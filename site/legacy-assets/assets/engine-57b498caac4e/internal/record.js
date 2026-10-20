// Internal format-3 record primitives. They deliberately expose raw TEXT rather
// than applying WHATWG decoding. Algorithms follow util.c:sqlite3GetVarint and
// vdbeaux.c:sqlite3VdbeSerialTypeLen/sqlite3VdbeSerialGet in the pinned source.
export class RecordFormatError extends Error {
    reason;
    constructor(reason, message) {
        super(message);
        this.name = "RecordFormatError";
        this.reason = reason;
    }
}
/** Decode one SQLite varint without reading beyond `end` (an exclusive offset). */
export function decodeVarint(bytes, offset, end = bytes.byteLength) {
    if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(end) || offset < 0 || end < offset || end > bytes.byteLength) {
        throw new RecordFormatError("invalid-bounds", "invalid varint bounds");
    }
    let value = 0n;
    for (let i = 0; i < 8; i++) {
        const position = offset + i;
        if (position >= end)
            throw new RecordFormatError("truncated-varint", "truncated SQLite varint");
        const byte = bytes[position];
        value = (value << 7n) | BigInt(byte & 0x7f);
        if ((byte & 0x80) === 0)
            return { value, length: i + 1 };
    }
    const ninth = offset + 8;
    if (ninth >= end)
        throw new RecordFormatError("truncated-varint", "truncated SQLite varint");
    return { value: (value << 8n) | BigInt(bytes[ninth]), length: 9 };
}
/** Incremental view of a packed record. Consumers such as index-key comparison
 * can stop after a decisive field without reading unrelated serial values. */
export class RawRecordReader {
    record;
    encoding;
    headerLength;
    #headerOffset;
    #payloadOffset;
    constructor(record, encoding) {
        this.record = record;
        this.encoding = encoding;
        if (record.byteLength === 0)
            throw new RecordFormatError("invalid-header", "record has no header-size varint");
        const headerSizeVarint = decodeVarint(record, 0, record.byteLength);
        const headerSizeBig = headerSizeVarint.value;
        if (headerSizeBig < BigInt(headerSizeVarint.length) || headerSizeBig > BigInt(record.byteLength)) {
            throw new RecordFormatError("invalid-header", "record header length is outside the record");
        }
        this.headerLength = Number(headerSizeBig);
        this.#headerOffset = headerSizeVarint.length;
        this.#payloadOffset = this.headerLength;
    }
    get payloadLength() { return this.#payloadOffset - this.headerLength; }
    /** Decode the next field, borrowing TEXT/BLOB bytes from `record`. */
    next() {
        if (this.#headerOffset >= this.headerLength)
            return null;
        const serial = decodeVarint(this.record, this.#headerOffset, this.headerLength);
        const nextHeaderOffset = this.#headerOffset + serial.length;
        const lengthBig = serialLength(serial.value);
        const remaining = BigInt(this.record.byteLength - this.#payloadOffset);
        if (lengthBig > remaining)
            throw new RecordFormatError("truncated-payload", "record serial value exceeds available payload");
        const length = Number(lengthBig);
        const payload = this.record.subarray(this.#payloadOffset, this.#payloadOffset + length);
        const value = decodeSerial(serial.value, payload, this.encoding);
        this.#headerOffset = nextHeaderOffset;
        this.#payloadOffset += length;
        return value;
    }
}
function serialLength(serialType) {
    if (serialType <= 4n)
        return serialType === 0n ? 0n : serialType;
    if (serialType === 5n)
        return 6n;
    if (serialType === 6n || serialType === 7n)
        return 8n;
    if (serialType === 8n || serialType === 9n)
        return 0n;
    if (serialType === 10n || serialType === 11n) {
        throw new RecordFormatError("reserved-serial-type", `reserved record serial type ${serialType}`);
    }
    return (serialType - 12n) >> 1n;
}
function signedBigEndian(bytes) {
    let value = 0n;
    for (const byte of bytes)
        value = (value << 8n) | BigInt(byte);
    const bits = BigInt(bytes.byteLength * 8);
    return bytes.byteLength !== 0 && (bytes[0] & 0x80) !== 0 ? value - (1n << bits) : value;
}
function unsignedBigEndian(bytes) {
    let value = 0n;
    for (const byte of bytes)
        value = (value << 8n) | BigInt(byte);
    return value;
}
function decodeSerial(serialType, payload, encoding) {
    if (serialType === 0n)
        return { storageClass: "null" };
    if (serialType >= 1n && serialType <= 6n)
        return { storageClass: "integer", value: signedBigEndian(payload) };
    if (serialType === 7n) {
        const bits = unsignedBigEndian(payload);
        // serialGet7 assembles the big-endian bits then memcpy's into the REAL.
        // Reinterpret only those owned eight bytes, never export a borrowed page's
        // backing buffer (which could outlive its lease or expose unrelated cells).
        const real = new DataView(new ArrayBuffer(8));
        real.setBigUint64(0, bits, false);
        const value = real.getFloat64(0, false);
        const classification = Number.isNaN(value) ? "nan" : Number.isFinite(value) ? "finite" : "infinity";
        return { storageClass: "real", bits, value, classification };
    }
    if (serialType === 8n || serialType === 9n)
        return { storageClass: "integer", value: serialType - 8n };
    if ((serialType & 1n) === 0n)
        return { storageClass: "blob", bytes: payload };
    return { storageClass: "text", bytes: payload, encoding };
}
/**
 * Decode one complete record payload. The returned TEXT/BLOB subarrays borrow
 * `record`; callers needing a public value must copy at that later boundary.
 */
export function decodeRecord(record, encoding) {
    const reader = new RawRecordReader(record, encoding);
    const values = [];
    for (let value = reader.next(); value !== null; value = reader.next())
        values.push(value);
    return { headerLength: reader.headerLength, payloadLength: reader.payloadLength, values };
}
