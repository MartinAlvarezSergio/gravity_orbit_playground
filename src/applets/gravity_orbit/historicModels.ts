/**
 * Schematic kinematics for historic Solar System models.
 *
 * These are teaching cartoons, not faithful Ptolemaic/Copernican parameter fits:
 * periods and relative epicycle sizes are chosen so retrograde loops and frame
 * differences are visually obvious. Classical planets only (through Saturn).
 */

import { Vec2 } from "../../core/vector";
import type { BodyVisualKind, NamedBody } from "./types";

export type HistoricModelId = "ptolemy" | "copernicus" | "tycho" | "kepler";

export type HistoricGuide =
  | {
      kind: "circle";
      cx: number;
      cy: number;
      radiusPx: number;
      style: "deferent" | "epicycle" | "orbit" | "sun-path";
      bodyId?: string;
      emphasize?: boolean;
    }
  | {
      kind: "ellipse";
      cx: number;
      cy: number;
      aPx: number;
      bPx: number;
      rotation: number;
      style: "orbit";
      bodyId?: string;
      emphasize?: boolean;
    }
  | {
      kind: "segment";
      x0: number;
      y0: number;
      x1: number;
      y1: number;
      style: "spoke" | "epicycle-arm";
      bodyId?: string;
      emphasize?: boolean;
    };

export type HistoricModelMeta = {
  id: HistoricModelId;
  label: string;
  yearHint: string;
  summary: string;
  note: string;
  bizarreHook: string;
};

export const HISTORIC_MODEL_OPTIONS: HistoricModelMeta[] = [
  {
    id: "ptolemy",
    label: "Ptolemy (geocentric + epicycles)",
    yearHint: "~150 CE",
    summary: "Earth fixed at the center; planets ride on epicycles that loop around deferents.",
    note:
      "Schematic Ptolemaic machinery: each planet’s path is a circle (epicycle) whose center rides a larger circle (deferent). Superior planets get a ~1-year epicycle so you can watch retrograde loops — especially Mars. Not a fitted Almagest model; sizes and rates are exaggerated for clarity.",
    bizarreHook: "Watch Mars scribble loops while Earth never moves."
  },
  {
    id: "copernicus",
    label: "Copernicus (heliocentric circles)",
    yearHint: "1543",
    summary: "Sun at the center; planets on circular orbits. Cleaner than epicycles — still not ellipses.",
    note:
      "Early heliocentric sketch with circular orbits (Copernicus still used some epicycles historically; we omit them). The Moon rides with Earth. Compare this calm set of nested circles with Ptolemy’s loops and Tycho’s hybrid.",
    bizarreHook: "Same sky, far fewer moving circles — if the Sun is the center."
  },
  {
    id: "tycho",
    label: "Tycho Brahe (geo-heliocentric hybrid)",
    yearHint: "~1588",
    summary: "Earth fixed; Sun orbits Earth; planets orbit the Sun.",
    note:
      "Tychonic compromise: Earth stays put (as in Ptolemy), but Mercury–Saturn circle the moving Sun (as in Copernicus). Relative planet–Sun geometry matches Copernicus; the stage directions feel much stranger. Schematic distances only.",
    bizarreHook: "Planets swarm around a Sun that itself circles a motionless Earth."
  },
  {
    id: "kepler",
    label: "Kepler (elliptical, Sun at a focus)",
    yearHint: "1609–1619",
    summary: "Sun at one focus of each ellipse; orbital speed varies (Kepler’s 2nd law, schematic).",
    note:
      "Ellipses with schematic eccentricities (Mercury and Mars exaggerated a bit so the oval is obvious). Mean motion uses Kepler’s equation so the planet speeds up near perihelion. This is the historical “resolution” of the epicycle zoo — still not Newtonian gravity.",
    bizarreHook: "Orbits stop being perfect circles — and the Sun is not at the geometric center."
  }
];

export const DEFAULT_HISTORIC_MODEL: HistoricModelId = "ptolemy";

type ClassicBodyId =
  | "earth"
  | "sun"
  | "moon"
  | "mercury"
  | "venus"
  | "mars"
  | "jupiter"
  | "saturn";

