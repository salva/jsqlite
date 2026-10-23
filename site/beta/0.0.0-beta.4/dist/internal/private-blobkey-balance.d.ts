import { PrivateStateByteBudget, type PrivateStateControl } from './private-state.js';
/** btree.c:balance_nonroot 8546–8652, BLOBKEY leafData==0 branch.
 * Counts delimit ordered CellArray cells, with the cell at each nonfinal
 * boundary retained as a parent divider. No sorting, key comparison or page
 * publication occurs here. Held nonroot owns gather/edit/rekey and publication.
 * Input counters include resident and staged cell sizes plus their 2-byte slots.
 * The returned fixed-capacity arrays stay charged until explicit release. */
export declare function partitionBlobkeyCells(nCell: number, cellSize: (index: number) => number, oldCounts: readonly number[], oldBytes: readonly number[], usableSpace: number, bulk: boolean, budget: PrivateStateByteBudget, control: PrivateStateControl): Promise<{
    counts: number[];
    bytes: number[];
    release(): void;
}>;
/** Nonroot8410–8524 CellArray resident/staged/divider producer.
 * Private bridge borrows adjacent staged descriptors without consuming them.
 * Resident bytes are borrowed and must remain under the caller's admission;
 * divider bytes are copied into charged scratch before child-pointer rewrite.
 * No page edits, refcounts, entry ownership or overflow chains are changed. */
export declare function gatherBlobkeyCells(pages: readonly import('./private-blobkey-pages.js').PrivateIndexPage[], dividers: readonly Uint8Array[], budget: PrivateStateByteBudget, control: PrivateStateControl): Promise<{
    cells: Uint8Array[];
    oldCounts: number[];
    oldBytes: number[];
    release(): void;
}>;
/** balance_nonroot sibling update loop (two passes). BLOBKEY divider cells
 * remain outside the new page ranges. Caller owns parent publication, physical
 * page identity, entry reconciliation and one admission across all pages. */
export declare function editBlobkeySiblings(pages: readonly import('./private-blobkey-pages.js').PrivateIndexPage[], cells: readonly Uint8Array[], oldCounts: readonly number[], newCounts: readonly number[], budget: PrivateStateByteBudget, control: PrivateStateControl): Promise<void>;
/** Native nonroot8670ff identity rekey. The sibling objects and their data stay
 * in CellArray order; only pager identities move. The arena callback owns map,
 * derived pgno, primary-error FAULT and cleanup. No key sorting occurs here. */
export declare function rekeyBlobkeySiblings<T extends {
    readonly pgno: number;
}>(pages: readonly T[], rekey: (page: T, number: number) => Promise<void>, budget: PrivateStateByteBudget, control: PrivateStateControl): Promise<{
    oldNumbers: number[];
    release(): void;
}>;
/** balance_nonroot8312–8340 sibling selection. Caller supplies logical child
 * pointers (including pending parent divider adjustment), not sorted keys.
 * Descending producer order matches native acquire/drop traversal. */
export declare function selectBlobkeySiblingWindow(parentCells: number, index: number, bulk: boolean, child: (slot: number) => number, budget: PrivateStateByteBudget, control: PrivateStateControl): Promise<{
    first: number;
    pages: number[];
    release(): void;
}>;
/** Nonroot8310–8388 acquire/drop chain. Caller retains exclusive parent gate
 * and owns logical reconciliation/global FAULT on failure after any drop. */
export declare function acquireBlobkeySiblings(parent: import('./private-blobkey-pages.js').PrivateIndexPage, index: number, bulk: boolean, acquire: (number: number) => Promise<{
    page: import('./private-blobkey-pages.js').PrivateIndexPage;
    release(): void;
}>, budget: PrivateStateByteBudget, control: PrivateStateControl): Promise<{
    first: number;
    rightOffset: number;
    pages: import('./private-blobkey-pages.js').PrivateIndexPage[];
    dividers: Uint8Array[];
    release(): void;
}>;
/** BLOBKEY divider representation producer, nonroot8830–8889. Parent insert
 * and left sibling right-child publication remain caller-owned. */
export declare function promoteBlobkeyDivider(parent: import('./private-blobkey-pages.js').PrivateIndexPage, cell: Uint8Array, leaf: boolean, left: number, budget: PrivateStateByteBudget, control: PrivateStateControl): Promise<{
    bytes: Uint8Array;
    rightChild: number | null;
    release(): void;
}>;
/** Native nonroot8755/8830 parent publication phase. Caller holds all leases,
 * owns logical counts and globally faults any failed admitted balance. */
export declare function publishBlobkeyDividers(parent: import('./private-blobkey-pages.js').PrivateIndexPage, first: number, rightOffset: number, siblings: readonly import('./private-blobkey-pages.js').PrivateIndexPage[], counts: readonly number[], cells: readonly Uint8Array[], oldRight: number, oldCount: number, budget: PrivateStateByteBudget, control: PrivateStateControl): Promise<void>;
