import { type BuiltinCollation } from "./comparison.js";
import { Mem } from "./mem.js";
export type ArithmeticBinaryOp = "add" | "subtract" | "multiply" | "divide" | "remainder";
export type BitwiseBinaryOp = "bit-and" | "bit-or" | "shift-left" | "shift-right";
export type LogicalBinaryOp = "and" | "or";
export type TruthValue = 0 | 1 | 2;
/** Evaluate using SQL operand order (left op right), not VDBE's P2 op P1. */
export declare function arithmeticBinary(op: ArithmeticBinaryOp, left: Mem, right: Mem): Mem;
export declare function bitwiseBinary(op: BitwiseBinaryOp, left: Mem, right: Mem): Mem;
export declare function bitwiseNot(value: Mem): Mem;
/** Translation of sqlite3VdbeBooleanValue; ifNull must be 0, 1, or 2. */
export declare function booleanValue(value: Mem, ifNull: TruthValue): TruthValue;
export declare function logicalBinary(op: LogicalBinaryOp, left: Mem, right: Mem): Mem;
export declare function logicalNot(value: Mem): Mem;
/** OP_IsTrue parameters implement IS TRUE/FALSE and their NOT variants. */
export declare function isTrue(value: Mem, ifNull: 0 | 1, invert: boolean): Mem;
/** OP_If/OP_IfNot branch decision with the opcode P3 NULL policy. */
export declare function truthBranch(value: Mem, branch: "if" | "if-not", ifNull: boolean): boolean;
export declare function isNull(value: Mem): boolean;
export declare function windowRangeTest(candidate: Mem, current: Mem, offset: Mem | undefined, mode: "end-current" | "end-following" | "end-unbounded" | "start-unbounded" | "start-current" | "start-preceding" | "start-following", descending: boolean, collation: BuiltinCollation, bigNull?: boolean): boolean;
