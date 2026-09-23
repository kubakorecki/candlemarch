// Camera input: drag to pan, mouse wheel to zoom around the cursor. Clicks that don't drag
// are reported as clicks.
import { type CameraView, screenToWorld } from './iso';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2.5;
/** Pointer travel (px) before a press counts as a drag instead of a click. */
const DRAG_THRESHOLD = 5;

export interface CameraInputHandlers {
  onHover(sx: number, sy: number): void;
  onLeave(): void;
  onClick(sx: number, sy: number, button: number, shiftKey: boolean): void;
}

export class CameraInput {
  private press: { x: number; y: number; camX: number; camY: number; dragging: boolean } | null =
    null;
  private readonly abort = new AbortController();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    readonly camera: CameraView,
    private readonly screenSize: () => { w: number; h: number },
    private readonly handlers: CameraInputHandlers,
  ) {
    const opts = { signal: this.abort.signal };
    canvas.addEventListener('pointerdown', (e) => this.down(e), opts);
    canvas.addEventListener('pointermove', (e) => this.move(e), opts);
    canvas.addEventListener('pointerup', (e) => this.up(e), opts);
    canvas.addEventListener('pointerleave', () => this.handlers.onLeave(), opts);
    canvas.addEventListener('wheel', (e) => this.wheel(e), { ...opts, passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault(), opts);
  }

  dispose(): void {
    this.abort.abort();
  }

  private local(e: MouseEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private down(e: PointerEvent): void {
    if (e.button !== 0 && e.button !== 1) return;
    const p = this.local(e);
    this.press = { ...p, camX: this.camera.x, camY: this.camera.y, dragging: false };
    this.canvas.setPointerCapture(e.pointerId);
  }

  private move(e: PointerEvent): void {
    const p = this.local(e);
    const press = this.press;
    if (press) {
      const dx = p.x - press.x;
      const dy = p.y - press.y;
      if (!press.dragging && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        press.dragging = true;
        this.canvas.style.cursor = 'grabbing';
      }
      if (press.dragging) {
        this.camera.x = press.camX - dx / this.camera.zoom;
        this.camera.y = press.camY - dy / this.camera.zoom;
        return;
      }
    }
    this.handlers.onHover(p.x, p.y);
  }

  private up(e: PointerEvent): void {
    const p = this.local(e);
    const press = this.press;
    this.press = null;
    this.canvas.style.cursor = '';
    if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
    if (e.button === 2) {
      this.handlers.onClick(p.x, p.y, 2, e.shiftKey);
    } else if (press && !press.dragging) {
      this.handlers.onClick(p.x, p.y, e.button, e.shiftKey);
    }
  }

  private wheel(e: WheelEvent): void {
    e.preventDefault();
    const p = this.local(e);
    const { w, h } = this.screenSize();
    const before = screenToWorld(p.x, p.y, this.camera, w, h);
    const zoom = this.camera.zoom * Math.exp(-e.deltaY * 0.0015);
    this.camera.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
    // Keep the world point under the cursor fixed.
    const after = screenToWorld(p.x, p.y, this.camera, w, h);
    this.camera.x += before.x - after.x;
    this.camera.y += before.y - after.y;
  }
}
