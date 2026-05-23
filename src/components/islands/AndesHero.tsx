import { useEffect, useRef, useState } from "react";
import type { Map as MlMap, Marker as MlMarker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import minesData from "../../data/andes/mines.json";
import beltData from "../../data/andes/copper-belt.json";
import borderData from "../../data/andes/border.json";
import tenuresData from "../../data/andes/tenures.json";
import {
  readTokens,
  maptilerStyleUrl,
  TERRAIN_SOURCE_URL,
  CAMERA,
  hillshadeLayer,
  beltFillLayer,
  beltOutlineLayer,
  borderLayer,
  tenureFillLayer,
  tenureOutlineLayer,
  type AndesTokens,
  type CameraView,
} from "../../data/andes/style";

type MineFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: {
    id: string;
    name: string;
    operator?: string;
    country: string;
    type: "competitor" | "flagship" | "city" | "deposit";
    caption?: string;
    labelBelow?: boolean;
    labelPos?: "2" | "3";
    compact?: boolean;
    minZoom?: number;
    tagline?: string;
  };
};

const MINES = minesData as { features: MineFeature[] };
const DEFAULT_FALLBACK_SRC = "/images/projects/map_fallback_horizontal.webp";

interface AndesHeroProps {
  fallbackSrc?: string;
  fallbackAlt?: string;
  cameraEnd?: CameraView;
}

