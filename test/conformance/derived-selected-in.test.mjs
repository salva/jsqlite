// Reuse g52's typed rows/metadata/reset/LEFT/OR assertions without changing
// its fixture or attributing its harness to this derived-source addition.
import assert from 'node:assert/strict';
assert.ok(process.env.DERIVED_SELECTED_IN_DIR,'DERIVED_SELECTED_IN_DIR required');
process.env.SELECT_IN_R1_MATRIX_DIR=process.env.DERIVED_SELECTED_IN_DIR;
await import('./selected-in-r1-matrix.test.mjs');
