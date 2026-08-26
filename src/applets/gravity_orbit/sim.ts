import { Vec2, magnitude, sub } from "../../core/vector";
import {
  applyEarthPitchPreset,
  createEarthPitchState,
  resetEarthPitchBall,
  setEarthPitchSpeed,
  setEarthPitchTimeScale,
  setEarthPitchViewZoom,
  stepEarthPitch,
  type EarthPitchState,
  type PitchPresetId
} from "./earthPitch";
import {
  EARTH_YEAR_SIM_SECONDS,
  NEAR_EARTH_VIEW_DEFAULT_KM,
  NEAR_EARTH_VIEW_MAX_KM,
  NEAR_EARTH_VIEW_MIN_KM,
  SCENARIOS,
  formatDistance,
  omegaFromPeriodDays,
  solarOrbitRadiusPx,
  type ScenarioBodyDef
} from "./scenarios";
import {
  GravityParticle,
  GravitySettings,
  GravitySnapshot,
  NamedBody,
  ScenarioId,
  SelectedBodyInfo
} from "./types";

const LOGICAL_WIDTH = 900;
const LOGICAL_HEIGHT = 620;
const DEFAULT_PARTICLE_COUNT = 140;
const G = 1800;
const SOFTENING = 14;
const DRAG = 0.999;
const MAX_SPEED = 400;
const TRAIL_LENGTH = 48;
const PLAYGROUND_TRAIL_LENGTH = 22;

export type GravityOrbitSim = {
  step: (dt: number) => void;
  setScenario: (scenario: ScenarioId) => void;
  setCenterPosition: (position: Vec2) => void;
  setCenterMass: (mass: number) => void;
  setParticleCount: (count: number) => void;
  setSelfGravity: (enabled: boolean) => void;
  setViewHalfWidthKm: (km: number) => void;
  setTimeScale: (scale: number) => void;
  setPitchSpeedFraction: (fraction: number) => void;
  setPitchViewZoom: (zoom: number) => void;
  applyPitchPreset: (presetId: PitchPresetId) => void;
  resetPitch: () => void;
  getEarthPitch: () => EarthPitchState | null;
  pickBodyAt: (position: Vec2, hitScale?: number) => string | null;
  selectBody: (id: string | null) => void;
  getSelectedInfo: () => SelectedBodyInfo | null;
  getSelectedBody: () => NamedBody | null;
  getSnapshot: () => GravitySnapshot;
  reset: () => void;
};

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function createInitialParticles(
  center: Vec2,
  centerMass: number,
  count: number
): GravityParticle[] {
  const particles: GravityParticle[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = randomInRange(0, Math.PI * 2);
    const radius = randomInRange(90, 280);
    const jitter = randomInRange(-8, 8);
    const x = center.x + Math.cos(angle) * (radius + jitter);
    const y = center.y + Math.sin(angle) * (radius + jitter);
    const tangential = Math.sqrt((G * centerMass) / Math.max(30, radius)) * randomInRange(0.72, 1.05);
    const vx = -Math.sin(angle) * tangential;
    const vy = Math.cos(angle) * tangential;

    particles.push({
      position: { x, y },
      velocity: { x: vx, y: vy },
      acceleration: { x: 0, y: 0 },
      mass: randomInRange(0.8, 2.4),
      trail: []
    });
  }
  return particles;
}

function sizeToRadius(sizeRank: number, scenario: ScenarioId): number {
  if (scenario === "near-earth") {
    return clamp(sizeRank * 0.85, 4, 26);
  }
  return clamp(sizeRank * 0.9, 3.5, 22);
}

