// Internal format-3 record primitives. They deliberately expose raw TEXT rather
// than applying WHATWG decoding. Algorithms follow util.c:sqlite3GetVarint and
// vdbeaux.c:sqlite3VdbeSerialTypeLen/sqlite3VdbeSerialGet in the pinned source.

export type DatabaseEncoding = "utf-8" | "utf-16le" | "utf-16be";

export class RecordFormatError extends Error {
  readonly reason:
    | "invalid-bounds"
    | "truncated-varint"
    | "invalid-header"
    | "reserved-serial-type"
    | "truncated-payload";

  constructor(reason: RecordFormatError["reason"], message: string) {
    super(message);
    this.name = "RecordFormatError";
    this.reason = reason;
  }
}

export interface DecodedVarint {
  readonly value: bigint;
  readonly length: number;
}

/** Decode one SQLite varint without reading beyond `end` (an exclusive offset). */
export function decodeVarint(bytes: Uint8Array, offset: number, end = bytes.byteLength): DecodedVarint {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(end) || offset < 0 || end < offset || end > bytes.byteLength) {
    throw new RecordFormatError("invalid-bounds", "invalid varint bounds");
  }

  // util.c:sqlite3GetVarint's one/two-byte branches dominate record
  // headers. Keep bounds checks at the read boundary (C relies on padding).
  if (offset < end) {
    const first = bytes[offset]!;
    if (first < 0x80) return { value: BigInt(first), length: 1 };
    if (offset + 1 < end && bytes[offset + 1]! < 0x80)
      return { value: BigInt(((first & 0x7f) << 7) | bytes[offset + 1]!), length: 2 };
  }
  let value = 0n;
  for (let i = 0; i < 8; i++) {
    const position = offset + i;
    if (position >= end) throw new RecordFormatError("truncated-varint", "truncated SQLite varint");
    const byte = bytes[position]!;
    value = (value << 7n) | BigInt(byte & 0x7f);
    if ((byte & 0x80) === 0) return { value, length: i + 1 };
  }

  const ninth = offset + 8;
  if (ninth >= end) throw new RecordFormatError("truncated-varint", "truncated SQLite varint");
  return { value: (value << 8n) | BigInt(bytes[ninth]!), length: 9 };
}

export interface RawNull {
  readonly storageClass: "null";
}
export interface RawInteger {
  readonly storageClass: "integer";
  readonly value: bigint;
}
export interface RawReal {
  readonly storageClass: "real";
  /** Exact source bits, retained even when JS canonicalizes a NaN payload. */
  readonly bits: bigint;
  readonly value: number;
  readonly classification: "finite" | "infinity" | "nan";
}
export interface RawText {
  readonly storageClass: "text";
  /** Borrowed from the record argument; its owner must outlive this value. */
  readonly bytes: Uint8Array;
  readonly encoding: DatabaseEncoding;
}
export interface RawBlob {
  readonly storageClass: "blob";
  /** OP_Column source encoding metadata, not a conversion of the BLOB. */
  readonly encoding?: DatabaseEncoding;
  /** Borrowed from the record argument; its owner must outlive this value. */
  readonly bytes: Uint8Array;
}
export type RawRecordValue = RawNull | RawInteger | RawReal | RawText | RawBlob;

export interface DecodedRecord {
  readonly headerLength: number;
  readonly payloadLength: number;
  readonly values: readonly RawRecordValue[];
}

/** vdbe.c OP_Column's movement-invalidated cursor record cache.
 * Its owner discards the cache before moving/reusing its cursor. */
