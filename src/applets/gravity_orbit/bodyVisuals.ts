import { BodyVisualKind } from "./types";

type DrawBodyOptions = {
  selected?: boolean;
  label?: string;
};

function withShadow(
  ctx: CanvasRenderingContext2D,
  draw: () => void,
  color = "rgba(255,255,255,0.35)"
): void {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  draw();
  ctx.restore();
}

function drawDisc(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  fill: string | CanvasGradient
): void {
  ctx.beginPath();
  ctx.fillStyle = fill;
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  label: string | undefined,
  selected: boolean
): void {
  if (!label) {
    return;
  }
  ctx.save();
  ctx.font = selected ? "600 12px system-ui, sans-serif" : "500 11px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = selected ? "#fff6d5" : "rgba(236, 244, 255, 0.92)";
  ctx.strokeStyle = "rgba(8, 12, 20, 0.75)";
  ctx.lineWidth = 3;
  ctx.strokeText(label, x, y + r + 4);
  ctx.fillText(label, x, y + r + 4);
  ctx.restore();
}

function drawSelectionRing(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  selected: boolean
): void {
  if (!selected) {
    return;
  }
  ctx.save();
  ctx.strokeStyle = "rgba(255, 220, 120, 0.95)";
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.arc(x, y, r + 5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawSun(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  const glow = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 2.4);
  glow.addColorStop(0, "rgba(255, 230, 120, 0.7)");
  glow.addColorStop(1, "rgba(255, 230, 120, 0)");
  drawDisc(ctx, x, y, r * 2.4, glow);
  const core = ctx.createRadialGradient(x - r * 0.2, y - r * 0.2, r * 0.1, x, y, r);
  core.addColorStop(0, "#fff6c8");
  core.addColorStop(1, "#ffb347");
  withShadow(ctx, () => drawDisc(ctx, x, y, r, core), "rgba(255, 200, 80, 0.55)");
}

function drawEarth(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  const ocean = ctx.createRadialGradient(x - r * 0.25, y - r * 0.25, r * 0.1, x, y, r);
  ocean.addColorStop(0, "#7ec8ff");
  ocean.addColorStop(1, "#1d5fad");
  withShadow(ctx, () => drawDisc(ctx, x, y, r, ocean), "rgba(80, 160, 255, 0.4)");
  ctx.fillStyle = "#3f9a57";
  ctx.beginPath();
  ctx.ellipse(x - r * 0.15, y - r * 0.1, r * 0.45, r * 0.28, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + r * 0.25, y + r * 0.2, r * 0.28, r * 0.18, 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  ctx.arc(x, y - r * 0.78, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
}

function drawMoon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  const fill = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  fill.addColorStop(0, "#f0eee8");
  fill.addColorStop(1, "#9a958c");
  withShadow(ctx, () => drawDisc(ctx, x, y, r, fill));
  ctx.fillStyle = "rgba(70, 68, 64, 0.28)";
  for (const [dx, dy, cr] of [
    [-0.25, -0.15, 0.18],
    [0.2, 0.1, 0.14],
    [0.05, -0.35, 0.1],
    [-0.1, 0.3, 0.12]
  ] as const) {
    ctx.beginPath();
    ctx.arc(x + dx * r, y + dy * r, cr * r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawMercury(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  drawDisc(ctx, x, y, r, "#b8b0a4");
  ctx.fillStyle = "rgba(60,55,50,0.25)";
  ctx.beginPath();
  ctx.arc(x + r * 0.2, y - r * 0.15, r * 0.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawVenus(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  const fill = ctx.createRadialGradient(x - r * 0.2, y - r * 0.2, r * 0.1, x, y, r);
  fill.addColorStop(0, "#f5e2a8");
  fill.addColorStop(1, "#c9a04a");
  drawDisc(ctx, x, y, r, fill);
}

function drawMars(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  const fill = ctx.createRadialGradient(x - r * 0.2, y - r * 0.2, r * 0.1, x, y, r);
  fill.addColorStop(0, "#f0a07a");
  fill.addColorStop(1, "#b44a2a");
  drawDisc(ctx, x, y, r, fill);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath();
  ctx.arc(x, y - r * 0.72, r * 0.18, 0, Math.PI * 2);
  ctx.fill();
}

function drawJupiter(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  const fill = ctx.createLinearGradient(x, y - r, x, y + r);
  fill.addColorStop(0, "#e8d2b0");
  fill.addColorStop(0.35, "#c9955a");
  fill.addColorStop(0.55, "#f0d8b8");
  fill.addColorStop(0.75, "#b8733a");
  fill.addColorStop(1, "#d8b890");
  withShadow(ctx, () => drawDisc(ctx, x, y, r, fill));
  ctx.fillStyle = "rgba(180, 70, 50, 0.75)";
  ctx.beginPath();
  ctx.ellipse(x + r * 0.25, y + r * 0.15, r * 0.28, r * 0.16, 0.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawSaturn(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.save();
  ctx.strokeStyle = "rgba(220, 200, 150, 0.85)";
  ctx.lineWidth = Math.max(2, r * 0.22);
  ctx.beginPath();
  ctx.ellipse(x, y, r * 1.85, r * 0.55, -0.25, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  const fill = ctx.createRadialGradient(x - r * 0.2, y - r * 0.2, r * 0.1, x, y, r);
  fill.addColorStop(0, "#f2e0b0");
  fill.addColorStop(1, "#c9a65a");
  drawDisc(ctx, x, y, r, fill);
}

function drawUranus(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  drawDisc(ctx, x, y, r, "#9fd9e8");
  ctx.strokeStyle = "rgba(200, 230, 255, 0.7)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(x, y, r * 1.35, r * 0.35, 1.1, 0, Math.PI * 2);
  ctx.stroke();
}

function drawNeptune(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  const fill = ctx.createRadialGradient(x - r * 0.2, y - r * 0.2, r * 0.1, x, y, r);
  fill.addColorStop(0, "#7eb6ff");
  fill.addColorStop(1, "#2a4db0");
  drawDisc(ctx, x, y, r, fill);
}

/** Cartoon ISS: truss + panels. */
function drawIss(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#d7dde8";
  ctx.fillRect(-r * 0.55, -r * 0.18, r * 1.1, r * 0.36);
  ctx.fillStyle = "#2f6fbf";
  ctx.fillRect(-r * 1.5, -r * 0.55, r * 0.7, r * 1.1);
  ctx.fillRect(r * 0.8, -r * 0.55, r * 0.7, r * 1.1);
  ctx.fillStyle = "#f0c45a";
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Cartoon JWST: gold hexagonal primary + sunshield. */
function drawJwst(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.save();
  ctx.translate(x, y);
  // sunshield
  ctx.fillStyle = "rgba(240, 240, 245, 0.9)";
  ctx.beginPath();
  ctx.moveTo(-r * 1.4, r * 0.55);
  ctx.lineTo(r * 1.4, r * 0.55);
  ctx.lineTo(r * 0.9, r * 1.15);
  ctx.lineTo(-r * 0.9, r * 1.15);
  ctx.closePath();
  ctx.fill();
  // hex mirror cluster
  ctx.fillStyle = "#d4a017";
  ctx.strokeStyle = "#8a6a10";
  ctx.lineWidth = 1;
  const hexR = r * 0.32;
  const centers: Array<[number, number]> = [
    [0, 0],
    [hexR * 1.05, 0],
    [-hexR * 1.05, 0],
    [hexR * 0.52, hexR * 0.9],
    [-hexR * 0.52, hexR * 0.9],
    [hexR * 0.52, -hexR * 0.9],
    [-hexR * 0.52, -hexR * 0.9]
  ];
  for (const [hx, hy] of centers) {
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const a = (Math.PI / 3) * i + Math.PI / 6;
      const px = hx + Math.cos(a) * hexR * 0.55;
      const py = hy - r * 0.25 + Math.sin(a) * hexR * 0.55;
      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

const DRAWERS: Record<
  Exclude<BodyVisualKind, "particle">,
  (ctx: CanvasRenderingContext2D, x: number, y: number, r: number) => void
> = {
  sun: drawSun,
  mercury: drawMercury,
  venus: drawVenus,
  earth: drawEarth,
  mars: drawMars,
  jupiter: drawJupiter,
  saturn: drawSaturn,
  uranus: drawUranus,
  neptune: drawNeptune,
  moon: drawMoon,
  iss: drawIss,
  jwst: drawJwst
};

export function drawNamedBody(
  ctx: CanvasRenderingContext2D,
  visual: BodyVisualKind,
  x: number,
  y: number,
  radius: number,
  options: DrawBodyOptions = {}
): void {
  if (visual === "particle") {
    drawDisc(ctx, x, y, radius, "rgba(232, 246, 255, 0.95)");
    return;
  }
  DRAWERS[visual](ctx, x, y, radius);
  drawSelectionRing(ctx, x, y, radius, Boolean(options.selected));
  drawLabel(ctx, x, y, radius, options.label, Boolean(options.selected));
}
