import { setLogicalTransform } from "../../core/canvasScale";
import { applyCameraTransform, worldToScreen, type CameraView } from "./camera";
import { drawNamedBody } from "./bodyVisuals";
import { renderEarthPitchWorld } from "./earthPitchRender";
import type { HistoricGuide } from "./historicModels";
import { historicModelMeta } from "./historicModels";
import { AU_KM, formatDistance } from "./scenarios";
import { GravityCanvasTheme, GravitySnapshot, NamedBody } from "./types";

type RenderOptions = {
  theme: GravityCanvasTheme;
  showVelocityVectors: boolean;
  showForceVectors: boolean;
  showTrails: boolean;
  showSweptArea: boolean;
  camera: CameraView;
  /** Bottom-edge text strip (status bits and arrow legend). Default true. */
  showHud?: boolean;
};

type CanvasPalette = {
  background: [string, string, string];
  star: string;
  orbitGuide: string;
  binaryOrbitA: string;
  binaryOrbitB: string;
  nearEarthOrbit: string;
  satelliteOrbit: string;
  playgroundTrail: string;
  binaryTrailA: string;
  binaryTrailB: string;
  historicSelectedTrail: string;
  selectedTrail: string;
  historicTrail: string;
  defaultTrail: string;
  sweptAFill: string;
  sweptAStroke: string;
  sweptBFill: string;
  sweptBStroke: string;
  barycenterLine: string;
  barycenterMark: string;
  barycenterFill: string;
  barycenterText: string;
  barycenterTextStroke: string;
  particle: string;
  force: string;
  velocity: string;
  sunDirection: string;
  sunLabel: string;
  sunLabelStroke: string;
  hud: string;
};

const DARK_CANVAS_PALETTE: CanvasPalette = {
  background: ["#061018", "#0b1524", "#121a2b"],
  star: "rgba(220, 230, 255, 0.35)",
  orbitGuide: "rgba(136, 180, 255, 0.18)",
  binaryOrbitA: "rgba(105, 210, 255, 0.42)",
  binaryOrbitB: "rgba(255, 160, 120, 0.42)",
  nearEarthOrbit: "rgba(120, 200, 255, 0.35)",
  satelliteOrbit: "rgba(136, 180, 255, 0.2)",
  playgroundTrail: "rgba(138, 165, 255, 0.17)",
  binaryTrailA: "rgba(105, 210, 255, 0.62)",
  binaryTrailB: "rgba(255, 160, 120, 0.62)",
  historicSelectedTrail: "rgba(255, 170, 140, 0.82)",
  selectedTrail: "rgba(255, 220, 140, 0.7)",
  historicTrail: "rgba(160, 200, 255, 0.22)",
  defaultTrail: "rgba(160, 200, 255, 0.28)",
  sweptAFill: "rgba(80, 205, 255, 0.18)",
  sweptAStroke: "rgba(105, 220, 255, 0.72)",
  sweptBFill: "rgba(255, 130, 90, 0.16)",
  sweptBStroke: "rgba(255, 165, 125, 0.68)",
  barycenterLine: "rgba(245, 248, 255, 0.34)",
  barycenterMark: "rgba(255, 238, 155, 0.98)",
  barycenterFill: "rgba(255, 238, 155, 0.2)",
  barycenterText: "rgba(255, 239, 170, 1)",
  barycenterTextStroke: "rgba(0, 0, 0, 0.88)",
  particle: "rgba(232, 246, 255, 0.95)",
  force: "rgba(255, 140, 110, 0.95)",
  velocity: "rgba(110, 220, 170, 0.92)",
  sunDirection: "rgba(255, 210, 110, 0.95)",
  sunLabel: "rgba(255, 230, 150, 1)",
  sunLabelStroke: "rgba(0, 0, 0, 0.85)",
  hud: "rgba(220, 230, 245, 0.88)"
};

