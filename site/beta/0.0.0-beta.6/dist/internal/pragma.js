import { resolvedViewTable, NameResolutionError } from "./resolve.js";
import { pragmaNames } from "./pragma-names.js";
import { JSQLiteError } from "../index.js";
import { findSchemaTable } from "./schema.js";
import { sqliteAsciiFold } from "./sqlite-case.js";
export function pragmaNeedsSchema(node) {
    return ['table_info', 'table_xinfo', 'index_list', 'index_info', 'index_xinfo', 'foreign_key_list'].includes(sqliteAsciiFold(node.name));
}
export const TABLE_INFO_COLUMNS = Object.freeze(['cid', 'name', 'type', 'notnull', 'dflt_value', 'pk']);
export const TABLE_XINFO_COLUMNS = Object.freeze([...TABLE_INFO_COLUMNS, 'hidden']);
/** pragma.c INDEX_INFO: one field mapping for direct lowering and module rows.
 * Lookup and prepare/cursor lifetimes belong to the callers. Module checks run
 * after field reads but before row construction; direct emit checks after it. */
function* indexMetadataRows(index, extended, check) {
    const layout = index.layout;
    for (let i = 0; i < (extended ? layout.fields.length : layout.declaredFieldCount); i++) {
        const field = layout.fields[i], cid = field.column ? index.table.columns.indexOf(field.column) : field.expression ? -2 : -1;
        // Index.azColl spelling is distinct from folded KeyInfo lookup identity.
        const coll = field.collationName ?? (field.collation === 'binary' ? 'BINARY' : field.collation);
        check?.();
        yield [i, cid, field.column?.name ?? null, ...(extended ? [field.descending ? 1 : 0, coll, i < layout.declaredFieldCount ? 1 : 0] : [])];
    }
}
/** pragma.c TABLE_INFO owns these rows. Both direct lowering and private
 * eponymous cursors consume this traversal, never infer metadata from data rows. */
function* tableMetadataRows(table, extended, check) {
    let hidden = 0;
    for (const [i, col] of (table?.columns ?? []).entries()) {
        check();
        const isHidden = col.generatedStorage === 'virtual' ? 2 : col.generatedStorage === 'stored' ? 3 : 0;
        if (isHidden && !extended) {
            hidden++;
            continue;
        }
        yield [i - hidden, col.name, col.declaredType ?? '', col.notNull ? 1 : 0, isHidden ? null : col.defaultExpr?.sourceText ?? null, col.primaryKeyPosition ?? 0, ...(extended ? [isHidden] : [])];
    }
}
/** pragmaVtabFilter uses sqlite3_value_text (NULL stays NULL), then the
 * existing PRAGMA schema lookup. Hidden values are retained independently of
 * produced columns; xColumn returns NULL for absent schema, not default 'main'. */
