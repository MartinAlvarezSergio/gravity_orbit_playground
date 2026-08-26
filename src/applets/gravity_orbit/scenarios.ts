import { ScenarioId } from "./types";

export type ScenarioBodyDef = {
  id: string;
  name: string;
  shortLabel: string;
  description: string;
  visual: import("./types").BodyVisualKind;
  isCenter: boolean;
  /** Semi-major axis: AU for solar system, km from Earth for near-Earth. */
  distance: number;
  /** Sidereal period in days (0 for fixed center). */
  periodDays: number;
  /** Relative visual size (not to physical scale — educational exaggeration). */
  sizeRank: number;
};

export type ScenarioDefinition = {
  id: ScenarioId;
  title: string;
  summary: string;
  note: string;
  distanceUnit: "AU" | "km" | null;
  bodies: ScenarioBodyDef[];
};

/** Approximate solar-system data; sizes are exaggerated for legibility. */
export const SOLAR_SYSTEM_BODIES: ScenarioBodyDef[] = [
  {
    id: "sun",
    name: "Sun",
    shortLabel: "Sun",
    description: "Central star. In this demo it is fixed; planets follow circular Keplerian orbits.",
    visual: "sun",
    isCenter: true,
    distance: 0,
    periodDays: 0,
    sizeRank: 18
  },
  {
    id: "mercury",
    name: "Mercury",
    shortLabel: "Mer",
    description: "Innermost planet. Short year (~88 days) and fast orbital speed.",
    visual: "mercury",
    isCenter: false,
    distance: 0.387,
    periodDays: 87.97,
    sizeRank: 4
  },
  {
    id: "venus",
    name: "Venus",
    shortLabel: "Ven",
    description: "Similar size to Earth, but a much denser atmosphere. Year ~225 days.",
    visual: "venus",
    isCenter: false,
    distance: 0.723,
    periodDays: 224.7,
    sizeRank: 6
  },
  {
    id: "earth",
    name: "Earth",
    shortLabel: "Ear",
    description: "Our home world. One AU from the Sun; period fixed as 1 year in this model.",
    visual: "earth",
    isCenter: false,
    distance: 1.0,
    periodDays: 365.25,
    sizeRank: 6.2
  },
  {
    id: "mars",
    name: "Mars",
    shortLabel: "Mar",
    description: "The red planet. Year ~687 days; farther and slower than Earth.",
    visual: "mars",
    isCenter: false,
    distance: 1.524,
    periodDays: 686.98,
    sizeRank: 5
  },
  {
    id: "jupiter",
    name: "Jupiter",
    shortLabel: "Jup",
    description: "Gas giant. Dominates the outer system mass; year ~12 Earth years.",
    visual: "jupiter",
    isCenter: false,
    distance: 5.203,
    periodDays: 4332.6,
    sizeRank: 12
  },
  {
    id: "saturn",
    name: "Saturn",
    shortLabel: "Sat",
    description: "Ringed gas giant. Year ~29 Earth years. Rings are drawn schematically.",
    visual: "saturn",
    isCenter: false,
    distance: 9.537,
    periodDays: 10759,
    sizeRank: 10
  },
  {
    id: "uranus",
    name: "Uranus",
    shortLabel: "Ura",
    description: "Ice giant. Year ~84 Earth years. Distance compressed in this view.",
    visual: "uranus",
    isCenter: false,
    distance: 19.19,
    periodDays: 30687,
    sizeRank: 8
  },
  {
    id: "neptune",
    name: "Neptune",
    shortLabel: "Nep",
    description: "Outermost planet here. Year ~165 Earth years. Distance strongly compressed.",
    visual: "neptune",
    isCenter: false,
    distance: 30.07,
    periodDays: 60190,
    sizeRank: 8
  }
];

/**
 * Earth-centered near-space bodies.
 * Distances are approximate mean/typical values from Earth's center.
 */
