import { Vec2, magnitude, sub } from "../../core/vector";

export type PitchPresetId = "fast" | "horizon" | "circular" | "elliptical" | "hyperbolic";

export type PitchRegime = "everyday" | "suborbital" | "circular" | "elliptical" | "hyperbolic";

export type PitchBall = {
  position: Vec2;
  velocity: Vec2;
  acceleration: Vec2;
  trail: Vec2[];
  /** False after surface impact. */
  flying: boolean;
};

export type EarthPitchState = {
  earthCenter: Vec2;
  earthRadius: number;
  /** Launch site angle from +x axis (canvas y-down). */
  launchAngle: number;
  launchPosition: Vec2;
  /** Outward unit normal at launch. */
  launchNormal: Vec2;
  /** Unit tangent used for the pitch direction. */
  launchTangent: Vec2;
  ball: PitchBall;
  /** Launch speed as a fraction of circular-orbit speed. */
  speedFraction: number;
  vCircular: number;
  vEscape: number;
  regime: PitchRegime;
  timeScale: number;
  /** Current camera zoom — used to keep release height matched to the pitcher sprite. */
  viewZoom: number;
  /** World-space height above the surface at release. */
  launchLift: number;
  note: string;
};

export type PitchPreset = {
  id: PitchPresetId;
  label: string;
  blurb: string;
  /** Speed as a fraction of v_circular. */
  speedFraction: number;
};

export const PITCH_PRESETS: PitchPreset[] = [
  {
    id: "fast",
    label: "Hard throw (still slow)",
    blurb:
      "Like a strong baseball pitch — way below orbital speed. Stay zoomed in: the ground looks flat and the ball just falls.",
    speedFraction: 0.05
  },
  {
    id: "horizon",
    label: "Long arc over the horizon",
    blurb: "Fast enough that Earth curves under the path, but still not enough to stay in orbit.",
    speedFraction: 0.82
  },
  {
    id: "circular",
    label: "Circular orbit",
    blurb: "Hit circular speed and the ball keeps falling around Earth without hitting the ground.",
    speedFraction: 1.0
  },
  {
    id: "elliptical",
    label: "Elliptical orbit",
    blurb: "Faster than circular, slower than escape — a closed oval that comes back around.",
    speedFraction: 1.22
  },
  {
    id: "hyperbolic",
    label: "Escape trajectory",
    blurb: "Faster than escape speed — the path opens up and the ball doesn’t come back.",
    speedFraction: 1.55
  }
];

const LOGICAL_WIDTH = 900;
const LOGICAL_HEIGHT = 620;
const EARTH_RADIUS = 168;
/**
 * Reference altitude used only to define v_circ / GM so orbital presets stay stable
 * when the visual launch height changes with zoom.
 */
const ORBIT_REF_LIFT = 1.0;
const TRAIL_MAX = 420;
/** Softening keeps the singularity tame if the ball somehow penetrates. */
const SOFTENING = 4;
/**
 * Choose GM so circular speed at the reference altitude is comfortable in px/s.
 * v_circ ≈ 140 px/s → one low orbit ~7.5 s at 1×.
 */
const LAUNCH_RADIUS = EARTH_RADIUS + ORBIT_REF_LIFT;
const V_CIRCULAR = 140;
const GM = V_CIRCULAR * V_CIRCULAR * LAUNCH_RADIUS;
const V_ESCAPE = Math.SQRT2 * V_CIRCULAR;

/** Pitcher hand height in screen pixels (sprite is counter-scaled by 1/zoom). */
const PITCHER_HAND_SCREEN_PX = 38;
/** Camera sits a bit above the mound, also in screen pixels. */
const CAMERA_ELEV_SCREEN_PX = 14;

export const PITCH_SPEED_MIN = 0.02;
export const PITCH_SPEED_MAX = 1.85;
export const PITCH_SPEED_DEFAULT = PITCH_PRESETS[0].speedFraction;
/** Default classroom zoom: Earth surface looks nearly flat. */
export const PITCH_DEFAULT_ZOOM = 48;
export const PITCH_MAX_ZOOM = 90;

/** World-space release height so the ball matches the pitcher’s hand at this zoom. */
export function launchLiftForZoom(zoom: number): number {
  return clamp(PITCHER_HAND_SCREEN_PX / Math.max(zoom, 1), 0.28, 4.5);
}

