// Internal SQLite Mem translation, pinned to SQLite 3.53.4 vdbeInt.h Mem and
// vdbemem.c set/copy/move/release paths. C allocation flags are represented as
// semantic ownership and checked lifetimes rather than exposed bit masks.
import type { SqliteValue } from "../index.ts";
import type { DatabaseEncoding, RawRecordValue } from "./record.ts";
import { decodeSqliteText } from "./utf.ts";

const INT64_MIN = -(1n << 63n);
const INT64_MAX = (1n << 63n) - 1n;

export type MemManifest = "null" | "integer" | "real" | "text" | "blob" | "aggregate";
export type MemOwnership = "owned" | "borrowed" | "static";
export type MemFailureReason = "invalid-state" | "expired-borrow" | "limit" | "invalid-int64" | "invalid-text";

export class MemError extends Error {
  readonly reason: MemFailureReason;
  constructor(reason: MemFailureReason, message: string) {
    super(message);
    this.name = "MemError";
    this.reason = reason;
  }
}
/** Backwards-compatible name from the first SetDouble slice. */
export class MemStateError extends MemError {
  constructor(message: string) { super("invalid-state", message); this.name = "MemStateError"; }
}

/** Explicit owner generation used by record/page/cursor borrows. */
export class BorrowLifetime {
  #generation = 0;
  #valid = true;
  capture(): BorrowToken { return new BorrowToken(this, this.#generation); }
  invalidate(): void { this.#generation++; }
  close(): void { this.#valid = false; this.#generation++; }
  _valid(generation: number): boolean { return this.#valid && generation === this.#generation; }
}
export class BorrowToken {
  readonly owner: BorrowLifetime;
  readonly generation: number;
  constructor(owner: BorrowLifetime, generation: number) { this.owner = owner; this.generation = generation; }
  assertValid(): void {
    if (!this.owner._valid(this.generation)) throw new MemError("expired-borrow", "borrowed Mem bytes have expired");
  }
}

interface LifetimeCheck { assertValid(): void }
class CompositeBorrowToken implements LifetimeCheck {
  readonly #tokens: readonly LifetimeCheck[];
  constructor(tokens: readonly LifetimeCheck[]) { this.#tokens = tokens; }
  assertValid(): void { for (const token of this.#tokens) token.assertValid(); }
}

interface NumericInteger { kind: "integer" | "int-real"; value: bigint }
interface NumericReal { kind: "real"; value: number }
type Numeric = NumericInteger | NumericReal;
interface BytesState {
  kind: "text" | "blob";
  bytes: Uint8Array;
  encoding: DatabaseEncoding;
  terminated: boolean;
  ownership: MemOwnership;
  token?: LifetimeCheck;
  zeroTail: number;
}
export interface MemAggregateState { readonly definition: unknown; readonly context: unknown; readonly cleanup?: () => void }
export interface MemDiagnostic {
  readonly manifest: MemManifest;
  readonly numeric: "integer" | "real" | "int-real" | null;
  readonly bytes: "text" | "blob" | null;
  readonly encoding: DatabaseEncoding | null;
  readonly byteLength: number;
  readonly ownership: MemOwnership | null;
  readonly terminated: boolean;
  readonly zeroTail: number;
  readonly subtype: number | null;
  readonly fromBind: boolean;
  readonly clearedNull: boolean;
}
export interface MemLimits { readonly maxLength?: number }
export type MemAffinity = "blob" | "text" | "numeric" | "integer" | "real";
export interface SetBytesOptions extends MemLimits {
  readonly ownership?: MemOwnership;
  readonly lifetime?: BorrowLifetime | BorrowToken;
  readonly terminated?: boolean;
  readonly zeroTail?: number;
}

function checkedLength(length: number, limit?: number): void {
  if (!Number.isSafeInteger(length) || length < 0) throw new MemError("invalid-state", "invalid Mem byte length");
  if (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 0 || length > limit)) {
    throw new MemError("limit", "Mem value exceeds configured byte limit");
  }
}
function tokenOf(lifetime: BorrowLifetime | BorrowToken | undefined): BorrowToken | undefined {
  return lifetime instanceof BorrowLifetime ? lifetime.capture() : lifetime;
}
function copyBytes(bytes: Uint8Array): Uint8Array { return new Uint8Array(bytes); }

interface Atoi64Result { readonly value: bigint; readonly rc: -1 | 0 | 1 | 2 | 3; readonly integerPrefixEnd: number }
interface AtoFResult { readonly value: number; readonly validPrefix: boolean; readonly full: boolean; readonly hasDecimalOrExponent: boolean }
const SQLITE_SPACES = new Set([0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x20]);

/* Source-shaped util.c:sqlite3Atoi64/sqlite3AtoF scanners. Conversion operates
 * on encoded Mem bytes and explicit lengths. UTF-16 odd bytes are ignored just
 * as Atoi64 does. AtoF is NUL-terminated at its caller, whereas Atoi64 sees the
 * complete Mem length; that distinction is intentional for embedded NUL. */
function numericCodeUnits(bytes: Uint8Array, encoding: DatabaseEncoding): number[] {
  if (encoding === "utf-8") return Array.from(bytes);
  const result: number[] = [];
  const little = encoding === "utf-16le";
  for (let i = 0; i + 1 < bytes.length; i += 2) result.push(little ? bytes[i]! | (bytes[i + 1]! << 8) : (bytes[i]! << 8) | bytes[i + 1]!);
  return result;
}
function atoi64Prefix(input: readonly number[]): Atoi64Result {
  let i = 0;
  while (i < input.length && SQLITE_SPACES.has(input[i]!)) i++;
  let negative = false;
  if (input[i] === 0x2d || input[i] === 0x2b) { negative = input[i] === 0x2d; i++; }
  const digitStart = i;
  while (input[i] === 0x30) i++;
  const significantStart = i;
  let magnitude = 0n;
  while (i < input.length && input[i]! >= 0x30 && input[i]! <= 0x39) { magnitude = magnitude * 10n + BigInt(input[i]! - 0x30); i++; }
  const prefixEnd = i;
  if (i === digitStart) return { value: 0n, rc: -1, integerPrefixEnd: prefixEnd };
  let tail = i; while (tail < input.length && SQLITE_SPACES.has(input[tail]!)) tail++;
  const extra = tail < input.length;
  const significantDigits = i - significantStart;
  const limit = negative ? 9223372036854775808n : 9223372036854775807n;
  if (significantDigits > 19 || magnitude > limit) return { value: negative ? INT64_MIN : INT64_MAX, rc: magnitude === 9223372036854775808n && !negative ? 3 : 2, integerPrefixEnd: prefixEnd };
  return { value: negative ? -magnitude : magnitude, rc: extra ? 1 : 0, integerPrefixEnd: prefixEnd };
}
function atof(inputWithTail: readonly number[]): AtoFResult {
  const nul = inputWithTail.indexOf(0);
  const input = nul < 0 ? inputWithTail : inputWithTail.slice(0, nul);
  let i = 0; while (i < input.length && SQLITE_SPACES.has(input[i]!)) i++;
  let negative = false; if (input[i] === 0x2d || input[i] === 0x2b) { negative = input[i] === 0x2d; i++; }
  let mantissa = 0n, exponent10 = 0, digits = 0;
  // sqlite3AtoF bounds the unsigned mantissa by its value, not by the
  // number of input characters. Leading zeroes do not consume this budget.
  const mantissaThreshold = ((1n << 64n) - 1n - 9n) / 10n;
  if (i < input.length && input[i]! >= 0x30 && input[i]! <= 0x39) {
    mantissa = BigInt(input[i]! - 0x30); digits++; i++;
    while (i < input.length && input[i]! >= 0x30 && input[i]! <= 0x39) {
      mantissa = mantissa * 10n + BigInt(input[i]! - 0x30); digits++; i++;
      if (mantissa >= mantissaThreshold) {
        while (i < input.length && input[i]! >= 0x30 && input[i]! <= 0x39) {
          digits++; exponent10++; i++;
        }
        break;
      }
    }
  }
  let hasFp = false;
  if (input[i] === 0x2e) {
    hasFp = true; i++;
    while (i < input.length && input[i]! >= 0x30 && input[i]! <= 0x39) {
      const d = input[i]! - 0x30; digits++;
      if (mantissa < mantissaThreshold) { mantissa = mantissa * 10n + BigInt(d); exponent10--; }
      i++;
    }
  }
  if (digits === 0) return { value: 0, validPrefix: false, full: false, hasDecimalOrExponent: hasFp };
  if (input[i] === 0x65 || input[i] === 0x45) {
    const mark = i++; let sign = 1;
    if (input[i] === 0x2d || input[i] === 0x2b) { if (input[i] === 0x2d) sign = -1; i++; }
    const start = i; let e = 0;
    while (i < input.length && input[i]! >= 0x30 && input[i]! <= 0x39) { e = Math.min(10000, e * 10 + input[i]! - 0x30); i++; }
    if (i === start) i = mark; else { exponent10 += sign * e; hasFp = true; }
  }
  let tail = i; while (tail < input.length && SQLITE_SPACES.has(input[tail]!)) tail++;
  /* Convert the scanner's bounded unsigned mantissa and decimal exponent in
   * one correctly-rounded host operation. Grammar/prefix/encoding decisions
   * remain source-owned; unlike Number(input), ignored significant digits do
   * not affect rounding (the sqlite3AtoF/Fp10Convert2 contract). */
  let value = mantissa === 0n ? 0 : Number(`${mantissa}e${exponent10}`);
  if (negative) value = -value;
  return { value, validPrefix: true, full: tail === input.length, hasDecimalOrExponent: hasFp };
}
function realToI64(value: number): bigint {
  if (value < -9223372036854774784) return INT64_MIN;
  if (value > 9223372036854774784) return INT64_MAX;
  return BigInt(Math.trunc(value));
}
function realSameAsInt(value: number, integer: bigint): boolean {
  return value === 0 || (integer >= -2251799813685248n && integer < 2251799813685248n && Object.is(value, Number(integer)));
}
function numericAsReal(numeric: Numeric): number {
  return numeric.kind === "real" ? numeric.value as number : Number(numeric.value);
}
const FP_BASE = [
  0x8000000000000000n, 0xa000000000000000n, 0xc800000000000000n, 0xfa00000000000000n,
  0x9c40000000000000n, 0xc350000000000000n, 0xf424000000000000n, 0x9896800000000000n,
  0xbebc200000000000n, 0xee6b280000000000n, 0x9502f90000000000n, 0xba43b74000000000n,
  0xe8d4a51000000000n, 0x9184e72a00000000n, 0xb5e620f480000000n, 0xe35fa931a0000000n,
  0x8e1bc9bf04000000n, 0xb1a2bc2ec5000000n, 0xde0b6b3a76400000n, 0x8ac7230489e80000n,
  0xad78ebc5ac620000n, 0xd8d726b7177a8000n, 0x878678326eac9000n, 0xa968163f0a57b400n,
  0xd3c21bcecceda100n, 0x84595161401484a0n, 0xa56fa5b99019a5c8n,
] as const;
const FP_SCALE = [
  0x8049a4ac0c5811aen, 0xcf42894a5dce35ean, 0xa76c582338ed2621n, 0x873e4f75e2224e68n,
  0xda7f5bf590966848n, 0xb080392cc4349decn, 0x8e938662882af53en, 0xe65829b3046b0afan,
  0xba121a4650e4ddebn, 0x964e858c91ba2655n, 0xf2d56790ab41c2a2n, 0xc428d05aa4751e4cn,
  0x9e74d1b791e07e48n, 0xccccccccccccccccn, 0xcecb8f27f4200f3an, 0xa70c3c40a64e6c51n,
  0x86f0ac99b4e8dafdn, 0xda01ee641a708de9n, 0xb01ae745b101e9e4n, 0x8e41ade9fbebc27dn,
  0xe5d3ef282a242e81n, 0xb9a74a0637ce2ee1n, 0x95f83d0a1fb69cd9n, 0xf24a01a73cf2dccfn,
  0xc3b8358109e84f07n, 0x9e19db92b4e31ba9n,
] as const;
const FP_SCALE_LO = [
  0x205b896dn, 0x52064cadn, 0xaf2af2b8n, 0x5a7744a7n, 0xaf39a475n, 0xbd8d794en,
  0x547eb47bn, 0x0cb4a5a3n, 0x92f34d62n, 0x3a6a07f9n, 0xfae27299n, 0xaa97e14cn,
  0x775ea265n, 0xccccccccn, 0x00000000n, 0x999090b6n, 0x69a028bbn, 0xe80e6f48n,
  0x5ec05dd0n, 0x14588f14n, 0x8f1668c9n, 0x6d953e2cn, 0x4abdaf10n, 0xbc633b39n,
  0x0a862f81n, 0x6c07a2c2n,
] as const;
const U64_MASK = (1n << 64n) - 1n;
function sqlitePowerOfTen(p: number): bigint {
  if (p >= 0 && p < 27) return FP_BASE[p]!;
  let g = Math.trunc(p / 27), n = p % 27;
  if (p < 0 && n !== 0) { g--; n += 27; }
  const index = g + 13;
  const high = FP_SCALE[index]!;
  const low = FP_SCALE_LO[index]!;
  if (n === 0) return high;
  const product = ((high << 32n) + low) * FP_BASE[n]!;
  let result = product >> 96n;
  let middle = (product >> 64n) & 0xffffffffn;
  if ((result & (1n << 63n)) === 0n) {
    result = (result << 1n) | (middle >> 31n);
    middle = ((middle << 1n) | 1n) & 0xffffffffn;
  }
  return result & U64_MASK;
}
function sqliteFp2Convert10(m: bigint, e: number, n: number): { value: bigint; exponent: number } {
  const pwr2to10 = (x: number): number => Math.floor((x * 78913) / 262144);
  const pwr10to2 = (x: number): number => Math.floor((x * 108853) / 32768);
  const p = n - 1 - pwr2to10(e + 63);
  let high = (m * sqlitePowerOfTen(p)) >> 64n;
  if (n === 18) {
    high >>= BigInt(-(e + pwr10to2(p) + 2));
    high = (high + ((high << 1n) & 2n)) >> 1n;
  } else {
    high >>= BigInt(-(e + pwr10to2(p) + 1));
  }
  return { value: high, exponent: -p };
}
function sqliteRealDigits(value: number): { digits: string; exponent: number } {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value, false);
  const bits = view.getBigUint64(0, false);
  let binaryExponent = Number((bits >> 52n) & 0x7ffn);
  let mantissa = bits & 0x000fffffffffffffn;
  if (binaryExponent === 0) {
    const leading = 64 - mantissa.toString(2).length;
    mantissa <<= BigInt(leading);
    binaryExponent = -1074 - leading;
  } else {
    mantissa = (mantissa << 11n) | (1n << 63n);
    binaryExponent -= 1086;
  }
  const decoded = sqliteFp2Convert10(mantissa, binaryExponent, 18);
  let digits = decoded.value.toString();
  const exponent = digits.length + decoded.exponent - 1;
  const internalExponent = decoded.exponent;
  let roundAt = 17;
  if (digits[15] === "9" && digits[14] === "9") {
    let jj = 14;
    while (jj > 0 && digits[jj - 1] === "9") jj--;
    const candidate = jj === 0 ? 1n : BigInt(digits.slice(0, jj)) + 1n;
    if (value === Number(`${candidate}e${internalExponent + digits.length - jj}`)) roundAt = jj + 1;
  } else if (exponent + 1 >= digits.length || digits.slice(13, 16) === "000") {
    let jj = 13;
    while (jj > 0 && digits[jj - 1] === "0") jj--;
    const candidate = BigInt(digits.slice(0, jj));
    if (value === Number(`${candidate}e${internalExponent + digits.length - jj}`)) roundAt = jj + 1;
  }
  let kept = digits.slice(0, roundAt);
  if (digits[roundAt]! >= "5") {
    kept = (BigInt(kept) + 1n).toString();
    if (kept.length > roundAt) return { digits: kept, exponent: exponent + 1 };
    kept = kept.padStart(roundAt, "0");
  }
  return { digits: kept.replace(/0+$/, ""), exponent };
}
function sqliteNumberText(numeric: Numeric): string {
  if (numeric.kind === "integer") return numeric.value.toString();
  if (numeric.kind === "int-real") return `${numeric.value}.0`;
  const value: number = numeric.value as number;
  if (!Number.isFinite(value)) return value < 0 ? "-Inf" : "Inf";
  if (value === 0) return "0.0"; // Both IEEE zero payloads render identically; cached REAL retains sign.
  // printf.c's "%!.17g" uses util.c:sqlite3FpDecode rather than the host's
  // printf/Number formatting. Decode and round the binary value above, then
  // apply printf.c's alternate-form generic layout.
  const negative = value < 0;
  const { digits, exponent } = sqliteRealDigits(Math.abs(value));
  let rendered: string;
  if (exponent < -4 || exponent > 16) {
    const fraction = digits.slice(1) || "0";
    rendered = `${digits[0]}.${fraction}e${exponent < 0 ? "-" : "+"}${Math.abs(exponent).toString().padStart(2, "0")}`;
  } else if (exponent >= 0) {
    const before = digits.slice(0, exponent + 1).padEnd(exponent + 1, "0");
    const after = digits.slice(exponent + 1) || "0";
    rendered = `${before}.${after}`;
  } else {
    rendered = `0.${"0".repeat(-exponent - 1)}${digits}`;
  }
  return negative ? `-${rendered}` : rendered;
}

export class Mem {
  #manifest: MemManifest = "null";
  #numeric: Numeric | null = null;
  #bytes: BytesState | null = null;
  #subtype: number | null = null;
  #aggregate: MemAggregateState | null = null;
  #generation = new BorrowLifetime();
  #fromBind = false;
  #clearedNull = false;

  get initialStorageClass(): Exclude<MemManifest, "aggregate"> {
    if (this.#manifest === "aggregate") throw new MemStateError("aggregate has no public storage class");
    return this.#manifest;
  }
  #drop(runCleanup = true): void {
    this.#generation.invalidate();
    if (runCleanup && this.#aggregate?.cleanup) this.#aggregate.cleanup();
    this.#numeric = null; this.#bytes = null; this.#aggregate = null; this.#subtype = null;
    this.#fromBind = false; this.#clearedNull = false;
  }
  setNull(options: { cleared?: boolean } = {}): void {
    this.#drop(); this.#manifest = "null"; this.#clearedNull = options.cleared ?? false;
  }
  setInt64(value: bigint): void {
    if (value < INT64_MIN || value > INT64_MAX) throw new MemError("invalid-int64", "INTEGER is outside signed int64");
    this.#drop(); this.#manifest = "integer"; this.#numeric = { kind: "integer", value };
  }
  /** Internal exact representation of a manifest REAL held in the integer slot. */
  setIntReal(value: bigint): void {
    if (value < INT64_MIN || value > INT64_MAX) throw new MemError("invalid-int64", "IntReal is outside signed int64");
    this.#drop(); this.#manifest = "real"; this.#numeric = { kind: "int-real", value };
  }
  setDouble(value: number): void {
    this.setNull();
    if (!Number.isNaN(value)) { this.#manifest = "real"; this.#numeric = { kind: "real", value }; }
  }
  setText(bytes: Uint8Array, encoding: DatabaseEncoding, options: SetBytesOptions = {}): void {
    this.#setBytes("text", bytes, encoding, options);
  }
  setBlob(bytes: Uint8Array, options: SetBytesOptions = {}): void {
    this.#setBytes("blob", bytes, "utf-8", options);
  }
  #setBytes(kind: "text" | "blob", bytes: Uint8Array, encoding: DatabaseEncoding, options: SetBytesOptions): void {
    const zeroTail = options.zeroTail ?? 0;
    if (kind === "text" && zeroTail !== 0) throw new MemError("invalid-state", "TEXT cannot have a zero tail");
    checkedLength(zeroTail, undefined); checkedLength(bytes.byteLength + zeroTail, options.maxLength);
    const ownership = options.ownership ?? "owned";
    const token = tokenOf(options.lifetime);
    if (ownership === "borrowed" && token === undefined) throw new MemError("invalid-state", "borrowed bytes require a lifetime");
    this.#drop(); this.#manifest = kind;
    this.#bytes = { kind, bytes: ownership === "owned" ? copyBytes(bytes) : bytes, encoding,
      terminated: options.terminated ?? false, ownership, ...(token === undefined ? {} : { token }), zeroTail };
  }
  setAggregate(state: MemAggregateState): void { this.#drop(); this.#manifest = "aggregate"; this.#aggregate = state; }
  setSubtype(subtype: number | null): void {
    if (subtype !== null && (!Number.isInteger(subtype) || subtype < 0 || subtype > 255)) throw new MemError("invalid-state", "subtype must be one byte");
    if (this.#manifest === "null" || this.#manifest === "aggregate") throw new MemError("invalid-state", "subtype requires an ordinary non-NULL value");
    this.#subtype = subtype;
  }
  markFromBind(): void { this.#fromBind = true; }

  integerValue(): bigint {
    if (this.#numeric?.kind === "integer" || this.#numeric?.kind === "int-real") return this.#numeric.value;
    throw new MemStateError("Mem does not contain an exact integer form");
  }
  realValue(): number {
    if (this.#numeric?.kind === "real") return this.#numeric.value;
    if (this.#numeric?.kind === "int-real") return Number(this.#numeric.value);
    throw new MemStateError("Mem does not contain a REAL value");
  }
  #replaceWithNumeric(numeric: Numeric): void {
    this.#generation.invalidate();
    this.#bytes = null;
    this.#aggregate = null;
    this.#clearedNull = false;
    this.#numeric = numeric;
    this.#manifest = numeric.kind === "integer" ? "integer" : "real";
    // MemSetTypeFlag changes only type/zero flags. Subtype and FromBind survive.
  }
  #forceByteType(kind: "text" | "blob", encoding: DatabaseEncoding): void {
    const state = this.#checkedBytes();
    const bytes = state.zeroTail === 0 ? state.bytes : this.blobValue();
    this.#bytes = { ...state, kind, bytes, encoding, zeroTail: 0 };
    this.#numeric = null;
    this.#manifest = kind;
    // MemSetTypeFlag leaves subtype and FromBind outside MEM_TypeMask.
  }
  #numericFromBytes(force: boolean, tryForInt: boolean): Numeric | null {
    const state = this.#checkedBytes();
    const bytes = state.kind === "blob" ? this.blobValue() : state.bytes;
    const units = numericCodeUnits(bytes, state.encoding);
    const integer = atoi64Prefix(units);
    const real = atof(units);
    if (!force && !real.full) return null;
    if (!real.validPrefix) return force ? { kind: "integer", value: 0n } : null;
    if (!real.hasDecimalOrExponent && integer.rc < 2) return { kind: "integer", value: integer.value };
    if (tryForInt) {
      const candidate = realToI64(real.value);
      if (realSameAsInt(real.value, candidate)) return { kind: "integer", value: candidate };
    }
    return { kind: "real", value: real.value };
  }
  /** sqlite3VdbeMemStringify: add canonical MEM_Str and optionally force TEXT. */
  stringify(encoding: DatabaseEncoding, force = false, limits: MemLimits = {}): void {
    if (this.#bytes?.kind === "text") { this.changeEncoding(encoding, limits); if (force) { this.#numeric = null; this.#manifest = "text"; } return; }
    if (this.#numeric === null) throw new MemStateError("stringify requires a numeric Mem");
    const bytes = encodeSqliteString(sqliteNumberText(this.#numeric), "utf-8");
    checkedLength(bytes.byteLength, limits.maxLength);
    this.#generation.invalidate();
    this.#bytes = { kind: "text", bytes, encoding: "utf-8", terminated: true, ownership: "owned", zeroTail: 0 };
    this.#subtype = null;
    this.#fromBind = false;
    if (force) { this.#numeric = null; this.#manifest = "text"; }
    this.changeEncoding(encoding, limits);
  }
  /** sqlite3VdbeChangeEncoding/sqlite3VdbeMemTranslate. Numeric flags survive. */
  changeEncoding(encoding: DatabaseEncoding, limits: MemLimits = {}): void {
    if (this.#bytes?.kind !== "text" || this.#bytes.encoding === encoding) return;
    const old = this.#checkedBytes();
    let bytes: Uint8Array;
    if (old.encoding !== "utf-8" && encoding !== "utf-8") {
      const evenLength = old.bytes.byteLength & ~1;
      bytes = copyBytes(old.bytes);
      for (let i = 0; i < evenLength; i += 2) { const first = bytes[i]!; bytes[i] = bytes[i + 1]!; bytes[i + 1] = first; }
      // SQLite's endian-swap path preserves an unmatched trailing byte.
    } else {
      const source = old.encoding === "utf-8" ? old.bytes : old.bytes.subarray(0, old.bytes.byteLength & ~1);
      bytes = encodeSqliteString(decodeSqliteText(source, old.encoding), encoding);
    }
    checkedLength(bytes.byteLength, limits.maxLength);
    this.#generation.invalidate();
    this.#bytes = { kind: "text", bytes, encoding, terminated: true, ownership: "owned", zeroTail: 0 };
  }
  applyAffinity(affinity: MemAffinity, encoding: DatabaseEncoding): void {
    if (affinity === "blob" || this.#manifest === "null") return;
    if (affinity === "text") {
      if (this.#numeric !== null && this.#bytes?.kind !== "text") this.stringify(encoding, true);
      else if (this.#bytes?.kind === "text") { this.changeEncoding(encoding); this.#numeric = null; this.#manifest = "text"; }
      return;
    }
    if (this.#numeric === null && this.#bytes?.kind === "text") {
      const numeric = this.#numericFromBytes(false, true);
      // vdbe.c:applyNumericAffinity deliberately invalidates MEM_Str because
      // source text is not guaranteed to be the canonical rendering.
      if (numeric?.kind === "integer" || numeric?.kind === "real") this.#replaceWithNumeric(numeric);
    } else if ((this.#numeric?.kind === "real" || this.#numeric?.kind === "int-real") && affinity !== "numeric") {
      const real = numericAsReal(this.#numeric);
      const candidate = realToI64(real);
      if (realSameAsInt(real, candidate)) { this.#replaceWithNumeric({ kind: "integer", value: candidate }); }
    }
  }
  cast(affinity: MemAffinity, encoding: DatabaseEncoding): void {
    if (this.#manifest === "null") return;
    if (affinity === "blob" && this.#bytes?.kind === "blob") return;
    if (affinity === "text" || affinity === "blob") {
      if (this.#bytes?.kind === "blob" && affinity === "text") this.#forceByteType("text", "utf-8");
      if (this.#bytes?.kind !== "text" && affinity === "text") {
        if (this.#numeric === null) throw new MemStateError("ordinary Mem value has no cast representation");
        this.stringify(encoding, true);
      } else if (this.#bytes?.kind === "text" && this.#bytes.encoding !== encoding) {
        this.changeEncoding(encoding);
      }
      if (affinity === "blob") {
        if (this.#bytes?.kind !== "blob") {
          if (this.#bytes?.kind !== "text") {
            if (this.#numeric === null) throw new MemStateError("ordinary Mem value has no cast representation");
            this.stringify(encoding, true);
          }
          this.#forceByteType("blob", encoding);
        } else this.#forceByteType("blob", this.#bytes.encoding);
      } else if (this.#bytes?.kind === "text") this.#forceByteType("text", encoding);
      return;
    }
    if (affinity === "numeric") {
      if (this.#numeric !== null) return;
      const numeric = this.#numericFromBytes(true, true);
      if (numeric === null) throw new MemStateError("numeric parser produced no forced value");
      this.#replaceWithNumeric(numeric);
      return;
    }
    if (affinity === "integer") {
      let value: bigint;
      if (this.#numeric?.kind === "integer" || this.#numeric?.kind === "int-real") value = this.#numeric.value;
      else if (this.#numeric?.kind === "real") value = realToI64(this.#numeric.value);
      else {
        const parsed = this.#numericFromBytes(true, false)!;
        value = parsed.kind === "real" ? realToI64(parsed.value) : parsed.value;
      }
      this.#replaceWithNumeric({ kind: "integer", value }); return;
    }
    let value: number;
    if (this.#numeric !== null) value = numericAsReal(this.#numeric);
    else {
      const parsed = this.#numericFromBytes(true, false);
      if (parsed === null) throw new MemStateError("numeric parser produced no forced value");
      value = numericAsReal(parsed);
    }
    this.#replaceWithNumeric({ kind: "real", value });
  }
  #checkedBytes(): BytesState {
    if (this.#bytes === null) throw new MemStateError("Mem does not contain bytes");
    this.#bytes.token?.assertValid(); return this.#bytes;
  }
  textBytes(): Uint8Array {
    const state = this.#checkedBytes();
    if (state.kind !== "text") throw new MemStateError("Mem does not contain TEXT");
    return state.bytes;
  }
  blobValue(): Uint8Array {
    const state = this.#checkedBytes();
    if (state.kind !== "blob") throw new MemStateError("Mem does not contain BLOB");
    if (state.zeroTail === 0) return state.bytes;
    const result = new Uint8Array(state.bytes.byteLength + state.zeroTail); result.set(state.bytes); return result;
  }
  textValue(): string {
    const state = this.#checkedBytes();
    if (state.kind !== "text") throw new MemStateError("Mem does not contain TEXT");
    return decodeSqliteText(state.bytes, state.encoding);
  }
  makeWriteable(): void {
    const state = this.#checkedBytes();
    if (state.ownership !== "owned" || state.zeroTail !== 0) {
      const bytes = state.kind === "blob" ? this.blobValue() : copyBytes(state.bytes);
      const { token: _token, ...withoutToken } = state;
      this.#bytes = { ...withoutToken, bytes, ownership: "owned", zeroTail: 0 };
    }
  }
  shallowCopyFrom(source: Mem, ownership: "borrowed" | "static" = "borrowed"): void {
    if (source === this) return;
    if (source.#manifest === "aggregate") throw new MemError("invalid-state", "aggregate state cannot be shallow-copied");
    this.#drop(); this.#manifest = source.#manifest; this.#numeric = source.#numeric; this.#subtype = source.#subtype;
    this.#fromBind = source.#fromBind; this.#clearedNull = source.#clearedNull;
    if (source.#bytes) {
      source.#checkedBytes();
      const token = ownership === "borrowed"
        ? new CompositeBorrowToken([...(source.#bytes.token === undefined ? [] : [source.#bytes.token]), source.#generation.capture()])
        : source.#bytes.token;
      this.#bytes = { ...source.#bytes, ownership, ...(token === undefined ? {} : { token }) };
    }
  }
  copyFrom(source: Mem): void {
    if (source === this) return;
    if (source.#manifest === "aggregate") throw new MemError("invalid-state", "aggregate state cannot be copied");
    this.#drop(); this.#manifest = source.#manifest; this.#numeric = source.#numeric; this.#subtype = source.#subtype;
    this.#fromBind = source.#fromBind; this.#clearedNull = source.#clearedNull;
    if (source.#bytes) {
      source.#checkedBytes();
      const { token: _token, ...withoutToken } = source.#bytes;
      this.#bytes = { ...withoutToken, bytes: source.#bytes.kind === "blob" ? source.blobValue() : copyBytes(source.#bytes.bytes), ownership: "owned", zeroTail: 0 };
    }
  }
  moveFrom(source: Mem): void {
    if (source === this) return;
    source.#bytes?.token?.assertValid(); this.#drop();
    this.#manifest = source.#manifest; this.#numeric = source.#numeric; this.#bytes = source.#bytes;
    this.#subtype = source.#subtype; this.#aggregate = source.#aggregate; this.#fromBind = source.#fromBind; this.#clearedNull = source.#clearedNull;
    source.#aggregate = null; source.#drop(false); source.#manifest = "null";
  }
  release(): void { this.setNull(); }
  diagnostic(): MemDiagnostic {
    let byteLength = 0, encoding: DatabaseEncoding | null = null, ownership: MemOwnership | null = null, terminated = false, zeroTail = 0;
    if (this.#bytes) { const b = this.#checkedBytes(); byteLength = b.bytes.byteLength + b.zeroTail; encoding = b.kind === "text" ? b.encoding : null; ownership = b.ownership; terminated = b.terminated; zeroTail = b.zeroTail; }
    return { manifest: this.#manifest, numeric: this.#numeric?.kind ?? null, bytes: this.#bytes?.kind ?? null,
      encoding, byteLength, ownership, terminated, zeroTail, subtype: this.#subtype, fromBind: this.#fromBind, clearedNull: this.#clearedNull };
  }
}

function assertWellFormed(value: string): void {
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) { const d = value.charCodeAt(++i); if (!(d >= 0xdc00 && d <= 0xdfff)) throw new MemError("invalid-text", "string contains a lone surrogate"); }
    else if (c >= 0xdc00 && c <= 0xdfff) throw new MemError("invalid-text", "string contains a lone surrogate");
  }
}
function encodeText(value: string, encoding: DatabaseEncoding): Uint8Array {
  assertWellFormed(value);
  return encodeSqliteString(value, encoding);
}

/* sqlite3VdbeMemTranslate writes the code points produced by SQLite's own
 * READ_UTF8/READ_UTF16 loops. Public strings are validated above; internal
 * translation instead replaces an unmatched JS surrogate, mirroring the
 * source-derived decoder's malformed-input boundary. */
function encodeSqliteString(value: string, encoding: DatabaseEncoding): Uint8Array {
  const units: number[] = [];
  for (let i = 0; i < value.length; i++) {
    const first = value.charCodeAt(i);
    let cp = first;
    if (first >= 0xd800 && first <= 0xdbff) {
      const second = value.charCodeAt(i + 1);
      if (second >= 0xdc00 && second <= 0xdfff) { cp = 0x10000 + ((first - 0xd800) << 10) + second - 0xdc00; i++; }
      else cp = 0xfffd;
    } else if (first >= 0xdc00 && first <= 0xdfff) cp = 0xfffd;
    if (encoding === "utf-8") {
      if (cp < 0x80) units.push(cp);
      else if (cp < 0x800) units.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
      else if (cp < 0x10000) units.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
      else units.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    } else {
      const words = cp < 0x10000 ? [cp] : [0xd7c0 + (cp >> 10), 0xdc00 + (cp & 0x3ff)];
      for (const word of words) encoding === "utf-16le" ? units.push(word & 255, word >> 8) : units.push(word >> 8, word & 255);
    }
  }
  return Uint8Array.from(units);
}

export function memFromRawRecord(raw: RawRecordValue, lifetime?: BorrowLifetime | BorrowToken): Mem {
  const result = new Mem();
  switch (raw.storageClass) {
    case "null": result.setNull(); break;
    case "integer": result.setInt64(raw.value); break;
    case "real": result.setDouble(raw.value); break;
    case "text": if (!lifetime) throw new MemError("invalid-state", "raw TEXT borrow requires lifetime"); result.setText(raw.bytes, raw.encoding, { ownership: "borrowed", lifetime }); break;
    case "blob": if (!lifetime) throw new MemError("invalid-state", "raw BLOB borrow requires lifetime"); result.setBlob(raw.bytes, { ownership: "borrowed", lifetime }); break;
  }
  return result;
}
export function memFromPublic(value: SqliteValue, encoding: DatabaseEncoding, limits: MemLimits = {}): Mem {
  const result = new Mem();
  if (value === null) result.setNull();
  else if (typeof value === "bigint") result.setInt64(value);
  else if (typeof value === "number") result.setDouble(value);
  else if (typeof value === "string") {
    const utf8 = encodeText(value, "utf-8"); checkedLength(utf8.byteLength, limits.maxLength);
    result.setText(encodeText(value, encoding), encoding, { ...(limits.maxLength === undefined ? {} : { maxLength: limits.maxLength }), ownership: "owned" });
  } else result.setBlob(value, { ...(limits.maxLength === undefined ? {} : { maxLength: limits.maxLength }), ownership: "owned" });
  result.markFromBind(); return result;
}
export function memToPublicInitial(value: Mem): SqliteValue {
  switch (value.initialStorageClass) {
    case "null": return null;
    case "integer": return value.integerValue();
    case "real": return value.realValue();
    case "text": return value.textValue();
    case "blob": return copyBytes(value.blobValue());
  }
}