export function metadataTableSource(schema, argument, database, extended, check) {
    const db = database === null ? null : sqliteAsciiFold(database);
    if (db !== null && db !== 'main' && db !== 'temp')
        throw new JSQLiteError('sqlite', `unknown database ${database}`, { code: 1 });
    if (argument === null || db === 'temp')
        return tableMetadataRows(undefined, extended, check);
    const key = sqliteAsciiFold(argument);
    let table = findSchemaTable(schema, key);
    if (!table && schema.views.has(key)) {
        check();
        try {
            table = resolvedViewTable(schema.views.get(key), { ...schema, viewMetadata: true, check });
        }
        catch (error) {
            if (error instanceof NameResolutionError)
                throw new JSQLiteError('sqlite', error.message, { code: 1 });
            throw error;
        }
        check();
    }
    return tableMetadataRows(table, extended, check);
}
export const METADATA_MODULE_COLUMNS = Object.freeze({
    pragma_database_list: ['seq', 'name', 'file'], pragma_table_info: TABLE_INFO_COLUMNS, pragma_table_xinfo: TABLE_XINFO_COLUMNS,
    pragma_index_list: ['seq', 'name', 'unique', 'origin', 'partial'], pragma_index_info: ['seqno', 'cid', 'name'], pragma_index_xinfo: ['seqno', 'cid', 'name', 'desc', 'coll', 'key'], pragma_foreign_key_list: ['id', 'seq', 'table', 'from', 'to', 'on_update', 'on_delete', 'match']
});
// pragma registry Result0 has no hidden fields; Result1+SchemaOpt has arg/schema.
export function metadataHiddenColumns(module) { return module === 'pragma_database_list' ? [] : ['arg', 'schema']; }
// Resident schema graph belongs to a connection. Refresh this immutable descriptor
// snapshot before SELECT compilation, never expose Fetch URL as a filename.
const metadataTempOpen = new WeakMap();
const metadataDatabases = new WeakMap();
export function setMetadataDatabases(schema, databases, openTemp) { metadataTempOpen.set(schema, openTemp); metadataDatabases.set(schema, Object.freeze(databases.map(db => Object.freeze({ ...db })))); }
export function metadataSource(schema, argument, database, module, check) {
    const db = database === null ? null : sqliteAsciiFold(database);
    if (db !== null && db !== 'main' && db !== 'temp')
        throw new JSQLiteError('sqlite', `unknown database ${database}`, { code: 1 });
    if (db === 'temp') {
        metadataTempOpen.get(schema)?.();
        const list = metadataDatabases.get(schema) ?? [{ sequence: 0, name: 'main', file: '' }];
        if (!list.some(db => db.name === 'temp'))
            metadataDatabases.set(schema, Object.freeze([...list, { sequence: 1, name: 'temp', file: '' }]));
    }
    return metadataRows(schema, argument, database, module, check);
}
function* metadataRows(schema, argument, database, module, check) {
    if (module === 'pragma_database_list') {
        for (const db of metadataDatabases.get(schema) ?? [{ sequence: 0, name: 'main', file: '' }]) {
            check();
            yield [db.sequence, db.name, db.file];
        }
        return;
    }
    if (module === 'pragma_table_info' || module === 'pragma_table_xinfo') {
        yield* metadataTableSource(schema, argument, database, module === 'pragma_table_xinfo', check);
        return;
    }
    const db = database === null ? null : sqliteAsciiFold(database);
    if (db !== null && db !== 'main' && db !== 'temp')
        throw new JSQLiteError('sqlite', `unknown database ${database}`, { code: 1 });
    if (argument === null || db === 'temp')
        return;
    const name = module.slice(7), key = sqliteAsciiFold(argument), table = findSchemaTable(schema, key);
    if (name === 'index_list') {
        for (const [i, index] of (table?.indexes ?? []).entries()) {
            check();
            yield [i, index.name, index.unique ? 1 : 0, { create: 'c', unique: 'u', 'primary-key': 'pk' }[index.origin], index.partialWhere ? 1 : 0];
        }
    }
    else if (name === 'index_info' || name === 'index_xinfo') {
        // pragma.c permits the WITHOUT ROWID table name as its PK index alias.
        const index = schema.indexes.get(key) ?? (table?.withoutRowid ? table.indexes.find(index => index.origin === 'primary-key') : undefined);
        if (index)
            yield* indexMetadataRows(index, name === 'index_xinfo', check);
    }
    else if (name === 'foreign_key_list') {
        // build.c sqlite3CreateForeignKey prepends pNextFrom. Schema retains DDL
        // declaration order; walk backwards to consume that linked-list order.
        const foreignKeys = table?.foreignKeys ?? [];
        for (let i = 0; i < foreignKeys.length; i++) {
            const fk = foreignKeys[foreignKeys.length - 1 - i];
            for (const [j, link] of fk.columns.entries()) {
                check();
                yield [i, j, fk.referencedTableName, link.column.name, link.referencedColumn, fk.onUpdate.replaceAll('-', ' ').toUpperCase(), fk.onDelete.replaceAll('-', ' ').toUpperCase(), 'NONE'];
            }
        }
    }
}
export function compilePragma(node, schema, maxRows, maxWorkUnits, maxResultBytes, privateStateLimits, check, databases) {
    const db = node.database === null ? null : sqliteAsciiFold(node.database);
    if (db !== null && db !== 'main' && db !== 'temp')
        throw new JSQLiteError('sqlite', `unknown database ${node.database}`, { code: 1 });
    const name = sqliteAsciiFold(node.name), extended = name === 'table_xinfo';
    // Explicit SPEC exclusions: these remain unavailable, never executed. Other
    // untranslated pragmas retain temporary classification rather than guessed rows.
    if (['wal_checkpoint', 'incremental_vacuum', 'optimize', 'journal_mode', 'writable_schema', 'locking_mode', 'load_extension', 'activate_extensions'].includes(name))
        throw new JSQLiteError('unsupported', 'mutating or extension PRAGMA is excluded', { unsupportedClassification: 'permanent' });
    // Do not infer read-only from '=': these arguments are identifiers, not writes.
    const resultNames = {
        table_info: [...TABLE_INFO_COLUMNS],
        table_xinfo: [...TABLE_XINFO_COLUMNS],
        index_list: ['seq', 'name', 'unique', 'origin', 'partial'],
        index_info: ['seqno', 'cid', 'name'], index_xinfo: ['seqno', 'cid', 'name', 'desc', 'coll', 'key'],
        database_list: ['seq', 'name', 'file'],
        foreign_key_list: ['id', 'seq', 'table', 'from', 'to', 'on_update', 'on_delete', 'match']
    };
    const names = resultNames[name] ?? (!pragmaNames.has(name) ? [] : undefined);
    if (!names)
        throw new JSQLiteError('unsupported', 'this PRAGMA is not implemented', { unsupportedClassification: 'temporary' });
    const ops = [];
    // vdbeaux.c sqlite3VdbeMultiLoad; single common VM emission owner.
    const emit = (values) => {
        check();
        values.forEach((value, j) => ops.push(value === null ? { code: 'Null', p2: j + 1 } : typeof value === 'number' ? { code: 'Integer', p1: BigInt(value), p2: j + 1 } : { code: 'String', p1: value, p2: j + 1 }));
        ops.push({ code: 'ResultRow', p1: 1, p2: values.length });
    };
    if (name === 'database_list') {
        for (const database of databases)
            emit([database.sequence, database.name, database.file]);
    }
    else if (names.length > 0 && node.argument !== null && db !== 'temp') {
        const key = sqliteAsciiFold(node.argument);
        let table = findSchemaTable(schema, key);
        if (name === 'index_list') {
            for (const [i, index] of (table?.indexes ?? []).entries())
                emit([i, index.name, index.unique ? 1 : 0, { create: 'c', unique: 'u', 'primary-key': 'pk' }[index.origin], index.partialWhere ? 1 : 0]);
        }
        else if (name === 'index_info' || name === 'index_xinfo') {
            // pragma.c permits the WITHOUT ROWID table name as its PK index alias.
            const index = schema.indexes.get(key) ?? (table?.withoutRowid ? table.indexes.find(index => index.origin === 'primary-key') : undefined);
            if (index)
                for (const values of indexMetadataRows(index, name === 'index_xinfo'))
                    emit(values);
        }
        else if (name === 'foreign_key_list') {
            // build.c sqlite3CreateForeignKey prepends pNextFrom. Schema retains DDL
            // declaration order; walk backwards to consume that linked-list order.
            const foreignKeys = table?.foreignKeys ?? [];
            for (let i = 0; i < foreignKeys.length; i++) {
                const fk = foreignKeys[foreignKeys.length - 1 - i];
                fk.columns.forEach((link, j) => emit([i, j, fk.referencedTableName, link.column.name, link.referencedColumn, fk.onUpdate.replaceAll('-', ' ').toUpperCase(), fk.onDelete.replaceAll('-', ' ').toUpperCase(), 'NONE']));
            }
        }
        else {
            for (const values of metadataTableSource(schema, node.argument, node.database, extended, check))
                emit(values);
        }
    }
    ops.push({ code: 'Halt' });
    return { ops, registers: 9, columns: names.map(name => ({ name, declaredType: null, database: null, table: null, origin: null })), parameters: [], encoding: schema.encoding, maxRows, maxWorkUnits, maxResultBytes, privateStateLimits };
}
/** pragmaVtabConnect declares arg/schema HIDDEN. vtab.c removes HIDDEN from
 * their allocated type string, leaving empty (not absent); visible untyped
 * columns have no type allocation. Preserve that distinction in SELECT metadata. */
export function metadataColumnDeclaredType(origin) {
    return origin === 'arg' || origin === 'schema' ? '' : null;
}
