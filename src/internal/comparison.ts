// Internal comparison, built-in collation, and packed-key primitives.
// Source: SQLite 3.53.4 vdbeaux.c:sqlite3MemCompare,
// sqlite3IntFloatCompare/sqlite3VdbeRecordCompare and
// main.c:binCollFunc/nocaseCollatingFunc/rtrimCollFunc.
import { BorrowLifetime, type BorrowToken, Mem, MemError, memFromRawRecord } from "./mem.ts";
import { decodeRecord, type DatabaseEncoding, RawRecordReader, RecordFormatError } from "./record.ts";

export type BuiltinCollation = "binary" | "nocase" | "rtrim";
export interface BuiltinCollationSpec {
  readonly kind: BuiltinCollation;
  /** Encoding in which the collation callback consumes bytes. */
  readonly encoding: DatabaseEncoding;
}
export interface KeyTerm {
  readonly collation?: BuiltinCollation | BuiltinCollationSpec;
  readonly desc?: boolean;
  /** SQLite KEYINFO_ORDER_BIGNULL, before the independent DESC inversion. */
  readonly nullsLarge?: boolean;
}
export interface KeyInfoInput {
  readonly encoding: DatabaseEncoding;
  readonly totalFieldCount: number;
  readonly keyFieldCount: number;
  readonly terms: readonly KeyTerm[];
}
/** Immutable, identity-bearing counterpart of SQLite KeyInfo. */
export class KeyInfo {
  readonly encoding: DatabaseEncoding;
  readonly totalFieldCount: number;
  readonly keyFieldCount: number;
  readonly terms: readonly Readonly<KeyTerm>[];
  constructor(input: KeyInfoInput) {
    checkedCount(input.totalFieldCount, "totalFieldCount");
    checkedCount(input.keyFieldCount, "keyFieldCount");
    if (input.encoding !== "utf-8" && input.encoding !== "utf-16le" && input.encoding !== "utf-16be") {
      throw new ComparisonError("internal", "invalid KeyInfo encoding");
    }
    if (input.keyFieldCount > input.totalFieldCount || input.terms.length < input.keyFieldCount) {
      throw new ComparisonError("internal", "inconsistent KeyInfo field counts");
    }
    this.encoding = input.encoding;
    this.totalFieldCount = input.totalFieldCount;
    this.keyFieldCount = input.keyFieldCount;
    this.terms = Object.freeze(input.terms.map((term): Readonly<KeyTerm> => {
      if (term.desc !== undefined && typeof term.desc !== "boolean") throw new ComparisonError("internal", "invalid KeyInfo DESC flag");
      if (term.nullsLarge !== undefined && typeof term.nullsLarge !== "boolean") throw new ComparisonError("internal", "invalid KeyInfo BIGNULL flag");
      let collation = term.collation;
      if (typeof collation === "object" && collation !== null) {
        collation = Object.freeze({ kind: collation.kind, encoding: collation.encoding });
      }
      validateCollation(collation);
      const copy: { collation?: BuiltinCollation | BuiltinCollationSpec; desc?: boolean; nullsLarge?: boolean } = {};
      if (collation !== undefined) copy.collation = collation;
      if (term.desc !== undefined) copy.desc = term.desc;
      if (term.nullsLarge !== undefined) copy.nullsLarge = term.nullsLarge;
      return Object.freeze(copy);
    }));
    Object.freeze(this);
  }
}
export interface RecordKeyLimits {
  readonly maxFields?: number;
  readonly maxBytes?: number;
  readonly maxWorkUnits?: number;
}
export type ComparisonFailureReason = "corrupt" | "limit" | "internal";
export class ComparisonError extends Error {
  readonly reason: ComparisonFailureReason;
  constructor(reason: ComparisonFailureReason, message: string, options?: ErrorOptions) {
    super(message, options); this.name = "ComparisonError"; this.reason = reason;
  }
}
export interface UnpackedRecordKeyOptions {
  /** SQLite UnpackedRecord.default_rc for exhausted equal fields. */
  readonly defaultRc?: -1 | 0 | 1;
  /** Current-pin construction class. Seek keys are non-empty prefixes whose
   * nField does not exceed KeyInfo.nKeyField; record unpack may also represent
   * a generic complete record, but a short one is not comparison-ready. */
  readonly caller?: "record" | "seek";
  readonly limits?: RecordKeyLimits;
}
export class UnpackedRecordKey {
  readonly keyInfo: KeyInfo;
  readonly values: readonly Mem[];
  readonly defaultRc: -1 | 0 | 1;
  readonly caller: "record" | "seek";
  eqSeen = false;
  #released = false;
  constructor(values: readonly Mem[], defaultRc: -1 | 0 | 1, caller: "record" | "seek", keyInfo: KeyInfo) {
    this.values = Object.freeze([...values]); this.defaultRc = defaultRc; this.caller = caller; this.keyInfo = keyInfo;
  }
  assertLive(): void { if (this.#released) throw new ComparisonError("internal", "unpacked record key has been released"); }
  release(): void { if (!this.#released) { for (const value of this.values) value.release(); this.#released = true; } }
}

function sign(value: number): -1 | 0 | 1 { return value < 0 ? -1 : value > 0 ? 1 : 0; }
function byteCompare(left: Uint8Array, right: Uint8Array): -1 | 0 | 1 {
  const n = Math.min(left.byteLength, right.byteLength);
  for (let i = 0; i < n; i++) if (left[i] !== right[i]) return left[i]! < right[i]! ? -1 : 1;
  return sign(left.byteLength - right.byteLength);
}
function asciiFold(byte: number): number { return byte >= 0x41 && byte <= 0x5a ? byte + 0x20 : byte; }
function nocaseCompare(left: Uint8Array, right: Uint8Array): -1 | 0 | 1 {
  const n = Math.min(left.byteLength, right.byteLength);
  for (let i = 0; i < n; i++) {
    const a = asciiFold(left[i]!); const b = asciiFold(right[i]!);
    if (a !== b) return a < b ? -1 : 1;
  }
  return sign(left.byteLength - right.byteLength);
}
function asUtf8(bytes: Uint8Array, encoding: DatabaseEncoding): Uint8Array {
  if (encoding === "utf-8") return bytes;
  const value = new Mem(); value.setText(bytes, encoding, { ownership: "static" });
  value.changeEncoding("utf-8"); return value.textBytes();
}

/** Compare byte-counted TEXT. Embedded NUL is data. NOCASE and RTRIM are the
 * UTF-8-only built-ins and therefore source-translate UTF-16 before comparing. */
export function compareBuiltinText(
  kind: BuiltinCollation,
  left: Uint8Array,
  right: Uint8Array,
  encoding: DatabaseEncoding,
): -1 | 0 | 1 {
  let a = left, b = right;
  if (kind !== "binary" && encoding !== "utf-8") { a = asUtf8(a, encoding); b = asUtf8(b, encoding); }
  if (kind === "nocase") return nocaseCompare(a, b);
  if (kind === "rtrim") {
    let an = a.byteLength, bn = b.byteLength;
    while (an > 0 && a[an - 1] === 0x20) an--;
    while (bn > 0 && b[bn - 1] === 0x20) bn--;
    return byteCompare(a.subarray(0, an), b.subarray(0, bn));
  }
  return byteCompare(a, b);
}

function intFloatCompare(integer: bigint, real: number): -1 | 0 | 1 {
  // Direct port of sqlite3IntFloatCompare. Number(integer) is used only after
  // the truncated-real bigint comparison has established the safe tie region.
  if (Number.isNaN(real)) return 1;
  if (real < -9223372036854775808) return 1;
  if (real >= 9223372036854775808) return -1;
  const truncated = BigInt(Math.trunc(real));
  if (integer < truncated) return -1;
  if (integer > truncated) return 1;
  const converted = Number(integer);
  return converted < real ? -1 : converted > real ? 1 : 0;
}
function numericKind(value: Mem): "integer" | "real" | null {
  const kind = value.diagnostic().numeric;
  return kind === "integer" || kind === "int-real" ? "integer" : kind === "real" ? "real" : null;
}
function collationSpec(collation: BuiltinCollation | BuiltinCollationSpec | undefined, fallback: DatabaseEncoding): BuiltinCollationSpec {
  return typeof collation === "string" ? { kind: collation, encoding: fallback } : collation ?? { kind: "binary", encoding: fallback };
}
function textAtEncoding(value: Mem, encoding: DatabaseEncoding): Uint8Array {
  const diagnostic = value.diagnostic(); // validates borrow before any copy/conversion
  if (diagnostic.encoding === encoding) return value.textBytes();
  const copy = new Mem(); copy.copyFrom(value); copy.changeEncoding(encoding); return copy.textBytes();
}

/** SQLite storage-class comparison. Inputs are never converted or cache-mutated. */
export function compareMem(left: Mem, right: Mem, collation?: BuiltinCollation | BuiltinCollationSpec): -1 | 0 | 1 {
  const ld = left.diagnostic(), rd = right.diagnostic(); // also validates borrows
  if (ld.manifest === "aggregate" || rd.manifest === "aggregate") throw new ComparisonError("internal", "aggregate Mem cannot be compared");
  if (ld.manifest === "null" || rd.manifest === "null") return ld.manifest === rd.manifest ? 0 : ld.manifest === "null" ? -1 : 1;
  const ln = numericKind(left), rn = numericKind(right);
  if (ln || rn) {
    if (!ln || !rn) return ln ? -1 : 1;
    if (ln === "integer" && rn === "integer") return left.integerValue() < right.integerValue() ? -1 : left.integerValue() > right.integerValue() ? 1 : 0;
    if (ln === "real" && rn === "real") return sign(left.realValue() - right.realValue());
    return ln === "integer" ? intFloatCompare(left.integerValue(), right.realValue()) : -intFloatCompare(right.integerValue(), left.realValue()) as -1 | 0 | 1;
  }
  if (ld.manifest === "text" || rd.manifest === "text") {
    if (ld.manifest !== "text" || rd.manifest !== "text") return ld.manifest === "text" ? -1 : 1;
    const spec = collationSpec(collation, (ld.encoding ?? rd.encoding)!);
    return compareBuiltinText(spec.kind, textAtEncoding(left, spec.encoding), textAtEncoding(right, spec.encoding), spec.encoding);
  }
  return byteCompare(left.blobValue(), right.blobValue());
}

function checkedCount(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new ComparisonError("internal", `${name} must be a non-negative safe integer`);
}
function checkedLimit(value: number | undefined, name: string): void {
  if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) throw new ComparisonError("internal", `${name} must be a non-negative safe integer`);
}
function validateLimits(limits: RecordKeyLimits): void {
  checkedLimit(limits.maxFields, "maxFields"); checkedLimit(limits.maxBytes, "maxBytes"); checkedLimit(limits.maxWorkUnits, "maxWorkUnits");
}
function validateCollation(collation: KeyTerm["collation"]): void {
  if (collation === undefined) return;
  const kind = typeof collation === "string" ? collation : collation.kind;
  const encoding = typeof collation === "string" ? undefined : collation.encoding;
  if (kind !== "binary" && kind !== "nocase" && kind !== "rtrim") throw new ComparisonError("internal", "invalid KeyInfo collation");
  if (encoding !== undefined && encoding !== "utf-8" && encoding !== "utf-16le" && encoding !== "utf-16be") {
    throw new ComparisonError("internal", "invalid KeyInfo collation encoding");
  }
}
function validateKeyInfo(info: KeyInfo): void {
  if (!(info instanceof KeyInfo) || !Object.isFrozen(info) || !Object.isFrozen(info.terms)) {
    throw new ComparisonError("internal", "KeyInfo must be a validated immutable descriptor");
  }
}

/** Decode a complete packed index record. TEXT/BLOB Mem cells borrow `packed`
 * under the caller-owned generation. No partial object escapes on failure. */
export function unpackRecordKey(
  packed: Uint8Array,
  keyInfo: KeyInfo,
  borrowLifetime: BorrowLifetime | BorrowToken,
  options: UnpackedRecordKeyOptions = {},
): UnpackedRecordKey {
  validateKeyInfo(keyInfo);
  const defaultRc = options.defaultRc ?? 0;
  if (defaultRc !== -1 && defaultRc !== 0 && defaultRc !== 1) throw new ComparisonError("internal", "defaultRc must be -1, 0, or 1");
  const caller = options.caller ?? "record";
  const limits = options.limits ?? {};
  validateLimits(limits);
  if (limits.maxBytes !== undefined && packed.byteLength > limits.maxBytes) throw new ComparisonError("limit", "packed key exceeds configured byte limit");
  try {
    const decoded = decodeRecord(packed, keyInfo.encoding);
    if (decoded.values.length > keyInfo.totalFieldCount) throw new ComparisonError("corrupt", "packed key has more fields than KeyInfo permits");
    if (caller === "seek" && (decoded.values.length === 0 || decoded.values.length > keyInfo.keyFieldCount)) {
      throw new ComparisonError("internal", "seek key requires between one and keyFieldCount fields");
    }
    if (limits.maxFields !== undefined && decoded.values.length > limits.maxFields) throw new ComparisonError("limit", "packed key exceeds configured field limit");
    if (limits.maxWorkUnits !== undefined && packed.byteLength + decoded.values.length > limits.maxWorkUnits) {
      throw new ComparisonError("limit", "packed key exceeds configured work limit");
    }
    const values = decoded.values.map(value => memFromRawRecord(value, borrowLifetime));
    return new UnpackedRecordKey(values, defaultRc, caller, keyInfo);
  } catch (error) {
    if (error instanceof ComparisonError) throw error;
    if (error instanceof RecordFormatError) throw new ComparisonError("corrupt", error.message, { cause: error });
    if (error instanceof MemError) throw new ComparisonError(error.reason === "limit" ? "limit" : "internal", error.message, { cause: error });
    throw error;
  }
}

/** Compare a packed left key with an unpacked right key, matching
 * sqlite3VdbeRecordCompare. The packed temporary borrow is scoped to this call;
 * serial fields are decoded one at a time and equal compared prefixes return
 * the unpacked RHS defaultRc. */
export function compareRecordKey(packed: Uint8Array, unpacked: UnpackedRecordKey, keyInfo: KeyInfo, limits: RecordKeyLimits = {}): -1 | 0 | 1 {
  unpacked.assertLive(); validateKeyInfo(keyInfo); validateLimits(limits);
  if (keyInfo !== unpacked.keyInfo) throw new ComparisonError("internal", "comparison KeyInfo identity does not match unpacked key");
  // Generic complete unpack may produce zero/short records for inspection, but
  // ordinary record comparison requires RHS nField to cover nKeyField. Only an
  // explicit current-pin OP_Seek construction is an intentional short prefix.
  if (unpacked.caller === "record" && unpacked.values.length < keyInfo.keyFieldCount) {
    throw new ComparisonError("internal", "ordinary comparison key has fewer than keyFieldCount fields");
  }
  if (unpacked.caller === "seek" && (unpacked.values.length === 0 || unpacked.values.length > keyInfo.keyFieldCount)) {
    throw new ComparisonError("internal", "invalid seek comparison field count");
  }
  if (limits.maxBytes !== undefined && packed.byteLength > limits.maxBytes) throw new ComparisonError("limit", "packed key exceeds configured byte limit");
  if (limits.maxWorkUnits !== undefined && packed.byteLength > limits.maxWorkUnits) {
    throw new ComparisonError("limit", "packed key exceeds configured work limit");
  }
  const lifetime = new BorrowLifetime();
  try {
    const reader = new RawRecordReader(packed, keyInfo.encoding);
    const count = Math.min(keyInfo.keyFieldCount, unpacked.values.length);
    let comparedFields = 0;
    for (let i = 0; i < count; i++) {
      if (limits.maxFields !== undefined && comparedFields >= limits.maxFields) {
        throw new ComparisonError("limit", "packed key exceeds configured field limit");
      }
      const raw = reader.next();
      if (raw === null) {
        // In 3.53.4 prefix intent belongs to the unpacked RHS nField. Once
        // another RHS field is requested, exhaustion of the packed LHS header
        // is a corrupt index record, not an equal prefix/default_rc result.
        throw new ComparisonError("corrupt", "packed key header ended before the next comparison field");
      }
      comparedFields++;
      if (limits.maxWorkUnits !== undefined && packed.byteLength + comparedFields > limits.maxWorkUnits) {
        throw new ComparisonError("limit", "packed key exceeds configured work limit");
      }
      const right = memFromRawRecord(raw, lifetime);
      const term = keyInfo.terms[i]!;
      try {
        let result = compareMem(right, unpacked.values[i]!, term.collation);
        if (result !== 0) {
          const eitherNull = unpacked.values[i]!.initialStorageClass === "null" || right.initialStorageClass === "null";
          if (term.nullsLarge && eitherNull) result = -result as -1 | 1;
          if (term.desc) result = -result as -1 | 1;
          return result;
        }
      } finally { right.release(); }
    }
    unpacked.eqSeen = true;
    return unpacked.defaultRc;
  } catch (error) {
    if (error instanceof ComparisonError) throw error;
    if (error instanceof RecordFormatError) throw new ComparisonError("corrupt", error.message, { cause: error });
    throw error;
  } finally { lifetime.close(); }
}
