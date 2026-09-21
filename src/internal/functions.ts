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
  definition("unlikely",[1],withFlags("inline","unlikely"),true),
  definition("likelihood",[2],withFlags("inline","unlikely"),true),
  definition("likely",[1],withFlags("inline","unlikely"),true),
  definition("ltrim",[1,2],C,true), definition("rtrim",[1,2],C,true), definition("trim",[1,2],C,true),
  definition("min",[],withFlags("need-collation"),true,2),
  definition("max",[],withFlags("need-collation"),true,2),
  definition("typeof",[1],withFlags("typeof"),true),
  definition("subtype",[1],withFlags("typeof","subtype"),true),
  definition("length",[1],withFlags("length"),true),
  definition("octet_length",[1],withFlags("byte-length"),true),
  definition("instr",[2],C,true), definition("printf",[],C,true,0), definition("format",[],C,true,0),
  definition("unicode",[1],C,true), definition("char",[],C,true,0), definition("abs",[1],C,true),
  definition("round",[1,2],C,true), definition("upper",[1],C,true), definition("lower",[1],C,true),
  definition("hex",[1],C,true), definition("unhex",[1,2],C,true),
  definition("concat",[],C,true,1), definition("concat_ws",[],C,true,2),
  definition("nullif",[2],withFlags("need-collation"),true), definition("unistr",[1],C,true),
  definition("quote",[1],C,true), definition("unistr_quote",[1],C,true), definition("replace",[3],C,true),
  definition("zeroblob",[1],C,true), definition("substr",[2,3],C,true), definition("substring",[2,3],C,true),
  definition("sign",[1],C,true), definition("ifnull",[2],withFlags("inline"),true),
  definition("coalesce",[],withFlags("inline"),true,2),
  definition("iif",[],withFlags("inline"),true,2), definition("if",[],withFlags("inline"),true,2),
  definition("random",[0],V,true), definition("randomblob",[1],V,true),
  definition("last_insert_rowid",[0],V,true), definition("changes",[0],V,true), definition("total_changes",[0],V,true),
  definition("sqlite_version",[0],S,true), definition("sqlite_source_id",[0],S,true),
  definition("sqlite_log",[2],C,true), definition("glob",[2],withFlags("like","case"),true),
  definition("like",[2,3],withFlags("like"),true),
  definition("sqlite_compileoption_used",[1],S,true), definition("sqlite_compileoption_get",[1],S,true),
]);

if(entries.length!==50) throw new Error("ordinary scalar registry must contain 50 rows");
// date.c keeps these registrations separate; lookup and OP_Function are shared.
const dateEntries:readonly BuiltinFunctionDefinition[]=Object.freeze([
 definition("julianday",[],C,true,0),definition("unixepoch",[],C,true,0),definition("date",[],C,true,0),definition("time",[],C,true,0),definition("datetime",[],C,true,0),definition("strftime",[],C,true,1),definition("timediff",[2],C,true),definition("current_time",[0],V,true),definition("current_date",[0],V,true),definition("current_timestamp",[0],V,true),
]);
// func.c's SQLITE_ENABLE_MATH_FUNCTIONS block. Multiple FuncDef rows for log
// are represented by its exact arity set, just as the ordinary catalog does.
const M=(name:string,arities:readonly number[])=>definition(name,arities,C,true);
const mathEntries:readonly BuiltinFunctionDefinition[]=Object.freeze([
 M("ceil",[1]),M("ceiling",[1]),M("floor",[1]),M("trunc",[1]),
 M("ln",[1]),M("log",[1,2]),M("log10",[1]),M("log2",[1]),
 M("exp",[1]),M("pow",[2]),M("power",[2]),M("mod",[2]),
 M("acos",[1]),M("asin",[1]),M("atan",[1]),M("atan2",[2]),
 M("cos",[1]),M("sin",[1]),M("tan",[1]),M("cosh",[1]),M("sinh",[1]),M("tanh",[1]),
 M("acosh",[1]),M("asinh",[1]),M("atanh",[1]),M("sqrt",[1]),
 M("radians",[1]),M("degrees",[1]),M("pi",[0]),
]);
// json.c:sqlite3RegisterJsonFunctions. Keep the initial tranche narrow: this
// representation owner implements conversion and validation, and later JSON
// consumers can reuse it rather than inventing another representation.
const jsonEntries:readonly BuiltinFunctionDefinition[]=Object.freeze([
 definition("json",[1],withFlags("subtype"),true),
 definition("jsonb",[1],C,true),
 definition("json_valid",[1,2],C,true),
 definition("json_extract",[],withFlags("subtype"),true,2),
]);
const byName = new Map([...entries,...dateEntries,...mathEntries,...jsonEntries].map(entry=>[entry.name,entry] as const));
export const builtinFunctionRegistry: readonly BuiltinFunctionDefinition[] = entries;
export function builtinFunction(name:string):BuiltinFunctionDefinition|undefined{return byName.get(name);}
export function builtinFunctionAccepts(definition:BuiltinFunctionDefinition,argc:number):boolean{
  if(definition.exactArities.includes(argc))return true;
  return definition.minimumArity!==null&&argc>=definition.minimumArity&&argc<=definition.maximumArity;
}
export function builtinFunctionIsPure(definition:BuiltinFunctionDefinition):boolean{
  return definition.flags.includes("constant");
}