type BodyCatalog = {
  id: ClassicBodyId;
  name: string;
  shortLabel: string;
  visual: BodyVisualKind;
  sizeRank: number;
  /** Heliocentric semi-major axis (AU). */
  aAu: number;
  /** Sidereal period (Earth days). */
  periodDays: number;
  /** Kepler eccentricity (schematic; bumped for demo clarity). */
  eccentricity: number;
};

const CLASSIC_BODIES: BodyCatalog[] = [
  {
    id: "mercury",
    name: "Mercury",
    shortLabel: "Mer",
    visual: "mercury",
    sizeRank: 4,
    aAu: 0.387,
    periodDays: 87.97,
    eccentricity: 0.28
  },
  {
    id: "venus",
    name: "Venus",
    shortLabel: "Ven",
    visual: "venus",
    sizeRank: 5.5,
    aAu: 0.723,
    periodDays: 224.7,
    eccentricity: 0.05
  },
  {
    id: "earth",
    name: "Earth",
    shortLabel: "Ear",
    visual: "earth",
    sizeRank: 6,
    aAu: 1.0,
    periodDays: 365.25,
    eccentricity: 0.04
  },
  {
    id: "mars",
    name: "Mars",
    shortLabel: "Mar",
    visual: "mars",
    sizeRank: 5,
    aAu: 1.524,
    periodDays: 686.98,
    eccentricity: 0.16
  },
  {
    id: "jupiter",
    name: "Jupiter",
    shortLabel: "Jup",
    visual: "jupiter",
    sizeRank: 11,
    aAu: 5.203,
    periodDays: 4332.6,
    eccentricity: 0.08
  },
  {
    id: "saturn",
    name: "Saturn",
    shortLabel: "Sat",
    visual: "saturn",
    sizeRank: 10,
    aAu: 9.537,
    periodDays: 10759,
    eccentricity: 0.09
  }
];

const MOON = {
  id: "moon" as const,
  name: "Moon",
  shortLabel: "Moon",
  visual: "moon" as BodyVisualKind,
  sizeRank: 3.5,
  /** Mean Earth–Moon distance as a fraction of 1 AU (schematic, enlarged). */
  aAuFromEarth: 0.12,
  periodDays: 27.32
};

const SUN = {
  id: "sun" as const,
  name: "Sun",
  shortLabel: "Sun",
  visual: "sun" as BodyVisualKind,
  sizeRank: 16
};

/** Wall-clock seconds for one Earth year at timeScale = 1. */
export const HISTORIC_YEAR_SECONDS = 28;

export const HISTORIC_TRAIL_LENGTH = 160;

function omegaFromDays(periodDays: number): number {
  if (periodDays <= 0) {
    return 0;
  }
  const periodSim = (periodDays / 365.25) * HISTORIC_YEAR_SECONDS;
  return (Math.PI * 2) / periodSim;
}

/** Soft radial compression so Saturn still fits; Mercury stays readable. */
export function historicOrbitPx(au: number, maxOrbitPx: number): number {
  const saturnAu = 9.537;
  const t = Math.pow(Math.max(au, 0.05) / saturnAu, 0.55);
  return Math.max(22, t * maxOrbitPx);
}

function periodLabel(periodDays: number): string {
  if (periodDays <= 0) {
    return "—";
  }
  if (periodDays < 400) {
    return `~${periodDays.toFixed(periodDays < 100 ? 1 : 0)} days`;
  }
  const years = periodDays / 365.25;
  return `~${years.toFixed(years < 20 ? 1 : 0)} yr`;
}

function sizeToRadius(sizeRank: number): number {
  return Math.min(22, Math.max(3.2, sizeRank * 0.9));
}

function emptyBody(
  partial: Omit<NamedBody, "position" | "velocity" | "acceleration" | "trail" | "angle" | "omega" | "orbitRadiusPx"> & {
    angle?: number;
    omega?: number;
    orbitRadiusPx?: number;
  },
  center: Vec2
): NamedBody {
  return {
    ...partial,
    position: { x: center.x, y: center.y },
    velocity: { x: 0, y: 0 },
    acceleration: { x: 0, y: 0 },
    trail: [],
    angle: partial.angle ?? 0,
    omega: partial.omega ?? 0,
    orbitRadiusPx: partial.orbitRadiusPx ?? 0
  };
}

