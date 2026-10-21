import { resolvedGeneratedExpressionCarrier, NameResolutionError } from "./resolve.js";
import { btreeFromConnection, BtreeCursorStateError, BtreeFormatError } from "./btree.js";
import { decodeRecord, RecordFormatError } from "./record.js";
import { parseSql, SqlParseError } from "./parse.js";
import { storageOwner } from "./storage.js";
import { tokenIds, productions } from "../generated/parser-tables.js";
import { decodeSqliteText } from "./utf.js";
import { sqliteAsciiFold, sqliteIdentifierEqual } from "./sqlite-case.js";
import { Mem } from "./mem.js";
import { KeyInfo } from "./comparison.js";
/** A malformed sqlite_schema row or declaration. */
export class SchemaFormatError extends Error {
    constructor(message, options = {}) { super(message, options); this.name = "SchemaFormatError"; }
}
/** A recognized schema construct whose construction is staged for a later slice. */
export class SchemaUnsupportedError extends Error {
    classification = "temporary";
    constructor(message) { super(message); this.name = "SchemaUnsupportedError"; }
}
export class SchemaStateError extends Error {
    constructor(message) { super(message); this.name = "SchemaStateError"; }
}
export function statisticsForIndex(index) { return index; }
/** util.c:sqlite3LogEst, including its small integer rounding table. */
export function sqliteLogEst(value) {
    if (value < 2n)
        return 0;
    let x = value, y = 40;
    if (x < 8n) {
        while (x < 8n) {
            y -= 10;
            x <<= 1n;
        }
    }
    else {
        while (x > 255n) {
            y += 40;
            x >>= 4n;
        }
        while (x > 15n) {
            y += 10;
            x >>= 1n;
        }
    }
    return [0, 2, 3, 5, 6, 7, 8, 9][Number(x & 7n)] + y - 10;
}
/** build.c sqlite3TableColumnToStorage. VIRTUAL columns are absent from
 * records but occupy the register-cache tail after all nonvirtual columns. */
export function tableColumnToStorage(table, column) {
    if (column < 0)
        return column;
    if (column >= table.columns.length)
        throw new RangeError("table column out of range");
    let normal = 0;
    for (let i = 0; i < column; i++)
        if (table.columns[i].generatedStorage !== "virtual")
            normal++;
    return table.columns[column].generatedStorage === "virtual"
        ? table.columns.filter(value => value.generatedStorage !== "virtual").length + column - normal : normal;
}
function malformed(message, cause) {
    throw new SchemaFormatError(`malformed database schema: ${message}`, cause === undefined ? {} : { cause });
}
function text(value, encoding, field) {
    if (value.storageClass !== "text")
        malformed(`${field} is not text`);
    return decodeSqliteText(value.bytes, encoding);
}
function rootPage(value) {
    if (value.storageClass !== "integer" || value.value < 0n || value.value > BigInt(Number.MAX_SAFE_INTEGER)) {
        malformed("rootpage is not a nonnegative integer");
    }
    return Number(value.value);
}
function row(payload, encoding) {
    try {
        const values = decodeRecord(payload, encoding);
        if (values.values.length !== 5)
            malformed("sqlite_schema row does not have five columns");
        const [typeValue, nameValue, tableValue, rootValue, sqlValue] = values.values;
        const type = text(typeValue, encoding, "type").toLowerCase();
        const name = text(nameValue, encoding, "name");
        const tableName = text(tableValue, encoding, "tbl_name");
        const root = rootPage(rootValue);
        const sql = sqlValue.storageClass === "null" ? null : text(sqlValue, encoding, "sql");
        return { type, name, tableName, rootPage: root, sql };
    }
    catch (error) {
        if (error instanceof SchemaFormatError)
            throw error;
        if (error instanceof RecordFormatError)
            malformed(error.message, error);
        throw error;
    }
}
function identifier(token) {
    if (!token || (token.kind !== "id" && token.kind !== "keyword"))
        malformed("expected identifier");
    const value = token.text;
    if (value[0] === "[" && value.at(-1) === "]")
        return value.slice(1, -1);
    if ((value[0] === '"' || value[0] === "`") && value.at(-1) === value[0])
        return value.slice(1, -1).replaceAll(value[0] + value[0], value[0]);
    return value;
}
/** util.c sqlite3GetInt32/sqlite3Atoi: failure leaves the initialized zero. */
export function sqliteAtoi(z) {
    let neg = false;
    if (z[0] === "-" || z[0] === "+") {
        neg = z[0] === "-";
        z = z.slice(1);
    }
    else if (/^0[xX][0-9a-fA-F]/.test(z)) {
        z = z.slice(2).replace(/^0+/, "");
        const digits = z.match(/^[0-9a-fA-F]*/)?.[0] ?? "";
        if (digits.length > 8)
            return 0;
        const v = digits ? BigInt("0x" + digits) : 0n;
        return v > 2147483647n ? 0 : Number(v);
    }
    if (!/^[0-9]/.test(z))
        return 0;
    const digits = z.replace(/^0+/, "").match(/^[0-9]*/)?.[0] ?? "";
    if (digits.length > 10)
        return 0;
    const v = BigInt(digits || "0");
    return v - (neg ? 1n : 0n) > 2147483647n ? 0 : Number(neg ? -v : v);
}
/** build.c sqlite3AddColumn/ sqlite3AffinityType, including retained CHAR pointer. */
export function columnTypeEstimate(declaredType) {
    if (!declaredType)
        return { affinity: "blob", szEst: 1 };
    const z = sqliteAsciiFold(declaredType);
    let aff = "numeric", charAt = null;
    for (let i = 1; i <= z.length; i++) {
        const h = z.slice(Math.max(0, i - 4), i);
        if (h === "char") {
            aff = "text";
            charAt = i;
        }
        else if (h === "clob" || h === "text")
            aff = "text";
        else if (h === "blob" && (aff === "numeric" || aff === "real")) {
            aff = "blob";
            if (z[i] === "(")
                charAt = i;
        }
        else if (["real", "floa", "doub"].includes(h) && aff === "numeric")
            aff = "real";
        else if (h.endsWith("int")) {
            aff = "integer";
            break;
        }
    }
    let v = 0;
    if (aff === "text" || aff === "blob") {
        if (charAt === null)
            v = 16;
        else {
            const tail = z.slice(charAt), at = tail.search(/[0-9]/);
            if (at >= 0)
                v = sqliteAtoi(tail.slice(at));
        }
    }
    return { affinity: aff, szEst: Math.min(255, Math.trunc(v / 4) + 1) };
}
function defaultRowEst(index) {
    const table = index.table;
    table.nRowLogEst = Math.max(99, table.nRowLogEst);
    const defaults = [33, 32, 30, 28, 26];
    const rows = [table.nRowLogEst - (index.partialWhere ? 10 : 0), ...index.terms.map((_, i) => defaults[i] ?? 23)];
    if (index.unique)
        rows[index.terms.length] = 0;
    index.rowLogEst = rows;
}
/** analyze.c:initAvgEq. tRowcnt is u64, not signed i64: usual C arithmetic
 * conversions make products/division unsigned where a row count participates.
 * Only assignment to nDist100 reinterprets the resulting bits as signed. */
export function initStat4AvgEq(state, nKeyCol, aiRowEst) {
    const final = state.samples[state.nSample - 1];
    if (!final)
        throw new SchemaStateError("statistics average requires an accepted sample");
    const u64 = (v) => BigInt.asUintN(64, v);
    const i64 = (v) => BigInt.asIntN(64, v);
    let nCol = 1;
    if (state.nSampleCol > 1) {
        nCol = state.nSampleCol - 1;
        state.aAvgEq[nCol] = 1n;
    }
    for (let col = 0; col < nCol; col++) {
        let nSample = state.nSample, nRow, nDist100;
        if (!aiRowEst || col >= nKeyCol || aiRowEst[col + 1] === 0n) {
            nRow = final.anLt[col];
            nDist100 = i64(u64(100n * final.anDLt[col]));
            nSample--;
        }
        else {
            nRow = aiRowEst[0];
            nDist100 = i64(u64(100n * nRow) / aiRowEst[col + 1]);
        }
        state.nRowEst0 = nRow;
        let sumEq = 0n, nSum100 = 0n;
        for (let i = 0; i < nSample; i++) {
            if (i === state.nSample - 1 || state.samples[i].anDLt[col] !== state.samples[i + 1].anDLt[col]) {
                sumEq = u64(sumEq + state.samples[i].anEq[col]);
                nSum100 = i64(nSum100 + 100n);
            }
        }
        let avgEq = 0n;
        if (nDist100 > nSum100 && sumEq < nRow) {
            avgEq = u64(100n * u64(nRow - sumEq)) / u64(i64(nDist100 - nSum100));
        }
        state.aAvgEq[col] = avgEq === 0n ? 1n : avgEq;
    }
}
/** analyze.c:loadStatTbl. Iterator factory is reopened for the load pass;
 * no retained decoded table/index or sample cap. Grouped count state alone is
 * retained between passes. Native sample metadata costs 40 logical bytes per
 * slot, each rowcnt costs 8, and each owned record costs n+8. This is logical
 * accounting, not a claim about host object heap sizes. */
