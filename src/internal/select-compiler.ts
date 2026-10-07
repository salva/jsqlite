import { sqliteAsciiFold } from './sqlite-case.ts';
import { NameResolutionError, expandAndResolveSelect, type ResolvedSelect } from './resolve.ts';
import { JSQLiteError } from '../index.ts';
import type { SelectNode } from "./parse.ts";
import type { SchemaGraph } from "./schema.ts";
import type { BtreeDatabase } from "./btree.ts";
import type { Program } from "./vdbe.ts";
import { SelectProgramBuilder, emitSelectDestination, type SelectDest } from "./select-program.ts";
import { compileAggregateSelect, compileCteUnionAll, compileOrderedCteUnionAll, compileMultipleRecursiveCtes, compileRecursiveAggregateSelect, compileRecursiveCteSelect, compileRecursiveWindowSelect, compileScalarSelect, compileTableSelect, selectHasAggregate, selectHasWindow } from "./vdbe.ts";

/**
 * Production SELECT program entry. The graph has already passed public parse,
 * schema acquisition, CTE lowering and whole-graph admission. The recursive
 * generators return undefined only when their shape is not theirs; once chosen,
 * any compilation error must propagate rather than try a different generator.
 *
 * select.c:sqlite3Select / selectInnerLoop separate resolution, destination and
 * code generation. Admitted production generators consume the enclosing builder,
 * parameters and destination; specialized algorithms retain their source-shaped
 * schedules. Publication belongs to the enclosing entry, not relocated child
 * Programs. This construction ownership is separate from VM execution control.
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
  progressCheck?:()=>void,
): Program {
  if (recursive) {
    // Specialized recursive consumers retain their current admission. A
    // selected compiler error is terminal; only undefined declines the branch.
    {
      const builder = new SelectProgramBuilder<Program["ops"][number]>(progressCheck);
      const parameters = { maximum: 0, names: [] as (string | null)[], named: new Map<string, number>() };
      const destination: SelectDest = { kind: "output" };
      const windowProgram = compileRecursiveWindowSelect(select, schema, database, maxRows, maxWorkUnits, maxResultBytes, privateStateLimits, { builder, parameters, destination });
      if (windowProgram) {
        builder.ops.push({ code: "Halt" });
        return Object.freeze({ ...windowProgram, ops: builder.finish(), registers: builder.registers });
      }
    }
    // The ordinary recursive aggregate consumer shares enclosing Parse allocation and output.
    // Admission declines before emission; selected diagnostics are terminal.
    {
      const builder = new SelectProgramBuilder<Program["ops"][number]>(progressCheck);
      const parameters = { maximum: 0, names: [] as (string | null)[], named: new Map<string, number>() };
      const destination: SelectDest = { kind: "output" };
      const aggregateProgram = compileRecursiveAggregateSelect(select, schema, database, maxRows, maxWorkUnits, maxResultBytes, privateStateLimits, { builder, parameters, destination });
      if (aggregateProgram) {
        builder.ops.push({ code: "Halt" });
        return Object.freeze({ ...aggregateProgram, ops: builder.finish(), registers: builder.registers });
      }
    }
    {
      const builder = new SelectProgramBuilder<Program["ops"][number]>(progressCheck);
      const parameters = { maximum: 0, names: [] as (string | null)[], named: new Map<string, number>() };
      const destination: SelectDest = { kind: "output" };
      const multipleProgram = compileMultipleRecursiveCtes(select, encoding, maxWorkUnits, maxResultBytes, privateStateLimits, maxRows, { builder, parameters, destination });
      if (multipleProgram) {
        builder.ops.push({ code: "Halt" });
        return Object.freeze({ ...multipleProgram, ops: builder.finish(), registers: builder.registers });
      }
    }
    // generateWithRecursiveQuery consumes the enclosing Parse/Vdbe and dest.
    // Reserve the current VM's physical zero convention before queue/history
    // allocation, just as the standalone producer did; do not remap WHERE.
    const builder = new SelectProgramBuilder<Program["ops"][number]>(progressCheck);
    builder.reserveCursorsThrough(0);
    const parameters = { maximum: 0, names: [] as (string | null)[], named: new Map<string, number>() };
    const destination: SelectDest = { kind: "output" };
    const produced = compileRecursiveCteSelect(select, encoding, maxWorkUnits, maxResultBytes, privateStateLimits, maxRows, false, { builder, parameters, destination });
    builder.ops.push({ code: "Halt" });
    return Object.freeze({ ...produced, ops: builder.finish(), registers: builder.registers });
  }
  // select.c:sqlite3Select dispatches a compound to multiSelect before
  // coding the rightmost arm's aggregate. Each arm owns its own aggregate
  // context; the rightmost expression must not classify the whole compound.
  if (select.hasCompound && !select.orderBy.length && !select.limit && !select.offset && select.arms.slice(1).every(arm=>arm.operatorFromPrior==='union-all') && select.arms.every(arm=>arm.origin==='select')) {
    // multiSelect receives the enclosing Parse/Vdbe and output destination.
    // Existing arm producers (including c's aggregate carriers) append to this
    // owner. Admission is complete before emission; exceptions are terminal.
    const builder = new SelectProgramBuilder<Program["ops"][number]>(progressCheck);
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
  if (select.hasCompound && select.arms.some(arm=>arm.from.items.length) && !select.limit && !select.offset && select.arms.slice(1).every(arm=>arm.operatorFromPrior==='union-all') && select.orderBy.length===1 && select.result.length===1) {
    const builder = new SelectProgramBuilder<Program["ops"][number]>(progressCheck);
    const parameters = { maximum: 0, names: [] as (string | null)[], named: new Map<string, number>() };
    const destination: SelectDest = { kind: "output" };
    // Compound ORDER resolution belongs to the selected composer, not token
    // admission. Invalid ordinals must reach its native code-1 diagnostics.
    const compiled = compileOrderedCteUnionAll(select, schema, database, maxRows, maxWorkUnits, maxResultBytes, privateStateLimits, { builder, parameters, destination });
    if (compiled) {
      builder.ops.push({ code: "Halt" });
      return Object.freeze({ ops: builder.finish(), registers: builder.registers, encoding,
        columns: compiled.columns, parameters: Object.freeze(parameters.names.map(name => Object.freeze({ name }))),
        database, maxRows, maxWorkUnits, maxResultBytes, privateStateLimits });
    }
    return compileTableSelect(select, schema, database, maxRows, maxWorkUnits, maxResultBytes, privateStateLimits);
  }
  // Existing transient/window/set entry owners still prepare their own graphs.
  // For physical ordinary entry, resolved aggregate depth—not nested spelling—
  // selects the enclosing AggInfo path. Do not publish resolver errors raw.
  const hasNestedSelect=(node:import('./lemon-runtime.ts').LemonValue<import('./tokenize.ts').SqlToken>):boolean=>node.kind==='reduction'&&(((node.signature==='expr ::= LP select RP'||node.signature==='expr ::= EXISTS LP select RP'||node.signature==='expr ::= expr in_op LP select RP')&&node.children.some(child=>child.kind==='reduction'&&child.signature.startsWith('select ::=')&&child.semantic&&typeof child.semantic==='object'&&'kind' in child.semantic&&child.semantic.kind==='select'&&selectHasAggregate(child.semantic as SelectNode)))||node.children.some(hasNestedSelect));
  const resolveLexical=()=>{try{return expandAndResolveSelect(select,schema);}catch(error){if(error instanceof NameResolutionError)throw new JSQLiteError("sqlite",error.message,{code:1});throw error;}};
  const hasTransientSelect=(node:import('./lemon-runtime.ts').LemonValue<import('./tokenize.ts').SqlToken>):boolean=>node.kind==='reduction'&&((!!node.semantic&&typeof node.semantic==='object'&&'kind' in node.semantic&&node.semantic.kind==='select'&&!!((node.semantic as SelectNode).from.derived||(node.semantic as SelectNode).from.cteDerived?.length))||node.children.some(hasTransientSelect));
  const lexicalPlan = select.from.items.length>0&&!select.result.some(expression=>expression.reduction&&hasTransientSelect(expression.reduction))&&select.result.some(expression=>expression.reduction&&hasNestedSelect(expression.reduction))&&!selectHasAggregate(select)&&!select.hasGroupBy&&!select.hasHaving&&!select.hasCompound&&!select.hasValues&&!select.from.derived&&!select.from.cteDerived?.length ? resolveLexical() : undefined;
  const ownsNestedAggregate=(plan:ResolvedSelect,depth=0):boolean=>[...(plan.aggregateUses?.values()??[])].some(owner=>owner===depth)||plan.nested.some(child=>ownsNestedAggregate(child,depth+1));
  const aggregate = selectHasAggregate(select) || (lexicalPlan!==undefined&&ownsNestedAggregate(lexicalPlan)) || select.hasGroupBy || select.hasHaving;
  const window = selectHasWindow(select);
  const jsonTableAggregate = aggregate && select.from.items.length === 1 &&
    ["json_each", "json_tree", "jsonb_each", "jsonb_tree"].includes(select.from.items[0]!.tableName.toLowerCase());
  if (aggregate && !window && !jsonTableAggregate) {
    // Aggregate analysis/capture/finalization consumes the enclosing Parse/Vdbe.
    // The physical WHERE range remains reserved until its callers migrate.
    const builder = new SelectProgramBuilder<Program["ops"][number]>(progressCheck);
    builder.reserveCursorsThrough(30);
    const parameters = { maximum: 0, names: [] as (string | null)[], named: new Map<string, number>() };
    const destination: SelectDest = { kind: "output" };
    const produced = compileAggregateSelect(select, schema, database, maxRows, maxWorkUnits, maxResultBytes, privateStateLimits, { builder, ops: builder.ops, parameters, destination });
    builder.ops.push({ code: "Halt" });
    return Object.freeze({ ...produced, ops: builder.finish(), registers: builder.registers });
  }
  // Only the ordinary physical window consumer below has migrated here.
  // Retained/JSON/CTE specializations keep their live preparation contracts.
  if (selectHasWindow(select) && !select.hasCompound && !select.with && !select.from.derived && !select.from.cteDerived?.length && !select.from.flattenedDerived && select.from.items.length === 1 && !select.from.items[0]!.arguments && !select.from.items[0]!.databaseName && schema.tables.has(sqliteAsciiFold(select.from.items[0]!.tableName))) {
    const builder = new SelectProgramBuilder<Program["ops"][number]>(progressCheck);
    builder.reserveCursorsThrough(30);
    const parameters = { maximum: 0, names: [] as (string | null)[], named: new Map<string, number>() };
    const destination: SelectDest = { kind: "output" };
    const produced = compileTableSelect(select, schema, database, maxRows, maxWorkUnits, maxResultBytes, privateStateLimits, { builder, parameters, destination });
    builder.ops.push({ code: "Halt" });
    return Object.freeze({ ...produced, ops: builder.finish(), registers: builder.registers });
  }
  if (select.from.items.length || select.where) {
    const builder = new SelectProgramBuilder<Program["ops"][number]>(progressCheck);
    builder.reserveCursorsThrough(30);
    const parameters = { maximum: 0, names: [] as (string | null)[], named: new Map<string, number>() };
    const destination: SelectDest = { kind: "output" };
    const produced = compileTableSelect(select, schema, database, maxRows, maxWorkUnits, maxResultBytes, privateStateLimits, { builder, parameters, destination });
    // Every admitted table-entry branch consumes this enclosing Parse.
    if (produced.ops !== builder.ops) throw new JSQLiteError("internal", "table producer did not consume enclosing builder");
    builder.ops.push({ code: "Halt" });
    return Object.freeze({ ...produced, ops: builder.finish(), registers: builder.registers });
  }
  // select.c:multiSelect/selectInnerLoop consume the enclosing allocation and
  // destination even for zero-source arms. Early window/CTE consumers forward
  // this same owner; selected errors cannot publish or retry a child Program.
  const builder = new SelectProgramBuilder<Program["ops"][number]>(progressCheck);
  const parameters = { maximum: 0, names: [] as (string | null)[], named: new Map<string, number>() };
  const destination: SelectDest = { kind: "output" };
  const emitRow = (first: number, count: number) => emitSelectDestination(builder.ops, destination, first, count);
  const produced = compileScalarSelect(select, encoding, maxWorkUnits, maxResultBytes, privateStateLimits, schema, database, maxRows, { builder, parameters, emitRow, destination });
  builder.ops.push({ code: "Halt" });
  return Object.freeze({ ...produced, ops: builder.finish(), registers: builder.registers });
}