function buildScenarioBodies(
  scenario: ScenarioId,
  center: Vec2,
  viewHalfWidthKm: number
): NamedBody[] {
  const def = SCENARIOS[scenario];
  if (def.bodies.length === 0) {
    return [];
  }

  const maxOrbitPx = Math.min(LOGICAL_WIDTH, LOGICAL_HEIGHT) * 0.42;
  const bodies: NamedBody[] = [];

  for (const body of def.bodies) {
    const orbitRadiusPx =
      scenario === "solar-system"
        ? solarOrbitRadiusPx(body.distance, maxOrbitPx)
        : body.isCenter
          ? 0
          : (body.distance / viewHalfWidthKm) * maxOrbitPx;

    const angle = body.isCenter ? 0 : randomInRange(0, Math.PI * 2);
    const omega =
      scenario === "near-earth"
        ? nearEarthOmega(body)
        : omegaFromPeriodDays(body.periodDays);

    const position = body.isCenter
      ? { x: center.x, y: center.y }
      : {
          x: center.x + Math.cos(angle) * orbitRadiusPx,
          y: center.y + Math.sin(angle) * orbitRadiusPx
        };

    const speed = Math.abs(omega * orbitRadiusPx);
    const velocity = body.isCenter
      ? { x: 0, y: 0 }
      : {
          x: -Math.sin(angle) * speed,
          y: Math.cos(angle) * speed
        };

    bodies.push({
      id: body.id,
      name: body.name,
      shortLabel: body.shortLabel,
      description: body.description,
      visual: body.visual,
      isCenter: body.isCenter,
      drawRadius: sizeToRadius(body.sizeRank, scenario),
      distanceValue: body.distance,
      distanceUnit: def.distanceUnit === "AU" ? "AU" : "km",
      periodLabel: periodLabelFor(body),
      position,
      velocity,
      acceleration: { x: 0, y: 0 },
      trail: [],
      angle,
      omega,
      orbitRadiusPx
    });
  }

  return bodies;
}

function periodLabelFor(body: ScenarioBodyDef): string {
  if (body.isCenter || body.periodDays <= 0) {
    return "—";
  }
  if (body.periodDays < 1) {
    const minutes = body.periodDays * 24 * 60;
    return `~${minutes.toFixed(0)} min`;
  }
  if (body.periodDays < 400) {
    return `~${body.periodDays.toFixed(body.periodDays < 100 ? 1 : 0)} days`;
  }
  const years = body.periodDays / 365.25;
  return `~${years.toFixed(years < 20 ? 1 : 0)} yr`;
}

/**
 * Near-Earth spans huge dynamic range; speed up LEO and slow distant bodies
 * so several objects remain visually informative at once.
 */
function nearEarthOmega(body: ScenarioBodyDef): number {
  if (body.isCenter || body.periodDays <= 0) {
    return 0;
  }
  // Map physical period into a readable band: ISS ~8 s/orbit, Moon ~40 s, JWST/Sun slower.
  if (body.id === "iss") {
    return (Math.PI * 2) / 8;
  }
  if (body.id === "moon") {
    return (Math.PI * 2) / 40;
  }
  if (body.id === "jwst") {
    return (Math.PI * 2) / 90;
  }
  if (body.id === "sun") {
    // Distant reference: very slow apparent motion.
    return (Math.PI * 2) / (EARTH_YEAR_SIM_SECONDS * 2);
  }
  return omegaFromPeriodDays(body.periodDays);
}

function reprojectNearEarthBodies(
  bodies: NamedBody[],
  center: Vec2,
  viewHalfWidthKm: number
): void {
  const maxOrbitPx = Math.min(LOGICAL_WIDTH, LOGICAL_HEIGHT) * 0.42;
  for (const body of bodies) {
    if (body.isCenter) {
      body.position = { x: center.x, y: center.y };
      body.orbitRadiusPx = 0;
      continue;
    }
    body.orbitRadiusPx = (body.distanceValue / viewHalfWidthKm) * maxOrbitPx;
    // Keep angle; update position from current angle.
    body.position = {
      x: center.x + Math.cos(body.angle) * body.orbitRadiusPx,
      y: center.y + Math.sin(body.angle) * body.orbitRadiusPx
    };
    const speed = Math.abs(body.omega * body.orbitRadiusPx);
    body.velocity = {
      x: -Math.sin(body.angle) * speed,
      y: Math.cos(body.angle) * speed
    };
  }
}