export function loadStat4Samples(rows, find, layout, options) {
    const groups = new Map();
    const states = new Map();
    const max = options.maxBytes;
    if (!Number.isSafeInteger(max) || max < 0)
        throw new SchemaStateError("invalid statistics allocation envelope");
    let used = 0;
    const charge = (bytes) => {
        if (bytes < 0n || bytes > BigInt(max - used))
            throw new SchemaStateError("statistics allocation envelope exceeded");
        used += Number(bytes);
    };
    const check = (phase, units = 1) => options.check?.(phase, units);
    for (const row of rows()) {
        check("count");
        if (row.name === null)
            continue;
        const key = sqliteAsciiFold(row.name), group = groups.get(key);
        if (group) {
            if (group.count === 0x7fffffff)
                throw new SchemaStateError("statistics allocation capacity overflow");
            group.count++;
        }
        else {
            charge(32n + BigInt(row.name.length) * 2n);
            groups.set(key, { name: row.name, count: 1 });
        }
    }
    for (const [, group] of [...groups].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
        check("capacity");
        const index = find(group.name);
        if (!index || states.has(index))
            continue;
        const { nSampleCol } = layout(index);
        if (!Number.isSafeInteger(nSampleCol) || nSampleCol < 1 || nSampleCol > 32767)
            throw new SchemaStateError("statistics allocation column overflow");
        charge(BigInt(group.count) * (40n + 24n * BigInt(nSampleCol)) + 8n * BigInt(nSampleCol));
        states.set(index, { mxSample: group.count, nSample: 0, nSampleCol, samples: [], nRowEst0: 0n, aAvgEq: Array(nSampleCol).fill(0n) });
    }
    let previous = null;
    const average = (index) => { if (index) {
        const info = layout(index);
        initStat4AvgEq(states.get(index), info.nKeyCol, info.aiRowEst);
    } };
    for (const row of rows()) {
        check("load");
        if (row.name === null)
            continue;
        const index = find(row.name), state = index && states.get(index);
        if (!index || !state || state.nSample >= state.mxSample)
            continue;
        if (index !== previous) {
            average(previous);
            previous = index;
        }
        // Count decoding precedes the record allocation/copy in the source.
        const anEq = decodeStat4Counts(row.neq, state.nSampleCol, undefined, units => options.check?.("load", units));
        const anLt = decodeStat4Counts(row.nlt, state.nSampleCol, undefined, units => options.check?.("load", units));
        const anDLt = decodeStat4Counts(row.ndlt, state.nSampleCol, undefined, units => options.check?.("load", units));
        const n = row.bytes.byteLength;
        charge(BigInt(n) + 8n);
        const p = new Uint8Array(n + 8);
        for (let at = 0; at < n; at += 4096) {
            const end = Math.min(n, at + 4096);
            check("copy", end - at);
            p.set(row.bytes.subarray(at, end), at);
        }
        // Published consumers receive a copy, never a mutable alias to owned bytes.
        const sample = { get p() { return p.slice(); }, n, anEq, anLt, anDLt };
        state.samples.push(sample);
        state.nSample++;
    }
    check("finalize");
    average(previous);
    return states;
}
/** analyze.c decodeIntArray: zero allocated counts, uint64 accumulation.
 * Reused aiRowEst destinations preserve untouched trailing slots. */
export function decodeStat4Counts(z, nOut, out = Array(nOut).fill(0n), check) {
    if (!Number.isSafeInteger(nOut) || nOut < 0 || out.length !== nOut)
        throw new SchemaStateError("invalid statistics count array capacity");
    decodeCountPrefix(z ?? "", nOut, (i, value) => { out[i] = value; }, check);
    return out;
}
/** Shared numeric producer, not a second STAT4 text parser. */
function decodeCountPrefix(z, nOut, put, check) {
    let at = 0, pending = 0;
    check?.(1);
    for (let i = 0; i < nOut && at < z.length && z[at] !== "\0"; i++) {
        let value = 0n;
        while (at < z.length && z[at] >= "0" && z[at] <= "9") {
            value = BigInt.asUintN(64, value * 10n + BigInt(z.charCodeAt(at++) - 48));
            if (++pending === 4096) {
                check?.(pending);
                pending = 0;
            }
        }
        check?.(pending + 1);
        pending = 0;
        put(i, value);
        if (z[at] === " ")
            at++;
    }
    return at;
}
function decodeEstimates(z, rows, width) {
    let at = decodeCountPrefix(z, rows.length, (i, v) => { rows[i] = sqliteLogEst(v); });
    let unordered = false, noSkipScan = false;
    while (at < z.length) {
        const tail = z.slice(at);
        if (tail.startsWith("unordered"))
            unordered = true;
        else if (/^sz=[0-9]/.test(tail))
            width = sqliteLogEst(BigInt(Math.max(2, sqliteAtoi(tail.slice(3)))));
        else if (tail.startsWith("noskipscan"))
            noSkipScan = true;
        while (at < z.length && z[at] !== " ")
            at++;
        while (z[at] === " ")
            at++;
    }
    return { rows, width, unordered, noSkipScan };
}
/** sqlite3_exec callback column_text: database BLOB encoding then UTF8, C NUL. */
function callbackText(raw, encoding) {
    if (raw.storageClass === "null")
        return null;
    const mem = new Mem();
    if (raw.storageClass === "text" || raw.storageClass === "blob")
        mem.setText(raw.bytes, encoding);
    else if (raw.storageClass === "integer")
        mem.setInt64(raw.value);
    else
        mem.setDouble(raw.value);
    try {
        mem.cast("text", "utf-8");
        // legacy.c sqlite3_exec passes column_text bytes to analysisLoader. Hash
        // lookup and decodeIntArray inspect those bytes; READ_UTF8 would collapse
        // overlong non-ASCII names into a different, valid schema name.
        let text = "";
        for (const byte of mem.textBytes()) {
            if (byte === 0)
                break;
            text += String.fromCharCode(byte);
        }
        return text;
    }
    finally {
        mem.release();
    }
}
// build.c exit_create_index: only the first REPLACE may be out of order.
function linkIndex(table, index) {
    table.indexes.unshift(index);
    let at = table.indexes.findIndex(candidate => candidate.onError === "replace");
    if (at < 0)
        return;
    while (at + 1 < table.indexes.length && table.indexes[at + 1].onError !== "replace") {
        const next = table.indexes.splice(at + 1, 1)[0];
        table.indexes.splice(at, 0, next);
        at++;
    }
}
/** build.c sqlite3AddPrimaryKey: identity before WR conversion, not storage
 * alias after conversion. Both rowid publication and delayed PK use it. */
