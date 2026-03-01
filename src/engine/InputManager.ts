import { EventEmitter } from '@/utils/eventEmitter';

export interface SwipeEvent {
  dx: number;
  dy: number;
  direction: 'left' | 'right' | 'up' | 'down';
}

export interface PointerEventPayload {
  x: number;
  y: number;
  button: number;
}

export interface InputEvents {
  keydown: KeyboardEvent;
  keyup: KeyboardEvent;
  tap: { x: number; y: number };
  doubletap: { x: number; y: number };
  longpress: { x: number; y: number };
  swipe: SwipeEvent;
  pointerdown: PointerEventPayload;
  pointerup: PointerEventPayload;
  pointermove: PointerEventPayload;
  player_input: { source: 'mouse' | 'touch' | 'keyboard' };
}

interface TouchState {
  startX: number;
  startY: number;
  startTime: number;
  longPressTimer: number | null;
}

export class InputManager {
  public readonly events = new EventEmitter<InputEvents>();
  private keys = new Set<string>();
  private target: HTMLElement | null = null;
  private touchState: TouchState | null = null;
  private lastTap = 0;

  constructor(target: HTMLElement | Window = window) {
    this.bind();
    if (target instanceof HTMLElement) {
      this.setTarget(target);
    }
  }

  isPressed(key: string): boolean {
    return this.keys.has(key.toLowerCase());
  }

  destroy(): void {
    this.detachPointerTarget();
    this.unbind();
    this.keys.clear();
  }

  setTarget(target: HTMLElement | null): void {
    this.detachPointerTarget();
    this.target = target;
    this.attachPointerTarget();
  }

  private bind(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  private unbind(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }

  private attachPointerTarget(): void {
    if (!this.target) return;
    this.target.addEventListener('pointerdown', this.onPointerDown);
    this.target.addEventListener('pointerup', this.onPointerUp);
    this.target.addEventListener('pointermove', this.onPointerMove);
    this.target.addEventListener('touchstart', this.onTouchStart, { passive: true });
    this.target.addEventListener('touchend', this.onTouchEnd, { passive: true });
    this.target.addEventListener('touchmove', this.onTouchMove, { passive: true });
  }

  private detachPointerTarget(): void {
    if (!this.target) return;
    this.target.removeEventListener('pointerdown', this.onPointerDown);
    this.target.removeEventListener('pointerup', this.onPointerUp);
    this.target.removeEventListener('pointermove', this.onPointerMove);
    this.target.removeEventListener('touchstart', this.onTouchStart);
    this.target.removeEventListener('touchend', this.onTouchEnd);
    this.target.removeEventListener('touchmove', this.onTouchMove);
  }

  private emitPlayerInput(source: 'mouse' | 'touch' | 'keyboard'): void {
    this.events.emit('player_input', { source });
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    this.keys.add(event.key.toLowerCase());
    this.events.emit('keydown', event);
    this.emitPlayerInput('keyboard');
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.key.toLowerCase());
    this.events.emit('keyup', event);
    this.emitPlayerInput('keyboard');
  };

  private onPointerDown = (event: PointerEvent): void => {
    const payload = { x: event.offsetX, y: event.offsetY, button: event.button };
    this.events.emit('pointerdown', payload);
    this.emitPlayerInput('mouse');
  };

  private onPointerUp = (event: PointerEvent): void => {
    const payload = { x: event.offsetX, y: event.offsetY, button: event.button };
    this.events.emit('pointerup', payload);
    this.emitPlayerInput('mouse');
  };

  private onPointerMove = (event: PointerEvent): void => {
    const payload = { x: event.offsetX, y: event.offsetY, button: event.button };
    this.events.emit('pointermove', payload);
  };

  private onTouchStart = (event: TouchEvent): void => {
    const touch = event.touches[0];
    if (!touch) return;

    const now = performance.now();
    const longPressTimer = window.setTimeout(() => {
      if (!this.touchState) return;
      this.events.emit('longpress', { x: this.touchState.startX, y: this.touchState.startY });
      this.emitPlayerInput('touch');
    }, 420);

    this.touchState = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: now,
      longPressTimer,
    };
  };

  private onTouchMove = (event: TouchEvent): void => {
    const touch = event.touches[0];
    if (!touch) return;
    this.events.emit('pointermove', { x: touch.clientX, y: touch.clientY, button: 0 });
  };

  private onTouchEnd = (event: TouchEvent): void => {
    if (!this.touchState) return;
    const changed = event.changedTouches[0];
    if (!changed) return;

    const { startX, startY, startTime, longPressTimer } = this.touchState;
    if (longPressTimer !== null) {
      clearTimeout(longPressTimer);
    }

    const dx = changed.clientX - startX;
    const dy = changed.clientY - startY;
    const dt = performance.now() - startTime;
    const distance = Math.hypot(dx, dy);

    if (distance > 32) {
      const direction = Math.abs(dx) > Math.abs(dy)
        ? (dx > 0 ? 'right' : 'left')
        : (dy > 0 ? 'down' : 'up');

      this.events.emit('swipe', { dx, dy, direction });
      this.emitPlayerInput('touch');
    } else if (dt < 320) {
      const isDoubleTap = performance.now() - this.lastTap < 280;
      const payload = { x: changed.clientX, y: changed.clientY };
      if (isDoubleTap) {
        this.events.emit('doubletap', payload);
      } else {
        this.events.emit('tap', payload);
      }
      this.lastTap = performance.now();
      this.emitPlayerInput('touch');
    }

    this.touchState = null;
  };
}
