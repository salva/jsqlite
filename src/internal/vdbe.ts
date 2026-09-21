// First compiled no-FROM scalar SELECT slice. The instruction/register split
// follows expr.c sqlite3ExprCode* and vdbe.c's opcode loop rather than evaluating
// the parsed ExprNode directly from Statement.step().
import type { ColumnMetadata, OperationOptions, SqliteStorageClass, SqliteValue, Statement, StepResult } from "../index.ts";
import { JSQLiteError } from "../index.ts";
import { BorrowLifetime, Mem, type MemAffinity, memFromPublic, memFromRawRecord, memToPublicInitial } from "./mem.ts";
import type { ExprNode, SelectNode } from "./parse.ts";
import { lowerOrdinaryCtes } from "./cte.ts";
import { arithmeticBinary, bitwiseNot, booleanValue, logicalNot } from "./vdbe-primitives.ts";
import { compareMem, KeyInfo, type BuiltinCollation } from "./comparison.ts";
import { EphemeralIndexCursor, FifoCursor, PriorityQueueCursor, PrivateStateByteBudget, PrivateStateLimitError, SorterCursor, type PrivateStateControl, type PrivateStateLimits } from "./private-state.ts";
import { decodeRecord, RecordFormatError } from "./record.ts";
import { BtreeFormatError, BtreeLimitError, type BtreeDatabase, type TableScanCursor } from "./btree.ts";
import type { SchemaGraph, TableNode, ViewNode } from "./schema.ts";
import type { DatabaseEncoding } from "./record.ts";
import { expandAndResolveSelect, NameResolutionError } from "./resolve.ts";
import { sqliteAsciiFold, sqliteIdentifierEqual } from "./sqlite-case.ts";
import type { LemonValue } from "./lemon-runtime.ts";
import type { SqlToken } from "./tokenize.ts";
import { tokenIds } from "../generated/parser-tables.ts";
import { builtinFunction, builtinFunctionAccepts } from "./functions.ts";
import { SQLITE_COMPILE_OPTIONS, SQLITE_SOURCE_ID, SQLITE_VERSION, asText, asUtf8, decodeUnistr, firstCodePoint, quoteValue, scalarText, secureRandom, utf8Length } from "./ordinary-scalars.ts";
import {sqliteFormat,sqliteRound} from "./printf.ts";
import {evaluateDateTime, defaultDateTimeEnvironment, LocalTimeUnavailableError, type DateTimeEnvironment} from "./date-time.ts";
import { sqlitePatternCompare, validateLikeEscape } from "./pattern.ts";
import {evaluateMathFunction,isMathFunction} from "./math.ts";
import { jsonArrayLength, jsonArrow, jsonConstruct, openJsonTableCursor, jsonEdit, jsonErrorPosition, jsonExtract, jsonNodeFromSqlValue, jsonPatch, jsonQuote, jsonTextResult, jsonType, jsonValid, jsonbExtract, jsonbMemResult, jsonbResult, parseJsonMem, renderJson, JSON_EACH_COLUMNS, JSON_TABLE_COLUMNS, type JsonNode, type JsonTableCursor } from "./json.ts";

import {sqlite3WindowRewrite, type WindowRewriteGraph} from "./window-rewrite.ts";
export {sqlite3WindowRewrite};
export type {WindowRewriteFunction,WindowRewriteSortTerm,WindowRewriteLayer,WindowRewriteGraph} from "./window-rewrite.ts";

type SubqueryExpression=Extract<Expression,{kind:"scalar-subquery"}>|Extract<Expression,{kind:"in-subquery"}>;
type AggregateOrderTerm={expression:Expression;descending:boolean;nullsLarge:boolean};
type Expression =
 | {kind:"variable";spelling:string}
 | {kind:"mem";value:Mem;collation?:BuiltinCollation}
 | {kind:"literal";value:null|bigint|number|string|Uint8Array}
 | {kind:"column";index:number;name:string;cursor?:number;payloadIndex?:number;collation?:BuiltinCollation;affinity?:MemAffinity}
 | {kind:"unary";op:string;value:Expression}
 | {kind:"binary";op:string;left:Expression;right:Expression}
 | {kind:"collate";value:Expression;collation:BuiltinCollation}
 | {kind:"cast";value:Expression;affinity:MemAffinity}
 | {kind:"call";name:string;args:Expression[]}
 | {kind:"aggregate";name:string;args:Expression[];collation:BuiltinCollation;distinct:boolean;filter:Expression|null;orderBy:AggregateOrderTerm[]}
 | {kind:"scalar-subquery";select:SelectNode;exists?:true}
 | {kind:"in-subquery";left:Expression;select:SelectNode;negated:boolean}
 | {kind:"in-list";left:Expression;values:Expression[];negated:boolean}
 | {kind:"register";index:number}
 | {kind:"case";operand:Expression|null;pairs:[Expression,Expression][];otherwise:Expression|null};

function compoundOrderExpressionEqual(left:Expression,right:Expression):boolean{
 const unwrap=(value:Expression):Expression=>value.kind==="collate"?unwrap(value.value):value;
 left=unwrap(left);right=unwrap(right);if(left.kind!==right.kind)return false;
 switch(left.kind){
  case"literal":{const r=right as typeof left;if(left.value instanceof Uint8Array){if(!(r.value instanceof Uint8Array))return false;const rv=r.value;return left.value.length===rv.length&&left.value.every((v,i)=>v===rv[i]);}if(r.value instanceof Uint8Array)return false;return Object.is(left.value,r.value)}
  case"variable":return left.spelling===(right as typeof left).spelling;
  case"column":{const r=right as typeof left;const owner=(name:string)=>sqlName(name.split(".").at(-1)!);return sqliteIdentifierEqual(owner(left.name),owner(r.name))&&(left.index<0||r.index<0||left.index===r.index)}
  case"unary":{const r=right as typeof left;return left.op===r.op&&compoundOrderExpressionEqual(left.value,r.value)}
  case"binary":{const r=right as typeof left;return left.op===r.op&&compoundOrderExpressionEqual(left.left,r.left)&&compoundOrderExpressionEqual(left.right,r.right)}
  case"cast":{const r=right as typeof left;return left.affinity===r.affinity&&compoundOrderExpressionEqual(left.value,r.value)}
  case"call":{const r=right as typeof left;return left.name===r.name&&left.args.length===r.args.length&&left.args.every((v,i)=>compoundOrderExpressionEqual(v,r.args[i]!))}
  case"register":return left.index===(right as typeof left).index;
  case"mem":return left.value===(right as typeof left).value;
  default:return false;
 }
}

type Op =
  | { readonly code: "Integer"; readonly p1: bigint; readonly p2: number }
  | { readonly code: "Real"; readonly p1: number; readonly p2: number }
  | { readonly code: "String"; readonly p1: string; readonly p2: number }
  | { readonly code: "Blob"; readonly p1: Uint8Array; readonly p2: number }
  | { readonly code: "Null"; readonly p2: number }
  | { readonly code: "Copy"; readonly p1: number; readonly p2: number }
  | { readonly code: "Variable"; readonly p1: number; readonly p2: number }
  | { readonly code: "Binary"; readonly op: string; readonly p1:number; readonly p2:number; readonly p3:number; readonly collation:BuiltinCollation; readonly affinity?:MemAffinity }
  | { readonly code: "Cast"; readonly p1:number; readonly p2:number; readonly affinity:MemAffinity }
  | { readonly code: "Function" | "PureFunc"; readonly name:string; readonly args:readonly number[]; readonly p2:number; readonly collation:BuiltinCollation }
  | { readonly code: "AggStep"; readonly name:string; readonly args:readonly number[]; readonly p2:number; readonly collation:BuiltinCollation; readonly changed?:number }
  | { readonly code: "AggInverse"; readonly name:string; readonly args:readonly number[]; readonly p2:number; readonly collation:BuiltinCollation }
  | { readonly code: "AggFinal"; readonly name:string; readonly p1:number }
  | { readonly code: "AggValue"; readonly name:string; readonly p1:number; readonly p2:number }
  | { readonly code: "AggReset"; readonly registers:readonly number[] }
  | { readonly code: "CompareGroup"; readonly left:number; readonly right:number; readonly count:number; readonly keyInfo:KeyInfo; readonly jump:number }
  | { readonly code: "WindowRangeTest"; readonly candidate:number; readonly current:number; readonly offset?:number; readonly mode:"end-current"|"end-following"|"end-unbounded"|"start-unbounded"|"start-current"|"start-preceding"|"start-following"; readonly descending:boolean; readonly collation:BuiltinCollation; readonly jump:number }
  | { readonly code: "CollSeq"; readonly collation:BuiltinCollation }
  | { readonly code: "ShortCircuit"; readonly kind:"and"|"or"; readonly p1:number; readonly p2:number; readonly jump:number }
  | { readonly code: "Boolean"; readonly kind:"and"|"or"; readonly p1:number; readonly p2:number; readonly p3:number }
  | { readonly code: "NotNull"; readonly p1:number; readonly p2:number; readonly jump:number }
  | { readonly code: "Once"; readonly p1:number; readonly p2:number }
  | { readonly code: "Gosub"; readonly p1:number; readonly p2:number }
  | { readonly code: "Return"; readonly p1:number }
  | { readonly code: "InitCoroutine"; readonly p1:number; readonly p2:number; readonly p3:number }
  | { readonly code: "Yield"; readonly p1:number; readonly p2:number }
  | { readonly code: "EndCoroutine"; readonly p1:number; readonly p2:number }
  | { readonly code: "OpenDup"; readonly p1:number; readonly p2:number }
  | { readonly code: "Goto"; readonly p2:number }
  | { readonly code: "Subtract"; readonly p1: number; readonly p2: number; readonly p3: number }
  | { readonly code: "BitNot" | "Not"; readonly p1: number; readonly p2: number }
  | { readonly code: "OpenRead"; readonly p1: number; readonly p2?: number }
  | { readonly code: "JsonTableRewind"; readonly p1:number; readonly input:number; readonly root?:number; readonly recursive:boolean; readonly binaryContainers:boolean; readonly rowStart:number; readonly p2:number }
  | { readonly code: "JsonTableNext"; readonly p1:number; readonly rowStart:number; readonly p2:number }
  | { readonly code: "SorterOpen"; readonly p1:number; readonly keyInfo:KeyInfo }
  | { readonly code: "SorterInsert"; readonly p1:number; readonly keyStart:number; readonly keyCount:number; readonly payload:number; readonly payloadCount:number; readonly topN?:number }
  | { readonly code: "SorterSort"; readonly p1:number; readonly emptyJump:number }
  | { readonly code: "SorterData"; readonly p1:number; readonly p2:number; readonly count:number }
  | { readonly code: "SorterNext"; readonly p1:number; readonly p2:number }
  | { readonly code: "OpenFifo"; readonly p1:number }
  | { readonly code: "OpenPriorityQueue"; readonly p1:number; readonly keyInfo:KeyInfo }
  | { readonly code: "PriorityInsert"; readonly p1:number; readonly keyStart:number; readonly keyCount:number; readonly payloadStart:number; readonly payloadCount:number }
  | { readonly code: "PriorityShift"; readonly p1:number; readonly p2:number; readonly count:number; readonly emptyJump:number }
  | { readonly code: "FifoInsert"; readonly p1:number; readonly keyStart:number; readonly keyCount:number }
  | { readonly code: "FifoShift"; readonly p1:number; readonly p2:number; readonly count:number; readonly emptyJump:number }
  | { readonly code: "OpenEphemeral"; readonly p1:number; readonly keyInfo:KeyInfo }
  | { readonly code: "MakeRecord"; readonly p1:number; readonly p2:number; readonly p3:number }
  | { readonly code: "NewRowid"; readonly p1:number; readonly p2:number }
  | { readonly code: "Insert"; readonly p1:number; readonly p2:number; readonly p3:number }
  | { readonly code: "Found"; readonly p1:number; readonly keyStart:number; readonly keyCount:number; readonly jump:number }
  | { readonly code: "InSet"; readonly p1:number; readonly key:number; readonly output:number; readonly affinity:MemAffinity; readonly negated:boolean }
  | { readonly code: "IdxInsert"; readonly p1:number; readonly keyStart:number; readonly keyCount:number; readonly replace?:boolean }
  | { readonly code: "SetDelete"; readonly p1:number; readonly keyStart:number; readonly keyCount:number }
  | { readonly code: "SetRetainIntersection"; readonly p1:number; readonly p2:number }
  | { readonly code: "ClearEphemeral"; readonly p1:number }
  | { readonly code: "ClearSorter"; readonly p1:number }
  | { readonly code: "EphemeralSort"; readonly p1:number }
  | { readonly code: "EphemeralRewind"; readonly p1:number; readonly p2:number }
  | { readonly code: "EphemeralSeekRowid"; readonly p1:number; readonly rowid:number; readonly jump:number }
  | { readonly code: "EphemeralRowid"; readonly p1:number; readonly p2:number }
  | { readonly code: "EphemeralData"; readonly p1:number; readonly p2:number; readonly count:number }
  | { readonly code: "EphemeralNext"; readonly p1:number; readonly p2:number }
  | { readonly code: "IfCursorSizeGt"; readonly p1:number; readonly threshold?:number; readonly thresholdRegister?:number; readonly registerAdjustment?:number; readonly jump:number }
  | { readonly code: "IfRegisterGt"; readonly left:number; readonly right:number; readonly jump:number }
  | { readonly code: "EphemeralAdvanceData"; readonly p1:number; readonly p2:number; readonly count:number; readonly emptyJump?:number }
  | { readonly code: "IfEphemeralHasNext"; readonly p1:number; readonly jump:number }
  | { readonly code: "EphemeralResetPosition"; readonly p1:number }
  | { readonly code: "MustBeInt"; readonly p1:number }
  | { readonly code: "WindowCheck"; readonly p1:number; readonly boundary:"starting"|"ending"; readonly numeric:boolean }
  | { readonly code: "OffsetLimit"; readonly p1:number; readonly p2:number; readonly p3:number }
  | { readonly code: "IfNotZero"; readonly p1:number; readonly p2:number }
  | { readonly code: "IfPos"; readonly p1:number; readonly p2:number; readonly p3:number }
  | { readonly code: "DecrJumpZero"; readonly p1:number; readonly p2:number }
  | { readonly code: "Rewind"; readonly p1?: number; readonly p2: number }
  | { readonly code: "NullRow"; readonly p1: number }
  | { readonly code: "Column"; readonly p1: number; readonly p2: number; readonly p3?: number; readonly affinity?: MemAffinity }
  | { readonly code: "RealAffinity"; readonly p1: number }
  | { readonly code: "Rowid"; readonly p1?: number; readonly p2: number }
  | { readonly code: "Eq"; readonly p1: number; readonly p2: number; readonly p3: number; readonly affinity: MemAffinity; readonly collation: BuiltinCollation }
  | { readonly code: "IfNot"; readonly p1: number; readonly p2: number }
  | { readonly code: "Next"; readonly p1?: number; readonly p2: number }
  | { readonly code: "ResultRow"; readonly p1: number; readonly p2: number }
  | { readonly code: "Halt" };
export interface ParameterDescriptor { readonly name: string | null }
export interface Program {
  readonly ops: readonly Op[];
  readonly registers: number;
  readonly columns: readonly ColumnMetadata[];
  readonly parameters: readonly ParameterDescriptor[];
  readonly database?: BtreeDatabase;
  readonly maxRows?: number;
  readonly maxWorkUnits: number;
  readonly maxResultBytes: number;
  readonly privateStateLimits: PrivateStateLimits;
  readonly encoding: DatabaseEncoding;
  readonly dateTimeEnvironment?: DateTimeEnvironment;
}
export type WindowDeleteMode="retain"|"agg-inverse"|"return-row"|"agg-step";
export interface WindowSetupLayer {
  readonly compatibleGroup:number;
  readonly regPart:number|null;
  readonly regPartInitialized:number|null;
  readonly partitionRegisters:readonly number[];
  readonly regOne:number;
  readonly regOutputReady:number;
  readonly boundRegisters:Readonly<{start:number|null;end:number|null}>;
  readonly regStartRowid:number|null;
  readonly regEndRowid:number|null;
  readonly applicationCursor:number|null;
  readonly deleteMode:WindowDeleteMode;
  readonly partitionKeyInfo:KeyInfo|null;
  readonly peerKeyInfo:KeyInfo|null;
  readonly regNew:number;
  readonly inputRegisters:readonly number[];
  readonly regRecord:number;
  readonly regRowid:number;
  readonly regPeer:number|null;
  readonly startPeerRegisters:readonly number[];
  readonly currentPeerRegisters:readonly number[];
  readonly endPeerRegisters:readonly number[];
}
export interface WindowLoopBinding {
  readonly compatibleGroup:number;
  readonly producerKind:"original"|"rewritten-select";
  readonly producerCoroutine:number;
  readonly childCoroutine:number;
  readonly loopBody:number;
  readonly gosub:number;
  readonly returnAddress:number;
  readonly sorterCursor:number;
  readonly ownedClauses:readonly ("from"|"where"|"groupBy"|"having")[];
  readonly producerOrderBy:WindowRewriteGraph["layers"][number]["producerOrderBy"];
}
export interface WindowLoweringCompilation {
  readonly rewrite:WindowRewriteGraph;
  readonly setup:readonly WindowSetupLayer[];
  readonly loopBindings:readonly WindowLoopBinding[];
  readonly program:Program;
}

type WindowCodeLayer=WindowRewriteGraph["layers"][number];
type WindowCodeOperation="WINDOW_AGGSTEP"|"WINDOW_AGGINVERSE"|"WINDOW_AGGVALUE";
interface WindowCodeArg {
  readonly ops:Op[];
  readonly layer:WindowCodeLayer;
  readonly state:WindowSetupLayer;
  readonly collationOf:(bufferColumn:number)=>BuiltinCollation;
}

/** A lead/lag layer is partition-cached by windowCacheFrame. Compatible
 * cumulative callback built-ins can share that cache and advance with its
 * output cursor instead of requiring a second producer schedule. */
function cachedDirectOffsetLayer(layer:WindowCodeLayer):boolean {
  return layer.windows.length>0
    &&layer.windows.some(win=>win.window.functionName==="lead"||win.window.functionName==="lag")
    &&layer.windows.every(win=>{
      if(win.window.functionName==="lead"||win.window.functionName==="lag")return true;
      const frame=win.window.frame;
      return !!aggregateDefinition(win.window.functionName)
        &&frame.type==="rows"
        &&frame.start.kind==="unbounded"
        &&frame.end.kind==="current"
        &&(frame.exclusion===null||frame.exclusion==="no-others");
    });
}

/** window.c:windowAggStep. This emits VM callback opcodes; it does not replace
 * the pinned aggregate algorithm with a host-side implementation. */
function windowAggStep(p:WindowCodeArg,sourceRegister:number,inverse:boolean,accumulators?:readonly number[]):void {
  for(let index=0;index<p.layer.windows.length;index++){
    const win=p.layer.windows[index]!,args=Array.from({length:win.window.argumentCount},(_,i)=>sourceRegister+win.argumentColumn+i);
    let filter:number|null=null;
    if(win.filterColumn!==null){filter=p.ops.length;p.ops.push({code:"IfNot",p1:sourceRegister+win.filterColumn,p2:0});}
    p.ops.push({code:inverse?"AggInverse":"AggStep",name:win.window.functionName,args,p2:accumulators?.[index]??win.regAccum,collation:args.length?p.collationOf(win.argumentColumn):"binary"});
    if(filter!==null)(p.ops[filter] as {p2:number}).p2=p.ops.length;
  }
}

/** window.c:windowCodeOp callback phase. Cursor movement and peer/range tests
 * remain in sqlite3WindowCodeStep; this owns callback placement in its schedule. */
function windowCodeOp(p:WindowCodeArg,operation:WindowCodeOperation,sourceRegister=p.state.regNew,accumulators?:readonly number[]):void {
  if(operation==="WINDOW_AGGSTEP")return windowAggStep(p,sourceRegister,false,accumulators);
  if(operation==="WINDOW_AGGINVERSE")return windowAggStep(p,sourceRegister,true,accumulators);
  for(let index=0;index<p.layer.windows.length;index++){
    const win=p.layer.windows[index]!;
    p.ops.push({code:"AggValue",name:win.window.functionName,p1:accumulators?.[index]??win.regAccum,p2:win.regResult});
  }
}

/** window.c:windowFullScan ownership boundary. EXCLUDE schedules provide the
 * peer/row filtering body; reset, rewind, and value remain one phase owner. */
function windowFullScan(p:WindowCodeArg,cursor:number,accumulators:readonly number[],emitAcceptedRows:(scanPc:number)=>void):void {
  p.ops.push({code:"AggReset",registers:accumulators});
  const rewind=p.ops.length;p.ops.push({code:"EphemeralRewind",p1:cursor,p2:0});
  const scan=p.ops.length;emitAcceptedRows(scan);
  const done=p.ops.length;(p.ops[rewind] as {p2:number}).p2=done;
  windowCodeOp(p,"WINDOW_AGGVALUE",p.state.regNew,accumulators);
}

/** window.c:sqlite3WindowCodeStep outer ownership. Frame-family schedules are
 * migrated behind this boundary without changing their opcode order. */
function sqlite3WindowCodeStep(emitSchedule:()=>void):void {emitSchedule();}

function windowConstantInteger(expressionNode:NonNullable<ReturnType<typeof expressionFromReduction>>):number|null {
  if(expressionNode.kind==="literal"){
    if(typeof expressionNode.value==="bigint"&&expressionNode.value>=0n&&expressionNode.value<=BigInt(Number.MAX_SAFE_INTEGER))return Number(expressionNode.value);
    if(typeof expressionNode.value==="number"&&Number.isSafeInteger(expressionNode.value)&&expressionNode.value>=0)return expressionNode.value;
  }
  return null;
}

function windowConstantIntegerGtZero(expressionNode:NonNullable<ReturnType<typeof expressionFromReduction>>):boolean {
  // window.c:windowExprGtZero is deliberately conservative. This currently
  // represents its literal/unary numeric subset; unknown/parameterized
  // expressions return false and therefore select the non-early-delete mode.
  if(expressionNode.kind==="literal"){
    if(typeof expressionNode.value==="bigint")return expressionNode.value>0n;
    if(typeof expressionNode.value==="number")return Math.trunc(expressionNode.value)>0;
    if(typeof expressionNode.value==="string"){
      const value=memFromPublic(expressionNode.value,"utf-8");value.applyAffinity("numeric","utf-8");
      return value.initialStorageClass==="integer"?value.integerValue()>0n:value.initialStorageClass==="real"?Math.trunc(value.realValue())>0:false;
    }
  }
  if(expressionNode.kind==="unary"&&(expressionNode.op==="+"||expressionNode.op==="-")){
    const value=expressionNode.value;
    if(value.kind==="literal"&&(typeof value.value==="bigint"||typeof value.value==="number"))return expressionNode.op==="+"?value.value>0:value.value<0;
  }
  return false;
}

/** Internal, deliberately non-publishable SELECT lowering through the boundary
 * immediately before sqlite3WindowCodeStep. Unlike the earlier setup snapshot,
 * this owns the ordinary source scan and places each select.c Gosub in that
 * producer loop. The matching Return is the outer continuation. */
export function compileWindowSelectLowering(
  resolved:ReturnType<typeof expandAndResolveSelect>,
  encoding:DatabaseEncoding,
  database?:BtreeDatabase,
  maxWorkUnits=10_000_000,
  maxResultBytes=1_000_000_000,
  privateStateLimits:PrivateStateLimits=DEFAULT_PRIVATE_STATE_LIMITS,
  schema?:SchemaGraph,
  coroutineProducer?:Program,
):WindowLoweringCompilation {
  const rewrite=sqlite3WindowRewrite(resolved);
  const byGroup=new Map(rewrite.layers.map(layer=>[layer.compatibleGroup,layer] as const));
  const compileLayers:WindowRewriteGraph["layers"][number][]=[];
  const visit=(select:NonNullable<WindowRewriteGraph["root"]>):void=>{
    if(select.subquery.kind==="rewritten-select")visit(select.subquery.select);
    const layer=byGroup.get(select.compatibleGroup);
    if(!layer)throw new Error(`window rewrite lost compatible group ${select.compatibleGroup}`);
    compileLayers.push(layer);
  };
  if(rewrite.root)visit(rewrite.root);
  const ops:Op[]=[];
  const parameters:ParameterBuilder={maximum:0,names:[],named:new Map()};
  let registers=Math.max(0,...rewrite.layers.flatMap(layer=>[layer.regGosub,...layer.windows.flatMap(win=>[win.regAccum,win.regResult])]));
  const setup:WindowSetupLayer[]=[];
  const frameDeleteMode=(frame:NonNullable<WindowRewriteGraph["layers"][number]["windows"][number]>["window"]["frame"]):WindowDeleteMode=>{
    const gtZero=(boundary:typeof frame.start)=>!!boundary.expr?.reduction&&windowConstantIntegerGtZero(expressionFromReduction(boundary.expr.reduction));
    if(frame.start.kind==="following")return frame.type!=="range"&&gtZero(frame.start)?"return-row":"retain";
    if(frame.start.kind==="unbounded"){
      // Aggregate-only windows do not trigger windowCacheFrame(). EXCLUDE state
      // does, because sqlite3WindowCodeInit allocated regStartRowid.
      if(frame.exclusion!==null)return "retain";
      if(frame.end.kind==="preceding")return frame.type!=="range"&&gtZero(frame.end)?"agg-step":"retain";
      return "return-row";
    }
    return "agg-inverse";
  };
  const bindingCollation=(binding:WindowCodeLayer["bufferBindings"][number]):BuiltinCollation=>{
    if(!binding||binding.columnIndex<0)return "binary";
    return sqliteAsciiFold(binding.source.table.columns[binding.columnIndex]?.collation??"binary") as BuiltinCollation;
  };
  const keyCollation=(expression:{readonly reduction?:LemonValue<SqlToken>;readonly tokens:readonly SqlToken[]},binding:WindowCodeLayer["bufferBindings"][number]):BuiltinCollation=>{
    if(!expression.reduction)throw new JSQLiteError("internal","generated window key expression lost its reduction");
    // sqlite3ExprCollSeq: an explicit COLLATE belongs to the expression. In its
    // absence a column inherits the resolver-owned declared collation.
    return expression.tokens.some(token=>sqliteAsciiFold(token.text)==="collate")?collation(expressionFromReduction(expression.reduction)):bindingCollation(binding);
  };
  const keyInfoFor=(expressions:readonly {readonly reduction?:LemonValue<SqlToken>;readonly tokens:readonly SqlToken[]}[],bindings:readonly WindowCodeLayer["bufferBindings"][number][],terms:readonly {readonly descending:boolean;readonly nulls:"first"|"last"|null}[],includeSortFlags:boolean):KeyInfo=>new KeyInfo({
    encoding,totalFieldCount:expressions.length,keyFieldCount:expressions.length,
    terms:expressions.map((expression,index)=>{const term=terms[index];return{collation:keyCollation(expression,bindings[index]??null),...(includeSortFlags&&term?{desc:term.descending,nullsLarge:term.nulls==="last"?!term.descending:term.nulls==="first"?term.descending:false}:{})};}),
  });
  let nextApplicationCursor=Math.max(0,...resolved.sources.map(source=>source.cursorId),...rewrite.layers.flatMap(layer=>[layer.iEphCsr,...layer.duplicateCursors]))+1;
  for(const layer of compileLayers){
    const width=layer.bufferExpressions.length;
    const keyInfo=new KeyInfo({encoding,totalFieldCount:width,keyFieldCount:0,terms:[]});
    ops.push({code:"OpenEphemeral",p1:layer.iEphCsr,keyInfo});
    for(const cursor of layer.duplicateCursors)ops.push({code:"OpenDup",p1:cursor,p2:layer.iEphCsr});
    const partitionRegisters:number[]=[];
    for(const _term of layer.producerOrderBy.filter(term=>term.source==="partition")){const reg=++registers;partitionRegisters.push(reg);ops.push({code:"Null",p2:reg});}
    const regPartInitialized=partitionRegisters.length?++registers:null;if(regPartInitialized!==null)ops.push({code:"Integer",p1:0n,p2:regPartInitialized});
    const regOne=++registers;ops.push({code:"Integer",p1:1n,p2:regOne});
    const regOutputReady=++registers;ops.push({code:"Integer",p1:0n,p2:regOutputReady});
    for(const win of layer.windows)ops.push({code:"Null",p2:win.regAccum});
    // window.c:windowCheckValue evaluates offsets once, outside the producer
    // loop. ROWS/GROUPS require integers; RANGE admits numeric values.
    const frame=layer.windows[0]?.window.frame;
    const boundRegisters:{start:number|null;end:number|null}={start:null,end:null};
    if(frame){
      for(const [boundary,value] of [["starting",frame.start],["ending",frame.end]] as const){
        if(!value.expr?.reduction)continue;
        const register=compileExpressionTree(expressionFromReduction(value.expr.reduction),ops,()=>++registers,parameters);
        boundRegisters[boundary==="starting"?"start":"end"]=register;
        ops.push({code:"WindowCheck",p1:register,boundary,numeric:frame.type==="range"});
      }
    }
    // window.c:sqlite3WindowCodeInit checks eExclude before function-specific
    // state. Any explicit EXCLUDE (including NO OTHERS/TK_NO) owns rowid bounds
    // and a duplicate application cursor used by windowCodeOp's full scan.
    const exclusion=layer.windows[0]?.window.frame.exclusion??null;
    // window.c:windowCacheFrame() retains the partition for lead()/lag() even
    // though these WINDOWFUNCNOOP registrations have no aggregate callbacks.
    // Their result path reads the current ephemeral rowid and seeks a duplicate
    // application cursor (windowReturnOneRow, window.c:1956-1981).
    const offsetApplication=layer.windows.some(win=>win.window.functionName==="lead"||win.window.functionName==="lag");
    // window.c:sqlite3WindowCodeInit gives first_value()/nth_value() an
    // application cursor for their non-EXCLUDE windowReturnOneRow fast path.
    // Explicit EXCLUDE continues to use the full-scan cursor allocated above.
    const valueApplication=exclusion===null&&layer.windows.some(win=>win.window.functionName==="first_value"||win.window.functionName==="nth_value");
    let regStartRowid:number|null=null,regEndRowid:number|null=null,applicationCursor:number|null=null;
    if(exclusion!==null){
      regStartRowid=++registers;regEndRowid=++registers;applicationCursor=nextApplicationCursor++;
      ops.push({code:"Integer",p1:1n,p2:regStartRowid},{code:"Integer",p1:0n,p2:regEndRowid},{code:"OpenDup",p1:applicationCursor,p2:layer.iEphCsr});
    }else if(offsetApplication||valueApplication){
      applicationCursor=nextApplicationCursor++;
      ops.push({code:"OpenDup",p1:applicationCursor,p2:layer.iEphCsr});
    }
    const owner=layer.windows[0]?.window;
    const partitionExpressions=owner?.partitionBy??[];
    const peerExpressions=owner?.orderBy??[];
    const partitionTerms=layer.producerOrderBy.filter(term=>term.source==="partition");
    const peerTerms=layer.producerOrderBy.filter(term=>term.source==="order");
    const partitionKeyInfo=partitionExpressions.length?keyInfoFor(partitionExpressions,partitionTerms.map(term=>term.binding),partitionTerms,false):null;
    const exclusionPeers=exclusion==="group"||exclusion==="ties";
    const peerKeyInfo=(frame?.type!=="rows"||exclusionPeers)&&peerExpressions.length?keyInfoFor(peerExpressions,peerTerms.map(term=>term.binding),peerTerms,true):null;
    // window.c allocates regNew[nInput], regRecord and regRowid before the
    // producer loop. Non-ROWS frames additionally own four nPeer arrays.
    const inputRegisters=Object.freeze(Array.from({length:width},()=>++registers));
    const regNew=inputRegisters[0]??registers+1;
    const regRecord=++registers,regRowid=++registers;
    const peerRegisters=():readonly number[]=>Object.freeze(Array.from({length:peerExpressions.length},()=>++registers));
    const regPeer=(frame?.type!=="rows"||exclusionPeers)&&peerExpressions.length?registers+1:null;
    const mainPeerRegisters=regPeer===null?Object.freeze([] as number[]):peerRegisters();
    const startPeerRegisters=regPeer===null?Object.freeze([] as number[]):peerRegisters();
    const currentPeerRegisters=regPeer===null?Object.freeze([] as number[]):peerRegisters();
    const endPeerRegisters=regPeer===null?Object.freeze([] as number[]):peerRegisters();
    setup.push(Object.freeze({compatibleGroup:layer.compatibleGroup,regPart:partitionRegisters[0]??null,regPartInitialized,partitionRegisters:Object.freeze(partitionRegisters),regOne,regOutputReady,boundRegisters:Object.freeze(boundRegisters),regStartRowid,regEndRowid,applicationCursor,deleteMode:frame?frameDeleteMode(frame):"retain",partitionKeyInfo,peerKeyInfo,regNew,inputRegisters,regRecord,regRowid,regPeer,startPeerRegisters,currentPeerRegisters,endPeerRegisters}));
  }
  // Realize the recursive rewrite as coroutine producers. The innermost
  // producer alone owns the original FROM scan. Each incompatible outer layer
  // consumes the prior layer's coroutine instead of being flattened into that
  // scan. Producer ORDER terms are materialized through the ordinary sorter
  // op family before rows cross each boundary.
  const maxCursor=Math.max(0,...resolved.sources.map(source=>source.cursorId),...rewrite.layers.flatMap(layer=>[layer.iEphCsr,...layer.duplicateCursors]),...setup.flatMap(layer=>layer.applicationCursor===null?[]:[layer.applicationCursor]));
  // select.c finalizes the ordinary GROUP BY before the rewritten window
  // subquery consumes it. Lifted aggregates therefore cannot be read from a
  // raw source cursor. Build the existing AggInfo/sorter program as the
  // innermost coroutine producer (its ResultRow is adapted below).
  const groupedLayer=compileLayers[0]?.lifted.some(item=>item.kind==="aggregate")&&resolved.source.hasGroupBy?compileLayers[0]:null;
  const groupedProducer=groupedLayer&&database&&schema?(()=>{
    const source=resolved.source,arm=source.arms[0]!,result=groupedLayer.bufferExpressions;
    // The rewritten buffer contains deferred window-result slots alongside the
    // grouped columns and lifted aggregate arguments. select.c's inner grouped
    // producer does not execute those OVER expressions; they are populated by
    // the outer window layer. Keep the payload width stable with an ordinary
    // grouped expression placeholder so ResultRow-to-coroutine column indexes
    // remain source-shaped.
    const hasOver=(node:LemonValue<SqlToken>):boolean=>node.kind==="reduction"&&(node.signature.toLowerCase().includes("over_clause ::= over")||node.children.some(hasOver));
    const groupedResult=Object.freeze(result.map(item=>item.reduction&&hasOver(item.reduction)?source.groupBy[0]!:item));
    const producer:SelectNode=Object.freeze({...source,result:groupedResult,orderBy:Object.freeze([]),limit:null,offset:null,windowNames:Object.freeze([]),windowDefinitions:Object.freeze([]),hasOrderBy:false,hasLimit:false,hasSubquery:false,arms:Object.freeze([Object.freeze({...arm,result:groupedResult,orderBy:Object.freeze([])})])});
    return compileAggregateSelect(producer,schema,database,Number.MAX_SAFE_INTEGER,maxWorkUnits,maxResultBytes,privateStateLimits);
  })():null;
  const sourceCoroutine=++registers;
  const producerCoroutines=compileLayers.map(()=>++registers);
  const sorterCursors=compileLayers.map((_layer,index)=>maxCursor+1+index);
  const equivalentBufferExpression=(expressions:readonly WindowCodeLayer["bufferExpressions"][number][],value:WindowCodeLayer["bufferExpressions"][number]):number=>{
    const identical=expressions.findIndex(expression=>expression.reduction===value.reduction);
    if(identical>=0||!value.reduction)return identical;
    try {
      const wanted=expressionFromReduction(value.reduction);
      return expressions.findIndex(expression=>{
        if(!expression.reduction)return false;
        try{return sameExpression(wanted,expressionFromReduction(expression.reduction));}
        catch{return false;}
      });
    } catch {
      // An expression outside the represented subset remains an atomic
      // publication failure at the caller.
      return -1;
    }
  };
  const bindingsPending:{layer:WindowRewriteGraph["layers"][number];producerCoroutine:number;childCoroutine:number;loopBody:number;gosub:number;sorterCursor:number;payload:number;ownedClauses:readonly ("from"|"where"|"groupBy"|"having")[]}[]=[];

  // Source coroutine. Nested source scans use the existing SELECT loop shape:
  // each outer row executes the inner Rewind anew, avoiding the former invalid
  // reverse-Next Cartesian scan.
  const sourceInit=ops.length;ops.push({code:"InitCoroutine",p1:sourceCoroutine,p2:0,p3:0});
  const sourceStart=ops.length;(ops[sourceInit] as {p3:number}).p3=sourceStart;
  let groupedPayload:number|null=null;
  if(groupedProducer||coroutineProducer){
    const sourceProgram=groupedProducer??coroutineProducer!;
    groupedPayload=registers+1;registers+=sourceProgram.columns.length;
    const registerOffset=registers,cursorOffset=maxCursor+compileLayers.length+10;
    registers+=sourceProgram.registers;
    // ResultRow becomes one Copy per column plus Yield. Build the complete old
    // PC -> new PC map before relocating branches; a constant offset would send
    // every target after the first output into the middle of the expansion.
    const pcMap:number[]=[];let relocatedPc=ops.length;
    for(const original of sourceProgram.ops){pcMap.push(relocatedPc);relocatedPc+=original.code==="ResultRow"?original.p2+1:1;}
    pcMap.push(relocatedPc);
    const reg=(value:number)=>value+registerOffset,csr=(value:number|undefined)=>value===undefined?undefined:value+cursorOffset,pc=(value:number)=>pcMap[value]!;
    for(const original of sourceProgram.ops){
      if(original.code==="ResultRow"){
        for(let column=0;column<original.p2;column++)ops.push({code:"Copy",p1:reg(original.p1+column),p2:groupedPayload+column});
        ops.push({code:"Yield",p1:sourceCoroutine,p2:0});continue;
      }
      if(original.code==="Halt"){ops.push({code:"EndCoroutine",p1:sourceCoroutine,p2:0});continue;}
      const op:any={...original};
      switch(original.code){
        case"SorterOpen":case"OpenEphemeral":op.p1=csr(original.p1);break;
        case"OpenRead":op.p2=csr(original.p2);break;
        case"Rewind":case"Next":op.p1=csr(original.p1);op.p2=pc(original.p2);break;
        case"Column":op.p2=reg(original.p2);op.p3=csr(original.p3);break;
        case"Rowid":op.p1=csr(original.p1);op.p2=reg(original.p2);break;
        case"Copy":op.p1=reg(original.p1);op.p2=reg(original.p2);break;
        case"SorterInsert":op.p1=csr(original.p1);op.keyStart=reg(original.keyStart);op.payload=reg(original.payload);break;
        case"SorterSort":op.p1=csr(original.p1);op.emptyJump=pc(original.emptyJump);break;
        case"SorterData":op.p1=csr(original.p1);op.p2=reg(original.p2);break;
        case"SorterNext":op.p1=csr(original.p1);op.p2=pc(original.p2);break;
        case"AggReset":op.registers=original.registers.map(reg);break;
        case"AggStep":op.args=original.args.map(reg);op.p2=reg(original.p2);if(original.changed!==undefined)op.changed=reg(original.changed);break;
        case"AggFinal":op.p1=reg(original.p1);break;
        case"IfNot":op.p1=reg(original.p1);op.p2=pc(original.p2);break;
        case"CompareGroup":op.left=reg(original.left);op.right=reg(original.right);op.jump=pc(original.jump);break;
        case"Goto":op.p2=pc(original.p2);break;
        case"OpenFifo":case"OpenPriorityQueue":op.p1=csr(original.p1);break;
        case"FifoInsert":op.p1=csr(original.p1);op.keyStart=reg(original.keyStart);break;
        case"PriorityInsert":op.p1=csr(original.p1);op.keyStart=reg(original.keyStart);op.payloadStart=reg(original.payloadStart);break;
        case"FifoShift":case"PriorityShift":op.p1=csr(original.p1);op.p2=reg(original.p2);op.emptyJump=pc(original.emptyJump);break;
        case"Found":case"IdxInsert":op.p1=csr(original.p1);op.keyStart=reg(original.keyStart);if(original.code==="Found")op.jump=pc(original.jump);break;
        case"Binary":op.p1=reg(original.p1);op.p2=reg(original.p2);op.p3=reg(original.p3);break;
        case"Function":case"PureFunc":op.args=original.args.map(reg);op.p2=reg(original.p2);break;
        case"MustBeInt":op.p1=reg(original.p1);break;
        case"OffsetLimit":op.p1=reg(original.p1);op.p2=reg(original.p2);op.p3=reg(original.p3);break;
        case"IfPos":case"DecrJumpZero":op.p1=reg(original.p1);op.p2=pc(original.p2);break;
        case"Null":case"Integer":case"Real":case"String":case"Blob":op.p2=reg(original.p2);break;
        default:throw new JSQLiteError("unsupported",`grouped window producer opcode ${original.code} is not represented`,{unsupportedClassification:"temporary"});
      }
      ops.push(op as Op);
    }
  }else{
    for(const source of resolved.sources)ops.push({code:"OpenRead",p1:source.table.rootPage,p2:source.cursorId});
    const bindSourceExpression=(reduction:Reduction):Expression=>{
      const bind=(expression:Expression,node:Reduction):Expression=>{
        const children=descendantExprs(node).filter((child):child is Reduction=>child.kind==="reduction");
        const child=(index:number):Reduction=>{const value=children[index];if(!value)throw new JSQLiteError("internal","source predicate expression child is missing");return value;};
        if(expression.kind==="column"){
          const use=resolved.columnUses.find(candidate=>candidate.expression===node);
          if(!use)throw new JSQLiteError("internal","resolved source predicate column lost its binding");
          expression.index=use.columnIndex<0||isIntegerPrimaryKeyAlias(use.source.table,use.columnIndex)?-1:use.columnIndex;expression.cursor=use.source.cursorId;
        }else if(expression.kind==="unary"||expression.kind==="cast"||expression.kind==="collate")bind(expression.value,child(0));
        else if(expression.kind==="binary"){bind(expression.left,child(0));bind(expression.right,child(1));}
        else if(expression.kind==="in-list"){bind(expression.left,child(0));for(let i=0;i<expression.values.length;i++)bind(expression.values[i]!,child(i+1));}
        else if(expression.kind==="call"){const infixPattern=node.signature.startsWith("expr ::= expr likeop ")||node.signature.startsWith("expr ::= expr MATCH ");for(let i=0;i<expression.args.length;i++)bind(expression.args[i]!,child(infixPattern&&i<2?1-i:i));}
        return expression;
      };return bind(expressionFromReduction(reduction),reduction);
    };
    // select.c moves FROM/WHERE into the innermost rewritten subquery. Keep
    // these predicates in that source loop instead of silently broadening it.
    const sourcePredicates:Reduction[]=[];for(const item of resolved.source.from.items)if(item.on?.reduction?.kind==="reduction")sourcePredicates.push(item.on.reduction);if(resolved.source.where?.reduction?.kind==="reduction")sourcePredicates.push(resolved.source.where.reduction);
    const predicateSkips:number[]=[];
    const emitSourceLevel=(index:number):void=>{
      if(index===resolved.sources.length){for(const predicate of sourcePredicates){const register=compileExpressionTree(bindSourceExpression(predicate),ops,()=>++registers,parameters,undefined,true);predicateSkips.push(ops.length);ops.push({code:"IfNot",p1:register,p2:0});}ops.push({code:"Yield",p1:sourceCoroutine,p2:0});return;}
      const cursor=resolved.sources[index]!.cursorId,rewind=ops.length;ops.push({code:"Rewind",p1:cursor,p2:0});const body=ops.length;emitSourceLevel(index+1);const next=ops.length;ops.push({code:"Next",p1:cursor,p2:body});if(index===resolved.sources.length-1)for(const at of predicateSkips)(ops[at] as {p2:number}).p2=next;(ops[rewind] as {p2:number}).p2=ops.length;
    };
    if(resolved.sources.length)emitSourceLevel(0);else ops.push({code:"Yield",p1:sourceCoroutine,p2:0});
    ops.push({code:"EndCoroutine",p1:sourceCoroutine,p2:0});
  }
  const sourceContinuation=ops.length;(ops[sourceInit] as {p2:number}).p2=sourceContinuation;

  let childCoroutine=sourceCoroutine,childStart=sourceStart,allProducerExpressionsRepresented=true;
  for(let index=0;index<compileLayers.length;index++){
    const layer=compileLayers[index]!,producerCoroutine=producerCoroutines[index]!,sorterCursor=sorterCursors[index]!;
    const init=ops.length;ops.push({code:"InitCoroutine",p1:producerCoroutine,p2:0,p3:0});const producerStart=ops.length;(ops[init] as {p3:number}).p3=producerStart;
    ops.push({code:"InitCoroutine",p1:childCoroutine,p2:0,p3:childStart});
    // window.c opens the producer sorter once, before sqlite3WhereBegin drives
    // rows into it. Opening it in the child-loop body discarded every prior
    // row and made the apparently executable streaming branch single-row-only.
    const terms=layer.producerOrderBy;ops.push({code:"SorterOpen",p1:sorterCursor,keyInfo:new KeyInfo({encoding,totalFieldCount:terms.length,keyFieldCount:terms.length,terms:terms.map(term=>({collation:keyCollation(term.expression,term.binding),desc:term.descending,nullsLarge:term.nulls==="last"?!term.descending:term.nulls==="first"?term.descending:false}))})});
    const childLoop=ops.length,yieldAt=ops.length;ops.push({code:"Yield",p1:childCoroutine,p2:0});
    let childNotReady:number|null=null;if(index>0){childNotReady=ops.length;ops.push({code:"IfNot",p1:setup[index-1]!.regOutputReady,p2:0});}
    // Resolver-owned provenance is copied alongside generated expressions.
    // Never infer identity from copied token spelling: wrappers, aliases and
    // duplicate names make that unsound.
    const emitProducerBinding=(binding:typeof layer.bufferBindings[number],target:number,value?:typeof layer.bufferExpressions[number],producerColumn?:number):void=>{
      if(index===0&&groupedPayload!==null&&(!coroutineProducer||binding)){const column=coroutineProducer?binding!.columnIndex:(producerColumn??(binding?groupedLayer!.bufferBindings.findIndex(candidate=>candidate?.source.cursorId===binding.source.cursorId&&candidate.columnIndex===binding.columnIndex):value?equivalentBufferExpression(groupedLayer!.bufferExpressions,value):-1));if(column<0){allProducerExpressionsRepresented=false;ops.push({code:"Null",p2:target});return;}ops.push({code:"Copy",p1:groupedPayload+column,p2:target});return;}
      if(index>0&&value?.reduction){const child=compileLayers[index-1]!,childState=setup[index-1]!;const win=child.windows.find(item=>item.window.owner.reduction===value.reduction);if(win){ops.push({code:"Copy",p1:win.regResult,p2:target});return;}const column=equivalentBufferExpression(child.bufferExpressions,value);if(column>=0){ops.push({code:"Copy",p1:childState.regNew+column,p2:target});return;}const bound=binding?child.bufferBindings.findIndex(candidate=>candidate?.source.cursorId===binding.source.cursorId&&candidate.columnIndex===binding.columnIndex):-1;if(bound>=0){ops.push({code:"Copy",p1:childState.regNew+bound,p2:target});return;}}
      if(!binding){
        // FILTER is a complete producer expression, not a direct column
        // binding. Evaluate it while the source cursors are positioned and
        // retain its boolean value in the shared ephemeral payload. This is
        // window.c's FILTER register ownership, not output-time recomputation.
        const ownedFilter=producerColumn!==undefined&&layer.windows.some(win=>win.filterColumn===producerColumn);
        const valueReduction=value?.reduction;
        if(ownedFilter&&valueReduction?.kind==="reduction"){
          const filterExpr=valueReduction.children.find((child):child is Reduction=>child.kind==="reduction"&&child.signature.startsWith("expr ::="));
          if(!filterExpr)throw new JSQLiteError("internal","window FILTER lost its expression");
          const bindColumns=(expression:Expression,reduction:Reduction):Expression=>{
            const children=descendantExprs(reduction);
            const child=(index:number):Reduction=>{const value=children[index];if(!value||value.kind!=="reduction")throw new JSQLiteError("internal","window FILTER expression child is missing");return value;};
            if(expression.kind==="column"){
              const use=resolved.columnUses.find(candidate=>candidate.expression===reduction);
              if(!use)throw new JSQLiteError("internal","resolved window FILTER column lost its binding");
              expression.index=use.columnIndex<0||isIntegerPrimaryKeyAlias(use.source.table,use.columnIndex)?-1:use.columnIndex;
              expression.cursor=use.source.cursorId;
            }else if(expression.kind==="unary"||expression.kind==="cast"||expression.kind==="collate")bindColumns(expression.value,child(0));
            else if(expression.kind==="binary"){bindColumns(expression.left,child(0));bindColumns(expression.right,child(1));}
            return expression;
          };
          const boundFilter=bindColumns(expressionFromReduction(filterExpr),filterExpr);const register=compileExpressionTree(boundFilter,ops,()=>++registers,parameters);ops.push({code:"Copy",p1:register,p2:target});return;
        }
        // Constant aggregate arguments have no resolver column binding, but
        // sqlite3WindowRewrite still stores their value in every ephemeral row.
        let expression:ReturnType<typeof expressionFromReduction>|null=null;
        try{expression=value?.reduction?expressionFromReduction(value.reduction):null;}catch{/* Preserve the existing unrepresented-expression rejection below. */}
        if(expression?.kind==="literal"){
          const literal=expression.value;
          if(literal===null)ops.push({code:"Null",p2:target});
          else if(typeof literal==="bigint")ops.push({code:"Integer",p1:literal,p2:target});
          else if(typeof literal==="number")ops.push({code:"Real",p1:literal,p2:target});
          else if(typeof literal==="string")ops.push({code:"String",p1:literal,p2:target});
          else ops.push({code:"Blob",p1:literal,p2:target});
          return;
        }
        const producerConstant=(candidate:Expression):boolean=>candidate.kind==="literal"||candidate.kind==="variable"||((candidate.kind==="unary"||candidate.kind==="cast"||candidate.kind==="collate")&&producerConstant(candidate.value));
        if(expression&&producerConstant(expression)){
          // Unary/cast parameter expressions are evaluated while the rewritten
          // producer row is current, then copied into its ephemeral payload.
          // This is the general expression-code path used by select.c, not a
          // spelling-specific ntile admission rule.
          const register=compileExpressionTree(expression,ops,()=>++registers,parameters);ops.push({code:"Copy",p1:register,p2:target});return;
        }
        const windowAlias=value?.tokens.length===1?resolved.result.find(result=>result.expression.alias!==undefined&&result.expression.alias!==null&&sqliteIdentifierEqual(result.expression.alias,sqlName(value.tokens[0]!.text))&&rewrite.layers.some(owner=>owner.windows.some(win=>win.window.owner===result.expression))):undefined;
        const generatedZeroArgWindowSlot=value?.tokens.length===0&&layer.windows.some(win=>win.window.argumentCount===0);const deferred=generatedZeroArgWindowSlot||!!windowAlias||!!(value?.reduction&&compileLayers.slice(index+1).some(owner=>owner.windows.some(win=>win.window.owner.reduction===value.reduction)));if(!deferred)allProducerExpressionsRepresented=false;ops.push({code:"Null",p2:target});return;
      }
      const column=binding.columnIndex<0||isIntegerPrimaryKeyAlias(binding.source.table,binding.columnIndex)?-1:binding.columnIndex;
      if(column<0)ops.push({code:"Rowid",p1:binding.source.cursorId,p2:target});else ops.push({code:"Column",p1:column,p2:target,p3:binding.source.cursorId,affinity:binding.source.table.columns[column]!.affinity});
    };
    const key=registers+1;registers+=terms.length;for(let term=0;term<terms.length;term++)emitProducerBinding(terms[term]!.binding,key+term,terms[term]!.expression);
    const payload=registers+1;registers+=layer.bufferExpressions.length;
    for(let column=0;column<layer.bufferExpressions.length;column++)emitProducerBinding(layer.bufferBindings[column]!,payload+column,layer.bufferExpressions[column],column);
    const directCumulative=index>0&&terms.length===0&&layer.windows.every(win=>{const f=win.window.frame;return f.type==="rows"&&f.start.kind==="unbounded"&&f.end.kind==="current"&&(f.exclusion===null||f.exclusion==="no-others");});
    if(directCumulative){
      for(let column=0;column<layer.bufferExpressions.length;column++)ops.push({code:"Copy",p1:payload+column,p2:setup[index]!.regNew+column});
      for(const win of layer.windows){const args=Array.from({length:win.window.argumentCount},(_,i)=>setup[index]!.regNew+win.argumentColumn+i);ops.push({code:"AggStep",name:win.window.functionName,args,p2:win.regAccum,collation:args.length?collation(expressionFromReduction(layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary"},{code:"AggValue",name:win.window.functionName,p1:win.regAccum,p2:win.regResult});}
      ops.push({code:"Integer",p1:1n,p2:setup[index]!.regOutputReady},{code:"Yield",p1:producerCoroutine,p2:0});
    }else ops.push({code:"SorterInsert",p1:sorterCursor,keyStart:key,keyCount:terms.length,payload,payloadCount:layer.bufferExpressions.length});
    if(index>0)ops.push({code:"Integer",p1:0n,p2:setup[index-1]!.regOutputReady});ops.push({code:"Goto",p2:childLoop});
    const childDone=ops.length;if(childNotReady!==null)(ops[childNotReady] as {p2:number}).p2=childLoop;(ops[yieldAt] as {p2:number}).p2=childDone;
    const following=layer.windows.length>0&&layer.windows.every(win=>{const frame=win.window.frame;return frame.type==="rows"&&frame.start.kind==="current"&&frame.end.kind==="following"&&!!frame.end.expr?.reduction&&(frame.exclusion===null||frame.exclusion==="no-others");});
    const followingRange=layer.windows.length>0&&layer.windows.every(win=>{const frame=win.window.frame;return frame.type==="rows"&&frame.start.kind==="following"&&frame.end.kind==="following"&&!!frame.start.expr?.reduction&&!!frame.end.expr?.reduction&&(frame.exclusion===null||frame.exclusion==="no-others");});
    const precedingRange=layer.windows.length>0&&layer.windows.every(win=>{const frame=win.window.frame;return frame.type==="rows"&&frame.start.kind==="preceding"&&frame.end.kind==="preceding"&&!!frame.start.expr?.reduction&&!!frame.end.expr?.reduction&&(frame.exclusion===null||frame.exclusion==="no-others");});
    const precedingFollowing=layer.windows.length>0&&layer.windows.every(win=>{const frame=win.window.frame;return frame.type==="rows"&&frame.start.kind==="preceding"&&frame.end.kind==="following"&&!!frame.start.expr?.reduction&&!!frame.end.expr?.reduction&&(frame.exclusion===null||frame.exclusion==="no-others");});
    const followingUnbounded=layer.windows.length>0&&layer.windows.every(win=>{const frame=win.window.frame;return frame.type==="rows"&&frame.start.kind==="following"&&frame.end.kind==="unbounded"&&!!frame.start.expr?.reduction&&(frame.exclusion===null||frame.exclusion==="no-others");});
    // sqlite3WindowUpdate's ntile() frame has no bound expression. It uses the
    // cached end/start/output cursor family: fill, publish, then inverse the row.
    const currentUnbounded=layer.windows.length>0&&layer.windows.every(win=>{const frame=win.window.frame;return frame.type==="rows"&&frame.start.kind==="current"&&frame.end.kind==="unbounded"&&(frame.exclusion===null||frame.exclusion==="no-others");});
    const precedingUnbounded=layer.windows.length>0&&layer.windows.every(win=>{const frame=win.window.frame;return frame.type==="rows"&&win.window.partitionBy.length===0&&frame.start.kind==="preceding"&&frame.end.kind==="unbounded"&&!!frame.start.expr?.reduction&&(frame.exclusion===null||frame.exclusion==="no-others");});
    const directOffset=cachedDirectOffsetLayer(layer);
    const wholePartition=layer.windows.length>0&&!directOffset&&layer.windows.every(win=>{const frame=win.window.frame;return (frame.exclusion===null||frame.exclusion==="no-others")&&((frame.type==="rows"&&frame.start.kind==="unbounded"&&frame.end.kind==="unbounded")||(frame.type==="range"&&win.window.orderBy.length===0&&frame.start.kind==="unbounded"&&frame.end.kind==="current")||(frame.type==="groups"&&win.window.orderBy.length===0&&frame.start.kind==="current"&&frame.end.kind==="unbounded"));});
    const wholePartitionExcludeGroup=layer.windows.length>0&&layer.windows.every(win=>{const frame=win.window.frame;return frame.type==="rows"&&win.window.orderBy.length>0&&frame.start.kind==="unbounded"&&frame.end.kind==="unbounded"&&frame.exclusion==="group";});
    const singlePeerGroups=layer.windows.length>0&&layer.windows.every(win=>{const frame=win.window.frame;return frame.type==="groups"&&win.window.orderBy.length===0&&frame.start.kind==="current"&&frame.end.kind==="current"&&(frame.exclusion===null||frame.exclusion==="no-others");});
    const orderedCurrentGroups=layer.windows.length>0&&layer.windows.every(win=>{const frame=win.window.frame;return frame.type==="groups"&&win.window.partitionBy.length===0&&win.window.orderBy.length>0&&frame.start.kind==="current"&&frame.end.kind==="current"&&(frame.exclusion===null||frame.exclusion==="no-others");});
    const rangeCurrentPeerExclusion=layer.windows.length>0&&layer.windows.every(win=>{const frame=win.window.frame;return (frame.type==="range"||frame.type==="groups")&&win.window.partitionBy.length===0&&win.window.orderBy.length>0&&frame.start.kind==="current"&&frame.end.kind==="current"&&frame.exclusion==="ties";});
    const rangeOffsetExcludeCurrent=layer.windows.length>0&&layer.windows.every(win=>{const f=win.window.frame;return f.type==="range"&&win.window.orderBy.length===1&&(f.start.kind==="unbounded"||(f.start.kind==="preceding"&&!!f.start.expr?.reduction)||f.start.kind==="current"||(f.start.kind==="following"&&!!f.start.expr?.reduction))&&(f.end.kind==="unbounded"||f.end.kind==="current"||(f.end.kind==="following"&&!!f.end.expr?.reduction))&&(f.exclusion==="current-row"||f.exclusion==="ties"||f.exclusion==="group"||f.exclusion==="no-others");});
    const groupsCumulativeExcludeCurrent=layer.windows.length>0&&layer.windows.every(win=>{const f=win.window.frame;return f.type==="groups"&&win.window.partitionBy.length===0&&win.window.orderBy.length>0&&f.start.kind==="unbounded"&&f.end.kind==="current"&&f.exclusion==="current-row";});
    const groupsOnePrecedingExcludeGroup=layer.windows.length>0&&layer.windows.every(win=>{const f=win.window.frame;return f.type==="groups"&&win.window.partitionBy.length===0&&win.window.orderBy.length>0&&f.start.kind==="preceding"&&!!f.start.expr?.reduction&&windowConstantInteger(expressionFromReduction(f.start.expr.reduction))===1&&f.end.kind==="current"&&f.exclusion==="group";});
    const orderedCumulativePeerGroups=layer.windows.length>0&&layer.windows.every(win=>{const frame=win.window.frame;return (frame.type==="groups"||frame.type==="range")&&win.window.orderBy.length>0&&frame.start.kind==="unbounded"&&frame.end.kind==="current"&&(frame.exclusion===null||frame.exclusion==="no-others");});
    const orderedCumulativePriorGroups=layer.windows.length>0&&layer.windows.every(win=>{const frame=win.window.frame;return frame.type==="groups"&&win.window.orderBy.length>0&&frame.start.kind==="unbounded"&&frame.end.kind==="preceding"&&!!frame.end.expr?.reduction&&windowConstantInteger(expressionFromReduction(frame.end.expr.reduction))===1&&(frame.exclusion===null||frame.exclusion==="no-others");});
    const orderedCumulativePeerExclusion=layer.windows.length>0&&layer.windows.every(win=>{const frame=win.window.frame;return frame.type==="rows"&&win.window.orderBy.length>0&&frame.start.kind==="unbounded"&&frame.end.kind==="current"&&(frame.exclusion==="group"||frame.exclusion==="ties");});
    const orderedSuffixGroups=layer.windows.length>0&&layer.windows.every(win=>{const frame=win.window.frame;return frame.type==="groups"&&win.window.orderBy.length>0&&frame.start.kind==="current"&&frame.end.kind==="unbounded"&&(frame.exclusion===null||frame.exclusion==="no-others");});
    const orderedFollowingGroups=layer.windows.length>0&&layer.windows.every(win=>{const frame=win.window.frame;return frame.type==="groups"&&win.window.orderBy.length>0&&frame.start.kind==="following"&&win.window.functionName==="cume_dist"&&frame.end.kind==="unbounded"&&(frame.exclusion===null||frame.exclusion==="no-others");});
    // With no ORDER BY the complete partition is one peer group. Preserve the
    // cursor/callback windowCodeOp schedule rather than special-casing a result.
    const noOrderFollowingGroups=layer.windows.length>0&&layer.windows.every(win=>{const frame=win.window.frame;return frame.type==="groups"&&win.window.orderBy.length===0&&frame.start.kind==="following"&&frame.end.kind==="unbounded"&&(frame.exclusion===null||frame.exclusion==="no-others");});
    // First offset GROUPS schedule. Like windowCodeOp, this advances the end and
    // start cursors by complete peer groups and leaves callback dispatch in the
    // ordinary AggStep/AggInverse/AggValue opcodes. Do not collapse this into a
    // host-side partition mapper: regNew/lookahead and all cursor positions are
    // resumable VM state across each output Yield.
    const orderedRangePrecedingCurrent=layer.windows.length>0&&layer.windows.every(win=>{const f=win.window.frame;return f.type==="range"&&win.window.orderBy.length===1&&(f.start.kind==="unbounded"||f.start.kind==="current"||((f.start.kind==="preceding"||f.start.kind==="following")&&!!f.start.expr?.reduction))&&(f.end.kind==="current"||f.end.kind==="unbounded"||(f.end.kind==="following"&&!!f.end.expr?.reduction))&&f.exclusion===null;});
    const orderedAdjacentGroups=layer.windows.length>0&&layer.windows.every(win=>{const f=win.window.frame;if(f.type!=="groups"||win.window.orderBy.length===0||f.start.kind!=="preceding"||!f.start.expr?.reduction||(f.exclusion!==null&&f.exclusion!=="group"))return false;if(f.exclusion==="group"&&windowConstantInteger(expressionFromReduction(f.start.expr.reduction))===1)return false;return f.end.kind==="current"||(f.end.kind==="following"&&!!f.end.expr?.reduction);});
    const followingState=setup.find(item=>item.compatibleGroup===layer.compatibleGroup);
    if((following||followingRange||precedingRange||precedingFollowing||followingUnbounded||currentUnbounded||precedingUnbounded||wholePartition||wholePartitionExcludeGroup||singlePeerGroups||orderedCurrentGroups||rangeCurrentPeerExclusion||rangeOffsetExcludeCurrent||groupsCumulativeExcludeCurrent||groupsOnePrecedingExcludeGroup||orderedCumulativePeerGroups||orderedCumulativePriorGroups||orderedCumulativePeerExclusion||orderedSuffixGroups||orderedFollowingGroups||noOrderFollowingGroups||orderedRangePrecedingCurrent||orderedAdjacentGroups)&&!followingState)throw new JSQLiteError("internal","window following state is missing");
    const rangeState=(followingRange||precedingRange||precedingFollowing)?followingState!:null;
    const rangeEndCount=(followingRange||precedingRange||precedingFollowing||followingUnbounded||precedingUnbounded)?++registers:null,rangeStartCount=(followingRange||precedingRange||precedingFollowing||followingUnbounded||precedingUnbounded)?++registers:null;
    const emitPrecedingRangeDrain=():void=>{
      // window.c keeps the current, end and start rows on independently
      // positioned cursors. Our cursor payload operations share regNew, so the
      // end-step and start-inverse reads below must not replace the current row
      // that crosses the producer Yield boundary.
      const outputSave=registers+1;registers+=rangeState!.inputRegisters.length;
      const reversed=ops.length;ops.push({code:"IfRegisterGt",left:rangeState!.boundRegisters.end!,right:rangeState!.boundRegisters.start!,jump:0});
      ops.push({code:"Copy",p1:rangeState!.boundRegisters.end!,p2:rangeEndCount!},{code:"Copy",p1:rangeState!.boundRegisters.start!,p2:rangeStartCount!},{code:"Binary",op:"+",p1:rangeStartCount!,p2:rangeState!.regOne,p3:rangeStartCount!,collation:"binary"});
      const output=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[2],p2:rangeState!.regNew,count:rangeState!.inputRegisters.length,emptyJump:0});
      for(let i=0;i<rangeState!.inputRegisters.length;i++)ops.push({code:"Copy",p1:rangeState!.regNew+i,p2:outputSave+i});
      const endCheck=ops.length;ops.push({code:"IfPos",p1:rangeEndCount!,p2:0,p3:1});const endAdvance=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[1],p2:rangeState!.regNew,count:rangeState!.inputRegisters.length,emptyJump:0});for(const win of layer.windows){const args=Array.from({length:win.window.argumentCount},(_,i)=>rangeState!.regNew+win.argumentColumn+i);ops.push({code:"AggStep",name:win.window.functionName,args,p2:win.regAccum,collation:args.length?collation(expressionFromReduction(layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary"});}const afterEnd=ops.length;(ops[endCheck] as {p2:number}).p2=afterEnd;(ops[endAdvance] as {emptyJump:number}).emptyJump=afterEnd;
      const startCheck=ops.length;ops.push({code:"IfPos",p1:rangeStartCount!,p2:0,p3:1});const startAdvance=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[0],p2:rangeState!.regNew,count:rangeState!.inputRegisters.length,emptyJump:0});for(const win of layer.windows){const args=Array.from({length:win.window.argumentCount},(_,i)=>rangeState!.regNew+win.argumentColumn+i);ops.push({code:"AggInverse",name:win.window.functionName,args,p2:win.regAccum,collation:args.length?collation(expressionFromReduction(layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary"});}const snapshot=ops.length;(ops[startCheck] as {p2:number}).p2=snapshot;(ops[startAdvance] as {emptyJump:number}).emptyJump=snapshot;for(const win of layer.windows)ops.push({code:"AggValue",name:win.window.functionName,p1:win.regAccum,p2:win.regResult});for(let i=0;i<rangeState!.inputRegisters.length;i++)ops.push({code:"Copy",p1:outputSave+i,p2:rangeState!.regNew+i});ops.push({code:"Integer",p1:1n,p2:rangeState!.regOutputReady},{code:"Yield",p1:producerCoroutine,p2:0},{code:"Goto",p2:output});
      const empty=ops.length;(ops[reversed] as {jump:number}).jump=empty;const emptyLoop=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[2],p2:rangeState!.regNew,count:rangeState!.inputRegisters.length,emptyJump:0});for(const win of layer.windows)ops.push({code:"AggValue",name:win.window.functionName,p1:win.regAccum,p2:win.regResult});ops.push({code:"Integer",p1:1n,p2:rangeState!.regOutputReady},{code:"Yield",p1:producerCoroutine,p2:0},{code:"Goto",p2:emptyLoop});const complete=ops.length;(ops[output] as {emptyJump:number}).emptyJump=complete;(ops[emptyLoop] as {emptyJump:number}).emptyJump=complete;
    };
    const emitPrecedingFollowingDrain=():void=>{
      const emitFastValueResults=():void=>{
        const state=rangeState!,fast=layer.windows.filter(win=>win.window.functionName==="first_value"||win.window.functionName==="nth_value");
        if(fast.length===0)return;
        // windowReturnOneRow (window.c:1956-1981) reads first/nth directly from
        // csrApp. The aggregate callbacks are still stepped so nth_value keeps
        // its source diagnostic and lifecycle, but they do not produce these
        // result registers for an ordinary (non-EXCLUDE) frame.
        const current=++registers,start=++registers,end=++registers,zero=++registers;
        ops.push({code:"EphemeralRowid",p1:layer.duplicateCursors[2],p2:current},{code:"Binary",op:"-",p1:current,p2:state.boundRegisters.start!,p3:start,collation:"binary"},{code:"Integer",p1:0n,p2:zero});
        const positive=ops.length;ops.push({code:"IfRegisterGt",left:start,right:zero,jump:0},{code:"Integer",p1:1n,p2:start});(ops[positive] as {jump:number}).jump=ops.length;
        ops.push({code:"Binary",op:"+",p1:current,p2:state.boundRegisters.end!,p3:end,collation:"binary"});
        for(const win of fast){
          const target=++registers,targetPayload=registers+1;registers+=state.inputRegisters.length;
          ops.push({code:"Copy",p1:start,p2:target});
          if(win.window.functionName==="nth_value"){
            const n=state.regNew+win.argumentColumn+1,minusOne=++registers;
            ops.push({code:"Binary",op:"-",p1:n,p2:state.regOne,p3:minusOne,collation:"binary"},{code:"Binary",op:"+",p1:target,p2:minusOne,p3:target,collation:"binary"});
          }
          ops.push({code:"Null",p2:win.regResult});
          const beyond=ops.length;ops.push({code:"IfRegisterGt",left:target,right:end,jump:0});
          const seek=ops.length;ops.push({code:"EphemeralSeekRowid",p1:state.applicationCursor!,rowid:target,jump:0},{code:"EphemeralData",p1:state.applicationCursor!,p2:targetPayload,count:state.inputRegisters.length},{code:"Copy",p1:targetPayload+win.argumentColumn,p2:win.regResult});
          const done=ops.length;(ops[beyond] as {jump:number}).jump=done;(ops[seek] as {jump:number}).jump=done;
        }
      };
      ops.push({code:"Copy",p1:rangeState!.boundRegisters.end!,p2:rangeEndCount!},{code:"Binary",op:"+",p1:rangeEndCount!,p2:rangeState!.regOne,p3:rangeEndCount!,collation:"binary"});
      const initial=ops.length;ops.push({code:"IfPos",p1:rangeEndCount!,p2:0,p3:1},{code:"Goto",p2:0});const initialAdvance=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[1],p2:rangeState!.regNew,count:rangeState!.inputRegisters.length,emptyJump:0});for(const win of layer.windows){const args=Array.from({length:win.window.argumentCount},(_,i)=>rangeState!.regNew+win.argumentColumn+i);ops.push({code:"AggStep",name:win.window.functionName,args,p2:win.regAccum,collation:args.length?collation(expressionFromReduction(layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary"});}ops.push({code:"Goto",p2:initial});const initialized=ops.length;(ops[initial] as {p2:number}).p2=initialAdvance;(ops[initial+1] as {p2:number}).p2=initialized;(ops[initialAdvance] as {emptyJump:number}).emptyJump=initialized;
      ops.push({code:"Copy",p1:rangeState!.boundRegisters.start!,p2:rangeStartCount!});
      const output=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[2],p2:rangeState!.regNew,count:rangeState!.inputRegisters.length,emptyJump:0});for(const win of layer.windows)ops.push({code:"AggValue",name:win.window.functionName,p1:win.regAccum,p2:win.regResult});emitFastValueResults();ops.push({code:"Integer",p1:1n,p2:rangeState!.regOutputReady},{code:"Yield",p1:producerCoroutine,p2:0});
      const endAdvance=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[1],p2:rangeState!.regNew,count:rangeState!.inputRegisters.length,emptyJump:0});for(const win of layer.windows){const args=Array.from({length:win.window.argumentCount},(_,i)=>rangeState!.regNew+win.argumentColumn+i);ops.push({code:"AggStep",name:win.window.functionName,args,p2:win.regAccum,collation:args.length?collation(expressionFromReduction(layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary"});}const afterEnd=ops.length;(ops[endAdvance] as {emptyJump:number}).emptyJump=afterEnd;
      const startCheck=ops.length;ops.push({code:"IfPos",p1:rangeStartCount!,p2:0,p3:1});const startAdvance=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[0],p2:rangeState!.regNew,count:rangeState!.inputRegisters.length,emptyJump:0});for(const win of layer.windows){const args=Array.from({length:win.window.argumentCount},(_,i)=>rangeState!.regNew+win.argumentColumn+i);ops.push({code:"AggInverse",name:win.window.functionName,args,p2:win.regAccum,collation:args.length?collation(expressionFromReduction(layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary"});}const afterStart=ops.length;(ops[startCheck] as {p2:number}).p2=afterStart;(ops[startAdvance] as {emptyJump:number}).emptyJump=afterStart;ops.push({code:"Goto",p2:output});const complete=ops.length;(ops[output] as {emptyJump:number}).emptyJump=complete;
    };
    const emitGroupsOnePrecedingExcludeGroupDrain=():void=>{
      const state=followingState!,peerCount=state.endPeerRegisters.length,peerStart=layer.windows[0]!.argumentColumn-peerCount,initialized=++registers,hasPrevious=++registers;
      const currentPeer=registers+1;registers+=peerCount;const previousPeer=registers+1;registers+=peerCount;const outputSave=registers+1;registers+=state.inputRegisters.length;const temporary=layer.windows.map(()=>++registers);
      ops.push({code:"Integer",p1:0n,p2:initialized},{code:"Integer",p1:0n,p2:hasPrevious});const output=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[2],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:state.regNew+i,p2:outputSave+i});
      const first=ops.length;ops.push({code:"IfNot",p1:initialized,p2:0});const sameGroup=ops.length;ops.push({code:"CompareGroup",left:outputSave+peerStart,right:currentPeer,count:peerCount,keyInfo:state.peerKeyInfo!,jump:0});for(let i=0;i<peerCount;i++)ops.push({code:"Copy",p1:currentPeer+i,p2:previousPeer+i});for(let i=0;i<peerCount;i++)ops.push({code:"Copy",p1:outputSave+peerStart+i,p2:currentPeer+i});ops.push({code:"Integer",p1:1n,p2:hasPrevious},{code:"Goto",p2:0});const initialize=ops.length;(ops[first] as {p2:number}).p2=initialize;for(let i=0;i<peerCount;i++)ops.push({code:"Copy",p1:outputSave+peerStart+i,p2:currentPeer+i});ops.push({code:"Integer",p1:1n,p2:initialized});const scanStart=ops.length;(ops[sameGroup] as {jump:number}).jump=scanStart;(ops[initialize-1] as {p2:number}).p2=scanStart;ops.push({code:"AggReset",registers:temporary});const noPrevious=ops.length;ops.push({code:"IfNot",p1:hasPrevious,p2:0});const rewind=ops.length;ops.push({code:"EphemeralRewind",p1:state.applicationCursor!,p2:0});const scan=ops.length;ops.push({code:"EphemeralData",p1:state.applicationCursor!,p2:state.regNew,count:state.inputRegisters.length});const peer=ops.length;ops.push({code:"CompareGroup",left:state.regNew+peerStart,right:previousPeer,count:peerCount,keyInfo:state.peerKeyInfo!,jump:0},{code:"Goto",p2:0});const step=ops.length;(ops[peer] as {jump:number}).jump=step;for(let i=0;i<layer.windows.length;i++){const win=layer.windows[i]!,args=Array.from({length:win.window.argumentCount},(_,j)=>state.regNew+win.argumentColumn+j);let filter:number|null=null;if(win.filterColumn!==null){filter=ops.length;ops.push({code:"IfNot",p1:state.regNew+win.filterColumn,p2:0});}const at=ops.length;ops.push({code:"AggStep",name:win.window.functionName,args,p2:temporary[i]!,collation:args.length?collation(expressionFromReduction(layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary"});if(filter!==null)(ops[filter] as {p2:number}).p2=at+1;}const next=ops.length;(ops[peer+1] as {p2:number}).p2=next;ops.push({code:"EphemeralNext",p1:state.applicationCursor!,p2:scan});const snapshot=ops.length;(ops[noPrevious] as {p2:number}).p2=snapshot;(ops[rewind] as {p2:number}).p2=snapshot;for(let i=0;i<layer.windows.length;i++)ops.push({code:"AggValue",name:layer.windows[i]!.window.functionName,p1:temporary[i]!,p2:layer.windows[i]!.regResult});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:outputSave+i,p2:state.regNew+i});ops.push({code:"Integer",p1:1n,p2:state.regOutputReady},{code:"Yield",p1:producerCoroutine,p2:0},{code:"Goto",p2:output});const done=ops.length;(ops[output] as {emptyJump:number}).emptyJump=done;
    };
    const emitGroupsCumulativeExcludeCurrentDrain=():void=>{
      const state=followingState!,peerCount=state.endPeerRegisters.length,peerStart=layer.windows[0]!.argumentColumn-peerCount,currentRowid=++registers,candidateRowid=++registers,same=++registers;
      const outputSave=registers+1;registers+=state.inputRegisters.length;const temporary=layer.windows.map(()=>++registers);
      const output=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[2],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0},{code:"EphemeralRowid",p1:layer.duplicateCursors[2],p2:currentRowid});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:state.regNew+i,p2:outputSave+i});ops.push({code:"AggReset",registers:temporary});
      const rewind=ops.length;ops.push({code:"EphemeralRewind",p1:state.applicationCursor!,p2:0});const scan=ops.length;ops.push({code:"EphemeralData",p1:state.applicationCursor!,p2:state.regNew,count:state.inputRegisters.length},{code:"EphemeralRowid",p1:state.applicationCursor!,p2:candidateRowid});
      const afterCurrent=ops.length;ops.push({code:"IfRegisterGt",left:candidateRowid,right:currentRowid,jump:0},{code:"Eq",p1:candidateRowid,p2:currentRowid,p3:same,affinity:"numeric",collation:"binary"});const beforeIdentity=ops.length;ops.push({code:"IfNot",p1:same,p2:0},{code:"Goto",p2:0});
      const peer=ops.length;(ops[afterCurrent] as {jump:number}).jump=peer;ops.push({code:"CompareGroup",left:state.regNew+peerStart,right:outputSave+peerStart,count:peerCount,keyInfo:state.peerKeyInfo!,jump:0},{code:"Goto",p2:0});
      const step=ops.length;(ops[beforeIdentity] as {p2:number}).p2=step;(ops[peer] as {jump:number}).jump=step;for(let i=0;i<layer.windows.length;i++){const win=layer.windows[i]!,args=Array.from({length:win.window.argumentCount},(_,j)=>state.regNew+win.argumentColumn+j);ops.push({code:"AggStep",name:win.window.functionName,args,p2:temporary[i]!,collation:args.length?collation(expressionFromReduction(layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary"});}
      const next=ops.length;(ops[beforeIdentity+1] as {p2:number}).p2=next;ops.push({code:"EphemeralNext",p1:state.applicationCursor!,p2:scan});const snapshot=ops.length;(ops[rewind] as {p2:number}).p2=snapshot;(ops[peer+1] as {p2:number}).p2=snapshot;for(let i=0;i<layer.windows.length;i++)ops.push({code:"AggValue",name:layer.windows[i]!.window.functionName,p1:temporary[i]!,p2:layer.windows[i]!.regResult});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:outputSave+i,p2:state.regNew+i});ops.push({code:"Integer",p1:1n,p2:state.regOutputReady},{code:"Yield",p1:producerCoroutine,p2:0},{code:"Goto",p2:output});const done=ops.length;(ops[output] as {emptyJump:number}).emptyJump=done;
    };
    const emitRangeOffsetExcludeCurrentDrain=():void=>{
      const state=followingState!,frame=layer.windows[0]!.window.frame,orderIndex=layer.windows[0]!.argumentColumn-state.endPeerRegisters.length,currentRowid=++registers,candidateRowid=++registers,same=++registers;
      const cumulativeRangeTies=frame.exclusion==="ties"&&frame.start.kind==="unbounded"&&frame.end.kind==="current";
      const outputSave=registers+1;registers+=state.inputRegisters.length;const temporary=layer.windows.map(()=>++registers),term=layer.producerOrderBy.find(item=>item.source==="order")!;const coll=typeof state.peerKeyInfo!.terms[0]!.collation==="string"?state.peerKeyInfo!.terms[0]!.collation:"binary";
      const output=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[2],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0},{code:"EphemeralRowid",p1:layer.duplicateCursors[2],p2:currentRowid});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:state.regNew+i,p2:outputSave+i});ops.push({code:"AggReset",registers:temporary});
      const rewind=ops.length;ops.push({code:"EphemeralRewind",p1:state.applicationCursor!,p2:0});const scan=ops.length;ops.push({code:"EphemeralData",p1:state.applicationCursor!,p2:state.regNew,count:state.inputRegisters.length},{code:"EphemeralRowid",p1:state.applicationCursor!,p2:candidateRowid});const startUnbounded=layer.windows[0]!.window.frame.start.kind==="unbounded",beforeStart=ops.length;ops.push(startUnbounded?{code:"Goto",p2:0}:layer.windows[0]!.window.frame.start.kind==="current"?{code:"WindowRangeTest",candidate:state.regNew+orderIndex,current:outputSave+orderIndex,mode:"start-current",descending:term.descending,collation:coll,jump:0}:{code:"WindowRangeTest",candidate:state.regNew+orderIndex,current:outputSave+orderIndex,offset:state.boundRegisters.start!,mode:layer.windows[0]!.window.frame.start.kind==="following"?"start-following":"start-preceding",descending:term.descending,collation:coll,jump:0});const endUnbounded=layer.windows[0]!.window.frame.end.kind==="unbounded",endEligible=ops.length;ops.push(endUnbounded?{code:"Goto",p2:0}:layer.windows[0]!.window.frame.end.kind==="following"?{code:"WindowRangeTest",candidate:state.regNew+orderIndex,current:outputSave+orderIndex,offset:state.boundRegisters.end!,mode:"end-following",descending:term.descending,collation:coll,jump:0}:{code:"WindowRangeTest",candidate:state.regNew+orderIndex,current:outputSave+orderIndex,mode:"end-current",descending:term.descending,collation:coll,jump:0},{code:"Goto",p2:0});const eligible=ops.length;if(startUnbounded)(ops[beforeStart] as {p2:number}).p2=eligible;if(endUnbounded)(ops[endEligible] as {p2:number}).p2=eligible;else (ops[endEligible] as {jump:number}).jump=eligible;let skipCurrent:number,identityStep:number|null=null;if(layer.windows[0]!.window.frame.exclusion==="no-others"){skipCurrent=ops.length;ops.push({code:"Goto",p2:skipCurrent+1});identityStep=skipCurrent+1;}else if(layer.windows[0]!.window.frame.exclusion==="group"){const peer=ops.length;ops.push({code:"CompareGroup",left:state.regNew+orderIndex,right:outputSave+orderIndex,count:1,keyInfo:state.peerKeyInfo!,jump:0},{code:"Goto",p2:0});const step=ops.length;(ops[peer+1] as {p2:number}).p2=step;skipCurrent=peer;identityStep=step;}else if(cumulativeRangeTies){ops.push({code:"Eq",p1:candidateRowid,p2:currentRowid,p3:same,affinity:"numeric",collation:"binary"});skipCurrent=ops.length;ops.push({code:"IfNot",p1:same,p2:0},{code:"Goto",p2:0});const nonIdentity=ops.length;(ops[skipCurrent] as {p2:number}).p2=nonIdentity;ops.push({code:"WindowRangeTest",candidate:state.regNew+orderIndex,current:outputSave+orderIndex,mode:"start-current",descending:term.descending,collation:coll,jump:0},{code:"Goto",p2:0});const step=ops.length;identityStep=step;(ops[skipCurrent+1] as {p2:number}).p2=step;}else if(layer.windows[0]!.window.frame.exclusion==="ties"){const peer=ops.length;ops.push({code:"CompareGroup",left:state.regNew+orderIndex,right:outputSave+orderIndex,count:1,keyInfo:state.peerKeyInfo!,jump:0},{code:"Goto",p2:0});const identity=ops.length;(ops[peer] as {jump:number}).jump=identity;ops.push({code:"Eq",p1:candidateRowid,p2:currentRowid,p3:same,affinity:"numeric",collation:"binary"});skipCurrent=ops.length;ops.push({code:"IfNot",p1:same,p2:0},{code:"Goto",p2:0});const step=ops.length;identityStep=step;(ops[peer+1] as {p2:number}).p2=step;}else{ops.push({code:"Eq",p1:candidateRowid,p2:currentRowid,p3:same,affinity:"numeric",collation:"binary"});skipCurrent=ops.length;ops.push({code:"IfNot",p1:same,p2:0},{code:"Goto",p2:0});const step=ops.length;(ops[skipCurrent] as {p2:number}).p2=step;}for(let i=0;i<layer.windows.length;i++){const win=layer.windows[i]!,args=Array.from({length:win.window.argumentCount},(_,j)=>state.regNew+win.argumentColumn+j);let filter:number|null=null;if(win.filterColumn!==null){filter=ops.length;ops.push({code:"IfNot",p1:state.regNew+win.filterColumn,p2:0});}const at=ops.length;ops.push({code:"AggStep",name:win.window.functionName,args,p2:temporary[i]!,collation:args.length?collation(expressionFromReduction(layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary"});if(filter!==null)(ops[filter] as {p2:number}).p2=at+1;}
      const next=ops.length;if(!startUnbounded)(ops[beforeStart] as {jump:number}).jump=next;if(identityStep!==null){if(layer.windows[0]!.window.frame.exclusion==="group")(ops[skipCurrent] as {jump:number}).jump=next;else if(layer.windows[0]!.window.frame.exclusion==="ties"&&layer.windows[0]!.window.frame.start.kind==="unbounded"&&layer.windows[0]!.window.frame.end.kind==="current"){(ops[skipCurrent+2] as {jump:number}).jump=identityStep;(ops[skipCurrent+3] as {p2:number}).p2=next;}else if(layer.windows[0]!.window.frame.exclusion!=="no-others"){(ops[skipCurrent] as {p2:number}).p2=next;(ops[skipCurrent+1] as {p2:number}).p2=identityStep;}}else (ops[skipCurrent+1] as {p2:number}).p2=next;ops.push({code:"EphemeralNext",p1:state.applicationCursor!,p2:scan});const snapshot=ops.length;(ops[rewind] as {p2:number}).p2=snapshot;(ops[endEligible+1] as {p2:number}).p2=snapshot;for(let i=0;i<layer.windows.length;i++)ops.push({code:"AggValue",name:layer.windows[i]!.window.functionName,p1:temporary[i]!,p2:layer.windows[i]!.regResult});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:outputSave+i,p2:state.regNew+i});ops.push({code:"Integer",p1:1n,p2:state.regOutputReady},{code:"Yield",p1:producerCoroutine,p2:0},{code:"Goto",p2:output});const done=ops.length;(ops[output] as {emptyJump:number}).emptyJump=done;
    };
    const emitRangeCurrentTiesDrain=():void=>{
      const state=followingState!,peerCount=state.endPeerRegisters.length,peerStart=layer.windows[0]!.argumentColumn-peerCount,currentRowid=++registers,candidateRowid=++registers,same=++registers;
      const outputSave=registers+1;registers+=state.inputRegisters.length;const temporary=layer.windows.map(()=>++registers);
      const output=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[2],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0},{code:"EphemeralRowid",p1:layer.duplicateCursors[2],p2:currentRowid});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:state.regNew+i,p2:outputSave+i});
      ops.push({code:"AggReset",registers:temporary});const rewind=ops.length;ops.push({code:"EphemeralRewind",p1:state.applicationCursor!,p2:0});const scan=ops.length;ops.push({code:"EphemeralData",p1:state.applicationCursor!,p2:state.regNew,count:state.inputRegisters.length},{code:"EphemeralRowid",p1:state.applicationCursor!,p2:candidateRowid});const pastCurrent=ops.length;ops.push({code:"IfRegisterGt",left:candidateRowid,right:currentRowid,jump:0});const peer=ops.length;ops.push({code:"CompareGroup",left:state.regNew+peerStart,right:outputSave+peerStart,count:peerCount,keyInfo:state.peerKeyInfo!,jump:0},{code:"Goto",p2:0});const identity=ops.length;(ops[peer] as {jump:number}).jump=identity;ops.push({code:"Eq",p1:candidateRowid,p2:currentRowid,p3:same,affinity:"numeric",collation:"binary"});const skip=ops.length;ops.push({code:"IfNot",p1:same,p2:0});for(let i=0;i<layer.windows.length;i++){const win=layer.windows[i]!,args=Array.from({length:win.window.argumentCount},(_,j)=>state.regNew+win.argumentColumn+j);let filter:number|null=null;if(win.filterColumn!==null){filter=ops.length;ops.push({code:"IfNot",p1:state.regNew+win.filterColumn,p2:0});}const at=ops.length;ops.push({code:"AggStep",name:win.window.functionName,args,p2:temporary[i]!,collation:args.length?collation(expressionFromReduction(layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary"});if(filter!==null)(ops[filter] as {p2:number}).p2=at+1;}const next=ops.length;(ops[peer+1] as {p2:number}).p2=orderedCumulativePeerExclusion?skip+1:next;(ops[skip] as {p2:number}).p2=next;ops.push({code:"EphemeralNext",p1:state.applicationCursor!,p2:scan});const snapshot=ops.length;(ops[rewind] as {p2:number}).p2=snapshot;(ops[pastCurrent] as {jump:number}).jump=snapshot;for(let i=0;i<layer.windows.length;i++)ops.push({code:"AggValue",name:layer.windows[i]!.window.functionName,p1:temporary[i]!,p2:layer.windows[i]!.regResult});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:outputSave+i,p2:state.regNew+i});ops.push({code:"Integer",p1:1n,p2:state.regOutputReady},{code:"Yield",p1:producerCoroutine,p2:0},{code:"Goto",p2:output});const done=ops.length;(ops[output] as {emptyJump:number}).emptyJump=done;
    };
    const emitOrderedCurrentGroupsDrain=():void=>{
      const state=followingState!,peerCount=state.currentPeerRegisters.length,peerStart=layer.windows[0]!.argumentColumn-layer.windows[0]!.window.partitionBy.length-peerCount,groupRows=++registers;
      // EphemeralAdvanceData on the end cursor reads one row ahead to discover a
      // peer boundary. The current-cursor output loop also uses regNew, so retain
      // that complete lookahead payload before output overwrites it. This is the
      // register-shaped equivalent of windowCodeOp preserving its end cursor row.
      const lookahead=registers+1;registers+=state.inputRegisters.length;
      const first=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[1],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0});
      for(let i=0;i<peerCount;i++)ops.push({code:"Copy",p1:state.regNew+peerStart+i,p2:state.endPeerRegisters[i]!});
      const beginGroup=ops.length;ops.push({code:"Integer",p1:0n,p2:groupRows});
      const stepRow=ops.length;for(const win of layer.windows){const args=Array.from({length:win.window.argumentCount},(_,i)=>state.regNew+win.argumentColumn+i);ops.push({code:"AggStep",name:win.window.functionName,args,p2:win.regAccum,collation:args.length?collation(expressionFromReduction(layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary"});}ops.push({code:"Binary",op:"+",p1:groupRows,p2:state.regOne,p3:groupRows,collation:"binary"});
      const nextEnd=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[1],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0});const compare=ops.length;ops.push({code:"CompareGroup",left:state.regNew+peerStart,right:state.endPeerRegisters[0]!,count:peerCount,keyInfo:state.peerKeyInfo!,jump:stepRow});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:state.regNew+i,p2:lookahead+i});
      const output=ops.length;for(const win of layer.windows)ops.push({code:"AggValue",name:win.window.functionName,p1:win.regAccum,p2:win.regResult});const outputLoop=ops.length;ops.push({code:"IfPos",p1:groupRows,p2:0,p3:1},{code:"Goto",p2:0});const outputRow=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[2],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0},{code:"Integer",p1:1n,p2:state.regOutputReady},{code:"Yield",p1:producerCoroutine,p2:0},{code:"Goto",p2:outputLoop});
      const nextGroup=ops.length;(ops[outputLoop] as {p2:number}).p2=outputRow;(ops[outputLoop+1] as {p2:number}).p2=nextGroup;ops.push({code:"AggReset",registers:layer.windows.map(win=>win.regAccum)});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:lookahead+i,p2:state.regNew+i});for(let i=0;i<peerCount;i++)ops.push({code:"Copy",p1:state.regNew+peerStart+i,p2:state.endPeerRegisters[i]!});ops.push({code:"Goto",p2:beginGroup});
      const finalOutput=ops.length;(ops[first] as {emptyJump:number}).emptyJump=finalOutput;(ops[nextEnd] as {emptyJump:number}).emptyJump=finalOutput;for(const win of layer.windows)ops.push({code:"AggValue",name:win.window.functionName,p1:win.regAccum,p2:win.regResult});const finalLoop=ops.length;ops.push({code:"IfPos",p1:groupRows,p2:0,p3:1},{code:"Goto",p2:0});const finalRow=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[2],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0},{code:"Integer",p1:1n,p2:state.regOutputReady},{code:"Yield",p1:producerCoroutine,p2:0},{code:"Goto",p2:finalLoop});const complete=ops.length;(ops[finalLoop] as {p2:number}).p2=finalRow;(ops[finalLoop+1] as {p2:number}).p2=complete;(ops[finalRow] as {emptyJump:number}).emptyJump=complete;
    };
    const emitOrderedCumulativePeerGroupsDrain=():void=>{
      const state=followingState!,peerCount=state.endPeerRegisters.length,peerStart=layer.windows[0]!.argumentColumn-peerCount,groupRows=++registers,commitRows=++registers,hasLookahead=++registers;
      const lookahead=registers+1;registers+=state.inputRegisters.length;ops.push({code:"Integer",p1:0n,p2:hasLookahead});
      const group=ops.length;ops.push({code:"Integer",p1:0n,p2:groupRows},{code:"Integer",p1:0n,p2:commitRows});if(orderedCumulativePeerExclusion||orderedCumulativePriorGroups)for(const win of layer.windows)ops.push({code:"AggValue",name:win.window.functionName,p1:win.regAccum,p2:win.regResult});const useCursor=ops.length;ops.push({code:"IfNot",p1:hasLookahead,p2:0});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:lookahead+i,p2:state.regNew+i});ops.push({code:"Integer",p1:0n,p2:hasLookahead},{code:"Goto",p2:0});const advance=ops.length;(ops[useCursor] as {p2:number}).p2=advance;const first=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[1],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0});const have=ops.length;(ops[advance-1] as {p2:number}).p2=have;for(let i=0;i<peerCount;i++)ops.push({code:"Copy",p1:state.regNew+peerStart+i,p2:state.endPeerRegisters[i]!});
      const step=ops.length;if(layer.windows[0]!.window.frame.exclusion!=="ties")windowCodeOp({ops,layer,state,collationOf:column=>collation(expressionFromReduction(layer.bufferExpressions[column]!.reduction!))},"WINDOW_AGGSTEP");ops.push({code:"Binary",op:"+",p1:groupRows,p2:state.regOne,p3:groupRows,collation:"binary"},{code:"Binary",op:"+",p1:commitRows,p2:state.regOne,p3:commitRows,collation:"binary"});const next=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[1],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0},{code:"CompareGroup",left:state.regNew+peerStart,right:state.endPeerRegisters[0]!,count:peerCount,keyInfo:state.peerKeyInfo!,jump:step});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:state.regNew+i,p2:lookahead+i});ops.push({code:"Integer",p1:1n,p2:hasLookahead});
      const output=ops.length;(ops[next] as {emptyJump:number}).emptyJump=output;if(!orderedCumulativePeerExclusion&&!orderedCumulativePriorGroups)for(const win of layer.windows)ops.push({code:"AggValue",name:win.window.functionName,p1:win.regAccum,p2:win.regResult});const loop=ops.length;ops.push({code:"IfPos",p1:groupRows,p2:0,p3:1},{code:"Goto",p2:0});const row=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[2],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0});if(layer.windows[0]!.window.frame.exclusion==="ties"){for(const win of layer.windows){const args=Array.from({length:win.window.argumentCount},(_,i)=>state.regNew+win.argumentColumn+i);ops.push({code:"AggStep",name:win.window.functionName,args,p2:win.regAccum,collation:args.length?collation(expressionFromReduction(layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary"},{code:"AggValue",name:win.window.functionName,p1:win.regAccum,p2:win.regResult},{code:"AggInverse",name:win.window.functionName,args,p2:win.regAccum,collation:args.length?collation(expressionFromReduction(layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary"});}}ops.push({code:"Integer",p1:1n,p2:state.regOutputReady},{code:"Yield",p1:producerCoroutine,p2:0},{code:"Goto",p2:loop});const following=ops.length;(ops[loop] as {p2:number}).p2=row;(ops[loop+1] as {p2:number}).p2=following;if(layer.windows[0]!.window.frame.exclusion==="ties"){const commit=ops.length;ops.push({code:"IfPos",p1:commitRows,p2:0,p3:1},{code:"Goto",p2:0});const commitRow=ops.length;(ops[commit] as {p2:number}).p2=commitRow;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[0],p2:state.regNew,count:state.inputRegisters.length});for(const win of layer.windows){const args=Array.from({length:win.window.argumentCount},(_,i)=>state.regNew+win.argumentColumn+i);ops.push({code:"AggStep",name:win.window.functionName,args,p2:win.regAccum,collation:args.length?collation(expressionFromReduction(layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary"});}ops.push({code:"Goto",p2:commit});const committed=ops.length;(ops[commit+1] as {p2:number}).p2=committed;}ops.push({code:"Goto",p2:group});const done=ops.length;(ops[first] as {emptyJump:number}).emptyJump=done;(ops[row] as {emptyJump:number}).emptyJump=done;
    };
    const emitOrderedFollowingGroupsDrain=():void=>{
      const state=followingState!,peerCount=state.endPeerRegisters.length,peerStart=layer.windows[0]!.argumentColumn-peerCount,groupRows=++registers,hasLookahead=++registers;
      const lookahead=registers+1;registers+=state.inputRegisters.length;
      // cume_dist is coerced by sqlite3WindowUpdate() to GROUPS 1 FOLLOWING..
      // UNBOUNDED FOLLOWING. Fill nTotal once, then advance the start cursor by
      // one complete peer group before AggValue, matching windowCodeOp's inverse
      // callback schedule without host-side partition recomputation.
      const fill=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[1],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0});for(const win of layer.windows){const args=Array.from({length:win.window.argumentCount},(_,i)=>state.regNew+win.argumentColumn+i);ops.push({code:"AggStep",name:win.window.functionName,args,p2:win.regAccum,collation:args.length?collation(expressionFromReduction(layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary"});}ops.push({code:"Goto",p2:fill});const filled=ops.length;(ops[fill] as {emptyJump:number}).emptyJump=filled;ops.push({code:"Integer",p1:0n,p2:hasLookahead});
      const group=ops.length;ops.push({code:"Integer",p1:0n,p2:groupRows});const useSaved=ops.length;ops.push({code:"IfNot",p1:hasLookahead,p2:0});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:lookahead+i,p2:state.regNew+i});ops.push({code:"Integer",p1:0n,p2:hasLookahead},{code:"Goto",p2:0});const advance=ops.length;(ops[useSaved] as {p2:number}).p2=advance;const first=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[0],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0});const have=ops.length;(ops[advance-1] as {p2:number}).p2=have;for(let i=0;i<peerCount;i++)ops.push({code:"Copy",p1:state.regNew+peerStart+i,p2:state.startPeerRegisters[i]!});
      const inverse=ops.length;for(const win of layer.windows){const args=Array.from({length:win.window.argumentCount},(_,i)=>state.regNew+win.argumentColumn+i);ops.push({code:"AggInverse",name:win.window.functionName,args,p2:win.regAccum,collation:args.length?collation(expressionFromReduction(layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary"});}ops.push({code:"Binary",op:"+",p1:groupRows,p2:state.regOne,p3:groupRows,collation:"binary"});const next=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[0],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0},{code:"CompareGroup",left:state.regNew+peerStart,right:state.startPeerRegisters[0]!,count:peerCount,keyInfo:state.peerKeyInfo!,jump:inverse});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:state.regNew+i,p2:lookahead+i});ops.push({code:"Integer",p1:1n,p2:hasLookahead});const snapshot=ops.length;(ops[next] as {emptyJump:number}).emptyJump=snapshot;for(const win of layer.windows)ops.push({code:"AggValue",name:win.window.functionName,p1:win.regAccum,p2:win.regResult});
      const output=ops.length;ops.push({code:"IfPos",p1:groupRows,p2:0,p3:1},{code:"Goto",p2:0});const row=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[2],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0},{code:"Integer",p1:1n,p2:state.regOutputReady},{code:"Yield",p1:producerCoroutine,p2:0},{code:"Goto",p2:output});const following=ops.length;(ops[output] as {p2:number}).p2=row;(ops[output+1] as {p2:number}).p2=following;ops.push({code:"Goto",p2:group});const done=ops.length;(ops[first] as {emptyJump:number}).emptyJump=done;(ops[row] as {emptyJump:number}).emptyJump=done;
    };
    const emitOrderedSuffixGroupsDrain=():void=>{
      const state=followingState!,peerCount=state.endPeerRegisters.length,peerStart=layer.windows[0]!.argumentColumn-peerCount,hasOutput=++registers,hasInverse=++registers;
      const outputLookahead=registers+1;registers+=state.inputRegisters.length;const inverseLookahead=registers+1;registers+=state.inputRegisters.length;
      const fill=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[1],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0});for(const win of layer.windows){const args=Array.from({length:win.window.argumentCount},(_,i)=>state.regNew+win.argumentColumn+i);ops.push({code:"AggStep",name:win.window.functionName,args,p2:win.regAccum,collation:args.length?collation(expressionFromReduction(layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary"});}ops.push({code:"Goto",p2:fill});const filled=ops.length;(ops[fill] as {emptyJump:number}).emptyJump=filled;ops.push({code:"Integer",p1:0n,p2:hasOutput},{code:"Integer",p1:0n,p2:hasInverse});
      const group=ops.length;
      // Snapshot before publishing the peer group. The output cursor itself owns
      // each authoritative payload; retaining only the one-row lookahead mirrors
      // windowCodeOp's separate current cursor and avoids yielding that lookahead
      // repeatedly after a peer-counting pre-scan.
      for(const win of layer.windows)ops.push({code:"AggValue",name:win.window.functionName,p1:win.regAccum,p2:win.regResult});
      const useOutput=ops.length;ops.push({code:"IfNot",p1:hasOutput,p2:0});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:outputLookahead+i,p2:state.regNew+i});ops.push({code:"Integer",p1:0n,p2:hasOutput},{code:"Goto",p2:0});const advanceOutput=ops.length;(ops[useOutput] as {p2:number}).p2=advanceOutput;const firstOutput=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[2],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0});const haveOutput=ops.length;(ops[advanceOutput-1] as {p2:number}).p2=haveOutput;for(let i=0;i<peerCount;i++)ops.push({code:"Copy",p1:state.regNew+peerStart+i,p2:state.currentPeerRegisters[i]!});
      const yieldRow=ops.length;ops.push({code:"Integer",p1:1n,p2:state.regOutputReady},{code:"Yield",p1:producerCoroutine,p2:0});const nextOutput=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[2],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0},{code:"CompareGroup",left:state.regNew+peerStart,right:state.currentPeerRegisters[0]!,count:peerCount,keyInfo:state.peerKeyInfo!,jump:yieldRow});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:state.regNew+i,p2:outputLookahead+i});ops.push({code:"Integer",p1:1n,p2:hasOutput});
      const inverseStart=ops.length;(ops[nextOutput] as {emptyJump:number}).emptyJump=inverseStart;
      const useInverse=ops.length;ops.push({code:"IfNot",p1:hasInverse,p2:0});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:inverseLookahead+i,p2:state.regNew+i});ops.push({code:"Integer",p1:0n,p2:hasInverse},{code:"Goto",p2:0});const advanceInverse=ops.length;(ops[useInverse] as {p2:number}).p2=advanceInverse;const firstInverse=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[0],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0});const haveInverse=ops.length;(ops[advanceInverse-1] as {p2:number}).p2=haveInverse;for(let i=0;i<peerCount;i++)ops.push({code:"Copy",p1:state.regNew+peerStart+i,p2:state.startPeerRegisters[i]!});const inverse=ops.length;for(const win of layer.windows){const args=Array.from({length:win.window.argumentCount},(_,i)=>state.regNew+win.argumentColumn+i);ops.push({code:"AggInverse",name:win.window.functionName,args,p2:win.regAccum,collation:args.length?collation(expressionFromReduction(layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary"});}const nextInverse=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[0],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0},{code:"CompareGroup",left:state.regNew+peerStart,right:state.startPeerRegisters[0]!,count:peerCount,keyInfo:state.peerKeyInfo!,jump:inverse});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:state.regNew+i,p2:inverseLookahead+i});ops.push({code:"Integer",p1:1n,p2:hasInverse},{code:"Goto",p2:group});const done=ops.length;(ops[firstOutput] as {emptyJump:number}).emptyJump=done;(ops[firstInverse] as {emptyJump:number}).emptyJump=done;(ops[nextInverse] as {emptyJump:number}).emptyJump=done;
    };
    const emitOrderedRangePrecedingCurrentDrain=():void=>{
      const state=followingState!,orderIndex=layer.windows[0]!.argumentColumn-state.endPeerRegisters.length,currentKey=++registers,endFlag=++registers,startFlag=++registers;
      const outputSave=registers+1;registers+=state.inputRegisters.length;const endSave=registers+1;registers+=state.inputRegisters.length;const startSave=registers+1;registers+=state.inputRegisters.length;
      const term=layer.producerOrderBy.find(term=>term.source==="order")!;ops.push({code:"Integer",p1:0n,p2:endFlag},{code:"Integer",p1:0n,p2:startFlag});
      const output=ops.length;const outputAdvance=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[2],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:state.regNew+i,p2:outputSave+i});ops.push({code:"Copy",p1:state.regNew+orderIndex,p2:currentKey});
      const endLoop=ops.length;const endUse=ops.length;ops.push({code:"IfNot",p1:endFlag,p2:0});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:endSave+i,p2:state.regNew+i});ops.push({code:"Integer",p1:0n,p2:endFlag},{code:"Goto",p2:0});const endAdvance=ops.length;(ops[endUse] as {p2:number}).p2=endAdvance;const endFirst=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[1],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0});const endHave=ops.length;(ops[endAdvance-1] as {p2:number}).p2=endHave;const endEligible=ops.length;ops.push(layer.windows[0]!.window.frame.end.kind==="following"?{code:"WindowRangeTest",candidate:state.regNew+orderIndex,current:outputSave+orderIndex,offset:state.boundRegisters.end!,mode:"end-following",descending:term.descending,collation:(typeof state.peerKeyInfo!.terms[0]!.collation==="string"?state.peerKeyInfo!.terms[0]!.collation:"binary"),jump:0}:layer.windows[0]!.window.frame.end.kind==="unbounded"?{code:"WindowRangeTest",candidate:state.regNew+orderIndex,current:outputSave+orderIndex,mode:"end-unbounded",descending:term.descending,collation:(typeof state.peerKeyInfo!.terms[0]!.collation==="string"?state.peerKeyInfo!.terms[0]!.collation:"binary"),jump:0}:{code:"WindowRangeTest",candidate:state.regNew+orderIndex,current:outputSave+orderIndex,mode:"end-current",descending:term.descending,collation:(typeof state.peerKeyInfo!.terms[0]!.collation==="string"?state.peerKeyInfo!.terms[0]!.collation:"binary"),jump:0});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:state.regNew+i,p2:endSave+i});ops.push({code:"Integer",p1:1n,p2:endFlag},{code:"Goto",p2:0});const endStep=ops.length;(ops[endEligible] as {jump:number}).jump=endStep;for(const win of layer.windows){const args=Array.from({length:win.window.argumentCount},(_,i)=>state.regNew+win.argumentColumn+i);ops.push({code:"AggStep",name:win.window.functionName,args,p2:win.regAccum,collation:args.length?collation(expressionFromReduction(layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary"});}ops.push({code:"Goto",p2:endLoop});const startLoop=ops.length;(ops[endEligible+state.inputRegisters.length+2] as {p2:number}).p2=startLoop;(ops[endFirst] as {emptyJump:number}).emptyJump=startLoop;
      const startUse=ops.length;ops.push({code:"IfNot",p1:startFlag,p2:0});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:startSave+i,p2:state.regNew+i});ops.push({code:"Integer",p1:0n,p2:startFlag},{code:"Goto",p2:0});const startAdvance=ops.length;(ops[startUse] as {p2:number}).p2=startAdvance;const startFirst=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[0],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0});const startHave=ops.length;(ops[startAdvance-1] as {p2:number}).p2=startHave;const startEligible=ops.length;ops.push(layer.windows[0]!.window.frame.start.kind==="unbounded"?{code:"WindowRangeTest",candidate:state.regNew+orderIndex,current:outputSave+orderIndex,mode:"start-unbounded",descending:term.descending,collation:(typeof state.peerKeyInfo!.terms[0]!.collation==="string"?state.peerKeyInfo!.terms[0]!.collation:"binary"),jump:0}:layer.windows[0]!.window.frame.start.kind==="current"?{code:"WindowRangeTest",candidate:state.regNew+orderIndex,current:outputSave+orderIndex,mode:"start-current",descending:term.descending,collation:(typeof state.peerKeyInfo!.terms[0]!.collation==="string"?state.peerKeyInfo!.terms[0]!.collation:"binary"),jump:0}:{code:"WindowRangeTest",candidate:state.regNew+orderIndex,current:outputSave+orderIndex,offset:state.boundRegisters.start!,mode:layer.windows[0]!.window.frame.start.kind==="following"?"start-following":"start-preceding",descending:term.descending,collation:(typeof state.peerKeyInfo!.terms[0]!.collation==="string"?state.peerKeyInfo!.terms[0]!.collation:"binary"),jump:0});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:state.regNew+i,p2:startSave+i});ops.push({code:"Integer",p1:1n,p2:startFlag},{code:"Goto",p2:0});const inverse=ops.length;(ops[startEligible] as {jump:number}).jump=inverse;for(const win of layer.windows){const args=Array.from({length:win.window.argumentCount},(_,i)=>state.regNew+win.argumentColumn+i);ops.push({code:"AggInverse",name:win.window.functionName,args,p2:win.regAccum,collation:args.length?collation(expressionFromReduction(layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary"});}ops.push({code:"Goto",p2:startLoop});const snapshot=ops.length;(ops[startEligible+state.inputRegisters.length+2] as {p2:number}).p2=snapshot;(ops[startFirst] as {emptyJump:number}).emptyJump=snapshot;for(const win of layer.windows)ops.push({code:"AggValue",name:win.window.functionName,p1:win.regAccum,p2:win.regResult});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:outputSave+i,p2:state.regNew+i});ops.push({code:"Integer",p1:1n,p2:state.regOutputReady},{code:"Yield",p1:producerCoroutine,p2:0},{code:"Goto",p2:output});const done=ops.length;(ops[outputAdvance] as {emptyJump:number}).emptyJump=done;
    };
    const emitOrderedAdjacentGroupsDrain=():void=>{
      const state=followingState!,peerCount=state.endPeerRegisters.length,peerStart=layer.windows[0]!.argumentColumn-state.partitionRegisters.length-peerCount;
      const endCount=++registers,startDelay=++registers,endRows=++registers,endLookaheadFlag=++registers,startLookaheadFlag=++registers,outputLookaheadFlag=++registers,endReturn=++registers,startReturn=++registers;
      const endLookahead=registers+1;registers+=state.inputRegisters.length;const startLookahead=registers+1;registers+=state.inputRegisters.length;const outputLookahead=registers+1;registers+=state.inputRegisters.length;const excludeGroup=layer.windows[0]!.window.frame.exclusion==="group",outputGroup=excludeGroup?++registers:0,candidateGroup=excludeGroup?++registers:0,candidateInitialized=excludeGroup?++registers:0,distance=excludeGroup?++registers:0,candidatePeer=registers+1;registers+=excludeGroup?peerCount:0;const temporary=excludeGroup?layer.windows.map(()=>++registers):[];
      if(layer.windows[0]!.window.frame.end.kind==="current")ops.push({code:"Integer",p1:1n,p2:endCount});else ops.push({code:"Copy",p1:state.boundRegisters.end!,p2:endCount},{code:"Binary",op:"+",p1:endCount,p2:state.regOne,p3:endCount,collation:"binary"});ops.push({code:"Copy",p1:state.boundRegisters.start!,p2:startDelay},{code:"Integer",p1:0n,p2:endLookaheadFlag},{code:"Integer",p1:0n,p2:startLookaheadFlag},{code:"Integer",p1:0n,p2:outputLookaheadFlag});if(excludeGroup)ops.push({code:"Integer",p1:0n,p2:outputGroup});
      const endCalls:number[]=[];const callEnd=():void=>{endCalls.push(ops.length);ops.push({code:"Gosub",p1:endReturn,p2:0});};
      const initialEnd=ops.length;ops.push({code:"IfPos",p1:endCount,p2:0,p3:1},{code:"Goto",p2:0});const initialBody=ops.length;callEnd();ops.push({code:"Goto",p2:initialEnd});const output=ops.length;(ops[initialEnd] as {p2:number}).p2=initialBody;(ops[initialEnd+1] as {p2:number}).p2=output;
      // Snapshot once for the complete current peer group. regResult remains
      // stable across all of the group's output Yield operations.
      if(!excludeGroup){for(const win of layer.windows)ops.push({code:"AggValue",name:win.window.functionName,p1:win.regAccum,p2:win.regResult});}else{
        ops.push({code:"AggReset",registers:temporary},{code:"Integer",p1:0n,p2:candidateGroup},{code:"Integer",p1:0n,p2:candidateInitialized});const rewind=ops.length;ops.push({code:"EphemeralRewind",p1:state.applicationCursor!,p2:0});const scan=ops.length;ops.push({code:"EphemeralData",p1:state.applicationCursor!,p2:state.regNew,count:state.inputRegisters.length});const firstCandidate=ops.length;ops.push({code:"IfNot",p1:candidateInitialized,p2:0});const sameCandidate=ops.length;ops.push({code:"CompareGroup",left:state.regNew+peerStart,right:candidatePeer,count:peerCount,keyInfo:state.peerKeyInfo!,jump:0},{code:"Binary",op:"+",p1:candidateGroup,p2:state.regOne,p3:candidateGroup,collation:"binary"});for(let i=0;i<peerCount;i++)ops.push({code:"Copy",p1:state.regNew+peerStart+i,p2:candidatePeer+i});const eligible=ops.length;(ops[sameCandidate] as {jump:number}).jump=eligible;const initialize=ops.length;(ops[firstCandidate] as {p2:number}).p2=initialize;for(let i=0;i<peerCount;i++)ops.push({code:"Copy",p1:state.regNew+peerStart+i,p2:candidatePeer+i});ops.push({code:"Integer",p1:1n,p2:candidateInitialized});const eligibleAfterInit=ops.length;ops.push({code:"IfRegisterGt",left:candidateGroup,right:outputGroup,jump:0},{code:"Binary",op:"-",p1:outputGroup,p2:candidateGroup,p3:distance,collation:"binary"});const tooFar=ops.length;ops.push({code:"IfRegisterGt",left:distance,right:state.boundRegisters.start!,jump:0},{code:"Eq",p1:candidateGroup,p2:outputGroup,p3:distance,affinity:"numeric",collation:"binary"});const notCurrent=ops.length;ops.push({code:"IfNot",p1:distance,p2:0},{code:"Goto",p2:0});const step=ops.length;(ops[notCurrent] as {p2:number}).p2=step;for(let i=0;i<layer.windows.length;i++){const win=layer.windows[i]!,args=Array.from({length:win.window.argumentCount},(_,j)=>state.regNew+win.argumentColumn+j);let filter:number|null=null;if(win.filterColumn!==null){filter=ops.length;ops.push({code:"IfNot",p1:state.regNew+win.filterColumn,p2:0});}const at=ops.length;ops.push({code:"AggStep",name:win.window.functionName,args,p2:temporary[i]!,collation:args.length?collation(expressionFromReduction(layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary"});if(filter!==null)(ops[filter] as {p2:number}).p2=at+1;}const nextCandidate=ops.length;(ops[eligibleAfterInit] as {jump:number}).jump=nextCandidate;(ops[tooFar] as {jump:number}).jump=nextCandidate;(ops[notCurrent+1] as {p2:number}).p2=nextCandidate;ops.push({code:"EphemeralNext",p1:state.applicationCursor!,p2:scan});const scanDone=ops.length;(ops[rewind] as {p2:number}).p2=scanDone;for(let i=0;i<layer.windows.length;i++)ops.push({code:"AggValue",name:layer.windows[i]!.window.functionName,p1:temporary[i]!,p2:layer.windows[i]!.regResult});
      }
      const outputUseCursor=ops.length;ops.push({code:"IfNot",p1:outputLookaheadFlag,p2:0});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:outputLookahead+i,p2:state.regNew+i});ops.push({code:"Integer",p1:0n,p2:outputLookaheadFlag},{code:"Goto",p2:0});const outputAdvance=ops.length;(ops[outputUseCursor] as {p2:number}).p2=outputAdvance;const outputFirst=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[2],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0});const outputHave=ops.length;(ops[outputAdvance-1] as {p2:number}).p2=outputHave;for(let i=0;i<peerCount;i++)ops.push({code:"Copy",p1:state.regNew+peerStart+i,p2:state.currentPeerRegisters[i]!});
      const emitRow=ops.length;ops.push({code:"Integer",p1:1n,p2:state.regOutputReady},{code:"Yield",p1:producerCoroutine,p2:0});const outputNext=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[2],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0},{code:"CompareGroup",left:state.regNew+peerStart,right:state.currentPeerRegisters[0]!,count:peerCount,keyInfo:state.peerKeyInfo!,jump:emitRow});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:state.regNew+i,p2:outputLookahead+i});ops.push({code:"Integer",p1:1n,p2:outputLookaheadFlag});
      const slide=ops.length;(ops[outputNext] as {emptyJump:number}).emptyJump=slide;if(excludeGroup)ops.push({code:"Binary",op:"+",p1:outputGroup,p2:state.regOne,p3:outputGroup,collation:"binary"});
      const delay=ops.length;ops.push({code:"IfPos",p1:startDelay,p2:0,p3:1},{code:"Gosub",p1:startReturn,p2:0});const afterInverse=ops.length;(ops[delay] as {p2:number}).p2=afterInverse;callEnd();ops.push({code:"Goto",p2:output});const done=ops.length;(ops[outputFirst] as {emptyJump:number}).emptyJump=done;const skipSubroutines=ops.length;ops.push({code:"Goto",p2:0});

      // End-cursor peer scanner. It may read one row beyond a peer boundary,
      // so the complete row is retained as resumable register state.
      const endScan=ops.length;for(const call of endCalls)(ops[call] as {p2:number}).p2=endScan;ops.push({code:"Integer",p1:0n,p2:endRows});const endUse=ops.length;ops.push({code:"IfNot",p1:endLookaheadFlag,p2:0});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:endLookahead+i,p2:state.regNew+i});ops.push({code:"Integer",p1:0n,p2:endLookaheadFlag},{code:"Goto",p2:0});const endAdvance=ops.length;(ops[endUse] as {p2:number}).p2=endAdvance;const endFirst=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[1],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0});const endHave=ops.length;(ops[endAdvance-1] as {p2:number}).p2=endHave;for(let i=0;i<peerCount;i++)ops.push({code:"Copy",p1:state.regNew+peerStart+i,p2:state.endPeerRegisters[i]!});const endStep=ops.length;for(const win of layer.windows){const args=Array.from({length:win.window.argumentCount},(_,i)=>state.regNew+win.argumentColumn+i);ops.push({code:"AggStep",name:win.window.functionName,args,p2:win.regAccum,collation:args.length?collation(expressionFromReduction(layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary"});}ops.push({code:"Binary",op:"+",p1:endRows,p2:state.regOne,p3:endRows,collation:"binary"});const endNext=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[1],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0},{code:"CompareGroup",left:state.regNew+peerStart,right:state.endPeerRegisters[0]!,count:peerCount,keyInfo:state.peerKeyInfo!,jump:endStep});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:state.regNew+i,p2:endLookahead+i});ops.push({code:"Integer",p1:1n,p2:endLookaheadFlag});const endRet=ops.length;ops.push({code:"Return",p1:endReturn});(ops[endFirst] as {emptyJump:number}).emptyJump=endRet;(ops[endNext] as {emptyJump:number}).emptyJump=endRet;

      // Start cursor removes exactly one complete peer group once the starting
      // distance has elapsed. This is windowCodeOp's GROUPS inverse phase.
      const startScan=ops.length;(ops[delay+1] as {p2:number}).p2=startScan;const startUse=ops.length;ops.push({code:"IfNot",p1:startLookaheadFlag,p2:0});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:startLookahead+i,p2:state.regNew+i});ops.push({code:"Integer",p1:0n,p2:startLookaheadFlag},{code:"Goto",p2:0});const startAdvance=ops.length;(ops[startUse] as {p2:number}).p2=startAdvance;const startFirst=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[0],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0});const startHave=ops.length;(ops[startAdvance-1] as {p2:number}).p2=startHave;for(let i=0;i<peerCount;i++)ops.push({code:"Copy",p1:state.regNew+peerStart+i,p2:state.startPeerRegisters[i]!});const inverse=ops.length;for(const win of layer.windows){const args=Array.from({length:win.window.argumentCount},(_,i)=>state.regNew+win.argumentColumn+i);ops.push({code:"AggInverse",name:win.window.functionName,args,p2:win.regAccum,collation:args.length?collation(expressionFromReduction(layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary"});}const startNext=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[0],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0},{code:"CompareGroup",left:state.regNew+peerStart,right:state.startPeerRegisters[0]!,count:peerCount,keyInfo:state.peerKeyInfo!,jump:inverse});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:state.regNew+i,p2:startLookahead+i});ops.push({code:"Integer",p1:1n,p2:startLookaheadFlag});const startRet=ops.length;ops.push({code:"Return",p1:startReturn});(ops[startFirst] as {emptyJump:number}).emptyJump=startRet;(ops[startNext] as {emptyJump:number}).emptyJump=startRet;(ops[skipSubroutines] as {p2:number}).p2=ops.length;
    };
    const emitDirectOffsetDrain=():void=>{
      const state=followingState!;
      // window.c:windowCacheFrame/windowReturnOneRow: cache the complete
      // partition, then derive the target rowid from the current buffered row.
      const output=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[2],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0});
      for(const win of layer.windows){
        if(win.window.functionName!=="lead"&&win.window.functionName!=="lag"){
          const args=Array.from({length:win.window.argumentCount},(_,i)=>state.regNew+win.argumentColumn+i);
          ops.push({code:"AggStep",name:win.window.functionName,args,p2:win.regAccum,collation:args.length?collation(expressionFromReduction(layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary"},{code:"AggValue",name:win.window.functionName,p1:win.regAccum,p2:win.regResult});
          continue;
        }
        const target=++registers,offset=++registers,targetPayload=registers+1;registers+=state.inputRegisters.length;
        if(win.window.argumentCount<3)ops.push({code:"Null",p2:win.regResult});else ops.push({code:"Copy",p1:state.regNew+win.argumentColumn+2,p2:win.regResult});
        ops.push({code:"EphemeralRowid",p1:layer.duplicateCursors[2],p2:target});
        if(win.window.argumentCount<2)ops.push({code:"Integer",p1:1n,p2:offset});else ops.push({code:"Copy",p1:state.regNew+win.argumentColumn+1,p2:offset});
        ops.push({code:"Binary",op:win.window.functionName==="lead"?"+":"-",p1:target,p2:offset,p3:target,collation:"binary"});
        const seek=ops.length;ops.push({code:"EphemeralSeekRowid",p1:state.applicationCursor!,rowid:target,jump:0},{code:"EphemeralData",p1:state.applicationCursor!,p2:targetPayload,count:state.inputRegisters.length},{code:"Copy",p1:targetPayload+win.argumentColumn,p2:win.regResult});
        (ops[seek] as {jump:number}).jump=ops.length;
      }
      ops.push({code:"Integer",p1:1n,p2:state.regOutputReady},{code:"Yield",p1:producerCoroutine,p2:0},{code:"Goto",p2:output});const complete=ops.length;(ops[output] as {emptyJump:number}).emptyJump=complete;
    };
    const emitWholePartitionDrain=():void=>{
      const fill=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[1],p2:followingState!.regNew,count:followingState!.inputRegisters.length,emptyJump:0});for(const win of layer.windows){const args=Array.from({length:win.window.argumentCount},(_,i)=>followingState!.regNew+win.argumentColumn+i);ops.push({code:"AggStep",name:win.window.functionName,args,p2:win.regAccum,collation:args.length?collation(expressionFromReduction(layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary"});}ops.push({code:"Goto",p2:fill});const output=ops.length;(ops[fill] as {emptyJump:number}).emptyJump=output;for(const win of layer.windows)ops.push({code:"AggValue",name:win.window.functionName,p1:win.regAccum,p2:win.regResult});
      // The accumulator is complete and unchanged while this partition drains.
      // Match windowReturnOneRow's peer snapshot: value callbacks run once and
      // regResult is reused for every row. This matters for rankValueFunc, which
      // clears its pending peer value after publishing it.
      const loop=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[2],p2:followingState!.regNew,count:followingState!.inputRegisters.length,emptyJump:0},{code:"Integer",p1:1n,p2:followingState!.regOutputReady},{code:"Yield",p1:producerCoroutine,p2:0},{code:"Goto",p2:loop});const complete=ops.length;(ops[loop] as {emptyJump:number}).emptyJump=complete;
    };
    const emitWholePartitionExcludeGroupDrain=():void=>{
      const state=followingState!,peerCount=state.endPeerRegisters.length,peerStart=layer.windows[0]!.argumentColumn-peerCount;
      const outputSave=registers+1;registers+=state.inputRegisters.length;const temporary=layer.windows.map(()=>++registers);
      // windowCodeOp's EXCLUDE path scans the cached frame with the application
      // cursor for each output row. EXCLUDE GROUP omits all ORDER BY peers.
      const output=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[2],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:state.regNew+i,p2:outputSave+i});ops.push({code:"AggReset",registers:temporary});
      const rewind=ops.length;ops.push({code:"EphemeralRewind",p1:state.applicationCursor!,p2:0});const scan=ops.length;ops.push({code:"EphemeralData",p1:state.applicationCursor!,p2:state.regNew,count:state.inputRegisters.length});const compare=ops.length;ops.push({code:"CompareGroup",left:state.regNew+peerStart,right:outputSave+peerStart,count:peerCount,keyInfo:state.peerKeyInfo!,jump:0},{code:"Goto",p2:0});const step=ops.length;for(let i=0;i<layer.windows.length;i++){const win=layer.windows[i]!,args=Array.from({length:win.window.argumentCount},(_,j)=>state.regNew+win.argumentColumn+j);let filter:number|null=null;if(win.filterColumn!==null){filter=ops.length;ops.push({code:"IfNot",p1:state.regNew+win.filterColumn,p2:0});}const at=ops.length;ops.push({code:"AggStep",name:win.window.functionName,args,p2:temporary[i]!,collation:args.length?collation(expressionFromReduction(layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary"});if(filter!==null)(ops[filter] as {p2:number}).p2=at+1;}const next=ops.length;(ops[compare] as {jump:number}).jump=next;(ops[compare+1] as {p2:number}).p2=step;ops.push({code:"EphemeralNext",p1:state.applicationCursor!,p2:scan});const snapshot=ops.length;(ops[rewind] as {p2:number}).p2=snapshot;for(let i=0;i<layer.windows.length;i++)ops.push({code:"AggValue",name:layer.windows[i]!.window.functionName,p1:temporary[i]!,p2:layer.windows[i]!.regResult});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:outputSave+i,p2:state.regNew+i});ops.push({code:"Integer",p1:1n,p2:state.regOutputReady},{code:"Yield",p1:producerCoroutine,p2:0},{code:"Goto",p2:output});const done=ops.length;(ops[output] as {emptyJump:number}).emptyJump=done;
    };
    const emitNoOrderFollowingGroupsDrain=():void=>{
      // With no ORDER BY all rows are one peer group. windowCodeOp advances
      // both the end and start boundaries across that group before WINDOW_RETURN_ROW.
      const fill=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[1],p2:followingState!.regNew,count:followingState!.inputRegisters.length,emptyJump:0});for(const win of layer.windows){const args=Array.from({length:win.window.argumentCount},(_,i)=>followingState!.regNew+win.argumentColumn+i);ops.push({code:"AggStep",name:win.window.functionName,args,p2:win.regAccum,collation:args.length?collation(expressionFromReduction(layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary"},{code:"AggInverse",name:win.window.functionName,args,p2:win.regAccum,collation:args.length?collation(expressionFromReduction(layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary"});}ops.push({code:"Goto",p2:fill});const output=ops.length;(ops[fill] as {emptyJump:number}).emptyJump=output;
      const outputLoop=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[2],p2:followingState!.regNew,count:followingState!.inputRegisters.length,emptyJump:0});for(const win of layer.windows)ops.push({code:"AggValue",name:win.window.functionName,p1:win.regAccum,p2:win.regResult});ops.push({code:"Integer",p1:1n,p2:followingState!.regOutputReady},{code:"Yield",p1:producerCoroutine,p2:0},{code:"Goto",p2:outputLoop});const complete=ops.length;(ops[outputLoop] as {emptyJump:number}).emptyJump=complete;
    };
    const emitFollowingUnboundedDrain=():void=>{
      const fill=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[1],p2:followingState!.regNew,count:followingState!.inputRegisters.length,emptyJump:0});for(const win of layer.windows){const args=Array.from({length:win.window.argumentCount},(_,i)=>followingState!.regNew+win.argumentColumn+i);ops.push({code:"AggStep",name:win.window.functionName,args,p2:win.regAccum,collation:args.length?collation(expressionFromReduction(layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary"});}ops.push({code:"Goto",p2:fill});const filled=ops.length;(ops[fill] as {emptyJump:number}).emptyJump=filled;
      ops.push({code:"Copy",p1:followingState!.boundRegisters.start!,p2:rangeStartCount!});const initial=ops.length;ops.push({code:"IfPos",p1:rangeStartCount!,p2:0,p3:1},{code:"Goto",p2:0});const inverse=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[0],p2:followingState!.regNew,count:followingState!.inputRegisters.length,emptyJump:0});for(const win of layer.windows){const args=Array.from({length:win.window.argumentCount},(_,i)=>followingState!.regNew+win.argumentColumn+i);ops.push({code:"AggInverse",name:win.window.functionName,args,p2:win.regAccum,collation:args.length?collation(expressionFromReduction(layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary"});}ops.push({code:"Goto",p2:initial});const output=ops.length;(ops[initial] as {p2:number}).p2=inverse;(ops[initial+1] as {p2:number}).p2=output;(ops[inverse] as {emptyJump:number}).emptyJump=output;
      const loop=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[2],p2:followingState!.regNew,count:followingState!.inputRegisters.length,emptyJump:0});for(const win of layer.windows)ops.push({code:"AggValue",name:win.window.functionName,p1:win.regAccum,p2:win.regResult});ops.push({code:"Integer",p1:1n,p2:followingState!.regOutputReady},{code:"Yield",p1:producerCoroutine,p2:0});const slide=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[0],p2:followingState!.regNew,count:followingState!.inputRegisters.length,emptyJump:0});for(const win of layer.windows){const args=Array.from({length:win.window.argumentCount},(_,i)=>followingState!.regNew+win.argumentColumn+i);ops.push({code:"AggInverse",name:win.window.functionName,args,p2:win.regAccum,collation:args.length?collation(expressionFromReduction(layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary"});}const afterSlide=ops.length;(ops[slide] as {emptyJump:number}).emptyJump=afterSlide;ops.push({code:"Goto",p2:loop});const complete=ops.length;(ops[loop] as {emptyJump:number}).emptyJump=complete;
    };
    const emitCurrentUnboundedDrain=():void=>{
      const state=followingState!;
      const fill=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[1],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0});for(const win of layer.windows){const args=Array.from({length:win.window.argumentCount},(_,i)=>state.regNew+win.argumentColumn+i);ops.push({code:"AggStep",name:win.window.functionName,args,p2:win.regAccum,collation:args.length?collation(expressionFromReduction(layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary"});}ops.push({code:"Goto",p2:fill});const filled=ops.length;(ops[fill] as {emptyJump:number}).emptyJump=filled;
      const output=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[2],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0});for(const win of layer.windows)ops.push({code:"AggValue",name:win.window.functionName,p1:win.regAccum,p2:win.regResult});ops.push({code:"Integer",p1:1n,p2:state.regOutputReady},{code:"Yield",p1:producerCoroutine,p2:0});
      const inverse=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[0],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0});for(const win of layer.windows){const args=Array.from({length:win.window.argumentCount},(_,i)=>state.regNew+win.argumentColumn+i);ops.push({code:"AggInverse",name:win.window.functionName,args,p2:win.regAccum,collation:args.length?collation(expressionFromReduction(layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary"});}ops.push({code:"Goto",p2:output});const complete=ops.length;(ops[output] as {emptyJump:number}).emptyJump=complete;(ops[inverse] as {emptyJump:number}).emptyJump=complete;
    };
    const emitPrecedingUnboundedDrain=():void=>{
      const state=followingState!;
      const fill=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[1],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0});for(const win of layer.windows){const args=Array.from({length:win.window.argumentCount},(_,i)=>state.regNew+win.argumentColumn+i);ops.push({code:"AggStep",name:win.window.functionName,args,p2:win.regAccum,collation:args.length?collation(expressionFromReduction(layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary"});}ops.push({code:"Goto",p2:fill});const filled=ops.length;(ops[fill] as {emptyJump:number}).emptyJump=filled;
      ops.push({code:"Copy",p1:state.boundRegisters.start!,p2:rangeStartCount!});
      const output=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[2],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0});for(const win of layer.windows)ops.push({code:"AggValue",name:win.window.functionName,p1:win.regAccum,p2:win.regResult});ops.push({code:"Integer",p1:1n,p2:state.regOutputReady},{code:"Yield",p1:producerCoroutine,p2:0});
      const delay=ops.length;ops.push({code:"IfPos",p1:rangeStartCount!,p2:output,p3:1});const inverse=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[0],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0});for(const win of layer.windows){const args=Array.from({length:win.window.argumentCount},(_,i)=>state.regNew+win.argumentColumn+i);ops.push({code:"AggInverse",name:win.window.functionName,args,p2:win.regAccum,collation:args.length?collation(expressionFromReduction(layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary"});}ops.push({code:"Goto",p2:output});const complete=ops.length;(ops[output] as {emptyJump:number}).emptyJump=complete;(ops[inverse] as {emptyJump:number}).emptyJump=complete;
    };
    const emitFollowingRangeDrain=():void=>{
      const reversed=ops.length;ops.push({code:"IfRegisterGt",left:rangeState!.boundRegisters.start!,right:rangeState!.boundRegisters.end!,jump:0});
      ops.push({code:"Copy",p1:rangeState!.boundRegisters.end!,p2:rangeEndCount!},{code:"Binary",op:"+",p1:rangeEndCount!,p2:rangeState!.regOne,p3:rangeEndCount!,collation:"binary"});
      const endLoop=ops.length,endBody=endLoop+2;ops.push({code:"IfPos",p1:rangeEndCount!,p2:endBody,p3:1},{code:"Goto",p2:0});
      const endAdvance=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[1],p2:rangeState!.regNew,count:rangeState!.inputRegisters.length,emptyJump:0});
      for(const win of layer.windows){const args=Array.from({length:win.window.argumentCount},(_,i)=>rangeState!.regNew+win.argumentColumn+i);ops.push({code:"AggStep",name:win.window.functionName,args,p2:win.regAccum,collation:args.length?collation(expressionFromReduction(layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary"});}
      ops.push({code:"Goto",p2:endLoop});const endDone=ops.length;(ops[endLoop+1] as {p2:number}).p2=endDone;(ops[endAdvance] as {emptyJump:number}).emptyJump=endDone;
      ops.push({code:"Copy",p1:rangeState!.boundRegisters.start!,p2:rangeStartCount!});
      const startLoop=ops.length,startBody=startLoop+2;ops.push({code:"IfPos",p1:rangeStartCount!,p2:startBody,p3:1},{code:"Goto",p2:0});
      const startAdvance=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[0],p2:rangeState!.regNew,count:rangeState!.inputRegisters.length,emptyJump:0});
      for(const win of layer.windows){const args=Array.from({length:win.window.argumentCount},(_,i)=>rangeState!.regNew+win.argumentColumn+i);ops.push({code:"AggInverse",name:win.window.functionName,args,p2:win.regAccum,collation:args.length?collation(expressionFromReduction(layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary"});}
      ops.push({code:"Goto",p2:startLoop});const startDone=ops.length;(ops[startLoop+1] as {p2:number}).p2=startDone;(ops[startAdvance] as {emptyJump:number}).emptyJump=startDone;
      const output=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[2],p2:rangeState!.regNew,count:rangeState!.inputRegisters.length,emptyJump:0});
      const snapshot=ops.length;for(const win of layer.windows)ops.push({code:"AggValue",name:win.window.functionName,p1:win.regAccum,p2:win.regResult});
      ops.push({code:"Integer",p1:1n,p2:rangeState!.regOutputReady},{code:"Yield",p1:producerCoroutine,p2:0});
      const slideEnd=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[1],p2:rangeState!.regNew,count:rangeState!.inputRegisters.length,emptyJump:0});
      for(const win of layer.windows){const args=Array.from({length:win.window.argumentCount},(_,i)=>rangeState!.regNew+win.argumentColumn+i);ops.push({code:"AggStep",name:win.window.functionName,args,p2:win.regAccum,collation:args.length?collation(expressionFromReduction(layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary"});}
      const afterEnd=ops.length;(ops[slideEnd] as {emptyJump:number}).emptyJump=afterEnd;
      const slideStart=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[0],p2:rangeState!.regNew,count:rangeState!.inputRegisters.length,emptyJump:0});
      for(const win of layer.windows){const args=Array.from({length:win.window.argumentCount},(_,i)=>rangeState!.regNew+win.argumentColumn+i);ops.push({code:"AggInverse",name:win.window.functionName,args,p2:win.regAccum,collation:args.length?collation(expressionFromReduction(layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary"});}
      const afterStart=ops.length;(ops[slideStart] as {emptyJump:number}).emptyJump=afterStart;ops.push({code:"Goto",p2:output});
      const empty=ops.length;(ops[reversed] as {jump:number}).jump=empty;
      const emptyLoop=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[2],p2:rangeState!.regNew,count:rangeState!.inputRegisters.length,emptyJump:0});
      for(const win of layer.windows)ops.push({code:"AggValue",name:win.window.functionName,p1:win.regAccum,p2:win.regResult});
      ops.push({code:"Integer",p1:1n,p2:rangeState!.regOutputReady},{code:"Yield",p1:producerCoroutine,p2:0},{code:"Goto",p2:emptyLoop});
      const complete=ops.length;(ops[output] as {emptyJump:number}).emptyJump=complete;(ops[emptyLoop] as {emptyJump:number}).emptyJump=complete;
        };
    const sort=ops.length;ops.push({code:"SorterSort",p1:sorterCursor,emptyJump:0});const loopBody=ops.length;ops.push({code:"SorterData",p1:sorterCursor,p2:payload,count:layer.bufferExpressions.length});
    if((wholePartition||directOffset)&&followingState&&followingState.partitionRegisters.length){
      const partitionStart=payload+layer.windows[0]!.argumentColumn-followingState.partitionRegisters.length-layer.windows[0]!.window.orderBy.length;
      const first=ops.length;ops.push({code:"IfNot",p1:followingState.regPartInitialized!,p2:0});
      const equal=ops.length;ops.push({code:"CompareGroup",left:partitionStart,right:followingState.partitionRegisters[0]!,count:followingState.partitionRegisters.length,keyInfo:followingState.partitionKeyInfo!,jump:0});
      if(directOffset)emitDirectOffsetDrain();else emitWholePartitionDrain();
      const reset=ops.length;ops.push({code:"AggReset",registers:layer.windows.map(win=>win.regAccum)},{code:"ClearEphemeral",p1:layer.duplicateCursors[0]},{code:"EphemeralResetPosition",p1:layer.duplicateCursors[0]},{code:"EphemeralResetPosition",p1:layer.duplicateCursors[1]},{code:"EphemeralResetPosition",p1:layer.duplicateCursors[2]});
      for(let i=0;i<followingState.partitionRegisters.length;i++)ops.push({code:"Copy",p1:partitionStart+i,p2:followingState.partitionRegisters[i]!});
      ops.push({code:"Integer",p1:1n,p2:followingState.regPartInitialized!},{code:"Integer",p1:0n,p2:followingState.regOutputReady});
      (ops[first] as {p2:number}).p2=reset;(ops[equal] as {jump:number}).jump=ops.length;
    }
    if(orderedRangePrecedingCurrent&&followingState&&followingState.partitionRegisters.length){
      const partitionStart=payload+layer.windows[0]!.argumentColumn-followingState.partitionRegisters.length-followingState.endPeerRegisters.length;
      const first=ops.length;ops.push({code:"IfNot",p1:followingState.regPartInitialized!,p2:0});
      const equal=ops.length;ops.push({code:"CompareGroup",left:partitionStart,right:followingState.partitionRegisters[0]!,count:followingState.partitionRegisters.length,keyInfo:followingState.partitionKeyInfo!,jump:0});
      emitOrderedRangePrecedingCurrentDrain();
      const reset=ops.length;ops.push({code:"AggReset",registers:layer.windows.map(win=>win.regAccum)},{code:"ClearEphemeral",p1:layer.duplicateCursors[0]},{code:"EphemeralResetPosition",p1:layer.duplicateCursors[0]},{code:"EphemeralResetPosition",p1:layer.duplicateCursors[1]},{code:"EphemeralResetPosition",p1:layer.duplicateCursors[2]});
      for(let i=0;i<followingState.partitionRegisters.length;i++)ops.push({code:"Copy",p1:partitionStart+i,p2:followingState.partitionRegisters[i]!});
      ops.push({code:"Integer",p1:1n,p2:followingState.regPartInitialized!},{code:"Integer",p1:0n,p2:followingState.regOutputReady});
      (ops[first] as {p2:number}).p2=reset;(ops[equal] as {jump:number}).jump=ops.length;
    }
    if((orderedSuffixGroups||orderedFollowingGroups)&&followingState&&followingState.partitionRegisters.length){
      const partitionStart=payload+layer.windows[0]!.argumentColumn-followingState.partitionRegisters.length-layer.windows[0]!.window.orderBy.length;
      const first=ops.length;ops.push({code:"IfNot",p1:followingState.regPartInitialized!,p2:0});
      const equal=ops.length;ops.push({code:"CompareGroup",left:partitionStart,right:followingState.partitionRegisters[0]!,count:followingState.partitionRegisters.length,keyInfo:followingState.partitionKeyInfo!,jump:0});
      if(orderedFollowingGroups)emitOrderedFollowingGroupsDrain();else emitOrderedSuffixGroupsDrain();
      const reset=ops.length;ops.push({code:"AggReset",registers:layer.windows.map(win=>win.regAccum)},{code:"ClearEphemeral",p1:layer.duplicateCursors[0]},{code:"EphemeralResetPosition",p1:layer.duplicateCursors[0]},{code:"EphemeralResetPosition",p1:layer.duplicateCursors[1]},{code:"EphemeralResetPosition",p1:layer.duplicateCursors[2]});
      for(let i=0;i<followingState.partitionRegisters.length;i++)ops.push({code:"Copy",p1:partitionStart+i,p2:followingState.partitionRegisters[i]!});
      ops.push({code:"Integer",p1:1n,p2:followingState.regPartInitialized!},{code:"Integer",p1:0n,p2:followingState.regOutputReady});
      (ops[first] as {p2:number}).p2=reset;(ops[equal] as {jump:number}).jump=ops.length;
    }
    if((orderedCumulativePeerGroups||orderedCumulativePriorGroups)&&followingState&&followingState.partitionRegisters.length){
      const partitionStart=payload+layer.windows[0]!.argumentColumn-followingState.partitionRegisters.length-layer.windows[0]!.window.orderBy.length;
      const first=ops.length;ops.push({code:"IfNot",p1:followingState.regPartInitialized!,p2:0});
      const equal=ops.length;ops.push({code:"CompareGroup",left:partitionStart,right:followingState.partitionRegisters[0]!,count:followingState.partitionRegisters.length,keyInfo:followingState.partitionKeyInfo!,jump:0});
      emitOrderedCumulativePeerGroupsDrain();
      const reset=ops.length;ops.push({code:"AggReset",registers:layer.windows.map(win=>win.regAccum)},{code:"ClearEphemeral",p1:layer.duplicateCursors[0]},{code:"EphemeralResetPosition",p1:layer.duplicateCursors[0]},{code:"EphemeralResetPosition",p1:layer.duplicateCursors[1]},{code:"EphemeralResetPosition",p1:layer.duplicateCursors[2]});
      for(let i=0;i<followingState.partitionRegisters.length;i++)ops.push({code:"Copy",p1:partitionStart+i,p2:followingState.partitionRegisters[i]!});
      ops.push({code:"Integer",p1:1n,p2:followingState.regPartInitialized!},{code:"Integer",p1:0n,p2:followingState.regOutputReady});
      (ops[first] as {p2:number}).p2=reset;(ops[equal] as {jump:number}).jump=ops.length;
    }
    if(rangeOffsetExcludeCurrent&&followingState&&followingState.partitionRegisters.length){
      const partitionStart=payload+layer.windows[0]!.argumentColumn-followingState.partitionRegisters.length-layer.windows[0]!.window.orderBy.length;
      const first=ops.length;ops.push({code:"IfNot",p1:followingState.regPartInitialized!,p2:0});
      const equal=ops.length;ops.push({code:"CompareGroup",left:partitionStart,right:followingState.partitionRegisters[0]!,count:followingState.partitionRegisters.length,keyInfo:followingState.partitionKeyInfo!,jump:0});
      emitRangeOffsetExcludeCurrentDrain();
      const reset=ops.length;ops.push({code:"AggReset",registers:layer.windows.map(win=>win.regAccum)},{code:"ClearEphemeral",p1:layer.duplicateCursors[0]},{code:"EphemeralResetPosition",p1:layer.duplicateCursors[0]},{code:"EphemeralResetPosition",p1:layer.duplicateCursors[1]},{code:"EphemeralResetPosition",p1:layer.duplicateCursors[2]});
      for(let i=0;i<followingState.partitionRegisters.length;i++)ops.push({code:"Copy",p1:partitionStart+i,p2:followingState.partitionRegisters[i]!});
      ops.push({code:"Integer",p1:1n,p2:followingState.regPartInitialized!},{code:"Integer",p1:0n,p2:followingState.regOutputReady});
      (ops[first] as {p2:number}).p2=reset;(ops[equal] as {jump:number}).jump=ops.length;
    }
    if(orderedAdjacentGroups&&followingState&&followingState.partitionRegisters.length){
      const partitionStart=payload+layer.windows[0]!.argumentColumn-followingState.partitionRegisters.length-layer.windows[0]!.window.orderBy.length;
      const first=ops.length;ops.push({code:"IfNot",p1:followingState.regPartInitialized!,p2:0});
      const equal=ops.length;ops.push({code:"CompareGroup",left:partitionStart,right:followingState.partitionRegisters[0]!,count:followingState.partitionRegisters.length,keyInfo:followingState.partitionKeyInfo!,jump:0});
      // The sorter payload for the first row of the next partition remains in
      // registers while the prior cache drains through Yield. Only after that
      // drain returns do we reset contexts/cursors and cache the pending row.
      emitOrderedAdjacentGroupsDrain();
      const reset=ops.length;ops.push({code:"AggReset",registers:layer.windows.map(win=>win.regAccum)},{code:"ClearEphemeral",p1:layer.duplicateCursors[0]},{code:"EphemeralResetPosition",p1:layer.duplicateCursors[0]},{code:"EphemeralResetPosition",p1:layer.duplicateCursors[1]},{code:"EphemeralResetPosition",p1:layer.duplicateCursors[2]});
      for(let i=0;i<followingState.partitionRegisters.length;i++)ops.push({code:"Copy",p1:partitionStart+i,p2:followingState.partitionRegisters[i]!});
      ops.push({code:"Integer",p1:1n,p2:followingState.regPartInitialized!},{code:"Integer",p1:0n,p2:followingState.regOutputReady});
      (ops[first] as {p2:number}).p2=reset;(ops[equal] as {jump:number}).jump=ops.length;
    }
    if((precedingFollowing||precedingRange)&&followingState&&followingState.partitionRegisters.length){
      const partitionStart=payload+layer.windows[0]!.argumentColumn-followingState.partitionRegisters.length-layer.windows[0]!.window.orderBy.length;
      const first=ops.length;ops.push({code:"IfNot",p1:followingState.regPartInitialized!,p2:0});
      const equal=ops.length;ops.push({code:"CompareGroup",left:partitionStart,right:followingState.partitionRegisters[0]!,count:followingState.partitionRegisters.length,keyInfo:followingState.partitionKeyInfo!,jump:0});
      // window.c drains the completed partition before caching the pending row
      // from the next partition. The sorter payload remains authoritative while
      // this coroutine suspends for each row of the drain.
      if(precedingFollowing)emitPrecedingFollowingDrain();else emitPrecedingRangeDrain();
      const reset=ops.length;ops.push({code:"AggReset",registers:layer.windows.map(win=>win.regAccum)},{code:"ClearEphemeral",p1:layer.duplicateCursors[0]},{code:"EphemeralResetPosition",p1:layer.duplicateCursors[0]},{code:"EphemeralResetPosition",p1:layer.duplicateCursors[1]},{code:"EphemeralResetPosition",p1:layer.duplicateCursors[2]});
      for(let i=0;i<followingState.partitionRegisters.length;i++)ops.push({code:"Copy",p1:partitionStart+i,p2:followingState.partitionRegisters[i]!});
      ops.push({code:"Integer",p1:1n,p2:followingState.regPartInitialized!},{code:"Integer",p1:0n,p2:followingState.regOutputReady});
      (ops[first] as {p2:number}).p2=reset;(ops[equal] as {jump:number}).jump=ops.length;
    }
    if(followingRange&&followingState&&followingState.partitionRegisters.length){
      const partitionStart=payload+layer.windows[0]!.argumentColumn-followingState.partitionRegisters.length-layer.windows[0]!.window.orderBy.length;
      const first=ops.length;ops.push({code:"IfNot",p1:followingState.regPartInitialized!,p2:0});
      const equal=ops.length;ops.push({code:"CompareGroup",left:partitionStart,right:followingState.partitionRegisters[0]!,count:followingState.partitionRegisters.length,keyInfo:followingState.partitionKeyInfo!,jump:0});
      emitFollowingRangeDrain();
      const reset=ops.length;ops.push({code:"AggReset",registers:layer.windows.map(win=>win.regAccum)},{code:"ClearEphemeral",p1:layer.duplicateCursors[0]},{code:"EphemeralResetPosition",p1:layer.duplicateCursors[0]},{code:"EphemeralResetPosition",p1:layer.duplicateCursors[1]},{code:"EphemeralResetPosition",p1:layer.duplicateCursors[2]});
      for(let i=0;i<followingState.partitionRegisters.length;i++)ops.push({code:"Copy",p1:partitionStart+i,p2:followingState.partitionRegisters[i]!});
      ops.push({code:"Integer",p1:1n,p2:followingState.regPartInitialized!},{code:"Integer",p1:0n,p2:followingState.regOutputReady});
      (ops[first] as {p2:number}).p2=reset;(ops[equal] as {jump:number}).jump=ops.length;
    }
    if(following&&followingState&&followingState.partitionRegisters.length){
      const partitionStart=payload+layer.windows[0]!.argumentColumn-followingState.partitionRegisters.length-layer.windows[0]!.window.orderBy.length;
      const first=ops.length;ops.push({code:"IfNot",p1:followingState.regPartInitialized!,p2:0});
      const equal=ops.length;ops.push({code:"CompareGroup",left:partitionStart,right:followingState.partitionRegisters[0]!,count:followingState.partitionRegisters.length,keyInfo:followingState.partitionKeyInfo!,jump:0});
      const flush=ops.length;
      for(const win of layer.windows)ops.push({code:"AggValue",name:win.window.functionName,p1:win.regAccum,p2:win.regResult});
      ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[0],p2:followingState.regNew,count:followingState.inputRegisters.length});
      for(const win of layer.windows){const args=Array.from({length:win.window.argumentCount},(_,i)=>followingState.regNew+win.argumentColumn+i);ops.push({code:"AggInverse",name:win.window.functionName,args,p2:win.regAccum,collation:args.length?collation(expressionFromReduction(layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary"});}
      ops.push({code:"Integer",p1:1n,p2:followingState.regOutputReady},{code:"Yield",p1:producerCoroutine,p2:0},{code:"IfEphemeralHasNext",p1:layer.duplicateCursors[0],jump:flush});
      const reset=ops.length;ops.push({code:"ClearEphemeral",p1:layer.duplicateCursors[0]});
      for(let i=0;i<followingState.partitionRegisters.length;i++)ops.push({code:"Copy",p1:partitionStart+i,p2:followingState.partitionRegisters[i]!});
      ops.push({code:"Integer",p1:1n,p2:followingState.regPartInitialized!},{code:"Integer",p1:0n,p2:followingState.regOutputReady});
      (ops[first] as {p2:number}).p2=reset;(ops[equal] as {jump:number}).jump=ops.length;
    }
    const gosub=ops.length;ops.push({code:"Gosub",p1:layer.regGosub,p2:0});
    ops.push({code:"Yield",p1:producerCoroutine,p2:0});const sorterNext=ops.length;ops.push({code:"SorterNext",p1:sorterCursor,p2:loopBody});
    (ops[sort] as {emptyJump:number}).emptyJump=ops.length;
    sqlite3WindowCodeStep(()=>{
      if(orderedCurrentGroups&&followingState)emitOrderedCurrentGroupsDrain();
      if((rangeCurrentPeerExclusion||(orderedCumulativePeerExclusion&&layer.windows[0]!.window.frame.exclusion==="ties"))&&followingState)emitRangeCurrentTiesDrain();
      if(rangeOffsetExcludeCurrent&&followingState)emitRangeOffsetExcludeCurrentDrain();
      if(groupsCumulativeExcludeCurrent&&followingState)emitGroupsCumulativeExcludeCurrentDrain();
      if(groupsOnePrecedingExcludeGroup&&followingState)emitGroupsOnePrecedingExcludeGroupDrain();
      if((orderedCumulativePeerGroups||orderedCumulativePriorGroups||(orderedCumulativePeerExclusion&&layer.windows[0]!.window.frame.exclusion==="group"))&&followingState)emitOrderedCumulativePeerGroupsDrain();
      if(orderedSuffixGroups&&followingState)emitOrderedSuffixGroupsDrain();
      if(orderedFollowingGroups&&followingState)emitOrderedFollowingGroupsDrain();
      if(noOrderFollowingGroups&&followingState)emitNoOrderFollowingGroupsDrain();
      if(orderedRangePrecedingCurrent&&followingState)emitOrderedRangePrecedingCurrentDrain();
      if(orderedAdjacentGroups&&followingState)emitOrderedAdjacentGroupsDrain();
      if(directOffset&&followingState)emitDirectOffsetDrain();
      if(wholePartitionExcludeGroup&&followingState)emitWholePartitionExcludeGroupDrain();
      if((wholePartition||singlePeerGroups)&&followingState)emitWholePartitionDrain();
      if(followingUnbounded&&followingState)emitFollowingUnboundedDrain();
      if(currentUnbounded&&followingState)emitCurrentUnboundedDrain();
      if(precedingUnbounded&&followingState)emitPrecedingUnboundedDrain();
      if(precedingFollowing&&followingState)emitPrecedingFollowingDrain();
      if(precedingRange&&followingState)emitPrecedingRangeDrain();
      if(followingRange&&followingState&&rangeEndCount!==null&&rangeStartCount!==null)emitFollowingRangeDrain();
    });
    if(following&&followingState){
      const trailing=ops.length;
      for(const win of layer.windows)ops.push({code:"AggValue",name:win.window.functionName,p1:win.regAccum,p2:win.regResult});
      ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[0],p2:followingState.regNew,count:followingState.inputRegisters.length});
      for(const win of layer.windows){
        const args=Array.from({length:win.window.argumentCount},(_,i)=>followingState.regNew+win.argumentColumn+i);
        ops.push({code:"AggInverse",name:win.window.functionName,args,p2:win.regAccum,collation:args.length?collation(expressionFromReduction(layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary"});
      }
      ops.push({code:"Integer",p1:1n,p2:followingState.regOutputReady},{code:"Yield",p1:producerCoroutine,p2:0},{code:"IfEphemeralHasNext",p1:layer.duplicateCursors[0],jump:trailing});
    }
    ops.push({code:"EndCoroutine",p1:producerCoroutine,p2:0});const continuation=ops.length;(ops[init] as {p2:number}).p2=continuation;
    bindingsPending.push({layer,producerCoroutine,childCoroutine,loopBody,gosub,sorterCursor,payload,ownedClauses:index===0?rewrite.movedClauses:Object.freeze([])});
    childCoroutine=producerCoroutine;childStart=producerStart;
  }
  // The outer SELECT drives only the root rewritten producer. The narrow
  // aggregate-only streaming tranche can now consume regResult directly;
  // mixed/lifted result expressions remain nonpublishable until ordinary
  // expression lowering is attached to this boundary.
  // sqlite3WindowRewrite makes the outermost rewritten SELECT the publication
  // owner. Results produced by an inner incompatible layer are ordinary lifted
  // payload columns by the time they reach this boundary; only windows owned by
  // the root layer remain live regResult values. This avoids any rendezvous by
  // source rowid and preserves duplicate/reordered rows through the coroutine.
  const outputLayer=rewrite.layers.at(-1);
  const outputEntries=outputLayer?resolved.result.map(result=>{const win=outputLayer.windows.find(item=>item.window.owner===result.expression);if(win)return Object.freeze({kind:"window" as const,win});const lifted=outputLayer.lifted.find(item=>item.expression.reduction===result.expression.reduction);return lifted?Object.freeze({kind:"column" as const,bufferColumn:lifted.bufferColumn}):null;}):[];
  const outerOrderEntries=outputLayer?rewrite.outer.orderBy.map(term=>{const lifted=outputLayer.lifted.find(item=>item.expression.reduction===term.expr.reduction);if(lifted)return Object.freeze({kind:"column" as const,bufferColumn:lifted.bufferColumn,term});let tree:Expression|null=null;try{tree=term.expr.reduction?expressionFromReduction(term.expr.reduction):null}catch{}if(tree?.kind==="literal"&&typeof tree.value==="bigint"&&tree.value>=1n&&tree.value<=BigInt(outputEntries.length)){const entry=outputEntries[Number(tree.value)-1];if(entry)return entry.kind==="window"?Object.freeze({kind:"window" as const,win:entry.win,term}):Object.freeze({kind:"column" as const,bufferColumn:entry.bufferColumn,term});}return null;}):[];
  const outputWindows=outputEntries.map(entry=>entry?.kind==="window"?entry.win:null);
  const boundedRowsOffset=(win:NonNullable<typeof outputWindows[number]>):number|null=>{const frame=win.window.frame;if(frame.type!=="rows"||frame.start.kind!=="preceding"||frame.end.kind!=="current"||frame.exclusion!==null||!frame.start.expr?.reduction)return null;return windowConstantInteger(expressionFromReduction(frame.start.expr.reduction));};
  const runtimeBoundedRows=(win:NonNullable<typeof outputWindows[number]>):boolean=>{const frame=win.window.frame;return frame.type==="rows"&&((frame.start.kind==="preceding"&&!!frame.start.expr?.reduction&&frame.end.kind==="current")||(frame.start.kind==="current"&&frame.end.kind==="current"))&&frame.exclusion===null;};
  const precedingPreceding=(win:NonNullable<typeof outputWindows[number]>):boolean=>{const f=win.window.frame;return f.type==="rows"&&f.start.kind==="preceding"&&f.end.kind==="preceding"&&!!f.start.expr?.reduction&&!!f.end.expr?.reduction&&(f.exclusion===null||f.exclusion==="no-others");};
  const precedingFollowingOutput=(win:NonNullable<typeof outputWindows[number]>):boolean=>{const f=win.window.frame;return f.type==="rows"&&f.start.kind==="preceding"&&f.end.kind==="following"&&!!f.start.expr?.reduction&&!!f.end.expr?.reduction&&(f.exclusion===null||f.exclusion==="no-others");};
  const followingUnboundedOutput=(win:NonNullable<typeof outputWindows[number]>):boolean=>{const f=win.window.frame;return f.type==="rows"&&f.start.kind==="following"&&f.end.kind==="unbounded"&&!!f.start.expr?.reduction&&(f.exclusion===null||f.exclusion==="no-others");};
  const currentUnboundedOutput=(win:NonNullable<typeof outputWindows[number]>):boolean=>{const f=win.window.frame;return f.type==="rows"&&f.start.kind==="current"&&f.end.kind==="unbounded"&&(f.exclusion===null||f.exclusion==="no-others");};
  const precedingUnboundedOutput=(win:NonNullable<typeof outputWindows[number]>):boolean=>{const f=win.window.frame;return f.type==="rows"&&win.window.partitionBy.length===0&&f.start.kind==="preceding"&&f.end.kind==="unbounded"&&!!f.start.expr?.reduction&&(f.exclusion===null||f.exclusion==="no-others");};
  const directOffsetOutput=(win:NonNullable<typeof outputWindows[number]>):boolean=>win.window.functionName==="lead"||win.window.functionName==="lag";
  const wholePartitionOutput=(win:NonNullable<typeof outputWindows[number]>):boolean=>{const f=win.window.frame;return (f.exclusion===null||f.exclusion==="no-others")&&((f.type==="rows"&&f.start.kind==="unbounded"&&f.end.kind==="unbounded")||(f.type==="range"&&win.window.orderBy.length===0&&f.start.kind==="unbounded"&&f.end.kind==="current")||(f.type==="groups"&&win.window.orderBy.length===0&&f.start.kind==="current"&&f.end.kind==="unbounded"));};
  const wholePartitionExcludeGroupOutput=(win:NonNullable<typeof outputWindows[number]>):boolean=>{const f=win.window.frame;return f.type==="rows"&&win.window.orderBy.length>0&&f.start.kind==="unbounded"&&f.end.kind==="unbounded"&&f.exclusion==="group";};
  const singlePeerGroupsOutput=(win:NonNullable<typeof outputWindows[number]>):boolean=>{const f=win.window.frame;return f.type==="groups"&&win.window.orderBy.length===0&&f.start.kind==="current"&&f.end.kind==="current"&&(f.exclusion===null||f.exclusion==="no-others");};
  const orderedCurrentGroupsOutput=(win:NonNullable<typeof outputWindows[number]>):boolean=>{const f=win.window.frame;return f.type==="groups"&&win.window.partitionBy.length===0&&win.window.orderBy.length>0&&f.start.kind==="current"&&f.end.kind==="current"&&(f.exclusion===null||f.exclusion==="no-others");};
  const rangeCurrentPeerExclusionOutput=(win:NonNullable<typeof outputWindows[number]>):boolean=>{const f=win.window.frame;return (f.type==="range"||f.type==="groups")&&win.window.partitionBy.length===0&&win.window.orderBy.length>0&&f.start.kind==="current"&&f.end.kind==="current"&&f.exclusion==="ties";};
  const rangeOffsetExcludeCurrentOutput=(win:NonNullable<typeof outputWindows[number]>):boolean=>{const f=win.window.frame;return f.type==="range"&&win.window.orderBy.length===1&&(f.start.kind==="unbounded"||(f.start.kind==="preceding"&&!!f.start.expr?.reduction)||f.start.kind==="current"||(f.start.kind==="following"&&!!f.start.expr?.reduction))&&(f.end.kind==="unbounded"||f.end.kind==="current"||(f.end.kind==="following"&&!!f.end.expr?.reduction))&&(f.exclusion==="current-row"||f.exclusion==="ties"||f.exclusion==="group"||f.exclusion==="no-others");};
  const groupsCumulativeExcludeCurrentOutput=(win:NonNullable<typeof outputWindows[number]>):boolean=>{const f=win.window.frame;return f.type==="groups"&&win.window.partitionBy.length===0&&win.window.orderBy.length>0&&f.start.kind==="unbounded"&&f.end.kind==="current"&&f.exclusion==="current-row";};
  const groupsOnePrecedingExcludeGroupOutput=(win:NonNullable<typeof outputWindows[number]>):boolean=>{const f=win.window.frame;return f.type==="groups"&&win.window.partitionBy.length===0&&win.window.orderBy.length>0&&f.start.kind==="preceding"&&!!f.start.expr?.reduction&&windowConstantInteger(expressionFromReduction(f.start.expr.reduction))===1&&f.end.kind==="current"&&f.exclusion==="group";};
  const orderedCumulativePeerGroupsOutput=(win:NonNullable<typeof outputWindows[number]>):boolean=>{const f=win.window.frame;return (f.type==="groups"||f.type==="range")&&win.window.orderBy.length>0&&f.start.kind==="unbounded"&&f.end.kind==="current"&&(f.exclusion===null||f.exclusion==="no-others");};
  const orderedCumulativePriorGroupsOutput=(win:NonNullable<typeof outputWindows[number]>):boolean=>{const f=win.window.frame;return f.type==="groups"&&win.window.orderBy.length>0&&f.start.kind==="unbounded"&&f.end.kind==="preceding"&&!!f.end.expr?.reduction&&windowConstantInteger(expressionFromReduction(f.end.expr.reduction))===1&&(f.exclusion===null||f.exclusion==="no-others");};
  const cumulativePeerExclusion=(win:NonNullable<typeof outputWindows[number]>):boolean=>{const f=win.window.frame;return f.type==="rows"&&win.window.orderBy.length>0&&f.start.kind==="unbounded"&&f.end.kind==="current"&&(f.exclusion==="group"||f.exclusion==="ties");};
  const orderedSuffixGroupsOutput=(win:NonNullable<typeof outputWindows[number]>):boolean=>{const f=win.window.frame;return f.type==="groups"&&win.window.orderBy.length>0&&f.start.kind==="current"&&f.end.kind==="unbounded"&&(f.exclusion===null||f.exclusion==="no-others");};
  const orderedFollowingGroupsOutput=(win:NonNullable<typeof outputWindows[number]>):boolean=>{const f=win.window.frame;return f.type==="groups"&&win.window.orderBy.length>0&&f.start.kind==="following"&&win.window.functionName==="cume_dist"&&f.end.kind==="unbounded"&&(f.exclusion===null||f.exclusion==="no-others");};
  const noOrderFollowingGroupsOutput=(win:NonNullable<typeof outputWindows[number]>):boolean=>{const f=win.window.frame;return f.type==="groups"&&win.window.orderBy.length===0&&f.start.kind==="following"&&f.end.kind==="unbounded"&&(f.exclusion===null||f.exclusion==="no-others");};
  const orderedRangePrecedingCurrentOutput=(win:NonNullable<typeof outputWindows[number]>):boolean=>{const f=win.window.frame;return f.type==="range"&&win.window.orderBy.length===1&&(f.start.kind==="unbounded"||f.start.kind==="current"||((f.start.kind==="preceding"||f.start.kind==="following")&&!!f.start.expr?.reduction))&&(f.end.kind==="current"||f.end.kind==="unbounded"||(f.end.kind==="following"&&!!f.end.expr?.reduction))&&(f.exclusion===null||f.exclusion==="no-others");};
  const orderedAdjacentGroupsOutput=(win:NonNullable<typeof outputWindows[number]>):boolean=>{const f=win.window.frame;if(f.type!=="groups"||win.window.orderBy.length===0||f.start.kind!=="preceding"||!f.start.expr?.reduction||(f.exclusion!==null&&f.exclusion!=="group"))return false;if(f.exclusion==="group"&&windowConstantInteger(expressionFromReduction(f.start.expr.reduction))===1)return false;return f.end.kind==="current"||(f.end.kind==="following"&&!!f.end.expr?.reduction);};
  const currentFollowing=(win:NonNullable<typeof outputWindows[number]>):boolean=>{const frame=win.window.frame;return frame.type==="rows"&&frame.start.kind==="current"&&frame.end.kind==="following"&&!!frame.end.expr?.reduction&&frame.exclusion===null;};
  const followingFollowing=(win:NonNullable<typeof outputWindows[number]>):boolean=>{const f=win.window.frame;return f.type==="rows"&&f.start.kind==="following"&&f.end.kind==="following"&&!!f.start.expr?.reduction&&!!f.end.expr?.reduction&&(f.exclusion===null||f.exclusion==="no-others");};
  const reversedFollowing=(win:NonNullable<typeof outputWindows[number]>):boolean=>{const frame=win.window.frame;if(win.window.partitionBy.length||frame.type!=="rows"||frame.start.kind!=="following"||frame.end.kind!=="following"||!frame.start.expr?.reduction||!frame.end.expr?.reduction||frame.exclusion!==null)return false;const start=windowConstantInteger(expressionFromReduction(frame.start.expr.reduction)),end=windowConstantInteger(expressionFromReduction(frame.end.expr.reduction));return start!==null&&end!==null&&start>end;};
  const cumulativeExcludeCurrent=(win:NonNullable<typeof outputWindows[number]>):boolean=>{const f=win.window.frame;return f.type==="rows"&&f.start.kind==="unbounded"&&f.end.kind==="current"&&f.exclusion==="current-row";};
  const boundedPeerExclusion=(win:NonNullable<typeof outputWindows[number]>):boolean=>{const f=win.window.frame;return f.type==="rows"&&f.start.kind==="preceding"&&!!f.start.expr?.reduction&&f.end.kind==="current"&&(f.exclusion==="group"||f.exclusion==="ties"||f.exclusion==="no-others");};
  const boundedExcludeCurrent=(win:NonNullable<typeof outputWindows[number]>):boolean=>{const f=win.window.frame;return f.type==="rows"&&f.start.kind==="preceding"&&!!f.start.expr?.reduction&&f.end.kind==="current"&&f.exclusion==="current-row";};
  const executableOutput=(win:NonNullable<typeof outputWindows[number]>):boolean=>directOffsetOutput(win)||(!!aggregateDefinition(win.window.functionName)&&((win.window.frame.type==="rows"&&win.window.frame.start.kind==="unbounded"&&win.window.frame.end.kind==="current"&&(win.window.frame.exclusion===null||win.window.frame.exclusion==="no-others"))||cumulativeExcludeCurrent(win)||boundedExcludeCurrent(win)||boundedPeerExclusion(win)||runtimeBoundedRows(win)||precedingPreceding(win)||precedingFollowingOutput(win)||followingUnboundedOutput(win)||currentUnboundedOutput(win)||precedingUnboundedOutput(win)||wholePartitionOutput(win)||wholePartitionExcludeGroupOutput(win)||singlePeerGroupsOutput(win)||orderedCurrentGroupsOutput(win)||rangeCurrentPeerExclusionOutput(win)||rangeOffsetExcludeCurrentOutput(win)||groupsCumulativeExcludeCurrentOutput(win)||groupsOnePrecedingExcludeGroupOutput(win)||orderedCumulativePeerGroupsOutput(win)||orderedCumulativePriorGroupsOutput(win)||cumulativePeerExclusion(win)||orderedSuffixGroupsOutput(win)||orderedFollowingGroupsOutput(win)||noOrderFollowingGroupsOutput(win)||orderedRangePrecedingCurrentOutput(win)||orderedAdjacentGroupsOutput(win)||currentFollowing(win)||followingFollowing(win)||reversedFollowing(win)));
  const outerOrderRepresented=outerOrderEntries.length===rewrite.outer.orderBy.length&&outerOrderEntries.every(entry=>entry!==null);
  const emitsRows=outputEntries.length===resolved.result.length&&outputEntries.length>0&&outerOrderRepresented&&outputEntries.every(entry=>entry!==null&&(entry.kind==="column"||executableOutput(entry.win)));
  const outputStart=emitsRows?registers+1:0;if(emitsRows)registers+=outputEntries.length;
  const outerSorter=emitsRows&&outerOrderEntries.length?(Math.max(nextApplicationCursor,...sorterCursors)+1):null;
  const outerLimit=emitsRows&&(rewrite.outer.limit!==null||rewrite.outer.offset!==null)?computeLimitRegisters(resolved.source,ops,()=>++registers,parameters):undefined;
  if(outerSorter!==null)ops.push({code:"SorterOpen",p1:outerSorter,keyInfo:new KeyInfo({encoding,totalFieldCount:outerOrderEntries.length+outputEntries.length,keyFieldCount:outerOrderEntries.length,terms:outerOrderEntries.map(entry=>({collation:collation(expressionFromReduction(entry!.term.expr.reduction!)),desc:entry!.term.descending,nullsLarge:entry!.term.nulls==="last"?!entry!.term.descending:entry!.term.nulls==="first"?entry!.term.descending:false}))})});
  const rootInit=ops.length;ops.push({code:"InitCoroutine",p1:childCoroutine,p2:0,p3:childStart});const rootLoop=ops.length;ops.push({code:"Yield",p1:childCoroutine,p2:0});
  if(emitsRows){const rootState=setup.at(-1),needsReady=outputWindows.some(win=>win!==null&&(directOffsetOutput(win)||currentFollowing(win)||followingFollowing(win)||precedingPreceding(win)||precedingFollowingOutput(win)||followingUnboundedOutput(win)||currentUnboundedOutput(win)||precedingUnboundedOutput(win)||wholePartitionOutput(win)||wholePartitionExcludeGroupOutput(win)||singlePeerGroupsOutput(win)||orderedCurrentGroupsOutput(win)||rangeCurrentPeerExclusionOutput(win)||rangeOffsetExcludeCurrentOutput(win)||groupsCumulativeExcludeCurrentOutput(win)||groupsOnePrecedingExcludeGroupOutput(win)||orderedCumulativePeerGroupsOutput(win)||orderedCumulativePriorGroupsOutput(win)||cumulativePeerExclusion(win)||orderedSuffixGroupsOutput(win)||orderedFollowingGroupsOutput(win)||noOrderFollowingGroupsOutput(win)||orderedRangePrecedingCurrentOutput(win)||orderedAdjacentGroupsOutput(win)));let skip:number|undefined;if(needsReady&&rootState){skip=ops.length;ops.push({code:"IfNot",p1:rootState.regOutputReady,p2:0});}for(let index=0;index<outputEntries.length;index++){const entry=outputEntries[index]!;ops.push({code:"Copy",p1:entry.kind==="window"?entry.win.regResult:setup.at(-1)!.regNew+entry.bufferColumn,p2:outputStart+index});}if(outerSorter!==null){const keyStart=registers+1;registers+=outerOrderEntries.length;for(let index=0;index<outerOrderEntries.length;index++){const entry=outerOrderEntries[index]!;ops.push({code:"Copy",p1:entry.kind==="window"?entry.win.regResult:setup.at(-1)!.regNew+entry.bufferColumn,p2:keyStart+index});}ops.push({code:"SorterInsert",p1:outerSorter,keyStart,keyCount:outerOrderEntries.length,payload:outputStart,payloadCount:outputEntries.length});}else{let offsetSkip:number|null=null;if(outerLimit?.offset!==undefined){offsetSkip=ops.length;ops.push({code:"IfPos",p1:outerLimit.offset,p2:0,p3:1});}ops.push({code:"ResultRow",p1:outputStart,p2:outputEntries.length});if(outerLimit)ops.push({code:"DecrJumpZero",p1:outerLimit.count,p2:0});if(offsetSkip!==null)(ops[offsetSkip] as {p2:number}).p2=ops.length;}if(skip!==undefined)(ops[skip] as {p2:number}).p2=ops.length;}
  ops.push({code:"Goto",p2:rootLoop});const outerDrain=ops.length;(ops[rootLoop] as {p2:number}).p2=outerDrain;if(outerSorter===null&&outerLimit){(ops[outerLimit.ifZero] as {p2:number}).p2=outerDrain;for(const op of ops)if(op.code==="DecrJumpZero"&&op.p1===outerLimit.count&&op.p2===0)(op as {p2:number}).p2=outerDrain;}if(outerSorter!==null){const sort=ops.length;ops.push({code:"SorterSort",p1:outerSorter,emptyJump:0},{code:"SorterData",p1:outerSorter,p2:outputStart,count:outputEntries.length});let offsetSkip:number|null=null;if(outerLimit?.offset!==undefined){offsetSkip=ops.length;ops.push({code:"IfPos",p1:outerLimit.offset,p2:0,p3:1});}ops.push({code:"ResultRow",p1:outputStart,p2:outputEntries.length});let limitDone:number|null=null;if(outerLimit){limitDone=ops.length;ops.push({code:"DecrJumpZero",p1:outerLimit.count,p2:0});}const next=ops.length;if(offsetSkip!==null)(ops[offsetSkip] as {p2:number}).p2=next;ops.push({code:"SorterNext",p1:outerSorter,p2:sort+1});const done=ops.length;(ops[sort] as {emptyJump:number}).emptyJump=done;if(limitDone!==null)(ops[limitDone] as {p2:number}).p2=done;if(outerLimit)(ops[outerLimit.ifZero] as {p2:number}).p2=done;}ops.push({code:"Halt"});
  const loopBindings:WindowLoopBinding[]=[];
  for(const pending of bindingsPending){
    const target=ops.length;(ops[pending.gosub] as {p2:number}).p2=target;
    const state=setup.find(item=>item.compatibleGroup===pending.layer.compatibleGroup);if(!state)throw new JSQLiteError("internal","window setup layer is missing");
    for(let column=0;column<state.inputRegisters.length;column++)ops.push({code:"Copy",p1:pending.payload+column,p2:state.regNew+column});
    const streaming=pending.layer.windows.every(win=>{const frame=win.window.frame;return !!aggregateDefinition(win.window.functionName)&&frame.type==="rows"&&(((frame.exclusion===null||frame.exclusion==="no-others")&&(frame.end.kind==="current"&&(frame.start.kind==="unbounded"||frame.start.kind==="current"||(frame.start.kind==="preceding"&&!!frame.start.expr?.reduction))))||(frame.exclusion==="current-row"&&frame.end.kind==="current"&&(frame.start.kind==="unbounded"||(frame.start.kind==="preceding"&&!!frame.start.expr?.reduction)))||((frame.exclusion==="no-others"||((frame.exclusion==="group"||frame.exclusion==="ties")&&win.window.orderBy.length>0))&&frame.start.kind==="preceding"&&!!frame.start.expr?.reduction&&frame.end.kind==="current"));});
    if(streaming&&state.partitionRegisters.length){
      const partitionStart=state.regNew+pending.layer.windows[0]!.argumentColumn-state.partitionRegisters.length-pending.layer.windows[0]!.window.orderBy.length;
      const firstAt=ops.length;ops.push({code:"IfNot",p1:state.regPartInitialized!,p2:0});
      const compareAt=ops.length;ops.push({code:"CompareGroup",left:partitionStart,right:state.partitionRegisters[0]!,count:state.partitionRegisters.length,keyInfo:state.partitionKeyInfo!,jump:0});
      const resetAt=ops.length;ops.push({code:"AggReset",registers:pending.layer.windows.map(win=>win.regAccum)},{code:"ClearEphemeral",p1:pending.layer.duplicateCursors[0]});
      for(let index=0;index<state.partitionRegisters.length;index++)ops.push({code:"Copy",p1:partitionStart+index,p2:state.partitionRegisters[index]!});
      ops.push({code:"Integer",p1:1n,p2:state.regPartInitialized!});
      (ops[firstAt] as {p2:number}).p2=resetAt;(ops[compareAt] as {jump:number}).jump=ops.length;
    }
    ops.push({code:"MakeRecord",p1:state.regNew,p2:state.inputRegisters.length,p3:state.regRecord},{code:"NewRowid",p1:pending.layer.iEphCsr,p2:state.regRowid},{code:"Insert",p1:pending.layer.iEphCsr,p2:state.regRecord,p3:state.regRowid});
    // window.c:windowAggStep, bounded streaming tranche. For ROWS
    // UNBOUNDED PRECEDING..CURRENT ROW no peer or lookahead navigation is
    // required: the just-cached producer row steps each compatible aggregate
    // once and xValue snapshots regAccum into regResult. Other frame shapes
    // remain deliberately unexecuted until windowCodeOp owns their cursors.
    const sharedExcludeCurrent=pending.layer.windows.length>0&&pending.layer.windows.every(win=>{const f=win.window.frame;return f.type==="rows"&&f.start.kind==="unbounded"&&f.end.kind==="current"&&f.exclusion==="current-row";});
    const sharedBoundedExcludeCurrent=pending.layer.windows.length>0&&pending.layer.windows.every(win=>{const f=win.window.frame;return f.type==="rows"&&f.start.kind==="preceding"&&!!f.start.expr?.reduction&&f.end.kind==="current"&&f.exclusion==="current-row";});
    const sharedBoundedPeerExclusion=pending.layer.windows.length>0&&pending.layer.windows.every(win=>{const f=win.window.frame;return f.type==="rows"&&f.start.kind==="preceding"&&!!f.start.expr?.reduction&&f.end.kind==="current"&&(f.exclusion==="group"||f.exclusion==="ties"||f.exclusion==="no-others");});
    if(sharedExcludeCurrent){
      // window.c EXCLUDE scan for this cumulative ROWS specialization: the
      // frame before the current row is exactly the retained context. Snapshot
      // it first, then admit the current cached row for the next output.
      for(const win of pending.layer.windows)ops.push({code:"AggValue",name:win.window.functionName,p1:win.regAccum,p2:win.regResult});
      for(const win of pending.layer.windows){const args=Array.from({length:win.window.argumentCount},(_,index)=>state.regNew+win.argumentColumn+index);let filterJump:number|null=null;if(win.filterColumn!==null){filterJump=ops.length;ops.push({code:"IfNot",p1:state.regNew+win.filterColumn,p2:0});}const stepAt=ops.length;ops.push({code:"AggStep",name:win.window.functionName,args,p2:win.regAccum,collation:args.length?collation(expressionFromReduction(pending.layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary"});if(filterJump!==null)(ops[filterJump] as {p2:number}).p2=stepAt+1;}
    }
    if(sharedBoundedExcludeCurrent){
      const frame=pending.layer.windows[0]!.window.frame,bounded=windowConstantInteger(expressionFromReduction(frame.start.expr!.reduction!));
      // The application scan for this ROWS/CURRENT specialization has one
      // eligible prefix: after advancing the ordinary start cursor, the base
      // context is exactly [start,current). Snapshot it before admitting the
      // current payload. Dynamic bounds retain the checked boundary register.
      const trim=ops.length;ops.push({code:"IfCursorSizeGt",p1:pending.layer.iEphCsr,...(bounded!==null?{threshold:bounded+1}:{thresholdRegister:state.boundRegisters.start!}),jump:0});
      const snapshotJump=ops.length;ops.push({code:"Goto",p2:0});const inverse=ops.length;ops.push({code:"EphemeralAdvanceData",p1:pending.layer.duplicateCursors[0],p2:state.regNew,count:state.inputRegisters.length});
      for(const win of pending.layer.windows){const args=Array.from({length:win.window.argumentCount},(_,index)=>state.regNew+win.argumentColumn+index);let skip:number|null=null;if(win.filterColumn!==null){skip=ops.length;ops.push({code:"IfNot",p1:state.regNew+win.filterColumn,p2:0});}const at=ops.length;ops.push({code:"AggInverse",name:win.window.functionName,args,p2:win.regAccum,collation:args.length?collation(expressionFromReduction(pending.layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary"});if(skip!==null)(ops[skip] as {p2:number}).p2=at+1;}
      const snapshot=ops.length;(ops[trim] as {jump:number}).jump=inverse;(ops[snapshotJump] as {p2:number}).p2=snapshot;for(const win of pending.layer.windows)ops.push({code:"AggValue",name:win.window.functionName,p1:win.regAccum,p2:win.regResult});
      // Inverse loading overwrote regNew. Restore the authoritative producer
      // payload before stepping current; the sorter payload remains retained in
      // pending.payload across this Gosub and no host row object is introduced.
      for(let column=0;column<state.inputRegisters.length;column++)ops.push({code:"Copy",p1:pending.payload+column,p2:state.regNew+column});
      for(const win of pending.layer.windows){const args=Array.from({length:win.window.argumentCount},(_,index)=>state.regNew+win.argumentColumn+index);let skip:number|null=null;if(win.filterColumn!==null){skip=ops.length;ops.push({code:"IfNot",p1:state.regNew+win.filterColumn,p2:0});}const at=ops.length;ops.push({code:"AggStep",name:win.window.functionName,args,p2:win.regAccum,collation:args.length?collation(expressionFromReduction(pending.layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary"});if(skip!==null)(ops[skip] as {p2:number}).p2=at+1;}
    }
    if(sharedBoundedPeerExclusion){
      const frame=pending.layer.windows[0]!.window.frame,offset=windowConstantInteger(expressionFromReduction(frame.start.expr!.reduction!));
      const endRowid=++registers,startRowid=++registers,candidateRowid=++registers;const temporary=pending.layer.windows.map(()=>++registers);
      ops.push({code:"AggReset",registers:temporary},{code:"Copy",p1:state.regRowid,p2:endRowid});
      if(offset!==null){const width=++registers;ops.push({code:"Integer",p1:BigInt(offset),p2:width},{code:"Subtract",p1:endRowid,p2:width,p3:startRowid});}else ops.push({code:"Subtract",p1:endRowid,p2:state.boundRegisters.start!,p3:startRowid});
      const seek=ops.length;ops.push({code:"EphemeralRewind",p1:state.applicationCursor!,p2:0});const loop=ops.length;ops.push({code:"EphemeralRowid",p1:state.applicationCursor!,p2:candidateRowid});const beforeStart=ops.length;ops.push({code:"IfRegisterGt",left:startRowid,right:candidateRowid,jump:0});const beyond=ops.length;ops.push({code:"IfRegisterGt",left:candidateRowid,right:endRowid,jump:0},{code:"EphemeralData",p1:state.applicationCursor!,p2:state.regNew,count:state.inputRegisters.length});
      const exclusion=frame.exclusion,orderCount=pending.layer.windows[0]!.window.orderBy.length,orderStart=pending.layer.windows[0]!.argumentColumn-orderCount;const peer=exclusion==="no-others"?null:ops.length;if(peer!==null)ops.push({code:"CompareGroup",left:state.regNew+orderStart,right:pending.payload+orderStart,count:orderCount,keyInfo:state.peerKeyInfo!,jump:0});
      const stepJumps:number[]=[];let identitySkip:number|null=null;if(exclusion==="ties"){stepJumps.push(ops.length);ops.push({code:"Goto",p2:0});const identity=ops.length;(ops[peer!] as {jump:number}).jump=identity;const same=++registers;ops.push({code:"Eq",p1:candidateRowid,p2:endRowid,p3:same,affinity:"numeric",collation:"binary"});identitySkip=ops.length;ops.push({code:"IfNot",p1:same,p2:0});stepJumps.push(ops.length);ops.push({code:"Goto",p2:0});}
      const step=ops.length;for(const jump of stepJumps)(ops[jump] as {p2:number}).p2=step;for(let i=0;i<pending.layer.windows.length;i++){const win=pending.layer.windows[i]!,args=Array.from({length:win.window.argumentCount},(_,index)=>state.regNew+win.argumentColumn+index);let skip:number|null=null;if(win.filterColumn!==null){skip=ops.length;ops.push({code:"IfNot",p1:state.regNew+win.filterColumn,p2:0});}const at=ops.length;ops.push({code:"AggStep",name:win.window.functionName,args,p2:temporary[i]!,collation:args.length?collation(expressionFromReduction(pending.layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary"});if(skip!==null)(ops[skip] as {p2:number}).p2=at+1;}
      const next=ops.length;if(exclusion==="group")(ops[peer!] as {jump:number}).jump=next;if(identitySkip!==null)(ops[identitySkip] as {p2:number}).p2=next;(ops[beforeStart] as {jump:number}).jump=next;ops.push({code:"EphemeralNext",p1:state.applicationCursor!,p2:loop});const finish=ops.length;(ops[seek] as {jump:number}).jump=finish;(ops[beyond] as {jump:number}).jump=finish;for(let i=0;i<pending.layer.windows.length;i++)ops.push({code:"AggValue",name:pending.layer.windows[i]!.window.functionName,p1:temporary[i]!,p2:pending.layer.windows[i]!.regResult});for(let column=0;column<state.inputRegisters.length;column++)ops.push({code:"Copy",p1:pending.payload+column,p2:state.regNew+column});
    }
    const sharedSliding=pending.layer.windows.length>0&&pending.layer.windows.every(win=>{const frame=win.window.frame;return frame.type==="rows"&&frame.end.kind==="current"&&(frame.exclusion===null||frame.exclusion==="no-others")&&(frame.start.kind==="current"||(frame.start.kind==="preceding"&&!!frame.start.expr?.reduction));});
    if(sharedSliding){
      for(const win of pending.layer.windows){const args=Array.from({length:win.window.argumentCount},(_,index)=>state.regNew+win.argumentColumn+index);let filterJump:number|null=null;if(win.filterColumn!==null){filterJump=ops.length;ops.push({code:"IfNot",p1:state.regNew+win.filterColumn,p2:0});}const stepAt=ops.length;ops.push({code:"AggStep",name:win.window.functionName,args,p2:win.regAccum,collation:args.length?collation(expressionFromReduction(pending.layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary"});if(filterJump!==null)(ops[filterJump] as {p2:number}).p2=stepAt+1;}
      const frame=pending.layer.windows[0]!.window.frame,bounded=frame.start.expr?.reduction?windowConstantInteger(expressionFromReduction(frame.start.expr.reduction)):null;
      const skip=ops.length;ops.push({code:"IfCursorSizeGt",p1:pending.layer.iEphCsr,...(frame.start.kind==="current"?{threshold:1}:bounded!==null?{threshold:bounded+1}:{thresholdRegister:state.boundRegisters.start!}),jump:0});const done=ops.length;ops.push({code:"Goto",p2:0});const inverse=ops.length;ops.push({code:"EphemeralAdvanceData",p1:pending.layer.duplicateCursors[0],p2:state.regNew,count:state.inputRegisters.length});for(const win of pending.layer.windows){const args=Array.from({length:win.window.argumentCount},(_,index)=>state.regNew+win.argumentColumn+index);ops.push({code:"AggInverse",name:win.window.functionName,args,p2:win.regAccum,collation:args.length?collation(expressionFromReduction(pending.layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary"});}(ops[skip] as {jump:number}).jump=inverse;(ops[done] as {p2:number}).p2=ops.length;
      // windowReturnOneRow publishes the current output row, not the row most
      // recently loaded through the start cursor for xInverse. Restore the
      // layer-owned producer payload at this explicit value boundary. This is
      // the register equivalent of SQLite's separate current/start cursors and
      // prevents ordinary result columns and outer keys from lagging a row.
      for(let column=0;column<state.inputRegisters.length;column++)ops.push({code:"Copy",p1:pending.payload+column,p2:state.regNew+column});
      for(const win of pending.layer.windows)ops.push({code:"AggValue",name:win.window.functionName,p1:win.regAccum,p2:win.regResult});
    }
    const sharedFollowing=pending.layer.windows.length>0&&pending.layer.windows.every(currentFollowing);
    if(sharedFollowing){
      for(const win of pending.layer.windows){
        const args=Array.from({length:win.window.argumentCount},(_,index)=>state.regNew+win.argumentColumn+index);
        let filterJump:number|null=null;if(win.filterColumn!==null){filterJump=ops.length;ops.push({code:"IfNot",p1:state.regNew+win.filterColumn,p2:0});}
        const stepAt=ops.length;ops.push({code:"AggStep",name:win.window.functionName,args,p2:win.regAccum,collation:args.length?collation(expressionFromReduction(pending.layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary"});if(filterJump!==null)(ops[filterJump] as {p2:number}).p2=stepAt+1;
      }
      const ready=ops.length;ops.push({code:"IfCursorSizeGt",p1:pending.layer.iEphCsr,thresholdRegister:state.boundRegisters.end!,registerAdjustment:0,jump:0});
      const done=ops.length;ops.push({code:"Goto",p2:0});const snapshot=ops.length;
      for(const win of pending.layer.windows)ops.push({code:"AggValue",name:win.window.functionName,p1:win.regAccum,p2:win.regResult});
      ops.push({code:"Integer",p1:1n,p2:state.regOutputReady},{code:"EphemeralAdvanceData",p1:pending.layer.duplicateCursors[0],p2:state.regNew,count:state.inputRegisters.length});
      for(const win of pending.layer.windows){const args=Array.from({length:win.window.argumentCount},(_,index)=>state.regNew+win.argumentColumn+index);ops.push({code:"AggInverse",name:win.window.functionName,args,p2:win.regAccum,collation:args.length?collation(expressionFromReduction(pending.layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary"});}
      (ops[ready] as {jump:number}).jump=snapshot;(ops[done] as {p2:number}).p2=ops.length;
    }
    const cachedDirectOffset=cachedDirectOffsetLayer(pending.layer);
    for(const win of pending.layer.windows){
      const frame=win.window.frame,definition=aggregateDefinition(win.window.functionName);
      if(cachedDirectOffset)continue;
      const bounded=frame.start.kind==="preceding"&&frame.start.expr?.reduction?windowConstantInteger(expressionFromReduction(frame.start.expr.reduction)):null;
      const cumulative=frame.type==="rows"&&frame.start.kind==="unbounded"&&frame.end.kind==="current"&&(frame.exclusion===null||frame.exclusion==="no-others");
      const sliding=frame.type==="rows"&&((frame.start.kind==="preceding"&&!!frame.start.expr?.reduction)||(frame.start.kind==="current"))&&frame.end.kind==="current"&&(frame.exclusion===null||frame.exclusion==="no-others");
      const currentOnly=sliding&&frame.start.kind==="current";
      const followingFrame=currentFollowing(win);
      const reversed=reversedFollowing(win);
      if(!definition||sharedSliding||sharedFollowing||(!cumulative&&!sliding&&!followingFrame&&!reversed))continue;
      const args=Array.from({length:win.window.argumentCount},(_,index)=>state.regNew+win.argumentColumn+index);
      if(reversed){ops.push({code:"AggValue",name:win.window.functionName,p1:win.regAccum,p2:win.regResult});continue;}
      let filterJump:number|null=null;
      if(win.filterColumn!==null){filterJump=ops.length;ops.push({code:"IfNot",p1:state.regNew+win.filterColumn,p2:0});}
      const stepAt=ops.length;ops.push({code:"AggStep",name:win.window.functionName,args,p2:win.regAccum,collation:args.length?collation(expressionFromReduction(pending.layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary"});
      if(filterJump!==null)(ops[filterJump] as {p2:number}).p2=stepAt+1;
      if(sliding){
        const skip=ops.length;ops.push({code:"IfCursorSizeGt",p1:pending.layer.iEphCsr,...(currentOnly?{threshold:1}:{...(bounded!==null?{threshold:bounded+1}:{thresholdRegister:state.boundRegisters.start!})}),jump:0});
        const done=ops.length;ops.push({code:"Goto",p2:0});
        const inverse=ops.length;ops.push({code:"EphemeralAdvanceData",p1:pending.layer.duplicateCursors[0],p2:state.regNew,count:state.inputRegisters.length},{code:"AggInverse",name:win.window.functionName,args,p2:win.regAccum,collation:args.length?collation(expressionFromReduction(pending.layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary"});
        (ops[skip] as {jump:number}).jump=inverse;(ops[done] as {p2:number}).p2=ops.length;
      }
      if(followingFrame){
        const ready=ops.length;ops.push({code:"IfCursorSizeGt",p1:pending.layer.iEphCsr,thresholdRegister:state.boundRegisters.end!,registerAdjustment:0,jump:0});
        const done=ops.length;ops.push({code:"Goto",p2:0});
        const snapshot=ops.length;ops.push({code:"AggValue",name:win.window.functionName,p1:win.regAccum,p2:win.regResult},{code:"Integer",p1:1n,p2:state.regOutputReady},{code:"EphemeralAdvanceData",p1:pending.layer.duplicateCursors[0],p2:state.regNew,count:state.inputRegisters.length},{code:"AggInverse",name:win.window.functionName,args,p2:win.regAccum,collation:args.length?collation(expressionFromReduction(pending.layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary"});
        (ops[ready] as {jump:number}).jump=snapshot;(ops[done] as {p2:number}).p2=ops.length;
      }else ops.push({code:"AggValue",name:win.window.functionName,p1:win.regAccum,p2:win.regResult});
    }
    // Every streaming Gosub shape except the lookahead-following schedule has
    // completed its value register for the just-cached row. This flag is also
    // the nested rewrite boundary: an incompatible parent must not discard a
    // valid child row merely because the child is not the root publisher.
    if(streaming&&!sharedFollowing)ops.push({code:"Integer",p1:1n,p2:state.regOutputReady});
    const returnAddress=ops.length;ops.push({code:"Return",p1:pending.layer.regGosub});
    loopBindings.push(Object.freeze({compatibleGroup:pending.layer.compatibleGroup,producerKind:pending.layer.producer.kind,producerCoroutine:pending.producerCoroutine,childCoroutine:pending.childCoroutine,loopBody:pending.loopBody,gosub:pending.gosub,returnAddress,sorterCursor:pending.sorterCursor,ownedClauses:Object.freeze(pending.ownedClauses),producerOrderBy:pending.layer.producerOrderBy}));
  }
  const program=Object.freeze({ops:Object.freeze(ops),registers,columns:Object.freeze(emitsRows&&allProducerExpressionsRepresented?resolved.result.map(result=>Object.freeze({name:result.name,declaredType:result.descriptor.declaredType,database:result.descriptor.database,table:result.descriptor.table,origin:result.descriptor.origin})):[]),parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),...(database?{database}:{}),maxWorkUnits,maxResultBytes,privateStateLimits,encoding});
  return Object.freeze({rewrite,setup:Object.freeze(setup),loopBindings:Object.freeze(loopBindings),program});
}

export function programOpcodeNames(program:Program):readonly string[]{return Object.freeze(program.ops.map(op=>op.code));}
export function programControlTargets(program:Program):readonly Readonly<{index:number;code:string;target:number;targetCode:string|undefined}>[]{
  return Object.freeze(program.ops.flatMap((op,index)=>{
    const target=op.code==="IfPos"||op.code==="DecrJumpZero"||op.code==="Once"||op.code==="Gosub"||op.code==="InitCoroutine"||op.code==="Yield"||op.code==="EndCoroutine"?op.p2:undefined;
    return target===undefined?[]:[Object.freeze({index,code:op.code,target,targetCode:program.ops[target]?.code})];
  }));
}
export const DEFAULT_PRIVATE_STATE_LIMITS:PrivateStateLimits=Object.freeze({maxEntries:100_000,maxKeyBytes:16*1024*1024,maxBytes:256*1024*1024});
interface ParameterBuilder { maximum: number; readonly names: (string | null)[]; readonly named: Map<string, number> }

/** Shared scalar-result owner, corresponding to sqlite3_context and its result Mem. */
export class FunctionContext {
  readonly #result = new Mem();
  #resultCleanup: (() => void) | null = null;
  readonly #auxData = new Map<number,{value:unknown;cleanup:(() => void)|null}>();
  firstError: unknown = null;

  setResult(value: Mem, cleanup: (() => void) | null = null): void {
    this.cleanupResult();
    this.#result.moveFrom(value);
    this.#resultCleanup = cleanup;
  }
  setError(error: unknown): void { if (this.firstError === null) this.firstError = error; }
  setAuxData(index:number,value:unknown,cleanup:(() => void)|null=null):void {
    this.cleanupAuxData(index);
    this.#auxData.set(index,{value,cleanup});
  }
  getAuxData(index:number):unknown{return this.#auxData.get(index)?.value;}
  cleanupAuxData(index?:number):void {
    const keys=index===undefined?[...this.#auxData.keys()]:[index];
    for(const key of keys){const item=this.#auxData.get(key);if(!item)continue;this.#auxData.delete(key);if(item.cleanup!==null)try{item.cleanup();}catch(error){this.setError(error);}}
  }
  cleanupResult(): void {
    this.#result.release();
    const cleanup = this.#resultCleanup; this.#resultCleanup = null;
    if (cleanup !== null) try { cleanup(); } catch (error) { this.setError(error); }
  }
  takeResult(): Mem {
    if (this.firstError !== null) { const error=this.firstError; this.cleanupResult(); this.cleanupAuxData(); throw error; }
    const result=new Mem(); result.moveFrom(this.#result); this.cleanupResult(); this.cleanupAuxData();
    if (this.firstError !== null) { const error=this.firstError; result.release(); throw error; }
    return result;
  }
}
function runFunctionContext(evaluate: () => Mem): Mem {
  const context=new FunctionContext();
  try { context.setResult(evaluate()); } catch (error) { context.setError(error); }
  return context.takeResult();
}
function aggregateDefinition(name:string):AggregateDefinition<any>|undefined{return aggregateDefinitions[name]}
function resolveBuiltinFunction(name:string,argc:number):NonNullable<ReturnType<typeof builtinFunction>>{
 const definition=builtinFunction(name);
 if(definition===undefined)throw new JSQLiteError("sqlite",`no such function: ${name}`,{code:1});
 // resolve.c rejects calls beyond SQLITE_MAX_FUNCTION_ARG independently of
 // FuncDef arity matching, with a distinct diagnostic from ordinary mismatch.
 if(argc>definition.maximumArity)throw new JSQLiteError("sqlite",`too many arguments on function ${name}`,{code:1});
 if(!builtinFunctionAccepts(definition,argc))throw new JSQLiteError("sqlite",`wrong number of arguments to function ${name}()`,{code:1});
 if(!definition.dispatchable)throw new JSQLiteError("unsupported",`built-in function ${name}() is registered but not implemented`,{unsupportedClassification:"temporary"});
 return definition;
}
function exprLeaves(n:LemonValue<SqlToken>):SqlToken[]{return n.kind==="terminal"?(n.value?[n.value]:[]):n.children.flatMap(exprLeaves)}
function descendantExprs(n:LemonValue<SqlToken>):LemonValue<SqlToken>[] {if(n.kind!=="reduction")return[];const out:LemonValue<SqlToken>[]=[];for(const c of n.children){if(c.kind==="reduction"&&(c.signature.startsWith("expr ::=")||c.signature.startsWith("term ::=")))out.push(c);else out.push(...descendantExprs(c))}return out}
type Reduction=Extract<LemonValue<SqlToken>,{kind:'reduction'}>;
function directReduction(n:LemonValue<SqlToken>,prefix:string):Reduction|undefined{return n.kind==='reduction'?n.children.find((child):child is Reduction=>child.kind==='reduction'&&child.signature.startsWith(prefix)):undefined}
function findReduction(n:LemonValue<SqlToken>,prefix:string):Reduction|undefined{if(n.kind!=='reduction')return undefined;if(n.signature.startsWith(prefix))return n;for(const child of n.children){const found=findReduction(child,prefix);if(found)return found}return undefined}
function listExpressions(n:LemonValue<SqlToken>,prefix:string):Reduction[] {if(n.kind!=='reduction')return[];const prior=directReduction(n,prefix),own=n.children.find((child):child is Reduction=>child.kind==='reduction'&&(child.signature.startsWith('expr ::=')||child.signature.startsWith('term ::=')));return[...(prior?listExpressions(prior,prefix):[]),...(own?[own]:[])]}
function sortListItems(n:LemonValue<SqlToken>):Reduction[]{if(n.kind!=='reduction'||!n.signature.startsWith('sortlist ::='))return[];const prior=directReduction(n,'sortlist ::=');return[...(prior?sortListItems(prior):[]),n]}
function aggregateParts(n:LemonValue<SqlToken>):{args:Expression[];distinct:boolean;filter:Expression|null;orderBy:AggregateOrderTerm[]}{
 const exprlist=directReduction(n,'exprlist ::=');const args=exprlist?listExpressions(exprlist,'nexprlist ::=').map(expressionFromReduction):[];
 const distinct=directReduction(n,'distinct ::=')?.signature.includes('DISTINCT')??false;
 const filterNode=findReduction(n,'filter_clause ::= FILTER'),filterExpr=filterNode?.children.find((child):child is Reduction=>child.kind==='reduction'&&child.signature.startsWith('expr ::='));
 const sortlist=directReduction(n,'sortlist ::=');const orderBy=sortlist?sortListItems(sortlist).map(item=>{const expr=item.children.find((child):child is Reduction=>child.kind==='reduction'&&(child.signature.startsWith('expr ::=')||child.signature.startsWith('term ::=')));if(!expr)throw new JSQLiteError('internal','generated aggregate ORDER BY item has no expression');const order=directReduction(item,'sortorder ::='),nulls=directReduction(item,'nulls ::='),descending=exprLeaves(order!).some(token=>token.text.toUpperCase()==='DESC'),words=exprLeaves(nulls!).map(token=>token.text.toUpperCase()).join(' '),first=words.includes('NULLS FIRST'),last=words.includes('NULLS LAST');return{expression:expressionFromReduction(expr),descending,nullsLarge:last?!descending:first?descending:false}}):[];
 return{args,distinct,filter:filterExpr?expressionFromReduction(filterExpr):null,orderBy};
}
function decodeString(s:string){return s.slice(1,-1).replaceAll("''", "'")}
function affinityOf(s:string):MemAffinity{const x=s.toUpperCase();if(x.includes("INT"))return"integer";if(x.includes("CHAR")||x.includes("CLOB")||x.includes("TEXT"))return"text";if(x.includes("REAL")||x.includes("FLOA")||x.includes("DOUB"))return"real";if(!x||x.includes("BLOB"))return"blob";return"numeric"}
/** btree table INTEGER PRIMARY KEY columns are aliases for the rowid and have no record payload field. */
function isIntegerPrimaryKeyAlias(table:TableNode,columnIndex:number):boolean{const column=table.columns[columnIndex];return table.primaryKey.length===1&&column?.primaryKeyPosition!==null&&column?.declaredType?.trim().toUpperCase()==="INTEGER"}
function expressionFromReduction(n:LemonValue<SqlToken>):Expression{
 if(n.kind!=="reduction"||!(n.signature.startsWith("expr ::=")||n.signature.startsWith("term ::=")))throw new JSQLiteError("unsupported","expression reduction is not implemented",{unsupportedClassification:"temporary"});
 const t=exprLeaves(n), all=descendantExprs(n), sig=n.signature;
 if(sig==="expr ::= ID|INDEXED|JOIN_KW"){const keyword=sqliteAsciiFold(t[0]!.text);if(['current_date','current_time','current_timestamp'].includes(keyword))return{kind:"call",name:keyword,args:[]};}
 if(sig.startsWith("term ::=")||sig==="expr ::= term"||sig==="expr ::= VARIABLE"){const x=t[0]!;const keyword=sqliteAsciiFold(x.text);if(['current_date','current_time','current_timestamp'].includes(keyword))return{kind:"call",name:keyword,args:[]};if(x.kind==="integer"){const v=BigInt(x.text);return{kind:"literal",value:v<(1n<<63n)?v:Number(x.text)}}if(x.kind==="float")return{kind:"literal",value:Number(x.text)};if(x.kind==="string")return{kind:"literal",value:decodeString(x.text)};if(x.kind==="blob")return{kind:"literal",value:Uint8Array.from(x.text.slice(2,-1).match(/../g)?.map(y=>parseInt(y,16))??[])};if(x.text.toUpperCase()==="NULL")return{kind:"literal",value:null}}
 if(sig==="expr ::= VARIABLE")return{kind:"variable",spelling:t[0]!.text};
 if(sig==="expr ::= LP expr RP")return expressionFromReduction(all[0]!);
 if(sig==="expr ::= LP select RP"){
  const nested=directReduction(n,"select ::=")?.semantic;
  if(!nested||typeof nested!=="object"||!("kind" in nested)||nested.kind!=="select")throw new JSQLiteError("internal","generated scalar subquery lost its Select");
  return{kind:"scalar-subquery",select:nested as SelectNode};
 }
 if(sig==="expr ::= EXISTS LP select RP"){
  const nested=directReduction(n,"select ::=")?.semantic;
  if(!nested||typeof nested!=="object"||!("kind" in nested)||nested.kind!=="select")throw new JSQLiteError("internal","generated EXISTS lost its Select");
  return{kind:"scalar-subquery",select:nested as SelectNode,exists:true};
 }
 if(sig==="expr ::= expr in_op LP select RP"){
  const nested=directReduction(n,"select ::=")?.semantic,inOp=directReduction(n,"in_op ::=");
  if(!nested||typeof nested!=="object"||!("kind" in nested)||nested.kind!=="select")throw new JSQLiteError("internal","generated IN subquery lost its Select");
  return{kind:"in-subquery",left:expressionFromReduction(all[0]!),select:nested as SelectNode,negated:inOp?.signature==="in_op ::= NOT IN"};
 }
 if(sig==="expr ::= expr in_op LP exprlist RP"){
  const inOp=directReduction(n,"in_op ::="),list=directReduction(n,"exprlist ::=");
  return{kind:"in-list",left:expressionFromReduction(all[0]!),values:list?listExpressions(list,"nexprlist ::=").map(expressionFromReduction):[],negated:inOp?.signature==="in_op ::= NOT IN"};
 }
 if(sig==="expr ::= PLUS|MINUS expr"||sig==="expr ::= BITNOT expr"||sig==="expr ::= NOT expr"){
  // expr.c admits 2^63 only as the operand of unary minus.
  if(t[0]!.text==="-"&&all[0]?.kind==="reduction"){const leaf=exprLeaves(all[0]);if(leaf.length===1&&leaf[0]!.kind==="integer"&&leaf[0]!.text==="9223372036854775808")return{kind:"literal",value:-(1n<<63n)}}
  return{kind:"unary",op:t[0]!.text.toUpperCase(),value:expressionFromReduction(all[0]!)};
 }
 if(sig.startsWith("expr ::= expr likeop expr")){
  const operands=n.children.filter((child):child is Reduction=>child.kind==="reduction"&&child.signature.startsWith("expr ::="));
  const likeop=directReduction(n,"likeop ::="),words=exprLeaves(likeop!).map(token=>sqliteAsciiFold(token.text));
  const name=words.includes("glob")?"glob":"like",negated=words.includes("not");
  // expr.c reverses infix operands for likeFunc(): argv[0] is pattern and
  // argv[1] is the candidate string.  ESCAPE, when present, remains argv[2].
  const args=[expressionFromReduction(operands[1]!),expressionFromReduction(operands[0]!)];
  if(operands[2])args.push(expressionFromReduction(operands[2]));
  const definition=resolveBuiltinFunction(name,args.length),call:Expression={kind:"call",name:definition.name,args};
  return negated?{kind:"unary",op:"NOT",value:call}:call;
 }
 if(all.length===2&&sig.startsWith("expr ::= expr ")){
  // Select the operator from the reduction itself, not from flattened leaves:
  // a child comparison may otherwise be mistaken for the outer AND/OR.
  const directWords=n.children.flatMap(child=>child.kind==="terminal"&&child.value?[child.value.text.toUpperCase()]:[]);
  const op=sig.includes(" IS NOT ")?"IS NOT":directWords[0]??t.find(token=>["+","-","*","/","%","||","=","==","!=","<>","<",">","<=",">=","IS","AND","OR"].includes(token.text.toUpperCase()))?.text.toUpperCase();
  if(op&&["+","-","*","/","%","||","->","->>","=","==","!=","<>","<",">","<=",">=","IS","IS NOT","AND","OR"].includes(op))return (op==="->"||op==="->>")?{kind:"call",name:op==="->"?"json_arrow":"json_arrow_sql",args:[expressionFromReduction(all[0]!),expressionFromReduction(all[1]!)]}:{kind:"binary",op,left:expressionFromReduction(all[0]!),right:expressionFromReduction(all[1]!)}
 }
 if(sig.startsWith("expr ::= CAST")){const at=t.findIndex(x=>x.text.toUpperCase()==="AS");return{kind:"cast",value:expressionFromReduction(all[0]!),affinity:affinityOf(t.slice(at+1,-1).map(x=>x.text).join(" "))}}
 if(sig==="expr ::= expr COLLATE ID|STRING"){const name=sqliteAsciiFold(t.at(-1)!.text);if(name!=="binary"&&name!=="nocase"&&name!=="rtrim")throw new JSQLiteError("sqlite",`no such collation sequence: ${t.at(-1)!.text}`,{code:1});return{kind:"collate",value:expressionFromReduction(all[0]!),collation:name};}
 if((sig.startsWith("expr ::= ID")||sig.startsWith("expr ::= nm"))&&!sig.includes(" LP"))return{kind:"column",index:-1,name:t.map(x=>x.text).join("")};
 // resolve.c function lookup selects unary min/max aggregate definitions by arity;
 // two-or-more arguments must continue through the scalar function registry.
 if(sig.startsWith("expr ::= ID|INDEXED|JOIN_KW LP")){const name=sqliteAsciiFold(t[0]!.text),parts=aggregateParts(n),args=sig.includes(" LP STAR RP")?[]:parts.args;const aggregate=aggregateDefinition(name);if(aggregate&&((name!=="min"&&name!=="max")||args.length===1)){const arities=aggregate.arities;if(!arities.includes(args.length))throw new JSQLiteError("sqlite",`wrong number of arguments to function ${name}()`,{code:1});if(parts.distinct&&args.length!==1)throw new JSQLiteError("sqlite","DISTINCT aggregates must have exactly one argument",{code:1});return{kind:"aggregate",name,args,collation:args[0]?collation(args[0]):"binary",distinct:parts.distinct,filter:parts.filter,orderBy:parts.orderBy};}const definition=resolveBuiltinFunction(name,args.length);if(parts.filter)throw new JSQLiteError("sqlite","FILTER may not be used with non-aggregate function",{code:1});return{kind:"call",name:definition.name,args}}
 if(sig.startsWith("expr ::= CASE")){const vals=all.map(expressionFromReduction),hasOperand=t[1]?.text.toUpperCase()!=="WHEN",hasElse=t.some(x=>x.text.toUpperCase()==="ELSE"),operand=hasOperand?vals.shift()!:null,otherwise=hasElse?vals.pop()!:null,pairs:[Expression,Expression][]=[];while(vals.length)pairs.push([vals.shift()!,vals.shift()!]);return{kind:"case",operand,pairs,otherwise}}
 throw new JSQLiteError("unsupported","SELECT expression is not implemented",{unsupportedClassification:"temporary"})
}

export function rejectUnimplementedAggregateSelect(select:SelectNode):void{
 const visit=(node:LemonValue<SqlToken>):boolean=>{
  if(node.kind!=="reduction")return false;
  if(node.signature.startsWith("expr ::= ID|INDEXED|JOIN_KW LP")){
   const token=exprLeaves(node)[0];
   if(token){const name=sqliteAsciiFold(token.text),count=descendantExprs(node).length;if(aggregateDefinition(name)!==undefined&&(!['min','max'].includes(name)||count===1))return true;}
  }
  return node.children.some(visit);
 };
 const expressions=[...select.result,...select.groupBy,...select.orderBy.map(term=>term.expr),...(select.where?[select.where]:[]),...(select.having?[select.having]:[])];
 if(expressions.some(expression=>expression.reduction?visit(expression.reduction):false))throw new JSQLiteError("unsupported","aggregate functions are not implemented",{unsupportedClassification:"temporary"});
}


/** resolve.c classifies aggregate calls from generated Expr structure. Identifiers
 * and aliases merely spelled like aggregate functions are not aggregate calls. */
export function selectHasAggregate(select:SelectNode):boolean {
 const visit=(node:LemonValue<SqlToken>):boolean=>{
  if(node.kind!=="reduction")return false;
  if(node.signature==="expr ::= LP select RP")return false;
  if(node.signature.startsWith("expr ::= ID|INDEXED|JOIN_KW LP")){
   const token=exprLeaves(node)[0];
   if(token){const name=sqliteAsciiFold(token.text),count=descendantExprs(node).length;if(aggregateDefinition(name)!==undefined&&((name!=="min"&&name!=="max")||count===1))return true;}
  }
  return node.children.some(visit);
 };
 const expressions=[...select.result,...select.groupBy,...select.orderBy.map(term=>term.expr),...(select.where?[select.where]:[]),...(select.having?[select.having]:[])];
 return expressions.some(expression=>expression.reduction!==undefined&&visit(expression.reduction));
}


/** select.c's Select.pWin ownership is local to one SELECT. */
export function selectHasWindow(select:SelectNode):boolean {
 const visit=(node:LemonValue<SqlToken>):boolean=>{if(node.kind!=="reduction")return false;if(node.signature==="expr ::= LP select RP")return false;if(node.signature.startsWith("over_clause ::= OVER"))return true;return node.children.some(visit)};
 const expressions=[...select.result,...select.groupBy,...select.orderBy.map(term=>term.expr),...(select.where?[select.where]:[]),...(select.having?[select.having]:[])];return expressions.some(expression=>expression.reduction!==undefined&&visit(expression.reduction));
}

/** window.c:sqlite3WindowAttach rejects DISTINCT while attaching the OVER
 * clause, before source planning (including recursive-CTE planning). */
export function rejectDistinctWindowFunctions(select:SelectNode):void {
 const contains=(node:LemonValue<SqlToken>,prefix:string):boolean=>node.kind==="reduction"&&(node.signature.startsWith(prefix)||node.children.some(child=>contains(child,prefix)));
 const visit=(node:LemonValue<SqlToken>):void=>{
  if(node.kind!=="reduction"||node.signature==="expr ::= LP select RP")return;
  if(node.signature.startsWith("expr ::= ID|INDEXED|JOIN_KW LP")&&contains(node,"over_clause ::= OVER")&&contains(node,"distinct ::= DISTINCT"))throw new JSQLiteError("sqlite","DISTINCT is not supported for window functions",{code:1});
  node.children.forEach(visit);
 };
 const expressions=[...select.result,...select.groupBy,...select.orderBy.map(term=>term.expr),...(select.where?[select.where]:[]),...(select.having?[select.having]:[])];
 expressions.forEach(expression=>{if(expression.reduction)visit(expression.reduction)});
}

function nestedRecursiveReferenceCount(select:SelectNode,name:string):number {
 const visitReduction=(node:LemonValue<SqlToken>):number=>{
  if(node.kind!=="reduction")return 0;
  if(node.signature==="expr ::= LP select RP"||node.signature==="expr ::= EXISTS LP select RP"||node.signature==="expr ::= expr in_op LP select RP"){
   const nested=node.children.find(child=>child.kind==="reduction"&&child.signature.startsWith("select ::="));
   return nested?.kind==="reduction"&&nested.semantic?visitSelect(nested.semantic as SelectNode):0;
  }
  return node.children.reduce((sum,child)=>sum+visitReduction(child),0);
 };
 const visitSelect=(node:SelectNode):number=>node.arms.reduce((sum,arm)=>sum+arm.from.items.filter(item=>item.databaseName===null&&sqliteIdentifierEqual(item.tableName,name)).length+arm.result.reduce((n,expr)=>n+(expr.reduction?visitReduction(expr.reduction):0),0)+(arm.where?.reduction?visitReduction(arm.where.reduction):0),0);
 return select.arms.reduce((sum,arm)=>sum+arm.result.reduce((n,expr)=>n+(expr.reduction?visitReduction(expr.reduction):0),0)+(arm.where?.reduction?visitReduction(arm.where.reduction):0),0);
}

function expressionName(expression: SelectNode["result"][number]): string {
  if (expression.alias !== undefined) return expression.alias;
  return expression.tokens.map((token, index) => {
    const spaces = index ? " ".repeat(Math.max(0, token.startByte - expression.tokens[index - 1]!.endByte)) : "";
    return spaces + token.text;
  }).join("");
}


function rejectUnsupportedSelectClauses(select: SelectNode, relational = false): void {
  if (select.hasGroupBy || select.hasHaving || (!relational && (select.hasDistinct || (select.hasOrderBy && !select.hasCompound))))
    throw new JSQLiteError("unsupported", "this SELECT clause is not implemented", { unsupportedClassification: "temporary" });
}

function compileExpressionTree(expression:Expression,ops:Op[],allocate:()=>number,parameters?:ParameterBuilder,compileSubquery?:(expression:SubqueryExpression)=>number,predicateContext=false):number {
  const emit=(e:Expression):number=>compileExpressionTree(e,ops,allocate,parameters,compileSubquery,predicateContext);
  if(expression.kind==="register") { const r=allocate();ops.push({code:"Copy",p1:expression.index,p2:r});return r; }
  if(expression.kind==="variable") { if(!parameters)throw new JSQLiteError("internal","missing parameter builder");const spelling=expression.spelling;let index:number;if(spelling==="?")index=parameters.maximum+1;else if(spelling[0]==="?")index=Number(spelling.slice(1));else index=parameters.named.get(spelling)??parameters.maximum+1;if(!Number.isSafeInteger(index)||index<1||index>32766)throw new JSQLiteError("sqlite","variable number must be between ?1 and ?32766",{code:1});if(spelling!=="?"&&!parameters.named.has(spelling))parameters.named.set(spelling,index);while(parameters.names.length<index)parameters.names.push(null);if(spelling!=="?"&&parameters.names[index-1]===null)parameters.names[index-1]=spelling;parameters.maximum=Math.max(parameters.maximum,index);const r=allocate();ops.push({code:"Variable",p1:index,p2:r});return r; }
  if(expression.kind==="literal") { const r=allocate(),v=expression.value;if(v===null)ops.push({code:"Null",p2:r});else if(typeof v==="bigint")ops.push({code:"Integer",p1:v,p2:r});else if(typeof v==="number")ops.push({code:"Real",p1:v,p2:r});else if(typeof v==="string")ops.push({code:"String",p1:v,p2:r});else ops.push({code:"Blob",p1:v,p2:r});return r; }
  if(expression.kind==="scalar-subquery") {
    if(compileSubquery)return compileSubquery(expression);
    // expr.c:sqlite3CodeSubselect initializes SRT_Mem to NULL and replaces it
    // from only the first row. This initial route admits the finite no-FROM
    // producer; all source/correlation shapes remain atomic prepare failures.
    const select=expression.select;
    if(select.result.length!==1)throw new JSQLiteError("sqlite",`sub-select returns ${select.result.length} columns - expected 1`,{code:1});
    if(select.from.items.length||select.where||select.hasDistinct||select.hasGroupBy||select.hasHaving||select.hasOrderBy||select.hasCompound||select.hasValues||select.offset||select.hasLimit)
      throw new JSQLiteError("unsupported","this scalar subquery shape is not implemented",{unsupportedClassification:"temporary"});
    const result=allocate();ops.push({code:"Null",p2:result});
    const item=select.result[0]!;
    if(!item.reduction)throw new JSQLiteError("internal","generated scalar subquery result lost its expression");
    const value=emit(expressionFromReduction(item.reduction));
    ops.push({code:"Copy",p1:value,p2:result});
    return result;
  }
  if(expression.kind==="in-subquery") {
    if(compileSubquery)return compileSubquery(expression);
    throw new JSQLiteError("unsupported","this IN subquery shape is not implemented",{unsupportedClassification:"temporary"});
  }
  if(expression.kind==="in-list") {
    // sqlite3ExprCodeIN's INDEX_NOOP path compares from left to right.  Compile
    // the chain into registers so a hit jumps over later (possibly erroring)
    // RHS terms while misses retain SQL's false/NULL distinction.
    const left=emit(expression.left),result=allocate();
    if(expression.values.length===0)ops.push({code:"Integer",p1:0n,p2:result});
    else {
      const affinity=expressionAffinity(expression.left);
      for(let i=0;i<expression.values.length;i++){
        const value=expression.values[i]!,guard=i>0?ops.length:-1;
        if(i>0)ops.push({code:"ShortCircuit",kind:"or",p1:result,p2:result,jump:0});
        const right=emit(value),equal=i===0?result:allocate();
        ops.push({code:"Binary",op:"=",p1:left,p2:right,p3:equal,collation:binaryCollation(expression.left,value),...(affinity?{affinity}:{})});
        if(i>0){ops.push({code:"Boolean",kind:"or",p1:result,p2:equal,p3:result});(ops[guard] as {jump:number}).jump=ops.length;}
      }
    }
    if(!expression.negated)return result;
    const negated=allocate();ops.push({code:"Not",p1:result,p2:negated});return negated;
  }
  if(expression.kind==="column") { const r=allocate();if(expression.index<0)ops.push({code:"Rowid",p1:expression.cursor??0,p2:r});else {ops.push({code:"Column",p1:expression.index,p2:r,...(expression.cursor===undefined?{}:{p3:expression.cursor})});if(expression.affinity==="real")ops.push({code:"RealAffinity",p1:r});}return r; }
  if(expression.kind==="collate") { ops.push({code:"CollSeq",collation:expression.collation});return emit(expression.value); }
  if(expression.kind==="cast") { const a=emit(expression.value),r=allocate();ops.push({code:"Cast",p1:a,p2:r,affinity:expression.affinity});return r; }
  if(expression.kind==="unary") { if(expression.op==="-"&&expression.value.kind==="literal"&&typeof expression.value.value==="number"){const r=allocate();ops.push({code:"Real",p1:-expression.value.value,p2:r});return r}const a=emit(expression.value);if(expression.op==="+")return a;const r=allocate();if(expression.op==="-"){const z=allocate();ops.push({code:"Integer",p1:0n,p2:z},{code:"Subtract",p1:z,p2:a,p3:r})}else ops.push({code:expression.op==="~"?"BitNot":"Not",p1:a,p2:r});return r; }
  if(expression.kind==="binary") {
    const left=emit(expression.left);
    // expr.c sqlite3ExprIfTrue/sqlite3ExprIfFalse can omit the RHS when a
    // literal left operand decides AND/OR during code generation. Projection
    // comparisons are otherwise evaluated eagerly (unlike predicate context).
    const literalDecides=expression.left.kind==="literal"&&typeof expression.left.value==="bigint"&&((expression.op==="AND"&&expression.left.value===0n)||(expression.op==="OR"&&expression.left.value!==0n));
    if((expression.op==="AND"||expression.op==="OR")&&(predicateContext||literalDecides)) { const r=allocate(),guard=ops.length;ops.push({code:"ShortCircuit",kind:expression.op.toLowerCase() as "and"|"or",p1:left,p2:r,jump:0});const right=emit(expression.right);ops.push({code:"Boolean",kind:expression.op.toLowerCase() as "and"|"or",p1:left,p2:right,p3:r});(ops[guard] as {jump:number}).jump=ops.length;return r; }
    const right=emit(expression.right),r=allocate(),affinity=expressionAffinity(expression.left)??expressionAffinity(expression.right);ops.push({code:"Binary",op:expression.op,p1:left,p2:right,p3:r,collation:binaryCollation(expression.left,expression.right),...(affinity?{affinity}:{})});return r;
  }
  if(expression.kind==="call") {
    if(expression.name==="coalesce"||expression.name==="ifnull") { const r=allocate(),jumps:number[]=[];for(const arg of expression.args){const a=emit(arg);const at=ops.length;ops.push({code:"NotNull",p1:a,p2:r,jump:0});jumps.push(at)}ops.push({code:"Null",p2:r});for(const at of jumps)(ops[at] as {jump:number}).jump=ops.length;return r; }
    if(expression.name==="iif"||expression.name==="if") {const r=allocate(),ends:number[]=[];let i=0;for(;i+1<expression.args.length;i+=2){const condition=emit(expression.args[i]!),skip=ops.length;ops.push({code:"IfNot",p1:condition,p2:0});const value=emit(expression.args[i+1]!);ops.push({code:"Copy",p1:value,p2:r});ends.push(ops.length);ops.push({code:"Goto",p2:0});(ops[skip] as {p2:number}).p2=ops.length}if(i<expression.args.length){const value=emit(expression.args[i]!);ops.push({code:"Copy",p1:value,p2:r})}else ops.push({code:"Null",p2:r});for(const end of ends)(ops[end] as {p2:number}).p2=ops.length;return r;}
    const args=expression.args.map(emit),r=allocate(),coll=expression.args.map(collation).find((_,i)=>expression.args[i]!.kind==="collate")??"binary";if(coll!=="binary")ops.push({code:"CollSeq",collation:coll});ops.push({code:"Function",name:expression.name,args,p2:r,collation:coll});return r;
  }
  if(expression.kind==="mem"||expression.kind==="aggregate")throw new JSQLiteError("internal","execution-only expression reached scalar lowering");
  const result=allocate(),endJumps:number[]=[],base=expression.operand?emit(expression.operand):null;
  for(const [when,then] of expression.pairs){const w=emit(when),test=base===null?w:(()=>{const r=allocate();ops.push({code:"Binary",op:"=",p1:base,p2:w,p3:r,collation:collation(expression.operand!)});return r})(),skip=ops.length;ops.push({code:"IfNot",p1:test,p2:0});const value=emit(then);ops.push({code:"Copy",p1:value,p2:result});endJumps.push(ops.length);ops.push({code:"Goto",p2:0});(ops[skip] as {p2:number}).p2=ops.length;}
  if(expression.otherwise){const value=emit(expression.otherwise);ops.push({code:"Copy",p1:value,p2:result})}else ops.push({code:"Null",p2:result});for(const at of endJumps)(ops[at] as {p2:number}).p2=ops.length;return result;
}

function compileExpression(expression: SelectNode["result"][number], ops: Op[], allocate: () => number, parameters: ParameterBuilder, compileSubquery?:(expression:SubqueryExpression)=>number): { register: number; name: string } {
  const tokens = expression.tokens;
  if (expression.reduction) { const register=compileExpressionTree(expressionFromReduction(expression.reduction),ops,allocate,parameters,compileSubquery); return {register,name:expressionName(expression)}; }
  let at = 0;
  const unary: string[] = [];
  while (at < tokens.length && (["+", "-", "~"].includes(tokens[at]!.text) || tokens[at]!.text.toUpperCase() === "NOT")) unary.push(tokens[at++]!.text.toUpperCase());
  const literal = tokens[at];
  if (!literal || at + 1 !== tokens.length) throw new JSQLiteError("unsupported", "SELECT expression is not implemented", { unsupportedClassification: "temporary" });
  let register = allocate();
  if (literal.kind === "integer") {
    let value: bigint;
    try { value = BigInt(literal.text); } catch { throw new JSQLiteError("sqlite", "integer literal is out of range", { code: 1 }); }
    if (value < -(1n << 63n) || value > (1n << 63n) - 1n) throw new JSQLiteError("sqlite", "integer literal is out of range", { code: 1 });
    ops.push({ code: "Integer", p1: value, p2: register });
  } else if (literal.kind === "variable") {
    if (unary.length) throw new JSQLiteError("unsupported", "unary parameter expression is not implemented", { unsupportedClassification: "temporary" });
    const spelling = literal.text;
    let index: number;
    if (spelling === "?") index = parameters.maximum + 1;
    else if (spelling[0] === "?") {
      if (!/^\?[0-9]+$/.test(spelling)) throw new JSQLiteError("sqlite", "variable number must be between ?1 and ?32766", { code: 1 });
      index = Number(spelling.slice(1));
      if (!Number.isSafeInteger(index) || index < 1 || index > 32766) throw new JSQLiteError("sqlite", "variable number must be between ?1 and ?32766", { code: 1 });
    } else {
      const known = parameters.named.get(spelling);
      index = known ?? parameters.maximum + 1;
      if (known === undefined) parameters.named.set(spelling, index);
    }
    if (index > 32766) throw new JSQLiteError("sqlite", "too many SQL variables", { code: 1 });
    while (parameters.names.length < index) parameters.names.push(null);
    if (spelling !== "?" && parameters.names[index - 1] === null) parameters.names[index - 1] = spelling;
    parameters.maximum = Math.max(parameters.maximum, index);
    ops.push({ code: "Variable", p1: index, p2: register });
  } else throw new JSQLiteError("unsupported", "SELECT expression is not implemented", { unsupportedClassification: "temporary" });
  for (let i = unary.length - 1; i >= 0; i--) {
    const operator = unary[i]!;
    if (operator === "+") continue;
    const output = allocate();
    if (operator === "-") {
      const zero = allocate();
      ops.push({ code: "Integer", p1: 0n, p2: zero }, { code: "Subtract", p1: zero, p2: register, p3: output });
    } else ops.push({ code: operator === "~" ? "BitNot" : "Not", p1: register, p2: output });
    register = output;
  }
  return { register, name: expressionName(expression) };
}

interface LimitRegisters { count:number; offset?:number; combined:number; capacity:number; ifZero:number }
function computeLimitRegisters(select:SelectNode,ops:Op[],allocate:()=>number,parameters:ParameterBuilder,compoundZeroBeforeOffset=false):LimitRegisters|undefined {
 if(!select.limit)return undefined;
 const count=compileExpressionTree(expressionFromReduction(select.limit.reduction!),ops,allocate,parameters);
 ops.push({code:"MustBeInt",p1:count});
 const earlyZero=compoundZeroBeforeOffset?ops.length:-1;if(compoundZeroBeforeOffset)ops.push({code:"IfNot",p1:count,p2:0});
 let offset:number|undefined;
 if(select.offset){offset=compileExpressionTree(expressionFromReduction(select.offset.reduction!),ops,allocate,parameters);ops.push({code:"MustBeInt",p1:offset});}
 const combined=allocate();if(offset===undefined){ops.push({code:"Copy",p1:count,p2:combined});}else ops.push({code:"OffsetLimit",p1:count,p2:combined,p3:offset});
 const capacity=allocate();ops.push({code:"Copy",p1:combined,p2:capacity});
 const ifZero=compoundZeroBeforeOffset?earlyZero:ops.length;if(!compoundZeroBeforeOffset)ops.push({code:"IfNot",p1:count,p2:0});
 return {count,...(offset===undefined?{}:{offset}),combined,capacity,ifZero};
}

export function compileRecursiveCteSelect(select:SelectNode,encoding:DatabaseEncoding,maxWorkUnits=10_000_000,maxResultBytes=1_000_000_000,privateStateLimits:PrivateStateLimits=DEFAULT_PRIVATE_STATE_LIMITS,maxRows=Number.MAX_SAFE_INTEGER,producerOnly=false):Program{
 const owner=select.with?.ctes.find(cte=>cte.select.arms.some(arm=>arm.from.items.some(item=>item.databaseName===null&&sqliteIdentifierEqual(item.tableName,cte.name))));
 if(!owner)throw new JSQLiteError("unsupported","recursive common table expressions are not implemented",{unsupportedClassification:"temporary"});
 const body=owner.select,arms=body.arms,width=arms[0]?.result.length??0;
 if(owner.columns&&owner.columns.length!==width)throw new JSQLiteError("sqlite",`table ${owner.name} has ${width} values for ${owner.columns.length} columns`,{code:1});
 const isReference=(arm:typeof arms[number])=>arm.from.items.some(item=>item.databaseName===null&&sqliteIdentifierEqual(item.tableName,owner.name));
 const firstRecursive=arms.findIndex(isReference);
 if(firstRecursive===0)throw new JSQLiteError("sqlite",`circular reference: ${owner.name}`,{code:1});
 if(!body.hasCompound||firstRecursive<1||!width||arms.some(arm=>arm.result.length!==width))throw new JSQLiteError("unsupported","this recursive common table expression shape is not implemented",{unsupportedClassification:"temporary"});
 const recursiveArms=arms.slice(firstRecursive),distinct=recursiveArms[0]!.operatorFromPrior==="union";
 const nestedUses=nestedRecursiveReferenceCount(body,owner.name);
 if(nestedUses){const directUses=recursiveArms.reduce((count,arm)=>count+arm.from.items.filter(item=>item.databaseName===null&&sqliteIdentifierEqual(item.tableName,owner.name)).length,0);throw new JSQLiteError("sqlite",`${directUses>0?"multiple recursive references":"recursive reference in a subquery"}: ${owner.name}`,{code:1});}
 if(recursiveArms.some(arm=>(arm.operatorFromPrior!=="union"&&arm.operatorFromPrior!=="union-all")||(arm.operatorFromPrior==="union")!==distinct))throw new JSQLiteError("sqlite","recursive terms must be separated by UNION ALL or UNION",{code:1});
 for(const recursive of recursiveArms){
  const recursiveSelect={...body,result:recursive.result,from:recursive.from,where:recursive.where,hasDistinct:recursive.hasDistinct,hasGroupBy:recursive.hasGroupBy,hasHaving:recursive.hasHaving,arms:Object.freeze([recursive]),hasCompound:false};
  if(selectHasWindow(recursiveSelect))throw new JSQLiteError("sqlite","cannot use window functions in recursive queries",{code:1});
  if(selectHasAggregate(recursiveSelect))throw new JSQLiteError("sqlite","recursive aggregate queries not supported",{code:1});
  const references=recursive.from.items.filter(item=>item.databaseName===null&&sqliteIdentifierEqual(item.tableName,owner.name));
  if(references.length>1)throw new JSQLiteError("sqlite",`multiple references to recursive table: ${owner.name}`,{code:1});
  if(references.length!==1||recursive.from.items.length!==1||recursive.hasGroupBy||recursive.hasHaving||recursive.hasDistinct)throw new JSQLiteError("unsupported","this recursive common table expression shape is not implemented",{unsupportedClassification:"temporary"});
 }
 const outerRecursiveIndex=select.from.items.findIndex(item=>item.databaseName===null&&sqliteIdentifierEqual(item.tableName,owner.name));
 const joinedDerived=select.from.items.length===2&&outerRecursiveIndex===0&&select.from.derived?.index===1&&!select.from.derived.select.from.items.length&&!select.from.derived.select.where&&!select.from.derived.select.hasCompound&&!select.from.derived.select.hasGroupBy&&!select.from.derived.select.hasHaving&&!select.from.derived.select.hasDistinct&&!select.from.derived.select.limit&&!select.from.derived.select.offset;
 if(!producerOnly&&(((select.from.items.length!==1||outerRecursiveIndex!==0)&&!joinedDerived)||select.where||select.hasCompound||select.hasGroupBy||select.hasHaving||select.hasDistinct||select.hasOrderBy||select.limit||select.offset))throw new JSQLiteError("unsupported","this recursive common table expression consumer is not implemented",{unsupportedClassification:"temporary"});
 const names=owner.columns??arms[0]!.result.map(expressionName);const lookup=(name:string)=>names.findIndex(candidate=>sqliteIdentifierEqual(candidate,sqlName(name.split(".").at(-1)!)));
 const bind=(tree:Expression,current:number):Expression=>{if(tree.kind==="column"){const index=lookup(tree.name);if(index<0)throw new JSQLiteError("sqlite",`no such column: ${tree.name}`,{code:1});return{kind:"register",index:current+index}}if(tree.kind==="unary"||tree.kind==="cast"||tree.kind==="collate")return{...tree,value:bind(tree.value,current)};if(tree.kind==="binary")return{...tree,left:bind(tree.left,current),right:bind(tree.right,current)};if(tree.kind==="call")return{...tree,args:tree.args.map(value=>bind(value,current))};if(tree.kind==="case")return{...tree,operand:tree.operand?bind(tree.operand,current):null,pairs:tree.pairs.map(([a,b])=>[bind(a,current),bind(b,current)]),otherwise:tree.otherwise?bind(tree.otherwise,current):null};return tree};
 const ops:Op[]=[],parameters:ParameterBuilder={maximum:0,names:[],named:new Map()};let maximum=0;const allocate=()=>++maximum,queue=1,history=2;
 const limit=computeLimitRegisters(body,ops,allocate,parameters);
 const order=body.orderBy.map(term=>{if(!term.expr.reduction)throw new JSQLiteError("internal","recursive ORDER BY lost expression");const tree=expressionFromReduction(term.expr.reduction);let index=-1;if(tree.kind==="literal"&&typeof tree.value==="bigint"&&tree.value>=1n&&tree.value<=BigInt(width))index=Number(tree.value)-1;else if(tree.kind==="column")index=lookup(tree.name);if(index<0)throw new JSQLiteError("sqlite","1st ORDER BY term does not match any column in the result set",{code:1});return{index,collation:collation(expressionFromReduction(arms[0]!.result[index]!.reduction!)),desc:term.descending,nullsLarge:term.nulls==="last"?!term.descending:term.nulls==="first"?term.descending:false};});
 if(order.length)ops.push({code:"OpenPriorityQueue",p1:queue,keyInfo:new KeyInfo({encoding,totalFieldCount:order.length,keyFieldCount:order.length,terms:order})});else ops.push({code:"OpenFifo",p1:queue});
 if(distinct)ops.push({code:"OpenEphemeral",p1:history,keyInfo:new KeyInfo({encoding,totalFieldCount:width,keyFieldCount:width,terms:arms[0]!.result.map(expression=>({collation:collation(expressionFromReduction(expression.reduction!))}))})});
 const enqueue=(start:number)=>{let found:number|undefined;if(distinct){found=ops.length;ops.push({code:"Found",p1:history,keyStart:start,keyCount:width,jump:0},{code:"IdxInsert",p1:history,keyStart:start,keyCount:width});}if(order.length){const key=allocate();maximum+=order.length-1;order.forEach((term,index)=>ops.push({code:"Copy",p1:start+term.index,p2:key+index}));ops.push({code:"PriorityInsert",p1:queue,keyStart:key,keyCount:order.length,payloadStart:start,payloadCount:width});}else ops.push({code:"FifoInsert",p1:queue,keyStart:start,keyCount:width});if(found!==undefined)(ops[found] as {jump:number}).jump=ops.length;};
 for(const arm of arms.slice(0,firstRecursive)){
  if(arm.from.items.length)throw new JSQLiteError("unsupported","this recursive common table expression setup is not implemented",{unsupportedClassification:"temporary"});
  const seedRows=arm.origin==="values"?arm.valuesRows!:[arm.result];for(const row of seedRows){const values=row.map(expression=>compileExpression(expression,ops,allocate,parameters)),start=allocate();values.forEach((value,index)=>ops.push({code:"Copy",p1:value.register,p2:start+index}));maximum+=width-1;enqueue(start);}
 }
 let joinedStart:number|undefined,joinedNames:readonly string[]=[];
 if(joinedDerived){const derived=select.from.derived!.select;joinedNames=derived.result.map(expression=>expression.alias??expressionName(expression));joinedStart=allocate();maximum+=derived.result.length-1;derived.result.forEach((expression,index)=>{const value=compileExpression(expression,ops,allocate,parameters);ops.push({code:"Copy",p1:value.register,p2:joinedStart!+index});});}
 const current=allocate();maximum+=width-1;const loop=ops.length;ops.push(order.length?{code:"PriorityShift",p1:queue,p2:current,count:width,emptyJump:0}:{code:"FifoShift",p1:queue,p2:current,count:width,emptyJump:0});
 let offsetSkip:number|undefined;if(limit?.offset!==undefined){offsetSkip=ops.length;ops.push({code:"IfPos",p1:limit.offset,p2:0,p3:1});}
 const bindOutput=(tree:Expression):Expression=>{if(tree.kind==="column"){const parts=tree.name.split(".").map(sqlName),qualifier=parts.length>1?parts.at(-2):undefined,name=parts.at(-1)!;if(joinedDerived&&qualifier&&sqliteIdentifierEqual(qualifier,select.from.items[1]!.alias??select.from.items[1]!.tableName)){const index=joinedNames.findIndex(candidate=>sqliteIdentifierEqual(candidate,name));if(index<0)throw new JSQLiteError("sqlite",`no such column: ${tree.name}`,{code:1});return{kind:"register",index:joinedStart!+index};}return bind(tree,current);}if(tree.kind==="unary"||tree.kind==="cast"||tree.kind==="collate")return{...tree,value:bindOutput(tree.value)};if(tree.kind==="binary")return{...tree,left:bindOutput(tree.left),right:bindOutput(tree.right)};if(tree.kind==="call")return{...tree,args:tree.args.map(bindOutput)};if(tree.kind==="case")return{...tree,operand:tree.operand?bindOutput(tree.operand):null,pairs:tree.pairs.map(([a,b])=>[bindOutput(a),bindOutput(b)]),otherwise:tree.otherwise?bindOutput(tree.otherwise):null};return tree};
 let consumerSkip:number|undefined;if(joinedDerived&&select.from.items[1]!.on?.reduction){const predicate=compileExpressionTree(bindOutput(expressionFromReduction(select.from.items[1]!.on!.reduction!)),ops,allocate,parameters);consumerSkip=ops.length;ops.push({code:"IfNot",p1:predicate,p2:0});}
 const output=allocate(),outputWidth=producerOnly?width:select.result.length;maximum+=outputWidth-1;if(producerOnly){for(let index=0;index<width;index++)ops.push({code:"Copy",p1:current+index,p2:output+index});}else select.result.forEach((expression,index)=>{if(!expression.reduction)throw new JSQLiteError("internal","recursive result lost expression");const value=compileExpressionTree(bindOutput(expressionFromReduction(expression.reduction)),ops,allocate,parameters);ops.push({code:"Copy",p1:value,p2:output+index});});ops.push({code:"ResultRow",p1:output,p2:outputWidth});
 let limitBreak:number|undefined;if(limit){limitBreak=ops.length;ops.push({code:"DecrJumpZero",p1:limit.count,p2:0});}
 const recursiveStart=ops.length;if(offsetSkip!==undefined)(ops[offsetSkip] as {p2:number}).p2=recursiveStart;if(consumerSkip!==undefined)(ops[consumerSkip] as {p2:number}).p2=recursiveStart;
 for(const recursive of recursiveArms){
  let skip:number|undefined;if(recursive.where?.reduction){const predicate=compileExpressionTree(bind(expressionFromReduction(recursive.where.reduction),current),ops,allocate,parameters);skip=ops.length;ops.push({code:"IfNot",p1:predicate,p2:0});}
  const next=allocate();maximum+=width-1;recursive.result.forEach((expression,index)=>{if(!expression.reduction)throw new JSQLiteError("internal","recursive term lost expression");const value=compileExpressionTree(bind(expressionFromReduction(expression.reduction),current),ops,allocate,parameters);ops.push({code:"Copy",p1:value,p2:next+index});});enqueue(next);if(skip!==undefined)(ops[skip] as {p2:number}).p2=ops.length;
 }
 ops.push({code:"Goto",p2:loop});const halt=ops.length;ops.push({code:"Halt"});(ops[loop] as {emptyJump:number}).emptyJump=halt;if(limit){(ops[limit.ifZero] as {p2:number}).p2=halt;if(limitBreak!==undefined)(ops[limitBreak] as {p2:number}).p2=halt;}
 return Object.freeze({ops:Object.freeze(ops),registers:maximum,columns:Object.freeze(producerOnly?names.map(name=>Object.freeze({name,declaredType:null,database:null,table:null,origin:null})):select.result.map((expression,index)=>Object.freeze({name:expression.alias??names[index]??expressionName(expression),declaredType:null,database:null,table:null,origin:null}))),parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,encoding});
}


/** select.c recursive SRT_Queue producer feeding window.c's coroutine consumer. */
export function compileRecursiveWindowSelect(select:SelectNode,schema:SchemaGraph,database:BtreeDatabase,maxRows=Number.MAX_SAFE_INTEGER,maxWorkUnits=10_000_000,maxResultBytes=1_000_000_000,privateStateLimits:PrivateStateLimits=DEFAULT_PRIVATE_STATE_LIMITS):Program|undefined {
 const owner=select.with?.ctes.find(cte=>cte.select.arms.some(arm=>arm.from.items.some(item=>item.databaseName===null&&sqliteIdentifierEqual(item.tableName,cte.name))));
 if(!owner||!selectHasWindow(select))return undefined;
 const producer=compileRecursiveCteSelect(select,database.encoding,maxWorkUnits,maxResultBytes,privateStateLimits,maxRows,true),names=producer.columns.map(column=>column.name);
 const columns=names.map(name=>Object.freeze({name,declaredType:null,affinity:"blob" as const,defaultExpr:null,generatedExpr:null,defaultIndex:null,notNull:false,primaryKeyPosition:null,unique:false,collation:null,generatedStorage:null,checks:Object.freeze([])}));
 const table:TableNode=Object.freeze({kind:"table",name:owner.name,tableName:owner.name,rootPage:0,sql:"",columns:Object.freeze(columns),indexes:[],withoutRowid:false,primaryKey:Object.freeze([]),storageKey:Object.freeze([]),checks:Object.freeze([]),foreignKeys:Object.freeze([]),referencedBy:Object.freeze([])});
 const transient=schema.withTransientTable(table);let expanded:ReturnType<typeof expandAndResolveSelect>;
 try{expanded=expandAndResolveSelect(select,transient)}catch(error){if(error instanceof NameResolutionError)throw new JSQLiteError("sqlite",error.message,{code:1});throw error;}
 const compilation=compileWindowSelectLowering(expanded,database.encoding,database,maxWorkUnits,maxResultBytes,privateStateLimits,transient,producer);
 return Object.freeze({...compilation.program,database,maxRows});
}

/** Compose multiple bounded recursive producers by redirecting each iterative
 * queue's output into a VDBE sorter, then draining the materializations with an
 * ordinary nested loop. No recursive host-language evaluation is introduced. */
export function compileMultipleRecursiveCtes(select:SelectNode,encoding:DatabaseEncoding,maxWorkUnits=10_000_000,maxResultBytes=1_000_000_000,privateStateLimits:PrivateStateLimits=DEFAULT_PRIVATE_STATE_LIMITS,maxRows=Number.MAX_SAFE_INTEGER):Program|undefined {
 const owners=(select.with?.ctes??[]).filter(cte=>cte.select.arms.some(arm=>arm.from.items.some(item=>item.databaseName===null&&sqliteIdentifierEqual(item.tableName,cte.name))));
 if(owners.length<2||select.from.items.length!==owners.length||select.where||select.hasCompound||select.hasGroupBy||select.hasHaving||select.hasDistinct||select.limit||select.offset)return undefined;
 const sourceOwners=select.from.items.map(item=>owners.find(owner=>item.databaseName===null&&sqliteIdentifierEqual(item.tableName,owner.name)));
 if(sourceOwners.some(owner=>!owner)||new Set(sourceOwners).size!==owners.length)return undefined;
 const names=sourceOwners.map(owner=>owner!.columns??owner!.select.arms[0]!.result.map(expressionName));
 const locateColumn=(tree:Expression):{source:number,column:number}|null=>{if(tree.kind!=="column")return null;const parts=tree.name.split('.').map(sqlName),name=parts.at(-1)!,qualifier=parts.length>1?parts.at(-2):undefined,matches:{source:number,column:number}[]=[];for(let source=0;source<sourceOwners.length;source++){const item=select.from.items[source]!,owner=sourceOwners[source]!;if(qualifier&&!sqliteIdentifierEqual(qualifier,item.alias??owner.name))continue;const column=names[source]!.findIndex(candidate=>sqliteIdentifierEqual(candidate,name));if(column>=0)matches.push({source,column});}return matches.length===1?matches[0]!:null;};
 const locate=(expression:SelectNode["result"][number])=>expression.reduction?locateColumn(expressionFromReduction(expression.reduction)):null;
 const locations=select.result.map(locate);if(locations.some(location=>!location))return undefined;
 // Keep this first composition seam exact: every producer column is projected
 // once. Expression consumers remain on the ordinary compiler backlog.
 for(let source=0;source<names.length;source++)for(let column=0;column<names[source]!.length;column++)if(!locations.some(location=>location?.source===source&&location.column===column))return undefined;
 const children=sourceOwners.map((owner,source)=>{const item=select.from.items[source]!,from=Object.freeze(Object.assign([...select.from.tokens],{items:Object.freeze([item]),tokens:select.from.tokens})) as typeof select.from,result=Object.freeze(names[source]!.map((_name,column)=>select.result[locations.findIndex(location=>location?.source===source&&location.column===column)]!)),arm=Object.freeze({...select.arms[0]!,result,from,where:null,hasDistinct:false,hasGroupBy:false,hasHaving:false,operatorFromPrior:null,prior:null,next:null});const child=Object.freeze({...select,result,from,where:null,groupBy:Object.freeze([]),having:null,orderBy:Object.freeze([]),limit:null,offset:null,hasDistinct:false,hasGroupBy:false,hasHaving:false,hasOrderBy:false,hasLimit:false,hasCompound:false,with:Object.freeze({recursive:true,ctes:Object.freeze([owner!])}),arms:Object.freeze([arm])});return compileRecursiveCteSelect(child,encoding,maxWorkUnits,maxResultBytes,privateStateLimits,maxRows);});
 if(children.some(child=>child.parameters.length))return undefined;
 const ops:Op[]=[],sorters:number[]=[];let registers=0,cursorOffset=0;
 const relocate=(original:Op,reg:number,cursor:number,pc:number):Op=>{const op={...original} as any;if(['Integer','Real','String','Blob','Null','Variable'].includes(op.code))op.p2+=reg;else if(op.code==='Copy'){op.p1+=reg;op.p2+=reg}else if(['Binary','Subtract'].includes(op.code)){op.p1+=reg;op.p2+=reg;op.p3+=reg}else if(['Cast','BitNot','Not'].includes(op.code)){op.p1+=reg;op.p2+=reg}else if(op.code==='IfNot'){op.p1+=reg;op.p2+=pc}else if(['IfPos','DecrJumpZero'].includes(op.code)){op.p1+=reg;op.p2+=pc}else if(op.code==='Goto')op.p2+=pc;else if(['OpenFifo','OpenPriorityQueue','OpenEphemeral'].includes(op.code))op.p1+=cursor;else if(['FifoInsert','Found','IdxInsert'].includes(op.code)){op.p1+=cursor;op.keyStart+=reg;if('jump'in op)op.jump+=pc}else if(op.code==='PriorityInsert'){op.p1+=cursor;op.keyStart+=reg;op.payloadStart+=reg}else if(['FifoShift','PriorityShift'].includes(op.code)){op.p1+=cursor;op.p2+=reg;op.emptyJump+=pc}else throw new JSQLiteError('internal',`unrelocatable recursive opcode: ${op.code}`);return op as Op;};
 // Materialization preserves producer queue order; it does not compare row values.
 for(const child of children){const reg=registers,cursor=cursorOffset,sorter=cursor+10;sorters.push(sorter);ops.push({code:'SorterOpen',p1:sorter,keyInfo:new KeyInfo({encoding,totalFieldCount:0,keyFieldCount:0,terms:[]})});const pc=ops.length,end:number[]=[];for(const original of child.ops){if(original.code==='ResultRow'){ops.push({code:'SorterInsert',p1:sorter,keyStart:original.p1+reg,keyCount:0,payload:original.p1+reg,payloadCount:original.p2});continue}if(original.code==='Halt'){end.push(ops.length);ops.push({code:'Goto',p2:0});continue}ops.push(relocate(original,reg,cursor,pc));}for(const at of end)(ops[at] as {p2:number}).p2=ops.length;registers+=child.registers;cursorOffset+=20;}
 const rowBases=children.map(child=>{const base=++registers;registers+=child.columns.length-1;return base}),rewinds:number[]=[],starts:number[]=[];
 let finalSorter:number|undefined,orderIndexes:readonly number[]=[];
 if(select.orderBy.length){
  const terms=select.orderBy.map(term=>{if(!term.expr.reduction)throw new JSQLiteError('internal','recursive consumer ORDER BY lost expression');const tree=expressionFromReduction(term.expr.reduction),identity=tree.kind==='collate'?tree.value:tree,location=locateColumn(identity);if(!location)throw new JSQLiteError('unsupported','this recursive common table expression consumer ORDER BY is not implemented',{unsupportedClassification:'temporary'});const resultIndex=locations.findIndex(candidate=>candidate?.source===location.source&&candidate.column===location.column);if(resultIndex<0)throw new JSQLiteError('sqlite','ORDER BY term does not match any column in the result set',{code:1});return{resultIndex,collation:explicitCollation(tree)??'binary',desc:term.descending,nullsLarge:term.nulls==='last'?!term.descending:term.nulls==='first'?term.descending:false}});
  orderIndexes=terms.map(term=>term.resultIndex);finalSorter=cursorOffset+10;ops.push({code:'SorterOpen',p1:finalSorter,keyInfo:new KeyInfo({encoding,totalFieldCount:terms.length,keyFieldCount:terms.length,terms})});
 }
 for(let source=0;source<children.length;source++){rewinds[source]=ops.length;ops.push({code:'SorterSort',p1:sorters[source]!,emptyJump:0});starts[source]=ops.length;ops.push({code:'SorterData',p1:sorters[source]!,p2:rowBases[source]!,count:children[source]!.columns.length});}
 const output=++registers;registers+=select.result.length-1;locations.forEach((location,index)=>ops.push({code:'Copy',p1:rowBases[location!.source]!+location!.column,p2:output+index}));
 if(finalSorter!==undefined){const key=++registers;registers+=orderIndexes.length-1;orderIndexes.forEach((resultIndex,index)=>ops.push({code:'Copy',p1:output+resultIndex,p2:key+index}));ops.push({code:'SorterInsert',p1:finalSorter,keyStart:key,keyCount:orderIndexes.length,payload:output,payloadCount:select.result.length});}else ops.push({code:'ResultRow',p1:output,p2:select.result.length});
 const next:number[]=[];for(let source=children.length-1;source>=0;source--){next[source]=ops.length;ops.push({code:'SorterNext',p1:sorters[source]!,p2:starts[source]!});(ops[rewinds[source]!] as {emptyJump:number}).emptyJump=source===0?ops.length:next[source-1]!;}
 if(finalSorter!==undefined){const sort=ops.length;ops.push({code:'SorterSort',p1:finalSorter,emptyJump:0},{code:'SorterData',p1:finalSorter,p2:output,count:select.result.length},{code:'ResultRow',p1:output,p2:select.result.length},{code:'SorterNext',p1:finalSorter,p2:sort+1});(ops[sort] as {emptyJump:number}).emptyJump=ops.length;}
 ops.push({code:'Halt'});return Object.freeze({ops:Object.freeze(ops),registers,columns:Object.freeze(select.result.map(expression=>Object.freeze({name:expression.alias??expressionName(expression),declaredType:null,database:null,table:null,origin:null}))),parameters:Object.freeze([]),maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,encoding});
}

export function compileScalarSelect(select: SelectNode, encoding: DatabaseEncoding, maxWorkUnits = 10_000_000, maxResultBytes = 1_000_000_000, privateStateLimits:PrivateStateLimits=DEFAULT_PRIVATE_STATE_LIMITS, schema?:SchemaGraph, database?:BtreeDatabase, maxRows=Number.MAX_SAFE_INTEGER): Program {
  // select.c applies sqlite3WindowRewrite to every SELECT after name/function
  // resolution, including a SELECT without a FROM clause. Public prepare passes
  // the schema here, so resolve before scalar lowering can misclassify the owner.
  if(selectHasWindow(select)){
    if(!schema)throw new JSQLiteError("unsupported","window functions are not implemented",{unsupportedClassification:"temporary"});
    let expanded:ReturnType<typeof expandAndResolveSelect>;
    try{expanded=expandAndResolveSelect(select,schema)}
    catch(error){if(error instanceof NameResolutionError)throw new JSQLiteError("sqlite",error.message,{code:1});throw error;}
    const compilation=compileWindowSelectLowering(expanded,encoding,database,maxWorkUnits,maxResultBytes,privateStateLimits,schema);
    // Publish only a completely represented result list. This is the same
    // atomic gate used by table-backed window lowering.
    if(compilation.program.columns.length===expanded.result.length&&expanded.result.length>0)
      return Object.freeze({...compilation.program,...(database?{database}:{}),maxRows});
    throw new JSQLiteError("unsupported","window functions are not implemented",{unsupportedClassification:"temporary"});
  }
  rejectUnsupportedSelectClauses(select);
  if(select.hasCompound){
    // select.c:multiSelect's unordered UNION ALL route emits each arm to one
    // SRT_Output destination while sharing the compound LIMIT/OFFSET registers.
    // Other operators/orderings remain atomic prepare-time unsupported until the
    // coroutine merge route is complete.
    const operators=select.arms.slice(1).map(arm=>arm.operatorFromPrior);
    const orderedAll=select.hasOrderBy&&operators.every(op=>op==="union-all");
    const distinctSet=operators.some(op=>op!=="union-all")&&operators.every(op=>op==="union-all"||op==="union"||op==="intersect"||op==="except");
    const lastSetArm=operators.reduce((last,operator,index)=>operator==="union-all"?last:index+1,-1);
    if((select.hasOrderBy&&!distinctSet&&!orderedAll)||(!distinctSet&&!orderedAll&&operators.some(op=>op!=="union-all"))||select.arms.some(arm=>arm.from.items.length||arm.where!==null||arm.hasDistinct||arm.hasGroupBy||arm.hasHaving))
      throw new JSQLiteError("unsupported","ordered and mixed set compound SELECTs are not implemented",{unsupportedClassification:"temporary"});
    const width=select.arms[0]?.result.length??0;
    if(!width||select.arms.some(arm=>arm.result.length!==width||(arm.origin==="values"&&arm.valuesRows!.some(row=>row.length!==width)))){const mismatch=select.arms.find(arm=>arm.result.length!==width||(arm.origin==="values"&&arm.valuesRows!.some(row=>row.length!==width))),word=mismatch?.operatorFromPrior==="union-all"?"UNION ALL":mismatch?.operatorFromPrior?.toUpperCase()??"UNION";throw new JSQLiteError("sqlite",`SELECTs to the left and right of ${word} do not have the same number of result columns`,{code:1});}
    // select.c:multiSelectCollSeq chooses the first non-BINARY (non-null
    // CollSeq in native terms) result collation scanning arms left-to-right.
    // Resolve expression metadata once; KeyInfo, not SQL spelling, owns compare.
    const resultCollations=Array.from({length:width},(_,column)=>{
      for(const arm of select.arms){const expression=arm.result[column];if(!expression?.reduction)continue;const named=explicitCollation(expressionFromReduction(expression.reduction));if(named)return named;}
      return "binary" as BuiltinCollation;
    });
    const ops:Op[]=[],parameters:ParameterBuilder={maximum:0,names:[],named:new Map()};let maximum=0;const allocate=()=>++maximum;
    const compoundLimit=computeLimitRegisters(select,ops,allocate,parameters,true);
    if(orderedAll){
      // For these finite scalar/VALUES producers, materializing into the existing
      // typed sorter is the documented browser adaptation of multiSelectByMerge.
      // Preserve resolveCompoundOrderBy's complete key: every term resolves to
      // one result column, and the sorter payload remains the complete row.
      const resolvedOrder=select.orderBy.map((term,termIndex)=>{
        const tree=expressionFromReduction(term.expr.reduction!),matchTree=tree.kind==="collate"?tree.value:tree;let resultIndex=-1;
        if(matchTree.kind==="literal"&&typeof matchTree.value==="bigint"){
          if(matchTree.value<1n||matchTree.value>BigInt(width))throw new JSQLiteError("sqlite",`${termIndex+1}${termIndex===0?"st":termIndex===1?"nd":termIndex===2?"rd":"th"} ORDER BY term out of range - should be between 1 and ${width}`,{code:1});
          resultIndex=Number(matchTree.value-1n);
        }else if(matchTree.kind==="column"&&!matchTree.name.includes(".")){
          const name=sqlName(matchTree.name);
          for(const arm of select.arms){const at=arm.result.findIndex(result=>result.alias!==undefined&&result.alias!==null&&sqliteIdentifierEqual(result.alias,name));if(at>=0){resultIndex=at;break;}}
        }
        if(resultIndex<0){for(const arm of select.arms){const at=arm.result.findIndex(result=>result.reduction!==undefined&&result.reduction!==null&&compoundOrderExpressionEqual(matchTree,expressionFromReduction(result.reduction)));if(at>=0){resultIndex=at;break;}}}
        if(resultIndex<0)throw new JSQLiteError("sqlite",`${termIndex+1}${termIndex===0?"st":termIndex===1?"nd":termIndex===2?"rd":"th"} ORDER BY term does not match any column in the result set`,{code:1});
        const nullsLarge=term.nulls==="last"?!term.descending:term.nulls==="first"?term.descending:false;
        return {resultIndex,collation:explicitCollation(tree)??resultCollations[resultIndex]!,desc:term.descending,nullsLarge};
      });
      const cursor=1,keyInfo=new KeyInfo({encoding,totalFieldCount:resolvedOrder.length,keyFieldCount:resolvedOrder.length,terms:resolvedOrder.map(term=>({collation:term.collation,desc:term.desc,nullsLarge:term.nullsLarge}))});ops.push({code:"SorterOpen",p1:cursor,keyInfo});
      let scalarCursor=1000;
      // select.c's SRT_Mem destination is emitted directly into this compound
      // program. Avoid relocating a completed child control graph: scalar
      // early-exit and sorter labels are fixed only after their destination is
      // known, while work/private-state ownership remains with this VDBE.
      const compileOrderedScalarSubquery=(expression:SubqueryExpression):number=>{
        const nested=expression.select,item=nested.result[0];if(expression.kind==='in-subquery'||expression.exists||!schema||!database||nested.result.length!==1||!item?.reduction||nested.from.items.length!==1||nested.hasDistinct||nested.hasGroupBy||nested.hasHaving||nested.hasCompound||nested.hasValues||nested.limit||nested.offset)throw new JSQLiteError('unsupported','this scalar subquery shape is not implemented',{unsupportedClassification:'temporary'});
        const sourceName=sqlName(nested.from.items[0]!.tableName),table=schema.tables.get(sqliteAsciiFold(sourceName));if(!table)throw new JSQLiteError('sqlite',`no such table: ${sourceName}`,{code:1});const sourceCursor=scalarCursor++,sorter=nested.hasOrderBy?scalarCursor++:-1;
        const bind=(node:Expression):Expression=>{if(node.kind==='column'){const parts=node.name.split('.').map(sqlName),name=parts.at(-1)!;if(parts.length>1&&!sqliteIdentifierEqual(parts.at(-2)!,nested.from.items[0]!.alias??table.name))throw new JSQLiteError('sqlite',`no such column: ${node.name}`,{code:1});const index=table.columns.findIndex(column=>sqliteIdentifierEqual(column.name,name));if(index<0)throw new JSQLiteError('sqlite',`no such column: ${node.name}`,{code:1});node.cursor=sourceCursor;node.index=isIntegerPrimaryKeyAlias(table,index)?-1:index;node.affinity=node.index<0?'integer':affinityOf(table.columns[index]!.declaredType??'');const named=node.index<0?'binary':sqliteAsciiFold(table.columns[index]!.collation??'binary');if(named!=='binary'&&named!=='nocase'&&named!=='rtrim')throw new JSQLiteError('sqlite',`no such collation sequence: ${named}`,{code:1});node.collation=named;return node;}if(node.kind==='unary'||node.kind==='cast'||node.kind==='collate')node.value=bind(node.value);else if(node.kind==='binary'){node.left=bind(node.left);node.right=bind(node.right)}else if(node.kind==='call')node.args=node.args.map(bind);else if(node.kind==='case'){if(node.operand)node.operand=bind(node.operand);node.pairs=node.pairs.map(([a,b])=>[bind(a),bind(b)]);if(node.otherwise)node.otherwise=bind(node.otherwise)}return node};
        const result=allocate(),valueTree=bind(expressionFromReduction(item.reduction)),orderTerms=nested.orderBy.map(term=>{const tree=bind(expressionFromReduction(term.expr.reduction!));return{tree,desc:term.descending,nullsLarge:term.nulls==='last'?!term.descending:term.nulls==='first'?term.descending:false}});ops.push({code:'OpenRead',p1:table.rootPage,p2:sourceCursor},{code:'Null',p2:result});if(sorter>=0)ops.push({code:'SorterOpen',p1:sorter,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:orderTerms.length,keyFieldCount:orderTerms.length,terms:orderTerms.map(term=>({collation:collation(term.tree),desc:term.desc,nullsLarge:term.nullsLarge}))})});const rewind=ops.length;ops.push({code:'Rewind',p1:sourceCursor,p2:0});const loop=ops.length;let skip:number|undefined;if(nested.where?.reduction){const predicate=compileExpressionTree(bind(expressionFromReduction(nested.where.reduction)),ops,allocate,parameters,compileOrderedScalarSubquery);skip=ops.length;ops.push({code:'IfNot',p1:predicate,p2:0});}let done:number|undefined;if(sorter>=0){const key=allocate();maximum+=orderTerms.length-1;orderTerms.forEach((term,index)=>{const register=compileExpressionTree(term.tree,ops,allocate,parameters,compileOrderedScalarSubquery);ops.push({code:'Copy',p1:register,p2:key+index})});const value=compileExpressionTree(valueTree,ops,allocate,parameters,compileOrderedScalarSubquery),payload=allocate();ops.push({code:'Copy',p1:value,p2:payload},{code:'SorterInsert',p1:sorter,keyStart:key,keyCount:orderTerms.length,payload,payloadCount:1});}else{const value=compileExpressionTree(valueTree,ops,allocate,parameters,compileOrderedScalarSubquery);ops.push({code:'Copy',p1:value,p2:result});done=ops.length;ops.push({code:'Goto',p2:0});}const next=ops.length;ops.push({code:'Next',p1:sourceCursor,p2:loop});const finish=ops.length;(ops[rewind] as {p2:number}).p2=finish;if(skip!==undefined)(ops[skip] as {p2:number}).p2=next;if(done!==undefined)(ops[done] as {p2:number}).p2=finish;if(sorter>=0){const sort=ops.length;ops.push({code:'SorterSort',p1:sorter,emptyJump:0},{code:'SorterData',p1:sorter,p2:result,count:1},{code:'ClearSorter',p1:sorter});(ops[sort] as {emptyJump:number}).emptyJump=ops.length-1;}return result;
      };
      for(const arm of select.arms)for(const expressions of arm.origin==="values"?arm.valuesRows!:[arm.result]){
        const values=expressions.map(expression=>compileExpression(expression,ops,allocate,parameters,compileOrderedScalarSubquery)),row=allocate();values.forEach((value,index)=>ops.push({code:"Copy",p1:value.register,p2:row+index}));maximum+=width-1;
        const key=allocate();resolvedOrder.forEach((term,index)=>ops.push({code:"Copy",p1:row+term.resultIndex,p2:key+index}));maximum+=resolvedOrder.length-1;
        ops.push({code:"SorterInsert",p1:cursor,keyStart:key,keyCount:resolvedOrder.length,payload:row,payloadCount:width,...(compoundLimit?{topN:compoundLimit.capacity}:{})});
      }
      const output=allocate();maximum+=width-1;const sortAt=ops.length;ops.push({code:"SorterSort",p1:cursor,emptyJump:0},{code:"SorterData",p1:cursor,p2:output,count:width});let skip:number|undefined;if(compoundLimit?.offset!==undefined){skip=ops.length;ops.push({code:"IfPos",p1:compoundLimit.offset,p2:0,p3:1});}ops.push({code:"ResultRow",p1:output,p2:width});let exhausted:number|undefined;if(compoundLimit){exhausted=ops.length;ops.push({code:"DecrJumpZero",p1:compoundLimit.count,p2:0});}const next=ops.length;ops.push({code:"SorterNext",p1:cursor,p2:sortAt+1});const halt=ops.length;ops.push({code:"Halt"});(ops[sortAt] as {emptyJump:number}).emptyJump=halt;if(skip!==undefined)(ops[skip] as {p2:number}).p2=next;if(exhausted!==undefined)(ops[exhausted] as {p2:number}).p2=halt;if(compoundLimit)(ops[compoundLimit.ifZero] as {p2:number}).p2=halt;
      const names=select.arms[0]!.result.map(expression=>expressionName(expression));return Object.freeze({ops:Object.freeze(ops),registers:maximum,maxWorkUnits,maxResultBytes,privateStateLimits,encoding,parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),columns:Object.freeze(names.map(name=>Object.freeze({name,declaredType:null,database:null,table:null,origin:null}))),...(database?{database,maxRows}: {})});
    }
    if(distinctSet){
      let orderDescending=false,orderNullsLarge=false,orderCollation: BuiltinCollation|undefined;
      if(select.hasOrderBy){
        if(select.orderBy.length!==1||width!==1)throw new JSQLiteError("unsupported","multi-column compound ORDER BY merge is not implemented",{unsupportedClassification:"temporary"});
        const term=select.orderBy[0]!,tree=expressionFromReduction(term.expr.reduction!),matchTree=tree.kind==="collate"?tree.value:tree;let matches=false;
        if(matchTree.kind==="literal"&&typeof matchTree.value==="bigint"){if(matchTree.value!==1n)throw new JSQLiteError("sqlite","1st ORDER BY term out of range - should be between 1 and 1",{code:1});matches=true;}
        else if(matchTree.kind==="column"&&!matchTree.name.includes(".")){const name=sqlName(matchTree.name);matches=select.arms.some(arm=>arm.result.some(result=>result.alias!==undefined&&result.alias!==null&&sqliteIdentifierEqual(result.alias,name)));}
        if(!matches){matches=select.arms.some(arm=>arm.result.some(result=>result.reduction!==undefined&&result.reduction!==null&&compoundOrderExpressionEqual(matchTree,expressionFromReduction(result.reduction))));}
        if(!matches)throw new JSQLiteError("sqlite","1st ORDER BY term does not match any column in the result set",{code:1});
        orderDescending=term.descending;orderNullsLarge=term.nulls==="last"?!term.descending:term.nulls==="first"?term.descending:false;orderCollation=explicitCollation(tree);
      }
      // multiSelect completes the set prefix in typed ephemeral state, then
      // redirects that state and every trailing UNION ALL arm to one shared
      // output/sorter destination. Duplicate and ORDER KeyInfo stay separate.
      const cursor=1,aux=2,keyInfo=new KeyInfo({encoding,totalFieldCount:width,keyFieldCount:width,terms:resultCollations.map(collation=>({collation,desc:false,nullsLarge:false}))});ops.push({code:"OpenEphemeral",p1:cursor,keyInfo},{code:"OpenEphemeral",p1:aux,keyInfo});
      for(let armIndex=0;armIndex<=lastSetArm;armIndex++){const arm=select.arms[armIndex]!,operator=arm.operatorFromPrior,rows=arm.origin==="values"?arm.valuesRows!:[arm.result];for(const expressions of rows){const values=expressions.map(expression=>compileExpression(expression,ops,allocate,parameters));const start=allocate();values.forEach((value,index)=>ops.push({code:"Copy",p1:value.register,p2:start+index}));maximum+=width-1;if(armIndex===0||operator==="union"||operator==="union-all")ops.push({code:"IdxInsert",p1:cursor,keyStart:start,keyCount:width,replace:true});else if(operator==="except")ops.push({code:"SetDelete",p1:cursor,keyStart:start,keyCount:width});else ops.push({code:"IdxInsert",p1:aux,keyStart:start,keyCount:width,replace:true});}if(operator==="intersect")ops.push({code:"SetRetainIntersection",p1:cursor,p2:aux},{code:"ClearEphemeral",p1:aux});}
      const output=allocate();maximum+=width-1;let sorter:number|undefined;
      if(select.hasOrderBy){sorter=3;const sortKey=new KeyInfo({encoding,totalFieldCount:1,keyFieldCount:1,terms:[{collation:orderCollation??resultCollations[0]!,desc:orderDescending,nullsLarge:orderNullsLarge}]});ops.push({code:"SorterOpen",p1:sorter,keyInfo:sortKey});}
      const haltJumps:number[]=[],emit=(start:number)=>{if(sorter!==undefined){ops.push({code:"SorterInsert",p1:sorter,keyStart:start,keyCount:1,payload:start,payloadCount:width,...(compoundLimit?{topN:compoundLimit.capacity}:{})});return undefined;}let skip:number|undefined;if(compoundLimit?.offset!==undefined){skip=ops.length;ops.push({code:"IfPos",p1:compoundLimit.offset,p2:0,p3:1});}ops.push({code:"ResultRow",p1:start,p2:width});if(compoundLimit){haltJumps.push(ops.length);ops.push({code:"DecrJumpZero",p1:compoundLimit.count,p2:0});}return skip;};
      ops.push({code:"EphemeralSort",p1:cursor});const rewind=ops.length;ops.push({code:"EphemeralRewind",p1:cursor,p2:0},{code:"EphemeralData",p1:cursor,p2:output,count:width});const drainSkip=emit(output),drainNext=ops.length;ops.push({code:"EphemeralNext",p1:cursor,p2:rewind+1});(ops[rewind] as {p2:number}).p2=ops.length;if(drainSkip!==undefined)(ops[drainSkip] as {p2:number}).p2=drainNext;
      for(let armIndex=lastSetArm+1;armIndex<select.arms.length;armIndex++)for(const expressions of select.arms[armIndex]!.origin==="values"?select.arms[armIndex]!.valuesRows!:[select.arms[armIndex]!.result]){const values=expressions.map(expression=>compileExpression(expression,ops,allocate,parameters)),start=allocate();values.forEach((value,index)=>ops.push({code:"Copy",p1:value.register,p2:start+index}));maximum+=width-1;const skip=emit(start);if(skip!==undefined)(ops[skip] as {p2:number}).p2=ops.length;}
      if(sorter!==undefined){const sortAt=ops.length;ops.push({code:"SorterSort",p1:sorter,emptyJump:0},{code:"SorterData",p1:sorter,p2:output,count:width});let skip:number|undefined;if(compoundLimit?.offset!==undefined){skip=ops.length;ops.push({code:"IfPos",p1:compoundLimit.offset,p2:0,p3:1});}ops.push({code:"ResultRow",p1:output,p2:width});if(compoundLimit){haltJumps.push(ops.length);ops.push({code:"DecrJumpZero",p1:compoundLimit.count,p2:0});}const next=ops.length;ops.push({code:"SorterNext",p1:sorter,p2:sortAt+1});(ops[sortAt] as {emptyJump:number}).emptyJump=ops.length;if(skip!==undefined)(ops[skip] as {p2:number}).p2=next;}
      const halt=ops.length;ops.push({code:"Halt"});for(const at of haltJumps)(ops[at] as {p2:number}).p2=halt;if(compoundLimit)(ops[compoundLimit.ifZero] as {p2:number}).p2=halt;
      const names=select.arms[0]!.result.map(expression=>expressionName(expression));return Object.freeze({ops:Object.freeze(ops),registers:maximum,maxWorkUnits,maxResultBytes,privateStateLimits,encoding,parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),columns:Object.freeze(names.map(name=>Object.freeze({name,declaredType:null,database:null,table:null,origin:null})))});
    }
    const limit=compoundLimit,haltJumps:number[]=[];
    for(const arm of select.arms)for(const expressions of arm.origin==="values"?arm.valuesRows!:[arm.result]){
      const values=expressions.map(expression=>compileExpression(expression,ops,allocate,parameters));
      const start=allocate();values.forEach((value,index)=>ops.push({code:"Copy",p1:value.register,p2:start+index}));maximum+=width-1;
      if(limit?.offset!==undefined){const skip=ops.length;ops.push({code:"IfPos",p1:limit.offset,p2:0,p3:1});ops.push({code:"ResultRow",p1:start,p2:width});(ops[skip] as {p2:number}).p2=ops.length+(limit?1:0);}else ops.push({code:"ResultRow",p1:start,p2:width});
      if(limit){haltJumps.push(ops.length);ops.push({code:"DecrJumpZero",p1:limit.count,p2:0});}
    }
    const halt=ops.length;ops.push({code:"Halt"});if(limit){(ops[limit.ifZero] as {p2:number}).p2=halt;for(const at of haltJumps)(ops[at] as {p2:number}).p2=halt;}
    const names=select.arms[0]!.result.map(expression=>expressionName(expression));
    return Object.freeze({ops:Object.freeze(ops),registers:maximum,maxWorkUnits,maxResultBytes,privateStateLimits,encoding,parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),columns:Object.freeze(names.map(name=>Object.freeze({name,declaredType:null,database:null,table:null,origin:null})))});
  }
  if (select.hasValues) {
    const arm=select.arms[0],rows=arm?.valuesRows;
    if(!rows?.length||!rows[0]?.length)throw new JSQLiteError("sqlite","VALUES must have at least one column",{code:1});
    const width=rows[0].length;
    if(rows.some(row=>row.length!==width))throw new JSQLiteError("sqlite","all VALUES must have the same number of terms",{code:1});
    const ops:Op[]=[],parameters:ParameterBuilder={maximum:0,names:[],named:new Map()};let maximum=0;const allocate=()=>++maximum;
    for(const row of rows){
      const evaluated=row.map(expression=>compileExpression(expression,ops,allocate,parameters));
      const start=allocate();evaluated.forEach((value,index)=>ops.push({code:"Copy",p1:value.register,p2:start+index}));maximum+=width-1;
      ops.push({code:"ResultRow",p1:start,p2:width});
    }
    ops.push({code:"Halt"});
    return Object.freeze({ops:Object.freeze(ops),registers:maximum,maxWorkUnits,maxResultBytes,privateStateLimits,encoding,parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),columns:Object.freeze(rows[0].map((_,index)=>Object.freeze({name:`column${index+1}`,declaredType:null,database:null,table:null,origin:null})))});
  }
  if (select.from.items.length || select.where !== null) throw new JSQLiteError("unsupported", "table SELECT compilation is not implemented", { unsupportedClassification: "temporary" });
  if (!select.result.length) throw new JSQLiteError("sqlite", "SELECT has no result columns", { code: 1 });
  const ops: Op[] = [];
  const resultOps: Op[] = [];
  let maximum = 0;
  const allocate = () => ++maximum;
  const parameters: ParameterBuilder = { maximum: 0, names: [], named: new Map() };
  let subqueryCursor=1000;
  const subqueryColumns=new Map<SelectNode,Program["columns"][number]>();
  const compileSubquery=(expression:SubqueryExpression):number=>{
    if(expression.select.result.length!==1)throw new JSQLiteError("sqlite",`sub-select returns ${expression.select.result.length} columns - expected 1`,{code:1});
    if(!expression.select.from.items.length){
      const nested=expression.select,item=nested.result[0]!;
      if(nested.where||nested.hasDistinct||nested.hasGroupBy||nested.hasHaving||nested.hasOrderBy||nested.hasCompound||nested.hasValues||nested.offset||nested.hasLimit||!item.reduction)
        throw new JSQLiteError("unsupported","this expression subquery shape is not implemented",{unsupportedClassification:"temporary"});
      const destination=allocate();
      // expr.c:sqlite3CodeSubselect initializes SRT_Mem before its one-row
      // producer. Lower into the parent Program to retain shared VM budgets.
      if(expression.kind==="in-subquery")throw new JSQLiteError("unsupported","this expression subquery shape is not implemented",{unsupportedClassification:"temporary"});
      resultOps.push(expression.exists?{code:"Integer",p1:0n,p2:destination}:{code:"Null",p2:destination});
      if(expression.exists)resultOps.push({code:"Integer",p1:1n,p2:destination});
      else {const value=compileExpressionTree(expressionFromReduction(item.reduction),resultOps,allocate,parameters,compileSubquery);resultOps.push({code:"Copy",p1:value,p2:destination});}
      return destination;
    }
    if(!schema||!database)throw new JSQLiteError("unsupported","this expression subquery shape is not implemented",{unsupportedClassification:"temporary"});
    if(expression.select.hasCompound||expression.select.hasValues)throw new JSQLiteError("unsupported","this expression subquery shape is not implemented",{unsupportedClassification:"temporary"});
    const child=compileTableSelect(expression.select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits);
    if(child.columns[0])subqueryColumns.set(expression.select,child.columns[0]);
    if(child.parameters.length)throw new JSQLiteError("unsupported","parameters in this expression subquery shape are not implemented",{unsupportedClassification:"temporary"});
    // A nested sqlite3Select shares the parent register array but receives a
    // disjoint range. Child Programs number from one, so relocate every Mem
    // operand before splicing their control graph into this Program.
    const registerOffset=maximum;maximum+=child.registers;
    const destination=allocate(),isIn=expression.kind==="in-subquery",cursor=isIn?subqueryCursor++:-1;
    if(isIn)resultOps.push({code:"OpenEphemeral",p1:cursor,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:1,keyFieldCount:1,terms:[{collation:collation(expression.left)}]})});
    else resultOps.push(expression.exists?{code:"Integer",p1:0n,p2:destination}:{code:"Null",p2:destination});
    const base=resultOps.length;
    const shifted=child.ops.map(original=>{
      const op={...original} as Op;
      const add=(field:'p1'|'p2'|'p3'|'keyStart')=>{const value=(op as unknown as Record<string,unknown>)[field];if(typeof value==='number')(op as unknown as Record<string,unknown>)[field]=value+registerOffset};
      if(['Integer','Real','String','Blob','Null','Variable','Column','Rowid','AggFinal','SorterData','EphemeralData'].includes(op.code))add('p2');
      else if(['Copy','Cast','Not','BitNot','MustBeInt','IfNotZero','IfPos','DecrJumpZero','NotNull'].includes(op.code)){add('p1');if(op.code==='Copy'||op.code==='Cast'||op.code==='Not'||op.code==='BitNot')add('p2')}
      else if(['Binary','Eq','Boolean','Subtract'].includes(op.code)){add('p1');add('p2');add('p3')}
      else if(['IfNot'].includes(op.code))add('p1');
      else if(['ResultRow'].includes(op.code))add('p1');
      else if(['IdxInsert','Found','SorterInsert'].includes(op.code))add('keyStart');
      else if(op.code==='Function'||op.code==='PureFunc'){const fn=op as Extract<Op,{code:'Function'|'PureFunc'}>;(fn as {args:readonly number[]}).args=fn.args.map((x:number)=>x+registerOffset);add('p2')}
      if('p2' in op&&['Goto','Rewind','IfNot','Next','DecrJumpZero','IfNotZero','IfPos','SorterNext','EphemeralRewind','EphemeralNext'].includes(op.code))(op as {p2:number}).p2+=base;
      if('jump' in op&&typeof op.jump==='number')(op as {jump:number}).jump+=base;
      if(op.code==='SorterSort')(op as {emptyJump:number}).emptyJump+=base;
      return op;
    });
    const resultAt=shifted.findIndex(op=>op.code==='ResultRow'),haltAt=shifted.findIndex(op=>op.code==='Halt'),end=base+shifted.length;
    if(resultAt<0||haltAt<0)throw new JSQLiteError("internal","expression SELECT producer has no row destination");
    const row=shifted[resultAt] as Extract<Op,{code:"ResultRow"}>;
    shifted[resultAt]=isIn?{code:"IdxInsert",p1:cursor,keyStart:row.p1,keyCount:1}:expression.exists?{code:"Integer",p1:1n,p2:destination}:{code:"Copy",p1:row.p1,p2:destination};
    if(!isIn&&resultAt+1<shifted.length)shifted[resultAt+1]={code:"Goto",p2:end};
    shifted[haltAt]={code:"Goto",p2:end};resultOps.push(...shifted);
    if(isIn){const left=compileExpressionTree(expression.left,resultOps,allocate,parameters,compileSubquery);resultOps.push({code:"InSet",p1:cursor,key:left,output:destination,affinity:affinityOf(child.columns[0]?.declaredType??""),negated:expression.negated});}
    maximum=Math.max(maximum,destination);return destination;
  };
  // Resolve/number result expressions in SQL source order, but retain their
  // opcodes until after computeLimitRegisters. SQLite computes LIMIT and
  // OFFSET before entering the result-production path, so LIMIT 0 skips even
  // failing or work-heavy result expressions while an invalid OFFSET still
  // fails before that zero-row jump.
  const expressions = select.result.map(expression => compileExpression(expression, resultOps, allocate, parameters, compileSubquery));
  const limit=computeLimitRegisters(select,ops,allocate,parameters);
  ops.push(...resultOps);
  const resultStart = allocate();
  expressions.forEach((expression, index) => ops.push({ code: "Copy", p1: expression.register, p2: resultStart + index }));
  maximum += expressions.length - 1;
  const offsetSkip=limit?.offset===undefined?undefined:ops.length;
  if(limit?.offset!==undefined)ops.push({code:"IfPos",p1:limit.offset,p2:0,p3:1});
  ops.push({ code: "ResultRow", p1: resultStart, p2: expressions.length });
  if(limit)ops.push({code:"DecrJumpZero",p1:limit.count,p2:ops.length+1});
  ops.push({ code: "Halt" });
  if(limit){const halt=ops.length-1;(ops[limit.ifZero] as {p2:number}).p2=halt;if(offsetSkip!==undefined)(ops[offsetSkip] as {p2:number}).p2=halt;}
  return Object.freeze({ ops: Object.freeze(ops), registers: maximum, maxWorkUnits, maxResultBytes, privateStateLimits, encoding, parameters: Object.freeze(parameters.names.map(name => Object.freeze({ name }))), columns: Object.freeze(expressions.map((expression,index) => { const node=select.result[index]?.reduction?expressionFromReduction(select.result[index]!.reduction!):null; const inner=node?.kind==="scalar-subquery"&&!node.exists?subqueryColumns.get(node.select):undefined; return Object.freeze({ name: expression.name, declaredType: inner?.declaredType??null, database: inner?.database??null, table: inner?.table??null, origin: inner?.origin??null }); })), ...(database?{database,maxRows}: {}) });
}

function compileInnerTableSelect(select:SelectNode,expanded:ReturnType<typeof expandAndResolveSelect>,database:BtreeDatabase,maxRows:number,maxWorkUnits:number,maxResultBytes:number,privateStateLimits:PrivateStateLimits):Program {
  if(expanded.sources.some((source,index)=>index>0&&source.joinFromLeft.error))throw new JSQLiteError("unsupported","invalid joins are not implemented",{unsupportedClassification:"temporary"});
  const rightLevels=expanded.sources.flatMap((source,index)=>index>0&&source.joinFromLeft.right?[index]:[]),rightLevel=rightLevels[0]??-1;
  // Pinned wherecode.c owns a WhereRightJoin per barrier. Until this compiler
  // carries that cardinality, reject repeated barriers atomically rather than
  // silently lowering only the first one.
  if(rightLevels.length>1)throw new JSQLiteError("unsupported","multiple RIGHT/FULL JOIN barriers are not implemented",{unsupportedClassification:"temporary"});
  for(const source of expanded.sources)if(source.table.withoutRowid||source.table.columns.some(column=>column.generatedExpr))throw new JSQLiteError("unsupported","this table storage shape is not implemented",{unsupportedClassification:"temporary"});
  const ops:Op[]=[],parameters:ParameterBuilder={maximum:0,names:[],named:new Map()};let registers=expanded.result.length;const allocate=()=>++registers;
  const resolveTree=(tree:Expression):Expression=>{const visit=(node:Expression):Expression=>{
    if(node.kind==="column") {const parts=node.name.split('.').map(sqlName),name=parts.at(-1)!;const candidates=expanded.sources.flatMap(source=>{if(parts.length>1&&!sqliteIdentifierEqual(parts.at(-2)!,source.alias??source.table.name))return [];const index=source.table.columns.findIndex(column=>sqliteIdentifierEqual(column.name,name));if(index>=0)return[{source,index}];if(!source.table.withoutRowid&&['rowid','_rowid_','oid'].some(alias=>sqliteIdentifierEqual(alias,name))&&!source.table.columns.some(column=>sqliteIdentifierEqual(column.name,name)))return[{source,index:-1}];return[];});if(candidates.length===0&&parts.length===1){const alias=select.result.find(result=>result.alias&&sqliteIdentifierEqual(result.alias,name));if(alias?.reduction)return visit(expressionFromReduction(alias.reduction));}if(candidates.length!==1)throw new JSQLiteError("internal",`resolved join column lost identity: ${node.name}`);const {source,index}=candidates[0]!;node.cursor=source.cursorId;if(index<0||isIntegerPrimaryKeyAlias(source.table,index)){node.index=-1;node.affinity='integer';node.collation='binary';return node;}node.index=index;const column=source.table.columns[index]!,c=sqliteAsciiFold(column.collation??'binary');if(c!=="binary"&&c!=="nocase"&&c!=="rtrim")throw new JSQLiteError("sqlite",`no such collation sequence: ${column.collation}`,{code:1});node.collation=c;node.affinity=affinityOf(column.declaredType??'');return node;}
    if(node.kind==="unary"||node.kind==="cast"||node.kind==="collate")node.value=visit(node.value);else if(node.kind==="binary"){node.left=visit(node.left);node.right=visit(node.right);}else if(node.kind==="call")node.args=node.args.map(visit);else if(node.kind==="case"){if(node.operand)node.operand=visit(node.operand);node.pairs=node.pairs.map(([a,b])=>[visit(a),visit(b)]);if(node.otherwise)node.otherwise=visit(node.otherwise);}return node;};return visit(tree);};
  const limit=computeLimitRegisters(select,ops,allocate,parameters);
  const orderTerms=select.orderBy.map((term,index)=>{let tree=expressionFromReduction(term.expr.reduction!),identity=tree;while(identity.kind==='collate')identity=identity.value;let resultIndex=-1;if(identity.kind==='literal'&&typeof identity.value==='bigint'){if(identity.value<1n||identity.value>BigInt(expanded.result.length)){const n=index+1,suffix=n%100>=11&&n%100<=13?'th':n%10===1?'st':n%10===2?'nd':n%10===3?'rd':'th';throw new JSQLiteError('sqlite',`${n}${suffix} ORDER BY term out of range - should be between 1 and ${expanded.result.length}`,{code:1});}resultIndex=Number(identity.value-1n);}else if(identity.kind==='column'&&!identity.name.includes('.'))resultIndex=expanded.result.findIndex(result=>sqliteIdentifierEqual(result.name,sqlName(identity.name)));return{tree:resultIndex<0?resolveTree(tree):tree,resultIndex,descending:term.descending,nullsLarge:term.nulls==='last'?!term.descending:term.nulls==='first'?term.descending:false};});
  const sorterCursor=expanded.sources.length,distinctCursor=sorterCursor+1,rightMatchCursor=distinctCursor+1;
  if(orderTerms.length)ops.push({code:'SorterOpen',p1:sorterCursor,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:orderTerms.length,keyFieldCount:orderTerms.length,terms:orderTerms.map(term=>({collation:term.resultIndex>=0?sqliteAsciiFold(expanded.result[term.resultIndex]!.descriptor.collation) as BuiltinCollation:collation(term.tree),desc:term.descending,nullsLarge:term.nullsLarge}))})});
  if(select.hasDistinct)ops.push({code:'OpenEphemeral',p1:distinctCursor,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:expanded.result.length,keyFieldCount:expanded.result.length,terms:expanded.result.map(result=>({collation:sqliteAsciiFold(result.descriptor.collation) as BuiltinCollation}))})});
  let rightKey:number|undefined;if(rightLevel>=0){rightKey=allocate();ops.push({code:'OpenEphemeral',p1:rightMatchCursor,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:1,keyFieldCount:1,terms:[{collation:'binary'}]})});}
  // expr.c:sqlite3CodeSubselect lowers into the caller's VDBE. The
  // bounded join route likewise emits a correlated aggregate in the joined-row
  // body, where it observes the current outer cursors.
  const nestedPlans=new Map<SelectNode,{plan:ReturnType<typeof expandAndResolveSelect>;cursor:number}>();let nestedCursor=1000;
  const rememberNested=(plan:ReturnType<typeof expandAndResolveSelect>):void=>{for(const child of plan.nested){nestedPlans.set(child.source,{plan:child,cursor:nestedCursor++});rememberNested(child);}};rememberNested(expanded);
  const compileJoinSubquery=(expression:SubqueryExpression):number=>{
    const entry=nestedPlans.get(expression.select),item=expression.select.result[0];
    if(!entry||entry.plan.sources.length!==1||!item?.reduction||expression.kind==='in-subquery'||expression.exists||expression.select.hasDistinct||expression.select.hasGroupBy||expression.select.hasHaving||expression.select.hasOrderBy||expression.select.hasCompound||expression.select.hasValues||expression.select.limit||expression.select.offset)throw new JSQLiteError('unsupported','this scalar subquery shape is not implemented',{unsupportedClassification:'temporary'});
    const source=entry.plan.sources[0]!,tree=expressionFromReduction(item.reduction);if(tree.kind!=='aggregate'||tree.distinct||tree.filter||tree.orderBy.length)throw new JSQLiteError('unsupported','this scalar subquery shape is not implemented',{unsupportedClassification:'temporary'});
    const bind=(node:Expression):Expression=>{if(node.kind==='column'){const parts=node.name.split('.').map(sqlName),name=parts.at(-1)!,qualified=parts.length>1?parts.at(-2):undefined,candidates=[{table:source.table,alias:source.alias,cursor:entry.cursor},...expanded.sources.map(outer=>({table:outer.table,alias:outer.alias,cursor:outer.cursorId}))].filter(candidate=>qualified===undefined||sqliteIdentifierEqual(qualified,candidate.alias??candidate.table.name)),allOwners=candidates.flatMap(candidate=>{const index=candidate.table.columns.findIndex(column=>sqliteIdentifierEqual(column.name,name));return index<0?[]:[{candidate,index}]}),owners=qualified===undefined&&allOwners[0]?.candidate.cursor===entry.cursor?[allOwners[0]]:allOwners;if(owners.length!==1)throw new JSQLiteError('internal',`resolved correlated column lost identity: ${node.name}`);const {candidate,index}=owners[0]!;node.cursor=candidate.cursor;node.index=isIntegerPrimaryKeyAlias(candidate.table,index)?-1:index;node.affinity=node.index<0?'integer':affinityOf(candidate.table.columns[index]!.declaredType??'');const named=node.index<0?'binary':sqliteAsciiFold(candidate.table.columns[index]!.collation??'binary');if(named!=='binary'&&named!=='nocase'&&named!=='rtrim')throw new JSQLiteError('sqlite',`no such collation sequence: ${named}`,{code:1});node.collation=named;return node;}if(node.kind==='unary'||node.kind==='cast'||node.kind==='collate')node.value=bind(node.value);else if(node.kind==='binary'){node.left=bind(node.left);node.right=bind(node.right)}else if(node.kind==='call'||node.kind==='aggregate')node.args=node.args.map(bind);else if(node.kind==='case'){if(node.operand)node.operand=bind(node.operand);node.pairs=node.pairs.map(([a,b])=>[bind(a),bind(b)]);if(node.otherwise)node.otherwise=bind(node.otherwise)}return node};
    const result=allocate(),once=entry.plan.correlated?undefined:allocate(),onceAt=once===undefined?-1:ops.length;if(once!==undefined)ops.push({code:'Once',p1:once,p2:0});ops.push({code:'Null',p2:result});const rewind=ops.length;ops.push({code:'Rewind',p1:entry.cursor,p2:0});const loop=ops.length;let skip:number|undefined;if(expression.select.where?.reduction){const predicate=compileExpressionTree(bind(expressionFromReduction(expression.select.where.reduction)),ops,allocate,parameters,compileJoinSubquery);skip=ops.length;ops.push({code:'IfNot',p1:predicate,p2:0});}const args=tree.args.map(arg=>compileExpressionTree(bind(arg),ops,allocate,parameters,compileJoinSubquery));ops.push({code:'AggStep',name:tree.name,args,p2:result,collation:tree.collation});const next=ops.length;ops.push({code:'Next',p1:entry.cursor,p2:loop});const finish=ops.length;(ops[rewind] as {p2:number}).p2=finish;if(skip!==undefined)(ops[skip] as {p2:number}).p2=next;ops.push({code:'AggFinal',name:tree.name,p1:result});if(onceAt>=0)(ops[onceAt] as {p2:number}).p2=ops.length;return result;
  };
  const compilePredicate=(expression:SelectNode['where'])=>{if(!expression?.reduction)return undefined;const value=compileExpressionTree(resolveTree(expressionFromReduction(expression.reduction)),ops,allocate,parameters,compileJoinSubquery),at=ops.length;ops.push({code:'IfNot',p1:value,p2:0});return at;};
  for(const {plan,cursor} of nestedPlans.values()){const source=plan.sources[0];if(source)ops.push({code:'OpenRead',p1:source.table.rootPage,p2:cursor});}
  expanded.sources.forEach(source=>ops.push({code:'OpenRead',p1:source.table.rootPage,p2:source.cursorId}));const rewinds:number[]=[],starts:number[]=[],bodies:number[]=[],leftMatches:(number|undefined)[]=[],jumps:{at:number;level:number}[]=[];
  for(let level=0;level<expanded.sources.length;level++){const source=expanded.sources[level]!,isLeft=level>0&&source.joinFromLeft.left;if(isLeft){leftMatches[level]=allocate();ops.push({code:'Integer',p1:0n,p2:leftMatches[level]!});}rewinds.push(ops.length);ops.push({code:'Rewind',p1:source.cursorId,p2:0});starts.push(ops.length);const on=compilePredicate(source.on);if(on!==undefined)jumps.push({at:on,level});if(source.using)for(const name of source.using){const right=source.table.columns.findIndex(column=>sqliteIdentifierEqual(column.name,name)),left=expanded.sources.slice(0,level).reverse().find(candidate=>candidate.table.columns.some(column=>sqliteIdentifierEqual(column.name,name)))!,leftIndex=left.table.columns.findIndex(column=>sqliteIdentifierEqual(column.name,name));const value=compileExpressionTree(resolveTree({kind:'binary',op:'=',left:{kind:'column',index:leftIndex,name:`${left.alias??left.table.name}.${name}`},right:{kind:'column',index:right,name:`${source.alias??source.table.name}.${name}`}}),ops,allocate,parameters),at=ops.length;ops.push({code:'IfNot',p1:value,p2:0});jumps.push({at,level});}if(isLeft)ops.push({code:'Integer',p1:1n,p2:leftMatches[level]!});if(level===rightLevel)ops.push({code:'Rowid',p1:source.cursorId,p2:rightKey!},{code:'IdxInsert',p1:rightMatchCursor,keyStart:rightKey!,keyCount:1});bodies[level]=ops.length;}
  const joinedBodyStart=ops.length;
  const where=compilePredicate(select.where);if(where!==undefined)jumps.push({at:where,level:expanded.sources.length-1});expanded.result.forEach((result,index)=>{if(result.resolution==='coalesce'){const refs=result.mergedSources!;const ends:number[]=[];for(const ref of refs){const value=allocate();if(ref.columnIndex<0)ops.push({code:'Rowid',p1:ref.source.cursorId,p2:value});else ops.push({code:'Column',p1:ref.columnIndex,p2:value,p3:ref.source.cursorId});const at=ops.length;ops.push({code:'NotNull',p1:value,p2:index+1,jump:0});ends.push(at);}ops.push({code:'Null',p2:index+1});for(const at of ends)(ops[at] as {jump:number}).jump=ops.length;}else if(result.source&&result.columnIndex!==null){if(result.columnIndex<0)ops.push({code:'Rowid',p1:result.source.cursorId,p2:index+1});else {const value=allocate();ops.push({code:'Column',p1:result.columnIndex,p2:value,p3:result.source.cursorId},{code:'Copy',p1:value,p2:index+1});}}else{if(!result.expression.reduction)throw new JSQLiteError('internal','resolved expression has no tree');const value=compileExpressionTree(resolveTree(expressionFromReduction(result.expression.reduction)),ops,allocate,parameters,compileJoinSubquery);ops.push({code:'Copy',p1:value,p2:index+1});}});
  let distinctAt:number|undefined;if(select.hasDistinct){distinctAt=ops.length;ops.push({code:'Found',p1:distinctCursor,keyStart:1,keyCount:expanded.result.length,jump:0},{code:'IdxInsert',p1:distinctCursor,keyStart:1,keyCount:expanded.result.length});}
  if(orderTerms.length){const keyStart=allocate();registers+=orderTerms.length-1;orderTerms.forEach((term,index)=>{if(term.resultIndex>=0)ops.push({code:'Copy',p1:term.resultIndex+1,p2:keyStart+index});else{const value=compileExpressionTree(term.tree,ops,allocate,parameters);ops.push({code:'Copy',p1:value,p2:keyStart+index});}});ops.push({code:'SorterInsert',p1:sorterCursor,keyStart,keyCount:orderTerms.length,payload:1,payloadCount:expanded.result.length,...(limit?{topN:limit.capacity}:{})});}
  else {let offsetAt:number|undefined;if(limit?.offset!==undefined){offsetAt=ops.length;ops.push({code:'IfPos',p1:limit.offset,p2:0,p3:1});}ops.push({code:'ResultRow',p1:1,p2:expanded.result.length});if(limit)ops.push({code:'DecrJumpZero',p1:limit.count,p2:0});if(offsetAt!==undefined)jumps.push({at:offsetAt,level:expanded.sources.length-1});}
  const joinedBodyEnd=ops.length;
  const nextAt:number[]=[],rewindEmpty:number[]=[];for(let level=expanded.sources.length-1;level>=0;level--){nextAt[level]=ops.length;ops.push({code:'Next',p1:expanded.sources[level]!.cursorId,p2:starts[level]!});const match=leftMatches[level];if(match!==undefined){rewindEmpty[level]=ops.length;const matched=ops.length;ops.push({code:'IfPos',p1:match,p2:0,p3:0},{code:'Integer',p1:1n,p2:match},{code:'NullRow',p1:expanded.sources[level]!.cursorId},{code:'Goto',p2:bodies[level]!});(ops[matched] as {p2:number}).p2=ops.length;}}const normalScanEnd=ops.length;
  if(rightLevel>=0){
    // Resolve sqlite3WhereEnd-style forward exits before cloning the shared
    // continuation. Copying their zero placeholders would restart at address
    // 0 when a downstream ON fails or its input is empty.
    for(let level=0;level<rewinds.length;level++)(ops[rewinds[level]!] as {p2:number}).p2=rewindEmpty[level]??(level===0?normalScanEnd:nextAt[level-1]!);
    if(distinctAt!==undefined)(ops[distinctAt] as {jump:number}).jump=nextAt.at(-1)!;
    for(const jump of jumps)(ops[jump.at] as {p2:number}).p2=nextAt[jump.level]!;
    // wherecode.c:sqlite3WhereRightJoinLoop scans the original RHS after the
    // source-order pass, NULLs every cursor left of the barrier, and invokes the
    // same interior continuation (including downstream joins and destinations).
    for(let level=0;level<rightLevel;level++)ops.push({code:'NullRow',p1:expanded.sources[level]!.cursorId});
    const rewind=ops.length;ops.push({code:'Rewind',p1:expanded.sources[rightLevel]!.cursorId,p2:0});
    const start=ops.length;ops.push({code:'Rowid',p1:expanded.sources[rightLevel]!.cursorId,p2:rightKey!});
    const found=ops.length;ops.push({code:'Found',p1:rightMatchCursor,keyStart:rightKey!,keyCount:1,jump:0});
    const continuationStart=bodies[rightLevel]!,continuationEnd=nextAt[rightLevel]!,copyStart=ops.length,delta=copyStart-continuationStart;
    const relocate=(target:number):number=>target>=continuationStart&&target<continuationEnd?target+delta:target===continuationEnd?-1:target;
    for(const original of ops.slice(continuationStart,continuationEnd)){
      const copy={...original} as Op;
      if(copy.code==='Rewind'||copy.code==='IfNot'||copy.code==='Goto'||copy.code==='Next'||copy.code==='IfPos'||(copy.code==='DecrJumpZero'&&copy.p2!==0)){
        const target=relocate(copy.p2);(copy as {p2:number}).p2=target;
      }else if(copy.code==='Found'){(copy as {jump:number}).jump=relocate(copy.jump);}
      else if(copy.code==='NotNull'){(copy as {jump:number}).jump=relocate(copy.jump);}
      ops.push(copy);
    }
    const unmatchedNext=ops.length;ops.push({code:'Next',p1:expanded.sources[rightLevel]!.cursorId,p2:start});
    const done=ops.length;(ops[rewind] as {p2:number}).p2=done;(ops[found] as {jump:number}).jump=unmatchedNext;
    for(let at=copyStart;at<unmatchedNext;at++){const op=ops[at]!;if((op.code==='Rewind'||op.code==='IfNot'||op.code==='Goto'||op.code==='Next'||op.code==='DecrJumpZero'||op.code==='IfPos')&&op.p2===-1)(op as {p2:number}).p2=unmatchedNext;else if((op.code==='Found'||op.code==='NotNull')&&op.jump===-1)(op as {jump:number}).jump=unmatchedNext;}
  }
  const scanEnd=ops.length;
  if(distinctAt!==undefined)(ops[distinctAt] as {jump:number}).jump=nextAt.at(-1)!;for(const jump of jumps)(ops[jump.at] as {p2:number}).p2=nextAt[jump.level]!;
  let halt:number;
  if(orderTerms.length){const sortAt=ops.length;ops.push({code:'SorterSort',p1:sorterCursor,emptyJump:0},{code:'SorterData',p1:sorterCursor,p2:1,count:expanded.result.length});let offsetAt:number|undefined;if(limit?.offset!==undefined){offsetAt=ops.length;ops.push({code:'IfPos',p1:limit.offset,p2:0,p3:1});}ops.push({code:'ResultRow',p1:1,p2:expanded.result.length});const limitAt=limit?ops.length:undefined;if(limit)ops.push({code:'DecrJumpZero',p1:limit.count,p2:0});const next=ops.length;ops.push({code:'SorterNext',p1:sorterCursor,p2:sortAt+1});halt=ops.length;ops.push({code:'Halt'});(ops[sortAt] as {emptyJump:number}).emptyJump=halt;if(offsetAt!==undefined)(ops[offsetAt] as {p2:number}).p2=next;if(limitAt!==undefined)(ops[limitAt] as {p2:number}).p2=halt;}else {halt=ops.length;ops.push({code:'Halt'});for(const op of ops)if(op.code==='DecrJumpZero'&&op.p2===0)(op as {p2:number}).p2=halt;}
  for(let level=0;level<rewinds.length;level++)(ops[rewinds[level]!] as {p2:number}).p2=rewindEmpty[level]??(level===0?normalScanEnd:nextAt[level-1]!);if(limit)(ops[limit.ifZero] as {p2:number}).p2=halt;
  const columns=expanded.result.map(result=>Object.freeze({name:result.name,declaredType:result.descriptor.declaredType,database:result.descriptor.database,table:result.descriptor.table,origin:result.descriptor.origin}));return Object.freeze({ops:Object.freeze(ops),registers,encoding:database.encoding,columns:Object.freeze(columns),parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits});
}

function sqlName(text: string): string {
  if (text[0] === "[" && text.at(-1) === "]") return text.slice(1, -1);
  if ((text[0] === '"' || text[0] === "`") && text.at(-1) === text[0]) return text.slice(1, -1).replaceAll(text[0] + text[0], text[0]);
  return text;
}

interface FullScanPlan { readonly loopStart: number; readonly rewindIndex: number }
/** Bounded first-plan translation seam for sqlite3WhereBegin/wherecode.c. */
function sqlite3WhereBegin(ops: Op[], rootPage: number): FullScanPlan {
  ops.push({code:"OpenRead",p1:rootPage}); const rewindIndex=ops.length;
  ops.push({code:"Rewind",p2:0}); return {loopStart:ops.length,rewindIndex};
}
function sqlite3WhereEnd(ops: Op[], plan: FullScanPlan, continueAt: number): void {
  const halt=ops.length+1; ops.push({code:"Next",p2:continueAt},{code:"Halt"});
  (ops[plan.rewindIndex] as {code:"Rewind";p2:number}).p2=halt;
}

function compileJoinedUnionAll(select:SelectNode,schema:SchemaGraph,database:BtreeDatabase,maxRows:number,maxWorkUnits:number,maxResultBytes:number,privateStateLimits:PrivateStateLimits):Program|undefined {
  const first=select.arms[0];if(!first||first.from.items.length<2||first.result.length!==1||select.arms.slice(1).some(arm=>arm.operatorFromPrior!=="union-all"||arm.from.items.length!==0||arm.where!==null||arm.result.length!==1)||select.orderBy.length!==1||select.limit||select.offset)return undefined;
  let identity=expressionFromReduction(select.orderBy[0]!.expr.reduction!);while(identity.kind==="collate")identity=identity.value;if(identity.kind!=="literal"||identity.value!==1n)return undefined;
  const leftSelect:SelectNode={...select,result:first.result,from:first.from,where:first.where,hasDistinct:first.hasDistinct,hasGroupBy:first.hasGroupBy,hasHaving:first.hasHaving,orderBy:Object.freeze([]),limit:null,offset:null,hasOrderBy:false,hasLimit:false,hasCompound:false,arms:Object.freeze([first])};
  let expanded:ReturnType<typeof expandAndResolveSelect>;try{expanded=expandAndResolveSelect(leftSelect,schema)}catch(error){if(error instanceof NameResolutionError)throw new JSQLiteError("sqlite",error.message,{code:1});throw error;}
  const producer=compileInnerTableSelect(leftSelect,expanded,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits),ops:Op[]=[],sorterCursor=Math.max(...expanded.sources.map(source=>source.cursorId))+3,descriptor=expanded.result[0]!.descriptor,coll=sqliteAsciiFold(descriptor.collation) as BuiltinCollation,term=select.orderBy[0]!;
  ops.push({code:"SorterOpen",p1:sorterCursor,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:1,keyFieldCount:1,terms:[{collation:coll,desc:term.descending,nullsLarge:term.nulls==="last"?!term.descending:term.nulls==="first"?term.descending:false}]})});
  const producerEnd:number[]=[];
  for(const original of producer.ops){let op:Op=original;if("p2" in op&&["Goto","Rewind","IfNot","Next","DecrJumpZero","IfNotZero","IfPos"].includes(op.code))op={...op,p2:op.p2+1} as Op;if("jump" in op&&typeof op.jump==="number")op={...op,jump:op.jump+1} as Op;if(op.code==="ResultRow")ops.push({code:"SorterInsert",p1:sorterCursor,keyStart:op.p1,keyCount:1,payload:op.p1,payloadCount:1});else if(op.code==="Halt"){producerEnd.push(ops.length);ops.push({code:"Goto",p2:0});}else ops.push(op);}
  for(const at of producerEnd)(ops[at] as {p2:number}).p2=ops.length;
  let registers=producer.registers;const allocate=()=>++registers,parameters:ParameterBuilder={maximum:producer.parameters.length,names:producer.parameters.map(parameter=>parameter.name),named:new Map(producer.parameters.flatMap((parameter,index)=>parameter.name?[[parameter.name,index+1] as const]:[]))};
  for(const arm of select.arms.slice(1)){const value=compileExpressionTree(expressionFromReduction(arm.result[0]!.reduction!),ops,allocate,parameters);ops.push({code:"SorterInsert",p1:sorterCursor,keyStart:value,keyCount:1,payload:value,payloadCount:1});}
  const output=allocate(),sortAt=ops.length;ops.push({code:"SorterSort",p1:sorterCursor,emptyJump:0},{code:"SorterData",p1:sorterCursor,p2:output,count:1},{code:"ResultRow",p1:output,p2:1},{code:"SorterNext",p1:sorterCursor,p2:sortAt+1});const halt=ops.length;ops.push({code:"Halt"});(ops[sortAt] as {emptyJump:number}).emptyJump=halt;
  return Object.freeze({ops:Object.freeze(ops),registers,encoding:database.encoding,columns:producer.columns,parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits});
}

function compileCteUnionAll(select:SelectNode,schema:SchemaGraph,database:BtreeDatabase,maxRows:number,maxWorkUnits:number,maxResultBytes:number,privateStateLimits:PrivateStateLimits):Program|undefined {
  if(!select.hasCompound||select.limit||select.offset||select.hasDistinct||select.arms.slice(1).some(arm=>arm.operatorFromPrior!=="union-all"))return undefined;
  const children=select.arms.map(arm=>{const single:SelectNode={...select,result:arm.result,from:arm.from,where:arm.where,hasDistinct:arm.hasDistinct,hasGroupBy:arm.hasGroupBy,hasHaving:arm.hasHaving,groupBy:Object.freeze([]),having:null,orderBy:Object.freeze([]),limit:null,offset:null,hasOrderBy:false,hasLimit:false,hasCompound:false,arms:Object.freeze([{...arm,operatorFromPrior:null,prior:null,next:null}])};return single.from.items.length||single.where?compileTableSelect(single,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits):compileScalarSelect(single,database.encoding,maxWorkUnits,maxResultBytes,privateStateLimits,schema,database,maxRows);});
  if(children.some(child=>child.parameters.length)||children.some(child=>child.columns.length!==children[0]!.columns.length))return undefined;
  const width=children[0]!.columns.length,orderIndexes=select.orderBy.map(term=>{let tree=expressionFromReduction(term.expr.reduction!);while(tree.kind==="collate")tree=tree.value;if(tree.kind!=="literal"||typeof tree.value!=="bigint"||tree.value<1n||tree.value>BigInt(width))return -1;return Number(tree.value)-1;});
  // This destination can feed a sorter directly only when its key prefix is the
  // complete compound row. Other compound ORDER BY layouts remain with the
  // existing compound lowering instead of receiving an incorrectly packed key.
  if(!select.orderBy.length||orderIndexes.length!==width||orderIndexes.some((value,index)=>value!==index))return undefined;
  const outerSorter=1,ops:Op[]=[{code:"SorterOpen",p1:outerSorter,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:width,keyFieldCount:width,terms:select.orderBy.map(term=>({collation:explicitCollation(expressionFromReduction(term.expr.reduction!))??"binary",desc:term.descending,nullsLarge:term.nulls==="last"?!term.descending:term.nulls==="first"?term.descending:false}))})}];
  let registers=0,nextCursor=10;
  for(const child of children){
    const base=ops.length,registerOffset=registers,cursorOffset=nextCursor,end:number[]=[];
    registers+=child.registers;nextCursor+=10;
    const reg=(value:number)=>value+registerOffset,csr=(value:number|undefined)=>value===undefined?undefined:value+cursorOffset,pc=(value:number)=>value+base;
    for(const original of child.ops){
      if(original.code==="Halt"){end.push(ops.length);ops.push({code:"Goto",p2:0});continue;}
      if(original.code==="ResultRow"){ops.push({code:"SorterInsert",p1:outerSorter,keyStart:reg(original.p1),keyCount:width,payload:reg(original.p1),payloadCount:width});continue;}
      const op:any={...original};
      switch(original.code){
        case"OpenEphemeral":case"SorterOpen":case"OpenFifo":case"OpenPriorityQueue":op.p1=csr(original.p1);break;
        case"OpenDup":op.p1=csr(original.p1);op.p2=csr(original.p2);break;
        case"OpenRead":op.p2=csr(original.p2);break;
        case"Rewind":case"Next":op.p1=csr(original.p1);op.p2=pc(original.p2);break;
        case"Column":op.p2=reg(original.p2);op.p3=csr(original.p3);break;
        case"Rowid":op.p1=csr(original.p1);op.p2=reg(original.p2);break;
        case"Integer":case"Real":case"String":case"Blob":case"Null":op.p2=reg(original.p2);break;
        case"Copy":case"Cast":case"Subtract":case"BitNot":case"Not":op.p1=reg(original.p1);op.p2=reg(original.p2);if("p3" in original)op.p3=reg(original.p3);break;
        case"Binary":case"Boolean":case"Eq":op.p1=reg(original.p1);op.p2=reg(original.p2);op.p3=reg(original.p3);break;
        case"Function":case"PureFunc":op.args=original.args.map(reg);op.p2=reg(original.p2);break;
        case"AggStep":op.args=original.args.map(reg);op.p2=reg(original.p2);if(original.changed!==undefined)op.changed=reg(original.changed);break;
        case"AggInverse":op.args=original.args.map(reg);op.p2=reg(original.p2);break;
        case"AggFinal":op.p1=reg(original.p1);break;
        case"AggValue":op.p1=reg(original.p1);op.p2=reg(original.p2);break;
        case"AggReset":op.registers=original.registers.map(reg);break;
        case"CompareGroup":op.left=reg(original.left);op.right=reg(original.right);op.jump=pc(original.jump);break;
        case"WindowRangeTest":op.candidate=reg(original.candidate);op.current=reg(original.current);if(original.offset!==undefined)op.offset=reg(original.offset);op.jump=pc(original.jump);break;
        case"IfNot":case"IfNotZero":case"IfPos":case"DecrJumpZero":case"Once":op.p1=reg(original.p1);op.p2=pc(original.p2);break;
        case"IfRegisterGt":op.left=reg(original.left);op.right=reg(original.right);op.jump=pc(original.jump);break;
        case"Goto":op.p2=pc(original.p2);break;
        case"Gosub":op.p1=reg(original.p1);op.p2=pc(original.p2);break;
        case"Return":op.p1=reg(original.p1);break;
        case"InitCoroutine":op.p1=reg(original.p1);op.p2=original.p2===0?0:pc(original.p2);op.p3=pc(original.p3);break;
        case"Yield":case"EndCoroutine":op.p1=reg(original.p1);op.p2=original.p2===0?0:pc(original.p2);break;
        case"SorterInsert":op.p1=csr(original.p1);op.keyStart=reg(original.keyStart);op.payload=reg(original.payload);break;
        case"SorterSort":op.p1=csr(original.p1);op.emptyJump=pc(original.emptyJump);break;
        case"SorterData":op.p1=csr(original.p1);op.p2=reg(original.p2);break;
        case"SorterNext":op.p1=csr(original.p1);op.p2=pc(original.p2);break;
        case"EphemeralAdvanceData":op.p1=csr(original.p1);op.p2=reg(original.p2);if(original.emptyJump!==undefined)op.emptyJump=pc(original.emptyJump);break;
        case"EphemeralRewind":case"EphemeralNext":op.p1=csr(original.p1);op.p2=pc(original.p2);break;
        case"EphemeralData":op.p1=csr(original.p1);op.p2=reg(original.p2);break;
        case"EphemeralRowid":op.p1=csr(original.p1);op.p2=reg(original.p2);break;
        case"MakeRecord":op.p1=reg(original.p1);op.p3=reg(original.p3);break;
        case"NewRowid":op.p1=csr(original.p1);op.p2=reg(original.p2);break;
        case"Insert":op.p1=csr(original.p1);op.p2=reg(original.p2);op.p3=reg(original.p3);break;
        case"RealAffinity":case"MustBeInt":case"WindowCheck":op.p1=reg(original.p1);break;
        default:throw new JSQLiteError("unsupported",`compound window arm opcode ${original.code} is not represented`,{unsupportedClassification:"temporary"});
      }
      ops.push(op as Op);
    }
    for(const at of end)(ops[at] as {p2:number}).p2=ops.length;
  }
  const output=registers+1;registers+=width;const sort=ops.length;ops.push({code:"SorterSort",p1:outerSorter,emptyJump:0},{code:"SorterData",p1:outerSorter,p2:output,count:width},{code:"ResultRow",p1:output,p2:width},{code:"SorterNext",p1:outerSorter,p2:sort+1});(ops[sort] as {emptyJump:number}).emptyJump=ops.length;ops.push({code:"Halt"});
  return Object.freeze({ops:Object.freeze(ops),registers,encoding:database.encoding,columns:children[0]!.columns,parameters:Object.freeze([]),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits});
}

function compileSimpleTableCompound(select:SelectNode,schema:SchemaGraph,database:BtreeDatabase,maxRows:number,maxWorkUnits:number,maxResultBytes:number,privateStateLimits:PrivateStateLimits):Program {
  if(select.arms.some(arm=>arm.from.items.length!==1||arm.where!==null||arm.result.length!==1||arm.origin!=="select"))throw new JSQLiteError("unsupported","complex compound table arms are not implemented",{unsupportedClassification:"temporary"});
  const resolved=select.arms.map(arm=>{const name=sqlName(arm.from.items[0]!.tableName),table=schema.tables.get(sqliteAsciiFold(name));if(!table)throw new JSQLiteError("sqlite",`no such table: ${name}`,{code:1});if(table.withoutRowid||table.columns.some(c=>c.generatedExpr))throw new JSQLiteError("unsupported","this table storage shape is not implemented",{unsupportedClassification:"temporary"});const expression=arm.result[0]!,token=expression.tokens;if(token.length!==1)throw new JSQLiteError("unsupported","compound table expression is not implemented",{unsupportedClassification:"temporary"});const columnName=sqlName(token[0]!.text),column=table.columns.findIndex(c=>sqliteIdentifierEqual(c.name,columnName));if(column<0)throw new JSQLiteError("sqlite",`no such column: ${columnName}`,{code:1});return{arm,table,column,expression};});
  const operators=select.arms.slice(1).map(arm=>arm.operatorFromPrior!),lastSetArm=operators.reduce((last,op,index)=>op==="union-all"?last:index+1,-1);
  const left=resolved[0]!,leftColumn=left.table.columns[left.column]!,outputName=left.expression.alias??leftColumn.name,leftCollation=sqliteAsciiFold(leftColumn.collation??"binary");
  if(leftCollation!=="binary"&&leftCollation!=="nocase"&&leftCollation!=="rtrim")throw new JSQLiteError("sqlite",`no such collation sequence: ${leftColumn.collation}`,{code:1});
  const orderTerms=select.orderBy.map((term,index)=>{
    let tree=expressionFromReduction(term.expr.reduction!),identity=tree;while(identity.kind==="collate")identity=identity.value;
    let matches=false;
    if(identity.kind==="literal"&&typeof identity.value==="bigint"){
      if(identity.value!==1n)throw new JSQLiteError("sqlite",`${index+1}${index===0?"st":index===1?"nd":index===2?"rd":"th"} ORDER BY term out of range - should be between 1 and 1`,{code:1});matches=true;
    }else if(identity.kind==="column"&&!identity.name.includes(".")){
      const name=sqlName(identity.name);matches=sqliteIdentifierEqual(name,outputName)||resolved.some(item=>item.expression.alias!==undefined&&item.expression.alias!==null&&sqliteIdentifierEqual(item.expression.alias,name));
    }
    // resolveCompoundOrderBy compares generated expressions after alias/ordinal
    // precedence. Token spelling is not ownership: parentheses, qualification,
    // quoting and COLLATE decoration must not change the owning result column.
    if(!matches){
      const owned=(value:Expression,item:typeof resolved[number]):boolean=>{switch(value.kind){
        case "column": {const parts=value.name.split('.').map(sqlName);return parts.length<2||sqliteIdentifierEqual(parts.at(-2)!,item.arm.from.items[0]!.alias??item.table.name);}
        case "unary": case "cast": case "collate": return owned(value.value,item);
        case "binary": return owned(value.left,item)&&owned(value.right,item);
        case "call": case "aggregate": return value.args.every(arg=>owned(arg,item));
        case "case": return (value.operand===null||owned(value.operand,item))&&value.pairs.every(([when,then])=>owned(when,item)&&owned(then,item))&&(value.otherwise===null||owned(value.otherwise,item));
        default: return true;
      }};
      matches=resolved.some(item=>owned(tree,item)&&item.expression.reduction!==undefined&&item.expression.reduction!==null&&compoundOrderExpressionEqual(tree,expressionFromReduction(item.expression.reduction)));
    }
    if(!matches)throw new JSQLiteError("sqlite",`${index+1}${index===0?"st":index===1?"nd":index===2?"rd":"th"} ORDER BY term does not match any column in the result set`,{code:1});
    const named=explicitCollation(tree)??leftCollation;if(named!=="binary"&&named!=="nocase"&&named!=="rtrim")throw new JSQLiteError("sqlite",`no such collation sequence: ${named}`,{code:1});
    return {collation:named as BuiltinCollation,desc:term.descending,nullsLarge:term.nulls==="last"?!term.descending:term.nulls==="first"?term.descending:false};
  });
  const ops:Op[]=[],parameters:ParameterBuilder={maximum:0,names:[],named:new Map()};let registers=Math.max(1,1+orderTerms.length);const limit=computeLimitRegisters(select,ops,()=>++registers,parameters,true),setCursor=1,auxCursor=2,sorterCursor=3;
  const setKeyInfo=new KeyInfo({encoding:database.encoding,totalFieldCount:1,keyFieldCount:1,terms:[{collation:leftCollation as BuiltinCollation}]});
  const orderKeyInfo=orderTerms.length?new KeyInfo({encoding:database.encoding,totalFieldCount:orderTerms.length,keyFieldCount:orderTerms.length,terms:orderTerms}):null;
  if(orderKeyInfo)ops.push({code:"SorterOpen",p1:sorterCursor,keyInfo:orderKeyInfo});
  const haltJumps:number[]=[],emitResult=()=>{let skip:number|undefined;if(limit?.offset!==undefined){skip=ops.length;ops.push({code:"IfPos",p1:limit.offset,p2:0,p3:1});}ops.push({code:"ResultRow",p1:1,p2:1});if(limit){haltJumps.push(ops.length);ops.push({code:"DecrJumpZero",p1:limit.count,p2:0});}return skip;};
  const emitOrdered=()=>{for(let index=0;index<orderTerms.length;index++)ops.push({code:"Copy",p1:1,p2:2+index});ops.push({code:"SorterInsert",p1:sorterCursor,keyStart:2,keyCount:orderTerms.length,payload:1,payloadCount:1,...(limit?{topN:limit.capacity}:{})});};
  const scan=(item:typeof resolved[number],destination:"result"|"order"|"set"|"aux-set"|"delete")=>{ops.push({code:"OpenRead",p1:item.table.rootPage});const rewind=ops.length;ops.push({code:"Rewind",p2:0});const body=ops.length;ops.push({code:"Column",p1:item.column,p2:1});let skip:number|undefined;if(destination==="result")skip=emitResult();else if(destination==="order")emitOrdered();else if(destination==="set")ops.push({code:"IdxInsert",p1:setCursor,keyStart:1,keyCount:1,replace:true});else if(destination==="delete")ops.push({code:"SetDelete",p1:setCursor,keyStart:1,keyCount:1});else ops.push({code:"IdxInsert",p1:auxCursor,keyStart:1,keyCount:1,replace:true});const next=ops.length;ops.push({code:"Next",p2:body});(ops[rewind] as {p2:number}).p2=ops.length;if(skip!==undefined)(ops[skip] as {p2:number}).p2=next;};
  const destination=orderKeyInfo?"order" as const:"result" as const;
  if(lastSetArm<0){for(const item of resolved)scan(item,destination);}
  else{
    ops.push({code:"OpenEphemeral",p1:setCursor,keyInfo:setKeyInfo},{code:"OpenEphemeral",p1:auxCursor,keyInfo:setKeyInfo});
    for(let index=0;index<=lastSetArm;index++){const operator=resolved[index]!.arm.operatorFromPrior;if(index===0||operator==="union"||operator==="union-all")scan(resolved[index]!,"set");else if(operator==="except")scan(resolved[index]!,"delete");else{scan(resolved[index]!,"aux-set");ops.push({code:"SetRetainIntersection",p1:setCursor,p2:auxCursor},{code:"ClearEphemeral",p1:auxCursor});}}
    ops.push({code:"EphemeralSort",p1:setCursor});const rewind=ops.length;ops.push({code:"EphemeralRewind",p1:setCursor,p2:0},{code:"EphemeralData",p1:setCursor,p2:1,count:1});let skip:number|undefined;if(orderKeyInfo)emitOrdered();else skip=emitResult();const next=ops.length;ops.push({code:"EphemeralNext",p1:setCursor,p2:rewind+1});(ops[rewind] as {p2:number}).p2=ops.length;if(skip!==undefined)(ops[skip] as {p2:number}).p2=next;
    for(let index=lastSetArm+1;index<resolved.length;index++)scan(resolved[index]!,destination);
  }
  if(orderKeyInfo){const sortAt=ops.length;ops.push({code:"SorterSort",p1:sorterCursor,emptyJump:0},{code:"SorterData",p1:sorterCursor,p2:1,count:1});const skip=emitResult(),next=ops.length;ops.push({code:"SorterNext",p1:sorterCursor,p2:sortAt+1});(ops[sortAt] as {emptyJump:number}).emptyJump=ops.length;if(skip!==undefined)(ops[skip] as {p2:number}).p2=next;}
  const halt=ops.length;ops.push({code:"Halt"});if(limit){(ops[limit.ifZero] as {p2:number}).p2=halt;for(const at of haltJumps)(ops[at] as {p2:number}).p2=halt;}
  return Object.freeze({ops:Object.freeze(ops),registers,encoding:database.encoding,columns:Object.freeze([Object.freeze({name:outputName,declaredType:leftColumn.declaredType,database:"main",table:left.table.name,origin:leftColumn.name})]),parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits});
}


/** select.c SRT_EphemTab destination for a single compound FROM producer.
 * The child Program is spliced into this Program and every SRT_Output row is
 * redirected to the consumer sorter. This retains one VDBE, work counter and
 * private-state budget rather than executing a nested public Statement. */
function compileSingleCompoundDerived(select:SelectNode,schema:SchemaGraph,database:BtreeDatabase,maxRows:number,maxWorkUnits:number,maxResultBytes:number,privateStateLimits:PrivateStateLimits):Program|undefined {
 const derived=select.from.derived;
 if(!derived||derived.index!==0||select.from.items.length!==1||!derived.select.hasCompound||select.where||select.hasDistinct||select.hasGroupBy||select.hasHaving||select.limit||select.offset)return undefined;
 const item=select.from.items[0]!,alias=item.alias;
 const names=select.result.map(expression=>{if(!expression.reduction)return null;let tree=expressionFromReduction(expression.reduction);while(tree.kind==='collate')tree=tree.value;if(tree.kind!=="column")return null;const parts=tree.name.split('.').map(sqlName);if(parts.length>2||(parts.length===2&&(!alias||!sqliteIdentifierEqual(parts[0]!,alias))))return null;return parts.at(-1)!;});
 if(names.some(value=>value===null))return undefined;
 if(derived.select.arms.slice(1).some(arm=>arm.operatorFromPrior!=='union-all'))return undefined;
 const children=derived.select.arms.map(arm=>{const single:SelectNode={...derived.select,result:arm.result,from:arm.from,where:arm.where,hasDistinct:arm.hasDistinct,hasGroupBy:arm.hasGroupBy,hasHaving:arm.hasHaving,groupBy:Object.freeze([]),having:null,orderBy:Object.freeze([]),limit:null,offset:null,hasOrderBy:false,hasLimit:false,hasCompound:false,arms:Object.freeze([{...arm,operatorFromPrior:null,prior:null,next:null}])};return compileTableSelect(single,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits);});
 if(children.some(child=>child.parameters.length))return undefined;
 const leftColumns=children[0]!.columns,metadataColumns=children.at(-1)!.columns;
 const indices=names.map(name=>leftColumns.findIndex(column=>sqliteIdentifierEqual(column.name,name!)));if(indices.some(index=>index<0)||children.some(child=>child.columns.length!==leftColumns.length))return undefined;
 const ordinal=select.orderBy.map(term=>{let tree=expressionFromReduction(term.expr.reduction!);while(tree.kind==='collate')tree=tree.value;return tree.kind==='literal'&&typeof tree.value==='bigint'&&tree.value>=1n&&tree.value<=BigInt(indices.length)?Number(tree.value-1n):-1;});
 if(ordinal.some(index=>index<0))return undefined;
 // This destination currently retains a one-to-one opcode map so child jump
 // addresses remain source-identical while ResultRow becomes SorterInsert.
 if(indices.some((index,i)=>index!==i)||ordinal.some((index,i)=>index!==i))return undefined;
 const sorter=30,ops:Op[]=[];
 if(select.hasOrderBy)ops.push({code:"SorterOpen",p1:sorter,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:ordinal.length,keyFieldCount:ordinal.length,terms:select.orderBy.map(term=>({collation:'binary',desc:term.descending,nullsLarge:term.nulls==='last'?!term.descending:term.nulls==='first'?term.descending:false}))})});
 let registers=Math.max(...children.map(child=>child.registers));
 for(const child of children){const base=ops.length,endJumps:number[]=[];
  for(const original of child.ops){
   if(original.code==='Halt'){endJumps.push(ops.length);ops.push({code:'Goto',p2:0});continue;}
   if(original.code==='ResultRow'){
    if(select.hasOrderBy)ops.push({code:'SorterInsert',p1:sorter,keyStart:original.p1,keyCount:ordinal.length,payload:original.p1,payloadCount:indices.length});
    else ops.push({code:'ResultRow',p1:original.p1,p2:indices.length});
    continue;
   }
   let op:Op=original;if('p2' in op&&['Goto','Rewind','IfNot','Next','DecrJumpZero','IfNotZero','IfPos','SorterNext','EphemeralRewind','EphemeralNext'].includes(op.code))op={...op,p2:op.p2+base} as Op;if('jump' in op&&typeof op.jump==='number')op={...op,jump:op.jump+base} as Op;if(op.code==='SorterSort')op={...op,emptyJump:op.emptyJump+base};ops.push(op);
  }
  for(const at of endJumps)(ops[at] as {p2:number}).p2=ops.length;
 }
 if(select.hasOrderBy){const output=++registers;registers+=indices.length-1;const sortAt=ops.length;ops.push({code:'SorterSort',p1:sorter,emptyJump:0},{code:'SorterData',p1:sorter,p2:output,count:indices.length},{code:'ResultRow',p1:output,p2:indices.length},{code:'SorterNext',p1:sorter,p2:sortAt+1});const halt=ops.length;ops.push({code:'Halt'});(ops[sortAt] as {emptyJump:number}).emptyJump=halt;}else ops.push({code:'Halt'});
 const columns=indices.map((index,result)=>Object.freeze({...metadataColumns[index]!,name:select.result[result]!.alias??leftColumns[index]!.name}));
 return Object.freeze({ops:Object.freeze(ops),registers,encoding:database.encoding,columns:Object.freeze(columns),parameters:Object.freeze([]),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits});
}

export type FromSubqueryRouteFacts=Readonly<{sourceCount:number;index:number;joinFromLeft:SelectNode["from"]["items"][number]["joinFromLeft"];nextCross:boolean;leftOfRightJoin:boolean;updateFrom:boolean;coroutineOptimization:boolean;isCte:boolean|null;cteMaterialized:boolean|null;cteUseCount:number|null;cteNotMaterialized:boolean|null;earlierSubquery:boolean|null;selfJoinView:boolean|null}>;
/** Direct translation of select.c:fromClauseTermCanBeCoroutine conditions 1a-c/2a-b/3-5. */
export function fromClauseTermCanBeCoroutine(f:FromSubqueryRouteFacts):boolean{if(f.isCte===null||f.selfJoinView===null||f.earlierSubquery===null)return false;if(f.isCte){if(f.cteMaterialized===null||f.cteUseCount===null||f.cteNotMaterialized===null)return false;if(f.cteMaterialized)return false;if(f.cteUseCount>=2&&!f.cteNotMaterialized)return false;}if(f.leftOfRightJoin||!f.coroutineOptimization||f.selfJoinView)return false;if(f.index===0){if(f.sourceCount===1)return true;if(f.nextCross)return true;if(f.updateFrom)return false;return true;}if(f.updateFrom||f.joinFromLeft.outer||f.joinFromLeft.cross||f.earlierSubquery)return false;return true;}

/** select.c SRT_EphemTab materialization for bounded non-flattenable derived
 * sources. The inner SELECT is compiled by the ordinary owner, then its
 * ResultRow destination is redirected into a shared typed ephemeral cursor;
 * no host rows or nested Statement exist. */
function compileDerivedProducer(select:SelectNode,schema:SchemaGraph,database:BtreeDatabase,maxRows:number,maxWorkUnits:number,maxResultBytes:number,privateStateLimits:PrivateStateLimits):Program|undefined {
 const derived=select.from.derived;
 if(derived&&derived.index===0&&select.from.items.length===1&&selectHasWindow(derived.select)&&!!select.where&&!select.hasDistinct&&!select.hasGroupBy&&!select.hasHaving&&select.orderBy.length<=1){
  // select.c materializes a non-flattenable window producer before applying the
  // parent predicate. Keep its nested coroutine PCs/registers intact: redirect
  // ResultRow to a typed zero-key sorter rather than wrapping it in yet another
  // coroutine (which changes EndCoroutine caller ownership). The parent owns
  // its ORDER/LIMIT destination after the predicate, just as selectInnerLoop()
  // does for an SRT_EphemTab source.
  const inner=compileTableSelect(derived.select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits);if(inner.parameters.length)return undefined;
  const names=uniqueTransientColumnNames(derived.select.result.map((expression,index)=>expression.alias??inner.columns[index]?.name??`column${index+1}`)),alias=select.from.items[0]!.alias;
  const bareStar=select.result.length===1&&select.result[0]!.tokens.length===1&&select.result[0]!.tokens[0]!.text==='*';
  const sourceIndex=(expression:typeof select.result[number]):number=>{if(!expression.reduction)return -1;let tree=expressionFromReduction(expression.reduction);while(tree.kind==='collate')tree=tree.value;if(tree.kind!=='column')return -1;const parts=tree.name.split('.').map(sqlName);if(parts.length>2||(parts.length===2&&(!alias||!sqliteIdentifierEqual(parts[0]!,alias))))return -1;return names.findIndex(name=>sqliteIdentifierEqual(name,parts.at(-1)!));};
  const indices=bareStar?inner.columns.map((_,index)=>index):select.result.map(sourceIndex);if(indices.some(index=>index<0))return undefined;
  let orderIndex=-1,orderTree:Expression|undefined;if(select.hasOrderBy){const term=select.orderBy[0]!;orderTree=expressionFromReduction(term.expr.reduction!);let tree=orderTree;while(tree.kind==='collate')tree=tree.value;if(tree.kind==='literal'&&tree.value===1n)orderIndex=indices[0]??-1;else if(tree.kind==='column'){const parts=tree.name.split('.').map(sqlName);if(parts.length<=2&&(parts.length===1||!!alias&&sqliteIdentifierEqual(parts[0]!,alias)))orderIndex=names.findIndex(name=>sqliteIdentifierEqual(name,parts.at(-1)!));}if(orderIndex<0)return undefined;}
  const spool=40,outputSorter=41,ops:Op[]=inner.ops.map(op=>op),first=ops[0]!,ends:number[]=[];ops[0]={code:'Goto',p2:0};for(let pc=1;pc<ops.length;pc++){const op=ops[pc]!;if(op.code==='ResultRow')ops[pc]={code:'SorterInsert',p1:spool,keyStart:op.p1,keyCount:0,payload:op.p1,payloadCount:op.p2};else if(op.code==='Halt'){ends.push(pc);ops[pc]={code:'Goto',p2:0};}}
  const setup=ops.length;ops.push({code:'SorterOpen',p1:spool,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:0,keyFieldCount:0,terms:[]})});if(orderTree){const term=select.orderBy[0]!;ops.push({code:'SorterOpen',p1:outputSorter,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:1+indices.length,keyFieldCount:1,terms:[{collation:collation(orderTree),desc:term.descending,nullsLarge:term.nulls==='last'?!term.descending:term.nulls==='first'?term.descending:false}]})});}
  let registers=inner.registers,output=++registers;registers+=indices.length-1;const payload=++registers;registers+=inner.columns.length-1;const parameters:ParameterBuilder={maximum:0,names:[],named:new Map()};const limit=computeLimitRegisters(select,ops,()=>++registers,parameters);ops.push(first,{code:'Goto',p2:1});(ops[0] as {p2:number}).p2=setup;const key=orderTree?++registers:0;const sort=ops.length;for(const end of ends)(ops[end] as {p2:number}).p2=sort;ops.push({code:'SorterSort',p1:spool,emptyJump:0},{code:'SorterData',p1:spool,p2:payload,count:inner.columns.length});
  const bind=(tree:Expression):Expression=>{if(tree.kind==='column'){const parts=tree.name.split('.').map(sqlName);if(parts.length>2||(parts.length===2&&(!alias||!sqliteIdentifierEqual(parts[0]!,alias))))throw new JSQLiteError('sqlite',`no such column: ${tree.name}`,{code:1});const index=names.findIndex(name=>sqliteIdentifierEqual(name,parts.at(-1)!));if(index<0)throw new JSQLiteError('sqlite',`no such column: ${tree.name}`,{code:1});return{kind:'register',index:payload+index}}if(tree.kind==='unary'||tree.kind==='cast'||tree.kind==='collate')return{...tree,value:bind(tree.value)};if(tree.kind==='binary')return{...tree,left:bind(tree.left),right:bind(tree.right)};if(tree.kind==='call')return{...tree,args:tree.args.map(bind)};if(tree.kind==='case')return{...tree,operand:tree.operand?bind(tree.operand):null,pairs:tree.pairs.map(([a,b])=>[bind(a),bind(b)]),otherwise:tree.otherwise?bind(tree.otherwise):null};return tree};
  const predicate=compileExpressionTree(bind(expressionFromReduction(select.where.reduction!)),ops,()=>++registers,parameters),skip=ops.length;ops.push({code:'IfNot',p1:predicate,p2:0});indices.forEach((index,result)=>ops.push({code:'Copy',p1:payload+index,p2:output+result}));if(orderTree){ops.push({code:'Copy',p1:payload+orderIndex,p2:key},{code:'SorterInsert',p1:outputSorter,keyStart:key,keyCount:1,payload:output,payloadCount:indices.length});}else{let offsetSkip:number|undefined;if(limit?.offset!==undefined){offsetSkip=ops.length;ops.push({code:'IfPos',p1:limit.offset,p2:0,p3:1});}ops.push({code:'ResultRow',p1:output,p2:indices.length});if(limit)ops.push({code:'DecrJumpZero',p1:limit.count,p2:0});if(offsetSkip!==undefined)(ops[offsetSkip] as {p2:number}).p2=ops.length;}
  const next=ops.length;(ops[skip] as {p2:number}).p2=next;ops.push({code:'SorterNext',p1:spool,p2:sort+1});const outputDrain=ops.length;(ops[sort] as {emptyJump:number}).emptyJump=outputDrain;
  if(orderTree){const sorted=ops.length;ops.push({code:'SorterSort',p1:outputSorter,emptyJump:0},{code:'SorterData',p1:outputSorter,p2:output,count:indices.length});let offsetSkip:number|undefined;if(limit?.offset!==undefined){offsetSkip=ops.length;ops.push({code:'IfPos',p1:limit.offset,p2:0,p3:1});}ops.push({code:'ResultRow',p1:output,p2:indices.length});if(limit)ops.push({code:'DecrJumpZero',p1:limit.count,p2:0});const advance=ops.length;if(offsetSkip!==undefined)(ops[offsetSkip] as {p2:number}).p2=advance;ops.push({code:'SorterNext',p1:outputSorter,p2:sorted+1});const halt=ops.length;(ops[sorted] as {emptyJump:number}).emptyJump=halt;ops.push({code:'Halt'});if(limit){(ops[limit.ifZero] as {p2:number}).p2=halt;for(const op of ops)if(op.code==='DecrJumpZero'&&op.p1===limit.count&&op.p2===0)(op as {p2:number}).p2=halt;}}
  else{const halt=ops.length;ops.push({code:'Halt'});if(limit){(ops[limit.ifZero] as {p2:number}).p2=halt;for(const op of ops)if(op.code==='DecrJumpZero'&&op.p1===limit.count&&op.p2===0)(op as {p2:number}).p2=halt;}}
  const columns=indices.map((index,result)=>Object.freeze({...inner.columns[index]!,name:(bareStar?names[index]:select.result[result]!.alias)??names[index]!}));return Object.freeze({ops:Object.freeze(ops),registers,encoding:database.encoding,columns:Object.freeze(columns),parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits});
 }
 if(derived&&derived.index===0&&select.from.items.length===1&&!select.where&&!select.hasDistinct&&!select.hasGroupBy&&!select.hasHaving&&select.orderBy.length<=1&&!select.limit&&!select.offset){
  // select.c tag-select-0482, single-source form. Compile the child into the
  // parent's coroutine destination rather than letting ordinary table lookup
  // interpret the parser's synthetic "(subquery)" source name.
  const inner=derived.select.from.items.length ? compileTableSelect(derived.select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits) : compileScalarSelect(derived.select,database.encoding,maxWorkUnits,maxResultBytes,privateStateLimits,schema,database,maxRows);if(inner.parameters.length)return undefined;
  const alias=select.from.items[0]!.alias,names=uniqueTransientColumnNames(derived.select.result.map((expression,index)=>expression.alias??inner.columns[index]?.name??`column${index+1}`));
  const bareStar=select.result.length===1&&select.result[0]!.tokens.length===1&&select.result[0]!.tokens[0]!.text==='*';
  const indices=bareStar?inner.columns.map((_,index)=>index):select.result.map(expression=>{if(!expression.reduction)return -1;let tree=expressionFromReduction(expression.reduction);while(tree.kind==='collate')tree=tree.value;if(tree.kind!=='column')return -1;const parts=tree.name.split('.').map(sqlName);if(parts.length>2||(parts.length===2&&(!alias||!sqliteIdentifierEqual(parts[0]!,alias))))return -1;return names.findIndex(name=>sqliteIdentifierEqual(name,parts.at(-1)!));});if(indices.some(index=>index<0))return undefined;
  let orderIndex=-1;if(select.hasOrderBy){const term=select.orderBy[0]!;let tree=expressionFromReduction(term.expr.reduction!);while(tree.kind==='collate')tree=tree.value;if(tree.kind==='literal'&&tree.value===1n)orderIndex=0;else if(tree.kind==='column'){const parts=tree.name.split('.').map(sqlName);orderIndex=indices.findIndex(index=>sqliteIdentifierEqual(names[index]!,parts.at(-1)!));}if(orderIndex<0||term.nulls!==null)return undefined;}
  const returnRegister=inner.registers+1,sorterCursor=40,ops:Op[]=[{code:'InitCoroutine',p1:returnRegister,p2:0,p3:0}],producerBase=1,endJumps:number[]=[];
  for(const original of inner.ops){let op:Op=original;if('p2' in op&&['Goto','Rewind','IfNot','Next','DecrJumpZero','IfNotZero','IfPos','SorterNext'].includes(op.code))op={...op,p2:op.p2+producerBase} as Op;if(op.code==='InitCoroutine')op={...op,p2:op.p2===0?0:op.p2+producerBase,p3:op.p3+producerBase};if(op.code==='EndCoroutine')op={...op,p2:op.p2===0?0:op.p2+producerBase};if(op.code==='SorterSort')op={...op,emptyJump:op.emptyJump+producerBase};if('jump' in op&&typeof op.jump==='number')op={...op,jump:op.jump+producerBase} as Op;if(op.code==='ResultRow')ops.push({code:'Yield',p1:returnRegister,p2:0});else if(op.code==='Halt'){endJumps.push(ops.length);ops.push({code:'EndCoroutine',p1:returnRegister,p2:0});}else ops.push(op);}
  const consumer=ops.length;(ops[0] as {p2:number}).p2=consumer;(ops[0] as {p3:number}).p3=producerBase;const output=returnRegister+1,key=output+indices.length;if(select.hasOrderBy)ops.push({code:'SorterOpen',p1:sorterCursor,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:1,keyFieldCount:1,terms:[{collation:'binary',desc:select.orderBy[0]!.descending}]})});const resume=ops.length;ops.push({code:'Yield',p1:returnRegister,p2:0});indices.forEach((index,result)=>ops.push({code:'Copy',p1:index+1,p2:output+result}));if(select.hasOrderBy){ops.push({code:'Copy',p1:output+orderIndex,p2:key},{code:'SorterInsert',p1:sorterCursor,keyStart:key,keyCount:1,payload:output,payloadCount:indices.length},{code:'Goto',p2:resume});const sort=ops.length;for(const at of endJumps)(ops[at] as {p2:number}).p2=sort;ops.push({code:'SorterSort',p1:sorterCursor,emptyJump:0},{code:'SorterData',p1:sorterCursor,p2:output,count:indices.length},{code:'ResultRow',p1:output,p2:indices.length},{code:'SorterNext',p1:sorterCursor,p2:sort+1});const halt=ops.length;ops.push({code:'Halt'});(ops[sort] as {emptyJump:number}).emptyJump=halt;}else{ops.push({code:'ResultRow',p1:output,p2:indices.length},{code:'Goto',p2:resume});const halt=ops.length;for(const at of endJumps)(ops[at] as {p2:number}).p2=halt;ops.push({code:'Halt'});}
  const columns=indices.map((index,result)=>Object.freeze({...inner.columns[index]!,name:(bareStar?names[index]:select.result[result]!.alias)??names[index]!}));return Object.freeze({ops:Object.freeze(ops),registers:key,encoding:database.encoding,columns:Object.freeze(columns),parameters:Object.freeze([]),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits});
 }
 if(!derived||derived.index!==1||select.from.items.length!==2||select.where||select.hasDistinct||select.hasGroupBy||select.hasHaving||select.result.length!==2||select.orderBy.length!==2||select.limit||select.offset)return undefined;
 const item=select.from.items[derived.index]!,coroutine=fromClauseTermCanBeCoroutine({sourceCount:select.from.items.length,index:derived.index,joinFromLeft:item.joinFromLeft,nextCross:false,leftOfRightJoin:select.from.items[0]!.leftOfRightJoin,updateFrom:false,coroutineOptimization:true,isCte:false,cteMaterialized:false,cteUseCount:1,cteNotMaterialized:false,earlierSubquery:false,selfJoinView:false});
 const outerItem=select.from.items[0]!,outer=schema.tables.get(sqliteAsciiFold(sqlName(outerItem.tableName)));if(!outer)return undefined;
 const inner=compileTableSelect(derived.select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits);if(inner.parameters.length)return undefined;
 const ordinalOrder=select.orderBy.every((term,index)=>term.expr.tokens.length===1&&term.expr.tokens[0]!.text===String(index+1)&&!term.descending&&term.nulls===null);if(!ordinalOrder)return undefined;
 const direct=(expression:SelectNode['result'][number])=>expression.tokens.length===3&&expression.tokens[1]!.text==='.'?{owner:sqlName(expression.tokens[0]!.text),name:sqlName(expression.tokens[2]!.text)}:null,left=direct(select.result[0]!),right=direct(select.result[1]!);if(!left||!right||!sqliteIdentifierEqual(left.owner,outerItem.alias??outer.name)||!sqliteIdentifierEqual(right.owner,derived.alias??'(subquery)'))return undefined;
 const outerColumn=outer.columns.findIndex(column=>sqliteIdentifierEqual(column.name,left.name)),innerColumn=inner.columns.findIndex(column=>sqliteIdentifierEqual(column.name,right.name));if(outerColumn<0||innerColumn<0)return undefined;const outerRowid=isIntegerPrimaryKeyAlias(outer,outerColumn);
 const ephemeral=20,keyInfo=new KeyInfo({encoding:database.encoding,totalFieldCount:inner.columns.length,keyFieldCount:inner.columns.length,terms:inner.columns.map(()=>({collation:'binary'}))}),onceRegister=inner.registers+1,returnRegister=onceRegister+1;
 if(coroutine){
  // select.c tag-select-0482: the subquery destination is a register range.
  // Yield exchanges the producer and consumer PCs; it must not populate a
  // statement-private ephemeral cursor before the consumer starts.
  const ops:Op[]=[{code:'InitCoroutine',p1:returnRegister,p2:0,p3:0}],producerBase=1,endJumps:number[]=[];
  for(const original of inner.ops){let op:Op=original;if('p2' in op&&['Goto','Rewind','IfNot','Next','DecrJumpZero','IfNotZero','IfPos','SorterNext'].includes(op.code))op={...op,p2:op.p2+producerBase} as Op;if(op.code==='InitCoroutine')op={...op,p2:op.p2===0?0:op.p2+producerBase,p3:op.p3+producerBase};if(op.code==='EndCoroutine')op={...op,p2:op.p2===0?0:op.p2+producerBase};if(op.code==='SorterSort')op={...op,emptyJump:op.emptyJump+producerBase};if('jump' in op&&typeof op.jump==='number')op={...op,jump:op.jump+producerBase} as Op;if(op.code==='ResultRow')ops.push({code:'Yield',p1:returnRegister,p2:0});else if(op.code==='Halt'){endJumps.push(ops.length);ops.push({code:'EndCoroutine',p1:returnRegister,p2:0});}else ops.push(op);}
  const consumerStart=ops.length;(ops[0] as {p2:number}).p2=consumerStart;(ops[0] as {p3:number}).p3=producerBase;
  const output=returnRegister+1,outerCursor=30;ops.push({code:'OpenRead',p1:outer.rootPage,p2:outerCursor});const outerRewind=ops.length;ops.push({code:'Rewind',p1:outerCursor,p2:0});const outerBody=ops.length;ops.push({code:'InitCoroutine',p1:returnRegister,p2:0,p3:producerBase});const resume=ops.length;ops.push({code:'Yield',p1:returnRegister,p2:0},outerRowid?{code:'Rowid',p1:outerCursor,p2:output}:{code:'Column',p1:outerColumn,p2:output,p3:outerCursor},{code:'Copy',p1:innerColumn+1,p2:output+1},{code:'ResultRow',p1:output,p2:2},{code:'Goto',p2:resume});const innerDone=ops.length;for(const at of endJumps)(ops[at] as {p2:number}).p2=innerDone;ops.push({code:'Next',p1:outerCursor,p2:outerBody});const halt=ops.length;ops.push({code:'Halt'});(ops[outerRewind] as {p2:number}).p2=halt;
  const columns=Object.freeze([Object.freeze({name:select.result[0]!.alias??outer.columns[outerColumn]!.name,declaredType:outer.columns[outerColumn]!.declaredType,database:'main',table:outer.name,origin:outer.columns[outerColumn]!.name}),inner.columns[innerColumn]!]);return Object.freeze({ops:Object.freeze(ops),registers:output+1,encoding:database.encoding,columns,parameters:Object.freeze([]),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits});
 }
 const ops:Op[]=[{code:'OpenEphemeral',p1:ephemeral,keyInfo},{code:'Once',p1:onceRegister,p2:3},{code:'Gosub',p1:returnRegister,p2:4},{code:'Goto',p2:0}],endJumps:number[]=[];
 const producerBase=ops.length;
 for(const original of inner.ops){let op:Op=original;if('p2' in op&&['Goto','Rewind','IfNot','Next','DecrJumpZero','IfNotZero','IfPos','SorterNext'].includes(op.code))op={...op,p2:op.p2+producerBase} as Op;if(op.code==='InitCoroutine')op={...op,p2:op.p2===0?0:op.p2+producerBase,p3:op.p3+producerBase};if(op.code==='EndCoroutine')op={...op,p2:op.p2===0?0:op.p2+producerBase};if(op.code==='SorterSort')op={...op,emptyJump:op.emptyJump+producerBase};if('jump' in op&&typeof op.jump==='number')op={...op,jump:op.jump+producerBase} as Op;if(op.code==='ResultRow')ops.push({code:'IdxInsert',p1:ephemeral,keyStart:op.p1,keyCount:op.p2});else if(op.code==='Halt'){endJumps.push(ops.length);ops.push({code:'Goto',p2:0});}else ops.push(op);}
 const producerEnd=ops.length;for(const at of endJumps)(ops[at] as {p2:number}).p2=producerEnd;ops.push({code:'Return',p1:returnRegister});const consumerStart=ops.length;(ops[3] as {p2:number}).p2=consumerStart;
 const derivedBase=returnRegister+1,output=derivedBase+inner.columns.length,outerCursor=0;ops.push({code:'OpenRead',p1:outer.rootPage,p2:outerCursor});const outerRewind=ops.length;ops.push({code:'Rewind',p1:outerCursor,p2:0});const outerBody=ops.length,innerRewind=ops.length;ops.push({code:'EphemeralRewind',p1:ephemeral,p2:0},{code:'EphemeralData',p1:ephemeral,p2:derivedBase,count:inner.columns.length},outerRowid?{code:'Rowid',p1:outerCursor,p2:output}:{code:'Column',p1:outerColumn,p2:output,p3:outerCursor},{code:'Copy',p1:derivedBase+innerColumn,p2:output+1},{code:'ResultRow',p1:output,p2:2});const innerNext=ops.length;ops.push({code:'EphemeralNext',p1:ephemeral,p2:innerRewind+1},{code:'Next',p1:outerCursor,p2:outerBody});const halt=ops.length;ops.push({code:'Halt'});(ops[outerRewind] as {p2:number}).p2=halt;(ops[innerRewind] as {p2:number}).p2=innerNext+1;
 const columns=Object.freeze([Object.freeze({name:select.result[0]!.alias??outer.columns[outerColumn]!.name,declaredType:outer.columns[outerColumn]!.declaredType,database:'main',table:outer.name,origin:outer.columns[outerColumn]!.name}),inner.columns[innerColumn]!]);return Object.freeze({ops:Object.freeze(ops),registers:output+1,encoding:database.encoding,columns,parameters:Object.freeze([]),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits});
}

/**
 * select.c:sqlite3ColumnsFromExprList() makes transient view/subquery columns
 * unique without mutating the stored Select. Identifier comparison uses the
 * same ASCII fold as schema lookup. A colliding trailing ":<digits>" suffix is
 * replaced rather than accumulated.
 */
function uniqueTransientColumnNames(names:readonly string[]):readonly string[]{
  const used=new Set<string>(),result:string[]=[];
  for(const original of names){
    let name=original,counter=0;
    while(used.has(sqliteAsciiFold(name))){
      const base=name.replace(/:\d+$/,"");
      name=`${base}:${++counter}`;
    }
    used.add(sqliteAsciiFold(name));result.push(name);
  }
  return Object.freeze(result);
}


type ExprReduction=Extract<LemonValue<SqlToken>,{kind:"reduction"}>;
/** Bounded select.c:flattenSubquery substitution over generated reductions. */
function substituteViewExpression(expression:SelectNode["result"][number],columns:ReadonlyMap<string,SelectNode["result"][number]>,qualifier?:string):SelectNode["result"][number]{
  const directName=expression.tokens.length===1?sqlName(expression.tokens[0]!.text):null;
  const direct=directName===null?undefined:columns.get(sqliteAsciiFold(directName));
  if(direct)return Object.freeze({...direct,...(expression.alias===undefined?{}:{alias:expression.alias})});
  const replace=(node:LemonValue<SqlToken>):LemonValue<SqlToken>=>{
    if(node.kind==='terminal')return node;
    if(node.signature.startsWith('select ::=')&&node.semantic&&typeof node.semantic==='object'&&'kind' in node.semantic&&node.semantic.kind==='select'){
      const nested=node.semantic as SelectNode;
      const where=nested.where?substituteViewExpression(nested.where,columns,qualifier):null;
      return Object.freeze({...node,semantic:Object.freeze({...nested,where})});
    }
    if(qualifier&&node.signature==='expr ::= nm DOT nm'){
      const names=node.children.filter((child):child is ExprReduction=>child.kind==='reduction'&&child.signature.startsWith('nm ::='));
      const values=names.map(name=>name.children.find(child=>child.kind==='terminal')).filter((child):child is Extract<LemonValue<SqlToken>,{kind:'terminal'}>=>child?.kind==='terminal').map(child=>sqlName(child.value.text));
      const replacement=values.length===2&&sqliteIdentifierEqual(values[0]!,qualifier)?columns.get(sqliteAsciiFold(values[1]!)):undefined;
      if(replacement?.reduction)return replacement.reduction;
    }
    if(node.signature==='expr ::= ID|INDEXED|JOIN_KW'){
      const terminal=node.children.find(child=>child.kind==='terminal'&&child.value);
      const replacement=terminal?.kind==='terminal'?columns.get(sqliteAsciiFold(sqlName(terminal.value.text))):undefined;
      if(replacement?.reduction)return replacement.reduction;
    }
    return Object.freeze({...node,children:Object.freeze(node.children.map(replace))});
  };
  return Object.freeze({...expression,...(expression.reduction?{reduction:replace(expression.reduction)}:{})});
}
function andViewPredicates(left:SelectNode["where"],right:SelectNode["where"]):SelectNode["where"]{
  if(!left)return right;if(!right)return left;if(!left.reduction||!right.reduction)throw new JSQLiteError("internal","generated view predicate lost its reduction");
  const at=left.tokens.at(-1)?.endByte??0,andToken:SqlToken={kind:'keyword',text:'AND',startByte:at,endByte:at+3};
  const reduction:ExprReduction=Object.freeze({kind:'reduction',rule:-1,signature:'expr ::= expr AND expr',children:Object.freeze([left.reduction,{kind:'terminal' as const,tokenId:tokenIds.AND,value:andToken},right.reduction])});
  return Object.freeze({kind:'tokens',tokens:Object.freeze([...left.tokens,andToken,...right.tokens]),reduction});
}
function flattenImmutableView(select:SelectNode,view:ViewNode):SelectNode{
  const source=select.from.items[0]!,inner=lowerOrdinaryCtes(view.select)??view.select;
  if(source.alias!==null||source.databaseName!==null||source.on!==null||source.using!==null||inner.hasCompound||inner.hasDistinct||inner.hasGroupBy||inner.hasHaving||inner.hasOrderBy||inner.hasLimit||inner.from.items.length!==1)
    throw new JSQLiteError("unsupported","this view shape is not implemented",{unsupportedClassification:"temporary"});
  if(view.columns.length&&view.columns.length!==inner.result.length)throw new JSQLiteError("sqlite",`expected ${view.columns.length} columns for '${view.name}' but got ${inner.result.length}`,{code:1});
  const names=uniqueTransientColumnNames(view.columns.length?view.columns:inner.result.map((expression,index)=>expression.alias??(expression.tokens.length===1?sqlName(expression.tokens[0]!.text):`column${index+1}`)));
  const exposed=inner.result.map((expression,index)=>Object.freeze({...expression,alias:names[index]!}));
  // build.c:sqlite3ViewGetColumnNames and select.c:selectExpander keep the
  // view-visible column name distinct from the underlying origin metadata.
  // Substitute the transient exposed expression (whose alias is the view
  // column name), not the stored inner expression, so a direct projection of
  // `vc` remains named `vc` while resolution still traces its origin to `c`.
  const columns=new Map(exposed.map((expression,index)=>[sqliteAsciiFold(names[index]!),expression]));
  const bareStar=select.result.length===1&&select.result[0]!.tokens.length===1&&select.result[0]!.tokens[0]!.text==='*';
  const result=bareStar?exposed:select.result.map(expression=>substituteViewExpression(expression,columns,source.tableName));
  const where=andViewPredicates(inner.where,select.where?substituteViewExpression(select.where,columns,source.tableName):null);
  const groupBy=select.groupBy.map(expression=>substituteViewExpression(expression,columns,source.tableName));
  const having=select.having?substituteViewExpression(select.having,columns):null;
  const orderBy=select.orderBy.map(term=>Object.freeze({...term,expr:substituteViewExpression(term.expr,columns,source.tableName)}));
  return Object.freeze({...inner,result:Object.freeze(result),where,groupBy:Object.freeze(groupBy),having,orderBy:Object.freeze(orderBy),limit:select.limit,offset:select.offset,hasDistinct:select.hasDistinct,hasGroupBy:groupBy.length>0,hasHaving:having!==null,hasOrderBy:orderBy.length>0,hasLimit:select.hasLimit,hasSubquery:inner.hasSubquery,tokens:select.tokens});
}

/** select.c tag-select-0488/0486 for two compatible occurrences of one
 * immutable, non-flattenable view. The first occurrence owns the fill and the
 * second gets OP_OpenDup with an independent cursor position. */
function compileRepeatedImmutableView(select:SelectNode,schema:SchemaGraph,database:BtreeDatabase,maxRows:number,maxWorkUnits:number,maxResultBytes:number,privateStateLimits:PrivateStateLimits):Program|undefined{
 if(select.from.items.length!==2||select.hasDistinct||select.hasGroupBy||select.hasHaving||select.hasCompound||select.limit||select.offset)return undefined;
 const [li,ri]=select.from.items,l=schema.views.get(sqliteAsciiFold(sqlName(li!.tableName))),r=schema.views.get(sqliteAsciiFold(sqlName(ri!.tableName)));
 if(!l||l!==r||!li!.alias||!ri!.alias||!ri!.on?.reduction||ri!.using)return undefined;
 const inner=compileTableSelect(l.select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits);if(inner.parameters.length)return undefined;
 const names=uniqueTransientColumnNames(l.columns.length?l.columns:l.select.result.map((e,i)=>e.alias??(e.tokens.length===1?sqlName(e.tokens[0]!.text):`column${i+1}`)));
 const direct=(tree:Expression):{side:0|1;index:number}|null=>{if(tree.kind!=="column")return null;const p=tree.name.split('.').map(sqlName);if(p.length!==2)return null;const side=sqliteIdentifierEqual(p[0]!,li!.alias!)?0:sqliteIdentifierEqual(p[0]!,ri!.alias!)?1:null;if(side===null)return null;const index=names.findIndex(n=>sqliteIdentifierEqual(n,p[1]!));return index<0?null:{side,index};};
 const on=expressionFromReduction(ri!.on.reduction);if(on.kind!=="binary"||on.op!=="=")return undefined;const a=direct(on.left),b=direct(on.right);if(!a||!b||a.side===b.side)return undefined;
 const projected=select.result.map(e=>e.reduction?direct(expressionFromReduction(e.reduction)):null);if(projected.some(x=>x===null))return undefined;
 if(select.orderBy.length>1)return undefined;if(select.orderBy.length===1){let order=expressionFromReduction(select.orderBy[0]!.expr.reduction!);while(order.kind==='collate')order=order.value;if(order.kind!=="literal"||order.value!==1n||select.orderBy[0]!.descending||select.orderBy[0]!.nulls!==null)return undefined;}
 const owner=20,dup=21,keyInfo=new KeyInfo({encoding:database.encoding,totalFieldCount:inner.columns.length,keyFieldCount:inner.columns.length,terms:inner.columns.map(()=>({collation:'binary'}))}),once=inner.registers+1,ret=once+1,ops:Op[]=[{code:'OpenEphemeral',p1:owner,keyInfo},{code:'Once',p1:once,p2:3},{code:'Gosub',p1:ret,p2:4},{code:'Goto',p2:0}],ends:number[]=[];
 const producerBase=ops.length;for(const original of inner.ops){let op:Op=original;if('p2' in op&&['Goto','Rewind','IfNot','Next','DecrJumpZero','IfNotZero','IfPos','SorterNext'].includes(op.code))op={...op,p2:op.p2+producerBase} as Op;if(op.code==='InitCoroutine')op={...op,p2:op.p2===0?0:op.p2+producerBase,p3:op.p3+producerBase};if(op.code==='EndCoroutine')op={...op,p2:op.p2===0?0:op.p2+producerBase};if(op.code==='SorterSort')op={...op,emptyJump:op.emptyJump+producerBase};if('jump' in op&&typeof op.jump==='number')op={...op,jump:op.jump+producerBase} as Op;if(op.code==='ResultRow')ops.push({code:'IdxInsert',p1:owner,keyStart:op.p1,keyCount:op.p2});else if(op.code==='Halt'){ends.push(ops.length);ops.push({code:'Goto',p2:0});}else ops.push(op);}
 const producerEnd=ops.length;for(const at of ends)(ops[at] as {p2:number}).p2=producerEnd;ops.push({code:'Return',p1:ret});const consumer=ops.length;(ops[3] as {p2:number}).p2=consumer;
 ops.push({code:'EphemeralSort',p1:owner},{code:'OpenDup',p1:dup,p2:owner});const base=ret+1,rightBase=base+inner.columns.length,output=rightBase+inner.columns.length,rewindLeft=ops.length;ops.push({code:'EphemeralRewind',p1:owner,p2:0});const leftStart=ops.length;ops.push({code:'EphemeralData',p1:owner,p2:base,count:inner.columns.length});const rewindRight=ops.length;ops.push({code:'EphemeralRewind',p1:dup,p2:0});const rightStart=ops.length;ops.push({code:'EphemeralData',p1:dup,p2:rightBase,count:inner.columns.length});const lhs=(a.side===0?base:rightBase)+a.index,rhs=(b.side===0?base:rightBase)+b.index,test=output+projected.length;ops.push({code:'Binary',op:'=',p1:lhs,p2:rhs,p3:test,collation:'binary'});const skip=ops.length;ops.push({code:'IfNot',p1:test,p2:0});projected.forEach((v,i)=>ops.push({code:'Copy',p1:(v!.side===0?base:rightBase)+v!.index,p2:output+i}));ops.push({code:'ResultRow',p1:output,p2:projected.length});const nextRight=ops.length;ops.push({code:'EphemeralNext',p1:dup,p2:rightStart},{code:'EphemeralNext',p1:owner,p2:leftStart});const halt=ops.length;ops.push({code:'Halt'});(ops[rewindLeft] as {p2:number}).p2=halt;(ops[rewindRight] as {p2:number}).p2=nextRight+1;(ops[skip] as {p2:number}).p2=nextRight;
 const columns=projected.map((v,i)=>{const source=inner.columns[v!.index]!;return Object.freeze({...source,name:select.result[i]!.alias??names[v!.index]!})});return Object.freeze({ops:Object.freeze(ops),registers:test,encoding:database.encoding,columns:Object.freeze(columns),parameters:Object.freeze([]),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits});
}


/** select.c CteUse eM10d/addrM9e materialization route for the represented
 * two-source graph. One fill is emitted per declaration identity and repeated
 * references receive OpenDup cursors with independent positions. */
function compileCteDerivedSources(select:SelectNode,schema:SchemaGraph,database:BtreeDatabase,maxRows:number,maxWorkUnits:number,maxResultBytes:number,privateStateLimits:PrivateStateLimits):Program|undefined {
 const sources=select.from.cteDerived;if(!sources?.length||sources.length!==select.from.items.length||sources.length>2||select.hasDistinct||select.hasGroupBy||select.hasHaving||select.hasCompound||select.limit||select.offset)return undefined;
 const compiled=new Map<object,Program>(),names:(readonly string[])[]=[];
 for(const source of sources){let inner=compiled.get(source.use);if(!inner){inner=source.select.from.items.length?compileTableSelect(source.select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits):compileScalarSelect(source.select,database.encoding,maxWorkUnits,maxResultBytes,privateStateLimits,schema,database,maxRows);if(inner.parameters.length)return undefined;compiled.set(source.use,inner);}names[source.index]=uniqueTransientColumnNames(source.select.result.map((e,i)=>e.alias??inner!.columns[i]?.name??`column${i+1}`));}
 const direct=(tree:Expression):{source:number;column:number}|null=>{if(tree.kind!=="column")return null;const parts=tree.name.split('.').map(sqlName),name=parts.at(-1)!;let candidates=sources;if(parts.length===2)candidates=sources.filter(source=>sqliteIdentifierEqual(source.alias,parts[0]!));else if(parts.length!==1)return null;const found=candidates.flatMap(source=>{const column=names[source.index]!.findIndex(n=>sqliteIdentifierEqual(n,name));return column<0?[]:[{source:source.index,column}]});return found.length===1?found[0]!:null;};
 const projected=select.result.map(e=>e.reduction?direct(expressionFromReduction(e.reduction)):null);if(projected.some(x=>x===null))return undefined;
 let predicate:{left:{source:number;column:number};right:{source:number;column:number}}|null=null;if(sources.length===2&&select.from.items[1]!.on?.reduction){const tree=expressionFromReduction(select.from.items[1]!.on!.reduction!);if(tree.kind!=="binary"||tree.op!=="=")return undefined;const left=direct(tree.left),right=direct(tree.right);if(!left||!right)return undefined;predicate={left,right};}else if(sources.length===2&&!select.from.items[1]!.joinFromLeft.cross)return undefined;
 if(select.orderBy.length>1)return undefined;if(select.orderBy.length===1){let tree=expressionFromReduction(select.orderBy[0]!.expr.reduction!);while(tree.kind==='collate')tree=tree.value;if(tree.kind!=="literal"||tree.value!==1n||select.orderBy[0]!.descending||select.orderBy[0]!.nulls!==null)return undefined;}
 const ops:Op[]=[],owners=new Map<object,number>(),cursors:number[]=[],ends:{at:number;owner:number}[]=[];let registers=0,nextCursor=60;
 for(const source of sources){const prior=owners.get(source.use);if(prior!==undefined){const cursor=nextCursor++;ops.push({code:'OpenDup',p1:cursor,p2:prior});cursors[source.index]=cursor;continue;}const inner=compiled.get(source.use)!,owner=nextCursor++;owners.set(source.use,owner);cursors[source.index]=owner;registers=Math.max(registers,inner.registers);const keyInfo=new KeyInfo({encoding:database.encoding,totalFieldCount:inner.columns.length,keyFieldCount:inner.columns.length,terms:inner.columns.map(()=>({collation:'binary'}))});ops.push({code:'OpenEphemeral',p1:owner,keyInfo});const ret=++registers,gosub=ops.length;ops.push({code:'Gosub',p1:ret,p2:0},{code:'Goto',p2:0});const skipProducer=gosub+1,base=ops.length;(ops[gosub] as {p2:number}).p2=base;for(const original of inner.ops){let op:Op=original;if('p2' in op&&['Goto','Rewind','IfNot','Next','DecrJumpZero','IfNotZero','IfPos','SorterNext'].includes(op.code))op={...op,p2:op.p2+base} as Op;if(op.code==='SorterSort')op={...op,emptyJump:op.emptyJump+base};if('jump' in op&&typeof op.jump==='number')op={...op,jump:op.jump+base} as Op;if(op.code==='ResultRow')ops.push({code:'IdxInsert',p1:owner,keyStart:op.p1,keyCount:op.p2});else if(op.code==='Halt'){ends.push({at:ops.length,owner});ops.push({code:'Goto',p2:0});}else ops.push(op);}const finish=ops.length;for(const end of ends.filter(e=>e.owner===owner))(ops[end.at] as {p2:number}).p2=finish;ops.push({code:'Return',p1:ret});const consumer=ops.length;(ops[skipProducer] as {p2:number}).p2=consumer;ops.push({code:'EphemeralSort',p1:owner});}
 const bases=sources.map(source=>{const base=++registers;registers+=compiled.get(source.use)!.columns.length-1;return base;}),rewinds:number[]=[],starts:number[]=[];for(const source of sources){rewinds[source.index]=ops.length;ops.push({code:'EphemeralRewind',p1:cursors[source.index]!,p2:0});starts[source.index]=ops.length;ops.push({code:'EphemeralData',p1:cursors[source.index]!,p2:bases[source.index]!,count:compiled.get(source.use)!.columns.length});}
 let skip:number|undefined;if(predicate){const test=++registers,at=(ref:{source:number;column:number})=>bases[ref.source]!+ref.column;ops.push({code:'Binary',op:'=',p1:at(predicate.left),p2:at(predicate.right),p3:test,collation:'binary'});skip=ops.length;ops.push({code:'IfNot',p1:test,p2:0});}const output=++registers;registers+=projected.length-1;projected.forEach((v,i)=>ops.push({code:'Copy',p1:bases[v!.source]!+v!.column,p2:output+i}));ops.push({code:'ResultRow',p1:output,p2:projected.length});const next:number[]=[];for(let i=sources.length-1;i>=0;i--){next[i]=ops.length;ops.push({code:'EphemeralNext',p1:cursors[i]!,p2:starts[i]!});}const halt=ops.length;ops.push({code:'Halt'});for(let i=0;i<sources.length;i++)(ops[rewinds[i]!] as {p2:number}).p2=i?next[i-1]!:halt;if(skip!==undefined)(ops[skip] as {p2:number}).p2=next.at(-1)!;
 const columns=projected.map((v,i)=>Object.freeze({...compiled.get(sources[v!.source]!.use)!.columns[v!.column]!,name:select.result[i]!.alias??names[v!.source]![v!.column]!}));return Object.freeze({ops:Object.freeze(ops),registers,encoding:database.encoding,columns:Object.freeze(columns),parameters:Object.freeze([]),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits});
}

/** Initial resolve.c/select.c-shaped single rowid-table full-scan compiler. */
export function compileTableSelect(select: SelectNode, schema: SchemaGraph, database: BtreeDatabase, maxRows: number, maxWorkUnits = 10_000_000, maxResultBytes = 1_000_000_000, privateStateLimits:PrivateStateLimits=DEFAULT_PRIVATE_STATE_LIMITS): Program {
  // json.c's eponymous-only JSON table cursors.  Inputs are evaluated by the
  // ordinary expression VM, then xFilter-shaped state is owned by the statement.
  const jsonNames=new Set(["json_each","json_tree","jsonb_each","jsonb_tree"]);
  if(select.from.items.length===2&&!jsonNames.has(select.from.items[0]!.tableName.toLowerCase())&&jsonNames.has(select.from.items[1]!.tableName.toLowerCase())){
    if(select.hasOrderBy||select.hasGroupBy||select.hasHaving||select.hasDistinct||select.hasLimit)throw new JSQLiteError("unsupported","this mixed JSON table composition is not implemented",{unsupportedClassification:"temporary"});
    const physicalItem=select.from.items[0]!,jsonItem=select.from.items[1]!,table=schema.tables.get(sqliteAsciiFold(physicalItem.tableName));if(!table)throw new JSQLiteError("sqlite",`no such table: ${physicalItem.tableName}`,{code:1});if(table.withoutRowid||table.columns.some(column=>column.generatedExpr))throw new JSQLiteError("unsupported","this table storage shape is not implemented",{unsupportedClassification:"temporary"});
    const parameters:ParameterBuilder={maximum:0,names:[],named:new Map()},ops:Op[]=[];let registers=0;const allocate=()=>++registers,rowStart=1;registers=JSON_TABLE_COLUMNS.length;
    const bind=(tree:Expression,jsonAvailable:boolean):Expression=>{if(tree.kind==="column"){const parts=tree.name.split('.'),name=parts.at(-1)!,qualifier=parts.length>1?parts.at(-2)!:null,physicalQualifier=physicalItem.alias??physicalItem.tableName,jsonQualifier=jsonItem.alias??jsonItem.tableName;const physicalIndex=(!qualifier||sqliteIdentifierEqual(qualifier,physicalQualifier))?table.columns.findIndex(column=>sqliteIdentifierEqual(column.name,name)):-1,jsonIndex=jsonAvailable&&(!qualifier||sqliteIdentifierEqual(qualifier,jsonQualifier))?JSON_TABLE_COLUMNS.findIndex(column=>sqliteIdentifierEqual(column,name)):-1;if(physicalIndex>=0&&jsonIndex>=0)throw new JSQLiteError("sqlite",`ambiguous column name: ${name}`,{code:1});if(jsonIndex>=0)return{kind:"register",index:rowStart+jsonIndex};if(physicalIndex>=0){tree.cursor=0;tree.index=isIntegerPrimaryKeyAlias(table,physicalIndex)?-1:physicalIndex;tree.affinity=affinityOf(table.columns[physicalIndex]!.declaredType??"");tree.collation=sqliteAsciiFold(table.columns[physicalIndex]!.collation??"binary") as BuiltinCollation;return tree;}throw new JSQLiteError("sqlite",`no such column: ${tree.name}`,{code:1});}if(tree.kind==="unary")return{...tree,value:bind(tree.value,jsonAvailable)};if(tree.kind==="binary")return{...tree,left:bind(tree.left,jsonAvailable),right:bind(tree.right,jsonAvailable)};if(tree.kind==="collate"||tree.kind==="cast")return{...tree,value:bind(tree.value,jsonAvailable)};if(tree.kind==="call")return{...tree,args:tree.args.map(arg=>bind(arg,jsonAvailable))};return tree;};
    const args=jsonItem.arguments;if(!args||args.length<1||args.length>2||args.some(arg=>!arg.reduction))throw new JSQLiteError("unsupported","this JSON table argument is not implemented",{unsupportedClassification:"temporary"});ops.push({code:"OpenRead",p1:table.rootPage,p2:0});const outerRewind=ops.length;ops.push({code:"Rewind",p1:0,p2:0});const outerLoop=ops.length,input=compileExpressionTree(bind(expressionFromReduction(args[0]!.reduction!),false),ops,allocate,parameters),root=args[1]?.reduction?compileExpressionTree(bind(expressionFromReduction(args[1].reduction),false),ops,allocate,parameters):undefined,innerRewind=ops.length;ops.push({code:"JsonTableRewind",p1:1,input,...(root===undefined?{}:{root}),recursive:jsonItem.tableName.toLowerCase().endsWith("tree"),binaryContainers:jsonItem.tableName.toLowerCase().startsWith("jsonb_"),rowStart,p2:0});const innerLoop=ops.length;let skip:number|null=null;const predicates=[jsonItem.on,select.where].filter((value):value is NonNullable<typeof value>=>value!==null);if(predicates.length){let predicate=bind(expressionFromReduction(predicates[0]!.reduction!),true);for(const item of predicates.slice(1))predicate={kind:"binary",op:"and",left:predicate,right:bind(expressionFromReduction(item.reduction!),true)};const test=compileExpressionTree(predicate,ops,allocate,parameters,undefined,true);skip=ops.length;ops.push({code:"IfNot",p1:test,p2:0});}const outputs=select.result.map(result=>{if(!result.reduction)throw new JSQLiteError("unsupported","this mixed JSON projection is not implemented",{unsupportedClassification:"temporary"});return compileExpressionTree(bind(expressionFromReduction(result.reduction),true),ops,allocate,parameters)}),out=registers+1;for(const output of outputs){registers++;ops.push({code:"Copy",p1:output,p2:registers});}ops.push({code:"ResultRow",p1:out,p2:outputs.length});const innerNext=ops.length;if(skip!==null)(ops[skip] as {p2:number}).p2=innerNext;ops.push({code:"JsonTableNext",p1:1,rowStart,p2:innerLoop});const outerNext=ops.length;(ops[innerRewind] as {p2:number}).p2=outerNext;ops.push({code:"Next",p1:0,p2:outerLoop});const halt=ops.length;(ops[outerRewind] as {p2:number}).p2=halt;ops.push({code:"Halt"});return Object.freeze({ops:Object.freeze(ops),registers,encoding:database.encoding,columns:Object.freeze(select.result.map(result=>Object.freeze({name:result.alias??expressionName(result),declaredType:null,database:null,table:null,origin:null}))),parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits});
  }
  if(select.from.items.length===2&&select.from.items.every(item=>jsonNames.has(item.tableName.toLowerCase()))){
    if(select.hasOrderBy||select.hasGroupBy||select.hasHaving||select.hasDistinct||select.hasLimit)throw new JSQLiteError("unsupported","this correlated JSON table composition is not implemented",{unsupportedClassification:"temporary"});
    const parameters:ParameterBuilder={maximum:0,names:[],named:new Map()},ops:Op[]=[];let registers=0;const allocate=()=>++registers;
    const starts=[0,0],bind=(tree:Expression,available:number):Expression=>{
      if(tree.kind==="column"){
        const parts=tree.name.split('.'),name=parts.at(-1)!,qualified=parts.length>1?parts.at(-2)!:null;const candidates=select.from.items.slice(0,available).flatMap((item,index)=>qualified&&!sqliteIdentifierEqual(qualified,item.alias??item.tableName)?[]:[[index,JSON_TABLE_COLUMNS.findIndex(column=>sqliteIdentifierEqual(column,name))] as const]).filter(([,column])=>column>=0);
        if(candidates.length!==1)throw new JSQLiteError("sqlite",candidates.length?`ambiguous column name: ${tree.name}`:`no such column: ${tree.name}`,{code:1});return{kind:"register",index:starts[candidates[0]![0]]!+candidates[0]![1]};
      }
      if(tree.kind==="unary")return{...tree,value:bind(tree.value,available)};if(tree.kind==="binary")return{...tree,left:bind(tree.left,available),right:bind(tree.right,available)};if(tree.kind==="collate"||tree.kind==="cast")return{...tree,value:bind(tree.value,available)};if(tree.kind==="call")return{...tree,args:tree.args.map(value=>bind(value,available))};return tree;
    };
    const open=(index:number):{rewind:number;loop:number}=>{const item=select.from.items[index]!,args=item.arguments;if(!args||args.length<1||args.length>2||args.some(arg=>!arg.reduction))throw new JSQLiteError("unsupported","this JSON table argument is not implemented",{unsupportedClassification:"temporary"});const input=compileExpressionTree(bind(expressionFromReduction(args[0]!.reduction!),index),ops,allocate,parameters),root=args[1]?.reduction?compileExpressionTree(bind(expressionFromReduction(args[1].reduction),index),ops,allocate,parameters):undefined;starts[index]=registers+1;registers+=JSON_TABLE_COLUMNS.length;const rewind=ops.length;ops.push({code:"JsonTableRewind",p1:index,input,...(root===undefined?{}:{root}),recursive:item.tableName.toLowerCase().endsWith("tree"),binaryContainers:item.tableName.toLowerCase().startsWith("jsonb_"),rowStart:starts[index]!,p2:0});return{rewind,loop:ops.length};};
    const outer=open(0),inner=open(1);let skip:number|null=null;if(select.where?.reduction){const predicate=compileExpressionTree(bind(expressionFromReduction(select.where.reduction),2),ops,allocate,parameters,undefined,true);skip=ops.length;ops.push({code:"IfNot",p1:predicate,p2:0});}
    const outputs=select.result.map(result=>{if(!result.reduction)throw new JSQLiteError("unsupported","this correlated JSON projection is not implemented",{unsupportedClassification:"temporary"});return compileExpressionTree(bind(expressionFromReduction(result.reduction),2),ops,allocate,parameters)}),outputStart=registers+1;for(const output of outputs){registers++;ops.push({code:"Copy",p1:output,p2:registers});}ops.push({code:"ResultRow",p1:outputStart,p2:outputs.length});const innerNext=ops.length;if(skip!==null)(ops[skip] as {p2:number}).p2=innerNext;ops.push({code:"JsonTableNext",p1:1,rowStart:starts[1]!,p2:inner.loop});const outerNext=ops.length;(ops[inner.rewind] as {p2:number}).p2=outerNext;ops.push({code:"JsonTableNext",p1:0,rowStart:starts[0]!,p2:outer.loop});const halt=ops.length;(ops[outer.rewind] as {p2:number}).p2=halt;ops.push({code:"Halt"});
    return Object.freeze({ops:Object.freeze(ops),registers,encoding:database.encoding,columns:Object.freeze(select.result.map(result=>Object.freeze({name:result.alias??expressionName(result),declaredType:null,database:null,table:null,origin:null}))),parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits});
  }
  const jsonTableName=select.from.items.length===1?select.from.items[0]!.tableName.toLowerCase():"";
  if(jsonTableName==="json_each"||jsonTableName==="json_tree"||jsonTableName==="jsonb_each"||jsonTableName==="jsonb_tree"){
    if(select.hasDistinct)throw new JSQLiteError("unsupported",`this ${jsonTableName} composition is not implemented`,{unsupportedClassification:"temporary"});
    const source=select.from.items[0]!,args=source.arguments;
    if(args===null||args.length<1||args.length>2||args.some(arg=>!arg.reduction))throw new JSQLiteError("unsupported",`this ${jsonTableName} argument is not implemented`,{unsupportedClassification:"temporary"});
    const parameters:ParameterBuilder={maximum:0,names:[],named:new Map()},ops:Op[]=[];let registers=0;const allocate=()=>++registers;
    const input=compileExpressionTree(expressionFromReduction(args[0]!.reduction!),ops,allocate,parameters);
    const root=args.length===2?compileExpressionTree(expressionFromReduction(args[1]!.reduction!),ops,allocate,parameters):undefined;
    const limit=computeLimitRegisters(select,ops,allocate,parameters);
    const rowStart=registers+1;registers+=JSON_TABLE_COLUMNS.length;
    const bindColumns=(tree:Expression):Expression=>{
      if(tree.kind==="column"){
        const name=tree.name.split('.').at(-1)!,index=JSON_TABLE_COLUMNS.findIndex(column=>sqliteIdentifierEqual(column,name));
        if(index<0)throw new JSQLiteError("unsupported",`this ${jsonTableName} column is not implemented`,{unsupportedClassification:"temporary"});
        return {kind:"register",index:rowStart+index};
      }
      if(tree.kind==="unary")return{...tree,value:bindColumns(tree.value)};
      if(tree.kind==="binary")return{...tree,left:bindColumns(tree.left),right:bindColumns(tree.right)};
      if(tree.kind==="collate"||tree.kind==="cast")return{...tree,value:bindColumns(tree.value)};
      if(tree.kind==="call")return{...tree,args:tree.args.map(bindColumns)};
      if(tree.kind==="aggregate")return{...tree,args:tree.args.map(bindColumns),filter:tree.filter&&bindColumns(tree.filter),orderBy:tree.orderBy.map(term=>({...term,expression:bindColumns(term.expression)}))};
      if(tree.kind==="case")return{...tree,operand:tree.operand&&bindColumns(tree.operand),pairs:tree.pairs.map(([x,y])=>[bindColumns(x),bindColumns(y)]),otherwise:tree.otherwise&&bindColumns(tree.otherwise)};
      return tree;
    };
    const starProjection=select.result.length===1&&select.result[0]!.tokens.length===1&&select.result[0]!.tokens[0]!.text==="*";
    const resultTrees=starProjection?[]:select.result.map(result=>{if(!result.reduction)throw new JSQLiteError("unsupported",`this ${jsonTableName} projection is not implemented`,{unsupportedClassification:"temporary"});return bindColumns(expressionFromReduction(result.reduction));});
    const groupTrees=select.groupBy.map(group=>{if(!group.reduction)throw new JSQLiteError("unsupported",`this ${jsonTableName} grouping is not implemented`,{unsupportedClassification:"temporary"});return bindColumns(expressionFromReduction(group.reduction));});
    const groupedEntries=resultTrees.map(tree=>tree.kind==="aggregate"&&!tree.distinct&&!tree.filter&&!tree.orderBy.length?tree:null);
    const groupedOutput=resultTrees.every(tree=>tree.kind==="aggregate"||tree.kind==="register"&&groupTrees.some(group=>group.kind==="register"&&group.index===tree.index));
    if(select.hasGroupBy&&groupTrees.length&&groupedOutput&&!select.hasOrderBy){
      const sorter=1,keyCount=groupTrees.length,keyInfo=new KeyInfo({encoding:database.encoding,totalFieldCount:keyCount,keyFieldCount:keyCount,terms:groupTrees.map(group=>({collation:collation(group)}))}),states=groupedEntries.map(entry=>entry?allocate():0),sorted=registers+1;registers+=keyCount+JSON_TABLE_COLUMNS.length;const saved=registers+1;registers+=keyCount;ops.push({code:"SorterOpen",p1:sorter,keyInfo});const rewind=ops.length;ops.push({code:"JsonTableRewind",p1:0,input,...(root===undefined?{}:{root}),recursive:jsonTableName.endsWith("tree"),binaryContainers:jsonTableName.startsWith("jsonb_"),rowStart,p2:0});const loop=ops.length;let skip:number|null=null;if(select.where?.reduction){const predicate=compileExpressionTree(bindColumns(expressionFromReduction(select.where.reduction)),ops,allocate,parameters,undefined,true);skip=ops.length;ops.push({code:"IfNot",p1:predicate,p2:0});}const keys=groupTrees.map(group=>compileExpressionTree(group,ops,allocate,parameters)),record=registers+1;registers+=keyCount+JSON_TABLE_COLUMNS.length;keys.forEach((key,index)=>ops.push({code:"Copy",p1:key,p2:record+index}));for(let i=0;i<JSON_TABLE_COLUMNS.length;i++)ops.push({code:"Copy",p1:rowStart+i,p2:record+keyCount+i});ops.push({code:"SorterInsert",p1:sorter,keyStart:record,keyCount,payload:record,payloadCount:keyCount+JSON_TABLE_COLUMNS.length});const next=ops.length;if(skip!==null)(ops[skip] as {p2:number}).p2=next;ops.push({code:"JsonTableNext",p1:0,rowStart,p2:loop});const sort=ops.length;(ops[rewind] as {p2:number}).p2=sort;ops.push({code:"SorterSort",p1:sorter,emptyJump:0},{code:"SorterData",p1:sorter,p2:sorted,count:keyCount+JSON_TABLE_COLUMNS.length});for(let i=0;i<keyCount;i++)ops.push({code:"Copy",p1:sorted+i,p2:saved+i});
      const havingTree=select.having?.reduction?bindColumns(expressionFromReduction(select.having.reduction)):null;
      const finalized=(tree:Expression):Expression=>{if(tree.kind==="aggregate"){const index=groupedEntries.findIndex(entry=>entry!==null&&entry.name===tree.name&&entry.args.length===tree.args.length&&entry.args.every((arg,i)=>sameExpression(arg,tree.args[i]!)));if(index<0)throw new JSQLiteError("unsupported",`this ${jsonTableName} HAVING aggregate is not projected`,{unsupportedClassification:"temporary"});return{kind:"register",index:states[index]!};}if(tree.kind==="unary")return{...tree,value:finalized(tree.value)};if(tree.kind==="binary")return{...tree,left:finalized(tree.left),right:finalized(tree.right)};if(tree.kind==="collate"||tree.kind==="cast")return{...tree,value:finalized(tree.value)};if(tree.kind==="call")return{...tree,args:tree.args.map(finalized)};return tree;};
      const emitSteps=()=>groupedEntries.forEach((entry,index)=>{if(entry){const args=entry.args.map(arg=>{const rebound=arg.kind==="register"?{kind:"register",index:sorted+keyCount+(arg.index-rowStart)} as Expression:arg;return compileExpressionTree(rebound,ops,allocate,parameters)});ops.push({code:"AggStep",name:entry.name,args,p2:states[index]!,collation:entry.collation});}}),emitGroup=()=>{groupedEntries.forEach((entry,index)=>{if(entry)ops.push({code:"AggFinal",name:entry.name,p1:states[index]!})});let reject:number|null=null;if(havingTree){const test=compileExpressionTree(finalized(havingTree),ops,allocate,parameters);reject=ops.length;ops.push({code:"IfNot",p1:test,p2:0});}const out=registers+1;for(let i=0;i<resultTrees.length;i++){registers++;const tree=resultTrees[i]!,source=tree.kind==="aggregate"?states[i]!:saved+groupTrees.findIndex(group=>group.kind==="register"&&tree.kind==="register"&&group.index===tree.index);ops.push({code:"Copy",p1:source,p2:out+i});}ops.push({code:"ResultRow",p1:out,p2:resultTrees.length});if(reject!==null)(ops[reject] as {p2:number}).p2=ops.length;};
      const step=ops.length;emitSteps();const advance=ops.length;ops.push({code:"SorterNext",p1:sorter,p2:0},{code:"Goto",p2:0});const nextRow=ops.length;(ops[advance] as {p2:number}).p2=nextRow;ops.push({code:"SorterData",p1:sorter,p2:sorted,count:keyCount+JSON_TABLE_COLUMNS.length});const compare=ops.length;ops.push({code:"CompareGroup",left:sorted,right:saved,count:keyCount,keyInfo,jump:step});emitGroup();ops.push({code:"AggReset",registers:states.filter(Boolean)});for(let i=0;i<keyCount;i++)ops.push({code:"Copy",p1:sorted+i,p2:saved+i});ops.push({code:"Goto",p2:step});const finish=ops.length;(ops[advance+1] as {p2:number}).p2=finish;emitGroup();const halt=ops.length;(ops[sort] as {emptyJump:number}).emptyJump=halt;ops.push({code:"Halt"});return Object.freeze({ops:Object.freeze(ops),registers,encoding:database.encoding,columns:Object.freeze(select.result.map(result=>Object.freeze({name:result.alias??expressionName(result),declaredType:null,database:null,table:jsonTableName,origin:null}))),parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits});
    }
    const aggregateOnly=resultTrees.length>0&&resultTrees.every(tree=>tree.kind==="aggregate"&&!tree.distinct&&!tree.filter&&!tree.orderBy.length);
    if(aggregateOnly){
      const states=resultTrees.map(()=>allocate()),rewind=ops.length;ops.push({code:"JsonTableRewind",p1:0,input,...(root===undefined?{}:{root}),recursive:jsonTableName.endsWith("tree"),binaryContainers:jsonTableName.startsWith("jsonb_"),rowStart,p2:0});const loop=ops.length;let skip:number|null=null;if(select.where?.reduction){const predicate=compileExpressionTree(bindColumns(expressionFromReduction(select.where.reduction)),ops,allocate,parameters,undefined,true);skip=ops.length;ops.push({code:"IfNot",p1:predicate,p2:0});}resultTrees.forEach((tree,index)=>{const aggregate=tree as Extract<Expression,{kind:"aggregate"}>,args=aggregate.args.map(arg=>compileExpressionTree(arg,ops,allocate,parameters));ops.push({code:"AggStep",name:aggregate.name,args,p2:states[index]!,collation:aggregate.collation});});const next=ops.length;if(skip!==null)(ops[skip] as {p2:number}).p2=next;ops.push({code:"JsonTableNext",p1:0,rowStart,p2:loop});const finish=ops.length;(ops[rewind] as {p2:number}).p2=finish;resultTrees.forEach((tree,index)=>ops.push({code:"AggFinal",name:(tree as Extract<Expression,{kind:"aggregate"}>).name,p1:states[index]!}));const outputStart=registers+1;for(const state of states){registers++;ops.push({code:"Copy",p1:state,p2:registers});}ops.push({code:"ResultRow",p1:outputStart,p2:states.length},{code:"Halt"});return Object.freeze({ops:Object.freeze(ops),registers,encoding:database.encoding,columns:Object.freeze(select.result.map(result=>Object.freeze({name:result.alias??expressionName(result),declaredType:null,database:null,table:jsonTableName,origin:null}))),parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits});
    }
    if(resultTrees.some(tree=>tree.kind==="aggregate"))throw new JSQLiteError("unsupported",`this ${jsonTableName} aggregate composition is not implemented`,{unsupportedClassification:"temporary"});
    const sorter=select.hasOrderBy?1:null;
    if(sorter!==null)ops.push({code:"SorterOpen",p1:sorter,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:select.orderBy.length,keyFieldCount:select.orderBy.length,terms:select.orderBy.map(term=>({collation:collation(expressionFromReduction(term.expr.reduction!)),desc:term.descending,nullsLarge:term.nulls==="last"?!term.descending:term.nulls==="first"?term.descending:false}))})});
    const rewind=ops.length;ops.push({code:"JsonTableRewind",p1:0,input,...(root===undefined?{}:{root}),recursive:jsonTableName.endsWith("tree"),binaryContainers:jsonTableName.startsWith("jsonb_"),rowStart,p2:0});
    const loop=ops.length;let predicateJump:number|null=null;
    if(select.where?.reduction){const predicate=compileExpressionTree(bindColumns(expressionFromReduction(select.where.reduction)),ops,allocate,parameters,undefined,true);predicateJump=ops.length;ops.push({code:"IfNot",p1:predicate,p2:0});}
    const star=select.result.length===1&&select.result[0]!.tokens.length===1&&select.result[0]!.tokens[0]!.text==="*";
    const outputs=star?JSON_EACH_COLUMNS.map((_,i)=>rowStart+i):resultTrees.map(tree=>compileExpressionTree(tree,ops,allocate,parameters));
    // ResultRow and sorter payloads require contiguous registers.
    const contiguous=outputs.every((value,index)=>value===outputs[0]!+index);let outputStart=outputs[0]!;
    if(!contiguous){outputStart=registers+1;for(const value of outputs){registers++;ops.push({code:"Copy",p1:value,p2:registers});}}
    if(sorter!==null){
      const keys=select.orderBy.map(term=>{const tree=expressionFromReduction(term.expr.reduction!);if(tree.kind==="literal"&&typeof tree.value==="bigint"&&tree.value>=1n&&tree.value<=BigInt(outputs.length))return outputs[Number(tree.value)-1]!;if(tree.kind==="column"){const alias=select.result.findIndex(result=>result.alias&&sqliteIdentifierEqual(result.alias,tree.name));if(alias>=0)return outputs[alias]!;}return compileExpressionTree(bindColumns(tree),ops,allocate,parameters);});
      const keyStart=registers+1;for(const key of keys){registers++;ops.push({code:"Copy",p1:key,p2:registers});}
      ops.push({code:"SorterInsert",p1:sorter,keyStart,keyCount:keys.length,payload:outputStart,payloadCount:outputs.length});
    }else{
      let offsetSkip:number|null=null;if(limit?.offset!==undefined){offsetSkip=ops.length;ops.push({code:"IfPos",p1:limit.offset,p2:0,p3:1});}
      ops.push({code:"ResultRow",p1:outputStart,p2:outputs.length});
      let limitDone:number|null=null;if(limit){limitDone=ops.length;ops.push({code:"DecrJumpZero",p1:limit.count,p2:0});}
      const next=ops.length;if(predicateJump!==null)(ops[predicateJump] as {p2:number}).p2=next;if(offsetSkip!==null)(ops[offsetSkip] as {p2:number}).p2=next;ops.push({code:"JsonTableNext",p1:0,rowStart,p2:loop});const halt=ops.length;(ops[rewind] as {p2:number}).p2=halt;if(limitDone!==null)(ops[limitDone] as {p2:number}).p2=halt;if(limit)(ops[limit.ifZero] as {p2:number}).p2=halt;ops.push({code:"Halt"});
    }
    if(sorter!==null){
      const next=ops.length;if(predicateJump!==null)(ops[predicateJump] as {p2:number}).p2=next;ops.push({code:"JsonTableNext",p1:0,rowStart,p2:loop});const sort=ops.length;(ops[rewind] as {p2:number}).p2=sort;ops.push({code:"SorterSort",p1:sorter,emptyJump:0},{code:"SorterData",p1:sorter,p2:outputStart,count:outputs.length});let offsetSkip:number|null=null;if(limit?.offset!==undefined){offsetSkip=ops.length;ops.push({code:"IfPos",p1:limit.offset,p2:0,p3:1});}ops.push({code:"ResultRow",p1:outputStart,p2:outputs.length});let limitDone:number|null=null;if(limit){limitDone=ops.length;ops.push({code:"DecrJumpZero",p1:limit.count,p2:0});}const advance=ops.length;if(offsetSkip!==null)(ops[offsetSkip] as {p2:number}).p2=advance;ops.push({code:"SorterNext",p1:sorter,p2:sort+1});const halt=ops.length;(ops[sort] as {emptyJump:number}).emptyJump=halt;if(limitDone!==null)(ops[limitDone] as {p2:number}).p2=halt;if(limit)(ops[limit.ifZero] as {p2:number}).p2=halt;ops.push({code:"Halt"});
    }
    const names=star?[...JSON_EACH_COLUMNS]:select.result.map(expressionName);
    return Object.freeze({ops:Object.freeze(ops),registers,encoding:database.encoding,columns:Object.freeze(names.map((name,i)=>Object.freeze({name:select.result[i]?.alias??name,declaredType:null,database:null,table:jsonTableName,origin:star?name:null}))),parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits});
  }
  // Route a compound owner before treating its select-level first-arm carrier
  // as a standalone derived source, which would silently discard later arms.
  if(select.hasCompound){rejectUnsupportedSelectClauses(select, true);return compileCteUnionAll(select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits)??compileJoinedUnionAll(select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits)??compileSimpleTableCompound(select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits);}
  const cteSources=compileCteDerivedSources(select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits);if(cteSources)return cteSources;
  const repeatedView=compileRepeatedImmutableView(select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits);if(repeatedView)return repeatedView;
  const compoundDerived=compileSingleCompoundDerived(select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits);if(compoundDerived)return compoundDerived;
  const derived=select.from.derived;
  if(derived&&derived.index===0&&select.from.items.length===1&&!selectHasWindow(derived.select)&&!derived.select.hasDistinct&&!derived.select.hasGroupBy&&!derived.select.hasHaving&&!derived.select.hasOrderBy&&!derived.select.hasLimit&&!derived.select.hasCompound&&derived.select.from.items.length===1){
    // select.c:flattenSubquery, bounded ordinary/window-parent form. Ordinary
    // CTE lowering deliberately retains the CTE name as a synthetic SrcItem;
    // substitute its transient result expressions before resolution so the
    // window rewrite sees the real producer rather than opening that name as
    // a schema table. This is the same bounded flattening contract used by the
    // aggregate parent below, including substitution inside OVER reductions.
    const names=uniqueTransientColumnNames(derived.select.result.map(expression=>expression.alias??expressionName(expression)));
    const columns=new Map(derived.select.result.map((expression,index)=>[sqliteAsciiFold(names[index]!),expression]));
    const qualifier=select.from.items[0]!.alias??select.from.items[0]!.tableName;
    const result=Object.freeze(select.result.map(expression=>substituteViewExpression(expression,columns,qualifier)));
    const groupBy=Object.freeze(select.groupBy.map(expression=>substituteViewExpression(expression,columns,qualifier)));
    const having=select.having?substituteViewExpression(select.having,columns,qualifier):null;
    const orderBy=Object.freeze(select.orderBy.map(term=>Object.freeze({...term,expr:substituteViewExpression(term.expr,columns,qualifier)})));
    const outerWhere=select.where?substituteViewExpression(select.where,columns,qualifier):null;
    const where=andViewPredicates(derived.select.where,outerWhere);
    const flattened=Object.freeze({...select,result,groupBy,having,orderBy,from:derived.select.from,where,hasSubquery:derived.select.hasSubquery,tokens:select.tokens});
    return compileTableSelect(flattened,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits);
  }
  const materialized=compileDerivedProducer(select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits);if(materialized)return materialized;
  // select.c:selectExpander turns an immutable schema view into its stored
  // generated Select. This first flattenable tranche never reparses schema SQL.
  if(select.from.items.length===1){
    const source=select.from.items[0]!,view=schema.views.get(sqliteAsciiFold(sqlName(source.tableName)));
    if(view){
      const expandedView=flattenImmutableView(select,view);
      return compileTableSelect(expandedView,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits);
    }
  }
  let expanded;
  try { expanded=expandAndResolveSelect(select,schema); }
  catch(error){if(error instanceof NameResolutionError)throw new JSQLiteError("sqlite",error.message,{code:1});throw error;}
  // select.c invokes sqlite3WindowRewrite after resolution/aggregate analysis and
  // before WHERE planning. Construct the complete immutable handoff here. Only
  // residual shapes whose lowering cannot publish every result column reject
  // atomically below, before a Program or Statement is exposed to the caller.
  if(expanded.windows.length){
    let compilation:WindowLoweringCompilation;
    try{compilation=compileWindowSelectLowering(expanded,database.encoding,database,maxWorkUnits,maxResultBytes,privateStateLimits,schema);}
    catch(error){if(error instanceof JSQLiteError&&error.kind==="unsupported"){throw new JSQLiteError("unsupported","window functions are not implemented",{unsupportedClassification:"temporary"});}throw error;}
    // Publish only the source-shaped tranche whose complete result list and
    // frame execution were proven by the lowering. A zero-column Program is
    // the atomic unsupported marker for every mixed or incomplete shape.
    if(compilation.program.columns.length===expanded.result.length&&expanded.result.length>0){
      return Object.freeze({...compilation.program,database,maxRows});
    }
    throw new JSQLiteError("unsupported","window functions are not implemented",{unsupportedClassification:"temporary"});
  }
  rejectUnsupportedSelectClauses(select, true);
  if (select.from.items.length > 1) return compileInnerTableSelect(select,expanded,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits);
  if (select.from.items.length !== 1) throw new JSQLiteError("unsupported", "joins and complex FROM clauses are not implemented", { unsupportedClassification: "temporary" });
  const tableName = sqlName(select.from.items[0]!.tableName), folded = sqliteAsciiFold(tableName);
  const table = schema.tables.get(folded);
  if (!table) {
    if (schema.views.has(folded)) throw new JSQLiteError("unsupported", "views are not implemented", { unsupportedClassification: "temporary" });
    throw new JSQLiteError("sqlite", `no such table: ${tableName}`, { code: 1 });
  }
  if (table.withoutRowid || table.columns.some(c => c.generatedExpr)) throw new JSQLiteError("unsupported", "this table storage shape is not implemented", { unsupportedClassification: "temporary" });
  const resolve = (tokens: readonly { text: string }[]): number => {
    let name: string;
    if (tokens.length === 1) name = sqlName(tokens[0]!.text);
    else if (tokens.length === 3 && tokens[1]!.text === "." && sqliteIdentifierEqual(sqlName(tokens[0]!.text), select.from.items[0]!.alias??table.name)) name = sqlName(tokens[2]!.text);
    else throw new JSQLiteError("unsupported", "table expression is not implemented", { unsupportedClassification: "temporary" });
    const at = table.columns.findIndex(c => sqliteIdentifierEqual(c.name, name));
    if(at>=0&&isIntegerPrimaryKeyAlias(table,at))return -1;
    if(at<0&&!table.withoutRowid&&['rowid','_rowid_','oid'].some(x=>sqliteIdentifierEqual(x,name))&&!table.columns.some(c=>sqliteIdentifierEqual(c.name,name)))return -1;
    if (at < 0) throw new JSQLiteError("sqlite", `no such column: ${name}`, { code: 1 });
    return at;
  };
  const resolveExpression=(expression:SelectNode["result"][number],allowAlias=true):Expression=>{
    const assign=(e:Expression):Expression=>{
      if(e.kind==="column"){
        try{e.index=resolve([{text:e.name}]);e.cursor=0;}
        catch(error){const aliases=allowAlias&&!e.name.includes('.')?select.result.filter(item=>item.alias&&sqliteIdentifierEqual(item.alias,e.name)):[];if(aliases[0])return resolveExpression(aliases[0],false);throw error;}
        if(e.index<0){e.affinity='integer';e.collation='binary';return e;}
        const name=sqliteAsciiFold(table.columns[e.index]!.collation??"binary");if(name!=="binary"&&name!=="nocase"&&name!=="rtrim")throw new JSQLiteError("sqlite",`no such collation sequence: ${table.columns[e.index]!.collation}`,{code:1});e.collation=name;e.affinity=affinityOf(table.columns[e.index]!.declaredType??"");return e;
      }
      if(e.kind==="unary"||e.kind==="cast"||e.kind==="collate")e.value=assign(e.value);else if(e.kind==="binary"){e.left=assign(e.left);e.right=assign(e.right)}else if(e.kind==="in-subquery")e.left=assign(e.left);else if(e.kind==="in-list"){e.left=assign(e.left);e.values=e.values.map(assign)}else if(e.kind==="call"||e.kind==="aggregate")e.args=e.args.map(assign);else if(e.kind==="case"){if(e.operand)e.operand=assign(e.operand);e.pairs=e.pairs.map(x=>[assign(x[0]),assign(x[1])]);if(e.otherwise)e.otherwise=assign(e.otherwise)}return e;
    };
    return assign(expressionFromReduction(expression.reduction!));
  };
  // Resolve functions (including arity failures) before rejecting later planning
  // features, as resolve.c does during SELECT preparation.
  select.result.filter(x=>x.reduction&&!expanded.result.some(item=>item.expression===x&&item.columnIndex!==null)).forEach(x=>resolveExpression(x));
  const projected: { column?: number; rowid?:boolean; expression?:Expression; name: string; realAffinity?: boolean }[] = [];
  for (const item of expanded.result) {
    const expression=item.expression;
    if(item.resolution==='coalesce')throw new JSQLiteError("unsupported","FULL JOIN merged-column execution is not implemented",{unsupportedClassification:"temporary"});
    if(item.columnIndex!==null){if(item.columnIndex<0)projected.push({rowid:true,name:item.name});else projected.push({column:item.columnIndex,name:item.name,realAffinity:affinityOf(table.columns[item.columnIndex]!.declaredType??"")==="real"});}
    else { try { const column = resolve(expression.tokens); projected.push({ column, name: expression.alias ?? table.columns[column]!.name, realAffinity: column>=0&&affinityOf(table.columns[column]!.declaredType??"")==="real" }); }
    catch(error){if(!expression.reduction)throw error;projected.push({expression:resolveExpression(expression),name:expressionName(expression)});} }
  }
  let registers = projected.length;
  const tokens=select.tokens,orderAt=tokens.findIndex(t=>t.text.toUpperCase()==="ORDER"),limitAt=tokens.findIndex(t=>t.text.toUpperCase()==="LIMIT");
  // resolve.c:resolveOrderGroupBy walks every ExprList item. Preserve that
  // cardinality here so select.c:pushOntoSorter receives a complete key.
  const orderTerms:{expression:Expression;resultIndex?:number;descending:boolean;nullsLarge:boolean}[]=[];
  if(orderAt>=0){
    for(let termNumber=0;termNumber<select.orderBy.length;termNumber++){
      const term=select.orderBy[termNumber]!,leaf=term.expr.tokens;
      const parsedOrderExpression=expressionFromReduction(term.expr.reduction!);
      // resolve.c:resolveOrderGroupBy calls sqlite3ExprSkipCollateAndLikely()
      // before testing aliases and ordinals. resolveAlias() then substitutes
      // the result expression below the existing TK_COLLATE wrapper.
      let orderIdentity=parsedOrderExpression;
      while(orderIdentity.kind==="collate")orderIdentity=orderIdentity.value;
      let resultIndex=-1;
      if(orderIdentity.kind==="literal"&&typeof orderIdentity.value==="bigint"){
        const ordinal=orderIdentity.value;
        if(ordinal<1n||ordinal>BigInt(projected.length))throw new JSQLiteError("sqlite",`${termNumber+1}${termNumber===0?"st":termNumber===1?"nd":termNumber===2?"rd":"th"} ORDER BY term out of range - should be between 1 and ${projected.length}`,{code:1});
        resultIndex=Number(ordinal-1n);
      }else if(orderIdentity.kind==="column"&&!orderIdentity.name.includes("."))resultIndex=projected.findIndex(x=>sqliteIdentifierEqual(x.name,sqlName(orderIdentity.name)));
      // resolve.c also reuses an identical result expression before ordinary
      // name resolution. Token identity is sufficient for this generated slice.
      if(resultIndex<0)resultIndex=select.result.findIndex(x=>x.tokens.map(t=>t.text).join(" ")===leaf.map(t=>t.text).join(" "));
      let expression:Expression;
      if(resultIndex>=0){
        const projection=projected[resultIndex]!;
        let resultExpression=projection.expression;
        // resolveOrderGroupBy() substitutes the expanded result Expr, not the
        // syntactic '*' that produced it. In particular, ORDER BY on a column
        // expanded from a derived-table '*' has no matching Select.result node.
        if(!resultExpression){
          const index=projection.rowid?-1:projection.column!;
          if(index<0)resultExpression={kind:"column",index,name:projection.name,affinity:"integer",collation:"binary"};
          else {
            const column=table.columns[index]!,collationName=sqliteAsciiFold(column.collation??"binary");
            if(collationName!=="binary"&&collationName!=="nocase"&&collationName!=="rtrim")throw new JSQLiteError("sqlite",`no such collation sequence: ${column.collation}`,{code:1});
            resultExpression={kind:"column",index,name:projection.name,affinity:affinityOf(column.declaredType??""),collation:collationName};
          }
        }
        const substitute=(node:Expression):Expression=>node.kind==="collate"?{...node,value:substitute(node.value)}:resultExpression;
        expression=substitute(parsedOrderExpression);
      }else expression=resolveExpression(term.expr);
      const nullsLarge=term.nulls==="last"?!term.descending:term.nulls==="first"?term.descending:false;
      orderTerms.push({expression,...(resultIndex>=0?{resultIndex}:{}),descending:term.descending,nullsLarge});
    }
  }
  const hasLimit=select.limit!==null;
  const scalarPlans=new Map<SelectNode,ReturnType<typeof expandAndResolveSelect>>();
  const rememberNested=(parent:ReturnType<typeof expandAndResolveSelect>):void=>{for(const nested of parent.nested){scalarPlans.set(nested.source,nested);rememberNested(nested);}};
  rememberNested(expanded);
  const ops: Op[] = [];
  const parameters:ParameterBuilder={maximum:0,names:[],named:new Map()};
  const limit=computeLimitRegisters(select,ops,()=>++registers,parameters);
  const sorterCursor=1,distinctCursor=2,keyInfo=orderTerms.length===0?null:new KeyInfo({encoding:database.encoding,totalFieldCount:orderTerms.length,keyFieldCount:orderTerms.length,terms:orderTerms.map(term=>({collation:collation(term.expression),desc:term.descending,nullsLarge:term.nullsLarge}))});
  ops.push({code:"OpenRead",p1:table.rootPage,p2:0});
  // Child NameContexts number their SrcList cursors independently, but all of
  // these plans execute in this one VDBE. Relocate child-owned read cursors so
  // an inner scan cannot replace the positioned outer cursor (SQLite keeps
  // SrcList.iCursor unique within the parent Parse/Vdbe).
  let expressionCursor=1000;
  const nestedReadCursors=new Map<object,number>();
  for(const nested of scalarPlans.values())for(const source of nested.sources){
    if(nestedReadCursors.has(source))continue;
    const cursor=expressionCursor++;
    nestedReadCursors.set(source,cursor);
    ops.push({code:"OpenRead",p1:source.table.rootPage,p2:cursor});
  }
  if(keyInfo)ops.push({code:"SorterOpen",p1:sorterCursor,keyInfo});
  // select.c's DISTINCT ephemeral key uses the resolved result ExprList
  // collation. In particular, an explicit COLLATE on a direct table column
  // overrides the column's declared collation even though the projection can
  // still use the direct-column fast path.
  if(select.hasDistinct)ops.push({code:"OpenEphemeral",p1:distinctCursor,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:projected.length,keyFieldCount:projected.length,terms:expanded.result.map(result=>({collation:sqliteAsciiFold(result.descriptor.collation) as BuiltinCollation}))})});
  const rewindIndex=ops.length;ops.push({code:"Rewind",p2:0});const scan:FullScanPlan={rewindIndex,loopStart:ops.length};
  let ifNotIndex: number | undefined;
  const compileExpressionSubquery=(expression:SubqueryExpression):number=>{
    const nested=scalarPlans.get(expression.select),source=nested?.sources[0],item=expression.select.result[0];
    if(!nested||nested.sources.length>1||!item?.reduction||expression.select.hasDistinct||expression.select.hasGroupBy||expression.select.hasHaving||expression.select.hasCompound||expression.select.hasValues||expression.select.offset)throw new JSQLiteError("unsupported","this expression subquery shape is not implemented",{unsupportedClassification:"temporary"});
    const bind=(tree:Expression):Expression=>{if(tree.kind==="column"){
      // Expressions already resolved by the enclosing table plan retain that
      // lexical owner. Child reductions arrive without a cursor and are bound
      // against the nested/enclosing NameContexts below.
      if(tree.cursor!==undefined)return tree;
      const parts=tree.name.split('.').map(sqlName),name=parts.at(-1)!;
      const match=(candidate:NonNullable<typeof source>):number|null=>{if(parts.length>1&&!sqliteIdentifierEqual(parts.at(-2)!,candidate.alias??candidate.table.name))return null;const index=candidate.table.columns.findIndex(column=>sqliteIdentifierEqual(column.name,name));if(index<0)return null;return isIntegerPrimaryKeyAlias(candidate.table,index)?-1:index;};
      // resolve.c already established lexical ownership. Recover that source's
      // cursor from the child and enclosing NameContext plans.
      const candidates=[...(source?[source]:[]),...Array.from(scalarPlans.values()).flatMap(plan=>plan.sources),...expanded.sources];
      let owner:NonNullable<typeof source>|undefined,index:number|null=null;
      for(const candidate of candidates){const found=match(candidate);if(found!==null){owner=candidate;index=found;break;}}
      if(!owner||index===null)throw new JSQLiteError("internal",`resolved correlated column lost identity: ${tree.name}`);
      tree.cursor=nestedReadCursors.get(owner)??owner.cursorId;tree.index=index;if(index<0){tree.affinity='integer';tree.collation='binary';return tree;}tree.affinity=affinityOf(owner.table.columns[index]!.declaredType??"");const c=sqliteAsciiFold(owner.table.columns[index]!.collation??"binary");if(c!=="binary"&&c!=="nocase"&&c!=="rtrim")throw new JSQLiteError("sqlite",`no such collation sequence: ${c}`,{code:1});tree.collation=c;return tree;
    }if(tree.kind==="unary"||tree.kind==="cast"||tree.kind==="collate")tree.value=bind(tree.value);else if(tree.kind==="binary"){tree.left=bind(tree.left);tree.right=bind(tree.right);}else if(tree.kind==="in-subquery")tree.left=bind(tree.left);else if(tree.kind==="call"||tree.kind==="aggregate")tree.args=tree.args.map(bind);else if(tree.kind==="case"){if(tree.operand)tree.operand=bind(tree.operand);tree.pairs=tree.pairs.map(([a,b])=>[bind(a),bind(b)]);if(tree.otherwise)tree.otherwise=bind(tree.otherwise);}return tree;};
    const result=++registers,cursor=expressionCursor++,isIn=expression.kind==="in-subquery";
    const aggregate=bind(expressionFromReduction(item.reduction));
    const onceRegister=nested.sources.length>0&&!nested.correlated?++registers:undefined,onceAt=onceRegister===undefined?-1:ops.length;
    if(onceRegister!==undefined)ops.push({code:"Once",p1:onceRegister,p2:0});
    if(!source){
      if(isIn)throw new JSQLiteError("unsupported","this expression subquery shape is not implemented",{unsupportedClassification:"temporary"});
      ops.push(expression.exists?{code:"Integer",p1:1n,p2:result}:{code:"Null",p2:result});
      if(!expression.exists){const value=compileExpressionTree(aggregate,ops,()=>++registers,parameters,compileExpressionSubquery);ops.push({code:"Copy",p1:value,p2:result});}
      return result;
    }
    if(!isIn&&!expression.exists&&aggregate.kind==="aggregate"){
      if(aggregate.distinct||aggregate.filter||aggregate.orderBy.length)throw new JSQLiteError("unsupported","this scalar subquery aggregate is not implemented",{unsupportedClassification:"temporary"});
      ops.push({code:"Null",p2:result});
    }else if(isIn){ops.push({code:"OpenEphemeral",p1:cursor,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:1,keyFieldCount:1,terms:[{collation:collation(expression.left)}]})});}
    else ops.push(expression.exists?{code:"Integer",p1:0n,p2:result}:{code:"Null",p2:result});
    const sourceCursor=nestedReadCursors.get(source)??source.cursorId;
    const rewind=ops.length;ops.push({code:"Rewind",p1:sourceCursor,p2:0});const loop=ops.length;let skip:number|undefined;
    if(expression.select.where?.reduction){const predicate=compileExpressionTree(bind(expressionFromReduction(expression.select.where.reduction)),ops,()=>++registers,parameters,compileExpressionSubquery);skip=ops.length;ops.push({code:"IfNot",p1:predicate,p2:0});}
    let done=-1;
    const orderTerms=!isIn&&!expression.exists&&aggregate.kind!=="aggregate"?expression.select.orderBy.map(term=>{const tree=bind(expressionFromReduction(term.expr.reduction!));return{tree,desc:term.descending,nullsLarge:term.nulls==="last"?!term.descending:term.nulls==="first"?term.descending:false};}):[];
    const orderCursor=orderTerms.length?expressionCursor++:-1;
    if(orderTerms.length)ops.push({code:"SorterOpen",p1:orderCursor,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:orderTerms.length,keyFieldCount:orderTerms.length,terms:orderTerms.map(term=>({collation:collation(term.tree),desc:term.desc,nullsLarge:term.nullsLarge}))})});
    if(isIn){const value=compileExpressionTree(aggregate,ops,()=>++registers,parameters,compileExpressionSubquery);ops.push({code:"IdxInsert",p1:cursor,keyStart:value,keyCount:1});}
    else if(expression.exists){ops.push({code:"Integer",p1:1n,p2:result});done=ops.length;ops.push({code:"Goto",p2:0});}
    else if(aggregate.kind==="aggregate"){const args=aggregate.args.map(arg=>compileExpressionTree(arg,ops,()=>++registers,parameters,compileExpressionSubquery));ops.push({code:"AggStep",name:aggregate.name,args,p2:result,collation:aggregate.collation});}
    else if(orderTerms.length){const key=++registers;registers+=orderTerms.length-1;orderTerms.forEach((term,index)=>{const value=compileExpressionTree(term.tree,ops,()=>++registers,parameters,compileExpressionSubquery);ops.push({code:"Copy",p1:value,p2:key+index});});const value=compileExpressionTree(aggregate,ops,()=>++registers,parameters,compileExpressionSubquery),payload=++registers;ops.push({code:"Copy",p1:value,p2:payload},{code:"SorterInsert",p1:orderCursor,keyStart:key,keyCount:orderTerms.length,payload,payloadCount:1});}
    else {const value=compileExpressionTree(aggregate,ops,()=>++registers,parameters,compileExpressionSubquery);ops.push({code:"Copy",p1:value,p2:result});done=ops.length;ops.push({code:"Goto",p2:0});}
    const next=ops.length;ops.push({code:"Next",p1:sourceCursor,p2:loop});const finish=ops.length;(ops[rewind] as {p2:number}).p2=finish;if(skip!==undefined)(ops[skip] as {p2:number}).p2=next;if(done>=0)(ops[done] as {p2:number}).p2=finish;
    if(orderTerms.length){ops.push({code:"Null",p2:result});const sort=ops.length;ops.push({code:"SorterSort",p1:orderCursor,emptyJump:0},{code:"SorterData",p1:orderCursor,p2:result,count:1},{code:"ClearSorter",p1:orderCursor});(ops[sort] as {emptyJump:number}).emptyJump=ops.length-1;}
    if(!isIn&&!expression.exists&&aggregate.kind==="aggregate")ops.push({code:"AggFinal",name:aggregate.name,p1:result});
    if(onceAt>=0)(ops[onceAt] as {p2:number}).p2=ops.length;
    if(isIn){const left=compileExpressionTree(bind(expression.left),ops,()=>++registers,parameters,compileExpressionSubquery);ops.push({code:"InSet",p1:cursor,key:left,output:result,affinity:expressionAffinity(aggregate)??"numeric",negated:expression.negated});if(nested.correlated)ops.push({code:"ClearEphemeral",p1:cursor});}
    return result;
  };
  if (select.where) {
    if (!select.where.reduction) throw new JSQLiteError("unsupported", "WHERE predicate is not implemented", { unsupportedClassification: "temporary" });
    const predicate=resolveExpression(select.where);
    const compilePredicate=(tree:Expression):number=>{
      if(tree.kind==="scalar-subquery"||tree.kind==="in-subquery")return compileExpressionSubquery(tree);
      if(tree.kind==="binary"&&(tree.op==="AND"||tree.op==="OR")){
        const left=compilePredicate(tree.left),output=++registers,guard=ops.length;
        ops.push({code:"ShortCircuit",kind:tree.op.toLowerCase() as "and"|"or",p1:left,p2:output,jump:0});
        const right=compilePredicate(tree.right);ops.push({code:"Boolean",kind:tree.op.toLowerCase() as "and"|"or",p1:left,p2:right,p3:output});(ops[guard] as {jump:number}).jump=ops.length;return output;
      }
      return compileExpressionTree(tree,ops,()=>++registers,parameters,compileExpressionSubquery);
    };
    const output=compilePredicate(predicate);
    ifNotIndex=ops.length; ops.push({code:"IfNot",p1:output,p2:0});
  }
  const body=ops.length;
  projected.forEach((x,i)=>{if(x.rowid)ops.push({code:"Rowid",p2:i+1});else if(x.column===undefined){const expression=x.expression!,source=compileExpressionTree(expression,ops,()=>++registers,parameters,compileExpressionSubquery);ops.push({code:"Copy",p1:source,p2:i+1})}else{ops.push({code:"Column",p1:x.column,p2:i+1});if(x.realAffinity)ops.push({code:"RealAffinity",p1:i+1});}});
  let distinctFound: number | undefined;
  if(select.hasDistinct){distinctFound=ops.length;ops.push({code:"Found",p1:distinctCursor,keyStart:1,keyCount:projected.length,jump:0},{code:"IdxInsert",p1:distinctCursor,keyStart:1,keyCount:projected.length});}
  if(keyInfo){const keyStart=registers+1;registers+=orderTerms.length;orderTerms.forEach((term,i)=>{if(term.resultIndex!==undefined)ops.push({code:"Copy",p1:term.resultIndex+1,p2:keyStart+i});else{const source=compileExpressionTree(term.expression,ops,()=>++registers);ops.push({code:"Copy",p1:source,p2:keyStart+i})}});if(limit)ops.push({code:"IfNotZero",p1:limit.combined,p2:ops.length+1});ops.push({code:"SorterInsert",p1:sorterCursor,keyStart,keyCount:orderTerms.length,payload:1,payloadCount:projected.length,...(limit?{topN:limit.capacity}:{})});}
  else ops.push({code:"ResultRow",p1:1,p2:projected.length});
  sqlite3WhereEnd(ops,scan,select.where?scan.loopStart:body);
  if(keyInfo){const sortAt=ops.length-1,tail:Op[]=[{code:"SorterSort",p1:sorterCursor,emptyJump:0},{code:"SorterData",p1:sorterCursor,p2:1,count:projected.length}];if(limit?.offset!==undefined)tail.push({code:"IfPos",p1:limit.offset,p2:0,p3:1});tail.push({code:"ResultRow",p1:1,p2:projected.length});if(limit)tail.push({code:"DecrJumpZero",p1:limit.count,p2:0});const nextIndex=sortAt+tail.length;tail.push({code:"SorterNext",p1:sorterCursor,p2:sortAt+1});(tail[0] as {emptyJump:number}).emptyJump=nextIndex+1;for(const op of tail){if(op.code==="IfPos") (op as {p2:number}).p2=nextIndex;if(op.code==="DecrJumpZero") (op as {p2:number}).p2=nextIndex+1;}ops.splice(sortAt,0,...tail);}else if(limit){const resultAt=(()=>{for(let i=ops.length-1;i>=0;i--)if(ops[i]!.code==="ResultRow")return i;return -1})();if(limit.offset!==undefined)ops.splice(resultAt,0,{code:"IfPos",p1:limit.offset,p2:0,p3:1});const adjusted=(()=>{for(let i=ops.length-1;i>=0;i--)if(ops[i]!.code==="ResultRow")return i;return -1})();ops.splice(adjusted+1,0,{code:"DecrJumpZero",p1:limit.count,p2:0});}
  // Patch scan-continuation labels only after the result tail has its final
  // layout. Duplicate and filtered rows must bypass OFFSET/result/LIMIT work.
  let scanContinue=-1;for(let i=ops.length-1;i>=scan.loopStart;i--){const op=ops[i]!;if(op.code==="Next"&&op.p1===undefined){scanContinue=i;break;}}
  if(scanContinue<0)throw new Error("table scan has no continuation target");
  if(distinctFound!==undefined)(ops[distinctFound] as {jump:number}).jump=scanContinue;
  if(ifNotIndex!==undefined) (ops[ifNotIndex] as {code:"IfNot";p1:number;p2:number}).p2=scanContinue;
  if(!keyInfo&&limit){
    const halt=ops.findIndex((op,index)=>index>scanContinue&&op.code==="Halt");
    if(halt<0)throw new Error("LIMIT program has no halt target");
    const offset=ops.find(op=>op.code==="IfPos") as Extract<Op,{code:"IfPos"}>|undefined;
    if(offset) (offset as {p2:number}).p2=scanContinue;
    const decrement=ops.find(op=>op.code==="DecrJumpZero") as Extract<Op,{code:"DecrJumpZero"}>|undefined;
    if(!decrement)throw new Error("LIMIT program has no decrement operation");
    (decrement as {p2:number}).p2=halt;
  }
  if(limit){let halt=ops.length-1;while(halt>=0&&ops[halt]!.code!=="Halt")halt--;if(halt<0)throw new Error("LIMIT program has no halt target");(ops[limit.ifZero] as {p2:number}).p2=halt;}
  const columns=expanded.result.map((x,i)=>{
    let descriptor=x.descriptor;
    const expression=projected[i]?.expression;
    if(x.resolution==='expression'&&expression?.kind==='scalar-subquery'&&!expression.exists){const inner=scalarPlans.get(expression.select)?.result[0]?.descriptor;if(inner)descriptor=inner;}
    return Object.freeze({name:x.resolution==='expression'?projected[i]!.name:descriptor.name,declaredType:descriptor.declaredType,database:descriptor.database,table:descriptor.table,origin:descriptor.origin});
  });
  return Object.freeze({ops:Object.freeze(ops),registers,encoding:database.encoding,columns:Object.freeze(columns),parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),table,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits});
}

function sameExpression(a:Expression,b:Expression):boolean {
 if(a.kind!==b.kind)return false;
 switch(a.kind){
  case "variable": return a.spelling===(b as typeof a).spelling;
  case "literal": return typeof a.value===typeof (b as typeof a).value&&String(a.value)===String((b as typeof a).value);
  case "column": return sqliteIdentifierEqual(a.name,(b as typeof a).name);
  case "unary": return a.op===(b as typeof a).op&&sameExpression(a.value,(b as typeof a).value);
  case "binary": return a.op===(b as typeof a).op&&sameExpression(a.left,(b as typeof a).left)&&sameExpression(a.right,(b as typeof a).right);
  case "collate": return a.collation===(b as typeof a).collation&&sameExpression(a.value,(b as typeof a).value);
  case "cast": return a.affinity===(b as typeof a).affinity&&sameExpression(a.value,(b as typeof a).value);
  case "call": case "aggregate": {const x=b as typeof a;return a.name===x.name&&a.args.length===x.args.length&&a.args.every((arg,i)=>sameExpression(arg,x.args[i]!));}
  case "case": {const x=b as typeof a;return (a.operand===null?x.operand===null:x.operand!==null&&sameExpression(a.operand,x.operand))&&a.pairs.length===x.pairs.length&&a.pairs.every((pair,i)=>sameExpression(pair[0],x.pairs[i]![0])&&sameExpression(pair[1],x.pairs[i]![1]))&&(a.otherwise===null?x.otherwise===null:x.otherwise!==null&&sameExpression(a.otherwise,x.otherwise));}
  case "in-list": {const x=b as typeof a;return a.negated===x.negated&&sameExpression(a.left,x.left)&&a.values.length===x.values.length&&a.values.every((value,i)=>sameExpression(value,x.values[i]!));}
  case "mem": case "register": case "scalar-subquery": case "in-subquery": return false;
 }
}
function reductionHas(select:SelectNode,part:string):boolean {const visit=(node:LemonValue<SqlToken>):boolean=>node.kind==="reduction"&&(node.signature.toLowerCase().includes(part.toLowerCase())||node.children.some(visit));const roots=[...select.result,...select.groupBy,...select.orderBy.map(x=>x.expr),...(select.having?[select.having]:[])];return roots.some(x=>x.reduction!==undefined&&visit(x.reduction));}
function aggregateOrderResultIndex(select:SelectNode,term:SelectNode["orderBy"][number]):number {
 const order=expressionFromReduction(term.expr.reduction!),identity=order.kind==="collate"?order.value:order;
 if(identity.kind==="literal"&&typeof identity.value==="bigint"){const at=Number(identity.value)-1;return at>=0&&at<select.result.length?at:-1;}
 if(identity.kind==="column"&&!identity.name.includes(".")){const at=select.result.findIndex(item=>item.alias!==undefined&&sqliteIdentifierEqual(item.alias,identity.name));if(at>=0)return at;}
 return select.result.findIndex(item=>sameExpression(identity,expressionFromReduction(item.reduction!)));
}
function simpleGroupShape(select:SelectNode):boolean {
 if(!select.hasGroupBy||select.hasCompound||select.from.items.length===0||select.from.items.some((item,index)=>index>0&&(item.joinFromLeft.left||item.joinFromLeft.right||item.joinFromLeft.error||item.using!==null))||reductionHas(select,"over_clause ::= OVER"))return false;
 try {
  const groups=select.groupBy.map(x=>expressionFromReduction(x.reduction!));
  const results=select.result.map(x=>expressionFromReduction(x.reduction!));
  return !select.hasOrderBy||select.orderBy.every(term=>{if(aggregateOrderResultIndex(select,term)>=0)return true;const order=expressionFromReduction(term.expr.reduction!);return !term.descending&&term.nulls===null&&groups.some(group=>sameExpression(order,group)||(order.kind==="collate"&&sameExpression(order.value,group)));});
 } catch { return false; }
}
export function aggregateShapeSupported(select:SelectNode):boolean{return simpleGroupShape(select)||!(select.hasCompound||select.hasGroupBy||select.hasDistinct||select.hasOrderBy||select.limit||select.offset||select.hasSubquery||select.from.items.length>1||reductionHas(select,"over_clause ::= OVER"));}


/** select.c SRT_Accumulator fed by a bounded UNION ALL derived source. The
 * producer arms and aggregate consumer remain one Program and one set of
 * execution/resource controls. */
function compileCompoundDerivedAggregate(select:SelectNode,schema:SchemaGraph,database:BtreeDatabase,maxRows:number,maxWorkUnits:number,maxResultBytes:number,privateStateLimits:PrivateStateLimits):Program|undefined {
 const derived=select.from.derived;if(!derived||derived.index!==0||select.from.items.length!==1||!derived.select.hasCompound||select.where||select.hasGroupBy||select.hasHaving||select.hasDistinct||select.hasOrderBy||select.limit||select.offset||derived.select.arms.slice(1).some(arm=>arm.operatorFromPrior!=='union-all'))return undefined;
 const children=derived.select.arms.map(arm=>{const single:SelectNode={...derived.select,result:arm.result,from:arm.from,where:arm.where,hasDistinct:arm.hasDistinct,hasGroupBy:false,hasHaving:false,groupBy:Object.freeze([]),having:null,orderBy:Object.freeze([]),limit:null,offset:null,hasOrderBy:false,hasLimit:false,hasCompound:false,arms:Object.freeze([{...arm,operatorFromPrior:null,prior:null,next:null}])};return single.from.items.length||single.where?compileTableSelect(single,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits):compileScalarSelect(single,database.encoding,maxWorkUnits,maxResultBytes,privateStateLimits)});
 if(children.some(child=>child.parameters.length))return undefined;const columns=children[0]!.columns;if(children.some(child=>child.columns.length!==columns.length))return undefined;
 type Entry={name:string;args:Expression[];register:number;collation:BuiltinCollation;orderBy:AggregateOrderTerm[];sorter?:number};let registers=Math.max(...children.map(child=>child.registers)),nextCursor=40;const entries:Entry[]=[];
 const lower=(e:Expression):Expression=>{if(e.kind==='aggregate'){if(e.distinct||e.filter)return e;const register=++registers;entries.push({name:e.name,args:e.args,register,collation:e.collation,orderBy:e.orderBy,...(e.orderBy.length?{sorter:nextCursor++}:{})});return{kind:'register',index:register}}if(e.kind==='unary'||e.kind==='cast'||e.kind==='collate')e.value=lower(e.value);else if(e.kind==='binary'){e.left=lower(e.left);e.right=lower(e.right)}else if(e.kind==='call')e.args=e.args.map(lower);else if(e.kind==='case'){if(e.operand)e.operand=lower(e.operand);e.pairs=e.pairs.map(([a,b])=>[lower(a),lower(b)]);if(e.otherwise)e.otherwise=lower(e.otherwise)}return e};
 const outputs=select.result.map(item=>lower(expressionFromReduction(item.reduction!)));if(!entries.length||entries.some(entry=>entry.args.some(arg=>arg.kind==='aggregate')))return undefined;
 const ops:Op[]=[];for(const entry of entries)if(entry.sorter!==undefined)ops.push({code:'SorterOpen',p1:entry.sorter,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:entry.orderBy.length,keyFieldCount:entry.orderBy.length,terms:entry.orderBy.map(term=>({collation:collation(term.expression),desc:term.descending,nullsLarge:term.nullsLarge}))})});
 const forRow=(expression:Expression,row:number):Expression=>{if(expression.kind==='column'){const parts=expression.name.split('.').map(sqlName),name=parts.at(-1)!,index=columns.findIndex(column=>sqliteIdentifierEqual(column.name,name));if(index<0)throw new JSQLiteError('sqlite',`no such column: ${expression.name}`,{code:1});return{kind:'register',index:row+index}}if(expression.kind==='unary'||expression.kind==='cast'||expression.kind==='collate')expression.value=forRow(expression.value,row);else if(expression.kind==='binary'){expression.left=forRow(expression.left,row);expression.right=forRow(expression.right,row)}else if(expression.kind==='call')expression.args=expression.args.map(arg=>forRow(arg,row));else if(expression.kind==='case'){if(expression.operand)expression.operand=forRow(expression.operand,row);expression.pairs=expression.pairs.map(([a,b])=>[forRow(a,row),forRow(b,row)]);if(expression.otherwise)expression.otherwise=forRow(expression.otherwise,row)}return expression};
 for(const child of children){const base=ops.length,endJumps:number[]=[];for(const original of child.ops){if(original.code==='Halt'){endJumps.push(ops.length);ops.push({code:'Goto',p2:0});continue}if(original.code==='ResultRow'){for(const entry of entries){const args=entry.args.map(arg=>compileExpressionTree(forRow(structuredClone(arg),original.p1),ops,()=>++registers));if(entry.sorter===undefined)ops.push({code:'AggStep',name:entry.name,args,p2:entry.register,collation:entry.collation});else{const key=++registers;registers+=entry.orderBy.length-1;entry.orderBy.forEach((term,index)=>{const value=compileExpressionTree(forRow(structuredClone(term.expression),original.p1),ops,()=>++registers);ops.push({code:'Copy',p1:value,p2:key+index})});const payload=++registers;registers+=args.length-1;args.forEach((arg,index)=>ops.push({code:'Copy',p1:arg,p2:payload+index}));ops.push({code:'SorterInsert',p1:entry.sorter,keyStart:key,keyCount:entry.orderBy.length,payload,payloadCount:args.length})}}continue}let op:Op=original;if('p2' in op&&['Goto','Rewind','IfNot','Next','DecrJumpZero','IfNotZero','IfPos','SorterNext','EphemeralRewind','EphemeralNext'].includes(op.code))op={...op,p2:op.p2+base} as Op;if('jump' in op&&typeof op.jump==='number')op={...op,jump:op.jump+base} as Op;if(op.code==='SorterSort')op={...op,emptyJump:op.emptyJump+base};ops.push(op)}for(const at of endJumps)(ops[at] as {p2:number}).p2=ops.length}
 for(const entry of entries){if(entry.sorter!==undefined){const args=++registers;registers+=entry.args.length-1;const at=ops.length;ops.push({code:'SorterSort',p1:entry.sorter,emptyJump:0},{code:'SorterData',p1:entry.sorter,p2:args,count:entry.args.length},{code:'AggStep',name:entry.name,args:Array.from({length:entry.args.length},(_,i)=>args+i),p2:entry.register,collation:entry.collation},{code:'SorterNext',p1:entry.sorter,p2:at+1});(ops[at] as {emptyJump:number}).emptyJump=ops.length}ops.push({code:'AggFinal',name:entry.name,p1:entry.register})}
 outputs.forEach((output,index)=>{const value=compileExpressionTree(output,ops,()=>++registers);ops.push({code:'Copy',p1:value,p2:index+1})});ops.push({code:'ResultRow',p1:1,p2:outputs.length},{code:'Halt'});
 return Object.freeze({ops:Object.freeze(ops),registers,columns:Object.freeze(select.result.map(item=>Object.freeze({name:expressionName(item),declaredType:null,database:null,table:null,origin:null}))),parameters:Object.freeze([]),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,encoding:database.encoding});
}

/** select.c:sqlite3Select aggregate-without-GROUP tranche. AggInfo entries own
 * accumulator registers; ordinary expression lowering consumes AggFinal values. */
export function compileAggregateSelect(select:SelectNode,schema:SchemaGraph,database:BtreeDatabase,maxRows:number,maxWorkUnits=10_000_000,maxResultBytes=1_000_000_000,privateStateLimits:PrivateStateLimits=DEFAULT_PRIVATE_STATE_LIMITS):Program {
 const compoundDerived=compileCompoundDerivedAggregate(select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits);if(compoundDerived)return compoundDerived;
 const derived=select.from.derived;
 if(derived&&derived.index===0&&select.from.items.length===1&&!derived.select.hasDistinct&&!derived.select.hasGroupBy&&!derived.select.hasHaving&&!derived.select.hasOrderBy&&!derived.select.hasLimit&&!derived.select.hasCompound&&derived.select.from.items.length===1){
  // select.c:flattenSubquery, bounded aggregate-parent form. Substitute the
  // transient producer columns before inheriting its source. This also retains
  // CTE alias names without fabricating a schema table.
  const names=uniqueTransientColumnNames(derived.select.result.map((expression,index)=>expression.alias??`column${index+1}`));
  const columns=new Map(derived.select.result.map((expression,index)=>[sqliteAsciiFold(names[index]!),expression]));
  const qualifier=select.from.items[0]!.alias??select.from.items[0]!.tableName;
  const result=Object.freeze(select.result.map(expression=>substituteViewExpression(expression,columns,qualifier)));
  const groupBy=Object.freeze(select.groupBy.map(expression=>substituteViewExpression(expression,columns,qualifier)));
  const having=select.having?substituteViewExpression(select.having,columns,qualifier):null;
  const orderBy=Object.freeze(select.orderBy.map(term=>Object.freeze({...term,expr:substituteViewExpression(term.expr,columns,qualifier)})));
  const outerWhere=select.where?substituteViewExpression(select.where,columns,qualifier):null;
  const where=andViewPredicates(derived.select.where,outerWhere);
  const flattened=Object.freeze({...select,result,groupBy,having,orderBy,from:derived.select.from,where,hasSubquery:derived.select.hasSubquery,tokens:select.tokens});
  return compileAggregateSelect(flattened,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits);
 }
 // select.c:selectExpander runs before resolveSelectStep/aggregate lowering.
 // Flatten the same bounded immutable-view shape used by ordinary SELECT so
 // view column names, origin/type/affinity and inherited collation reach the
 // grouping KeyInfo without mutating the schema-owned Select.
 if(!select.hasCompound&&select.from.items.length===1){
  const source=select.from.items[0]!,view=schema.views.get(sqliteAsciiFold(sqlName(source.tableName)));
  if(view)return compileAggregateSelect(flattenImmutableView(select,view),schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits);
 }
 if(select.hasCompound){
  const unionAll=select.arms.slice(1).every(arm=>arm.operatorFromPrior==="union-all"),order=select.orderBy[0];
  if(!unionAll||select.orderBy.length!==1||select.limit||select.offset||select.hasDistinct)throw new JSQLiteError("unsupported","this aggregate form is not implemented",{unsupportedClassification:"temporary"});
  let orderTree=expressionFromReduction(order!.expr.reduction!);while(orderTree.kind==="collate")orderTree=orderTree.value;
  if(orderTree.kind!=="literal"||orderTree.value!==1n)throw new JSQLiteError("unsupported","this aggregate form is not implemented",{unsupportedClassification:"temporary"});
  const armPrograms=select.arms.map(arm=>{const single:SelectNode={...select,result:arm.result,from:arm.from,where:arm.where,hasDistinct:arm.hasDistinct,hasGroupBy:arm.hasGroupBy,hasHaving:arm.hasHaving,groupBy:Object.freeze([]),having:null,orderBy:Object.freeze([]),limit:null,offset:null,hasOrderBy:false,hasLimit:false,hasCompound:false,arms:Object.freeze([{...arm,operatorFromPrior:null,prior:null,next:null}])};return compileAggregateSelect(single,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits);});
  if(armPrograms.some(program=>program.parameters.length))throw new JSQLiteError("unsupported","parameters in aggregate compounds are not implemented",{unsupportedClassification:"temporary"});const width=armPrograms[0]!.columns.length;if(armPrograms.some(program=>program.columns.length!==width))throw new JSQLiteError("sqlite","SELECTs to the left and right of UNION ALL do not have the same number of result columns",{code:1});
  const sorter=20,ops:Op[]=[{code:"SorterOpen",p1:sorter,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:1,keyFieldCount:1,terms:[{collation:"binary",desc:order!.descending,nullsLarge:order!.nulls==="last"?!order!.descending:order!.nulls==="first"?order!.descending:false}]})}];let registers=Math.max(...armPrograms.map(program=>program.registers));
  for(const program of armPrograms){const base=ops.length,endJumps:number[]=[];for(const original of program.ops){if(original.code==="Halt"){endJumps.push(ops.length);ops.push({code:"Goto",p2:0});continue;}if(original.code==="ResultRow"){ops.push({code:"SorterInsert",p1:sorter,keyStart:original.p1,keyCount:1,payload:original.p1,payloadCount:original.p2});continue;}let op:Op=original;if("p2" in op&&["Goto","Rewind","IfNot","Next","DecrJumpZero","IfNotZero","IfPos","SorterNext"].includes(op.code))op={...op,p2:op.p2+base} as Op;if("jump" in op&&typeof op.jump==="number")op={...op,jump:op.jump+base} as Op;if(op.code==="SorterSort")op={...op,emptyJump:op.emptyJump+base};ops.push(op);}for(const at of endJumps)(ops[at] as {p2:number}).p2=ops.length;}
  const output=++registers,sortAt=ops.length;ops.push({code:"SorterSort",p1:sorter,emptyJump:0},{code:"SorterData",p1:sorter,p2:output,count:width},{code:"ResultRow",p1:output,p2:width},{code:"SorterNext",p1:sorter,p2:sortAt+1});const halt=ops.length;ops.push({code:"Halt"});(ops[sortAt] as {emptyJump:number}).emptyJump=halt;return Object.freeze({ops:Object.freeze(ops),registers,columns:armPrograms[0]!.columns,parameters:Object.freeze([]),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,encoding:database.encoding});
 }
 if(!aggregateShapeSupported(select))throw new JSQLiteError("unsupported","this aggregate form is not implemented",{unsupportedClassification:"temporary"});
 let table:TableNode|undefined;
 const aggregateSources=select.from.items.map((item,cursor)=>{const name=sqlName(item.tableName),found=schema.tables.get(sqliteAsciiFold(name));if(!found)throw new JSQLiteError("sqlite",`no such table: ${name}`,{code:1});if(found.withoutRowid||found.columns.some(c=>c.generatedExpr))throw new JSQLiteError("unsupported","this table storage shape is not implemented",{unsupportedClassification:"temporary"});return{item,table:found,cursor:select.from.items.length===1?0:cursor+3,base:0}});let sourceWidth=0;for(const source of aggregateSources){source.base=sourceWidth;sourceWidth+=source.table.columns.length;}if(aggregateSources.length===1)table=aggregateSources[0]!.table;
 const resolve=(e:Expression):Expression=>{if(e.kind==="column"){if(!aggregateSources.length)throw new JSQLiteError("sqlite",`no such column: ${e.name}`,{code:1});const parts=e.name.split('.').map(sqlName),name=parts.at(-1)!,candidates=aggregateSources.flatMap(source=>{if(parts.length>1&&!sqliteIdentifierEqual(parts.at(-2)!,source.item.alias??source.table.name))return[];const at=source.table.columns.findIndex(c=>sqliteIdentifierEqual(c.name,name));return at<0?[]:[{source,at}]});if(candidates.length!==1)throw new JSQLiteError("sqlite",candidates.length?`ambiguous column name: ${e.name}`:`no such column: ${e.name}`,{code:1});const {source,at}=candidates[0]!;e.index=isIntegerPrimaryKeyAlias(source.table,at)?-1:at;e.cursor=source.cursor;e.payloadIndex=source.base+at;e.affinity=affinityOf(source.table.columns[at]!.declaredType??"");const c=sqliteAsciiFold(source.table.columns[at]!.collation??"binary");if(c!=="binary"&&c!=="nocase"&&c!=="rtrim")throw new JSQLiteError("sqlite",`no such collation sequence: ${c}`,{code:1});e.collation=c;return e}if(e.kind==="unary"||e.kind==="cast"||e.kind==="collate")e.value=resolve(e.value);else if(e.kind==="binary"){e.left=resolve(e.left);e.right=resolve(e.right)}else if(e.kind==="call")e.args=e.args.map(resolve);else if(e.kind==="aggregate"){e.args=e.args.map(resolve);if(e.filter)e.filter=resolve(e.filter);e.orderBy=e.orderBy.map(term=>({...term,expression:resolve(term.expression)}));}else if(e.kind==="case"){if(e.operand)e.operand=resolve(e.operand);e.pairs=e.pairs.map(([a,b])=>[resolve(a),resolve(b)]);if(e.otherwise)e.otherwise=resolve(e.otherwise)}return e};
 const rawTrees=select.result.map(x=>expressionFromReduction(x.reduction!));
 // resolve.c resolves aggregate arguments under NC_InAggFunc and rejects a
 // second aggregate before select.c/AggInfo lowering. Keep that diagnostic at
 // prepare time instead of passing an execution-only aggregate to scalar code.
 const nestedAggregate=(e:Expression,inside=false):string|null=>{if(e.kind==="aggregate"){if(inside)return e.name;for(const arg of e.args){const nested=nestedAggregate(arg,true);if(nested)return nested;}if(e.filter){const nested=nestedAggregate(e.filter,true);if(nested)return nested;}for(const term of e.orderBy){const nested=nestedAggregate(term.expression,true);if(nested)return nested;}return null;}if(e.kind==="unary"||e.kind==="cast"||e.kind==="collate")return nestedAggregate(e.value,inside);if(e.kind==="binary")return nestedAggregate(e.left,inside)??nestedAggregate(e.right,inside);if(e.kind==="call"){for(const arg of e.args){const nested=nestedAggregate(arg,inside);if(nested)return nested;}return null;}if(e.kind==="case"){if(e.operand){const nested=nestedAggregate(e.operand,inside);if(nested)return nested;}for(const [when,then] of e.pairs){const nested=nestedAggregate(when,inside)??nestedAggregate(then,inside);if(nested)return nested;}return e.otherwise?nestedAggregate(e.otherwise,inside):null;}return null};
 for(const tree of rawTrees){const nested=nestedAggregate(tree);if(nested)throw new JSQLiteError("sqlite",`misuse of aggregate function ${nested}()`,{code:1});}
 const whereTree=select.where?expressionFromReduction(select.where.reduction!):null;
 if(whereTree){const aggregate=nestedAggregate(whereTree,true);if(aggregate)throw new JSQLiteError("sqlite",`misuse of aggregate: ${aggregate}()`,{code:1});}
 const aliasExpression=(e:Expression):Expression=>{if(e.kind==="column"&&!e.name.includes(".")){const source=aggregateSources.some(item=>item.table.columns.some(column=>sqliteIdentifierEqual(column.name,e.name)));if(!source){const at=select.result.findIndex(item=>item.alias!==undefined&&sqliteIdentifierEqual(item.alias,e.name));if(at>=0)return expressionFromReduction(select.result[at]!.reduction!)}}if(e.kind==="unary"||e.kind==="cast"||e.kind==="collate")e.value=aliasExpression(e.value);else if(e.kind==="binary"){e.left=aliasExpression(e.left);e.right=aliasExpression(e.right)}else if(e.kind==="call")e.args=e.args.map(aliasExpression);else if(e.kind==="aggregate"){e.args=e.args.map(aliasExpression);if(e.filter)e.filter=aliasExpression(e.filter);e.orderBy=e.orderBy.map(term=>({...term,expression:aliasExpression(term.expression)}));}else if(e.kind==="case"){if(e.operand)e.operand=aliasExpression(e.operand);e.pairs=e.pairs.map(([a,b])=>[aliasExpression(a),aliasExpression(b)]);if(e.otherwise)e.otherwise=aliasExpression(e.otherwise)}return e};
 const trees=rawTrees.map(resolve),where=whereTree?resolve(whereTree):null,groups=select.groupBy.map(x=>resolve(expressionFromReduction(x.reduction!))),havingTree=select.having?resolve(aliasExpression(expressionFromReduction(select.having.reduction!))):null;
 const ops:Op[]=[],parameters:ParameterBuilder={maximum:0,names:[],named:new Map()};let registers=select.result.length,allocate=()=>++registers;
 // expr.c:sqlite3CodeSubselect + select.c SRT_Mem. Group output is emitted
 // once per completed group, but an uncorrelated scalar aggregate is guarded by
 // Once and retains its destination register across those emissions. Keeping
 // this producer in the parent Program preserves shared work/control budgets.
 let aggregateSubqueryCursor=1000;
 const compileAggregateSubquery=(expression:SubqueryExpression):number=>{
  const nested=expression.select,item=nested.result[0];
  if(expression.kind==='in-subquery'){
   if(!item?.reduction||nested.result.length!==1||nested.from.items.length!==1||nested.where||nested.hasDistinct||nested.hasGroupBy||nested.hasHaving||nested.hasOrderBy||nested.hasCompound||nested.hasValues||nested.limit||nested.offset)throw new JSQLiteError('unsupported','this aggregate IN subquery shape is not implemented',{unsupportedClassification:'temporary'});
   const sourceName=sqlName(nested.from.items[0]!.tableName),sourceTable=schema.tables.get(sqliteAsciiFold(sourceName));if(!sourceTable)throw new JSQLiteError('sqlite',`no such table: ${sourceName}`,{code:1});
   let value=expressionFromReduction(item.reduction);if(value.kind!=='column')throw new JSQLiteError('unsupported','this aggregate IN subquery shape is not implemented',{unsupportedClassification:'temporary'});const parts=value.name.split('.').map(sqlName),name=parts.at(-1)!;if(parts.length>1&&!sqliteIdentifierEqual(parts.at(-2)!,nested.from.items[0]!.alias??sourceTable.name))throw new JSQLiteError('sqlite',`no such column: ${value.name}`,{code:1});const at=sourceTable.columns.findIndex(column=>sqliteIdentifierEqual(column.name,name));if(at<0)throw new JSQLiteError('sqlite',`no such column: ${value.name}`,{code:1});value.index=isIntegerPrimaryKeyAlias(sourceTable,at)?-1:at;value.cursor=aggregateSubqueryCursor++;value.affinity=affinityOf(sourceTable.columns[at]!.declaredType??'');value.collation=sqliteAsciiFold(sourceTable.columns[at]!.collation??'binary') as BuiltinCollation;
   const result=allocate(),once=allocate(),set=aggregateSubqueryCursor++,onceAt=ops.length;ops.push({code:'Once',p1:once,p2:0},{code:'OpenEphemeral',p1:set,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:1,keyFieldCount:1,terms:[{collation:collation(expression.left)}]})},{code:'OpenRead',p1:sourceTable.rootPage,p2:value.cursor});const rewind=ops.length;ops.push({code:'Rewind',p1:value.cursor,p2:0});const loop=ops.length,cell=compileExpressionTree(value,ops,allocate,parameters,compileAggregateSubquery);ops.push({code:'IdxInsert',p1:set,keyStart:cell,keyCount:1},{code:'Next',p1:value.cursor,p2:loop});(ops[rewind] as {p2:number}).p2=ops.length;(ops[onceAt] as {p2:number}).p2=ops.length;const left=compileExpressionTree(expression.left,ops,allocate,parameters,compileAggregateSubquery);ops.push({code:'InSet',p1:set,key:left,output:result,affinity:expressionAffinity(value)??'numeric',negated:expression.negated});return result;
  }
  if(expression.exists)throw new JSQLiteError('unsupported','this aggregate expression subquery shape is not implemented',{unsupportedClassification:'temporary'});
  if(!item?.reduction||nested.result.length!==1||nested.from.items.length!==1||nested.where||nested.hasDistinct||nested.hasGroupBy||nested.hasHaving||nested.hasOrderBy||nested.hasCompound||nested.hasValues||nested.limit||nested.offset)throw new JSQLiteError('unsupported','this aggregate expression subquery shape is not implemented',{unsupportedClassification:'temporary'});
  const sourceName=sqlName(nested.from.items[0]!.tableName),sourceTable=schema.tables.get(sqliteAsciiFold(sourceName));if(!sourceTable)throw new JSQLiteError('sqlite',`no such table: ${sourceName}`,{code:1});
  const tree=expressionFromReduction(item.reduction);if(tree.kind!=='aggregate'||tree.distinct||tree.filter||tree.orderBy.length)throw new JSQLiteError('unsupported','this aggregate expression subquery shape is not implemented',{unsupportedClassification:'temporary'});
  const cursor=aggregateSubqueryCursor++,result=allocate(),once=allocate(),onceAt=ops.length;ops.push({code:'Once',p1:once,p2:0},{code:'OpenRead',p1:sourceTable.rootPage,p2:cursor});
  const bind=(node:Expression):Expression=>{if(node.kind==='column'){const parts=node.name.split('.').map(sqlName),name=parts.at(-1)!;if(parts.length>1&&!sqliteIdentifierEqual(parts.at(-2)!,nested.from.items[0]!.alias??sourceTable.name))throw new JSQLiteError('sqlite',`no such column: ${node.name}`,{code:1});const at=sourceTable.columns.findIndex(column=>sqliteIdentifierEqual(column.name,name));if(at<0)throw new JSQLiteError('sqlite',`no such column: ${node.name}`,{code:1});node.index=isIntegerPrimaryKeyAlias(sourceTable,at)?-1:at;node.cursor=cursor;node.affinity=affinityOf(sourceTable.columns[at]!.declaredType??'');const named=sqliteAsciiFold(sourceTable.columns[at]!.collation??'binary');if(named!=='binary'&&named!=='nocase'&&named!=='rtrim')throw new JSQLiteError('sqlite',`no such collation sequence: ${named}`,{code:1});node.collation=named;return node}if(node.kind==='unary'||node.kind==='cast'||node.kind==='collate')node.value=bind(node.value);else if(node.kind==='binary'){node.left=bind(node.left);node.right=bind(node.right)}else if(node.kind==='call')node.args=node.args.map(bind);else if(node.kind==='case'){if(node.operand)node.operand=bind(node.operand);node.pairs=node.pairs.map(([a,b])=>[bind(a),bind(b)]);if(node.otherwise)node.otherwise=bind(node.otherwise)}return node};
  const rewind=ops.length;ops.push({code:'Rewind',p1:cursor,p2:0});const loop=ops.length,args=tree.args.map(arg=>compileExpressionTree(bind(arg),ops,allocate,parameters,compileAggregateSubquery));ops.push({code:'AggStep',name:tree.name,args,p2:result,collation:tree.collation},{code:'Next',p1:cursor,p2:loop});(ops[rewind] as {p2:number}).p2=ops.length;ops.push({code:'AggFinal',name:tree.name,p1:result});(ops[onceAt] as {p2:number}).p2=ops.length;return result;
 };
 type Entry={name:string;args:Expression[];collation:BuiltinCollation;register:number;distinct:boolean;filter:Expression|null;orderBy:AggregateOrderTerm[];distinctCursor?:number;orderCursor?:number};const entries:Entry[]=[];
 const lower=(e:Expression,inside=false):Expression=>{if(e.kind==="aggregate"){if(inside)throw new JSQLiteError("sqlite","misuse of aggregate function",{code:1});const register=allocate();entries.push({name:e.name,args:e.args,collation:e.args[0]?collation(e.args[0]):e.collation,register,distinct:e.distinct,filter:e.filter,orderBy:e.orderBy});return{kind:"register",index:register}}if(e.kind==="unary"||e.kind==="cast"||e.kind==="collate")e.value=lower(e.value,inside);else if(e.kind==="binary"){e.left=lower(e.left,inside);e.right=lower(e.right,inside)}else if(e.kind==="call")e.args=e.args.map(x=>lower(x,inside));else if(e.kind==="case"){if(e.operand)e.operand=lower(e.operand,inside);e.pairs=e.pairs.map(([a,b])=>[lower(a,inside),lower(b,inside)]);if(e.otherwise)e.otherwise=lower(e.otherwise,inside)}return e};
 const outputs=trees.map(x=>lower(x)),having=havingTree?lower(havingTree):null;
 // select.c AggInfo retains bare result columns from the first row that feeds
 // an ordinary (non-GROUP BY) aggregate. Cache those values before Next moves
 // the table cursor; final projection must not reread the last/exhausted cursor.
 const bareColumns:{source:Expression;register:number}[]=[];
 const cacheBare=(e:Expression):Expression=>{if(e.kind==="column"){const existing=bareColumns.find(item=>{const column=item.source as Extract<Expression,{kind:"column"}>;return column.cursor===e.cursor&&column.index===e.index});const register=existing?.register??allocate();if(!existing)bareColumns.push({source:e,register});return{kind:"register",index:register}}if(e.kind==="unary"||e.kind==="cast"||e.kind==="collate")e.value=cacheBare(e.value);else if(e.kind==="binary"){e.left=cacheBare(e.left);e.right=cacheBare(e.right)}else if(e.kind==="call")e.args=e.args.map(cacheBare);else if(e.kind==="case"){if(e.operand)e.operand=cacheBare(e.operand);e.pairs=e.pairs.map(([a,b])=>[cacheBare(a),cacheBare(b)]);if(e.otherwise)e.otherwise=cacheBare(e.otherwise)}return e};
 if(!select.hasGroupBy){outputs.forEach((output,index)=>outputs[index]=cacheBare(output));if(having)cacheBare(having);}
 const bareOnce=bareColumns.length?allocate():undefined;
 const groupLimit=select.hasGroupBy?computeLimitRegisters(select,ops,allocate,parameters):undefined;
 const resolvedOrderResultIndices=select.hasGroupBy&&select.hasOrderBy?select.orderBy.map(term=>aggregateOrderResultIndex(select,term)):[];
 const resultSorter=resolvedOrderResultIndices.length>0&&resolvedOrderResultIndices.every(index=>index>=0)&&select.orderBy.some((term,index)=>term.descending||term.nulls!==null||!groups.some(group=>sameExpression(rawTrees[resolvedOrderResultIndices[index]!]!,group)))?2:undefined;
 const orderResultIndices=resultSorter!==undefined?resolvedOrderResultIndices:[];
 if(resultSorter!==undefined)ops.push({code:"SorterOpen",p1:resultSorter,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:select.orderBy.length,keyFieldCount:select.orderBy.length,terms:select.orderBy.map((term,index)=>({collation:collation(outputs[orderResultIndices[index]!]!),desc:term.descending,nullsLarge:term.nulls==="last"?!term.descending:term.nulls==="first"?term.descending:false}))})});
 const distinctResultCursor=select.hasDistinct?Math.max(3,...aggregateSources.map(source=>source.cursor))+3:undefined;if(distinctResultCursor!==undefined)ops.push({code:"OpenEphemeral",p1:distinctResultCursor,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:outputs.length,keyFieldCount:outputs.length,terms:outputs.map(output=>({collation:collation(output)}))})});
 let modifierCursor=Math.max(distinctResultCursor??0,2,...aggregateSources.map(source=>source.cursor))+10;for(const entry of entries){if(entry.distinct){entry.distinctCursor=modifierCursor++;ops.push({code:"OpenEphemeral",p1:entry.distinctCursor,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:entry.args.length,keyFieldCount:entry.args.length,terms:entry.args.map(arg=>({collation:collation(arg)}))})});}if(entry.orderBy.length){entry.orderCursor=modifierCursor++;ops.push({code:"SorterOpen",p1:entry.orderCursor,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:entry.orderBy.length,keyFieldCount:entry.orderBy.length,terms:entry.orderBy.map(term=>({collation:collation(term.expression),desc:term.descending,nullsLarge:term.nullsLarge}))})});}}
 const groupLimitJumps:number[]=[];
 const emitSteps=(changed?:number)=>{for(const entry of entries){let filterJump:number|undefined;if(entry.filter){const test=compileExpressionTree(entry.filter,ops,allocate,parameters);filterJump=ops.length;ops.push({code:"IfNot",p1:test,p2:0});}const args=entry.args.map(arg=>compileExpressionTree(arg,ops,allocate,parameters));let duplicate:number|undefined;if(entry.distinctCursor!==undefined){const distinctStart=allocate();registers+=args.length-1;args.forEach((arg,index)=>ops.push({code:"Copy",p1:arg,p2:distinctStart+index}));duplicate=ops.length;ops.push({code:"Found",p1:entry.distinctCursor,keyStart:distinctStart,keyCount:args.length,jump:0},{code:"IdxInsert",p1:entry.distinctCursor,keyStart:distinctStart,keyCount:args.length});}if(entry.orderCursor!==undefined){const keyStart=allocate();registers+=entry.orderBy.length-1;entry.orderBy.forEach((term,index)=>{const value=compileExpressionTree(term.expression,ops,allocate,parameters);ops.push({code:"Copy",p1:value,p2:keyStart+index});});const payload=allocate();registers+=args.length-1;args.forEach((arg,index)=>ops.push({code:"Copy",p1:arg,p2:payload+index}));ops.push({code:"SorterInsert",p1:entry.orderCursor,keyStart,keyCount:entry.orderBy.length,payload,payloadCount:args.length});}else ops.push({code:"AggStep",name:entry.name,args,p2:entry.register,collation:entry.collation,...((entry.name==="min"||entry.name==="max")&&changed!==undefined?{changed}: {})});const end=ops.length;if(filterJump!==undefined)(ops[filterJump] as {p2:number}).p2=end;if(duplicate!==undefined)(ops[duplicate] as {jump:number}).jump=end;}};
 const emitFinals=()=>{for(const entry of entries){if(entry.orderCursor!==undefined){const args=allocate();registers+=entry.args.length-1;const sort=ops.length;ops.push({code:"SorterSort",p1:entry.orderCursor,emptyJump:0},{code:"SorterData",p1:entry.orderCursor,p2:args,count:entry.args.length},{code:"AggStep",name:entry.name,args:Array.from({length:entry.args.length},(_,i)=>args+i),p2:entry.register,collation:entry.collation},{code:"SorterNext",p1:entry.orderCursor,p2:sort+1});(ops[sort] as {emptyJump:number}).emptyJump=ops.length;}ops.push({code:"AggFinal",name:entry.name,p1:entry.register});}};
 if(select.hasGroupBy){
  const width=sourceWidth,keyCount=groups.length,sorter=1,sortedBase=allocate(),savedBase=sortedBase+keyCount+width;registers=savedBase+keyCount+width-1;
  const keyInfo=new KeyInfo({encoding:database.encoding,totalFieldCount:keyCount,keyFieldCount:keyCount,terms:groups.map(group=>({collation:collation(group)}))});
  ops.push({code:"SorterOpen",p1:sorter,keyInfo});aggregateSources.forEach(source=>ops.push({code:"OpenRead",p1:source.table.rootPage,p2:source.cursor}));const rewinds:number[]=[],bodies:number[]=[],predicateJumps:{at:number;level:number}[]=[];for(let level=0;level<aggregateSources.length;level++){rewinds[level]=ops.length;ops.push({code:"Rewind",p1:aggregateSources[level]!.cursor,p2:0});bodies[level]=ops.length;const on=aggregateSources[level]!.item.on;if(on){const test=compileExpressionTree(resolve(expressionFromReduction(on.reduction!)),ops,allocate,parameters);const at=ops.length;ops.push({code:"IfNot",p1:test,p2:0});predicateJumps.push({at,level});}}
  if(where){const test=compileExpressionTree(where,ops,allocate,parameters,compileAggregateSubquery);const at=ops.length;ops.push({code:"IfNot",p1:test,p2:0});predicateJumps.push({at,level:aggregateSources.length-1});}
  const keys=groups.map(group=>compileExpressionTree(group,ops,allocate,parameters)),combined=registers+1;registers+=keyCount+width;keys.forEach((value,i)=>ops.push({code:"Copy",p1:value,p2:combined+i}));for(const source of aggregateSources)for(let i=0;i<source.table.columns.length;i++)ops.push(isIntegerPrimaryKeyAlias(source.table,i)?{code:"Rowid",p1:source.cursor,p2:combined+keyCount+source.base+i}:{code:"Column",p1:i,p2:combined+keyCount+source.base+i,p3:source.cursor});ops.push({code:"SorterInsert",p1:sorter,keyStart:combined,keyCount,payload:combined,payloadCount:keyCount+width});
  const nextAt:number[]=[];for(let level=aggregateSources.length-1;level>=0;level--){nextAt[level]=ops.length;ops.push({code:"Next",p1:aggregateSources[level]!.cursor,p2:bodies[level]!});}const sortAt=ops.length;for(let level=0;level<aggregateSources.length;level++)(ops[rewinds[level]!] as {p2:number}).p2=level===0?sortAt:nextAt[level-1]!;for(const jump of predicateJumps)(ops[jump.at] as {p2:number}).p2=nextAt[jump.level]!;ops.push({code:"SorterSort",p1:sorter,emptyJump:0},{code:"SorterData",p1:sorter,p2:sortedBase,count:keyCount+width});
  for(let i=0;i<keyCount+width;i++)ops.push({code:"Copy",p1:sortedBase+i,p2:savedBase+i});
  const accumulatorRegisters=entries.map(x=>x.register);ops.push({code:"AggReset",registers:accumulatorRegisters});
  const rowColumns=(e:Expression):Expression=>{if(e.kind==="column")return{kind:"register",index:sortedBase+keyCount+(e.payloadIndex??e.index)};if(e.kind==="unary"||e.kind==="cast"||e.kind==="collate")e.value=rowColumns(e.value);else if(e.kind==="binary"){e.left=rowColumns(e.left);e.right=rowColumns(e.right)}else if(e.kind==="call"||e.kind==="aggregate")e.args=e.args.map(rowColumns);else if(e.kind==="case"){if(e.operand)e.operand=rowColumns(e.operand);e.pairs=e.pairs.map(([a,b])=>[rowColumns(a),rowColumns(b)]);if(e.otherwise)e.otherwise=rowColumns(e.otherwise)}return e};
  entries.forEach(entry=>{entry.args=entry.args.map(rowColumns);if(entry.filter)entry.filter=rowColumns(entry.filter);entry.orderBy=entry.orderBy.map(term=>({...term,expression:rowColumns(term.expression)}));});if(having)rowColumns(having);const savedColumns=(e:Expression):Expression=>{if(e.kind==="register"&&e.index>=sortedBase+keyCount&&e.index<sortedBase+keyCount+width){const column=e.index-sortedBase-keyCount,group=groups.findIndex(g=>g.kind==="column"&&g.index===column);return{kind:"register",index:group>=0?savedBase+group:savedBase+keyCount+column}};if(e.kind==="unary"||e.kind==="cast"||e.kind==="collate")e.value=savedColumns(e.value);else if(e.kind==="binary"){e.left=savedColumns(e.left);e.right=savedColumns(e.right)}else if(e.kind==="call")e.args=e.args.map(savedColumns);else if(e.kind==="case"){if(e.operand)e.operand=savedColumns(e.operand);e.pairs=e.pairs.map(([a,b])=>[savedColumns(a),savedColumns(b)]);if(e.otherwise)e.otherwise=savedColumns(e.otherwise)}return e};outputs.forEach((x,i)=>outputs[i]=savedColumns(rowColumns(x)));if(having)savedColumns(having);const change=entries.filter(e=>e.name==="min"||e.name==="max").length===1?allocate():undefined;const stepAt=ops.length;emitSteps(change);if(change!==undefined){const unchanged=ops.length;ops.push({code:"IfNot",p1:change,p2:0});for(let i=0;i<width;i++)ops.push({code:"Copy",p1:sortedBase+keyCount+i,p2:savedBase+keyCount+i});(ops[unchanged] as {p2:number}).p2=ops.length}const advance=ops.length;ops.push({code:"SorterNext",p1:sorter,p2:advance+2},{code:"Goto",p2:0},{code:"SorterData",p1:sorter,p2:sortedBase,count:keyCount+width});ops.push({code:"CompareGroup",left:sortedBase,right:savedBase,count:keyCount,keyInfo,jump:stepAt});
  const emitGroup=()=>{emitFinals();let reject=-1;if(having){const test=compileExpressionTree(having,ops,allocate,parameters,compileAggregateSubquery);reject=ops.length;ops.push({code:"IfNot",p1:test,p2:0})}outputs.forEach((tree,index)=>{const value=compileExpressionTree(tree,ops,allocate,parameters,compileAggregateSubquery);ops.push({code:"Copy",p1:value,p2:index+1})});let duplicate=-1;if(distinctResultCursor!==undefined){duplicate=ops.length;ops.push({code:"Found",p1:distinctResultCursor,keyStart:1,keyCount:outputs.length,jump:0},{code:"IdxInsert",p1:distinctResultCursor,keyStart:1,keyCount:outputs.length});}if(resultSorter!==undefined){const keyStart=allocate();registers+=orderResultIndices.length-1;orderResultIndices.forEach((resultIndex,index)=>ops.push({code:"Copy",p1:resultIndex+1,p2:keyStart+index}));ops.push({code:"SorterInsert",p1:resultSorter,keyStart,keyCount:orderResultIndices.length,payload:1,payloadCount:outputs.length,...(groupLimit?{topN:groupLimit.capacity}:{})});}else{let offsetAt:number|undefined;if(groupLimit?.offset!==undefined){offsetAt=ops.length;ops.push({code:"IfPos",p1:groupLimit.offset,p2:0,p3:1});}ops.push({code:"ResultRow",p1:1,p2:outputs.length});if(groupLimit){groupLimitJumps.push(ops.length);ops.push({code:"DecrJumpZero",p1:groupLimit.count,p2:0});}if(offsetAt!==undefined)(ops[offsetAt] as {p2:number}).p2=ops.length;}if(duplicate>=0)(ops[duplicate] as {jump:number}).jump=ops.length;if(reject>=0)(ops[reject] as {p2:number}).p2=ops.length;};
  emitGroup();ops.push({code:"AggReset",registers:accumulatorRegisters});for(const entry of entries){if(entry.distinctCursor!==undefined)ops.push({code:"ClearEphemeral",p1:entry.distinctCursor});if(entry.orderCursor!==undefined)ops.push({code:"ClearSorter",p1:entry.orderCursor});}for(let i=0;i<keyCount+width;i++)ops.push({code:"Copy",p1:sortedBase+i,p2:savedBase+i});ops.push({code:"Goto",p2:stepAt});const finalAt=ops.length;(ops[advance+1] as {p2:number}).p2=finalAt;emitGroup();let resultSortAt:number|undefined,resultOffsetAt:number|undefined,resultLimitAt:number|undefined;if(resultSorter!==undefined){resultSortAt=ops.length;ops.push({code:"SorterSort",p1:resultSorter,emptyJump:0},{code:"SorterData",p1:resultSorter,p2:1,count:outputs.length});if(groupLimit?.offset!==undefined){resultOffsetAt=ops.length;ops.push({code:"IfPos",p1:groupLimit.offset,p2:0,p3:1});}ops.push({code:"ResultRow",p1:1,p2:outputs.length});if(groupLimit){resultLimitAt=ops.length;ops.push({code:"DecrJumpZero",p1:groupLimit.count,p2:0});}const resultNext=ops.length;ops.push({code:"SorterNext",p1:resultSorter,p2:resultSortAt+1});if(resultOffsetAt!==undefined)(ops[resultOffsetAt] as {p2:number}).p2=resultNext;}const halt=ops.length;ops.push({code:"Halt"});(ops[sortAt] as {emptyJump:number}).emptyJump=halt;if(resultSortAt!==undefined)(ops[resultSortAt] as {emptyJump:number}).emptyJump=halt;if(resultLimitAt!==undefined)(ops[resultLimitAt] as {p2:number}).p2=halt;for(const at of groupLimitJumps)(ops[at] as {p2:number}).p2=halt;if(groupLimit)(ops[groupLimit.ifZero] as {p2:number}).p2=halt;
  const columns=select.result.map((expression,i)=>{const tree=trees[i]!;if(tree.kind==="column"){const source=aggregateSources.find(item=>item.cursor===(tree.cursor??0))!,columnIndex=tree.index<0?(tree.payloadIndex??source.base)-source.base:tree.index,c=source.table.columns[columnIndex]!;return Object.freeze({name:expression.alias??c.name,declaredType:c.declaredType,database:"main",table:source.table.name,origin:c.name})}return Object.freeze({name:expressionName(expression),declaredType:null,database:null,table:null,origin:null})});return Object.freeze({ops:Object.freeze(ops),registers,columns:Object.freeze(columns),parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,encoding:database.encoding});
 }
 let rewind=-1,body=0,skip=-1;
 if(table){ops.push({code:"OpenRead",p1:table.rootPage});rewind=ops.length;ops.push({code:"Rewind",p2:0});body=ops.length;if(where){const test=compileExpressionTree(where,ops,allocate,parameters);skip=ops.length;ops.push({code:"IfNot",p1:test,p2:0});}if(bareOnce!==undefined){const onceAt=ops.length;ops.push({code:"Once",p1:bareOnce,p2:0});for(const item of bareColumns){const value=compileExpressionTree(item.source,ops,allocate,parameters);ops.push({code:"Copy",p1:value,p2:item.register});}(ops[onceAt] as {p2:number}).p2=ops.length;}emitSteps();const next=ops.length;ops.push({code:"Next",p2:body});if(skip>=0)(ops[skip] as {p2:number}).p2=next;(ops[rewind] as {p2:number}).p2=ops.length;}else {if(where){const test=compileExpressionTree(where,ops,allocate,parameters);skip=ops.length;ops.push({code:"IfNot",p1:test,p2:0});}emitSteps();if(skip>=0)(ops[skip] as {p2:number}).p2=ops.length;}
 emitFinals();let reject=-1;if(having){const test=compileExpressionTree(having,ops,allocate,parameters,compileAggregateSubquery);reject=ops.length;ops.push({code:"IfNot",p1:test,p2:0})}outputs.forEach((tree,index)=>{const value=compileExpressionTree(tree,ops,allocate,parameters,compileAggregateSubquery);ops.push({code:"Copy",p1:value,p2:index+1})});ops.push({code:"ResultRow",p1:1,p2:outputs.length});if(reject>=0)(ops[reject] as {p2:number}).p2=ops.length;ops.push({code:"Halt"});
 const columns=select.result.map(expression=>Object.freeze({name:expressionName(expression),declaredType:null,database:null,table:null,origin:null}));return Object.freeze({ops:Object.freeze(ops),registers,columns:Object.freeze(columns),parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,encoding:database.encoding});
}


function truth(m:Mem):boolean|null{if(m.initialStorageClass==="null")return null;return booleanValue(m,0)===1}
const expressionAffinity=(x:Expression):MemAffinity|undefined=>x.kind==="column"?x.affinity:x.kind==="cast"?x.affinity:x.kind==="collate"?expressionAffinity(x.value):undefined;
// expr.c:sqlite3ExprCollSeq follows CAST/unary-plus and propagates EP_Collate
// through expression children (including function argument lists), choosing the
// first collated child in source order. Keep undefined distinct from BINARY so
// select.c:multiSelectCollSeq can continue to a later compound arm.
const expressionCollation=(x:Expression):BuiltinCollation|undefined=>{
 if(x.kind==="collate")return x.collation;
 if(x.kind==="mem"||x.kind==="column")return x.collation;
 if(x.kind==="unary"||x.kind==="cast")return expressionCollation(x.value);
 if(x.kind==="binary")return expressionCollation(x.left)??expressionCollation(x.right);
 if(x.kind==="call"||x.kind==="aggregate")return x.args.map(expressionCollation).find((value):value is BuiltinCollation=>value!==undefined);
 if(x.kind==="case")return (x.operand?expressionCollation(x.operand):undefined)??x.pairs.flatMap(([when,then])=>[when,then]).map(expressionCollation).find((value):value is BuiltinCollation=>value!==undefined)??(x.otherwise?expressionCollation(x.otherwise):undefined);
 return undefined;
};
const collation=(x:Expression):BuiltinCollation=>expressionCollation(x)??"binary";
// expr.c sqlite3BinaryCompareCollSeq: explicit left, then explicit right, then derived left/right.
const explicitCollation=(x:Expression):BuiltinCollation|undefined=>{
 if(x.kind==="collate")return x.collation;
 if(x.kind==="unary"||x.kind==="cast")return explicitCollation(x.value);
 if(x.kind==="binary")return explicitCollation(x.left)??explicitCollation(x.right);
 if(x.kind==="call"||x.kind==="aggregate")return x.args.map(explicitCollation).find((value):value is BuiltinCollation=>value!==undefined);
 if(x.kind==="case")return (x.operand?explicitCollation(x.operand):undefined)??x.pairs.flatMap(([when,then])=>[when,then]).map(explicitCollation).find((value):value is BuiltinCollation=>value!==undefined)??(x.otherwise?explicitCollation(x.otherwise):undefined);
 return undefined;
};
const binaryCollation=(left:Expression,right:Expression):BuiltinCollation=>explicitCollation(left)??explicitCollation(right)??collation(left)??collation(right);
function valueBytes(value:Mem):number{return value.initialStorageClass==="text"?value.textBytes().byteLength:value.initialStorageClass==="blob"?value.blobValue().byteLength:0;}
interface ScalarControl { charge(units:number):void; check():void; checkSize(bytes:number):void; readonly maxResultBytes:number; now?():bigint; readonly dateTimeEnvironment?:DateTimeEnvironment }
function evaluateFunction(name:string,a:Mem[],encoding:DatabaseEncoding,coll:"binary"|BuiltinCollation="binary",control?:ScalarControl):Mem{
 const out=new Mem(),charge=(units:number)=>control?.charge(units),checkSize=(bytes:number)=>{if(!Number.isSafeInteger(bytes)||bytes<0||(control&&bytes>control.maxResultBytes))throw new JSQLiteError("limit","string or blob too big")};
 const workBytes=(bytes:number)=>{if(bytes>0)charge(Math.ceil(bytes/256))},checkpoint=(index:number)=>{if((index&255)===0){charge(1);control?.check()}};
 if(["julianday","unixepoch","date","time","datetime","strftime","timediff","current_time","current_date","current_timestamp"].includes(name))return evaluateDateTime(name,a,encoding,control?.now??(()=>BigInt(Date.now())),control?.dateTimeEnvironment??defaultDateTimeEnvironment,control);
 if(isMathFunction(name))return evaluateMathFunction(name,a,encoding);
 if(name==="json"||name==="jsonb"){
  if(a[0]!.initialStorageClass==="null")return out;
  const node=parseJsonMem(a[0]!,true,units=>{charge(units);control?.check()});
  const result=name==="json"?jsonTextResult(node):jsonbMemResult(a[0]!,node);
  checkSize(valueBytes(result));return result;
 }
 if(name==="json_extract"||name==="jsonb_extract"){
  const result=(name==="json_extract"?jsonExtract:jsonbExtract)(a[0]!,a.slice(1),units=>{charge(units);control?.check()});
  checkSize(valueBytes(result));return result;
 }
 if(name==="json_arrow"||name==="json_arrow_sql")return jsonArrow(a[0]!,a[1]!,name==="json_arrow_sql",units=>{charge(units);control?.check()});
 if(name==="json_type"){return jsonType(a[0]!,a[1],units=>{charge(units);control?.check()})}
 if(name==="json_array_length"){return jsonArrayLength(a[0]!,a[1],units=>{charge(units);control?.check()})}
 if(name==="json_error_position")return jsonErrorPosition(a[0]!);
 if(name==="json_quote")return jsonQuote(a[0]!);
 if(["json_array","json_object","jsonb_array","jsonb_object"].includes(name)){const result=jsonConstruct(name.endsWith("array")?"array":"object",a,name.startsWith("jsonb_"));checkSize(valueBytes(result));return result}
 if(/jsonb?_(?:insert|replace|set|remove|array_insert)$/.test(name)){const mode=name.endsWith("array_insert")?"array_insert":name.slice(name.indexOf("_")+1) as "insert"|"replace"|"set"|"remove";const result=jsonEdit(a[0]!,a.slice(1),mode,units=>{charge(units);control?.check()},name.startsWith("jsonb_"));checkSize(valueBytes(result));return result}
 if(name==="json_patch"||name==="jsonb_patch"){const result=jsonPatch(a[0]!,a[1]!,units=>{charge(units);control?.check()},name==="jsonb_patch");checkSize(valueBytes(result));return result}
 if(name==="json_pretty")throw new JSQLiteError("unsupported","json_pretty() is temporarily unsupported",{unsupportedClassification:"temporary"});
 if(name==="json_valid"){
  if(a[0]!.initialStorageClass==="null")return out;
  let flags=1;
  if(a.length===2){
   if(a[1]!.initialStorageClass==="null")return out;
   flags=Number(a[1]!.integerValue());
  }
  out.setInt64(jsonValid(a[0]!,flags,units=>{charge(units);control?.check()})?1n:0n);return out;
 }
 if(name==="likely"||name==="unlikely"||name==="likelihood")return a[0]!;
 if(name==="subtype"){out.setInt64(BigInt(a[0]!.subtypeValue()));return out}
 if(name==="sqlite_version")return scalarText(SQLITE_VERSION);
 if(name==="sqlite_source_id")return scalarText(SQLITE_SOURCE_ID);
 if(name==="last_insert_rowid"||name==="changes"||name==="total_changes"){out.setInt64(0n);return out}
 if(name==="sqlite_log")return out;
 if(name==="printf"||name==="format"){const formatted=a.length?sqliteFormat(a[0]!,a.slice(1),{maxBytes:control?.maxResultBytes??Number.MAX_SAFE_INTEGER,charge,check:()=>control?.check()}):null;if(formatted===null)return out;const bytes=new TextEncoder().encode(formatted);checkSize(bytes.length);out.setText(bytes,"utf-8");return out}
 if(name==="round"){const rounded=sqliteRound(a[0]!,a[1]);if(rounded!==null)out.setDouble(rounded);return out}
 if(name==="sqlite_compileoption_get"){const index=Number(a[0]!.integerValue());return index>=0&&index<SQLITE_COMPILE_OPTIONS.length?scalarText(SQLITE_COMPILE_OPTIONS[index]!):out}
 if(name==="sqlite_compileoption_used"){const query=asText(a[0]!,encoding).toUpperCase();out.setInt64(SQLITE_COMPILE_OPTIONS.some(option=>option.toUpperCase()===query||option.split("=")[0]!.toUpperCase()===query)?1n:0n);return out}
 if(name==="like"||name==="glob"){
  if(a.some(x=>x.initialStorageClass==="null"))return out;
  const textValue=(value:Mem):string=>{if(value.initialStorageClass!=="blob")return asText(value,encoding);const copy=new Mem();copy.setText(value.blobValue(),encoding);return copy.textValue()};
  const pattern=textValue(a[0]!),candidate=textValue(a[1]!);
  // Pinned default SQLITE_LIMIT_LIKE_PATTERN_LENGTH.
  if(new TextEncoder().encode(pattern).byteLength>50000)throw new JSQLiteError("sqlite","LIKE or GLOB pattern too complex",{code:1});
  const escape=name==="like"&&a.length===3?validateLikeEscape(textValue(a[2]!)):null;
  out.setInt64(sqlitePatternCompare(pattern,candidate,name,escape,control)?1n:0n);return out;
 }
 if(name==="substring")name="substr";
 if(name==="min"||name==="max"){if(a.some(x=>x.initialStorageClass==="null"))return out;let best=0;for(let i=1;i<a.length;i++){const cmp=compareMem(a[i]!,a[best]!,coll);if(name==="min"?cmp<=0:cmp>0)best=i}return a[best]!}if(name==="upper"||name==="lower"){const input=a[0]!;if(input.initialStorageClass==="null")return out;const text=new Mem();if(input.initialStorageClass==="blob"){text.setText(input.blobValue(),encoding);text.changeEncoding("utf-8")}else{text.copyFrom(input);text.cast("text","utf-8")}const source=text.textBytes(),bytes=new Uint8Array(source);checkSize(bytes.byteLength);for(let i=0;i<bytes.length;i++){if((i&255)===0){charge(1);control?.check()}const byte=bytes[i]!;if(name==="upper"&&byte>=0x61&&byte<=0x7a)bytes[i]=byte-0x20;else if(name==="lower"&&byte>=0x41&&byte<=0x5a)bytes[i]=byte+0x20}out.setText(bytes,"utf-8");return out}
 if(name==="trim"||name==="ltrim"||name==="rtrim"){if(a.some(x=>x.initialStorageClass==="null"))return out;const source=[...asText(a[0]!,encoding)],characters=a[1]?asText(a[1],encoding).split("\0",1)[0]!:" ",set=new Set([...characters]);let start=0,end=source.length,steps=0;if(name!=="rtrim")while(start<end&&set.has(source[start]!)){checkpoint(steps++);start++}if(name!=="ltrim")while(end>start&&set.has(source[end-1]!)){checkpoint(steps++);end--}const value=source.slice(start,end).join("");checkSize(utf8Length(value));out.setText(new TextEncoder().encode(value),"utf-8");out.changeEncoding(encoding);return out}
 if(name==="instr"){if(a.some(x=>x.initialStorageClass==="null"))return out;const blobPair=a[0]!.initialStorageClass==="blob"&&a[1]!.initialStorageClass==="blob";const initialBytes=(value:Mem)=>value.initialStorageClass==="blob"?value.blobValue():asUtf8(value);const searchBytes=(value:Mem,mixed:boolean)=>{if(!mixed||value.initialStorageClass!=="blob")return asUtf8(value);const copy=new Mem();copy.setText(value.blobValue(),encoding);copy.changeEncoding("utf-8");return copy.textBytes()};const originalHaystack=initialBytes(a[0]!),originalNeedle=initialBytes(a[1]!);const mixed=!blobPair&&(a[0]!.initialStorageClass==="blob"||a[1]!.initialStorageClass==="blob"),haystack=blobPair?originalHaystack:searchBytes(a[0]!,mixed),needle=blobPair?originalNeedle:searchBytes(a[1]!,mixed);const nHaystack=mixed?haystack.length:originalHaystack.length,nNeedle=mixed?needle.length:originalNeedle.length;if(nNeedle===0){out.setInt64(1n);return out}let offset=-1,comparisons=0;outer:for(let i=0;i+nNeedle<=nHaystack;i++){for(let j=0;j<nNeedle;j++){checkpoint(comparisons++);if((haystack[i+j]??0)!==(needle[j]??0))continue outer}offset=i;break}if(offset<0){out.setInt64(0n);return out}if(blobPair){out.setInt64(BigInt(offset+1));return out}let characters=1;for(let i=0;i<offset;i++)if((haystack[i]!&0xc0)!==0x80)characters++;out.setInt64(BigInt(characters));return out}
 if(name==="unicode"){const cp=firstCodePoint(a[0]!);if(cp!==null)out.setInt64(BigInt(cp));return out}
 if(name==="unistr"){if(a[0]!.initialStorageClass==="null")return out;const value=decodeUnistr(asText(a[0]!,encoding),control?.maxResultBytes,()=>{charge(1);control?.check()});out.setText(new TextEncoder().encode(value),"utf-8");out.changeEncoding(encoding);return out}
 if(name==="quote"){return scalarText(quoteValue(a[0]!,control?.maxResultBytes))}
 if(name==="unistr_quote"){if(a[0]!.initialStorageClass!=="text")return scalarText(quoteValue(a[0]!,control?.maxResultBytes));const value=a[0]!.textValue();let escaped=false,size=10,index=0;for(const c of value){checkpoint(index++);const n=c.codePointAt(0)!;if(n<0x20||n===0x5c)escaped=true;size+=c==="'"||c==="\\"?2:n<0x20?6:utf8Length(c)}if(!escaped)return scalarText(quoteValue(a[0]!,control?.maxResultBytes));checkSize(size);const parts:string[]=[];index=0;for(const c of value){checkpoint(index++);const n=c.codePointAt(0)!;parts.push(c==="'"?"''":c==="\\"?"\\\\":n<0x20?`\\u${n.toString(16).padStart(4,"0")}`:c)}return scalarText(`unistr('${parts.join("")}')`)}
 if(name==="unhex"){if(a.some(x=>x.initialStorageClass==="null"))return out;const value=asText(a[0]!,encoding),ignore=a[1]?new Set([...asText(a[1],encoding)]):new Set<string>();let digits=0,index=0;for(const c of value){checkpoint(index++);if(ignore.has(c))continue;if(!/^[0-9a-f]$/i.test(c))return out;digits++}if(digits%2)return out;checkSize(digits/2);const bytes=new Uint8Array(digits/2);let high=-1,at=0;index=0;for(const c of value){checkpoint(index++);if(ignore.has(c))continue;const digit=parseInt(c,16);if(high<0)high=digit;else{bytes[at++]=(high<<4)|digit;high=-1}}out.setBlob(bytes);return out}
 if(name==="zeroblob"){let n=Number(a[0]!.integerValue());if(n<0)n=0;checkSize(n);workBytes(n);control?.check();out.setBlob(new Uint8Array(n));return out}
 if(name==="concat"||name==="concat_ws"){if(name==="concat_ws"&&a[0]!.initialStorageClass==="null")return out;const separator=name==="concat_ws"?asText(a[0]!,encoding):"",values=a.slice(name==="concat_ws"?1:0).filter(x=>x.initialStorageClass!=="null").map(x=>asText(x,encoding));let size=0;for(let i=0;i<values.length;i++){checkpoint(i);size+=utf8Length(values[i]!)+(i?utf8Length(separator):0);checkSize(size)}workBytes(size);return scalarText(values.join(separator))}
 if(name==="sign"){if(a[0]!.initialStorageClass==="null")return out;const n=a[0]!.numericTypeCopy();if(a[0]!.initialStorageClass==="text"&&n.initialStorageClass==="integer"&&n.integerValue()===0n&&asText(a[0]!,encoding).trim()!=="0")return out;const value=n.initialStorageClass==="integer"?Number(n.integerValue()):n.realValue();out.setInt64(BigInt(value<0?-1:value>0?1:0));return out}
 if(name==="random"){let value;do{value=new DataView(secureRandom(8).buffer).getBigInt64(0)}while(value===-(1n<<63n));out.setInt64(value);return out}
 if(name==="randomblob"){let n=Number(a[0]!.integerValue());if(n<1)n=1;checkSize(n);workBytes(n);out.setBlob(secureRandom(n,()=>control?.check()));return out}
 if(name==="char"){const codepoints:number[]=[];let size=0;for(let i=0;i<a.length;i++){checkpoint(i);let n=Number(a[i]!.integerValue());if(n<0||n>0x10ffff)n=0xfffd;size+=n<=0x7f?1:n<=0x7ff?2:n<=0xffff?3:4;checkSize(size);codepoints.push(n)}workBytes(size);out.setText(new TextEncoder().encode(String.fromCodePoint(...codepoints)),"utf-8");return out}if(name==="hex"){const c=a[0]!;if(c.initialStorageClass==="null"){out.setText(new Uint8Array(),"utf-8");return out}const bytes=c.initialStorageClass==="blob"?c.blobValue():c.initialStorageClass==="text"?c.textBytes():new TextEncoder().encode(String(memToPublicInitial(c)));checkSize(bytes.byteLength*2);charge(Math.ceil(bytes.byteLength/256));out.setText(new TextEncoder().encode(Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("").toUpperCase()),"utf-8");return out}if(name==="replace"){if(a.some(x=>x.initialStorageClass==="null"))return out;const source=a[0]!.textValue(),search=a[1]!.textValue().split("\0")[0]!,replacement=a[2]!.textValue();let value:string;if(!search)value=source;else{const count=source.split(search).length-1;const estimate=new TextEncoder().encode(source).byteLength+count*(new TextEncoder().encode(replacement).byteLength-new TextEncoder().encode(search).byteLength);checkSize(estimate);charge(Math.ceil(source.length/256)+count);value=source.split(search).join(replacement)}const bytes=new TextEncoder().encode(value);checkSize(bytes.byteLength);out.setText(bytes,"utf-8");return out}if(name==="typeof"){out.setText(new TextEncoder().encode(a[0]!.initialStorageClass),"utf-8");return out}if(name==="nullif"){if(a[0]!.initialStorageClass!=="null"&&a[1]!.initialStorageClass!=="null"&&compareMem(a[0]!,a[1]!,coll)===0)return out;return a[0]!}if(name==="octet_length"||name==="length"){if(a[0]!.initialStorageClass==="null")return out;const c=new Mem();c.copyFrom(a[0]!);if(c.initialStorageClass!=="text"&&c.initialStorageClass!=="blob")c.stringify(encoding);if(name==="octet_length")out.setInt64(BigInt(c.initialStorageClass==="blob"?c.blobValue().length:c.textBytes().length));else out.setInt64(BigInt(c.initialStorageClass==="blob"?c.blobValue().length:[...c.textValue().split("\0")[0]!].length));return out}if(name==="abs"){const c=a[0]!;if(c.initialStorageClass==="null")return out;if(c.initialStorageClass==="integer"){const n=c.integerValue();if(n===-(1n<<63n))throw new JSQLiteError("sqlite","integer overflow",{code:1});out.setInt64(n<0?-n:n)}else if(c.initialStorageClass==="real")out.setDouble(Math.abs(c.realValue()));else{const numeric=c.numericTypeCopy();out.setDouble(Math.abs(numeric.initialStorageClass==="integer"?Number(numeric.integerValue()):numeric.realValue()))}return out}if(name==="substr"){if(a.some(x=>x.initialStorageClass==="null"))return out;const blob=a[0]!.initialStorageClass==="blob",input=blob?a[0]!.blobValue():[...a[0]!.textValue().split("\0")[0]!],total=input.length;let p1=Number(a[1]!.integerValue()),p2=a[2]?Number(a[2]!.integerValue()):Number.MAX_SAFE_INTEGER;if(p1<0){p1+=total;if(p1<0){if(p2<0)p2=0;else p2+=p1;p1=0}}else if(p1>0)p1--;else if(p2>0)p2--;if(p2<0){p2=Math.min(-p2,p1);p1-=p2}p1=Math.max(0,p1);p2=Math.max(0,p2);const value=input.slice(p1,p1+p2);charge(Math.ceil(total/256));if(blob){const bytes=value as Uint8Array;checkSize(bytes.byteLength);out.setBlob(bytes)}else{const bytes=new TextEncoder().encode((value as string[]).join(""));checkSize(bytes.byteLength);out.setText(bytes,"utf-8")}return out}return out
}

/** vdbe.c OP_Concat: stringify numeric operands in the database encoding,
 * retain BLOB bytes verbatim, and publish a TEXT result. */
function concatenateMem(left:Mem,right:Mem,encoding:DatabaseEncoding,maxBytes=Number.MAX_SAFE_INTEGER):Mem{
 const out=new Mem();
 if(left.initialStorageClass==="null"||right.initialStorageClass==="null")return out;
 const bytes=(input:Mem):Uint8Array=>{
  if(input.initialStorageClass==="blob")return input.blobValue();
  const value=new Mem();value.copyFrom(input);
  if(value.initialStorageClass==="text")value.changeEncoding(encoding,{maxLength:maxBytes});
  else value.stringify(encoding,false,{maxLength:maxBytes});
  return value.textBytes();
 };
 const a=bytes(left),b=bytes(right),length=a.byteLength+b.byteLength;
 if(length>maxBytes)throw new JSQLiteError("limit","string or blob too big");
 const resultLength=encoding==="utf-8"?length:length&~1,result=new Uint8Array(resultLength);
 result.set(a.subarray(0,Math.min(a.length,resultLength)));
 if(a.length<resultLength)result.set(b.subarray(0,resultLength-a.length),a.length);
 out.setText(result,encoding,{maxLength:maxBytes});return out;
}
function evaluateExpression(e:Expression,encoding:DatabaseEncoding,columns?:readonly Mem[]):Mem{
 const out=new Mem();if(e.kind==="register"||e.kind==="aggregate"||e.kind==="scalar-subquery"||e.kind==="in-subquery"||e.kind==="in-list")throw new JSQLiteError("internal","lowered expression reached evaluator");if(e.kind==="variable")throw new JSQLiteError("internal","variables are compiled before execution");if(e.kind==="mem")return e.value;if(e.kind==="column"){out.copyFrom(columns![e.index]!);return out}if(e.kind==="literal"){if(e.value===null)out.setNull();else if(typeof e.value==="bigint")out.setInt64(e.value);else if(typeof e.value==="number")out.setDouble(e.value);else if(typeof e.value==="string")out.setText(new TextEncoder().encode(e.value),"utf-8");else out.setBlob(e.value);return out}
 if(e.kind==="unary"){const v=evaluateExpression(e.value,encoding,columns);if(e.op==="+")return v;if(e.op==="-"){const z=new Mem();z.setInt64(0n);return arithmeticBinary("subtract",z,v)}return e.op==="~"?bitwiseNot(v):logicalNot(v)}
 if(e.kind==="cast"){const v=evaluateExpression(e.value,encoding,columns);v.cast(e.affinity,encoding);return v}
 if(e.kind==="collate")return evaluateExpression(e.value,encoding,columns);
 if(e.kind==="binary"){const a=evaluateExpression(e.left,encoding,columns);if(e.op==="AND"&&truth(a)===false){out.setInt64(0n);return out}if(e.op==="OR"&&truth(a)===true){out.setInt64(1n);return out}const b=evaluateExpression(e.right,encoding,columns);if(e.op==="||")return concatenateMem(a,b,encoding);if(e.op==="AND"||e.op==="OR"){const x=truth(a),y=truth(b),v=e.op==="AND"?(x===false||y===false?false:x===null||y===null?null:true):(x===true||y===true?true:x===null||y===null?null:false);v===null?out.setNull():out.setInt64(v?1n:0n);return out}if(["+","-","*","/","%"].includes(e.op)){return arithmeticBinary(({"+":"add","-":"subtract","*":"multiply","/":"divide","%":"remainder"} as const)[e.op as "+"],a,b)}const is=e.op==="IS"||e.op==="IS NOT";if(!is&&(a.initialStorageClass==="null"||b.initialStorageClass==="null")){out.setNull();return out}const bothNull=a.initialStorageClass==="null"&&b.initialStorageClass==="null",oneNull=a.initialStorageClass==="null"||b.initialStorageClass==="null";let cmp=0;if(!oneNull)cmp=compareMem(a,b,binaryCollation(e.left,e.right));let result:boolean;switch(e.op){case "=":case "==":result=cmp===0;break;case "IS":result=bothNull||(!oneNull&&cmp===0);break;case "!=":case "<>":result=cmp!==0;break;case "IS NOT":result=!bothNull&&(oneNull||cmp!==0);break;case "<":result=cmp<0;break;case "<=":result=cmp<=0;break;case ">":result=cmp>0;break;default:result=cmp>=0}out.setInt64(result?1n:0n);return out}
 if(e.kind==="case"){const base=e.operand?evaluateExpression(e.operand,encoding,columns):null;for(const [w,r] of e.pairs){const test=evaluateExpression(w,encoding,columns);if(base?(base.initialStorageClass!=="null"&&test.initialStorageClass!=="null"&&compareMem(base,test,"binary")===0):truth(test)===true)return evaluateExpression(r,encoding,columns)}return e.otherwise?evaluateExpression(e.otherwise,encoding,columns):out}
 const args=()=>e.args.map(x=>evaluateExpression(x,encoding,columns));if(e.name==="coalesce"){for(const x of e.args){const v=evaluateExpression(x,encoding,columns);if(v.initialStorageClass!=="null")return v}return out}const a=args();return evaluateFunction(e.name,a,encoding,e.args.map(collation).find((_,i)=>e.args[i]!.kind==="collate")??"binary")
}

interface AggregateFunctionContext<State> {
 readonly encoding:DatabaseEncoding;
 readonly collation:BuiltinCollation;
 readonly maxResultBytes:number;
 readonly budget:PrivateStateByteBudget;
 readonly inverseCapable:boolean;
 state():State;
 currentState():State|undefined;
 setResult(value:Mem):void;
 setError(error:unknown):void;
}
interface AggregateDefinition<State=unknown> {
 readonly name:string;
 readonly arities:readonly number[];
 create(context:AggregateFunctionContext<State>):State;
 step(context:AggregateFunctionContext<State>,args:readonly Mem[]):boolean|void;
 readonly inverse?: (context:AggregateFunctionContext<State>,args:readonly Mem[])=>void;
 readonly value?: (context:AggregateFunctionContext<State>)=>void;
 final(context:AggregateFunctionContext<State>):void;
 readonly cleanup?: (state:State)=>void;
}
interface SumCtx {rSum:number;rErr:number;iSum:bigint;cnt:bigint;approx:boolean;ovrfl:boolean}
const INT64_MIN=-(1n<<63n),INT64_MAX=(1n<<63n)-1n,KBN_SPLIT=4503599627370496n;
function kahanBabuskaNeumaierStep(p:SumCtx,r:number):void{const s=p.rSum,t=s+r;p.rErr+=Math.abs(s)>Math.abs(r)?(s-t)+r:(r-t)+s;p.rSum=t;}
function kahanBabuskaNeumaierStepInt64(p:SumCtx,value:bigint):void{if(value<=-KBN_SPLIT||value>=KBN_SPLIT){const small=value%16384n;kahanBabuskaNeumaierStep(p,Number(value-small));kahanBabuskaNeumaierStep(p,Number(small));}else kahanBabuskaNeumaierStep(p,Number(value));}
function kahanBabuskaNeumaierInit(p:SumCtx,value:bigint):void{if(value<=-KBN_SPLIT||value>=KBN_SPLIT){const small=value%16384n;p.rSum=Number(value-small);p.rErr=Number(small);}else{p.rSum=Number(value);p.rErr=0;}}
function sumStep(context:AggregateFunctionContext<SumCtx>,args:readonly Mem[]):void{const value=args[0]!,numeric=value.numericTypeCopy();if(numeric.initialStorageClass==="null")return;const p=context.state();p.cnt++;if(!p.approx){if(numeric.initialStorageClass!=="integer"){kahanBabuskaNeumaierInit(p,p.iSum);p.approx=true;kahanBabuskaNeumaierStep(p,numeric.realValue());}else{const n=numeric.integerValue(),sum=p.iSum+n;if(sum>=INT64_MIN&&sum<=INT64_MAX)p.iSum=sum;else{p.ovrfl=true;kahanBabuskaNeumaierInit(p,p.iSum);p.approx=true;kahanBabuskaNeumaierStepInt64(p,n);}}}else if(numeric.initialStorageClass==="integer")kahanBabuskaNeumaierStepInt64(p,numeric.integerValue());else{p.ovrfl=false;kahanBabuskaNeumaierStep(p,numeric.realValue());}}
function sumInverse(context:AggregateFunctionContext<SumCtx>,args:readonly Mem[]):void{const numeric=args[0]!.numericTypeCopy();if(numeric.initialStorageClass==="null")return;const p=context.currentState();if(!p||p.cnt===0n)throw new JSQLiteError("internal","sum inverse without stepped value");p.cnt--;if(!p.approx&&numeric.initialStorageClass==="integer")p.iSum-=numeric.integerValue();else if(numeric.initialStorageClass==="integer")kahanBabuskaNeumaierStepInt64(p,-numeric.integerValue());else{kahanBabuskaNeumaierStep(p,-numeric.realValue());p.ovrfl=false}}
function sumResult(context:AggregateFunctionContext<SumCtx>,kind:"sum"|"avg"|"total"):void{const p=context.currentState(),out=new Mem();if(kind==="total"&&!p){out.setDouble(0);context.setResult(out);return}if(!p||p.cnt===0n){context.setResult(out);return}if(kind==="sum"&&!p.approx){out.setInt64(p.iSum);context.setResult(out);return}if(kind==="sum"&&p.ovrfl){context.setError(new JSQLiteError("sqlite","integer overflow",{code:1}));return}let r=p.approx?p.rSum:p.iSum===0n?0:Number(p.iSum);if(p.approx&&!Number.isFinite(p.rErr)){}else if(p.approx)r+=p.rErr;if(kind==="avg")r/=Number(p.cnt);out.setDouble(r);context.setResult(out);}
interface CountCtx {count:bigint}
interface RankCtx {nStep:bigint;nValue:bigint}
interface DistributionCtx {nStep:bigint;nValue:bigint;nTotal:bigint}
interface NtileCtx {nTotal:bigint;nParam:bigint;iRow:bigint}
interface NthValueCtx {nStep:bigint;value:Mem|null}
interface LastValueCtx {nVal:bigint;value:Mem|null}
interface ExtremaCtx {values:Mem[];bytes:number;inverseCapable:boolean}
interface ConcatCtx {values:{text:string;separator:string;bytes:number}[];bytes:number}
interface JsonAggregateCtx {items:{key:string|null;value:JsonNode;bytes:number}[];bytes:number}
const emptySum=():SumCtx=>({rSum:0,rErr:0,iSum:0n,cnt:0n,approx:false,ovrfl:false});
const aggregateDefinitions:Readonly<Record<string,AggregateDefinition<any>>>=Object.freeze({
 // window.c:row_numberStep/row_numberValue use an int64 aggregate context.
 // sqlite3WindowUpdate fixes ROWS UNBOUNDED PRECEDING..CURRENT, allowing the
 // common translated frame scheduler to invoke these callbacks in source order.
 row_number:{name:"row_number",arities:[0],create:()=>({count:0n}),step:c=>{c.state().count++},inverse:c=>{const state=c.currentState();if(!state||state.count===0n)throw new JSQLiteError("internal","row_number inverse without stepped value");state.count--},value:c=>{const out=new Mem();out.setInt64(c.currentState()?.count??0n);c.setResult(out)},final:c=>{const out=new Mem();out.setInt64(c.currentState()?.count??0n);c.setResult(out)}},
 // window.c:rankStepFunc/rankValueFunc. sqlite3WindowUpdate supplies RANGE
 // UNBOUNDED PRECEDING..CURRENT ROW; WINDOWFUNCX installs a no-op inverse.
 rank:{name:"rank",arities:[0],create:()=>({nStep:0n,nValue:0n} as RankCtx),step:c=>{const state=c.state();state.nStep++;if(state.nValue===0n)state.nValue=state.nStep},inverse:()=>{},value:c=>{const state=c.state(),out=new Mem();out.setInt64(state.nValue);state.nValue=0n;c.setResult(out)},final:c=>{const state=c.state(),out=new Mem();out.setInt64(state.nValue);state.nValue=0n;c.setResult(out)}},
 // window.c:dense_rankStepFunc/dense_rankValueFunc. RANGE peer scheduling
 // steps the peer group before one value callback; WINDOWFUNCX inverse is no-op.
 dense_rank:{name:"dense_rank",arities:[0],create:()=>({nStep:0n,nValue:0n} as RankCtx),step:c=>{c.state().nStep=1n},inverse:()=>{},value:c=>{const state=c.state(),out=new Mem();if(state.nStep!==0n){state.nValue++;state.nStep=0n}out.setInt64(state.nValue);c.setResult(out)},final:c=>{const state=c.state(),out=new Mem();if(state.nStep!==0n){state.nValue++;state.nStep=0n}out.setInt64(state.nValue);c.setResult(out)}},
 // window.c:percent_rankStepFunc/percent_rankInvFunc/value. The coerced
 // GROUPS CURRENT..UNBOUNDED FOLLOWING schedule first counts the partition,
 // then removes complete peer groups before publishing the next group.
 percent_rank:{name:"percent_rank",arities:[0],create:()=>({nStep:0n,nValue:0n,nTotal:0n} as DistributionCtx),step:c=>{c.state().nTotal++},inverse:c=>{c.state().nStep++},value:c=>{const state=c.state(),out=new Mem();state.nValue=state.nStep;out.setDouble(state.nTotal>1n?Number(state.nValue)/Number(state.nTotal-1n):0);c.setResult(out)},final:c=>{const state=c.state(),out=new Mem();state.nValue=state.nStep;out.setDouble(state.nTotal>1n?Number(state.nValue)/Number(state.nTotal-1n):0);c.setResult(out)}},
 // window.c:cume_distStepFunc/cume_distInvFunc/value. GROUPS 1 FOLLOWING..
 // UNBOUNDED FOLLOWING makes inverse count all rows through the current peer.
 cume_dist:{name:"cume_dist",arities:[0],create:()=>({nStep:0n,nValue:0n,nTotal:0n} as DistributionCtx),step:c=>{c.state().nTotal++},inverse:c=>{c.state().nStep++},value:c=>{const state=c.state(),out=new Mem();out.setDouble(Number(state.nStep)/Number(state.nTotal));c.setResult(out)},final:c=>{const state=c.state(),out=new Mem();out.setDouble(Number(state.nStep)/Number(state.nTotal));c.setResult(out)}},
 // window.c:ntileStepFunc/InvFunc/ValueFunc. The coerced ROWS CURRENT..
 // UNBOUNDED frame first counts the partition, then inverse advances iRow.
 ntile:{name:"ntile",arities:[1],create:()=>({nTotal:0n,nParam:0n,iRow:0n} as NtileCtx),step:(c,a)=>{const state=c.state() as NtileCtx;if(state.nTotal===0n){const numeric=a[0]!.numericTypeCopy();state.nParam=numeric.initialStorageClass==="integer"?numeric.integerValue():BigInt(Math.trunc(numeric.realValue()));if(state.nParam<=0n)c.setError(new JSQLiteError("sqlite","argument of ntile must be a positive integer",{code:1}));}state.nTotal++},inverse:c=>{c.state().iRow++},value:c=>{const state=c.state() as NtileCtx,out=new Mem();if(state.nParam>0n){const size=state.nTotal/state.nParam;if(size===0n)out.setInt64(state.iRow+1n);else{const large=state.nTotal-state.nParam*size,smallStart=large*(size+1n);out.setInt64(state.iRow<smallStart?1n+state.iRow/(size+1n):1n+large+(state.iRow-smallStart)/size);}}c.setResult(out)},final:c=>{const state=c.state() as NtileCtx,out=new Mem();if(state.nParam>0n){const size=state.nTotal/state.nParam;if(size===0n)out.setInt64(state.iRow+1n);else{const large=state.nTotal-state.nParam*size,smallStart=large*(size+1n);out.setInt64(state.iRow<smallStart?1n+state.iRow/(size+1n):1n+large+(state.iRow-smallStart)/size);}}c.setResult(out)}},
 // window.c callback forms used by full-frame and EXCLUDE scans. Fast
 // first/nth application-cursor paths remain scheduler-owned.
 first_value:{name:"first_value",arities:[1],create:()=>({nStep:0n,value:null} as NthValueCtx),step:(c,a)=>{const state=c.state() as NthValueCtx;state.nStep++;if(state.value===null){state.value=new Mem();state.value.copyFrom(a[0]!)}},inverse:()=>{},value:c=>{const out=new Mem(),value=(c.currentState() as NthValueCtx|undefined)?.value;if(value)out.copyFrom(value);c.setResult(out)},final:c=>{const out=new Mem(),value=(c.currentState() as NthValueCtx|undefined)?.value;if(value)out.copyFrom(value);c.setResult(out)},cleanup:s=>s.value?.release()},
 nth_value:{name:"nth_value",arities:[2],create:()=>({nStep:0n,value:null} as NthValueCtx),step:(c,a)=>{const state=c.state() as NthValueCtx,arg=a[1]!,kind=arg.initialStorageClass;let n:bigint|null=null;if(kind==="integer")n=arg.integerValue();else if(kind==="real"){const real=arg.realValue();if(Number.isFinite(real)&&Math.trunc(real)===real&&real>=Number(INT64_MIN)&&real<=Number(INT64_MAX))n=BigInt(real)}if(n===null||n<=0n){c.setError(new JSQLiteError("sqlite","second argument to nth_value must be a positive integer",{code:1}));return}state.nStep++;if(state.nStep===n&&state.value===null){state.value=new Mem();state.value.copyFrom(a[0]!)}},inverse:()=>{},value:c=>{const out=new Mem(),value=(c.currentState() as NthValueCtx|undefined)?.value;if(value)out.copyFrom(value);c.setResult(out)},final:c=>{const out=new Mem(),value=(c.currentState() as NthValueCtx|undefined)?.value;if(value)out.copyFrom(value);c.setResult(out)},cleanup:s=>s.value?.release()},
 last_value:{name:"last_value",arities:[1],create:()=>({nVal:0n,value:null} as LastValueCtx),step:(c,a)=>{const state=c.state() as LastValueCtx;state.value?.release();state.value=new Mem();state.value.copyFrom(a[0]!);state.nVal++},inverse:c=>{const state=c.currentState() as LastValueCtx|undefined;if(!state||state.nVal===0n)throw new JSQLiteError("internal","last_value inverse without stepped value");state.nVal--;if(state.nVal===0n){state.value?.release();state.value=null}},value:c=>{const out=new Mem(),value=(c.currentState() as LastValueCtx|undefined)?.value;if(value)out.copyFrom(value);c.setResult(out)},final:c=>{const out=new Mem(),value=(c.currentState() as LastValueCtx|undefined)?.value;if(value)out.copyFrom(value);c.setResult(out)},cleanup:s=>s.value?.release()},
 count:{name:"count",arities:[0,1],create:()=>({count:0n}),step:(c,a)=>{if(!a[0]||a[0].initialStorageClass!=="null")c.state().count++},inverse:(c,a)=>{if(!a[0]||a[0].initialStorageClass!=="null"){const state=c.currentState();if(!state||state.count===0n)throw new JSQLiteError("internal","count inverse without stepped value");state.count--}},value:c=>{const out=new Mem();out.setInt64(c.currentState()?.count??0n);c.setResult(out)},final:c=>{const out=new Mem();out.setInt64(c.currentState()?.count??0n);c.setResult(out)}},
 sum:{name:"sum",arities:[1],create:emptySum,step:sumStep,inverse:sumInverse,value:c=>sumResult(c,"sum"),final:c=>sumResult(c,"sum")},
 avg:{name:"avg",arities:[1],create:emptySum,step:sumStep,inverse:sumInverse,value:c=>sumResult(c,"avg"),final:c=>sumResult(c,"avg")},
 total:{name:"total",arities:[1],create:emptySum,step:sumStep,inverse:sumInverse,value:c=>sumResult(c,"total"),final:c=>sumResult(c,"total")},
 min:extremaDefinition("min"),max:extremaDefinition("max"),
 group_concat:concatDefinition("group_concat"),string_agg:concatDefinition("string_agg"),
 json_group_array:jsonAggregateDefinition("json_group_array"),jsonb_group_array:jsonAggregateDefinition("jsonb_group_array"),
 json_group_object:jsonAggregateDefinition("json_group_object"),jsonb_group_object:jsonAggregateDefinition("jsonb_group_object"),
});
function extremaDefinition(name:"min"|"max"):AggregateDefinition<ExtremaCtx>{return{name,arities:[1],create:c=>({values:[],bytes:0,inverseCapable:c.inverseCapable}),step:(c,a)=>{const value=a[0];if(!value||value.initialStorageClass==="null")return false;const state=c.state(),bytes=valueBytes(value);if(!state.inverseCapable&&state.values.length){const best=state.values[0]!,better=name==="min"?compareMem(best,value,c.collation)>0:compareMem(best,value,c.collation)<0;if(!better)return false;const oldBytes=state.bytes,next=new Mem();c.budget.replace(oldBytes,bytes,"aggregate state exceeds total byte limit");try{next.copyFrom(value)}catch(error){c.budget.replace(bytes,oldBytes);throw error}best.release();state.values[0]=next;state.bytes=bytes;return true}const next=new Mem();c.budget.reserve(bytes,"aggregate state exceeds total byte limit");try{next.copyFrom(value)}catch(error){c.budget.release(bytes);throw error}let at=0;while(at<state.values.length&&(name==="min"?compareMem(state.values[at]!,next,c.collation)<=0:compareMem(state.values[at]!,next,c.collation)>=0))at++;state.values.splice(at,0,next);state.bytes+=bytes;return at===0},inverse:(c,a)=>{const value=a[0],state=c.currentState();if(!value||value.initialStorageClass==="null"||!state)return;if(!state.inverseCapable)throw new JSQLiteError("internal",`${name} inverse without inverse-capable state`);const at=state.values.findIndex(candidate=>compareMem(candidate,value,c.collation)===0);if(at<0)throw new JSQLiteError("internal",`${name} inverse without stepped value`);const [removed]=state.values.splice(at,1),bytes=valueBytes(removed!);removed!.release();state.bytes-=bytes;c.budget.release(bytes)},value:c=>{const out=new Mem(),best=c.currentState()?.values[0];if(best)out.copyFrom(best);c.setResult(out)},final:c=>{const out=new Mem(),best=c.currentState()?.values[0];if(best)out.copyFrom(best);c.setResult(out)},cleanup:s=>{for(const value of s.values)value.release();s.values.length=0}}}
function concatDefinition(name:"group_concat"|"string_agg"):AggregateDefinition<ConcatCtx>{return{name,arities:name==="string_agg"?[2]:[1,2],create:()=>({values:[],bytes:0}),step:(c,a)=>{const value=a[0];if(!value||value.initialStorageClass==="null")return;const text=aggregateText(value),separator=a[1]?.initialStorageClass==="null"?"":a[1]?aggregateText(a[1]):",",state=c.state(),prefix=state.values.length?separator:"",bytes=new TextEncoder().encode(prefix+text).byteLength;if(state.bytes+bytes>c.maxResultBytes)throw new JSQLiteError("limit","string or blob too big");c.budget.reserve(bytes,"aggregate state exceeds total byte limit");try{state.values.push({text,separator:prefix,bytes})}catch(error){c.budget.release(bytes);throw error}state.bytes+=bytes},inverse:(c,a)=>{if(!a[0]||a[0]!.initialStorageClass==="null")return;const state=c.currentState();if(!state?.values.length)throw new JSQLiteError("internal",`${name} inverse without stepped value`);const removed=state.values.shift()!;state.bytes-=removed.bytes;c.budget.release(removed.bytes);if(state.values.length){const first=state.values[0]!,separatorBytes=new TextEncoder().encode(first.separator).byteLength;first.separator="";first.bytes-=separatorBytes;state.bytes-=separatorBytes;c.budget.release(separatorBytes)}},value:c=>concatResult(c),final:c=>concatResult(c),cleanup:s=>s.values.length=0}}
function aggregateText(input:Mem):string{const copy=new Mem();copy.copyFrom(input);if(copy.initialStorageClass!=="text")copy.stringify("utf-8");return copy.textValue()}
function concatResult(c:AggregateFunctionContext<ConcatCtx>):void{const out=new Mem(),state=c.currentState();if(state?.values.length)out.setText(new TextEncoder().encode(state.values.map(value=>value.separator+value.text).join("")),"utf-8");c.setResult(out)}
function jsonAggregateDefinition(name:"json_group_array"|"jsonb_group_array"|"json_group_object"|"jsonb_group_object"):AggregateDefinition<JsonAggregateCtx>{
 const object=name.endsWith("object"),binary=name.startsWith("jsonb_");
 const result=(c:AggregateFunctionContext<JsonAggregateCtx>):void=>{const items=c.currentState()?.items??[];const node:JsonNode=object?{kind:"object",entries:items.filter(x=>x.key!==null).map(x=>[x.key!,x.value] as const)}:{kind:"array",values:items.map(x=>x.value)};const out=binary?jsonbResult(node):jsonTextResult(node);const size=out.initialStorageClass==="blob"?out.blobValue().length:new TextEncoder().encode(out.textValue()).length;if(size>c.maxResultBytes)throw new JSQLiteError("limit","string or blob too big");c.setResult(out)};
 return{name,arities:object?[2]:[1],create:()=>({items:[],bytes:0}),step:(c,a)=>{let key:string|null=null;if(object){const label=a[0]!;if(label.initialStorageClass!=="null")key=aggregateText(label)}const value=jsonNodeFromSqlValue(a[object?1:0]!);const bytes=new TextEncoder().encode((key===null?"":key)+renderJson(value)).length,state=c.state();if(state.bytes+bytes>c.maxResultBytes)throw new JSQLiteError("limit","string or blob too big");c.budget.reserve(bytes,"aggregate state exceeds total byte limit");try{state.items.push({key,value,bytes})}catch(error){c.budget.release(bytes);throw error}state.bytes+=bytes},inverse:c=>{const state=c.currentState();if(!state?.items.length)throw new JSQLiteError("internal",`${name} inverse without stepped value`);const removed=state.items.shift()!;state.bytes-=removed.bytes;c.budget.release(removed.bytes)},value:result,final:result,cleanup:s=>s.items.length=0};
}
class AggregateContext<State> implements AggregateFunctionContext<State>{
 readonly #result=new FunctionContext();
 readonly cell:Mem;readonly definition:AggregateDefinition<State>;readonly encoding:DatabaseEncoding;readonly collation:BuiltinCollation;readonly maxResultBytes:number;readonly budget:PrivateStateByteBudget;readonly inverseCapable:boolean;
 constructor(cell:Mem,definition:AggregateDefinition<State>,encoding:DatabaseEncoding,collation:BuiltinCollation,maxResultBytes:number,budget:PrivateStateByteBudget,inverseCapable=false){this.cell=cell;this.definition=definition;this.encoding=encoding;this.collation=collation;this.maxResultBytes=maxResultBytes;this.budget=budget;this.inverseCapable=inverseCapable}
 currentState():State|undefined{return this.cell.aggregateState()?.context as State|undefined}
 state():State{let state=this.currentState();if(state===undefined){state=this.definition.create(this);this.cell.setAggregate({definition:this.definition,context:state,cleanup:()=>{try{this.definition.cleanup?.(state!)}finally{const bytes=(state as any).bytes;if(typeof bytes==="number")this.budget.release(bytes)}}})}return state}
 setResult(value:Mem):void{this.#result.setResult(value)} setError(error:unknown):void{this.#result.setError(error)}
 takeResult():Mem{return this.#result.takeResult()}
}
function aggregateContext(cell:Mem,name:string,encoding:DatabaseEncoding,collation:BuiltinCollation,maxResultBytes:number,budget:PrivateStateByteBudget,inverseCapable=false):AggregateContext<any>{const definition=aggregateDefinitions[name];if(!definition)throw new JSQLiteError("internal",`missing aggregate definition: ${name}`);const stored=cell.aggregateState()?.definition;if(stored&&stored!==definition)throw new JSQLiteError("internal","aggregate definition changed for context");return new AggregateContext(cell,definition,encoding,collation,maxResultBytes,budget,inverseCapable)}
function aggregateStep(cell:Mem,name:string,args:readonly Mem[],collation:BuiltinCollation,encoding:DatabaseEncoding,maxResultBytes:number,budget:PrivateStateByteBudget,inverseCapable=false):boolean{
 const context=aggregateContext(cell,name,encoding,collation,maxResultBytes,budget,inverseCapable);let changed=false;
 try{changed=context.definition.step(context,args)===true}catch(error){context.setError(error)}
 // xStep may report through sqlite3_result_error() without throwing. Consume
 // its transient result/error before the VM advances to another opcode.
 const result=context.takeResult();result.release();return changed;
}
function aggregateInverse(cell:Mem,name:string,args:readonly Mem[],collation:BuiltinCollation,encoding:DatabaseEncoding,maxResultBytes:number,budget:PrivateStateByteBudget):void{const context=aggregateContext(cell,name,encoding,collation,maxResultBytes,budget,true);try{if(!context.definition.inverse)throw new JSQLiteError("internal",`aggregate ${name} has no inverse callback`);context.definition.inverse(context,args)}catch(error){context.setError(error);context.takeResult()}}
function aggregateResult(cell:Mem,name:string,encoding:DatabaseEncoding,maxResultBytes:number,budget:PrivateStateByteBudget,destructive:boolean):Mem{const context=aggregateContext(cell,name,encoding,"binary",maxResultBytes,budget);try{const callback=destructive?context.definition.final:context.definition.value;if(!callback)throw new JSQLiteError("internal",`aggregate ${name} has no value callback`);callback(context);const result=context.takeResult();if(destructive)cell.setNull();return result}catch(error){context.setError(error);throw error}}

function misuse(message: string): never { throw new JSQLiteError("misuse", message); }
function range(): never { throw new JSQLiteError("sqlite", "column or parameter index out of range", { code: 25 }); }

export class VdbeStatement implements Statement {
  readonly #program: Program;
  readonly #registers: Mem[];
  readonly #onFinalize: () => void;
  readonly #admit: () => () => void;
  readonly #assertConnectionIdle: () => void;
  readonly #bindings: Mem[];
  #pc = 0;
  #state: "prepared" | "running" | "suspended" | "row" | "done" | "failed" | "finalized" = "prepared";
  #rowStart = 0;
  #rowCount = 0;
  #cursors = new Map<number, TableScanCursor>();
  #jsonCursors = new Map<number,JsonTableCursor>();
  #cursorRoots = new Map<number, number>();
  #records = new Map<number, ReturnType<typeof decodeRecord>>();
  // Aggregate programs can retain a decoded row after Next moves the btree
  // cursor past EOF. Cache its rowid alongside it, as the VDBE cursor does.
  #recordRowids = new Map<number, bigint>();
  #privateCursors = new Map<number, SorterCursor | EphemeralIndexCursor | FifoCursor | PriorityQueueCursor>();
  // MakeRecord owns only a register-range descriptor until Insert. This avoids an
  // unbudgeted second Mem copy; EphemeralIndexCursor performs the single
  // statement-budgeted copy at the insertion opcode's atomic checkpoint.
  #packedRecords = new Map<number, {start:number;count:number}>();
  #privateBytes: PrivateStateByteBudget;
  #once = new Set<number>();
  readonly #inverseAggregates: ReadonlySet<number>;
  #borrow = new BorrowLifetime();
  #rows = 0;
  #work = 0;
  #savedError: unknown = null;
  #currentTime: bigint|null = null;
  constructor(program: Program, assertConnectionIdle: () => void, admit: () => () => void, onFinalize: () => void) {
    this.#program = program; this.#assertConnectionIdle = assertConnectionIdle; this.#admit = admit; this.#onFinalize = onFinalize;
    this.#registers = Array.from({ length: program.registers + 1 }, () => new Mem());
    this.#bindings = program.parameters.map(() => new Mem());
    this.#privateBytes = new PrivateStateByteBudget(program.privateStateLimits.maxBytes);
    this.#inverseAggregates = new Set(program.ops.filter((op):op is Extract<Op,{code:"AggInverse"}>=>op.code==="AggInverse").map(op=>op.p2));
  }
  get columnCount(): number { return this.#program.columns.length; }
  get parameterCount(): number { return this.#program.parameters.length; }
  parameterName(index: number): string | null { this.#assertLive(); if (!Number.isInteger(index) || index < 1 || index > this.parameterCount) range(); return this.#program.parameters[index - 1]!.name; }
  parameterIndex(name: string): number { this.#assertLive(); const found = this.#program.parameters.findIndex(parameter => parameter.name === name); return found < 0 ? 0 : found + 1; }
  bind(indexOrName: number | string, value: SqliteValue): void { this.#assertIdle(); if (this.#state !== "prepared") misuse("statement must be reset before binding"); const index = typeof indexOrName === "string" ? this.parameterIndex(indexOrName) : indexOrName; if (!Number.isInteger(index) || index < 1 || index > this.parameterCount) range(); let bound: Mem; try { bound = memFromPublic(value, this.#program.encoding); } catch (error) { throw new JSQLiteError("misuse", (error as Error).message, { cause: error }); } this.#bindings[index - 1]!.moveFrom(bound); }
  clearBindings(): void { this.#assertIdle(); this.#bindings.forEach(value => value.setNull()); }
  async step(options: OperationOptions = {}): Promise<StepResult> {
    this.#assertIdle();
    if (this.#state === "failed") throw this.#savedError;
    if (this.#state === "done") return "done";
    const requestedLimit = options.maxWorkUnits ?? this.#program.maxWorkUnits;
    const limit = Math.min(requestedLimit, this.#program.maxWorkUnits);
    if (!Number.isSafeInteger(limit) || limit < 0) misuse("maxWorkUnits must be a finite nonnegative safe integer");
    if (options.timeoutMs !== undefined && (!Number.isFinite(options.timeoutMs) || options.timeoutMs < 0)) misuse("timeoutMs must be finite and nonnegative");
    const release = this.#admit();
    this.#state = "running";
    this.#invalidateRow();
    const started = Date.now();
    // Start execution in a promise job after synchronously acquiring connection
    // ownership, and retain that ownership until the returned chain settles.
    return await Promise.resolve().then(async () => {
    try {
      while (this.#pc < this.#program.ops.length) {
        this.#checkControl(options, limit, started);
        if (this.#work !== 0 && this.#work % 256 === 0) { this.#state = "suspended"; await new Promise<void>(resolve => setTimeout(resolve, 0)); this.#state = "running"; }
        const op = this.#program.ops[this.#pc++]!; this.#work++;
        switch (op.code) {
          case "OpenRead": {const cursor=op.p2??0;this.#cursorRoots.set(cursor,op.p1);this.#cursors.set(cursor,this.#program.database!.tableScanCursor(op.p1));break;}
          case "JsonTableRewind": {
            const input=this.#registers[op.input]!,root=op.root===undefined?"$":this.#registers[op.root]!.initialStorageClass==="null"?null:this.#registers[op.root]!.textValue();
            const charge=(units:number)=>{for(let i=0;i<units;i++){this.#checkControl(options,limit,started);this.#work++;}};
            this.#jsonCursors.get(op.p1)?.close();
            const cursor=openJsonTableCursor(input,op.recursive,charge,root??"$",op.binaryContainers,(oldBytes,newBytes)=>this.#privateBytes.replace(oldBytes,newBytes,"JSON table cursor exceeds private-state byte limit"));this.#jsonCursors.set(op.p1,cursor);
            const row=root===null?null:cursor.next();if(row===null){cursor.close();this.#jsonCursors.delete(op.p1);this.#pc=op.p2;break;}
            for(let i=0;i<row.length&&i<JSON_TABLE_COLUMNS.length;i++)this.#registers[op.rowStart+i]!.copyFrom(row[i]!);
            break;
          }
          case "JsonTableNext": {
            const cursor=this.#jsonCursors.get(op.p1);if(!cursor)throw new JSQLiteError("internal","advance on unopened JSON table cursor");const row=cursor.next();
            if(row){for(let i=0;i<row.length&&i<JSON_TABLE_COLUMNS.length;i++)this.#registers[op.rowStart+i]!.copyFrom(row[i]!);this.#pc=op.p2;}else this.#jsonCursors.delete(op.p1);
            break;
          }
          case "MustBeInt": {const value=this.#registers[op.p1]!;let integer:bigint;if(value.initialStorageClass==="integer")integer=value.integerValue();else if(value.initialStorageClass==="real"&&Number.isInteger(value.realValue())&&value.realValue()>=-9223372036854775808&&value.realValue()<9223372036854775808)integer=BigInt(value.realValue());else if(value.initialStorageClass==="text"&&/^[+-]?[0-9]+$/.test(value.textValue())){integer=BigInt(value.textValue());if(integer<-(1n<<63n)||integer>=(1n<<63n))throw new JSQLiteError("sqlite","datatype mismatch",{code:20});}else throw new JSQLiteError("sqlite","datatype mismatch",{code:20});value.setInt64(integer);break;}
          case "WindowCheck": {
            const value=this.#registers[op.p1]!,message=`frame ${op.boundary} offset must be a non-negative ${op.numeric?"number":"integer"}`;
            // window.c:windowCheckValue uses numeric affinity for both the
            // OP_MustBeInt path and the RANGE comparison path. Apply it to the
            // register itself so accepted numeric TEXT has the same subsequent
            // register representation as the source VM sequence.
            value.applyAffinity("numeric",this.#program.encoding);
            if(op.numeric){
              if(value.initialStorageClass==="integer"){if(value.integerValue()<0n)throw new JSQLiteError("sqlite",message,{code:1});}
              else if(value.initialStorageClass==="real"){if(value.realValue()<0)throw new JSQLiteError("sqlite",message,{code:1});}
              else throw new JSQLiteError("sqlite",message,{code:1});
            }else{
              if(value.initialStorageClass==="real"&&Number.isInteger(value.realValue())&&value.realValue()>=-9223372036854775808&&value.realValue()<9223372036854775808)value.setInt64(BigInt(value.realValue()));
              if(value.initialStorageClass!=="integer"||value.integerValue()<0n)throw new JSQLiteError("sqlite",message,{code:1});
            }
            break;
          }
          case "OffsetLimit": {const count=this.#registers[op.p1]!.integerValue(),offset=this.#registers[op.p3]!.integerValue();const positive=offset>0n?offset:0n,sum=count+positive;this.#registers[op.p2]!.setInt64(count<=0n||sum>(1n<<63n)-1n?-1n:sum);break;}
          case "IfNotZero": {const value=this.#registers[op.p1]!.integerValue();if(value!==0n){if(value>0n)this.#registers[op.p1]!.setInt64(value-1n);this.#pc=op.p2;}break;}
          case "IfPos": {const value=this.#registers[op.p1]!.integerValue();if(value>0n){this.#registers[op.p1]!.setInt64(value-BigInt(op.p3));this.#pc=op.p2;}break;}
          case "DecrJumpZero": {const value=this.#registers[op.p1]!.integerValue(),next=value>-(1n<<63n)?value-1n:value;this.#registers[op.p1]!.setInt64(next);if(next===0n)this.#pc=op.p2;break;}
          case "SorterOpen": this.#privateCursors.set(op.p1,new SorterCursor(op.keyInfo,this.#program.privateStateLimits,this.#privateBytes));break;
          case "OpenFifo": this.#privateCursors.set(op.p1,new FifoCursor(this.#program.privateStateLimits,this.#privateBytes));break;
          case "OpenPriorityQueue": this.#privateCursors.set(op.p1,new PriorityQueueCursor(op.keyInfo,this.#program.privateStateLimits,this.#privateBytes));break;
          case "PriorityInsert": await (this.#privateCursors.get(op.p1) as PriorityQueueCursor).insert(this.#registers.slice(op.keyStart,op.keyStart+op.keyCount),this.#registers.slice(op.payloadStart,op.payloadStart+op.payloadCount),this.#privateControl(options,limit,started));break;
          case "PriorityShift": {const values=(this.#privateCursors.get(op.p1) as PriorityQueueCursor).shift();if(!values)this.#pc=op.emptyJump;else{for(let i=0;i<op.count;i++){this.#registers[op.p2+i]!.copyFrom(values[i]!);values[i]!.release();}}break;}
          case "FifoInsert": await (this.#privateCursors.get(op.p1) as FifoCursor).insert(this.#registers.slice(op.keyStart,op.keyStart+op.keyCount),this.#privateControl(options,limit,started));break;
          case "FifoShift": {const values=(this.#privateCursors.get(op.p1) as FifoCursor).shift();if(!values)this.#pc=op.emptyJump;else{for(let i=0;i<op.count;i++){this.#registers[op.p2+i]!.copyFrom(values[i]!);values[i]!.release();}}break;}
          case "OpenEphemeral": this.#privateCursors.set(op.p1,new EphemeralIndexCursor(op.keyInfo,this.#program.privateStateLimits,this.#privateBytes));break;
          case "MakeRecord": this.#packedRecords.set(op.p3,{start:op.p1,count:op.p2});break;
          case "NewRowid": this.#registers[op.p2]!.setInt64(BigInt((this.#privateCursors.get(op.p1) as EphemeralIndexCursor).size+1));break;
          case "Insert": {const record=this.#packedRecords.get(op.p2);if(!record)throw new JSQLiteError("internal","Insert record register was not packed");await (this.#privateCursors.get(op.p1) as EphemeralIndexCursor).insert(this.#registers.slice(record.start,record.start+record.count),this.#privateControl(options,limit,started));this.#packedRecords.delete(op.p2);break;}
          case "SorterInsert": {const cursor=this.#privateCursors.get(op.p1) as SorterCursor,key=this.#registers.slice(op.keyStart,op.keyStart+op.keyCount),payload=this.#registers.slice(op.payload,op.payload+op.payloadCount),control=this.#privateControl(options,limit,started);if(op.topN!==undefined){const capacity=this.#registers[op.topN]!.integerValue();if(capacity>=0n)await cursor.insertBounded(key,payload,capacity,control);else await cursor.insert(key,payload,control);}else await cursor.insert(key,payload,control);break;}
          case "SorterSort": {const cursor=this.#privateCursors.get(op.p1) as SorterCursor;await cursor.sort(this.#privateControl(options,limit,started));if(!cursor.first())this.#pc=op.emptyJump;break;}
          case "SorterData": {const values=(this.#privateCursors.get(op.p1) as SorterCursor).data();for(let i=0;i<op.count;i++)this.#registers[op.p2+i]!.copyFrom(values[i]!);break;}
          case "SorterNext": if((this.#privateCursors.get(op.p1) as SorterCursor).next())this.#pc=op.p2;break;
          case "Found": {const cursor=this.#privateCursors.get(op.p1) as EphemeralIndexCursor;if(await cursor.found(this.#registers.slice(op.keyStart,op.keyStart+op.keyCount),this.#privateControl(options,limit,started)))this.#pc=op.jump;break;}
          case "InSet": {
            // expr.c:sqlite3ExprCodeIN four-state scalar result: empty is false
            // even for NULL LHS; otherwise match, RHS NULL, and ordinary miss
            // remain distinct. Membership stays on EphemeralIndexCursor KeyInfo.
            const cursor=this.#privateCursors.get(op.p1) as EphemeralIndexCursor,out=this.#registers[op.output]!,key=new Mem();key.copyFrom(this.#registers[op.key]!);key.applyAffinity(op.affinity,this.#program.database!.encoding);
            if(cursor.size===0)out.setInt64(op.negated?1n:0n);
            else if(key.initialStorageClass==="null")out.setNull();
            else if(await cursor.found([key],this.#privateControl(options,limit,started)))out.setInt64(op.negated?0n:1n);
            else if(cursor.hasNullKey())out.setNull();
            else out.setInt64(op.negated?1n:0n);
            key.release();break;
          }
          case "IdxInsert": {const cursor=this.#privateCursors.get(op.p1) as EphemeralIndexCursor,key=this.#registers.slice(op.keyStart,op.keyStart+op.keyCount),control=this.#privateControl(options,limit,started);if(op.replace)await cursor.replace(key,control);else await cursor.insert(key,control);break;}
          case "SetDelete": await (this.#privateCursors.get(op.p1) as EphemeralIndexCursor).remove(this.#registers.slice(op.keyStart,op.keyStart+op.keyCount),this.#privateControl(options,limit,started));break;
          case "SetRetainIntersection": {const control=this.#privateControl(options,limit,started);await (this.#privateCursors.get(op.p1) as EphemeralIndexCursor).retainFoundIn(this.#privateCursors.get(op.p2) as EphemeralIndexCursor,control);break;}
          case "ClearEphemeral": (this.#privateCursors.get(op.p1) as EphemeralIndexCursor).clear();break;
          case "ClearSorter": (this.#privateCursors.get(op.p1) as SorterCursor).clear();break;
          case "EphemeralSort": await (this.#privateCursors.get(op.p1) as EphemeralIndexCursor).sort(this.#privateControl(options,limit,started));break;
          case "EphemeralRewind": if(!(this.#privateCursors.get(op.p1) as EphemeralIndexCursor).first())this.#pc=op.p2;break;
          case "EphemeralSeekRowid": {const rowid=this.#registers[op.rowid]!;if(rowid.initialStorageClass==="null"||!(this.#privateCursors.get(op.p1) as EphemeralIndexCursor).seekRowid(rowid.integerValue()))this.#pc=op.jump;break;}
          case "EphemeralRowid": this.#registers[op.p2]!.setInt64((this.#privateCursors.get(op.p1) as EphemeralIndexCursor).rowid());break;
          case "EphemeralData": {const values=(this.#privateCursors.get(op.p1) as EphemeralIndexCursor).data();for(let i=0;i<op.count;i++)this.#registers[op.p2+i]!.copyFrom(values[i]!);break;}
          case "EphemeralNext": if((this.#privateCursors.get(op.p1) as EphemeralIndexCursor).next())this.#pc=op.p2;break;
          case "IfCursorSizeGt": {const threshold=op.thresholdRegister===undefined?op.threshold!:Number(this.#registers[op.thresholdRegister]!.integerValue())+(op.registerAdjustment??1);if((this.#privateCursors.get(op.p1) as EphemeralIndexCursor).size>threshold)this.#pc=op.jump;break;}
          case "IfRegisterGt": if(this.#registers[op.left]!.integerValue()>this.#registers[op.right]!.integerValue())this.#pc=op.jump;break;
          case "EphemeralAdvanceData": {const cursor=this.#privateCursors.get(op.p1) as EphemeralIndexCursor;if(!cursor.next()){if(op.emptyJump!==undefined){this.#pc=op.emptyJump;break;}throw new JSQLiteError("internal","window inverse cursor exhausted");}const values=cursor.data();for(let i=0;i<op.count;i++)this.#registers[op.p2+i]!.copyFrom(values[i]!);break;}
          case "IfEphemeralHasNext": if((this.#privateCursors.get(op.p1) as EphemeralIndexCursor).hasNext())this.#pc=op.jump;break;
          case "EphemeralResetPosition": (this.#privateCursors.get(op.p1) as EphemeralIndexCursor).rewindBeforeFirst();break;
          case "Rewind": {const cursor=op.p1??0,root=this.#cursorRoots.get(cursor);if(root===undefined)throw new JSQLiteError("internal","rewind on unopened cursor");const scan=this.#program.database!.tableScanCursor(root);this.#cursors.set(cursor,scan);this.#records.delete(cursor);this.#recordRowids.delete(cursor);if (!scan.first()) this.#pc = op.p2; else await this.#loadRecord(cursor,options, limit, started); break;}
          case "NullRow": this.#records.delete(op.p1); this.#recordRowids.delete(op.p1); break;
          case "Column": { const record=this.#records.get(op.p3??0),raw=record?.values[op.p1] ?? {storageClass:"null" as const},borrowed=memFromRawRecord(raw, this.#borrow); this.#registers[op.p2]!.copyFrom(borrowed); borrowed.release(); if(op.affinity){this.#registers[op.p2]!.applyAffinity(op.affinity,this.#program.encoding);if(op.affinity==="real")this.#registers[op.p2]!.cast("real",this.#program.encoding);} break; }
          case "RealAffinity": {const value=this.#registers[op.p1]!;if(value.initialStorageClass==="integer")value.cast("real",this.#program.encoding);break;}
          case "Rowid": {const rowid=this.#recordRowids.get(op.p1??0);if(rowid!==undefined)this.#registers[op.p2]!.setInt64(rowid);else this.#registers[op.p2]!.setNull();break;}
          case "Eq": { const a=this.#registers[op.p1]!, b=this.#registers[op.p2]!, out=this.#registers[op.p3]!; a.applyAffinity(op.affinity,this.#program.database!.encoding); b.applyAffinity(op.affinity,this.#program.database!.encoding); out.setInt64(a.initialStorageClass!=="null" && b.initialStorageClass!=="null" && compareMem(a,b,op.collation)===0 ? 1n : 0n); break; }
          case "IfNot": if (truth(this.#registers[op.p1]!)!==true) this.#pc=op.p2; break;
          case "Next": {const cursor=op.p1??0;if (this.#cursors.get(cursor)!.next()) { await this.#loadRecord(cursor,options, limit, started); this.#pc=op.p2; } break;}
          case "Integer": this.#registers[op.p2]!.setInt64(op.p1); break;
          case "Real": this.#registers[op.p2]!.setDouble(op.p1); break;
          case "String": this.#registers[op.p2]!.setText(new TextEncoder().encode(op.p1),"utf-8"); break;
          case "Blob": this.#registers[op.p2]!.setBlob(op.p1); break;
          case "Null": this.#registers[op.p2]!.setNull(); break;
          case "Copy": {const source=this.#registers[op.p1]!;this.#chargeValue(source,options,limit,started);this.#registers[op.p2]!.copyFrom(source);break;}
          case "Once": if(this.#once.has(op.p1))this.#pc=op.p2;else this.#once.add(op.p1); break;
          case "Gosub": this.#registers[op.p1]!.setInt64(BigInt(this.#pc));this.#pc=op.p2;break;
          case "Return": this.#pc=Number(this.#registers[op.p1]!.integerValue());break;
          case "InitCoroutine": this.#registers[op.p1]!.setInt64(BigInt(op.p3));if(op.p2!==0)this.#pc=op.p2;break;
          case "Yield": {const destination=Number(this.#registers[op.p1]!.integerValue());this.#registers[op.p1]!.setInt64(BigInt(this.#pc));this.#pc=destination;break;}
          case "EndCoroutine": {
            // vdbe.c OP_EndCoroutine: P1 identifies the suspended caller Yield.
            // Leave P1 pointing back to this EndCoroutine so later Yields take
            // the same caller P2 path without a sentinel-only VM convention.
            // Existing bounded subquery producers carry that exit on
            // EndCoroutine.P2; window coroutines use the source-shaped
            // caller-Yield P2 owner.
            const caller=Number(this.#registers[op.p1]!.integerValue())-1,target=this.#program.ops[caller];
            if(target?.code!=="Yield")throw new JSQLiteError("internal","coroutine ended without caller Yield");
            this.#registers[op.p1]!.setInt64(BigInt(this.#pc-1));this.#pc=target.p2||op.p2;break;
          }
          case "OpenDup": {const source=this.#privateCursors.get(op.p2);if(!source)throw new JSQLiteError("internal","OpenDup source cursor is not open");if(!(source instanceof EphemeralIndexCursor))throw new JSQLiteError("internal","OpenDup source is not ephemeral");this.#privateCursors.set(op.p1,source.duplicate());break;}
          case "Goto": this.#pc=op.p2; break;
          case "CollSeq": break;
          case "Cast": {const value=new Mem();value.copyFrom(this.#registers[op.p1]!);value.cast(op.affinity,this.#program.encoding);this.#registers[op.p2]!.moveFrom(value);break;}
          case "Binary": {let a=this.#registers[op.p1]!,b=this.#registers[op.p2]!;if(op.affinity&&["=","==","!=","<>","<",">","<=",">=","IS","IS NOT"].includes(op.op)){const left=new Mem(),right=new Mem();left.copyFrom(a);right.copyFrom(b);left.applyAffinity(op.affinity,this.#program.encoding);right.applyAffinity(op.affinity,this.#program.encoding);a=left;b=right}this.#registers[op.p3]!.moveFrom(op.op==="||"?concatenateMem(a,b,this.#program.encoding,this.#program.maxResultBytes):evaluateExpression({kind:"binary",op:op.op,left:{kind:"mem",value:a,collation:op.collation},right:{kind:"mem",value:b}},this.#program.encoding));break;}
          case "AggReset": for(const register of op.registers)this.#registers[register]!.setNull();break;
          case "WindowRangeTest": {const candidate=this.#registers[op.candidate]!,current=this.#registers[op.current]!;const numeric=(m:Mem)=>m.initialStorageClass==="integer"||m.initialStorageClass==="real";let yes=false;if(op.mode==="end-unbounded")yes=true;else if(op.mode==="start-unbounded")yes=false;else if(op.mode==="end-current")yes=compareMem(candidate,current,op.collation)*(op.descending?-1:1)<=0;else if(op.mode==="start-current")yes=compareMem(candidate,current,op.collation)*(op.descending?-1:1)<0;else if(numeric(candidate)&&numeric(current)){const number=(m:Mem)=>m.initialStorageClass==="integer"?Number(m.integerValue()):m.realValue(),c=number(candidate),v=number(current),d=number(this.#registers[op.offset!]!);yes=op.mode==="end-following"?(op.descending?c>=v-d:c<=v+d):op.mode==="start-following"?(op.descending?c>v-d:c<v+d):(op.descending?c>v+d:c<v-d)}else yes=op.mode==="end-following"?compareMem(candidate,current,op.collation)===0:compareMem(candidate,current,op.collation)!==0;if(yes)this.#pc=op.jump;break;}
          case "CompareGroup": {let equal=true;for(let i=0;i<op.count;i++)if(compareMem(this.#registers[op.left+i]!,this.#registers[op.right+i]!,op.keyInfo.terms[i]!.collation)!==0){equal=false;break}if(equal)this.#pc=op.jump;break;}
          case "AggStep": {const args=op.args.map(x=>this.#registers[x]!);await this.#chargeScalarInputs(args,options,limit,started);const changed=aggregateStep(this.#registers[op.p2]!,op.name,args,op.collation,this.#program.encoding,this.#program.maxResultBytes,this.#privateBytes,this.#inverseAggregates.has(op.p2));if(op.changed!==undefined)this.#registers[op.changed]!.setInt64(changed?1n:0n);break;}
          case "AggInverse": {const args=op.args.map(x=>this.#registers[x]!);await this.#chargeScalarInputs(args,options,limit,started);aggregateInverse(this.#registers[op.p2]!,op.name,args,op.collation,this.#program.encoding,this.#program.maxResultBytes,this.#privateBytes);break;}
          case "AggFinal": this.#registers[op.p1]!.moveFrom(aggregateResult(this.#registers[op.p1]!,op.name,this.#program.encoding,this.#program.maxResultBytes,this.#privateBytes,true));break;
          case "AggValue": this.#registers[op.p2]!.moveFrom(aggregateResult(this.#registers[op.p1]!,op.name,this.#program.encoding,this.#program.maxResultBytes,this.#privateBytes,false));break;
          case "Function": case "PureFunc": {const args=op.args.map(x=>this.#registers[x]!);await this.#chargeScalarInputs(args,options,limit,started);const control:ScalarControl={maxResultBytes:this.#program.maxResultBytes,checkSize:(bytes)=>{if(!Number.isSafeInteger(bytes)||bytes<0||bytes>this.#program.maxResultBytes)throw new JSQLiteError("limit","string or blob too big")},check:()=>this.#checkControl(options,limit,started),charge:(units)=>{for(let i=0;i<units;i++){this.#checkControl(options,limit,started);this.#work++;}},now:()=>this.#currentTime??(this.#currentTime=(this.#program.dateTimeEnvironment??defaultDateTimeEnvironment).nowUnixMilliseconds()),...(this.#program.dateTimeEnvironment?{dateTimeEnvironment:this.#program.dateTimeEnvironment}:{})};this.#registers[op.p2]!.moveFrom(runFunctionContext(()=>evaluateFunction(op.name,args,this.#program.encoding,op.collation,control)));break;}
          case "ShortCircuit": {const value=truth(this.#registers[op.p1]!);if((op.kind==="and"&&value===false)||(op.kind==="or"&&value===true)){this.#registers[op.p2]!.setInt64(op.kind==="and"?0n:1n);this.#pc=op.jump}break;}
          case "Boolean": {const x=truth(this.#registers[op.p1]!),y=truth(this.#registers[op.p2]!),v=op.kind==="and"?(x===false||y===false?false:x===null||y===null?null:true):(x===true||y===true?true:x===null||y===null?null:false);v===null?this.#registers[op.p3]!.setNull():this.#registers[op.p3]!.setInt64(v?1n:0n);break;}
          case "NotNull": if(this.#registers[op.p1]!.initialStorageClass!=="null"){this.#registers[op.p2]!.copyFrom(this.#registers[op.p1]!);this.#pc=op.jump}break;
          case "Variable": this.#registers[op.p2]!.copyFrom(this.#bindings[op.p1 - 1]!); break;
          case "Subtract": this.#registers[op.p3]!.moveFrom(arithmeticBinary("subtract", this.#registers[op.p1]!, this.#registers[op.p2]!)); break;
          case "BitNot": this.#registers[op.p2]!.moveFrom(bitwiseNot(this.#registers[op.p1]!)); break;
          case "Not": this.#registers[op.p2]!.moveFrom(logicalNot(this.#registers[op.p1]!)); break;
          case "ResultRow": {for(let i=0;i<op.p2;i++)this.#checkResultValue(this.#registers[op.p1+i]!);if(++this.#rows>(this.#program.maxRows??Number.MAX_SAFE_INTEGER))throw new JSQLiteError("limit","statement exceeds maxRows");this.#rowStart=op.p1;this.#rowCount=op.p2;this.#state="row";return "row";}
          case "Halt": this.#state = "done"; {const cleanup=this.#halt();if(cleanup!==null)throw cleanup;} return "done";
        }
      }
      this.#state = "done"; {const cleanup=this.#halt();if(cleanup!==null)throw cleanup;} return "done";
    } catch (error) {
      const publicError = this.#mapExecutionError(error);
      this.#savedError = publicError; this.#state = "failed"; this.#halt(); throw publicError;
    }
    }).finally(release);
  }
  reset(): void { this.#assertIdle(); const primary=this.#savedError; this.#savedError=null; const cleanup=this.#halt(); this.#rows=0; this.#work=0; this.#currentTime=null; this.#once.clear(); this.#registers.forEach(value => value.setNull()); this.#pc = 0; this.#state = "prepared"; if(primary!==null) throw primary; if(cleanup!==null) throw cleanup; }
  finalize(): void { this.#assertIdle(); if (this.#state === "finalized") misuse("statement is finalized"); const primary=this.#savedError; this.#savedError=null; const cleanup=this.#halt(); this.#registers.forEach(value => value.release()); this.#bindings.forEach(value => value.release()); this.#state = "finalized"; this.#onFinalize(); if(primary!==null) throw primary; if(cleanup!==null) throw cleanup; }
  columnMetadata(index: number): ColumnMetadata { this.#assertColumn(index, false); return Object.freeze({...this.#program.columns[index]!}); }
  columnType(index: number): SqliteStorageClass { return this.#cell(index).initialStorageClass; }
  column(index: number): SqliteValue { return memToPublicInitial(this.#cell(index)); }
  columnInteger(index: number): bigint | null { const cell = this.#cell(index); if(cell.initialStorageClass === "null")return null;const copy=new Mem();copy.copyFrom(cell);copy.cast("integer",this.#program.encoding);return copy.integerValue(); }
  columnReal(index: number): number | null { const cell = this.#cell(index); if(cell.initialStorageClass === "null")return null;const copy=new Mem();copy.copyFrom(cell);copy.cast("real",this.#program.encoding);return copy.realValue(); }
  columnText(index: number): string | null { const cell = this.#cell(index); if (cell.initialStorageClass === "null") return null; const copy = new Mem(); copy.copyFrom(cell); copy.cast("text", "utf-8"); return copy.textValue(); }
  columnBlob(index: number): Uint8Array | null { const cell = this.#cell(index); if (cell.initialStorageClass === "null") return null; const value = memToPublicInitial(cell); return value instanceof Uint8Array ? value : memFromPublic(String(value), "utf-8").textBytes().slice(); }
  async #loadRecord(cursorId:number,options: OperationOptions, limit: number, started: number): Promise<void> {
    this.#borrow.invalidate();
    const chunks: Uint8Array[] = []; let length = 0;
    for (const chunk of { [Symbol.iterator]: () => this.#cursors.get(cursorId)!.payloadChunks() }) {
      this.#checkControl(options, limit, started);
      this.#work++; chunks.push(chunk); length += chunk.byteLength;
      // An overflow-page read is a bounded storage work unit and a host
      // checkpoint. PC and cursor stay on the current row while suspended.
      if (chunks.length > 1) {
        this.#state = "suspended";
        await new Promise<void>(resolve => setTimeout(resolve, 0));
        this.#state = "running";
      }
    }
    this.#checkControl(options, limit, started);
    this.#work++; // record header/serial-type decoding
    const payload = new Uint8Array(length); let at = 0;
    for (const chunk of chunks) { payload.set(chunk, at); at += chunk.byteLength; }
    this.#records.set(cursorId,decodeRecord(payload, this.#program.database!.encoding));
    this.#recordRowids.set(cursorId,this.#cursors.get(cursorId)!.rowid);
  }
  async #chargeScalarInputs(values:readonly Mem[],options:OperationOptions,limit:number,started:number):Promise<void>{let units=0;for(const value of values)units+=Math.ceil(valueBytes(value)/256);for(let i=0;i<units;i++){this.#checkControl(options,limit,started);this.#work++;if(this.#work%256===0){this.#state="suspended";await new Promise<void>(resolve=>setTimeout(resolve,0));this.#state="running";}}}
  #checkResultValue(value:Mem):void {if(valueBytes(value)>this.#program.maxResultBytes)throw new JSQLiteError("limit","string or blob too big");}
  #chargeValue(value:Mem,options:OperationOptions,limit:number,started:number):void { const bytes=valueBytes(value);const units=Math.ceil(bytes/256);for(let i=0;i<units;i++){this.#checkControl(options,limit,started);this.#work++;} }
  #mapExecutionError(error: unknown): unknown {
    // This is the single lazy execution boundary. Existing public errors retain
    // identity; only known storage provenance is classified here.
    if (error instanceof JSQLiteError) return error;
    if (error instanceof LocalTimeUnavailableError) return new JSQLiteError("sqlite",error.message,{code:1,extendedCode:1,cause:error});
    if (error instanceof BtreeFormatError || error instanceof RecordFormatError)
      return new JSQLiteError("sqlite", error.message, { code: 11, extendedCode: 11, cause: error });
    if (error instanceof BtreeLimitError || error instanceof PrivateStateLimitError)
      return new JSQLiteError("limit", error.message, { cause: error });
    return error;
  }
  #checkControl(options: OperationOptions, limit: number, started: number): void {
    if (options.signal?.aborted) throw new JSQLiteError("cancelled", "statement execution was cancelled", { cause: options.signal.reason });
    if (options.timeoutMs !== undefined && Date.now() - started >= options.timeoutMs) throw new JSQLiteError("timeout", "statement execution timed out");
    if (this.#work >= limit) throw new JSQLiteError("limit", "statement exceeds maxWorkUnits");
  }
  #privateControl(options:OperationOptions,limit:number,started:number):PrivateStateControl {
    return {checkpoint:async(units=0)=>{
      if(!Number.isSafeInteger(units)||units<0)throw new JSQLiteError("internal","invalid private-state work charge");
      for(let i=0;i<units;i++){this.#checkControl(options,limit,started);this.#work++;if(this.#work%256===0){this.#state="suspended";await new Promise<void>(resolve=>setTimeout(resolve,0));this.#state="running"}}
      this.#checkControl(options,limit,started);
    }};
  }
  #halt(): unknown | null {
    this.#invalidateRow();this.#cursors.clear();for(const cursor of this.#jsonCursors.values())cursor.close();this.#jsonCursors.clear();this.#cursorRoots.clear();this.#records.clear();this.#recordRowids.clear();this.#packedRecords.clear();
    let diagnostic:unknown=null;
    for(const cursor of this.#privateCursors.values())try{cursor.close()}catch(error){if(diagnostic===null)diagnostic=error}
    this.#privateCursors.clear();this.#borrow.invalidate();
    return diagnostic;
  }
  #assertLive(): void { if (this.#state === "finalized") misuse("statement is finalized"); }
  #assertIdle(): void { this.#assertLive(); if (this.#state === "running" || this.#state === "suspended") misuse("statement operation is pending"); this.#assertConnectionIdle(); }
  #invalidateRow(): void { this.#rowStart = 0; this.#rowCount = 0; }
  #assertColumn(index: number, requireRow: boolean): void { this.#assertIdle(); if (!Number.isInteger(index) || index < 0 || index >= this.columnCount) range(); if (requireRow && this.#rowCount === 0) misuse("no current row"); }
  #cell(index: number): Mem { this.#assertColumn(index, true); return this.#registers[this.#rowStart + index]!; }
}