export const NEAR_EARTH_BODIES: ScenarioBodyDef[] = [
  {
    id: "earth",
    name: "Earth",
    shortLabel: "Earth",
    description: "Central body for this scenario. Satellites and the Moon orbit (schematically) around Earth.",
    visual: "earth",
    isCenter: true,
    distance: 0,
    periodDays: 0,
    sizeRank: 22
  },
  {
    id: "iss",
    name: "International Space Station",
    shortLabel: "ISS",
    description: "Crewed laboratory in low Earth orbit (~420 km altitude). Completes an orbit in ~93 minutes.",
    visual: "iss",
    isCenter: false,
    distance: 6771,
    periodDays: 93 / (60 * 24),
    sizeRank: 5
  },
  {
    id: "moon",
    name: "Moon",
    shortLabel: "Moon",
    description: "Earth's natural satellite at ~384,400 km. Period ~27.3 days (sidereal).",
    visual: "moon",
    isCenter: false,
    distance: 384400,
    periodDays: 27.32,
    sizeRank: 8
  },
  {
    id: "jwst",
    name: "James Webb Space Telescope",
    shortLabel: "JWST",
    description:
      "Observatory near Sun–Earth L2 (~1.5 million km from Earth). Shown here as a distant Earth-facing satellite for scale study.",
    visual: "jwst",
    isCenter: false,
    distance: 1.5e6,
    periodDays: 365.25,
    sizeRank: 6
  },
  {
    id: "sun",
    name: "Sun",
    shortLabel: "Sun",
    description:
      "Shown at 1 AU for scale. In reality Earth orbits the Sun; here the Sun is placed as a distant reference while the view stays Earth-centered.",
    visual: "sun",
    isCenter: false,
    distance: 1.496e8,
    periodDays: 365.25,
    sizeRank: 14
  }
];

export const SCENARIOS: Record<ScenarioId, ScenarioDefinition> = {
  playground: {
    id: "playground",
    title: "Particle playground",
    summary: "Many anonymous particles around a draggable central mass.",
    note: "Softened Newtonian gravity with optional particle self-gravity. Not a Solar System model.",
    distanceUnit: null,
    bodies: []
  },
  "solar-system": {
    id: "solar-system",
    title: "Solar System",
    summary: "Sun plus the eight planets on circular orbits. Click a planet to inspect it.",
    note:
      "Circular Keplerian orbits with approximate periods. Orbital radii use a compressed (power-law) scale so outer planets fit; body sizes are exaggerated for visibility.",
    distanceUnit: "AU",
    bodies: SOLAR_SYSTEM_BODIES
  },
  "near-earth": {
    id: "near-earth",
    title: "Earth–Moon–satellites",
    summary: "Earth, ISS, Moon, JWST, and the Sun as a distant scale reference. Use the distance slider to zoom.",
    note:
      "Earth-centered schematic. Distances are approximate. ISS/Moon/JWST/Sun sizes are not to scale. The distance slider sets the view half-width (log km).",
    distanceUnit: "km",
    bodies: NEAR_EARTH_BODIES
  },
  "earth-pitch": {
    id: "earth-pitch",
    title: "Baseball from Earth’s surface",
    summary:
      "Newton’s cannonball as a pitch: throw harder and watch the path become a long arc, a circular orbit, an ellipse, or a hyperbolic escape.",
    note:
      "Idealized airless Earth. Default “fast pitch” is ≪ circular-orbit speed; zoom in until the surface looks flat, then zoom out and raise speed to show orbital regimes. Escape is √2 × v_circ.",
    distanceUnit: null,
    bodies: []
  }
};

export const SCENARIO_OPTIONS: { id: ScenarioId; label: string }[] = [
  { id: "playground", label: "Particle playground" },
  { id: "solar-system", label: "Solar System" },
  { id: "near-earth", label: "Earth · Moon · ISS · JWST" },
  { id: "earth-pitch", label: "Earth surface · baseball pitch" }
];

/** Map AU to canvas orbit radius with compression so Neptune still fits. */
export function solarOrbitRadiusPx(au: number, maxRadiusPx: number): number {
  if (au <= 0) {
    return 0;
  }
  // Soft compression: r_px ∝ au^0.45, normalized so Neptune ≈ maxRadiusPx.
  const neptuneAu = 30.07;
  const t = Math.pow(au / neptuneAu, 0.45);
  return Math.max(28, t * maxRadiusPx);
}

/** Convert scenario time so Earth's year takes ~24 s of wall-clock when running 1×. */
export const EARTH_YEAR_SIM_SECONDS = 24;

export function omegaFromPeriodDays(periodDays: number): number {
  if (periodDays <= 0) {
    return 0;
  }
  const periodSimSeconds = (periodDays / 365.25) * EARTH_YEAR_SIM_SECONDS;
  return (Math.PI * 2) / periodSimSeconds;
}

export function formatDistance(value: number, unit: "AU" | "km"): string {
  if (unit === "AU") {
    return `${value.toFixed(value >= 10 ? 1 : 3)} AU`;
  }
  if (value >= 1e6) {
    return `${(value / 1e6).toFixed(2)} × 10⁶ km`;
  }
  if (value >= 1e3) {
    return `${(value / 1e3).toFixed(value >= 1e5 ? 0 : 1)} × 10³ km`;
  }
  return `${Math.round(value)} km`;
}

/** Near-Earth view half-width slider range (km). */
export const NEAR_EARTH_VIEW_MIN_KM = 2e3;
export const NEAR_EARTH_VIEW_MAX_KM = 2e8;
export const NEAR_EARTH_VIEW_DEFAULT_KM = 5e5;
