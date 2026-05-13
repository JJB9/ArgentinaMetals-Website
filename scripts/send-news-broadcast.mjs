#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import matter from "gray-matter";
import { Resend } from "resend";

const REPO_ROOT = process.cwd();
const LOG_PATH = path.join(REPO_ROOT, ".news-broadcasts.json");

function loadLog() {
  if (!fs.existsSync(LOG_PATH)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(LOG_PATH, "utf-8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLog(log) {
  fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2) + "\n");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderHtml({ title, excerpt, url, image, imageAlt, siteUrl }) {
  const safeTitle = escapeHtml(title);
  const safeExcerpt = escapeHtml(excerpt);
  const safeUrl = escapeHtml(url);
  const safeImageAlt = escapeHtml(imageAlt ?? title ?? "");
  const base = siteUrl.replace(/\/$/, "");
  const logoUrl = `${base}/assets/images/logo-copper-white.png`;
  const preheader = excerpt.length > 140 ? `${excerpt.slice(0, 137).trimEnd()}...` : excerpt;
  const safePreheader = escapeHtml(preheader);

  const heroImageHtml = image
    ? `<tr><td style="padding:0;font-size:0;line-height:0;"><img src="${escapeHtml(image)}" alt="${safeImageAlt}" width="560" style="display:block;width:100%;max-width:560px;height:auto;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;"/></td></tr>`
    : "";

  return `<!doctype html>
<html lang="en" style="color-scheme:light dark;supported-color-schemes:light dark;">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="x-apple-disable-message-reformatting">
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <title>${safeTitle}</title>
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
        .em-link { color:#fdb473 !important; }
      }
    </style>
  </head>
  <body class="em-bg" style="margin:0;padding:0;background-color:#f0ede5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1917;">
    <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;color:#f0ede5;">${safePreheader}&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="em-bg" style="background-color:#f0ede5;">
      <tr><td align="center" style="padding:32px 16px;">
        <!--[if mso | IE]><table role="presentation" align="center" width="560" cellspacing="0" cellpadding="0" border="0"><tr><td width="560"><![endif]-->
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" class="em-container" style="width:560px;max-width:560px;background-color:#ffffff;border-radius:20px;border:1px solid #e8e5dd;overflow:hidden;">
          <tr><td class="em-pad-header" align="left" style="padding:28px 40px;background-color:#1a1917;mso-line-height-rule:exactly;">
            <a href="${base}" style="text-decoration:none;border:0;outline:none;"><img src="${logoUrl}" alt="Argentina Metals" width="140" height="87" class="em-logo" style="display:block;width:140px;height:auto;border:0;outline:none;text-decoration:none;"></a>
          </td></tr>
          ${heroImageHtml}
          <tr><td class="em-pad" style="padding:40px 40px 8px;">
            <p class="em-muted" style="margin:0 0 6px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#c5642b;font-weight:700;mso-line-height-rule:exactly;">Press release</p>
            <h1 class="em-h1" style="margin:0 0 18px;font-size:26px;line-height:1.25;font-weight:600;letter-spacing:-0.01em;color:#1a1917;mso-line-height-rule:exactly;">${safeTitle}</h1>
            <p class="em-body" style="margin:0 0 28px;font-size:15px;line-height:1.7;color:#524e47;mso-line-height-rule:exactly;">${safeExcerpt}</p>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 32px;"><tr><td>
              <!--[if mso]>
              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeUrl}" style="height:48px;v-text-anchor:middle;width:230px;" arcsize="22%" stroke="f" fillcolor="#c5642b">
                <w:anchorlock/>
                <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:600;">Read the full release</center>
              </v:roundrect>
              <![endif]-->
              <!--[if !mso]><!-- -->
              <a href="${safeUrl}" class="em-btn" style="display:inline-block;padding:14px 28px;border-radius:10px;background-color:#c5642b;background-image:linear-gradient(135deg,#c5642b 0%,#d4783f 40%,#fdb473 100%);color:#ffffff;font-weight:600;font-size:15px;line-height:1;text-decoration:none;mso-hide:all;">Read the full release</a>
              <!--<![endif]-->
            </td></tr></table>
          </td></tr>
          <tr><td class="em-pad-footer em-footer" style="padding:24px 40px;background-color:#fdfcf9;border-top:1px solid #e8e5dd;">
            <p class="em-muted" style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#706c63;mso-line-height-rule:exactly;">You're receiving this because you subscribed to Argentina Metals investor alerts.</p>
            <p class="em-muted" style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#706c63;mso-line-height-rule:exactly;">Argentina Metals Corp. &middot; TSX-V: VLLC</p>
            <p class="em-muted" style="margin:0;font-size:12px;line-height:1.6;color:#706c63;mso-line-height-rule:exactly;"><a href="{{RESEND_UNSUBSCRIBE_URL}}" class="em-link" style="color:#706c63;text-decoration:underline;">Unsubscribe</a></p>
          </td></tr>
        </table>
        <!--[if mso | IE]></td></tr></table><![endif]-->
      </td></tr>
    </table>
  </body>
</html>`;
}

function renderText({ title, excerpt, url }) {
  return `${title}

${excerpt}

Read the full release:
${url}

---
You're receiving this because you subscribed to Argentina Metals investor alerts.
Argentina Metals Corp. — TSX-V: VLLC
Unsubscribe: {{RESEND_UNSUBSCRIBE_URL}}`;
}

async function main() {
  const inputArg = process.argv[2];
  if (!inputArg) {
    console.error("Usage: send-news-broadcast.mjs <path/to/news.md>");
    process.exit(1);
  }

  const absPath = path.resolve(REPO_ROOT, inputArg);
  if (!fs.existsSync(absPath)) {
    console.error(`File not found: ${absPath}`);
    process.exit(1);
  }

  const slug = path.basename(absPath, ".md");
  const log = loadLog();
  if (log.some((entry) => entry.slug === slug)) {
    console.log(`Broadcast for ${slug} already sent — skipping (idempotent).`);
    return;
  }

  const raw = fs.readFileSync(absPath, "utf-8");
  const { data } = matter(raw);

  if (data.draft === true) {
    console.log(`${slug} has draft: true — skipping.`);
    return;
  }

  if (!data.title || !data.excerpt) {
    console.error(`${slug} is missing required frontmatter (title or excerpt).`);
    process.exit(1);
  }

  const apiKey = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  const siteUrl = process.env.SITE_URL;
  const fromAddress = process.env.RESEND_FROM_ADDRESS ?? "alerts@argentinametals.com";

  if (!apiKey || !audienceId || !siteUrl) {
    console.error("Missing required env vars: RESEND_API_KEY, RESEND_AUDIENCE_ID, SITE_URL");
    process.exit(1);
  }

  const articleUrl = `${siteUrl.replace(/\/$/, "")}/news/${slug}`;
  const html = renderHtml({
    title: data.title,
    excerpt: data.excerpt,
    url: articleUrl,
    image: data.image,
    imageAlt: data.imageAlt,
    siteUrl
  });
  const text = renderText({ title: data.title, excerpt: data.excerpt, url: articleUrl });

  const resend = new Resend(apiKey);

  const created = await resend.broadcasts.create({
    audienceId,
    from: `Argentina Metals <${fromAddress}>`,
    subject: data.title,
    html,
    text
  });

  if (created.error || !created.data?.id) {
    console.error("Failed to create broadcast:", created.error);
    process.exit(1);
  }

  const broadcastId = created.data.id;
  const sent = await resend.broadcasts.send(broadcastId);
  if (sent.error) {
    console.error("Failed to send broadcast:", sent.error);
    process.exit(1);
  }

  log.push({
    slug,
    broadcast_id: broadcastId,
    title: data.title,
    sentAt: new Date().toISOString()
  });
  saveLog(log);

  console.log(`Sent broadcast for ${slug}: ${broadcastId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
