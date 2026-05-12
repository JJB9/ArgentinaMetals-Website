import type { Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { Resend } from "resend";
import crypto from "node:crypto";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface SignedPayload {
  email: string;
  expiresAt: number;
}

function signToken(payload: SignedPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function renderConfirmEmail(confirmUrl: string): { html: string; text: string } {
  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f0ede5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1917;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f0ede5;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff;border-radius:20px;border:1px solid #e8e5dd;overflow:hidden;">
          <tr><td style="padding:40px 40px 8px;">
            <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#c5642b;font-weight:700;">Argentina Metals</p>
            <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;font-weight:600;letter-spacing:-0.01em;color:#1a1917;">Confirm your investor alerts</h1>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#524e47;">Please confirm your subscription so we can send you Argentina Metals press releases and corporate updates as soon as they're published.</p>
            <p style="margin:0 0 32px;">
              <a href="${confirmUrl}" style="display:inline-block;padding:14px 28px;border-radius:10px;background:linear-gradient(135deg,#c5642b 0%,#d4783f 40%,#fdb473 100%);color:#ffffff;font-weight:600;font-size:15px;text-decoration:none;">Confirm subscription</a>
            </p>
            <p style="margin:0 0 8px;font-size:13px;color:#706c63;">Or paste this link into your browser:</p>
            <p style="margin:0 0 32px;font-size:13px;color:#524e47;word-break:break-all;"><a href="${confirmUrl}" style="color:#c5642b;text-decoration:underline;">${confirmUrl}</a></p>
            <p style="margin:0;font-size:12px;line-height:1.6;color:#9a9588;">This link expires in 24 hours. If you didn't request this, you can safely ignore this email — no subscription will be created.</p>
          </td></tr>
          <tr><td style="padding:24px 40px;background:#fdfcf9;border-top:1px solid #e8e5dd;">
            <p style="margin:0;font-size:12px;line-height:1.6;color:#706c63;">Argentina Metals Corp. &middot; TSX-V: VLLC (pending)</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  const text = `Confirm your Argentina Metals investor alerts subscription.

Click or paste this link into your browser to confirm:
${confirmUrl}

This link expires in 24 hours. If you didn't request this, you can safely ignore this email.

Argentina Metals Corp.
TSX-V: VLLC (pending)`;

  return { html, text };
}

export default async (req: Request, _context: Context): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let payload: { email?: unknown };
  try {
    payload = (await req.json()) as { email?: unknown };
  } catch {
    return Response.json({ ok: true });
  }

  const rawEmail = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  if (!rawEmail || rawEmail.length > 254 || !EMAIL_RE.test(rawEmail)) {
    return Response.json({ ok: true });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const secret = process.env.CONFIRM_TOKEN_SECRET;
  const siteUrl = process.env.SITE_URL;
  const fromAddress = process.env.RESEND_FROM_ADDRESS ?? "alerts@argentinametals.com";

  if (!apiKey || !secret || !siteUrl) {
    console.error("subscribe: missing required env vars");
    return Response.json({ ok: true });
  }

  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const token = signToken({ email: rawEmail, expiresAt }, secret);

  const store = getStore("pending-subscribers");
  await store.setJSON(rawEmail, { email: rawEmail, token, expiresAt, createdAt: Date.now() });

  const confirmUrl = `${siteUrl.replace(/\/$/, "")}/api/confirm?t=${encodeURIComponent(token)}`;
  const { html, text } = renderConfirmEmail(confirmUrl);

  const resend = new Resend(apiKey);
  const sent = await resend.emails.send({
    from: `Argentina Metals <${fromAddress}>`,
    to: rawEmail,
    subject: "Confirm your Argentina Metals investor alerts",
    html,
    text
  });

  if (sent.error) {
    console.error("subscribe: resend send error", sent.error);
  }

  return Response.json({ ok: true });
};
