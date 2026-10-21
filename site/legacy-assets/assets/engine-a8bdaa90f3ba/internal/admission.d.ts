import type { SelectNode } from "./parse.js";
import type { SchemaGraph } from "./schema.js";
/**
 * Pre-compilation walk of every Select owner currently reachable by select.c's
 * expansion/lowering routes. Relation-owned WITH/CteUse graphs are lowered before
 * this residual admission walk; discovering a WITH here identifies an
 * expression-owned or nested owner not represented by those lowering routes and
 * rejects it atomically. Object identity sets make malformed/shared semantic
 * graphs and recursive view references finite without changing immutable parser
 * or schema ownership.
 */
export declare function selectGraphContainsWith(root: SelectNode, schema: SchemaGraph): boolean;
/** select.c expansion only needs schema when resolving a source. Conservative
 * WITH/derived ownership uses the same graph traversal as residual admission. */
export declare function selectGraphNeedsSchema(root: SelectNode): boolean;
