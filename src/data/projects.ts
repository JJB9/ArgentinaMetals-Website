export type ProjectPhase = "Flagship" | "Satellite" | "Early-Stage";

export interface Project {
  id: string;
  tag: ProjectPhase;
  title: string;
  text: string;
  image: string;
  imageAlt: string;
  meta: [string, string][];
  lat: number;
  lng: number;
}

// Coordinates are approximate, clustered around the Western Malargüe Mining
// District (Mendoza Province, Argentina). TODO: verify against NI 43-101 map.
export const flagship: Project = {
  id: "las-estrellas",
  tag: "Flagship",
  title: "Las Estrellas",
  text: "Manto-type copper oxides in the Rio Damas Formation and porphyry copper-gold signatures in the Huincan Formation. Surface sampling returned up to 9,978 ppm Cu.",
  image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1400&q=80",
  imageAlt: "Las Estrellas project area in the Andes",
  meta: [["layers", "Manto + Porphyry Cu-Au"], ["science", "144 rock chips"]],
  lat: -35.50,
  lng: -70.10
};

export const projects: Project[] = [
  {
    id: "el-burrero",
    tag: "Satellite",
    title: "El Burrero Group",
    text: "Historic copper mining area within the Río Damas Formation. Manto-type stratabound mineralization with high-grade potential at accessible depth.",
    image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=800&q=80",
    imageAlt: "El Burrero project terrain",
    meta: [["layers", "Manto-type Cu"], ["location_on", "W. Malargüe"]],
    lat: -35.45,
    lng: -70.18
  },
  {
    id: "northern-cluster",
    tag: "Satellite",
    title: "Northern Cluster",
    text: "Multiple GIS-defined anomalies across acquired concessions. Structural corridor aligned with regional NW-SE lineaments controlling hydrothermal fluid pathways.",
    image: "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=800&q=80",
    imageAlt: "Northern cluster project terrain",
    meta: [["hub", "Structural targets"], ["location_on", "W. Malargüe"]],
    lat: -35.30,
    lng: -70.12
  },
  {
    id: "porphyry-corridor",
    tag: "Satellite",
    title: "Porphyry Corridor",
    text: "Targets defined by GIS modelling, analogous to the El Perdido system currently being drill-tested by Kobrea Exploration to the west.",
    image: "https://images.unsplash.com/photo-1454496522488-7a8e488e8606?auto=format&fit=crop&w=800&q=80",
    imageAlt: "Porphyry corridor terrain",
    meta: [["volcano", "Porphyry model"], ["location_on", "W. Malargüe"]],
    lat: -35.56,
    lng: -70.22
  },
  {
    id: "southern-extensions",
    tag: "Early-Stage",
    title: "Southern Extensions",
    text: "Staked ground extending the land package south along strike of known copper-bearing formations. Early-stage reconnaissance confirms prospective geology.",
    image: "https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?auto=format&fit=crop&w=800&q=80",
    imageAlt: "Southern extensions terrain",
    meta: [["south", "Along-strike"], ["explore", "Reconnaissance"]],
    lat: -35.68,
    lng: -70.14
  },
  {
    id: "additional-concessions",
    tag: "Early-Stage",
    title: "Additional Concessions",
    text: "Remaining project areas under GIS evaluation. Priority ranking is based on geochemical signatures, structural positioning, and proximity to confirmed mineralization.",
    image: "https://images.unsplash.com/photo-1542224566-6e85f2e6772f?auto=format&fit=crop&w=800&q=80",
    imageAlt: "Additional concessions terrain",
    meta: [["grid_view", "GIS evaluation"], ["schedule", "Pipeline"]],
    lat: -35.40,
    lng: -70.04
  },
  {
    id: "western-corridor",
    tag: "Early-Stage",
    title: "Western Corridor",
    text: "Acquired concessions along the western margin of the district. Prospective for both manto-type and deeper porphyry-style mineralization.",
    image: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80",
    imageAlt: "Western corridor terrain",
    meta: [["terrain", "Cu-Au targets"], ["location_on", "W. Malargüe"]],
    lat: -35.52,
    lng: -70.30
  }
];
