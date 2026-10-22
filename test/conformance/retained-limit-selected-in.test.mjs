// Retained ORDER/LIMIT must finish before the correlated selected-IN caller.
// Reuse the native typed rows, all five metadata fields, selected work and reset
// assertions; never flatten LIMIT into the parent join.
import assert from 'node:assert/strict';
assert.ok(process.env.RETAINED_LIMIT_SELECTED_IN_DIR,'RETAINED_LIMIT_SELECTED_IN_DIR required');
process.env.SELECT_IN_R1_MATRIX_DIR=process.env.RETAINED_LIMIT_SELECTED_IN_DIR;
await import('./selected-in-r1-matrix.test.mjs');
