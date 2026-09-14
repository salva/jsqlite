import assert from "node:assert/strict";
import test from "node:test";
import { Mem, memToPublicInitial } from "../../src/internal/mem.ts";
import {
  arithmeticBinary, bitwiseBinary, bitwiseNot, booleanValue, isNull, isTrue,
  logicalBinary, logicalNot, truthBranch,
} from "../../src/internal/vdbe-primitives.ts";

function integer(value) { const mem = new Mem(); mem.setInt64(value); return mem; }
function real(value) { const mem = new Mem(); mem.setDouble(value); return mem; }
function text(value) { const mem = new Mem(); mem.setText(new TextEncoder().encode(value), "utf-8"); return mem; }
function nil() { return new Mem(); }
function value(mem) { return memToPublicInitial(mem); }

// Exact pinned upstream assertions from test/e_expr.test.
test("UPSTREAM e_expr-6.1..6.5 remainder coercion, sign and result class", () => {
  assert.equal(value(arithmeticBinary("remainder", integer(72n), integer(5n))), 2n);
  assert.equal(value(arithmeticBinary("remainder", integer(72n), integer(-5n))), 2n);
  assert.equal(value(arithmeticBinary("remainder", integer(-72n), integer(-5n))), -2n);
  assert.equal(value(arithmeticBinary("remainder", integer(-72n), integer(5n))), -2n);
  assert.equal(value(arithmeticBinary("remainder", real(72.35), integer(5n))), 2);
});

test("UPSTREAM e_expr-2.3/2.4 unary bit-not and logical-not", () => {
  assert.equal(value(bitwiseNot(integer(10n))), -11n);
  assert.equal(value(logicalNot(integer(10n))), 0n);
});

test("vdbe.c OP_Add..OP_Divide integer paths, overflow promotion and zero", () => {
  assert.equal(value(arithmeticBinary("add", integer(7n), integer(5n))), 12n);
  assert.equal(value(arithmeticBinary("subtract", integer(7n), integer(5n))), 2n);
  assert.equal(value(arithmeticBinary("multiply", integer(-7n), integer(5n))), -35n);
  assert.equal(value(arithmeticBinary("divide", integer(-7n), integer(3n))), -2n);
  const max = 9223372036854775807n, min = -9223372036854775808n;
  assert.equal(value(arithmeticBinary("add", integer(max), integer(1n))), Number(max) + 1);
  assert.equal(value(arithmeticBinary("subtract", integer(min), integer(1n))), Number(min) - 1);
  assert.equal(value(arithmeticBinary("multiply", integer(max), integer(2n))), Number(max) * 2);
  assert.equal(value(arithmeticBinary("divide", integer(min), integer(-1n))), -Number(min));
  assert.equal(value(arithmeticBinary("remainder", integer(min), integer(-1n))), 0n);
  assert.equal(value(arithmeticBinary("divide", integer(1n), integer(0n))), null);
  assert.equal(value(arithmeticBinary("remainder", real(1), real(-0))), null);
});

test("vdbe.c floating arithmetic preserves signed zero/infinity and maps NaN to NULL", () => {
  assert.ok(Object.is(value(arithmeticBinary("multiply", real(-0), real(2))), -0));
  assert.equal(value(arithmeticBinary("divide", real(1), real(Infinity))), 0);
  assert.equal(value(arithmeticBinary("add", real(Infinity), real(-Infinity))), null);
  assert.equal(value(arithmeticBinary("add", nil(), integer(1n))), null);
  assert.equal(value(arithmeticBinary("add", text("2"), text("3"))), 5n);
  assert.equal(value(arithmeticBinary("add", text("x"), integer(3n))), 3n);
});

test("vdbe.c OP_BitAnd/BitOr/ShiftLeft/ShiftRight and NULL propagation", () => {
  assert.equal(value(bitwiseBinary("bit-and", integer(6n), integer(3n))), 2n);
  assert.equal(value(bitwiseBinary("bit-or", integer(6n), integer(3n))), 7n);
  assert.equal(value(bitwiseBinary("shift-left", integer(1n), integer(63n))), -9223372036854775808n);
  assert.equal(value(bitwiseBinary("shift-left", integer(1n), integer(64n))), 0n);
  assert.equal(value(bitwiseBinary("shift-right", integer(-2n), integer(1n))), -1n);
  assert.equal(value(bitwiseBinary("shift-right", integer(-2n), integer(64n))), -1n);
  assert.equal(value(bitwiseBinary("shift-left", integer(8n), integer(-2n))), 2n);
  assert.equal(value(bitwiseBinary("shift-right", integer(8n), integer(-2n))), 32n);
  assert.equal(value(bitwiseBinary("bit-and", nil(), integer(1n))), null);
  assert.equal(value(bitwiseNot(nil())), null);
});

test("vdbe.c OP_And/Or/Not implement three-valued SQL logic", () => {
  const F=integer(0n), T=integer(1n), N=nil();
  assert.equal(value(logicalBinary("and", F, N)), 0n);
  assert.equal(value(logicalBinary("and", T, N)), null);
  assert.equal(value(logicalBinary("and", N, N)), null);
  assert.equal(value(logicalBinary("or", T, N)), 1n);
  assert.equal(value(logicalBinary("or", F, N)), null);
  assert.equal(value(logicalNot(N)), null);
  assert.equal(booleanValue(text("12x"), 2), 1);
  assert.equal(booleanValue(text("x"), 2), 0);
});

test("vdbe.c OP_IsTrue/If/IfNot/IsNull NULL policy", () => {
  const N=nil(), T=integer(4n), F=real(-0);
  assert.equal(value(isTrue(N, 0, false)), 0n); // IS TRUE
  assert.equal(value(isTrue(N, 1, true)), 0n);  // IS FALSE
  assert.equal(value(isTrue(N, 0, true)), 1n);  // IS NOT TRUE
  assert.equal(value(isTrue(N, 1, false)), 1n); // IS NOT FALSE
  assert.equal(truthBranch(T, "if", false), true);
  assert.equal(truthBranch(F, "if", false), false);
  assert.equal(truthBranch(N, "if", true), true);
  assert.equal(truthBranch(N, "if-not", true), true);
  assert.equal(isNull(N), true);
  assert.equal(isNull(T), false);
});