export class CursorRecord {
  #record: Uint8Array | undefined;
  #headerOffset = 0;
  #headerLength = 0;
  #payloadOffset = 0;
  #fields: {serial: bigint; start: number; length: number}[] = [];
  #values = new Map<number, RawRecordValue>();
  readonly payload: () => Uint8Array;
  readonly encoding: DatabaseEncoding;
  constructor(payload: () => Uint8Array, encoding: DatabaseEncoding) { this.payload = payload; this.encoding = encoding; }
  field(index: number): RawRecordValue | undefined {
    if (!this.#record) {
      const reader = new RawRecordReader(this.payload(), this.encoding);
      this.#record = reader.record;
      this.#headerLength = reader.headerLength;
      this.#headerOffset = decodeVarint(this.#record, 0).length;
      this.#payloadOffset = this.#headerLength;
    }
    // OP_Column parses preceding serial headers, not preceding values.
    while (this.#fields.length <= index && this.#headerOffset < this.#headerLength) {
      const serial = decodeVarint(this.#record, this.#headerOffset, this.#headerLength);
      const length = Number(serialLength(serial.value));
      if (length > this.#record.length - this.#payloadOffset) throw new RecordFormatError("truncated-payload", "record serial value exceeds available payload");
      // OP_Column requires complete payload consumption at header exhaustion,
      // before publishing the terminal field or its offset transition. Unlike
      // generic unpacking, trailing payload is corruption on this path.
      if (this.#headerOffset + serial.length === this.#headerLength &&
          this.#payloadOffset + length !== this.#record.length) {
        throw new RecordFormatError("invalid-header", "record header does not consume the complete payload");
      }
      this.#fields.push({serial: serial.value, start: this.#payloadOffset, length});
      this.#headerOffset += serial.length;
      this.#payloadOffset += length;
    }
    const field = this.#fields[index];
    if (!field) return undefined;
    let value = this.#values.get(index);
    if (!value) {
      value = decodeSerial(field.serial, this.#record.subarray(field.start, field.start + field.length), this.encoding);
      this.#values.set(index, value);
    }
    return value;
  }
  last(): RawRecordValue | undefined {
    // Determine the final ordinal without materializing intervening values.
    this.field(Number.MAX_SAFE_INTEGER);
    return this.field(this.#fields.length - 1);
  }
}

/** Incremental view of a packed record. Consumers such as index-key comparison
 * can stop after a decisive field without reading unrelated serial values. */
export class RawRecordReader {
  readonly record: Uint8Array;
  readonly encoding: DatabaseEncoding;
  readonly headerLength: number;
  #headerOffset: number;
  #payloadOffset: number;

  constructor(record: Uint8Array, encoding: DatabaseEncoding) {
    this.record = record;
    this.encoding = encoding;
    if (record.byteLength === 0) throw new RecordFormatError("invalid-header", "record has no header-size varint");
    const headerSizeVarint = decodeVarint(record, 0, record.byteLength);
    const headerSizeBig = headerSizeVarint.value;
    if (headerSizeBig < BigInt(headerSizeVarint.length) || headerSizeBig > BigInt(record.byteLength)) {
      throw new RecordFormatError("invalid-header", "record header length is outside the record");
    }
    this.headerLength = Number(headerSizeBig);
    this.#headerOffset = headerSizeVarint.length;
    this.#payloadOffset = this.headerLength;
  }

  get payloadLength(): number { return this.#payloadOffset - this.headerLength; }

  // Number-sized serial classification mirrors upstream u32 serial_type.
  // Larger varints still pass serialLength's exact bounded validation first.
  serialNumber = 0;
  get serialType(): bigint { return BigInt(this.serialNumber); }
  fieldOffset = 0;
  fieldLength = 0;

  /** RecordCompareWithSkip's idx1/d1 transition, without materializing a value. */
  advance(): boolean {
    if (this.#headerOffset >= this.headerLength) return false;
    const byte = this.record[this.#headerOffset]!;
    let serial: number;
    let headerBytes: number;
    let length: number;
    if (byte < 0x80) {
      serial = byte; headerBytes = 1;
      if (byte === 10 || byte === 11) throw new RecordFormatError("reserved-serial-type", "reserved serial type");
      length = byte < 5 ? byte : byte === 5 ? 6 : byte < 8 ? 8 : byte < 10 ? 0 : Math.floor((byte - 12) / 2);
    } else {
      const decoded = decodeVarint(this.record, this.#headerOffset, this.headerLength);
      length = Number(serialLength(decoded.value));
      serial = Number(decoded.value); headerBytes = decoded.length;
    }
    if (length > this.record.byteLength - this.#payloadOffset) throw new RecordFormatError("truncated-payload", "record serial value exceeds available payload");
    this.serialNumber = serial;
    this.fieldOffset = this.#payloadOffset;
    this.fieldLength = length;
    this.#headerOffset += headerBytes;
    this.#payloadOffset += length;
    return true;
  }

  /** vdbeRecordDecodeInt: valid only for serial1–6,8,9. */
  integer(): bigint {
    if (this.serialNumber === 8 || this.serialNumber === 9) return BigInt(this.serialNumber - 8);
    return signedBigEndianAt(this.record, this.fieldOffset, this.fieldLength);
  }
  value(): RawRecordValue {
    return decodeSerial(this.serialType, this.record.subarray(this.fieldOffset, this.fieldOffset + this.fieldLength), this.encoding);
  }
  /** Decode the next field, borrowing TEXT/BLOB bytes from `record`. */
  next(): RawRecordValue | null { return this.advance() ? this.value() : null; }
}

function serialLength(serialType: bigint): bigint {
  if (serialType <= 4n) return serialType === 0n ? 0n : serialType;
  if (serialType === 5n) return 6n;
  if (serialType === 6n || serialType === 7n) return 8n;
  if (serialType === 8n || serialType === 9n) return 0n;
  if (serialType === 10n || serialType === 11n) {
    throw new RecordFormatError("reserved-serial-type", `reserved record serial type ${serialType}`);
  }
  return (serialType - 12n) >> 1n;
}

function signedBigEndian(bytes: Uint8Array): bigint {
  return signedBigEndianAt(bytes, 0, bytes.length);
}
function signedBigEndianAt(bytes: Uint8Array, start: number, length: number): bigint {
  // vdbeaux.c ONE/TWO/THREE/FOUR_BYTE_INT: exact signed 32-bit
  // arithmetic, then widen. Wider serial types retain the 64-bit path.
  if (length > 0 && length <= 4) {
    let value = (bytes[start]! << 24) >> 24;
    for (let i = 1; i < length; i++) value = value * 256 + bytes[start + i]!;
    return BigInt(value);
  }
  let value = 0n;
  for (let i = 0; i < length; i++) value = (value << 8n) | BigInt(bytes[start + i]!);
  const bits = BigInt(length * 8);
  return length !== 0 && (bytes[start]! & 0x80) !== 0 ? value - (1n << bits) : value;
}

function unsignedBigEndian(bytes: Uint8Array): bigint {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  return value;
}

function decodeSerial(serialType: bigint, payload: Uint8Array, encoding: DatabaseEncoding): RawRecordValue {
  if (serialType === 0n) return { storageClass: "null" };
  if (serialType >= 1n && serialType <= 6n) return { storageClass: "integer", value: signedBigEndian(payload) };
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
  if (serialType === 8n || serialType === 9n) return { storageClass: "integer", value: serialType - 8n };
  if ((serialType & 1n) === 0n) return { storageClass: "blob", bytes: payload, encoding };
  return { storageClass: "text", bytes: payload, encoding };
}

/**
 * Decode one complete record payload. The returned TEXT/BLOB subarrays borrow
 * `record`; callers needing a public value must copy at that later boundary.
 */
export function decodeRecord(record: Uint8Array, encoding: DatabaseEncoding): DecodedRecord {
  const reader = new RawRecordReader(record, encoding);
  const values: RawRecordValue[] = [];
  for (let value = reader.next(); value !== null; value = reader.next()) values.push(value);
  return { headerLength: reader.headerLength, payloadLength: reader.payloadLength, values };
}