export function cameraElevForZoom(zoom: number): number {
  return clamp(CAMERA_ELEV_SCREEN_PX / Math.max(zoom, 1), 0.12, 16);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function unitFromAngle(angle: number): Vec2 {
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

function classifyRegime(speedFraction: number): PitchRegime {
  if (speedFraction < 0.25) {
    return "everyday";
  }
  if (speedFraction < 0.97) {
    return "suborbital";
  }
  if (speedFraction <= 1.03) {
    return "circular";
  }
  if (speedFraction < Math.SQRT2 * 0.98) {
    return "elliptical";
  }
  return "hyperbolic";
}

function regimeNote(regime: PitchRegime, speedFraction: number): string {
  switch (regime) {
    case "everyday":
      return `You’re at ${speedFraction.toFixed(2)}× circular speed — still a normal throw compared with orbit. Zoomed in, Earth looks flat and the ball falls. Zoom out, then raise the speed to see orbits appear.`;
    case "suborbital":
      return "Newton’s idea in one sentence: the ball is falling the whole time, but Earth’s surface curves away — until the path hits ground again.";
    case "circular":
      return "At circular speed the path closes: continuous free-fall that never meets the ground (in this airless idealization).";
    case "elliptical":
      return "Between circular and escape speed you get a closed ellipse. Still bound to Earth; no atmosphere in this demo.";
    case "hyperbolic":
      return "Past escape speed the trajectory is open. The ball leaves and doesn’t return on this path.";
    default:
      return "";
  }
}

function launchGeometry(earthCenter: Vec2, earthRadius: number, launchAngle: number) {
  const normal = unitFromAngle(launchAngle);
  // Pitch "eastward": rotate outward normal by +90° in y-down coords → ( -ny, nx ) is one tangent;
  // use (-ny, nx) so a top-of-Earth launch goes to the right.
  const tangent = { x: -normal.y, y: normal.x };
  const launchPosition = {
    x: earthCenter.x + normal.x * earthRadius,
    y: earthCenter.y + normal.y * earthRadius
  };
  return { normal, tangent, launchPosition };
}

function makeBall(launchPosition: Vec2, tangent: Vec2, speed: number, lift: number): PitchBall {
  // Lift to the pitcher’s hand height (zoom-matched) so we do not instantly collide.
  const outward = { x: tangent.y, y: -tangent.x };
  return {
    position: {
      x: launchPosition.x + outward.x * lift,
      y: launchPosition.y + outward.y * lift
    },
    velocity: { x: tangent.x * speed, y: tangent.y * speed },
    acceleration: { x: 0, y: 0 },
    trail: [],
    flying: true
  };
}

export function createEarthPitchState(
  speedFraction = PITCH_SPEED_DEFAULT,
  viewZoom = PITCH_DEFAULT_ZOOM
): EarthPitchState {
  const earthCenter = { x: LOGICAL_WIDTH / 2, y: LOGICAL_HEIGHT / 2 + 18 };
  // Pitcher stands on a highland near the top-right so the arc reads clearly.
  const launchAngle = -Math.PI / 2 + 0.42;
  const { normal, tangent, launchPosition } = launchGeometry(earthCenter, EARTH_RADIUS, launchAngle);
  const fraction = clamp(speedFraction, PITCH_SPEED_MIN, PITCH_SPEED_MAX);
  const speed = V_CIRCULAR * fraction;
  const regime = classifyRegime(fraction);
  const zoom = Math.max(viewZoom, 1);
  const lift = launchLiftForZoom(zoom);

  return {
    earthCenter,
    earthRadius: EARTH_RADIUS,
    launchAngle,
    launchPosition,
    launchNormal: normal,
    launchTangent: tangent,
    ball: makeBall(launchPosition, tangent, speed, lift),
    speedFraction: fraction,
    vCircular: V_CIRCULAR,
    vEscape: V_ESCAPE,
    regime,
    timeScale: 1,
    viewZoom: zoom,
    launchLift: lift,
    note: regimeNote(regime, fraction)
  };
}

function gravityAccel(pos: Vec2, earthCenter: Vec2): Vec2 {
  const delta = sub(earthCenter, pos);
  const d2 = delta.x * delta.x + delta.y * delta.y + SOFTENING * SOFTENING;
  const invD = 1 / Math.sqrt(d2);
  const invD3 = invD * invD * invD;
  return { x: delta.x * GM * invD3, y: delta.y * GM * invD3 };
}

export function stepEarthPitch(state: EarthPitchState, dt: number): void {
  const clampedDt = clamp(dt, 1 / 240, 1 / 40) * state.timeScale;
  const ball = state.ball;
  if (!ball.flying) {
    ball.acceleration = { x: 0, y: 0 };
    return;
  }

  // Velocity Verlet-ish: kick–drift–kick for smoother orbits.
  const a0 = gravityAccel(ball.position, state.earthCenter);
  ball.velocity.x += a0.x * clampedDt * 0.5;
  ball.velocity.y += a0.y * clampedDt * 0.5;
  ball.position.x += ball.velocity.x * clampedDt;
  ball.position.y += ball.velocity.y * clampedDt;
  const a1 = gravityAccel(ball.position, state.earthCenter);
  ball.velocity.x += a1.x * clampedDt * 0.5;
  ball.velocity.y += a1.y * clampedDt * 0.5;
  ball.acceleration = a1;

  const radial = sub(ball.position, state.earthCenter);
  const dist = magnitude(radial);
  if (dist <= state.earthRadius + 0.5) {
    const n = dist > 0 ? { x: radial.x / dist, y: radial.y / dist } : state.launchNormal;
    ball.position = {
      x: state.earthCenter.x + n.x * state.earthRadius,
      y: state.earthCenter.y + n.y * state.earthRadius
    };
    ball.velocity = { x: 0, y: 0 };
    ball.acceleration = { x: 0, y: 0 };
    ball.flying = false;
  }

  ball.trail.push({ x: ball.position.x, y: ball.position.y });
  if (ball.trail.length > TRAIL_MAX) {
    ball.trail.shift();
  }
}

export function setEarthPitchSpeed(state: EarthPitchState, speedFraction: number): void {
  state.speedFraction = clamp(speedFraction, PITCH_SPEED_MIN, PITCH_SPEED_MAX);
  state.regime = classifyRegime(state.speedFraction);
  state.note = regimeNote(state.regime, state.speedFraction);
  resetEarthPitchBall(state);
}

export function applyEarthPitchPreset(state: EarthPitchState, presetId: PitchPresetId): void {
  const preset = PITCH_PRESETS.find((p) => p.id === presetId) ?? PITCH_PRESETS[0];
  setEarthPitchSpeed(state, preset.speedFraction);
}

export function resetEarthPitchBall(state: EarthPitchState): void {
  state.launchLift = launchLiftForZoom(state.viewZoom);
  const speed = state.vCircular * state.speedFraction;
  state.ball = makeBall(state.launchPosition, state.launchTangent, speed, state.launchLift);
  state.regime = classifyRegime(state.speedFraction);
  state.note = regimeNote(state.regime, state.speedFraction);
}

export function setEarthPitchViewZoom(state: EarthPitchState, zoom: number): void {
  state.viewZoom = Math.max(zoom, 1);
  state.launchLift = launchLiftForZoom(state.viewZoom);
  // If the ball is still on the mound (not in flight), keep it glued to hand height.
  if (!state.ball.flying || state.ball.trail.length <= 1) {
    const speed = state.vCircular * state.speedFraction;
    const wasFlying = state.ball.flying;
    const trail = state.ball.trail;
    state.ball = makeBall(state.launchPosition, state.launchTangent, speed, state.launchLift);
    if (!wasFlying) {
      state.ball.flying = false;
      state.ball.velocity = { x: 0, y: 0 };
      state.ball.trail = trail;
    }
  }
}

export function setEarthPitchTimeScale(state: EarthPitchState, scale: number): void {
  state.timeScale = clamp(scale, 0.15, 6);
}

/** Camera focus: zoomed out sees whole Earth; zoomed in sits low on the pitcher. */
export function earthPitchCameraFocus(state: EarthPitchState, zoom: number): Vec2 {
  const t = clamp((zoom - 1) / 2, 0, 1);
  const elev = cameraElevForZoom(zoom);
  const pitcher = {
    x: state.launchPosition.x + state.launchNormal.x * elev,
    y: state.launchPosition.y + state.launchNormal.y * elev
  };
  return {
    x: state.earthCenter.x * (1 - t) + pitcher.x * t,
    y: state.earthCenter.y * (1 - t) + pitcher.y * t
  };
}

export function formatPitchSpeedFraction(speedFraction: number): string {
  const digits = speedFraction < 0.2 ? 3 : 2;
  return `${speedFraction.toFixed(digits)} × v_circ`;
}

export function formatPitchSpeed(state: EarthPitchState): string {
  return formatPitchSpeedFraction(state.speedFraction);
}

export function pitchRegimeLabel(regime: PitchRegime): string {
  switch (regime) {
    case "everyday":
      return "Everyday throw (≪ orbital)";
    case "suborbital":
      return "Suborbital (hits Earth)";
    case "circular":
      return "Circular orbit";
    case "elliptical":
      return "Elliptical orbit";
    case "hyperbolic":
      return "Escape trajectory";
    default:
      return regime;
  }
}

/** How “flat” the local ground looks at this zoom (0 = globe, 1 = flat horizon). */
export function earthPitchFlatness(zoom: number): number {
  return clamp((zoom - 8) / 40, 0, 1);
}
