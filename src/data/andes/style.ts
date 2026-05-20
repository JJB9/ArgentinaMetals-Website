import type { StyleSpecification } from "maplibre-gl";

export type AndesTokens = {
  copperDark: string;
  copper: string;
  copperLight: string;
  copperWash: string;
  green: string;
  greenDark: string;
  greenPale: string;
  sand: string;
  warm: string;
  g700: string;
  g500: string;
  tenure: string;
  tenureDark: string;
};

export function readTokens(): AndesTokens {
  const s = getComputedStyle(document.documentElement);
  const v = (name: string, fb: string) => s.getPropertyValue(name).trim() || fb;
  return {
    copperDark: v("--copper-dark", "#c5642b"),
    copper: v("--copper", "#d4783f"),
    copperLight: v("--copper-light", "#fdb473"),
    copperWash: v("--copper-wash", "#fff8f1"),
    green: v("--green", "#00562b"),
    greenDark: v("--green-dark", "#003d1e"),
    greenPale: v("--green-pale", "#d8e8de"),
    sand: v("--sand", "#f0ede5"),
    warm: v("--warm", "#f8f6f1"),
    g700: v("--g700", "#504b3f"),
    g500: v("--g500", "#7d766a"),
    tenure: v("--tenure", "#e6b720"),
    tenureDark: v("--tenure-dark", "#6b4a0a"),
  };
}

export function maptilerStyleUrl(key: string): string {
  return `https://api.maptiler.com/maps/outdoor-v2/style.json?key=${encodeURIComponent(key)}`;
}

export const TERRAIN_SOURCE_URL = (key: string) =>
  `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${encodeURIComponent(key)}`;

export const CAMERA = {
  start: { center: [-71.2, -40.2] as [number, number], zoom: 4.3, pitch: 38, bearing: 0 },
  end: { center: [-70.5, -34.6] as [number, number], zoom: 7.0, pitch: 50, bearing: 0 },
  flyDurationMs: 2500,
};

export function hillshadeLayer(): StyleSpecification["layers"][number] {
  return {
    id: "amc-hillshade",
    type: "hillshade",
    source: "amc-terrain",
    paint: {
      "hillshade-exaggeration": 0.55,
      "hillshade-shadow-color": "#4a2a14",
      "hillshade-highlight-color": "#fff1dd",
      "hillshade-accent-color": "#7a3e1a",
    },
  } as unknown as StyleSpecification["layers"][number];
}

export function argentinaHighlightLayer(tokens: AndesTokens): StyleSpecification["layers"][number] {
  return {
    id: "amc-argentina-tint",
    type: "fill",
    source: "amc-argentina",
    paint: {
      "fill-color": tokens.greenPale,
      "fill-opacity": 0.18,
    },
  } as unknown as StyleSpecification["layers"][number];
}

export function beltFillLayer(tokens: AndesTokens): StyleSpecification["layers"][number] {
  return {
    id: "amc-belt-fill",
    type: "fill",
    source: "amc-belt",
    paint: {
      "fill-color": [
        "interpolate",
        ["linear"],
        ["get", "intensity"],
        0.2,
        tokens.copperWash,
        0.5,
        tokens.copperLight,
        1.0,
        tokens.copper,
      ] as unknown as string,
      "fill-opacity": [
        "interpolate",
        ["linear"],
        ["get", "intensity"],
        0.0,
        0.0,
        0.2,
        0.18,
        0.5,
        0.34,
        1.0,
        0.58,
      ] as unknown as number,
      "fill-antialias": true,
    },
  } as unknown as StyleSpecification["layers"][number];
}

export function borderLayer(): StyleSpecification["layers"][number] {
  return {
    id: "amc-border",
    type: "line",
    source: "amc-border",
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-color": "#504b3f",
      "line-width": 2.4,
      "line-opacity": 1,
      "line-dasharray": [2, 1.4],
    },
  } as unknown as StyleSpecification["layers"][number];
}

export function beltOutlineLayer(tokens: AndesTokens): StyleSpecification["layers"][number] {
  return {
    id: "amc-belt-outline",
    type: "line",
    source: "amc-belt",
    filter: ["in", ["get", "id"],
      ["literal", ["belt-mendoza-0", "belt-mendoza-1", "belt-mendoza-2", "belt-mendoza-3"]]
    ] as unknown as never,
    paint: {
      "line-color": tokens.copperDark,
      "line-width": 1.0,
      "line-opacity": 0.45,
    },
  } as unknown as StyleSpecification["layers"][number];
}

export function tenureFillLayer(tokens: AndesTokens): StyleSpecification["layers"][number] {
  return {
    id: "amc-tenure-fill",
    type: "fill",
    source: "amc-tenure",
    paint: {
      "fill-color": tokens.green,
      "fill-opacity": 0.55,
      "fill-antialias": true,
    },
  } as unknown as StyleSpecification["layers"][number];
}

export function tenureOutlineLayer(tokens: AndesTokens): StyleSpecification["layers"][number] {
  return {
    id: "amc-tenure-outline",
    type: "line",
    source: "amc-tenure",
    paint: {
      "line-color": tokens.greenDark,
      "line-width": 1.4,
      "line-opacity": 0.95,
    },
  } as unknown as StyleSpecification["layers"][number];
}
