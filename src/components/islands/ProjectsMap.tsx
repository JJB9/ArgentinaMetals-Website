import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import type { Project } from "../../data/projects";

interface ProjectsMapProps {
  flagship: Project;
  projects: Project[];
}

const copperPin = (color: string) =>
  L.divIcon({
    className: "amc-pin",
    iconSize: [26, 34],
    iconAnchor: [13, 32],
    popupAnchor: [0, -28],
    html: `
      <svg width="26" height="34" viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M13 0C5.82 0 0 5.82 0 13c0 9.75 13 21 13 21s13-11.25 13-21C26 5.82 20.18 0 13 0z" fill="${color}" />
        <circle cx="13" cy="13" r="5" fill="#ffffff" />
      </svg>
    `
  });

const flagshipIcon = copperPin("#8a3f18");
const satelliteIcon = copperPin("#d4783f");
const earlyStageIcon = copperPin("#b8895c");

const iconFor = (tag: Project["tag"]) =>
  tag === "Flagship" ? flagshipIcon : tag === "Satellite" ? satelliteIcon : earlyStageIcon;

export default function ProjectsMap({ flagship, projects }: ProjectsMapProps) {
  const all = useMemo(() => [flagship, ...projects], [flagship, projects]);
  const bounds = useMemo<L.LatLngBoundsExpression>(() => {
    const lats = all.map((p) => p.lat);
    const lngs = all.map((p) => p.lng);
    const pad = 0.08;
    return [
      [Math.min(...lats) - pad, Math.min(...lngs) - pad],
      [Math.max(...lats) + pad, Math.max(...lngs) + pad]
    ];
  }, [all]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const map = mapRef.current;
    if (!container || !map) return;

    let frame = 0;
    const invalidate = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => map.invalidateSize());
    };

    const ro = new ResizeObserver(invalidate);
    ro.observe(container);
    window.addEventListener("resize", invalidate, { passive: true });

    return () => {
      if (frame) cancelAnimationFrame(frame);
      ro.disconnect();
      window.removeEventListener("resize", invalidate);
    };
  }, []);

  return (
    <div className="projects-map" ref={containerRef}>
      <MapContainer
        ref={mapRef}
        bounds={bounds}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        {all.map((project) => (
          <Marker
            key={project.id}
            position={[project.lat, project.lng]}
            icon={iconFor(project.tag)}
          >
            <Popup>
              <div className="projects-map-popup">
                <span className="projects-map-popup-tag">{project.tag}</span>
                <strong>{project.title}</strong>
                <p>{project.text}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <div className="projects-map-legend" aria-hidden="true">
        <span><span className="dot" style={{ background: "#8a3f18" }} /> Flagship</span>
        <span><span className="dot" style={{ background: "#d4783f" }} /> Satellite</span>
        <span><span className="dot" style={{ background: "#b8895c" }} /> Early-Stage</span>
      </div>
    </div>
  );
}
