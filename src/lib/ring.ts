/**
 * Geometry for the portfolio's 3D photo ring. Angles are the ring's rotateY in degrees; the photo
 * facing the viewer is slot round(-angle / step). With fewer than MIN_SLOTS photos the ring keeps
 * MIN_SLOTS places, so a few photos sit together and the rest of the circle is simply empty.
 */
export const RING_MIN_SLOTS = 8;

export function ringGeometry(n: number, cardWidth = 112, gap = 10) {
  const slots = Math.max(n, RING_MIN_SLOTS);
  const step = 360 / slots;
  const radius = Math.round((cardWidth / 2 + gap / 2) / Math.tan(Math.PI / slots));
  return { slots, step, radius };
}

const mod = (a: number, m: number) => ((a % m) + m) % m;

/** The photo facing the viewer; an empty place counts as the nearest photo. */
export function frontIndex(angle: number, n: number): number {
  const { slots, step } = ringGeometry(n);
  const slot = mod(Math.round(-angle / step), slots);
  if (slot < n) return slot;
  return slot - (n - 1) < slots - slot ? n - 1 : 0;
}

/** The nearest angle that faces a real photo (never an empty place). */
export function facePhoto(angle: number, n: number): number {
  const { slots, step } = ringGeometry(n);
  const slot = Math.round(-angle / step);
  const idx = mod(slot, slots);
  if (idx < n) return -slot * step;
  const toFirst = slots - idx; // forward to photo 0
  const toLast = idx - (n - 1); // back to the last photo
  return -(toFirst <= toLast ? slot + toFirst : slot - toLast) * step;
}

/** Angle for the next (dir 1) or previous (dir -1) photo; wraps across empty places. */
export function stepAngle(angle: number, dir: 1 | -1, n: number): number {
  const { slots, step } = ringGeometry(n);
  const front = frontIndex(angle, n);
  const gap = slots - (n - 1);
  const by = dir === 1 && front === n - 1 ? gap : dir === -1 && front === 0 ? -gap : dir;
  return facePhoto(angle, n) - by * step;
}
