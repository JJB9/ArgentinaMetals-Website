import { useEffect, useRef, useState } from "react";
import type { Time } from "lightweight-charts";

/**
 * Investor-page price chart (lightweight-charts).
 *
 * Renders from the shared `/api/quote` fetch: it listens for the `vllc:quote`
 * event dispatched by src/scripts/quote.ts (and reads window.__vllcQuote if the
 * event already fired before hydration), falling back to its own fetch only if
 * nothing arrives shortly — so the page makes a single network call.
 */

interface SeriesPoint {
  time: number;
  value: number;
}

interface QuotePayload {
  status: "ok" | "stale" | "unavailable";
  quote: { price: number; currency: string } | null;
  history: { daily: SeriesPoint[]; intraday: SeriesPoint[] };
}

type TimeframeKey = "1D" | "1M" | "6M" | "1Y";

const TIMEFRAMES: { key: TimeframeKey; days: number }[] = [
  { key: "1D", days: 0 },
  { key: "1M", days: 31 },
  { key: "6M", days: 184 },
  { key: "1Y", days: 366 }
];

const cssVar = (name: string, fallback: string): string => {
  if (typeof document === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
};

function seriesFor(payload: QuotePayload, tf: TimeframeKey): SeriesPoint[] {
  if (tf === "1D") {
    const intra = payload.history.intraday;
    if (intra.length >= 2) return intra;
    return payload.history.daily.slice(-6);
  }
  const daily = payload.history.daily;
  if (!daily.length) return [];
  const days = TIMEFRAMES.find((t) => t.key === tf)?.days ?? 366;
  const last = daily[daily.length - 1].time;
  const cutoff = last - days * 86400;
  const windowed = daily.filter((p) => p.time >= cutoff);
  return windowed.length >= 2 ? windowed : daily;
}

export default function StockChart() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRef = useRef<any>(null);

  const [payload, setPayload] = useState<QuotePayload | null>(null);
  const [timeframe, setTimeframe] = useState<TimeframeKey>("1D");
  const [sparse, setSparse] = useState(false);
  const [currency, setCurrency] = useState("CAD");
  const [chartReady, setChartReady] = useState(false);

  // Subscribe to the shared quote feed.
  useEffect(() => {
    const win = window as unknown as { __vllcQuote?: QuotePayload };
    if (win.__vllcQuote) setPayload(win.__vllcQuote);
    const onQuote = (e: Event) => setPayload((e as CustomEvent<QuotePayload>).detail);
    window.addEventListener("vllc:quote", onQuote);

    // Self-contained fallback: if the shared script never fired, fetch once.
    const fallback = window.setTimeout(() => {
      if (!win.__vllcQuote) {
        fetch("/api/quote", { headers: { accept: "application/json" } })
          .then((r) => (r.ok ? r.json() : null))
          .then((p) => p && setPayload(p as QuotePayload))
          .catch(() => {});
      }
    }, 1200);

    return () => {
      window.removeEventListener("vllc:quote", onQuote);
      window.clearTimeout(fallback);
    };
  }, []);

  // Create the chart once.
  useEffect(() => {
    let disposed = false;
    let ro: ResizeObserver | null = null;

    (async () => {
      const mod = await import("lightweight-charts");
      const container = containerRef.current;
      if (disposed || !container) return;

      const copper = cssVar("--copper", "#d4783f");
      // TSX-V trades in Toronto; render the time axis in ET to match the rest of the page.
      const asDate = (ts: unknown) => new Date((typeof ts === "number" ? ts : 0) * 1000);
      const etTime = (ts: unknown) =>
        new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", hour: "numeric", minute: "2-digit", hour12: false }).format(asDate(ts));
      const etDate = (ts: unknown) =>
        new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", month: "short", day: "numeric" }).format(asDate(ts));
      const chart = mod.createChart(container, {
        width: container.clientWidth,
        height: 260,
        autoSize: false,
        localization: {
          locale: "en-CA",
          timeFormatter: (ts: Time) => `${etDate(ts)}, ${etTime(ts)} ET`
        },
        layout: {
          background: { type: mod.ColorType.Solid, color: "transparent" },
          textColor: cssVar("--g500", "#706c63"),
          fontFamily: "Sora, -apple-system, sans-serif",
          attributionLogo: false
        },
        grid: {
          vertLines: { visible: false },
          horzLines: { color: cssVar("--sand", "#f0ede5") }
        },
        rightPriceScale: { borderVisible: false },
        timeScale: {
          borderVisible: false,
          timeVisible: true,
          secondsVisible: false,
          // tickMarkType >= 3 is an intraday time tick; below that it's a date tick.
          tickMarkFormatter: (ts: Time, tickMarkType: number) => (tickMarkType >= 3 ? etTime(ts) : etDate(ts))
        },
        crosshair: {
          mode: mod.CrosshairMode.Magnet,
          vertLine: { color: cssVar("--g300", "#b8b3a7"), width: 1, style: 2, labelVisible: false },
          horzLine: { color: cssVar("--g300", "#b8b3a7"), width: 1, style: 2 }
        },
        handleScroll: false,
        handleScale: false
      });

      const areaOpts = {
        lineColor: copper,
        topColor: "rgba(212, 120, 63, 0.22)",
        bottomColor: "rgba(212, 120, 63, 0.02)",
        lineWidth: 2 as const,
        priceLineVisible: false,
        lastValueVisible: true,
        crosshairMarkerRadius: 4,
        crosshairMarkerBorderColor: copper,
        crosshairMarkerBackgroundColor: cssVar("--white", "#ffffff")
      };
      const series = chart.addSeries(mod.AreaSeries, areaOpts);

      chartRef.current = chart;
      seriesRef.current = series;
      setChartReady(true);

      // Minimal crosshair tooltip.
      chart.subscribeCrosshairMove((param: any) => {
        const tip = tooltipRef.current;
        if (!tip) return;
        const point = param.point;
        const value = param.seriesData?.get(series);
        if (!param.time || !point || !value || point.x < 0 || point.y < 0) {
          tip.style.opacity = "0";
          return;
        }
        const price = typeof value === "object" ? value.value : value;
        tip.textContent = `C$${Number(price).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
        tip.style.opacity = "1";
        const x = Math.min(Math.max(point.x + 12, 0), container.clientWidth - 64);
        tip.style.transform = `translate(${x}px, ${Math.max(point.y - 34, 0)}px)`;
      });

      ro = new ResizeObserver((entries) => {
        for (const entry of entries) chart.applyOptions({ width: entry.contentRect.width });
      });
      ro.observe(container);
    })();

    return () => {
      disposed = true;
      ro?.disconnect();
      chartRef.current?.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Redraw on new data or timeframe change.
  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series || !payload) return;
    if (payload.quote?.currency) setCurrency(payload.quote.currency);

    const data = seriesFor(payload, timeframe);
    series.setData(data);
    chart.applyOptions({
      timeScale: { timeVisible: timeframe === "1D", secondsVisible: false }
    });
    chart.timeScale().fitContent();
    setSparse(data.length < 2);
  }, [payload, timeframe, chartReady]);

  const unavailable = payload?.status === "unavailable" || (payload != null && payload.history.daily.length === 0 && payload.history.intraday.length === 0);

  return (
    <figure className="quote-chart" aria-label="VLLC price chart">
      <div className="quote-chart-head">
        <figcaption className="quote-chart-cap">
          Share price <span className="quote-chart-cur">({currency})</span>
        </figcaption>
        <div className="quote-chart-tabs" role="tablist" aria-label="Chart timeframe">
          {TIMEFRAMES.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={timeframe === t.key}
              className={`quote-chart-tab${timeframe === t.key ? " is-active" : ""}`}
              onClick={() => setTimeframe(t.key)}
            >
              {t.key}
            </button>
          ))}
        </div>
      </div>
      <div className="quote-chart-plot">
        <div ref={containerRef} className="quote-chart-canvas" />
        <div ref={tooltipRef} className="quote-chart-tip" aria-hidden="true" />
        {unavailable && <p className="quote-chart-note">Chart temporarily unavailable.</p>}
        {!unavailable && sparse && <p className="quote-chart-note">More history will appear as trading continues.</p>}
      </div>
    </figure>
  );
}