function solveKepler(meanAnomaly: number, eccentricity: number): number {
  let E = meanAnomaly;
  for (let i = 0; i < 10; i += 1) {
    E = meanAnomaly + eccentricity * Math.sin(E);
  }
  return E;
}

function polar(cx: number, cy: number, angle: number, radius: number): Vec2 {
  return {
    x: cx + Math.cos(angle) * radius,
    y: cy + Math.sin(angle) * radius
  };
}

function setKinematics(
  body: NamedBody,
  position: Vec2,
  prev: Vec2 | null,
  dt: number
): void {
  body.position = { x: position.x, y: position.y };
  if (prev && dt > 1e-6) {
    body.velocity = {
      x: (position.x - prev.x) / dt,
      y: (position.y - prev.y) / dt
    };
  } else {
    body.velocity = { x: 0, y: 0 };
  }
  body.acceleration = { x: 0, y: 0 };
}

export type HistoricRuntime = {
  model: HistoricModelId;
  /** Accumulated scenario time (seconds). */
  time: number;
  /** Per-body phase offsets so the scene does not start stacked. */
  phases: Record<string, number>;
  bodies: NamedBody[];
  guides: HistoricGuide[];
  selectedBodyId: string | null;
};

function descriptionFor(model: HistoricModelId, id: string): string {
  switch (model) {
    case "ptolemy":
      if (id === "earth") {
        return "Fixed center of the cosmos in this model. Everything else is built to go around Earth.";
      }
      if (id === "sun") {
        return "Rides a deferent around Earth (no epicycle in this sketch). Sets the year and lights the planets.";
      }
      if (id === "moon") {
        return "Deferent + small epicycle around Earth — the closest classical “wanderer.”";
      }
      if (id === "mars") {
        return "Large epicycle on a deferent: the textbook place to watch retrograde loops.";
      }
      if (id === "mercury" || id === "venus") {
        return "Inferior planet: epicycle center stays tied to the Sun’s direction so it never strays far from the Sun in the sky.";
      }
      return "Superior planet: deferent carries the epicycle; the epicycle turns once per year, producing stations and retrograde arcs.";
    case "copernicus":
      if (id === "sun") {
        return "Center of the planetary system in this model.";
      }
      if (id === "earth") {
        return "One of the planets — it orbits the Sun, and the Moon orbits Earth.";
      }
      if (id === "moon") {
        return "Circles Earth while Earth circles the Sun.";
      }
      return "Circular heliocentric orbit (schematic). No epicycle loops in this simplified Copernicus.";
    case "tycho":
      if (id === "earth") {
        return "Fixed — Tycho keeps Earth unmoved while borrowing heliocentric planet–Sun geometry.";
      }
      if (id === "sun") {
        return "Orbits Earth once per year; the other planets orbit this moving Sun.";
      }
      if (id === "moon") {
        return "Still Earth’s companion, orbiting the fixed Earth.";
      }
      return "Orbits the Sun, which itself orbits Earth — so the path on this canvas is a cycloid-like tangle.";
    case "kepler":
      if (id === "sun") {
        return "Sits at one focus of each elliptical orbit — not at the geometric center of the oval.";
      }
      if (id === "moon") {
        return "Still drawn as a small circle about Earth (Kepler’s focus was planetary ellipses).";
      }
      return "Elliptical orbit with schematic eccentricity; moves faster near perihelion (2nd law, approximate).";
    default:
      return "";
  }
}

