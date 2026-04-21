import { useEffect, useRef, useState } from "react";
import type { Map as MlMap, Marker as MlMarker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import minesData from "../../data/andes/mines.json";
import beltData from "../../data/andes/copper-belt.json";
import borderData from "../../data/andes/border.json";
import {
  readTokens,
  maptilerStyleUrl,
  TERRAIN_SOURCE_URL,
  CAMERA,
  hillshadeLayer,
  beltFillLayer,
  beltOutlineLayer,
  borderLayer,
  type AndesTokens,
} from "../../data/andes/style";

type MineFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: {
    id: string;
    name: string;
    operator?: string;
    country: string;
    type: "competitor" | "flagship" | "city";
    caption?: string;
  };
};

const MINES = minesData as { features: MineFeature[] };
const FALLBACK_SRC = "/assets/images/andes-hero-fallback.webp";

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
  root.className = `andes-hero-marker andes-hero-marker--${variant}`;
  if (variant === "city") {
    root.innerHTML = `
      <span class="andes-hero-marker-dot" aria-hidden="true"></span>
      <span class="andes-hero-marker-label">
        <strong>${f.properties.name}</strong>
        ${f.properties.caption ? `<em>${f.properties.caption}</em>` : ""}
      </span>
    `;
    return root;
  }
  const label = variant === "flagship"
    ? `<span class="andes-hero-marker-label">
        <span class="andes-hero-marker-badge">Argentina Metals</span>
        <strong>${f.properties.name}</strong>
        <em>${f.properties.caption ?? ""}</em>
      </span>`
    : `<span class="andes-hero-marker-label">
        <strong>${f.properties.name}</strong>
        ${f.properties.caption ? `<em>${f.properties.caption}</em>` : ""}
      </span>`;
  root.innerHTML = `${label}<span class="andes-hero-marker-pulse" aria-hidden="true"></span><span class="andes-hero-marker-dot" aria-hidden="true"></span>`;
  return root;
}

export default function AndesHero() {
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

        map.on("load", () => {
          if (cancelled || !map) return;

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

          for (const f of MINES.features) {
            const el = makeMarkerEl(f);
            const anchor = f.properties.type === "city" ? "left" : "bottom";
            const marker = new maplibre.Marker({ element: el, anchor })
              .setLngLat(f.geometry.coordinates)
              .addTo(map);
            markersRef.current.push(marker);
          }

          setStatus("ready");

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
              center: CAMERA.end.center,
              zoom: CAMERA.end.zoom,
              pitch: CAMERA.end.pitch,
              bearing: CAMERA.end.bearing,
            });
            enableInteraction();
          } else {
            map.once("moveend", enableInteraction);
            map.flyTo({
              center: CAMERA.end.center,
              zoom: CAMERA.end.zoom,
              pitch: CAMERA.end.pitch,
              bearing: CAMERA.end.bearing,
              duration: CAMERA.flyDurationMs,
              essential: true,
            });
          }
        });
      } catch (err) {
        console.warn("[AndesHero] init failed", err);
        if (!cancelled) setStatus("failed");
      }
    })();

    return () => {
      cancelled = true;
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
      {status === "failed" && (
        <img className="andes-hero-fallback" src={FALLBACK_SRC} alt="Southern Andes, Chile-Argentina border region with the Andean copper belt" />
      )}
      {status !== "failed" && <div className="andes-hero-canvas" ref={containerRef} aria-hidden="true" />}
      <div className="andes-hero-legend" role="note" aria-label="Karten-Legende">
        <span className="andes-hero-legend-item">
          <span className="andes-hero-legend-swatch andes-hero-legend-swatch--competitor" aria-hidden="true" />
          World-class Chilean mine
        </span>
        <span className="andes-hero-legend-item">
          <span className="andes-hero-legend-swatch andes-hero-legend-swatch--flagship" aria-hidden="true" />
          Argentina Metals — Las Estrellas
        </span>
        <span className="andes-hero-legend-item">
          <span className="andes-hero-legend-swatch andes-hero-legend-swatch--belt" aria-hidden="true" />
          Andean Copper Belt
        </span>
        <span className="andes-hero-legend-item">
          <span className="andes-hero-legend-swatch andes-hero-legend-swatch--border" aria-hidden="true" />
          Chile–Argentina Border
        </span>
        <span className="andes-hero-legend-note">Indicative belt extent · after USGS / SERNAGEOMIN</span>
      </div>
    </div>
  );
}
