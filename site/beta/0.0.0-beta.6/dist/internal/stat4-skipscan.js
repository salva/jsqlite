// SQLite 3.53.4 vdbemem.c:sqlite3Stat4Column and
// where.c:whereRangeSkipScanEst. Scalar samples are NOT unpacked index keys.
import { stat4RecordBytes } from "./stat4-record.js";
import { decodeVarint, RecordFormatError } from "./record.js";
import { Mem } from "./mem.js";
import { ComparisonError, compareMem } from "./comparison.js";
import { sqliteLogEst } from "./schema.js";
import { stat4ValueFromExpr } from "./stat4-probe.js";
const serialLength = (t) => t < 5 ? t : t === 5 ? 6 : t === 6 || t === 7 ? 8 : t < 12 ? 0 : Math.floor((t - 12) / 2);
const corrupt = () => { throw new ComparisonError('corrupt', 'invalid STAT4 sample column'); };
/** Decode only iCol (native requires iCol>0). Padding is readable for varints,
 * but header and cumulative payload endpoints must fit the original n.
 * A supplied destination is unchanged on structural corruption. Ordinary record
 * readers remain strict, including their rejection of reserved serial types.
 * reserve covers the copied field until the caller releases the scratch Mem. */
export function stat4Column(sample, iCol, encoding, destination, check = () => { }, reserve) {
    const p = stat4RecordBytes(sample), n = sample.n;
    if (!Number.isInteger(iCol) || iCol <= 0 || !Number.isSafeInteger(n) || n < 0 || p.length < n + 8)
        throw new ComparisonError('internal', 'invalid STAT4 scalar column request');
    const varint = (offset) => {
        check(1);
        try {
            const v = decodeVarint(p, offset);
            return { value: Number(v.value > 0xffffffffn ? 0xffffffffn : v.value), length: v.length };
        }
        catch (e) {
            if (e instanceof RecordFormatError)
                return corrupt();
            throw e;
        }
    };
    const header = varint(0);
    let iHdr = header.length, iField = header.value, t = 0, size = 0;
    if (iField > n || iHdr >= iField)
        return corrupt();
    for (let i = 0; i <= iCol; i++) {
        const serial = varint(iHdr);
        iHdr += serial.length;
        t = serial.value;
        if (iHdr > header.value)
            return corrupt();
        size = serialLength(t);
        iField += size;
    }
    if (iField > n)
        return corrupt();
    // Charge before copying/decoding payload; host codecs are synchronous.
    for (let at = 0; at < size; at += 4096)
        check(Math.min(4096, size - at));
    const release = reserve?.(64 + size * 2) ?? (() => { });
    try {
        const start = iField - size;
        if (t === 0 || t === 10 || t === 11)
            destination.setNull();
        else if (t === 7)
            destination.setDouble(new DataView(p.buffer, p.byteOffset + start, 8).getFloat64(0, false));
        else if (t === 8 || t === 9)
            destination.setInt64(BigInt(t - 8));
        else if (t < 7) {
            let v = 0n;
            for (let j = start; j < iField; j++)
                v = (v << 8n) | BigInt(p[j]);
            destination.setInt64(BigInt.asIntN(size * 8, v));
        }
        else if (t & 1)
            destination.setText(p.subarray(start, iField), encoding);
        else
            destination.setBlob(p.subarray(start, iField), { encoding });
        return release;
    }
    catch (e) {
        release();
        throw e;
    }
}
/** Builder-local native count loop. Consumer subtracts adjust from nOut only
 * when done. No prefix slots/metadata are mutated and DESC does not invert the
 * scalar MemCompare. Errors propagate (no apparent successful fallback). */
export function stat4SkipScanRange(input) {
    const { probe, samples, column, affinity, lower, upper } = input;
    probe.assertLive();
    if (!Number.isInteger(column) || column <= 0 || column >= probe.keyInfo.terms.length)
        throw new ComparisonError('internal', 'invalid skipscan range column');
    let nLower = -1, nUpper = samples.length + 1, p1 = null, p2 = null;
    const value = new Mem();
    const releases = [];
    let sampleRelease = () => { };
    const extract = (node) => {
        // Same conservative token/codec/binding accounting as ProbeSetValue, but
        // bound scratch belongs to this call, not persistent prefix slot capacity.
        let bytes = 64;
        const size = (n) => { probe.check(1); if (n.kind === 'terminal')
            bytes += 32 + n.value.text.length * 8 + (n.value.kind === 'variable' ? (probe.reprepare?.bindingBytes(n.value) ?? 0) * 8 : 0);
        else
            for (const c of n.children)
                size(c); };
        size(node);
        const release = probe.reserve?.(bytes);
        if (release)
            releases.push(release);
        return stat4ValueFromExpr(node, affinity, probe.keyInfo.encoding, () => { probe.parameterSensitive = true; }, probe.check, probe.reprepare);
    };
    const compare = (bound) => {
        // compareMem may transcode to the collation encoding (and NOCASE/RTRIM
        // consumes UTF8). Charge BOTH operands on every comparison, not just the
        // sample decode: a long constant can otherwise repeat unmetered O(n) work.
        const bytes = bound.diagnostic().byteLength + value.diagnostic().byteLength;
        probe.check(1);
        for (let at = 0; at < bytes; at += 4096)
            probe.check(Math.min(4096, bytes - at));
        const release = probe.reserve?.(64 + bytes * 8);
        try {
            return compareMem(bound, value, probe.keyInfo.terms[column].collation);
        }
        finally {
            release?.();
        }
    };
    try {
        if (lower) {
            p1 = extract(lower);
            nLower = 0;
        }
        if (upper) {
            p2 = extract(upper);
            nUpper = p2 ? 0 : samples.length;
        }
        let done = false, adjust = 0;
        if (p1 || p2) {
            for (const sample of samples) {
                probe.check(1);
                // Release preceding field before replacement; pVal object identity stays.
                value.setNull();
                sampleRelease();
                sampleRelease = () => { };
                sampleRelease = stat4Column(sample, column, probe.keyInfo.encoding, value, probe.check, probe.reserve);
                if (p1 && compare(p1) >= 0)
                    nLower++;
                if (p2 && compare(p2) >= 0)
                    nUpper++;
            }
            const nDiff = Math.max(1, nUpper - nLower);
            if (nDiff !== 1 || !upper || !lower) {
                adjust = sqliteLogEst(BigInt(samples.length)) - sqliteLogEst(BigInt(nDiff));
                done = true;
            }
        }
        return { nLower, nUpper, nDiff: Math.max(1, nUpper - nLower), done, adjust };
    }
    finally {
        // Native order sqlite3ValueFree(p1), p2, pVal. Logical reservations track
        // owned copies, not measured JS heap; no schema/statement retention.
        p1?.release();
        p2?.release();
        value.release();
        sampleRelease();
        for (const release of releases)
            release();
    }
}