function declaredIntegerPrimaryKey(columns, ddl) {
    const names = ddl.primaryKey.length ? ddl.primaryKey : ddl.columns.filter(c => c.primaryKey).map(c => c.name);
    const column = names.length === 1 ? columns.find(c => sqliteIdentifierEqual(c.name, names[0])) : undefined;
    return column?.declaredType?.toUpperCase() === "INTEGER" &&
        (ddl.primaryKey.length > 0 || !ddl.columns.find(c => sqliteIdentifierEqual(c.name, column.name))?.primaryKeyDescending) ? column : null;
}
function implicitIndexDefinitions(table, ddl) {
    const rowidAlias = table.integerPrimaryKey !== null && !table.withoutRowid;
    // build.c sqlite3CreateIndex: grammar actions run in declaration
    // order; equal column/collation sequences merge ignoring direction.
    const linked = [];
    const implicit = [];
    // build.c convertToWithoutRowidTable delays INTEGER rowid-alias PK
    // creation until after all grammar indexes, even for WITHOUT ROWID.
    const delayed = table.withoutRowid && declaredIntegerPrimaryKey(table.columns, ddl) !== null;
    const constraints = delayed ? [...ddl.implicitConstraints.filter(c => !c.primary), ...ddl.implicitConstraints.filter(c => c.primary)] : ddl.implicitConstraints;
    for (const constraint of constraints) {
        if (constraint.primary && rowidAlias)
            continue;
        const terms = Object.freeze(constraint.terms.map(term => {
            const tokens = term.expr.tokens, simple = tokens.length === 1 ? identifier(tokens[0]) : null;
            const column = simple === null ? undefined : table.columns.find(c => sqliteIdentifierEqual(c.name, simple));
            if (!column)
                throw new SchemaUnsupportedError(`expression implicit index is not implemented: ${table.name}`);
            return Object.freeze({ column, expression: null, expressionSql: null, descending: term.descending, collation: term.collation ?? column.collation, nulls: term.nulls });
        }));
        const prior = implicit.find(index => index.terms.length === terms.length && index.terms.every((term, i) => term.column === terms[i].column && sqliteIdentifierEqual(term.collation ?? "BINARY", terms[i].collation ?? "BINARY")));
        if (prior) {
            if (prior.onError !== constraint.onError) {
                if (prior.onError !== "default" && constraint.onError !== "default")
                    throw new SchemaFormatError(`malformed database schema (${table.name}) - conflicting ON CONFLICT clauses specified`);
                if (prior.onError === "default")
                    prior.onError = constraint.onError;
            }
            if (constraint.primary)
                prior.primary = true;
            reorder();
            continue;
        }
        const definition = { terms, primary: constraint.primary, onError: constraint.onError, listPosition: 0 };
        implicit.push(definition);
        linked.unshift(definition);
        reorder();
    }
    function reorder() {
        let at = linked.findIndex(index => index.onError === "replace");
        if (at >= 0)
            while (at + 1 < linked.length && linked[at + 1].onError !== "replace") {
                const next = linked.splice(at + 1, 1)[0];
                linked.splice(at, 0, next);
                at++;
            }
        linked.forEach((index, position) => index.listPosition = position);
    }
    return implicit;
}
function triggerFixContext() { return { full: new WeakMap(), sources: new WeakMap(), sourceFlags: new WeakMap() }; }
/** window.c sqlite3WindowOffsetExpr uses expr.c IsConstant with no Parse:
 * unresolved functions/identifiers and SELECTs disqualify a bound. Traverse
 * generated expression carriers, never SQL text, before the fixer sees it. */
function constantWindowOffset(node) {
    const pending = [node];
    while (pending.length) {
        const value = pending.pop();
        if (value.kind !== "reduction")
            continue;
        const signature = value.signature;
        if (signature.startsWith("select ::=") || signature.startsWith("expr ::= RAISE") || signature.startsWith("term ::= CTIME_KW"))
            return false;
        if (signature.startsWith("expr ::= nm DOT") || signature.startsWith("expr ::= idj LP"))
            return false;
        if (signature === "expr ::= idj") {
            const identifiers = [...value.children];
            let name = "";
            while (identifiers.length) {
                const part = identifiers.pop();
                if (part.kind === "terminal")
                    name = part.value.text.replace(/[a-z]/g, c => c.toUpperCase());
                else
                    identifiers.push(...part.children);
            }
            if (name !== "TRUE" && name !== "FALSE")
                return false;
            continue;
        }
        for (let i = value.children.length - 1; i >= 0; i--)
            pending.push(value.children[i]);
    }
    return true;
}
function nullTriggerExpression() {
    // Keep the original grammar/SQL outside the initialized semantic tree.
    return Object.freeze({ kind: "reduction", signature: "term ::= NULL|FLOAT|BLOB", rule: productions.find(p => p.signature === "term ::= NULL|FLOAT|BLOB").id,
        children: Object.freeze([Object.freeze({ kind: "terminal", tokenId: tokenIds.NULL, value: Object.freeze({ kind: "keyword", text: "NULL", startByte: 0, endByte: 0 }) })]), semantic: Object.freeze({ fromDDL: true, windowOffsetNormalized: true }) });
}
function initializeTriggerTree(node, fail, sourceOnly = false, context = triggerFixContext()) {
    const cache = sourceOnly ? context.sources : context.full;
    const cached = cache.get(node);
    if (cached)
        return cached;
    // Grammar lists (columns, sources and expressions) may be much wider than
    // expression height. Use an explicit postorder stack for ordinary carriers;
    // semantic owners retain their short-circuit ordering in fixTriggerTree.
    const owned = (value) => value.kind === "reduction" && [
        "expr ::= VARIABLE", "select ::= WITH", "seltablist ::=", "xfullname ::=",
        "oneselect ::= SELECT", "window ::=", "filter_over ::=", "frame_bound ::=", "selectnowith ::= selectnowith multiselect_op",
    ].some(prefix => value.signature.startsWith(prefix));
    const pending = [{ value: node, finish: false }];
    while (pending.length) {
        const entry = pending.pop(), value = entry.value;
        if (cache.has(value))
            continue;
        if (entry.finish || value.kind === "terminal" || owned(value) || sourceOnly && (value.signature.startsWith("select ::=") || value.signature.startsWith("exprlist ::="))) {
            cache.set(value, fixTriggerTree(value, fail, sourceOnly, context));
            continue;
        }
        pending.push({ value, finish: true });
        for (let i = value.children.length - 1; i >= 0; i--)
            pending.push({ value: value.children[i], finish: false });
    }
    return cache.get(node);
}
function fixTriggerTree(node, fail, sourceOnly, context) {
    if (node.kind === "terminal")
        return node;
    if (node.signature === "frame_bound ::= expr PRECEDING|FOLLOWING") {
        const expression = node.children.find(child => child.kind === "reduction" && child.signature.startsWith("expr ::="));
        if (expression && !constantWindowOffset(expression))
            return Object.freeze({ ...node, children: Object.freeze(node.children.map(child => child === expression ? nullTriggerExpression() : child)), semantic: Object.freeze({ windowOffsetNormalized: true }) });
    }
    if (node.signature.startsWith("expr ::= VARIABLE")) {
        const token = node.children[0];
        if (token?.kind !== "terminal")
            fail("invalid trigger variable");
        return Object.freeze({ ...node, signature: "term ::= NULL|FLOAT|BLOB", rule: productions.find(p => p.signature === "term ::= NULL|FLOAT|BLOB").id, children: Object.freeze([Object.freeze({ ...token, value: Object.freeze({ ...token.value, text: "NULL", kind: "keyword" }), tokenId: tokenIds.NULL })]), semantic: Object.freeze({ fromDDL: true }) });
    }
    const own = (prefix) => node.children.find(child => child.kind === "reduction" && child.signature.startsWith(prefix));
    const tokenList = (value) => !value ? [] : value.kind === "terminal" ? [value.value] : value.children.flatMap(tokenList);
    if (sourceOnly && (node.signature.startsWith("select ::=") || node.signature.startsWith("exprlist ::=")))
        return node;
    if (node.signature.startsWith("select ::= WITH")) {
        // attachWithToSelect places WITH on the rightmost Select. Its callback
        // visits source names/ON, then CTEs, before projection/subqueries.
        const body = own("selectnowith ::=");
        const rightmost = (value) => {
            if (value.kind !== "reduction")
                return;
            if (value.signature.startsWith("oneselect ::="))
                return value;
            for (let i = value.children.length - 1; i >= 0; i--) {
                const found = rightmost(value.children[i]);
                if (found)
                    return found;
            }
        };
        const arm = body ? rightmost(body) : undefined;
        const from = arm?.kind === "reduction" ? arm.children.find(child => child.kind === "reduction" && child.signature.startsWith("from ::=")) : undefined;
        if (from)
            initializeTriggerTree(from, fail, true, context);
        const ctes = own("wqlist ::=");
        const fixedCtes = ctes ? initializeTriggerTree(ctes, fail, false, context) : undefined;
        return Object.freeze({ ...node, semantic: undefined, children: Object.freeze(node.children.map(child => child === ctes ? fixedCtes : initializeTriggerTree(child, fail, false, context))) });
    }
    if (node.signature.startsWith("xfullname ::=")) {
        // sqlite3FixSrcList uses a zeroed Select callback on trigger DML pSrc.
        const flags = Object.freeze({ schema: "main", fixedSchema: true, fromDDL: true, notCte: false, hadSchema: false });
        return Object.freeze({ ...node, semantic: flags, children: Object.freeze(node.children.map(child => initializeTriggerTree(child, fail, false, context))) });
    }
    if (node.signature.startsWith("seltablist ::=")) {
        // SrcList is a left-recursive grammar list but an ordered native array.
        // Visit prefix before this item's qualifier and ON; subqueries/arguments
        // belong to WalkSelectFrom, not fixSelectCb.
        const prefix = own("stl_prefix ::="), fixedPrefix = prefix ? initializeTriggerTree(prefix, fail, sourceOnly, context) : undefined;
        const qualifier = tokenList(own("dbnm ::="));
        if (!context.sourceFlags.has(node) && qualifier.length) {
            const name = identifier(tokenList(own("nm ::="))[0]);
            if (!sqliteIdentifierEqual(name, "main"))
                fail(`cannot reference objects in database ${name}`);
        }
        const named = !!own("nm ::=");
        if (named && !context.sourceFlags.has(node))
            context.sourceFlags.set(node, Object.freeze({ schema: "main", fixedSchema: true, fromDDL: true, notCte: qualifier.length !== 0, hadSchema: qualifier.length !== 0 }));
        const on = own("on_using ::="), fixedOn = on ? initializeTriggerTree(on, fail, false, context) : undefined;
        return Object.freeze({ ...node, semantic: context.sourceFlags.get(node), children: Object.freeze(node.children.map(child => {
                if (child === prefix)
                    return fixedPrefix;
                if (child === on)
                    return fixedOn;
                if (child.kind === "reduction" && child.signature.startsWith("dbnm ::=") && child.children.length)
                    return Object.freeze({ ...child, signature: "dbnm ::=", children: Object.freeze([]), semantic: undefined });
                return initializeTriggerTree(child, fail, sourceOnly, context);
            })) });
    }
    // walker.c Select callback fixes FROM/ON before projection and WHERE;
    // compound pPrior is walked after the rightmost arm. Rebuild in original
    // grammar order while visiting semantic fields in their owner order.
    const ordered = [...node.children];
    if (node.signature.startsWith("oneselect ::= SELECT")) {
        const fields = ["selcollist", "where_opt", "groupby_opt", "having_opt", "orderby_opt", "limit_opt", "from"];
        const from = own("from ::=");
        if (from)
            initializeTriggerTree(from, fail, true, context);
        ordered.sort((a, b) => {
            const rank = (value) => value.kind === "reduction" ? fields.findIndex(field => value.signature.startsWith(`${field} ::=`)) : -1;
            const ar = rank(a), br = rank(b);
            return (ar < 0 ? 99 : ar) - (br < 0 ? 99 : br);
        });
    }
    else if (node.signature.startsWith("filter_over ::=")) {
        // parse.y attaches FILTER to the Window produced by OVER. walker.c visits
        // that Window's ORDER/PARTITION before FILTER and its frame after FILTER;
        // grammar child order (FILTER, OVER) is not semantic field order.
        const filter = own("filter_clause ::="), over = own("over_clause ::=");
        const window = over && over.kind === "reduction" ? over.children.find(child => child.kind === "reduction" && child.signature.startsWith("window ::=")) : undefined;
        if (window?.kind === "reduction") {
            const frame = window.children.find(child => child.kind === "reduction" && child.signature.startsWith("frame_opt ::="));
            const fields = window.children.filter(child => child !== frame);
            const rank = (value) => value.kind !== "reduction" ? 99 : value.signature.startsWith("orderby_opt ::=") || value.signature.startsWith("sortlist ::=") ? 0 : value.signature.startsWith("nexprlist ::=") ? 1 : 99;
            fields.sort((a, b) => rank(a) - rank(b));
            for (const child of fields)
                initializeTriggerTree(child, fail, sourceOnly, context);
            if (filter)
                initializeTriggerTree(filter, fail, sourceOnly, context);
            if (frame)
                initializeTriggerTree(frame, fail, sourceOnly, context);
        }
        else {
            if (over)
                initializeTriggerTree(over, fail, sourceOnly, context);
            if (filter)
                initializeTriggerTree(filter, fail, sourceOnly, context);
        }
        // Rebuild in grammar order, reusing the initialized field identities.
    }
    else if (node.signature.startsWith("window ::=")) {
        // walker.c walkWindowList visits ORDER, PARTITION, FILTER, bounds.
        const rank = (value) => value.kind !== "reduction" ? 99 : value.signature.startsWith("orderby_opt ::=") || value.signature.startsWith("sortlist ::=") ? 0 : value.signature.startsWith("nexprlist ::=") ? 1 : value.signature.startsWith("frame_opt ::=") ? 3 : 99;
        ordered.sort((a, b) => rank(a) - rank(b));
    }
    else if (node.signature.startsWith("selectnowith ::= selectnowith multiselect_op"))
        ordered.reverse();
    const fixed = new Map();
    for (const child of ordered) {
        if (node.signature.startsWith("seltablist ::=") && child.kind === "reduction" && child.signature.startsWith("dbnm ::=") && child.children.length)
            fixed.set(child, Object.freeze({ ...child, signature: "dbnm ::=", children: Object.freeze([]), semantic: undefined }));
        else
            fixed.set(child, initializeTriggerTree(child, fail, sourceOnly, context));
    }
    return Object.freeze({ ...node, semantic: node.signature.startsWith("expr ::=") || node.signature.startsWith("term ::=") ? Object.freeze({ fromDDL: true }) : undefined, children: Object.freeze(node.children.map(child => fixed.get(child))) });
}
/** attach.c sqlite3FixTriggerStep short-circuit order. Fields are fixed once,
 * not repeatedly through token containers or semantic back-references. */