export function createHistoricRuntime(
  model: HistoricModelId,
  center: Vec2,
  width: number,
  height: number
): HistoricRuntime {
  const maxOrbitPx = Math.min(width, height) * 0.42;
  const phases: Record<string, number> = {
    mercury: 0.4,
    venus: 1.1,
    earth: 0.2,
    mars: 2.4,
    jupiter: 0.7,
    saturn: 3.5,
    moon: 0.9,
    sun: 0.2
  };

  const bodies: NamedBody[] = [];

  const pushCenter = (id: "earth" | "sun", name: string, visual: BodyVisualKind, sizeRank: number): void => {
    bodies.push(
      emptyBody(
        {
          id,
          name,
          shortLabel: id === "earth" ? "Ear" : "Sun",
          description: descriptionFor(model, id),
          visual,
          isCenter: true,
          drawRadius: sizeToRadius(sizeRank),
          distanceValue: 0,
          distanceUnit: "AU",
          periodLabel: "—"
        },
        center
      )
    );
  };

  if (model === "ptolemy" || model === "tycho") {
    pushCenter("earth", "Earth", "earth", 7);
  } else {
    pushCenter("sun", "Sun", "sun", SUN.sizeRank);
  }

  if (model === "ptolemy") {
    bodies.push(
      emptyBody(
        {
          id: "sun",
          name: "Sun",
          shortLabel: "Sun",
          description: descriptionFor(model, "sun"),
          visual: "sun",
          isCenter: false,
          drawRadius: sizeToRadius(SUN.sizeRank),
          distanceValue: 1,
          distanceUnit: "AU",
          periodLabel: periodLabel(365.25),
          orbitRadiusPx: historicOrbitPx(1, maxOrbitPx),
          omega: omegaFromDays(365.25)
        },
        center
      )
    );
    bodies.push(
      emptyBody(
        {
          id: "moon",
          name: "Moon",
          shortLabel: "Moon",
          description: descriptionFor(model, "moon"),
          visual: "moon",
          isCenter: false,
          drawRadius: sizeToRadius(MOON.sizeRank),
          distanceValue: MOON.aAuFromEarth,
          distanceUnit: "AU",
          periodLabel: periodLabel(MOON.periodDays),
          orbitRadiusPx: historicOrbitPx(MOON.aAuFromEarth, maxOrbitPx),
          omega: omegaFromDays(MOON.periodDays)
        },
        center
      )
    );
    for (const b of CLASSIC_BODIES) {
      if (b.id === "earth") {
        continue;
      }
      const deferentAu = b.aAu;
      bodies.push(
        emptyBody(
          {
            id: b.id,
            name: b.name,
            shortLabel: b.shortLabel,
            description: descriptionFor(model, b.id),
            visual: b.visual,
            isCenter: false,
            drawRadius: sizeToRadius(b.sizeRank),
            distanceValue: deferentAu,
            distanceUnit: "AU",
            periodLabel: periodLabel(b.periodDays),
            orbitRadiusPx: historicOrbitPx(deferentAu, maxOrbitPx),
            omega: omegaFromDays(b.periodDays)
          },
          center
        )
      );
    }
  } else if (model === "copernicus" || model === "kepler") {
    for (const b of CLASSIC_BODIES) {
      bodies.push(
        emptyBody(
          {
            id: b.id,
            name: b.name,
            shortLabel: b.shortLabel,
            description: descriptionFor(model, b.id),
            visual: b.visual,
            isCenter: false,
            drawRadius: sizeToRadius(b.sizeRank),
            distanceValue: b.aAu,
            distanceUnit: "AU",
            periodLabel: periodLabel(b.periodDays),
            orbitRadiusPx: historicOrbitPx(b.aAu, maxOrbitPx),
            omega: omegaFromDays(b.periodDays)
          },
          center
        )
      );
    }
    bodies.push(
      emptyBody(
        {
          id: "moon",
          name: "Moon",
          shortLabel: "Moon",
          description: descriptionFor(model, "moon"),
          visual: "moon",
          isCenter: false,
          drawRadius: sizeToRadius(MOON.sizeRank),
          distanceValue: MOON.aAuFromEarth,
          distanceUnit: "AU",
          periodLabel: periodLabel(MOON.periodDays),
          orbitRadiusPx: historicOrbitPx(MOON.aAuFromEarth, maxOrbitPx),
          omega: omegaFromDays(MOON.periodDays)
        },
        center
      )
    );
  } else {
    // Tycho: Sun + planets + Moon; Earth already center.
    bodies.push(
      emptyBody(
        {
          id: "sun",
          name: "Sun",
          shortLabel: "Sun",
          description: descriptionFor(model, "sun"),
          visual: "sun",
          isCenter: false,
          drawRadius: sizeToRadius(SUN.sizeRank),
          distanceValue: 1,
          distanceUnit: "AU",
          periodLabel: periodLabel(365.25),
          orbitRadiusPx: historicOrbitPx(1, maxOrbitPx),
          omega: omegaFromDays(365.25)
        },
        center
      )
    );
    bodies.push(
      emptyBody(
        {
          id: "moon",
          name: "Moon",
          shortLabel: "Moon",
          description: descriptionFor(model, "moon"),
          visual: "moon",
          isCenter: false,
          drawRadius: sizeToRadius(MOON.sizeRank),
          distanceValue: MOON.aAuFromEarth,
          distanceUnit: "AU",
          periodLabel: periodLabel(MOON.periodDays),
          orbitRadiusPx: historicOrbitPx(MOON.aAuFromEarth, maxOrbitPx),
          omega: omegaFromDays(MOON.periodDays)
        },
        center
      )
    );
    for (const b of CLASSIC_BODIES) {
      if (b.id === "earth") {
        continue;
      }
      bodies.push(
        emptyBody(
          {
            id: b.id,
            name: b.name,
            shortLabel: b.shortLabel,
            description: descriptionFor(model, b.id),
            visual: b.visual,
            isCenter: false,
            drawRadius: sizeToRadius(b.sizeRank),
            distanceValue: b.aAu,
            distanceUnit: "AU",
            periodLabel: periodLabel(b.periodDays),
            orbitRadiusPx: historicOrbitPx(b.aAu, maxOrbitPx),
            omega: omegaFromDays(b.periodDays)
          },
          center
        )
      );
    }
  }

  const runtime: HistoricRuntime = {
    model,
    time: 0,
    phases,
    bodies,
    guides: [],
    selectedBodyId: model === "ptolemy" || model === "tycho" ? "mars" : "earth"
  };
  stepHistoricRuntime(runtime, center, maxOrbitPx, 0);
  return runtime;
}

