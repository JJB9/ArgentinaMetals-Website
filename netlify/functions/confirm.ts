import type { Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { Resend } from "resend";
import crypto from "node:crypto";

interface PendingEntry {
  email: string;
  token: string;
  expiresAt: number;
  createdAt: number;
}

interface DecodedPayload {
  email: string;
  expiresAt: number;
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function verifyAndDecode(token: string, secret: string): DecodedPayload | null {
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  if (!timingSafeEqualStrings(sig, expected)) return null;
  try {
    const json = Buffer.from(body, "base64url").toString("utf-8");
    const parsed = JSON.parse(json) as DecodedPayload;
    if (typeof parsed.email !== "string" || typeof parsed.expiresAt !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export default async (req: Request, _context: Context): Promise<Response> => {
  const siteUrl = (process.env.SITE_URL ?? "").replace(/\/$/, "");
  const invalidRedirect = `${siteUrl}/subscribe/invalid`;
  const confirmedRedirect = `${siteUrl}/subscribe/confirmed`;

  const url = new URL(req.url);
  const token = url.searchParams.get("t");
  if (!token) return Response.redirect(invalidRedirect, 302);

  const secret = process.env.CONFIRM_TOKEN_SECRET;
  const apiKey = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  if (!secret || !apiKey || !audienceId || !siteUrl) {
    console.error("confirm: missing required env vars");
    return Response.redirect(invalidRedirect, 302);
  }

  const decoded = verifyAndDecode(token, secret);
  if (!decoded) return Response.redirect(invalidRedirect, 302);
  if (Date.now() > decoded.expiresAt) return Response.redirect(invalidRedirect, 302);

  const store = getStore("pending-subscribers");
  const pending = (await store.get(decoded.email, { type: "json" })) as PendingEntry | null;
  if (!pending || pending.token !== token) return Response.redirect(invalidRedirect, 302);

  const resend = new Resend(apiKey);
  const created = await resend.contacts.create({
    email: decoded.email,
    unsubscribed: false,
    audienceId
  });

  if (created.error) {
    const msg = typeof created.error === "object" && created.error && "message" in created.error
      ? String((created.error as { message?: unknown }).message ?? "")
      : "";
    if (!/already exists/i.test(msg)) {
      console.error("confirm: resend contacts.create error", created.error);
      return Response.redirect(invalidRedirect, 302);
    }
  }

  await store.delete(decoded.email);
  return Response.redirect(confirmedRedirect, 302);
};
