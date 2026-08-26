import type { EarthPitchState } from "./earthPitch";
import { Vec2 } from "../../core/vector";

export type ScenarioId = "playground" | "solar-system" | "near-earth" | "earth-pitch";

export type BodyVisualKind =
  | "sun"
  | "mercury"
  | "venus"
  | "earth"
  | "mars"
  | "jupiter"
  | "saturn"
  | "uranus"
  | "neptune"
  | "moon"
  | "iss"
  | "jwst"
  | "particle";

export type GravityParticle = {
  position: Vec2;
  velocity: Vec2;
  /** Instantaneous acceleration (force/mass proxy) for pull-vector display. */
  acceleration: Vec2;
  mass: number;
  trail: Vec2[];
};

export type NamedBody = {
  id: string;
  name: string;
  shortLabel: string;
  description: string;
  visual: BodyVisualKind;
  /** True for the fixed central body in scenario modes. */
  isCenter: boolean;
  /** Display / hit radius in canvas pixels (scenario modes). */
  drawRadius: number;
  /** Physical distance from scenario center (AU or km depending on scenario). */
  distanceValue: number;
  distanceUnit: "AU" | "km";
  /** Approximate orbital period shown to the learner (scenario time, not wall clock). */
  periodLabel: string;
  position: Vec2;
  velocity: Vec2;
  /** Instantaneous acceleration toward the central body (pull vector). */
  acceleration: Vec2;
  trail: Vec2[];
  /** Angle on circular orbit (radians). */
  angle: number;
  /** Angular speed in scenario time (rad / s of sim time). */
  omega: number;
  /** Orbital radius in logical canvas pixels at current scale. */
  orbitRadiusPx: number;
};

export type GravitySettings = {
  centralMass: number;
  selfGravity: boolean;
  showVectors: boolean;
  showTrails: boolean;
};

export type SelectedBodyInfo = {
  id: string;
  name: string;
  description: string;
  distanceLabel: string;
  periodLabel: string;
  speedLabel: string;
};

export type GravitySnapshot = {
  width: number;
  height: number;
  scenario: ScenarioId;
  center: Vec2;
  centerMass: number;
  /** Playground mode particles. */
  particles: GravityParticle[];
  /** Named scenario bodies (empty in playground). */
  bodies: NamedBody[];
  selectedBodyId: string | null;
  /** Half-width of the view in physical units for near-Earth (km). */
  viewHalfWidthKm: number | null;
  /** Newton baseball / cannonball demo state. */
  earthPitch: EarthPitchState | null;
  totalKineticEnergy: number;
  averageSpeed: number;
  note: string;
};