function initializeTriggerStep(step, fail, context) {
    const fix = (node) => node ? initializeTriggerTree(node, fail, false, context) : null;
    const select = fix(step.select), where = fix(step.where), expressions = fix(step.expressions);
    const target = fix(step.target), from = fix(step.from);
    const fixUpsert = (up) => {
        if (!up)
            return null;
        const target = fix(up.target), targetWhere = fix(up.targetWhere), expressions = fix(up.expressions), where = fix(up.where);
        return Object.freeze({ target, targetWhere, expressions, where, next: fixUpsert(up.next) });
    };
    const upsert = fixUpsert(step.upsert);
    return Object.freeze({ ...step, select, where, expressions, target, from, upsert });
}
function validateTriggerSteps(declaration, fail) {
    for (const step of declaration.steps) {
        const pending = [step.reduction];
        while (pending.length) {
            const node = pending.pop();
            if (node.kind !== "reduction")
                continue;
            if (node.signature.startsWith("tridxby ::=") && node.children.length) {
                fail(`the ${node.signature.includes("NOT") ? "NOT INDEXED" : "INDEXED BY"} clause is not allowed on UPDATE or DELETE statements within triggers`);
            }
            if (node.signature.startsWith("trigger_cmd ::=")) {
                const target = node.children.find(child => child.kind === "reduction" && child.signature.startsWith("xfullname ::="));
                if (target?.kind === "reduction" && target.signature.includes("DOT"))
                    fail("qualified table names are not allowed on INSERT, UPDATE, and DELETE statements within triggers");
            }
            for (let i = node.children.length - 1; i >= 0; i--)
                pending.push(node.children[i]);
        }
    }
}
function parseTrigger(item) {
    try {
        return parseDdl(item.sql, "create-trigger", item.name);
    }
    catch (error) {
        if (error instanceof SchemaFormatError) {
            const prefix = `malformed database schema: ${item.name} - `;
            if (error.message.startsWith(prefix))
                throw new SchemaFormatError(`malformed database schema (${item.name}) - ${error.message.slice(prefix.length)}`, { cause: error });
        }
        throw error;
    }
}
function parseDdl(sql, expected, name) {
    try {
        const parsed = parseSql(sql);
        if (parsed.statement?.kind !== expected)
            malformed(`SQL for ${name} has the wrong object type`);
        return parsed.statement;
    }
    catch (error) {
        if (error instanceof SchemaFormatError)
            throw error;
        if (error instanceof SqlParseError)
            throw new SchemaFormatError(`malformed database schema (${name}) - ${error.message}`, { cause: error });
        throw error;
    }
}
function readonlyMap(source) {
    // Do not publish a mutable Map behind a ReadonlyMap type annotation.
    let view;
    view = Object.freeze({
        get size() { return source.size; },
        get: (key) => source.get(key),
        has: (key) => source.has(key),
        entries: () => source.entries(),
        keys: () => source.keys(),
        values: () => source.values(),
        forEach: (callback, thisArg) => {
            source.forEach((value, key) => callback.call(thisArg, value, key, view));
        },
        [Symbol.iterator]: () => source[Symbol.iterator](),
    });
    return view;
}
/** Production uses build.c-owned identity, never inference from index sort flags.
 * Fallback supports older private mock tables; real and transient producers
 * explicitly publish a column or null. */
export function integerPrimaryKeyColumn(table) {
    if (table.integerPrimaryKey !== undefined)
        return table.integerPrimaryKey;
    if (table.withoutRowid || table.primaryKey.length !== 1)
        return null;
    const column = table.primaryKey[0];
    return column.declaredType?.trim().toUpperCase() === "INTEGER" && !table.primaryKeyTerms?.[0]?.descending ? column : null;
}
function builtinCollation(name) {
    const folded = sqliteAsciiFold(name ?? "binary");
    return folded === "binary" || folded === "nocase" || folded === "rtrim" ? folded : null;
}
/** build.c:sqlite3KeyInfoOfIndex and convertToWithoutRowidTable for admitted
 * rowid and WITHOUT ROWID layouts. Unsupported layouts return null atomically. */
