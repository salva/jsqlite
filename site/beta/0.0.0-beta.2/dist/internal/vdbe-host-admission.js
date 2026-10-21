import { ExecutionTaskScheduler } from "./task-scheduler.js";
/** VM host transport, separate from deterministic work/progress checks.
 * Admission-start spacing, not CPU-slice or timer-latency guarantee. Native
 * vdbe.c check_for_interrupt has no host task transport. See
 * docs/research/card-t-d-vm-admission-disposition.md. */
export class VdbeHostAdmission {
    #last = null;
    scheduler;
    now;
    constructor(scheduler = new ExecutionTaskScheduler(), now = () => performance.now()) { this.scheduler = scheduler; this.now = now; }
    reset() { this.#last = null; this.scheduler.reset(); }
    checkpoint() {
        const now = this.now();
        // A regressed or non-finite clock must not suppress host delivery forever.
        if (this.#last !== null && Number.isFinite(now) &&
            now >= this.#last && now - this.#last < 4)
            return;
        this.#last = Number.isFinite(now) ? now : null;
        return this.scheduler.yield();
    }
}
