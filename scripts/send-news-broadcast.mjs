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

function renderHtml({ title, excerpt, url, image, imageAlt }) {
  const safeTitle = escapeHtml(title);
  const safeExcerpt = escapeHtml(excerpt);
  const safeUrl = escapeHtml(url);
  const safeImageAlt = escapeHtml(imageAlt ?? title ?? "");

  const heroImageHtml = image
    ? `<tr><td style="padding:0;"><img src="${escapeHtml(image)}" alt="${safeImageAlt}" width="560" style="display:block;width:100%;max-width:560px;height:auto;border:0;"/></td></tr>`
    : "";

  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f0ede5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1917;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f0ede5;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff;border-radius:20px;border:1px solid #e8e5dd;overflow:hidden;">
          ${heroImageHtml}
          <tr><td style="padding:40px 40px 8px;">
            <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#c5642b;font-weight:700;">Press release</p>
            <h1 style="margin:0 0 18px;font-size:26px;line-height:1.25;font-weight:600;letter-spacing:-0.01em;color:#1a1917;">${safeTitle}</h1>
            <p style="margin:0 0 28px;font-size:15px;line-height:1.7;color:#524e47;">${safeExcerpt}</p>
            <p style="margin:0 0 32px;">
              <a href="${safeUrl}" style="display:inline-block;padding:14px 28px;border-radius:10px;background:linear-gradient(135deg,#c5642b 0%,#d4783f 40%,#fdb473 100%);color:#ffffff;font-weight:600;font-size:15px;text-decoration:none;">Read the full release</a>
            </p>
          </td></tr>
          <tr><td style="padding:24px 40px;background:#fdfcf9;border-top:1px solid #e8e5dd;">
            <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#706c63;">You're receiving this because you subscribed to Argentina Metals investor alerts.</p>
            <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#706c63;">Argentina Metals Corp. &middot; TSX-V: VLLC (pending)</p>
            <p style="margin:0;font-size:12px;line-height:1.6;color:#706c63;"><a href="{{RESEND_UNSUBSCRIBE_URL}}" style="color:#706c63;text-decoration:underline;">Unsubscribe</a></p>
          </td></tr>
        </table>
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
Argentina Metals Corp. — TSX-V: VLLC (pending)
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
    imageAlt: data.imageAlt
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
