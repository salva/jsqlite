import { ExecutionTaskScheduler } from "./task-scheduler.js";
/** VM host transport, separate from deterministic work/progress checks.
 * Admission-start spacing, not CPU-slice or timer-latency guarantee. Native
 * vdbe.c check_for_interrupt has no host task transport. See
 * docs/research/card-t-d-vm-admission-disposition.md. */
export declare class VdbeHostAdmission {
    #private;
    readonly scheduler: ExecutionTaskScheduler;
    readonly now: () => number;
    constructor(scheduler?: ExecutionTaskScheduler, now?: () => number);
    reset(): void;
    checkpoint(): void | Promise<void>;
}