export function physicalIndexLayout(index) {
    const fields = [];
    for (const term of index.terms) {
        const collationName = term.collation ?? term.column?.collation ?? "BINARY";
        const collation = sqliteAsciiFold(collationName);
        if ((!term.column && !term.expression) || term.nulls !== null)
            throw new SchemaUnsupportedError("index record fields are not represented");
        fields.push(Object.freeze({ role: "declared", column: term.column, expression: term.expression, collation, collationName, descending: term.descending, nullsLarge: false }));
    }
    if (index.table.withoutRowid) {
        const isPrimary = index.origin === "primary-key";
        let primaryKeyFields = Object.freeze([]);
        if (isPrimary) {
            // build.c:convertToWithoutRowidTable makes the PK b-tree the table and
            // appends every non-key column to its record in declared-column order.
            for (const column of index.table.columns)
                if (!fields.some(field => field.column === column))
                    fields.push(Object.freeze({ role: "stored-column", column, expression: null, collation: "binary", collationName: "BINARY", descending: false, nullsLarge: false }));
        }
        else {
            // build.c:isDupColumn/convertToWithoutRowidTable replace the rowid tail
            // with each PK term not already represented by the same column and
            // collation. sqlite3CreateIndex copies that PK term's collation and sort
            // direction into the physical suffix (not the bare column defaults).
            // Production schema graphs always publish primaryKeyTerms. Keep the
            // column-derived fallback for older compiler tests and transient schema
            // producers, which predate preservation of PK collation/direction. It is
            // deliberately unable to invent metadata absent from those producers;
            // persisted schemas take the exact terms above.
            const primaryKeyTerms = index.table.primaryKeyTerms ?? Object.freeze(index.table.primaryKey.map(column => Object.freeze({ column, expression: null, expressionSql: null, descending: false, collation: column.collation, nulls: null })));
            for (const term of primaryKeyTerms) {
                const collationName = term.collation ?? term.column?.collation ?? "BINARY";
                const collation = sqliteAsciiFold(collationName);
                if (!term.column || term.expression || term.nulls !== null)
                    throw new SchemaUnsupportedError("primary-key record fields are not represented");
                if (fields.some(field => field.column === term.column && field.collation === collation))
                    continue;
                fields.push(Object.freeze({ role: "primary-key-suffix", column: term.column, expression: null, collation, collationName, descending: term.descending, nullsLarge: false }));
            }
            // wherecode.c:2171-2185 maps every primary-key component from the
            // selected secondary record. Declared and auxiliary fields need not be
            // contiguous or ordered. Match collation too, so a different-collation
            // declared copy cannot hide the appended physical PK copy.
            const mapped = [];
            for (const term of primaryKeyTerms) {
                const collation = sqliteAsciiFold(term.collation ?? term.column?.collation ?? "binary");
                if (!term.column)
                    throw new SchemaUnsupportedError("primary-key record field missing");
                const ordinal = fields.findIndex(field => field.column === term.column && field.collation === collation);
                if (ordinal < 0)
                    throw new SchemaUnsupportedError("primary-key record mapping missing");
                mapped.push(ordinal);
            }
            primaryKeyFields = Object.freeze(mapped);
        }
        return Object.freeze({ index, fields: Object.freeze(fields), declaredFieldCount: index.terms.length, rowidField: -1, primaryKeyFields });
    }
    fields.push(Object.freeze({ role: "rowid-tail", column: null, expression: null, collation: "binary", collationName: "BINARY", descending: false, nullsLarge: false }));
    return Object.freeze({ index, fields: Object.freeze(fields), declaredFieldCount: index.terms.length, rowidField: index.terms.length, primaryKeyFields: Object.freeze([]) });
}
export function physicalIndex(index, encoding) {
    const layout = index.layout ?? physicalIndexLayout(index);
    if (layout.fields.some(field => !builtinCollation(field.collation)))
        return null;
    const fields = layout.fields;
    const allNotNull = index.unique && index.terms.every(term => term.column?.notNull === true);
    const keyFieldCount = index.table.withoutRowid ? (index.origin === "primary-key" ? index.terms.length : fields.length) : (allNotNull ? index.terms.length : fields.length);
    const keyInfo = new KeyInfo({ encoding, totalFieldCount: fields.length, keyFieldCount, terms: fields.map(field => Object.freeze({ collation: field.collation, desc: field.descending, nullsLarge: false })) });
    return Object.freeze({ index, ...layout, fields, keyInfo });
}
/** Compatibility entrypoint for rowid-only callers. New lowering should use
 * physicalIndex so WITHOUT ROWID layouts are not accidentally excluded. */
