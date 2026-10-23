// vdbe.c OP_MakeRecord: serial types, header-size fixed point, then big-endian
// payload. Read-only VM callers supply no affinity/P5 trimming. IntReal is
// serialized as INTEGER as in the upstream MEM_IntReal branch.
function varint(n) {
    if (n < 0n || n > 0xffffffffffffffffn)
        throw new Error('record varint out of range');
    if (n > 0x00ffffffffffffffn) {
        const out = new Array(9);
        out[8] = Number(n & 255n);
        n >>= 8n;
        for (let i = 7; i >= 0; i--) {
            out[i] = Number(n & 127n) | 128;
            n >>= 7n;
        }
        return out;
    }
    const out = [Number(n & 127n)];
    while ((n >>= 7n) !== 0n)
        out.unshift(Number(n & 127n) | 128);
    return out;
}
export function recordSize(values) {
    let header = 0, payload = 0;
    for (const value of values) {
        const field = serial(value);
        header += varint(field.type).length;
        payload += field.length;
    }
    let size = header + 1;
    while (header + varint(BigInt(size)).length !== size)
        size = header + varint(BigInt(size)).length;
    return size + payload;
}
function serial(value) {
    const d = value.diagnostic();
    if (d.manifest === 'null')
        return { type: 0n, length: 0 };
    if (d.manifest === 'integer' || d.numeric === 'int-real') {
        const n = value.integerValue();
        if (n === 0n || n === 1n)
            return { type: 8n + n, length: 0 };
        for (const [length, type] of [[1, 1], [2, 2], [3, 3], [4, 4], [6, 5], [8, 6]]) {
            const bound = 1n << BigInt(length * 8 - 1);
            if (n >= -bound && n < bound) {
                if (length === 8 && d.numeric === 'int-real')
                    return { type: 7n, length: 8 };
                return { type: BigInt(type), length };
            }
        }
    }
    if (d.manifest === 'real')
        return { type: 7n, length: 8 };
    if (d.manifest === 'text' || d.manifest === 'blob')
        return { type: BigInt(d.byteLength) * 2n + (d.manifest === 'text' ? 13n : 12n), length: d.byteLength };
    throw new Error('MakeRecord requires ordinary Mem values');
}
export function packRecord(values, encoding) {
    const fields = values.map(serial), types = fields.flatMap(f => varint(f.type));
    // MakeRecord mutates an eight-byte IntReal input into MEM_Real.
    for (let i = 0; i < values.length; i++)
        if (fields[i].type === 7n && values[i].diagnostic().numeric === 'int-real')
            values[i].setDouble(values[i].realValue());
    let header = types.length + 1;
    while (types.length + varint(BigInt(header)).length !== header)
        header = types.length + varint(BigInt(header)).length;
    const out = new Uint8Array(header + fields.reduce((n, f) => n + f.length, 0));
    out.set(varint(BigInt(header)));
    out.set(types, varint(BigInt(header)).length);
    let at = header;
    for (let i = 0; i < values.length; i++) {
        const value = values[i], field = fields[i];
        if (field.type >= 1n && field.type <= 6n) {
            let n = BigInt.asUintN(field.length * 8, value.integerValue());
            for (let j = field.length - 1; j >= 0; j--) {
                out[at + j] = Number(n & 255n);
                n >>= 8n;
            }
        }
        else if (field.type === 7n)
            new DataView(out.buffer).setFloat64(at, value.realValue(), false);
        else if (field.type >= 12n) {
            const d = value.diagnostic();
            if (d.manifest === 'text' && d.encoding !== encoding)
                throw new Error('MakeRecord encoding mismatch');
            out.set(d.manifest === 'text' ? value.textBytes() : value.blobValue(), at);
        }
        at += field.length;
    }
    return out;
}
