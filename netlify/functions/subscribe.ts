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

function renderConfirmEmail(confirmUrl: string, siteUrl: string): { html: string; text: string } {
  const base = siteUrl.replace(/\/$/, "");
  const logoUrl = `${base}/assets/images/logo-copper-white.png`;
  const preheader = "Confirm your subscription to Argentina Metals investor alerts.";

  const html = `<!doctype html>
<html lang="en" style="color-scheme:light dark;supported-color-schemes:light dark;">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="x-apple-disable-message-reformatting">
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <title>Confirm your Argentina Metals investor alerts</title>
    <!--[if mso]>
    <noscript><xml><o:OfficeDocumentSettings xmlns:o="urn:schemas-microsoft-com:office:office"><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
    <style>* { font-family: Arial, Helvetica, sans-serif !important; }</style>
    <![endif]-->
    <style>
      body { margin:0 !important; padding:0 !important; width:100% !important; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
      table { border-collapse:collapse; border-spacing:0; mso-table-lspace:0pt; mso-table-rspace:0pt; }
      img { border:0; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; display:block; }
      a { text-decoration:none; }

      @media only screen and (max-width:480px) {
        .em-container { width:100% !important; border-radius:0 !important; border-left:0 !important; border-right:0 !important; }
        .em-pad { padding:28px 22px 4px !important; }
        .em-pad-footer { padding:20px 22px !important; }
        .em-pad-header { padding:22px 22px !important; }
        .em-h1 { font-size:22px !important; line-height:1.3 !important; }
        .em-btn { display:block !important; width:auto !important; }
        .em-logo { width:128px !important; height:auto !important; }
      }

      @media (prefers-color-scheme: dark) {
        body, .em-bg { background-color:#0c0b0a !important; }
        .em-container { background-color:#1a1917 !important; border-color:#2a2824 !important; }
        .em-footer { background-color:#15140f !important; border-top-color:#2a2824 !important; }
        .em-h1 { color:#f5f2ea !important; }
        .em-body { color:#c9c4b8 !important; }
        .em-muted { color:#a09b8f !important; }
        .em-faint { color:#7a766e !important; }
        .em-link { color:#fdb473 !important; }
      }
    </style>
  </head>
  <body class="em-bg" style="margin:0;padding:0;background-color:#f0ede5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1917;">
    <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;color:#f0ede5;">${preheader}&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="em-bg" style="background-color:#f0ede5;">
      <tr><td align="center" style="padding:32px 16px;">
        <!--[if mso | IE]><table role="presentation" align="center" width="560" cellspacing="0" cellpadding="0" border="0"><tr><td width="560"><![endif]-->
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" class="em-container" style="width:560px;max-width:560px;background-color:#ffffff;border-radius:20px;border:1px solid #e8e5dd;overflow:hidden;">
          <tr><td class="em-pad-header" align="left" style="padding:28px 40px;background-color:#1a1917;mso-line-height-rule:exactly;">
            <a href="${base}" style="text-decoration:none;border:0;outline:none;"><img src="${logoUrl}" alt="Argentina Metals" width="140" height="87" class="em-logo" style="display:block;width:140px;height:auto;border:0;outline:none;text-decoration:none;"></a>
          </td></tr>
          <tr><td class="em-pad" style="padding:40px 40px 8px;">
            <p class="em-muted" style="margin:0 0 4px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#c5642b;font-weight:700;mso-line-height-rule:exactly;">Investor alerts</p>
            <h1 class="em-h1" style="margin:0 0 16px;font-size:24px;line-height:1.25;font-weight:600;letter-spacing:-0.01em;color:#1a1917;mso-line-height-rule:exactly;">Confirm your subscription</h1>
            <p class="em-body" style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#524e47;mso-line-height-rule:exactly;">Please confirm your subscription so we can send you Argentina Metals press releases and corporate updates as soon as they're published.</p>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 32px;"><tr><td>
              <!--[if mso]>
              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${confirmUrl}" style="height:48px;v-text-anchor:middle;width:220px;" arcsize="22%" stroke="f" fillcolor="#c5642b">
                <w:anchorlock/>
                <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:600;">Confirm subscription</center>
              </v:roundrect>
              <![endif]-->
              <!--[if !mso]><!-- -->
              <a href="${confirmUrl}" class="em-btn" style="display:inline-block;padding:14px 28px;border-radius:10px;background-color:#c5642b;background-image:linear-gradient(135deg,#c5642b 0%,#d4783f 40%,#fdb473 100%);color:#ffffff;font-weight:600;font-size:15px;line-height:1;text-decoration:none;mso-hide:all;">Confirm subscription</a>
              <!--<![endif]-->
            </td></tr></table>
            <p class="em-muted" style="margin:0 0 8px;font-size:13px;color:#706c63;mso-line-height-rule:exactly;">Or paste this link into your browser:</p>
            <p class="em-body" style="margin:0 0 32px;font-size:13px;color:#524e47;word-break:break-all;mso-line-height-rule:exactly;"><a href="${confirmUrl}" class="em-link" style="color:#c5642b;text-decoration:underline;">${confirmUrl}</a></p>
            <p class="em-faint" style="margin:0;font-size:12px;line-height:1.6;color:#9a9588;mso-line-height-rule:exactly;">This link expires in 24 hours. If you didn't request this, you can safely ignore this email — no subscription will be created.</p>
          </td></tr>
          <tr><td class="em-pad-footer em-footer" style="padding:24px 40px;background-color:#fdfcf9;border-top:1px solid #e8e5dd;">
            <p class="em-muted" style="margin:0;font-size:12px;line-height:1.6;color:#706c63;mso-line-height-rule:exactly;">Argentina Metals Corp. &middot; TSX-V: VLLC</p>
          </td></tr>
        </table>
        <!--[if mso | IE]></td></tr></table><![endif]-->
      </td></tr>
    </table>
  </body>
</html>`;

  const text = `Confirm your Argentina Metals investor alerts subscription.

Click or paste this link into your browser to confirm:
${confirmUrl}

This link expires in 24 hours. If you didn't request this, you can safely ignore this email.

Argentina Metals Corp.
TSX-V: VLLC`;

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
  const { html, text } = renderConfirmEmail(confirmUrl, siteUrl);

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