export function historicModelMeta(id: HistoricModelId): HistoricModelMeta {
  return HISTORIC_MODEL_OPTIONS.find((m) => m.id === id) ?? HISTORIC_MODEL_OPTIONS[0];
}

/**
 * Advance schematic kinematics and rebuild guide geometry.
 * `dt` is already scaled by the UI timeScale.
 */
export function stepHistoricRuntime(
  runtime: HistoricRuntime,
  center: Vec2,
  maxOrbitPx: number,
  dt: number
): void {
  runtime.time += dt;
  const t = runtime.time;
  const guides: HistoricGuide[] = [];
  const selected = runtime.selectedBodyId;
  const prevPositions = new Map(runtime.bodies.map((b) => [b.id, { ...b.position }]));

  const earthOmega = omegaFromDays(365.25);
  const earthPhase = runtime.phases.earth ?? 0;
  const sunAngle = earthPhase + earthOmega * t;

  if (runtime.model === "ptolemy") {
    placePtolemy(runtime, center, maxOrbitPx, t, sunAngle, guides, selected);
  } else if (runtime.model === "copernicus") {
    placeCopernicus(runtime, center, maxOrbitPx, t, guides, selected);
  } else if (runtime.model === "tycho") {
    placeTycho(runtime, center, maxOrbitPx, t, sunAngle, guides, selected);
  } else {
    placeKepler(runtime, center, maxOrbitPx, t, guides, selected);
  }

  for (const body of runtime.bodies) {
    const prev = prevPositions.get(body.id) ?? null;
    if (dt > 0) {
      setKinematics(body, body.position, prev, dt);
    } else {
      body.velocity = { x: 0, y: 0 };
      body.acceleration = { x: 0, y: 0 };
    }
  }

  runtime.guides = guides;
}

