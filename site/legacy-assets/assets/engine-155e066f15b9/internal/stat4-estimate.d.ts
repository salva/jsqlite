import type { IndexStat4 } from './schema.js';
import type { Stat4Probe } from './stat4-probe.js';
export interface KeyStats {
    readonly sample: number;
    readonly less: bigint;
    readonly equal: bigint;
}
export declare function whereKeyStats(state: IndexStat4, probe: Stat4Probe, roundUp: boolean): KeyStats;
