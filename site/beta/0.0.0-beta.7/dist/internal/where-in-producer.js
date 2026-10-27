import { JSQLiteError } from "../index.js";
import { integerPrimaryKeyColumn } from "./schema.js";
/** expr.c isCandidateForInOpt/sqlite3FindInIndex, scalar IN_INDEX_LOOP.
 * Retain physical identity, not a second SELECT plan. LOOP requires uniqueness;
 * nullable UNIQUE entries are safe because codeINTerm skips every NULL. */
export function selectedInStorage(rhs, info, affinity) {
    const fallback = { kind: 'ephemeral', descending: false };
    const p = rhs.select, plan = rhs.resolved, result = plan.result[0], source = plan.sources[0];
    if (rhs.correlated || !rhs.scalar || p.hasCompound || p.hasDistinct || p.hasGroupBy || p.hasHaving || p.hasLimit || p.where || plan.windows.length || plan.sources.length !== 1 || !source || source.table.kind !== 'table' || p.from.derived || p.from.derivedSources?.length || p.from.cteDerived?.length || p.from.flattenedDerived || result?.expression.tokens.some(token => token.text.toUpperCase() === 'COLLATE') || result?.resolution !== 'direct' || result.source !== source || result.columnIndex === null)
        return fallback;
    const table = source.table, column = table.columns[result.columnIndex];
    if (!table.withoutRowid && (result.columnIndex < 0 || column === integerPrimaryKeyColumn(table)))
        return Object.freeze({ kind: 'rowid', table, descending: false });
    if (!column)
        return fallback;
    const numeric = (a) => a === 'integer' || a === 'real' || a === 'numeric' || a === 'flexnum';
    if (affinity === 'text' && column.affinity !== 'text')
        return fallback;
    if (affinity !== 'blob' && affinity !== 'text' && !numeric(column.affinity))
        return fallback;
    const collation = info.terms[0]?.collation ?? 'binary', name = typeof collation === 'string' ? collation : collation.kind;
    for (const index of table.indexes) {
        const physical = index.physical;
        if (!physical || !index.unique || index.partialWhere || index.terms.length !== 1 || index.terms[0]?.column !== column || physical.fields[0]?.collation !== name)
            continue;
        return Object.freeze({ kind: 'index', physical, descending: !!physical.fields[0]?.descending });
    }
    return fallback;
}
/** sqlite3FindInIndex LOOP: each RHS output maps to a distinct leading
 * index column with its own comparison collation. Repeated RHS columns cannot
 * reuse one physical slot twice; they use the ordinary UNIQUE SRT_Set path. */
export function selectedVectorInStorage(rhs, info, affinities) {
    const fallback = { kind: 'ephemeral', descending: false };
    const p = rhs.select, plan = rhs.resolved, source = plan.sources[0], width = plan.result.length;
    if (rhs.correlated || rhs.scalar || width < 2 || p.hasCompound || p.hasDistinct || p.hasGroupBy || p.hasHaving || p.hasLimit || p.where || plan.windows.length || plan.sources.length !== 1 || !source || source.table.kind !== 'table' || p.from.derived || p.from.derivedSources?.length || p.from.cteDerived?.length || p.from.flattenedDerived)
        return fallback;
    const table = source.table;
    const columns = plan.result.map(result => result.source === source && result.resolution === 'direct' && result.columnIndex !== null && !result.expression.tokens.some(token => token.text.toLowerCase() === 'collate') ? table.columns[result.columnIndex] : undefined);
    if (columns.some(column => !column) || affinities.length !== width || info.keyFieldCount !== width)
        return fallback;
    const numeric = (a) => a === 'integer' || a === 'real' || a === 'numeric' || a === 'flexnum';
    if (columns.some((column, i) => affinities[i] === 'text' ? column.affinity !== 'text' : affinities[i] !== 'blob' && !numeric(column.affinity)))
        return fallback;
    for (const index of table.indexes) {
        const physical = index.physical;
        if (!physical || !index.unique || index.partialWhere || index.terms.length !== width)
            continue;
        const used = new Set(), map = [];
        for (let i = 0; i < width; i++) {
            const collation = info.terms[i]?.collation ?? 'binary', name = typeof collation === 'string' ? collation : collation.kind;
            const field = index.terms.findIndex((term, j) => j < width && term.column === columns[i] && physical.fields[j]?.collation === name);
            if (field < 0 || used.has(field))
                break;
            used.add(field);
            map.push(field);
        }
        if (map.length === width)
            return Object.freeze({ kind: 'index', physical, descending: !!physical.fields[0]?.descending, fieldMap: Object.freeze(map) });
    }
    return fallback;
}
/** expr.c sqlite3FindInIndex / sqlite3CodeRhsOfIN, scalar LOOP branches.
 * Eligible base-table ROWID/UNIQUE indices retain physical identity. Otherwise
 * the linked SELECT compiler owns UNIQUE SRT_Set production and parameters.
 * The caller iterates the resulting cursor through WhereInLoop. */
