// Bounded source-shaped VDBE arithmetic and truth primitives, pinned to SQLite
// 3.53.4 vdbe.c OP_Add..OP_Remainder, OP_BitAnd..OP_BitNot and
// OP_And..OP_IsNull. This is an internal register-value layer, not an SQL AST
// evaluator or public statement path.
import { compareMem } from "./comparison.js";
import { Mem } from "./mem.js";
const INT64_MIN = -(1n << 63n);
const INT64_MAX = (1n << 63n) - 1n;
function numericCopy(source) {
    return source.numericTypeCopy();
}
function integerValue(source) {
    const value = new Mem();
    value.copyFrom(source);
    value.cast("integer", "utf-8");
    return value.integerValue();
}
function realValue(source) {
    const value = new Mem();
    value.copyFrom(source);
    value.cast("real", "utf-8");
    return value.realValue();
}
function setFiniteOrNull(result, value) {
    // sqlite3VdbeMemSetDouble semantics: NaN is NULL; infinities and signed zero
    // remain REAL.
    result.setDouble(value);
    return result;
}
/** Evaluate using SQL operand order (left op right), not VDBE's P2 op P1. */
export function arithmeticBinary(op, left, right) {
    const result = new Mem();
    if (isNull(left) || isNull(right))
        return result;
    const numericLeft = numericCopy(left);
    const numericRight = numericCopy(right);
    const bothInteger = numericLeft.initialStorageClass === "integer"
        && numericRight.initialStorageClass === "integer";
    if (bothInteger) {
        const a = numericLeft.integerValue();
        const b = numericRight.integerValue();
        if (op === "divide") {
            if (b === 0n)
                return result;
            if (a !== INT64_MIN || b !== -1n) {
                result.setInt64(a / b);
                return result;
            }
        }
        else if (op === "remainder") {
            if (b === 0n)
                return result;
            result.setInt64(a % (b === -1n ? 1n : b));
            return result;
        }
        else {
            const value = op === "add" ? a + b : op === "subtract" ? a - b : a * b;
            if (value >= INT64_MIN && value <= INT64_MAX) {
                result.setInt64(value);
                return result;
            }
        }
        // Integer overflow follows vdbe.c's fp_math path using the original
        // operands converted independently to double.
    }
    if (op === "remainder") {
        const divisor = integerValue(numericRight);
        if (divisor === 0n)
            return result;
        const dividend = integerValue(numericLeft);
        return setFiniteOrNull(result, Number(dividend % (divisor === -1n ? 1n : divisor)));
    }
    const a = realValue(numericLeft);
    const b = realValue(numericRight);
    if (op === "divide" && b === 0)
        return result; // includes +0 and -0
    const value = op === "add" ? a + b
        : op === "subtract" ? a - b
            : op === "multiply" ? a * b
                : a / b;
    return setFiniteOrNull(result, value);
}
export function bitwiseBinary(op, left, right) {
    const result = new Mem();
    if (isNull(left) || isNull(right))
        return result;
    let a = integerValue(left);
    const b = integerValue(right);
    if (op === "bit-and")
        a &= b;
    else if (op === "bit-or")
        a |= b;
    else {
        let shift = b;
        let direction = op === "shift-left" ? "left" : "right";
        if (shift < 0n) {
            direction = direction === "left" ? "right" : "left";
            shift = shift > -64n ? -shift : 64n;
        }
        if (shift >= 64n)
            a = direction === "left" || a >= 0n ? 0n : -1n;
        else if (shift !== 0n) {
            a = direction === "left"
                ? BigInt.asIntN(64, BigInt.asUintN(64, a) << shift)
                : a >> shift;
        }
    }
    result.setInt64(BigInt.asIntN(64, a));
    return result;
}
export function bitwiseNot(value) {
    const result = new Mem();
    if (!isNull(value))
        result.setInt64(BigInt.asIntN(64, ~integerValue(value)));
    return result;
}
/** Translation of sqlite3VdbeBooleanValue; ifNull must be 0, 1, or 2. */
export function booleanValue(value, ifNull) {
    if (isNull(value))
        return ifNull;
    const numeric = numericCopy(value);
    if (numeric.initialStorageClass === "integer")
        return numeric.integerValue() === 0n ? 0 : 1;
    return realValue(numeric) === 0 ? 0 : 1;
}
export function logicalBinary(op, left, right) {
    const a = booleanValue(left, 2);
    const b = booleanValue(right, 2);
    const table = op === "and"
        ? [0, 0, 0, 0, 1, 2, 0, 2, 2]
        : [0, 1, 2, 1, 1, 1, 2, 1, 2];
    const truth = table[a * 3 + b];
    const result = new Mem();
    if (truth !== 2)
        result.setInt64(BigInt(truth));
    return result;
}
export function logicalNot(value) {
    const result = new Mem();
    if (!isNull(value))
        result.setInt64(BigInt(booleanValue(value, 0) === 0 ? 1 : 0));
    return result;
}
/** OP_IsTrue parameters implement IS TRUE/FALSE and their NOT variants. */
export function isTrue(value, ifNull, invert) {
    const result = new Mem();
    result.setInt64(BigInt(booleanValue(value, ifNull) ^ (invert ? 1 : 0)));
    return result;
}
/** OP_If/OP_IfNot branch decision with the opcode P3 NULL policy. */
export function truthBranch(value, branch, ifNull) {
    if (branch === "if")
        return booleanValue(value, ifNull ? 1 : 0) !== 0;
    return !booleanValue(value, ifNull ? 0 : 1);
}
export function isNull(value) {
    return value.initialStorageClass === "null";
}
// window.c windowCodeRangeTest: arithmetic belongs to csr1, even when csr2
// is nonnumeric. Preserve int64 arithmetic and SQLite storage-class ordering.
export function windowRangeTest(candidate, current, offset, mode, descending, collation, bigNull = false) {
    if (mode === "end-unbounded")
        return true;
    if (mode === "start-unbounded")
        return false;
    const compare = (a, b) => {
        if (bigNull && (a.initialStorageClass === "null" || b.initialStorageClass === "null"))
            return a.initialStorageClass === b.initialStorageClass ? 0 : a.initialStorageClass === "null" ? 1 : -1;
        return compareMem(a, b, collation);
    };
    const ordered = (a, b) => compare(a, b) * (descending ? -1 : 1);
    if (mode === "end-current")
        return ordered(candidate, current) <= 0;
    if (mode === "start-current")
        return ordered(candidate, current) < 0;
    const left = mode === "start-preceding" ? candidate : current;
    const right = mode === "start-preceding" ? current : candidate;
    // OP_Ge/Le before arithmetic protects the PRECEDING inverse threshold.
    if (mode === "start-preceding" && ordered(left, right) >= 0)
        return false;
    const shifted = left.initialStorageClass === "integer" || left.initialStorageClass === "real"
        ? arithmeticBinary(descending ? "subtract" : "add", left, offset) : left;
    const relation = ordered(shifted, right);
    return mode === "end-following" ? relation >= 0 : mode === "start-following" ? relation > 0 : relation < 0;
}
