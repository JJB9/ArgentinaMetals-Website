import type { Context } from "@netlify/functions";

const MAX_BODY_BYTES = 16 * 1024;

export default async (req: Request, _context: Context): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response(null, { status: 405 });
  }

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return new Response(null, { status: 204 });
  }

  if (raw.length > MAX_BODY_BYTES) {
    raw = raw.slice(0, MAX_BODY_BYTES);
  }

  const contentType = req.headers.get("content-type") ?? "";
  const userAgent = req.headers.get("user-agent") ?? "";

  let parsed: unknown = raw;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // keep raw string if not JSON
  }

  console.warn("csp-report", { contentType, userAgent, report: parsed });

  return new Response(null, { status: 204 });
};
