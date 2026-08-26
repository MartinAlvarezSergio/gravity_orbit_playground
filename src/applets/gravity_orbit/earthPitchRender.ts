import {
  earthPitchFlatness,
  type EarthPitchState,
  type PitchRegime
} from "./earthPitch";

function drawAtmosphere(ctx: CanvasRenderingContext2D, state: EarthPitchState, flatness: number): void {
  if (flatness > 0.85) {
    return;
  }
  const { earthCenter: c, earthRadius: r } = state;
  const glow = ctx.createRadialGradient(c.x, c.y, r * 0.92, c.x, c.y, r * 1.35);
  glow.addColorStop(0, "rgba(120, 190, 255, 0)");
  glow.addColorStop(0.55, `rgba(110, 180, 255, ${0.18 * (1 - flatness)})`);
  glow.addColorStop(1, "rgba(80, 140, 255, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(c.x, c.y, r * 1.35, 0, Math.PI * 2);
  ctx.fill();
}

function drawEarth(ctx: CanvasRenderingContext2D, state: EarthPitchState): void {
  const { earthCenter: c, earthRadius: r } = state;

  const ocean = ctx.createRadialGradient(c.x - r * 0.25, c.y - r * 0.3, r * 0.1, c.x, c.y, r);
  ocean.addColorStop(0, "#6eb8ff");
  ocean.addColorStop(0.55, "#2a6fbf");
  ocean.addColorStop(1, "#163a72");
  ctx.beginPath();
  ctx.fillStyle = ocean;
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#3f9a57";
  const patches: Array<[number, number, number, number, number]> = [
    [-0.35, -0.2, 0.42, 0.28, -0.5],
    [0.2, 0.15, 0.34, 0.22, 0.4],
    [-0.1, 0.4, 0.26, 0.16, 0.1],
    [0.35, -0.35, 0.2, 0.14, -0.2]
  ];
  for (const [dx, dy, rx, ry, rot] of patches) {
    ctx.beginPath();
    ctx.ellipse(c.x + dx * r, c.y + dy * r, rx * r, ry * r, rot, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "rgba(245, 250, 255, 0.85)";
  ctx.beginPath();
  ctx.ellipse(c.x, c.y - r * 0.82, r * 0.28, r * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(c.x, c.y + r * 0.84, r * 0.24, r * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();

  const shade = ctx.createLinearGradient(c.x - r, c.y, c.x + r, c.y);
  shade.addColorStop(0, "rgba(0,0,0,0.22)");
  shade.addColorStop(0.45, "rgba(0,0,0,0)");
  shade.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.beginPath();
  ctx.fillStyle = shade;
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(200, 230, 255, 0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
  ctx.stroke();
}

/** Local grass / “flat ground” band that reads as a rectangle when zoomed in. */
function drawFlatGroundOverlay(
  ctx: CanvasRenderingContext2D,
  state: EarthPitchState,
  flatness: number,
  zoom: number
): void {
  if (flatness < 0.08) {
    return;
  }
  const { launchPosition: p, launchNormal: n, launchTangent: t } = state;
  const halfWidth = (520 / zoom) * (0.55 + 0.9 * flatness);
  const depth = (140 / zoom) * (0.4 + flatness);

  const left = {
    x: p.x - t.x * halfWidth - n.x * 2,
    y: p.y - t.y * halfWidth - n.y * 2
  };
  const right = {
    x: p.x + t.x * halfWidth - n.x * 2,
    y: p.y + t.y * halfWidth - n.y * 2
  };
  const leftIn = {
    x: left.x - n.x * depth,
    y: left.y - n.y * depth
  };
  const rightIn = {
    x: right.x - n.x * depth,
    y: right.y - n.y * depth
  };

  ctx.save();
  ctx.globalAlpha = 0.35 + 0.5 * flatness;
  const grass = ctx.createLinearGradient(left.x, left.y, leftIn.x, leftIn.y);
  grass.addColorStop(0, "#6f9a4e");
  grass.addColorStop(1, "#3f6a32");
  ctx.fillStyle = grass;
  ctx.beginPath();
  ctx.moveTo(left.x, left.y);
  ctx.lineTo(right.x, right.y);
  ctx.lineTo(rightIn.x, rightIn.y);
  ctx.lineTo(leftIn.x, leftIn.y);
  ctx.closePath();
  ctx.fill();

  // Horizon line — the “rectangle” cue for a flat classroom view.
  ctx.strokeStyle = `rgba(230, 240, 255, ${0.25 + 0.55 * flatness})`;
  ctx.lineWidth = Math.max(1.2 / zoom, 0.04);
  ctx.beginPath();
  ctx.moveTo(left.x, left.y);
  ctx.lineTo(right.x, right.y);
  ctx.stroke();

  if (flatness > 0.55) {
    ctx.fillStyle = `rgba(180, 210, 255, ${0.12 * flatness})`;
    const skyLeft = {
      x: left.x + n.x * (220 / zoom),
      y: left.y + n.y * (220 / zoom)
    };
    const skyRight = {
      x: right.x + n.x * (220 / zoom),
      y: right.y + n.y * (220 / zoom)
    };
    ctx.beginPath();
    ctx.moveTo(left.x, left.y);
    ctx.lineTo(right.x, right.y);
    ctx.lineTo(skyRight.x, skyRight.y);
    ctx.lineTo(skyLeft.x, skyLeft.y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawReferenceOrbits(
  ctx: CanvasRenderingContext2D,
  state: EarthPitchState,
  flatness: number
): void {
  if (flatness > 0.35) {
    return;
  }
  const { earthCenter: c, earthRadius: r } = state;
  ctx.save();
  ctx.globalAlpha = 1 - flatness * 2.2;
  ctx.setLineDash([5, 6]);
  ctx.lineWidth = 1.2;

  ctx.strokeStyle = "rgba(140, 220, 170, 0.45)";
  ctx.beginPath();
  ctx.arc(c.x, c.y, r + 3.2, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = "rgba(180, 170, 255, 0.28)";
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, r * 1.35, r * 1.05, state.launchAngle, 0, Math.PI * 2);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.restore();
}

function drawMountainAndPitcher(
  ctx: CanvasRenderingContext2D,
  state: EarthPitchState,
  zoom: number
): void {
  const { launchPosition: p, launchNormal: n } = state;
  const inv = 1 / Math.max(zoom, 0.001);

  // Keep pitcher + mound at roughly constant on-screen size while Earth zooms.
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(Math.atan2(n.y, n.x) + Math.PI / 2);
  ctx.scale(inv, inv);

  ctx.fillStyle = "#5a6b52";
  ctx.beginPath();
  ctx.moveTo(-28, 10);
  ctx.lineTo(-12, -14);
  ctx.lineTo(16, -12);
  ctx.lineTo(30, 12);
  ctx.closePath();
  ctx.fill();

  const lamp = ctx.createRadialGradient(0, -28, 1, 0, -28, 32);
  lamp.addColorStop(0, "rgba(255, 230, 150, 0.45)");
  lamp.addColorStop(1, "rgba(255, 230, 150, 0)");
  ctx.fillStyle = lamp;
  ctx.beginPath();
  ctx.arc(0, -28, 32, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f2e6d4";
  ctx.beginPath();
  ctx.arc(-2, -40, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#e8f0ff";
  ctx.lineWidth = 3.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-2, -33);
  ctx.lineTo(-2, -12);
  ctx.moveTo(-2, -28);
  ctx.lineTo(12, -36);
  ctx.moveTo(-2, -28);
  ctx.lineTo(-10, -20);
  ctx.moveTo(-2, -12);
  ctx.lineTo(-8, 0);
  ctx.moveTo(-2, -12);
  ctx.lineTo(6, 0);
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 220, 120, 0.95)";
  ctx.beginPath();
  ctx.arc(14, -38, 2.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = "600 12px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255, 245, 220, 0.95)";
  ctx.textAlign = "center";
  ctx.fillText("pitcher", 0, -54);
  ctx.restore();
}

function trailColor(regime: PitchRegime, flying: boolean): string {
  if (!flying) {
    return "rgba(255, 160, 120, 0.55)";
  }
  switch (regime) {
    case "everyday":
      return "rgba(255, 210, 140, 0.8)";
    case "suborbital":
      return "rgba(255, 200, 120, 0.7)";
    case "circular":
      return "rgba(120, 230, 170, 0.75)";
    case "elliptical":
      return "rgba(170, 160, 255, 0.75)";
    case "hyperbolic":
      return "rgba(120, 200, 255, 0.8)";
    default:
      return "rgba(220, 230, 255, 0.6)";
  }
}

function drawBall(
  ctx: CanvasRenderingContext2D,
  state: EarthPitchState,
  showTrail: boolean,
  zoom: number
): void {
  const { ball, regime } = state;
  const inv = 1 / Math.max(zoom, 0.001);

  if (showTrail && ball.trail.length > 1) {
    ctx.save();
    ctx.strokeStyle = trailColor(regime, ball.flying);
    ctx.lineWidth = Math.max(2 * inv, 0.03);
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(ball.trail[0].x, ball.trail[0].y);
    for (let i = 1; i < ball.trail.length; i += 1) {
      ctx.lineTo(ball.trail[i].x, ball.trail[i].y);
    }
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(ball.position.x, ball.position.y);
  ctx.scale(inv, inv);

  const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, 16);
  glow.addColorStop(0, "rgba(255, 240, 180, 0.55)");
  glow.addColorStop(1, "rgba(255, 240, 180, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 16, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#fff6d8";
  ctx.strokeStyle = "rgba(80, 60, 30, 0.45)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, 0, 5.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "rgba(200, 60, 60, 0.7)";
  ctx.beginPath();
  ctx.arc(-0.5, 0, 3, -0.8, 0.8);
  ctx.stroke();
  ctx.restore();
}

function drawVectors(
  ctx: CanvasRenderingContext2D,
  state: EarthPitchState,
  showVelocity: boolean,
  showForce: boolean,
  zoom: number
): void {
  const { ball } = state;
  if (!ball.flying) {
    return;
  }
  const inv = 1 / Math.max(zoom, 0.001);
  if (showForce) {
    ctx.strokeStyle = "rgba(255, 140, 110, 0.9)";
    ctx.fillStyle = "rgba(255, 140, 110, 0.9)";
    drawArrow(
      ctx,
      ball.position.x,
      ball.position.y,
      ball.acceleration.x * 0.02 * inv * zoom * 0.35,
      ball.acceleration.y * 0.02 * inv * zoom * 0.35,
      inv
    );
  }
  if (showVelocity) {
    ctx.strokeStyle = "rgba(110, 220, 170, 0.9)";
    ctx.fillStyle = "rgba(110, 220, 170, 0.9)";
    // Keep velocity arrows readable at high zoom for slow pitches.
    const scale = Math.max(0.18, 0.55 * inv * 8);
    drawArrow(
      ctx,
      ball.position.x,
      ball.position.y,
      ball.velocity.x * scale,
      ball.velocity.y * scale,
      inv
    );
  }
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dx: number,
  dy: number,
  inv: number
): void {
  const len = Math.hypot(dx, dy);
  if (len < 0.5 * inv) {
    return;
  }
  ctx.lineWidth = Math.max(1.5 * inv, 0.03);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + dx, y + dy);
  ctx.stroke();
  const angle = Math.atan2(dy, dx);
  const head = Math.min(9 * inv, len * 0.35);
  ctx.beginPath();
  ctx.moveTo(x + dx, y + dy);
  ctx.lineTo(x + dx - head * Math.cos(angle - 0.4), y + dy - head * Math.sin(angle - 0.4));
  ctx.lineTo(x + dx - head * Math.cos(angle + 0.4), y + dy - head * Math.sin(angle + 0.4));
  ctx.closePath();
  ctx.fill();
}

export function renderEarthPitchWorld(
  ctx: CanvasRenderingContext2D,
  state: EarthPitchState,
  options: {
    showVelocityVectors: boolean;
    showForceVectors: boolean;
    showTrails: boolean;
    zoom: number;
  }
): void {
  const zoom = Math.max(options.zoom, 0.001);
  const flatness = earthPitchFlatness(zoom);

  drawAtmosphere(ctx, state, flatness);
  drawReferenceOrbits(ctx, state, flatness);
  drawEarth(ctx, state);
  drawFlatGroundOverlay(ctx, state, flatness, zoom);
  drawMountainAndPitcher(ctx, state, zoom);
  drawBall(ctx, state, options.showTrails, zoom);
  drawVectors(
    ctx,
    state,
    options.showVelocityVectors,
    options.showForceVectors,
    zoom
  );
}
