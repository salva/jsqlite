import { aggregateTextToBlob } from "./json-aggregate-blob.js";
import { JSQLiteError } from "../index.js";
import { Mem, atof, atoi64Prefix, sqliteQuoteReal } from "./mem.js";
const jsonStringEncoding = new WeakMap();
const jsonStringSpelling = new WeakMap();
const jsonObjectLabelSpelling = new WeakMap();
const jsonbOriginal = new WeakMap();
const jsonbBounds = new WeakMap();
const jsonbLabels = new WeakMap();
const jsonbLabelEncodings = new WeakMap();
const te = new TextEncoder(), td = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const malformed = () => new JSQLiteError("sqlite", "malformed JSON", { code: 1 });
class JsonPositionError extends Error {
    offset;
    constructor(offset) { super("malformed JSON"); this.offset = offset; }
}
function driveJson(steps, charge) { for (;;) {
    const next = steps.next();
    if (next.done)
        return next.value;
    charge(next.value);
} }
class Parser {
    #i = 0;
    #depth = 0;
    s;
    json5;
    charge;
    constructor(s, json5, charge) { this.s = s; this.json5 = json5; this.charge = charge; }
    fail(at = this.#i) { throw new JsonPositionError(at); }
    *parse() { (yield* this.ws()); const n = (yield* this.value()); (yield* this.ws(true)); if (this.#i !== this.s.length && this.s[this.#i] !== "\0")
        this.fail(0); return n; }
    // json.c:json5Whitespace. The UTF8 2/3-byte cases become exact UTF16
    // codepoints, not JS \s (which has a different character set).
    spaceAt(at) {
        const c = this.s.charCodeAt(at);
        return (c >= 9 && c <= 13) || c === 32 || c === 0xa0 || c === 0x1680 ||
            (c >= 0x2000 && c <= 0x200a) || c === 0x2028 || c === 0x2029 ||
            c === 0x202f || c === 0x205f || c === 0x3000 || c === 0xfeff;
    }
    *ws(trailing = false) {
        const entry = this.#i;
        let nextCheck = this.#i + 256;
        for (;;) {
            if (this.#i >= nextCheck) {
                nextCheck = this.#i + 256;
                yield 1;
            }
            const c = this.s.charCodeAt(this.#i);
            if (c === 9 || c === 10 || c === 13 || c === 32) {
                this.#i++;
                continue;
            }
            if (this.#i >= this.s.length && this.#i > entry && !trailing)
                this.fail(entry);
            if (!this.json5)
                return;
            if (this.spaceAt(this.#i)) {
                this.#i++;
                continue;
            }
            if (c !== 47)
                return;
            const start = this.#i;
            if (this.s[start + 1] === '*' && this.s[start + 2] !== undefined && this.s[start + 2] !== '\0') {
                // Source commits n only after finding */. An incomplete block is not
                // whitespace: retain the slash cursor for the caller's error owner.
                let j = start + 3;
                while (this.s[j] !== '/' || this.s[j - 1] !== '*') {
                    if (j >= this.s.length || this.s[j] === '\0')
                        return;
                    if (j >= nextCheck) {
                        nextCheck = j + 256;
                        yield 1;
                    }
                    j++;
                }
                this.#i = j + 1;
                continue;
            }
            if (this.s[start + 1] === '/') {
                let j = start + 2;
                for (; j < this.s.length && this.s[j] !== '\0'; j++) {
                    const d = this.s.charCodeAt(j);
                    if (d === 10 || d === 13 || d === 0x2028 || d === 0x2029)
                        break;
                    if (j >= nextCheck) {
                        nextCheck = j + 256;
                        yield 1;
                    }
                }
                // C skips two continuation bytes for a Unicode terminator before
                // its final increment; one complete codepoint here.
                this.#i = j + (j < this.s.length && this.s[j] !== '\0' ? 1 : 0);
                continue;
            }
            return;
        }
    }
    // Container depth matches jsonTranslateTextToBlob: scalar leaves do not consume a level.
    *value() { yield 1; (yield* this.ws()); const c = this.s[this.#i]; if (c === undefined || c === "\0")
        this.fail(this.#i); const container = c === "[" || c === "{"; if (container && ++this.#depth > 1000)
        this.fail(); let n; if (c === '"' || (this.json5 && c === "'")) {
        const start = this.#i;
        n = { kind: "string", value: (yield* this.str()) };
        const encoding = (yield* this.stringEncoding(start));
        jsonStringEncoding.set(n, encoding);
        jsonStringSpelling.set(n, (yield* translateStringSteps(encoding)));
    }
    else if (c === "[")
        n = (yield* this.array());
    else if (c === "{")
        n = (yield* this.object());
    else if (c !== undefined && /[0-9+.-]/.test(c))
        n = (yield* this.numeric());
    else {
        n = (yield* this.literal());
    } if (container)
        this.#depth--; return n; }
    /** jsonTranslateTextToBlob literal/default dispatch and aNanInfName order. */
    *literal() {
        const i = this.#i, z = this.s, c = z[i];
        const alnum = (c) => c !== undefined && ((c >= '0' && c <= '9') || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z'));
        const word = c === 't' ? 'true' : c === 'f' ? 'false' : c === 'n' ? 'null' : undefined;
        if (word && z.startsWith(word, i) && !alnum(z[i + word.length])) {
            this.#i = i + word.length;
            return { kind: word };
        }
        // t/f fail directly; only lowercase n falls through to the name table.
        if (c === 't' || c === 'f')
            this.fail(i);
        for (const [name, type] of [['inf', 'float'], ['infinity', 'float'], ['nan', 'null'], ['qnan', 'null'], ['snan', 'null']]) {
            if (c !== name[0] && c !== name[0].toUpperCase())
                continue;
            if (z.slice(i, i + name.length).toLowerCase() !== name || alnum(z[i + name.length]))
                continue;
            if (!this.json5)
                this.fail(i);
            this.#i = i + name.length;
            return type === 'float' ? { kind: 'number', raw: '9e999', json5: false } : { kind: 'null' };
        }
        this.fail(i);
    }
    /** Pinned jsonTranslateTextToBlob numeric production and error offsets. */
    *numeric() {
        const i = this.#i, z = this.s, digit = (c) => c !== undefined && c >= '0' && c <= '9', hex = (c) => c !== undefined && /[0-9a-fA-F]/.test(c);
        let j = i + 1, t = 0, seenE = false, finish = false;
        const c = z[i];
        if (c === '+')
            t = 1;
        if (c === '.') {
            if (!digit(z[i + 1]))
                this.fail(i);
            t = 3;
        }
        else if (c <= '0') {
            if (c === '0') {
                if ((z[i + 1] === 'x' || z[i + 1] === 'X') && hex(z[i + 2])) {
                    t = 1;
                    j = i + 3;
                    finish = true;
                }
                else if (digit(z[i + 1]))
                    this.fail(i + 1);
            }
            else {
                if (!digit(z[i + 1])) {
                    if (z.slice(i + 1, i + 4).toLowerCase() === 'inf') {
                        if (!this.json5)
                            this.fail(i);
                        this.#i = i + (z.slice(i + 4, i + 9).toLowerCase() === 'inity' ? 9 : 4);
                        return { kind: 'number', raw: c === '-' ? '-9e999' : '9e999', json5: false };
                    }
                    if (z[i + 1] === '.')
                        t |= 1;
                    else
                        this.fail(i);
                }
                else if (z[i + 1] === '0') {
                    if (digit(z[i + 2]))
                        this.fail(i + 1);
                    if ((z[i + 2] === 'x' || z[i + 2] === 'X') && hex(z[i + 3])) {
                        t |= 1;
                        j = i + 4;
                        finish = true;
                    }
                }
            }
        }
        if (finish) {
            while (hex(z[j])) {
                if ((j & 255) === 0)
                    yield 1;
                j++;
            }
        }
        else {
            for (;; j++) {
                if ((j & 255) === 0)
                    yield 1;
                const c = z[j];
                if (digit(c))
                    continue;
                if (c === '.') {
                    if (t & 2)
                        this.fail(j);
                    t |= 2;
                    continue;
                }
                if (c === 'e' || c === 'E') {
                    if (z[j - 1] < '0') {
                        if (z[j - 1] === '.' && j - 2 >= i && digit(z[j - 2]))
                            t |= 1;
                        else
                            this.fail(j);
                    }
                    if (seenE)
                        this.fail(j);
                    t |= 2;
                    seenE = true;
                    if (z[j + 1] === '+' || z[j + 1] === '-')
                        j++;
                    if (!digit(z[j + 1]))
                        this.fail(j);
                    continue;
                }
                break;
            }
            if (z[j - 1] < '0') {
                if (z[j - 1] === '.' && j - 2 >= i && digit(z[j - 2]))
                    t |= 1;
                else
                    this.fail(j);
            }
        }
        if ((t & 1) && !this.json5)
            this.fail(i);
        this.#i = j;
        return { kind: 'number', raw: z.slice(c === '+' ? i + 1 : i, j), json5: (t & 1) !== 0 };
    }
    #stringEncoding;
    *stringEncoding(_start) { return this.#stringEncoding; }
    /** jsonTranslateTextToBlob parse_string: one admission/tag/cursor owner. */
    *str() {
        const start = this.#i, q = this.s[this.#i++], out = [];
        let type = 7, nextCheck = this.#i;
        const nonstd = (at) => { if (!this.json5)
            this.fail(at); type = 9; };
        if (q === "'" && !this.json5)
            this.fail(start);
        // Single-quote syntax is nonstandard but does not itself change the tag.
        for (;;) {
            if (this.#i >= nextCheck) {
                nextCheck = this.#i + 256;
                yield 1;
            }
            const at = this.#i, c = this.s[at];
            if (c === q) {
                this.#i++;
                this.#stringEncoding = { type, raw: this.s.slice(start + 1, at) };
                return out.join("");
            }
            if (c === undefined || c === '\0')
                this.fail(at);
            if (c === '\\') {
                this.#i++;
                const escapeAt = this.#i, e = this.s[this.#i];
                const simple = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
                if (e !== undefined && Object.hasOwn(simple, e)) {
                    if (type === 7)
                        type = 8;
                    out.push(simple[e]);
                    this.#i++;
                    continue;
                }
                if (e === 'u') {
                    const h = this.s.slice(this.#i + 1, this.#i + 5);
                    if (!/^[0-9a-fA-F]{4}$/.test(h))
                        this.fail(escapeAt);
                    if (type === 7)
                        type = 8;
                    out.push(String.fromCharCode(parseInt(h, 16)));
                    this.#i += 5;
                    continue;
                }
                if (e === "'" || e === 'v' || e === '\n' || e === '\r' || e === '\u2028' || e === '\u2029') {
                    nonstd(escapeAt);
                    this.#i++;
                    if (e === "'")
                        out.push("'");
                    else if (e === 'v')
                        out.push('\v');
                    else if (e === '\r' && this.s[this.#i] === '\n')
                        this.#i++;
                    continue;
                }
                if (e === '0' && !/[0-9]/.test(this.s[this.#i + 1] ?? '')) {
                    nonstd(escapeAt);
                    out.push('\0');
                    this.#i++;
                    continue;
                }
                if (e === 'x' && /^[0-9a-fA-F]{2}$/.test(this.s.slice(this.#i + 1, this.#i + 3))) {
                    nonstd(escapeAt);
                    out.push(String.fromCharCode(parseInt(this.s.slice(this.#i + 1, this.#i + 3), 16)));
                    this.#i += 3;
                    continue;
                }
                this.fail(escapeAt);
            }
            if (c.charCodeAt(0) < 32)
                nonstd(at);
            else if (c === '"')
                type = 9;
            out.push(c);
            this.#i++;
        }
    }
    *array() { this.#i++; const values = []; (yield* this.ws()); if (this.s[this.#i] === "]") {
        this.#i++;
        return { kind: "array", values };
    } for (;;) {
        values.push((yield* this.value()));
        (yield* this.ws());
        if (this.s[this.#i] === "]") {
            this.#i++;
            return { kind: "array", values };
        }
        if (this.s[this.#i] !== ",")
            this.fail();
        this.#i++;
        (yield* this.ws());
        if (this.s[this.#i] === "]") {
            if (!this.json5)
                this.fail();
            this.#i++;
            return { kind: "array", values };
        }
    } }
    objectResult(entries, spellings, encodings) { const n = { kind: "object", entries }; jsonObjectLabelSpelling.set(n, spellings); jsonbLabelEncodings.set(n, encodings ?? spellings.map(raw => ({ type: raw.includes("\\") ? 8 : 7, payload: te.encode(raw.slice(1, -1)) }))); return n; }
    // jsonTranslateTextToBlob object fallback: jsonIs4HexB changes the label
    // encoding but the source scans each byte (including the escape's letters).
    *label() {
        const start = this.#i;
        let type = 7;
        const escaped = (at) => this.s[at] === '\\' && this.s[at + 1] === 'u' && [2, 3, 4, 5].every(n => { const c = this.s.charCodeAt(at + n); return (c >= 48 && c <= 57) || (c >= 65 && c <= 70) || (c >= 97 && c <= 102); });
        const id = (at, first) => { const c = this.s.charCodeAt(at); return (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 36 || c === 95 || (!first && c >= 48 && c <= 57) || (c >= 128 && !this.spaceAt(at)); };
        if (!id(this.#i, true) && !escaped(this.#i))
            this.fail();
        if (escaped(this.#i))
            type = 8;
        this.#i++;
        while (id(this.#i, false) || escaped(this.#i)) {
            if (escaped(this.#i))
                type = 8;
            if ((this.#i & 255) === 0)
                yield 1;
            this.#i++;
        }
        return { type, raw: this.s.slice(start, this.#i) };
    }
    *object() {
        this.#i++;
        const entries = [], spellings = [], encodings = [];
        (yield* this.ws());
        if (this.s[this.#i] === "}") {
            this.#i++;
            return this.objectResult(entries, spellings, encodings);
        }
        for (;;) {
            (yield* this.ws());
            let key;
            let unquoted;
            const labelStart = this.#i, c = this.s[this.#i];
            if (c === '"' || (this.json5 && c === "'"))
                key = (yield* this.str());
            else if (this.json5) {
                // C first parses a value; a successful non-TEXT producer cannot be a label.
                let produced = false;
                try {
                    yield* this.value();
                    produced = true;
                }
                catch (error) {
                    if (!(error instanceof JsonPositionError))
                        throw error;
                }
                this.#i = labelStart;
                if (produced)
                    this.fail(labelStart);
                unquoted = (yield* this.label());
                key = unquoted.type === 8 ? (yield* new Parser('"' + unquoted.raw + '"', true, this.charge).str()) : unquoted.raw;
            }
            else
                this.fail();
            const encoding = (c === '"' || c === "'") ? (yield* this.stringEncoding(labelStart)) : unquoted;
            encodings.push({ type: encoding.type, payload: te.encode(encoding.raw) });
            const label = (c === '"' || c === "'") ? (yield* translateStringSteps(encoding)) : unquoted.type === 8 ? (yield* translateStringSteps(unquoted)) : (yield* quoteSteps(key));
            spellings.push(label);
            (yield* this.ws());
            if (this.s[this.#i] !== ":") {
                const at = this.#i;
                yield* this.value();
                this.fail(at);
            }
            this.#i++;
            entries.push([key, (yield* this.value())]);
            (yield* this.ws());
            if (this.s[this.#i] === "}") {
                this.#i++;
                return this.objectResult(entries, spellings, encodings);
            }
            if (this.s[this.#i] !== ",")
                this.fail();
            this.#i++;
            (yield* this.ws());
            if (this.s[this.#i] === "}") {
                if (!this.json5)
                    this.fail();
                this.#i++;
                return this.objectResult(entries, spellings, encodings);
            }
        }
    }
}
function quote(s, charge = () => { }) { return driveJson(quoteSteps(s), charge); }
function* quoteSteps(s) { let out = '"', index = 0; for (const c of s) {
    if ((index++ & 255) === 0)
        yield 1;
    const n = c.charCodeAt(0);
    out += c === '"' ? '\\"' : c === '\\' ? '\\\\' : c === '\b' ? '\\b' : c === '\f' ? '\\f' : c === '\n' ? '\\n' : c === '\r' ? '\\r' : c === '\t' ? '\\t' : n < 0x20 ? `\\u${n.toString(16).padStart(4, "0")}` : c;
} return out + '"'; }
function renderObjectLabel(n, i, key) {
    const label = jsonbLabelEncodings.get(n)?.[i];
    return label ? driveJson(translateStringSteps({ type: label.type, raw: td.decode(label.payload) }), () => { }) : quote(key);
}
export function renderJson(n) { switch (n.kind) {
    case "null":
    case "true":
    case "false": return n.kind;
    case "number": return renderNumeric(nodeNumber(n));
    case "string": return jsonStringSpelling.get(n) ?? quote(n.value);
    case "array": return `[${n.values.map(renderJson).join(",")}]`;
    case "object": return `{${n.entries.map(([k, v], i) => `${jsonObjectLabelSpelling.get(n)?.[i] ?? renderObjectLabel(n, i, k)}:${renderJson(v)}`).join(",")}}`;
} }
/** json.c:jsonTranslateBlobToText TEXT/TEXTJ/TEXT5/TEXTRAW branches. */
function translateStringEncoding(e, charge = () => { }) { return driveJson(translateStringSteps(e), charge); }
function* translateStringSteps(e) {
    if (e.type === 7 || e.type === 10)
        return yield* quoteSteps(e.raw);
    if (e.type === 8)
        return '"' + e.raw + '"';
    let out = '"', nextCheck = 0;
    for (let i = 0; i < e.raw.length; i++) {
        while (i >= nextCheck) {
            nextCheck += 256;
            yield 1;
        }
        const c = e.raw[i];
        if (c !== "\\") {
            if (c.charCodeAt(0) < 32)
                out += (yield* quoteSteps(c)).slice(1, -1);
            else
                out += c === '"' ? '\\"' : c;
            continue;
        }
        const next = e.raw[++i];
        if (next === undefined)
            throw malformed();
        if (next === "'")
            out += "'";
        else if (next === 'v')
            out += '\\u000b';
        else if (next === '0')
            out += '\\u0000';
        else if (next === 'x') {
            const h = e.raw.slice(i + 1, i + 3);
            if (!/^[0-9a-fA-F]{2}$/.test(h))
                throw malformed();
            out += '\\u00' + h;
            i += 2;
        }
        else if (next === '\n' || next === '\u2028' || next === '\u2029') { }
        else if (next === '\r') {
            if (e.raw[i + 1] === '\n')
                i++;
        }
        else if (next === 'u' || '"\\/bfnrt'.includes(next))
            out += '\\' + next;
        else
            throw malformed();
    }
    return out + '"';
}
/** Ordered nodes replace JSONB offsets. Temporary retention is reserved before
 * conversion, and released in finally; chunks bound encoding and yielded work. */
export async function jsonPretty(value, indent, control) {
    const out = new Mem();
    if (value.initialStorageClass === "null")
        return out;
    let reserved = 0;
    const reserve = (bytes) => { control.reserve(bytes); reserved += bytes; };
    const chunks = (s) => ({ *[Symbol.iterator]() { for (let i = 0; i < s.length;) {
            let end = Math.min(i + 256, s.length);
            if (end < s.length && s.charCodeAt(end - 1) >= 0xd800 && s.charCodeAt(end - 1) <= 0xdbff)
                end--;
            yield s.slice(i, end);
            i = end;
        } } });
    try {
        // Conservative logical arena: source/decoded/lexical strings and per-character
        // worst-case node/entry overhead. Not a measurement of native or JS heap bytes.
        const sourceBytes = value.initialStorageClass === "blob" ? value.blobValue().length : value.initialStorageClass === "text" ? value.textBytes().length : 32;
        reserve(sourceBytes * 128 + 256);
        for (let i = 0; i < sourceBytes; i += 256)
            await control.checkpoint(1);
        let node;
        if (value.initialStorageClass === "blob" && jsonArgIsJsonb(value.blobValue())) {
            node = binaryNode(value.blobValue().slice(), 0, 0, n => { control.charge(n); control.check(); });
        }
        else {
            const source = new Mem();
            source.copyFrom(value);
            source.cast("text", "utf-8");
            const steps = new Parser(source.textValue(), true, n => { control.charge(n); control.check(); }).parse();
            try {
                for (;;) {
                    const next = steps.next();
                    if (next.done) {
                        node = next.value;
                        break;
                    }
                    await control.checkpoint(next.value);
                }
            }
            catch (error) {
                if (error instanceof JsonPositionError)
                    throw malformed();
                throw error;
            }
        }
        const indentBytes = indent === undefined ? 4 : indent.initialStorageClass === "blob" ? indent.blobValue().length : indent.initialStorageClass === "text" ? indent.textBytes().length : 32;
        reserve(indentBytes * 8 + 128);
        for (let i = 0; i < indentBytes; i += 256)
            await control.checkpoint(1);
        const copy = new Mem();
        if (indent !== undefined)
            copy.copyFrom(indent);
        if (indent !== undefined && indent.initialStorageClass !== "null")
            copy.cast("text", "utf-8");
        const text = indent === undefined || indent.initialStorageClass === "null" ? "    " : copy.textValue();
        const nul = text.indexOf("\0"), zIndent = nul < 0 ? text : text.slice(0, nul);
        const parts = [];
        let bytes = 0;
        const append = async (s) => {
            for (const chunk of chunks(s)) {
                await control.checkpoint(1);
                // Bound before allocating UTF8. Actual length checked without whole-string encoding.
                let length = 0;
                for (const c of chunk) {
                    const n = c.codePointAt(0);
                    length += n < 128 ? 1 : n < 2048 ? 2 : n < 65536 ? 3 : 4;
                }
                control.checkSize(bytes + length);
                reserve(length + 64);
                parts.push(te.encode(chunk));
                bytes += length;
            }
        };
        const indentation = async (depth) => { for (let i = 0; i < depth; i++)
            await append(zIndent); };
        const visit = async (n, depth) => {
            await control.checkpoint(1);
            if (n.kind !== "array" && n.kind !== "object") {
                if (n.kind === "string")
                    await append(jsonStringSpelling.get(n) ?? quote(n.value));
                else
                    await append(renderJson(n));
                return;
            }
            const object = n.kind === "object", length = object ? n.entries.length : n.values.length;
            await append(object ? "{" : "[");
            if (length) {
                if (depth + 1 >= 1000)
                    throw new JSQLiteError("sqlite", "JSON nested too deep", { code: 1 });
                await append("\n");
                for (let i = 0; i < length; i++) {
                    await indentation(depth + 1);
                    if (n.kind === "object") {
                        await append(jsonObjectLabelSpelling.get(n)?.[i] ?? quote(n.entries[i][0]));
                        await append(": ");
                        await visit(n.entries[i][1], depth + 1);
                    }
                    else
                        await visit(n.values[i], depth + 1);
                    if (i + 1 < length)
                        await append(",\n");
                }
                await append("\n");
                await indentation(depth);
            }
            await append(object ? "}" : "]");
        };
        // jsonTranslateBlobToPrettyText: container positioning uses byte extents;
        // scalar and object-label publication shares jsonTranslateBlobToText.
        const appendRaw = async (raw) => {
            for (let i = 0; i < raw.length; i += 256) {
                await control.checkpoint(1);
                const part = raw.slice(i, i + 256);
                control.checkSize(bytes + part.length);
                reserve(part.length + 64);
                parts.push(part);
                bytes += part.length;
            }
        };
        const span = jsonBinarySpans.get(node);
        const visitBinary = async (at, depth) => {
            await control.checkpoint(1);
            const b = span.bytes, h = binaryPayloadSize(b, at);
            if (!h)
                throw malformed();
            const start = at + h.header, end = start + h.size;
            const scalar = async (pos, renderDepth = depth) => {
                // Like jsonTranslateBlobToPrettyText, forward the plain renderer's actual
                // cursor, not the declared extent. It renders against the whole parse;
                // labels may be containers and NULL/TRUE/FALSE consume only one byte.
                const { value, next } = jsonBlobTextAt(b, pos, renderDepth, n => { control.charge(n); control.check(); });
                try {
                    await appendRaw(value.textBytes());
                }
                finally {
                    value.release();
                }
                return next;
            };
            if (h.type !== 11 && h.type !== 12)
                return scalar(at);
            const object = h.type === 12;
            await append(object ? "{" : "[");
            let j = start;
            if (j < end) {
                if (depth + 1 >= 1000)
                    throw new JSQLiteError("sqlite", "JSON nested too deep", { code: 1 });
                await append("\n");
                for (;;) {
                    await indentation(depth + 1);
                    if (object) {
                        j = await scalar(j, depth + 1);
                        if (j > end)
                            throw malformed();
                        await append(": ");
                    }
                    j = await visitBinary(j, depth + 1);
                    if (j >= end)
                        break;
                    await append(",\n");
                }
                await append("\n");
                await indentation(depth);
            }
            await append(object ? "}" : "]");
            return end;
        };
        if (span)
            await visitBinary(span.at, 0);
        else
            await visit(node, 0);
        reserve(bytes * 2);
        const result = new Uint8Array(bytes);
        let offset = 0;
        for (const part of parts) {
            await control.checkpoint(1);
            result.set(part, offset);
            offset += part.length;
        }
        out.setText(result, "utf-8");
        return out;
    }
    catch (error) {
        if (error instanceof JsonPositionError)
            throw malformed();
        throw error;
    }
    finally {
        control.release(reserved);
    }
}
function header(type, size) { if (size <= 11)
    return Uint8Array.of((size << 4) | type); if (size <= 255)
    return Uint8Array.of(0xc0 | type, size); if (size <= 65535)
    return Uint8Array.of(0xd0 | type, size >>> 8, size & 255); return Uint8Array.of(0xe0 | type, (size / 0x1000000) >>> 0, (size >>> 16) & 255, (size >>> 8) & 255, size & 255); }
function join(parts) { const n = parts.reduce((x, p) => x + p.length, 0), out = new Uint8Array(n); let i = 0; for (const p of parts) {
    out.set(p, i);
    i += p.length;
} return out; }
function element(type, payload = new Uint8Array()) { return join([header(type, payload.length), payload]); }
export function encodeJsonb(n) { return jsonbOriginal.get(n) ?? encodeJsonbNode(n); }
function encodeJsonbNode(n) { switch (n.kind) {
    case "null": return element(0);
    case "true": return element(1);
    case "false": return element(2);
    case "number": {
        const e = nodeNumber(n);
        return e === null ? element(0) : element(e.type, te.encode(e.raw));
    }
    case "string": {
        const e = jsonStringEncoding.get(n);
        return element(e?.type ?? 7, te.encode(e?.raw ?? n.value));
    }
    case "array": return element(11, join(n.values.map(encodeJsonb)));
    case "object": {
        const labels = jsonbLabelEncodings.get(n);
        return element(12, join(n.entries.flatMap(([k, v], i) => { const label = labels?.[i]; return [element(label?.type ?? 7, label?.payload ?? te.encode(k)), encodeJsonb(v)]; })));
    }
} }
function jsonbSize(b, at = 0) { if (at >= b.length)
    return null; const x = b[at], tag = x >>> 4, type = x & 15; let header = 1, size = tag; if (tag >= 12) {
    header = tag === 12 ? 2 : tag === 13 ? 3 : tag === 14 ? 5 : 9;
    if (at + header > b.length)
        return null;
    size = 0;
    for (let i = 1; i < header; i++) {
        size = size * 256 + b[at + i];
        if (!Number.isSafeInteger(size))
            return null;
    }
} return { size, type, header }; }
function decodePayload(b, start, end) { try {
    return td.decode(b.subarray(start, end));
}
catch {
    throw malformed();
} }
function decodeJsonbAt(b, at, depth, charge) { return driveJson(decodeJsonbSteps(b, at, depth, charge), charge); }
function* decodeJsonbSteps(b, at, depth, charge) {
    yield 1;
    if (depth > 1000)
        throw malformed();
    const h = jsonbSize(b, at);
    if (!h || h.type > 12 || at + h.header + h.size > b.length)
        throw malformed();
    const start = at + h.header, end = start + h.size, raw = h.type <= 10 ? decodePayload(b, start, end) : "";
    if (h.type <= 2) {
        if (h.size)
            throw malformed();
        const node = { kind: h.type === 0 ? "null" : h.type === 1 ? "true" : "false" };
        jsonbOriginal.set(node, b.slice(at, end));
        jsonbBounds.set(node, { start: at, end });
        return { node, end };
    }
    if (h.type >= 3 && h.type <= 6) {
        const node = { kind: "number", raw, json5: h.type === 4 || h.type === 6, numericType: h.type };
        jsonbOriginal.set(node, b.slice(at, end));
        jsonbBounds.set(node, { start: at, end });
        return { node, end };
    }
    if (h.type >= 7 && h.type <= 10) {
        let value;
        if (h.type === 7 || h.type === 10)
            value = raw;
        else {
            const node = (yield* new Parser(`"${raw}"`, h.type === 9, charge).parse());
            if (node.kind !== "string")
                throw malformed();
            value = node.value;
        }
        const node = { kind: "string", value };
        const encoding = { type: h.type, raw };
        jsonStringEncoding.set(node, encoding);
        jsonStringSpelling.set(node, (yield* translateStringSteps(encoding)));
        jsonbOriginal.set(node, b.slice(at, end));
        jsonbBounds.set(node, { start: at, end });
        return { node, end };
    }
    const values = [], entries = [], labels = [], labelEncodings = [];
    let p = start, index = 0;
    while (p < end) {
        const childStart = p, child = (yield* decodeJsonbSteps(b, p, depth + 1, charge));
        p = child.end;
        if (h.type === 11)
            values.push(child.node);
        else if ((index++ & 1) === 0) {
            if (child.node.kind !== "string")
                throw malformed();
            const lh = jsonbSize(b, childStart);
            labels.push(jsonbBounds.get(child.node).start);
            labelEncodings.push({ type: lh.type, payload: b.slice(childStart + lh.header, child.end) });
            entries.push([child.node.value, { kind: "null" }]);
        }
        else
            entries[entries.length - 1] = [entries.at(-1)[0], child.node];
    }
    if (p !== end || (h.type === 12 && index % 2))
        throw malformed();
    const node = h.type === 11 ? { kind: "array", values } : { kind: "object", entries };
    jsonbOriginal.set(node, b.slice(at, end));
    jsonbBounds.set(node, { start: at, end });
    if (h.type === 12) {
        jsonbLabels.set(node, labels);
        jsonbLabelEncodings.set(node, labelEncodings);
        const spellings = [];
        for (const label of labelEncodings)
            spellings.push(yield* translateStringSteps({ type: label.type, raw: td.decode(label.payload) }));
        jsonObjectLabelSpelling.set(node, spellings);
    }
    return { node, end };
}
// json.c:jsonbValidityCheck: zero or absolute 1-based byte offset.
// Shared resumable owner: one checkpoint per reached element and per 256
// scalar payload bytes. Header probes and unescape lookahead are bounded.
// Async VM consumers await actual scheduler checkpoints; sync internal consumers
// drive exactly the same branches. TEXTRAW intentionally does not scan payload.
function* jsonbValiditySteps(b, i = 0, iEnd = b.length, depth = 1) {
    yield 1;
    if (depth > 1000)
        return i + 1;
    const h = jsonbSize(b, i);
    if (!h || i + h.header + h.size !== iEnd || iEnd > b.length)
        return i + 1;
    const x = h.type, n = h.header, sz = h.size, k = iEnd;
    let j = i + n, nextCheck = j + 256;
    const digit = (p) => b[p] !== undefined && b[p] >= 48 && b[p] <= 57;
    const hex = (p) => digit(p) || b[p] !== undefined && ((b[p] >= 65 && b[p] <= 70) || (b[p] >= 97 && b[p] <= 102));
    if (x <= 2)
        return n + sz === 1 ? 0 : i + 1;
    if (x === 3) {
        if (sz < 1)
            return i + 1;
        if (b[j] === 45) {
            j++;
            if (sz < 2)
                return i + 1;
        }
        for (; j < k; j++) {
            if (j >= nextCheck) {
                nextCheck = j + 256;
                yield 1;
            }
            if (!digit(j))
                return j + 1;
        }
        return 0;
    }
    if (x === 4) {
        if (sz < 3)
            return i + 1;
        if (b[j] === 45) {
            if (sz < 4)
                return i + 1;
            j++;
        }
        if (b[j] !== 48)
            return i + 1;
        if (b[j + 1] !== 120 && b[j + 1] !== 88)
            return j + 2;
        for (j += 2; j < k; j++) {
            if (j >= nextCheck) {
                nextCheck = j + 256;
                yield 1;
            }
            if (!hex(j))
                return j + 1;
        }
        return 0;
    }
    if (x === 5 || x === 6) {
        let seen = 0;
        if (sz < 2)
            return i + 1;
        if (b[j] === 45) {
            j++;
            if (sz < 3)
                return i + 1;
        }
        if (b[j] === 46) {
            if (x === 5 || !digit(j + 1))
                return j + 1;
            j += 2;
            seen = 1;
        }
        else if (b[j] === 48 && x === 5) {
            if (j + 3 > k || ![46, 101, 69].includes(b[j + 1]))
                return j + 1;
            j++;
        }
        for (; j < k; j++) {
            if (j >= nextCheck) {
                nextCheck = j + 256;
                yield 1;
            }
            if (digit(j))
                continue;
            if (b[j] === 46) {
                if (seen > 0 || x === 5 && (j === k - 1 || !digit(j + 1)))
                    return j + 1;
                seen = 1;
                continue;
            }
            if (b[j] === 101 || b[j] === 69) {
                if (seen === 2 || j === k - 1)
                    return j + 1;
                if (b[j + 1] === 43 || b[j + 1] === 45) {
                    j++;
                    if (j === k - 1)
                        return j + 1;
                }
                seen = 2;
                continue;
            }
            return j + 1;
        }
        return seen === 0 ? i + 1 : 0;
    }
    if (x >= 7 && x <= 9) {
        for (; j < k; j++) {
            if (j >= nextCheck) {
                nextCheck = j + 256;
                yield 1;
            }
            const c = b[j];
            if (c > 31 && c !== 34 && c !== 92)
                continue;
            if (x === 7)
                return j + 1;
            if (c === 34 || c <= 31) {
                if (x === 8)
                    return j + 1;
                continue;
            }
            if (j + 1 >= k)
                return j + 1;
            const e = b[j + 1];
            if ([34, 92, 47, 98, 102, 110, 114, 116, 0].includes(e)) {
                j++;
                continue;
            }
            if (e === 117) {
                if (j + 5 >= k || ![2, 3, 4, 5].every(d => hex(j + d)))
                    return j + 1;
                j++;
                continue;
            }
            if (x !== 9)
                return j + 1;
            const consumed = yield* jsonbUnescapeLengthSteps(b, j, k);
            if (consumed === 0)
                return j + 1;
            j += consumed - 1;
        }
        return 0;
    }
    if (x === 10)
        return 0;
    if (x === 11 || x === 12) {
        let count = 0;
        while (j < k) {
            const child = jsonbSize(b, j);
            if (!child || j + child.header + child.size > k)
                return j + 1;
            if (x === 12 && (count & 1) === 0 && (child.type < 7 || child.type > 10))
                return j + 1;
            const error = yield* jsonbValiditySteps(b, j, j + child.header + child.size, depth + 1);
            if (error)
                return error;
            j += child.header + child.size;
            count++;
        }
        return x === 12 && (count & 1) !== 0 ? j + 1 : 0;
    }
    return i + 1;
}
// json.c:jsonUnescapeOneChar/jsonBytesToBypass. Project length and invalid
// status only; do not validate hex here: native conversion masks each nibble.
// The outer jsonbValidityCheck Unicode branch independently checks four hex.
function* jsonbUnescapeLengthSteps(b, j, k) {
    if (j + 1 >= k)
        return 0;
    const c = b[j + 1];
    if (c === 117) {
        if (j + 6 > k)
            return 0;
        const nibble = (p) => { const h = b[p]; return (h + 9 * (1 & (h >> 6))) & 15; };
        const word = (p) => (nibble(p) << 12) + (nibble(p + 1) << 8) + (nibble(p + 2) << 4) + nibble(p + 3);
        const high = word(j + 2);
        return (high & 0xfc00) === 0xd800 && j + 12 <= k && b[j + 6] === 92 && b[j + 7] === 117 && (word(j + 8) & 0xfc00) === 0xdc00 ? 12 : 6;
    }
    if ([98, 102, 110, 114, 116, 118, 39, 34, 47, 92].includes(c))
        return 2;
    if (c === 48)
        return j + 2 < k && b[j + 2] >= 48 && b[j + 2] <= 57 ? 0 : 2;
    if (c === 120)
        return j + 4 <= k ? 4 : 0;
    if (c !== 10 && c !== 13 && c !== 226)
        return 0;
    // jsonBytesToBypass can consume the whole scalar. Suspend within that scan,
    // not just at its outer caller; preserve j as the first invalid escape offset.
    let p = j, nextCheck = j + 256;
    while (p + 1 < k && b[p] === 92) {
        if (p >= nextCheck) {
            nextCheck = p + 256;
            yield 1;
        }
        if (b[p + 1] === 10) {
            p += 2;
            continue;
        }
        if (b[p + 1] === 13) {
            p += p + 2 < k && b[p + 2] === 10 ? 3 : 2;
            continue;
        }
        if (b[p + 1] === 226 && p + 3 < k && b[p + 2] === 128 && (b[p + 3] === 168 || b[p + 3] === 169)) {
            p += 4;
            continue;
        }
        break;
    }
    if (p === j)
        return 0;
    if (p === k)
        return p - j;
    if (b[p] === 92) {
        const len = yield* jsonbUnescapeLengthSteps(b, p, k);
        return len ? p - j + len : 0;
    }
    // utf.c:sqlite3Utf8ReadLimited consumes at most four bytes, even when a
    // malformed lead is followed by more continuation bytes. No UTF-8 rejection.
    let q = p + 1;
    if (b[p] >= 192)
        while (q < Math.min(k, p + 4) && (b[q] & 192) === 128)
            q++;
    return q - j;
}
/** src/json.c:jsonArgIsJsonb, including tag-20240123-a. Small BLOBs whose
 * leading byte can also begin text JSON require deep validation before they
 * are classified as JSONB; otherwise document arguments fall through to text. */
function jsonArgIsJsonb(b, charge = () => { }) { return driveJson(jsonArgIsJsonbSteps(b), charge); }
// Ambiguous admission checks at most seven payload bytes upstream; sharing
// the generator also preserves that ordered classification before flags4.
function* jsonArgIsJsonbSteps(b) { if (b.length === 0)
    return false; const h = jsonbSize(b, 0); if (!h || h.type > 12 || h.header + h.size !== b.length || (h.type <= 2 && h.size !== 0))
    return false; const c = b[0], ambiguous = c === 0x7b || c === 0x5b || (c >= 0x30 && c <= 0x39); return h.size > 7 || !ambiguous || (yield* jsonbValiditySteps(b)) === 0; }
// jsonParseFuncArg admits spans; header/skip/convert/render are distinct consumers.
function binaryPayloadSize(b, at) { const h = jsonbSize(b, at); return h && at + h.header + h.size <= b.length ? h : null; }
const jsonLookupPositions = new WeakMap();
const jsonBinarySpans = new WeakMap();
function binaryNode(bytes, at, depth, charge) {
    let decoded;
    const node = new Proxy({}, { get(_target, key) {
            if (!decoded) {
                decoded = decodeJsonbAt(bytes, at, depth, charge).node;
                const labels = jsonbLabelEncodings.get(decoded);
                if (labels)
                    jsonbLabelEncodings.set(node, labels);
                const spelling = jsonStringSpelling.get(decoded);
                if (spelling !== undefined)
                    jsonStringSpelling.set(node, spelling);
                const encoding = jsonStringEncoding.get(decoded);
                if (encoding)
                    jsonStringEncoding.set(node, encoding);
                const objectSpelling = jsonObjectLabelSpelling.get(decoded);
                if (objectSpelling)
                    jsonObjectLabelSpelling.set(node, objectSpelling);
            }
            return Reflect.get(decoded, key);
        } });
    jsonBinarySpans.set(node, { bytes, at, depth, charge });
    const h = jsonbSize(bytes, at);
    if (h) {
        jsonbOriginal.set(node, bytes.slice(at, at + h.header + h.size));
        jsonbBounds.set(node, { start: at, end: at + h.header + h.size });
    }
    return node;
}
function binaryArrayCount(b, at, charge) { return driveJson(binaryArrayCountSteps(b, at), charge); }
function* binaryArrayCountSteps(b, at) {
    const h = binaryPayloadSize(b, at);
    if (!h)
        return 0;
    let p = at + h.header, k = 0, n = h.header;
    const end = p + h.size;
    while (n > 0 && p < end) {
        yield 1;
        const c = binaryPayloadSize(b, p);
        n = c?.header ?? 0;
        p += (c?.size ?? 0) + n;
        k++;
    }
    return k;
}
// jsonLookupStep returns at kk==0 before decoding the selected header.
function* binaryLookupSteps(span, path) {
    const { bytes: b, charge } = span;
    let at = span.at, depth = span.depth, i = 1, id = span.at;
    const ancestors = [];
    while (i < path.length) {
        yield 1;
        const type = (b[at] ?? 0) & 15;
        if (path[i] === "[" && type !== 11)
            return undefined;
        const length = path[i + 1] === "#" ? yield* binaryArrayCountSteps(b, at) : 0;
        const step = yield* pathStepSteps(path, i, length);
        if (!step)
            return undefined;
        const h = binaryPayloadSize(b, at);
        if (!h)
            throw malformed();
        let p = at + h.header;
        const end = p + h.size;
        if (step.part.kind === "key") {
            if (type !== 12)
                return undefined;
            let found = false;
            while (p < end) {
                yield 1;
                const label = binaryPayloadSize(b, p);
                if (!label || label.type < 7 || label.type > 10)
                    throw malformed();
                // jsonLookupStep requires room for a value even for an unmatched label.
                if (p + label.header + label.size >= end)
                    throw malformed();
                const payload = b.subarray(p + label.header, p + label.header + label.size), key = step.part.label;
                const raw = label.type === 7 || label.type === 10, rawKey = key.type === 7 || key.type === 10;
                const same = raw && rawKey ? yield* jsonRawLabelEqualSteps(payload, key.payload) : yield* jsonEscapedLabelEqualSteps(payload, raw, key.payload, rawKey);
                p += label.header + label.size;
                // Both scanned and matched values reject reserved tags and invalid headers.
                // Only a match checks its parent bound before descending; scanned spans
                // are checked by the loop-exit boundary, as in jsonLookupStep.
                if ((b[p] & 15) > 12)
                    throw malformed();
                const v = binaryPayloadSize(b, p);
                if (!v)
                    throw malformed();
                if (same) {
                    if (p + v.header + v.size > end)
                        throw malformed();
                    id = p - label.header - label.size;
                    found = true;
                    break;
                }
                p += v.header + v.size;
            }
            if (p > end)
                throw malformed();
            if (!found)
                return undefined;
        }
        else {
            let k = step.part.kind === "fromEnd" ? length - step.part.distance : step.part.index === "append" ? length : step.part.index;
            if (k < 0)
                return undefined;
            while (p < end && k > 0) {
                yield 1;
                const c = binaryPayloadSize(b, p);
                if (!c)
                    throw malformed();
                p += c.header + c.size;
                k--;
            }
            if (p > end)
                throw malformed();
            if (p === end || k > 0)
                return undefined;
            id = p;
        }
        if (++depth >= 1000)
            throw new JSQLiteError("sqlite", "JSON path too deep", { code: 1 });
        ancestors.push(at);
        at = p;
        i = step.next;
    }
    const node = binaryNode(b, at, depth, charge);
    jsonLookupPositions.set(node, { id, ancestors });
    return node;
}
export function parseJsonMem(value, json5 = true, charge = () => { }) { try {
    if (value.initialStorageClass === "null")
        throw malformed();
    if (value.initialStorageClass === "blob") {
        const b = value.blobValue();
        if (jsonArgIsJsonb(b)) {
            return binaryNode(b.slice(), 0, 0, charge);
        }
        return driveJson(new Parser(jsonSqlText(value), json5, charge).parse(), charge);
    }
    const text = new Mem();
    text.copyFrom(value);
    try {
        text.cast("text", "utf-8");
        return driveJson(new Parser(text.textValue(), json5, charge).parse(), charge);
    }
    finally {
        text.release();
    }
}
catch (error) {
    if (error instanceof JsonPositionError)
        throw malformed();
    throw error;
} }
export function jsonValid(value, flags, charge = () => { }) { return driveJson(jsonValidSteps(value, flags, charge), charge); }
async function driveJsonAsync(steps, checkpoint) { try {
    for (;;) {
        const next = steps.next();
        if (next.done)
            return next.value;
        await checkpoint(next.value);
    }
}
finally {
    steps.return(undefined);
} }
export function jsonValidAsync(value, flags, checkpoint) { return driveJsonAsync(jsonValidSteps(value, flags, () => { }), checkpoint); }
function* jsonValidSteps(value, flags, charge) {
    if (flags < 1 || flags > 15)
        throw new JSQLiteError("sqlite", "FLAGS parameter to json_valid() must be between 1 and 15", { code: 1 });
    if (value.initialStorageClass === "null")
        return null;
    try {
        if (value.initialStorageClass === "blob") {
            const b = value.blobValue();
            if (yield* jsonArgIsJsonbSteps(b)) {
                if ((flags & 4) !== 0)
                    return true;
                return (flags & 8) !== 0 && (yield* jsonbValiditySteps(b)) === 0;
            }
        }
        if ((flags & 3) === 0)
            return false;
        yield* new Parser(jsonSqlText(value), (flags & 2) !== 0, charge).parse();
        return true;
    }
    catch (error) {
        if (error instanceof JsonPositionError)
            return false;
        throw error;
    }
}
// jsonAppendString: copy ordinary bytes, escape only quote, backslash and
// controls. This is deliberately not UTF-8 decoding (labels may be malformed).
export async function appendJsonStringBytes(bytes, scratch, append, checkpoint) {
    await append(new Uint8Array([34]));
    const hex = "0123456789abcdef", chunk = Math.min(256, Math.floor(scratch.length / 6));
    if (chunk < 1)
        throw new JSQLiteError("internal", "JSON quote scratch too small");
    for (let start = 0; start < bytes.length; start += chunk) {
        await checkpoint();
        let used = 0;
        for (let i = start; i < Math.min(bytes.length, start + chunk); i++) {
            const b = bytes[i];
            if (b >= 32 && b !== 34 && b !== 92) {
                scratch[used++] = b;
                continue;
            }
            scratch[used++] = 92;
            const short = b === 8 ? 98 : b === 9 ? 116 : b === 10 ? 110 : b === 12 ? 102 : b === 13 ? 114 : b === 34 ? 34 : b === 92 ? 92 : 0;
            if (short)
                scratch[used++] = short;
            else {
                scratch[used++] = 117;
                scratch[used++] = 48;
                scratch[used++] = 48;
                scratch[used++] = hex.charCodeAt(b >> 4);
                scratch[used++] = hex.charCodeAt(b & 15);
            }
        }
        await append(scratch.subarray(0, used));
    }
    await append(new Uint8Array([34]));
}
export function quoteJsonBytes(bytes) {
    const parts = [te.encode('"')];
    let start = 0;
    for (let i = 0; i < bytes.length; i++) {
        const b = bytes[i];
        if (b >= 32 && b !== 34 && b !== 92)
            continue;
        parts.push(bytes.subarray(start, i));
        const short = { 8: "\\b", 9: "\\t", 10: "\\n", 12: "\\f", 13: "\\r", 34: '\\"', 92: "\\\\" };
        parts.push(te.encode(short[b] ?? `\\u00${b.toString(16).padStart(2, "0")}`));
        start = i + 1;
    }
    parts.push(bytes.subarray(start), te.encode('"'));
    return join(parts);
}
function renderJsonBytes(node) {
    const binary = jsonBinarySpans.get(node);
    if (binary) {
        const text = jsonBlobText(binary.bytes.slice(binary.at), binary.charge);
        try {
            return text.textBytes().slice();
        }
        finally {
            text.release();
        }
    }
    if (node.kind === "array")
        return join([te.encode("["), ...node.values.flatMap((v, i) => [...(i ? [te.encode(",")] : []), renderJsonBytes(v)]), te.encode("]")]);
    if (node.kind === "object") {
        const labels = jsonbLabelEncodings.get(node);
        return join([te.encode("{"), ...node.entries.flatMap(([k, v], i) => {
                const label = labels?.[i];
                const spelling = label ? (label.type === 10 ? quoteJsonBytes(label.payload) : label.type === 7 || label.type === 8 ? join([te.encode('"'), label.payload, te.encode('"')]) : te.encode(translateStringEncoding({ type: label.type, raw: td.decode(label.payload) }))) : te.encode(jsonObjectLabelSpelling.get(node)?.[i] ?? quote(k));
                return [...(i ? [te.encode(",")] : []), spelling, te.encode(":"), renderJsonBytes(v)];
            }), te.encode("}")]);
    }
    return te.encode(renderJson(node));
}
export function jsonTextResult(node) { const binary = jsonBinarySpans.get(node); if (binary)
    return jsonBlobText(binary.bytes.slice(binary.at), binary.charge); const out = new Mem(); out.setText(renderJsonBytes(node), "utf-8"); out.setSubtype(74); return out; }
/** JSONB is identified by its validated binary representation, not by the
 * JSON text subtype. In the pinned json.c registration, JSON_BLOB selects a
 * BLOB result while the SQLITE_RESULT_SUBTYPE flag is deliberately absent. */
export function jsonbResult(node) { const out = new Mem(); out.setBlob(encodeJsonb(node)); return out; }
function decodeJsonbUnchecked(b, at = 0, depth = 0) {
    const decoded = decodeJsonbAt(b, at, depth, () => { });
    return { node: decoded.node, next: decoded.end };
}
/** json.c:jsonAppendSqlValue. TEXT subtype is copied verbatim, not parsed;
 * ordinary TEXT is quoted by bytes. BLOB translation uses the shared JSONB
 * byte walker. All coercions are private owning copies. */
export function jsonAggregateValueBytes(value) {
    switch (value.initialStorageClass) {
        case "null": return te.encode("null");
        case "integer": return te.encode(value.integerValue().toString());
        // jsonAppendSqlValue's %!0.17g producer is shared with scalar constructors.
        case "real": return te.encode(sqliteQuoteReal(value.realValue()));
        case "blob":
        case "text": throw new JSQLiteError("internal", "JSON aggregate byte argument requires controlled production");
    }
}
/** jsonReturnStringAsBlob: completed bytes feed the direct aBlob producer. */
export async function jsonAggregateBlob(bytes, control) {
    return aggregateTextToBlob(bytes, control, "aggregate");
}
/** json.c:jsonAppendSqlValue classification used by scalar constructors. */
export function jsonNodeFromSqlValue(value) {
    switch (value.initialStorageClass) {
        case "null": return { kind: "null" };
        case "integer": return { kind: "number", raw: value.integerValue().toString(), json5: false };
        case "real": {
            const n = value.realValue();
            return { kind: "number", raw: sqliteQuoteReal(n), json5: false };
        }
        case "blob": {
            const b = value.blobValue();
            if (!jsonArgIsJsonb(b))
                throw new JSQLiteError("sqlite", "JSON cannot hold BLOB values", { code: 1 });
            return binaryNode(b.slice(), 0, 0, () => { });
        }
        case "text": {
            if (value.subtypeValue() === 74)
                return parseJsonMem(value, true);
            const copy = new Mem();
            copy.copyFrom(value);
            try {
                copy.cast("text", "utf-8");
                return binaryNode(element(10, copy.textBytes().slice()), 0, 0, () => { });
            }
            finally {
                copy.release();
            }
        }
    }
}
// Lazily initialize semantic error subclasses: index.ts imports JSON through
// the VM, so its public JSQLiteError binding is not initialized at module load.
let JsonPathError;
const badPath = (path) => {
    JsonPathError ??= class extends JSQLiteError {
        constructor(path) { super("sqlite", `bad JSON path: '${path}'`, { code: 1 }); }
    };
    return new JsonPathError(path);
};
let JsonArrayElementError;
const notArrayElement = () => {
    JsonArrayElementError ??= class extends JSQLiteError {
        constructor() { super("sqlite", "not an array element", { code: 1 }); }
    };
    return new JsonArrayElementError();
};
/** src/json.c:jsonLookupStep read-only branches. Object scans deliberately
 * return the first matching label, preserving SQLite's duplicate-key rule. */
export function jsonLookup(root, path, charge = () => { }) { return driveJson(jsonLookupSteps(root, path), charge); }
function* jsonLookupSteps(root, path) {
    const binary = jsonBinarySpans.get(root);
    if (binary) {
        if (!path.startsWith("$"))
            throw badPath(path);
        return yield* binaryLookupSteps(binary, path);
    }
    if (!path.startsWith("$"))
        throw badPath(path);
    let node = root, i = 1;
    while (i < path.length) {
        if (!node)
            return undefined;
        if (path[i] === "[" && node.kind !== "array")
            return undefined;
        const step = yield* pathStepSteps(path, i, node.kind === "array" ? node.values.length : 0);
        if (!step)
            return undefined;
        const part = step.part;
        i = step.next;
        if (part.kind === "key") {
            if (node.kind !== "object")
                return undefined;
            node = node.entries[yield* pathLabelIndexSteps(node, part)]?.[1];
        }
        else {
            if (node.kind !== "array")
                return undefined;
            const index = part.kind === "fromEnd" ? node.values.length - part.distance : part.index === "append" ? node.values.length : part.index;
            node = node.values[index];
        }
    }
    return node;
}
function nodeNumber(n) {
    if (n.numericType !== undefined)
        return { type: n.numericType, raw: n.raw };
    if (/NaN/.test(n.raw))
        return null;
    if (/Infinity/.test(n.raw))
        return { type: 5, raw: n.raw[0] === "-" ? "-9e999" : "9e999" };
    const raw = n.raw[0] === "+" ? n.raw.slice(1) : n.raw;
    if (/^-?0[xX]/.test(raw))
        return { type: 4, raw };
    const floating = /[.eE]/.test(raw), nonstandard = /^-?\./.test(raw) || /\.(?:[eE]|$)/.test(raw);
    return { type: floating ? (nonstandard ? 6 : 5) : 3, raw };
}
// jsonTranslateBlobToText: numeric rendering is not SQL numeric conversion.
function renderNumeric(e) {
    if (e === null)
        return "null";
    if (!e.raw.length)
        throw malformed();
    if (e.type === 3 || e.type === 5)
        return e.raw;
    if (e.type === 4) {
        let k = 2, sign = "";
        if (e.raw[0] === "-" || e.raw[0] === "+") {
            sign = e.raw[0] === "-" ? "-" : "";
            k++;
        }
        let u = 0n, overflow = false;
        for (; k < e.raw.length; k++) {
            if (!/[0-9a-fA-F]/.test(e.raw[k]))
                throw malformed();
            if (u >> 60n)
                overflow = true;
            else
                u = u * 16n + BigInt(parseInt(e.raw[k], 16));
        }
        return sign + (overflow ? "9.0e999" : u.toString());
    }
    let k = 0, out = "";
    if (e.raw[0] === "-") {
        out = "-";
        k++;
        if (k === e.raw.length)
            throw malformed();
    }
    if (e.raw[k] === ".")
        out += "0";
    for (; k < e.raw.length; k++) {
        out += e.raw[k];
        if (e.raw[k] === "." && !/[0-9]/.test(e.raw[k + 1] ?? ""))
            out += "0";
    }
    return out;
}
// jsonReturnFromBlob and util.c:sqlite3DecOrHexToI64 own scalar conversion.
function numericResult(n) {
    const out = new Mem(), e = nodeNumber(n);
    if (e === null)
        return out;
    if (!e.raw.length)
        throw malformed();
    if (e.type === 3 || e.type === 4) {
        const negative = e.raw[0] === "-", z = (negative ? e.raw.slice(1) : e.raw).split("\0", 1)[0];
        if (!z.length)
            throw malformed();
        let value = 0n, rc;
        if (/^0[xX]/.test(z)) {
            let i = 2;
            while (z[i] === "0")
                i++;
            const start = i;
            while (/[0-9a-fA-F]/.test(z[i] ?? "")) {
                value = BigInt.asUintN(64, value * 16n + BigInt(parseInt(z[i++], 16)));
            }
            rc = i - start > 16 ? 2 : i !== z.length ? 1 : 0;
            if (rc === 0) {
                out.setDouble(negative ? -Number(value) : Number(value));
                if (value <= 9223372036854775807n)
                    out.setInt64(negative ? -value : value);
                return out;
            }
        }
        else {
            const parsed = atoi64Prefix(Array.from(te.encode(z)));
            value = parsed.value;
            rc = parsed.rc;
            if (rc === 0) {
                out.setInt64(negative ? -value : value);
                return out;
            }
            if (rc === 3 && negative) {
                out.setInt64(-9223372036854775808n);
                return out;
            }
        }
        if (rc === 1)
            throw malformed();
    }
    const parsed = atof(Array.from(te.encode(e.raw)));
    if (!parsed.full || !parsed.validPrefix)
        throw malformed();
    out.setDouble(parsed.value);
    return out;
}
// jsonReturnFromBlob string branches publish SQL TEXT bytes. UTF-8 decoding
// belongs to Mem/public column conversion, not JSON semantic admission.
function binaryScalarResult(span) {
    const { bytes: b, at, charge } = span, h = binaryPayloadSize(b, at);
    if (!h)
        throw malformed();
    const type = b[at] & 15, out = new Mem(), start = at + h.header, end = start + h.size;
    if (type <= 2) {
        if (h.size)
            throw malformed();
        if (type === 0)
            out.setNull();
        else
            out.setInt64(type === 1 ? 1n : 0n);
        return out;
    }
    if (type === 7 || type === 10) {
        out.setText(b.slice(start, end), 'utf-8');
        return out;
    }
    if (type === 8 || type === 9) {
        const payload = b.subarray(start, end), parts = [];
        for (let i = 0; i < payload.length;) {
            charge(1);
            if (payload[i] !== 92) {
                parts.push(payload[i++]);
                continue;
            }
            const [v, next] = jsonReadLabel(payload, i, false, charge);
            if (v === 0x99999 || next <= i)
                throw malformed();
            if (v <= 127)
                parts.push(v);
            else if (v <= 2047)
                parts.push(192 | (v >> 6), 128 | (v & 63));
            else if (v < 65536)
                parts.push(224 | (v >> 12), 128 | ((v >> 6) & 63), 128 | (v & 63));
            else
                parts.push(240 | (v >> 18), 128 | ((v >> 12) & 63), 128 | ((v >> 6) & 63), 128 | (v & 63));
            i = next;
        }
        out.setText(Uint8Array.from(parts), 'utf-8');
        return out;
    }
    if (type >= 3 && type <= 6)
        return numericResult({ kind: 'number', raw: decodePayload(b, start, end), json5: type === 4 || type === 6, numericType: type });
    if (type === 11 || type === 12)
        return jsonBlobText(b.slice(at, at + h.header + h.size), charge);
    throw malformed();
}
function scalarResult(node) {
    const binary = jsonBinarySpans.get(node);
    if (binary)
        return binaryScalarResult(binary);
    const out = new Mem();
    switch (node.kind) {
        case "null":
            out.setNull();
            break;
        case "true":
            out.setInt64(1n);
            break;
        case "false":
            out.setInt64(0n);
            break;
        case "string":
            out.setText(te.encode(node.value), "utf-8");
            break;
        case "array":
        case "object": return jsonTextResult(node);
        case "number": return numericResult(node);
    }
    return out;
}
export const JSON_EACH_COLUMNS = Object.freeze(["key", "value", "type", "atom", "id", "parent", "fullkey", "path"]);
export const JSON_TABLE_COLUMNS = Object.freeze([...JSON_EACH_COLUMNS, "json", "root"]);
export function openJsonTableCursor(value, recursive, charge = () => { }, rootArgument = "$", binaryContainers = false, reserve = () => { }, columns, deferred = false) {
    let retained = 0, closed = false;
    // jsonEachFilter admits the document before sqlite3_value_text(root).
    // Keep argv/root owning bytes separate from the private lookup C-string.
    let rootPath = "$";
    const inputBytes = value.initialStorageClass === "blob" ? value.blobValue().byteLength : value.initialStorageClass === "text" ? value.textBytes().byteLength : 0;
    const replace = (n) => { reserve(retained, n); retained = n; };
    try {
        replace(inputBytes + rootPath.length * 2 + 64);
        if (value.initialStorageClass === "null")
            return { next: () => null, close() { if (!closed) {
                    closed = true;
                    replace(0);
                } } };
        let parseUnits = 0;
        const document = parseJsonMem(value, true, n => { parseUnits += n; charge(n); replace(inputBytes + rootPath.length * 2 + 64 + parseUnits * 64); });
        const convertedRoot = typeof rootArgument === "string" ? rootArgument : jsonSqlText(rootArgument);
        if (convertedRoot === null)
            return { next: () => null, close() { if (!closed) {
                    closed = true;
                    replace(0);
                } } };
        rootPath = convertedRoot.split("\0", 1)[0];
        replace(inputBytes + rootPath.length * 2 + 64 + parseUnits * 64);
        const selected = jsonLookup(document, rootPath, charge);
        const parseBytes = parseUnits * 64;
        const text = (x) => { const m = new Mem(); m.setText(te.encode(x), "utf-8"); return m; }, integer = (x) => { const m = new Mem(); m.setInt64(x); return m; }, nil = () => { const m = new Mem(); m.setNull(); return m; };
        const size = (node) => { const bounds = jsonbBounds.get(node); return bounds ? bounds.end - bounds.start : encodeJsonb(node).length; };
        let selectedId = 0, selectedValueAt = 0;
        const positions = new WeakMap();
        const valueStart = (node, fallback) => jsonbBounds.get(node)?.start ?? fallback;
        // json.c jsonBlobChangePayloadSize selects the container header from its
        // actual payload size; text parse images do not invariably have one-byte headers.
        const contentStart = (node, at) => at + (jsonbBounds.get(node) ? jsonbSize(value.blobValue(), at).header : jsonbSize(encodeJsonb(node), 0).header);
        const labelSize = (node, index, label) => { const encoding = jsonbLabelEncodings.get(node)?.[index]; return encoding ? header(encoding.type, encoding.payload.length).length + encoding.payload.length : encodeJsonb({ kind: "string", value: label }).length; };
        const locate = (node, id, valueAt) => { if (node === selected) {
            positions.set(node, valueAt);
            selectedId = id;
            selectedValueAt = valueAt;
            return true;
        } let at = contentStart(node, valueAt); if (node.kind === "array")
            for (const child of node.values) {
                const childAt = valueStart(child, at);
                if (locate(child, childAt, childAt)) {
                    positions.set(node, valueAt);
                    return true;
                }
                ;
                at = childAt + size(child);
            }
        else if (node.kind === "object")
            for (let i = 0; i < node.entries.length; i++) {
                const [label, child] = node.entries[i], labelAt = jsonbLabels.get(node)?.[i] ?? at, childAt = valueStart(child, labelAt + labelSize(node, i, label));
                if (locate(child, labelAt, childAt)) {
                    positions.set(node, valueAt);
                    return true;
                }
                ;
                at = childAt + size(child);
            } return false; };
        if (selected) {
            const target = jsonBinarySpans.get(selected), source = jsonBinarySpans.get(document);
            if (target && source) {
                // jsonLookupStep's value and label offsets belong to the lookup result.
                const lookup = jsonLookupPositions.get(selected);
                selectedId = lookup?.id ?? target.at;
                selectedValueAt = target.at;
                positions.set(document, source.at);
                positions.set(selected, target.at);
            }
            else
                locate(document, 0, 0);
        }
        const tag = (node) => { const span = jsonBinarySpans.get(node); return span ? (span.bytes[span.at] & 15) : undefined; };
        const container = (node) => { const t = tag(node); return t === undefined ? node.kind === "array" || node.kind === "object" : t === 11 || t === 12; };
        const valueResult = (node) => { if (!container(node))
            return scalarResult(node); if (!binaryContainers)
            return jsonTextResult(node); const bounds = jsonbBounds.get(node); if (!bounds)
            return jsonbResult(node); const out = new Mem(); out.setBlob(value.blobValue().slice(bounds.start, bounds.end)); return out; };
        // json.c jsonEachColumn and json_type share the aJsonType label owner.
        const type = (node) => { const t = tag(node); return t === undefined ? jsonTypeName(node) : ["null", "true", "false", "integer", "integer", "real", "real", "text", "text", "text", "text", "array", "object", "", "", ""][t]; };
        let currentColumns;
        const pathText = (path) => typeof path === "function" ? path() : path;
        const pathResult = (p) => { const m = new Mem(); m.setText(typeof p === "string" ? te.encode(p) : p, "utf-8"); return m; };
        const appendPath = (prefix, suffix) => { const p = pathText(prefix), b = typeof p === "string" ? te.encode(p) : p, out = new Uint8Array(b.length + suffix.length); out.set(b); out.set(suffix, b.length); return out; };
        const row = (key, node, id, parent, fullkey, path, depth) => { replace(inputBytes + parseBytes + rootPath.length * 2 + (depth + 1) * 64); charge(1); currentColumns = [() => typeof key === "function" ? key() : key, () => valueResult(node), () => text(type(node)), () => container(node) ? nil() : scalarResult(node), () => integer(BigInt(id)), () => parent === null ? nil() : integer(BigInt(parent)), () => { const f = pathText(fullkey), p = pathText(path); replace(inputBytes + parseBytes + (f.length + p.length + rootPath.length) * 2 + (depth + 1) * 64); return pathResult(f); }, () => { const p = pathText(path); replace(inputBytes + parseBytes + (p.length + rootPath.length) * 2 + (depth + 1) * 64); return pathResult(p); }, () => value, () => text(rootPath)]; return Object.freeze(currentColumns.map((produce, index) => !deferred && (!columns || columns.has(index)) ? produce() : nil())); };
        function* walk(node, id, valueAt, parent, key, fullkey, path, depth) { yield row(key, node, id, parent, fullkey, path, depth); if (!recursive)
            return; let at = contentStart(node, valueAt); if (node.kind === "array")
            for (let i = 0; i < node.values.length; i++) {
                const child = node.values[i], childAt = valueStart(child, at), childPath = `${fullkey}[${i}]`;
                yield* walk(child, childAt, childAt, id, integer(BigInt(i)), childPath, fullkey, depth + 1);
                at = childAt + size(child);
            }
        else if (node.kind === "object")
            for (let i = 0; i < node.entries.length; i++) {
                const [label, child] = node.entries[i], childId = jsonbLabels.get(node)?.[i] ?? at, childAt = valueStart(child, childId + labelSize(node, i, label)), childPath = /^[A-Za-z][A-Za-z0-9]*$/.test(label) ? `${fullkey}.${label}` : `${fullkey}.${quote(label)}`;
                yield* walk(child, childId, childAt, id, text(label), childPath, fullkey, depth + 1);
                at = childAt + size(child);
            } }
        // json.c jsonEachPathLength/JEACH_KEY: the first recursive row retains
        // the selected path's final segment, not an unconditional NULL key. Match
        // prefix payload position to the label/value position, including quoted dots.
        let rootKey = nil(), rootParentPath = rootPath;
        if (recursive && selected && rootPath.length >= 2) {
            let n = rootPath.length;
            while (n > 1) {
                n--;
                if (rootPath[n] !== "[" && rootPath[n] !== ".")
                    continue;
                try {
                    const prefix = jsonLookup(document, rootPath.slice(0, n), charge), at = prefix && (jsonBinarySpans.get(prefix)?.at ?? positions.get(prefix));
                    if (prefix && at !== undefined && contentStart(prefix, at) === selectedId)
                        break;
                }
                catch (error) {
                    // jsonEachPathLength ignores only JSON_LOOKUP path errors for candidate
                    // separators inside quoted labels, never execution/control failures.
                    if (!JsonPathError || !(error instanceof JsonPathError))
                        throw error;
                }
            }
            rootParentPath = rootPath.slice(0, n);
            const suffix = rootPath.slice(n);
            if (suffix.startsWith("[")) {
                const digits = /^[+-]?\d+/.exec(suffix.slice(1));
                rootKey = integer(digits ? BigInt(digits[0]) : 0n);
            }
            else
                rootKey = text(suffix.startsWith('."') ? suffix.slice(2, -1) : suffix.slice(1));
        }
        // jsonEachNext: visit the current span, then advance using payload extents.
        // Producing type/id/count must not demand a semantic child conversion.
        function* binaryChildren(node, id, fullkey, depth) {
            const span = jsonBinarySpans.get(node), b = span.bytes, h = binaryPayloadSize(b, span.at);
            if (!h)
                return;
            let at = span.at + h.header, index = 0;
            const end = at + h.size;
            while (at < end) {
                charge(1);
                const childId = at;
                let key, path;
                if (h.type === 12) {
                    // jsonSkipLabel consumes only the label extent. xColumn owns SQL key
                    // conversion; path production is a separate demand from row positioning.
                    const labelAt = at, label = binaryPayloadSize(b, at);
                    if (!label)
                        throw malformed();
                    key = () => scalarResult(binaryNode(b, labelAt, depth + 1, charge));
                    path = () => {
                        // jsonAppendPathName examines raw payload for quoting, then %.*s
                        // terminates at NUL. SQL key conversion is a separate column owner.
                        const raw = b.subarray(labelAt + label.header, labelAt + label.header + label.size);
                        const alpha = (c) => (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
                        const quoted = raw.length === 0 || !alpha(raw[0]) || raw.some(c => !alpha(c) && !(c >= 48 && c <= 57));
                        const nul = raw.indexOf(0), name = nul < 0 ? raw : raw.subarray(0, nul);
                        const suffix = new Uint8Array(name.length + (quoted ? 3 : 1));
                        suffix[0] = 46;
                        if (quoted)
                            suffix[1] = 34;
                        suffix.set(name, quoted ? 2 : 1);
                        if (quoted)
                            suffix[suffix.length - 1] = 34;
                        return appendPath(fullkey, suffix);
                    };
                    // jsonSkipLabel compares against the whole blob, not the parent end.
                    const valueAt = at + label.header + label.size;
                    if (valueAt < b.length)
                        at = valueAt;
                }
                else {
                    key = integer(BigInt(index));
                    path = appendPath(fullkey, te.encode(`[${index}]`));
                }
                const child = binaryNode(b, at, depth + 1, charge);
                yield row(key, child, childId, recursive ? id : null, path, fullkey, depth + 1);
                if (recursive && container(child))
                    yield* binaryChildren(child, childId, path, depth + 1);
                const size = binaryPayloadSize(b, at);
                if (!size)
                    throw malformed();
                at += size.header + size.size;
                index++;
            }
        }
        function* rows() {
            if (!selected)
                return;
            if (jsonBinarySpans.has(selected)) {
                if (recursive || !container(selected))
                    yield row(recursive ? rootKey : nil(), selected, selectedId, null, rootPath, recursive ? rootParentPath : rootPath, 0);
                if (container(selected))
                    yield* binaryChildren(selected, selectedId, rootPath, 0);
                return;
            }
            if (recursive) {
                yield* walk(selected, selectedId, selectedValueAt, null, rootKey, rootPath, rootParentPath, 0);
                return;
            }
            if (selected.kind !== "array" && selected.kind !== "object") {
                yield row(nil(), selected, selectedId, null, rootPath, rootPath, 0);
                return;
            }
            let at = contentStart(selected, selectedValueAt);
            if (selected.kind === "array")
                for (let i = 0; i < selected.values.length; i++) {
                    const node = selected.values[i], id = valueStart(node, at);
                    yield row(integer(BigInt(i)), node, id, null, `${rootPath}[${i}]`, rootPath, 1);
                    at = id + size(node);
                }
            else
                for (let i = 0; i < selected.entries.length; i++) {
                    const [key, node] = selected.entries[i], id = jsonbLabels.get(selected)?.[i] ?? at, childAt = valueStart(node, id + labelSize(selected, i, key));
                    yield row(text(key), node, id, null, /^[A-Za-z][A-Za-z0-9]*$/.test(key) ? `${rootPath}.${key}` : `${rootPath}.${quote(key)}`, rootPath, 1);
                    at = childAt + size(node);
                }
        }
        const iterator = rows();
        return { column(index) { if (closed || !currentColumns)
                throw new JSQLiteError("internal", "column on unpositioned JSON cursor"); return currentColumns[index](); }, next() { if (closed)
                return null; const item = iterator.next(); if (item.done) {
                this.close();
                return null;
            } return item.value; }, close() { if (!closed) {
                closed = true;
                currentColumns = undefined;
                iterator.return?.(undefined);
                replace(0);
            } } };
    }
    catch (error) {
        if (retained)
            replace(0);
        throw error;
    }
}
export function jsonEachRows(value, charge = () => { }, rootPath = "$", binaryContainers = false) { const cursor = openJsonTableCursor(value, false, charge, rootPath, binaryContainers), rows = []; try {
    for (let row; (row = cursor.next()) !== null;)
        rows.push(row);
    return Object.freeze(rows);
}
finally {
    cursor.close();
} }
export function jsonTreeRows(value, charge = () => { }, rootPath = "$", binaryContainers = false) { const cursor = openJsonTableCursor(value, true, charge, rootPath, binaryContainers), rows = []; try {
    for (let row; (row = cursor.next()) !== null;)
        rows.push(row);
    return Object.freeze(rows);
}
finally {
    cursor.close();
} }
/** src/json.c:jsonExtractFunc: document admission, ordered paths and flags. */
// JFUNCTION_JSON arrow abbreviation is a reached semantic scan.
function* pathAbbreviationSteps(text) {
    for (let i = 0; i < text.length; i++) {
        if (i > 0 && i % 256 === 0)
            yield 1;
        const c = text.charCodeAt(i);
        if (!(c >= 65 && c <= 90 || c >= 97 && c <= 122 || c >= 48 && c <= 57 || c === 95))
            return false;
    }
    return true;
}
function jsonExtractFunc(value, paths, mode, charge) { return driveJson(jsonExtractSteps(value, paths, mode, charge), charge); }
function* jsonExtractSteps(value, paths, mode, charge) {
    const out = new Mem();
    if (paths.length === 0 || value.initialStorageClass === "null")
        return out;
    const root = parseJsonMem(value, true, charge), values = [];
    for (const path of paths) {
        // sqlite3_value_text is requested only when this argument is reached.
        if (path.initialStorageClass === "null")
            return out;
        const storage = path.initialStorageClass;
        let p = jsonSqlText(path).split("\0", 1)[0];
        const originalPath = p;
        if (!p.startsWith("$")) {
            if (mode !== "json" && mode !== "sql")
                throw badPath(p);
            if (storage === "integer")
                p = `$[${p.startsWith("-") ? "#" : ""}${p}]`;
            else if (yield* pathAbbreviationSteps(p))
                p = `$.${p}`;
            else if (p.startsWith("[") && p.length >= 3 && p.endsWith("]"))
                p = "$" + p;
            else
                p = `$."${p}"`;
        }
        let node;
        try {
            node = yield* jsonLookupSteps(root, p);
        }
        catch (error) {
            if (JsonPathError && error instanceof JsonPathError)
                throw badPath(originalPath);
            throw error;
        }
        if (paths.length === 1) {
            if (!node)
                return out;
            if (mode === "json")
                return jsonTextResult(node);
            const binary = jsonBinarySpans.get(node);
            if (mode === "blob" && (binary ? ((binary.bytes[binary.at] & 15) === 11 || (binary.bytes[binary.at] & 15) === 12) : (node.kind === "array" || node.kind === "object")))
                return jsonbResult(node);
            const result = scalarResult(node);
            if (mode === "sql" && result.initialStorageClass !== "null")
                result.setSubtype(null);
            return result;
        }
        values.push(node ?? { kind: "null" });
    }
    const array = { kind: "array", values };
    return mode === "blob" ? renderedTextToBlob(renderJsonBytes(array), charge) : jsonTextResult(array);
}
export function jsonExtractAsync(value, paths, mode, checkpoint, charge) { return driveJsonAsync(jsonExtractSteps(value, paths, mode, charge), checkpoint); }
export function jsonExtract(value, paths, charge = () => { }) { return jsonExtractFunc(value, paths, "text", charge); }
export function jsonbExtract(value, paths, charge = () => { }) { return jsonExtractFunc(value, paths, "blob", charge); }
export function jsonbMemResult(value, node) { if (value.initialStorageClass !== "blob")
    return jsonbResult(node); const bytes = value.blobValue(); if (!jsonArgIsJsonb(bytes))
    return jsonbResult(node); const out = new Mem(); out.setBlob(bytes); return out; }
export function jsonArrow(value, path, sql, charge = () => { }) { return jsonExtractFunc(value, [path], sql ? "sql" : "json", charge); }
// jsonReturnString(JSON_BLOB) -> jsonTranslateTextToBlob. This input is the
// canonical byte output of our JsonString renderer, not arbitrary SQL JSON5.
// Keep string payload bytes opaque exactly as the upstream parse_string branch;
// numeric productions retain the existing translated Parser owner.
function renderedTextToBlob(bytes, charge = () => { }) {
    let i = 0;
    const visit = (depth) => {
        charge(1);
        if (depth > 1000)
            throw malformed();
        const c = bytes[i];
        if (c === 34) {
            const start = ++i;
            let type = 7;
            for (;;) {
                charge(1);
                const x = bytes[i];
                if (x === undefined || x === 0)
                    throw malformed();
                if (x < 32)
                    type = 9;
                if (x === 34) {
                    const payload = bytes.slice(start, i++);
                    return element(type, payload);
                }
                if (x === 92) {
                    if (type === 7)
                        type = 8;
                    const e = bytes[++i];
                    if (e === 117) {
                        if (i + 4 >= bytes.length)
                            throw malformed();
                        for (let j = 1; j <= 4; j++) {
                            const z = bytes[i + j];
                            if (!((z >= 48 && z <= 57) || (z >= 65 && z <= 70) || (z >= 97 && z <= 102)))
                                throw malformed();
                        }
                        i += 5;
                        continue;
                    }
                    if (e === undefined || ![34, 92, 47, 98, 102, 110, 114, 116].includes(e))
                        throw malformed();
                }
                i++;
            }
        }
        if (c === 91 || c === 123) {
            const object = c === 123, close = object ? 125 : 93, parts = [];
            i++;
            if (bytes[i] === close) {
                i++;
                return element(object ? 12 : 11);
            }
            for (;;) {
                if (object) {
                    if (bytes[i] !== 34)
                        throw malformed();
                    parts.push(visit(depth + 1));
                    if (bytes[i++] !== 58)
                        throw malformed();
                }
                parts.push(visit(depth + 1));
                if (bytes[i] === close) {
                    i++;
                    break;
                }
                if (bytes[i++] !== 44)
                    throw malformed();
            }
            return element(object ? 12 : 11, join(parts));
        }
        const start = i;
        while (i < bytes.length && bytes[i] !== 44 && bytes[i] !== 93 && bytes[i] !== 125)
            i++;
        if (start === i)
            throw malformed();
        let raw = '';
        for (let j = start; j < i; j++) {
            if (bytes[j] >= 128)
                throw malformed();
            raw += String.fromCharCode(bytes[j]);
        }
        return encodeJsonb(driveJson(new Parser(raw, true, charge).parse(), charge));
    };
    const result = visit(0);
    if (i !== bytes.length)
        throw malformed();
    const out = new Mem();
    out.setBlob(result);
    return out;
}
export function jsonQuote(value) { return jsonTextResult(jsonNodeFromSqlValue(value)); }
export function jsonConstruct(kind, values, blob = false) {
    if (kind === "array") {
        const node = { kind: "array", values: values.map(jsonNodeFromSqlValue) };
        return blob ? renderedTextToBlob(renderJsonBytes(node)) : jsonTextResult(node);
    }
    if (values.length % 2)
        throw new JSQLiteError("sqlite", "json_object() labels must be TEXT", { code: 1 });
    const entries = [];
    for (let i = 0; i < values.length; i += 2) {
        const key = values[i];
        if (key.initialStorageClass !== "text")
            throw new JSQLiteError("sqlite", "json_object() labels must be TEXT", { code: 1 });
        entries.push([key.textValue(), jsonNodeFromSqlValue(values[i + 1])]);
    }
    const node = { kind: "object", entries };
    return blob ? renderedTextToBlob(renderJsonBytes(node)) : jsonTextResult(node);
}
const jsonTypeName = (node) => node.kind === "number" ? (nodeNumber(node) === null ? "null" : (nodeNumber(node).type < 5 ? "integer" : "real")) : node.kind === "string" ? "text" : node.kind;
// sqlite3_value_text on a private Mem; preserve full text except at path callers.
// jsonObjectStep: sqlite3_value_text followed by sqlite3Strlen30, not
// sqlite3_value_bytes (which owns value strings). Measure UTF-8 before decoding.
export function jsonAggregateLabel(value) {
    if (value.initialStorageClass === "null")
        return null;
    const text = new Mem();
    text.copyFrom(value);
    try {
        text.cast("text", "utf-8");
        const bytes = text.textBytes(), zero = bytes.indexOf(0);
        return bytes.slice(0, zero < 0 ? bytes.length : zero);
    }
    finally {
        text.release();
    }
}
export async function withJsonAggregateLabel(value, control, use) {
    if (value.initialStorageClass === "null") {
        await use(null);
        return;
    }
    const text = new Mem();
    // BLOB's producer encoding is private to Mem. Account its worst-case UTF
    // conversion plus zero-tail expansion conservatively, without copying first.
    const conversion = value.initialStorageClass === "blob" ? 64 + value.diagnostic().byteLength * 4 : value.recordConversionBytes("text", "utf-8");
    control.reserve(conversion);
    try {
        text.shallowCopyFrom(value);
        await control.checkpoint(1);
        text.cast("text", "utf-8");
        const bytes = text.textBytes();
        let end = 0;
        for (; end < bytes.length; end++) {
            if (end % 256 === 0)
                await control.checkpoint(1);
            if (bytes[end] === 0)
                break;
        }
        await use(bytes.subarray(0, end));
    }
    finally {
        text.release();
        control.release(conversion);
    }
}
function jsonSqlText(value) {
    if (value.initialStorageClass === "null")
        return null;
    const text = new Mem();
    text.copyFrom(value);
    try {
        return text.valueText();
    }
    finally {
        text.release();
    }
}
// jsonTypeFunc/jsonArrayLengthFunc admit the document before touching the path.
function* jsonInspectionNodeSteps(value, path, charge) {
    if (value.initialStorageClass === "null")
        return undefined;
    const root = parseJsonMem(value, true, charge);
    if (path === undefined)
        return root;
    const text = jsonSqlText(path);
    return text === null ? undefined : yield* jsonLookupSteps(root, text.split("\0", 1)[0]);
}
export function jsonInspectAsync(value, path, length, charge, checkpoint) { return driveJsonAsync(length ? jsonArrayLengthSteps(value, path, charge) : jsonTypeSteps(value, path, charge), checkpoint); }
export function jsonType(value, path, charge = () => { }) { return driveJson(jsonTypeSteps(value, path, charge), charge); }
function* jsonTypeSteps(value, path, charge) {
    const out = new Mem(), node = yield* jsonInspectionNodeSteps(value, path, charge);
    if (node) {
        const binary = jsonBinarySpans.get(node);
        const name = binary ? ["null", "true", "false", "integer", "integer", "real", "real", "text", "text", "text", "text", "array", "object", "", "", ""][(binary.bytes[binary.at] ?? 0) & 15] : jsonTypeName(node);
        out.setText(te.encode(name), "utf-8");
    }
    return out;
}
export function jsonArrayLength(value, path, charge = () => { }) { return driveJson(jsonArrayLengthSteps(value, path, charge), charge); }
function* jsonArrayLengthSteps(value, path, charge) {
    const out = new Mem(), node = yield* jsonInspectionNodeSteps(value, path, charge);
    if (node) {
        const binary = jsonBinarySpans.get(node);
        out.setInt64(BigInt(binary ? ((binary.bytes[binary.at] & 15) === 11 ? yield* binaryArrayCountSteps(binary.bytes, binary.at) : 0) : node.kind === "array" ? node.values.length : 0));
    }
    return out;
}
export function jsonErrorPosition(value, charge = () => { }) { return driveJson(jsonErrorPositionSteps(value, charge), charge); }
export function jsonErrorPositionAsync(value, checkpoint) { return driveJsonAsync(jsonErrorPositionSteps(value, () => { }), checkpoint); }
function* jsonErrorPositionSteps(value, charge) {
    const out = new Mem();
    if (value.initialStorageClass === "null") {
        out.setNull();
        return out;
    }
    if (value.initialStorageClass === "blob" && (yield* jsonArgIsJsonbSteps(value.blobValue()))) {
        out.setInt64(BigInt(yield* jsonbValiditySteps(value.blobValue())));
        return out;
    }
    const text = jsonSqlText(value);
    try {
        yield* new Parser(text, true, charge).parse();
        out.setInt64(0n);
    }
    catch (error) {
        if (!(error instanceof JsonPositionError))
            throw error;
        let count = 0;
        for (let i = 0; i < error.offset;) {
            if ((count & 255) === 0)
                yield 1;
            const cp = text.codePointAt(i);
            i += cp > 65535 ? 2 : 1;
            count++;
        }
        out.setInt64(BigInt(count + 1));
    }
    return out;
}
function* pathEncodeSteps(text) {
    const parts = [];
    let bytes = 0;
    for (let at = 0; at < text.length;) {
        let end = Math.min(at + 256, text.length);
        if (end < text.length && text.charCodeAt(end - 1) >= 0xd800 && text.charCodeAt(end - 1) <= 0xdbff)
            end--;
        const part = te.encode(text.slice(at, end));
        parts.push(part);
        bytes += part.length;
        at = end;
        if (at < text.length)
            yield 1;
    }
    const out = new Uint8Array(bytes);
    let at = 0;
    for (const part of parts) {
        out.set(part, at);
        at += part.length;
        if (at < bytes)
            yield 1;
    }
    return out;
}
// Projection for object-key consumers; comparison still consumes original bytes.
function* pathLabelTextSteps(raw) {
    const b = yield* pathEncodeSteps(raw);
    let at = 0, out = "", count = 0;
    while (at < b.length) {
        if (++count % 256 === 0)
            yield 1;
        const [cp, next] = yield* jsonReadLabelSteps(b, at, false);
        if (next <= at)
            break;
        out += String.fromCodePoint(cp);
        at = next;
    }
    return out;
}
// jsonLabelCompare consumes producer tags and raw payloads, not decoded JS keys.
function* pathLabelIndexSteps(root, part) {
    const labels = jsonbLabelEncodings.get(root), a = part.label, rawA = a.type === 7 || a.type === 10;
    for (let i = 0; i < root.entries.length; i++) {
        if (i > 0 && i % 256 === 0)
            yield 1;
        const b = labels?.[i] ?? { type: 7, payload: yield* pathEncodeSteps(root.entries[i][0]) }, rawB = b.type === 7 || b.type === 10;
        const same = rawA && rawB ? yield* jsonRawLabelEqualSteps(a.payload, b.payload) : yield* jsonEscapedLabelEqualSteps(a.payload, rawA, b.payload, rawB);
        if (same)
            return i;
    }
    return -1;
}
// jsonLookupStep owns scan-before-shape and early from-end NOTFOUND.
// 256-character scan/UTF-8 chunks are host scheduling checkpoints, not precharge.
function* pathStepSteps(path, at, arrayLength) {
    let i = at, progress = 0;
    const tick = () => ++progress % 256 === 0;
    if (path[i] === ".") {
        i++;
        if (path[i] === '"') {
            const start = i++;
            let escaped = false;
            while (i < path.length && path[i] !== '"') {
                if (tick())
                    yield 1;
                if (path[i] === "\\") {
                    escaped = true;
                    i++;
                }
                i++;
            }
            if (path[i] !== '"')
                throw badPath(path);
            i++;
            // jsonLookupStep retains the span, not a JSON string value.
            const raw = path.slice(start + 1, i - 1);
            return { part: { kind: "key", key: yield* pathLabelTextSteps(raw), label: { type: escaped ? 9 : 10, payload: yield* pathEncodeSteps(raw) } }, next: i };
        }
        const start = i;
        while (i < path.length && !".[".includes(path[i])) {
            if (tick())
                yield 1;
            i++;
        }
        if (start === i)
            throw badPath(path);
        const key = path.slice(start, i);
        return { part: { kind: "key", key, label: { type: 10, payload: yield* pathEncodeSteps(key) } }, next: i };
    }
    if (path[i] === "[") {
        // jsonLookupStep: accumulate digits without overflow, then resolve # relative
        // to this array before validating its closing delimiter. NOTFOUND is not a
        // syntax error and must not consume either the delimiter or the remaining tail.
        const digit = (at) => path[at] !== undefined && path[at] >= "0" && path[at] <= "9";
        let index = 0;
        i++;
        const start = i;
        while (digit(i)) {
            if (tick())
                yield 1;
            if (index < 0xffffffff)
                index = index * 10 + Number(path[i]);
            i++;
        }
        let part = { kind: "index", index };
        if (i === start || path[i] !== "]") {
            if (path[at + 1] !== "#")
                throw badPath(path);
            i = at + 2;
            part = { kind: "index", index: "append" };
            if (path[i] === "-" && digit(i + 1)) {
                let distance = 0;
                i++;
                do {
                    if (tick())
                        yield 1;
                    if (distance < 0xffffffff)
                        distance = distance * 10 + Number(path[i]);
                    i++;
                } while (digit(i));
                if (distance > arrayLength)
                    return undefined;
                part = { kind: "fromEnd", distance };
            }
            if (path[i] !== "]")
                throw badPath(path);
        }
        return { part, next: i + 1 };
    }
    throw badPath(path);
}
// json.c:jsonCreateEditSubstructure: build privately, then publish only when
// lookup on the empty container succeeds (NOTFOUND must not leave a shell).
function* createEditSubstructureSteps(path, at, value, mode, depth, charge) {
    if (at === path.length)
        return value ?? { kind: "null" };
    const empty = path[at] === "." ? { kind: "object", entries: [] } : { kind: "array", values: [] };
    const result = yield* editNodeSteps(empty, path, at, value, mode, depth, charge);
    return result === empty ? undefined : result;
}
/** jsonBlobEdit/jsonBlobOverwrite: absorb a small shrink in the replacement
 * header, otherwise propagate the extent delta to the ancestor. */
function retainEditExtent(old, next) {
    if (old === next)
        return next;
    const before = encodeJsonb(old), after = encodeJsonb(next), h = jsonbSize(after);
    const d = before.length - after.length, width = h.header + d;
    if (d < 0 || d > 8 || h.type <= 2 || ![2, 3, 5, 9].includes(width))
        return next;
    if (d === 0)
        return next;
    const bytes = new Uint8Array(before.length);
    bytes[0] = (width === 2 ? 0xc0 : width === 3 ? 0xd0 : width === 5 ? 0xe0 : 0xf0) | h.type;
    let size = h.size;
    for (let i = width - 1; i > 0; i--) {
        bytes[i] = size % 256;
        size = Math.floor(size / 256);
    }
    bytes.set(after.subarray(h.header), width);
    // Replacement nodes may be reused by a later path argument. Header padding
    // belongs to this private destination, never to the shared insertion value.
    const result = { ...next };
    if (next.kind === "string") {
        const encoding = jsonStringEncoding.get(next);
        if (encoding)
            jsonStringEncoding.set(result, encoding);
        const spelling = jsonStringSpelling.get(next);
        if (spelling !== undefined)
            jsonStringSpelling.set(result, spelling);
    }
    else if (next.kind === "object") {
        const labels = jsonbLabelEncodings.get(next);
        if (labels)
            jsonbLabelEncodings.set(result, labels);
        const spellings = jsonObjectLabelSpelling.get(next);
        if (spellings)
            jsonObjectLabelSpelling.set(result, spellings);
    }
    jsonbOriginal.set(result, bytes);
    return result;
}
// jsonAfterEditSizeAdjust is called only for a nonzero descendant delta.
function retainContainerHeader(old, next) {
    const before = jsonbOriginal.get(old);
    if (!before)
        return next;
    const h = jsonbSize(before), encoded = encodeJsonbNode(next), n = jsonbSize(encoded);
    if (h.size === n.size)
        jsonbOriginal.set(next, join([before.subarray(0, h.header), encoded.subarray(n.header)]));
    return next;
}
function* editNodeSteps(root, path, at, value, mode, depth = 0, charge = () => { }) {
    yield 1;
    if (depth >= 1000)
        throw new JSQLiteError("sqlite", "JSON path too deep", { code: 1 });
    if (at === path.length) {
        if (mode === "array_insert")
            throw notArrayElement();
        return mode === "insert" ? root : retainEditExtent(root, value ?? { kind: "null" });
    }
    // jsonLookupStep checks array shape before parsing a bracket step, but
    // parses dot labels before checking object shape. Never consume a tail here.
    if (path[at] === "[" && root.kind !== "array")
        return root;
    const step = yield* pathStepSteps(path, at, root.kind === "array" ? root.values.length : 0);
    if (!step)
        return root;
    const { part, next } = step, hasTail = next < path.length;
    if (part.kind === "key") {
        if (root.kind !== "object")
            return root;
        const index = yield* pathLabelIndexSteps(root, part), entries = [...root.entries], labels = [...(jsonbLabelEncodings.get(root) ?? root.entries.map(([k]) => ({ type: 7, payload: te.encode(k) })))];
        if (index < 0) {
            if (mode === "replace" || mode === "remove")
                return root;
            if (mode === "array_insert" && (!hasTail || !path.endsWith("]")))
                throw notArrayElement();
            const sub = yield* createEditSubstructureSteps(path, next, value, mode, depth + 1, charge);
            if (!sub)
                return root;
            entries.push([part.key, sub]); /* json.c:jsonLookupStep uses JSONB_TEXTRAW for an unquoted path label. */
            labels.push(part.label);
        }
        else if (!hasTail) {
            if (mode === "insert")
                return root;
            if (mode === "array_insert")
                throw notArrayElement();
            if (mode === "remove") {
                entries.splice(index, 1);
                labels.splice(index, 1);
            }
            else
                entries[index] = [entries[index][0], retainEditExtent(entries[index][1], value ?? { kind: "null" })];
        }
        else
            entries[index] = [entries[index][0], yield* editNodeSteps(entries[index][1], path, next, value, mode, depth + 1, charge)];
        const result = { kind: "object", entries };
        jsonbLabelEncodings.set(result, labels);
        return retainContainerHeader(root, result);
    }
    if (root.kind !== "array")
        return root;
    const values = [...root.values], index = part.kind === "fromEnd" ? values.length - part.distance : part.index === "append" ? values.length : part.index;
    if (index < 0)
        return root;
    if (index > values.length)
        return root;
    if (index === values.length) {
        if (mode === "replace" || mode === "remove")
            return root;
        const sub = yield* createEditSubstructureSteps(path, next, value, mode, depth + 1, charge);
        if (!sub)
            return root;
        values.push(sub);
    }
    else if (index < values.length) {
        if (!hasTail) {
            if (mode === "insert")
                return root;
            if (mode === "array_insert")
                values.splice(index, 0, value ?? { kind: "null" });
            else if (mode === "remove")
                values.splice(index, 1);
            else
                values[index] = retainEditExtent(values[index], value ?? { kind: "null" });
        }
        else
            values[index] = yield* editNodeSteps(values[index], path, next, value, mode, depth + 1, charge);
    }
    return retainContainerHeader(root, { kind: "array", values });
}
// jsonLookupStep editable branches. Offsets remain in one private byte owner;
// only ancestors on the successful lookup path receive size-delta adjustment.
function* editBinarySteps(doc, at, path, pos, value, mode, depth, charge, label = 0) {
    yield 1;
    if (depth >= 1000)
        throw new JSQLiteError("sqlite", "JSON path too deep", { code: 1 });
    const b = doc.bytes;
    if (pos === path.length) {
        const h = binaryPayloadSize(b, at), size = h ? h.header + h.size : 0;
        if (mode === "insert")
            return true;
        if (mode === "array_insert") {
            if (path[pos - 1] !== ']')
                throw notArrayElement();
            doc.edit(at, 0, encodeJsonb(value ?? { kind: "null" }));
        }
        else if (mode === "remove")
            doc.edit(label || at, size + (label ? at - label : 0), new Uint8Array());
        else
            doc.edit(at, size, encodeJsonb(value ?? { kind: "null" }));
        return true;
    }
    const type = (b[at] ?? 0) & 15;
    if (path[pos] === "[" && type !== 11)
        return false;
    const length = path[pos + 1] === "#" ? yield* binaryArrayCountSteps(b, at) : 0;
    const step = yield* pathStepSteps(path, pos, length);
    if (!step)
        return false;
    if (step.part.kind === "key" && type !== 12)
        return false;
    const h = binaryPayloadSize(b, at);
    if (!h)
        throw malformed();
    let p = at + h.header, end = p + h.size, labelAt = 0, found = false;
    if (step.part.kind === "key") {
        while (p < end) {
            yield 1;
            labelAt = p;
            const lh = binaryPayloadSize(b, p);
            if (!lh || lh.type < 7 || lh.type > 10)
                throw malformed();
            const raw = lh.type === 7 || lh.type === 10, key = step.part.label, rawKey = key.type === 7 || key.type === 10;
            if (p + lh.header + lh.size >= end)
                throw malformed();
            const payload = b.subarray(p + lh.header, p + lh.header + lh.size);
            const same = raw && rawKey ? yield* jsonRawLabelEqualSteps(payload, key.payload) : yield* jsonEscapedLabelEqualSteps(payload, raw, key.payload, rawKey);
            p += lh.header + lh.size;
            if ((b[p] & 15) > 12)
                throw malformed();
            const v = binaryPayloadSize(b, p);
            if (!v)
                throw malformed();
            if (same) {
                if (p + v.header + v.size > end)
                    throw malformed();
                found = true;
                break;
            }
            p += v.header + v.size;
        }
    }
    else {
        let k = step.part.kind === "fromEnd" ? length - step.part.distance : step.part.index === "append" ? length : step.part.index;
        if (k < 0)
            return false;
        while (p < end && k > 0) {
            yield 1;
            const c = binaryPayloadSize(b, p);
            if (!c)
                throw malformed();
            p += c.header + c.size;
            k--;
        }
        found = p < end && k === 0;
        // jsonLookupStep checks scanned parent overshoot before remaining-index
        // NOTFOUND; selected/unvisited and early from-end branches stay distinct.
        if (p > end)
            throw malformed();
        if (k > 0)
            return false;
    }
    if (p > end)
        throw malformed();
    const before = doc.delta;
    if (found) {
        if (!(yield* editBinarySteps(doc, p, path, step.next, value, mode, depth + 1, charge, labelAt)))
            return false;
    }
    else {
        if (mode === "replace" || mode === "remove")
            return false;
        if (mode === "array_insert" && step.part.kind === "key" && (step.next === path.length || !path.endsWith("]")))
            throw notArrayElement();
        const sub = yield* createEditSubstructureSteps(path, step.next, value, mode, depth + 1, charge);
        if (!sub)
            return false;
        const insert = encodeJsonb(sub);
        doc.edit(p, 0, step.part.kind === "key" ? join([element(step.part.label.type, step.part.label.payload), insert]) : insert);
    }
    const delta = doc.delta - before;
    if (delta) {
        const saved = doc.delta;
        doc.delta = delta;
        doc.adjust(at);
        doc.delta += saved - delta;
    }
    return true;
}
/** json.c:jsonFunctionArgToBlob differs from jsonAppendSqlValue for FLOAT:
 * mutations consume sqlite3_value_text and canonicalize Inf to 9e999. */
function jsonEditValue(value) {
    if (value.initialStorageClass !== "real")
        return jsonNodeFromSqlValue(value);
    const n = value.realValue();
    if (Number.isNaN(n))
        return { kind: "null" };
    return { kind: "number", raw: Number.isFinite(n) ? jsonSqlText(value) : n < 0 ? "-9e999" : "9e999", json5: false, numericType: 5 };
}
export function jsonEditAsync(value, args, mode, charge, blob, checkpoint) { return driveJsonAsync(jsonEditSteps(value, args, mode, charge, blob), checkpoint); }
export function jsonEdit(value, args, mode, charge = () => { }, blob = false) { return driveJson(jsonEditSteps(value, args, mode, charge, blob), charge); }
function* jsonEditSteps(value, args, mode, charge = () => { }, blob = false) { if (value.initialStorageClass === "null") {
    const out = new Mem();
    return out;
} let root = parseJsonMem(value, true, charge); const binary = jsonBinarySpans.get(root); const editable = binary ? new JsonPatchBlob(binary.bytes.slice(), charge) : undefined; const stride = mode === "remove" ? 1 : 2; if (args.length % stride)
    throw new JSQLiteError("sqlite", `json_${mode}() needs an odd number of arguments`, { code: 1 }); for (let i = 0; i < args.length; i += stride) {
    if (args[i].initialStorageClass === "null") {
        if (mode === "remove") {
            const out = new Mem();
            return out;
        }
        continue;
    }
    const path = jsonSqlText(args[i]).split("\0", 1)[0];
    if (!path.startsWith("$"))
        throw badPath(path);
    if (mode === "remove" && path === "$") {
        const out = new Mem();
        return out;
    }
    if (mode === "array_insert" && path === "$") {
        jsonEditValue(args[i + 1]);
        continue;
    }
    try {
        if (editable) {
            yield* editBinarySteps(editable, 0, path, 1, mode === "remove" ? undefined : jsonEditValue(args[i + 1]), mode, 0, charge);
        }
        else
            root = yield* editNodeSteps(root, path, 1, mode === "remove" ? undefined : jsonEditValue(args[i + 1]), mode, 0, charge);
    }
    catch (error) {
        if (JsonArrayElementError && error instanceof JsonArrayElementError)
            throw new JSQLiteError("sqlite", `not an array element: '${path.replaceAll("'", "''")}'`, { code: 1 });
        throw error;
    }
} if (editable) {
    if (!blob)
        return jsonBlobText(editable.bytes, charge);
    const out = new Mem();
    out.setBlob(editable.bytes);
    return out;
} return blob ? jsonbResult(root) : jsonTextResult(root); }
// Private editable JsonParse analogue for jsonMergePatch. Offsets always refer
// to the current target buffer; delta belongs to the current recursive frame.
class JsonPatchBlob {
    delta = 0;
    bytes;
    charge;
    constructor(bytes, charge) { this.bytes = bytes; this.charge = charge; }
    size(at) {
        const h = jsonbSize(this.bytes, at);
        if (!h || at + h.header + h.size > Math.max(this.bytes.length, this.bytes.length - this.delta))
            throw malformed();
        return h;
    }
    edit(at, remove, insert) {
        this.charge(Math.max(1, insert.length));
        const d = insert.length - remove, h = jsonbSize(insert);
        // jsonBlobOverwrite: preserve the old extent when a larger size header
        // can absorb a small shrink. NULL/true/false cannot be enlarged.
        if (d < 0 && d >= -8 && h && h.type > 2) {
            const width = h.header - d;
            if ([1, 2, 3, 5, 9].includes(width) && width > h.header) {
                const expanded = new Uint8Array(remove);
                expanded[0] = (width === 2 ? 0xc0 : width === 3 ? 0xd0 : width === 5 ? 0xe0 : 0xf0) | h.type;
                let size = h.size;
                for (let i = width - 1; i > 0; i--) {
                    expanded[i] = size % 256;
                    size = Math.floor(size / 256);
                }
                expanded.set(insert.subarray(h.header), width);
                this.bytes.set(expanded, at);
                return;
            }
        }
        this.bytes = join([this.bytes.subarray(0, at), insert, this.bytes.subarray(at + remove)]);
        this.delta += d;
    }
    adjust(at) {
        const h = this.size(at), next = header(h.type, (h.size + this.delta) >>> 0);
        const d = next.length - h.header;
        this.bytes = join([this.bytes.subarray(0, at), next, this.bytes.subarray(at + h.header)]);
        this.delta += d;
    }
}
function patchArgument(value, charge) {
    // jsonParseFuncArg admits superficial JSONB without eagerly walking children.
    if (value.initialStorageClass === "blob" && jsonArgIsJsonb(value.blobValue()))
        return value.blobValue().slice();
    return encodeJsonb(parseJsonMem(value, true, charge));
}
// jsonTranslateBlobToText emits SQL TEXT bytes, not a decoded JS string.
// Mem.setText owns the bytes; public column() decoding is a separate boundary.
function* jsonBlobTextChunks(bytes, at = 0, depth = 0) {
    const syntax = Symbol('jsonTranslateBlobToText malformed');
    let error;
    const ascii = function* (s) { yield te.encode(s); };
    const control = function* (c) { yield* ascii({ 8: '\\b', 9: '\\t', 10: '\\n', 12: '\\f', 13: '\\r' }[c] ?? `\\u${c.toString(16).padStart(4, '0')}`); };
    const render = function* (at, depth) {
        yield null;
        const h = jsonbSize(bytes, at);
        if (!h || at + h.header + h.size > bytes.length) {
            error ??= malformed();
            return bytes.length + 1;
        }
        const start = at + h.header, end = start + h.size, p = bytes.subarray(start, end);
        try {
            switch (h.type) {
                case 0:
                    yield* ascii('null');
                    return at + 1;
                case 1:
                    yield* ascii('true');
                    return at + 1;
                case 2:
                    yield* ascii('false');
                    return at + 1;
                case 3:
                case 5:
                    if (!h.size)
                        throw syntax;
                    yield p;
                    break;
                case 4: {
                    if (!h.size)
                        throw syntax;
                    let k = 2, u = 0n, overflow = false;
                    if (p[0] === 45) {
                        yield* ascii('-');
                        k++;
                    }
                    else if (p[0] === 43)
                        k++;
                    for (; k < p.length; k++) {
                        yield null;
                        const x = p[k];
                        if (!((x >= 48 && x <= 57) || (x >= 65 && x <= 70) || (x >= 97 && x <= 102))) {
                            error ??= malformed();
                            break;
                        }
                        if (u >> 60n)
                            overflow = true;
                        else
                            u = u * 16n + BigInt(x <= 57 ? x - 48 : (x & ~32) - 55);
                    }
                    yield* ascii(overflow ? '9.0e999' : u.toString());
                    break;
                }
                case 6: {
                    if (!h.size)
                        throw syntax;
                    let k = 0;
                    if (p[0] === 45) {
                        yield* ascii('-');
                        if (h.size <= 1)
                            throw syntax;
                        k = 1;
                    }
                    if (p[k] === 46)
                        yield* ascii('0');
                    for (; k < p.length; k++) {
                        yield null;
                        yield p.subarray(k, k + 1);
                        if (p[k] === 46 && (k + 1 === p.length || p[k + 1] < 48 || p[k + 1] > 57))
                            yield* ascii('0');
                    }
                    break;
                }
                case 7:
                case 8:
                    yield* ascii('"');
                    yield p;
                    yield* ascii('"');
                    break;
                case 9: {
                    yield* ascii('"');
                    for (let k = 0; k < p.length; k++) {
                        yield null;
                        const x = p[k];
                        if (x === 34)
                            yield* ascii('\\"');
                        else if (x <= 31)
                            yield* control(x);
                        else if (x !== 92)
                            yield p.subarray(k, k + 1);
                        else {
                            if (k + 1 >= p.length) {
                                error ??= malformed();
                                break;
                            }
                            const e = p[++k];
                            if (e === 39)
                                yield* ascii("'");
                            else if (e === 118)
                                yield* ascii('\\u000b');
                            else if (e === 48)
                                yield* ascii('\\u0000');
                            else if (e === 120) {
                                if (k + 2 >= p.length) {
                                    error ??= malformed();
                                    break;
                                }
                                yield* ascii('\\u00');
                                yield p.subarray(k + 1, k + 3);
                                k += 2;
                            }
                            else if (e === 13) {
                                if (p[k + 1] === 10)
                                    k++;
                            }
                            else if (e === 10) { }
                            else if (e === 226) {
                                if (p[k + 1] !== 128 || (p[k + 2] !== 168 && p[k + 2] !== 169)) {
                                    error ??= malformed();
                                    break;
                                }
                                k += 2;
                            }
                            else {
                                yield* ascii('\\');
                                yield p.subarray(k, k + 1);
                            }
                        }
                    }
                    yield* ascii('"');
                    break;
                }
                case 10: {
                    yield* ascii('"');
                    for (let k = 0; k < p.length; k++) {
                        yield null;
                        const x = p[k];
                        if (x === 34 || x === 92) {
                            yield* ascii('\\');
                            yield p.subarray(k, k + 1);
                        }
                        else if (x < 32)
                            yield* control(x);
                        else
                            yield p.subarray(k, k + 1);
                    }
                    yield* ascii('"');
                    break;
                }
                case 11:
                case 12: {
                    yield* ascii(h.type === 11 ? '[' : '{');
                    if (depth >= 1000)
                        error ??= new JSQLiteError('sqlite', 'JSON nested too deep', { code: 1 });
                    let j = start, count = 0;
                    while (j < end && !error) {
                        j = yield* render(j, depth + 1);
                        yield* ascii(h.type === 11 || count % 2 === 1 ? ',' : ':');
                        count++;
                    }
                    if (j > end || (h.type === 12 && count % 2))
                        error ??= malformed();
                    if (h.size > 0 && !error)
                        yield -1; // jsonStringTrimOneChar is suppressed by eErr
                    yield* ascii(h.type === 11 ? ']' : '}');
                    break;
                }
                default: throw syntax;
            }
        }
        catch (e) {
            if (e !== syntax)
                throw e;
            error ??= malformed();
        }
        return end;
    };
    const next = yield* render(at, depth);
    if (error)
        throw error;
    return next;
}
function jsonBlobText(bytes, charge) { return jsonBlobTextAt(bytes, 0, 0, charge).value; }
function jsonBlobTextAt(bytes, at, depth, charge) {
    const parts = [];
    const steps = jsonBlobTextChunks(bytes, at, depth);
    let next;
    for (;;) {
        const step = steps.next();
        if (step.done) {
            next = step.value;
            break;
        }
        const part = step.value;
        if (part === null)
            charge(1);
        else if (part === -1) {
            const last = parts.pop();
            if (last && last.length > 1)
                parts.push(last.subarray(0, last.length - 1));
        }
        else
            parts.push(part);
    }
    const value = new Mem();
    value.setText(join(parts), 'utf-8');
    value.setSubtype(74);
    return { value, next };
}
/** Feed the same translated producer directly into the aggregate JsonString.
 * No complete temporary TEXT, part inventory or joined/copy result is retained. */
export async function appendJsonAggregateBlob(value, append, checkpoint, trim, storage = { reserve: () => { }, release: () => { } }) {
    await value.withBlobBytes({ ...storage, checkpoint }, async (bytes) => {
        if (!jsonArgIsJsonb(bytes))
            throw new JSQLiteError('sqlite', 'JSON cannot hold BLOB values', { code: 1 });
        let units = 0;
        for (const part of jsonBlobTextChunks(bytes)) {
            if (part === null) {
                if (++units % 128 === 0)
                    await checkpoint();
            }
            else if (part === -1)
                trim();
            else
                await append(part);
        }
        await checkpoint();
    });
}
// jsonLabelCompare raw/raw branch: opaque byte labels are not UTF-8 strings.
function jsonRawLabelEqual(a, b, charge) { return driveJson(jsonRawLabelEqualSteps(a, b), charge); }
function* jsonRawLabelEqualSteps(a, b) {
    if (a.length !== b.length)
        return false;
    for (let i = 0; i < a.length; i++) {
        yield 1;
        if (a[i] !== b[i])
            return false;
    }
    return true;
}
// jsonLabelCompareEscaped uses sqlite3Utf8ReadLimited, which deliberately
// neither validates nor replaces codepoints. NUL terminates this comparison.
function jsonReadLabel(p, i, raw, charge) { charge(1); return driveJson(jsonReadLabelSteps(p, i, raw), charge); }
function* jsonReadLabelSteps(p, i, raw) {
    const hex = (x) => (x + 9 * (1 & (x >> 6))) & 15;
    const hex4 = (p, i) => (hex(p[i]) << 12) | (hex(p[i + 1]) << 8) | (hex(p[i + 2]) << 4) | hex(p[i + 3]);
    if (i >= p.length)
        return [0, i];
    const x = p[i];
    if (raw || x !== 92) {
        let c = x, j = i + 1;
        if (c >= 192) {
            c = c < 224 ? c - 192 : c < 240 ? c - 224 : c < 248 ? c - 240 : c < 252 ? c - 248 : c < 254 ? c - 252 : 0;
            while (j < p.length && j < i + 4 && (p[j] & 192) === 128)
                c = (c << 6) + (p[j++] & 63);
        }
        return [c, j];
    }
    const n = p.length - i;
    if (n < 2)
        return [0x99999, p.length];
    const e = p[i + 1];
    if (e === 117) {
        if (n < 6)
            return [0x99999, p.length];
        const v = hex4(p, i + 2);
        if ((v & 0xfc00) === 0xd800 && n >= 12 && p[i + 6] === 92 && p[i + 7] === 117) {
            const lo = hex4(p, i + 8);
            if ((lo & 0xfc00) === 0xdc00)
                return [((v & 1023) << 10) + (lo & 1023) + 65536, i + 12];
        }
        return [v, i + 6];
    }
    if (e === 120)
        return n < 4 ? [0x99999, p.length] : [(hex(p[i + 2]) << 4) | hex(p[i + 3]), i + 4];
    if (e === 48)
        return [n > 2 && p[i + 2] >= 48 && p[i + 2] <= 57 ? 0x99999 : 0, i + 2];
    const escapes = { 98: 8, 102: 12, 110: 10, 114: 13, 116: 9, 118: 11, 39: 39, 34: 34, 47: 47, 92: 92 };
    if (escapes[e] !== undefined)
        return [escapes[e], i + 2];
    if (e === 10 || e === 13 || e === 226) {
        let j = i;
        while (j + 1 < p.length && p[j] === 92) {
            if ((j - i) % 256 < 4)
                yield 1;
            if (p[j + 1] === 10)
                j += 2;
            else if (p[j + 1] === 13)
                j += p[j + 2] === 10 ? 3 : 2;
            else if (p[j + 1] === 226 && p[j + 2] === 128 && (p[j + 3] === 168 || p[j + 3] === 169))
                j += 4;
            else
                break;
        }
        if (j === i)
            return [0x99999, p.length];
        return yield* jsonReadLabelSteps(p, j, false);
    }
    return [0x99999, i + 2];
}
function jsonEscapedLabelEqual(a, rawA, b, rawB, charge) { return driveJson(jsonEscapedLabelEqualSteps(a, rawA, b, rawB), charge); }
function* jsonEscapedLabelEqualSteps(a, rawA, b, rawB) {
    let l = 0, r = 0;
    for (;;) {
        yield 2;
        const [lc, ln] = yield* jsonReadLabelSteps(a, l, rawA), [rc, rn] = yield* jsonReadLabelSteps(b, r, rawB);
        if (lc !== rc)
            return false;
        if (lc === 0)
            return true;
        l = ln;
        r = rn;
    }
}
function mergePatchBlob(target, at, patch, from, depth, charge) {
    charge(1);
    let p = patch.size(from), t = target.size(at);
    if (p.type !== 12) {
        target.edit(at, t.header + t.size, patch.bytes.slice(from, from + p.header + p.size));
        return;
    }
    if (t.type !== 12) {
        target.edit(at + t.header, t.size, new Uint8Array());
        target.bytes[at] = (target.bytes[at] & 0xf0) | 12;
    }
    p = patch.size(from);
    t = target.size(at);
    let pc = from + p.header;
    const pe = pc + p.size, ts = at + t.header, teBefore = ts + t.size;
    while (pc < pe) {
        charge(1);
        const pl = pc, ph = patch.size(pl);
        if (ph.type < 7 || ph.type > 10)
            throw malformed();
        const pv = pl + ph.header + ph.size;
        if (pv >= pe)
            throw malformed();
        const v = patch.size(pv);
        pc = pv + v.header + v.size;
        if (pc > pe)
            throw malformed();
        let tc = ts, tl = tc, tv = tc, th = t, vh = t;
        const te = teBefore + target.delta;
        while (tc < te) {
            charge(1);
            tl = tc;
            th = target.size(tl);
            if (th.type < 7 || th.type > 10)
                throw malformed();
            tv = tl + th.header + th.size;
            if (tv >= te)
                throw malformed();
            vh = target.size(tv);
            if (tv + vh.header + vh.size > te)
                throw malformed();
            // jsonMergePatch passes raw flags for TEXT/TEXTRAW; only escaped
            // comparands enter the character-decoding branch in jsonLabelCompare.
            const rawPatch = ph.type === 7 || ph.type === 10, rawTarget = th.type === 7 || th.type === 10;
            if (rawPatch && rawTarget
                ? jsonRawLabelEqual(patch.bytes.subarray(pl + ph.header, pv), target.bytes.subarray(tl + th.header, tv), charge)
                : jsonEscapedLabelEqual(patch.bytes.subarray(pl + ph.header, pv), rawPatch, target.bytes.subarray(tl + th.header, tv), rawTarget, charge))
                break;
            tc = tv + vh.header + vh.size;
        }
        if (tc < te) {
            if (v.type === 0)
                target.edit(tl, th.header + th.size + vh.header + vh.size, new Uint8Array());
            else {
                const saved = target.delta;
                target.delta = 0;
                if (depth >= 1000)
                    throw new JSQLiteError("sqlite", "JSON nested too deep", { code: 1 });
                mergePatchBlob(target, tv, patch, pv, depth + 1, charge);
                target.delta += saved;
            }
        }
        else if (v.type > 0) {
            const labelBytes = patch.bytes.slice(pl, pv);
            if (v.type !== 12)
                target.edit(te, 0, patch.bytes.slice(pl, pc));
            else {
                target.edit(te, 0, join([labelBytes, Uint8Array.of(0)]));
                const saved = target.delta;
                target.delta = 0;
                if (depth >= 1000)
                    throw new JSQLiteError("sqlite", "JSON nested too deep", { code: 1 });
                mergePatchBlob(target, te + labelBytes.length, patch, pv, depth + 1, charge);
                target.delta += saved;
            }
        }
    }
    if (target.delta)
        target.adjust(at);
}
export function jsonPatch(target, patch, charge = () => { }, blob = false) {
    const out = new Mem();
    if (target.initialStorageClass === "null")
        return out;
    const editable = new JsonPatchBlob(patchArgument(target, charge), charge);
    if (patch.initialStorageClass === "null")
        return out;
    const input = new JsonPatchBlob(patchArgument(patch, charge), charge);
    mergePatchBlob(editable, 0, input, 0, 0, charge);
    if (blob) {
        out.setBlob(editable.bytes);
        return out;
    }
    return jsonBlobText(editable.bytes, charge);
}
