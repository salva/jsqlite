// Group completion belongs to the retained child, not the selected-IN caller.
// Shared native/public assertions retain typed rows, metadata, work and reset.
import assert from 'node:assert/strict';
assert.ok(process.env.GROUPED_SELECTED_IN_DIR,'GROUPED_SELECTED_IN_DIR required');
process.env.SELECT_IN_R1_MATRIX_DIR=process.env.GROUPED_SELECTED_IN_DIR;
await import('./selected-in-r1-matrix.test.mjs');
