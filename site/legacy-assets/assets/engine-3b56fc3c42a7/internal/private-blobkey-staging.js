/** Module-internal CellArray borrowing bridge, not exported by product entrypoints.
 * No take/refund/count mutation: owner keeps staged authority alive until edit. */
export const balanceStaging = new WeakMap();
/** Scheduler-held lifetime. Physical staging survives every page edit until
 * all consumers have copied it. This bridge does not reconcile arena entries. */
export const balanceEditLifetime = new WeakMap();
/** Parent divider transit: physical removal conserves logical count. */
export const balanceDivider = new WeakMap();
/** Nonroot pRight and interior right-child publication, held parent/sibling. */
export const balanceChildPointer = new WeakMap();
/** Conserving balance divider insertion; caller owns count reconciliation. */
export const balanceDividerInsert = new WeakMap();
