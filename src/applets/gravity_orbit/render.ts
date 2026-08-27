import { applyCameraTransform, worldToScreen, type CameraView } from "./camera";
import { drawNamedBody } from "./bodyVisuals";
import { renderEarthPitchWorld } from "./earthPitchRender";
import type { HistoricGuide } from "./historicModels";
import { historicModelMeta } from "./historicModels";
import { AU_KM, formatDistance } from "./scenarios";
import { GravitySnapshot, NamedBody } from "./types";

type RenderOptions = {
  showVelocityVectors: boolean;
  showForceVectors: boolean;
  showTrails: boolean;
  camera: CameraView;
};

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
  emphasize: boolean | undefined
): { color: string; width: number; dash?: number[] } {
  const hot = Boolean(emphasize);
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

function drawHistoricGuides(ctx: CanvasRenderingContext2D, guides: HistoricGuide[]): void {
  // Dim guides first, emphasized on top.
  const ordered = [...guides].sort((a, b) => Number(Boolean(a.emphasize)) - Number(Boolean(b.emphasize)));
  for (const guide of ordered) {
    const stroke = guideStroke(guide.style, guide.emphasize);
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
  visibleBodies: NamedBody[]
): void {
  const { center, scenario } = snapshot;
  ctx.save();
  ctx.strokeStyle = "rgba(136, 180, 255, 0.18)";
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
    drawHistoricGuides(ctx, snapshot.historicGuides);
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
        ctx.strokeStyle = "rgba(120, 200, 255, 0.35)";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(sun.position.x, sun.position.y, earthOrbitR, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    // Satellite rings around Earth (not the Sun).
    if (earth) {
      ctx.strokeStyle = "rgba(136, 180, 255, 0.2)";
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
  ctx.save();
  ctx.lineWidth = 1.2;

  if (snapshot.scenario === "playground") {
    ctx.strokeStyle = "rgba(138, 165, 255, 0.17)";
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
      ctx.lineWidth = isEarthTrail || isHistoricSelected ? 2.4 : 1.2;
      ctx.strokeStyle = isHistoricSelected
        ? "rgba(255, 170, 140, 0.82)"
        : snapshot.selectedBodyId === body.id || isEarthTrail
          ? "rgba(255, 220, 140, 0.7)"
          : snapshot.scenario === "historic-models"
            ? "rgba(160, 200, 255, 0.22)"
            : "rgba(160, 200, 255, 0.28)";
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

function drawPlaygroundBodies(
  ctx: CanvasRenderingContext2D,
  snapshot: GravitySnapshot,
  options: RenderOptions
): void {
  for (const particle of snapshot.particles) {
    if (options.showForceVectors) {
      const d = readableArrowDelta(particle.acceleration.x, particle.acceleration.y, 0.02, 16, 48);
      if (d) {
        drawArrow(ctx, particle.position.x, particle.position.y, d.dx, d.dy, "rgba(255, 140, 110, 0.9)");
      }
    }
    if (options.showVelocityVectors) {
      const d = readableArrowDelta(particle.velocity.x, particle.velocity.y, 0.06, 16, 48);
      if (d) {
        drawArrow(ctx, particle.position.x, particle.position.y, d.dx, d.dy, "rgba(110, 220, 170, 0.85)");
      }
    }

    ctx.beginPath();
    ctx.fillStyle = "rgba(232, 246, 255, 0.95)";
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
    label: undefined
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
  camera: CameraView
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

  drawArrow(ctx, x0, y0, x1 - x0, y1 - y0, "rgba(255, 210, 110, 0.95)");

  const tip = worldToScreen(camera, { x: x1, y: y1 });
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.font = "700 12px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.85)";
  ctx.fillStyle = "rgba(255, 230, 150, 1)";
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
  const sun =
    snapshot.scenario === "near-earth"
      ? snapshot.bodies.find((b) => b.id === "sun")
      : undefined;
  const earth =
    snapshot.scenario === "near-earth"
      ? snapshot.bodies.find((b) => b.id === "earth")
      : undefined;

  if (snapshot.scenario === "near-earth" && earth && sun) {
    drawSunDirectionHint(ctx, earth, sun, options.camera);
  }

  for (const body of visible) {
    const showMotion =
      !body.isCenter || (snapshot.scenario === "near-earth" && body.id === "earth");
    // Historic models are kinematic cartoons — no Newtonian pull arrows.
    if (showMotion && options.showForceVectors && snapshot.scenario !== "historic-models") {
      const d = readableArrowDelta(body.acceleration.x, body.acceleration.y, 0.05);
      if (d) {
        drawArrow(
          ctx,
          body.position.x,
          body.position.y,
          d.dx,
          d.dy,
          "rgba(255, 140, 110, 0.95)"
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
          "rgba(110, 220, 170, 0.92)"
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
      camera: options.camera
    });
  }
}

function drawHud(
  ctx: CanvasRenderingContext2D,
  snapshot: GravitySnapshot,
  options: RenderOptions
): void {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.font = "500 12px system-ui, sans-serif";
  ctx.fillStyle = "rgba(220, 230, 245, 0.88)";
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
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const background = ctx.createLinearGradient(0, 0, 0, height);
  background.addColorStop(0, "#061018");
  background.addColorStop(0.55, "#0b1524");
  background.addColorStop(1, "#121a2b");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  // Soft starfield in screen space.
  ctx.fillStyle = "rgba(220, 230, 255, 0.35)";
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
      zoom: options.camera.zoom
    });
  } else {
    const visible = visibleScenarioBodies(snapshot, options.camera);
    drawOrbitGuides(ctx, snapshot, visible);
    drawTrails(ctx, snapshot, options);

    if (snapshot.scenario === "playground") {
      drawPlaygroundBodies(ctx, snapshot, options);
    } else {
      drawScenarioBodies(ctx, snapshot, options, visible);
    }
  }
  ctx.restore();

  drawHud(ctx, snapshot, options);
}
