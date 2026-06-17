import type { Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

/**
 * Live quote proxy for VLLC (TSX-V) + COMEX copper.
 *
 * The browser only ever calls this same-origin endpoint (/api/quote); the
 * upstream data provider is reached server-to-server, so no API key or
 * provider domain is ever exposed to the client and no CSP change is needed.
 *
 * Provider is abstracted behind `fetchUpstream()`. The default adapter uses
 * Yahoo Finance's public chart endpoint, which covers TSX-V micro-caps and
 * copper with no API key. To switch to a licensed feed (e.g. Twelve Data),
 * reimplement `fetchUpstream()` — the response contract below is unchanged.
 */

const QUOTE_SYMBOL = process.env.QUOTE_SYMBOL || "VLLC.V";
const COPPER_SYMBOL = process.env.COPPER_SYMBOL || "HG=F";

const TTL_OPEN_MS = 60 * 1000; // refresh at most once a minute while the market is open
const TTL_CLOSED_MS = 15 * 60 * 1000; // when closed, the last close barely moves
const DAILY_TTL_MS = 60 * 60 * 1000; // daily history changes at most once a day
const UPSTREAM_TIMEOUT_MS = 4000;

const STORE_NAME = "quotes";
const BLOB_KEY = "vllc";

const SOURCE = { label: "Yahoo Finance", url: "https://finance.yahoo.com" };

// TSX / TSX-V observed market holidays (America/Toronto local dates). A missing
// entry only costs a few harmless upstream calls that return an unchanged close.
const TSX_HOLIDAYS_2026 = new Set([
  "2026-01-01", // New Year's Day
  "2026-02-16", // Family Day
  "2026-04-03", // Good Friday
  "2026-05-18", // Victoria Day
  "2026-07-01", // Canada Day
  "2026-08-03", // Civic Holiday
  "2026-09-07", // Labour Day
  "2026-10-12", // Thanksgiving
  "2026-12-25", // Christmas Day
  "2026-12-28" // Boxing Day (observed)
]);

type MarketState = "open" | "closed" | "holiday";

interface SeriesPoint {
  time: number; // unix seconds
  value: number;
}

interface QuoteSnapshot {
  symbol: string;
  displaySymbol: string;
  name: string;
  currency: string;
  price: number;
  change: number;
  changePercent: number;
  open: number | null;
  previousClose: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  asOf: string; // ISO
  delayed: boolean;
  delayMinutes: number;
}

interface CopperSnapshot {
  name: string;
  currency: string;
  unit: string;
  price: number;
  change: number;
  changePercent: number;
  asOf: string;
  delayed: boolean;
}

interface QuotePayload {
  schemaVersion: 1;
  status: "ok" | "stale" | "unavailable";
  fetchedAt: string;
  market: { state: MarketState; exchange: "TSXV" };
  quote: QuoteSnapshot | null;
  copper: CopperSnapshot | null;
  history: { daily: SeriesPoint[]; intraday: SeriesPoint[] };
  source: { label: string; url: string };
}

interface CachedBlob extends QuotePayload {
  fetchedAtMs: number;
  dailyFetchedAtMs: number;
}

/** Read hour/minute/weekday/date in America/Toronto without any dependency. */
function torontoParts(now: Date): { weekday: number; minutes: number; ymd: string } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const hour = parseInt(parts.hour === "24" ? "0" : parts.hour, 10);
  const minutes = hour * 60 + parseInt(parts.minute, 10);
  return {
    weekday: weekdayMap[parts.weekday as string] ?? 0,
    minutes,
    ymd: `${parts.year}-${parts.month}-${parts.day}`
  };
}

function marketState(now: Date): MarketState {
  const { weekday, minutes, ymd } = torontoParts(now);
  if (weekday === 0 || weekday === 6) return "closed";
  if (TSX_HOLIDAYS_2026.has(ymd)) return "holiday";
  // Regular session 09:30–16:00 ET.
  if (minutes >= 9 * 60 + 30 && minutes < 16 * 60) return "open";
  return "closed";
}

interface YahooMeta {
  currency?: string;
  symbol?: string;
  shortName?: string;
  longName?: string;
  regularMarketPrice?: number;
  regularMarketOpen?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketVolume?: number;
  regularMarketTime?: number;
  previousClose?: number;
  chartPreviousClose?: number;
}

interface YahooChart {
  meta: YahooMeta;
  series: SeriesPoint[];
}