export function emitSelectedInRhs(builder, rhs, keyInfo, affinity, emitSelect, storage = { kind: 'ephemeral', descending: false }) {
    // Reject unsupported construction before consuming cursor/register identity.
    const affinities = typeof affinity === 'string' ? [affinity] : affinity;
    const width = rhs.resolved.result.length;
    if (!rhs.scalar && width < 2)
        throw new JSQLiteError('unsupported', 'selected SELECT IN requires a field contract', { unsupportedClassification: 'temporary' });
    // EP_VarSelect disallows statement-wide reuse. The caller owns readiness.
    if (rhs.correlated && storage.kind !== 'ephemeral')
        throw new JSQLiteError('internal', 'correlated RHS requires ephemeral storage');
    // exprINAffinity and SRT_Set describe every output before allocating state.
    if (affinities.length !== width || keyInfo.keyFieldCount !== width || keyInfo.totalFieldCount !== width)
        throw new JSQLiteError('internal', 'selected IN requires matching field affinities and KeyInfo');
    const fieldMap = storage.kind === 'index' && storage.fieldMap ? storage.fieldMap : Object.freeze(Array.from({ length: width }, (_, i) => storage.kind === 'rowid' ? -1 : i));
    const cursor = builder.cursor(), onceRegister = builder.register();
    const start = builder.ops.length;
    if (!rhs.correlated)
        builder.emit({ code: 'Once', p1: onceRegister, p2: 0 });
    if (storage.kind !== 'ephemeral') {
        builder.emit((storage.kind === 'index' ? { code: 'OpenIndex', p1: storage.physical.index.rootPage, p2: cursor, physical: storage.physical } : { code: 'OpenRead', p1: storage.table.rootPage, p2: cursor }));
        const end = builder.ops.length;
        if (!rhs.correlated)
            builder.ops[start] = { code: 'Once', p1: onceRegister, p2: end };
        return Object.freeze({ rhs, fieldMap, cursor, keyInfo: storage.kind === 'index' ? storage.physical.keyInfo : keyInfo, destination: null, storage, onceRegister, start, end });
    }
    const packedRegister = builder.register();
    const destination = Object.freeze({ kind: 'set', cursor, width, affinities: Object.freeze([...affinities]), packedRegister });
    builder.emit({ code: 'OpenEphemeral', p1: cursor, keyInfo, p4KeyInfo: keyInfo });
    // Pass the original resolved SELECT, never reconstructed SQL or fake literals.
    emitSelect(rhs.resolved, destination);
    const end = builder.ops.length;
    if (!rhs.correlated)
        builder.ops[start] = { code: 'Once', p1: onceRegister, p2: end };
    return Object.freeze({ rhs, fieldMap, cursor, keyInfo, destination, storage, onceRegister, start, end });
}
