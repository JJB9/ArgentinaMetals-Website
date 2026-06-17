/**
 * Shared live-quote client.
 *
 * Fetches /api/quote once per page, polls while visible, and writes values into
 * any `[data-quote="…"]` / `[data-copper="…"]` placeholders present on the page
 * (footer, hero, news header, investor block). Directional colouring is applied
 * by setting `data-dir="up|down|flat"` on `[data-quote-dir]` / `[data-copper-dir]`.
 *
 * It also stashes the latest payload on `window.__vllcQuote` and dispatches a
 * `vllc:quote` CustomEvent so the StockChart island can render from the same
 * single network fetch instead of making its own.
 */

interface SeriesPoint {
  time: number;
  value: number;
}

interface QuoteSnapshot {
  currency: string;
  price: number;
  change: number;
  changePercent: number;
  open: number | null;
  previousClose: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  asOf: string;
  delayed: boolean;
  delayMinutes: number;
}

interface CopperSnapshot {
  currency: string;
  unit: string;
  price: number;
  change: number;
  changePercent: number;
}

export interface QuotePayload {
  status: "ok" | "stale" | "unavailable";
  market: { state: "open" | "closed" | "holiday"; exchange: string };
  quote: QuoteSnapshot | null;
  copper: CopperSnapshot | null;
  history: { daily: SeriesPoint[]; intraday: SeriesPoint[] };
  source: { label: string; url: string };
}

const ENDPOINT = "/api/quote";
const POLL_MS = 60_000;
const EPS = 1e-9;

let latest: QuotePayload | null = null;
let intervalId: number | null = null;
let started = false;

const currencySymbol = (c: string) => (c === "CAD" ? "C$" : c === "USD" ? "US$" : `${c} `);

const numFmt = (v: number, min = 2, max = 4) =>
  new Intl.NumberFormat("en-CA", { minimumFractionDigits: min, maximumFractionDigits: max }).format(v);

const decimalsFor = (v: number) => (Math.abs(v) < 1 ? 3 : 2);

const money = (v: number, currency: string) =>
  `${currencySymbol(currency)}${numFmt(v, 2, Math.max(2, decimalsFor(v)))}`;

const signed = (v: number, max = 4) => `${v >= 0 ? "+" : "−"}${numFmt(Math.abs(v), 2, max)}`;

const signedPct = (v: number) => `${v >= 0 ? "+" : "−"}${numFmt(Math.abs(v), 2, 2)}%`;

const dir = (v: number) => (v > EPS ? "up" : v < -EPS ? "down" : "flat");

const stateLabel = (s: string) => (s === "open" ? "Market open" : s === "holiday" ? "Market holiday" : "Market closed");

function formatAsOf(iso: string): string {
  try {
    const t = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Toronto",
      hour: "numeric",
      minute: "2-digit"
    }).format(new Date(iso));
    return `As of ${t} ET`;
  } catch {
    return "";
  }
}

function setAll(root: ParentNode, selector: string, text: string): void {
  root.querySelectorAll(selector).forEach((el) => {
    el.textContent = text;
  });
}

function applyQuote(root: ParentNode, p: QuotePayload): void {
  const q = p.quote;

  if (q && p.status !== "unavailable") {
    setAll(root, '[data-quote="price"]', money(q.price, q.currency));
    setAll(root, '[data-quote="change"]', signed(q.change, Math.max(2, decimalsFor(q.change))));
    setAll(root, '[data-quote="changePct"]', signedPct(q.changePercent));
    setAll(root, '[data-quote="open"]', q.open != null ? money(q.open, q.currency) : "—");
    setAll(root, '[data-quote="prevClose"]', q.previousClose != null ? money(q.previousClose, q.currency) : "—");
    setAll(
      root,
      '[data-quote="dayRange"]',
      q.dayLow != null && q.dayHigh != null ? `${numFmt(q.dayLow, 2, 4)} – ${numFmt(q.dayHigh, 2, 4)}` : "—"
    );
    setAll(root, '[data-quote="volume"]', q.volume != null ? new Intl.NumberFormat("en-CA").format(q.volume) : "—");
    setAll(root, '[data-quote="asOf"]', formatAsOf(q.asOf));
    const d = dir(q.change);
    root.querySelectorAll("[data-quote-dir]").forEach((el) => el.setAttribute("data-dir", d));
  } else {
    setAll(root, '[data-quote="price"]', "—");
    setAll(root, '[data-quote="change"]', "");
    setAll(root, '[data-quote="changePct"]', "Quote unavailable");
    root.querySelectorAll("[data-quote-dir]").forEach((el) => el.setAttribute("data-dir", "flat"));
  }

  root.querySelectorAll("[data-quote-state]").forEach((el) => {
    el.textContent = stateLabel(p.market.state);
    el.setAttribute("data-state", p.market.state);
  });

  // "Delayed 15 min" only makes sense while the market is open; otherwise it's the last close.
  root.querySelectorAll("[data-quote-delay]").forEach((el) => {
    el.textContent = p.market.state === "open" ? "Delayed 15 min" : "At close";
  });

  const c = p.copper;
  if (c && p.status !== "unavailable") {
    setAll(root, '[data-copper="price"]', money(c.price, c.currency));
    setAll(root, '[data-copper="unit"]', c.unit);
    setAll(root, '[data-copper="change"]', signed(c.change, 3));
    setAll(root, '[data-copper="changePct"]', signedPct(c.changePercent));
    root.querySelectorAll("[data-copper-dir]").forEach((el) => el.setAttribute("data-dir", dir(c.change)));
  }
}

async function tick(): Promise<void> {
  try {
    const res = await fetch(ENDPOINT, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`quote ${res.status}`);
    const payload = (await res.json()) as QuotePayload;
    latest = payload;
    (window as unknown as { __vllcQuote?: QuotePayload }).__vllcQuote = payload;
    applyQuote(document, payload);
    window.dispatchEvent(new CustomEvent<QuotePayload>("vllc:quote", { detail: payload }));
  } catch {
    // Keep the last good values on screen; try again next interval.
  }
}

function startPolling(): void {
  if (intervalId != null) return;
  intervalId = window.setInterval(() => {
    if (!document.hidden) void tick();
  }, POLL_MS);
}

function onPageLoad(): void {
  if (latest) applyQuote(document, latest);
  if (started) return;
  started = true;
  void tick();
  startPolling();
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void tick();
  });
}

document.addEventListener("astro:page-load", onPageLoad);
// Fallback for the very first load if astro:page-load already fired.
if (document.readyState !== "loading") onPageLoad();
