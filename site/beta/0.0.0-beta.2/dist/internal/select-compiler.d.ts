import type { Mem } from './mem.js';
import type { SelectNode } from "./parse.js";
import type { SchemaGraph } from "./schema.js";
import type { BtreeDatabase } from "./btree.js";
import type { Program } from "./vdbe.js";
export declare function compileSelect(select: SelectNode, schema: SchemaGraph, database: BtreeDatabase, encoding: Program["encoding"], maxRows: number, maxWorkUnits: number, maxResultBytes: number, privateStateLimits: Program["privateStateLimits"], recursive: boolean, progressCheck?: () => void, bindings?: readonly Mem[]): Program;