export function physicalRowidIndex(index, encoding) {
    return index.table.withoutRowid ? null : physicalIndex(index, encoding);
}
/** build.c:sqlite3FindTable; usable by linked transient resolution schemas. */
export function findSchemaTable(schema, name) {
    const folded = sqliteAsciiFold(name);
    return schema.tables.get(folded) ?? (folded === "sqlite_schema" ? schema.tables.get("sqlite_master") : undefined);
}
export class SchemaGraph {
    encoding;
    objects;
    tables;
    indexes;
    views;
    triggers;
    #owner;
    constructor(owner, encoding, objects, tables, indexes, views, triggers = new Map()) {
        this.#owner = owner;
        this.encoding = encoding;
        this.objects = Object.freeze(objects);
        this.tables = readonlyMap(tables);
        this.indexes = readonlyMap(indexes);
        this.views = readonlyMap(views);
        this.triggers = readonlyMap(triggers);
        Object.freeze(this);
    }
    /** build.c:sqlite3FindTable — aliases share a single synthetic Table. */
    findTable(name) {
        return findSchemaTable(this, name);
    }
    assertOpen() {
        try {
            this.#owner[storageOwner].assertOpen();
        }
        catch (error) {
            throw new SchemaStateError("schema owner is closed");
        }
    }
    /** Resolution-only table used by select.c-style coroutine consumers. It is
     * never opened as a b-tree; the owning compiler supplies its rows. */
    withTransientTable(table) {
        freezeTransientTable(table);
        const tables = new Map(this.tables);
        tables.set(sqliteAsciiFold(table.name), table);
        return new SchemaGraph(this.#owner, this.encoding, [...this.objects, table], tables, new Map(this.indexes), new Map(this.views), new Map(this.triggers));
    }
}
/** Publish completed SELECT-result metadata (select.c:2376/2432/2464).
 * Persistent defaults/ANALYZE must never run on a rootPage=0 result table. */
export function freezeTransientTable(table) {
    if (table.rootPage !== 0 || table.indexes.length !== 0)
        throw new SchemaUnsupportedError("transient publication requires nonphysical result metadata");
    for (const column of table.columns) {
        Object.freeze(column.checks);
        Object.freeze(column);
    }
    for (const array of [table.columns, table.indexes, table.primaryKey, table.primaryKeyTerms, table.storageKey, table.checks, table.foreignKeys, table.referencedBy])
        Object.freeze(array);
    return Object.freeze(table);
}
const graphs = new WeakMap();
/**
 * Translate prepare.c sqlite3InitOne/sqlite3InitCallback for the supported
 * table, index, view and retained trigger construction tranche. Root page 1 is read via the
 * existing connection storage owner; every graph value is detached from cursor borrows.
 */
export function canonicalSchemaCatalog(connection) {
    const graph = loadSchemaGraph(connection);
    return graph.objects.map(object => `${object.kind}\t${object.name}\t${object.tableName}\t${object.sql ?? ""}\n`).join("");
}
/** Source-free SELECTs do not invoke sqlite3LocateTable/schema initialization.
 * This uncached empty carrier supplies compiler contracts without publishing a
 * failed catalog initialization as successfully loaded. */
export function sourceFreeSchemaGraph(connection) {
    return new SchemaGraph(connection, btreeFromConnection(connection).encoding, [], new Map(), new Map(), new Map());
}
export function loadSchemaGraph(connection, context = {}) {
    const key = connection;
    const prior = graphs.get(key);
    if (prior) {
        prior.assertOpen();
        return prior;
    }
    let database;
    try {
        database = btreeFromConnection(connection);
    }
    catch (error) {
        if (error instanceof BtreeCursorStateError)
            throw new SchemaStateError(error.message);
        throw error;
    }
    const rows = [];
    try {
        const cursor = database.tableCursor(1);
        if (cursor.first())
            do
                rows.push(row(cursor.payload(), database.encoding));
            while (cursor.next());
    }
    catch (error) {
        if (error instanceof SchemaFormatError || error instanceof SchemaUnsupportedError)
            throw error;
        if (error instanceof BtreeFormatError || error instanceof RecordFormatError)
            malformed(error.message, error);
        throw error;
    }
    const objects = [];
    const tables = new Map();
    const indexes = new Map();
    const views = new Map();
    const triggers = new Map();
    let triggerBytes = 0;
    const names = new Set();
    // prepare.c:sqlite3InitOne/build.c:sqlite3StartTable synthesize a Table at
    // root 1 before parsing persisted declarations. It is not a catalog row.
    // The substituted legacy name is the same identity used by sqlite3FindTable.
    const schemaTable = { type: "table", name: "sqlite_master", tableName: "sqlite_master", rootPage: 1,
        sql: "CREATE TABLE sqlite_master(type text,name text,tbl_name text,rootpage int,sql text)" };
    for (const item of [schemaTable, ...rows]) {
        const folded = sqliteAsciiFold(item.name);
        if (item.type !== "trigger") {
            if (names.has(folded))
                malformed(`duplicate object name ${item.name}`);
            names.add(folded);
        }
        if (item.type === "table") {
            if (item.sql === null)
                malformed(`table ${item.name} has null SQL`);
            const ddl = parseDdl(item.sql, "create-table", item.name);
            if (ddl.tableAsSelect)
                throw new SchemaUnsupportedError(`CREATE TABLE AS construction is not implemented: ${item.name}`);
            if (item.rootPage < 1 || item.rootPage > database.pageCount)
                malformed(`invalid root page for ${item.name}`);
            let defaultIndex = 0;
            const declaredPrimary = ddl.primaryKey.length ? ddl.primaryKey : ddl.columns.filter(column => column.primaryKey).map(column => column.name);
            // build.c sqlite3AddPrimaryKey/makeColumnPartOfPrimaryKey run before
            // EndTable STRICT validation; declaration errors must win over types.
            for (const name of declaredPrimary) {
                const column = ddl.columns.find(column => sqliteIdentifierEqual(column.name, name));
                if (!column)
                    malformed(`no such column: ${name}`);
                if (column.generatedExpr)
                    malformed('generated columns cannot be part of the PRIMARY KEY');
            }
            // build.c sqlite3EndTable STRICT pass: validate in declaration order,
            // after PK declaration has selected the INTEGER rowid alias.
            const strictRowidAlias = !ddl.withoutRowid && declaredPrimary.length === 1
                ? ddl.columns.find(column => sqliteIdentifierEqual(column.name, declaredPrimary[0]) &&
                    column.declaredType?.toUpperCase() === "INTEGER" && (ddl.primaryKey.length > 0 || !column.primaryKeyDescending))?.name ?? null : null;
            if (ddl.strict)
                for (const column of ddl.columns) {
                    const type = column.declaredType?.toUpperCase();
                    if (!type)
                        malformed(`missing datatype for ${item.name}.${column.name}`);
                    if (!["INT", "INTEGER", "REAL", "TEXT", "BLOB", "ANY"].includes(type))
                        malformed(`unknown datatype for ${item.name}.${column.name}: "${column.declaredType}"`);
                }
            const columns = Object.freeze(ddl.columns.map(column => Object.freeze({ name: column.name, declaredType: item === schemaTable ? column.declaredType?.toUpperCase() ?? null : column.declaredType, ...columnTypeEstimate(column.declaredType), ...(ddl.strict && column.declaredType?.toUpperCase() === "ANY" ? { affinity: "blob" } : {}), defaultExpr: column.defaultExpr, generatedExpr: column.generatedExpr, defaultIndex: column.defaultExpr ? defaultIndex++ : null, notNull: column.notNull || ((ddl.withoutRowid || (ddl.strict && !sqliteIdentifierEqual(strictRowidAlias ?? "", column.name))) && declaredPrimary.some(name => sqliteIdentifierEqual(name, column.name))), primaryKeyPosition: (() => { const at = declaredPrimary.findIndex(name => sqliteIdentifierEqual(name, column.name)); return at < 0 ? null : at + 1; })(), unique: column.unique, collation: column.collation, generatedStorage: column.generatedStorage, checks: [] })));
            const declaredPrimaryKey = Object.freeze(declaredPrimary.map(name => { const column = columns.find(candidate => sqliteIdentifierEqual(candidate.name, name)); if (!column)
                malformed(`primary key refers to unknown column ${name}`); return column; }));
            const declaredPrimaryKeyTerms = Object.freeze(declaredPrimaryKey.map((column, index) => { const declared = ddl.primaryKeyTerms[index]; return Object.freeze({ column, expression: null, expressionSql: null, descending: declared?.descending ?? ddl.columns.find(candidate => sqliteIdentifierEqual(candidate.name, column.name))?.primaryKeyDescending ?? false, collation: declared?.collation ?? column.collation, nulls: declared?.nulls ?? null }); }));
            // build.c equivalent UNIQUE/PK constraints retain the first index's
            // direction. The WR physical primary must consume that retained owner
            // before duplicate-key compaction and storage layout are constructed.
            const effectivePrimaryKeyTerms = ddl.withoutRowid
                ? implicitIndexDefinitions({ columns, name: item.name, integerPrimaryKey: null, withoutRowid: true }, ddl).find(index => index.primary)?.terms ?? declaredPrimaryKeyTerms
                : declaredPrimaryKeyTerms;
            // build.c convertToWithoutRowidTable/isDupColumn: collapse only
            // identical column+collation pairs, keeping the first sort direction.
            // Distinct collations on the same column remain distinct key fields.
            const retainedPrimaryKeyTerms = [];
            for (const term of effectivePrimaryKeyTerms) {
                if (ddl.withoutRowid && retainedPrimaryKeyTerms.some(prior => prior.column === term.column && sqliteIdentifierEqual(prior.collation ?? "BINARY", term.collation ?? "BINARY")))
                    continue;
                retainedPrimaryKeyTerms.push(term);
            }
            const primaryKeyTerms = Object.freeze(retainedPrimaryKeyTerms);
            const primaryKey = Object.freeze(primaryKeyTerms.map(term => term.column));
            // For WITHOUT ROWID, the declared PK is the b-tree storage key. Rowid
            // tables retain their implicit rowid key, represented by an empty list.
            const storageKey = ddl.withoutRowid ? primaryKey : Object.freeze([]);
            const integerPrimaryKey = ddl.withoutRowid ? null : declaredIntegerPrimaryKey(columns, ddl);
            const checks = Object.freeze(ddl.checks.map(check => { const column = check.columnName === null ? null : columns.find(candidate => sqliteIdentifierEqual(candidate.name, check.columnName)) ?? null; if (check.columnName !== null && !column)
                malformed(`CHECK refers to unknown column ${check.columnName}`); const node = Object.freeze({ name: check.name, column, expr: check.expr, sql: check.tokens.map(token => token.text).join(" ") }); if (column)
                column.checks.push(node); return node; }));
            for (const column of columns)
                Object.freeze(column.checks);
            const foreignKeys = Object.freeze(ddl.foreignKeys.map(foreign => { if (foreign.referencedColumns && foreign.referencedColumns.length !== foreign.columns.length)
                malformed("number of columns in foreign key does not match referenced columns"); const links = Object.freeze(foreign.columns.map((name, index) => { const column = columns.find(candidate => sqliteIdentifierEqual(candidate.name, name)); if (!column)
                malformed(`unknown column ${name} in foreign key definition`); return Object.freeze({ column, referencedColumn: foreign.referencedColumns?.[index] ?? null }); })); return { name: foreign.name, columns: links, referencedTableName: foreign.referencedTable, referencedTable: null, onDelete: foreign.onDelete, onUpdate: foreign.onUpdate, deferrable: foreign.deferrable, initiallyDeferred: foreign.initiallyDeferred, sql: foreign.tokens.map(token => token.text).join(" ") }; }));
            const table = { integerPrimaryKey, szTabRow: sqliteLogEst(BigInt((columns.reduce((n, c) => n + c.szEst, 0) + (integerPrimaryKey === null ? 1 : 0)) * 4)), nRowLogEst: 200, hasStat1: false, kind: "table", name: item.name, tableName: item.tableName, rootPage: item.rootPage, sql: item.sql, columns, indexes: [], strict: ddl.strict, withoutRowid: ddl.withoutRowid, primaryKey, primaryKeyTerms, storageKey, checks, foreignKeys, referencedBy: [] };
            // build.c:sqlite3EndTable resolves every generating expression through
            // resolve.c:sqlite3ResolveSelfReference, including STORED definitions.
            // Resolve names/functions without expanding dependencies: cycles belong
            // to expr.c's later compile-local BUSY guard, not schema initialization.
            const self = { table, cursorId: -1, tableName: table.name, databaseName: null, arguments: null, alias: null, indexedBy: null, notIndexed: false, on: null, using: null, leftOfRightJoin: false, joinFromLeft: { inner: true, cross: false, natural: false, left: false, right: false, outer: false, error: false } };
            try {
                for (let i = 0; i < columns.length; i++)
                    if (columns[i].generatedExpr)
                        resolvedGeneratedExpressionCarrier(self, i);
            }
            catch (error) {
                if (error instanceof NameResolutionError)
                    throw new SchemaFormatError(`malformed database schema (${item.name}) - ${error.message}`, { cause: error });
                throw error;
            }
            tables.set(folded, table);
        }
    }
    for (const table of tables.values())
        for (const foreign of table.foreignKeys) {
            const target = tables.get(sqliteAsciiFold(foreign.referencedTableName)) ?? null;
            foreign.referencedTable = target;
            if (target)
                target.referencedBy.push(foreign);
            Object.freeze(foreign);
        }
    // WITHOUT ROWID PRIMARY KEY indexes have no sqlite_schema row: build.c
    // aliases that index to the table root. Publish the immutable physical owner
    // before secondary indexes are linked.
    for (const table of tables.values())
        if (table.withoutRowid) {
            if (!table.primaryKey.length)
                malformed(`WITHOUT ROWID table ${table.name} has no PRIMARY KEY`);
            const terms = table.primaryKeyTerms;
            const definitions = implicitIndexDefinitions(table, parseDdl(table.sql, "create-table", table.name));
            const ordinal = definitions.findIndex(definition => definition.primary) + 1;
            if (ordinal < 1)
                malformed(`WITHOUT ROWID table ${table.name} has no primary index definition`);
            const name = `sqlite_autoindex_${table.name}_${ordinal}`;
            const index = { kind: "index", name, tableName: table.tableName, rootPage: table.rootPage, sql: null, table, terms, unique: true, onError: definitions[ordinal - 1].onError, origin: "primary-key", partialWhere: null, physical: null };
            index.layout = physicalIndexLayout(index);
            index.physical = physicalIndex(index, database.encoding);
            linkIndex(table, index);
            indexes.set(sqliteAsciiFold(name), index);
        }
    // Automatic indexes are produced by table grammar before APPDEF schema rows.
    // Materialize retained grammar linkage once, then let each APPDEF insertion
    // perform source exit_create_index cleanup on that actual list.
    let implicitPublished = false;
    const automaticRows = rows.filter(item => item.type === "index" && item.sql === null);
    for (const item of [...automaticRows, ...rows.filter(item => !(item.type === "index" && item.sql === null))]) {
        if (!implicitPublished && !(item.type === "index" && item.sql === null)) {
            for (const table of tables.values()) {
                const definitions = implicitIndexDefinitions(table, parseDdl(table.sql, "create-table", table.name));
                const byOrdinal = new Map(table.indexes.map(index => [Number(index.name.slice(index.name.lastIndexOf("_") + 1)) - 1, index]));
                const linked = [];
                definitions.forEach((definition, ordinal) => {
                    const index = byOrdinal.get(ordinal);
                    if (index)
                        linked[definition.listPosition] = index;
                });
                table.indexes.splice(0, table.indexes.length, ...linked.filter(index => index !== undefined));
            }
            implicitPublished = true;
        }
        const folded = sqliteAsciiFold(item.name);
        if (item.type === "table")
            continue;
        if (item.type === "index") {
            const table = tables.get(sqliteAsciiFold(item.tableName));
            if (!table)
                malformed(`index ${item.name} refers to unknown table ${item.tableName}`);
            if (item.rootPage < 1 || item.rootPage > database.pageCount)
                malformed(`invalid root page for ${item.name}`);
            if (item.sql === null) {
                // build.c:sqlite3CreateIndex constructs persistent automatic indexes
                // for PRIMARY KEY and UNIQUE constraints. These are existing on-disk
                // b-trees, not OP_OpenAutoindex/runtime index construction.
                const primary = table.primaryKey;
                const rowidAlias = table.integerPrimaryKey !== null;
                const ddl = parseDdl(table.sql, "create-table", table.name);
                const implicit = implicitIndexDefinitions(table, ddl);
                const prefix = `sqlite_autoindex_${table.name}_`, ordinal = item.name.startsWith(prefix) ? Number(item.name.slice(prefix.length)) : NaN, definition = implicit[ordinal - 1], terms = definition?.terms;
                if (!Number.isSafeInteger(ordinal) || ordinal < 1 || !terms)
                    throw new SchemaUnsupportedError(`automatic index construction is not implemented: ${item.name}`);
                const index = { kind: "index", name: item.name, tableName: item.tableName, rootPage: item.rootPage, sql: null, table, terms, unique: true, onError: definition.onError, origin: definition.primary ? "primary-key" : "unique", partialWhere: null, physical: null };
                index.layout = physicalIndexLayout(index);
                index.physical = physicalIndex(index, database.encoding);
                linkIndex(table, index);
                indexes.set(folded, index);
                continue;
            }
            const ddl = parseDdl(item.sql, "create-index", item.name);
            if (ddl.tableName === null || !sqliteIdentifierEqual(ddl.tableName, item.tableName))
                malformed(`index ${item.name} has mismatched table name`);
            const terms = Object.freeze(ddl.indexTerms.map(term => {
                const tokens = term.expr.tokens;
                const simple = tokens.length === 1 && (tokens[0].kind === "id" || tokens[0].kind === "keyword") ? identifier(tokens[0]) : null;
                const column = simple === null ? null : table.columns.find(candidate => sqliteIdentifierEqual(candidate.name, simple)) ?? null;
                if (simple !== null && !column)
                    malformed(`index refers to unknown column ${simple}`);
                return Object.freeze({ column, expression: column ? null : term.expr, expressionSql: column ? null : tokens.map(token => token.text).join(" "), descending: term.descending, collation: term.collation, nulls: term.nulls });
            }));
            const index = { kind: "index", name: item.name, tableName: item.tableName, rootPage: item.rootPage, sql: item.sql, table, terms, unique: ddl.indexUnique, onError: ddl.indexUnique ? "abort" : "none", origin: "create", partialWhere: ddl.indexWhere, physical: null };
            index.layout = physicalIndexLayout(index);
            index.physical = physicalIndex(index, database.encoding);
            linkIndex(table, index);
            indexes.set(folded, index);
        }
        else if (item.type === "view") {
            if (item.rootPage !== 0 || item.sql === null)
                malformed(`invalid view ${item.name}`);
            const ddl = parseDdl(item.sql, "create-view", item.name);
            if (!ddl.select)
                malformed(`view ${item.name} has no SELECT`);
            const selectSql = ddl.select.tokens.map(token => token.text).join(" ");
            const view = { kind: "view", name: item.name, tableName: item.tableName, rootPage: 0, sql: item.sql, selectSql, select: ddl.select, columns: ddl.viewColumns };
            views.set(folded, Object.freeze(view));
        }
        else if (item.type === "trigger") {
            // Defer linkage until every table/view exists (prepare.c schema loading).
            // Parsing still occurs here so malformed SQL is not silently bypassed.
            if (item.rootPage !== 0 || item.sql === null)
                malformed(`invalid trigger ${item.name}`);
            parseTrigger(item);
        }
        else
            malformed(`unknown object type ${item.type}`);
    }
    for (const item of rows)
        if (item.type === "trigger") {
            if (triggers.has(sqliteAsciiFold(item.name)))
                throw new SchemaFormatError(`malformed database schema (${item.name}) - trigger ${item.name} already exists`);
            const ddl = parseTrigger(item), declaration = ddl.trigger;
            function triggerError(message) { throw new SchemaFormatError(`malformed database schema (${item.name}) - ${message}`); }
            if (!declaration)
                triggerError(`invalid trigger ${item.name}`);
            if (declaration.temporary)
                throw new SchemaUnsupportedError(`persisted temporary trigger initialization is not implemented: ${item.name}`);
            if (declaration.databaseName)
                triggerError("corrupt database");
            if (sqliteAsciiFold(declaration.name).startsWith("sqlite_"))
                triggerError(`object name reserved for internal use: ${declaration.name}`);
            const target = tables.get(sqliteAsciiFold(declaration.tableName)) ?? views.get(sqliteAsciiFold(declaration.tableName));
            if (!target)
                triggerError(`no such table: main.${declaration.tableName}`);
            if (!sqliteIdentifierEqual(item.tableName, declaration.tableName))
                triggerError(`trigger table mismatch: ${item.name}`);
            if (target.kind === "view" && declaration.timing !== "instead")
                triggerError(`cannot create ${declaration.timing.toUpperCase()} trigger on view: ${target.name}`);
            if (target.kind === "table" && declaration.timing === "instead")
                triggerError(`cannot create INSTEAD OF trigger on table: ${target.name}`);
            if (sqliteAsciiFold(target.name).startsWith("sqlite_"))
                triggerError(`cannot create trigger on system table: ${target.name}`);
            validateTriggerSteps(declaration, triggerError);
            // Logical retained declaration/fixed-tree envelope. This is not a claim
            // about host heap size; the file/SQL/parser bounds still own construction.
            const count = (node) => { let total = 0; const pending = [node]; while (pending.length) {
                const value = pending.pop();
                total++;
                if (value.kind === "reduction")
                    for (const child of value.children)
                        pending.push(child);
            } return total; };
            triggerBytes += 128 + 2 * item.sql.length + 128 * (declaration.steps.reduce((sum, step) => sum + count(step.reduction), 0) + (declaration.when?.reduction ? count(declaration.when.reduction) : 0));
            context.check?.("load", 1);
            const fixError = (message) => triggerError(`trigger ${declaration.name} ${message}`);
            const fixContext = triggerFixContext();
            const initializedSteps = Object.freeze(declaration.steps.map(step => initializeTriggerStep(step, fixError, fixContext)));
            const initializedWhen = declaration.when?.reduction ? initializeTriggerTree(declaration.when.reduction, fixError, false, fixContext) : null;
            triggers.set(sqliteAsciiFold(item.name), Object.freeze({ kind: "trigger", name: item.name, tableName: item.tableName, rootPage: 0, sql: item.sql, target, declaration, initializedSteps, initializedWhen }));
        }
    // All physical identities exist before estimates; no competing stat owner.
    for (const index of indexes.values()) {
        const m = index;
        m.szIdxRow = sqliteLogEst(BigInt(index.layout.fields.reduce((n, f) => n + (f.column?.szEst ?? 1), 0) * 4));
        m.hasStat1 = false;
        m.unordered = false;
        m.noSkipScan = false;
        defaultRowEst(index);
    }
    // analyze.c:sqlite3AnalysisLoad/analysisLoader. sqlite_stat1 is an ordinary
    // rowid b-tree, not a schema declaration. Decode using the database encoding;
    // never expose unsupported stat tokens as plausible planner estimates.
    const callbackKey = (name) => { let key = ""; for (const byte of new TextEncoder().encode(name))
        key += String.fromCharCode(byte); return sqliteAsciiFold(key); };
    const callbackTables = new Map([...tables.values()].map(table => [callbackKey(table.name), table]));
    const callbackIndexes = new Map([...indexes.values()].map(index => [callbackKey(index.name), index]));
    const rawEstimates = new Map();
    const statTable = tables.get("sqlite_stat1");
    if (statTable) {
        const cursor = database.tableCursor(statTable.rootPage);
        if (cursor.first())
            do {
                context.check?.("load", 1);
                let values;
                try {
                    values = decodeRecord(cursor.payload(), database.encoding).values;
                }
                catch (error) {
                    throw new SchemaFormatError("invalid sqlite_stat1 record", { cause: error });
                }
                if (values.length !== 3)
                    malformed("sqlite_stat1 record must have three fields");
                const [tableName, indexName, stat] = values.map(value => callbackText(value, database.encoding));
                if (tableName == null || stat == null)
                    continue;
                const table = callbackTables.get(sqliteAsciiFold(tableName));
                if (!table)
                    continue;
                const index = indexName == null ? undefined : sqliteIdentifierEqual(tableName, indexName) ? table.indexes.find(i => i.origin === "primary-key") : callbackIndexes.get(sqliteAsciiFold(indexName));
                const mt = table;
                if (index) {
                    const decoded = decodeEstimates(stat, [...index.rowLogEst], index.szIdxRow), mi = index;
                    rawEstimates.set(index, decodeStat4Counts(stat, index.terms.length + 1, rawEstimates.get(index)));
                    mi.rowLogEst = decoded.rows;
                    mi.szIdxRow = decoded.width;
                    mi.unordered = decoded.unordered;
                    mi.noSkipScan = decoded.noSkipScan;
                    mi.hasStat1 = true;
                    if (!index.partialWhere) {
                        mt.nRowLogEst = decoded.rows[0];
                        mt.hasStat1 = true;
                    }
                }
                else {
                    const decoded = decodeEstimates(stat, [table.nRowLogEst], table.szTabRow);
                    mt.nRowLogEst = decoded.rows[0];
                    mt.szTabRow = decoded.width;
                    mt.hasStat1 = true;
                }
            } while (cursor.next());
    }
    for (const index of indexes.values())
        if (!index.hasStat1)
            defaultRowEst(index);
    const stat4Table = tables.get("sqlite_stat4");
    let sampleStates = new Map();
    if (stat4Table && !stat4Table.withoutRowid) {
        const stat4Rows = function* () {
            const cursor = database.tableCursor(stat4Table.rootPage);
            if (cursor.first())
                do {
                    context.check?.("load", 1);
                    const values = decodeRecord(cursor.payload(units => context.check?.("copy", units)), database.encoding).values;
                    if (values.length !== 6)
                        malformed("sqlite_stat4 record must have six fields");
                    const name = callbackText(values[1], database.encoding);
                    const sample = values[5];
                    // sqlite3_column_blob includes native numeric/text conversion.
                    const mem = new Mem();
                    if (sample.storageClass === "blob")
                        mem.setBlob(sample.bytes);
                    else if (sample.storageClass === "text")
                        mem.setText(sample.bytes, database.encoding);
                    else if (sample.storageClass === "integer")
                        mem.setInt64(sample.value);
                    else if (sample.storageClass === "real")
                        mem.setDouble(sample.value);
                    try {
                        // analyze.c calls column_bytes (UTF8) before column_blob. ValueBytes
                        // preserves BLOB/NULL, but converts TEXT and stringifies numeric Mem
                        // in UTF8; the subsequent blob accessor returns those same bytes.
                        // Keep the conversion in this row's Mem owner through both passes.
                        if (sample.storageClass !== "blob" && sample.storageClass !== "null")
                            mem.stringify("utf-8");
                        const bytes = sample.storageClass === "null" ? new Uint8Array() : sample.storageClass === "blob" ? sample.bytes : mem.textBytes();
                        yield { name, neq: callbackText(values[2], database.encoding), nlt: callbackText(values[3], database.encoding), ndlt: callbackText(values[4], database.encoding), bytes };
                    }
                    finally {
                        mem.release();
                    }
                } while (cursor.next());
        };
        sampleStates = loadStat4Samples(stat4Rows, name => {
            const direct = callbackIndexes.get(sqliteAsciiFold(name));
            if (direct)
                return direct;
            const table = callbackTables.get(sqliteAsciiFold(name));
            return table?.withoutRowid ? table.indexes.find(i => i.origin === "primary-key") ?? null : null;
        }, index => ({ nSampleCol: index.table.withoutRowid && index.origin === "primary-key" ? index.terms.length : index.layout.fields.length, nKeyCol: index.terms.length, aiRowEst: rawEstimates.get(index) ?? null }), { maxBytes: context.maxStat4Bytes ?? connection[storageOwner].schemaAllowance, ...(context.check ? { check: context.check } : {}) });
    }
    rawEstimates.clear();
    let schemaBytes = triggerBytes;
    for (const index of indexes.values()) {
        const state = sampleStates.get(index);
        if (state) {
            schemaBytes += state.mxSample * (40 + 24 * state.nSampleCol) + 8 * state.nSampleCol;
            for (const sample of state.samples) {
                schemaBytes += sample.n + 8;
                Object.freeze(sample.anEq);
                Object.freeze(sample.anLt);
                Object.freeze(sample.anDLt);
                Object.freeze(sample);
            }
            Object.freeze(state.samples);
            Object.freeze(state.aAvgEq);
            Object.freeze(state);
        }
        index.stat4 = state ?? null;
        Object.freeze(index.rowLogEst);
        Object.freeze(index);
    }
    // Restore physical sqlite_schema declaration order after cross-linking tables.
    const byName = new Map([...tables, ...indexes, ...views]);
    for (const item of rows) {
        const object = item.type === "trigger" ? triggers.get(sqliteAsciiFold(item.name)) : byName.get(sqliteAsciiFold(item.name));
        if (object)
            objects.push(object);
    }
    for (const table of tables.values()) {
        Object.freeze(table.indexes);
        Object.freeze(table.referencedBy);
        Object.freeze(table);
    }
    const graph = new SchemaGraph(connection, database.encoding, objects, tables, indexes, views, triggers);
    context.check?.("finalize", 1);
    connection[storageOwner].publishSchema(schemaBytes, () => { graphs.delete(key); });
    graphs.set(key, graph);
    return graph;
}