const LIGHT_CANVAS_PALETTE: CanvasPalette = {
  background: ["#fbfdff", "#edf4fb", "#dce8f4"],
  star: "rgba(35, 72, 115, 0.2)",
  orbitGuide: "rgba(35, 78, 126, 0.38)",
  binaryOrbitA: "rgba(0, 105, 150, 0.72)",
  binaryOrbitB: "rgba(174, 65, 27, 0.68)",
  nearEarthOrbit: "rgba(15, 95, 151, 0.58)",
  satelliteOrbit: "rgba(35, 78, 126, 0.4)",
  playgroundTrail: "rgba(44, 76, 132, 0.38)",
  binaryTrailA: "rgba(0, 105, 150, 0.85)",
  binaryTrailB: "rgba(174, 65, 27, 0.82)",
  historicSelectedTrail: "rgba(172, 55, 23, 0.9)",
  selectedTrail: "rgba(145, 91, 0, 0.86)",
  historicTrail: "rgba(39, 84, 133, 0.42)",
  defaultTrail: "rgba(39, 84, 133, 0.5)",
  sweptAFill: "rgba(0, 125, 180, 0.18)",
  sweptAStroke: "rgba(0, 105, 150, 0.78)",
  sweptBFill: "rgba(195, 70, 30, 0.16)",
  sweptBStroke: "rgba(174, 65, 27, 0.75)",
  barycenterLine: "rgba(40, 55, 75, 0.5)",
  barycenterMark: "rgba(126, 82, 0, 0.98)",
  barycenterFill: "rgba(198, 139, 0, 0.16)",
  barycenterText: "#674500",
  barycenterTextStroke: "rgba(255, 255, 255, 0.94)",
  particle: "rgba(24, 52, 86, 0.92)",
  force: "rgba(190, 55, 18, 0.98)",
  velocity: "rgba(0, 112, 62, 0.98)",
  sunDirection: "rgba(145, 91, 0, 0.98)",
  sunLabel: "#704900",
  sunLabelStroke: "rgba(255, 255, 255, 0.95)",
  hud: "rgba(27, 48, 76, 0.92)"
};

function canvasPalette(theme: GravityCanvasTheme): CanvasPalette {
  return theme === "light" ? LIGHT_CANVAS_PALETTE : DARK_CANVAS_PALETTE;
}

