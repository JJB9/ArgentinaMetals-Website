import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

interface PendingEntry {
  email: string;
  token: string;
  expiresAt: number;
  createdAt: number;
}

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

export default async (): Promise<Response> => {
  const now = Date.now();
  let pendingScanned = 0;
  let pendingDeleted = 0;
  let rateScanned = 0;
  let rateDeleted = 0;

  const pending = getStore("pending-subscribers");
  for await (const page of pending.list({ paginate: true })) {
    for (const blob of page.blobs) {
      pendingScanned += 1;
      const entry = (await pending.get(blob.key, { type: "json" })) as PendingEntry | null;
      if (!entry || entry.expiresAt < now) {
        await pending.delete(blob.key);
        pendingDeleted += 1;
      }
    }
  }

  const rateLimit = getStore("rate-limit-subscribe");
  for await (const page of rateLimit.list({ paginate: true })) {
    for (const blob of page.blobs) {
      rateScanned += 1;
      const entry = (await rateLimit.get(blob.key, { type: "json" })) as RateLimitEntry | null;
      if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
        await rateLimit.delete(blob.key);
        rateDeleted += 1;
      }
    }
  }

  console.log("cleanup-pending: done", { pendingScanned, pendingDeleted, rateScanned, rateDeleted });
  return new Response(JSON.stringify({ ok: true, pendingScanned, pendingDeleted, rateScanned, rateDeleted }), {
    headers: { "content-type": "application/json" }
  });
};

export const config: Config = {
  schedule: "0 3 * * 0"
};
