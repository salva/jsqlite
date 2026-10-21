/** Browser adaptation of vdbe.c interrupt/progress host delivery, not opcode
 * accounting. See docs/research/card-h-e/decision.md. Real timer turns remain
 * periodic because cross-task-source ordering is not a portable fairness rule.
 * One caller awaits one task; no queue, retained ports, or microtask-only path. */
export declare class ExecutionTaskScheduler {
    #private;
    reset(): void;
    yield(): Promise<void>;
}
