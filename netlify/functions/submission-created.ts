import type { Handler } from "@netlify/functions";
import { Resend } from "resend";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TOPIC_LABELS: Record<string, string> = {
  general: "General Inquiry",
  investment: "Investment & IR",
  partnership: "Partnership Opportunity",
  media: "Media & Press",
  technical: "Technical / Projects",
  other: "Other"
};

interface SubmissionPayload {
  payload?: {
    form_name?: string;
    data?: Record<string, unknown>;
  };
}

interface ContactFields {
  firstName: string;
  lastName: string;
  email: string;
  topic: string;
  message: string;
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderContactEmail(input: ContactFields): { html: string; text: string; subject: string } {
  const fullName = `${input.firstName} ${input.lastName}`.trim() || "(no name)";
  const subject = `[Contact] ${fullName} — ${input.topic}`;
  const preheader = `New contact form submission from ${fullName}.`;

  const nameDisplay = esc(fullName);
  const emailDisplay = esc(input.email);
  const topicDisplay = esc(input.topic);
  const messageHtml = esc(input.message).replace(/\r?\n/g, "<br>");

  const html = `<!doctype html>
<html lang="en" dir="ltr" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" style="color-scheme:light dark;supported-color-schemes:light dark;">
  <head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="x-apple-disable-message-reformatting">
    <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <title>New contact form submission</title>
    <!--[if mso]>
    <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch><o:AllowPNG/></o:OfficeDocumentSettings></xml></noscript>
    <style>* { font-family: Arial, Helvetica, sans-serif !important; } table { border-collapse:collapse !important; }</style>
    <![endif]-->
    <style>
      body { margin:0 !important; padding:0 !important; width:100% !important; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
      table { border-collapse:collapse; border-spacing:0; mso-table-lspace:0pt; mso-table-rspace:0pt; }
      td { mso-line-height-rule:exactly; }
      img { border:0; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; display:block; }
      a { text-decoration:none; }

      .em-msg { word-break:break-word; overflow-wrap:break-word; }
      .em-mail-link { word-break:break-all; overflow-wrap:anywhere; }

      @media only screen and (max-width:480px) {
        .em-container { width:100% !important; border-radius:0 !important; border-left:0 !important; border-right:0 !important; }
        .em-pad { padding:28px 22px 4px !important; }
        .em-pad-footer { padding:20px 22px !important; }
        .em-pad-header { padding:20px 22px !important; }
        .em-h1 { font-size:22px !important; line-height:1.3 !important; }
        .em-wordmark { font-size:12px !important; letter-spacing:0.14em !important; }
        .em-row-label { width:auto !important; display:block !important; padding:0 0 4px !important; }
        .em-row-value { display:block !important; padding:0 0 16px !important; }
        .em-msg-cell { padding:14px 16px !important; }
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
        .em-label { color:#a09b8f !important; }
        .em-value { color:#f5f2ea !important; }
        .em-message-box { background-color:#15140f !important; border-color:#2a2824 !important; color:#c9c4b8 !important; }
      }

      /* Outlook.com / Outlook 365 web — uses its own data-attrs, not prefers-color-scheme */
      [data-ogsc] .em-h1 { color:#f5f2ea !important; }
      [data-ogsc] .em-body { color:#c9c4b8 !important; }
      [data-ogsc] .em-muted { color:#a09b8f !important; }
      [data-ogsc] .em-faint { color:#7a766e !important; }
      [data-ogsc] .em-link { color:#fdb473 !important; }
      [data-ogsc] .em-label { color:#a09b8f !important; }
      [data-ogsc] .em-value { color:#f5f2ea !important; }
      [data-ogsb] body, [data-ogsb] .em-bg { background-color:#0c0b0a !important; }
      [data-ogsb] .em-container { background-color:#1a1917 !important; border-color:#2a2824 !important; }
      [data-ogsb] .em-footer { background-color:#15140f !important; border-top-color:#2a2824 !important; }
      [data-ogsb] .em-message-box { background-color:#15140f !important; border-color:#2a2824 !important; }
    </style>
  </head>
  <body class="em-bg" style="margin:0;padding:0;background-color:#f0ede5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1917;">
    <div style="display:none !important;font-size:0;line-height:0;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;visibility:hidden;color:#f0ede5;">${esc(preheader)}&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="em-bg" style="background-color:#f0ede5;">
      <tr><td align="center" style="padding:32px 16px;">
        <!--[if mso | IE]><table role="presentation" align="center" width="560" cellspacing="0" cellpadding="0" border="0"><tr><td width="560" style="width:560px;"><![endif]-->
        <table role="presentation" align="center" width="560" cellspacing="0" cellpadding="0" border="0" class="em-container" style="width:560px;max-width:560px;background-color:#ffffff;border-radius:20px;border:1px solid #e8e5dd;overflow:hidden;">
          <tr><td class="em-pad-header" align="left" style="padding:24px 40px;background-color:#1a1917;mso-line-height-rule:exactly;">
            <p class="em-wordmark" style="margin:0;font-size:14px;line-height:1;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#ffffff;mso-line-height-rule:exactly;">Argentina <span style="color:#c5642b;">Metals</span></p>
          </td></tr>
          <tr><td class="em-pad" style="padding:40px 40px 8px;">
            <p class="em-muted" style="margin:0 0 4px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#c5642b;font-weight:700;mso-line-height-rule:exactly;">Contact form</p>
            <h1 class="em-h1" style="margin:0 0 24px;font-size:24px;line-height:1.25;font-weight:600;letter-spacing:-0.01em;color:#1a1917;mso-line-height-rule:exactly;">New submission</h1>

            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px;">
              <tr>
                <td class="em-row-label em-label" style="padding:0 12px 12px 0;width:90px;font-size:12px;color:#9a9588;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;vertical-align:top;mso-line-height-rule:exactly;">From</td>
                <td class="em-row-value em-value em-msg" style="padding:0 0 12px 0;font-size:15px;line-height:1.5;color:#1a1917;vertical-align:top;mso-line-height-rule:exactly;">${nameDisplay}<br><a href="mailto:${emailDisplay}" class="em-link em-mail-link" style="color:#c5642b;text-decoration:underline;word-break:break-all;">${emailDisplay}</a></td>
              </tr>
              <tr>
                <td class="em-row-label em-label" style="padding:0 12px 12px 0;width:90px;font-size:12px;color:#9a9588;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;vertical-align:top;mso-line-height-rule:exactly;">Topic</td>
                <td class="em-row-value em-value em-msg" style="padding:0 0 12px 0;font-size:15px;line-height:1.5;color:#1a1917;vertical-align:top;mso-line-height-rule:exactly;">${topicDisplay}</td>
              </tr>
            </table>

            <p class="em-label" style="margin:0 0 8px;font-size:12px;color:#9a9588;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;mso-line-height-rule:exactly;">Message</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 32px;">
              <tr><td class="em-message-box em-body em-msg em-msg-cell" align="left" style="padding:16px 20px;background-color:#fdfcf9;border:1px solid #e8e5dd;border-radius:10px;font-size:15px;line-height:1.6;color:#1a1917;mso-line-height-rule:exactly;word-break:break-word;overflow-wrap:break-word;">${messageHtml}</td></tr>
            </table>

            <p class="em-faint" style="margin:0;font-size:12px;line-height:1.6;color:#9a9588;mso-line-height-rule:exactly;">Reply to this email to respond directly to the sender &mdash; Reply-To is set to their address.</p>
          </td></tr>
          <tr><td class="em-pad-footer em-footer" align="left" style="padding:24px 40px;background-color:#fdfcf9;border-top:1px solid #e8e5dd;">
            <p class="em-muted" style="margin:0;font-size:12px;line-height:1.6;color:#706c63;mso-line-height-rule:exactly;">Argentina Metals Corp. &middot; TSX-V: VLLC</p>
          </td></tr>
        </table>
        <!--[if mso | IE]></td></tr></table><![endif]-->
      </td></tr>
    </table>
  </body>
</html>`;

  const text = `New contact form submission

From: ${fullName}
Email: ${input.email}
Topic: ${input.topic}

Message:
${input.message}

—
Reply to this email to respond directly to the sender.

Argentina Metals Corp.
TSX-V: VLLC`;

  return { html, text, subject };
}

const OK = { statusCode: 200, body: JSON.stringify({ ok: true }) };

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  let body: SubmissionPayload;
  try {
    body = JSON.parse(event.body ?? "{}") as SubmissionPayload;
  } catch {
    console.error("submission-created: invalid JSON body");
    return OK;
  }

