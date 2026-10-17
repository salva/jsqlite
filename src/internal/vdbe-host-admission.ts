import { ExecutionTaskScheduler } from "./task-scheduler.ts";

/** VM host transport, separate from deterministic work/progress checks.
 * Admission-start spacing, not CPU-slice or timer-latency guarantee. Native
 * vdbe.c check_for_interrupt has no host task transport. See
 * docs/research/card-t-d-vm-admission-disposition.md. */
export class VdbeHostAdmission {
  #last: number|null = null;
  readonly scheduler: ExecutionTaskScheduler;
  readonly now: () => number;
  constructor(
    scheduler = new ExecutionTaskScheduler(),
    now: () => number = () => performance.now(),
  ) { this.scheduler = scheduler; this.now = now; }
  reset(): void { this.#last = null; this.scheduler.reset(); }
  checkpoint(): void|Promise<void> {
    const now = this.now();
    // A regressed or non-finite clock must not suppress host delivery forever.
    if (this.#last !== null && Number.isFinite(now) &&
        now >= this.#last && now - this.#last < 4) return;
    this.#last = Number.isFinite(now) ? now : null;
    return this.scheduler.yield();
  }
}
