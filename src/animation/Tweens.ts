export type Ease = (t: number) => number;

export const ease = {
  linear: (t: number) => t,
  inQuad: (t: number) => t * t,
  outQuad: (t: number) => 1 - (1 - t) * (1 - t),
  inCubic: (t: number) => t * t * t,
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
};

export interface TweenOptions {
  /** Dauer in Sekunden */
  duration: number;
  /** Verzögerung in Sekunden */
  delay?: number;
  ease?: Ease;
  onStart?: () => void;
  onUpdate: (t: number) => void;
  onComplete?: () => void;
}

interface Tween extends TweenOptions {
  elapsed: number;
  started: boolean;
  cancelled: boolean;
}

export interface TweenHandle {
  cancel(): void;
}

/** Schlanker, zeitbasierter Tween-Manager – wird einmal pro Frame aktualisiert. */
export class Animator {
  private tweens: Tween[] = [];

  add(opts: TweenOptions): TweenHandle {
    const tw: Tween = { ...opts, elapsed: 0, started: false, cancelled: false };
    this.tweens.push(tw);
    return { cancel: () => (tw.cancelled = true) };
  }

  /** Führt eine Funktion nach `delay` Sekunden aus. */
  after(delay: number, fn: () => void): TweenHandle {
    return this.add({ duration: 0, delay, onUpdate: () => {}, onComplete: fn });
  }

  update(dt: number): void {
    const list = this.tweens;
    this.tweens = [];
    const keep: Tween[] = [];
    for (const tw of list) {
      if (tw.cancelled) continue;
      tw.elapsed += dt;
      const delay = tw.delay ?? 0;
      if (tw.elapsed < delay) {
        keep.push(tw);
        continue;
      }
      if (!tw.started) {
        tw.started = true;
        tw.onStart?.();
      }
      const raw = tw.duration <= 0 ? 1 : Math.min(1, (tw.elapsed - delay) / tw.duration);
      tw.onUpdate((tw.ease ?? ease.linear)(raw));
      if (raw >= 1) tw.onComplete?.();
      else keep.push(tw);
    }
    // Tweens, die während des Updates neu hinzugefügt wurden, bleiben erhalten.
    this.tweens = keep.concat(this.tweens);
  }
}

export const animator = new Animator();