async function fetchYahooChart(symbol: string, range: string, interval: string): Promise<YahooChart> {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?range=${range}&interval=${interval}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ArgentinaMetalsBot/1.0)" }
    });
    if (!res.ok) throw new Error(`upstream ${symbol} ${res.status}`);
    const json = (await res.json()) as any;
    const result = json?.chart?.result?.[0];
    if (!result?.meta) throw new Error(`upstream ${symbol} malformed`);
    const ts: number[] = result.timestamp || [];
    const closes: (number | null)[] = result.indicators?.quote?.[0]?.close || [];
    const series: SeriesPoint[] = ts
      .map((t, i) => ({ time: t, value: closes[i] }))
      .filter((p): p is SeriesPoint => typeof p.value === "number" && Number.isFinite(p.value));
    return { meta: result.meta as YahooMeta, series };
  } finally {
    clearTimeout(timer);
  }
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function buildQuote(meta: YahooMeta, intraday: SeriesPoint[]): QuoteSnapshot | null {
  const price = num(meta.regularMarketPrice);
  if (price === null) return null;
  const prev = num(meta.previousClose) ?? num(meta.chartPreviousClose);
  const change = prev !== null ? price - prev : 0;
  const changePercent = prev ? (change / prev) * 100 : 0;
  const open = num(meta.regularMarketOpen) ?? (intraday.length ? intraday[0].value : null);
  const asOf = meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : new Date().toISOString();
  return {
    symbol: "VLLC",
    displaySymbol: "TSX-V: VLLC",
    name: "Argentina Metals Corp.",
    currency: meta.currency || "CAD",
    price,
    change,
    changePercent,
    open,
    previousClose: prev,
    dayHigh: num(meta.regularMarketDayHigh),
    dayLow: num(meta.regularMarketDayLow),
    volume: num(meta.regularMarketVolume),
    asOf,
    delayed: true,
    delayMinutes: 15
  };
}

function buildCopper(meta: YahooMeta): CopperSnapshot | null {
  const price = num(meta.regularMarketPrice);
  if (price === null) return null;
  const prev = num(meta.previousClose) ?? num(meta.chartPreviousClose);
  const change = prev !== null ? price - prev : 0;
  const changePercent = prev ? (change / prev) * 100 : 0;
  const asOf = meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : new Date().toISOString();
  return {
    name: "Copper (COMEX)",
    currency: meta.currency || "USD",
    unit: "USD/lb",
    price,
    change,
    changePercent,
    asOf,
    delayed: true
  };
}

/** Fetch and assemble a fresh payload. Reuses prior daily history when still warm. */
async function refresh(state: MarketState, prev: CachedBlob | null): Promise<CachedBlob> {
  const nowMs = Date.now();
  const dailyWarm = prev && nowMs - prev.dailyFetchedAtMs < DAILY_TTL_MS && prev.history.daily.length > 0;

  const tasks: Promise<YahooChart | null>[] = [
    fetchYahooChart(QUOTE_SYMBOL, "1d", "5m").catch(() => null), // live quote + intraday
    fetchYahooChart(COPPER_SYMBOL, "5d", "1d").catch(() => null), // copper quote
    dailyWarm ? Promise.resolve(null) : fetchYahooChart(QUOTE_SYMBOL, "1y", "1d").catch(() => null)
  ];
  const [intra, copperChart, daily] = await Promise.all(tasks);

  if (!intra) {
    // Could not get the primary quote — surface the failure to the caller.
    throw new Error("primary quote fetch failed");
  }

  const quote = buildQuote(intra.meta, intra.series);
  const copper = copperChart ? buildCopper(copperChart.meta) : prev?.copper ?? null;
  const dailySeries = dailyWarm ? prev!.history.daily : daily?.series ?? prev?.history.daily ?? [];

  return {
    schemaVersion: 1,
    status: "ok",
    fetchedAt: new Date(nowMs).toISOString(),
    fetchedAtMs: nowMs,
    dailyFetchedAtMs: dailyWarm ? prev!.dailyFetchedAtMs : nowMs,
    market: { state, exchange: "TSXV" },
    quote,
    copper,
    history: { daily: dailySeries, intraday: intra.series },
    source: SOURCE
  };
}

function toResponse(blob: CachedBlob, status: QuotePayload["status"], state: MarketState): Response {
  const body: QuotePayload = {
    schemaVersion: 1,
    status,
    fetchedAt: blob.fetchedAt,
    market: { state, exchange: "TSXV" },
    quote: blob.quote,
    copper: blob.copper,
    history: blob.history,
    source: blob.source
  };
  return Response.json(body, {
    headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" }
  });
}

export default async (_req: Request, _context: Context): Promise<Response> => {
  const now = new Date();
  const state = marketState(now);
  const ttl = state === "open" ? TTL_OPEN_MS : TTL_CLOSED_MS;

  const store = getStore(STORE_NAME);
  let cached: CachedBlob | null = null;
  try {
    cached = (await store.get(BLOB_KEY, { type: "json" })) as CachedBlob | null;
  } catch (err) {
    console.error("quote: blob read failed", err);
  }

  // Fresh enough — serve cache, no upstream call.
  if (cached && Date.now() - cached.fetchedAtMs < ttl) {
    return toResponse(cached, "ok", state);
  }

  try {
    const fresh = await refresh(state, cached);
    try {
      await store.setJSON(BLOB_KEY, fresh);
    } catch (err) {
      console.error("quote: blob write failed", err);
    }
    return toResponse(fresh, "ok", state);
  } catch (err) {
    console.error("quote: upstream refresh failed", err);
    // Stale-while-revalidate: never overwrite good data with an error.
    if (cached) return toResponse(cached, "stale", state);
    const empty: CachedBlob = {
      schemaVersion: 1,
      status: "unavailable",
      fetchedAt: new Date().toISOString(),
      fetchedAtMs: Date.now(),
      dailyFetchedAtMs: 0,
      market: { state, exchange: "TSXV" },
      quote: null,
      copper: null,
      history: { daily: [], intraday: [] },
      source: SOURCE
    };
    return toResponse(empty, "unavailable", state);
  }
};
