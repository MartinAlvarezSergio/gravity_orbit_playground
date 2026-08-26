import { applyCameraTransform, type CameraView } from "./camera";
import { drawNamedBody } from "./bodyVisuals";
import { renderEarthPitchWorld } from "./earthPitchRender";
import { formatDistance } from "./scenarios";
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
  if (len < 1.5) {
    return;
  }
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + dx, y + dy);
  ctx.stroke();

  const angle = Math.atan2(dy, dx);
  const head = Math.min(8, len * 0.35);
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
      ctx.strokeStyle =
        snapshot.selectedBodyId === body.id
          ? "rgba(255, 220, 140, 0.55)"
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
      drawArrow(
        ctx,
        particle.position.x,
        particle.position.y,
        particle.acceleration.x * 0.012,
        particle.acceleration.y * 0.012,
        "rgba(255, 140, 110, 0.9)"
      );
    }
    if (options.showVelocityVectors) {
      drawArrow(
        ctx,
        particle.position.x,
        particle.position.y,
        particle.velocity.x * 0.045,
        particle.velocity.y * 0.045,
        "rgba(110, 220, 170, 0.85)"
      );
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

function visibleScenarioBodies(snapshot: GravitySnapshot, camera: CameraView): NamedBody[] {
  if (snapshot.scenario !== "near-earth") {
    return snapshot.bodies;
  }
  // When zoomed/following, keep all bodies available so follow targets stay visible.
  if (camera.zoom > 1.05) {
    return snapshot.bodies;
  }
  const maxR = Math.min(snapshot.width, snapshot.height) * 0.48;
  return snapshot.bodies.filter((b) => b.isCenter || b.orbitRadiusPx <= maxR * 1.25);
}

function drawScenarioBodies(
  ctx: CanvasRenderingContext2D,
  snapshot: GravitySnapshot,
  options: RenderOptions,
  visible: NamedBody[]
): void {
  for (const body of visible) {
    if (!body.isCenter && options.showForceVectors) {
      drawArrow(
        ctx,
        body.position.x,
        body.position.y,
        body.acceleration.x * 0.035,
        body.acceleration.y * 0.035,
        "rgba(255, 140, 110, 0.92)"
      );
    }
    if (!body.isCenter && options.showVelocityVectors) {
      drawArrow(
        ctx,
        body.position.x,
        body.position.y,
        body.velocity.x * 0.08,
        body.velocity.y * 0.08,
        "rgba(110, 220, 170, 0.85)"
      );
    }

    drawNamedBody(ctx, body.visual, body.position.x, body.position.y, body.drawRadius, {
      selected: snapshot.selectedBodyId === body.id,
      label: body.shortLabel
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
    bits.push(`View half-width ≈ ${formatDistance(snapshot.viewHalfWidthKm, "km")}`);
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
