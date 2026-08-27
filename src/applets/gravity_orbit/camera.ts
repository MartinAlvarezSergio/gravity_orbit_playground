import { Vec2 } from "../../core/vector";

export type CameraView = {
  focus: Vec2;
  zoom: number;
  width: number;
  height: number;
};

export function clampZoom(zoom: number, maxZoom = 16): number {
  return Math.min(maxZoom, Math.max(1, zoom));
}

export function defaultCamera(width: number, height: number): CameraView {
  return {
    focus: { x: width / 2, y: height / 2 },
    zoom: 1,
    width,
    height
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
  ctx.translate(-camera.focus.x, -camera.focus.y);
}

export function screenToWorld(camera: CameraView, screen: Vec2): Vec2 {
  return {
    x: (screen.x - camera.width / 2) / camera.zoom + camera.focus.x,
    y: (screen.y - camera.height / 2) / camera.zoom + camera.focus.y
  };
}

export function worldToScreen(camera: CameraView, world: Vec2): Vec2 {
  return {
    x: (world.x - camera.focus.x) * camera.zoom + camera.width / 2,
    y: (world.y - camera.focus.y) * camera.zoom + camera.height / 2
  };
}