function placePtolemy(
  runtime: HistoricRuntime,
  center: Vec2,
  maxOrbitPx: number,
  t: number,
  sunAngle: number,
  guides: HistoricGuide[],
  selected: string | null
): void {
  const earth = runtime.bodies.find((b) => b.id === "earth");
  if (earth) {
    earth.position = { x: center.x, y: center.y };
    earth.isCenter = true;
  }

  const sun = runtime.bodies.find((b) => b.id === "sun");
  if (sun) {
    const r = historicOrbitPx(1, maxOrbitPx);
    sun.orbitRadiusPx = r;
    sun.angle = sunAngle;
    sun.position = polar(center.x, center.y, sunAngle, r);
    const emp = selected === "sun";
    guides.push({
      kind: "circle",
      cx: center.x,
      cy: center.y,
      radiusPx: r,
      style: "deferent",
      bodyId: "sun",
      emphasize: emp
    });
    guides.push({
      kind: "segment",
      x0: center.x,
      y0: center.y,
      x1: sun.position.x,
      y1: sun.position.y,
      style: "spoke",
      bodyId: "sun",
      emphasize: emp
    });
  }

  const moon = runtime.bodies.find((b) => b.id === "moon");
  if (moon) {
    const deferentR = historicOrbitPx(MOON.aAuFromEarth, maxOrbitPx);
    const epicycleR = deferentR * 0.22;
    const defAngle = (runtime.phases.moon ?? 0) + omegaFromDays(MOON.periodDays) * t;
    const epiAngle = defAngle * 2.3;
    const deferentCenter = polar(center.x, center.y, defAngle, deferentR);
    moon.position = polar(deferentCenter.x, deferentCenter.y, epiAngle, epicycleR);
    moon.orbitRadiusPx = deferentR;
    moon.angle = defAngle;
    pushEpicycleGuides(
      guides,
      center,
      deferentCenter,
      moon.position,
      deferentR,
      epicycleR,
      "moon",
      selected === "moon"
    );
  }

  for (const b of CLASSIC_BODIES) {
    if (b.id === "earth") {
      continue;
    }
    const body = runtime.bodies.find((x) => x.id === b.id);
    if (!body) {
      continue;
    }
    const emp = selected === b.id;
    const isInferior = b.id === "mercury" || b.id === "venus";

    if (isInferior) {
      // Epicycle center stays on the Sun–Earth line (tied to solar longitude).
      const deferentR = historicOrbitPx(1, maxOrbitPx);
      const maxElongAu = b.id === "mercury" ? 0.38 : 0.72;
      const epicycleR = historicOrbitPx(maxElongAu, maxOrbitPx) * 0.85;
      const defAngle = sunAngle;
      const synodicDays = b.id === "mercury" ? 116 : 584;
      const epiAngle =
        (runtime.phases[b.id] ?? 0) + omegaFromDays(synodicDays) * t;
      const deferentCenter = polar(center.x, center.y, defAngle, deferentR);
      body.position = polar(deferentCenter.x, deferentCenter.y, epiAngle, epicycleR);
      body.orbitRadiusPx = deferentR;
      body.angle = epiAngle;
      if (emp) {
        pushEpicycleGuides(
          guides,
          center,
          deferentCenter,
          body.position,
          deferentR,
          epicycleR,
          b.id,
          true
        );
      } else {
        guides.push({
          kind: "circle",
          cx: center.x,
          cy: center.y,
          radiusPx: deferentR,
          style: "deferent",
          bodyId: b.id,
          emphasize: false
        });
      }
    } else {
      // Superior: deferent ~ sidereal; epicycle ~ 1 year; size ~ 1/a.
      const deferentR = historicOrbitPx(b.aAu, maxOrbitPx);
      const epicycleR = deferentR * (1 / b.aAu) * 0.92;
      const defAngle = (runtime.phases[b.id] ?? 0) + omegaFromDays(b.periodDays) * t;
      // Drive epicycle with Earth's year independently for clear loops.
      const epiSpin = (runtime.phases[b.id] ?? 0) * 0.3 + omegaFromDays(365.25) * t;
      const deferentCenter = polar(center.x, center.y, defAngle, deferentR);
      body.position = polar(deferentCenter.x, deferentCenter.y, epiSpin, epicycleR);
      body.orbitRadiusPx = deferentR;
      body.angle = defAngle;
      if (emp) {
        pushEpicycleGuides(
          guides,
          center,
          deferentCenter,
          body.position,
          deferentR,
          epicycleR,
          b.id,
          true
        );
      } else {
        guides.push({
          kind: "circle",
          cx: center.x,
          cy: center.y,
          radiusPx: deferentR,
          style: "deferent",
          bodyId: b.id,
          emphasize: false
        });
      }
    }
  }
}