function webglAvailable(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function makeMarkerEl(f: MineFeature): HTMLDivElement {
  const root = document.createElement("div");
  const variant = f.properties.type;
  const compact = f.properties.compact === true;
  const labelPos = f.properties.labelPos;
  root.className = `andes-hero-marker andes-hero-marker--${variant}${compact ? " andes-hero-marker--compact" : ""}${labelPos ? ` andes-hero-marker--pos-${labelPos}` : ""}`;
  if (compact) {
    root.innerHTML = `<svg class="andes-hero-marker-star" viewBox="0 0 24 24" aria-hidden="true">
        <polygon points="12,2 14.6,8.6 22,9 16,14 18,21 12,17.5 6,21 8,14 2,9 9.4,8.6"/>
      </svg>
      <span class="visually-hidden">${f.properties.name}</span>`;
  } else if ((labelPos === "2" || labelPos === "3") && variant === "deposit") {
    const star = `<svg class="andes-hero-marker-star" viewBox="0 0 24 24" aria-hidden="true">
        <polygon points="12,2 14.6,8.6 22,9 16,14 18,21 12,17.5 6,21 8,14 2,9 9.4,8.6"/>
      </svg>`;
    const label = `<span class="andes-hero-marker-label">
        <strong>${f.properties.name}</strong>
        ${f.properties.caption ? `<em>${f.properties.caption}</em>` : ""}
      </span>`;
    root.innerHTML = `${star}${label}`;
  } else if (variant === "city") {
    root.innerHTML = `
      <span class="andes-hero-marker-dot" aria-hidden="true"></span>
      <span class="andes-hero-marker-label">
        <strong>${f.properties.name}</strong>
        ${f.properties.caption ? `<em>${f.properties.caption}</em>` : ""}
      </span>
    `;
  } else if (variant === "deposit") {
    const star = `<svg class="andes-hero-marker-star" viewBox="0 0 24 24" aria-hidden="true">
        <polygon points="12,2 14.6,8.6 22,9 16,14 18,21 12,17.5 6,21 8,14 2,9 9.4,8.6"/>
      </svg>`;
    const label = `<span class="andes-hero-marker-label">
        <strong>${f.properties.name}</strong>
        ${f.properties.caption ? `<em>${f.properties.caption}</em>` : ""}
      </span>`;
    root.innerHTML = f.properties.labelBelow ? `${star}${label}` : `${label}${star}`;
  } else if (variant === "flagship") {
    root.innerHTML = `
      <span class="andes-hero-marker-pulse" aria-hidden="true"></span>
      <span class="andes-hero-marker-dot" aria-hidden="true"></span>
      <span class="andes-hero-marker-label">
        <span class="andes-hero-marker-badge">Argentina Metals</span>
        <strong>${f.properties.name}</strong>
        <em>${f.properties.caption ?? ""}</em>
      </span>
    `;
  } else {
    root.innerHTML = `<span class="andes-hero-marker-label">
        <strong>${f.properties.name}</strong>
        ${f.properties.caption ? `<em>${f.properties.caption}</em>` : ""}
      </span><span class="andes-hero-marker-pulse" aria-hidden="true"></span><span class="andes-hero-marker-dot" aria-hidden="true"></span>`;
  }
  if (f.properties.tagline) {
    const tip = document.createElement("span");
    tip.className = "andes-hero-marker-tagline";
    tip.setAttribute("role", "tooltip");
    tip.textContent = f.properties.tagline;
    root.appendChild(tip);
    root.classList.add("andes-hero-marker--has-tagline");
  }
  return root;
}

export default function AndesHero({
  fallbackSrc = DEFAULT_FALLBACK_SRC,
  fallbackAlt = "Southern Andes, Chile-Argentina border region with the Andean copper belt",
  cameraEnd = CAMERA.end,
}: AndesHeroProps = {}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markersRef = useRef<MlMarker[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const key = import.meta.env.PUBLIC_MAPTILER_KEY as string | undefined;
    if (!webglAvailable() || !key) {
      if (!key) console.warn("[AndesHero] PUBLIC_MAPTILER_KEY is not set — falling back to static image.");
      setStatus("failed");
      return;
    }

    let cancelled = false;
    let map: MlMap | null = null;
    let flyObserver: IntersectionObserver | null = null;

    (async () => {
      try {
        const maplibre = await import("maplibre-gl");
        if (cancelled || !containerRef.current) return;

        const tokens: AndesTokens = readTokens();

        map = new maplibre.Map({
          container: containerRef.current,
          style: maptilerStyleUrl(key),
          center: CAMERA.start.center,
          zoom: CAMERA.start.zoom,
          pitch: CAMERA.start.pitch,
          bearing: CAMERA.start.bearing,
          interactive: false,
          cooperativeGestures: true,
          attributionControl: { compact: true },
          maxPitch: 80,
          antialias: true,
        });
        mapRef.current = map;

        map.on("error", (e) => {
          console.warn("[AndesHero] map error:", e.error?.message ?? e);
        });

        let loaded = false;
        let visible = false;
        let flown = false;
        const runFly = () => {
          if (flown || cancelled || !map || !loaded || !visible) return;
          flown = true;

          const enableInteraction = () => {
            if (!map) return;
            map.scrollZoom.enable();
            map.dragPan.enable();
            map.dragRotate.enable();
            map.touchZoomRotate.enable();
            map.keyboard.enable();
            map.doubleClickZoom.enable();
            map.getCanvas().style.cursor = "grab";
          };

          if (prefersReducedMotion()) {
            map.jumpTo({
              center: cameraEnd.center,
              zoom: cameraEnd.zoom,
              pitch: cameraEnd.pitch,
              bearing: cameraEnd.bearing,
            });
            enableInteraction();
          } else {
            map.once("moveend", enableInteraction);
            map.flyTo({
              center: cameraEnd.center,
              zoom: cameraEnd.zoom,
              pitch: cameraEnd.pitch,
              bearing: cameraEnd.bearing,
              duration: CAMERA.flyDurationMs,
              essential: true,
            });
          }
        };

        flyObserver = typeof IntersectionObserver !== "undefined"
          ? new IntersectionObserver((entries) => {
              for (const entry of entries) {
                if (entry.isIntersecting) {
                  visible = true;
                  flyObserver?.disconnect();
                  flyObserver = null;
                  runFly();
                  break;
                }
              }
            }, { threshold: 0.35 })
          : null;
        if (flyObserver && containerRef.current) {
          flyObserver.observe(containerRef.current);
        } else {
          visible = true;
        }

        map.on("load", () => {
          if (cancelled || !map) return;

          const attribEl = containerRef.current?.querySelector<HTMLDetailsElement>(".maplibregl-ctrl-attrib");
          if (attribEl) {
            attribEl.open = false;
            attribEl.classList.remove("maplibregl-compact-show");
          }

          if (!map.getSource("amc-terrain")) {
            map.addSource("amc-terrain", {
              type: "raster-dem",
              url: TERRAIN_SOURCE_URL(key),
              tileSize: 256,
            });
          }
          map.setTerrain({ source: "amc-terrain", exaggeration: 1.35 });

          try {
            map.addLayer(hillshadeLayer());
          } catch (err) {
            console.warn("[AndesHero] hillshade add failed", err);
          }

          map.addSource("amc-belt", {
            type: "geojson",
            data: beltData as unknown as GeoJSON.FeatureCollection,
          });
          map.addLayer(beltFillLayer(tokens));
          map.addLayer(beltOutlineLayer(tokens));

          map.addSource("amc-border", {
            type: "geojson",
            data: borderData as unknown as GeoJSON.FeatureCollection,
          });
          map.addLayer(borderLayer());

          map.addSource("amc-tenure", {
            type: "geojson",
            data: tenuresData as unknown as GeoJSON.FeatureCollection,
          });
          map.addLayer(tenureFillLayer(tokens));
          map.addLayer(tenureOutlineLayer(tokens));

          const setSky = (map as unknown as { setSky?: (s: Record<string, unknown>) => void }).setSky;
          if (typeof setSky === "function") {
            try {
              setSky.call(map, {
                "sky-color": tokens.copperWash,
                "sky-horizon-blend": 0.8,
                "horizon-color": tokens.copperLight,
                "horizon-fog-blend": 0.6,
                "fog-color": tokens.sand,
                "fog-ground-blend": 0.1,
                "atmosphere-blend": 0.6,
              });
            } catch {
              /* sky/fog not supported on older MapLibre */
            }
          }

          const visibilityEntries: Array<{ marker: MlMarker; minZoom: number }> = [];
          for (const f of MINES.features) {
            const el = makeMarkerEl(f);
            const horizontalLabel = f.properties.labelPos === "2" || f.properties.labelPos === "3";
            const anchor =
              f.properties.compact ? "center" :
              horizontalLabel ? "left" :
              f.properties.type === "city" ? "left" :
              f.properties.type === "flagship" ? "top-right" :
              f.properties.labelBelow ? "top" :
              "bottom";
            // Offsets shift the box so the visible dot/star CENTER lands on lat/lng.
            // Dot (competitor): 12×12 → half = 6.  Star (deposit): 16×16 → half = 8.
            // Flagship dot: 14×14 → half = 7.
            const halfDot = f.properties.type === "competitor" ? 6 : 8;
            const offset: [number, number] =
              f.properties.compact ? [0, 0] :
              f.properties.type === "flagship" ? [7, -7] :
              horizontalLabel ? [-halfDot, 0] :
              f.properties.type === "city" ? [-halfDot, 0] :
              f.properties.labelBelow ? [0, -halfDot] :
              [0, halfDot];
            const marker = new maplibre.Marker({
              element: el,
              anchor,
              offset,
              pitchAlignment: "viewport",
              rotationAlignment: "viewport",
            })
              .setLngLat(f.geometry.coordinates)
              .addTo(map);
            markersRef.current.push(marker);
            const minZoom = typeof f.properties.minZoom === "number" ? f.properties.minZoom : 0;
            if (minZoom > 0) visibilityEntries.push({ marker, minZoom });

            if (f.properties.tagline) {
              const positionTagline = () => {
                const mapEl = containerRef.current;
                const tip = el.querySelector<HTMLElement>(".andes-hero-marker-tagline");
                if (!mapEl || !tip) return;
                el.removeAttribute("data-tagline-pos");
                tip.style.removeProperty("left");
                tip.style.removeProperty("--tip-arrow-shift");
                const mapRect = mapEl.getBoundingClientRect();
                const markerRect = el.getBoundingClientRect();
                const tipW = tip.offsetWidth;
                const tipH = tip.offsetHeight;
                const gap = 8;
                const pad = 4;
                const centerX = markerRect.left + markerRect.width / 2;
                const topIfAbove = markerRect.top - gap - tipH;
                const topIfBelow = markerRect.bottom + gap;
                let pos: "above" | "below" = "above";
                if (topIfAbove < mapRect.top + pad && topIfBelow + tipH <= mapRect.bottom - pad) {
                  pos = "below";
                }
                const naturalLeft = centerX - tipW / 2;
                let shiftX = 0;
                if (naturalLeft + tipW > mapRect.right - pad) {
                  shiftX = mapRect.right - pad - (naturalLeft + tipW);
                } else if (naturalLeft < mapRect.left + pad) {
                  shiftX = mapRect.left + pad - naturalLeft;
                }
                if (pos === "below") el.setAttribute("data-tagline-pos", "below");
                if (shiftX !== 0) {
                  tip.style.left = `calc(50% + ${shiftX}px)`;
                  tip.style.setProperty("--tip-arrow-shift", `${shiftX}px`);
                }
              };
              const clearTagline = () => {
                el.removeAttribute("data-tagline-pos");
                const tip = el.querySelector<HTMLElement>(".andes-hero-marker-tagline");
                if (tip) {
                  tip.style.removeProperty("left");
                  tip.style.removeProperty("--tip-arrow-shift");
                }
              };
              el.addEventListener("mouseenter", positionTagline);
              el.addEventListener("focusin", positionTagline);
              el.addEventListener("mouseleave", clearTagline);
              el.addEventListener("focusout", clearTagline);
            }
          }

          if (visibilityEntries.length > 0) {
            const applyZoomVisibility = () => {
              if (!map) return;
              const z = map.getZoom();
              for (const { marker, minZoom } of visibilityEntries) {
                const node = marker.getElement();
                const shouldShow = z >= minZoom;
                if (node.dataset.zoomHidden !== (shouldShow ? "false" : "true")) {
                  node.dataset.zoomHidden = shouldShow ? "false" : "true";
                  node.style.display = shouldShow ? "" : "none";
                }
              }
            };
            applyZoomVisibility();
            map.on("zoom", applyZoomVisibility);
            map.on("zoomend", applyZoomVisibility);
          }

          setStatus("ready");
          loaded = true;
          runFly();
        });
      } catch (err) {
        console.warn("[AndesHero] init failed", err);
        if (!cancelled) setStatus("failed");
      }
    })();

    return () => {
      cancelled = true;
      flyObserver?.disconnect();
      flyObserver = null;
      for (const m of markersRef.current) m.remove();
      markersRef.current = [];
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div className="andes-hero" data-status={status}>
      <img
        className="andes-hero-fallback"
        src={fallbackSrc}
        alt={fallbackAlt}
        loading="lazy"
        decoding="async"
      />
      {status !== "failed" && <div className="andes-hero-canvas" ref={containerRef} aria-hidden="true" />}
    </div>
  );
}