  if (body?.payload?.form_name !== "contact") {
    return OK;
  }

  const data = body.payload.data ?? {};
  const firstName = String(data["first-name"] ?? "").trim().slice(0, 200);
  const lastName = String(data["last-name"] ?? "").trim().slice(0, 200);
  const email = String(data.email ?? "").trim().toLowerCase().slice(0, 254);
  const topicKey = String(data.topic ?? "").trim();
  const message = String(data.message ?? "").trim().slice(0, 10000);

  if (!email || !EMAIL_RE.test(email) || !message) {
    console.error("submission-created: payload failed validation", { hasEmail: !!email, emailValid: EMAIL_RE.test(email), hasMessage: !!message });
    return OK;
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromAddr = process.env.RESEND_CONTACT_FROM_ADDRESS ?? "contact@argentinametals.com";
  const toAddr = process.env.CONTACT_TO_ADDRESS ?? "amc@janbertram.com";

  if (!apiKey) {
    console.error("submission-created: missing RESEND_API_KEY");
    return OK;
  }

  const topicLabel = TOPIC_LABELS[topicKey] ?? (topicKey || "—");

  const { html, text, subject } = renderContactEmail({
    firstName,
    lastName,
    email,
    topic: topicLabel,
    message
  });

  const resend = new Resend(apiKey);
  const sent = await resend.emails.send({
    from: `Argentina Metals Contact Form <${fromAddr}>`,
    to: toAddr,
    replyTo: email,
    subject,
    html,
    text
  });

  if (sent.error) {
    console.error("submission-created: resend send error", sent.error);
  } else {
    console.log("submission-created: sent", { id: sent.data?.id, to: toAddr, from: fromAddr });
  }

  return OK;
};