function pushEpicycleGuides(
  guides: HistoricGuide[],
  earth: Vec2,
  deferentCenter: Vec2,
  planet: Vec2,
  deferentR: number,
  epicycleR: number,
  bodyId: string,
  emphasize: boolean
): void {
  guides.push({
    kind: "circle",
    cx: earth.x,
    cy: earth.y,
    radiusPx: deferentR,
    style: "deferent",
    bodyId,
    emphasize
  });
  guides.push({
    kind: "circle",
    cx: deferentCenter.x,
    cy: deferentCenter.y,
    radiusPx: epicycleR,
    style: "epicycle",
    bodyId,
    emphasize
  });
  guides.push({
    kind: "segment",
    x0: earth.x,
    y0: earth.y,
    x1: deferentCenter.x,
    y1: deferentCenter.y,
    style: "spoke",
    bodyId,
    emphasize
  });
  guides.push({
    kind: "segment",
    x0: deferentCenter.x,
    y0: deferentCenter.y,
    x1: planet.x,
    y1: planet.y,
    style: "epicycle-arm",
    bodyId,
    emphasize
  });
}

function placeCopernicus(
  runtime: HistoricRuntime,
  center: Vec2,
  maxOrbitPx: number,
  t: number,
  guides: HistoricGuide[],
  selected: string | null
): void {
  const sun = runtime.bodies.find((b) => b.id === "sun");
  if (sun) {
    sun.position = { x: center.x, y: center.y };
    sun.isCenter = true;
  }

  let earthPos: Vec2 = { x: center.x, y: center.y };
  for (const b of CLASSIC_BODIES) {
    const body = runtime.bodies.find((x) => x.id === b.id);
    if (!body) {
      continue;
    }
    const r = historicOrbitPx(b.aAu, maxOrbitPx);
    const angle = (runtime.phases[b.id] ?? 0) + omegaFromDays(b.periodDays) * t;
    body.orbitRadiusPx = r;
    body.angle = angle;
    body.position = polar(center.x, center.y, angle, r);
    if (b.id === "earth") {
      earthPos = body.position;
    }
    const emp = selected === b.id;
    guides.push({
      kind: "circle",
      cx: center.x,
      cy: center.y,
      radiusPx: r,
      style: "orbit",
      bodyId: b.id,
      emphasize: emp
    });
  }

  const moon = runtime.bodies.find((b) => b.id === "moon");
  if (moon) {
    const r = historicOrbitPx(MOON.aAuFromEarth, maxOrbitPx);
    const angle = (runtime.phases.moon ?? 0) + omegaFromDays(MOON.periodDays) * t;
    moon.orbitRadiusPx = r;
    moon.angle = angle;
    moon.position = polar(earthPos.x, earthPos.y, angle, r);
    guides.push({
      kind: "circle",
      cx: earthPos.x,
      cy: earthPos.y,
      radiusPx: r,
      style: "orbit",
      bodyId: "moon",
      emphasize: selected === "moon"
    });
  }
}

function placeTycho(
  runtime: HistoricRuntime,
  center: Vec2,
  maxOrbitPx: number,
  t: number,
  sunAngle: number,
  guides: HistoricGuide[],
  selected: string | null
): void {
  const earth = runtime.bodies.find((b) => b.id === "earth");
  if (earth) {
    earth.position = { x: center.x, y: center.y };
    earth.isCenter = true;
  }

  const sunR = historicOrbitPx(1, maxOrbitPx);
  const sunPos = polar(center.x, center.y, sunAngle, sunR);
  const sun = runtime.bodies.find((b) => b.id === "sun");
  if (sun) {
    sun.orbitRadiusPx = sunR;
    sun.angle = sunAngle;
    sun.position = sunPos;
    guides.push({
      kind: "circle",
      cx: center.x,
      cy: center.y,
      radiusPx: sunR,
      style: "sun-path",
      bodyId: "sun",
      emphasize: selected === "sun"
    });
  }

  const moon = runtime.bodies.find((b) => b.id === "moon");
  if (moon) {
    const r = historicOrbitPx(MOON.aAuFromEarth, maxOrbitPx);
    const angle = (runtime.phases.moon ?? 0) + omegaFromDays(MOON.periodDays) * t;
    moon.orbitRadiusPx = r;
    moon.angle = angle;
    moon.position = polar(center.x, center.y, angle, r);
    guides.push({
      kind: "circle",
      cx: center.x,
      cy: center.y,
      radiusPx: r,
      style: "orbit",
      bodyId: "moon",
      emphasize: selected === "moon"
    });
  }

  for (const b of CLASSIC_BODIES) {
    if (b.id === "earth") {
      continue;
    }
    const body = runtime.bodies.find((x) => x.id === b.id);
    if (!body) {
      continue;
    }
    const r = historicOrbitPx(b.aAu, maxOrbitPx);
    const angle = (runtime.phases[b.id] ?? 0) + omegaFromDays(b.periodDays) * t;
    body.orbitRadiusPx = r;
    body.angle = angle;
    body.position = polar(sunPos.x, sunPos.y, angle, r);
    const emp = selected === b.id;
    guides.push({
      kind: "circle",
      cx: sunPos.x,
      cy: sunPos.y,
      radiusPx: r,
      style: "orbit",
      bodyId: b.id,
      emphasize: emp
    });
  }
}

