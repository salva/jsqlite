/** Browser adaptation of vdbe.c interrupt/progress host delivery, not opcode
 * accounting. See docs/research/card-h-e/decision.md. Real timer turns remain
 * periodic because cross-task-source ordering is not a portable fairness rule.
 * One caller awaits one task; no queue, retained ports, or microtask-only path. */
export class ExecutionTaskScheduler {
  #turn = 0;
  reset(): void { this.#turn = 0; }
  yield(): Promise<void> {
    if (++this.#turn % 8 === 0 || typeof MessageChannel === "undefined")
      return new Promise(resolve => setTimeout(resolve, 0));
    return new Promise(resolve => {
      let channel: MessageChannel | undefined;
      const close = () => {
        if (!channel) return;
        channel.port1.onmessage = null;
        channel.port1.close(); channel.port2.close();
        channel = undefined;
      };
      try {
        channel = new MessageChannel();
        channel.port1.onmessage = () => { close(); resolve(); };
        channel.port2.postMessage(null);
      } catch {
        close();
        setTimeout(resolve, 0);
      }
    });
  }
}
