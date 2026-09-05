export const SECTORS = [20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];
export function scoreAt(x: number, y: number) {
  const r = Math.hypot(x,y);
  if (!Number.isFinite(r) || r > 1) return { score: 0, label: 'MISS' };
  if (r <= .0374) return { score: 50, label: 'BULL' };
  if (r <= .0935) return { score: 25, label: 'OUTER BULL' };
  const angle = (Math.atan2(y,x) + Math.PI/2 + Math.PI/20 + Math.PI*2) % (Math.PI*2);
  const sector = SECTORS[Math.floor(angle / (Math.PI/10)) % 20];
  const multiplier = r >= .953 ? 2 : r >= .582 && r <= .629 ? 3 : 1;
  return { score: sector*multiplier, label: `${multiplier === 3 ? 'TRIPLE' : multiplier === 2 ? 'DOUBLE' : 'SINGLE'} ${sector}` };
}
/** Hysteresis and minimum hold prevent jitter and tracking loss from firing. */
export class Gesture {
  armed = false;
  private since: number | null = null;
  private ready = false;
  reset() { this.armed = false; this.since = null; this.ready = false; }
  update(ratio: number, time: number): boolean {
    if (!Number.isFinite(ratio)) { this.reset(); return false; }
    if (ratio > .65) {
      const fire = this.armed;
      this.armed = false; this.since = null; this.ready = true;
      return fire;
    }
    if (ratio < .38 && this.ready) {
      this.since ??= time;
      if (time - this.since >= 160) this.armed = true;
    } else if (!this.armed) this.since = null;
    return false;
  }
}
