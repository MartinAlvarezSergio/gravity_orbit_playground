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
    description:
      "The central star. Here it’s fixed in place so you can focus on the planets’ orbits.",
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
    description: "Closest in. A year is only ~88 days, so it zips around quickly.",
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
    description: "Earth’s neighbor in size, but with a thick atmosphere. Year ~225 days.",
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
    description: "Home. One astronomical unit from the Sun; we take its year as 1 in this model.",
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
    description: "Farther out and slower. A Martian year is ~687 Earth days.",
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
    description: "The heavyweight of the outer planets. One trip around the Sun takes ~12 Earth years.",
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
    description: "Famous for its rings (drawn simply here). Year ~29 Earth years.",
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
    description: "An ice giant with a long year (~84 Earth years). Distance is squeezed so it still fits on screen.",
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
    description: "The outermost planet in this map. Year ~165 Earth years; its distance is compressed a lot.",
    visual: "neptune",
    isCenter: false,
    distance: 30.07,
    periodDays: 60190,
    sizeRank: 8
  }
];

/**
 * Near-Earth neighborhood on a heliocentric stage: the Sun is always the center,
 * Earth always orbits it, and ISS / Moon / JWST ride with Earth.
 * Distances for satellites are approximate means from Earth's center; Earth–Sun is 1 AU.
 * The view slider only changes how much space fits on screen — it does not flip the frame.
 */
export const NEAR_EARTH_BODIES: ScenarioBodyDef[] = [
  {
    id: "sun",
    name: "Sun",
    shortLabel: "Sun",
    description:
      "Always the center of this map and always on screen. Earth goes around it once per year — even when the distance slider is zoomed in on nearby space (the AU gap is compressed for clarity).",
    visual: "sun",
    isCenter: true,
    distance: 0,
    periodDays: 0,
    sizeRank: 14
  },
  {
    id: "earth",
    name: "Earth",
    shortLabel: "Earth",
    description:
      "Always orbiting the Sun. Tighten the distance slider to expand ISS / Moon / JWST around Earth; the Sun stays in the picture.",
    visual: "earth",
    isCenter: false,
    distance: 1.496e8,
    periodDays: 365.25,
    sizeRank: 22
  },
  {
    id: "iss",
    name: "International Space Station",
    shortLabel: "ISS",
    description:
      "Low Earth orbit, only a few hundred km up. It completes a lap in about 93 minutes — much faster than the Moon.",
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
    description: "About 384,000 km from Earth. One orbit takes roughly 27 days (sidereal).",
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
      "Near the Sun–Earth L2 point, about 1.5 million km from Earth (anti-Sun side). Farther than the Moon, but still tiny next to 1 AU.",
    visual: "jwst",
    isCenter: false,
    distance: 1.5e6,
    periodDays: 365.25,
    sizeRank: 6
  }
];

export const SCENARIOS: Record<ScenarioId, ScenarioDefinition> = {
  playground: {
    id: "playground",
    title: "Particle playground",
    summary: "Drop anonymous particles around a mass you can drag — a sandbox for Newtonian gravity.",
    note:
      "This is softened gravity (not the Solar System). Turn on particle–particle gravity if you want them to tug on each other. Drag the central mass to move the “star.”",
    distanceUnit: null,
    bodies: []
  },
  "solar-system": {
    id: "solar-system",
    title: "Solar System",
    summary: "Sun and eight planets on circular orbits. Click a planet to inspect it.",
    note:
      "Orbits are circular with roughly correct periods. We compress the outer distances (and exaggerate sizes) so Neptune still fits on one screen — think of it as a teaching sketch, not a scale model.",
    distanceUnit: "AU",
    bodies: SOLAR_SYSTEM_BODIES
  },
  "near-earth": {
    id: "near-earth",
    title: "Earth, Moon, and nearby space",
    summary:
      "Sun always on stage; Earth always orbits it. The distance slider opens the Earth neighborhood (ISS → Moon → JWST) without removing the Sun.",
    note:
      "Illustrative dual scale: the Earth–Sun year orbit stays on-screen at every slider setting (1 AU is compressed when you zoom in on nearby space). Moon / ISS / JWST use the slider scale around Earth and keep the Sunward pull. Body sizes shrink at wide views. Not a single linear map of the whole Solar System.",
    distanceUnit: "km",
    bodies: NEAR_EARTH_BODIES
  },
  "earth-pitch": {
    id: "earth-pitch",
    title: "Baseball from Earth’s surface",
    summary:
      "Newton’s cannonball, but as a pitch: throw harder and watch the path go from “just falls” to orbit to escape.",
    note:
      "No atmosphere, smooth sphere Earth. Start with a normal hard throw (much slower than orbital speed) while zoomed in so the ground looks flat. Then zoom out and crank the speed toward circular (~1×) and escape (~1.41×).",
    distanceUnit: null,
    bodies: []
  },
  "historic-models": {
    id: "historic-models",
    title: "Historic Solar System models",
    summary:
      "Ptolemy’s epicycles, Copernicus’s circles, Tycho’s hybrid, and Kepler’s ellipses — schematic orbits that show how strange each worldview looks in motion.",
    note:
      "Pick a historical model below. Paths are teaching cartoons (compressed distances, tuned epicycle sizes) so retrograde loops and frame differences read clearly — not fitted Almagest or Rudolphine tables.",
    distanceUnit: "AU",
    bodies: []
  }
};

export const SCENARIO_OPTIONS: { id: ScenarioId; label: string }[] = [
  { id: "playground", label: "Particle playground" },
  { id: "solar-system", label: "Solar System" },
  { id: "near-earth", label: "Earth · Moon · ISS · JWST" },
  { id: "historic-models", label: "Historic models (Ptolemy → Kepler)" },
  { id: "earth-pitch", label: "Baseball pitch from Earth" }
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
/** Default shows roughly Moon–JWST neighborhood while following Earth. */
export const NEAR_EARTH_VIEW_DEFAULT_KM = 5e5;
/** Above this half-width, prefer a Sun-centered view (Earth’s year orbit is the story). */
export const NEAR_EARTH_WIDE_VIEW_KM = 5e7;
export const AU_KM = 1.496e8;
