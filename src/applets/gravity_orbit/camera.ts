import { Vec2 } from "../../core/vector";

export type CameraView = {
  focus: Vec2;
  zoom: number;
  width: number;
  height: number;
  /**
   * Optional world rotation (radians, CCW). Used in near-Earth so a camera that
   * rides with Earth can keep the Sun in a fixed direction (heliocentric cue).
   */
  rotation?: number;
};

export function clampZoom(zoom: number, maxZoom = 16): number {
  return Math.min(maxZoom, Math.max(1, zoom));
}

export function defaultCamera(width: number, height: number): CameraView {
  return {
    focus: { x: width / 2, y: height / 2 },
    zoom: 1,
    width,
    height,
    rotation: 0
  };
}

/** Suggested zoom so a body of drawRadius fills roughly `targetPx` on screen. */
export function zoomForBodyRadius(drawRadius: number, targetPx = 48): number {
  if (drawRadius <= 0) {
    return 3;
  }
  return clampZoom(targetPx / drawRadius);
}

export function applyCameraTransform(ctx: CanvasRenderingContext2D, camera: CameraView): void {
  ctx.translate(camera.width / 2, camera.height / 2);
  ctx.scale(camera.zoom, camera.zoom);
  if (camera.rotation) {
    ctx.rotate(camera.rotation);
  }
  ctx.translate(-camera.focus.x, -camera.focus.y);
}

export function screenToWorld(camera: CameraView, screen: Vec2): Vec2 {
  const lx = (screen.x - camera.width / 2) / camera.zoom;
  const ly = (screen.y - camera.height / 2) / camera.zoom;
  const rot = -(camera.rotation ?? 0);
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  return {
    x: cos * lx - sin * ly + camera.focus.x,
    y: sin * lx + cos * ly + camera.focus.y
  };
}

export function worldToScreen(camera: CameraView, world: Vec2): Vec2 {
  const dx = world.x - camera.focus.x;
  const dy = world.y - camera.focus.y;
  const rot = camera.rotation ?? 0;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const lx = cos * dx - sin * dy;
  const ly = sin * dx + cos * dy;
  return {
    x: lx * camera.zoom + camera.width / 2,
    y: ly * camera.zoom + camera.height / 2
  };
}
