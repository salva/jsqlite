import type { LemonValue } from "./lemon-runtime.ts";
import type { ExprNode, SelectNode, SourceList } from "./parse.ts";
import type { SchemaGraph } from "./schema.ts";
import { sqliteAsciiFold } from "./sqlite-case.ts";
import type { SqlToken } from "./tokenize.ts";

/**
 * Pre-compilation walk of every Select owner currently reachable by select.c's
 * expansion/lowering routes.  This is deliberately an admission walk, not CTE
 * resolution: until With/CteUse lowering exists, discovering any WITH is enough.
 * Object identity sets make malformed/shared semantic graphs and recursive view
 * references finite without changing immutable parser or schema ownership.
 */
export function selectGraphContainsWith(root: SelectNode, schema: SchemaGraph): boolean {
  const selects = new Set<SelectNode>();
  const reductions = new Set<object>();
  const views = new Set<object>();

  const reduction = (node: LemonValue<SqlToken> | undefined): boolean => {
    if (!node || node.kind === "terminal" || reductions.has(node)) return false;
    reductions.add(node);
    const semantic = node.semantic;
    if (semantic && typeof semantic === "object" && "kind" in semantic && semantic.kind === "select") {
      if (select(semantic as SelectNode)) return true;
    }
    return node.children.some(reduction);
  };
  const expression = (node: ExprNode | null | undefined): boolean => reduction(node?.reduction);
  const sources = (from: SourceList): boolean => {
    if (from.derived && select(from.derived.select)) return true;
    if (from.flattenedDerived && select(from.flattenedDerived.select)) return true;
    for (const item of from.items) {
      if (expression(item.on)) return true;
      if (item.databaseName !== null && sqliteAsciiFold(item.databaseName) !== "main") continue;
      const view = schema.views.get(sqliteAsciiFold(item.tableName));
      if (view && !views.has(view)) {
        views.add(view);
        if (select(view.select)) return true;
      }
    }
    return false;
  };
  const select = (node: SelectNode): boolean => {
    if (selects.has(node)) return false;
    selects.add(node);
    if (node.with !== null) {
      // Inspecting bodies is not needed for the decision, but their ownership is
      // part of this graph contract and remains reachable when execution lands.
      return true;
    }
    for (const arm of node.arms) {
      if (sources(arm.from) || expression(arm.where)) return true;
      for (const value of arm.result) if (expression(value)) return true;
      for (const row of arm.valuesRows ?? []) for (const value of row) if (expression(value)) return true;
    }
    if (sources(node.from) || expression(node.where) || expression(node.having) || expression(node.limit) || expression(node.offset)) return true;
    for (const value of node.result) if (expression(value)) return true;
    for (const value of node.groupBy) if (expression(value)) return true;
    for (const term of node.orderBy) if (expression(term.expr)) return true;
    for (const window of node.windowDefinitions) {
      for (const value of window.partitionBy) if (expression(value)) return true;
      for (const value of window.orderBy) if (expression(value)) return true;
    }
    return false;
  };

  return select(root);
}
