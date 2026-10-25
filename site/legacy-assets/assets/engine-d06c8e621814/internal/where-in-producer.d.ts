import type { KeyInfo } from './comparison.js';
import type { MemAffinity } from './mem.js';
import type { SelectInLoopRhs } from './where-plan.js';
import { type PhysicalIndex, type TableNode } from './schema.js';
import { SelectProgramBuilder, type SelectDest } from './select-program.js';
export type SelectedInProducerOp = {
    readonly code: 'Once';
    readonly p1: number;
    readonly p2: number;
} | {
    readonly code: 'OpenEphemeral';
    readonly p1: number;
    readonly keyInfo: KeyInfo;
    readonly p4KeyInfo: KeyInfo;
};
export type SelectedInStorage = {
    readonly kind: 'ephemeral';
    readonly descending: false;
} | {
    readonly kind: 'rowid';
    readonly table: TableNode;
    readonly descending: false;
} | {
    readonly kind: 'index';
    readonly physical: PhysicalIndex;
    readonly descending: boolean;
    readonly fieldMap?: readonly number[];
};
/** expr.c isCandidateForInOpt/sqlite3FindInIndex, scalar IN_INDEX_LOOP.
 * Retain physical identity, not a second SELECT plan. LOOP requires uniqueness;
 * nullable UNIQUE entries are safe because codeINTerm skips every NULL. */
export declare function selectedInStorage(rhs: SelectInLoopRhs, info: KeyInfo, affinity: MemAffinity): SelectedInStorage;
/** sqlite3FindInIndex LOOP: each RHS output maps to a distinct leading
 * index column with its own comparison collation. Repeated RHS columns cannot
 * reuse one physical slot twice; they use the ordinary UNIQUE SRT_Set path. */
export declare function selectedVectorInStorage(rhs: SelectInLoopRhs, info: KeyInfo, affinities: readonly MemAffinity[]): SelectedInStorage;
export interface SelectedInSet {
    readonly storage: SelectedInStorage;
    readonly fieldMap: readonly number[];
    readonly rhs: SelectInLoopRhs;
    readonly cursor: number;
    readonly keyInfo: KeyInfo;
    readonly destination: Extract<SelectDest, {
        kind: 'set';
    }> | null;
    readonly onceRegister: number;
    readonly start: number;
    readonly end: number;
}
/** expr.c sqlite3FindInIndex / sqlite3CodeRhsOfIN, scalar LOOP branches.
 * Eligible base-table ROWID/UNIQUE indices retain physical identity. Otherwise
 * the linked SELECT compiler owns UNIQUE SRT_Set production and parameters.
 * The caller iterates the resulting cursor through WhereInLoop. */
export declare function emitSelectedInRhs<Op extends {
    readonly code: string;
}>(builder: SelectProgramBuilder<Op>, rhs: SelectInLoopRhs, keyInfo: KeyInfo, affinity: MemAffinity | readonly MemAffinity[], emitSelect: (resolved: SelectInLoopRhs['resolved'], destination: Extract<SelectDest, {
    kind: 'set';
}>) => void, storage?: SelectedInStorage): SelectedInSet;
