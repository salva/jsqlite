// Internal comparison, built-in collation, and packed-key primitives.
// Source: SQLite 3.53.4 vdbeaux.c:sqlite3MemCompare,
// sqlite3IntFloatCompare/sqlite3VdbeRecordCompare and
// main.c:binCollFunc/nocaseCollatingFunc/rtrimCollFunc.
import { BorrowLifetime, Mem, MemError, memFromRawRecord } from "./mem.js";
import { decodeVarint, decodeRecord, RawRecordReader, RecordFormatError } from "./record.js";
/** Immutable, identity-bearing counterpart of SQLite KeyInfo. */
export class KeyInfo {
    encoding;
    totalFieldCount;
    keyFieldCount;
    terms;
    constructor(input) {
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
        this.terms = Object.freeze(input.terms.map((term) => {
            if (term.desc !== undefined && typeof term.desc !== "boolean")
                throw new ComparisonError("internal", "invalid KeyInfo DESC flag");
            if (term.nullsLarge !== undefined && typeof term.nullsLarge !== "boolean")
                throw new ComparisonError("internal", "invalid KeyInfo BIGNULL flag");
            let collation = term.collation;
            if (typeof collation === "object" && collation !== null) {
                collation = Object.freeze({ kind: collation.kind, encoding: collation.encoding });
            }
            validateCollation(collation);
            const copy = {};
            if (collation !== undefined)
                copy.collation = collation;
            if (term.desc !== undefined)
                copy.desc = term.desc;
            if (term.nullsLarge !== undefined)
                copy.nullsLarge = term.nullsLarge;
            return Object.freeze(copy);
        }));
        Object.freeze(this);
    }
}
export class ComparisonError extends Error {
    reason;
    constructor(reason, message, options) {
        super(message, options);
        this.name = "ComparisonError";
        this.reason = reason;
    }
}
export class UnpackedRecordKey {
    keyInfo;
    values;
    defaultRc;
    caller;
    nField;
    errCode = 0;
    eqSeen = false;
    #released = false;
    constructor(values, defaultRc, caller, keyInfo) {
        this.nField = values.length;
        this.values = Object.freeze([...values]);
        this.defaultRc = defaultRc;
        this.caller = caller;
        this.keyInfo = keyInfo;
    }
    assertLive() { if (this.#released)
        throw new ComparisonError("internal", "unpacked record key has been released"); }
    release() { if (!this.#released) {
        for (const value of this.values)
            value.release();
        this.#released = true;
    } }
}
function sign(value) { return value < 0 ? -1 : value > 0 ? 1 : 0; }
function byteCompare(left, right) {
    const n = Math.min(left.byteLength, right.byteLength);
    for (let i = 0; i < n; i++)
        if (left[i] !== right[i])
            return left[i] < right[i] ? -1 : 1;
    return sign(left.byteLength - right.byteLength);
}
function asciiFold(byte) { return byte >= 0x41 && byte <= 0x5a ? byte + 0x20 : byte; }
function nocaseCompare(left, right) {
    const n = Math.min(left.byteLength, right.byteLength);
    // main.c:nocaseCollatingFunc delegates the bounded prefix to
    // sqlite3StrNICmp(), which stops when either byte is NUL, then uses the full
    // byte lengths only when that prefix compares equal. NUL remains present in
    // the Mem value; this is collation behavior, not host-string truncation.
    for (let i = 0; i < n; i++) {
        const a = asciiFold(left[i]);
        const b = asciiFold(right[i]);
        if (a !== b || a === 0 || b === 0)
            return a < b ? -1 : a > b ? 1 : sign(left.byteLength - right.byteLength);
    }
    return sign(left.byteLength - right.byteLength);
}
function asUtf8(bytes, encoding) {
    if (encoding === "utf-8")
        return bytes;
    const value = new Mem();
    value.setText(bytes, encoding, { ownership: "static" });
    value.changeEncoding("utf-8");
    return value.textBytes();
}
/** Compare byte-counted TEXT. Embedded NUL is data. NOCASE and RTRIM are the
 * UTF-8-only built-ins and therefore source-translate UTF-16 before comparing. */
export function compareBuiltinText(kind, left, right, encoding) {
    let a = left, b = right;
    if (kind !== "binary" && encoding !== "utf-8") {
        a = asUtf8(a, encoding);
        b = asUtf8(b, encoding);
    }
    if (kind === "nocase")
        return nocaseCompare(a, b);
    if (kind === "rtrim") {
        let an = a.byteLength, bn = b.byteLength;
        while (an > 0 && a[an - 1] === 0x20)
            an--;
        while (bn > 0 && b[bn - 1] === 0x20)
            bn--;
        return byteCompare(a.subarray(0, an), b.subarray(0, bn));
    }
    return byteCompare(a, b);
}
function intFloatCompare(integer, real) {
    // Direct port of sqlite3IntFloatCompare. Number(integer) is used only after
    // the truncated-real bigint comparison has established the safe tie region.
    if (Number.isNaN(real))
        return 1;
    if (real < -9223372036854775808)
        return 1;
    if (real >= 9223372036854775808)
        return -1;
    const truncated = BigInt(Math.trunc(real));
    if (integer < truncated)
        return -1;
    if (integer > truncated)
        return 1;
    const converted = Number(integer);
    return converted < real ? -1 : converted > real ? 1 : 0;
}
function numericKind(value) {
    const kind = value.diagnostic().numeric;
    return kind === "integer" || kind === "int-real" ? "integer" : kind === "real" ? "real" : null;
}
function collationSpec(collation, fallback) {
    return typeof collation === "string" ? { kind: collation, encoding: fallback } : collation ?? { kind: "binary", encoding: fallback };
}
function textAtEncoding(value, encoding) {
    const diagnostic = value.diagnostic(); // validates borrow before any copy/conversion
    if (diagnostic.encoding === encoding)
        return value.textBytes();
    const copy = new Mem();
    copy.copyFrom(value);
    copy.changeEncoding(encoding);
    return copy.textBytes();
}
/** SQLite storage-class comparison. Inputs are never converted or cache-mutated. */
export function compareMem(left, right, collation) {
    const ld = left.diagnostic(), rd = right.diagnostic(); // also validates borrows
    if (ld.manifest === "aggregate" || rd.manifest === "aggregate")
        throw new ComparisonError("internal", "aggregate Mem cannot be compared");
    if (ld.manifest === "null" || rd.manifest === "null")
        return ld.manifest === rd.manifest ? 0 : ld.manifest === "null" ? -1 : 1;
    const ln = numericKind(left), rn = numericKind(right);
    if (ln || rn) {
        if (!ln || !rn)
            return ln ? -1 : 1;
        if (ln === "integer" && rn === "integer")
            return left.integerValue() < right.integerValue() ? -1 : left.integerValue() > right.integerValue() ? 1 : 0;
        if (ln === "real" && rn === "real")
            return sign(left.realValue() - right.realValue());
        return ln === "integer" ? intFloatCompare(left.integerValue(), right.realValue()) : -intFloatCompare(right.integerValue(), left.realValue());
    }
    if (ld.manifest === "text" || rd.manifest === "text") {
        if (ld.manifest !== "text" || rd.manifest !== "text")
            return ld.manifest === "text" ? -1 : 1;
        const spec = collationSpec(collation, (ld.encoding ?? rd.encoding));
        return compareBuiltinText(spec.kind, textAtEncoding(left, spec.encoding), textAtEncoding(right, spec.encoding), spec.encoding);
    }
    return byteCompare(left.blobValue(), right.blobValue());
}
function checkedCount(value, name) {
    if (!Number.isSafeInteger(value) || value < 0)
        throw new ComparisonError("internal", `${name} must be a non-negative safe integer`);
}
function checkedLimit(value, name) {
    if (value !== undefined && (!Number.isSafeInteger(value) || value < 0))
        throw new ComparisonError("internal", `${name} must be a non-negative safe integer`);
}
function validateLimits(limits) {
    checkedLimit(limits.maxFields, "maxFields");
    checkedLimit(limits.maxBytes, "maxBytes");
    checkedLimit(limits.maxWorkUnits, "maxWorkUnits");
}
function validateCollation(collation) {
    if (collation === undefined)
        return;
    const kind = typeof collation === "string" ? collation : collation.kind;
    const encoding = typeof collation === "string" ? undefined : collation.encoding;
    if (kind !== "binary" && kind !== "nocase" && kind !== "rtrim")
        throw new ComparisonError("internal", "invalid KeyInfo collation");
    if (encoding !== undefined && encoding !== "utf-8" && encoding !== "utf-16le" && encoding !== "utf-16be") {
        throw new ComparisonError("internal", "invalid KeyInfo collation encoding");
    }
}
function validateKeyInfo(info) {
    if (!(info instanceof KeyInfo) || !Object.isFrozen(info) || !Object.isFrozen(info.terms)) {
        throw new ComparisonError("internal", "KeyInfo must be a validated immutable descriptor");
    }
}
/** Decode a complete packed index record. TEXT/BLOB Mem cells borrow `packed`
 * under the caller-owned generation. No partial object escapes on failure. */
export function unpackRecordKey(packed, keyInfo, borrowLifetime, options = {}) {
    validateKeyInfo(keyInfo);
    const defaultRc = options.defaultRc ?? 0;
    if (defaultRc !== -1 && defaultRc !== 0 && defaultRc !== 1)
        throw new ComparisonError("internal", "defaultRc must be -1, 0, or 1");
    const caller = options.caller ?? "record";
    const limits = options.limits ?? {};
    validateLimits(limits);
    if (limits.maxBytes !== undefined && packed.byteLength > limits.maxBytes)
        throw new ComparisonError("limit", "packed key exceeds configured byte limit");
    try {
        const decoded = decodeRecord(packed, keyInfo.encoding);
        if (decoded.values.length > keyInfo.totalFieldCount)
            throw new ComparisonError("corrupt", "packed key has more fields than KeyInfo permits");
        if (caller === "seek" && (decoded.values.length === 0 || decoded.values.length > keyInfo.keyFieldCount)) {
            throw new ComparisonError("internal", "seek key requires between one and keyFieldCount fields");
        }
        if (limits.maxFields !== undefined && decoded.values.length > limits.maxFields)
            throw new ComparisonError("limit", "packed key exceeds configured field limit");
        if (limits.maxWorkUnits !== undefined && packed.byteLength + decoded.values.length > limits.maxWorkUnits) {
            throw new ComparisonError("limit", "packed key exceeds configured work limit");
        }
        const values = decoded.values.map(value => memFromRawRecord(value, borrowLifetime));
        return new UnpackedRecordKey(values, defaultRc, caller, keyInfo);
    }
    catch (error) {
        if (error instanceof ComparisonError)
            throw error;
        if (error instanceof RecordFormatError)
            throw new ComparisonError("corrupt", error.message, { cause: error });
        if (error instanceof MemError)
            throw new ComparisonError(error.reason === "limit" ? "limit" : "internal", error.message, { cause: error });
        throw error;
    }
}
/** Compare a packed left key with an unpacked right key, matching
 * sqlite3VdbeRecordCompare. The packed temporary borrow is scoped to this call;
 * serial fields are decoded one at a time and equal compared prefixes return
 * the unpacked RHS defaultRc. */
export function compareRecordKey(packed, unpacked, keyInfo, limits = {}) {
    unpacked.assertLive();
    validateKeyInfo(keyInfo);
    validateLimits(limits);
    if (unpacked.caller === "stat4")
        throw new ComparisonError("internal", "STAT4 requires raw padded comparison channel");
    if (keyInfo !== unpacked.keyInfo)
        throw new ComparisonError("internal", "comparison KeyInfo identity does not match unpacked key");
    // Generic complete unpack may produce zero/short records for inspection, but
    // ordinary record comparison requires RHS nField to cover nKeyField. Only an
    // explicit current-pin OP_Seek construction is an intentional short prefix.
    if (unpacked.caller === "record" && unpacked.values.length < keyInfo.keyFieldCount) {
        throw new ComparisonError("internal", "ordinary comparison key has fewer than keyFieldCount fields");
    }
    if (unpacked.caller === "seek" && (unpacked.values.length === 0 || unpacked.values.length > keyInfo.keyFieldCount)) {
        throw new ComparisonError("internal", "invalid seek comparison field count");
    }
    if (limits.maxBytes !== undefined && packed.byteLength > limits.maxBytes)
        throw new ComparisonError("limit", "packed key exceeds configured byte limit");
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
            const term = keyInfo.terms[i];
            try {
                let result = compareMem(right, unpacked.values[i], term.collation);
                if (result !== 0) {
                    const eitherNull = unpacked.values[i].initialStorageClass === "null" || right.initialStorageClass === "null";
                    if (term.nullsLarge && eitherNull)
                        result = -result;
                    if (term.desc)
                        result = -result;
                    return result;
                }
            }
            finally {
                right.release();
            }
        }
        unpacked.eqSeen = true;
        return unpacked.defaultRc;
    }
    catch (error) {
        if (error instanceof ComparisonError)
            throw error;
        if (error instanceof RecordFormatError)
            throw new ComparisonError("corrupt", error.message, { cause: error });
        throw error;
    }
    finally {
        lifetime.close();
    }
}
/** vdbeaux.c:sqlite3VdbeRecordCompareWithSkip (skip=0), STAT4 raw
 * buffer contract. n excludes eight readable zero padding bytes. Strict
 * ordinary cursors keep RawRecordReader; malformed sample error ownership
 * belongs to RHS errCode, not record decoding exceptions. */
