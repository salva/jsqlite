import type { SelectNode } from "./parse.ts";
import type { SchemaGraph } from "./schema.ts";
import type { BtreeDatabase } from "./btree.ts";
import type { Program } from "./vdbe.ts";
import { SelectProgramBuilder, type SelectDest } from "./select-program.ts";
import { compileAggregateSelect, compileCteUnionAll, compileMultipleRecursiveCtes, compileRecursiveAggregateSelect, compileRecursiveCteSelect, compileRecursiveWindowSelect, compileScalarSelect, compileTableSelect, selectHasAggregate, selectHasWindow } from "./vdbe.ts";

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
  // select.c:sqlite3Select dispatches a compound to multiSelect before
  // coding the rightmost arm's aggregate. Each arm owns its own aggregate
  // context; the rightmost expression must not classify the whole compound.
  if (select.hasCompound && !select.orderBy.length && !select.limit && !select.offset && select.arms.slice(1).every(arm=>arm.operatorFromPrior==='union-all') && select.arms.every(arm=>arm.origin==='select')) {
    // multiSelect receives the enclosing Parse/Vdbe and output destination.
    // Existing arm producers (including c's aggregate carriers) append to this
    // owner. Admission is complete before emission; exceptions are terminal.
    const builder = new SelectProgramBuilder<Program["ops"][number]>();
    const parameters = { maximum: 0, names: [] as (string | null)[], named: new Map<string, number>() };
    const destination: SelectDest = { kind: "output" };
    const compiled = compileCteUnionAll(select, schema, database, maxRows, maxWorkUnits, maxResultBytes, privateStateLimits, { builder, parameters, destination });
    if (compiled) {
      builder.ops.push({ code: "Halt" });
      return Object.freeze({ ops: builder.finish(), registers: builder.registers, encoding,
        columns: compiled.columns, parameters: Object.freeze(parameters.names.map(name => Object.freeze({ name }))),
        database, maxRows, maxWorkUnits, maxResultBytes, privateStateLimits });
    }
    // A pre-emission admission decline retains specialized legacy ownership.
    // No caught compiler error is permitted to enter that route.
    return compileTableSelect(select, schema, database, maxRows, maxWorkUnits, maxResultBytes, privateStateLimits);
  }
  // select.c:sqlite3Select dispatches the compound before any arm's
  // SF_Aggregate production. Keep this bounded ordered composer in that owner.
  if (select.hasCompound && select.from.items.length && !select.limit && !select.offset && select.arms.slice(1).every(arm=>arm.operatorFromPrior==='union-all') && select.orderBy.length===1 && select.result.length===1 && select.orderBy[0]!.expr.tokens.length===1 && select.orderBy[0]!.expr.tokens[0]!.text==='1') {
    return compileTableSelect(select, schema, database, maxRows, maxWorkUnits, maxResultBytes, privateStateLimits);
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
