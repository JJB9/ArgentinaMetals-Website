#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import matter from "gray-matter";
import { Resend } from "resend";

const REPO_ROOT = process.cwd();
const LOG_PATH = path.join(REPO_ROOT, ".news-broadcasts.json");
const PREVIEW_DIR = path.join(REPO_ROOT, ".broadcast-preview");

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

function formatDate(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  });
}

function renderInline(text) {
  let out = escapeHtml(text);
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" style="color:#a8521f;text-decoration:underline;" class="em-link">$1</a>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong style="font-weight:700;">$1</strong>');
  out = out.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>');
  return out;
}

function renderMarkdownBody(markdown) {
  const blocks = markdown.replace(/\r\n/g, "\n").trim().split(/\n{2,}/);
  return blocks
    .map((b) => b.trim())
    .filter(Boolean)
    .map((block) => {
      const heading = block.match(/^(#{1,4})\s+(.+)$/);
      if (heading) {
        const level = Math.min(heading[1].length, 4);
        const sizes = { 1: 22, 2: 19, 3: 17, 4: 15 };
        return `<h${level} class="em-h2" style="margin:32px 0 12px;font-size:${sizes[level]}px;line-height:1.35;font-weight:700;color:#1a1917;mso-line-height-rule:exactly;">${renderInline(heading[2])}</h${level}>`;
      }

      const lines = block.split("\n");
      if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
        const items = lines
          .map((l) => `<li style="margin:0 0 8px;">${renderInline(l.replace(/^\s*[-*]\s+/, "").trim())}</li>`)
          .join("");
        return `<ul class="em-body" style="margin:0 0 18px;padding-left:22px;color:#3a3732;font-size:15px;line-height:1.75;mso-line-height-rule:exactly;">${items}</ul>`;
      }

      const paragraphText = renderInline(block.replace(/\n/g, " "));
      const isStandaloneBold = /^<strong [^>]*>[^<]+<\/strong>$/.test(paragraphText);
      if (isStandaloneBold) {
        return `<p class="em-h2" style="margin:32px 0 12px;font-size:17px;line-height:1.4;font-weight:700;color:#1a1917;mso-line-height-rule:exactly;">${paragraphText.replace(/<\/?strong[^>]*>/g, "")}</p>`;
      }
      return `<p class="em-body" style="margin:0 0 18px;font-size:15px;line-height:1.75;color:#3a3732;mso-line-height-rule:exactly;">${paragraphText}</p>`;
    })
    .join("\n");
}

function renderHtml({ title, excerpt, body, date, ctaUrl, image, imageAlt, siteUrl }) {
  const safeTitle = escapeHtml(title);
  const safeCtaUrl = escapeHtml(ctaUrl);
  const safeImageAlt = escapeHtml(imageAlt ?? title ?? "");
  const base = siteUrl.replace(/\/$/, "");
  const logoUrl = `${base}/images/brand/logo-copper-white.png`;
  const preheader = excerpt.length > 140 ? `${excerpt.slice(0, 137).trimEnd()}...` : excerpt;
  const safePreheader = escapeHtml(preheader);
  const bodyHtml = renderMarkdownBody(body);
  const dateLabel = formatDate(date);
  const dateHtml = dateLabel
    ? `<p class="em-muted em-date" style="margin:0 0 18px;font-size:12px;line-height:1.5;letter-spacing:0.08em;text-transform:uppercase;color:#706c63;font-weight:600;mso-line-height-rule:exactly;">${escapeHtml(dateLabel)}</p>`
    : "";

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
        .em-pad { padding:32px 22px 8px !important; }
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
        .em-h1, .em-h2 { color:#f5f2ea !important; }
        .em-body { color:#c9c4b8 !important; }
        .em-muted { color:#a09b8f !important; }
        .em-link { color:#fdb473 !important; }
        .em-link-muted { color:#a09b8f !important; }
      }

      /* Gmail (Android/iOS, webmail) — inverts colors via [data-ogsc]/[data-ogsb].
         Mirror dark-mode rules so we keep contrast. */
      [data-ogsb] body, [data-ogsb] .em-bg { background-color:#0c0b0a !important; }
      [data-ogsb] .em-container { background-color:#1a1917 !important; border-color:#2a2824 !important; }
      [data-ogsb] .em-footer { background-color:#15140f !important; border-top-color:#2a2824 !important; }
      [data-ogsc] .em-h1, [data-ogsc] .em-h2 { color:#f5f2ea !important; }
      [data-ogsc] .em-body { color:#c9c4b8 !important; }
      [data-ogsc] .em-muted { color:#a09b8f !important; }
      [data-ogsc] .em-link { color:#fdb473 !important; }
      [data-ogsc] .em-link-muted { color:#a09b8f !important; }
      u + .em-bg { background-color:#ffffff; }
    </style>
  </head>
  <body class="em-bg" style="margin:0;padding:0;background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1917;">
    <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;color:#ffffff;">${safePreheader}&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="em-bg" style="background-color:#ffffff;">
      <tr><td align="center" style="padding:32px 16px;">
        <!--[if mso | IE]><table role="presentation" align="center" width="560" cellspacing="0" cellpadding="0" border="0"><tr><td width="560"><![endif]-->
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" class="em-container" style="width:560px;max-width:560px;background-color:#ffffff;border-radius:20px;border:1px solid #e8e5dd;overflow:hidden;">
          <tr><td class="em-pad-header" align="left" style="padding:28px 40px;background-color:#1a1917;mso-line-height-rule:exactly;">
            <a href="${base}" style="text-decoration:none;border:0;outline:none;"><img src="${logoUrl}" alt="Argentina Metals" width="140" height="87" class="em-logo" style="display:block;width:140px;height:auto;border:0;outline:none;text-decoration:none;"></a>
          </td></tr>
          ${heroImageHtml}
          <tr><td class="em-pad" style="padding:40px 40px 8px;">
            ${dateHtml}
            <h1 class="em-h1" style="margin:0 0 24px;font-size:26px;line-height:1.25;font-weight:600;letter-spacing:-0.01em;color:#1a1917;mso-line-height-rule:exactly;">${safeTitle}</h1>
            ${bodyHtml}
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:32px 0 8px;"><tr><td>
              <!--[if mso]>
              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeCtaUrl}" style="height:44px;v-text-anchor:middle;width:180px;" arcsize="23%" stroke="f" fillcolor="#a8521f">
                <w:anchorlock/>
                <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:13px;font-weight:600;letter-spacing:0.5px;">View all news</center>
              </v:roundrect>
              <![endif]-->
              <!--[if !mso]><!-- -->
              <a href="${safeCtaUrl}" class="em-btn" style="display:inline-block;padding:12px 28px;border-radius:10px;background-color:#a8521f;color:#ffffff;font-weight:600;font-size:13px;line-height:1.2;letter-spacing:0.01em;text-decoration:none;mso-hide:all;">View all news</a>
              <!--<![endif]-->
            </td></tr></table>
          </td></tr>
          <tr><td class="em-pad-footer em-footer" style="padding:24px 40px;background-color:#fdfcf9;border-top:1px solid #e8e5dd;">
            <p class="em-muted" style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#706c63;mso-line-height-rule:exactly;">You're receiving this because you subscribed to Argentina Metals investor alerts.</p>
            <p class="em-muted" style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#706c63;mso-line-height-rule:exactly;">Argentina Metals Corp. &middot; TSX-V: VLLC</p>
            <p class="em-muted" style="margin:0;font-size:12px;line-height:1.6;color:#706c63;mso-line-height-rule:exactly;"><a href="{{RESEND_UNSUBSCRIBE_URL}}" class="em-link-muted" style="color:#706c63;text-decoration:underline;">Unsubscribe</a></p>
          </td></tr>
        </table>
        <!--[if mso | IE]></td></tr></table><![endif]-->
      </td></tr>
    </table>
  </body>
</html>`;
}

function renderText({ title, body, date, ctaUrl }) {
  const plain = body
    .replace(/\r\n/g, "\n")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, "$1 ($2)")
    .trim();
  const dateLabel = formatDate(date);
  const datePrefix = dateLabel ? `${dateLabel}\n\n` : "";
  return `${datePrefix}${title}

${plain}

View all news:
${ctaUrl}

---
You're receiving this because you subscribed to Argentina Metals investor alerts.
Argentina Metals Corp. — TSX-V: VLLC
Unsubscribe: {{RESEND_UNSUBSCRIBE_URL}}`;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const flags = new Set(args.filter((a) => a.startsWith("--")));
  const positional = args.find((a) => !a.startsWith("--"));
  return {
    inputArg: positional,
    isDryRun: flags.has("--dry-run"),
    isDraftFlag: flags.has("--draft")
  };
}

async function main() {
  const { inputArg, isDryRun, isDraftFlag } = parseArgs(process.argv);
  if (!inputArg) {
    console.error("Usage: send-news-broadcast.mjs <path/to/news.md> [--dry-run] [--draft]");
    process.exit(1);
  }

  const absPath = path.resolve(REPO_ROOT, inputArg);
  if (!fs.existsSync(absPath)) {
    console.error(`File not found: ${absPath}`);
    process.exit(1);
  }

  const slug = path.basename(absPath, ".md");
  const log = loadLog();
  if (!isDryRun && log.some((entry) => entry.slug === slug)) {
    console.log(`Broadcast for ${slug} already created — skipping (idempotent).`);
    return;
  }

  const raw = fs.readFileSync(absPath, "utf-8");
  const { data, content } = matter(raw);

  if (data.draft === true) {
    console.log(`${slug} has draft: true — skipping.`);
    return;
  }

  if (!data.title || !data.excerpt) {
    console.error(`${slug} is missing required frontmatter (title or excerpt).`);
    process.exit(1);
  }

  if (!content || !content.trim()) {
    console.error(`${slug} has no body content — cannot send full release.`);
    process.exit(1);
  }

  const sendAsDraft = isDraftFlag || data.broadcastDraft === true;

  const siteUrl = process.env.SITE_URL ?? "https://argentinametals.com";
  const base = siteUrl.replace(/\/$/, "");
  const articleUrl = `${base}/news/${slug}`;
  const newsIndexUrl = `${base}/news`;

  const html = renderHtml({
    title: data.title,
    excerpt: data.excerpt,
    body: content,
    date: data.date,
    ctaUrl: newsIndexUrl,
    image: data.image,
    imageAlt: data.imageAlt,
    siteUrl
  });
  const text = renderText({ title: data.title, body: content, date: data.date, ctaUrl: newsIndexUrl });

  if (isDryRun) {
    if (!fs.existsSync(PREVIEW_DIR)) fs.mkdirSync(PREVIEW_DIR, { recursive: true });
    const htmlPath = path.join(PREVIEW_DIR, `${slug}.html`);
    const textPath = path.join(PREVIEW_DIR, `${slug}.txt`);
    fs.writeFileSync(htmlPath, html);
    fs.writeFileSync(textPath, text);
    console.log(`Dry run — wrote preview to:`);
    console.log(`  ${path.relative(REPO_ROOT, htmlPath)}`);
    console.log(`  ${path.relative(REPO_ROOT, textPath)}`);
    console.log(`Open the .html file in a browser to preview. No Resend call made.`);
    if (sendAsDraft) console.log(`(broadcastDraft set — live run would create draft in Resend without sending.)`);
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  const fromAddress = process.env.RESEND_FROM_ADDRESS ?? "alerts@argentinametals.com";

  if (!apiKey || !audienceId || !process.env.SITE_URL) {
    console.error("Missing required env vars: RESEND_API_KEY, RESEND_AUDIENCE_ID, SITE_URL");
    process.exit(1);
  }

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
  const nowIso = new Date().toISOString();

  if (sendAsDraft) {
    log.push({
      slug,
      broadcast_id: broadcastId,
      title: data.title,
      status: "draft",
      createdAt: nowIso
    });
    saveLog(log);
    console.log(`Created broadcast ${broadcastId} for ${slug} as DRAFT — review and send manually in Resend dashboard.`);
    return;
  }

  const sent = await resend.broadcasts.send(broadcastId);
  if (sent.error) {
    console.error("Failed to send broadcast:", sent.error);
    process.exit(1);
  }

  log.push({
    slug,
    broadcast_id: broadcastId,
    title: data.title,
    status: "sent",
    sentAt: nowIso
  });
  saveLog(log);

  console.log(`Sent broadcast for ${slug}: ${broadcastId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