export function compareStat4RecordKey(p, n, rhs, info, check = () => { }) {
    rhs.assertLive();
    validateKeyInfo(info);
    if (rhs.caller !== "stat4" || rhs.keyInfo !== info || rhs.nField < 1 || rhs.nField > rhs.values.length || rhs.nField > info.totalFieldCount || rhs.nField > info.terms.length)
        throw new ComparisonError("internal", "invalid STAT4 comparison prefix");
    if (!Number.isSafeInteger(n) || n < 0 || p.length < n + 8)
        throw new ComparisonError("internal", "STAT4 requires raw padded length");
    const corrupt = () => { rhs.errCode = 11; return 0; };
    check();
    const header = decodeVarint(p, 0);
    const sz = Number(header.value > 0xffffffffn ? 0xffffffffn : header.value);
    let idx = header.length, d = sz;
    if (d > n)
        return corrupt();
    const length = (t) => t < 5 ? t : t === 5 ? 6 : t === 6 || t === 7 ? 8 : t < 12 ? 0 : (t - 12) >>> 1;
    const numeric = (t, m) => {
        if (t === 0 || t === 10 || t === 11) {
            m.setNull();
            return;
        }
        if (t === 7) {
            const v = new DataView(p.buffer, p.byteOffset + d, 8).getFloat64(0, false);
            m.setDouble(v);
            return;
        }
        if (t === 8 || t === 9) {
            m.setInt64(BigInt(t - 8));
            return;
        }
        let v = 0n;
        const count = length(t);
        for (let j = 0; j < count; j++)
            v = (v << 8n) | BigInt(p[d + j]);
        m.setInt64(BigInt.asIntN(count * 8, v));
    };
    for (let i = 0;; i++) {
        check();
        const r = rhs.values[i], kind = r.initialStorageClass;
        let t = p[idx], rc = 0;
        const m = new Mem();
        try {
            if (kind === "integer" || kind === "real") {
                if (t >= 10)
                    rc = t === 10 ? -1 : 1;
                else if (t === 0)
                    rc = -1;
                else {
                    numeric(t, m);
                    rc = compareMem(m, r);
                }
            }
            else if (kind === "text" || kind === "blob") {
                const serial = decodeVarint(p, idx).value;
                t = Number(serial > 0xffffffffn ? 0xffffffffn : serial);
                if (kind === "text" ? (t < 12 || !(t & 1)) : (t < 12 || !!(t & 1))) {
                    rc = kind === "text" && t >= 12 ? 1 : -1;
                }
                else {
                    const bytes = length(t);
                    if (d + bytes > n)
                        return corrupt();
                    if (kind === "text")
                        m.setText(p.subarray(d, d + bytes), info.encoding);
                    else
                        m.setBlob(p.subarray(d, d + bytes));
                    rc = compareMem(m, r, info.terms[i].collation);
                }
            }
            else {
                if (t === 0 || t === 10)
                    rc = 0;
                else if (t === 7) {
                    numeric(t, m);
                    rc = m.initialStorageClass === "null" ? 0 : 1;
                }
                else
                    rc = 1;
            }
            if (rc) {
                const term = info.terms[i];
                // Source uses serial_type==0, not a decoded reserved/NaN NULL.
                if (term.nullsLarge && (t === 0 || kind === "null"))
                    rc = -rc;
                if (term.desc)
                    rc = -rc;
                return rc;
            }
        }
        finally {
            m.release();
        }
        if (i + 1 === rhs.nField)
            break;
        d += length(t);
        if (d > n)
            break;
        // sqlite3VarintLen operates on the decoded serial type.
        let v = BigInt(t), bytes = 1;
        while (v >= 128n) {
            v >>= 7n;
            bytes++;
        }
        idx += bytes;
        if (idx >= sz)
            return corrupt();
    }
    rhs.eqSeen = true;
    return rhs.defaultRc;
}
