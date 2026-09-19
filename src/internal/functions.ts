// Immutable ordinary-scalar catalog translated from SQLite 3.53.4
// src/func.c:aBuiltinFunc. Arity selection follows callback.c:matchQuality:
// exact registrations win; otherwise a variadic registration is considered.
export type BuiltinFunctionFlag =
  | "builtin" | "utf8" | "constant" | "slow-changing" | "need-collation"
  | "inline" | "unlikely" | "like" | "case" | "typeof" | "subtype"
  | "length" | "byte-length";

export interface BuiltinFunctionDefinition {
  readonly name: string;
  readonly exactArities: readonly number[];
  readonly minimumArity: number | null;
  readonly maximumArity: number;
  readonly flags: readonly BuiltinFunctionFlag[];
  readonly dispatchable: boolean;
}

const MAX_FUNCTION_ARG = 1000;
const C = Object.freeze(["builtin", "utf8", "constant"] as const);
const V = Object.freeze(["builtin", "utf8"] as const);
const S = Object.freeze(["builtin", "utf8", "slow-changing"] as const);
function definition(
  name: string,
  exactArities: readonly number[],
  flags: readonly BuiltinFunctionFlag[] = C,
  dispatchable = false,
  minimumArity: number | null = null,
): BuiltinFunctionDefinition {
  return Object.freeze({name, exactArities:Object.freeze([...exactArities]), minimumArity,
    maximumArity:MAX_FUNCTION_ARG, flags:Object.freeze([...flags]), dispatchable});
}
const withFlags=(...extra:BuiltinFunctionFlag[])=>Object.freeze([...C,...extra]);
const entries: readonly BuiltinFunctionDefinition[] = Object.freeze([
  definition("unlikely",[1],withFlags("inline","unlikely")),
  definition("likelihood",[2],withFlags("inline","unlikely")),
  definition("likely",[1],withFlags("inline","unlikely")),
  definition("ltrim",[1,2]), definition("rtrim",[1,2]), definition("trim",[1,2]),
  definition("min",[],withFlags("need-collation"),true,2),
  definition("max",[],withFlags("need-collation"),true,2),
  definition("typeof",[1],withFlags("typeof"),true),
  definition("subtype",[1],withFlags("typeof","subtype")),
  definition("length",[1],withFlags("length"),true),
  definition("octet_length",[1],withFlags("byte-length"),true),
  definition("instr",[2]), definition("printf",[],C,false,0), definition("format",[],C,false,0),
  definition("unicode",[1]), definition("char",[],C,true,0), definition("abs",[1],C,true),
  definition("round",[1,2]), definition("upper",[1]), definition("lower",[1]),
  definition("hex",[1],C,true), definition("unhex",[1,2]),
  definition("concat",[],C,false,1), definition("concat_ws",[],C,false,2),
  definition("nullif",[2],withFlags("need-collation"),true), definition("unistr",[1]),
  definition("quote",[1]), definition("unistr_quote",[1]), definition("replace",[3],C,true),
  definition("zeroblob",[1]), definition("substr",[2,3],C,true), definition("substring",[2,3]),
  definition("sign",[1]), definition("ifnull",[2],withFlags("inline")),
  definition("coalesce",[],withFlags("inline"),true,2),
  definition("iif",[],withFlags("inline"),false,2), definition("if",[],withFlags("inline"),false,2),
  definition("random",[0],V), definition("randomblob",[1],V),
  definition("last_insert_rowid",[0],V), definition("changes",[0],V), definition("total_changes",[0],V),
  definition("sqlite_version",[0],S), definition("sqlite_source_id",[0],S),
  definition("sqlite_log",[2]), definition("glob",[2],withFlags("like","case")),
  definition("like",[2,3],withFlags("like")),
  definition("sqlite_compileoption_used",[1],S), definition("sqlite_compileoption_get",[1],S),
]);

if(entries.length!==50) throw new Error("ordinary scalar registry must contain 50 rows");
const byName = new Map(entries.map(entry=>[entry.name,entry] as const));
export const builtinFunctionRegistry: readonly BuiltinFunctionDefinition[] = entries;
export function builtinFunction(name:string):BuiltinFunctionDefinition|undefined{return byName.get(name);}
export function builtinFunctionAccepts(definition:BuiltinFunctionDefinition,argc:number):boolean{
  if(definition.exactArities.includes(argc))return true;
  return definition.minimumArity!==null&&argc>=definition.minimumArity&&argc<=definition.maximumArity;
}
export function builtinFunctionIsPure(definition:BuiltinFunctionDefinition):boolean{
  return definition.flags.includes("constant");
}