function placeKepler(
  runtime: HistoricRuntime,
  center: Vec2,
  maxOrbitPx: number,
  t: number,
  guides: HistoricGuide[],
  selected: string | null
): void {
  const sun = runtime.bodies.find((b) => b.id === "sun");
  if (sun) {
    sun.position = { x: center.x, y: center.y };
    sun.isCenter = true;
  }

  let earthPos: Vec2 = { x: center.x, y: center.y };

  for (const b of CLASSIC_BODIES) {
    const body = runtime.bodies.find((x) => x.id === b.id);
    if (!body) {
      continue;
    }
    const aPx = historicOrbitPx(b.aAu, maxOrbitPx);
    const e = b.eccentricity;
    const bPx = aPx * Math.sqrt(Math.max(0.05, 1 - e * e));
    const cPx = aPx * e;
    // Ellipse geometric center is offset from the Sun (focus) by +c along major axis.
    const rotation = runtime.phases[b.id] ?? 0;
    const meanAnomaly = omegaFromDays(b.periodDays) * t;
    const E = solveKepler(meanAnomaly, e);
    const cosE = Math.cos(E);
    const sinE = Math.sin(E);
    // Coordinates in orbit plane with focus at origin: x = a(cos E - e), y = a√(1-e²) sin E
    const xOrb = aPx * (cosE - e);
    const yOrb = aPx * Math.sqrt(Math.max(0.05, 1 - e * e)) * sinE;
    const cosR = Math.cos(rotation);
    const sinR = Math.sin(rotation);
    body.position = {
      x: center.x + cosR * xOrb - sinR * yOrb,
      y: center.y + sinR * xOrb + cosR * yOrb
    };
    body.orbitRadiusPx = aPx;
    body.angle = meanAnomaly;
    if (b.id === "earth") {
      earthPos = body.position;
    }

    const emp = selected === b.id;
    const ellipseCenter = {
      x: center.x + cosR * cPx,
      y: center.y + sinR * cPx
    };
    guides.push({
      kind: "ellipse",
      cx: ellipseCenter.x,
      cy: ellipseCenter.y,
      aPx,
      bPx,
      rotation,
      style: "orbit",
      bodyId: b.id,
      emphasize: emp
    });
  }

  const moon = runtime.bodies.find((b) => b.id === "moon");
  if (moon) {
    const r = historicOrbitPx(MOON.aAuFromEarth, maxOrbitPx);
    const angle = (runtime.phases.moon ?? 0) + omegaFromDays(MOON.periodDays) * t;
    moon.orbitRadiusPx = r;
    moon.angle = angle;
    moon.position = polar(earthPos.x, earthPos.y, angle, r);
    guides.push({
      kind: "circle",
      cx: earthPos.x,
      cy: earthPos.y,
      radiusPx: r,
      style: "orbit",
      bodyId: "moon",
      emphasize: selected === "moon"
    });
  }
}

export function syncHistoricSelection(runtime: HistoricRuntime, selectedBodyId: string | null): void {
  runtime.selectedBodyId = selectedBodyId;
}