export function createGravityOrbitSim(initial: GravitySettings): GravityOrbitSim {
  let center: Vec2 = { x: LOGICAL_WIDTH / 2, y: LOGICAL_HEIGHT / 2 };
  let centerMass = initial.centralMass;
  let particleCount = DEFAULT_PARTICLE_COUNT;
  let selfGravityEnabled = initial.selfGravity;
  let scenario: ScenarioId = "playground";
  let viewHalfWidthKm = NEAR_EARTH_VIEW_DEFAULT_KM;
  let timeScale = 1;
  let selectedBodyId: string | null = null;
  let particles = createInitialParticles(center, centerMass, particleCount);
  let bodies: NamedBody[] = [];
  let earthPitch: EarthPitchState | null = null;

  function addTrailPoint(trail: Vec2[], point: Vec2, maxLen: number): void {
    trail.push({ x: point.x, y: point.y });
    if (trail.length > maxLen) {
      trail.shift();
    }
  }

  function applyCenterGravity(particle: GravityParticle): Vec2 {
    const delta = sub(center, particle.position);
    const d2 = delta.x * delta.x + delta.y * delta.y + SOFTENING * SOFTENING;
    const invD = 1 / Math.sqrt(d2);
    const invD3 = invD * invD * invD;
    const accelScale = G * centerMass * invD3;
    return {
      x: delta.x * accelScale,
      y: delta.y * accelScale
    };
  }

  function applyParticleGravity(index: number): Vec2 {
    const source = particles[index];
    let ax = 0;
    let ay = 0;
    for (let j = 0; j < particles.length; j += 1) {
      if (j === index) {
        continue;
      }
      const other = particles[j];
      const dx = other.position.x - source.position.x;
      const dy = other.position.y - source.position.y;
      const d2 = dx * dx + dy * dy + SOFTENING * SOFTENING;
      const invD = 1 / Math.sqrt(d2);
      const invD3 = invD * invD * invD;
      const accelScale = G * other.mass * 0.08 * invD3;
      ax += dx * accelScale;
      ay += dy * accelScale;
    }
    return { x: ax, y: ay };
  }

  function keepInLogicalBounds(particle: GravityParticle): void {
    const margin = 18;
    if (particle.position.x < margin || particle.position.x > LOGICAL_WIDTH - margin) {
      particle.velocity.x *= -0.88;
      particle.position.x = clamp(particle.position.x, margin, LOGICAL_WIDTH - margin);
    }
    if (particle.position.y < margin || particle.position.y > LOGICAL_HEIGHT - margin) {
      particle.velocity.y *= -0.88;
      particle.position.y = clamp(particle.position.y, margin, LOGICAL_HEIGHT - margin);
    }
  }

  function loadScenario(next: ScenarioId): void {
    scenario = next;
    selectedBodyId = null;
    earthPitch = null;
    if (next === "playground") {
      bodies = [];
      particles = createInitialParticles(center, centerMass, particleCount);
      return;
    }
    if (next === "earth-pitch") {
      bodies = [];
      particles = [];
      earthPitch = createEarthPitchState();
      return;
    }
    particles = [];
    bodies = buildScenarioBodies(next, center, viewHalfWidthKm);
    const firstOrbiting = bodies.find((b) => !b.isCenter);
    selectedBodyId = firstOrbiting?.id ?? bodies[0]?.id ?? null;
  }

  function stepPlayground(clampedDt: number): void {
    for (let i = 0; i < particles.length; i += 1) {
      const particle = particles[i];
      const centerAccel = applyCenterGravity(particle);
      const particleAccel = selfGravityEnabled ? applyParticleGravity(i) : { x: 0, y: 0 };
      const ax = centerAccel.x + particleAccel.x;
      const ay = centerAccel.y + particleAccel.y;
      particle.acceleration = { x: ax, y: ay };

      particle.velocity.x += ax * clampedDt;
      particle.velocity.y += ay * clampedDt;
      particle.velocity.x *= DRAG;
      particle.velocity.y *= DRAG;

      const speed = magnitude(particle.velocity);
      if (speed > MAX_SPEED) {
        const scale = MAX_SPEED / speed;
        particle.velocity.x *= scale;
        particle.velocity.y *= scale;
      }

      particle.position.x += particle.velocity.x * clampedDt;
      particle.position.y += particle.velocity.y * clampedDt;

      keepInLogicalBounds(particle);
      addTrailPoint(particle.trail, particle.position, PLAYGROUND_TRAIL_LENGTH);
    }
  }

  function stepScenario(clampedDt: number): void {
    for (const body of bodies) {
      if (body.isCenter) {
        body.position = { x: center.x, y: center.y };
        body.velocity = { x: 0, y: 0 };
        body.acceleration = { x: 0, y: 0 };
        continue;
      }
      // Keep positions updated even when off-screen so follow/zoom-to still works.
      if (scenario === "near-earth" && body.orbitRadiusPx > maxVisibleOrbitPx() * 1.35) {
        body.angle += body.omega * clampedDt * timeScale;
        body.position = {
          x: center.x + Math.cos(body.angle) * body.orbitRadiusPx,
          y: center.y + Math.sin(body.angle) * body.orbitRadiusPx
        };
        const speed = Math.abs(body.omega * body.orbitRadiusPx * timeScale);
        body.velocity = {
          x: -Math.sin(body.angle) * speed,
          y: Math.cos(body.angle) * speed
        };
        const dx = center.x - body.position.x;
        const dy = center.y - body.position.y;
        const w2 = body.omega * body.omega;
        body.acceleration = { x: dx * w2, y: dy * w2 };
        continue;
      }
      body.angle += body.omega * clampedDt * timeScale;
      body.position = {
        x: center.x + Math.cos(body.angle) * body.orbitRadiusPx,
        y: center.y + Math.sin(body.angle) * body.orbitRadiusPx
      };
      const speed = Math.abs(body.omega * body.orbitRadiusPx * timeScale);
      body.velocity = {
        x: -Math.sin(body.angle) * speed,
        y: Math.cos(body.angle) * speed
      };
      // Circular-orbit centripetal acceleration (pull toward center).
      const dx = center.x - body.position.x;
      const dy = center.y - body.position.y;
      const w2 = body.omega * body.omega;
      body.acceleration = { x: dx * w2, y: dy * w2 };
      addTrailPoint(body.trail, body.position, TRAIL_LENGTH);
    }
  }

  function maxVisibleOrbitPx(): number {
    return Math.min(LOGICAL_WIDTH, LOGICAL_HEIGHT) * 0.48;
  }

  return {
    step(dt: number): void {
      const clampedDt = clamp(dt, 1 / 240, 1 / 25);
      if (scenario === "playground") {
        stepPlayground(clampedDt);
      } else if (scenario === "earth-pitch" && earthPitch) {
        stepEarthPitch(earthPitch, clampedDt);
      } else {
        stepScenario(clampedDt);
      }
    },
    setScenario(next: ScenarioId): void {
      loadScenario(next);
    },
    setCenterPosition(position: Vec2): void {
      if (scenario !== "playground") {
        return;
      }
      center = {
        x: clamp(position.x, 30, LOGICAL_WIDTH - 30),
        y: clamp(position.y, 30, LOGICAL_HEIGHT - 30)
      };
    },
    setCenterMass(mass: number): void {
      centerMass = clamp(mass, 20, 320);
    },
    setParticleCount(count: number): void {
      particleCount = clamp(Math.round(count), 20, 450);
      if (scenario === "playground") {
        particles = createInitialParticles(center, centerMass, particleCount);
      }
    },
    setSelfGravity(enabled: boolean): void {
      selfGravityEnabled = enabled;
    },
    setViewHalfWidthKm(km: number): void {
      viewHalfWidthKm = clamp(km, NEAR_EARTH_VIEW_MIN_KM, NEAR_EARTH_VIEW_MAX_KM);
      if (scenario === "near-earth") {
        reprojectNearEarthBodies(bodies, center, viewHalfWidthKm);
      }
    },
    setTimeScale(scale: number): void {
      timeScale = clamp(scale, 0.1, 20);
      if (earthPitch) {
        setEarthPitchTimeScale(earthPitch, scale);
      }
    },
    setPitchSpeedFraction(fraction: number): void {
      if (!earthPitch) {
        return;
      }
      setEarthPitchSpeed(earthPitch, fraction);
    },
    setPitchViewZoom(zoom: number): void {
      if (!earthPitch) {
        return;
      }
      setEarthPitchViewZoom(earthPitch, zoom);
    },
    applyPitchPreset(presetId: PitchPresetId): void {
      if (!earthPitch) {
        return;
      }
      applyEarthPitchPreset(earthPitch, presetId);
    },
    resetPitch(): void {
      if (!earthPitch) {
        return;
      }
      resetEarthPitchBall(earthPitch);
    },
    getEarthPitch(): EarthPitchState | null {
      return earthPitch;
    },
    pickBodyAt(position: Vec2, hitScale = 1): string | null {
      if (scenario === "playground") {
        return null;
      }
      let bestId: string | null = null;
      let bestDist = Infinity;
      const scale = Math.max(0.35, hitScale);
      for (const body of bodies) {
        const dx = body.position.x - position.x;
        const dy = body.position.y - position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const hitR = Math.max(body.drawRadius + 8, 14) / scale;
        if (dist <= hitR && dist < bestDist) {
          bestDist = dist;
          bestId = body.id;
        }
      }
      return bestId;
    },
    selectBody(id: string | null): void {
      selectedBodyId = id;
    },
    getSelectedInfo(): SelectedBodyInfo | null {
      if (!selectedBodyId) {
        return null;
      }
      const body = bodies.find((b) => b.id === selectedBodyId);
      if (!body) {
        return null;
      }
      const speed = magnitude(body.velocity);
      return {
        id: body.id,
        name: body.name,
        description: body.description,
        distanceLabel: body.isCenter
          ? "center"
          : formatDistance(body.distanceValue, body.distanceUnit),
        periodLabel: body.periodLabel,
        speedLabel: scenario === "playground" ? `${speed.toFixed(1)}` : body.periodLabel
      };
    },
    getSelectedBody(): NamedBody | null {
      if (!selectedBodyId) {
        return null;
      }
      return bodies.find((b) => b.id === selectedBodyId) ?? null;
    },
    getSnapshot(): GravitySnapshot {
      let totalKineticEnergy = 0;
      let speedSum = 0;
      let speedCount = 0;

      if (scenario === "playground") {
        for (const particle of particles) {
          const speed = magnitude(particle.velocity);
          totalKineticEnergy += 0.5 * particle.mass * speed * speed;
          speedSum += speed;
          speedCount += 1;
        }
      } else if (scenario === "earth-pitch" && earthPitch) {
        const speed = magnitude(earthPitch.ball.velocity);
        speedSum = speed;
        speedCount = earthPitch.ball.flying ? 1 : 0;
        totalKineticEnergy = 0.5 * speed * speed;
      } else {
        for (const body of bodies) {
          if (body.isCenter) {
            continue;
          }
          const speed = magnitude(body.velocity);
          speedSum += speed;
          speedCount += 1;
        }
      }

      return {
        width: LOGICAL_WIDTH,
        height: LOGICAL_HEIGHT,
        scenario,
        center,
        centerMass,
        particles,
        bodies,
        selectedBodyId,
        viewHalfWidthKm: scenario === "near-earth" ? viewHalfWidthKm : null,
        earthPitch: earthPitch,
        totalKineticEnergy,
        averageSpeed: speedCount > 0 ? speedSum / speedCount : 0,
        note: earthPitch?.note ?? SCENARIOS[scenario].note
      };
    },
    reset(): void {
      if (scenario === "playground") {
        particles = createInitialParticles(center, centerMass, particleCount);
        return;
      }
      if (scenario === "earth-pitch" && earthPitch) {
        resetEarthPitchBall(earthPitch);
        return;
      }
      const keepSelected = selectedBodyId;
      bodies = buildScenarioBodies(scenario, center, viewHalfWidthKm);
      selectedBodyId =
        bodies.some((b) => b.id === keepSelected) ? keepSelected : bodies.find((b) => !b.isCenter)?.id ?? null;
    }
  };
}
