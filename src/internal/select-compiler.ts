import type { SelectNode } from "./parse.ts";
import type { SchemaGraph } from "./schema.ts";
import type { BtreeDatabase } from "./btree.ts";
import type { Program } from "./vdbe.ts";
import { compileAggregateSelect, compileMultipleRecursiveCtes, compileRecursiveAggregateSelect, compileRecursiveCteSelect, compileRecursiveWindowSelect, compileScalarSelect, compileTableSelect, selectHasAggregate, selectHasWindow } from "./vdbe.ts";

/**
 * Production SELECT program entry. The graph has already passed public parse,
 * schema acquisition, CTE lowering and whole-graph admission. The recursive
 * generators return undefined only when their shape is not theirs; once chosen,
 * any compilation error must propagate rather than try a different generator.
 *
 * select.c:sqlite3Select / selectInnerLoop separate resolution, destination and
 * code generation. These currently independent generators still own their
 * respective destinations; consolidating their register/cursor builders requires
 * migrating those consumers, not replacing their programs after construction.
 */
export function compileSelect(
  select: SelectNode,
  schema: SchemaGraph,
  database: BtreeDatabase,
  encoding: Program["encoding"],
  maxRows: number,
  maxWorkUnits: number,
  maxResultBytes: number,
  privateStateLimits: Program["privateStateLimits"],
  recursive: boolean,
): Program {
  if (recursive) {
    return compileRecursiveWindowSelect(select, schema, database, maxRows, maxWorkUnits, maxResultBytes, privateStateLimits)
      ?? compileRecursiveAggregateSelect(select, encoding, maxWorkUnits, maxResultBytes, privateStateLimits, maxRows)
      ?? compileMultipleRecursiveCtes(select, encoding, maxWorkUnits, maxResultBytes, privateStateLimits, maxRows)
      ?? compileRecursiveCteSelect(select, encoding, maxWorkUnits, maxResultBytes, privateStateLimits, maxRows);
  }
  const aggregate = selectHasAggregate(select) || select.hasGroupBy || select.hasHaving;
  const window = selectHasWindow(select);
  const jsonTableAggregate = aggregate && select.from.items.length === 1 &&
    ["json_each", "json_tree", "jsonb_each", "jsonb_tree"].includes(select.from.items[0]!.tableName.toLowerCase());
  if (aggregate && !window && !jsonTableAggregate) {
    return compileAggregateSelect(select, schema, database, maxRows, maxWorkUnits, maxResultBytes, privateStateLimits);
  }
  if (select.from.items.length || select.where) {
    return compileTableSelect(select, schema, database, maxRows, maxWorkUnits, maxResultBytes, privateStateLimits);
  }
  return compileScalarSelect(select, encoding, maxWorkUnits, maxResultBytes, privateStateLimits, schema, database, maxRows);
}