function particleRadius(mass: number): number {
  return 1.8 + Math.sqrt(mass) * 1.2;
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dx: number,
  dy: number,
  color: string
): void {
  const len = Math.hypot(dx, dy);
  if (len < 0.5) {
    return;
  }
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + dx, y + dy);
  ctx.stroke();

  const angle = Math.atan2(dy, dx);
  const head = Math.min(10, Math.max(6, len * 0.32));
  ctx.beginPath();
  ctx.moveTo(x + dx, y + dy);
  ctx.lineTo(
    x + dx - head * Math.cos(angle - 0.4),
    y + dy - head * Math.sin(angle - 0.4)
  );
  ctx.lineTo(
    x + dx - head * Math.cos(angle + 0.4),
    y + dy - head * Math.sin(angle + 0.4)
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Keep velocity/force arrows readable even when orbital radii are tiny on screen. */
function readableArrowDelta(
  dx: number,
  dy: number,
  preferredScale: number,
  minLen = 22,
  maxLen = 64
): { dx: number; dy: number } | null {
  const len = Math.hypot(dx, dy);
  if (len < 1e-12) {
    return null;
  }
  const target = Math.min(maxLen, Math.max(minLen, len * preferredScale));
  const s = target / len;
  return { dx: dx * s, dy: dy * s };
}

function guideStroke(
  style: HistoricGuide["style"],
  emphasize: boolean | undefined,
  theme: GravityCanvasTheme
): { color: string; width: number; dash?: number[] } {
  const hot = Boolean(emphasize);
  if (theme === "light") {
    switch (style) {
      case "deferent":
        return {
          color: hot ? "rgba(156, 78, 0, 0.85)" : "rgba(156, 78, 0, 0.43)",
          width: hot ? 1.8 : 1.1
        };
      case "epicycle":
        return {
          color: hot ? "rgba(164, 27, 82, 0.88)" : "rgba(164, 27, 82, 0.44)",
          width: hot ? 1.7 : 1.05,
          dash: hot ? undefined : [4, 4]
        };
      case "sun-path":
        return {
          color: hot ? "rgba(137, 91, 0, 0.86)" : "rgba(137, 91, 0, 0.46)",
          width: hot ? 1.8 : 1.2
        };
      case "spoke":
        return {
          color: hot ? "rgba(43, 73, 112, 0.62)" : "rgba(43, 73, 112, 0.32)",
          width: hot ? 1.3 : 1
        };
      case "epicycle-arm":
        return {
          color: hot ? "rgba(166, 43, 90, 0.82)" : "rgba(166, 43, 90, 0.38)",
          width: hot ? 1.4 : 1
        };
      case "orbit":
      default:
        return {
          color: hot ? "rgba(24, 91, 145, 0.76)" : "rgba(24, 91, 145, 0.38)",
          width: hot ? 1.6 : 1.05
        };
    }
  }
  switch (style) {
    case "deferent":
      return {
        color: hot ? "rgba(255, 196, 120, 0.7)" : "rgba(255, 176, 96, 0.28)",
        width: hot ? 1.8 : 1.1
      };
    case "epicycle":
      return {
        color: hot ? "rgba(255, 120, 160, 0.85)" : "rgba(255, 110, 150, 0.32)",
        width: hot ? 1.7 : 1.05,
        dash: hot ? undefined : [4, 4]
      };
    case "sun-path":
      return {
        color: hot ? "rgba(255, 220, 120, 0.75)" : "rgba(255, 210, 100, 0.35)",
        width: hot ? 1.8 : 1.2
      };
    case "spoke":
      return {
        color: hot ? "rgba(200, 220, 255, 0.55)" : "rgba(160, 180, 220, 0.22)",
        width: hot ? 1.3 : 1
      };
    case "epicycle-arm":
      return {
        color: hot ? "rgba(255, 150, 180, 0.8)" : "rgba(255, 130, 160, 0.28)",
        width: hot ? 1.4 : 1
      };
    case "orbit":
    default:
      return {
        color: hot ? "rgba(140, 200, 255, 0.65)" : "rgba(136, 180, 255, 0.2)",
        width: hot ? 1.6 : 1.05
      };
  }
}

function drawHistoricGuides(
  ctx: CanvasRenderingContext2D,
  guides: HistoricGuide[],
  theme: GravityCanvasTheme
): void {
  // Dim guides first, emphasized on top.
  const ordered = [...guides].sort((a, b) => Number(Boolean(a.emphasize)) - Number(Boolean(b.emphasize)));
  for (const guide of ordered) {
    const stroke = guideStroke(guide.style, guide.emphasize, theme);
    ctx.save();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    if (stroke.dash) {
      ctx.setLineDash(stroke.dash);
    }
    if (guide.kind === "circle") {
      if (guide.radiusPx < 4) {
        ctx.restore();
        continue;
      }
      ctx.beginPath();
      ctx.arc(guide.cx, guide.cy, guide.radiusPx, 0, Math.PI * 2);
      ctx.stroke();
    } else if (guide.kind === "ellipse") {
      ctx.beginPath();
      ctx.translate(guide.cx, guide.cy);
      ctx.rotate(guide.rotation);
      ctx.scale(1, guide.bPx / Math.max(guide.aPx, 1e-6));
      ctx.arc(0, 0, guide.aPx, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(guide.x0, guide.y0);
      ctx.lineTo(guide.x1, guide.y1);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawOrbitGuides(
  ctx: CanvasRenderingContext2D,
  snapshot: GravitySnapshot,
  visibleBodies: NamedBody[],
  options: RenderOptions
): void {
  const { center, scenario } = snapshot;
  const palette = canvasPalette(options.theme);
  ctx.save();
  ctx.strokeStyle = palette.orbitGuide;
  ctx.lineWidth = 1;

  if (scenario === "playground") {
    for (let r = 100; r <= 300; r += 100) {
      ctx.beginPath();
      ctx.arc(center.x, center.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  if (scenario === "historic-models") {
    drawHistoricGuides(ctx, snapshot.historicGuides, options.theme);
    ctx.restore();
    return;
  }

  if (scenario === "binary-system") {
    const bodyA = visibleBodies.find((body) => body.id === "binary-a");
    const bodyB = visibleBodies.find((body) => body.id === "binary-b");
    const eccentricity = snapshot.binarySystem?.eccentricity ?? 0;
    const minorAxisFactor = Math.sqrt(Math.max(0, 1 - eccentricity * eccentricity));
    if (bodyA) {
      ctx.strokeStyle = palette.binaryOrbitA;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(
        center.x - bodyA.orbitRadiusPx * eccentricity,
        center.y,
        bodyA.orbitRadiusPx,
        bodyA.orbitRadiusPx * minorAxisFactor,
        0,
        0,
        Math.PI * 2
      );
      ctx.stroke();
    }
    if (bodyB) {
      ctx.strokeStyle = palette.binaryOrbitB;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(
        center.x + bodyB.orbitRadiusPx * eccentricity,
        center.y,
        bodyB.orbitRadiusPx,
        bodyB.orbitRadiusPx * minorAxisFactor,
        0,
        0,
        Math.PI * 2
      );
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  if (scenario === "near-earth") {
    const sun = visibleBodies.find((b) => b.id === "sun") ?? snapshot.bodies.find((b) => b.id === "sun");
    const earth =
      visibleBodies.find((b) => b.id === "earth") ?? snapshot.bodies.find((b) => b.id === "earth");
    if (sun && earth) {
      // Always paint Earth's heliocentric orbit (circle centered on the Sun through Earth).
      const earthOrbitR = Math.hypot(earth.position.x - sun.position.x, earth.position.y - sun.position.y);
      if (earthOrbitR > 8) {
        ctx.strokeStyle = palette.nearEarthOrbit;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(sun.position.x, sun.position.y, earthOrbitR, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    // Satellite rings around Earth (not the Sun).
    if (earth) {
      ctx.strokeStyle = palette.satelliteOrbit;
      ctx.lineWidth = 1;
      for (const body of visibleBodies) {
        if (body.id === "iss" || body.id === "moon" || body.id === "jwst") {
          const r = Math.hypot(body.position.x - earth.position.x, body.position.y - earth.position.y);
          if (r < 8) {
            continue;
          }
          ctx.beginPath();
          ctx.arc(earth.position.x, earth.position.y, r, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
    return;
  }

  for (const body of visibleBodies) {
    if (body.isCenter || body.orbitRadiusPx < 8) {
      continue;
    }
    ctx.beginPath();
    ctx.arc(center.x, center.y, body.orbitRadiusPx, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTrails(
  ctx: CanvasRenderingContext2D,
  snapshot: GravitySnapshot,
  options: RenderOptions
): void {
  if (!options.showTrails) {
    return;
  }
  const palette = canvasPalette(options.theme);
  ctx.save();
  ctx.lineWidth = 1.2;

  if (snapshot.scenario === "playground") {
    ctx.strokeStyle = palette.playgroundTrail;
    for (const particle of snapshot.particles) {
      if (particle.trail.length < 2) {
        continue;
      }
      ctx.beginPath();
      ctx.moveTo(particle.trail[0].x, particle.trail[0].y);
      for (let i = 1; i < particle.trail.length; i += 1) {
        ctx.lineTo(particle.trail[i].x, particle.trail[i].y);
      }
      ctx.stroke();
    }
  } else {
    for (const body of snapshot.bodies) {
      if (body.trail.length < 2) {
        continue;
      }
      // Near-Earth: emphasize Earth's heliocentric trail; skip the fixed Sun.
      if (snapshot.scenario === "near-earth" && body.id === "sun") {
        continue;
      }
      if (snapshot.scenario === "historic-models" && body.isCenter) {
        continue;
      }
      const isEarthTrail = snapshot.scenario === "near-earth" && body.id === "earth";
      const isHistoricSelected =
        snapshot.scenario === "historic-models" && snapshot.selectedBodyId === body.id;
      const isBinaryA = snapshot.scenario === "binary-system" && body.id === "binary-a";
      const isBinaryB = snapshot.scenario === "binary-system" && body.id === "binary-b";
      ctx.lineWidth =
        isBinaryA || isBinaryB ? 2.2 : isEarthTrail || isHistoricSelected ? 2.4 : 1.2;
      ctx.strokeStyle = isBinaryA
        ? palette.binaryTrailA
        : isBinaryB
          ? palette.binaryTrailB
          : isHistoricSelected
        ? palette.historicSelectedTrail
        : snapshot.selectedBodyId === body.id || isEarthTrail
          ? palette.selectedTrail
          : snapshot.scenario === "historic-models"
            ? palette.historicTrail
            : palette.defaultTrail;
      ctx.beginPath();
      ctx.moveTo(body.trail[0].x, body.trail[0].y);
      for (let i = 1; i < body.trail.length; i += 1) {
        ctx.lineTo(body.trail[i].x, body.trail[i].y);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawBinarySweptAreas(
  ctx: CanvasRenderingContext2D,
  snapshot: GravitySnapshot,
  options: RenderOptions
): void {
  const binary = snapshot.binarySystem;
  if (!binary) {
    return;
  }
  const palette = canvasPalette(options.theme);
  const focus = binary.barycenter;

  function drawSector(path: { x: number; y: number }[], fill: string, stroke: string): void {
    if (path.length < 2) {
      return;
    }
    ctx.save();
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.35;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(focus.x, focus.y);
    for (const point of path) {
      ctx.lineTo(point.x, point.y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  drawSector(
    binary.bodyASweptPath,
    palette.sweptAFill,
    palette.sweptAStroke
  );
  drawSector(
    binary.bodyBSweptPath,
    palette.sweptBFill,
    palette.sweptBStroke
  );
}

function drawBinaryBarycenter(
  ctx: CanvasRenderingContext2D,
  snapshot: GravitySnapshot,
  options: RenderOptions
): void {
  const binary = snapshot.binarySystem;
  if (!binary) {
    return;
  }
  const bodyA = snapshot.bodies.find((body) => body.id === "binary-a");
  const bodyB = snapshot.bodies.find((body) => body.id === "binary-b");
  if (!bodyA || !bodyB) {
    return;
  }

  const palette = canvasPalette(options.theme);
  const { x, y } = binary.barycenter;
  ctx.save();
  ctx.strokeStyle = palette.barycenterLine;
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(bodyA.position.x, bodyA.position.y);
  ctx.lineTo(bodyB.position.x, bodyB.position.y);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = palette.barycenterMark;
  ctx.fillStyle = palette.barycenterFill;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 13, y);
  ctx.lineTo(x + 13, y);
  ctx.moveTo(x, y - 13);
  ctx.lineTo(x, y + 13);
  ctx.stroke();

  ctx.font = "700 12px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.lineWidth = 4;
  ctx.strokeStyle = palette.barycenterTextStroke;
  ctx.fillStyle = palette.barycenterText;
  ctx.strokeText("shared center of mass", x, y - 17);
  ctx.fillText("shared center of mass", x, y - 17);
  ctx.restore();
}

function drawPlaygroundBodies(
  ctx: CanvasRenderingContext2D,
  snapshot: GravitySnapshot,
  options: RenderOptions
): void {
  const palette = canvasPalette(options.theme);
  for (const particle of snapshot.particles) {
    if (options.showForceVectors) {
      const d = readableArrowDelta(particle.acceleration.x, particle.acceleration.y, 0.026, 20, 60);
      if (d) {
        drawArrow(ctx, particle.position.x, particle.position.y, d.dx, d.dy, palette.force);
      }
    }
    if (options.showVelocityVectors) {
      const d = readableArrowDelta(particle.velocity.x, particle.velocity.y, 0.06, 16, 48);
      if (d) {
        drawArrow(ctx, particle.position.x, particle.position.y, d.dx, d.dy, palette.velocity);
      }
    }

    ctx.beginPath();
    ctx.fillStyle = palette.particle;
    ctx.arc(
      particle.position.x,
      particle.position.y,
      particleRadius(particle.mass),
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  const centerRadius = 10 + Math.sqrt(snapshot.centerMass) * 0.9;
  drawNamedBody(ctx, "sun", snapshot.center.x, snapshot.center.y, centerRadius, {
    label: undefined,
    theme: options.theme
  });
}

function visibleScenarioBodies(snapshot: GravitySnapshot, _camera: CameraView): NamedBody[] {
  void _camera;
  if (snapshot.scenario !== "near-earth") {
    return snapshot.bodies;
  }
  // Hide craft that still collapse onto Earth even with dual-scale mapping.
  return snapshot.bodies.filter((body) => {
    if (body.id === "sun" || body.id === "earth") {
      return true;
    }
    return body.orbitRadiusPx >= 2.8;
  });
}

function isBodyOnScreen(
  body: NamedBody,
  camera: CameraView,
  marginPx = 28
): boolean {
  const screen = worldToScreen(camera, body.position);
  const pad = marginPx + body.drawRadius * camera.zoom;
  return (
    screen.x >= -pad &&
    screen.x <= camera.width + pad &&
    screen.y >= -pad &&
    screen.y <= camera.height + pad
  );
}

/**
 * When the Sun is off-screen in the near-Earth scenario, point from Earth toward it.
 * Drawn in world space while the camera transform is active.
 */
function drawSunDirectionHint(
  ctx: CanvasRenderingContext2D,
  earth: NamedBody,
  sun: NamedBody,
  camera: CameraView,
  theme: GravityCanvasTheme
): void {
  if (isBodyOnScreen(sun, camera, 36)) {
    return;
  }
  const dx = sun.position.x - earth.position.x;
  const dy = sun.position.y - earth.position.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) {
    return;
  }
  const ux = dx / len;
  const uy = dy / len;
  // Keep arrow length roughly constant on screen across zooms.
  const arrowLen = Math.max(42, 56 / camera.zoom);
  const startPad = earth.drawRadius + 6 / camera.zoom;
  const x0 = earth.position.x + ux * startPad;
  const y0 = earth.position.y + uy * startPad;
  const x1 = x0 + ux * arrowLen;
  const y1 = y0 + uy * arrowLen;
  const palette = canvasPalette(theme);

  drawArrow(ctx, x0, y0, x1 - x0, y1 - y0, palette.sunDirection);

  const tip = worldToScreen(camera, { x: x1, y: y1 });
  ctx.save();
  // Screen space in logical units (the backing store may be at device resolution).
  setLogicalTransform(ctx, camera.width);
  ctx.font = "700 12px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 3;
  ctx.strokeStyle = palette.sunLabelStroke;
  ctx.fillStyle = palette.sunLabel;
  ctx.strokeText("Sun", tip.x, tip.y - 14);
  ctx.fillText("Sun", tip.x, tip.y - 14);
  ctx.restore();
}

function drawScenarioBodies(
  ctx: CanvasRenderingContext2D,
  snapshot: GravitySnapshot,
  options: RenderOptions,
  visible: NamedBody[]
): void {
  const palette = canvasPalette(options.theme);
  const sun =
    snapshot.scenario === "near-earth"
      ? snapshot.bodies.find((b) => b.id === "sun")
      : undefined;
  const earth =
    snapshot.scenario === "near-earth"
      ? snapshot.bodies.find((b) => b.id === "earth")
      : undefined;

  if (snapshot.scenario === "near-earth" && earth && sun) {
    drawSunDirectionHint(ctx, earth, sun, options.camera, options.theme);
  }

  for (const body of visible) {
    const showMotion =
      !body.isCenter || (snapshot.scenario === "near-earth" && body.id === "earth");
    // Historic models are kinematic cartoons — no Newtonian pull arrows.
    if (showMotion && options.showForceVectors && snapshot.scenario !== "historic-models") {
      const d = readableArrowDelta(body.acceleration.x, body.acceleration.y, 0.065, 28, 80);
      if (d) {
        drawArrow(
          ctx,
          body.position.x,
          body.position.y,
          d.dx,
          d.dy,
          palette.force
        );
      }
    }
    if (showMotion && options.showVelocityVectors) {
      const d = readableArrowDelta(body.velocity.x, body.velocity.y, 0.12);
      if (d) {
        drawArrow(
          ctx,
          body.position.x,
          body.position.y,
          d.dx,
          d.dy,
          palette.velocity
        );
      }
    }

    const lightToSun =
      sun && (body.id === "earth" || body.id === "moon")
        ? {
            x: sun.position.x - body.position.x,
            y: sun.position.y - body.position.y
          }
        : undefined;

    drawNamedBody(ctx, body.visual, body.position.x, body.position.y, body.drawRadius, {
      selected: snapshot.selectedBodyId === body.id,
      label: body.drawRadius >= 3.2 ? body.shortLabel : undefined,
      lightToSun,
      camera: options.camera,
      theme: options.theme
    });
  }
}

function drawHud(
  ctx: CanvasRenderingContext2D,
  snapshot: GravitySnapshot,
  options: RenderOptions
): void {
  const palette = canvasPalette(options.theme);
  ctx.save();
  setLogicalTransform(ctx, snapshot.width);
  ctx.font = "500 12px system-ui, sans-serif";
  ctx.fillStyle = palette.hud;
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";

  const bits: string[] = [];
  if (snapshot.scenario === "near-earth" && snapshot.viewHalfWidthKm != null) {
    bits.push(`Neighborhood half-width ≈ ${formatDistance(snapshot.viewHalfWidthKm, "km")}`);
    if (snapshot.viewHalfWidthKm < AU_KM * 0.85) {
      bits.push("Earth–Sun gap compressed");
    }
  }
  if (snapshot.scenario === "historic-models" && snapshot.historicModel) {
    const meta = historicModelMeta(snapshot.historicModel);
    bits.push(`${meta.label} · ${meta.yearHint}`);
  }
  if (snapshot.binarySystem) {
    bits.push(
      `Masses A ${snapshot.binarySystem.bodyAMass.toFixed(1)} · B ${snapshot.binarySystem.bodyBMass.toFixed(1)}`
    );
    bits.push(`e ${snapshot.binarySystem.eccentricity.toFixed(2)}`);
    bits.push(`period ${snapshot.binarySystem.orbitalPeriodSeconds.toFixed(1)} sim s`);
    if (options.showSweptArea) {
      bits.push(
        `shaded = ${(snapshot.binarySystem.sweepPeriodFraction * 100).toFixed(0)}% of a period`
      );
    }
  }
  if (snapshot.earthPitch) {
    const pitch = snapshot.earthPitch;
    bits.push(`${pitch.speedFraction.toFixed(2)}× v_circ`);
    if (!pitch.ball.flying) {
      bits.push("impact");
    }
  }
  if (options.camera.zoom > 1.01) {
    bits.push(`Zoom ${options.camera.zoom.toFixed(1)}×`);
  }
  if (bits.length > 0) {
    ctx.fillText(bits.join(" · "), 14, snapshot.height - 12);
  }

  if (options.showVelocityVectors || options.showForceVectors) {
    ctx.textAlign = "right";
    const legend: string[] = [];
    if (options.showVelocityVectors) {
      legend.push("green = velocity");
    }
    if (options.showForceVectors) {
      legend.push("orange = gravitational pull");
    }
    ctx.fillText(legend.join(" · "), snapshot.width - 14, snapshot.height - 12);
  }
  ctx.restore();
}

export function renderGravityOrbit(
  ctx: CanvasRenderingContext2D,
  snapshot: GravitySnapshot,
  options: RenderOptions
): void {
  const { width, height } = snapshot;
  const palette = canvasPalette(options.theme);
  setLogicalTransform(ctx, width);
  ctx.clearRect(0, 0, width, height);

  const background = ctx.createLinearGradient(0, 0, 0, height);
  background.addColorStop(0, palette.background[0]);
  background.addColorStop(0.55, palette.background[1]);
  background.addColorStop(1, palette.background[2]);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  // Soft starfield in screen space.
  ctx.fillStyle = palette.star;
  for (let i = 0; i < 70; i += 1) {
    const x = ((i * 97) % width) + 0.5;
    const y = ((i * 53) % height) + 0.5;
    ctx.fillRect(x, y, i % 7 === 0 ? 2 : 1, i % 7 === 0 ? 2 : 1);
  }

  ctx.save();
  applyCameraTransform(ctx, options.camera);

  if (snapshot.scenario === "earth-pitch" && snapshot.earthPitch) {
    renderEarthPitchWorld(ctx, snapshot.earthPitch, {
      showTrails: options.showTrails,
      showVelocityVectors: options.showVelocityVectors,
      showForceVectors: options.showForceVectors,
      zoom: options.camera.zoom,
      theme: options.theme
    });
  } else {
    const visible = visibleScenarioBodies(snapshot, options.camera);
    if (snapshot.scenario === "binary-system" && options.showSweptArea) {
      drawBinarySweptAreas(ctx, snapshot, options);
    }
    drawOrbitGuides(ctx, snapshot, visible, options);
    drawTrails(ctx, snapshot, options);
    if (snapshot.scenario === "binary-system") {
      drawBinaryBarycenter(ctx, snapshot, options);
    }

    if (snapshot.scenario === "playground") {
      drawPlaygroundBodies(ctx, snapshot, options);
    } else {
      drawScenarioBodies(ctx, snapshot, options, visible);
    }
  }
  ctx.restore();

  if (options.showHud ?? true) {
    drawHud(ctx, snapshot, options);
  }
}
