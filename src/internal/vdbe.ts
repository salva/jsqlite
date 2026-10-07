import {beginPrefixLoop,emitPrefixSeek,finishPrefixLoop,type PrefixLoop} from './where-prefix.ts';
import { RowSet } from "./rowset.ts";
import {resolvedResultColumn} from "./resolve.ts";
import {integerPrimaryKeyColumn,freezeTransientTable} from "./schema.ts";
import {resolvedExpressionCarrier,type ResolvedExpressionCarrier,type ResolvedSource,type ResolvedExpressionBinding} from './resolve.ts';
// First compiled no-FROM scalar SELECT slice. The instruction/register split
// follows expr.c sqlite3ExprCode* and vdbe.c's opcode loop rather than evaluating
// the parsed ExprNode directly from Statement.step().
import type { ColumnMetadata, OperationOptions, SqliteStorageClass, SqliteValue, Statement, StepResult } from "../index.ts";
import { JSQLiteError } from "../index.ts";
import { SelectProgramBuilder, reachesOwningReturn, emitSelectDestination, type SelectDest } from "./select-program.ts";
import { BorrowLifetime, Mem, type MemAffinity, memFromPublic, memFromRawRecord, memToPublicInitial } from "./mem.ts";
import type { ExprNode, SelectNode } from "./parse.ts";
import { lowerOrdinaryCtes } from "./cte.ts";
import { arithmeticBinary, bitwiseNot, booleanValue, logicalNot } from "./vdbe-primitives.ts";
import { compareMem, compareRecordKey, KeyInfo, UnpackedRecordKey, type BuiltinCollation } from "./comparison.ts";
import { EphemeralIndexCursor, FifoCursor, PriorityQueueCursor, PrivateStateByteBudget, PrivateStateLimitError, SorterCursor, type PrivateStateControl, type PrivateStateLimits } from "./private-state.ts";
import { decodeRecord, RecordFormatError } from "./record.ts";
import { BtreeFormatError, BtreeLimitError, type BtreeDatabase, type IndexCursor, type TableCursor, type TableScanCursor } from "./btree.ts";
import type { PhysicalIndex, SchemaGraph, TableNode, ViewNode } from "./schema.ts";
import type { DatabaseEncoding } from "./record.ts";
import { type ResolvedAggregatePhaseCarrier, transientColumnNames as uniqueTransientColumnNames, expandAndResolveSelect, NameResolutionError, resolvedCompoundAffinity, bindTransientProducer, transientDeclaredType, resolvedExpressionDeclaredType, resolvedCompoundCollation, resolvedExpressionAffinity, resolvedExpressionCollation } from "./resolve.ts";
import { sqliteAsciiFold, sqliteIdentifierEqual } from "./sqlite-case.ts";
import type { LemonValue } from "./lemon-runtime.ts";
import type { SqlToken } from "./tokenize.ts";
import { tokenIds } from "../generated/parser-tables.ts";
import {branchConsumedTerms, analyzeWhere, btreeLoops, orRuntimeArmClause, wherePathSolver, type WhereLoop, type WhereClause, rightJoinResidual, planWhere, resolvedWhereOrder, ROWID_NEEDED, WherePlanningUnsupportedError, expressionStructuralIdentity, type IndexConstraintAdmission, type WhereTerm } from "./where-plan.ts";
import { builtinFunction, builtinFunctionAccepts } from "./functions.ts";
import { SQLITE_COMPILE_OPTIONS, SQLITE_SOURCE_ID, SQLITE_VERSION, asText, asUtf8, decodeUnistr, firstCodePoint, quoteValue, scalarText, secureRandom, utf8Length } from "./ordinary-scalars.ts";
import {sqliteFormat,sqliteRound} from "./printf.ts";
import {evaluateDateTime, defaultDateTimeEnvironment, LocalTimeUnavailableError, type DateTimeEnvironment} from "./date-time.ts";
import { sqlitePatternCompare, validateLikeEscape } from "./pattern.ts";
import {evaluateMathFunction,isMathFunction} from "./math.ts";
import { jsonArrayLength, jsonArrow, jsonConstruct, openJsonTableCursor, jsonEdit, jsonErrorPosition, jsonExtract, jsonNodeFromSqlValue, jsonPatch, jsonPretty, jsonQuote, jsonTextResult, jsonType, jsonValid, jsonbExtract, jsonbMemResult, jsonbResult, parseJsonMem, renderJson, JSON_EACH_COLUMNS, JSON_TABLE_COLUMNS, type JsonNode, type JsonTableCursor } from "./json.ts";

import {sqlite3WindowRewrite, type WindowRewriteGraph} from "./window-rewrite.ts";
export {sqlite3WindowRewrite};
export type {WindowRewriteFunction,WindowRewriteSortTerm,WindowRewriteLayer,WindowRewriteGraph} from "./window-rewrite.ts";

type SubqueryExpression=Extract<Expression,{kind:"scalar-subquery"}>|Extract<Expression,{kind:"in-subquery"}>;
type AggregateOrderTerm={expression:Expression;descending:boolean;nullsLarge:boolean};
type Expression =
 | {kind:"variable";spelling:string}
 | {kind:"mem";value:Mem;collation?:BuiltinCollation}
 | {kind:"literal";value:null|bigint|number|string|Uint8Array}
 | {kind:"column";index:number;name:string;cursor?:number;payloadIndex?:number;physicalColumnIndex?:number|undefined;aggregateColumn?:{owner:import("./resolve.ts").AggregateColumnOwner;iAgg:number};collation?:BuiltinCollation;affinity?:MemAffinity}
 | {kind:"unary";op:string;value:Expression}
 | {kind:"binary";op:string;left:Expression;right:Expression}
 | {kind:"collate";value:Expression;collation:BuiltinCollation}
 | {kind:"cast";value:Expression;affinity:MemAffinity}
 | {kind:"call";name:string;args:Expression[];deferredAffinity?:true}
 | {kind:"aggregate";name:string;args:Expression[];collation:BuiltinCollation;distinct:boolean;filter:Expression|null;orderBy:AggregateOrderTerm[]}
 | {kind:"scalar-subquery";select:SelectNode;exists?:true}
 | {kind:"in-subquery";left:Expression;select:SelectNode;negated:boolean}
 | {kind:"in-list";left:Expression;values:Expression[];negated:boolean}
 | {kind:"between";value:Expression;lower:Expression;upper:Expression;negated:boolean}
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
  | { readonly code: "CompareJump"; readonly permutation?:readonly number[]; readonly left:number; readonly right:number; readonly count:number; readonly keyInfo:KeyInfo; readonly less:number; readonly equal:number; readonly greater:number }
  | { readonly code: "CompareGroup"; readonly left:number; readonly right:number; readonly count:number; readonly keyInfo:KeyInfo; readonly jump:number }
  | { readonly code: "WindowRangeTest"; readonly candidate:number; readonly current:number; readonly offset?:number; readonly mode:"end-current"|"end-following"|"end-unbounded"|"start-unbounded"|"start-current"|"start-preceding"|"start-following"; readonly descending:boolean; readonly collation:BuiltinCollation; readonly jump:number }
  | { readonly code: "CollSeq"; readonly collation:BuiltinCollation }
  | { readonly code: "ShortCircuit"; readonly kind:"and"|"or"; readonly p1:number; readonly p2:number; readonly jump:number }
  | { readonly code: "Boolean"; readonly kind:"and"|"or"; readonly p1:number; readonly p2:number; readonly p3:number }
  | { readonly code: "NotNull"; readonly p1:number; readonly p2:number; readonly jump:number }
  | { readonly code: "Once"; readonly p1:number; readonly p2:number }
  | { readonly code: "RowSetTest"; readonly p1:number; readonly p2:number; readonly p3:number; readonly p4:number }
  | { readonly code: "Gosub"; readonly p1:number; readonly p2:number }
  | { readonly code: "BeginSubrtn"; readonly p2:number }
  | { readonly code: "Return"; readonly p1:number; readonly fallthrough?:boolean }
  | { readonly code: "InitCoroutine"; readonly p1:number; readonly p2:number; readonly p3:number }
  | { readonly code: "Yield"; readonly p1:number; readonly p2:number }
  | { readonly code: "EndCoroutine"; readonly p1:number; readonly p2:number }
  | { readonly code: "OpenDup"; readonly p1:number; readonly p2:number }
  | { readonly code: "Goto"; readonly p2:number }
  | { readonly code: "Subtract"; readonly p1: number; readonly p2: number; readonly p3: number }
  | { readonly code: "BitNot" | "Not"; readonly p1: number; readonly p2: number }
  | { readonly code: "OpenRead"; readonly p1: number; readonly p2?: number }
  | { readonly code: "IndexNullRow";readonly p1:number }
  | { readonly code: "OpenIndex"; readonly orBranch?:boolean; readonly p1: number; readonly p2: number; readonly physical: PhysicalIndex }
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
  | { readonly code: "OpenEphemeral"; readonly p1:number; readonly keyInfo:KeyInfo; readonly insertionOrder?:boolean }
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
  | { readonly code: "WindowCheck"; readonly p1:number; readonly boundary:"starting"|"ending"|"nth"; readonly numeric:boolean }
  | { readonly code: "OffsetLimit"; readonly p1:number; readonly p2:number; readonly p3:number }
  | { readonly code: "IfNotZero"; readonly p1:number; readonly p2:number }
  | { readonly code: "IfPos"; readonly p1:number; readonly p2:number; readonly p3:number }
  | { readonly code: "DecrJumpZero"; readonly p1:number; readonly p2:number }
  | { readonly code: "Rewind"; readonly p1?: number; readonly p2: number }
  | { readonly code: "Last"; readonly p1?: number; readonly p2: number }
  | { readonly code: "SeekRowid"; readonly p1?:number; readonly key:number; readonly p2:number }
  | { readonly code: "SeekRowidRange"; readonly p1?:number; readonly key:number; readonly inclusive:boolean; readonly reverse:boolean; readonly p2:number }
  | { readonly code: "RowidUpperBound"; readonly p1?:number; readonly key:number; readonly inclusive:boolean; readonly p2:number }
  | { readonly code: "RowidLowerBound"; readonly p1?:number; readonly key:number; readonly inclusive:boolean; readonly p2:number }
  | { readonly code: "IndexRewind"; readonly p1: number; readonly p2: number }
  | { readonly code: "IndexLast"; readonly p1: number; readonly p2: number }
  | { readonly code:"InListValue";readonly values:readonly number[];readonly indexRegister:number;readonly target:number;readonly p2:number;readonly setKey?:{readonly affinity:MemAffinity;readonly keyInfo:KeyInfo;readonly fieldOrdinal?:number;readonly reverse?:boolean} }
  | { readonly code:"IndexSeekPrefix";readonly p1:number;readonly keys:readonly number[];readonly affinities:readonly MemAffinity[];readonly keyInfo:KeyInfo;readonly reverse:boolean;readonly strict?:boolean;readonly seekScan?:Readonly<{steps:number;hasRange:boolean}>;readonly p2:number }
  | { readonly code:"IndexPrefixEnd";readonly p1:number;readonly keys:readonly number[];readonly affinities:readonly MemAffinity[];readonly keyInfo:KeyInfo;readonly p2:number }
  | { readonly code:"IndexRangeEnd";readonly p1:number;readonly field:number;readonly key:number;readonly affinity:MemAffinity;readonly collation:BuiltinCollation;readonly operator:"lt"|"le"|"gt"|"ge";readonly p2:number }
  | { readonly code: "DeferredSeek"; readonly p1: number; readonly p2: number }
  | { readonly code: "DeferredIndexSeek"; readonly p1:number; readonly p2:number; readonly primaryKeyFields:readonly number[]; readonly physical:PhysicalIndex }
  | { readonly code: "NullRow"; readonly p1: number }
  | { readonly code: "Column"; readonly p1: number; readonly p2: number; readonly p3?: number; readonly affinity?: MemAffinity }
  | { readonly code: "RealAffinity"; readonly p1: number }
  | { readonly code: "Rowid"; readonly p1?: number; readonly p2: number }
  | { readonly code: "Eq"; readonly p1: number; readonly p2: number; readonly p3: number; readonly affinity: MemAffinity; readonly collation: BuiltinCollation }
  | { readonly code: "IsNull"; readonly p1:number; readonly p2:number }
  | { readonly code: "IfNot"; readonly p1: number; readonly p2: number; readonly residual?: boolean }
  | { readonly code: "Next"; readonly p1?: number; readonly p2: number }
  | { readonly code: "Prev"; readonly p1?: number; readonly p2: number }
  | { readonly code: "IndexNext"; readonly p1: number; readonly p2: number }
  | { readonly code: "IndexPrev"; readonly p1: number; readonly p2: number }
  | { readonly code: "ResultRow"; readonly p1: number; readonly p2: number }
  | { readonly code: "Halt" };

/** Relocate every instruction-address field when a complete Program is embedded.
 * Most p2 fields are registers, columns, roots, or cursors, so address-bearing
 * variants stay explicit. Coroutine p2 zero is a sentinel; ordinary target zero
 * is the first child instruction and must be relocated.
 */
function relocateControlTargets(original:Op,target:(pc:number)=>number):Op {
  switch(original.code){
    case "Goto":case "Once":case "Gosub":case "RowSetTest":case "JsonTableRewind":case "JsonTableNext":
    case "SorterNext":case "EphemeralRewind":case "EphemeralNext":
    case "IfNotZero":case "IfPos":case "DecrJumpZero":case "Rewind":case "Last":
    case "SeekRowid":case "SeekRowidRange":case "RowidUpperBound":case "RowidLowerBound":
    case "IndexRewind":case "IndexLast":case "InListValue":case "IndexSeekPrefix":case "IndexPrefixEnd":
    case "IndexRangeEnd":case "IsNull":case "IfNot":case "Next":case "Prev":case "IndexNext":case "IndexPrev":
      return {...original,p2:target(original.p2)} as Op;
    case "CompareJump":
      return {...original,less:target(original.less),equal:target(original.equal),greater:target(original.greater)};
    case "InitCoroutine":
      return {...original,p2:original.p2===0?0:target(original.p2),p3:target(original.p3)};
    case "Yield":case "EndCoroutine":
      return {...original,p2:original.p2===0?0:target(original.p2)};
    case "SorterSort":
      return {...original,emptyJump:target(original.emptyJump)};
    case "PriorityShift":case "FifoShift":
      return {...original,emptyJump:target(original.emptyJump)};
    case "EphemeralAdvanceData":
      return original.emptyJump===undefined?original:{...original,emptyJump:target(original.emptyJump)};
    default:
      return "jump" in original&&typeof original.jump==="number"
        ? {...original,jump:target(original.jump)} as Op
        : original;
  }
}
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
  /** Immutable prepare-time WHERE search accounting. Each execution copies it
   * into a fresh production-private counter set. */
  readonly whereAccounting?: Readonly<{plannerCandidates:number;plannerPaths:number}>;
}

/** Production-private sqlite3_stmt_status-shaped accounting. It deliberately
 * does not extend the public Statement contract. */
export interface VdbePrivateAccounting {
  readonly plannerCandidates:number;
  readonly plannerPaths:number;
  readonly indexSeeks:number;
  readonly indexNext:number;
  readonly tableSeeks:number;
  readonly tableNext:number;
  readonly residualTests:number;
  readonly sorterRows:number;
  /** Number of separate RHS values used to drive an index IN loop. */
  readonly inProbes:number;
  readonly orBranchStarts:number;
  readonly orBranchRoots:readonly number[];
  readonly orDuplicateSkips:number;
}
const zeroPrivateAccounting=():VdbePrivateAccounting=>({plannerCandidates:0,plannerPaths:0,indexSeeks:0,indexNext:0,tableSeeks:0,tableNext:0,residualTests:0,sorterRows:0,inProbes:0,orBranchStarts:0,orBranchRoots:[],orDuplicateSkips:0});
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
  readonly valueApplications:readonly Readonly<{result:number;start:number;end:number;cursor:number}>[];
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
  readonly ownerExit?:number;
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

// window.c windowFullScan / windowReturnOneRow: value functions with a
// moving ROWS start cannot use callback xInverse (first/nth inverse is a noop).
// Explicit EXCLUDE also owns a frame scan instead of a cumulative callback.
function scannedRowsLayer(layer:WindowCodeLayer):boolean {
  return layer.windows.length>0&&layer.windows.every(win=>{
    const f=win.window.frame;
    return win.window.partitionBy.length===0&&f.type==='rows'&&(f.start.kind==='preceding'||f.start.kind==='current')
      &&(f.end.kind==='following'||f.end.kind==='current')
      &&(f.exclusion===null||f.exclusion==='no-others'||f.exclusion==='current-row')
      &&!!aggregateDefinition(win.window.functionName);
  })&&((layer.windows[0]!.window.frame.exclusion==='current-row'&&(layer.windows[0]!.window.frame.end.kind==='following'||layer.windows[0]!.window.frame.start.kind==='current'))
    ||(layer.windows[0]!.window.frame.end.kind==='current'&&layer.windows.some(win=>win.window.functionName==='first_value'||win.window.functionName==='nth_value')));
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

/** window.c:windowAggStep callback primitive: FILTER surrounds callback only. */
function windowAggregateCallback(ops:Op[],win:WindowCodeLayer['windows'][number],source:number,inverse:boolean,collation:BuiltinCollation,accumulator=win.regAccum):void{
 const args=Array.from({length:win.window.argumentCount},(_,i)=>source+win.argumentColumn+i);
 const filter=win.filterColumn===null?-1:ops.length;
 if(filter>=0)ops.push({code:'IfNot',p1:source+win.filterColumn!,p2:0});
 ops.push({code:inverse?'AggInverse':'AggStep',name:win.window.functionName,args,p2:accumulator,collation:args.length?collation:'binary'});
 if(filter>=0)(ops[filter] as {p2:number}).p2=ops.length;
}
function windowAggStep(p:WindowCodeArg,sourceRegister:number,inverse:boolean,accumulators?:readonly number[]):void {
 for(let index=0;index<p.layer.windows.length;index++){
  const win=p.layer.windows[index]!;
  windowAggregateCallback(p.ops,win,sourceRegister,inverse,win.window.argumentCount?p.collationOf(win.argumentColumn):'binary',accumulators?.[index]??win.regAccum);
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
  recursiveProducer?:{select:SelectNode;maxRows:number},
  owner?:{builder:SelectProgramBuilder<Op>;destination:SelectDest;parameters?:ParameterBuilder;retainedSource?:SelectNode},
):WindowLoweringCompilation {
  // window.c:sqlite3WindowRewrite only rewrites pPrior==0. Compound arms
  // must be lowered by multiSelect individually; lowering its first-arm
  // carrier here silently discards subsequent rows. Until those arm callers
  // can share the window builder, preserve the whole construct atomically.
  if(resolved.source.hasCompound)throw new JSQLiteError('unsupported','compound window SELECT lowering is not implemented',{unsupportedClassification:'temporary'});
  const rewrite=sqlite3WindowRewrite(resolved,owner?.builder);
  const byGroup=new Map(rewrite.layers.map(layer=>[layer.compatibleGroup,layer] as const));
  const compileLayers:WindowRewriteGraph["layers"][number][]=[];
  const visit=(select:NonNullable<WindowRewriteGraph["root"]>):void=>{
    if(select.subquery.kind==="rewritten-select")visit(select.subquery.select);
    const layer=byGroup.get(select.compatibleGroup);
    if(!layer)throw new Error(`window rewrite lost compatible group ${select.compatibleGroup}`);
    compileLayers.push(layer);
  };
  if(rewrite.root)visit(rewrite.root);
  const builder=owner?.builder??new SelectProgramBuilder<Op>();
  const ops:Op[]=builder.ops;
  const parameters:ParameterBuilder=owner?.parameters??{maximum:0,names:[],named:new Map()};
  let registers=Math.max(builder.registers,0,...rewrite.layers.flatMap(layer=>[layer.regGosub,...layer.windows.flatMap(win=>[win.regAccum,win.regResult])]));
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
    // window.c:sqlite3WindowCodeInit allocates partition/constant state in
    // the enclosing Parse. Prior layers still have bounded manual consumers;
    // import their high-water, then hand the updated frontier back to them.
    builder.registers=Math.max(builder.registers,registers);
    const partitionRegisters:number[]=[];
    for(const _term of layer.producerOrderBy.filter(term=>term.source==="partition")){const reg=builder.register();partitionRegisters.push(reg);ops.push({code:"Null",p2:reg});}
    const regPartInitialized=partitionRegisters.length?builder.register():null;if(regPartInitialized!==null)ops.push({code:"Integer",p1:0n,p2:regPartInitialized});
    const regOne=builder.register();ops.push({code:"Integer",p1:1n,p2:regOne});
    const regOutputReady=builder.register();ops.push({code:"Integer",p1:0n,p2:regOutputReady});
    registers=builder.registers;
    for(const win of layer.windows)ops.push({code:"Null",p2:win.regAccum});
    // window.c:windowCheckValue evaluates offsets once, outside the producer
    // loop. ROWS/GROUPS require integers; RANGE admits numeric values.
    const frame=layer.windows[0]?.window.frame;
    const boundRegisters:{start:number|null;end:number|null}={start:null,end:null};
    if(frame){
      for(const [boundary,value] of [["starting",frame.start],["ending",frame.end]] as const){
        if(!value.expr?.reduction)continue;
        const register=compileExpressionTree(expressionFromReduction(value.expr.reduction),ops,()=>builder.register(),parameters);
        boundRegisters[boundary==="starting"?"start":"end"]=register;
        ops.push({code:"WindowCheck",p1:register,boundary,numeric:frame.type==="range"});
      }
    }
    // Exclusion/application/buffer consumers still use the manual frontier.
    registers=builder.registers;
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
    // window.c:sqlite3WindowCodeInit consumes the shared nMem/nTab frontier.
    // Rewrite/physical identities remain reserved; later sorters and children
    // still consume the bounded manual frontier until their migration.
    builder.reserveCursorsThrough(nextApplicationCursor-1);
    let regStartRowid:number|null=null,regEndRowid:number|null=null,applicationCursor:number|null=null;
    if(exclusion!==null){
      regStartRowid=builder.register();regEndRowid=builder.register();applicationCursor=builder.cursor();
      ops.push({code:"Integer",p1:1n,p2:regStartRowid},{code:"Integer",p1:0n,p2:regEndRowid},{code:"OpenDup",p1:applicationCursor,p2:layer.iEphCsr});
    }else if(offsetApplication||(valueApplication&&!scannedRowsLayer(layer))){
      applicationCursor=builder.cursor();
      ops.push({code:"OpenDup",p1:applicationCursor,p2:layer.iEphCsr});
    }
    const valueApplications:Readonly<{result:number;start:number;end:number;cursor:number}>[]=[];
    if(valueApplication&&scannedRowsLayer(layer))for(const win of layer.windows){
      if(win.window.functionName!=="first_value"&&win.window.functionName!=="nth_value")continue;
      const start=builder.range(2),cursor=builder.cursor();
      valueApplications.push(Object.freeze({result:win.regResult,start,end:start+1,cursor}));
      ops.push({code:"OpenDup",p1:cursor,p2:layer.iEphCsr},{code:"Integer",p1:0n,p2:start},{code:"Integer",p1:0n,p2:start+1});
    }
    registers=builder.registers;
    nextApplicationCursor=Math.max(nextApplicationCursor,builder.cursors);
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
    const regNew=width?builder.range(width):builder.registers+1;
    const inputRegisters=Object.freeze(Array.from({length:width},(_value,index)=>regNew+index));
    const regRecord=builder.register(),regRowid=builder.register();
    const peerRegisters=():readonly number[]=>{
      const count=peerExpressions.length;
      const first=count?builder.range(count):builder.registers+1;
      return Object.freeze(Array.from({length:count},(_value,index)=>first+index));
    };
    const regPeer=(frame?.type!=="rows"||exclusionPeers)&&peerExpressions.length?builder.registers+1:null;
    const mainPeerRegisters=regPeer===null?Object.freeze([] as number[]):peerRegisters();
    const startPeerRegisters=regPeer===null?Object.freeze([] as number[]):peerRegisters();
    const currentPeerRegisters=regPeer===null?Object.freeze([] as number[]):peerRegisters();
    const endPeerRegisters=regPeer===null?Object.freeze([] as number[]):peerRegisters();
    // Source/producer coroutine and output consumers remain manual for now.
    registers=builder.registers;
    setup.push(Object.freeze({compatibleGroup:layer.compatibleGroup,regPart:partitionRegisters[0]??null,regPartInitialized,partitionRegisters:Object.freeze(partitionRegisters),regOne,regOutputReady,boundRegisters:Object.freeze(boundRegisters),regStartRowid,regEndRowid,applicationCursor,valueApplications:Object.freeze(valueApplications),deleteMode:frame?frameDeleteMode(frame):"retain",partitionKeyInfo,peerKeyInfo,regNew,inputRegisters,regRecord,regRowid,regPeer,startPeerRegisters,currentPeerRegisters,endPeerRegisters}));
  }
  // Realize the recursive rewrite as coroutine producers. The innermost
  // producer alone owns the original FROM scan. Each incompatible outer layer
  // consumes the prior layer's coroutine instead of being flattened into that
  // scan. Producer ORDER terms are materialized through the ordinary sorter
  // op family before rows cross each boundary.
  const maxCursor=Math.max(0,...resolved.sources.map(source=>source.cursorId),...rewrite.layers.flatMap(layer=>[layer.iEphCsr,...layer.duplicateCursors]),...setup.flatMap(layer=>[...(layer.applicationCursor===null?[]:[layer.applicationCursor]),...layer.valueApplications.map(app=>app.cursor)]));
  // select.c finalizes the ordinary GROUP BY before the rewritten window
  // subquery consumes it. Lifted aggregates therefore cannot be read from a
  // raw source cursor. Build the existing AggInfo/sorter program as the
  // innermost coroutine producer on this builder and destination.
  // resolve.c1356ff: nested TK_AGG_FUNCTION.op2 owns the outer aggregate
  // even without a syntactic GROUP BY/top-level aggregate. window.c moves
  // those expressions into its inner producer before window stepping.
  const ownsNestedAggregate=(plan:import('./resolve.ts').ResolvedSelect,depth:number):boolean=>
    [...(plan.aggregateUses?.values()??[])].some(owner=>owner===depth)||plan.nested.some(child=>ownsNestedAggregate(child,depth+1));
  const nestedAggregate=resolved.nested.some(child=>ownsNestedAggregate(child,1));
  const groupedLayer=compileLayers[0]&&(resolved.source.hasGroupBy||([...resolved.aggregateUses?.values()??[]].some(depth=>depth===0)||nestedAggregate)&&!owner?.retainedSource)?compileLayers[0]:null;
  const groupedProducer=groupedLayer&&database&&schema?(()=>{
    const source=resolved.source,arm=source.arms[0]!,result=groupedLayer.bufferExpressions;
    // The rewritten buffer contains deferred window-result slots alongside the
    // grouped columns and lifted aggregate arguments. select.c's inner grouped
    // producer does not execute those OVER expressions; they are populated by
    // the outer window layer. Keep the payload width stable with an ordinary
    // grouped expression placeholder so coroutine payload column indexes
    // remain source-shaped.
    const hasOver=(node:LemonValue<SqlToken>):boolean=>node.kind==="reduction"&&(node.signature.toLowerCase().includes("over_clause ::= over")||node.children.some(hasOver));
    const groupedResult=Object.freeze(result.map(item=>item.reduction&&hasOver(item.reduction)?(source.groupBy[0]??result.find(value=>value.reduction&&!hasOver(value.reduction))!):item));
    const producer:SelectNode=Object.freeze({...source,result:groupedResult,orderBy:Object.freeze([]),limit:null,offset:null,windowNames:Object.freeze([]),windowDefinitions:Object.freeze([]),hasOrderBy:false,hasLimit:false,hasSubquery:false,arms:Object.freeze([Object.freeze({...arm,result:groupedResult,orderBy:Object.freeze([])})])});
    return producer;
  })():null;
  // select.c tag-select-0482: the coroutine destination identity belongs to
  // the enclosing Parse, before its source SELECT body is constructed.
  builder.registers=Math.max(builder.registers,registers);
  const sourceCoroutine=builder.register();
  const producerCoroutines=compileLayers.map(()=>builder.register());
  // Source/buffer expressions and later output producers are still manual.
  registers=builder.registers;
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
  if(owner?.retainedSource){
    // select.c tag-select-0482: retained SrcItem feeds this window rewrite
    // on the same Parse, with child LIMIT owned by the child SELECT.
    builder.registers=registers;
    builder.reserveCursorsThrough(Math.max(nextApplicationCursor,...sorterCursors));
    groupedPayload=builder.range(owner.retainedSource.result.length);
    const destination:SelectDest={kind:'coroutine',register:sourceCoroutine,first:groupedPayload};
    if(owner.retainedSource.hasCompound){
      // multiSelect emits each arm into the same SRT_Coroutine payload.
      // No child Program/PC relocation, and child limits remain child-owned.
      // window.c transfers producer ordering before select.c flattenSubquery
      // distributes that producer over UNION ALL (and transfers child LIMIT).
      // Bind generated keys to the retained EList, not its synthetic cursor.
      const terms=compileLayers[0]!.producerOrderBy;
      const canFlattenOrder=!owner.retainedSource.hasOrderBy&&!owner.retainedSource.offset&&owner.retainedSource.arms.every(arm=>!arm.hasDistinct&&!arm.hasGroupBy&&!arm.hasHaving&&arm.from.items.length>0&&!selectHasAggregate({...owner.retainedSource!,result:arm.result} as SelectNode)&&(arm.operatorFromPrior===null||arm.operatorFromPrior==='union-all'))&&terms.every(term=>term.binding&&term.binding.columnIndex>=0);
      const source=canFlattenOrder?Object.freeze({...owner.retainedSource,hasOrderBy:terms.length>0,orderBy:Object.freeze(terms.map(term=>Object.freeze({expr:owner.retainedSource!.result[term.binding!.columnIndex]!,descending:term.descending,nulls:term.nulls})))}):owner.retainedSource;
      compileTableCompoundProducer(source,schema!,database!,Number.MAX_SAFE_INTEGER,maxWorkUnits,maxResultBytes,privateStateLimits,{builder,parameters,destination});
    }else if(selectHasAggregate(owner.retainedSource)||owner.retainedSource.hasGroupBy||owner.retainedSource.hasHaving){
      compileAggregateSelect(owner.retainedSource,schema!,database!,Number.MAX_SAFE_INTEGER,maxWorkUnits,maxResultBytes,privateStateLimits,{builder,ops,parameters,destination});
    }else{
      const sourcePlan=expandAndResolveSelect(owner.retainedSource,schema!,null,builder.cursors);
      compileInnerTableSelect(owner.retainedSource,sourcePlan,database!,Number.MAX_SAFE_INTEGER,maxWorkUnits,maxResultBytes,privateStateLimits,{builder,ops,parameters,destination});
    }
    registers=builder.registers;
    nextApplicationCursor=Math.max(nextApplicationCursor,builder.cursors);
    ops.push({code:'EndCoroutine',p1:sourceCoroutine,p2:0});
  }else if(groupedProducer){
    // select.c:sqlite3Select SRT_Coroutine emits the rewritten GROUP producer
    // on the enclosing Parse. Reserve window rewrite allocations before AggInfo
    // takes registers/cursors; propagate its high-water marks back to the layers.
    builder.registers=registers;
    builder.reserveCursorsThrough(Math.max(nextApplicationCursor,...sorterCursors));
    groupedPayload=builder.range(groupedProducer.result.length);
    let input: {first:number;emit:(consume:()=>void)=>void}|undefined;
    if(recursiveProducer){
      const recursiveOwner=recursiveProducer.select.with!.ctes.find(cte=>cte.select.arms.some(arm=>arm.from.items.some(item=>item.databaseName===null&&sqliteIdentifierEqual(item.tableName,cte.name))))!;
      const first=builder.range(recursiveOwner.select.arms[0]!.result.length),coroutine=builder.register();
      const ready=builder.label();
      builder.jump(ready,{code:'InitCoroutine',p1:coroutine,p2:0,p3:ops.length+1},(op,pc)=>({...op,p2:pc}));
      compileRecursiveCteSelect(recursiveProducer.select,encoding,maxWorkUnits,maxResultBytes,privateStateLimits,recursiveProducer.maxRows,true,{builder,parameters,destination:{kind:'coroutine',register:coroutine,first}});
      ops.push({code:'EndCoroutine',p1:coroutine,p2:0});builder.mark(ready);
      input={first,emit:consume=>{const top=builder.label(),done=builder.label();builder.mark(top);builder.jump(done,{code:'Yield',p1:coroutine,p2:0},(op,pc)=>({...op,p2:pc}));consume();builder.jump(top,{code:'Goto',p2:0},(op,pc)=>({...op,p2:pc}));builder.mark(done);}};
    }
    // window.c selectWindowRewriteExprCb moves outer TK_COLUMN terminals
    // out of scalar children into the grouped producer. Their lexical source
    // identity survives, but they are now local producer expressions (depth 0).
    // The recursive producer reuses its prepared plan instead of resolving a
    // new physical SrcList, so publish the moved column uses on that plan too.
    const movedColumns:import('./resolve.ts').ResolvedColumnUse[]=[];
    const collectMovedColumns=(plan:import('./resolve.ts').ResolvedSelect):void=>{
      for(const use of plan.columnUses)if(resolved.sources.includes(use.source)&&groupedProducer.result.some(item=>item.reduction===use.expression))movedColumns.push(Object.freeze({...use,selectDepth:0}));
      plan.nested.forEach(collectMovedColumns);
    };
    if(recursiveProducer)resolved.nested.forEach(collectMovedColumns);
    const linkedPlan=recursiveProducer?Object.freeze({...resolved,source:groupedProducer,columnUses:Object.freeze([...resolved.columnUses,...movedColumns])}):undefined;
    compileAggregateSelect(groupedProducer,schema!,database!,Number.MAX_SAFE_INTEGER,maxWorkUnits,maxResultBytes,privateStateLimits,{builder,ops,parameters,destination:{kind:'coroutine',register:sourceCoroutine,first:groupedPayload},...(input?{input,linkedPlan:linkedPlan!}:{})});
    registers=builder.registers;
    nextApplicationCursor=Math.max(nextApplicationCursor,builder.cursors);
    ops.push({code:'EndCoroutine',p1:sourceCoroutine,p2:0});
  }else if(recursiveProducer){
    // generateWithRecursiveQuery emits Queue/Current and its destination in
    // the same Parse. No completed source Program or address relocation.
    builder.registers=registers;
    builder.reserveCursorsThrough(Math.max(nextApplicationCursor,...sorterCursors));
    const recursiveOwner=recursiveProducer.select.with!.ctes.find(cte=>cte.select.arms.some(arm=>arm.from.items.some(item=>item.databaseName===null&&sqliteIdentifierEqual(item.tableName,cte.name))))!;
    groupedPayload=builder.range(recursiveOwner.select.arms[0]!.result.length);
    compileRecursiveCteSelect(recursiveProducer.select,encoding,maxWorkUnits,maxResultBytes,privateStateLimits,recursiveProducer.maxRows,true,{builder,parameters,destination:{kind:'coroutine',register:sourceCoroutine,first:groupedPayload}});
    registers=builder.registers;
    nextApplicationCursor=Math.max(nextApplicationCursor,builder.cursors);
    ops.push({code:'EndCoroutine',p1:sourceCoroutine,p2:0});
  }else{
    // window.c:sqlite3WindowRewrite keeps the original resolved input edge.
    // Drive it through the same WHERE producer as an ordinary joined SELECT;
    // Yield leaves physical cursors positioned for the lifted buffer bindings.
    // Only FROM/ON/WHERE belong here: DISTINCT/ORDER/LIMIT belong to the outer
    // window consumer. No reparsing or second evaluator is involved.
    if(!database)throw new JSQLiteError('internal','window original input needs database');
    const original=compileLayers[0]?.producer;
    if(original?.kind!=='original')throw new JSQLiteError('internal','window source lost original predicate owner');
    const inputSelect:SelectNode=Object.freeze({...resolved.source,orderBy:Object.freeze([]),limit:null,offset:null,hasOrderBy:false,hasLimit:false,hasDistinct:false});
    builder.registers=Math.max(builder.registers,registers);
    builder.reserveCursorsThrough(Math.max(nextApplicationCursor,...sorterCursors));
    if(resolved.sources.length){
      compileInnerTableSelect(inputSelect,resolved,database,Number.MAX_SAFE_INTEGER,maxWorkUnits,maxResultBytes,privateStateLimits,{builder,ops,parameters,destination:{kind:'coroutine',register:sourceCoroutine,first:0},consumeRow:()=>ops.push({code:'Yield',p1:sourceCoroutine,p2:0})});
    }else ops.push({code:'Yield',p1:sourceCoroutine,p2:0});
    registers=builder.registers;
    nextApplicationCursor=Math.max(nextApplicationCursor,builder.cursors);
    ops.push({code:"EndCoroutine",p1:sourceCoroutine,p2:0});
  }
  const sourceContinuation=ops.length;(ops[sourceInit] as {p2:number}).p2=sourceContinuation;

  let childCoroutine=sourceCoroutine,childStart=sourceStart,allProducerExpressionsRepresented=true;
  for(let index=0;index<compileLayers.length;index++){
    const layer=compileLayers[index]!,producerCoroutine=producerCoroutines[index]!,sorterCursor=sorterCursors[index]!;
    const emitStep=(win:typeof layer.windows[number],source:number,inverse=false):void=>windowAggregateCallback(ops,win,source,inverse,win.window.argumentCount?collation(expressionFromReduction(layer.bufferExpressions[win.argumentColumn]!.reduction!)):'binary');
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
      if(index===0&&owner?.retainedSource&&binding){ops.push({code:"Copy",p1:groupedPayload!+binding.columnIndex,p2:target});return;}
      if(index===0&&!owner?.retainedSource&&groupedPayload!==null&&(!recursiveProducer||groupedLayer||binding)){const column=recursiveProducer&&!groupedLayer?binding!.columnIndex:producerColumn??(binding?groupedLayer!.bufferBindings.findIndex(candidate=>candidate?.source.cursorId===binding.source.cursorId&&candidate.columnIndex===binding.columnIndex):value?equivalentBufferExpression(groupedLayer!.bufferExpressions,value):-1);if(column<0){allProducerExpressionsRepresented=false;ops.push({code:"Null",p2:target});return;}ops.push({code:"Copy",p1:groupedPayload+column,p2:target});return;}
      if(index>0&&value?.reduction){const child=compileLayers[index-1]!,childState=setup[index-1]!;const win=child.windows.find(item=>item.window.owner.reduction===value.reduction);if(win){ops.push({code:"Copy",p1:win.regResult,p2:target});return;}const column=equivalentBufferExpression(child.bufferExpressions,value);if(column>=0){ops.push({code:"Copy",p1:childState.regNew+column,p2:target});return;}const bound=binding?child.bufferBindings.findIndex(candidate=>candidate?.source.cursorId===binding.source.cursorId&&candidate.columnIndex===binding.columnIndex):-1;if(bound>=0){ops.push({code:"Copy",p1:childState.regNew+bound,p2:target});return;}}
      if(!binding){
        // FILTER is a complete producer expression, not a direct column
        // binding. Evaluate it while the source cursors are positioned and
        // retain its boolean value in the shared ephemeral payload. This is
        // window.c's FILTER register ownership, not output-time recomputation.
        const ownedFilter=producerColumn!==undefined?layer.windows.find(win=>win.filterColumn===producerColumn):undefined;
        const valueReduction=value?.reduction;
        const windowAlias=value?.tokens.length===1?resolved.result.find(result=>result.expression.alias!==undefined&&result.expression.alias!==null&&sqliteIdentifierEqual(result.expression.alias,sqlName(value.tokens[0]!.text))&&rewrite.layers.some(owner=>owner.windows.some(win=>win.window.owner===result.expression))):undefined;
        const generatedZeroArgWindowSlot=value?.tokens.length===0&&layer.windows.some(win=>win.window.argumentCount===0);const deferred=generatedZeroArgWindowSlot||!!windowAlias||!!(value?.reduction&&compileLayers.slice(index).some(owner=>owner.windows.some(win=>win.window.owner.reduction===value.reduction)));if(deferred){ops.push({code:'Null',p2:target});return;}
        // window.c appends complete argument expressions to the producer
        // SELECT. Bind those expressions to the current source phase before
        // expr.c code generation, just as for the cached FILTER predicate.
        if(valueReduction?.kind==='reduction'){
          if(ownedFilter&&!ownedFilter.filterCarrier)throw new JSQLiteError('internal','window FILTER rewrite lost its carrier');
          const carrier=ownedFilter?.filterCarrier??resolvedExpressionCarrier(resolved,valueReduction);
          // window.c selectWindowRewriteExprCb (TK_AGG_FUNCTION) replaces
          // finalized nested aggregates with columns of the previous layer.
          // Match that payload expression identity before scalar child binding;
          // raw source columns are not an aggregate's finalized value.
          const location:ResolvedExpressionBinding={policy:'window-filter',aggregateOutput:reduction=>{
            if(index===0)return undefined;
            const column=equivalentBufferExpression(compileLayers[index-1]!.bufferExpressions,{kind:'tokens',tokens:[],reduction});
            return column<0?undefined:setup[index-1]!.regNew+column;
          },location:ref=>{
            if(index>0){
              const child=compileLayers[index-1]!,column=child.bufferBindings.findIndex(candidate=>candidate?.source.cursorId===ref.source.cursorId&&candidate.columnIndex===ref.columnIndex);
              if(column<0)throw new JSQLiteError('unsupported','window producer expression column is not represented',{unsupportedClassification:'temporary'});
              return {kind:'register',register:setup[index-1]!.regNew+column,phase:'producer-row'};
            }
            return groupedPayload!==null&&(owner?.retainedSource||recursiveProducer)
              ?{kind:'register',register:groupedPayload+ref.columnIndex,phase:'producer-row'}
              :{kind:'cursor',cursor:ref.source.cursorId};
          }};
          const expression=bindResolvedExpression(expressionFromReduction(valueReduction),carrier,ref=>ref.cursorId,true,location);
          builder.registers=Math.max(builder.registers,registers);
          const subquery=resolvedScalarSubqueryEmitter(resolved,builder,parameters,{database:database!,maxRows:recursiveProducer?.maxRows??Number.MAX_SAFE_INTEGER,maxWorkUnits,maxResultBytes,privateStateLimits},location);
          const register=compileExpressionTree(expression,ops,()=>builder.register(),parameters,subquery);registers=builder.registers;ops.push({code:'Copy',p1:register,p2:target});return;
        }
        allProducerExpressionsRepresented=false;ops.push({code:'Null',p2:target});return;
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
      for(const win of layer.windows){emitStep(win,setup[index]!.regNew);ops.push({code:"AggValue",name:win.window.functionName,p1:win.regAccum,p2:win.regResult});}
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
    const scannedRows=scannedRowsLayer(layer);
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
      builder.registers=Math.max(builder.registers,registers);const outputSave=rangeState!.inputRegisters.length?builder.range(rangeState!.inputRegisters.length):builder.registers+1;registers=builder.registers;
      const reversed=ops.length;ops.push({code:"IfRegisterGt",left:rangeState!.boundRegisters.end!,right:rangeState!.boundRegisters.start!,jump:0});
      ops.push({code:"Copy",p1:rangeState!.boundRegisters.end!,p2:rangeEndCount!},{code:"Copy",p1:rangeState!.boundRegisters.start!,p2:rangeStartCount!},{code:"Binary",op:"+",p1:rangeStartCount!,p2:rangeState!.regOne,p3:rangeStartCount!,collation:"binary"});
      const output=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[2],p2:rangeState!.regNew,count:rangeState!.inputRegisters.length,emptyJump:0});
      for(let i=0;i<rangeState!.inputRegisters.length;i++)ops.push({code:"Copy",p1:rangeState!.regNew+i,p2:outputSave+i});
      const endCheck=ops.length;ops.push({code:"IfPos",p1:rangeEndCount!,p2:0,p3:1});const endAdvance=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[1],p2:rangeState!.regNew,count:rangeState!.inputRegisters.length,emptyJump:0});for(const win of layer.windows){emitStep(win,rangeState!.regNew);}const afterEnd=ops.length;(ops[endCheck] as {p2:number}).p2=afterEnd;(ops[endAdvance] as {emptyJump:number}).emptyJump=afterEnd;
      const startCheck=ops.length;ops.push({code:"IfPos",p1:rangeStartCount!,p2:0,p3:1});const startAdvance=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[0],p2:rangeState!.regNew,count:rangeState!.inputRegisters.length,emptyJump:0});for(const win of layer.windows){emitStep(win,rangeState!.regNew,true);}const snapshot=ops.length;(ops[startCheck] as {p2:number}).p2=snapshot;(ops[startAdvance] as {emptyJump:number}).emptyJump=snapshot;for(const win of layer.windows)ops.push({code:"AggValue",name:win.window.functionName,p1:win.regAccum,p2:win.regResult});for(let i=0;i<rangeState!.inputRegisters.length;i++)ops.push({code:"Copy",p1:outputSave+i,p2:rangeState!.regNew+i});ops.push({code:"Integer",p1:1n,p2:rangeState!.regOutputReady},{code:"Yield",p1:producerCoroutine,p2:0},{code:"Goto",p2:output});
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
      const initial=ops.length;ops.push({code:"IfPos",p1:rangeEndCount!,p2:0,p3:1},{code:"Goto",p2:0});const initialAdvance=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[1],p2:rangeState!.regNew,count:rangeState!.inputRegisters.length,emptyJump:0});for(const win of layer.windows){emitStep(win,rangeState!.regNew);}ops.push({code:"Goto",p2:initial});const initialized=ops.length;(ops[initial] as {p2:number}).p2=initialAdvance;(ops[initial+1] as {p2:number}).p2=initialized;(ops[initialAdvance] as {emptyJump:number}).emptyJump=initialized;
      ops.push({code:"Copy",p1:rangeState!.boundRegisters.start!,p2:rangeStartCount!});
      const output=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[2],p2:rangeState!.regNew,count:rangeState!.inputRegisters.length,emptyJump:0});for(const win of layer.windows)ops.push({code:"AggValue",name:win.window.functionName,p1:win.regAccum,p2:win.regResult});emitFastValueResults();ops.push({code:"Integer",p1:1n,p2:rangeState!.regOutputReady},{code:"Yield",p1:producerCoroutine,p2:0});
      const endAdvance=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[1],p2:rangeState!.regNew,count:rangeState!.inputRegisters.length,emptyJump:0});for(const win of layer.windows){emitStep(win,rangeState!.regNew);}const afterEnd=ops.length;(ops[endAdvance] as {emptyJump:number}).emptyJump=afterEnd;
      const startCheck=ops.length;ops.push({code:"IfPos",p1:rangeStartCount!,p2:0,p3:1});const startAdvance=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[0],p2:rangeState!.regNew,count:rangeState!.inputRegisters.length,emptyJump:0});for(const win of layer.windows){emitStep(win,rangeState!.regNew,true);}const afterStart=ops.length;(ops[startCheck] as {p2:number}).p2=afterStart;(ops[startAdvance] as {emptyJump:number}).emptyJump=afterStart;ops.push({code:"Goto",p2:output});const complete=ops.length;(ops[output] as {emptyJump:number}).emptyJump=complete;
    };
    const emitGroupsOnePrecedingExcludeGroupDrain=():void=>{
      const state=followingState!,peerCount=state.endPeerRegisters.length,peerStart=layer.windows[0]!.argumentColumn-peerCount,initialized=++registers,hasPrevious=++registers;
      builder.registers=Math.max(builder.registers,registers);const currentPeer=peerCount?builder.range(peerCount):builder.registers+1;registers=builder.registers;builder.registers=Math.max(builder.registers,registers);const previousPeer=peerCount?builder.range(peerCount):builder.registers+1;registers=builder.registers;builder.registers=Math.max(builder.registers,registers);const outputSave=state.inputRegisters.length?builder.range(state.inputRegisters.length):builder.registers+1;registers=builder.registers;const temporary=layer.windows.map(()=>++registers);
      ops.push({code:"Integer",p1:0n,p2:initialized},{code:"Integer",p1:0n,p2:hasPrevious});const output=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[2],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:state.regNew+i,p2:outputSave+i});
      const first=ops.length;ops.push({code:"IfNot",p1:initialized,p2:0});const sameGroup=ops.length;ops.push({code:"CompareGroup",left:outputSave+peerStart,right:currentPeer,count:peerCount,keyInfo:state.peerKeyInfo!,jump:0});for(let i=0;i<peerCount;i++)ops.push({code:"Copy",p1:currentPeer+i,p2:previousPeer+i});for(let i=0;i<peerCount;i++)ops.push({code:"Copy",p1:outputSave+peerStart+i,p2:currentPeer+i});ops.push({code:"Integer",p1:1n,p2:hasPrevious},{code:"Goto",p2:0});const initialize=ops.length;(ops[first] as {p2:number}).p2=initialize;for(let i=0;i<peerCount;i++)ops.push({code:"Copy",p1:outputSave+peerStart+i,p2:currentPeer+i});ops.push({code:"Integer",p1:1n,p2:initialized});const scanStart=ops.length;(ops[sameGroup] as {jump:number}).jump=scanStart;(ops[initialize-1] as {p2:number}).p2=scanStart;ops.push({code:"AggReset",registers:temporary});const noPrevious=ops.length;ops.push({code:"IfNot",p1:hasPrevious,p2:0});const rewind=ops.length;ops.push({code:"EphemeralRewind",p1:state.applicationCursor!,p2:0});const scan=ops.length;ops.push({code:"EphemeralData",p1:state.applicationCursor!,p2:state.regNew,count:state.inputRegisters.length});const peer=ops.length;ops.push({code:"CompareGroup",left:state.regNew+peerStart,right:previousPeer,count:peerCount,keyInfo:state.peerKeyInfo!,jump:0},{code:"Goto",p2:0});const step=ops.length;(ops[peer] as {jump:number}).jump=step;windowCodeOp({ops,layer,state,collationOf:column=>collation(expressionFromReduction(layer.bufferExpressions[column]!.reduction!))},"WINDOW_AGGSTEP",state.regNew,temporary);const next=ops.length;(ops[peer+1] as {p2:number}).p2=next;ops.push({code:"EphemeralNext",p1:state.applicationCursor!,p2:scan});const snapshot=ops.length;(ops[noPrevious] as {p2:number}).p2=snapshot;(ops[rewind] as {p2:number}).p2=snapshot;for(let i=0;i<layer.windows.length;i++)ops.push({code:"AggValue",name:layer.windows[i]!.window.functionName,p1:temporary[i]!,p2:layer.windows[i]!.regResult});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:outputSave+i,p2:state.regNew+i});ops.push({code:"Integer",p1:1n,p2:state.regOutputReady},{code:"Yield",p1:producerCoroutine,p2:0},{code:"Goto",p2:output});const done=ops.length;(ops[output] as {emptyJump:number}).emptyJump=done;
    };
    const emitGroupsCumulativeExcludeCurrentDrain=():void=>{
      const state=followingState!,peerCount=state.endPeerRegisters.length,peerStart=layer.windows[0]!.argumentColumn-peerCount,currentRowid=++registers,candidateRowid=++registers,same=++registers;
      builder.registers=Math.max(builder.registers,registers);const outputSave=state.inputRegisters.length?builder.range(state.inputRegisters.length):builder.registers+1;registers=builder.registers;const temporary=layer.windows.map(()=>++registers);
      const output=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[2],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0},{code:"EphemeralRowid",p1:layer.duplicateCursors[2],p2:currentRowid});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:state.regNew+i,p2:outputSave+i});ops.push({code:"AggReset",registers:temporary});
      const rewind=ops.length;ops.push({code:"EphemeralRewind",p1:state.applicationCursor!,p2:0});const scan=ops.length;ops.push({code:"EphemeralData",p1:state.applicationCursor!,p2:state.regNew,count:state.inputRegisters.length},{code:"EphemeralRowid",p1:state.applicationCursor!,p2:candidateRowid});
      const afterCurrent=ops.length;ops.push({code:"IfRegisterGt",left:candidateRowid,right:currentRowid,jump:0},{code:"Eq",p1:candidateRowid,p2:currentRowid,p3:same,affinity:"numeric",collation:"binary"});const beforeIdentity=ops.length;ops.push({code:"IfNot",p1:same,p2:0},{code:"Goto",p2:0});
      const peer=ops.length;(ops[afterCurrent] as {jump:number}).jump=peer;ops.push({code:"CompareGroup",left:state.regNew+peerStart,right:outputSave+peerStart,count:peerCount,keyInfo:state.peerKeyInfo!,jump:0},{code:"Goto",p2:0});
      const step=ops.length;(ops[beforeIdentity] as {p2:number}).p2=step;(ops[peer] as {jump:number}).jump=step;windowCodeOp({ops,layer,state,collationOf:column=>collation(expressionFromReduction(layer.bufferExpressions[column]!.reduction!))},"WINDOW_AGGSTEP",state.regNew,temporary);
      const next=ops.length;(ops[beforeIdentity+1] as {p2:number}).p2=next;ops.push({code:"EphemeralNext",p1:state.applicationCursor!,p2:scan});const snapshot=ops.length;(ops[rewind] as {p2:number}).p2=snapshot;(ops[peer+1] as {p2:number}).p2=snapshot;for(let i=0;i<layer.windows.length;i++)ops.push({code:"AggValue",name:layer.windows[i]!.window.functionName,p1:temporary[i]!,p2:layer.windows[i]!.regResult});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:outputSave+i,p2:state.regNew+i});ops.push({code:"Integer",p1:1n,p2:state.regOutputReady},{code:"Yield",p1:producerCoroutine,p2:0},{code:"Goto",p2:output});const done=ops.length;(ops[output] as {emptyJump:number}).emptyJump=done;
    };
    const emitRangeOffsetExcludeCurrentDrain=():void=>{
      const state=followingState!,frame=layer.windows[0]!.window.frame,orderIndex=layer.windows[0]!.argumentColumn-state.endPeerRegisters.length,currentRowid=++registers,candidateRowid=++registers,same=++registers;
      const cumulativeRangeTies=frame.exclusion==="ties"&&frame.start.kind==="unbounded"&&frame.end.kind==="current";
      builder.registers=Math.max(builder.registers,registers);const outputSave=state.inputRegisters.length?builder.range(state.inputRegisters.length):builder.registers+1;registers=builder.registers;const temporary=layer.windows.map(()=>++registers),term=layer.producerOrderBy.find(item=>item.source==="order")!;const coll=typeof state.peerKeyInfo!.terms[0]!.collation==="string"?state.peerKeyInfo!.terms[0]!.collation:"binary";
      const output=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[2],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0},{code:"EphemeralRowid",p1:layer.duplicateCursors[2],p2:currentRowid});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:state.regNew+i,p2:outputSave+i});ops.push({code:"AggReset",registers:temporary});
      const rewind=ops.length;ops.push({code:"EphemeralRewind",p1:state.applicationCursor!,p2:0});const scan=ops.length;ops.push({code:"EphemeralData",p1:state.applicationCursor!,p2:state.regNew,count:state.inputRegisters.length},{code:"EphemeralRowid",p1:state.applicationCursor!,p2:candidateRowid});const startUnbounded=layer.windows[0]!.window.frame.start.kind==="unbounded",beforeStart=ops.length;ops.push(startUnbounded?{code:"Goto",p2:0}:layer.windows[0]!.window.frame.start.kind==="current"?{code:"WindowRangeTest",candidate:state.regNew+orderIndex,current:outputSave+orderIndex,mode:"start-current",descending:term.descending,collation:coll,jump:0}:{code:"WindowRangeTest",candidate:state.regNew+orderIndex,current:outputSave+orderIndex,offset:state.boundRegisters.start!,mode:layer.windows[0]!.window.frame.start.kind==="following"?"start-following":"start-preceding",descending:term.descending,collation:coll,jump:0});const endUnbounded=layer.windows[0]!.window.frame.end.kind==="unbounded",endEligible=ops.length;ops.push(endUnbounded?{code:"Goto",p2:0}:layer.windows[0]!.window.frame.end.kind==="following"?{code:"WindowRangeTest",candidate:state.regNew+orderIndex,current:outputSave+orderIndex,offset:state.boundRegisters.end!,mode:"end-following",descending:term.descending,collation:coll,jump:0}:{code:"WindowRangeTest",candidate:state.regNew+orderIndex,current:outputSave+orderIndex,mode:"end-current",descending:term.descending,collation:coll,jump:0},{code:"Goto",p2:0});const eligible=ops.length;if(startUnbounded)(ops[beforeStart] as {p2:number}).p2=eligible;if(endUnbounded)(ops[endEligible] as {p2:number}).p2=eligible;else (ops[endEligible] as {jump:number}).jump=eligible;let skipCurrent:number,identityStep:number|null=null;if(layer.windows[0]!.window.frame.exclusion==="no-others"){skipCurrent=ops.length;ops.push({code:"Goto",p2:skipCurrent+1});identityStep=skipCurrent+1;}else if(layer.windows[0]!.window.frame.exclusion==="group"){const peer=ops.length;ops.push({code:"CompareGroup",left:state.regNew+orderIndex,right:outputSave+orderIndex,count:1,keyInfo:state.peerKeyInfo!,jump:0},{code:"Goto",p2:0});const step=ops.length;(ops[peer+1] as {p2:number}).p2=step;skipCurrent=peer;identityStep=step;}else if(cumulativeRangeTies){ops.push({code:"Eq",p1:candidateRowid,p2:currentRowid,p3:same,affinity:"numeric",collation:"binary"});skipCurrent=ops.length;ops.push({code:"IfNot",p1:same,p2:0},{code:"Goto",p2:0});const nonIdentity=ops.length;(ops[skipCurrent] as {p2:number}).p2=nonIdentity;ops.push({code:"WindowRangeTest",candidate:state.regNew+orderIndex,current:outputSave+orderIndex,mode:"start-current",descending:term.descending,collation:coll,jump:0},{code:"Goto",p2:0});const step=ops.length;identityStep=step;(ops[skipCurrent+1] as {p2:number}).p2=step;}else if(layer.windows[0]!.window.frame.exclusion==="ties"){const peer=ops.length;ops.push({code:"CompareGroup",left:state.regNew+orderIndex,right:outputSave+orderIndex,count:1,keyInfo:state.peerKeyInfo!,jump:0},{code:"Goto",p2:0});const identity=ops.length;(ops[peer] as {jump:number}).jump=identity;ops.push({code:"Eq",p1:candidateRowid,p2:currentRowid,p3:same,affinity:"numeric",collation:"binary"});skipCurrent=ops.length;ops.push({code:"IfNot",p1:same,p2:0},{code:"Goto",p2:0});const step=ops.length;identityStep=step;(ops[peer+1] as {p2:number}).p2=step;}else{ops.push({code:"Eq",p1:candidateRowid,p2:currentRowid,p3:same,affinity:"numeric",collation:"binary"});skipCurrent=ops.length;ops.push({code:"IfNot",p1:same,p2:0},{code:"Goto",p2:0});const step=ops.length;(ops[skipCurrent] as {p2:number}).p2=step;}windowCodeOp({ops,layer,state,collationOf:column=>collation(expressionFromReduction(layer.bufferExpressions[column]!.reduction!))},"WINDOW_AGGSTEP",state.regNew,temporary);
      const next=ops.length;if(!startUnbounded)(ops[beforeStart] as {jump:number}).jump=next;if(identityStep!==null){if(layer.windows[0]!.window.frame.exclusion==="group")(ops[skipCurrent] as {jump:number}).jump=next;else if(layer.windows[0]!.window.frame.exclusion==="ties"&&layer.windows[0]!.window.frame.start.kind==="unbounded"&&layer.windows[0]!.window.frame.end.kind==="current"){(ops[skipCurrent+2] as {jump:number}).jump=identityStep;(ops[skipCurrent+3] as {p2:number}).p2=next;}else if(layer.windows[0]!.window.frame.exclusion!=="no-others"){(ops[skipCurrent] as {p2:number}).p2=next;(ops[skipCurrent+1] as {p2:number}).p2=identityStep;}}else (ops[skipCurrent+1] as {p2:number}).p2=next;ops.push({code:"EphemeralNext",p1:state.applicationCursor!,p2:scan});const snapshot=ops.length;(ops[rewind] as {p2:number}).p2=snapshot;(ops[endEligible+1] as {p2:number}).p2=snapshot;for(let i=0;i<layer.windows.length;i++)ops.push({code:"AggValue",name:layer.windows[i]!.window.functionName,p1:temporary[i]!,p2:layer.windows[i]!.regResult});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:outputSave+i,p2:state.regNew+i});ops.push({code:"Integer",p1:1n,p2:state.regOutputReady},{code:"Yield",p1:producerCoroutine,p2:0},{code:"Goto",p2:output});const done=ops.length;(ops[output] as {emptyJump:number}).emptyJump=done;
    };
    const emitRangeCurrentTiesDrain=():void=>{
      const state=followingState!,peerCount=state.endPeerRegisters.length,peerStart=layer.windows[0]!.argumentColumn-peerCount,currentRowid=++registers,candidateRowid=++registers,same=++registers;
      builder.registers=Math.max(builder.registers,registers);const outputSave=state.inputRegisters.length?builder.range(state.inputRegisters.length):builder.registers+1;registers=builder.registers;const temporary=layer.windows.map(()=>++registers);
      const output=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[2],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0},{code:"EphemeralRowid",p1:layer.duplicateCursors[2],p2:currentRowid});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:state.regNew+i,p2:outputSave+i});
      ops.push({code:"AggReset",registers:temporary});const rewind=ops.length;ops.push({code:"EphemeralRewind",p1:state.applicationCursor!,p2:0});const scan=ops.length;ops.push({code:"EphemeralData",p1:state.applicationCursor!,p2:state.regNew,count:state.inputRegisters.length},{code:"EphemeralRowid",p1:state.applicationCursor!,p2:candidateRowid});const pastCurrent=ops.length;ops.push({code:"IfRegisterGt",left:candidateRowid,right:currentRowid,jump:0});const peer=ops.length;ops.push({code:"CompareGroup",left:state.regNew+peerStart,right:outputSave+peerStart,count:peerCount,keyInfo:state.peerKeyInfo!,jump:0},{code:"Goto",p2:0});const identity=ops.length;(ops[peer] as {jump:number}).jump=identity;ops.push({code:"Eq",p1:candidateRowid,p2:currentRowid,p3:same,affinity:"numeric",collation:"binary"});const skip=ops.length;ops.push({code:"IfNot",p1:same,p2:0});windowCodeOp({ops,layer,state,collationOf:column=>collation(expressionFromReduction(layer.bufferExpressions[column]!.reduction!))},"WINDOW_AGGSTEP",state.regNew,temporary);const next=ops.length;(ops[peer+1] as {p2:number}).p2=orderedCumulativePeerExclusion?skip+1:next;(ops[skip] as {p2:number}).p2=next;ops.push({code:"EphemeralNext",p1:state.applicationCursor!,p2:scan});const snapshot=ops.length;(ops[rewind] as {p2:number}).p2=snapshot;(ops[pastCurrent] as {jump:number}).jump=snapshot;for(let i=0;i<layer.windows.length;i++)ops.push({code:"AggValue",name:layer.windows[i]!.window.functionName,p1:temporary[i]!,p2:layer.windows[i]!.regResult});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:outputSave+i,p2:state.regNew+i});ops.push({code:"Integer",p1:1n,p2:state.regOutputReady},{code:"Yield",p1:producerCoroutine,p2:0},{code:"Goto",p2:output});const done=ops.length;(ops[output] as {emptyJump:number}).emptyJump=done;
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
      const stepRow=ops.length;for(const win of layer.windows){emitStep(win,state.regNew);}ops.push({code:"Binary",op:"+",p1:groupRows,p2:state.regOne,p3:groupRows,collation:"binary"});
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
      const output=ops.length;(ops[next] as {emptyJump:number}).emptyJump=output;if(!orderedCumulativePeerExclusion&&!orderedCumulativePriorGroups)for(const win of layer.windows)ops.push({code:"AggValue",name:win.window.functionName,p1:win.regAccum,p2:win.regResult});const loop=ops.length;ops.push({code:"IfPos",p1:groupRows,p2:0,p3:1},{code:"Goto",p2:0});const row=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[2],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0});if(layer.windows[0]!.window.frame.exclusion==="ties"){for(const win of layer.windows){emitStep(win,state.regNew);ops.push({code:"AggValue",name:win.window.functionName,p1:win.regAccum,p2:win.regResult});emitStep(win,state.regNew,true);}}ops.push({code:"Integer",p1:1n,p2:state.regOutputReady},{code:"Yield",p1:producerCoroutine,p2:0},{code:"Goto",p2:loop});const following=ops.length;(ops[loop] as {p2:number}).p2=row;(ops[loop+1] as {p2:number}).p2=following;if(layer.windows[0]!.window.frame.exclusion==="ties"){const commit=ops.length;ops.push({code:"IfPos",p1:commitRows,p2:0,p3:1},{code:"Goto",p2:0});const commitRow=ops.length;(ops[commit] as {p2:number}).p2=commitRow;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[0],p2:state.regNew,count:state.inputRegisters.length});for(const win of layer.windows){emitStep(win,state.regNew);}ops.push({code:"Goto",p2:commit});const committed=ops.length;(ops[commit+1] as {p2:number}).p2=committed;}ops.push({code:"Goto",p2:group});const done=ops.length;(ops[first] as {emptyJump:number}).emptyJump=done;(ops[row] as {emptyJump:number}).emptyJump=done;
    };
    const emitOrderedFollowingGroupsDrain=():void=>{
      const state=followingState!,peerCount=state.endPeerRegisters.length,peerStart=layer.windows[0]!.argumentColumn-peerCount,groupRows=++registers,hasLookahead=++registers;
      const lookahead=registers+1;registers+=state.inputRegisters.length;
      // cume_dist is coerced by sqlite3WindowUpdate() to GROUPS 1 FOLLOWING..
      // UNBOUNDED FOLLOWING. Fill nTotal once, then advance the start cursor by
      // one complete peer group before AggValue, matching windowCodeOp's inverse
      // callback schedule without host-side partition recomputation.
      const fill=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[1],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0});for(const win of layer.windows){emitStep(win,state.regNew);}ops.push({code:"Goto",p2:fill});const filled=ops.length;(ops[fill] as {emptyJump:number}).emptyJump=filled;ops.push({code:"Integer",p1:0n,p2:hasLookahead});
      const group=ops.length;ops.push({code:"Integer",p1:0n,p2:groupRows});const useSaved=ops.length;ops.push({code:"IfNot",p1:hasLookahead,p2:0});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:lookahead+i,p2:state.regNew+i});ops.push({code:"Integer",p1:0n,p2:hasLookahead},{code:"Goto",p2:0});const advance=ops.length;(ops[useSaved] as {p2:number}).p2=advance;const first=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[0],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0});const have=ops.length;(ops[advance-1] as {p2:number}).p2=have;for(let i=0;i<peerCount;i++)ops.push({code:"Copy",p1:state.regNew+peerStart+i,p2:state.startPeerRegisters[i]!});
      const inverse=ops.length;for(const win of layer.windows){emitStep(win,state.regNew,true);}ops.push({code:"Binary",op:"+",p1:groupRows,p2:state.regOne,p3:groupRows,collation:"binary"});const next=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[0],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0},{code:"CompareGroup",left:state.regNew+peerStart,right:state.startPeerRegisters[0]!,count:peerCount,keyInfo:state.peerKeyInfo!,jump:inverse});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:state.regNew+i,p2:lookahead+i});ops.push({code:"Integer",p1:1n,p2:hasLookahead});const snapshot=ops.length;(ops[next] as {emptyJump:number}).emptyJump=snapshot;for(const win of layer.windows)ops.push({code:"AggValue",name:win.window.functionName,p1:win.regAccum,p2:win.regResult});
      const output=ops.length;ops.push({code:"IfPos",p1:groupRows,p2:0,p3:1},{code:"Goto",p2:0});const row=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[2],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0},{code:"Integer",p1:1n,p2:state.regOutputReady},{code:"Yield",p1:producerCoroutine,p2:0},{code:"Goto",p2:output});const following=ops.length;(ops[output] as {p2:number}).p2=row;(ops[output+1] as {p2:number}).p2=following;ops.push({code:"Goto",p2:group});const done=ops.length;(ops[first] as {emptyJump:number}).emptyJump=done;(ops[row] as {emptyJump:number}).emptyJump=done;
    };
    const emitOrderedSuffixGroupsDrain=():void=>{
      const state=followingState!,peerCount=state.endPeerRegisters.length,peerStart=layer.windows[0]!.argumentColumn-peerCount,hasOutput=++registers,hasInverse=++registers;
      const outputLookahead=registers+1;registers+=state.inputRegisters.length;const inverseLookahead=registers+1;registers+=state.inputRegisters.length;
      const fill=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[1],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0});for(const win of layer.windows){emitStep(win,state.regNew);}ops.push({code:"Goto",p2:fill});const filled=ops.length;(ops[fill] as {emptyJump:number}).emptyJump=filled;ops.push({code:"Integer",p1:0n,p2:hasOutput},{code:"Integer",p1:0n,p2:hasInverse});
      const group=ops.length;
      // Snapshot before publishing the peer group. The output cursor itself owns
      // each authoritative payload; retaining only the one-row lookahead mirrors
      // windowCodeOp's separate current cursor and avoids yielding that lookahead
      // repeatedly after a peer-counting pre-scan.
      for(const win of layer.windows)ops.push({code:"AggValue",name:win.window.functionName,p1:win.regAccum,p2:win.regResult});
      const useOutput=ops.length;ops.push({code:"IfNot",p1:hasOutput,p2:0});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:outputLookahead+i,p2:state.regNew+i});ops.push({code:"Integer",p1:0n,p2:hasOutput},{code:"Goto",p2:0});const advanceOutput=ops.length;(ops[useOutput] as {p2:number}).p2=advanceOutput;const firstOutput=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[2],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0});const haveOutput=ops.length;(ops[advanceOutput-1] as {p2:number}).p2=haveOutput;for(let i=0;i<peerCount;i++)ops.push({code:"Copy",p1:state.regNew+peerStart+i,p2:state.currentPeerRegisters[i]!});
      const yieldRow=ops.length;ops.push({code:"Integer",p1:1n,p2:state.regOutputReady},{code:"Yield",p1:producerCoroutine,p2:0});const nextOutput=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[2],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0},{code:"CompareGroup",left:state.regNew+peerStart,right:state.currentPeerRegisters[0]!,count:peerCount,keyInfo:state.peerKeyInfo!,jump:yieldRow});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:state.regNew+i,p2:outputLookahead+i});ops.push({code:"Integer",p1:1n,p2:hasOutput});
      const inverseStart=ops.length;(ops[nextOutput] as {emptyJump:number}).emptyJump=inverseStart;
      const useInverse=ops.length;ops.push({code:"IfNot",p1:hasInverse,p2:0});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:inverseLookahead+i,p2:state.regNew+i});ops.push({code:"Integer",p1:0n,p2:hasInverse},{code:"Goto",p2:0});const advanceInverse=ops.length;(ops[useInverse] as {p2:number}).p2=advanceInverse;const firstInverse=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[0],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0});const haveInverse=ops.length;(ops[advanceInverse-1] as {p2:number}).p2=haveInverse;for(let i=0;i<peerCount;i++)ops.push({code:"Copy",p1:state.regNew+peerStart+i,p2:state.startPeerRegisters[i]!});const inverse=ops.length;for(const win of layer.windows){emitStep(win,state.regNew,true);}const nextInverse=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[0],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0},{code:"CompareGroup",left:state.regNew+peerStart,right:state.startPeerRegisters[0]!,count:peerCount,keyInfo:state.peerKeyInfo!,jump:inverse});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:state.regNew+i,p2:inverseLookahead+i});ops.push({code:"Integer",p1:1n,p2:hasInverse},{code:"Goto",p2:group});const done=ops.length;(ops[firstOutput] as {emptyJump:number}).emptyJump=done;(ops[firstInverse] as {emptyJump:number}).emptyJump=done;(ops[nextInverse] as {emptyJump:number}).emptyJump=done;
    };
    const emitOrderedRangePrecedingCurrentDrain=():void=>{
      const state=followingState!,orderIndex=layer.windows[0]!.argumentColumn-state.endPeerRegisters.length,currentKey=++registers,endFlag=++registers,startFlag=++registers;
      builder.registers=Math.max(builder.registers,registers);const outputSave=state.inputRegisters.length?builder.range(state.inputRegisters.length):builder.registers+1;registers=builder.registers;builder.registers=Math.max(builder.registers,registers);const endSave=state.inputRegisters.length?builder.range(state.inputRegisters.length):builder.registers+1;registers=builder.registers;builder.registers=Math.max(builder.registers,registers);const startSave=state.inputRegisters.length?builder.range(state.inputRegisters.length):builder.registers+1;registers=builder.registers;
      const term=layer.producerOrderBy.find(term=>term.source==="order")!;ops.push({code:"Integer",p1:0n,p2:endFlag},{code:"Integer",p1:0n,p2:startFlag});
      const output=ops.length;const outputAdvance=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[2],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:state.regNew+i,p2:outputSave+i});ops.push({code:"Copy",p1:state.regNew+orderIndex,p2:currentKey});
      const endLoop=ops.length;const endUse=ops.length;ops.push({code:"IfNot",p1:endFlag,p2:0});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:endSave+i,p2:state.regNew+i});ops.push({code:"Integer",p1:0n,p2:endFlag},{code:"Goto",p2:0});const endAdvance=ops.length;(ops[endUse] as {p2:number}).p2=endAdvance;const endFirst=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[1],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0});const endHave=ops.length;(ops[endAdvance-1] as {p2:number}).p2=endHave;const endEligible=ops.length;ops.push(layer.windows[0]!.window.frame.end.kind==="following"?{code:"WindowRangeTest",candidate:state.regNew+orderIndex,current:outputSave+orderIndex,offset:state.boundRegisters.end!,mode:"end-following",descending:term.descending,collation:(typeof state.peerKeyInfo!.terms[0]!.collation==="string"?state.peerKeyInfo!.terms[0]!.collation:"binary"),jump:0}:layer.windows[0]!.window.frame.end.kind==="unbounded"?{code:"WindowRangeTest",candidate:state.regNew+orderIndex,current:outputSave+orderIndex,mode:"end-unbounded",descending:term.descending,collation:(typeof state.peerKeyInfo!.terms[0]!.collation==="string"?state.peerKeyInfo!.terms[0]!.collation:"binary"),jump:0}:{code:"WindowRangeTest",candidate:state.regNew+orderIndex,current:outputSave+orderIndex,mode:"end-current",descending:term.descending,collation:(typeof state.peerKeyInfo!.terms[0]!.collation==="string"?state.peerKeyInfo!.terms[0]!.collation:"binary"),jump:0});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:state.regNew+i,p2:endSave+i});ops.push({code:"Integer",p1:1n,p2:endFlag},{code:"Goto",p2:0});const endStep=ops.length;(ops[endEligible] as {jump:number}).jump=endStep;for(const win of layer.windows){emitStep(win,state.regNew);}ops.push({code:"Goto",p2:endLoop});const startLoop=ops.length;(ops[endEligible+state.inputRegisters.length+2] as {p2:number}).p2=startLoop;(ops[endFirst] as {emptyJump:number}).emptyJump=startLoop;
      const startUse=ops.length;ops.push({code:"IfNot",p1:startFlag,p2:0});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:startSave+i,p2:state.regNew+i});ops.push({code:"Integer",p1:0n,p2:startFlag},{code:"Goto",p2:0});const startAdvance=ops.length;(ops[startUse] as {p2:number}).p2=startAdvance;const startFirst=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[0],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0});const startHave=ops.length;(ops[startAdvance-1] as {p2:number}).p2=startHave;const startEligible=ops.length;ops.push(layer.windows[0]!.window.frame.start.kind==="unbounded"?{code:"WindowRangeTest",candidate:state.regNew+orderIndex,current:outputSave+orderIndex,mode:"start-unbounded",descending:term.descending,collation:(typeof state.peerKeyInfo!.terms[0]!.collation==="string"?state.peerKeyInfo!.terms[0]!.collation:"binary"),jump:0}:layer.windows[0]!.window.frame.start.kind==="current"?{code:"WindowRangeTest",candidate:state.regNew+orderIndex,current:outputSave+orderIndex,mode:"start-current",descending:term.descending,collation:(typeof state.peerKeyInfo!.terms[0]!.collation==="string"?state.peerKeyInfo!.terms[0]!.collation:"binary"),jump:0}:{code:"WindowRangeTest",candidate:state.regNew+orderIndex,current:outputSave+orderIndex,offset:state.boundRegisters.start!,mode:layer.windows[0]!.window.frame.start.kind==="following"?"start-following":"start-preceding",descending:term.descending,collation:(typeof state.peerKeyInfo!.terms[0]!.collation==="string"?state.peerKeyInfo!.terms[0]!.collation:"binary"),jump:0});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:state.regNew+i,p2:startSave+i});ops.push({code:"Integer",p1:1n,p2:startFlag},{code:"Goto",p2:0});const inverse=ops.length;(ops[startEligible] as {jump:number}).jump=inverse;for(const win of layer.windows){emitStep(win,state.regNew,true);}ops.push({code:"Goto",p2:startLoop});const snapshot=ops.length;(ops[startEligible+state.inputRegisters.length+2] as {p2:number}).p2=snapshot;(ops[startFirst] as {emptyJump:number}).emptyJump=snapshot;for(const win of layer.windows)ops.push({code:"AggValue",name:win.window.functionName,p1:win.regAccum,p2:win.regResult});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:outputSave+i,p2:state.regNew+i});ops.push({code:"Integer",p1:1n,p2:state.regOutputReady},{code:"Yield",p1:producerCoroutine,p2:0},{code:"Goto",p2:output});const done=ops.length;(ops[outputAdvance] as {emptyJump:number}).emptyJump=done;
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
        ops.push({code:"AggReset",registers:temporary},{code:"Integer",p1:0n,p2:candidateGroup},{code:"Integer",p1:0n,p2:candidateInitialized});const rewind=ops.length;ops.push({code:"EphemeralRewind",p1:state.applicationCursor!,p2:0});const scan=ops.length;ops.push({code:"EphemeralData",p1:state.applicationCursor!,p2:state.regNew,count:state.inputRegisters.length});const firstCandidate=ops.length;ops.push({code:"IfNot",p1:candidateInitialized,p2:0});const sameCandidate=ops.length;ops.push({code:"CompareGroup",left:state.regNew+peerStart,right:candidatePeer,count:peerCount,keyInfo:state.peerKeyInfo!,jump:0},{code:"Binary",op:"+",p1:candidateGroup,p2:state.regOne,p3:candidateGroup,collation:"binary"});for(let i=0;i<peerCount;i++)ops.push({code:"Copy",p1:state.regNew+peerStart+i,p2:candidatePeer+i});const eligible=ops.length;(ops[sameCandidate] as {jump:number}).jump=eligible;const initialize=ops.length;(ops[firstCandidate] as {p2:number}).p2=initialize;for(let i=0;i<peerCount;i++)ops.push({code:"Copy",p1:state.regNew+peerStart+i,p2:candidatePeer+i});ops.push({code:"Integer",p1:1n,p2:candidateInitialized});const eligibleAfterInit=ops.length;ops.push({code:"IfRegisterGt",left:candidateGroup,right:outputGroup,jump:0},{code:"Binary",op:"-",p1:outputGroup,p2:candidateGroup,p3:distance,collation:"binary"});const tooFar=ops.length;ops.push({code:"IfRegisterGt",left:distance,right:state.boundRegisters.start!,jump:0},{code:"Eq",p1:candidateGroup,p2:outputGroup,p3:distance,affinity:"numeric",collation:"binary"});const notCurrent=ops.length;ops.push({code:"IfNot",p1:distance,p2:0},{code:"Goto",p2:0});const step=ops.length;(ops[notCurrent] as {p2:number}).p2=step;windowCodeOp({ops,layer,state,collationOf:column=>collation(expressionFromReduction(layer.bufferExpressions[column]!.reduction!))},"WINDOW_AGGSTEP",state.regNew,temporary);const nextCandidate=ops.length;(ops[eligibleAfterInit] as {jump:number}).jump=nextCandidate;(ops[tooFar] as {jump:number}).jump=nextCandidate;(ops[notCurrent+1] as {p2:number}).p2=nextCandidate;ops.push({code:"EphemeralNext",p1:state.applicationCursor!,p2:scan});const scanDone=ops.length;(ops[rewind] as {p2:number}).p2=scanDone;for(let i=0;i<layer.windows.length;i++)ops.push({code:"AggValue",name:layer.windows[i]!.window.functionName,p1:temporary[i]!,p2:layer.windows[i]!.regResult});
      }
      const outputUseCursor=ops.length;ops.push({code:"IfNot",p1:outputLookaheadFlag,p2:0});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:outputLookahead+i,p2:state.regNew+i});ops.push({code:"Integer",p1:0n,p2:outputLookaheadFlag},{code:"Goto",p2:0});const outputAdvance=ops.length;(ops[outputUseCursor] as {p2:number}).p2=outputAdvance;const outputFirst=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[2],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0});const outputHave=ops.length;(ops[outputAdvance-1] as {p2:number}).p2=outputHave;for(let i=0;i<peerCount;i++)ops.push({code:"Copy",p1:state.regNew+peerStart+i,p2:state.currentPeerRegisters[i]!});
      const emitRow=ops.length;ops.push({code:"Integer",p1:1n,p2:state.regOutputReady},{code:"Yield",p1:producerCoroutine,p2:0});const outputNext=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[2],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0},{code:"CompareGroup",left:state.regNew+peerStart,right:state.currentPeerRegisters[0]!,count:peerCount,keyInfo:state.peerKeyInfo!,jump:emitRow});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:state.regNew+i,p2:outputLookahead+i});ops.push({code:"Integer",p1:1n,p2:outputLookaheadFlag});
      const slide=ops.length;(ops[outputNext] as {emptyJump:number}).emptyJump=slide;if(excludeGroup)ops.push({code:"Binary",op:"+",p1:outputGroup,p2:state.regOne,p3:outputGroup,collation:"binary"});
      const delay=ops.length;ops.push({code:"IfPos",p1:startDelay,p2:0,p3:1},{code:"Gosub",p1:startReturn,p2:0});const afterInverse=ops.length;(ops[delay] as {p2:number}).p2=afterInverse;callEnd();ops.push({code:"Goto",p2:output});const done=ops.length;(ops[outputFirst] as {emptyJump:number}).emptyJump=done;const skipSubroutines=ops.length;ops.push({code:"Goto",p2:0});

      // End-cursor peer scanner. It may read one row beyond a peer boundary,
      // so the complete row is retained as resumable register state.
      const endScan=ops.length;for(const call of endCalls)(ops[call] as {p2:number}).p2=endScan;ops.push({code:"Integer",p1:0n,p2:endRows});const endUse=ops.length;ops.push({code:"IfNot",p1:endLookaheadFlag,p2:0});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:endLookahead+i,p2:state.regNew+i});ops.push({code:"Integer",p1:0n,p2:endLookaheadFlag},{code:"Goto",p2:0});const endAdvance=ops.length;(ops[endUse] as {p2:number}).p2=endAdvance;const endFirst=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[1],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0});const endHave=ops.length;(ops[endAdvance-1] as {p2:number}).p2=endHave;for(let i=0;i<peerCount;i++)ops.push({code:"Copy",p1:state.regNew+peerStart+i,p2:state.endPeerRegisters[i]!});const endStep=ops.length;for(const win of layer.windows){emitStep(win,state.regNew);}ops.push({code:"Binary",op:"+",p1:endRows,p2:state.regOne,p3:endRows,collation:"binary"});const endNext=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[1],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0},{code:"CompareGroup",left:state.regNew+peerStart,right:state.endPeerRegisters[0]!,count:peerCount,keyInfo:state.peerKeyInfo!,jump:endStep});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:state.regNew+i,p2:endLookahead+i});ops.push({code:"Integer",p1:1n,p2:endLookaheadFlag});const endRet=ops.length;ops.push({code:"Return",p1:endReturn});(ops[endFirst] as {emptyJump:number}).emptyJump=endRet;(ops[endNext] as {emptyJump:number}).emptyJump=endRet;

      // Start cursor removes exactly one complete peer group once the starting
      // distance has elapsed. This is windowCodeOp's GROUPS inverse phase.
      const startScan=ops.length;(ops[delay+1] as {p2:number}).p2=startScan;const startUse=ops.length;ops.push({code:"IfNot",p1:startLookaheadFlag,p2:0});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:startLookahead+i,p2:state.regNew+i});ops.push({code:"Integer",p1:0n,p2:startLookaheadFlag},{code:"Goto",p2:0});const startAdvance=ops.length;(ops[startUse] as {p2:number}).p2=startAdvance;const startFirst=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[0],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0});const startHave=ops.length;(ops[startAdvance-1] as {p2:number}).p2=startHave;for(let i=0;i<peerCount;i++)ops.push({code:"Copy",p1:state.regNew+peerStart+i,p2:state.startPeerRegisters[i]!});const inverse=ops.length;for(const win of layer.windows){emitStep(win,state.regNew,true);}const startNext=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[0],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0},{code:"CompareGroup",left:state.regNew+peerStart,right:state.startPeerRegisters[0]!,count:peerCount,keyInfo:state.peerKeyInfo!,jump:inverse});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:state.regNew+i,p2:startLookahead+i});ops.push({code:"Integer",p1:1n,p2:startLookaheadFlag});const startRet=ops.length;ops.push({code:"Return",p1:startReturn});(ops[startFirst] as {emptyJump:number}).emptyJump=startRet;(ops[startNext] as {emptyJump:number}).emptyJump=startRet;(ops[skipSubroutines] as {p2:number}).p2=ops.length;
    };
    // window.c windowAggStep/windowReturnOneRow: non-EXCLUDE regApp
    // endpoints belong to each function. Construction labels stay in the
    // enclosing builder; VM PC and duplicate cursor positions remain runtime state.
    const emitEndpointRowsDrain=():void=>{
      const state=followingState!,frame=layer.windows[0]!.window.frame;
      builder.registers=Math.max(builder.registers,registers);
      const current=builder.register(),threshold=builder.register(),target=builder.register();
      const saved=builder.range(state.inputRegisters.length),seekPayload=builder.range(state.inputRegisters.length);
      registers=builder.registers;
      const step=(inverse:boolean):void=>{
        for(const win of layer.windows){
          const app=state.valueApplications.find(app=>app.result===win.regResult);
          if(app){const register=inverse?app.start:app.end;ops.push({code:"Binary",op:"+",p1:register,p2:state.regOne,p3:register,collation:"binary"});}
          else emitStep(win,state.regNew,inverse);
        }
      };
      const done=builder.label(),output=builder.label();builder.mark(output);
      builder.jump(done,{code:"EphemeralAdvanceData",p1:layer.duplicateCursors[2],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0},(op,pc)=>({...op,emptyJump:pc}));
      for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:state.regNew+i,p2:saved+i});
      ops.push({code:"EphemeralRowid",p1:layer.duplicateCursors[2],p2:current});
      // windowCodeOp: admit end row once, then evict start row only after
      // the bounded frame grows past its offset. regApp counts admitted/evicted
      // rows, so start is exclusive and end inclusive (windowReturnOneRow).
      ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[1],p2:state.regNew,count:state.inputRegisters.length});step(false);
      if(frame.start.kind==='preceding')ops.push({code:"Binary",op:"+",p1:state.boundRegisters.start!,p2:state.regOne,p3:threshold,collation:"binary"});
      else ops.push({code:"Copy",p1:state.regOne,p2:threshold});
      const inverse=builder.label(),value=builder.label();
      builder.jump(inverse,{code:"IfRegisterGt",left:current,right:threshold,jump:0},(op,pc)=>({...op,jump:pc}));
      builder.jump(value,{code:"Goto",p2:0},(op,pc)=>({...op,p2:pc}));builder.mark(inverse);
      ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[0],p2:state.regNew,count:state.inputRegisters.length});step(true);
      builder.mark(value);
      for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:saved+i,p2:state.regNew+i});
      for(const win of layer.windows){
        const app=state.valueApplications.find(app=>app.result===win.regResult);
        if(!app){ops.push({code:"AggValue",name:win.window.functionName,p1:win.regAccum,p2:win.regResult});continue;}
        ops.push({code:"Null",p2:win.regResult});
        if(win.window.functionName==='nth_value')ops.push({code:"Copy",p1:state.regNew+win.argumentColumn+1,p2:target},{code:"WindowCheck",p1:target,boundary:"nth",numeric:false});
        else ops.push({code:"Integer",p1:1n,p2:target});
        ops.push({code:"Binary",op:"+",p1:target,p2:app.start,p3:target,collation:"binary"});
        const absent=builder.label();
        builder.jump(absent,{code:"IfRegisterGt",left:target,right:app.end,jump:0},(op,pc)=>({...op,jump:pc}));
        builder.jump(absent,{code:"EphemeralSeekRowid",p1:app.cursor,rowid:target,jump:0},(op,pc)=>({...op,jump:pc}));
        ops.push({code:"EphemeralData",p1:app.cursor,p2:seekPayload,count:state.inputRegisters.length},{code:"Copy",p1:seekPayload+win.argumentColumn,p2:win.regResult});builder.mark(absent);
      }
      ops.push({code:"Integer",p1:1n,p2:state.regOutputReady},{code:"Yield",p1:producerCoroutine,p2:0});
      builder.jump(output,{code:"Goto",p2:0},(op,pc)=>({...op,p2:pc}));builder.mark(done);
    };
    const emitScannedRowsDrain=():void=>{
      const state=followingState!,frame=layer.windows[0]!.window.frame;
      builder.registers=Math.max(builder.registers,registers);
      const current=builder.register(),start=builder.register(),end=builder.register(),candidate=builder.register(),same=builder.register();
      const saved=builder.range(state.inputRegisters.length),temporary=layer.windows.map(()=>builder.register());
      // Import all preceding manual drain allocations before sharing this range.
      registers=Math.max(registers,builder.registers);
      const output=ops.length;ops.push({code:'EphemeralAdvanceData',p1:layer.duplicateCursors[2],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0});
      for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:'Copy',p1:state.regNew+i,p2:saved+i});
      ops.push({code:'EphemeralRowid',p1:layer.duplicateCursors[2],p2:current},{code:'Copy',p1:current,p2:start},{code:'Copy',p1:current,p2:end});
      if(frame.start.kind==='preceding')ops.push({code:'Binary',op:'-',p1:current,p2:state.boundRegisters.start!,p3:start,collation:'binary'});
      if(frame.end.kind==='following')ops.push({code:'Binary',op:'+',p1:current,p2:state.boundRegisters.end!,p3:end,collation:'binary'});
      windowFullScan({ops,layer,state,collationOf:column=>collation(expressionFromReduction(layer.bufferExpressions[column]!.reduction!))},state.applicationCursor??layer.duplicateCursors[0],temporary,scan=>{
        const cursor=state.applicationCursor??layer.duplicateCursors[0];
        ops.push({code:'EphemeralData',p1:cursor,p2:state.regNew,count:state.inputRegisters.length},{code:'EphemeralRowid',p1:cursor,p2:candidate});
        const before=ops.length;ops.push({code:'IfRegisterGt',left:start,right:candidate,jump:0});
        const after=ops.length;ops.push({code:'IfRegisterGt',left:candidate,right:end,jump:0});
        let excluded:number|null=null;
        if(frame.exclusion==='current-row'){
          ops.push({code:'Eq',p1:candidate,p2:current,p3:same,affinity:'numeric',collation:'binary'});
          excluded=ops.length;ops.push({code:'IfNot',p1:same,p2:0},{code:'Goto',p2:0});
          (ops[excluded] as {p2:number}).p2=ops.length;
        }
        windowCodeOp({ops,layer,state,collationOf:column=>collation(expressionFromReduction(layer.bufferExpressions[column]!.reduction!))},'WINDOW_AGGSTEP',state.regNew,temporary);
        const next=ops.length;(ops[before] as {jump:number}).jump=next;(ops[after] as {jump:number}).jump=next;
        if(excluded!==null)(ops[excluded+1] as {p2:number}).p2=next;
        ops.push({code:'EphemeralNext',p1:cursor,p2:scan});
      });
      for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:'Copy',p1:saved+i,p2:state.regNew+i});
      ops.push({code:'Integer',p1:1n,p2:state.regOutputReady},{code:'Yield',p1:producerCoroutine,p2:0},{code:'Goto',p2:output});
      (ops[output] as {emptyJump:number}).emptyJump=ops.length;
    };
    const emitDirectOffsetDrain=():void=>{
      const state=followingState!;
      // window.c:windowCacheFrame/windowReturnOneRow: cache the complete
      // partition, then derive the target rowid from the current buffered row.
      const output=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[2],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0});
      for(const win of layer.windows){
        if(win.window.functionName!=="lead"&&win.window.functionName!=="lag"){
          emitStep(win,state.regNew);ops.push({code:"AggValue",name:win.window.functionName,p1:win.regAccum,p2:win.regResult});
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
      const fill=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[1],p2:followingState!.regNew,count:followingState!.inputRegisters.length,emptyJump:0});for(const win of layer.windows){emitStep(win,followingState!.regNew);}ops.push({code:"Goto",p2:fill});const output=ops.length;(ops[fill] as {emptyJump:number}).emptyJump=output;for(const win of layer.windows)ops.push({code:"AggValue",name:win.window.functionName,p1:win.regAccum,p2:win.regResult});
      // The accumulator is complete and unchanged while this partition drains.
      // Match windowReturnOneRow's peer snapshot: value callbacks run once and
      // regResult is reused for every row. This matters for rankValueFunc, which
      // clears its pending peer value after publishing it.
      const loop=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[2],p2:followingState!.regNew,count:followingState!.inputRegisters.length,emptyJump:0},{code:"Integer",p1:1n,p2:followingState!.regOutputReady},{code:"Yield",p1:producerCoroutine,p2:0},{code:"Goto",p2:loop});const complete=ops.length;(ops[loop] as {emptyJump:number}).emptyJump=complete;
    };
    const emitWholePartitionExcludeGroupDrain=():void=>{
      const state=followingState!,peerCount=state.endPeerRegisters.length,peerStart=layer.windows[0]!.argumentColumn-peerCount;
      builder.registers=Math.max(builder.registers,registers);const outputSave=state.inputRegisters.length?builder.range(state.inputRegisters.length):builder.registers+1;registers=builder.registers;const temporary=layer.windows.map(()=>++registers);
      // windowCodeOp's EXCLUDE path scans the cached frame with the application
      // cursor for each output row. EXCLUDE GROUP omits all ORDER BY peers.
      const output=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[2],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:state.regNew+i,p2:outputSave+i});ops.push({code:"AggReset",registers:temporary});
      const rewind=ops.length;ops.push({code:"EphemeralRewind",p1:state.applicationCursor!,p2:0});const scan=ops.length;ops.push({code:"EphemeralData",p1:state.applicationCursor!,p2:state.regNew,count:state.inputRegisters.length});const compare=ops.length;ops.push({code:"CompareGroup",left:state.regNew+peerStart,right:outputSave+peerStart,count:peerCount,keyInfo:state.peerKeyInfo!,jump:0},{code:"Goto",p2:0});const step=ops.length;windowCodeOp({ops,layer,state,collationOf:column=>collation(expressionFromReduction(layer.bufferExpressions[column]!.reduction!))},"WINDOW_AGGSTEP",state.regNew,temporary);const next=ops.length;(ops[compare] as {jump:number}).jump=next;(ops[compare+1] as {p2:number}).p2=step;ops.push({code:"EphemeralNext",p1:state.applicationCursor!,p2:scan});const snapshot=ops.length;(ops[rewind] as {p2:number}).p2=snapshot;for(let i=0;i<layer.windows.length;i++)ops.push({code:"AggValue",name:layer.windows[i]!.window.functionName,p1:temporary[i]!,p2:layer.windows[i]!.regResult});for(let i=0;i<state.inputRegisters.length;i++)ops.push({code:"Copy",p1:outputSave+i,p2:state.regNew+i});ops.push({code:"Integer",p1:1n,p2:state.regOutputReady},{code:"Yield",p1:producerCoroutine,p2:0},{code:"Goto",p2:output});const done=ops.length;(ops[output] as {emptyJump:number}).emptyJump=done;
    };
    const emitNoOrderFollowingGroupsDrain=():void=>{
      // With no ORDER BY all rows are one peer group. windowCodeOp advances
      // both the end and start boundaries across that group before WINDOW_RETURN_ROW.
      const fill=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[1],p2:followingState!.regNew,count:followingState!.inputRegisters.length,emptyJump:0});for(const win of layer.windows){emitStep(win,followingState!.regNew);emitStep(win,followingState!.regNew,true);}ops.push({code:"Goto",p2:fill});const output=ops.length;(ops[fill] as {emptyJump:number}).emptyJump=output;
      const outputLoop=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[2],p2:followingState!.regNew,count:followingState!.inputRegisters.length,emptyJump:0});for(const win of layer.windows)ops.push({code:"AggValue",name:win.window.functionName,p1:win.regAccum,p2:win.regResult});ops.push({code:"Integer",p1:1n,p2:followingState!.regOutputReady},{code:"Yield",p1:producerCoroutine,p2:0},{code:"Goto",p2:outputLoop});const complete=ops.length;(ops[outputLoop] as {emptyJump:number}).emptyJump=complete;
    };
    const emitFollowingUnboundedDrain=():void=>{
      const fill=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[1],p2:followingState!.regNew,count:followingState!.inputRegisters.length,emptyJump:0});for(const win of layer.windows){emitStep(win,followingState!.regNew);}ops.push({code:"Goto",p2:fill});const filled=ops.length;(ops[fill] as {emptyJump:number}).emptyJump=filled;
      ops.push({code:"Copy",p1:followingState!.boundRegisters.start!,p2:rangeStartCount!});const initial=ops.length;ops.push({code:"IfPos",p1:rangeStartCount!,p2:0,p3:1},{code:"Goto",p2:0});const inverse=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[0],p2:followingState!.regNew,count:followingState!.inputRegisters.length,emptyJump:0});for(const win of layer.windows){emitStep(win,followingState!.regNew,true);}ops.push({code:"Goto",p2:initial});const output=ops.length;(ops[initial] as {p2:number}).p2=inverse;(ops[initial+1] as {p2:number}).p2=output;(ops[inverse] as {emptyJump:number}).emptyJump=output;
      const loop=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[2],p2:followingState!.regNew,count:followingState!.inputRegisters.length,emptyJump:0});for(const win of layer.windows)ops.push({code:"AggValue",name:win.window.functionName,p1:win.regAccum,p2:win.regResult});ops.push({code:"Integer",p1:1n,p2:followingState!.regOutputReady},{code:"Yield",p1:producerCoroutine,p2:0});const slide=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[0],p2:followingState!.regNew,count:followingState!.inputRegisters.length,emptyJump:0});for(const win of layer.windows){emitStep(win,followingState!.regNew,true);}const afterSlide=ops.length;(ops[slide] as {emptyJump:number}).emptyJump=afterSlide;ops.push({code:"Goto",p2:loop});const complete=ops.length;(ops[loop] as {emptyJump:number}).emptyJump=complete;
    };
    const emitCurrentUnboundedDrain=():void=>{
      const state=followingState!;
      const fill=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[1],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0});for(const win of layer.windows){emitStep(win,state.regNew);}ops.push({code:"Goto",p2:fill});const filled=ops.length;(ops[fill] as {emptyJump:number}).emptyJump=filled;
      const output=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[2],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0});for(const win of layer.windows)ops.push({code:"AggValue",name:win.window.functionName,p1:win.regAccum,p2:win.regResult});ops.push({code:"Integer",p1:1n,p2:state.regOutputReady},{code:"Yield",p1:producerCoroutine,p2:0});
      const inverse=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[0],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0});for(const win of layer.windows){emitStep(win,state.regNew,true);}ops.push({code:"Goto",p2:output});const complete=ops.length;(ops[output] as {emptyJump:number}).emptyJump=complete;(ops[inverse] as {emptyJump:number}).emptyJump=complete;
    };
    const emitPrecedingUnboundedDrain=():void=>{
      const state=followingState!;
      const fill=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[1],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0});for(const win of layer.windows){emitStep(win,state.regNew);}ops.push({code:"Goto",p2:fill});const filled=ops.length;(ops[fill] as {emptyJump:number}).emptyJump=filled;
      ops.push({code:"Copy",p1:state.boundRegisters.start!,p2:rangeStartCount!});
      const output=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[2],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0});for(const win of layer.windows)ops.push({code:"AggValue",name:win.window.functionName,p1:win.regAccum,p2:win.regResult});ops.push({code:"Integer",p1:1n,p2:state.regOutputReady},{code:"Yield",p1:producerCoroutine,p2:0});
      const delay=ops.length;ops.push({code:"IfPos",p1:rangeStartCount!,p2:output,p3:1});const inverse=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[0],p2:state.regNew,count:state.inputRegisters.length,emptyJump:0});for(const win of layer.windows){emitStep(win,state.regNew,true);}ops.push({code:"Goto",p2:output});const complete=ops.length;(ops[output] as {emptyJump:number}).emptyJump=complete;(ops[inverse] as {emptyJump:number}).emptyJump=complete;
    };
    const emitFollowingRangeDrain=():void=>{
      const reversed=ops.length;ops.push({code:"IfRegisterGt",left:rangeState!.boundRegisters.start!,right:rangeState!.boundRegisters.end!,jump:0});
      ops.push({code:"Copy",p1:rangeState!.boundRegisters.end!,p2:rangeEndCount!},{code:"Binary",op:"+",p1:rangeEndCount!,p2:rangeState!.regOne,p3:rangeEndCount!,collation:"binary"});
      const endLoop=ops.length,endBody=endLoop+2;ops.push({code:"IfPos",p1:rangeEndCount!,p2:endBody,p3:1},{code:"Goto",p2:0});
      const endAdvance=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[1],p2:rangeState!.regNew,count:rangeState!.inputRegisters.length,emptyJump:0});
      for(const win of layer.windows){emitStep(win,rangeState!.regNew);}
      ops.push({code:"Goto",p2:endLoop});const endDone=ops.length;(ops[endLoop+1] as {p2:number}).p2=endDone;(ops[endAdvance] as {emptyJump:number}).emptyJump=endDone;
      ops.push({code:"Copy",p1:rangeState!.boundRegisters.start!,p2:rangeStartCount!});
      const startLoop=ops.length,startBody=startLoop+2;ops.push({code:"IfPos",p1:rangeStartCount!,p2:startBody,p3:1},{code:"Goto",p2:0});
      const startAdvance=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[0],p2:rangeState!.regNew,count:rangeState!.inputRegisters.length,emptyJump:0});
      for(const win of layer.windows){emitStep(win,rangeState!.regNew,true);}
      ops.push({code:"Goto",p2:startLoop});const startDone=ops.length;(ops[startLoop+1] as {p2:number}).p2=startDone;(ops[startAdvance] as {emptyJump:number}).emptyJump=startDone;
      const output=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[2],p2:rangeState!.regNew,count:rangeState!.inputRegisters.length,emptyJump:0});
      const snapshot=ops.length;for(const win of layer.windows)ops.push({code:"AggValue",name:win.window.functionName,p1:win.regAccum,p2:win.regResult});
      ops.push({code:"Integer",p1:1n,p2:rangeState!.regOutputReady},{code:"Yield",p1:producerCoroutine,p2:0});
      const slideEnd=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[1],p2:rangeState!.regNew,count:rangeState!.inputRegisters.length,emptyJump:0});
      for(const win of layer.windows){emitStep(win,rangeState!.regNew);}
      const afterEnd=ops.length;(ops[slideEnd] as {emptyJump:number}).emptyJump=afterEnd;
      const slideStart=ops.length;ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[0],p2:rangeState!.regNew,count:rangeState!.inputRegisters.length,emptyJump:0});
      for(const win of layer.windows){emitStep(win,rangeState!.regNew,true);}
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
      for(const win of layer.windows){emitStep(win,followingState.regNew,true);}
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
      if(scannedRows&&followingState){if(layer.windows[0]!.window.frame.exclusion===null)emitEndpointRowsDrain();else emitScannedRowsDrain();}
      if(!scannedRows&&directOffset&&followingState)emitDirectOffsetDrain();
      if(wholePartitionExcludeGroup&&followingState)emitWholePartitionExcludeGroupDrain();
      if((wholePartition||singlePeerGroups)&&followingState)emitWholePartitionDrain();
      if(followingUnbounded&&followingState)emitFollowingUnboundedDrain();
      if(currentUnbounded&&followingState)emitCurrentUnboundedDrain();
      if(precedingUnbounded&&followingState)emitPrecedingUnboundedDrain();
      if(!scannedRows&&precedingFollowing&&followingState)emitPrecedingFollowingDrain();
      if(precedingRange&&followingState)emitPrecedingRangeDrain();
      if(followingRange&&followingState&&rangeEndCount!==null&&rangeStartCount!==null)emitFollowingRangeDrain();
    });
    if(following&&followingState){
      const trailing=ops.length;
      for(const win of layer.windows)ops.push({code:"AggValue",name:win.window.functionName,p1:win.regAccum,p2:win.regResult});
      ops.push({code:"EphemeralAdvanceData",p1:layer.duplicateCursors[0],p2:followingState.regNew,count:followingState.inputRegisters.length});
      for(const win of layer.windows){
        emitStep(win,followingState.regNew,true);
      }
      ops.push({code:"Integer",p1:1n,p2:followingState.regOutputReady},{code:"Yield",p1:producerCoroutine,p2:0},{code:"IfEphemeralHasNext",p1:layer.duplicateCursors[0],jump:trailing});
    }
    ops.push({code:"EndCoroutine",p1:producerCoroutine,p2:0});const continuation=ops.length;(ops[init] as {p2:number}).p2=continuation;
    bindingsPending.push({layer,producerCoroutine,childCoroutine,loopBody,gosub,sorterCursor,payload,ownedClauses:index===0?rewrite.movedClauses:Object.freeze([])});
    childCoroutine=producerCoroutine;childStart=producerStart;
  }
  // The outer SELECT drives only the root rewritten producer. Live window
  // results use regResult; surviving ordinary expressions consume the lifted
  // terminal payload through the resolver-linked expression owner below.
  // sqlite3WindowRewrite makes the outermost rewritten SELECT the publication
  // owner. Results produced by an inner incompatible layer are ordinary lifted
  // payload columns by the time they reach this boundary; only windows owned by
  // the root layer remain live regResult values. This avoids any rendezvous by
  // source rowid and preserves duplicate/reordered rows through the coroutine.
  const outputLayer=rewrite.layers.at(-1);
  // window.c selectWindowRewriteExprCb rewrites terminals, not the whole
  // outer expression. Compile the surviving expression against the finalized
  // producer payload; never reread a grouped source cursor here.
  const outputBinding:ResolvedExpressionBinding={policy:'window-source',aggregateOutput:reduction=>{
    const lifted=outputLayer?.lifted.find(item=>item.expression.reduction===reduction);
    return lifted?setup.at(-1)!.regNew+lifted.bufferColumn:undefined;
  },location:ref=>{
    const column=outputLayer?.bufferBindings.findIndex(candidate=>candidate?.source===ref.source&&candidate.columnIndex===ref.columnIndex)??-1;
    if(column<0)throw new JSQLiteError('unsupported','window output column is not represented',{unsupportedClassification:'temporary'});
    return {kind:'register',register:setup.at(-1)!.regNew+column,phase:'producer-row'};
  }};
  const outputSubquery=database?resolvedScalarSubqueryEmitter(resolved,builder,parameters,{database,maxRows:Number.MAX_SAFE_INTEGER,maxWorkUnits,maxResultBytes,privateStateLimits},outputBinding):undefined;
  const compileOutputExpression=(expression:Expression):number=>{builder.registers=Math.max(builder.registers,registers);const result=compileExpressionTree(expression,ops,()=>builder.register(),parameters,outputSubquery);registers=builder.registers;return result;};
  const outputEntry=(expression:ExprNode)=>{
    const win=outputLayer?.windows.find(item=>item.window.owner===expression);
    if(win)return Object.freeze({kind:'window' as const,win});
    const lifted=outputLayer?.lifted.find(item=>item.expression.reduction===expression.reduction);
    if(lifted)return Object.freeze({kind:'column' as const,bufferColumn:lifted.bufferColumn});
    if(!expression.reduction)return null;
    try{return Object.freeze({kind:'expression' as const,expression:bindResolvedExpression(expressionFromReduction(expression.reduction),resolvedExpressionCarrier(resolved,expression.reduction as Reduction),source=>source.cursorId,true,outputBinding)});}
    catch(error){if(error instanceof JSQLiteError&&error.kind==='unsupported')return null;throw error;}
  };
  const outputEntries=outputLayer?resolved.result.map(result=>outputEntry(result.expression)):[];
  const outerOrderEntries=outputLayer?rewrite.outer.orderBy.map(term=>{
    const resultIndex=resolved.orderResultColumns[resolved.source.orderBy.indexOf(term)];
    const entry=resultIndex!==null&&resultIndex!==undefined?outputEntries[resultIndex]:outputEntry(term.expr);
    return entry?Object.freeze({...entry,term}):null;
  }):[];
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
  const executableOutput=(win:NonNullable<typeof outputWindows[number]>):boolean=>directOffsetOutput(win)||compileLayers.some(layer=>layer.windows.includes(win)&&scannedRowsLayer(layer))||(!!aggregateDefinition(win.window.functionName)&&((win.window.frame.type==="rows"&&win.window.frame.start.kind==="unbounded"&&win.window.frame.end.kind==="current"&&(win.window.frame.exclusion===null||win.window.frame.exclusion==="no-others"))||cumulativeExcludeCurrent(win)||boundedExcludeCurrent(win)||boundedPeerExclusion(win)||runtimeBoundedRows(win)||precedingPreceding(win)||precedingFollowingOutput(win)||followingUnboundedOutput(win)||currentUnboundedOutput(win)||precedingUnboundedOutput(win)||wholePartitionOutput(win)||wholePartitionExcludeGroupOutput(win)||singlePeerGroupsOutput(win)||orderedCurrentGroupsOutput(win)||rangeCurrentPeerExclusionOutput(win)||rangeOffsetExcludeCurrentOutput(win)||groupsCumulativeExcludeCurrentOutput(win)||groupsOnePrecedingExcludeGroupOutput(win)||orderedCumulativePeerGroupsOutput(win)||orderedCumulativePriorGroupsOutput(win)||cumulativePeerExclusion(win)||orderedSuffixGroupsOutput(win)||orderedFollowingGroupsOutput(win)||noOrderFollowingGroupsOutput(win)||orderedRangePrecedingCurrentOutput(win)||orderedAdjacentGroupsOutput(win)||currentFollowing(win)||followingFollowing(win)||reversedFollowing(win)));
  const outerOrderRepresented=outerOrderEntries.length===rewrite.outer.orderBy.length&&outerOrderEntries.every(entry=>entry!==null);
  const emitsRows=outputEntries.length===resolved.result.length&&outputEntries.length>0&&outerOrderRepresented&&outputEntries.every(entry=>entry!==null&&(entry.kind!=="window"||executableOutput(entry.win)));
  builder.registers=Math.max(builder.registers,registers);
  const outputStart=emitsRows?builder.range(outputEntries.length):0;
  // Import the live application/rewrite sorter frontier before allocating the
  // enclosing ORDER BY cursor (select.c: sSort.iECursor = pParse->nTab++).
  if(emitsRows&&outerOrderEntries.length)builder.reserveCursorsThrough(Math.max(nextApplicationCursor,...sorterCursors));
  const outerSorter=emitsRows&&outerOrderEntries.length?builder.cursor():null;
  nextApplicationCursor=Math.max(nextApplicationCursor,builder.cursors);
  const outerLimit=emitsRows&&(rewrite.outer.limit!==null||rewrite.outer.offset!==null)?computeLimitRegisters(resolved.source,ops,()=>builder.register(),parameters):undefined;
  // Publish projection and consumer-limit allocations to remaining manual code.
  registers=builder.registers;
  if(outerSorter!==null)ops.push({code:"SorterOpen",p1:outerSorter,keyInfo:new KeyInfo({encoding,totalFieldCount:outerOrderEntries.length+outputEntries.length,keyFieldCount:outerOrderEntries.length,terms:outerOrderEntries.map(entry=>({collation:collation(expressionFromReduction(entry!.term.expr.reduction!)),desc:entry!.term.descending,nullsLarge:entry!.term.nulls==="last"?!entry!.term.descending:entry!.term.nulls==="first"?entry!.term.descending:false}))})});
  // select.c's inner-loop output destination owns OFFSET before ResultRow and
  // LIMIT after it. Keep this in the VDBE stream for both direct and sorted
  // window output; Statement never slices host rows.
  const emitOuterResult=():Readonly<{offsetSkip:number|null;limitDone:number|null}>=>{let offsetSkip:number|null=null;if(outerLimit?.offset!==undefined){offsetSkip=ops.length;ops.push({code:"IfPos",p1:outerLimit.offset,p2:0,p3:1});}emitSelectDestination(ops,owner?.destination??{kind:'output'},outputStart,outputEntries.length);let limitDone:number|null=null;if(outerLimit){limitDone=ops.length;ops.push({code:"DecrJumpZero",p1:outerLimit.count,p2:0});}return{offsetSkip,limitDone};};
  const rootInit=ops.length;ops.push({code:"InitCoroutine",p1:childCoroutine,p2:0,p3:childStart});const rootLoop=ops.length;ops.push({code:"Yield",p1:childCoroutine,p2:0});
  if(emitsRows){const rootState=setup.at(-1),needsReady=scannedRowsLayer(compileLayers.at(-1)!)||outputWindows.some(win=>win!==null&&(directOffsetOutput(win)||currentFollowing(win)||followingFollowing(win)||precedingPreceding(win)||precedingFollowingOutput(win)||followingUnboundedOutput(win)||currentUnboundedOutput(win)||precedingUnboundedOutput(win)||wholePartitionOutput(win)||wholePartitionExcludeGroupOutput(win)||singlePeerGroupsOutput(win)||orderedCurrentGroupsOutput(win)||rangeCurrentPeerExclusionOutput(win)||rangeOffsetExcludeCurrentOutput(win)||groupsCumulativeExcludeCurrentOutput(win)||groupsOnePrecedingExcludeGroupOutput(win)||orderedCumulativePeerGroupsOutput(win)||orderedCumulativePriorGroupsOutput(win)||cumulativePeerExclusion(win)||orderedSuffixGroupsOutput(win)||orderedFollowingGroupsOutput(win)||noOrderFollowingGroupsOutput(win)||orderedRangePrecedingCurrentOutput(win)||orderedAdjacentGroupsOutput(win)));let skip:number|undefined;if(needsReady&&rootState){skip=ops.length;ops.push({code:"IfNot",p1:rootState.regOutputReady,p2:0});}for(let index=0;index<outputEntries.length;index++){const entry=outputEntries[index]!;ops.push({code:"Copy",p1:entry.kind==="window"?entry.win.regResult:entry.kind==="column"?setup.at(-1)!.regNew+entry.bufferColumn:compileOutputExpression(entry.expression),p2:outputStart+index});}if(outerSorter!==null){builder.registers=Math.max(builder.registers,registers);const keyStart=builder.range(outerOrderEntries.length);registers=builder.registers;for(let index=0;index<outerOrderEntries.length;index++){const entry=outerOrderEntries[index]!;ops.push({code:"Copy",p1:entry.kind==="window"?entry.win.regResult:entry.kind==="column"?setup.at(-1)!.regNew+entry.bufferColumn:compileOutputExpression(entry.expression),p2:keyStart+index});}ops.push({code:"SorterInsert",p1:outerSorter,keyStart,keyCount:outerOrderEntries.length,payload:outputStart,payloadCount:outputEntries.length});}else{const {offsetSkip}=emitOuterResult();if(offsetSkip!==null)(ops[offsetSkip] as {p2:number}).p2=ops.length;}if(skip!==undefined)(ops[skip] as {p2:number}).p2=ops.length;}
  ops.push({code:"Goto",p2:rootLoop});const outerDrain=ops.length;(ops[rootLoop] as {p2:number}).p2=outerDrain;if(outerSorter===null&&outerLimit){(ops[outerLimit.ifZero] as {p2:number}).p2=outerDrain;for(const op of ops)if(op.code==="DecrJumpZero"&&op.p1===outerLimit.count&&op.p2===0)(op as {p2:number}).p2=outerDrain;}if(outerSorter!==null){const sort=ops.length;ops.push({code:"SorterSort",p1:outerSorter,emptyJump:0},{code:"SorterData",p1:outerSorter,p2:outputStart,count:outputEntries.length});const {offsetSkip,limitDone}=emitOuterResult();const next=ops.length;if(offsetSkip!==null)(ops[offsetSkip] as {p2:number}).p2=next;ops.push({code:"SorterNext",p1:outerSorter,p2:sort+1});const done=ops.length;(ops[sort] as {emptyJump:number}).emptyJump=done;if(limitDone!==null)(ops[limitDone] as {p2:number}).p2=done;if(outerLimit)(ops[outerLimit.ifZero] as {p2:number}).p2=done;}const ownerExit=ops.length;ops.push(owner?{code:"Goto",p2:0}:{code:"Halt"});
  if(owner){owner.builder.registers=Math.max(owner.builder.registers,registers);owner.builder.reserveCursorsThrough(Math.max(outerSorter??0,...sorterCursors,nextApplicationCursor));}
  const loopBindings:WindowLoopBinding[]=[];
  for(const pending of bindingsPending){
    const target=ops.length;(ops[pending.gosub] as {p2:number}).p2=target;
    const state=setup.find(item=>item.compatibleGroup===pending.layer.compatibleGroup);if(!state)throw new JSQLiteError("internal","window setup layer is missing");
    for(let column=0;column<state.inputRegisters.length;column++)ops.push({code:"Copy",p1:pending.payload+column,p2:state.regNew+column});
    const streaming=!scannedRowsLayer(pending.layer)&&pending.layer.windows.every(win=>{const frame=win.window.frame;return !!aggregateDefinition(win.window.functionName)&&frame.type==="rows"&&(((frame.exclusion===null||frame.exclusion==="no-others")&&(frame.end.kind==="current"&&(frame.start.kind==="unbounded"||frame.start.kind==="current"||(frame.start.kind==="preceding"&&!!frame.start.expr?.reduction))))||(frame.exclusion==="current-row"&&frame.end.kind==="current"&&(frame.start.kind==="unbounded"||(frame.start.kind==="preceding"&&!!frame.start.expr?.reduction)))||((frame.exclusion==="no-others"||((frame.exclusion==="group"||frame.exclusion==="ties")&&win.window.orderBy.length>0))&&frame.start.kind==="preceding"&&!!frame.start.expr?.reduction&&frame.end.kind==="current"));});
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
      windowCodeOp({ops,layer:pending.layer,state,collationOf:column=>collation(expressionFromReduction(pending.layer.bufferExpressions[column]!.reduction!))},"WINDOW_AGGINVERSE");
      const snapshot=ops.length;(ops[trim] as {jump:number}).jump=inverse;(ops[snapshotJump] as {p2:number}).p2=snapshot;for(const win of pending.layer.windows)ops.push({code:"AggValue",name:win.window.functionName,p1:win.regAccum,p2:win.regResult});
      // Inverse loading overwrote regNew. Restore the authoritative producer
      // payload before stepping current; the sorter payload remains retained in
      // pending.payload across this Gosub and no host row object is introduced.
      for(let column=0;column<state.inputRegisters.length;column++)ops.push({code:"Copy",p1:pending.payload+column,p2:state.regNew+column});
      for(const win of pending.layer.windows){const args=Array.from({length:win.window.argumentCount},(_,index)=>state.regNew+win.argumentColumn+index);let skip:number|null=null;if(win.filterColumn!==null){skip=ops.length;ops.push({code:"IfNot",p1:state.regNew+win.filterColumn,p2:0});}const at=ops.length;ops.push({code:"AggStep",name:win.window.functionName,args,p2:win.regAccum,collation:args.length?collation(expressionFromReduction(pending.layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary"});if(skip!==null)(ops[skip] as {p2:number}).p2=at+1;}
    }
    if(sharedBoundedPeerExclusion){
      builder.registers=Math.max(builder.registers,registers);
      const frame=pending.layer.windows[0]!.window.frame,offset=windowConstantInteger(expressionFromReduction(frame.start.expr!.reduction!));
      const endRowid=builder.register(),startRowid=builder.register(),candidateRowid=builder.register();
      const temporary=pending.layer.windows.map(()=>builder.register());
      const loop=builder.label(),next=builder.label(),finish=builder.label(),step=builder.label(),identity=builder.label();
      ops.push({code:"AggReset",registers:temporary},{code:"Copy",p1:state.regRowid,p2:endRowid});
      if(offset!==null){const width=builder.register();ops.push({code:"Integer",p1:BigInt(offset),p2:width},{code:"Subtract",p1:endRowid,p2:width,p3:startRowid});}else ops.push({code:"Subtract",p1:endRowid,p2:state.boundRegisters.start!,p3:startRowid});
      builder.jump(finish,{code:"EphemeralRewind",p1:state.applicationCursor!,p2:0},(op,pc)=>({...op,jump:pc} as Op));
      builder.mark(loop);ops.push({code:"EphemeralRowid",p1:state.applicationCursor!,p2:candidateRowid});
      builder.jump(next,{code:"IfRegisterGt",left:startRowid,right:candidateRowid,jump:0},(op,pc)=>({...op,jump:pc} as Op));
      builder.jump(finish,{code:"IfRegisterGt",left:candidateRowid,right:endRowid,jump:0},(op,pc)=>({...op,jump:pc} as Op));
      ops.push({code:"EphemeralData",p1:state.applicationCursor!,p2:state.regNew,count:state.inputRegisters.length});
      const exclusion=frame.exclusion,orderCount=pending.layer.windows[0]!.window.orderBy.length,orderStart=pending.layer.windows[0]!.argumentColumn-orderCount;
      if(exclusion!=="no-others")builder.jump(exclusion==="ties"?identity:next,{code:"CompareGroup",left:state.regNew+orderStart,right:pending.payload+orderStart,count:orderCount,keyInfo:state.peerKeyInfo!,jump:0},(op,pc)=>({...op,jump:pc} as Op));
      if(exclusion==="ties"){
        builder.jump(step,{code:"Goto",p2:0},(op,pc)=>({...op,p2:pc} as Op));builder.mark(identity);
        const same=builder.register();ops.push({code:"Eq",p1:candidateRowid,p2:endRowid,p3:same,affinity:"numeric",collation:"binary"});
        builder.jump(next,{code:"IfNot",p1:same,p2:0},(op,pc)=>({...op,p2:pc} as Op));
        builder.jump(step,{code:"Goto",p2:0},(op,pc)=>({...op,p2:pc} as Op));
      }
      builder.mark(step);
      for(let i=0;i<pending.layer.windows.length;i++){
        const win=pending.layer.windows[i]!,args=Array.from({length:win.window.argumentCount},(_,index)=>state.regNew+win.argumentColumn+index),after=builder.label();
        if(win.filterColumn!==null)builder.jump(after,{code:"IfNot",p1:state.regNew+win.filterColumn,p2:0},(op,pc)=>({...op,p2:pc} as Op));
        ops.push({code:"AggStep",name:win.window.functionName,args,p2:temporary[i]!,collation:args.length?collation(expressionFromReduction(pending.layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary"});builder.mark(after);
      }
      builder.mark(next);builder.jump(loop,{code:"EphemeralNext",p1:state.applicationCursor!,p2:0},(op,pc)=>({...op,p2:pc} as Op));builder.mark(finish);
      for(let i=0;i<pending.layer.windows.length;i++)ops.push({code:"AggValue",name:pending.layer.windows[i]!.window.functionName,p1:temporary[i]!,p2:pending.layer.windows[i]!.regResult});
      for(let column=0;column<state.inputRegisters.length;column++)ops.push({code:"Copy",p1:pending.payload+column,p2:state.regNew+column});
      registers=builder.registers;
    }
    const sharedSliding=!scannedRowsLayer(pending.layer)&&pending.layer.windows.length>0&&pending.layer.windows.every(win=>{const frame=win.window.frame;return frame.type==="rows"&&frame.end.kind==="current"&&(frame.exclusion===null||frame.exclusion==="no-others")&&(frame.start.kind==="current"||(frame.start.kind==="preceding"&&!!frame.start.expr?.reduction));});
    if(sharedSliding){
      for(const win of pending.layer.windows){const args=Array.from({length:win.window.argumentCount},(_,index)=>state.regNew+win.argumentColumn+index);const afterStep=builder.label();if(win.filterColumn!==null)builder.jump(afterStep,{code:"IfNot",p1:state.regNew+win.filterColumn,p2:0},(op,pc)=>({...op,p2:pc} as Op));ops.push({code:"AggStep",name:win.window.functionName,args,p2:win.regAccum,collation:args.length?collation(expressionFromReduction(pending.layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary"});builder.mark(afterStep);}
      const frame=pending.layer.windows[0]!.window.frame,bounded=frame.start.expr?.reduction?windowConstantInteger(expressionFromReduction(frame.start.expr.reduction)):null;
      const inverse=builder.label(),done=builder.label();builder.jump(inverse,{code:"IfCursorSizeGt",p1:pending.layer.iEphCsr,...(frame.start.kind==="current"?{threshold:1}:bounded!==null?{threshold:bounded+1}:{thresholdRegister:state.boundRegisters.start!}),jump:0},(op,pc)=>({...op,jump:pc} as Op));builder.jump(done,{code:"Goto",p2:0},(op,pc)=>({...op,p2:pc} as Op));builder.mark(inverse);ops.push({code:"EphemeralAdvanceData",p1:pending.layer.duplicateCursors[0],p2:state.regNew,count:state.inputRegisters.length});windowCodeOp({ops,layer:pending.layer,state,collationOf:column=>collation(expressionFromReduction(pending.layer.bufferExpressions[column]!.reduction!))},"WINDOW_AGGINVERSE");builder.mark(done);
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
        const afterStep=builder.label();if(win.filterColumn!==null)builder.jump(afterStep,{code:"IfNot",p1:state.regNew+win.filterColumn,p2:0},(op,pc)=>({...op,p2:pc} as Op));
        ops.push({code:"AggStep",name:win.window.functionName,args,p2:win.regAccum,collation:args.length?collation(expressionFromReduction(pending.layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary"});builder.mark(afterStep);
      }
      const snapshot=builder.label(),done=builder.label();
      builder.jump(snapshot,{code:"IfCursorSizeGt",p1:pending.layer.iEphCsr,thresholdRegister:state.boundRegisters.end!,registerAdjustment:0,jump:0},(op,pc)=>({...op,jump:pc} as Op));
      builder.jump(done,{code:"Goto",p2:0},(op,pc)=>({...op,p2:pc} as Op));builder.mark(snapshot);
      for(const win of pending.layer.windows)ops.push({code:"AggValue",name:win.window.functionName,p1:win.regAccum,p2:win.regResult});
      ops.push({code:"Integer",p1:1n,p2:state.regOutputReady},{code:"EphemeralAdvanceData",p1:pending.layer.duplicateCursors[0],p2:state.regNew,count:state.inputRegisters.length});
      windowCodeOp({ops,layer:pending.layer,state,collationOf:column=>collation(expressionFromReduction(pending.layer.bufferExpressions[column]!.reduction!))},"WINDOW_AGGINVERSE");
      builder.mark(done);
    }
    const cachedDirectOffset=cachedDirectOffsetLayer(pending.layer);
    for(const win of pending.layer.windows){
      const frame=win.window.frame,definition=aggregateDefinition(win.window.functionName);
      if(cachedDirectOffset||scannedRowsLayer(pending.layer))continue;
      const bounded=frame.start.kind==="preceding"&&frame.start.expr?.reduction?windowConstantInteger(expressionFromReduction(frame.start.expr.reduction)):null;
      const cumulative=frame.type==="rows"&&frame.start.kind==="unbounded"&&frame.end.kind==="current"&&(frame.exclusion===null||frame.exclusion==="no-others");
      const sliding=frame.type==="rows"&&((frame.start.kind==="preceding"&&!!frame.start.expr?.reduction)||(frame.start.kind==="current"))&&frame.end.kind==="current"&&(frame.exclusion===null||frame.exclusion==="no-others");
      const currentOnly=sliding&&frame.start.kind==="current";
      const followingFrame=currentFollowing(win);
      const reversed=reversedFollowing(win);
      if(!definition||sharedSliding||sharedFollowing||(!cumulative&&!sliding&&!followingFrame&&!reversed))continue;
      const args=Array.from({length:win.window.argumentCount},(_,index)=>state.regNew+win.argumentColumn+index);
      if(reversed){ops.push({code:"AggValue",name:win.window.functionName,p1:win.regAccum,p2:win.regResult});continue;}
      windowAggregateCallback(ops,win,state.regNew,false,args.length?collation(expressionFromReduction(pending.layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary");
      if(sliding){
        const skip=ops.length;ops.push({code:"IfCursorSizeGt",p1:pending.layer.iEphCsr,...(currentOnly?{threshold:1}:{...(bounded!==null?{threshold:bounded+1}:{thresholdRegister:state.boundRegisters.start!})}),jump:0});
        const done=ops.length;ops.push({code:"Goto",p2:0});
        const inverse=ops.length;ops.push({code:"EphemeralAdvanceData",p1:pending.layer.duplicateCursors[0],p2:state.regNew,count:state.inputRegisters.length});windowAggregateCallback(ops,win,state.regNew,true,args.length?collation(expressionFromReduction(pending.layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary");
        (ops[skip] as {jump:number}).jump=inverse;(ops[done] as {p2:number}).p2=ops.length;
      }
      if(followingFrame){
        const ready=ops.length;ops.push({code:"IfCursorSizeGt",p1:pending.layer.iEphCsr,thresholdRegister:state.boundRegisters.end!,registerAdjustment:0,jump:0});
        const done=ops.length;ops.push({code:"Goto",p2:0});
        const snapshot=ops.length;ops.push({code:"AggValue",name:win.window.functionName,p1:win.regAccum,p2:win.regResult},{code:"Integer",p1:1n,p2:state.regOutputReady},{code:"EphemeralAdvanceData",p1:pending.layer.duplicateCursors[0],p2:state.regNew,count:state.inputRegisters.length});windowAggregateCallback(ops,win,state.regNew,true,args.length?collation(expressionFromReduction(pending.layer.bufferExpressions[win.argumentColumn]!.reduction!)):"binary");
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
  if(owner){
    // Late frame/return subroutines allocate after the root drain. Publish the
    // complete Parse high-water before the enclosing caller allocates again.
    owner.builder.registers=Math.max(owner.builder.registers,registers);
    (ops[ownerExit] as {p2:number}).p2=ops.length;
  }
  const program=Object.freeze({ops:owner?ops:builder.finish(),registers,columns:Object.freeze(emitsRows&&allProducerExpressionsRepresented?resolved.result.map(result=>Object.freeze({name:result.name,declaredType:result.descriptor.declaredType,database:result.descriptor.database,table:result.descriptor.table,origin:result.descriptor.origin})):[]),parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),...(database?{database}:{}),maxWorkUnits,maxResultBytes,privateStateLimits,encoding});
  return Object.freeze({rewrite,setup:Object.freeze(setup),loopBindings:Object.freeze(loopBindings),program,...(owner?{ownerExit}:{})});
}

export function programOpcodeNames(program:Program):readonly string[]{return Object.freeze(program.ops.map(op=>op.code));}
/** Test/review projection of register ownership; values and function internals remain private. */
export function programRegisterFacts(program:Program):readonly Readonly<{index:number;code:string;p1?:number;p2?:number;p3?:number}>[]{return Object.freeze(program.ops.map((op,index)=>Object.freeze({index,code:op.code,...("p1" in op&&typeof op.p1==="number"?{p1:op.p1}:{}) ,...("p2" in op&&typeof op.p2==="number"?{p2:op.p2}:{}) ,...("p3" in op&&typeof op.p3==="number"?{p3:op.p3}:{})})));}
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
async function runAsyncFunctionContext(evaluate:()=>Promise<Mem>):Promise<Mem>{
 const context=new FunctionContext();
 try{context.setResult(await evaluate())}catch(error){context.setError(error)}
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
// parse.y1176 returns the operand Expr, while Lemon retains LP/RP reductions.
/** parse.y infix function lists are RHS, LHS, ESCAPE, unlike syntax children. */
function infixFunctionChild(signature:string,index:number):number {
 return signature.startsWith('expr ::= expr likeop ')&&index<2?1-index:index;
}
function bindResolvedExpression(value:Expression,carrier:ResolvedExpressionCarrier,cursorFor:(source:ResolvedSource)=>number,preserveScalarLeaves=false,binding?:ResolvedExpressionBinding):Expression {
      // An alias carrier owns the substituted result reduction, not the ID.
      if(value.kind==='column'&&!carrier.column&&carrier.reduction.signature!=='expr ::= ID')value=expressionFromReduction(carrier.reduction as Reduction);
      const children=carrier.children;
      const child=(index:number):ResolvedExpressionCarrier=>{const found=children[index];if(!found)throw new JSQLiteError('internal','resolved joined scalar expression child lost identity');return found;};
      if(value.kind==='column'){
        if(preserveScalarLeaves&&value.cursor!==undefined&&!binding)return value;
        const use=carrier.column;
        if(!use)throw new JSQLiteError('internal',`resolved correlated column lost identity: ${value.name}`);
        const bindColumn=(ref:{source:typeof use.source;columnIndex:number}):Expression=>{
          const location=binding?.location({...ref,name:value.name},use.selectDepth);
          if(location?.kind==='register')return {kind:'register',index:location.register};
          const index=ref.columnIndex<0||isIntegerPrimaryKeyAlias(ref.source.table,ref.columnIndex)?-1:ref.columnIndex;
          if((binding?.policy==='window-filter'||binding?.policy==='window-source'))return {...value,cursor:location?.kind==='cursor'?location.cursor:cursorFor(ref.source),index};
          const column=ref.columnIndex>=0?ref.source.table.columns[ref.columnIndex]:null;
          const named=index<0?'binary':sqliteAsciiFold(column?.collation??'binary');
          if(named!=='binary'&&named!=='nocase'&&named!=='rtrim')throw new JSQLiteError('sqlite',`no such collation sequence: ${named}`,{code:1});
          return {...value,...(location?.kind==='cursor'&&location.aggregateColumn?{aggregateColumn:location.aggregateColumn}:{}),...(location?.kind==='cursor'&&location.payloadIndex!==undefined?{payloadIndex:location.payloadIndex}:{}),physicalColumnIndex:location?.kind==='cursor'?location.physicalColumnIndex:undefined,cursor:location?.kind==='cursor'?location.cursor:cursorFor(ref.source),index,affinity:index<0?'integer':column!.affinity,collation:named};
    }

        // resolve.c lookupName TK_FUNCTION/AFF_DEFER argument list, not the
        // first raw column use. expr.c INLINEFUNC_coalesce owns short circuit.
        if(use.mergedSources)return {kind:'call',name:'coalesce',args:use.mergedSources.map(bindColumn),deferredAffinity:true};
        return bindColumn(use);
      }
      if(value.kind==='unary'&&value.op==='NOT'&&carrier.reduction.signature.startsWith('expr ::= expr likeop '))return {...value,value:bindResolvedExpression(value.value,carrier,cursorFor,preserveScalarLeaves,binding)};
      if(value.kind==='unary'||value.kind==='cast'||value.kind==='collate')return {...value,value:bindResolvedExpression(value.value,child(0),cursorFor,preserveScalarLeaves,binding)};
      if(value.kind==='binary'){
        // TK_ISNULL/TK_NOTNULL owns only pLeft; the representation's NULL
        // right value is generated, not a resolved second operand.
        const unaryNull=carrier.reduction.signature==='expr ::= expr ISNULL|NOTNULL'||carrier.reduction.signature==='expr ::= expr NOT NULL';
        return {...value,left:bindResolvedExpression(value.left,child(0),cursorFor,preserveScalarLeaves,binding),right:unaryNull?value.right:bindResolvedExpression(value.right,child(1),cursorFor,preserveScalarLeaves,binding)};
      }
      if(value.kind==='aggregate'){
        const output=binding?.aggregateOutput?.(carrier.reduction);
        if(output!==undefined)return {kind:'register',index:output};
      }
      if(value.kind==='aggregate'&&binding?.policy==='ordinary-aggregate'){
        const sortlist=directReduction(carrier.reduction,'sortlist ::=');
        const ordered=sortlist?sortListItems(sortlist):[];
        const filterNode=findReduction(carrier.reduction,'filter_clause ::= FILTER');
        const filterExpr=filterNode?.children.find((part):part is Reduction=>part.kind==='reduction'&&part.signature.startsWith('expr ::='));
        const owned=(node:Reduction):ResolvedExpressionCarrier=>{
          const search=(current:ResolvedExpressionCarrier):ResolvedExpressionCarrier|undefined=>current.reduction===node?current:current.children.map(search).find(Boolean);
          const found=search(carrier);if(!found)throw new JSQLiteError('internal','aggregate modifier lost linked identity');return found;
        };
        return {...value,args:value.args.map((arg,index)=>bindResolvedExpression(arg,child(index),cursorFor,true,binding)),
          filter:value.filter&&filterExpr?bindResolvedExpression(value.filter,owned(filterExpr),cursorFor,true,binding):value.filter,
          orderBy:value.orderBy.map((term,index)=>{const node=ordered[index]?.children.find((part):part is Reduction=>part.kind==='reduction'&&(part.signature.startsWith('expr ::=')||part.signature.startsWith('term ::=')));if(!node)throw new JSQLiteError('internal','aggregate order lost reduction');return {...term,expression:bindResolvedExpression(term.expression,owned(node),cursorFor,true,binding)};})};
      }
      if(value.kind==='call'||value.kind==='aggregate'&&binding?.policy!=='derived-predicate'&&binding?.policy!=='window-source'&&binding?.policy!=='aggregate-source')return {...value,args:value.args.map((arg,index)=>bindResolvedExpression(arg,child(infixFunctionChild(carrier.reduction.signature,index)),cursorFor,preserveScalarLeaves,binding))};
      if(preserveScalarLeaves){
        const bindChild=(expression:Expression,index:number)=>bindResolvedExpression(expression,child(index),cursorFor,true,binding);
        if(value.kind==='in-list'&&(binding?.policy==='scalar'||binding?.policy==='window-filter'||binding?.policy==='window-source'||binding?.policy==='ordinary-aggregate'))return {...value,left:bindChild(value.left,0),values:value.values.map((term,index)=>bindChild(term,index+1))};
        if(value.kind==='between'&&binding?.policy!=='aggregate-source')return {...value,value:bindChild(value.value,0),lower:bindChild(value.lower,1),upper:bindChild(value.upper,2)};
        if(value.kind==='in-subquery'&&binding?.policy!=='window-source'&&binding?.policy!=='aggregate-source')return {...value,left:bindChild(value.left,0)};
        if(value.kind==='case'&&binding?.policy!=='window-source'){
          let index=0;
          return {...value,operand:value.operand?bindChild(value.operand,index++):null,pairs:value.pairs.map(([when,then])=>[bindChild(when,index++),bindChild(then,index++)]),otherwise:value.otherwise?bindChild(value.otherwise,index++):null};
        }
        // Keep the scalar caller's prior leaf/unsupported-node admission.
        // Later code generation, not this binder, owns unsupported rejection.
        return value;
      }
      throw new JSQLiteError('unsupported','this joined scalar expression shape is not implemented',{unsupportedClassification:'temporary'});
}


function expressionIdentityReduction(node:Reduction):Reduction{
 while(node.signature==='expr ::= LP expr RP'){
  const child=descendantExprs(node)[0];if(child?.kind!=='reduction')throw new JSQLiteError('internal','parenthesized expression lost identity');node=child;
 }
 return node;
}
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
function isIntegerPrimaryKeyAlias(table:TableNode,columnIndex:number):boolean{return integerPrimaryKeyColumn(table)===table.columns[columnIndex]}
function expressionFromReduction(n:LemonValue<SqlToken>):Expression{
 if(n.kind!=="reduction"||!(n.signature.startsWith("expr ::=")||n.signature.startsWith("term ::=")))throw new JSQLiteError("unsupported","expression reduction is not implemented",{unsupportedClassification:"temporary"});
 const t=exprLeaves(n), all=descendantExprs(n), sig=n.signature;
 if(sig==="expr ::= ID|INDEXED|JOIN_KW"){const keyword=sqliteAsciiFold(t[0]!.text);if(['current_date','current_time','current_timestamp'].includes(keyword))return{kind:"call",name:keyword,args:[]};}
 if(sig.startsWith("term ::=")||sig==="expr ::= term"||sig==="expr ::= VARIABLE"){const x=t[0]!;const keyword=sqliteAsciiFold(x.text);if(['current_date','current_time','current_timestamp'].includes(keyword))return{kind:"call",name:keyword,args:[]};if(x.kind==="integer"){const v=BigInt(x.text);return{kind:"literal",value:v<(1n<<63n)?v:Number(x.text)}}if(x.kind==="float")return{kind:"literal",value:Number(x.text)};if(x.kind==="string")return{kind:"literal",value:decodeString(x.text)};if(x.kind==="blob")return{kind:"literal",value:Uint8Array.from(x.text.slice(2,-1).match(/../g)?.map(y=>parseInt(y,16))??[])};if(x.text.toUpperCase()==="NULL")return{kind:"literal",value:null}}
 if(sig==="expr ::= VARIABLE")return{kind:"variable",spelling:t[0]!.text};
 if(sig==="expr ::= LP expr RP")return expressionFromReduction(all[0]!);
 // whereexpr.c canonicalizes IS [NOT] NULL to TK_ISNULL/TK_NOTNULL;
 // preserve the owning unary production when consuming analyzed terms.
 if(sig==="expr ::= expr ISNULL|NOTNULL"||sig==="expr ::= expr NOT NULL")return {kind:'binary',op:t.at(-1)?.text.toUpperCase()==='ISNULL'?'IS':'IS NOT',left:expressionFromReduction(all[0]!),right:{kind:'literal',value:null}};

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
 if(sig==="expr ::= expr between_op expr AND expr"){
  const betweenOp=directReduction(n,"between_op ::=");
  return{kind:"between",value:expressionFromReduction(all[0]!),lower:expressionFromReduction(all[1]!),upper:expressionFromReduction(all[2]!),negated:betweenOp?.signature==="between_op ::= NOT BETWEEN"};
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
  if(op&&["+","-","*","/","%","&","|","<<",">>","||","->","->>","=","==","!=","<>","<",">","<=",">=","IS","IS NOT","AND","OR"].includes(op))return (op==="->"||op==="->>")?{kind:"call",name:op==="->"?"json_arrow":"json_arrow_sql",args:[expressionFromReduction(all[0]!),expressionFromReduction(all[1]!)]}:{kind:"binary",op,left:expressionFromReduction(all[0]!),right:expressionFromReduction(all[1]!)}
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
   if(token){// Count the call argument list only: FILTER/ORDER/OVER are separate
   // semantic children, not additional min/max arguments (resolve.c).
   const name=sqliteAsciiFold(token.text),count=aggregateParts(node).args.length;if(aggregateDefinition(name)!==undefined&&(!['min','max'].includes(name)||count===1))return true;}
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
  // resolve.c:resolveExprStep handles TK_SELECT/TK_EXISTS/TK_IN with a
  // separate NameContext for the child SELECT. Its aggregate calls do not
  // make this enclosing SELECT an aggregate. The IN left operand still belongs
  // to this SELECT and must be visited.
  if(node.signature==="expr ::= LP select RP"||node.signature==="expr ::= EXISTS LP select RP")return false;
  if(node.signature==="expr ::= expr in_op LP select RP"){
   const left=node.children.find(child=>child.kind==="reduction"&&child.signature.startsWith("expr ::="));
   return left!==undefined&&visit(left);
  }
  if(node.signature.startsWith("expr ::= ID|INDEXED|JOIN_KW LP")){
   const token=exprLeaves(node)[0];
   if(token){// Count the call argument list only: FILTER/ORDER/OVER are separate
   // semantic children, not additional min/max arguments (resolve.c).
   const name=sqliteAsciiFold(token.text),count=aggregateParts(node).args.length;if(aggregateDefinition(name)!==undefined&&((name!=="min"&&name!=="max")||count===1))return true;}
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
  if (expression.sourceText !== undefined) return expression.sourceText;
  return expression.tokens.map((token, index) => {
    const spaces = index ? " ".repeat(Math.max(0, token.startByte - expression.tokens[index - 1]!.endByte)) : "";
    return spaces + token.text;
  }).join("");
}

/** Default select.c short-column-name behavior for a resolved JSON virtual
 * column. Keep expressionName() for computed expressions: its exact UTF-8
 * source span, including comments and spacing, is observable metadata. */
function jsonResultMetadata(expression:SelectNode["result"][number],tree:Expression,starts:readonly number[],tables:readonly string[],physical?:TableNode):ColumnMetadata {
  while(tree.kind==="collate")tree=tree.value;
  if(tree.kind==="register")for(let source=0;source<starts.length;source++){const index=tree.index-starts[source]!;if(index>=0&&index<JSON_TABLE_COLUMNS.length){const origin=JSON_TABLE_COLUMNS[index]!;return Object.freeze({name:expression.alias??origin,declaredType:index>=JSON_EACH_COLUMNS.length?"":null,database:"main",table:tables[source]!,origin});}}
  if(physical&&tree.kind==="column"&&tree.cursor===0&&tree.index>=0){const column=physical.columns[tree.index];if(column)return Object.freeze({name:expression.alias??column.name,declaredType:column.declaredType,database:"main",table:physical.tableName,origin:column.name});}
  return Object.freeze({name:expression.alias??expressionName(expression),declaredType:null,database:null,table:null,origin:null});
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
  if(expression.kind==="between") {
    // expr.c exprCodeBetween rewrites to saved-x >= lower AND saved-x <= upper.
    // Keep x in one register and use the shared comparison/boolean opcodes so
    // false lower comparisons skip an erroring upper expression, while NULL
    // still evaluates upper (which may determine false).
    const value=emit(expression.value),result=allocate(),affinity=expressionAffinity(expression.value);
    const lower=emit(expression.lower);
    ops.push({code:"Binary",op:">=",p1:value,p2:lower,p3:result,collation:binaryCollation(expression.value,expression.lower),...(affinity?{affinity}:{})});
    // exprCodeBetween hands the synthetic AND to sqlite3ExprCodeTarget for a
    // projected value (both comparison operands execute in native order), but
    // to sqlite3ExprIfTrue/False in predicate context (a decisive false lower
    // comparison can jump over the upper expression).
    const guard=predicateContext?ops.length:-1;
    if(predicateContext)ops.push({code:"ShortCircuit",kind:"and",p1:result,p2:result,jump:0});
    const upper=emit(expression.upper),upperResult=allocate();
    ops.push({code:"Binary",op:"<=",p1:value,p2:upper,p3:upperResult,collation:binaryCollation(expression.value,expression.upper),...(affinity?{affinity}:{})},{code:"Boolean",kind:"and",p1:result,p2:upperResult,p3:result});
    if(guard>=0)(ops[guard] as {jump:number}).jump=ops.length;
    if(!expression.negated)return result;
    const negated=allocate();ops.push({code:"Not",p1:result,p2:negated});return negated;
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
  if(expression.kind==="column") {
    const aggregate=expression.aggregateColumn;
    if(aggregate?.owner.directMode&&!aggregate.owner.useSortingIdx&&aggregate.owner.sourceRegisters!==undefined){
      const target=allocate();ops.push({code:"Copy",p1:aggregate.owner.sourceRegisters+aggregate.iAgg,p2:target});
      if(expression.index>=0&&expression.affinity==="real")ops.push({code:"RealAffinity",p1:target});
      return target;
    }
    if(aggregate&&(!aggregate.owner.directMode||aggregate.owner.useSortingIdx)){
      const column=aggregate.owner.columns.get(aggregate.iAgg);
      if(!column){const target=allocate();ops.push({code:"Null",p2:target});return target;}
      if(!aggregate.owner.directMode)return column.accumulatorRegister;
      if(expression.index>=0&&expression.affinity==="real"){const target=allocate();ops.push({code:"Copy",p1:aggregate.owner.sortingIndexRegister+column.iSorterColumn,p2:target},{code:"RealAffinity",p1:target});return target;}
      return aggregate.owner.sortingIndexRegister+column.iSorterColumn;
    }
    const r=allocate();if(expression.index<0&&expression.physicalColumnIndex===undefined)ops.push({code:"Rowid",p1:expression.cursor??0,p2:r});else {ops.push({code:"Column",p1:expression.physicalColumnIndex??expression.index,p2:r,...(expression.cursor===undefined?{}:{p3:expression.cursor})});if(expression.affinity==="real")ops.push({code:"RealAffinity",p1:r});}return r; }
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
    if(expression.name==="coalesce"||expression.name==="ifnull") {
      // expr.c4592 INLINEFUNC_coalesce: first expression into target, then
      // test that target before each subsequent argument. No final test/null.
      const r=allocate(),jumps:number[]=[];
      expression.args.forEach((arg,index)=>{
        if(index){const at=ops.length;ops.push({code:"NotNull",p1:r,p2:r,jump:0});jumps.push(at);}
        const value=emit(arg);ops.push({code:"Copy",p1:value,p2:r});
      });
      for(const at of jumps)(ops[at] as {jump:number}).jump=ops.length;
      return r;
    }
    if(expression.name==="iif"||expression.name==="if") {const r=allocate(),ends:number[]=[];let i=0;for(;i+1<expression.args.length;i+=2){const condition=emit(expression.args[i]!),skip=ops.length;ops.push({code:"IfNot",p1:condition,p2:0});const value=emit(expression.args[i+1]!);ops.push({code:"Copy",p1:value,p2:r});ends.push(ops.length);ops.push({code:"Goto",p2:0});(ops[skip] as {p2:number}).p2=ops.length}if(i<expression.args.length){const value=emit(expression.args[i]!);ops.push({code:"Copy",p1:value,p2:r})}else ops.push({code:"Null",p2:r});for(const end of ends)(ops[end] as {p2:number}).p2=ops.length;return r;}
    const args=expression.args.map(emit),r=allocate(),coll=functionArgumentCollation(expression.name,expression.args);if(coll!=="binary")ops.push({code:"CollSeq",collation:coll});ops.push({code:"Function",name:expression.name,args,p2:r,collation:coll});return r;
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
// expr.c:sqlite3CodeSubselect3933–3958 rewrites scalar/EXISTS X to
// X<>0 with numeric affinity before SELECT integer admission. IN retains
// ordinary row-count LIMIT. Caller initializes destination before this guard.
function computeScalarLimitRegisters(select:SelectNode,ops:Op[],allocate:()=>number,parameters:ParameterBuilder,subquery?:(expression:SubqueryExpression)=>number):{count:number;ifZero:number}|undefined {
 if(!select.limit)return undefined;
 const value=compileExpressionTree(expressionFromReduction(select.limit.reduction!),ops,allocate,parameters,subquery),zero=allocate(),count=allocate();
 ops.push({code:'Integer',p1:0n,p2:zero},{code:'Binary',op:'!=',p1:value,p2:zero,p3:count,affinity:'numeric',collation:'binary'},{code:'MustBeInt',p1:count});
 const ifZero=ops.length;ops.push({code:'IfNot',p1:count,p2:0});return {count,ifZero};
}

function computeLimitRegisters(select:SelectNode,ops:Op[],allocate:()=>number,parameters:ParameterBuilder,scalarDestination=false):LimitRegisters|undefined {
 if(!select.limit)return undefined;
 // select.c:computeLimitRegisters emits OP_Goto for an integer literal zero
 // (or OP_IfNot for an evaluated LIMIT) before compiling the OFFSET expression.
 // expr.c normalizes the SELECT owned by Mem/Exists, not IN or a retained
 // derived producer feeding a post-producer predicate. Reuse its semantic owner
 // before OFFSET admission; count/combined/capacity still belong to this SELECT.
 const scalar=scalarDestination?computeScalarLimitRegisters(select,ops,allocate,parameters):undefined;
 const count=scalar?.count??compileExpressionTree(expressionFromReduction(select.limit.reduction!),ops,allocate,parameters);
 let ifZero:number;
 if(scalar)ifZero=scalar.ifZero;
 else {ops.push({code:"MustBeInt",p1:count});ifZero=ops.length;ops.push({code:"IfNot",p1:count,p2:0});}
 let offset:number|undefined;
 if(select.offset){offset=compileExpressionTree(expressionFromReduction(select.offset.reduction!),ops,allocate,parameters);ops.push({code:"MustBeInt",p1:offset});}
 const combined=allocate();if(offset===undefined){ops.push({code:"Copy",p1:count,p2:combined});}else ops.push({code:"OffsetLimit",p1:count,p2:combined,p3:offset});
 const capacity=allocate();ops.push({code:"Copy",p1:combined,p2:capacity});
 return {count,...(offset===undefined?{}:{offset}),combined,capacity,ifZero};
}

export function compileRecursiveCteSelect(select:SelectNode,encoding:DatabaseEncoding,maxWorkUnits=10_000_000,maxResultBytes=1_000_000_000,privateStateLimits:PrivateStateLimits=DEFAULT_PRIVATE_STATE_LIMITS,maxRows=Number.MAX_SAFE_INTEGER,producerOnly=false, shared?:{builder:SelectProgramBuilder<Op>; destination:SelectDest;parameters?:ParameterBuilder}):Program{
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
 if(!producerOnly&&(((select.from.items.length!==1||outerRecursiveIndex!==0)&&!joinedDerived)||select.where||select.hasCompound||select.hasGroupBy||select.hasHaving||select.hasDistinct||select.hasOrderBy))throw new JSQLiteError("unsupported","this recursive common table expression consumer is not implemented",{unsupportedClassification:"temporary"});
 const names=owner.columns??arms[0]!.result.map(expressionName);const lookup=(name:string)=>names.findIndex(candidate=>sqliteIdentifierEqual(candidate,sqlName(name.split(".").at(-1)!)));
 const bind=(tree:Expression,current:number):Expression=>{if(tree.kind==="column"){const index=lookup(tree.name);if(index<0)throw new JSQLiteError("sqlite",`no such column: ${tree.name}`,{code:1});return{kind:"register",index:current+index}}if(tree.kind==="unary"||tree.kind==="cast"||tree.kind==="collate")return{...tree,value:bind(tree.value,current)};if(tree.kind==="binary")return{...tree,left:bind(tree.left,current),right:bind(tree.right,current)};if(tree.kind==="between")return{...tree,value:bind(tree.value,current),lower:bind(tree.lower,current),upper:bind(tree.upper,current)};if(tree.kind==="call")return{...tree,args:tree.args.map(value=>bind(value,current))};if(tree.kind==="case")return{...tree,operand:tree.operand?bind(tree.operand,current):null,pairs:tree.pairs.map(([a,b])=>[bind(a,current),bind(b,current)]),otherwise:tree.otherwise?bind(tree.otherwise,current):null};return tree};
 const selectProgramBuilder=shared?.builder??new SelectProgramBuilder<Op>();const ops=selectProgramBuilder.ops,parameters:ParameterBuilder=shared?.parameters??{maximum:0,names:[],named:new Map()};// Cursor 0 is reserved by the current recursive VM convention. Keep Queue
 // and Distinct adjacent, as generateWithRecursiveQuery requires.
 if(!shared)selectProgramBuilder.cursor();const queue=selectProgramBuilder.cursor(),history=distinct?selectProgramBuilder.cursor():undefined;
 const allocate=()=>selectProgramBuilder.register();
 // Outer SELECT limits its destination, independently of queue-body LIMIT.
 const consumerLimit=producerOnly?undefined:computeLimitRegisters(select,ops,allocate,parameters);
 const limit=computeLimitRegisters(body,ops,allocate,parameters);
 const order=body.orderBy.map(term=>{if(!term.expr.reduction)throw new JSQLiteError("internal","recursive ORDER BY lost expression");const tree=expressionFromReduction(term.expr.reduction);let index=-1;if(tree.kind==="literal"&&typeof tree.value==="bigint"&&tree.value>=1n&&tree.value<=BigInt(width))index=Number(tree.value)-1;else if(tree.kind==="column")index=lookup(tree.name);if(index<0)throw new JSQLiteError("sqlite","1st ORDER BY term does not match any column in the result set",{code:1});return{index,collation:collation(expressionFromReduction(arms[0]!.result[index]!.reduction!)),desc:term.descending,nullsLarge:term.nulls==="last"?!term.descending:term.nulls==="first"?term.descending:false};});
 if(order.length)ops.push({code:"OpenPriorityQueue",p1:queue,keyInfo:new KeyInfo({encoding,totalFieldCount:order.length,keyFieldCount:order.length,terms:order})});else ops.push({code:"OpenFifo",p1:queue});
 if(history!==undefined)ops.push({code:"OpenEphemeral",p1:history,keyInfo:new KeyInfo({encoding,totalFieldCount:width,keyFieldCount:width,terms:arms[0]!.result.map(expression=>({collation:collation(expressionFromReduction(expression.reduction!))}))})});
 const enqueue=(start:number)=>{let found:number|undefined;if(history!==undefined){found=ops.length;ops.push({code:"Found",p1:history,keyStart:start,keyCount:width,jump:0},{code:"IdxInsert",p1:history,keyStart:start,keyCount:width});}if(order.length){const key=selectProgramBuilder.range(order.length);order.forEach((term,index)=>ops.push({code:"Copy",p1:start+term.index,p2:key+index}));ops.push({code:"PriorityInsert",p1:queue,keyStart:key,keyCount:order.length,payloadStart:start,payloadCount:width});}else ops.push({code:"FifoInsert",p1:queue,keyStart:start,keyCount:width});if(found!==undefined)(ops[found] as {jump:number}).jump=ops.length;};
 for(const arm of arms.slice(0,firstRecursive)){
  if(arm.from.items.length)throw new JSQLiteError("unsupported","this recursive common table expression setup is not implemented",{unsupportedClassification:"temporary"});
  const seedRows=arm.origin==="values"?arm.valuesRows!:[arm.result];for(const row of seedRows){const values=row.map(expression=>compileExpression(expression,ops,allocate,parameters)),start=selectProgramBuilder.range(width);values.forEach((value,index)=>ops.push({code:"Copy",p1:value.register,p2:start+index}));enqueue(start);}
 }
 let joinedStart:number|undefined,joinedNames:readonly string[]=[];
 if(joinedDerived){const derived=select.from.derived!.select;joinedNames=derived.result.map(expression=>expression.alias??expressionName(expression));joinedStart=selectProgramBuilder.range(derived.result.length);derived.result.forEach((expression,index)=>{const value=compileExpression(expression,ops,allocate,parameters);ops.push({code:"Copy",p1:value.register,p2:joinedStart!+index});});}
 const current=selectProgramBuilder.range(width);const loop=ops.length,breakLabel=selectProgramBuilder.label();selectProgramBuilder.jump(breakLabel,order.length?{code:"PriorityShift",p1:queue,p2:current,count:width,emptyJump:0}:{code:"FifoShift",p1:queue,p2:current,count:width,emptyJump:0},(op,pc)=>({...op,emptyJump:pc}));
 let offsetSkip:number|undefined;if(limit?.offset!==undefined){offsetSkip=ops.length;ops.push({code:"IfPos",p1:limit.offset,p2:0,p3:1});}
 const bindOutput=(tree:Expression):Expression=>{if(tree.kind==="column"){const parts=tree.name.split(".").map(sqlName),qualifier=parts.length>1?parts.at(-2):undefined,name=parts.at(-1)!;if(joinedDerived&&qualifier&&sqliteIdentifierEqual(qualifier,select.from.items[1]!.alias??select.from.items[1]!.tableName)){const index=joinedNames.findIndex(candidate=>sqliteIdentifierEqual(candidate,name));if(index<0)throw new JSQLiteError("sqlite",`no such column: ${tree.name}`,{code:1});return{kind:"register",index:joinedStart!+index};}return bind(tree,current);}if(tree.kind==="unary"||tree.kind==="cast"||tree.kind==="collate")return{...tree,value:bindOutput(tree.value)};if(tree.kind==="binary")return{...tree,left:bindOutput(tree.left),right:bindOutput(tree.right)};if(tree.kind==="call")return{...tree,args:tree.args.map(bindOutput)};if(tree.kind==="case")return{...tree,operand:tree.operand?bindOutput(tree.operand):null,pairs:tree.pairs.map(([a,b])=>[bindOutput(a),bindOutput(b)]),otherwise:tree.otherwise?bindOutput(tree.otherwise):null};return tree};
 let consumerSkip:number|undefined;if(joinedDerived&&select.from.items[1]!.on?.reduction){const predicate=compileExpressionTree(bindOutput(expressionFromReduction(select.from.items[1]!.on!.reduction!)),ops,allocate,parameters);consumerSkip=ops.length;ops.push({code:"IfNot",p1:predicate,p2:0});}
 let consumerOffsetSkip:number|undefined;if(consumerLimit?.offset!==undefined){consumerOffsetSkip=ops.length;ops.push({code:"IfPos",p1:consumerLimit.offset,p2:0,p3:1});}
 const outputWidth=producerOnly?width:select.result.length,output=selectProgramBuilder.range(outputWidth);if(producerOnly){for(let index=0;index<width;index++)ops.push({code:"Copy",p1:current+index,p2:output+index});}else select.result.forEach((expression,index)=>{if(!expression.reduction)throw new JSQLiteError("internal","recursive result lost expression");const value=compileExpressionTree(bindOutput(expressionFromReduction(expression.reduction)),ops,allocate,parameters);ops.push({code:"Copy",p1:value,p2:output+index});});emitSelectDestination(ops,shared?.destination??{kind:"output"},output,outputWidth);
 let consumerBreak:number|undefined;if(consumerLimit){consumerBreak=ops.length;ops.push({code:"DecrJumpZero",p1:consumerLimit.count,p2:0});}
 // Skipping an outer row still consumes the body row and runs its recursive step.
 if(consumerOffsetSkip!==undefined)(ops[consumerOffsetSkip] as {p2:number}).p2=ops.length;
 let limitBreak:number|undefined;if(limit){limitBreak=ops.length;ops.push({code:"DecrJumpZero",p1:limit.count,p2:0});}
 const recursiveStart=ops.length;if(offsetSkip!==undefined)(ops[offsetSkip] as {p2:number}).p2=recursiveStart;if(consumerSkip!==undefined)(ops[consumerSkip] as {p2:number}).p2=recursiveStart;
 for(const recursive of recursiveArms){
  let skip:number|undefined;if(recursive.where?.reduction){const predicate=compileExpressionTree(bind(expressionFromReduction(recursive.where.reduction),current),ops,allocate,parameters);skip=ops.length;ops.push({code:"IfNot",p1:predicate,p2:0});}
  const next=selectProgramBuilder.range(width);recursive.result.forEach((expression,index)=>{if(!expression.reduction)throw new JSQLiteError("internal","recursive term lost expression");const value=compileExpressionTree(bind(expressionFromReduction(expression.reduction),current),ops,allocate,parameters);ops.push({code:"Copy",p1:value,p2:next+index});});enqueue(next);if(skip!==undefined)(ops[skip] as {p2:number}).p2=ops.length;
 }
 ops.push({code:"Goto",p2:loop});selectProgramBuilder.mark(breakLabel);const done=ops.length;if(!shared)ops.push({code:"Halt"});if(limit){(ops[limit.ifZero] as {p2:number}).p2=done;if(limitBreak!==undefined)(ops[limitBreak] as {p2:number}).p2=done;}
 if(consumerLimit){(ops[consumerLimit.ifZero] as {p2:number}).p2=done;if(consumerBreak!==undefined)(ops[consumerBreak] as {p2:number}).p2=done;}
 return Object.freeze({ops:shared?ops:selectProgramBuilder.finish(),registers:selectProgramBuilder.registers,columns:Object.freeze(producerOnly?names.map(name=>Object.freeze({name,declaredType:null,database:null,table:null,origin:null})):select.result.map((expression,index)=>Object.freeze({name:expression.alias??names[index]??expressionName(expression),declaredType:null,database:null,table:null,origin:null}))),parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,encoding});
}


/** select.c generateWithRecursiveQuery's queue producer feeds the enclosing
 * aggregate destination during construction. Queue completion precedes parent
 * finalization in the same builder; no completed Program addresses are copied. */
// Existing recursive-window semantic source description, shared by consumers.
// This is NameContext column metadata only, never a synthetic OpenRead producer.
function prepareRecursiveSource(select:SelectNode,owner:NonNullable<SelectNode['with']>['ctes'][number],schema:SchemaGraph):{transient:SchemaGraph;expanded:ReturnType<typeof expandAndResolveSelect>} {
 const names=owner.columns??owner.select.arms[0]!.result.map(expressionName);
 const columns=names.map(name=>Object.freeze({szEst:0,name,declaredType:null,affinity:"blob" as const,defaultExpr:null,generatedExpr:null,defaultIndex:null,notNull:false,primaryKeyPosition:null,unique:false,collation:null,generatedStorage:null,checks:Object.freeze([])}));
 const table:TableNode=freezeTransientTable({integerPrimaryKey:null,szTabRow:1,nRowLogEst:200,hasStat1:false,kind:"table",name:owner.name,tableName:owner.name,rootPage:0,sql:"",columns:Object.freeze(columns),indexes:[],withoutRowid:false,primaryKey:Object.freeze([]),primaryKeyTerms:Object.freeze([]),storageKey:Object.freeze([]),checks:Object.freeze([]),foreignKeys:Object.freeze([]),referencedBy:Object.freeze([])});
 const transient=schema.withTransientTable(table);let expanded:ReturnType<typeof expandAndResolveSelect>;
 try{expanded=expandAndResolveSelect(select,transient)}catch(error){if(error instanceof NameResolutionError)throw new JSQLiteError("sqlite",error.message,{code:1});throw error;}
 return {transient,expanded};
}

export function compileRecursiveAggregateSelect(select:SelectNode,schema:SchemaGraph,database:BtreeDatabase,maxRows:number,maxWorkUnits=10_000_000,maxResultBytes=1_000_000_000,privateStateLimits:PrivateStateLimits=DEFAULT_PRIVATE_STATE_LIMITS,shared?:{builder:SelectProgramBuilder<Op>;parameters:ParameterBuilder;destination:SelectDest}):Program|undefined {
 const owner=select.with?.ctes.find(cte=>cte.select.arms.some(arm=>arm.from.items.some(item=>item.databaseName===null&&sqliteIdentifierEqual(item.tableName,cte.name))));
 if(!owner||!selectHasAggregate(select))return undefined;
 // Admit the ordinary single recursive SrcItem before emitting queue code.
 // GROUP/HAVING consume the shared aggregate sorter and saved/final phases.
 if(select.hasCompound||select.from.items.length!==1||!sqliteIdentifierEqual(select.from.items[0]!.tableName,owner.name))throw new JSQLiteError('unsupported','this recursive aggregate consumer is not implemented',{unsupportedClassification:'temporary'});
 // Same resolver-only SrcItem description as the recursive window consumer.
 // rootPage is never opened: input.first binds AggInfo columns to queue payload.
 const {transient,expanded:linkedPlan}=prepareRecursiveSource(select,owner,schema);
 const builder=shared?.builder??new SelectProgramBuilder<Op>(),ops=builder.ops,parameters:ParameterBuilder=shared?.parameters??{maximum:0,names:[],named:new Map()};
 const first=builder.range(linkedPlan.sources[0]!.table.columns.length),coroutine=builder.register(),ready=builder.label();
 builder.jump(ready,{code:'InitCoroutine',p1:coroutine,p2:0,p3:ops.length+1},(op,pc)=>({...op,p2:pc}));
 // Only the CTE body LIMIT belongs to queue production. Consumer LIMIT/WHERE
 // belong to the aggregate, after queue exhaustion/finalization respectively.
 compileRecursiveCteSelect(select,database.encoding,maxWorkUnits,maxResultBytes,privateStateLimits,Number.MAX_SAFE_INTEGER,true,{builder,parameters,destination:{kind:'coroutine',register:coroutine,first}});
 ops.push({code:'EndCoroutine',p1:coroutine,p2:0});builder.mark(ready);
 const input={first,emit:(consume:()=>void)=>{const top=builder.label(),done=builder.label();builder.mark(top);builder.jump(done,{code:'Yield',p1:coroutine,p2:0},(op,pc)=>({...op,p2:pc}));consume();builder.jump(top,{code:'Goto',p2:0},(op,pc)=>({...op,p2:pc}));builder.mark(done);}};
 const program=compileAggregateSelect(select,transient,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{builder,ops,parameters,linkedPlan,input,destination:shared?.destination??{kind:'output'}});
 if(!shared)ops.push({code:'Halt'});
 return Object.freeze({...program,ops:shared?ops:builder.finish(),registers:builder.registers,parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name})))});
}

export function compileRecursiveWindowSelect(select:SelectNode,schema:SchemaGraph,database:BtreeDatabase,maxRows=Number.MAX_SAFE_INTEGER,maxWorkUnits=10_000_000,maxResultBytes=1_000_000_000,privateStateLimits:PrivateStateLimits=DEFAULT_PRIVATE_STATE_LIMITS,shared?:{builder:SelectProgramBuilder<Op>;parameters:ParameterBuilder;destination:SelectDest}):Program|undefined {
 const owner=select.with?.ctes.find(cte=>cte.select.arms.some(arm=>arm.from.items.some(item=>item.databaseName===null&&sqliteIdentifierEqual(item.tableName,cte.name))));
 if(!owner||!selectHasWindow(select))return undefined;
 const {transient,expanded}=prepareRecursiveSource(select,owner,schema);
 const compilation=compileWindowSelectLowering(expanded,database.encoding,database,maxWorkUnits,maxResultBytes,privateStateLimits,transient,{select,maxRows},shared);
 return Object.freeze({...compilation.program,database,maxRows});
}

/** Compose multiple bounded recursive producers by redirecting each iterative
 * queue's output into a VDBE sorter, then draining the materializations with an
 * ordinary nested loop. No recursive host-language evaluation is introduced. */
export function compileMultipleRecursiveCtes(select:SelectNode,encoding:DatabaseEncoding,maxWorkUnits=10_000_000,maxResultBytes=1_000_000_000,privateStateLimits:PrivateStateLimits=DEFAULT_PRIVATE_STATE_LIMITS,maxRows=Number.MAX_SAFE_INTEGER,shared?:{builder:SelectProgramBuilder<Op>;parameters:ParameterBuilder;destination:SelectDest}):Program|undefined {
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
 const selectProgramBuilder=shared?.builder??new SelectProgramBuilder<Op>();
 const parameters:ParameterBuilder=shared?.parameters??{maximum:0,names:[],named:new Map()};
 const ops=selectProgramBuilder.ops,sorters:number[]=[],children:{columns:readonly {name:string}[]}[]=[];
 // select.c:generateWithRecursiveQuery materializes each queue in the same
 // Parse/Vdbe. Each producer owns its queue loop, not a completed Program to
 // be rebased after construction. Sorter key width zero keeps FIFO row order.
 for(let source=0;source<sourceOwners.length;source++){
  const owner=sourceOwners[source]!,item=select.from.items[source]!;
  const from=Object.freeze(Object.assign([...select.from.tokens],{items:Object.freeze([item]),tokens:select.from.tokens})) as typeof select.from;
  const result=Object.freeze(names[source]!.map((_name,column)=>select.result[locations.findIndex(location=>location?.source===source&&location.column===column)]!));
  const arm=Object.freeze({...select.arms[0]!,result,from,where:null,hasDistinct:false,hasGroupBy:false,hasHaving:false,operatorFromPrior:null,prior:null,next:null});
  const child=Object.freeze({...select,result,from,where:null,groupBy:Object.freeze([]),having:null,orderBy:Object.freeze([]),limit:null,offset:null,hasDistinct:false,hasGroupBy:false,hasHaving:false,hasOrderBy:false,hasLimit:false,hasCompound:false,with:Object.freeze({recursive:true,ctes:Object.freeze([owner])}),arms:Object.freeze([arm])});
  const sorter=selectProgramBuilder.cursor();sorters.push(sorter);
  ops.push({code:'SorterOpen',p1:sorter,keyInfo:new KeyInfo({encoding,totalFieldCount:0,keyFieldCount:0,terms:[]})});
  const producer=compileRecursiveCteSelect(child,encoding,maxWorkUnits,maxResultBytes,privateStateLimits,maxRows,false,{builder:selectProgramBuilder,parameters,destination:{kind:'sorter',cursor:sorter,keyCount:0}});
  children.push(producer);
 }
 const rowBases=children.map(child=>selectProgramBuilder.range(child.columns.length)),rewinds:number[]=[],starts:number[]=[];
 let finalSorter:number|undefined,orderIndexes:readonly number[]=[];
 if(select.orderBy.length){
  const terms=select.orderBy.map(term=>{if(!term.expr.reduction)throw new JSQLiteError('internal','recursive consumer ORDER BY lost expression');const tree=expressionFromReduction(term.expr.reduction),identity=tree.kind==='collate'?tree.value:tree,location=locateColumn(identity);if(!location)throw new JSQLiteError('unsupported','this recursive common table expression consumer ORDER BY is not implemented',{unsupportedClassification:'temporary'});const resultIndex=locations.findIndex(candidate=>candidate?.source===location.source&&candidate.column===location.column);if(resultIndex<0)throw new JSQLiteError('sqlite','ORDER BY term does not match any column in the result set',{code:1});return{resultIndex,collation:explicitCollation(tree)??'binary',desc:term.descending,nullsLarge:term.nulls==='last'?!term.descending:term.nulls==='first'?term.descending:false}});
  orderIndexes=terms.map(term=>term.resultIndex);finalSorter=selectProgramBuilder.cursor();ops.push({code:'SorterOpen',p1:finalSorter,keyInfo:new KeyInfo({encoding,totalFieldCount:terms.length,keyFieldCount:terms.length,terms})});
 }
 for(let source=0;source<children.length;source++){rewinds[source]=ops.length;ops.push({code:'SorterSort',p1:sorters[source]!,emptyJump:0});starts[source]=ops.length;ops.push({code:'SorterData',p1:sorters[source]!,p2:rowBases[source]!,count:children[source]!.columns.length});}
 const output=selectProgramBuilder.range(select.result.length);locations.forEach((location,index)=>ops.push({code:'Copy',p1:rowBases[location!.source]!+location!.column,p2:output+index}));
 if(finalSorter!==undefined){const key=selectProgramBuilder.range(orderIndexes.length);orderIndexes.forEach((resultIndex,index)=>ops.push({code:'Copy',p1:output+resultIndex,p2:key+index}));ops.push({code:'SorterInsert',p1:finalSorter,keyStart:key,keyCount:orderIndexes.length,payload:output,payloadCount:select.result.length});}else emitSelectDestination(ops,shared?.destination??{kind:'output'},output,select.result.length);
 const next:number[]=[];for(let source=children.length-1;source>=0;source--){next[source]=ops.length;ops.push({code:'SorterNext',p1:sorters[source]!,p2:starts[source]!});(ops[rewinds[source]!] as {emptyJump:number}).emptyJump=source===0?ops.length:next[source-1]!;}
 if(finalSorter!==undefined){const sort=ops.length;ops.push({code:'SorterSort',p1:finalSorter,emptyJump:0},{code:'SorterData',p1:finalSorter,p2:output,count:select.result.length});emitSelectDestination(ops,shared?.destination??{kind:'output'},output,select.result.length);ops.push({code:'SorterNext',p1:finalSorter,p2:sort+1});(ops[sort] as {emptyJump:number}).emptyJump=ops.length;}
 if(!shared)ops.push({code:'Halt'});return Object.freeze({ops:shared?ops:selectProgramBuilder.finish(),registers:selectProgramBuilder.registers,columns:Object.freeze(select.result.map(expression=>Object.freeze({name:expression.alias??expressionName(expression),declaredType:null,database:null,table:null,origin:null}))),parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,encoding});
}

export function compileScalarSelect(select: SelectNode, encoding: DatabaseEncoding, maxWorkUnits = 10_000_000, maxResultBytes = 1_000_000_000, privateStateLimits:PrivateStateLimits=DEFAULT_PRIVATE_STATE_LIMITS, schema?:SchemaGraph, database?:BtreeDatabase, maxRows=Number.MAX_SAFE_INTEGER, owner?:{builder:SelectProgramBuilder<Op>;parameters:ParameterBuilder;emitRow:(first:number,count:number)=>void;destination?:SelectDest}): Program {
  // select.c applies sqlite3WindowRewrite to every SELECT after name/function
  // resolution, including a SELECT without a FROM clause. Public prepare passes
  // the schema here, so resolve before scalar lowering can misclassify the owner.
  if(selectHasWindow(select)){
    if(select.hasCompound&&schema&&database){
      const compound=owner?.destination?compileCteUnionAll(select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{builder:owner.builder,parameters:owner.parameters,destination:owner.destination}):compileCteUnionAll(select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits);
      if(compound){if('ops' in compound)return compound;
      return Object.freeze({columns:compound.columns,ops:owner!.builder.ops,registers:owner!.builder.registers,parameters:Object.freeze(owner!.parameters.names.map(name=>Object.freeze({name}))),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,encoding});}
    }
    if(!schema)throw new JSQLiteError("unsupported","window functions are not implemented",{unsupportedClassification:"temporary"});
    let expanded:ReturnType<typeof expandAndResolveSelect>;
    try{expanded=expandAndResolveSelect(select,schema)}
    catch(error){if(error instanceof NameResolutionError)throw new JSQLiteError("sqlite",error.message,{code:1});throw error;}
    const compilation=compileWindowSelectLowering(expanded,encoding,database,maxWorkUnits,maxResultBytes,privateStateLimits,schema,undefined,owner?.destination?{builder:owner.builder,parameters:owner.parameters,destination:owner.destination}:undefined);
    // Publish only a completely represented result list. This is the same
    // atomic gate used by table-backed window lowering.
    if(compilation.program.columns.length===expanded.result.length&&expanded.result.length>0)
      return Object.freeze({...compilation.program,...(database?{database}:{}),maxRows});
    throw new JSQLiteError("unsupported","window functions are not implemented",{unsupportedClassification:"temporary"});
  }
  // where.c sqlite3WhereBegin, zero-table loop: nOBSat is the entire
  // ORDER BY. Resolve its expressions first; one candidate needs no sorter.
  const singleton=!select.hasValues&&!select.hasCompound&&!select.from.items.length&&!select.hasGroupBy&&!select.hasHaving&&!selectHasAggregate(select);
  if(singleton&&select.hasOrderBy){
    if(!schema)throw new JSQLiteError('unsupported','ordered scalar resolution requires schema',{unsupportedClassification:'temporary'});
    try{expandAndResolveSelect(select,schema)}catch(error){if(error instanceof NameResolutionError)throw new JSQLiteError('sqlite',error.message,{code:1});throw error;}
    select={...select,hasOrderBy:false,orderBy:Object.freeze([])};
  }
  rejectUnsupportedSelectClauses(singleton?{...select,hasDistinct:false}:select);
  if(select.hasCompound&&!select.hasOrderBy&&schema&&database&&select.arms.some(arm=>arm.from.items.length||arm.where!==null||arm.hasDistinct||arm.hasGroupBy||arm.hasHaving)&&select.arms.slice(1).every(arm=>arm.operatorFromPrior==='union-all')){
    const compound=owner?.destination?compileCteUnionAll(select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{builder:owner.builder,parameters:owner.parameters,destination:owner.destination}):compileCteUnionAll(select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits);
    if(compound){if('ops' in compound)return compound;
      return Object.freeze({columns:compound.columns,ops:owner!.builder.ops,registers:owner!.builder.registers,parameters:Object.freeze(owner!.parameters.names.map(name=>Object.freeze({name}))),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,encoding});}
  }
  if(select.hasCompound){
    // select.c:multiSelect's unordered UNION ALL route emits each arm to one
    // SRT_Output destination while sharing the compound LIMIT/OFFSET registers.
    // Other operators/orderings remain atomic prepare-time unsupported until the
    // coroutine merge route is complete.
    const operators=select.arms.slice(1).map(arm=>arm.operatorFromPrior);
    const orderedAll=select.hasOrderBy&&operators.every(op=>op==="union-all");
    const distinctSet=operators.some(op=>op!=="union-all")&&operators.every(op=>op==="union-all"||op==="union"||op==="intersect"||op==="except");
    if((select.hasOrderBy&&!distinctSet&&!orderedAll)||(!distinctSet&&!orderedAll&&operators.some(op=>op!=="union-all"))||select.arms.some(arm=>arm.from.items.length||arm.where!==null||arm.hasDistinct||arm.hasGroupBy||arm.hasHaving))
      throw new JSQLiteError("unsupported","ordered and mixed set compound SELECTs are not implemented",{unsupportedClassification:"temporary"});
    const width=select.arms[0]?.result.length??0;
    if(!width||select.arms.some(arm=>arm.result.length!==width||(arm.origin==="values"&&arm.valuesRows!.some(row=>row.length!==width)))){const mismatch=select.arms.find(arm=>arm.result.length!==width||(arm.origin==="values"&&arm.valuesRows!.some(row=>row.length!==width))),word=mismatch?.operatorFromPrior==="union-all"?"UNION ALL":mismatch?.operatorFromPrior?.toUpperCase()??"UNION";throw new JSQLiteError("sqlite",`SELECTs to the left and right of ${word} do not have the same number of result columns`,{code:1});}
    if(distinctSet||orderedAll){
      if(distinctSet&&select.hasOrderBy&&(select.orderBy.length!==1||width!==1))throw new JSQLiteError('unsupported','multi-column compound ORDER BY merge is not implemented',{unsupportedClassification:'temporary'});
      if(!schema||!database)throw new JSQLiteError('unsupported','compound merge requires database context',{unsupportedClassification:'temporary'});
      const mergeBuilder=owner?.builder??new SelectProgramBuilder<Op>(),mergeParameters:ParameterBuilder=owner?.parameters??{maximum:0,names:[],named:new Map()};
      emitScalarCompoundMerge(select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,mergeBuilder,mergeParameters,owner?.destination??{kind:'output'});
      if(!owner)mergeBuilder.ops.push({code:'Halt'});
      const names=select.arms[0]!.result.map(expression=>expressionName(expression));
      return Object.freeze({database,maxRows,ops:owner?mergeBuilder.ops:Object.freeze(mergeBuilder.ops),registers:mergeBuilder.registers,maxWorkUnits,maxResultBytes,privateStateLimits,encoding,parameters:Object.freeze(mergeParameters.names.map(name=>Object.freeze({name}))),columns:Object.freeze(names.map(name=>Object.freeze({name,declaredType:null,database:null,table:null,origin:null})))});
    }
    const compoundBuilder=owner?.builder??new SelectProgramBuilder<Op>(),ops=compoundBuilder.ops,parameters:ParameterBuilder=owner?.parameters??{maximum:0,names:[],named:new Map()};
    const limit=computeLimitRegisters(select,ops,()=>compoundBuilder.register(),parameters),haltJumps:number[]=[];
    // multiSelect TK_ALL compiles each arm to the same output destination;
    // common LIMIT/OFFSET belong to the compound, never an individual row.
    for(const arm of select.arms)for(const expressions of arm.valuesRows??[arm.result]){
      const rowSelect={...select,result:expressions,from:arm.from,where:arm.where,hasCompound:false,hasValues:false,hasOrderBy:false,orderBy:Object.freeze([]),limit:null,arms:Object.freeze([{...arm,result:expressions,origin:'select' as const,valuesRows:null}])};
      if(schema){try{expandAndResolveSelect(rowSelect,schema)}catch(error){if(error instanceof NameResolutionError)throw new JSQLiteError('sqlite',error.message,{code:1});throw error;}}
      compileScalarSelect(rowSelect,encoding,maxWorkUnits,maxResultBytes,privateStateLimits,schema,database,maxRows,{builder:compoundBuilder,parameters,emitRow:(first,count)=>{
        const skip=limit?.offset!==undefined?ops.length:-1;if(skip>=0)ops.push({code:'IfPos',p1:limit!.offset!,p2:0,p3:1});
        if(owner)owner.emitRow(first,count);else emitSelectDestination(ops,{kind:'output'},first,count);
        if(limit){haltJumps.push(ops.length);ops.push({code:'DecrJumpZero',p1:limit.count,p2:0});}
        if(skip>=0)(ops[skip] as {p2:number}).p2=ops.length;
      }});
    }
    const halt=ops.length;if(!owner)ops.push({code:'Halt'});if(limit){(ops[limit.ifZero] as {p2:number}).p2=halt;for(const at of haltJumps)(ops[at] as {p2:number}).p2=halt;}
    const names=select.arms[0]!.result.map((expression,index)=>select.arms[0]!.origin==='values'?`column${index+1}`:expressionName(expression));
    return Object.freeze({... (database?{database,maxRows}:{}),ops:owner?ops:Object.freeze(ops),registers:compoundBuilder.registers,maxWorkUnits,maxResultBytes,privateStateLimits,encoding,parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),columns:Object.freeze(names.map(name=>Object.freeze({name,declaredType:null,database:null,table:null,origin:null})))});
  }
  if (select.hasValues) {
    const arm=select.arms[0],rows=arm?.valuesRows;
    if(!rows?.length||!rows[0]?.length)throw new JSQLiteError("sqlite","VALUES must have at least one column",{code:1});
    const width=rows[0].length;
    if(rows.some(row=>row.length!==width))throw new JSQLiteError("sqlite","all VALUES must have the same number of terms",{code:1});
    // multiSelectValues calls selectInnerLoop for each row EList in source
    // order. Compose its expression/destination body on the enclosing builder.
    const builder=owner?.builder??new SelectProgramBuilder<Op>(),ops=builder.ops;
    const parameters=owner?.parameters??{maximum:0,names:[],named:new Map()};
    for(const row of rows){
      const rowSelect={...select,result:row,hasValues:false,arms:Object.freeze([{...arm!,result:row,origin:'select' as const,valuesRows:null}])};
      if(schema){try{expandAndResolveSelect(rowSelect,schema)}catch(error){if(error instanceof NameResolutionError)throw new JSQLiteError('sqlite',error.message,{code:1});throw error;}}
      compileScalarSelect(rowSelect,encoding,maxWorkUnits,maxResultBytes,privateStateLimits,schema,database,maxRows,{builder,parameters,emitRow:owner?.emitRow??((first,count)=>emitSelectDestination(ops,{kind:'output'},first,count))});
    }
    if(!owner)ops.push({code:'Halt'});
    return Object.freeze({... (database?{database,maxRows}:{}),ops:owner?ops:Object.freeze(ops),registers:builder.registers,maxWorkUnits,maxResultBytes,privateStateLimits,encoding,parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),columns:Object.freeze(rows[0].map((_,index)=>Object.freeze({name:`column${index+1}`,declaredType:null,database:null,table:null,origin:null})))});
  }
  if (select.from.items.length) throw new JSQLiteError("unsupported", "table SELECT compilation is not implemented", { unsupportedClassification: "temporary" });
  if (!select.result.length) throw new JSQLiteError("sqlite", "SELECT has no result columns", { code: 1 });
  if(owner&&(select.hasCompound||select.hasValues||select.from.items.length||select.hasOrderBy||select.hasGroupBy||select.hasHaving||selectHasWindow(select)||selectHasAggregate(select)))throw new JSQLiteError("unsupported","shared scalar destination shape is not implemented",{unsupportedClassification:"temporary"});
  // select.c columnTypeImpl owns TK_SELECT provenance independently of the
  // chosen WHERE/destination lowering route. Resolve the enclosing metadata
  // relationship before shared scalar children can change physical code paths.
  let scalarResolved:ReturnType<typeof expandAndResolveSelect>|undefined;
  if(schema){
    try{scalarResolved=expandAndResolveSelect(select,schema)}
    catch(error){if(error instanceof NameResolutionError)throw new JSQLiteError('sqlite',error.message,{code:1});throw error;}
  }
  const selectProgramBuilder=owner?.builder??new SelectProgramBuilder<Op>();
  const ops=selectProgramBuilder.ops;
  const resultOps=ops;
  const scalarSetup=ops.length;ops.push({code:"Goto",p2:0});
  const scalarBody=ops.length;
  const allocate = () => selectProgramBuilder.register();
  const parameters: ParameterBuilder = owner?.parameters??{ maximum: 0, names: [], named: new Map() };
  // This SELECT has no FROM cursor of its own. Nested producers are assigned
  // consecutive ranges, just as Parse.nTab is advanced by sqlite3CodeSubselect.
  const subqueryColumns=new Map<SelectNode,Program["columns"][number]>();
  const postProducerPredicates=new WeakMap<SelectNode,SelectNode['where']>();
  // resolve.c:lookupName retains the owner of outer references; do not
  // implicitly use cursor zero when compiling a no-FROM child inside a scan.
  const correlatedColumns=new WeakMap<SelectNode,Map<Reduction,{cursor:number;index:number;affinity:MemAffinity;collation:BuiltinCollation}>>();
  const bindCorrelated=(select:SelectNode,tree:Expression,reduction:Reduction):Expression=>{
    const uses=correlatedColumns.get(select);
    if(!uses)return tree;
    const visit=(value:Expression,node:Reduction):void=>{
      if(value.kind==='column'){
        const use=uses.get(node);
        if(use){value.cursor=use.cursor;value.index=use.index;value.affinity=use.affinity;value.collation=use.collation;}
        return;
      }
      const children=descendantExprs(node);
      if(value.kind==='collate'||value.kind==='cast'||value.kind==='unary')visit(value.value,children[0] as Reduction);
      else if(value.kind==='binary'){visit(value.left,children[0] as Reduction);visit(value.right,children[1] as Reduction);}
      else if(value.kind==='call'){
        // expressionFromReduction obtains call arguments from exprlist, in order.
        // Apply resolve.c's per-column ownership to those same reductions.
        const list=directReduction(node,'exprlist ::=');
        const args=list?listExpressions(list,'nexprlist ::='):[];
        if(args.length===value.args.length)value.args.forEach((arg,index)=>visit(arg,args[index]!));
      }
    };
    visit(tree,reduction);
    return tree;
  };
  const compileSubquery=(expression:SubqueryExpression):number=>{
    if(expression.select.result.length!==1)throw new JSQLiteError("sqlite",`sub-select returns ${expression.select.result.length} columns - expected 1`,{code:1});
    // select.c:multiSelectValues / multiSelect UNION ALL emit each constant row,
    // sharing the outer Parse/Vdbe and the destination from expr.c.
    if((expression.select.hasValues||expression.select.hasCompound)&&expression.select.arms.every(arm=>!arm.from.items.length)&&!expression.select.hasDistinct&&!expression.select.where&&!expression.select.hasGroupBy&&!expression.select.hasHaving){
      const nested=expression.select;
      const rows=nested.arms.flatMap(arm=>arm.origin==="values"?arm.valuesRows??[]:[arm.result]);
      if(rows.length&&nested.arms.every(arm=>!arm.from.items.length&&!arm.where&&!arm.hasDistinct&&!arm.hasGroupBy&&!arm.hasHaving&&!selectHasAggregate({...nested,result:arm.result,orderBy:[],groupBy:[],having:null,where:null})&&!selectHasWindow({...nested,result:arm.result,orderBy:[],groupBy:[],having:null,where:null})&&(!arm.operatorFromPrior||["union-all","union","except","intersect"].includes(arm.operatorFromPrior)))&&rows.every(row=>row.length===1&&row[0]?.reduction)){
        const operators=nested.arms.slice(1).map(arm=>arm.operatorFromPrior);
        const setOperators=operators.some(op=>op!=="union-all");
        const lastSet=operators.reduce((last,op,index)=>op==="union-all"?last:index+1,-1);
        // multiSelect's set prefix is consumed through a typed ephemeral
        // cursor; later ALL arms retain their original source order.
        // The one-column set cursor owns duplicate comparison independently
        // of the final ORDER key. Mixed set/ALL ordering still needs merge.
        if(setOperators&&nested.hasOrderBy&&lastSet!==nested.arms.length-1)throw new JSQLiteError("unsupported","ordered mixed set expression compound child is not implemented",{unsupportedClassification:"temporary"});
        // select.c:multiSelectByMerge sorts each arm by the resolved result
        // key before delivering to sqlite3CodeSubselect's Mem/Exists/Set.
        // A single result ordinal (or matching result expression) has the
        // same typed key and payload; our async sorter merges the finite
        // constant arms into that destination without a completed Program.
        const order=nested.orderBy[0];
        const orderTree=order?.expr.reduction?expressionFromReduction(order.expr.reduction):null;
        const match=orderTree?.kind==="collate"?orderTree.value:orderTree;
        const ordered=nested.hasOrderBy&&nested.hasCompound&&nested.orderBy.length===1&&!!match&&(
          (match.kind==="literal"&&match.value===1n)||
          (match.kind==="column"&&!match.name.includes(".")&&nested.arms.some(arm=>arm.result[0]?.alias&&sqliteIdentifierEqual(arm.result[0].alias,sqlName(match.name))))||
          nested.arms.some(arm=>arm.result[0]?.reduction&&compoundOrderExpressionEqual(match,expressionFromReduction(arm.result[0].reduction)))
        );
        if(nested.hasOrderBy&&!ordered)throw new JSQLiteError("unsupported","this ordered expression subquery shape is not implemented",{unsupportedClassification:"temporary"});
        const destination=allocate(),isIn=expression.kind==="in-subquery";
        const setCursor=isIn?selectProgramBuilder.cursor():-1;
        const sorter=ordered?selectProgramBuilder.cursor():-1;
        const setResultCursor=setOperators?selectProgramBuilder.cursor():-1;
        const auxCursor=setOperators?selectProgramBuilder.cursor():-1;
        if(setOperators){const keyInfo=new KeyInfo({encoding:database?.encoding??encoding,totalFieldCount:1,keyFieldCount:1,terms:[{collation:collation(expressionFromReduction(rows[0]![0]!.reduction!))}]});resultOps.push({code:"OpenEphemeral",p1:setResultCursor,keyInfo},{code:"OpenEphemeral",p1:auxCursor,keyInfo});}
        if(ordered)resultOps.push({code:"SorterOpen",p1:sorter,keyInfo:new KeyInfo({encoding:database?.encoding??encoding,totalFieldCount:1,keyFieldCount:1,terms:[{collation:explicitCollation(orderTree!)??collation(expressionFromReduction(rows[0]![0]!.reduction!)),desc:order!.descending,nullsLarge:order!.nulls==="last"?!order!.descending:order!.nulls==="first"?order!.descending:false}]})});
        if(isIn){
          if(!database)throw new JSQLiteError("unsupported","this expression subquery shape is not implemented",{unsupportedClassification:"temporary"});
          resultOps.push({code:"OpenEphemeral",p1:setCursor,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:1,keyFieldCount:1,terms:[{collation:collation(expression.left)}]})});
        }else resultOps.push(expression.exists?{code:"Integer",p1:0n,p2:destination}:{code:"Null",p2:destination});
        // expr.c:sqlite3CodeSubselect evaluates the non-correlated RHS once.
        const once=allocate(),onceAt=resultOps.length;resultOps.push({code:"Once",p1:once,p2:0});
        const limit=nested.limit?computeLimitRegisters(nested,resultOps,allocate,parameters):undefined;
        const exits:number[]=[],skips:number[]=[],setStops:number[]=[];
        const drainSet=()=>{
          resultOps.push({code:"EphemeralSort",p1:setResultCursor});
          const rewind=resultOps.length;resultOps.push({code:"EphemeralRewind",p1:setResultCursor,p2:0});
          const value=allocate();resultOps.push({code:"EphemeralData",p1:setResultCursor,p2:value,count:1});
          if(ordered){resultOps.push({code:"SorterInsert",p1:sorter,keyStart:value,keyCount:1,payload:value,payloadCount:1});resultOps.push({code:"EphemeralNext",p1:setResultCursor,p2:rewind+1});(resultOps[rewind] as {p2:number}).p2=resultOps.length;return;}
          let skip=-1;
          if(limit?.offset!==undefined){skip=resultOps.length;resultOps.push({code:"IfPos",p1:limit.offset,p2:0,p3:1});}
          emitSelectDestination(resultOps,isIn?{kind:"set",cursor:setCursor}:expression.exists?{kind:"exists",register:destination}:{kind:"mem",register:destination},value,1);
          const stop=resultOps.length;
          if(!isIn)resultOps.push({code:"Goto",p2:0});
          else if(limit)resultOps.push({code:"DecrJumpZero",p1:limit.count,p2:0});
          const advance=resultOps.length;resultOps.push({code:"EphemeralNext",p1:setResultCursor,p2:rewind+1});
          if(skip>=0)(resultOps[skip] as {p2:number}).p2=advance;
          (resultOps[rewind] as {p2:number}).p2=resultOps.length;
          if(!isIn||limit)setStops.push(stop);
        };
        for(let armIndex=0;armIndex<nested.arms.length;armIndex++){
          if(setOperators&&armIndex===lastSet+1)drainSet();
          const arm=nested.arms[armIndex]!;
          const operator=arm.operatorFromPrior;
          for(const row of arm.origin==="values"?arm.valuesRows!:[arm.result]){
          if(setOperators&&armIndex<=lastSet){
            const value=compileExpressionTree(expressionFromReduction(row[0]!.reduction!),resultOps,allocate,parameters,compileSubquery);
            if(armIndex===0||operator==="union"||operator==="union-all")resultOps.push({code:"IdxInsert",p1:setResultCursor,keyStart:value,keyCount:1,replace:true});
            else if(operator==="except")resultOps.push({code:"SetDelete",p1:setResultCursor,keyStart:value,keyCount:1});
            else resultOps.push({code:"IdxInsert",p1:auxCursor,keyStart:value,keyCount:1,replace:true});
            continue;
          }
          if(ordered){const value=compileExpressionTree(expressionFromReduction(row[0]!.reduction!),resultOps,allocate,parameters,compileSubquery);resultOps.push({code:"SorterInsert",p1:sorter,keyStart:value,keyCount:1,payload:value,payloadCount:1});continue;}
          if(limit?.offset!==undefined){const at=resultOps.length;resultOps.push({code:"IfPos",p1:limit.offset,p2:0,p3:1});skips.push(at);}
          if(expression.kind==="scalar-subquery"&&expression.exists)emitSelectDestination(resultOps,{kind:"exists",register:destination},destination,1);
          else {const value=compileExpressionTree(expressionFromReduction(row[0]!.reduction!),resultOps,allocate,parameters,compileSubquery);emitSelectDestination(resultOps,isIn?{kind:"set",cursor:setCursor}:{kind:"mem",register:destination},value,1);}
          if(!isIn||limit){exits.push(resultOps.length);resultOps.push(!isIn?{code:"Goto",p2:0}:{code:"DecrJumpZero",p1:limit!.count,p2:0});}
          if(skips.length)(resultOps[skips.pop()!] as {p2:number}).p2=resultOps.length;
          }
          if(setOperators&&operator==="intersect")resultOps.push({code:"SetRetainIntersection",p1:setResultCursor,p2:auxCursor},{code:"ClearEphemeral",p1:auxCursor});
        }
        if(setOperators&&lastSet===nested.arms.length-1)drainSet();
        if(ordered){
          const sortAt=resultOps.length;resultOps.push({code:"SorterSort",p1:sorter,emptyJump:0});
          const value=allocate();resultOps.push({code:"SorterData",p1:sorter,p2:value,count:1});
          let skip=-1;
          if(limit?.offset!==undefined){skip=resultOps.length;resultOps.push({code:"IfPos",p1:limit.offset,p2:0,p3:1});}
          emitSelectDestination(resultOps,isIn?{kind:"set",cursor:setCursor}:expression.exists?{kind:"exists",register:destination}:{kind:"mem",register:destination},value,1);
          const stop=resultOps.length;
          if(!isIn)resultOps.push({code:"Goto",p2:0});
          else if(limit)resultOps.push({code:"DecrJumpZero",p1:limit.count,p2:0});
          const advance=resultOps.length;resultOps.push({code:"SorterNext",p1:sorter,p2:sortAt+1});
          const endSorted=resultOps.length;
          if(skip>=0)(resultOps[skip] as {p2:number}).p2=advance;
          (resultOps[sortAt] as {emptyJump:number}).emptyJump=endSorted;
          if(!isIn||limit)(resultOps[stop] as {p2:number}).p2=endSorted;
        }
        const end=resultOps.length;
        for(const at of setStops)(resultOps[at] as {p2:number}).p2=end;
        for(const at of exits)(resultOps[at] as {p2:number}).p2=end;
        if(limit)(resultOps[limit.ifZero] as {p2:number}).p2=end;
        (resultOps[onceAt] as {p2:number}).p2=end;
        if(isIn){const left=compileExpressionTree(expression.left,resultOps,allocate,parameters,compileSubquery);resultOps.push({code:"InSet",p1:setCursor,key:left,output:destination,affinity:inComparisonAffinity(expression.left,expressionFromReduction(rows[0]![0]!.reduction!)),negated:expression.negated});}
        return destination;
      }
    }
    // Retained compound aggregate must reach its existing parent SRT owner
    // before the generic retained-derived projection admission gate.
    if(selectHasAggregate(expression.select)&&aggregateShapeSupported(expression.select)&&expression.select.from.derived?.select.hasCompound&&!expression.select.hasGroupBy&&!expression.select.where&&!expression.select.hasOrderBy&&!expression.select.hasHaving&&!expression.select.hasDistinct&&expression.select.result.length===1){
      if(!schema||!database)throw new JSQLiteError('unsupported','this expression subquery shape is not implemented',{unsupportedClassification:'temporary'});
      const nested=expression.select,destination=allocate(),isIn=expression.kind==="in-subquery";
      const setCursor=isIn?selectProgramBuilder.cursor():-1;
      if(isIn)resultOps.push({code:"OpenEphemeral",p1:setCursor,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:1,keyFieldCount:1,terms:[{collation:collation(expression.left)}]})});
      else resultOps.push(expression.exists?{code:"Integer",p1:0n,p2:destination}:{code:"Null",p2:destination});
      const once=allocate(),onceAt=resultOps.length;
      resultOps.push({code:"Once",p1:once,p2:0});
      compileAggregateSelect(nested,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{builder:selectProgramBuilder,ops:resultOps,parameters,destination:isIn?{kind:"set",cursor:setCursor}:expression.exists?{kind:"exists",register:destination}:{kind:"mem",register:destination}});
      (resultOps[onceAt] as {p2:number}).p2=resultOps.length;
      if(isIn){const left=compileExpressionTree(expression.left,resultOps,allocate,parameters,compileSubquery);resultOps.push({code:"InSet",p1:setCursor,key:left,output:destination,affinity:inComparisonAffinity(expression.left,expressionFromReduction(nested.result[0]!.reduction!)),negated:expression.negated});}
      return destination;
    }
    // select.c tag-select-0820: a zero-source ungrouped aggregate finalizes
    // even when WHERE rejects its input; grouped inputs instead visit the
    // sorter only when accepted. expr.c consumes Mem/Exists/Set in this Vdbe.
    if((selectHasAggregate(expression.select)||expression.select.hasGroupBy)&&!expression.select.from.items.length&&
       !expression.select.hasCompound&&!expression.select.hasValues&&
       aggregateShapeSupported(expression.select)){
      if(!schema||!database)throw new JSQLiteError("unsupported","this expression subquery shape is not implemented",{unsupportedClassification:"temporary"});
      const nested=expression.select,destination=allocate(),isIn=expression.kind==="in-subquery";
      const cursor=isIn?selectProgramBuilder.cursor():-1;
      if(isIn)resultOps.push({code:"OpenEphemeral",p1:cursor,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:1,keyFieldCount:1,terms:[{collation:collation(expression.left)}]})});
      else resultOps.push(expression.exists?{code:"Integer",p1:0n,p2:destination}:{code:"Null",p2:destination});
      const once=allocate(),onceAt=resultOps.length;
      resultOps.push({code:"Once",p1:once,p2:0});
      compileAggregateSelect(nested,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{builder:selectProgramBuilder,ops:resultOps,parameters,destination:isIn?{kind:"set",cursor}:expression.exists?{kind:"exists",register:destination}:{kind:"mem",register:destination}});
      (resultOps[onceAt] as {p2:number}).p2=resultOps.length;
      if(isIn){const left=compileExpressionTree(expression.left,resultOps,allocate,parameters,compileSubquery);resultOps.push({code:"InSet",p1:cursor,key:left,output:destination,affinity:inComparisonAffinity(expression.left,expressionFromReduction(nested.result[0]!.reduction!)),negated:expression.negated});}
      return destination;
    }
    if(!expression.select.from.items.length&&!expression.select.arms.some(arm=>arm.from.items.length)&&(!expression.select.hasCompound||!expression.select.arms.some(arm=>!!arm.where))){
      const nested=expression.select,item=nested.result[0]!;
      if((nested.where&&!nested.where.reduction)||nested.hasGroupBy||nested.hasHaving||nested.hasCompound||nested.hasValues||!item.reduction)
        throw new JSQLiteError("unsupported","this expression subquery shape is not implemented",{unsupportedClassification:"temporary"});
      // resolve.c:resolveOrderGroupBy validates all ORDER terms against the
      // result list before code generation. A zero-source producer has only
      // one candidate (no sorter), but independent keys still require binding
      // and invalid ordinals/names must fail during prepare.
      if(nested.hasOrderBy){
        if(!schema)throw new JSQLiteError("unsupported","this ordered expression subquery shape is not implemented",{unsupportedClassification:"temporary"});
        try{expandAndResolveSelect(nested,schema)}
        catch(error){if(error instanceof NameResolutionError)throw new JSQLiteError("sqlite",error.message,{code:1});throw error;}
      }
      const destination=allocate();
      // expr.c:sqlite3CodeSubselect initializes Mem/Exists before sqlite3Select;
      // select.c:computeLimitRegisters guards result production, not cursor
      // construction or the outer IN probe. Compile into this parent Vdbe.
      if(expression.kind==="scalar-subquery")resultOps.push(expression.exists?{code:"Integer",p1:0n,p2:destination}:{code:"Null",p2:destination});
      const childLimit=nested.limit&&expression.kind==="scalar-subquery"?computeLimitRegisters(nested,resultOps,allocate,parameters):undefined;
      if(expression.kind==="in-subquery"){
        // expr.c:sqlite3CodeSubselect constructs SRT_Set in the enclosing
        // Parse/Vdbe, then sqlite3ExprCodeIN probes the set. This no-FROM
        // producer has one candidate row; it shares this builder's cursor,
        // register allocation, and VM budget instead of publishing a child.
        if(!database)throw new JSQLiteError("unsupported","this expression subquery shape is not implemented",{unsupportedClassification:"temporary"});
        const cursor=selectProgramBuilder.cursor();
        resultOps.push({code:"OpenEphemeral",p1:cursor,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:1,keyFieldCount:1,terms:[{collation:collation(expression.left)}]})});
        const setLimit=nested.limit?computeLimitRegisters(nested,resultOps,allocate,parameters):undefined;
        const rhs=bindCorrelated(nested,expressionFromReduction(item.reduction),item.reduction as Reduction);
        // select.c:codeOffset skips the single candidate before SRT_Set.
        // LIMIT 0 branches past both the offset and destination emission.
        // select.c's zero-source WhereBegin rejects the candidate before
        // selectInnerLoop's OFFSET and result production.
        let whereSkip=-1;
        if(nested.where?.reduction){const predicate=compileExpressionTree(bindCorrelated(nested,expressionFromReduction(nested.where.reduction),nested.where.reduction as Reduction),resultOps,allocate,parameters,compileSubquery,true);whereSkip=resultOps.length;resultOps.push({code:"IfNot",p1:predicate,p2:0});}
        let offsetSkip=-1;
        if(setLimit?.offset!==undefined){offsetSkip=resultOps.length;resultOps.push({code:"IfPos",p1:setLimit.offset,p2:0,p3:1});}
        const value=compileExpressionTree(rhs,resultOps,allocate,parameters,compileSubquery);
        emitSelectDestination(resultOps,{kind:"set",cursor},value,1);
        if(offsetSkip>=0)(resultOps[offsetSkip] as {p2:number}).p2=resultOps.length;
        if(whereSkip>=0)(resultOps[whereSkip] as {p2:number}).p2=resultOps.length;
        if(setLimit)(resultOps[setLimit.ifZero] as {p2:number}).p2=resultOps.length;
        const left=compileExpressionTree(expression.left,resultOps,allocate,parameters,compileSubquery);
        resultOps.push({code:"InSet",p1:cursor,key:left,output:destination,affinity:inComparisonAffinity(expression.left,rhs),negated:expression.negated});
        return destination;
      }
      // The one-row no-FROM producer applies WHERE then OFFSET before Mem/Exists.
      // It must not evaluate or emit the candidate when either skips it.
      let whereSkip=-1;
      if(nested.where?.reduction){const predicate=compileExpressionTree(bindCorrelated(nested,expressionFromReduction(nested.where.reduction),nested.where.reduction as Reduction),resultOps,allocate,parameters,compileSubquery,true);whereSkip=resultOps.length;resultOps.push({code:"IfNot",p1:predicate,p2:0});}
      const offsetSkip=childLimit?.offset===undefined?-1:resultOps.length;
      if(offsetSkip>=0)resultOps.push({code:"IfPos",p1:childLimit!.offset!,p2:0,p3:1});
      if(expression.exists)resultOps.push({code:"Integer",p1:1n,p2:destination});
      else {const value=compileExpressionTree(bindCorrelated(nested,expressionFromReduction(item.reduction),item.reduction as Reduction),resultOps,allocate,parameters,compileSubquery);resultOps.push({code:"Copy",p1:value,p2:destination});}
      if(offsetSkip>=0)(resultOps[offsetSkip] as {p2:number}).p2=resultOps.length;
      if(whereSkip>=0)(resultOps[whereSkip] as {p2:number}).p2=resultOps.length;
      if(childLimit)(resultOps[childLimit.ifZero] as {p2:number}).p2=resultOps.length;
      return destination;
    }
    if(!schema||!database)throw new JSQLiteError("unsupported","this expression subquery shape is not implemented",{unsupportedClassification:"temporary"});
    // select.c:multiSelect TK_ALL calls sqlite3Select per arm with the same
    // SRT destination. Unordered, unlimited table-backed arms share this builder.
    if(expression.select.hasCompound&&
       !expression.select.hasValues&&!expression.select.hasOrderBy&&
       !expression.select.limit&&!expression.select.offset&&
       expression.select.arms.length>1&&(expression.select.arms.some(arm=>arm.from.items.length>0)||expression.select.arms.some(arm=>!!arm.where))&&
       expression.select.arms.every((arm,index)=>
         (index===0||arm.operatorFromPrior==='union-all')&&
         (arm.from.items.length>0||(arm.result.length===1&&!!arm.result[0]?.reduction&&(!arm.where||!!arm.where.reduction)))&&
         !arm.hasGroupBy&&!arm.hasHaving&&!arm.hasDistinct)){
      const nested=expression.select,destination=allocate(),isIn=expression.kind==='in-subquery';
      const cursor=isIn?selectProgramBuilder.cursor():-1;
      if(isIn)resultOps.push({code:'OpenEphemeral',p1:cursor,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:1,keyFieldCount:1,terms:[{collation:collation(expression.left)}]})});
      else resultOps.push(expression.exists?{code:'Integer',p1:0n,p2:destination}:{code:'Null',p2:destination});
      const found=!isIn&&!expression.exists?allocate():-1;
      if(found>=0)resultOps.push({code:'Integer',p1:0n,p2:found});
      const once=allocate(),onceAt=resultOps.length;resultOps.push({code:'Once',p1:once,p2:0});
      const exits:number[]=[];
      for(const arm of nested.arms){
        // select.c:selectInnerLoop SRT_Mem/Exists returns after the first
        // accepted row; skip subsequent UNION ALL arms once it is filled.
        if(!isIn){exits.push(resultOps.length);resultOps.push({code:'IfPos',p1:expression.exists?destination:found,p2:0,p3:0});}
        const part:SelectNode={...nested,result:arm.result,from:arm.from,where:arm.where,
          hasDistinct:arm.hasDistinct,hasGroupBy:false,hasHaving:false,
          hasCompound:false,hasOrderBy:false,hasLimit:false,orderBy:Object.freeze([]),
          limit:null,offset:null,arms:Object.freeze([arm])};
        if(selectHasAggregate(part)||selectHasWindow(part))throw new JSQLiteError('unsupported','aggregate or window compound arm is not implemented',{unsupportedClassification:'temporary'});
        if(!arm.from.items.length){
          // multiSelect sends the no-FROM arm's single selectInnerLoop row to
          // the same destination, without a separate cursor or child Program.
          const item=arm.result[0]!;
          // where.c tests the no-FROM candidate before selectInnerLoop codes
          // the result and sends it to the compound's shared destination.
          let whereSkip=-1;
          if(arm.where?.reduction){
            const predicate=compileExpressionTree(bindCorrelated(part,expressionFromReduction(arm.where.reduction),arm.where.reduction as Reduction),resultOps,allocate,parameters,compileSubquery,true);
            whereSkip=resultOps.length;resultOps.push({code:'IfNot',p1:predicate,p2:0});
          }
          const value=compileExpressionTree(bindCorrelated(part,expressionFromReduction(item.reduction!),item.reduction as Reduction),resultOps,allocate,parameters,compileSubquery);
          emitSelectDestination(resultOps,isIn?{kind:'set',cursor}:expression.exists?{kind:'exists',register:destination}:{kind:'mem',register:destination,found},value,1);
          if(whereSkip>=0)(resultOps[whereSkip] as {p2:number}).p2=resultOps.length;
        }else{
          let expanded:ReturnType<typeof expandAndResolveSelect>;
          try{expanded=expandAndResolveSelect(part,schema,null,selectProgramBuilder.cursors)}
          catch(error){if(error instanceof NameResolutionError)throw new JSQLiteError('sqlite',error.message,{code:1});throw error;}
          compileInnerTableSelect(part,expanded,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,
            {builder:selectProgramBuilder,ops:resultOps,parameters,destination:isIn?{kind:'set',cursor}:expression.exists?{kind:'exists',register:destination}:{kind:'mem',register:destination,found}});
        }
      }
      const end=resultOps.length;
      for(const at of exits)(resultOps[at] as {p2:number}).p2=end;
      (resultOps[onceAt] as {p2:number}).p2=end;
      if(!isIn&&!expression.exists){let expanded:ReturnType<typeof expandAndResolveSelect>;
        const arm=nested.arms[0]!,part:SelectNode={...nested,result:arm.result,from:arm.from,where:arm.where,hasCompound:false,hasOrderBy:false,hasLimit:false,orderBy:Object.freeze([]),limit:null,offset:null,arms:Object.freeze([arm])};
        try{expanded=expandAndResolveSelect(part,schema,null,selectProgramBuilder.cursors)}catch(error){if(error instanceof NameResolutionError)throw new JSQLiteError('sqlite',error.message,{code:1});throw error;}
        const column=expanded.result[0]!;subqueryColumns.set(nested,{name:column.name,declaredType:column.descriptor.declaredType,database:column.descriptor.database,table:column.descriptor.table,origin:column.descriptor.origin});
      }
      if(isIn){const left=compileExpressionTree(expression.left,resultOps,allocate,parameters,compileSubquery);
        resultOps.push({code:'InSet',p1:cursor,key:left,output:destination,affinity:inComparisonAffinity(expression.left,expressionFromReduction(nested.result[0]!.reduction!)),negated:expression.negated});}
      return destination;
    }
    if(expression.select.hasCompound||expression.select.hasValues)throw new JSQLiteError("unsupported","this expression subquery shape is not implemented",{unsupportedClassification:"temporary"});
    // select.c:sqlite3Select/selectInnerLoop: emit a simple table SrcList
    // directly into the enclosing Parse/Vdbe. This bounded producer owns its
    // cursor, registers, LIMIT and destination, not a published child Program.
    const nested=expression.select;
    if(nested.from.items.length===1&&!nested.from.derived&&!nested.hasCompound&&!nested.hasValues&&
       !nested.hasGroupBy&&!nested.hasHaving&&!selectHasAggregate(nested)&&!selectHasWindow(nested)){
      const source=nested.from.items[0]!,view=schema.views.get(sqliteAsciiFold(sqlName(source.tableName)));
      if(view&&source.databaseName===null&&source.on===null&&source.using===null){
        // select.c:flattenSubquery and build.c:sqlite3ViewGetColumnNames:
        // substitute the view-visible columns before entering the same
        // enclosing-builder direct scan used by ordinary scalar children.
        const flattened=flattenImmutableView(nested,view);
        return compileSubquery({...expression,select:flattened});
      }
    }
    // Retained producer predicates run after producer LIMIT, not in this direct child.
    if(!postProducerPredicates.has(nested)&&!nested.hasSubquery&&nested.from.items.length===1&&!nested.from.derived&&!nested.from.cteDerived?.length&&
       !nested.hasGroupBy&&!nested.hasHaving&&!selectHasAggregate(nested)&&!selectHasWindow(nested)){
      // select.c/expr.c: the ordinary child uses the enclosing destination and
      // normalized first-row limiter, not a separate scan-only evaluator.
      const plan=expandAndResolveSelect(nested,schema,null,selectProgramBuilder.cursors);
      const source=plan.sources[0]!;
      if(!source.table.withoutRowid&&!source.table.columns.some(column=>column.generatedExpr)){
        const destination=allocate(),isIn=expression.kind==='in-subquery';
        const cursor=isIn?selectProgramBuilder.cursor():-1;
        if(isIn)resultOps.push({code:'OpenEphemeral',p1:cursor,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:1,keyFieldCount:1,terms:[{collation:collation(expression.left)}]})});
        else resultOps.push(expression.exists?{code:'Integer',p1:0n,p2:destination}:{code:'Null',p2:destination});
        const once=allocate(),onceAt=resultOps.length;resultOps.push({code:'Once',p1:once,p2:0});
        let childLimit:LimitRegisters|undefined;
        if(isIn)childLimit=computeLimitRegisters(nested,resultOps,allocate,parameters);
        else {
          const scalar=computeScalarLimitRegisters(nested,resultOps,allocate,parameters,compileSubquery);
          const count=scalar?.count??allocate();if(!scalar)resultOps.push({code:'Integer',p1:1n,p2:count});
          const ifZero=scalar?.ifZero??resultOps.length;if(!scalar)resultOps.push({code:'IfNot',p1:count,p2:0});
          const offset=nested.offset?compileExpressionTree(expressionFromReduction(nested.offset.reduction!),resultOps,allocate,parameters,compileSubquery):undefined;
          if(offset!==undefined)resultOps.push({code:'MustBeInt',p1:offset});
          const combined=allocate(),capacity=allocate();
          resultOps.push(offset===undefined?{code:'Copy',p1:count,p2:combined}:{code:'OffsetLimit',p1:count,p2:combined,p3:offset},{code:'Copy',p1:combined,p2:capacity});
          childLimit={count,ifZero,combined,capacity,...(offset===undefined?{}:{offset})};
        }
        compileInnerTableSelect(nested,plan,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{builder:selectProgramBuilder,ops:resultOps,parameters,destination:isIn?{kind:'set',cursor}:expression.exists?{kind:'exists',register:destination}:{kind:'mem',register:destination},scalarPrepared:true,...(childLimit?{sharedLimit:childLimit}:{})});
        (resultOps[onceAt] as {p2:number}).p2=resultOps.length;
        if(isIn){const left=compileExpressionTree(expression.left,resultOps,allocate,parameters,compileSubquery);resultOps.push({code:'InSet',p1:cursor,key:left,output:destination,affinity:comparisonAffinity(expressionAffinity(expression.left),plan.result[0]!.descriptor.affinity??expressionAffinity(expressionFromReduction(nested.result[0]!.reduction!))),negated:expression.negated});}
        return destination;
      }
    }
    const derived=nested.from.derived;
    // select.c:flattenSubquery restriction (7) leaves a zero-source FROM
    // producer unflattened. Emit its result into the outer SRT destination
    // within this Parse rather than relocating a finished child Program.
    if(derived&&derived.index===0&&nested.from.items.length===1&&
       derived.select.from.items.length===0&&!derived.select.hasCompound&&
       !derived.select.hasValues&&!derived.select.hasGroupBy&&!derived.select.hasHaving&&
       !selectHasWindow(derived.select)&&
       !nested.hasGroupBy&&!nested.hasHaving&&!nested.hasDistinct&&!nested.hasOrderBy&&
       !selectHasAggregate(nested)&&!selectHasWindow(nested)&&
       (!nested.where||nested.where.reduction)&&
       derived.select.result.length>0&&derived.select.result.every(item=>item.reduction)&&
       (!derived.select.where||derived.select.where.reduction)&&nested.result.length===1&&
       nested.result[0]?.reduction){
      const source=derived.select,alias=nested.from.items[0]!.alias??nested.from.items[0]!.tableName;
      const names=uniqueTransientColumnNames(source.result.map(item=>item.alias??expressionName(item)));
      // resolve.c binds the transient producer columns to row registers.
      const sourceRegisters=source.result.map(()=>allocate());
      const bind=(tree:Expression):Expression=>{
        if(tree.kind==="column"){
          const parts=tree.name.split('.').map(sqlName);
          const index=parts.length<=2&&(parts.length===1||sqliteIdentifierEqual(parts[0]!,alias))?names.findIndex(name=>sqliteIdentifierEqual(name,parts.at(-1)!)):-1;
          return index>=0?{kind:"register",index:sourceRegisters[index]!}:tree;
        }
        if(tree.kind==="binary")return{...tree,left:bind(tree.left),right:bind(tree.right)};
        if(tree.kind==="unary"||tree.kind==="cast"||tree.kind==="collate")return{...tree,value:bind(tree.value)};
        if(tree.kind==="call")return{...tree,args:tree.args.map(bind)};
        return tree;
      };
      const outerTree=bind(expressionFromReduction(nested.result[0]!.reduction!));
      // A surviving column reference needs a source cursor/NameContext not
      // provided by this no-FROM producer. Reject before emitting any ops.
      const hasUnboundColumn=(tree:Expression):boolean=>tree.kind==="column"||
        (tree.kind==="binary"&&(hasUnboundColumn(tree.left)||hasUnboundColumn(tree.right)))||
        (tree.kind==="unary"&&hasUnboundColumn(tree.value));
      // resolve.c:resolveOrderGroupBy resolves AS names and integer ordinals
      // to the producer EList before treating an ORDER term as an expression.
      const orderTrees=source.orderBy.map((term,index)=>{
        const tree=expressionFromReduction(term.expr.reduction!);
        if(tree.kind==="literal"&&typeof tree.value==="bigint"){
          if(tree.value<1n||tree.value>BigInt(source.result.length))throw new JSQLiteError("sqlite",`${index+1}${(index+1)%100>=11&&(index+1)%100<=13?"th":["th","st","nd","rd"][(index+1)%10]??"th"} ORDER BY term out of range - should be between 1 and ${source.result.length}`,{code:1});
          return {kind:"register" as const,index:sourceRegisters[Number(tree.value)-1]!};
        }
        if(tree.kind==="column"&&!tree.name.includes('.')){
          const resultIndex=source.result.findIndex(item=>item.alias&&sqliteIdentifierEqual(item.alias,sqlName(tree.name)));
          if(resultIndex>=0)return {kind:"register" as const,index:sourceRegisters[resultIndex]!};
        }
        return bind(tree);
      });
      const outerWhere=nested.where?bind(expressionFromReduction(nested.where.reduction!)):null;
      if(hasUnboundColumn(outerTree)||(outerWhere&&hasUnboundColumn(outerWhere))||orderTrees.some(hasUnboundColumn))throw new JSQLiteError("unsupported","derived result column binding is not implemented",{unsupportedClassification:"temporary"});
      const destination=allocate(),isIn=expression.kind==="in-subquery";
          const setCursor=isIn?selectProgramBuilder.cursor():-1;
          if(isIn)resultOps.push({code:"OpenEphemeral",p1:setCursor,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:1,keyFieldCount:1,terms:[{collation:collation(expression.left)}]})});
          else resultOps.push(expression.exists?{code:"Integer",p1:0n,p2:destination}:{code:"Null",p2:destination});
          const once=allocate(),onceAt=resultOps.length;
          resultOps.push({code:"Once",p1:once,p2:0});
          // Outer SELECT's limit is initialized before its FROM producer.
          // The producer's own limit still guards its one candidate first;
          // OFFSET on the outer SELECT skips the resulting row event.
          const outerLimit=computeLimitRegisters(nested,resultOps,allocate,parameters);
          const limit=computeLimitRegisters(source,resultOps,allocate,parameters);
          let whereSkip=-1,offsetSkip=-1,outerWhereSkip=-1,outerOffsetSkip=-1;
          if(source.where){const predicate=compileExpressionTree(expressionFromReduction(source.where.reduction!),resultOps,allocate,parameters,compileSubquery,true);whereSkip=resultOps.length;resultOps.push({code:"IfNot",p1:predicate,p2:0});}
          // select.c:WHERE_DISTINCT_UNIQUE on this no-FROM, single-row
          // producer cannot suppress its sole admitted row. No dedup cursor
          // is needed; evaluate its result row before the outer consumer.
          // Producer result registers are filled exactly once per admitted row.
          source.result.forEach((item,index)=>{const r=compileExpressionTree(expressionFromReduction(item.reduction!),resultOps,allocate,parameters,compileSubquery);resultOps.push({code:"Copy",p1:r,p2:sourceRegisters[index]!});});
          // pushOntoSorter computes ORDER keys on an admitted candidate; with
          // one candidate there is no comparison or sort drain to perform.
          for(const tree of orderTrees)compileExpressionTree(tree,resultOps,allocate,parameters,compileSubquery);
          if(limit?.offset!==undefined){offsetSkip=resultOps.length;resultOps.push({code:"IfPos",p1:limit.offset,p2:0,p3:1});}
          if(outerWhere){
            const predicate=compileExpressionTree(outerWhere,resultOps,allocate,parameters,compileSubquery,true);
            outerWhereSkip=resultOps.length;resultOps.push({code:"IfNot",p1:predicate,p2:0});
          }
          if(outerLimit?.offset!==undefined){outerOffsetSkip=resultOps.length;resultOps.push({code:"IfPos",p1:outerLimit.offset,p2:0,p3:1});}
          const value=compileExpressionTree(outerTree,resultOps,allocate,parameters,compileSubquery);
          emitSelectDestination(resultOps,isIn?{kind:"set",cursor:setCursor}:expression.exists?{kind:"exists",register:destination}:{kind:"mem",register:destination},value,1);
          const end=resultOps.length;
          if(whereSkip>=0)(resultOps[whereSkip] as {p2:number}).p2=end;
          if(outerWhereSkip>=0)(resultOps[outerWhereSkip] as {p2:number}).p2=end;
          if(outerOffsetSkip>=0)(resultOps[outerOffsetSkip] as {p2:number}).p2=end;
          if(outerLimit)(resultOps[outerLimit.ifZero] as {p2:number}).p2=end;
          if(offsetSkip>=0)(resultOps[offsetSkip] as {p2:number}).p2=end;
          if(limit)(resultOps[limit.ifZero] as {p2:number}).p2=end;
          (resultOps[onceAt] as {p2:number}).p2=end;
          if(isIn){const left=compileExpressionTree(expression.left,resultOps,allocate,parameters,compileSubquery);resultOps.push({code:"InSet",p1:setCursor,key:left,output:destination,affinity:inComparisonAffinity(expression.left,outerTree),negated:expression.negated});}
          return destination;
    }
    if(derived&&derived.index===0&&nested.from.items.length===1&&derived.select.from.items.length===1&&
       !derived.select.hasCompound&&!derived.select.hasValues&&!derived.select.hasDistinct&&
       !derived.select.hasGroupBy&&!derived.select.hasHaving&&
       (!derived.select.hasOrderBy||!nested.hasOrderBy)&&
       (!derived.select.hasLimit||(!nested.where&&!nested.hasLimit&&!derived.select.offset))&&
       !selectHasWindow(derived.select)&&
       !nested.hasGroupBy&&!nested.hasHaving&&!selectHasAggregate(nested)&&!selectHasWindow(nested)){
      // select.c:flattenSubquery substitutes transient result columns and
      // splices the source list before selectInnerLoop. The scalar caller
      // allocates its scan and destination in the enclosing builder.
      const names=uniqueTransientColumnNames(derived.select.result.map(item=>item.alias??expressionName(item)));
      const columns=new Map(derived.select.result.map((item,index)=>[sqliteAsciiFold(names[index]!),item]));
      const qualifier=nested.from.items[0]!.alias??nested.from.items[0]!.tableName;
      const result=Object.freeze(nested.result.map(item=>substituteViewExpression(item,columns,qualifier)));
      const where=andViewPredicates(derived.select.where,nested.where?substituteViewExpression(nested.where,columns,qualifier):null);
      // resolve.c:resolveOrderGroupBy binds the producer ORDER against its
      // own EList before flattenSubquery transfers the list to the parent.
      // Substituting the parent EList first loses an AS-name (e.g. x+1 AS y).
      const orderBy=Object.freeze((derived.select.hasOrderBy?derived.select.orderBy:nested.orderBy).map(term=>{
        if(derived.select.hasOrderBy&&term.expr.reduction){
          let key=expressionFromReduction(term.expr.reduction);
          const collations:BuiltinCollation[]=[];
          while(key.kind==='collate'){collations.push(key.collation);key=key.value;}
          let bound:SelectNode['result'][number]|undefined;
          if(key.kind==='literal'&&typeof key.value==='bigint'){
            const width=derived.select.result.length;
            if(key.value<1n||key.value>BigInt(width))throw new JSQLiteError('sqlite',`1st ORDER BY term out of range - should be between 1 and ${width}`,{code:1});
            bound=derived.select.result[Number(key.value)-1]!;
          }
          if(key.kind==='column'&&!key.name.includes('.')){
            bound=derived.select.result.find(item=>item.alias&&sqliteIdentifierEqual(item.alias,sqlName(key.name)));
          }
          if(bound){
            // resolve.c:sqlite3ExprSkipCollateAndLikely resolves the inner
            // alias/ordinal; sqlite3ResolveOrderGroupBy retains outer COLLATE.
            const wrap=(node:Reduction,depth:number):Reduction=>{
              if(depth===0){if(!bound!.reduction||bound!.reduction.kind!=='reduction')throw new JSQLiteError('internal','ORDER result lost expression');return bound!.reduction;}
              const index=node.children.findIndex(child=>child.kind==='reduction');
              if(index<0)throw new JSQLiteError('internal','ORDER collate lost expression');
              return Object.freeze({...node,children:Object.freeze(node.children.map((child,i)=>i===index?wrap(child as Reduction,depth-1):child))});
            };
            if(term.expr.reduction.kind!=='reduction')throw new JSQLiteError('internal','ORDER term lost expression');
            const reduction=wrap(term.expr.reduction,collations.length);
            return Object.freeze({...term,expr:Object.freeze({...bound,reduction,tokens:Object.freeze(exprLeaves(reduction))})});
          }
        }
        return Object.freeze({...term,expr:derived.select.hasOrderBy?term.expr:substituteViewExpression(term.expr,columns,qualifier)});
      }));
      const flattened=Object.freeze({...nested,result,where,orderBy,from:derived.select.from,limit:derived.select.limit??nested.limit,offset:derived.select.offset??nested.offset,hasLimit:derived.select.hasLimit||nested.hasLimit,hasOrderBy:orderBy.length>0,hasSubquery:nested.hasSubquery||derived.select.hasSubquery});
      return compileSubquery({...expression,select:flattened});
    }
    if(derived&&derived.index===0&&nested.from.items.length===1&&derived.select.from.items.length===1&&
       derived.select.hasLimit&&nested.where&&!nested.hasLimit&&!nested.offset&&!nested.hasOrderBy&&
       !derived.select.hasDistinct&&
       !derived.select.hasCompound&&!derived.select.hasValues&&!derived.select.hasGroupBy&&!derived.select.hasHaving&&
       !selectHasAggregate(derived.select)&&!selectHasWindow(derived.select)&&
       !nested.hasDistinct&&!nested.hasGroupBy&&!nested.hasHaving&&!selectHasAggregate(nested)&&!selectHasWindow(nested)&&
       nested.result.length===1){
      // flattenSubquery restriction (19): a LIMIT producer with an outer
      // WHERE cannot transfer that WHERE before its LIMIT. Preserve the
      // producer's scan and limit in this Parse, then filter its output row.
      const names=uniqueTransientColumnNames(derived.select.result.map(item=>item.alias??expressionName(item)));
      const columns=new Map(derived.select.result.map((item,index)=>[sqliteAsciiFold(names[index]!),item]));
      const qualifier=nested.from.items[0]!.alias??nested.from.items[0]!.tableName;
      const result=Object.freeze(nested.result.map(item=>substituteViewExpression(item,columns,qualifier)));
      const predicate=substituteViewExpression(nested.where,columns,qualifier);
      // The enclosing destination needs only one projected producer column.
      // For a wider producer, the resolved ORDER term may refer to that same
      // column (including an ordinal into the producer EList). Do not flatten
      // an unrelated outer expression: it would require a full transient row.
      if(derived.select.hasOrderBy&&(
        result[0]?.reduction?.kind!=='reduction'||
        !derived.select.result.some(column=>column.reduction?.kind==='reduction'&&
          compoundOrderExpressionEqual(expressionFromReduction(result[0]!.reduction as Reduction),expressionFromReduction(column.reduction)))
      ))throw new JSQLiteError('unsupported','derived ORDER producer needs materialized consumer result',{unsupportedClassification:'temporary'});
      const orderBy=Object.freeze(derived.select.orderBy.map(term=>{
        if(!term.expr.reduction)return term;
        let key=expressionFromReduction(term.expr.reduction);
        let depth=0;
        while(key.kind==='collate'){depth++;key=key.value;}
        let bound:SelectNode['result'][number]|undefined;
        if(key.kind==='literal'&&typeof key.value==='bigint'){
          const width=derived.select.result.length;
          if(key.value<1n||key.value>BigInt(width))throw new JSQLiteError('sqlite',`1st ORDER BY term out of range - should be between 1 and ${width}`,{code:1});
          bound=derived.select.result[Number(key.value)-1]!;
        }else if(key.kind==='column'&&!key.name.includes('.'))bound=derived.select.result.find(item=>item.alias&&sqliteIdentifierEqual(item.alias,sqlName(key.name)));
        if(!bound)return term;
        if(!bound.reduction||bound.reduction.kind!=='reduction'||term.expr.reduction?.kind!=='reduction')throw new JSQLiteError('internal','producer ORDER lost expression');
        const replace=(node:Reduction,n:number):Reduction=>{
          if(!n)return bound!.reduction as Reduction;
          const index=node.children.findIndex(child=>child.kind==='reduction');
          if(index<0)throw new JSQLiteError('internal','producer ORDER COLLATE lost expression');
          return Object.freeze({...node,children:Object.freeze(node.children.map((child,i)=>i===index?replace(child as Reduction,n-1):child))});
        };
        const reduction=replace(term.expr.reduction,depth);
        return Object.freeze({...term,expr:Object.freeze({...bound,reduction,tokens:Object.freeze(exprLeaves(reduction))})});
      }));
      const lowered=Object.freeze({...nested,result,where:derived.select.where,from:derived.select.from,orderBy,hasOrderBy:orderBy.length>0,limit:derived.select.limit,offset:derived.select.offset,hasLimit:true});
      postProducerPredicates.set(lowered,predicate);
      return compileSubquery({...expression,select:lowered});
    }
    // A retained compound SrcItem is not a persistent schema table. Until
    // this scalar destination composes its producer, reject before lookup.
    if(nested.from.derived?.select.hasCompound){
      // Resolve transient consumer before destination capability rejection.
      // LIMIT 0 and unsupported lowering do not waive lookupName errors.
      resolveTransientArm(nested,schema);
      if(expression.kind==='in-subquery'||nested.where||nested.hasOrderBy||nested.hasDistinct||nested.hasGroupBy||nested.hasHaving||nested.from.items.length!==1||nested.from.derived.select.hasOrderBy||nested.from.derived.select.arms.some((arm,index)=>index>0&&arm.operatorFromPrior!=='union-all'||arm.from.items.length>1||arm.from.derived||arm.from.cteDerived?.length||arm.hasGroupBy||arm.hasHaving||selectHasAggregate({...nested.from.derived!.select,result:arm.result,arms:Object.freeze([arm]),hasCompound:false})||selectHasWindow({...nested.from.derived!.select,result:arm.result,arms:Object.freeze([arm]),hasCompound:false})))throw new JSQLiteError('unsupported','scalar retained compound producer destination is not implemented',{unsupportedClassification:'temporary'});
      const destination=allocate();
      resultOps.push(expression.exists?{code:'Integer',p1:0n,p2:destination}:{code:'Null',p2:destination});
      const exits:number[]=[];
      const program=compileDerivedProducer(nested,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{builder:selectProgramBuilder,parameters,scalarRetained:true,destination:{kind:expression.exists?'exists':'mem',register:destination},emitRow:(first,count)=>{
        emitSelectDestination(resultOps,{kind:expression.exists?'exists':'mem',register:destination},first,count);
        exits.push(resultOps.length);resultOps.push({code:'Goto',p2:0});
      }});
      if(!program)throw new JSQLiteError('unsupported','scalar retained compound producer destination is not implemented',{unsupportedClassification:'temporary'});
      for(const at of exits)(resultOps[at] as {p2:number}).p2=resultOps.length;

      subqueryColumns.set(nested,program.columns[0]!);
      return destination;
    }
    if(nested.from.items.length===1&&!nested.hasGroupBy&&!nested.hasHaving&&!selectHasAggregate(nested)){
      let plan:ReturnType<typeof expandAndResolveSelect>;
      try{plan=expandAndResolveSelect(nested,schema);}catch(error){if(error instanceof NameResolutionError)throw new JSQLiteError("sqlite",error.message,{code:1});throw error;}
      const source=plan.sources[0],item=plan.result[0];
      if(source&&item&&(!nested.where||nested.where.reduction?.kind==="reduction")&&!source.table.withoutRowid&&!source.table.columns.some(column=>column.generatedExpr)){
        // resolve.c:resolveOrderGroupBy binds this admitted single key either
        // to the result alias/ordinal or a direct column in this NameContext.
        const order=nested.orderBy[0];
        let orderColumn:number|undefined,orderResult=false,orderExpression:Expression|null=null;
        if(order&&nested.orderBy.length===1&&order.expr.reduction){
          const key=expressionFromReduction(order.expr.reduction);
          if(key.kind==="literal"&&typeof key.value==="bigint"&&key.value===1n)orderResult=true;
          else if(key.kind==="column"){
            if(!key.name.includes(".")&&nested.result[0]?.alias&&sqliteIdentifierEqual(sqlName(key.name),nested.result[0].alias))orderResult=true;
            else {
              const parts=key.name.split('.').map(sqlName),name=parts.at(-1)!;
              if(parts.length===1||sqliteIdentifierEqual(parts.at(-2)!,source.alias??source.table.name)){
                const index=source.table.columns.findIndex(column=>sqliteIdentifierEqual(column.name,name));
                if(index>=0)orderColumn=isIntegerPrimaryKeyAlias(source.table,index)?-1:index;
              }
            }
          }
          if(!orderResult&&orderColumn===undefined&&item.expression.reduction&&compoundOrderExpressionEqual(key,expressionFromReduction(item.expression.reduction)))orderResult=true;
        }
        if(order&&!orderResult&&orderColumn===undefined&&nested.orderBy.length===1&&order.expr.reduction?.kind==="reduction")orderExpression=expressionFromReduction(order.expr.reduction);
        if(!order||orderResult||orderColumn!==undefined||orderExpression){
        const cursor=selectProgramBuilder.cursor(),destination=allocate(),isIn=expression.kind==="in-subquery",setCursor=isIn?selectProgramBuilder.cursor():-1;
        const distinctCursor=nested.hasDistinct?selectProgramBuilder.cursor():-1;
        const sorter=order?selectProgramBuilder.cursor():-1;
          const postPredicate=postProducerPredicates.get(nested);
          const bind=(tree:Expression,node:Reduction,collatedUse?:typeof plan.columnUses[number]):Expression=>{
            node=expressionIdentityReduction(node);
            const children=descendantExprs(node);
            if(tree.kind==="column"){
              const use=plan.columnUses.find(candidate=>candidate.expression===node)??collatedUse;
              // Substituted outer WHERE reductions are not visited by the
              // producer NameContext; resolve remaining direct columns against
              // this single producer source, not an unrelated source cursor.
              const parts=tree.name.split('.').map(sqlName);
              const sourceIndex=parts.length<=2&&
                (parts.length===1||sqliteIdentifierEqual(parts[0]!,source.alias??source.table.name))
                ?source.table.columns.findIndex(column=>sqliteIdentifierEqual(column.name,parts.at(-1)!)):-1;
              // A resolved use belongs to its NameContext owner. Only a
              // reduction introduced by outer-predicate substitution has no
              // producer use and may fall back to this producer's columns.
              if((use&&use.source!==source)||(!use&&sourceIndex<0))throw new JSQLiteError("unsupported","nested source expression binding is not implemented",{unsupportedClassification:"temporary"});
              const index=use?.source===source?use.columnIndex:sourceIndex;
              tree.cursor=cursor;tree.index=isIntegerPrimaryKeyAlias(source.table,index)?-1:index;
              tree.affinity=tree.index<0?"integer":source.table.columns[tree.index]!.affinity;
              tree.collation=(tree.index<0?"binary":sqliteAsciiFold(source.table.columns[tree.index]!.collation??"binary")) as BuiltinCollation;
              return tree;
            }
            const child=(index:number):Reduction=>{const value=children[index];if(!value||value.kind!=="reduction")throw new JSQLiteError("internal","resolved source predicate lost its expression");return value;};
            if(tree.kind==="collate")bind(tree.value,child(0),plan.columnUses.find(candidate=>candidate.expression===node));
            else if(tree.kind==="unary"||tree.kind==="cast")bind(tree.value,child(0),undefined);
            else if(tree.kind==="binary"){bind(tree.left,child(0),undefined);bind(tree.right,child(1),undefined);}
            else if(tree.kind==="between"){bind(tree.value,child(0),undefined);bind(tree.lower,child(1),undefined);bind(tree.upper,child(2),undefined);}
            else if(tree.kind==="in-list"){bind(tree.left,child(0),undefined);tree.values.forEach((value,index)=>bind(value,child(index+1)));}
            else if(tree.kind==="call")tree.args.forEach((value,index)=>bind(value,child(index)));
            else if(tree.kind==="case"){
              // expr.c:TK_CASE compiles the optional base once, then each
              // WHEN/THEN pair in source order, followed by ELSE.
              let index=0;
              if(tree.operand)bind(tree.operand,child(index++),undefined);
              for(const [when,then] of tree.pairs){bind(when,child(index++),undefined);bind(then,child(index++),undefined);}
              if(tree.otherwise)bind(tree.otherwise,child(index++),undefined);
            }
            else if(tree.kind==="scalar-subquery"){
              // expr.c:sqlite3ExprCodeTarget compiles an independent scalar
              // subquery using this same Parse/Vdbe; it has its own NameContext
              // and does not bind the producer's source columns here.
            }
            else if(tree.kind==="in-subquery"){
              // expr.c:sqlite3CodeSubselect owns the RHS SELECT's independent
              // NameContext; only the left operand belongs to this producer.
              bind(tree.left,child(0),undefined);
              const resolved=plan.nested.find(candidate=>candidate.source===tree.select);
              if(resolved?.correlated){
                const uses=new Map<Reduction,{cursor:number;index:number;affinity:MemAffinity;collation:BuiltinCollation}>();
                for(const use of resolved.columnUses){
                  if(use.source!==source||use.selectDepth!==1)throw new JSQLiteError('unsupported','nested source expression binding is not implemented',{unsupportedClassification:'temporary'});
                  const index=use.columnIndex,column=index<0?null:source.table.columns[index]!;
                  uses.set(use.expression,{cursor,index,affinity:index<0?'integer':column!.affinity,collation:(index<0?'binary':sqliteAsciiFold(column!.collation??'binary')) as BuiltinCollation});
                }
                correlatedColumns.set(tree.select,uses);
              }
            }
            return tree;
          };
        const resultTree=item.expression.reduction?.kind==="reduction"?bind(expressionFromReduction(item.expression.reduction),item.expression.reduction):null;
        if(!resultTree)throw new JSQLiteError("unsupported","nested source projection is not implemented",{unsupportedClassification:"temporary"});
        const postTree=postPredicate?.reduction?.kind==='reduction'?bind(expressionFromReduction(postPredicate.reduction),postPredicate.reduction):null;
        if(postPredicate&&!postTree)throw new JSQLiteError('unsupported','derived WHERE expression is not implemented',{unsupportedClassification:'temporary'});
        if(orderExpression&&order?.expr.reduction?.kind==="reduction")orderExpression=bind(orderExpression,order.expr.reduction);
        // select.c:generateSortTail retains the producer row until drain.
        // flattenSubquery restriction (19) keeps the outer WHERE after LIMIT;
        // columns used by that WHERE must travel in the sorter payload, not
        // be reread from the scan cursor after the scan has finished.
        const postColumns:Expression[]=[];
        const collectPostColumns=(tree:Expression):void=>{
          if(compoundOrderExpressionEqual(tree,resultTree))return;
          if(tree.kind==='column'){
            if(!postColumns.some(column=>compoundOrderExpressionEqual(column,tree)))postColumns.push(tree);
          }else if(tree.kind==='binary'){collectPostColumns(tree.left);collectPostColumns(tree.right);}
          else if(tree.kind==='unary'||tree.kind==='collate'||tree.kind==='cast')collectPostColumns(tree.value);
          else if(tree.kind==='between'){collectPostColumns(tree.value);collectPostColumns(tree.lower);collectPostColumns(tree.upper);}
          else if(tree.kind==='in-list'){collectPostColumns(tree.left);tree.values.forEach(collectPostColumns);}
          else if(tree.kind==='call')tree.args.forEach(collectPostColumns);
          else if(tree.kind==='case'){if(tree.operand)collectPostColumns(tree.operand);tree.pairs.forEach(([when,then])=>{collectPostColumns(when);collectPostColumns(then)});if(tree.otherwise)collectPostColumns(tree.otherwise);}
        };
        if(order&&postTree)collectPostColumns(postTree);
        if(order)resultOps.push({code:"SorterOpen",p1:sorter,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:1+postColumns.length,keyFieldCount:1,terms:[{collation:orderResult?collation(resultTree):orderExpression?collation(orderExpression):orderColumn!<0?"binary":sqliteAsciiFold(source.table.columns[orderColumn!]!.collation??"binary") as BuiltinCollation,desc:order.descending,nullsLarge:order.nulls==="last"?!order.descending:order.nulls==="first"?order.descending:false}]})});
        const resultCollation=collation(resultTree);
        if(distinctCursor>=0)resultOps.push({code:"OpenEphemeral",p1:distinctCursor,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:1,keyFieldCount:1,terms:[{collation:resultCollation}]})});
        if(isIn)resultOps.push({code:"OpenEphemeral",p1:setCursor,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:1,keyFieldCount:1,terms:[{collation:collation(expression.left)}]})});
        if(!isIn)resultOps.push(expression.exists?{code:"Integer",p1:0n,p2:destination}:{code:"Null",p2:destination});
        resultOps.push({code:"OpenRead",p1:source.table.rootPage,p2:cursor});
        const childLimit=nested.limit?computeLimitRegisters(nested,resultOps,allocate,parameters,!isIn&&!postTree):undefined;
        const rewind=resultOps.length;resultOps.push({code:"Rewind",p1:cursor,p2:0});
        // where.c:sqlite3WhereCodeOneLoopStart / select.c:selectInnerLoop:
        // a rejected source row advances the scan, without consuming LIMIT.
        // Resolve column ownership from the already built NameContext rather
        // than looking up SQL text or recompiling a child Program.
        let whereSkip=-1;
        if(nested.where?.reduction?.kind==="reduction"){
          const whereReduction=nested.where.reduction;
          const test=compileExpressionTree(bind(expressionFromReduction(whereReduction),whereReduction),resultOps,allocate,parameters,compileSubquery,true);
          whereSkip=resultOps.length;resultOps.push({code:"IfNot",p1:test,p2:0});
        }
        // selectInnerLoop checks result DISTINCT before OFFSET and the SRT.
        // A duplicate continues the source scan without consuming either.
        let duplicateSkip=-1,distinctValue=-1;
        if(distinctCursor>=0){
          distinctValue=compileExpressionTree(resultTree,resultOps,allocate,parameters,compileSubquery);
          duplicateSkip=resultOps.length;
          resultOps.push({code:"Found",p1:distinctCursor,keyStart:distinctValue,keyCount:1,jump:0},{code:"IdxInsert",p1:distinctCursor,keyStart:distinctValue,keyCount:1});
        }
        // selectInnerLoop: OFFSET skips only qualifying rows before result
        // production; with ORDER BY, generateSortTail applies it on drain.
        let offsetSkip=-1;
        if(!order&&childLimit?.offset!==undefined){offsetSkip=resultOps.length;resultOps.push({code:"IfPos",p1:childLimit.offset,p2:0,p3:1});}
        let postSkip=-1;
        if(postTree&&!order){const test=compileExpressionTree(postTree,resultOps,allocate,parameters,compileSubquery,true);postSkip=resultOps.length;resultOps.push({code:'IfNot',p1:test,p2:0});}
        if(order){
          const key=allocate(),payload=selectProgramBuilder.range(1+postColumns.length);
          const projected=distinctValue>=0?distinctValue:compileExpressionTree(resultTree,resultOps,allocate,parameters,compileSubquery);
          if(orderResult)resultOps.push({code:"Copy",p1:projected,p2:key});
          else if(orderExpression){const orderValue=compileExpressionTree(orderExpression,resultOps,allocate,parameters,compileSubquery);resultOps.push({code:"Copy",p1:orderValue,p2:key});}
          else if(orderColumn!<0)resultOps.push({code:"Rowid",p1:cursor,p2:key});else resultOps.push({code:"Column",p1:orderColumn!,p2:key,p3:cursor});
          resultOps.push({code:"Copy",p1:projected,p2:payload});
          postColumns.forEach((column,index)=>{const register=compileExpressionTree(column,resultOps,allocate,parameters,compileSubquery);resultOps.push({code:"Copy",p1:register,p2:payload+index+1});});
          // select.c:pushOntoSorter keeps at most LIMIT(+OFFSET) entries
          // regardless of whether the outer SELECT has a post-drain WHERE.
          // This is the producer's bound, not the consumer's filter bound.
          resultOps.push({code:"SorterInsert",p1:sorter,keyStart:key,keyCount:1,payload,payloadCount:1+postColumns.length,...(childLimit?{topN:childLimit.capacity}:{})});
        }else if(expression.kind==="scalar-subquery"&&expression.exists)emitSelectDestination(resultOps,{kind:"exists",register:destination},destination,1);
        else {
          const value=allocate();
          const projected=distinctValue>=0?distinctValue:compileExpressionTree(resultTree,resultOps,allocate,parameters,compileSubquery);
          resultOps.push({code:"Copy",p1:projected,p2:value});
          if(isIn)emitSelectDestination(resultOps,{kind:"set",cursor:setCursor},value,1);
          else emitSelectDestination(resultOps,{kind:"mem",register:destination},value,1);
        }
        const stop=resultOps.length;
        // expr.c:sqlite3CodeSubselect caps Mem/Exists after the first
        // accepted outer row. A rejected post-producer row still consumes
        // producer LIMIT in the advance block below, but must not cap Set.
        if(!order&&!isIn)resultOps.push({code:"Goto",p2:0});
        else if(!order&&childLimit&&!postTree)resultOps.push({code:"DecrJumpZero",p1:childLimit.count,p2:0});
        const advance=resultOps.length;
        if(postTree&&!order&&childLimit)resultOps.push({code:'DecrJumpZero',p1:childLimit.count,p2:0});
        if(whereSkip>=0)(resultOps[whereSkip] as {p2:number}).p2=advance;
        if(postSkip>=0)(resultOps[postSkip] as {p2:number}).p2=advance;
        if(offsetSkip>=0)(resultOps[offsetSkip] as {p2:number}).p2=advance;
        if(duplicateSkip>=0)(resultOps[duplicateSkip] as {jump:number}).jump=advance;
        resultOps.push({code:"Next",p1:cursor,p2:rewind+1});
        const scanEnd=resultOps.length;
        if(postTree&&!order&&childLimit)(resultOps[advance] as {p2:number}).p2=scanEnd;
        (resultOps[rewind] as {p2:number}).p2=scanEnd;
        if(order){
          const sortAt=resultOps.length;resultOps.push({code:"SorterSort",p1:sorter,emptyJump:0});
          const value=allocate();for(let i=0;i<postColumns.length;i++)allocate();resultOps.push({code:"SorterData",p1:sorter,p2:value,count:1+postColumns.length});
          let sortedOffsetSkip=-1;
          if(childLimit?.offset!==undefined){sortedOffsetSkip=resultOps.length;resultOps.push({code:"IfPos",p1:childLimit.offset,p2:0,p3:1});}
          let sortedPostSkip=-1;
          if(postTree){
            // The producer sorter retains its projected value, not an open
            // source cursor. Bind outer references to that payload register;
            // never evaluate the outer WHERE while feeding the sorter.
            const fromPayload=(tree:Expression):Expression=>{
              if(compoundOrderExpressionEqual(tree,resultTree))return {kind:'register',index:value};
              const columnIndex=postColumns.findIndex(column=>compoundOrderExpressionEqual(column,tree));
              if(columnIndex>=0)return {kind:'register',index:value+columnIndex+1};
              if(tree.kind==='binary')return {...tree,left:fromPayload(tree.left),right:fromPayload(tree.right)};
              if(tree.kind==='unary'||tree.kind==='collate'||tree.kind==='cast')return {...tree,value:fromPayload(tree.value)};
              if(tree.kind==='between')return {...tree,value:fromPayload(tree.value),lower:fromPayload(tree.lower),upper:fromPayload(tree.upper)};
              if(tree.kind==='in-list')return {...tree,left:fromPayload(tree.left),values:tree.values.map(fromPayload)};
              if(tree.kind==='call')return {...tree,args:tree.args.map(fromPayload)};
              if(tree.kind==='case')return {...tree,
                ...(tree.operand?{operand:fromPayload(tree.operand)}:{}),
                pairs:tree.pairs.map(([when,then])=>[fromPayload(when),fromPayload(then)] as [Expression,Expression]),
                ...(tree.otherwise?{otherwise:fromPayload(tree.otherwise)}:{})};
              if(tree.kind==='column')throw new JSQLiteError('unsupported','derived ORDER producer requires materialized predicate column',{unsupportedClassification:'temporary'});
              return tree;
            };
            const test=compileExpressionTree(fromPayload(postTree),resultOps,allocate,parameters,compileSubquery,true);
            sortedPostSkip=resultOps.length;resultOps.push({code:'IfNot',p1:test,p2:0});
          }
          if(isIn)emitSelectDestination(resultOps,{kind:"set",cursor:setCursor},value,1);
          else emitSelectDestination(resultOps,expression.kind==="scalar-subquery"&&expression.exists?{kind:"exists",register:destination}:{kind:"mem",register:destination},value,1);
          const stopSorted=resultOps.length;
          // expr.c:sqlite3CodeSubselect caps SRT_Mem/SRT_Exists at one
          // result. This bounded caller stops after its first post-WHERE
          // row, independently of the producer's LIMIT count; SRT_Set drains.
          if(!isIn)resultOps.push({code:"Goto",p2:0});
          else if(childLimit)resultOps.push({code:"DecrJumpZero",p1:childLimit.count,p2:0});
          resultOps.push({code:"SorterNext",p1:sorter,p2:sortAt+1});
          const end=resultOps.length;
          if(sortedPostSkip>=0)(resultOps[sortedPostSkip] as {p2:number}).p2=stopSorted+1;
          if(sortedOffsetSkip>=0)(resultOps[sortedOffsetSkip] as {p2:number}).p2=stopSorted+1;
          (resultOps[sortAt] as {emptyJump:number}).emptyJump=end;
          if(!isIn)(resultOps[stopSorted] as {p2:number}).p2=end;
          else if(childLimit)(resultOps[stopSorted] as {p2:number}).p2=end;
          if(childLimit)(resultOps[childLimit.ifZero] as {p2:number}).p2=end;
        }else{
          const end=resultOps.length;
          if(postTree){
            const stopAt=resultOps[stop];
            if(stopAt?.code==='Goto') (stopAt as {p2:number}).p2=end;
            if(childLimit)(resultOps[childLimit.ifZero] as {p2:number}).p2=end;
          }else{
          if(!isIn)(resultOps[stop] as {p2:number}).p2=end;
          else if(childLimit)(resultOps[stop] as {p2:number}).p2=end;
          if(childLimit)(resultOps[childLimit.ifZero] as {p2:number}).p2=end;
          }
        }
        if(!isIn&&!expression.exists)subqueryColumns.set(nested,{name:item.name,declaredType:item.descriptor.declaredType,database:item.descriptor.database,table:item.descriptor.table,origin:item.descriptor.origin});
        if(isIn){const left=compileExpressionTree(expression.left,resultOps,allocate,parameters,compileSubquery);resultOps.push({code:"InSet",p1:setCursor,key:left,output:destination,affinity:comparisonAffinity(expressionAffinity(expression.left),expressionAffinity(resultTree)),negated:expression.negated});}
        return destination;
        }
      }
    }
    // select.c:flattenSubquery restriction (16) leaves an ORDER BY producer
    // distinct from its aggregate consumer. Feed its accepted rows directly
    // into the enclosing count accumulator, rather than relocating a completed
    // child Program. The inner scan/sorter retains ownership of LIMIT/OFFSET.
    const materialized=nested.from.derived;
    if(materialized?.index===0&&nested.from.items.length===1&&
       nested.result.length===1&&nested.result[0]?.reduction&&
       !nested.hasGroupBy&&!nested.hasHaving&&!nested.hasDistinct&&
       !nested.hasCompound&&
       materialized.select.from.items.length>0&&!materialized.select.from.derived&&
       !materialized.select.hasCompound&&!materialized.select.hasGroupBy&&
       !materialized.select.hasHaving&&!selectHasAggregate(materialized.select)&&
       !selectHasWindow(materialized.select)){
      const containsNestedAggregateOrSelect=(tree:Expression):boolean=>{
        if(tree.kind==='aggregate'||tree.kind==='scalar-subquery'||tree.kind==='in-subquery')return true;
        if(tree.kind==='unary'||tree.kind==='cast'||tree.kind==='collate')return containsNestedAggregateOrSelect(tree.value);
        if(tree.kind==='binary')return containsNestedAggregateOrSelect(tree.left)||containsNestedAggregateOrSelect(tree.right);
        if(tree.kind==='between')return [tree.value,tree.lower,tree.upper].some(containsNestedAggregateOrSelect);
        if(tree.kind==='in-list')return [tree.left,...tree.values].some(containsNestedAggregateOrSelect);
        if(tree.kind==='call')return tree.args.some(containsNestedAggregateOrSelect);
        if(tree.kind==='case')return [...(tree.operand?[tree.operand]:[]),...tree.pairs.flat(),...(tree.otherwise?[tree.otherwise]:[])].some(containsNestedAggregateOrSelect);
        return false;
      };
      const aggregate=expressionFromReduction(nested.result[0].reduction);
      const arguments_=aggregate.kind==='aggregate'?aggregate.args:[];
      const argument=arguments_[0];
      if(aggregate.kind==='aggregate'&&(['count','sum','avg','total','min','max','group_concat','string_agg'] as string[]).includes(aggregate.name)&&
         (aggregate.name==='count'?arguments_.length<=1:aggregate.name==='group_concat'?arguments_.length===1||arguments_.length===2:aggregate.name==='string_agg'?arguments_.length===2:arguments_.length===1)&&
         (!aggregate.distinct||arguments_.length===1)&&
         arguments_.every(arg=>!containsNestedAggregateOrSelect(arg))&&
         (!nested.where?.reduction||!containsNestedAggregateOrSelect(expressionFromReduction(nested.where.reduction)))&&
         aggregate.orderBy.every(term=>!containsNestedAggregateOrSelect(term.expression))&&
         (!aggregate.filter||!containsNestedAggregateOrSelect(aggregate.filter))){
        let expanded:ReturnType<typeof expandAndResolveSelect>;
        try{expanded=expandAndResolveSelect(materialized.select,schema,null,selectProgramBuilder.cursors)}
        catch(error){if(error instanceof NameResolutionError)throw new JSQLiteError('sqlite',error.message,{code:1});throw error;}
        const names=uniqueTransientColumnNames(materialized.select.result.map(item=>item.alias??expressionName(item)));
        const qualifier=materialized.alias??nested.from.items[0]!.tableName;
        const bindArgument=(tree:Expression,first:number):Expression=>{
          if(tree.kind==='column'){
            const parts=tree.name.split('.').map(sqlName);
            if(parts.length>2||parts.length===2&&!sqliteIdentifierEqual(parts[0]!,qualifier))throw new JSQLiteError('sqlite',`no such column: ${tree.name}`,{code:1});
            const index=names.findIndex(name=>sqliteIdentifierEqual(name,parts.at(-1)!));
            if(index<0)throw new JSQLiteError('sqlite',`no such column: ${tree.name}`,{code:1});
            return {kind:'register',index:first+index};
          }
          if(tree.kind==='unary'||tree.kind==='cast'||tree.kind==='collate')return {...tree,value:bindArgument(tree.value,first)};
          if(tree.kind==='binary')return {...tree,left:bindArgument(tree.left,first),right:bindArgument(tree.right,first)};
          if(tree.kind==='between')return {...tree,value:bindArgument(tree.value,first),lower:bindArgument(tree.lower,first),upper:bindArgument(tree.upper,first)};
          if(tree.kind==='in-list')return {...tree,left:bindArgument(tree.left,first),values:tree.values.map(value=>bindArgument(value,first))};
          if(tree.kind==='call')return {...tree,args:tree.args.map(value=>bindArgument(value,first))};
          if(tree.kind==='case')return {...tree,operand:tree.operand?bindArgument(tree.operand,first):null,pairs:tree.pairs.map(([when,then])=>[bindArgument(when,first),bindArgument(then,first)]),otherwise:tree.otherwise?bindArgument(tree.otherwise,first):null};
          return tree;
        };
        // expr.c:sqlite3ExprCollSeq follows a bare column (and CAST/UPLUS)
        // for inherited collation. A binary operator propagates only an
        // explicit EP_Collate child, not a column's implicit collation.
        const argumentCollation=(tree:Expression):BuiltinCollation=>{
          const explicit=explicitCollation(tree);
          if(explicit)return explicit;
          if(tree.kind==='cast'||tree.kind==='unary'&&tree.op==='+')return argumentCollation(tree.value);
          if(tree.kind==='column'){
            const parts=tree.name.split('.').map(sqlName);
            const index=names.findIndex(name=>sqliteIdentifierEqual(name,parts.at(-1)!));
            return sqliteAsciiFold(expanded.result[index]!.descriptor.collation) as BuiltinCollation;
          }
          return 'binary';
        };
        // resolve.c:resolveOrderGroupBy binds aliases, ordinals and column
        // names before select.c emits even a LIMIT-0 aggregate. The ungrouped
        // accumulator has one row, so ORDER never needs a second sorter.
        // resolve.c resolves arguments before sqlite3Select emits producer rows,
        // including when the producer LIMIT prevents any row from stepping.
        if(nested.hasOrderBy){
          // resolve.c:resolveOrderGroupBy checks aliases and ordinals against
          // the EList, then binds independent ORDER terms against the source.
          // The non-GROUP aggregate emits only one row; no outer sorter.
          nested.orderBy.forEach((term,index)=>{
            const tree=expressionFromReduction(term.expr.reduction!);
            if(tree.kind==='literal'&&typeof tree.value==='bigint'&&
               tree.value>=-2147483647n&&tree.value<=2147483647n){
              if(tree.value<1n||tree.value>BigInt(nested.result.length)){
                const n=index+1,suffix=n%100>=11&&n%100<=13?'th':n%10===1?'st':n%10===2?'nd':n%10===3?'rd':'th';
                throw new JSQLiteError('sqlite',`${n}${suffix} ORDER BY term out of range - should be between 1 and ${nested.result.length}`,{code:1});
              }
              return;
            }
            if(tree.kind==='column'&&!tree.name.includes('.')&&nested.result.some(item=>item.alias&&sqliteIdentifierEqual(item.alias,sqlName(tree.name))))return;
            bindArgument(tree,0);
          });
        }
        arguments_.forEach(arg=>bindArgument(arg,0));
        if(nested.where?.reduction)bindArgument(expressionFromReduction(nested.where.reduction),0);
        aggregate.orderBy.forEach(term=>bindArgument(term.expression,0));
        if(aggregate.filter)bindArgument(aggregate.filter,0);
        const destination=allocate(),isIn=expression.kind==='in-subquery';
        const setCursor=isIn?selectProgramBuilder.cursor():-1;
        if(isIn)resultOps.push({code:'OpenEphemeral',p1:setCursor,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:1,keyFieldCount:1,terms:[{collation:collation(expression.left)}]})});
        else resultOps.push(expression.exists?{code:'Integer',p1:0n,p2:destination}:{code:'Null',p2:destination});
        const once=allocate(),onceAt=resultOps.length;resultOps.push({code:'Once',p1:once,p2:0});
        // select.c:sqlite3Select initializes its limiter before the scan and
        // emits the sole ungrouped aggregate row through selectInnerLoop.
        // Even SRT_Set/Exists must not receive the row on LIMIT 0/OFFSET 1.
        const outerLimit=computeLimitRegisters(nested,resultOps,allocate,parameters);
        const accumulator=allocate();resultOps.push({code:'AggReset',registers:[accumulator]});
        const distinctCursor=aggregate.distinct?selectProgramBuilder.cursor():undefined;
        if(distinctCursor!==undefined)resultOps.push({code:'OpenEphemeral',p1:distinctCursor,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:1,keyFieldCount:1,terms:[{collation:argumentCollation(argument!)}]})});
        const orderCursor=aggregate.orderBy.length?selectProgramBuilder.cursor():undefined;
        const keyStart=orderCursor===undefined?undefined:selectProgramBuilder.range(aggregate.orderBy.length);
        const payload=orderCursor===undefined?undefined:selectProgramBuilder.range(arguments_.length);
        if(orderCursor!==undefined)resultOps.push({code:'SorterOpen',p1:orderCursor,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:aggregate.orderBy.length,keyFieldCount:aggregate.orderBy.length,terms:aggregate.orderBy.map(term=>({collation:argumentCollation(term.expression),desc:term.descending,nullsLarge:term.nullsLarge}))})});
        compileInnerTableSelect(materialized.select,expanded,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,
          {builder:selectProgramBuilder,ops:resultOps,parameters,destination:{kind:'aggregate-expression',register:accumulator,name:aggregate.name as 'count'|'sum'|'avg'|'total'|'min'|'max'|'group_concat'|'string_agg',collation:argument?argumentCollation(argument):'binary',...(distinctCursor!==undefined?{distinctCursor}:{}),...(orderCursor!==undefined?{order:{cursor:orderCursor,keyStart:keyStart!,payload:payload!,emitKeys:(first:number)=>aggregate.orderBy.map(term=>compileExpressionTree(bindArgument(term.expression,first),resultOps,allocate,parameters,compileSubquery))}}:{}),...(aggregate.filter?{emitFilter:(first:number)=>compileExpressionTree(bindArgument(aggregate.filter!,first),resultOps,allocate,parameters,compileSubquery)}:{}),...(nested.where?.reduction?{emitWhere:(first:number)=>compileExpressionTree(bindArgument(expressionFromReduction(nested.where!.reduction!),first),resultOps,allocate,parameters,compileSubquery,true)}:{}),...(arguments_.length?{emitArgument:(first:number)=>arguments_.map(arg=>compileExpressionTree(bindArgument(arg,first),resultOps,allocate,parameters,compileSubquery))}:{})}});
        if(orderCursor!==undefined){
          const sort=resultOps.length;
          resultOps.push({code:'SorterSort',p1:orderCursor,emptyJump:0},{code:'SorterData',p1:orderCursor,p2:payload!,count:arguments_.length},{code:'AggStep',name:aggregate.name,args:arguments_.map((_,index)=>payload!+index),p2:accumulator,collation:argumentCollation(argument!)},{code:'SorterNext',p1:orderCursor,p2:sort+1});
          (resultOps[sort] as {emptyJump:number}).emptyJump=resultOps.length;
        }
        resultOps.push({code:'AggFinal',p1:accumulator,name:aggregate.name});
        const offsetSkip=outerLimit?.offset===undefined?-1:resultOps.length;
        if(outerLimit?.offset!==undefined)resultOps.push({code:'IfPos',p1:outerLimit.offset,p2:0,p3:1});
        emitSelectDestination(resultOps,isIn?{kind:'set',cursor:setCursor}:expression.exists?{kind:'exists',register:destination}:{kind:'mem',register:destination},accumulator,1);
        const end=resultOps.length;
        if(outerLimit)(resultOps[outerLimit.ifZero] as {p2:number}).p2=end;
        if(offsetSkip>=0)(resultOps[offsetSkip] as {p2:number}).p2=end;
        (resultOps[onceAt] as {p2:number}).p2=end;
        if(isIn){const left=compileExpressionTree(expression.left,resultOps,allocate,parameters,compileSubquery);resultOps.push({code:'InSet',p1:setCursor,key:left,output:destination,affinity:inComparisonAffinity(expression.left,aggregate),negated:expression.negated});}
        return destination;
      }
    }
    // expr.c:sqlite3CodeSubselect calls sqlite3Select with the enclosing
    // Parse/Vdbe. The no-GROUP accumulator writes its SRT destination here,
    // rather than publishing a child Program for opcode relocation.
    if(selectHasAggregate(nested)&&aggregateShapeSupported(nested)&&nested.from.items.length>=1&&!nested.hasGroupBy){
      const destination=allocate(),isIn=expression.kind==="in-subquery";
      const setCursor=isIn?selectProgramBuilder.cursor():-1;
      if(isIn)resultOps.push({code:"OpenEphemeral",p1:setCursor,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:1,keyFieldCount:1,terms:[{collation:collation(expression.left)}]})});
      else resultOps.push(expression.exists?{code:"Integer",p1:0n,p2:destination}:{code:"Null",p2:destination});
      const once=allocate(),onceAt=resultOps.length;
      resultOps.push({code:"Once",p1:once,p2:0});
      compileAggregateSelect(nested,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{builder:selectProgramBuilder,ops:resultOps,parameters,destination:isIn?{kind:"set",cursor:setCursor}:expression.exists?{kind:"exists",register:destination}:{kind:"mem",register:destination}});
      (resultOps[onceAt] as {p2:number}).p2=resultOps.length;
      if(isIn){const left=compileExpressionTree(expression.left,resultOps,allocate,parameters,compileSubquery);resultOps.push({code:"InSet",p1:setCursor,key:left,output:destination,affinity:inComparisonAffinity(expression.left,expressionFromReduction(nested.result[0]!.reduction!)),negated:expression.negated});}
      return destination;
    }
    // select.c:sqlite3Select's GROUP BY accumulator and selectInnerLoop
    // share one Parse and SRT destination even for a bounded multi-source
    // group. Do not relocate a completed grouped child into this caller.
    if(aggregateShapeSupported(nested)&&nested.hasGroupBy&&nested.from.items.length>=1){
      const destination=allocate(),isIn=expression.kind==="in-subquery";
      const setCursor=isIn?selectProgramBuilder.cursor():-1;
      if(isIn)resultOps.push({code:"OpenEphemeral",p1:setCursor,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:1,keyFieldCount:1,terms:[{collation:collation(expression.left)}]})});
      else resultOps.push(expression.exists?{code:"Integer",p1:0n,p2:destination}:{code:"Null",p2:destination});
      const once=allocate(),onceAt=resultOps.length;
      resultOps.push({code:"Once",p1:once,p2:0});
      compileAggregateSelect(nested,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{builder:selectProgramBuilder,ops:resultOps,parameters,destination:isIn?{kind:"set",cursor:setCursor}:expression.exists?{kind:"exists",register:destination}:{kind:"mem",register:destination}});
      (resultOps[onceAt] as {p2:number}).p2=resultOps.length;
      if(isIn){const left=compileExpressionTree(expression.left,resultOps,allocate,parameters,compileSubquery);resultOps.push({code:"InSet",p1:setCursor,key:left,output:destination,affinity:inComparisonAffinity(expression.left,expressionFromReduction(nested.result[0]!.reduction!)),negated:expression.negated});}
      return destination;
    }
    // select.c:sqlite3Select retains the same Parse/Vdbe destination when the
    // bounded one-source fast path cannot consume a result/ORDER expression.
    // Let the shared scan builder own that producer as it already does joins.
    if(nested.from.items.length>=1&&!nested.hasGroupBy&&!nested.hasHaving&&!selectHasAggregate(nested)&&!selectHasWindow(nested)&&!nested.hasCompound){
      let expanded:ReturnType<typeof expandAndResolveSelect>;
      try{expanded=expandAndResolveSelect(nested,schema,null,selectProgramBuilder.cursors)}
      catch(error){if(error instanceof NameResolutionError)throw new JSQLiteError('sqlite',error.message,{code:1});throw error;}
      const destination=allocate(),isIn=expression.kind==='in-subquery';
      const setCursor=isIn?selectProgramBuilder.cursor():-1;
      if(isIn)resultOps.push({code:'OpenEphemeral',p1:setCursor,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:1,keyFieldCount:1,terms:[{collation:collation(expression.left)}]})});
      else resultOps.push(expression.exists?{code:'Integer',p1:0n,p2:destination}:{code:'Null',p2:destination});
      const once=allocate(),onceAt=resultOps.length;resultOps.push({code:'Once',p1:once,p2:0});
      compileInnerTableSelect(nested,expanded,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{builder:selectProgramBuilder,ops:resultOps,parameters,destination:isIn?{kind:'set',cursor:setCursor}:expression.exists?{kind:'exists',register:destination}:{kind:'mem',register:destination}});
      (resultOps[onceAt] as {p2:number}).p2=resultOps.length;
      if(!isIn&&!expression.exists)subqueryColumns.set(nested,{name:expanded.result[0]!.name,declaredType:expanded.result[0]!.descriptor.declaredType,database:expanded.result[0]!.descriptor.database,table:expanded.result[0]!.descriptor.table,origin:expanded.result[0]!.descriptor.origin});
      if(isIn){const left=compileExpressionTree(expression.left,resultOps,allocate,parameters,compileSubquery);resultOps.push({code:'InSet',p1:setCursor,key:left,output:destination,affinity:inComparisonAffinity(expression.left,expressionFromReduction(nested.result[0]!.reduction!)),negated:expression.negated});}
      return destination;
    }
    // select.c:sqlite3Select's grouped accumulator emits into the destination
    // supplied by expr.c:sqlite3CodeSubselect in the enclosing Parse/Vdbe.
    // select.c:flattenSubquery/resolveSelectStep hand the grouped aggregate
    // the same destination after flattening the admitted simple derived source
    // (or the immutable view). Do not route unflattenable producers through a
    // parent that they cannot yet consume.
    const groupedDerived=nested.from.derived;
    const flattenableGroupedDerived=groupedDerived?.index===0&&nested.from.items.length===1&&
      groupedDerived.select.from.items.length===1&&!groupedDerived.select.hasDistinct&&
      !groupedDerived.select.hasGroupBy&&!groupedDerived.select.hasHaving&&
      !groupedDerived.select.hasOrderBy&&!groupedDerived.select.hasLimit&&
      !groupedDerived.select.hasCompound;
    const groupedView=nested.from.items.length===1&&
      schema.views.has(sqliteAsciiFold(sqlName(nested.from.items[0]!.tableName)));
    if(nested.hasGroupBy&&!nested.hasCompound&&nested.from.items.length>0&&
       (flattenableGroupedDerived||groupedView||(!groupedDerived&&
       nested.from.items.every(source=>schema.tables.has(sqliteAsciiFold(sqlName(source.tableName))))))){
      const destination=allocate(),isIn=expression.kind==='in-subquery';
      const setCursor=isIn?selectProgramBuilder.cursor():-1;
      if(isIn)resultOps.push({code:'OpenEphemeral',p1:setCursor,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:1,keyFieldCount:1,terms:[{collation:collation(expression.left)}]})});
      else resultOps.push(expression.exists?{code:'Integer',p1:0n,p2:destination}:{code:'Null',p2:destination});
      const once=allocate(),onceAt=resultOps.length;resultOps.push({code:'Once',p1:once,p2:0});
      compileAggregateSelect(nested,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{builder:selectProgramBuilder,ops:resultOps,parameters,destination:isIn?{kind:'set',cursor:setCursor}:expression.exists?{kind:'exists',register:destination}:{kind:'mem',register:destination}});
      (resultOps[onceAt] as {p2:number}).p2=resultOps.length;
      if(isIn){const left=compileExpressionTree(expression.left,resultOps,allocate,parameters,compileSubquery);resultOps.push({code:'InSet',p1:setCursor,key:left,output:destination,affinity:inComparisonAffinity(expression.left,expressionFromReduction(nested.result[0]!.reduction!)),negated:expression.negated});}
      return destination;
    }
    // expr.c:sqlite3CodeSubselect supplies a destination in the enclosing
    // Parse/Vdbe. No completed child program can be relocated into this owner.
    const destination=allocate(),isIn=expression.kind==='in-subquery';
    const cursor=isIn?selectProgramBuilder.cursor():-1;
    if(isIn)resultOps.push({code:'OpenEphemeral',p1:cursor,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:1,keyFieldCount:1,terms:[{collation:collation(expression.left)}]})});
    else resultOps.push(expression.exists?{code:'Integer',p1:0n,p2:destination}:{code:'Null',p2:destination});
    const once=allocate(),onceAt=resultOps.length;
    resultOps.push({code:'Once',p1:once,p2:0});
    const owner={builder:selectProgramBuilder,ops:resultOps,parameters,destination:isIn?{kind:'set' as const,cursor}:expression.exists?{kind:'exists' as const,register:destination}:{kind:'mem' as const,register:destination}};
    if(selectHasAggregate(nested)||nested.hasGroupBy||nested.hasHaving){
      compileAggregateSelect(nested,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,owner);
    }else{
      // The shared scan generator owns non-aggregate row publication and the
      // same nMem/nTab ranges as the scalar/EXISTS/IN consumer.
      let expanded:ReturnType<typeof expandAndResolveSelect>;
      try{expanded=expandAndResolveSelect(nested,schema,null,selectProgramBuilder.cursors)}
      catch(error){if(error instanceof NameResolutionError)throw new JSQLiteError('sqlite',error.message,{code:1});throw error;}
      compileInnerTableSelect(nested,expanded,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,owner);
      if(!isIn&&!expression.exists)subqueryColumns.set(nested,{name:expanded.result[0]!.name,declaredType:expanded.result[0]!.descriptor.declaredType,database:expanded.result[0]!.descriptor.database,table:expanded.result[0]!.descriptor.table,origin:expanded.result[0]!.descriptor.origin});
    }
    (resultOps[onceAt] as {p2:number}).p2=resultOps.length;
    if(isIn){const left=compileExpressionTree(expression.left,resultOps,allocate,parameters,compileSubquery);resultOps.push({code:'InSet',p1:cursor,key:left,output:destination,affinity:inComparisonAffinity(expression.left,expressionFromReduction(nested.result[0]!.reduction!)),negated:expression.negated});}
    return destination;
  };
  // Resolve/number result expressions in SQL source order, but retain their
  // opcodes until after computeLimitRegisters. SQLite computes LIMIT and
  // OFFSET before entering the result-production path, so LIMIT 0 skips even
  // failing or work-heavy result expressions while an invalid OFFSET still
  // fails before that zero-row jump.
  const expressions = select.result.map(expression => compileExpression(expression, resultOps, allocate, parameters, compileSubquery));
  const bodyExit=ops.length;ops.push({code:"Goto",p2:0});
  (ops[scalarSetup] as {p2:number}).p2=ops.length;
  const limit=computeLimitRegisters(select,ops,allocate,parameters);
  let whereSkip=-1;
  if(select.where){
    if(!select.where.reduction)throw new JSQLiteError('unsupported','scalar WHERE expression is not implemented',{unsupportedClassification:'temporary'});
    const predicate=compileExpressionTree(expressionFromReduction(select.where.reduction),ops,allocate,parameters,compileSubquery,true);
    whereSkip=ops.length;ops.push({code:'IfNot',p1:predicate,p2:0});
  }
  ops.push({code:"Goto",p2:scalarBody});
  (ops[bodyExit] as {p2:number}).p2=ops.length;
  // where.c:6945 zero-FROM ordinary SELECT is WHERE_DISTINCT_UNIQUE.
  // select.c:codeDistinct does not filter a sole candidate; ALL remains ALL.
  const resultStart = selectProgramBuilder.range(expressions.length);
  expressions.forEach((expression, index) => ops.push({ code: "Copy", p1: expression.register, p2: resultStart + index }));
  const offsetSkip=limit?.offset===undefined?undefined:ops.length;
  if(limit?.offset!==undefined)ops.push({code:"IfPos",p1:limit.offset,p2:0,p3:1});
  if(owner)owner.emitRow(resultStart,expressions.length);else emitSelectDestination(ops,{kind:"output"},resultStart,expressions.length);
  if(limit)ops.push({code:"DecrJumpZero",p1:limit.count,p2:ops.length+1});
  const halt=ops.length;if(!owner)ops.push({ code: "Halt" });
  if(whereSkip>=0)(ops[whereSkip] as {p2:number}).p2=halt;
  if(limit){(ops[limit.ifZero] as {p2:number}).p2=halt;if(offsetSkip!==undefined)(ops[offsetSkip] as {p2:number}).p2=halt;}
  return Object.freeze({ ops: owner?ops:Object.freeze(ops), registers: selectProgramBuilder.registers, maxWorkUnits, maxResultBytes, privateStateLimits, encoding, parameters: Object.freeze(parameters.names.map(name => Object.freeze({ name }))), columns: Object.freeze(expressions.map((expression,index) => { const node=select.result[index]?.reduction?expressionFromReduction(select.result[index]!.reduction!):null; const inner=scalarResolved?.result[index]?.descriptor??(node?.kind==="scalar-subquery"&&!node.exists?subqueryColumns.get(node.select):undefined); return Object.freeze({ name: expression.name, declaredType: inner?.declaredType??null, database: inner?.database??null, table: inner?.table??null, origin: inner?.origin??null }); })), ...(database?{database,maxRows}: {}) });
}

// select.c:sqlite3KeyInfoFromExprList uses ExprNNCollSeq, not type/origin metadata.
// Shared by ordinary parent-destination and direct physical DISTINCT producers.
function resolvedResultKeyTerms(plan:ReturnType<typeof expandAndResolveSelect>):{collation:BuiltinCollation}[]{
 return plan.result.map(result=>{
  const expr=result.expression.reduction;
  const named=(expr?resolvedExpressionCollation(expr,plan):result.descriptor.collation)??'binary';
  const normalized=sqliteAsciiFold(named);
  if(normalized!=='binary'&&normalized!=='nocase'&&normalized!=='rtrim')throw new JSQLiteError('sqlite',`no such collation sequence: ${named}`,{code:1});
  return {collation:normalized};
 });
}

function resolvedScalarSubqueryEmitter(expanded:ReturnType<typeof expandAndResolveSelect>,builder:SelectProgramBuilder<Op>,parameters:ParameterBuilder,environment:{database:BtreeDatabase;maxRows:number;maxWorkUnits:number;maxResultBytes:number;privateStateLimits:PrivateStateLimits},outerBinding?:ResolvedExpressionBinding):(expression:SubqueryExpression)=>number {
  const ops=builder.ops,allocate=()=>builder.register();
  const nestedPlans=new Map<SelectNode,{plan:ReturnType<typeof expandAndResolveSelect>;cursor:number}>();
  const rememberNested=(plan:ReturnType<typeof expandAndResolveSelect>):void=>{for(const child of plan.nested){nestedPlans.set(child.source,{plan:child,cursor:builder.cursor()});rememberNested(child);}};rememberNested(expanded);
  const compileJoinSubquery=(expression:SubqueryExpression):number=>{
    if(expression.select.result.length!==1)throw new JSQLiteError('sqlite',`sub-select returns ${expression.select.result.length} columns - expected 1`,{code:1});
    const entry=nestedPlans.get(expression.select),item=expression.select.result[0];
    if(!entry||!item?.reduction||expression.kind==='in-subquery'||expression.select.hasValues)throw new JSQLiteError('unsupported','this scalar subquery shape is not implemented',{unsupportedClassification:'temporary'});
    const source=entry.plan.sources[0],tree=expressionFromReduction(item.reduction);if(tree.kind==='aggregate'&&(expression.select.offset||expression.exists||tree.distinct||tree.orderBy.length))throw new JSQLiteError('unsupported','this scalar subquery shape is not implemented',{unsupportedClassification:'temporary'});
    // resolve.c:lookupName already assigned each reduction's lexical source
    // and iColumn through pNext. This joined consumer must not re-search SQL
    // spelling across the inner and outer SrcLists (rowid is not a column).
    const localCursors=new Map(entry.plan.sources.map(ref=>[ref,ref===source?entry.cursor:builder.cursor()]));
    const cursorFor=(ref:ResolvedSource)=>localCursors.get(ref)??ref.cursorId;
    const binding:ResolvedExpressionBinding|undefined=outerBinding?{policy:outerBinding.policy,location:ref=>localCursors.has(ref.source)?{kind:'cursor',cursor:cursorFor(ref.source)}:outerBinding?.location(ref,0)??{kind:'cursor',cursor:ref.source.cursorId}}:undefined;
    const result=allocate(),once=entry.plan.correlated?undefined:allocate(),onceAt=once===undefined?-1:ops.length;if(once!==undefined)ops.push({code:'Once',p1:once,p2:0});ops.push(expression.exists?{code:'Integer',p1:0n,p2:result}:{code:'Null',p2:result});const limit=computeScalarLimitRegisters(expression.select,ops,allocate,parameters);
      // expr.c installs scalar LIMIT 1 (or X<>0), keeping OFFSET. Build
      // SELECT's sorter capacity from that prepared count, not raw child X.
      const count=limit?.count??allocate();if(!limit)ops.push({code:'Integer',p1:1n,p2:count});
      const ifZero=limit?.ifZero??ops.length;if(!limit)ops.push({code:'IfNot',p1:count,p2:0});
      let offset:number|undefined;
      if(expression.select.offset){offset=compileExpressionTree(expressionFromReduction(expression.select.offset.reduction!),ops,allocate,parameters);ops.push({code:'MustBeInt',p1:offset});}
      const combined=allocate(),capacity=allocate();
      ops.push(offset===undefined?{code:'Copy',p1:count,p2:combined}:{code:'OffsetLimit',p1:count,p2:combined,p3:offset},{code:'Copy',p1:combined,p2:capacity});
      const preparedLimit:LimitRegisters={count,...(offset===undefined?{}:{offset}),combined,capacity,ifZero};
    if(expression.select.hasCompound){
      const plans=entry.plan.compoundArms;
      if(!plans||expression.select.arms.some(arm=>arm.operatorFromPrior&&arm.operatorFromPrior!=='union-all')||plans.some(plan=>plan.source.hasGroupBy||plan.source.hasHaving||selectHasAggregate(plan.source)||plan.sources.some(source=>!source.table)))throw new JSQLiteError('unsupported','this correlated scalar compound is not implemented',{unsupportedClassification:'temporary'});
      emitScalarCompoundMerge(expression.select,undefined,environment.database,environment.maxRows,environment.maxWorkUnits,environment.maxResultBytes,environment.privateStateLimits,builder,parameters,expression.exists?{kind:'exists',register:result}:{kind:'mem',register:result},(_arm,_emitRow,destination)=>{
        const plan=plans.find(plan=>plan.source.result[0]!.reduction===_arm.result[0]!.reduction)!,local=new Map(plan.sources.map(source=>[source,builder.cursor()]));
        const armBinding:ResolvedExpressionBinding={policy:'scalar',location:ref=>local.has(ref.source)?{kind:'cursor',cursor:local.get(ref.source)!}:outerBinding?.location(ref,0)??{kind:'cursor',cursor:ref.source.cursorId}};
        if(plan.sources.length)compileInnerTableSelect(plan.source,plan,environment.database,environment.maxRows,environment.maxWorkUnits,environment.maxResultBytes,environment.privateStateLimits,{builder,ops,parameters,destination,scalarPrepared:true,expressionBinding:armBinding,cursorFor:source=>local.get(source)??source.cursorId});
        else {
          const child=resolvedScalarSubqueryEmitter(plan,builder,parameters,environment,armBinding);
          const bind=(reduction:Reduction)=>bindResolvedExpression(expressionFromReduction(reduction),resolvedExpressionCarrier(plan,reduction),source=>source.cursorId,true,armBinding);
          const end=builder.label();if(plan.source.where){const predicate=compileExpressionTree(bind(plan.source.where.reduction! as Reduction),ops,allocate,parameters,child);builder.jump(end,{code:'IfNot',p1:predicate,p2:0},(op,pc)=>({...op,p2:pc}));}
          const value=compileExpressionTree(bind(plan.source.result[0]!.reduction! as Reduction),ops,allocate,parameters,child);emitSelectDestination(ops,destination,value,1);builder.mark(end);builder.resolveLabel(end);
        }
      },{plans,limit:preparedLimit});
      (ops[preparedLimit.ifZero] as {p2:number}).p2=ops.length;if(onceAt>=0)(ops[onceAt] as {p2:number}).p2=ops.length;return result;
    }
    if(tree.kind!=='aggregate'&&!expression.select.hasGroupBy&&!expression.select.hasHaving){
      // expr.c supplies the initialized Mem destination and normalized scalar
      // LIMIT; select.c owns projection, WHERE positioning and first-row exit.
      // Keep the linked NameContext/source objects, mapping only physical reads.
      if(!source){
        // select.c: a SELECT without SrcItems visits its inner loop once.
        // Do not enter WHERE's physical-loop planner with an empty SrcList.
        const bind=(reduction:Reduction)=>bindResolvedExpression(expressionFromReduction(reduction),resolvedExpressionCarrier(entry.plan,reduction),cursorFor,true,binding);
        const end=builder.label();
        if(expression.select.where){const predicate=compileExpressionTree(bind(expression.select.where.reduction! as Reduction),ops,allocate,parameters,compileJoinSubquery);builder.jump(end,{code:'IfNot',p1:predicate,p2:0},(op,pc)=>({...op,p2:pc}));}
        if(offset!==undefined)builder.jump(end,{code:'IfPos',p1:offset,p2:0,p3:1},(op,pc)=>({...op,p2:pc}));
        const value=compileExpressionTree(bind(item.reduction as Reduction),ops,allocate,parameters,compileJoinSubquery);
        emitSelectDestination(ops,expression.exists?{kind:'exists',register:result}:{kind:'mem',register:result},value,1);
        builder.mark(end);builder.resolveLabel(end);
      }else       compileInnerTableSelect(expression.select,entry.plan,environment.database,environment.maxRows,environment.maxWorkUnits,environment.maxResultBytes,environment.privateStateLimits,{builder,ops,parameters,destination:expression.exists?{kind:'exists',register:result}:{kind:'mem',register:result},scalarPrepared:true,sharedLimit:preparedLimit,...(binding?{expressionBinding:binding}:{}),cursorFor});
      // Patch both explicit LIMIT and the synthesized scalar LIMIT 1 guard.
      // Leaving the latter at pc0 escapes enclosing RIGHT continuations.
      (ops[preparedLimit.ifZero] as {p2:number}).p2=ops.length;
      if(onceAt>=0)(ops[onceAt] as {p2:number}).p2=ops.length;
      return result;
    }
    // select.c owns analysis, accumulator reset/finalization and Mem production.
    compileAggregateSelect(expression.select,undefined,environment.database,environment.maxRows,environment.maxWorkUnits,environment.maxResultBytes,environment.privateStateLimits,{builder,ops,parameters,destination:{kind:'mem',register:result},linkedPlan:entry.plan,scalarPrepared:true,sharedLimit:preparedLimit,cursorFor,...(binding?{expressionBinding:binding}:{})});
    (ops[preparedLimit.ifZero] as {p2:number}).p2=ops.length;if(onceAt>=0)(ops[onceAt] as {p2:number}).p2=ops.length;return result;
  };
  return compileJoinSubquery;
}

function compileInnerTableSelect(select:SelectNode,expanded:ReturnType<typeof expandAndResolveSelect>,database:BtreeDatabase,maxRows:number,maxWorkUnits:number,maxResultBytes:number,privateStateLimits:PrivateStateLimits):Program;
function compileInnerTableSelect(select:SelectNode,expanded:ReturnType<typeof expandAndResolveSelect>,database:BtreeDatabase,maxRows:number,maxWorkUnits:number,maxResultBytes:number,privateStateLimits:PrivateStateLimits,owner:{builder:SelectProgramBuilder<Op>;ops:Op[];parameters:ParameterBuilder;destination:SelectDest;sharedLimit?:LimitRegisters;scalarPrepared?:boolean;expressionBinding?:ResolvedExpressionBinding;cursorFor?:(source:ResolvedSource)=>number;consumeRow?:()=>void;compoundLimit?:{registers:LimitRegisters|undefined;stops:number[]}}):NonNullable<Program["whereAccounting"]>;
function compileInnerTableSelect(select:SelectNode,expanded:ReturnType<typeof expandAndResolveSelect>,database:BtreeDatabase,maxRows:number,maxWorkUnits:number,maxResultBytes:number,privateStateLimits:PrivateStateLimits,owner?:{builder:SelectProgramBuilder<Op>;ops:Op[];parameters:ParameterBuilder;destination:SelectDest;sharedLimit?:LimitRegisters;scalarPrepared?:boolean;expressionBinding?:ResolvedExpressionBinding;cursorFor?:(source:ResolvedSource)=>number;consumeRow?:()=>void;compoundLimit?:{registers:LimitRegisters|undefined;stops:number[]}}):Program|NonNullable<Program["whereAccounting"]> {
  if(expanded.sources.some((source,index)=>index>0&&source.joinFromLeft.error))throw new JSQLiteError("unsupported","invalid joins are not implemented",{unsupportedClassification:"temporary"});
  const rightLevels=expanded.sources.flatMap((source,index)=>index>0&&source.joinFromLeft.right?[index]:[]),rightLevel=rightLevels[0]??-1;
  // Pinned wherecode.c owns a WhereRightJoin per barrier. Composite
  // WITHOUT ROWID match keys remain an atomic temporary boundary.
  if(rightLevels.some(level=>expanded.sources[level]!.table.withoutRowid))throw new JSQLiteError("unsupported","WITHOUT ROWID RIGHT/FULL match keys are not implemented",{unsupportedClassification:"temporary"});

  for(const source of expanded.sources)if(source.table.columns.some(column=>column.generatedExpr))throw new JSQLiteError("unsupported","this table storage shape is not implemented",{unsupportedClassification:"temporary"});
  // Even while the established multi-source loop lowering remains in place,
  // consume the immutable where.c handoff for candidate/path identity and
  // accounting. Global ordering is deliberately not requested/proved here.
  let multiWhere:ReturnType<typeof planWhere>,whereAccounting:Readonly<{plannerCandidates:number;plannerPaths:number}>;
  const builder=owner?.builder??new SelectProgramBuilder<Op>();
  const ops:Op[]=owner?.ops??builder.ops,parameters:ParameterBuilder=owner?.parameters??{maximum:0,names:[],named:new Map()};
  const resultStart=owner?owner.builder.range(Math.max(1,expanded.result.length)):1;
  let registers=owner?.builder.registers??expanded.result.length;
  builder.registers=Math.max(builder.registers,registers);
  const allocate=()=>{const register=builder.register();registers=builder.registers;return register;};
  const range=(count:number)=>{const first=builder.range(count);registers=builder.registers;return first;};
  const cursorFor=owner?.cursorFor??((source:ResolvedSource)=>source.cursorId);
  // expr.c:sqlite3ExprCodeGetColumnOfTable and wherecode.c index substitution
  // preserve declared semantic columns while mapping the payload at the caller.
  const primaryFor=(source:ResolvedSource):PhysicalIndex=>{
    const physical=source.table.indexes.find(index=>index.origin==='primary-key')?.physical;
    if(!physical)throw new JSQLiteError('unsupported','WITHOUT ROWID primary layout is not represented',{unsupportedClassification:'temporary'});
    return physical;
  };
  const columnAccess=(source:ResolvedSource,columnIndex:number):{cursor:number;physicalColumnIndex?:number}=>{
    const ordinal=expanded.sources.indexOf(source),selected=selectedBySource.get(ordinal),physical=selected?.capability?.physicalIndex,indexCursor=indexCursors.get(ordinal);
    if(indexCursor!==undefined&&physical&&source.table.withoutRowid&&(selected?.capability?.covering||physical.index.origin==='primary-key')){
      const at=physical.fields.findIndex(field=>field.column===source.table.columns[columnIndex]||(field.role==='rowid-tail'&&(columnIndex<0||isIntegerPrimaryKeyAlias(source.table,columnIndex))));
      if(at<0)throw new JSQLiteError('unsupported','covering column layout is not represented',{unsupportedClassification:'temporary'});
      return {cursor:indexCursor,physicalColumnIndex:at};
    }
    if(source.table.withoutRowid){
      const at=primaryFor(source).fields.findIndex(field=>field.column===source.table.columns[columnIndex]);
      if(at<0)throw new JSQLiteError('unsupported','WITHOUT ROWID table column layout is not represented',{unsupportedClassification:'temporary'});
      return {cursor:cursorFor(source),physicalColumnIndex:at};
    }
    return {cursor:cursorFor(source)};
  };
  const resolveTree=(tree:Expression,reduction?:Reduction):Expression=>{if(owner?.expressionBinding&&reduction)return bindResolvedExpression(tree,resolvedExpressionCarrier(expanded,reduction),cursorFor,true,{...owner.expressionBinding,location:(ref,depth)=>expanded.sources.includes(ref.source)?{kind:'cursor',...columnAccess(ref.source,ref.columnIndex)}:owner.expressionBinding!.location(ref,depth)});const visit=(node:Expression,reduction?:Reduction):Expression=>{
    if(reduction)reduction=expressionIdentityReduction(reduction);
    const children=reduction?descendantExprs(reduction).filter((child):child is Reduction=>child.kind==='reduction'):[];
    let index=0;const operand=(value:Expression):Expression=>{const child=children[index++];if(reduction&&!child)throw new JSQLiteError('internal','resolved join operand lost identity');return visit(value,child);};
    if(node.kind==="column") {
      // Physical WHERE selected operands and generated USING predicates lack
      // reduction identity today; retain their bounded source interface.
      const parts=node.name.split('.').map(sqlName);
      const generated=!reduction?expanded.sources.flatMap(source=>{if(parts.length>1&&!sqliteIdentifierEqual(parts.at(-2)!,source.alias??source.table.name))return [];const columnIndex=source.table.columns.findIndex(column=>sqliteIdentifierEqual(column.name,parts.at(-1)!));return columnIndex>=0?[{source,columnIndex}]:!source.table.withoutRowid&&['rowid','_rowid_','oid'].some(name=>sqliteIdentifierEqual(name,parts.at(-1)!))?[{source,columnIndex:-1}]:[];}):[];
      const use=reduction?expanded.columnUses.find(candidate=>candidate.expression===reduction):generated.length===1?generated[0]:undefined;
      if(!use){const alias=select.result.find(result=>result.alias&&sqliteIdentifierEqual(result.alias,sqlName(node.name)));if(alias?.reduction)return visit(expressionFromReduction(alias.reduction),alias.reduction as Reduction);throw new JSQLiteError('internal',`resolved join column lost identity: ${node.name}`);}
      const column=(ref:{source:typeof use.source;columnIndex:number}):Expression=>{
        const index=ref.columnIndex<0||isIntegerPrimaryKeyAlias(ref.source.table,ref.columnIndex)?-1:ref.columnIndex;
        const c=index<0?'binary':sqliteAsciiFold(ref.source.table.columns[index]!.collation??'binary');
        if(c!=='binary'&&c!=='nocase'&&c!=='rtrim')throw new JSQLiteError('sqlite',`no such collation sequence: ${c}`,{code:1});
        return {...node,...columnAccess(ref.source,ref.columnIndex),index,affinity:index<0?'integer':ref.source.table.columns[index]!.affinity,collation:c};
      };
      const merged='mergedSources' in use?use.mergedSources:undefined;
      return merged?{kind:'call',name:'coalesce',args:merged.map(column),deferredAffinity:true}:column(use);
    }
    // resolve.c:resolveExprStep walks operands of TK_IN (and BETWEEN) in the
    // owning NameContext before expr.c:sqlite3ExprCodeIN reads the left value.
    // The joined predicate must retain the exact source cursor even when the
    // column is nested rather than the immediate child of a binary operator.
    if(node.kind==="unary"&&node.op==='NOT'&&reduction?.signature.startsWith('expr ::= expr likeop '))node.value=visit(node.value,reduction);
    else if(node.kind==="unary"||node.kind==="cast"||node.kind==="collate")node.value=operand(node.value);
    else if(node.kind==="binary"){
      node.left=operand(node.left);
      if(reduction?.signature!=="expr ::= expr ISNULL|NOTNULL"&&reduction?.signature!=="expr ::= expr NOT NULL")node.right=operand(node.right);
    }
    else if(node.kind==="in-list"){node.left=operand(node.left);node.values=node.values.map(operand);}
    else if(node.kind==="in-subquery")node.left=operand(node.left);
    else if(node.kind==="between"){node.value=operand(node.value);node.lower=operand(node.lower);node.upper=operand(node.upper);}
    else if(node.kind==="call"||node.kind==="aggregate")node.args=node.args.map((arg,index)=>{const child=children[infixFunctionChild(reduction?.signature??'',index)];if(reduction&&!child)throw new JSQLiteError('internal','resolved join operand lost identity');return visit(arg,child);});
    else if(node.kind==="case"){if(node.operand)node.operand=operand(node.operand);node.pairs=node.pairs.map(([a,b])=>[operand(a),operand(b)]);if(node.otherwise)node.otherwise=operand(node.otherwise);}
    return node;};return visit(tree,reduction);};
  // select.c:multiSelect(TK_ALL) forwards the compound iLimit/iOffset into
  // each arm; only the enclosing producer initializes those registers.
  const limit=owner?.compoundLimit?owner.compoundLimit.registers:owner?.sharedLimit??(owner?.scalarPrepared?undefined:computeLimitRegisters(select,ops,allocate,parameters));
  const multiOrder=resolvedWhereOrder(expanded);
  // wherecode.c:codeINTerm admits a per-slot RHS cursor after its
  // prerequisites are positioned; the selected loop below lowers each slot.
  multiWhere=planWhere(expanded,{neededColumns:expanded.sources.map(source=>new Set([...source.table.columns,...(source.table.withoutRowid?[]:[ROWID_NEEDED])])),orderBy:multiOrder,planBudget:builder.wherePlanBudget});
  whereAccounting=Object.freeze({plannerCandidates:multiWhere.plannerCandidates,plannerPaths:multiWhere.plannerPaths});
  const multiOrderConsumed=rightLevels.length===0&&!owner?.scalarPrepared&&multiOrder.length===select.orderBy.length&&multiWhere.path?.orderTermsSatisfied===select.orderBy.length;
  const sorterCursor=owner?owner.builder.cursor():expanded.sources.length,distinctCursor=owner?owner.builder.cursor():sorterCursor+1,rightMatchCursor=owner?owner.builder.cursor():distinctCursor+1;
  const selectedBySource=new Map(multiWhere.path?.loops.map(loop=>[loop.sourceOrdinal,loop])??[]),indexCursors=new Map<number,number>();
  for(const [ordinal,loop] of selectedBySource){const physical=loop.capability?.physicalIndex;if(loop.kind==='index'&&physical){const cursor=owner?owner.builder.cursor():rightMatchCursor+rightLevels.length+ordinal;indexCursors.set(ordinal,cursor);ops.push({code:'OpenIndex',p1:physical.index.rootPage,p2:cursor,physical});}}
  const orderTerms=(multiOrderConsumed?[]:select.orderBy).map((term,index)=>{let tree=expressionFromReduction(term.expr.reduction!),identity=tree;while(identity.kind==='collate')identity=identity.value;let resultIndex=-1;if(identity.kind==='literal'&&typeof identity.value==='bigint'){if(identity.value<1n||identity.value>BigInt(expanded.result.length)){const n=index+1,suffix=n%100>=11&&n%100<=13?'th':n%10===1?'st':n%10===2?'nd':n%10===3?'rd':'th';throw new JSQLiteError('sqlite',`${n}${suffix} ORDER BY term out of range - should be between 1 and ${expanded.result.length}`,{code:1});}resultIndex=Number(identity.value-1n);}else if(identity.kind==='column'&&!identity.name.includes('.'))resultIndex=expanded.result.findIndex(result=>sqliteIdentifierEqual(result.name,sqlName(identity.name)));return{tree:resultIndex<0?resolveTree(tree,term.expr.reduction as Reduction):tree,resultIndex,descending:term.descending,nullsLarge:term.nulls==='last'?!term.descending:term.nulls==='first'?term.descending:false};});
  if(owner)owner.builder.reserveCursorsThrough(Math.max(-1,...expanded.sources.map(source=>cursorFor(source))));

  if(orderTerms.length)ops.push({code:'SorterOpen',p1:sorterCursor,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:orderTerms.length,keyFieldCount:orderTerms.length,terms:orderTerms.map(term=>({collation:term.resultIndex>=0?sqliteAsciiFold(expanded.result[term.resultIndex]!.descriptor.collation) as BuiltinCollation:collation(term.tree),desc:term.descending,nullsLarge:term.nullsLarge}))})});
  if(select.hasDistinct)ops.push({code:'OpenEphemeral',p1:distinctCursor,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:expanded.result.length,keyFieldCount:expanded.result.length,terms:resolvedResultKeyTerms(expanded)})});
  // Parent-program construction labels, not a finished child PC map. The
  // body is inline on the matched pass and called on the unmatched pass.
  // whereInt.h:WhereRightJoin belongs to a WhereLevel, never the SELECT.
  // Normal nested scans close in reverse order; unmatched scans run forward.
  // Bloom is omitted: exact typed Found remains the membership owner.
  const rightStates=new Map(rightLevels.map((level,index)=>{
    const state={matchCursor:index===0?rightMatchCursor:owner?builder.cursor():rightMatchCursor+index,
      key:allocate(),returnRegister:allocate(),body:{entry:-1,continue:-1,break:-1}};
    ops.push({code:'Null',p2:state.returnRegister},{code:'OpenEphemeral',p1:state.matchCursor,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:1,keyFieldCount:1,terms:[{collation:'binary'}]})});
    return [level,state] as const;
  }));
  // expr.c:sqlite3CodeSubselect lowers into the caller's VDBE. The
  // bounded join route likewise emits a correlated aggregate in the joined-row
  // body, where it observes the current outer cursors.
  // Standalone joined consumers retain their existing nested cursor range.
  // Parent-owned consumers already reserved their physical source frontier.
  builder.registers=Math.max(builder.registers,registers);
  if(!owner)builder.reserveCursorsThrough(999);
  const nestedBinding:ResolvedExpressionBinding={policy:owner?.expressionBinding?.policy??'scalar',location:(ref,depth)=>expanded.sources.includes(ref.source)?{kind:'cursor',...columnAccess(ref.source,ref.columnIndex)}:owner?.expressionBinding?.location(ref,depth)??{kind:'cursor',cursor:ref.source.cursorId}};
  const compileJoinSubquery=resolvedScalarSubqueryEmitter(expanded,builder,parameters,{database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits},nestedBinding);
  const compilePredicate=(expression:SelectNode['where'])=>{if(!expression?.reduction)return undefined;const value=compileExpressionTree(resolveTree(expressionFromReduction(expression.reduction),expression.reduction as Reduction),ops,allocate,parameters,compileJoinSubquery),at=ops.length;ops.push({code:'IfNot',p1:value,p2:0,residual:true});return at;};
  // wherecode.c code_outer_join_constraints: compile-time TERM_CODED
  // belongs to this WHERE invocation, not the immutable analysis or a scan.
  const whereTerms=analyzeWhere(expanded,true).clause.terms.filter(term=>!term.virtual&&term.origin.kind==='where');
  const codedWhere=new Set<number>();
  const codedOrIdentities=new Set<string>();
  // Case5 disableTerm is invocation-owned and applies to ordinary final
  // residuals as well as outer-join constraints. Untested parents are never
  // published here, so their complete truth survives to its ready frontier.
  const termIsCoded=(term:WhereTerm):boolean=>codedWhere.has(term.id)||codedOrIdentities.has(expressionStructuralIdentity(term.expression));
  const codeOuterConstraints=(level:number,ready:bigint):void=>{
    if(loopSources[level]!.leftOfRightJoin)return;
    for(const term of whereTerms){
      if(termIsCoded(term)||(term.prereqAll&~ready)!==0n)continue;
      const at=compilePredicate(term.expression);
      if(at!==undefined){jumps.push({at,level});codedWhere.add(term.id);}
    }
  };
  expanded.sources.forEach(source=>ops.push(source.table.withoutRowid?{code:'OpenIndex',p1:source.table.rootPage,p2:cursorFor(source),physical:primaryFor(source)}:{code:'OpenRead',p1:source.table.rootPage,p2:cursorFor(source)}));
  // wherecode.c opens and advances the selected secondary cursor, then leaves
  // table positioning deferred until an uncovered read.  Keep cursor identity
  // distinct from source, sorter and RIGHT-join cursors.
  // Linked scalar preparation supplies a normalized first-row Mem consumer.
  // Bind each owned constraint expression with its reduction before selecting
  // the RHS: prepared scalar outer references retain their NameContext phase.

  // where.c:wherePathSolver chooses both access and loop order. wherecode.c
  // evaluates each RHS only after its prereqRight cursors are positioned.
  // Keep the existing source-order NULL-row continuation for outer/right joins.
  const loopOrdinals=rightLevel<0&&expanded.sources.every(source=>!source.joinFromLeft.left)
    ?multiWhere.path!.loops.map(loop=>loop.sourceOrdinal)
    :expanded.sources.map((_,ordinal)=>ordinal);
  const loopSources=loopOrdinals.map(ordinal=>expanded.sources[ordinal]!);

  const rewinds:number[]=[],starts:number[]=[],bodies:number[]=[],singleRows:boolean[]=[],leftMatches:(number|undefined)[]=[],loopEnds:{at:number;level:number}[]=[],startNullGuards:{at:number;level:number}[]=[],equalityNullGuards:{at:number;level:number}[]=[],jumps:{at:number;level:number}[]=[],inRestarts=new Map<number,{iterators:number[];advance:number}>(),prefixLoops=new Map<number,PrefixLoop>(),nullPasses=new Map<number,number>(),nullContinues=new Map<number,number>();
  // A forward RIGHT drain can enter a deeper body even when an empty outer
  // scan never initialized that level. Its LEFT continuation flags must be
  // valid integers before any body is callable (where.c/wherecode.c reset).
  for(let level=0;level<loopSources.length;level++)if(level>0&&loopSources[level]!.joinFromLeft.left){leftMatches[level]=allocate();const nullPass=allocate();nullPasses.set(level,nullPass);ops.push({code:'Integer',p1:0n,p2:leftMatches[level]!},{code:'Integer',p1:0n,p2:nullPass});}
  const orReturns=new Map<number,number>();
  const orCovering=new Map<number,{physical:PhysicalIndex;cursor:number;tableCursor:number;start:number}>();
  // Case5 owns a subroutine per selected level. Its body is the ordinary
  // downstream join continuation; every outer-row invocation resets RowSet.
  const emitJoinedOr=(parent:WhereLoop,outer:WhereClause,tableCursor:number,readyMask:bigint,body?:()=>void):{exit:number;returnRegister:number;calls:number[];covering:PhysicalIndex|null;indexCursor:number}=>{
    const rowset=allocate(),rowid=allocate(),returnRegister=allocate(),calls:number[]=[];
    ops.push({code:'Null',p2:rowset});const safe=ops.length;ops.push({code:'Integer',p1:0n,p2:returnRegister});
    const arms=parent.orInfo!.clause.terms.filter(term=>!term.virtual);
    const available=readyMask|(1n<<BigInt(parent.sourceOrdinal));
    // Native untestedTerms leaves parent residual enabled if recursive
    // WhereBegin cannot test an arm at this ready frontier.
    if(arms.every(arm=>(arm.prereqAll&~available)===0n)){
      for(const term of parent.terms)codedOrIdentities.add(expressionStructuralIdentity(term.expression));
    }
    const commonIndexCursor=builder.cursor();let covering:PhysicalIndex|null=null;
    const needed=new Set(parent.source.table.columns);needed.add(ROWID_NEEDED as never);
    for(const [batch,arm] of arms.entries()){
      const clause=orRuntimeArmClause(arm,parent.sourceOrdinal,outer,parent.orInfo!.clause);
      if(!clause)throw new JSQLiteError('internal','joined OR lost owned arm');
      const candidates=btreeLoops(parent.source,parent.sourceOrdinal,clause,{forcedIndex:null,neededColumns:needed,orderBy:[],resolved:expanded,planBudget:builder.wherePlanBudget});
      const branch=wherePathSolver([candidates],1,undefined,0,1,null,readyMask).loops[0]!;
      const consumed=branchConsumedTerms(branch,clause,available);
      const consume=(tested=false):void=>{
        // wherecode.c OR_SUBCLAUSE: test only terms whose prereqAll is
        // positioned. An AND arm owns individual terms; an OR atom must not
        // be partially tested. Untested parents remain in the enclosing
        // caller; fully tested parents are disabled for this invocation.
        const ready=readyMask|(1n<<BigInt(parent.sourceOrdinal));
        const residuals:number[]=[];
        const terms=tested?[]:arm.info?.kind==='and'?arm.info.clause.terms:[arm];
        for(const term of terms){
          if(term.virtual||consumed.has(term)||(term.prereqAll&~ready)!==0n)continue;
          const at=compilePredicate(term.expression);
          if(at!==undefined)residuals.push(at);
        }
        ops.push({code:'Rowid',p1:tableCursor,p2:rowid});const duplicate=ops.length;
        ops.push({code:'RowSetTest',p1:rowset,p2:0,p3:rowid,p4:batch===arms.length-1?-1:batch});
        calls.push(ops.length);ops.push({code:'Gosub',p1:returnRegister,p2:0});
        for(const at of residuals)(ops[at] as {p2:number}).p2=ops.length;
        (ops[duplicate] as {p2:number}).p2=ops.length;
      };
      if(branch.kind==='multi-or'){covering=null;emitJoinedOr(branch,clause,tableCursor,readyMask,()=>consume((arm.prereqAll&~available)===0n));continue;}
      const cap=branch.capability,physical=cap?.physicalIndex,indexCursor=physical?commonIndexCursor:undefined;
      covering=physical&&(batch===0||physical===covering)?physical:null;
      const guards:number[]=[],ends:number[]=[],equalityGuards:number[]=[],iterators:number[]=[];
      const rhs=(term:WhereTerm):Expression=>{
        // Canonical null tests have a generated NULL RHS, not a resolved child.
        const expression=resolveTree(expressionFromReduction(term.expression.reduction!),term.expression.reduction as Reduction);
        if(term.operator==='is-null')return {kind:'literal',value:null};
        if(expression.kind!=='binary')throw new JSQLiteError('internal','joined OR bound lost expression');
        return term.originalIndexedOperand==='left'?expression.right:expression.left;
      };
      const key=(term:WhereTerm):number=>compileExpressionTree(rhs(term),ops,allocate,parameters,compileJoinSubquery);
      let rewind:number,single=false,prefixLoop:PrefixLoop|undefined;
      if(physical){
        ops.push({code:'OpenIndex',p1:physical.index.rootPage,p2:indexCursor!,physical,orBranch:true});
        const equalities=cap!.equalitySlots.filter((slot):slot is IndexConstraintAdmission=>slot!==null);
        const reverse=cap!.reverse,rangeReverse=reverse!==!!physical.fields[cap!.nEq]?.descending;
        const start=rangeReverse?cap!.upper:cap!.lower;
        const admissions=start?[...equalities,start]:equalities;
        const skippedKeys=Array.from({length:cap!.nSkip},allocate),skippedAffinities=Array<MemAffinity>(cap!.nSkip).fill("blob");
        const prefixEntry=beginPrefixLoop(ops,indexCursor!,skippedKeys,skippedAffinities,physical.keyInfo,reverse,cap!.nSkip);
        const ordinal=(admission:IndexConstraintAdmission)=>cap!.nSkip+admissions.indexOf(admission);
        // codeEqualityTerm: owned IN RHS iterators reset per invocation;
        // WhereEnd restarts inner values before advancing outer values.
        const inTargets=new Map<typeof admissions[number],number>();
        for(const admission of admissions.filter(item=>item.operator==='in')){
          const tree=resolveTree(expressionFromReduction(admission.term.expression.reduction!),admission.term.expression.reduction as Reduction);
          if(tree.kind!=='in-list'||tree.negated)throw new JSQLiteError('internal','joined OR IN lost value list');
          const values=tree.values.map(value=>compileExpressionTree(value,ops,allocate,parameters,compileJoinSubquery));
          const indexRegister=allocate(),target=allocate();
          ops.push({code:'Integer',p1:0n,p2:indexRegister});iterators.push(ops.length);
          ops.push({code:'InListValue',values,indexRegister,target,p2:0,setKey:{affinity:admission.comparison.kind==='comparison'?admission.comparison.affinity:'blob',keyInfo:physical.keyInfo,fieldOrdinal:ordinal(admission),reverse:reverse!==!!physical.fields[ordinal(admission)]?.descending}});
          inTargets.set(admission,target);
        }
        const keys=admissions.map(admission=>inTargets.get(admission)??key(admission.term)),affinities=admissions.map(admission=>admission.comparison.kind==='comparison'?admission.comparison.affinity:'blob' as const);
        admissions.forEach((admission,i)=>{if(admission.operator==='eq'||admission===start&&!admission.term.virtualNull){(admission===start?guards:equalityGuards).push(ops.length);ops.push({code:'IsNull',p1:keys[i]!,p2:0});}});
        rewind=ops.length;
        if(admissions.length||cap!.nSkip)prefixLoop=emitPrefixSeek(ops,prefixEntry,indexCursor!,[...skippedKeys,...keys],[...skippedAffinities,...affinities],physical.keyInfo,reverse,!!start&&(start.bound==='lower-exclusive'||start.bound==='upper-exclusive'),{enabled:!!cap!.inSeekScan,rowLogEst:cap!.index!.rowLogEst[0]??99,hasRange:!!(cap!.lower||cap!.upper)});
        else ops.push({code:reverse?'IndexLast':'IndexRewind',p1:indexCursor!,p2:0});
        const loopStart=ops.length;
        if(cap!.nEq){ends.push(ops.length);ops.push({code:'IndexPrefixEnd',p1:indexCursor!,keys:[...skippedKeys,...keys].slice(0,cap!.nEq),affinities:[...skippedAffinities,...affinities].slice(0,cap!.nEq),keyInfo:physical.keyInfo,p2:0});}
        const end=rangeReverse?cap!.lower:cap!.upper;
        if(end){const endKey=key(end.term);if(!end.term.virtualNull){ops.push({code:'IsNull',p1:endKey,p2:0});ends.push(ops.length-1);}ops.push({code:'IndexRangeEnd',p1:indexCursor!,field:cap!.nEq,key:endKey,affinity:end.comparison.kind==='comparison'?end.comparison.affinity:'blob',collation:end.comparison.kind==='comparison'?end.comparison.collation:'binary',operator:end.operator as 'lt'|'le'|'gt'|'ge',p2:0});ends.push(ops.length-1);}
        ops.push({code:'DeferredSeek',p1:indexCursor!,p2:tableCursor});consume();
        ops.push({code:reverse?'IndexPrev':'IndexNext',p1:indexCursor!,p2:loopStart});
      }else{
        const eq=cap?.rowidEquality,lower=cap?.rowidLower,upper=cap?.rowidUpper;
        rewind=ops.length;
        if(eq){const register=key(eq.term);rewind=ops.length;ops.push({code:'SeekRowid',p1:tableCursor,key:register,p2:0});single=true;}
        else if(lower){const register=key(lower.term);rewind=ops.length;ops.push({code:'SeekRowidRange',p1:tableCursor,key:register,inclusive:lower.operator==='ge',reverse:false,p2:0});}
        else ops.push({code:'Rewind',p1:tableCursor,p2:0});
        const loopStart=ops.length;
        if(upper){ends.push(ops.length);ops.push({code:'RowidUpperBound',p1:tableCursor,key:key(upper.term),inclusive:upper.operator==='le',p2:0});}
        consume();if(!single)ops.push({code:'Next',p1:tableCursor,p2:loopStart});
      }
      const advance=ops.length;
      for(let i=iterators.length-1;i>=0;i--){
        if(i<iterators.length-1)(ops[iterators[i+1]!] as {p2:number}).p2=ops.length;
        ops.push({code:'Goto',p2:iterators[i]!});
      }
      if(prefixLoop?.restart!==null&&prefixLoop?.restart!==undefined)finishPrefixLoop(ops,prefixLoop,ops.length+1);
      const exit=ops.length;
      if(iterators.length)(ops[iterators[0]!] as {p2:number}).p2=prefixLoop?.restart??exit;
      for(const at of [rewind,...guards,...ends])if(ops[at]!.code!=="Goto")(ops[at] as {p2:number}).p2=advance;
      // '=' NULL terminates the arm, not just the current IN probe.
      for(const at of equalityGuards)(ops[at] as {p2:number}).p2=exit;
    }
    const exit=ops.length;ops.push({code:'Goto',p2:0});(ops[safe] as {p1:bigint}).p1=BigInt(exit-1);
    if(body){for(const call of calls)(ops[call] as {p2:number}).p2=ops.length;body();ops.push({code:'Return',p1:returnRegister});(ops[exit] as {p2:number}).p2=ops.length;}
    return {exit,returnRegister,calls,covering,indexCursor:commonIndexCursor};
  };
  for(let level=0;level<expanded.sources.length;level++){const source=loopSources[level]!,ordinal=loopOrdinals[level]!,isLeft=level>0&&source.joinFromLeft.left,selected=selectedBySource.get(ordinal),indexCursor=indexCursors.get(ordinal),scanCursor=indexCursor??cursorFor(source);if(isLeft){const nullPass=nullPasses.get(level)!;ops.push({code:'Integer',p1:0n,p2:leftMatches[level]!},{code:'Integer',p1:0n,p2:nullPass});}const readyMask=loopOrdinals.slice(0,level).reduce((mask,source)=>mask|(1n<<BigInt(source)),0n),rowEqCandidate=selected?.capability?.rowidEquality,rowEq=rowEqCandidate&&(rowEqCandidate.term.prereqRight&~readyMask)===0n?rowEqCandidate:null;
  if(selected?.kind==='multi-or'){
    const continuation=emitJoinedOr(selected,multiWhere.analysis.clause,cursorFor(source),readyMask);
    rewinds.push(continuation.exit);orReturns.set(level,continuation.returnRegister);singleRows[level]=false;
    for(const call of continuation.calls)(ops[call] as {p2:number}).p2=ops.length;
    if(continuation.covering)orCovering.set(level,{physical:continuation.covering,cursor:continuation.indexCursor,tableCursor:cursorFor(source),start:ops.length});
  }else {
  rewinds.push(ops.length);
  if(rowEq){const tree=resolveTree(expressionFromReduction(rowEq.term.expression.reduction!),rowEq.term.expression.reduction as Reduction);if(tree.kind!=="binary")throw new JSQLiteError('internal','rowid equality lost binary expression');const key=compileExpressionTree(rowEq.originalIndexedOperand==='left'?tree.right:tree.left,ops,allocate,parameters,compileJoinSubquery);rewinds[level]=ops.length;ops.push({code:'SeekRowid',p1:cursorFor(source),key,p2:0});singleRows[level]=true; }else {
    const capability=selected?.capability;
    const equalities=capability?.equalitySlots.filter((slot):slot is IndexConstraintAdmission=>slot!==null)??[];
    const usable=indexCursor!==undefined&&capability&&(capability.nEq||capability.lower||capability.upper);
    const reverseRange=!!usable&&(capability.reverse!==!!capability.physicalIndex?.fields[capability.nEq]?.descending);
    const start=usable?(reverseRange?capability.upper:capability.lower):null;
    const admissions=usable?(start?[...equalities,start]:equalities):[];
    // where.c:sqlite3WhereEnd advances IN loops inside-out. On a new outer
    // RHS value the inner index register must be reset before its first probe.
    const inAdmissions=admissions.filter(admission=>admission.operator==='in');
    const ready=admissions.every(admission=>(admission.term.prereqRight&~readyMask)===0n);
    const bound=(term:WhereTerm):Expression=>{if(term.operator==='is-null')return {kind:'literal',value:null};const expression=resolveTree(expressionFromReduction(term.expression.reduction!),term.expression.reduction as Reduction);if(expression.kind!=='binary')throw new JSQLiteError('internal','joined index bound lost binary expression');return term.originalIndexedOperand==='left'?expression.right:expression.left;};
    if(usable&&(admissions.length||capability.nSkip)&&ready){
      if(capability.inSeekScan&&level>0)ops.push({code:'IndexNullRow',p1:indexCursor!});
      const skippedKeys=Array.from({length:capability.nSkip},allocate),skippedAffinities=Array<MemAffinity>(capability.nSkip).fill('blob');
      const prefixEntry=beginPrefixLoop(ops,indexCursor!,skippedKeys,skippedAffinities,capability.physicalIndex!.keyInfo,capability.reverse,capability.nSkip);
      const ordinal=(admission:IndexConstraintAdmission)=>capability.nSkip+admissions.indexOf(admission);
      const inTargets=new Map<typeof admissions[number],number>();
      const iterators:number[]=[];
      for(const admission of inAdmissions){
        const tree=resolveTree(expressionFromReduction(admission.term.expression.reduction!),admission.term.expression.reduction as Reduction);
        if(tree.kind!=='in-list'||tree.negated)throw new JSQLiteError('internal','selected IN lost value list');
        const values=tree.values.map(value=>compileExpressionTree(value,ops,allocate,parameters,compileJoinSubquery));
        const indexRegister=allocate(),target=allocate();
        ops.push({code:'Integer',p1:0n,p2:indexRegister});
        const iterator=ops.length;
        ops.push({code:'InListValue',values,indexRegister,target,p2:0,setKey:{affinity:admission.comparison.kind==='comparison'?admission.comparison.affinity:'blob',keyInfo:capability.physicalIndex!.keyInfo,fieldOrdinal:ordinal(admission),reverse:capability.reverse!==!!capability.physicalIndex!.fields[ordinal(admission)]?.descending}});
        iterators.push(iterator);
        inTargets.set(admission,target);
      }
      if(iterators.length)inRestarts.set(level,{iterators,advance:iterators.at(-1)!});
      const keys=admissions.map(admission=>inTargets.get(admission)??compileExpressionTree(bound(admission.term),ops,allocate,parameters,compileJoinSubquery));
      // codeAllEqualityTerms: '=' NULL exits this level, not the next IN
      // value. IS/IS NULL retain searchable NULL keys; IN skips NULL itself.
      equalities.forEach((admission,i)=>{if(admission.operator==='eq'){equalityNullGuards.push({at:ops.length,level});ops.push({code:'IsNull',p1:keys[i]!,p2:0});}});
      // wherecode.c Case 4: nullable pRangeStart exits to addrNxt before
      // affinity or seek. This is the next IN value (or outer loop), not Halt.
      if(start&&!start.term.virtualNull){startNullGuards.push({at:ops.length,level});ops.push({code:'IsNull',p1:keys[keys.length-1]!,p2:0});}
      const affinities=admissions.map(admission=>admission.comparison.kind==='comparison'?admission.comparison.affinity:'blob' as const);
      const prefixLoop=emitPrefixSeek(ops,prefixEntry,indexCursor!,[...skippedKeys,...keys],[...skippedAffinities,...affinities],capability.physicalIndex!.keyInfo,capability.reverse,!!start&&(start.bound==='lower-exclusive'||start.bound==='upper-exclusive'),{enabled:!!capability.inSeekScan,rowLogEst:capability.index!.rowLogEst[0]??99,hasRange:!!(capability.lower||capability.upper)});
      rewinds[level]=prefixLoop.seek;prefixLoops.set(level,prefixLoop);
    }else ops.push(indexCursor===undefined&&!source.table.withoutRowid?{code:capability?.reverse?'Last':'Rewind',p1:scanCursor,p2:0}:{code:capability?.reverse?'IndexLast':'IndexRewind',p1:scanCursor,p2:0});
    singleRows[level]=false;
  }
  }
  starts.push(ops.length);
  if(indexCursor!==undefined){
    const capability=selected!.capability!,seek=ops[rewinds[level]!];
    if(seek?.code==='IndexSeekPrefix'||seek?.code==='IndexRewind'||seek?.code==='IndexLast'||(seek?.code==='Goto'&&prefixLoops.has(level))){
      if(capability.nEq&&prefixLoops.has(level)){const prefix=prefixLoops.get(level)!;ops.push({code:'IndexPrefixEnd',p1:indexCursor,keys:prefix.keys.slice(0,capability.nEq),affinities:prefix.affinities.slice(0,capability.nEq),keyInfo:capability.physicalIndex!.keyInfo,p2:0});loopEnds.push({at:ops.length-1,level});}
      const rangeReverse=capability.reverse!==!!capability.physicalIndex?.fields[capability.nEq]?.descending;
      const end=rangeReverse?capability.lower:capability.upper;
      // wherecode.c Case 4 keeps pRangeStart and pRangeEnd separate. A
      // one-sided range never becomes its own end test: the equality-prefix
      // check (if any) bounds this scan and the original predicate filters
      // rows until strict range positioning is available here.
      const rangeEnd=end;
      if(rangeEnd&&rangeEnd.operator!=='in'&&(rangeEnd.term.prereqRight&~readyMask)===0n){const expression=expressionFromReduction(rangeEnd.term.expression.reduction!);if(expression.kind!=='binary')throw new JSQLiteError('internal','joined range bound lost binary expression');const bound=rangeEnd.term.originalIndexedOperand==='left'?expression.right:expression.left;const key=compileExpressionTree(resolveTree(bound),ops,allocate,parameters,compileJoinSubquery);if(!rangeEnd.term.virtualNull){loopEnds.push({at:ops.length,level});ops.push({code:'IsNull',p1:key,p2:0});}ops.push({code:'IndexRangeEnd',p1:indexCursor,field:rangeEnd.fieldOrdinal,key,affinity:rangeEnd.comparison.kind==='comparison'?rangeEnd.comparison.affinity:'blob',collation:rangeEnd.comparison.kind==='comparison'?rangeEnd.comparison.collation:'binary',operator:rangeEnd.operator as 'lt'|'le'|'gt'|'ge',p2:0});loopEnds.push({at:ops.length-1,level});}
    }
    // wherecode.c Case 4: only a WITHOUT ROWID primary index is the
    // table itself. A rowid table's declared PRIMARY KEY remains a secondary
    // index and must position its table cursor before uncovered reads.
    if(!source.table.withoutRowid||(!capability.covering&&capability.physicalIndex!.index.origin!=='primary-key')){
      if(source.table.withoutRowid){
        const primary=primaryFor(source),primaryKeyFields=capability.physicalIndex!.primaryKeyFields;
        if(primaryKeyFields.length!==primary.keyInfo.keyFieldCount)throw new JSQLiteError('unsupported','WITHOUT ROWID secondary primary-key mapping is not represented',{unsupportedClassification:'temporary'});
        ops.push({code:'DeferredIndexSeek',p1:indexCursor,p2:cursorFor(source),primaryKeyFields,physical:primary});
      }else ops.push({code:'DeferredSeek',p1:indexCursor,p2:cursorFor(source)});
    }
  }
  // wherecode.c Case 3 swaps pStart/pEnd for reverse traversal. The
  // operand is already bound with its owning reduction; do not resolve it again.
  const rowEndCandidate=selected?.capability?.reverse?selected.capability.rowidLower:selected?.capability?.rowidUpper;
  const rowEnd=rowEndCandidate&&(rowEndCandidate.term.prereqRight&~readyMask)===0n?rowEndCandidate:null;
  if(rowEnd&&!singleRows[level]){
    const tree=resolveTree(expressionFromReduction(rowEnd.term.expression.reduction!),rowEnd.term.expression.reduction as Reduction);
    if(tree.kind!=="binary")throw new JSQLiteError('internal','rowid end bound lost binary expression');
    const key=compileExpressionTree(rowEnd.originalIndexedOperand==='left'?tree.right:tree.left,ops,allocate,parameters,compileJoinSubquery),at=ops.length;
    ops.push({code:selected?.capability?.reverse?'RowidLowerBound':'RowidUpperBound',p1:cursorFor(source),key,inclusive:rowEnd.bound==='upper-inclusive'||rowEnd.bound==='lower-inclusive',p2:0});
    // Case3 addrBrk exhausts this level; WhereEnd finishes IN/null/outer owners.
    loopEnds.push({at,level});
  }
  const onReady=source.on?.reduction?multiWhere.analysis.clause.terms.filter(term=>term.origin.kind==='join-on'&&term.origin.rightSource===ordinal&&!term.virtual).every(term=>(term.prereqAll&~(readyMask|(1n<<BigInt(ordinal))))===0n):true;const on=onReady?compilePredicate(source.on):undefined;if(on!==undefined)jumps.push({at:on,level});if(source.using)for(const name of source.using){const right=source.table.columns.findIndex(column=>sqliteIdentifierEqual(column.name,name)),left=expanded.sources.slice(0,level).reverse().find(candidate=>candidate.table.columns.some(column=>sqliteIdentifierEqual(column.name,name)))!,leftIndex=left.table.columns.findIndex(column=>sqliteIdentifierEqual(column.name,name));const value=compileExpressionTree(resolveTree({kind:'binary',op:'=',left:expanded.sources.some(candidate=>candidate.joinFromLeft.right)?{kind:'call',name:'coalesce',args:expanded.sources.slice(0,level).filter(candidate=>candidate.table.columns.some(column=>sqliteIdentifierEqual(column.name,name))).map(candidate=>({kind:'column',index:candidate.table.columns.findIndex(column=>sqliteIdentifierEqual(column.name,name)),name:`${candidate.alias??candidate.table.name}.${name}`}))}:{kind:'column',index:leftIndex,name:`${left.alias??left.table.name}.${name}`},right:{kind:'column',index:right,name:`${source.alias??source.table.name}.${name}`}}),ops,allocate,parameters),at=ops.length;ops.push({code:'IfNot',p1:value,p2:0});jumps.push({at,level});}if(isLeft)ops.push({code:'Integer',p1:1n,p2:leftMatches[level]!});const right=rightStates.get(level);if(right){ops.push({code:'Rowid',p1:cursorFor(source),p2:right.key});const found=ops.length;ops.push({code:'Found',p1:right.matchCursor,keyStart:right.key,keyCount:1,jump:0},{code:'IdxInsert',p1:right.matchCursor,keyStart:right.key,keyCount:1});(ops[found] as {jump:number}).jump=ops.length;ops.push({code:'BeginSubrtn',p2:right.returnRegister});right.body.entry=ops.length;}bodies[level]=ops.length;if(isLeft||right)codeOuterConstraints(level,readyMask|(1n<<BigInt(ordinal)));}
  const joinedBodyStart=ops.length;
  // Delayed inner-join ON clauses can reference a source positioned later in
  // the chosen path. Their residual is evaluated only at the complete row.
  for(const ordinal of loopOrdinals){const source=expanded.sources[ordinal]!;if(!source.on?.reduction||source.joinFromLeft.left)continue;const terms=multiWhere.analysis.clause.terms.filter(term=>term.origin.kind==='join-on'&&term.origin.rightSource===ordinal&&!term.virtual);const at=loopOrdinals.indexOf(ordinal),ready=loopOrdinals.slice(0,at+1).reduce((mask,source)=>mask|(1n<<BigInt(source)),0n);if(terms.some(term=>(term.prereqAll&~ready)!==0n)){const predicate=compilePredicate(source.on);if(predicate!==undefined)jumps.push({at:predicate,level:expanded.sources.length-1});}}
  // selectInnerLoop codes the result expression list before SRT_Mem. A
  // phase-aware caller may bind even a direct column to an outer payload
  // register, so its resolved result must not take the physical-column shortcut.
  // expr.c sqlite3ExprCodeGetColumnOfTable / update.c sqlite3ColumnDefault:
  // Column reads storage, then logical REAL affinity re-expands compact integers.
  // Keep this outside Column itself: rowid and non-REAL reads retain their type,
  // and WhereEnd covering rewrites may change the cursor but not this affinity.
  const emitResultColumn=(source:typeof expanded.sources[number],column:number,target:number)=>{
    if(column<0)ops.push({code:'Rowid',p1:cursorFor(source),p2:target});
    else {
      ops.push({code:'Column',p1:column,p2:target,p3:cursorFor(source)});
      if(affinityOf(source.table.columns[column]!.declaredType??'')==='real')ops.push({code:'RealAffinity',p1:target});
    }
  };
  for(const term of whereTerms)if(!termIsCoded(term)){const where=compilePredicate(term.expression);if(where!==undefined){jumps.push({at:where,level:expanded.sources.length-1});codedWhere.add(term.id);}}if(!owner?.consumeRow)expanded.result.forEach((result,index)=>{if(owner?.expressionBinding){if(!result.expression.reduction)throw new JSQLiteError('internal','resolved expression has no tree');const value=compileExpressionTree(resolveTree(expressionFromReduction(result.expression.reduction),result.expression.reduction as Reduction),ops,allocate,parameters,compileJoinSubquery);ops.push({code:'Copy',p1:value,p2:resultStart+index});}else if(result.resolution==='coalesce'&&result.mergedSources!.every(ref=>!ref.source.table.withoutRowid)){const refs=result.mergedSources!;const ends:number[]=[];for(const ref of refs){const value=allocate();emitResultColumn(ref.source,ref.columnIndex,value);const at=ops.length;ops.push({code:'NotNull',p1:value,p2:resultStart+index,jump:0});ends.push(at);}ops.push({code:'Null',p2:resultStart+index});for(const at of ends)(ops[at] as {jump:number}).jump=ops.length;}else if(result.source&&!result.source.table.withoutRowid&&result.columnIndex!==null){const value=allocate();emitResultColumn(result.source,result.columnIndex,value);ops.push({code:'Copy',p1:value,p2:resultStart+index});}else{if(!result.expression.reduction)throw new JSQLiteError('internal','resolved expression has no tree');const value=compileExpressionTree(resolveTree(expressionFromReduction(result.expression.reduction),result.expression.reduction as Reduction),ops,allocate,parameters,compileJoinSubquery);ops.push({code:'Copy',p1:value,p2:resultStart+index});}});
  // selectInnerLoop's LIMIT break belongs to this producer, including the
  // unmatched RIGHT invocation below. Resolve producer exits together; a zero
  // address must never escape into the enclosing scalar/compound program.
  const destinationExit=builder.label();
  const producerStops=new Set<number>();
  let distinctAt:number|undefined;if(select.hasDistinct){distinctAt=ops.length;ops.push({code:'Found',p1:distinctCursor,keyStart:resultStart,keyCount:expanded.result.length,jump:0},{code:'IdxInsert',p1:distinctCursor,keyStart:resultStart,keyCount:expanded.result.length});}
  if(orderTerms.length){const keyStart=range(orderTerms.length);orderTerms.forEach((term,index)=>{if(term.resultIndex>=0)ops.push({code:'Copy',p1:resultStart+term.resultIndex,p2:keyStart+index});else{const value=compileExpressionTree(term.tree,ops,allocate,parameters);ops.push({code:'Copy',p1:value,p2:keyStart+index});}});ops.push({code:'SorterInsert',p1:sorterCursor,keyStart,keyCount:orderTerms.length,payload:resultStart,payloadCount:expanded.result.length,...(limit?{topN:limit.capacity}:{})});}
  else {const afterOutput=builder.label();if(limit?.offset!==undefined)builder.jump(afterOutput,{code:'IfPos',p1:limit.offset,p2:0,p3:1},(op,pc)=>({...op,p2:pc} as Op));if(owner?.consumeRow)owner.consumeRow();else if(owner)emitSelectDestination(ops,owner.destination,resultStart,expanded.result.length);else ops.push({code:'ResultRow',p1:resultStart,p2:expanded.result.length});if(limit){if(owner?.compoundLimit){owner.compoundLimit.stops.push(ops.length);ops.push({code:'DecrJumpZero',p1:limit.count,p2:0});}else {producerStops.add(ops.length);builder.jump(destinationExit,{code:'DecrJumpZero',p1:limit.count,p2:0},(op,pc)=>({...op,p2:pc} as Op));}}if(owner&&(owner.destination.kind==='mem'||owner.destination.kind==='exists')){producerStops.add(ops.length);builder.jump(destinationExit,{code:'Goto',p2:0},(op,pc)=>({...op,p2:pc} as Op));}builder.mark(afterOutput);builder.resolveLabel(afterOutput);}
  const joinedBodyEnd=ops.length;
  const nextAt:number[]=[],advanceAt:number[]=[],rewindEmpty:number[]=[];for(let level=expanded.sources.length-1;level>=0;level--){// where.c:sqlite3WhereEnd resolves RIGHT continue to the inline Return.
  // where.c sqlite3WhereEnd guards unopened inner IN cursors with
  // IfNotOpen after LEFT null-row execution. Our ordered-set iterator uses
  // registers instead of a cursor: a synthetic null pass must skip physical
  // advance and all RHS restarts, including slots never initialized.
  nextAt[level]=ops.length;const nullPass=nullPasses.get(level);if(nullPass!==undefined){nullContinues.set(level,ops.length);ops.push({code:'IfPos',p1:nullPass,p2:0,p3:0});}const right=rightStates.get(level);if(right){right.body.continue=ops.length;ops.push({code:'Return',p1:right.returnRegister,fallthrough:true});}// Record the actual movement op: LEFT IfPos and RIGHT Return precede it.
  // Patching nextAt would overwrite the synthetic-null continuation guard.
  const cover=orCovering.get(level);
  if(cover){
    // where.c WhereEnd consumes this level's Case5 pCov/iCovCur.
    for(let pc=cover.start;pc<ops.length;pc++){
      const op=ops[pc]!;
      if(op.code==='Column'&&(op.p3??0)===cover.tableCursor){
        const column=loopSources[level]!.table.columns[op.p1];
        const field=cover.physical.fields.findIndex(field=>column!==undefined&&(field.column===column||
          (field.role==='rowid-tail'&&isIntegerPrimaryKeyAlias(loopSources[level]!.table,op.p1))));
        if(field>=0)ops[pc]={...op,p1:field,p3:cover.cursor};
      }else if(op.code==='Rowid'&&(op.p1??0)===cover.tableCursor)ops[pc]={...op,p1:cover.cursor};
    }
  }
  advanceAt[level]=ops.length;if(orReturns.has(level))ops.push({code:'Return',p1:orReturns.get(level)!});else if(singleRows[level])ops.push({code:'Goto',p2:0});else {const ordinal=loopOrdinals[level]!,indexCursor=indexCursors.get(ordinal),reverse=!!selectedBySource.get(ordinal)?.capability?.reverse;ops.push(indexCursor===undefined&&!loopSources[level]!.table.withoutRowid?{code:reverse?'Prev':'Next',p1:cursorFor(loopSources[level]!),p2:starts[level]!}:{code:reverse?'IndexPrev':'IndexNext',p1:indexCursor??cursorFor(loopSources[level]!),p2:starts[level]!});}const restart=inRestarts.get(level);if(restart){
    // where.c:sqlite3WhereEnd unwinds each equality-slot IN from inner to outer.
    for(let i=restart.iterators.length-1;i>=0;i--){
      const iterator=restart.iterators[i]!;
      if(i===restart.iterators.length-1)restart.advance=ops.length;
      if(i<restart.iterators.length-1)(ops[restart.iterators[i+1]!] as {p2:number}).p2=ops.length;
      ops.push({code:'Goto',p2:iterator});
    }
  }const prefixLoop=prefixLoops.get(level);if(prefixLoop?.restart!==null&&prefixLoop?.restart!==undefined)ops.push({code:"Goto",p2:prefixLoop.restart});
  const match=leftMatches[level];if(match!==undefined){
    rewindEmpty[level]=ops.length;
    const matched=ops.length;
    ops.push({code:'IfPos',p1:match,p2:0,p3:0},{code:'Integer',p1:1n,p2:match},{code:'NullRow',p1:cursorFor(expanded.sources[level]!)});
    // where.c:sqlite3WhereEnd nulls both the table and its selected index
    // before re-entering the LEFT body. Neither may expose a previous hit.
    // where.c7694: MULTI_OR pCoveringIdx is a separate cursor owner.
    // Body Column/Rowid rewrites must observe NULL, not the final arm record.
    const indexCursor=indexCursors.get(loopOrdinals[level]!)??orCovering.get(level)?.cursor;
    if(indexCursor!==undefined)ops.push({code:'NullRow',p1:indexCursor});
    ops.push({code:'Integer',p1:1n,p2:nullPasses.get(level)!},{code:'Goto',p2:bodies[level]!});
    const nullContinue=nullContinues.get(level);if(nullContinue!==undefined)(ops[nullContinue] as {p2:number}).p2=ops.length;
    (ops[matched] as {p2:number}).p2=ops.length;
  }if(right){right.body.break=ops.length;rewindEmpty[level]??=right.body.break;ops.push({code:'Return',p1:right.returnRegister,fallthrough:true});}}const normalScanEnd=ops.length;
  for(const [rightLevel,right] of rightStates){
    // wherecode.c:sqlite3WhereRightJoinLoop scans the original RHS after the
    // source-order pass, NULLs every cursor left of the barrier, and invokes the
    // same interior continuation (including downstream joins and destinations).
    for(let level=0;level<rightLevel;level++){
      const ordinal=loopOrdinals[level]!;
      ops.push({code:'NullRow',p1:cursorFor(expanded.sources[ordinal]!)});
      const indexCursor=indexCursors.get(ordinal);
      if(indexCursor!==undefined)ops.push({code:'NullRow',p1:indexCursor});
    }
    // wherecode.c:sqlite3WhereRightJoinLoop uses a fresh RHS scan after
    // NULLing the left cursors. That scan must supersede any selected seek
    // cursor still attached to the same table cursor from the matched pass.
    const rightIndex=indexCursors.get(loopOrdinals[rightLevel]!);
    if(rightIndex!==undefined)ops.push({code:'NullRow',p1:rightIndex});
    // wherecode.c:sqlite3WhereRightJoinLoop copies the RHS with jointype=0
    // and re-enters the existing WHERE owner. Null preceding sources remain
    // resolved outer references; no spelling/token reconstruction is involved.
    const original=expanded.sources[loopOrdinals[rightLevel]!]!;
    const source:ResolvedSource={...original,on:null,using:null,leftOfRightJoin:false,
      joinFromLeft:{inner:true,cross:false,natural:false,left:false,right:false,outer:false,error:false}};
    const residual=rightJoinResidual(expanded,loopOrdinals[rightLevel]!).reduce<SelectNode['where']>((where,term)=>andViewPredicates(where,term.expression),null);
    const input:SelectNode={...select,result:[],where:residual,groupBy:[],having:null,
      orderBy:[],limit:null,offset:null,hasDistinct:false,hasGroupBy:false,
      hasHaving:false,hasOrderBy:false,hasLimit:false,hasCompound:false,hasValues:false,arms:[],
      from:Object.assign([],{items:[source],tokens:[]}) as unknown as SelectNode['from']};
    const mapRef=<T extends {readonly source:ResolvedSource}>(ref:T):T=>ref.source===original?{...ref,source}:ref;
    const sub:typeof expanded={...expanded,source:input,sources:[source],result:[],
      columnUses:expanded.columnUses.map(use=>({...mapRef(use),selectDepth:use.source===original?0:1,
        ...(use.mergedSources?{mergedSources:use.mergedSources.map(mapRef)}:{})}))};
    const binding:ResolvedExpressionBinding={policy:'scalar',location:(ref,depth)=>
      ref.source===source?{kind:'cursor',cursor:cursorFor(original)}:nestedBinding.location(ref,depth)};
    compileInnerTableSelect(input,sub,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{
      builder,ops,parameters,destination:{kind:'output'},expressionBinding:binding,
      cursorFor:ref=>ref===source?cursorFor(original):cursorFor(ref),consumeRow:()=>{
        ops.push({code:'Rowid',p1:cursorFor(original),p2:right.key});
        const found=ops.length;ops.push({code:'Found',p1:right.matchCursor,keyStart:right.key,keyCount:1,jump:0});
        ops.push({code:'Gosub',p1:right.returnRegister,p2:right.body.entry});
        (ops[found] as {jump:number}).jump=ops.length;
      }});
    registers=builder.registers;

  }
  const scanEnd=ops.length;
  if(distinctAt!==undefined)(ops[distinctAt] as {jump:number}).jump=nextAt.at(-1)!;for(const jump of jumps)(ops[jump.at] as {p2:number}).p2=jump.level<0?normalScanEnd:nextAt[jump.level]!;
  for(const {at,level} of loopEnds)(ops[at] as {p2:number}).p2=inRestarts.get(level)?.advance??prefixLoops.get(level)?.restart??rewindEmpty[level]??(level===0?normalScanEnd:nextAt[level-1]!);
  for(const [level,restart] of inRestarts){
    const exit=rewindEmpty[level]??(level===0?normalScanEnd:nextAt[level-1]!);
    (ops[restart.iterators[0]!] as {p2:number}).p2=prefixLoops.get(level)?.restart??exit;
  }
  for(const [level,prefix] of prefixLoops){
    const exit=rewindEmpty[level]??(level===0?normalScanEnd:nextAt[level-1]!);
    for(const at of [prefix.restart,prefix.empty])if(at!==null)(ops[at] as {p2:number}).p2=exit;
  }
  let halt:number;
  if(orderTerms.length){
    const drain=builder.label(),next=builder.label();
    builder.jump(destinationExit,{code:'SorterSort',p1:sorterCursor,emptyJump:0},(op,pc)=>({...op,emptyJump:pc} as Op));
    builder.mark(drain);ops.push({code:'SorterData',p1:sorterCursor,p2:resultStart,count:expanded.result.length});
    if(limit?.offset!==undefined)builder.jump(next,{code:'IfPos',p1:limit.offset,p2:0,p3:1},(op,pc)=>({...op,p2:pc} as Op));
    emitSelectDestination(ops,owner?.destination??{kind:'output'},resultStart,expanded.result.length);
    if(limit){if(owner?.compoundLimit){owner.compoundLimit.stops.push(ops.length);ops.push({code:'DecrJumpZero',p1:limit.count,p2:0});}else builder.jump(destinationExit,{code:'DecrJumpZero',p1:limit.count,p2:0},(op,pc)=>({...op,p2:pc} as Op));}
    if(owner&&(owner.destination.kind==='mem'||owner.destination.kind==='exists'))builder.jump(destinationExit,{code:'Goto',p2:0},(op,pc)=>({...op,p2:pc} as Op));
    builder.mark(next);builder.jump(drain,{code:'SorterNext',p1:sorterCursor,p2:0},(op,pc)=>({...op,p2:pc} as Op));
    builder.resolveLabel(drain);builder.resolveLabel(next);
  }
  halt=ops.length;builder.mark(destinationExit);builder.resolveLabel(destinationExit);
  if(!owner)ops.push({code:'Halt'});
  for(let level=0;level<rewinds.length;level++){if(!(prefixLoops.get(level)?.seek===rewinds[level]&&ops[rewinds[level]!]!.code==="Goto"))(ops[rewinds[level]!] as {p2:number}).p2=inRestarts.get(level)?.advance??prefixLoops.get(level)?.restart??rewindEmpty[level]??(level===0?normalScanEnd:nextAt[level-1]!);if(singleRows[level])(ops[advanceAt[level]!] as {p2:number}).p2=rewindEmpty[level]??(level===0?normalScanEnd:nextAt[level-1]!);}for(const guard of equalityNullGuards)(ops[guard.at] as {p2:number}).p2=rewindEmpty[guard.level]??(guard.level===0?normalScanEnd:nextAt[guard.level-1]!);for(const guard of startNullGuards)(ops[guard.at] as {p2:number}).p2=(ops[rewinds[guard.level]!] as {p2:number}).p2;if(limit&&!owner?.compoundLimit)(ops[limit.ifZero] as {p2:number}).p2=halt;
  // vdbeaux.c:sqlite3VdbeNoJumpsOutsideSubrtn: ordinary continuation
  // targets must stay inside the interior or reach its Return. Producer
  // Explicit producer stops may terminate early; ordinary escapes must reach
  // the owning Return (possibly through other Returns), as in the C verifier.
  const validateRightInterior=()=>{
    for(const right of rightStates.values()){
    for(let at=right.body.entry;at<=right.body.continue;at++){
      const op=ops[at]!;
      if(op.code==='Gosub'||op.code==='Yield'||op.code==='EndCoroutine')continue;
      relocateControlTargets(op,target=>{
        if(target>=right.body.entry&&target<=right.body.continue)return target;
        // LIMIT/scalar destination stop is deliberate producer termination,
        // not a loop continuation. NoJumpsOutsideSubrtn is verification only.
        if(producerStops.has(at)&&target===halt)return target;
        if(op.code==='DecrJumpZero'&&owner?.compoundLimit?.stops.includes(at))return target;
        if(reachesOwningReturn(ops,target,right.returnRegister))return target;
        throw new JSQLiteError('internal','RIGHT interior jump escapes its return boundary');
      });
    }
    }
  };
  if(owner){
    builder.validateResolved(validateRightInterior);return whereAccounting;
  }
  builder.validateResolved(validateRightInterior);
  const columns=expanded.result.map(result=>Object.freeze({name:result.name,declaredType:result.descriptor.declaredType,database:result.descriptor.database,table:result.descriptor.table,origin:result.descriptor.origin}));return Object.freeze({ops:builder.finish(),registers:builder.registers,encoding:database.encoding,columns:Object.freeze(columns),parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,whereAccounting});
}

function sqlName(text: string): string {
  if (text[0] === "[" && text.at(-1) === "]") return text.slice(1, -1);
  if ((text[0] === '"' || text[0] === "`") && text.at(-1) === text[0]) return text.slice(1, -1).replaceAll(text[0] + text[0], text[0]);
  return text;
}

interface FullScanPlan { readonly loopStart: number; readonly rewindIndex: number; readonly indexCursor?:number; readonly singleRow?:boolean; readonly reverse?:boolean; readonly inIterators?:readonly number[]; readonly startNullGuards?:readonly number[]; readonly equalityNullGuards?:readonly number[]; readonly prefixLoop?:PrefixLoop }
/** Bounded first-plan translation seam for sqlite3WhereBegin/wherecode.c. */
function sqlite3WhereBegin(ops: Op[], rootPage: number): FullScanPlan {
  ops.push({code:"OpenRead",p1:rootPage}); const rewindIndex=ops.length;
  ops.push({code:"Rewind",p2:0}); return {loopStart:ops.length,rewindIndex};
}
function sqlite3WhereEnd(ops: Op[], plan: FullScanPlan, continueAt: number): void {
  const iterators=plan.inIterators??[];
  if(!plan.singleRow)ops.push(plan.indexCursor===undefined?(plan.reverse?{code:"Prev",p2:continueAt}:{code:"Next",p2:continueAt}):(plan.reverse?{code:"IndexPrev",p1:plan.indexCursor,p2:continueAt}:{code:"IndexNext",p1:plan.indexCursor,p2:continueAt}));
  // where.c:sqlite3WhereEnd unwinds aInLoop inside-out. On outer
  // advancement execution falls through the next inner slot's Integer reset.
  for(let i=iterators.length-1;i>=0;i--){
    const iterator=ops[iterators[i]!];
    if(iterator?.code!=="InListValue")throw new Error("IN restart target is not an iterator");
    if(i<iterators.length-1)(ops[iterators[i+1]!] as {p2:number}).p2=ops.length;
    ops.push({code:"Goto",p2:iterators[i]!});
  }
  if(plan.prefixLoop?.restart!==null&&plan.prefixLoop?.restart!==undefined)finishPrefixLoop(ops,plan.prefixLoop,ops.length+1);
  const scanExit=ops.length;
  const prefixExit=plan.prefixLoop?.restart??scanExit;
  // Scan exhaustion falls through to the SELECT-owned drain/exit.
  if(iterators.length)(ops[iterators[0]!] as {p2:number}).p2=prefixExit;
  const exit=iterators.at(-1)??prefixExit;
  if(ops[plan.rewindIndex]?.code!=="Goto")(ops[plan.rewindIndex] as {p2:number}).p2=exit;
  for(const at of plan.equalityNullGuards??[])(ops[at] as {p2:number}).p2=scanExit;
  for(const at of plan.startNullGuards??[])(ops[at] as {p2:number}).p2=exit;
  for(const op of ops)if((op.code==="RowidLowerBound"||op.code==="RowidUpperBound"||op.code==="IndexPrefixEnd"||op.code==="IndexRangeEnd")&&op.p2===0)(op as {p2:number}).p2=exit;
}

function compileJoinedUnionAll(select:SelectNode,schema:SchemaGraph,database:BtreeDatabase,maxRows:number,maxWorkUnits:number,maxResultBytes:number,privateStateLimits:PrivateStateLimits,parent?:{builder:SelectProgramBuilder<Op>;parameters:ParameterBuilder;destination:SelectDest}):Program|{columns:Program['columns']}|undefined {
  const first=select.arms[0];if(!first||first.from.items.length<2||first.result.length!==1||select.arms.slice(1).some(arm=>arm.operatorFromPrior!=="union-all"||arm.from.items.length!==0||arm.where!==null||arm.result.length!==1)||select.orderBy.length!==1||select.limit||select.offset)return undefined;
  let identity=expressionFromReduction(select.orderBy[0]!.expr.reduction!);while(identity.kind==="collate")identity=identity.value;if(identity.kind!=="literal"||identity.value!==1n)return undefined;
  const leftSelect:SelectNode={...select,result:first.result,from:first.from,where:first.where,hasDistinct:first.hasDistinct,hasGroupBy:first.hasGroupBy,hasHaving:first.hasHaving,orderBy:Object.freeze([]),limit:null,offset:null,hasOrderBy:false,hasLimit:false,hasCompound:false,arms:Object.freeze([first])};
  let expanded:ReturnType<typeof expandAndResolveSelect>;try{expanded=expandAndResolveSelect(leftSelect,schema,null,parent?.builder.cursors??0)}catch(error){if(error instanceof NameResolutionError)throw new JSQLiteError("sqlite",error.message,{code:1});throw error;}
  const builder=parent?.builder??new SelectProgramBuilder<Op>(),ops=builder.ops,allocate=()=>builder.register(),parameters:ParameterBuilder=parent?.parameters??{maximum:0,names:[],named:new Map()},sorterCursor=Math.max(builder.cursors,...expanded.sources.map(source=>source.cursorId))+3,descriptor=expanded.result[0]!.descriptor,coll=sqliteAsciiFold(descriptor.collation) as BuiltinCollation,term=select.orderBy[0]!;
  builder.reserveCursorsThrough(sorterCursor);
  ops.push({code:"SorterOpen",p1:sorterCursor,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:1,keyFieldCount:1,terms:[{collation:coll,desc:term.descending,nullsLarge:term.nulls==="last"?!term.descending:term.nulls==="first"?term.descending:false}]})});
  compileInnerTableSelect(leftSelect,expanded,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{builder,ops,parameters,destination:{kind:'sorter',cursor:sorterCursor}});
  for(const arm of select.arms.slice(1)){const value=compileExpressionTree(expressionFromReduction(arm.result[0]!.reduction!),ops,allocate,parameters);ops.push({code:"SorterInsert",p1:sorterCursor,keyStart:value,keyCount:1,payload:value,payloadCount:1});}
  const output=allocate(),sortAt=ops.length;ops.push({code:"SorterSort",p1:sorterCursor,emptyJump:0},{code:"SorterData",p1:sorterCursor,p2:output,count:1} );emitSelectDestination(ops,parent?.destination??{kind:'output'},output,1);ops.push({code:"SorterNext",p1:sorterCursor,p2:sortAt+1});const halt=ops.length;if(!parent)ops.push({code:"Halt"});(ops[sortAt] as {emptyJump:number}).emptyJump=halt;
  if(parent)return {columns:Object.freeze(expanded.result.map(result=>Object.freeze({name:result.name,declaredType:result.descriptor.declaredType,database:result.descriptor.database,table:result.descriptor.table,origin:result.descriptor.origin})))};
 return Object.freeze({ops:Object.freeze(ops),registers:builder.registers,encoding:database.encoding,columns:Object.freeze(expanded.result.map(result=>Object.freeze({name:result.name,declaredType:result.descriptor.declaredType,database:result.descriptor.database,table:result.descriptor.table,origin:result.descriptor.origin}))),parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits});
}

export function compileOrderedCteUnionAll(select:SelectNode,schema:SchemaGraph,database:BtreeDatabase,maxRows:number,maxWorkUnits:number,maxResultBytes:number,privateStateLimits:PrivateStateLimits):Program|undefined;
export function compileOrderedCteUnionAll(select:SelectNode,schema:SchemaGraph,database:BtreeDatabase,maxRows:number,maxWorkUnits:number,maxResultBytes:number,privateStateLimits:PrivateStateLimits,owner:{builder:SelectProgramBuilder<Op>;parameters:ParameterBuilder;destination:SelectDest}): {columns:Program['columns']}|undefined;
export function compileOrderedCteUnionAll(select:SelectNode,schema:SchemaGraph,database:BtreeDatabase,maxRows:number,maxWorkUnits:number,maxResultBytes:number,privateStateLimits:PrivateStateLimits,owner?:{builder:SelectProgramBuilder<Op>;parameters:ParameterBuilder;destination:SelectDest}):Program|{columns:Program['columns']}|undefined {
  if(!select.orderBy.length||!select.hasCompound||select.arms.slice(1).some(arm=>arm.operatorFromPrior!=="union-all"))return undefined;
  const arms=select.arms.map(arm=>({...select,result:arm.result,from:arm.from,where:arm.where,hasDistinct:arm.hasDistinct,hasGroupBy:arm.hasGroupBy,hasHaving:arm.hasHaving,groupBy:arm.groupBy??Object.freeze([]),having:arm.having??null,orderBy:Object.freeze([]),limit:null,offset:null,hasOrderBy:false,hasLimit:false,hasCompound:false,hasValues:arm.origin==='values',arms:Object.freeze([{...arm,operatorFromPrior:null,prior:null,next:null}])} as SelectNode));
  // Keep the existing bounded single-use CTE flatten restriction carrier,
  // but substitute before merge admission/key resolution as sqlite3Select does.
  for(let index=0;index<arms.length;index++){
    const arm=arms[index]!,derived=arm.from.derived,cte=arm.from.cteDerived;
    if(!derived)continue;
    if(!cte?.length){
      const lexicalColumns=arm.result.map(item=>{const tree=expressionFromReduction(item.reduction!);return {name:item.alias??(tree.kind==='column'?tree.name.split('.').at(-1)!:expressionName(item))};});
      const flattened=flattenOrdinaryDerived(arm);
      if(flattened.from.derived)continue;
      // sqlite3Select column names are generated from the lexical EList
      // before flattening substitutes producer expressions.
      arms[index]={...flattened,result:Object.freeze(flattened.result.map((item,column)=>({...item,alias:lexicalColumns[column]!.name})))};continue;
    }
    if(!cte?.length||cte.length!==1||derived.index!==0||arm.from.items.length!==1||cte[0]!.materialization==='materialized'||cte[0]!.use.nUse!==1||derived.select.hasCompound||derived.select.hasDistinct||derived.select.hasGroupBy||derived.select.hasHaving||derived.select.hasOrderBy||derived.select.hasLimit||derived.select.from.derived||derived.select.from.items.length>1)return undefined;
    const producer=derived.select,qualifier=arm.from.items[0]!.alias??arm.from.items[0]!.tableName;
    const names=uniqueTransientColumnNames(producer.result.map(item=>item.alias??expressionName(item))),exposed=new Map(producer.result.map((item,index)=>[sqliteAsciiFold(names[index]!),item]));
    arms[index]={...arm,result:Object.freeze(arm.result.map(item=>substituteViewExpression(item,exposed,qualifier))),where:andViewPredicates(producer.where,arm.where?substituteViewExpression(arm.where,exposed,qualifier):null),from:producer.from};
  }

  if(arms.some(arm=>arm.hasGroupBy&&!arm.groupBy.length||arm.hasHaving&&!arm.having))throw new JSQLiteError('unsupported','unrepresented compound GROUP/HAVING carrier',{unsupportedClassification:'temporary'});
  const width=arms[0]!.result.length;
  if(arms.some(arm=>arm.result.length!==width))throw new JSQLiteError('sqlite','SELECTs to the left and right of UNION ALL do not have the same number of result columns',{code:1});
  // resolve.c:resolveCompoundOrderBy checks integer range before deciding
  // whether a specialized merge ordering can consume the resolved keys.
  const orderIndexes=select.orderBy.map((term,index)=>{let tree=expressionFromReduction(term.expr.reduction!);while(tree.kind==='collate')tree=tree.value;if(tree.kind!=='literal'||typeof tree.value!=='bigint'){return arms[0]!.result.findIndex(item=>item.reduction&&(sameExpression(tree,expressionFromReduction(item.reduction))||tree.kind==='column'&&sqliteIdentifierEqual(tree.name,item.alias??expressionName(item))));}if(tree.value<1n||tree.value>BigInt(width)){const n=index+1,suffix=n%100>=11&&n%100<=13?'th':n%10===1?'st':n%10===2?'nd':n%10===3?'rd':'th';throw new JSQLiteError('sqlite',`${n}${suffix} ORDER BY term out of range - should be between 1 and ${width}`,{code:1});}return Number(tree.value)-1;});
  if(orderIndexes.length!==width||orderIndexes.some((value,index)=>value!==index))return undefined;
  // Physical/scalar/aggregate/window arms compose the shared merge. Keep
  // retained derived specializations until their destination contract
  // is integrated, rather than feeding them to a scalar expression owner.
  if(arms.every(arm=>(!arm.hasDistinct||arm.from.items.length>0||!arm.hasValues)&&(!arm.from.derived||!arm.where&&!arm.hasDistinct&&!arm.hasGroupBy&&!arm.hasHaving&&!arm.from.derived.select.from.derived)&&!arm.from.cteDerived?.length)){
    const builder=owner?.builder??new SelectProgramBuilder<Op>(),parameters=owner?.parameters??{maximum:0,names:[],named:new Map()};
    const columns=compoundArmColumns(arms[0]!,schema);
    emitScalarCompoundMerge({...select,arms:Object.freeze(arms.map((arm,index)=>({...arm.arms[0]!,result:arm.result,from:arm.from,where:arm.where,operatorFromPrior:select.arms[index]!.operatorFromPrior})))},schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,builder,parameters,owner?.destination??{kind:'output'},(arm,emitRow,destination)=>{
      if(arm.from.derived){
        const produced=compileDerivedProducer(arm,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{builder,parameters,destination,scalarRetained:true,emitRow});
        if(!produced)throw new JSQLiteError('unsupported','ordered retained arm is not represented',{unsupportedClassification:'temporary'});
        return;
      }
      if(selectHasWindow(arm)){
        const expanded=expandAndResolveSelect(arm,schema,null,builder.cursors);
        compileWindowSelectLowering(expanded,database.encoding,database,maxWorkUnits,maxResultBytes,privateStateLimits,schema,undefined,{builder,parameters,destination});return;
      }
      if(selectHasAggregate(arm)||arm.hasGroupBy){compileAggregateSelect(arm,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{builder,ops:builder.ops,parameters,destination});return;}
      if(arm.hasHaving)throw new JSQLiteError('sqlite','HAVING clause on a non-aggregate query',{code:1});
      const expanded=expandAndResolveSelect(arm,schema,null,builder.cursors);
      if(expanded.sources.length)compileInnerTableSelect(arm,expanded,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{builder,ops:builder.ops,parameters,destination});
      else{
        // where.c WHERE_DISTINCT_UNIQUE: no FROM emits at most one
        // candidate. Retain lexical resolution above; omit only dedup state.
        compileScalarSelect({...arm,hasDistinct:false,arms:Object.freeze(arm.arms.map(item=>({...item,hasDistinct:false})))},database.encoding,maxWorkUnits,maxResultBytes,privateStateLimits,schema,database,maxRows,{builder,parameters,emitRow});
      }
    });
    if(owner)return {columns};
    builder.ops.push({code:'Halt'});
    return Object.freeze({database,maxRows,ops:Object.freeze(builder.ops),registers:builder.registers,encoding:database.encoding,maxWorkUnits,maxResultBytes,privateStateLimits,parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),columns});
  }
  // select.c:multiSelectByMerge constructs both arm bodies on one Parse/Vdbe.
  // This bounded ordered route collects rows in a typed sorter (a browser/async
  // adaptation of the merge coroutine), never relocating published Programs.
  const builder=owner?.builder??new SelectProgramBuilder<Op>(),ops=builder.ops,parameters:ParameterBuilder=owner?.parameters??{maximum:0,names:[],named:new Map()};
  const sorter=builder.cursor(),destination:SelectDest={kind:'sorter',cursor:sorter};
  // select.c:multiSelectCollSeq: first actual expression collation wins.
  const resultCollations:(BuiltinCollation|undefined)[]=Array(width).fill(undefined);
  const sorterOpen=ops.length;
  ops.push({code:'SorterOpen',p1:sorter,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:width,keyFieldCount:width,terms:select.orderBy.map((term,index)=>({collation:explicitCollation(expressionFromReduction(term.expr.reduction!))??'binary',desc:term.descending,nullsLarge:term.nulls==='last'?!term.descending:term.nulls==='first'?term.descending:false}))})});
  let columns:Program['columns']|undefined;
  for(const originalArm of arms){
    const arm=originalArm;
    if(selectHasWindow(arm))return undefined;
    // Use the actual flattened/resolved arm, not the lexical CTE placeholder.
    let collationPlan:ReturnType<typeof expandAndResolveSelect>;
    try{collationPlan=expandAndResolveSelect(arm,schema,null,builder.cursors)}catch(error){if(error instanceof NameResolutionError)throw new JSQLiteError('sqlite',error.message,{code:1});throw error;}
    for(let column=0;column<width;column++){
      if(resultCollations[column]!==undefined)continue;
      const expression=arm.result[column]!,result=collationPlan.result[column];
      const implicit=resolvedExpressionCollation(expression.reduction!,collationPlan)??(result?.source||result?.mergedSources?result.descriptor.collation:undefined);
      if(implicit!==undefined){
        const named=sqliteAsciiFold(implicit);
        if(named!=='binary'&&named!=='nocase'&&named!=='rtrim')throw new JSQLiteError('sqlite',`no such collation sequence: ${named}`,{code:1});
        resultCollations[column]=named;
      }
    }
    if(selectHasAggregate(arm)||arm.hasGroupBy){
      const result=compileAggregateSelect(arm,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{builder,ops,parameters,destination});columns??=result.columns;
    }else{
      if(arm.hasHaving)throw new JSQLiteError('sqlite','HAVING clause on a non-aggregate query',{code:1});
      const expanded=collationPlan;
      columns??=Object.freeze(expanded.result.map(result=>Object.freeze({name:result.name,declaredType:result.descriptor.declaredType,database:result.descriptor.database,table:result.descriptor.table,origin:result.descriptor.origin})));
      if(expanded.sources.length)compileInnerTableSelect(arm,expanded,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{builder,ops,parameters,destination});
      else{
        if(arm.hasDistinct&&arm.hasValues)throw new JSQLiteError('unsupported','DISTINCT multirow VALUES producer is not represented',{unsupportedClassification:'temporary'});
        // selectInnerLoop destinations consume rows during shared expression
        // lowering, including every VALUES EList and scalar WHERE hooks.
        compileScalarSelect(arm,database.encoding,maxWorkUnits,maxResultBytes,privateStateLimits,schema,database,maxRows,{builder,parameters,emitRow:(first,count)=>emitSelectDestination(ops,destination,first,count)});
      }
    }
  }
  (ops[sorterOpen] as {keyInfo:KeyInfo}).keyInfo=new KeyInfo({encoding:database.encoding,totalFieldCount:width,keyFieldCount:width,terms:select.orderBy.map((term,index)=>({collation:explicitCollation(expressionFromReduction(term.expr.reduction!))??resultCollations[orderIndexes[index]!]??'binary',desc:term.descending,nullsLarge:term.nulls==='last'?!term.descending:term.nulls==='first'?term.descending:false}))});
  const output=builder.range(width),sort=ops.length;
  ops.push({code:'SorterSort',p1:sorter,emptyJump:0},{code:'SorterData',p1:sorter,p2:output,count:width});
  emitSelectDestination(ops,owner?.destination??{kind:'output'},output,width);
  ops.push({code:'SorterNext',p1:sorter,p2:sort+1});
  (ops[sort] as {emptyJump:number}).emptyJump=ops.length;
  if(owner)return {columns:columns!};
  ops.push({code:'Halt'});
  return Object.freeze({ops:builder.finish(),registers:builder.registers,encoding:database.encoding,columns:columns!,parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits});
}

export function compileCteUnionAll(select:SelectNode,schema:SchemaGraph,database:BtreeDatabase,maxRows:number,maxWorkUnits:number,maxResultBytes:number,privateStateLimits:PrivateStateLimits):Program|undefined;
export function compileCteUnionAll(select:SelectNode,schema:SchemaGraph,database:BtreeDatabase,maxRows:number,maxWorkUnits:number,maxResultBytes:number,privateStateLimits:PrivateStateLimits,owner:{builder:SelectProgramBuilder<Op>;parameters:ParameterBuilder;destination:SelectDest}): {columns:Program['columns']}|undefined;
export function compileCteUnionAll(select:SelectNode,schema:SchemaGraph,database:BtreeDatabase,maxRows:number,maxWorkUnits:number,maxResultBytes:number,privateStateLimits:PrivateStateLimits,owner?:{builder:SelectProgramBuilder<Op>;parameters:ParameterBuilder;destination:SelectDest}):Program|{columns:Program['columns']}|undefined {
  if(!select.hasCompound||select.arms.slice(1).some(arm=>arm.operatorFromPrior!=="union-all"))return undefined;
  // select.c:multiSelect uses the merge destination for ORDER BY. Keep that
  // independently admitted route until its coroutine consumer is migrated.
  if(select.orderBy.length)return owner?undefined:compileOrderedCteUnionAll(select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits);
  // DISTINCT is owned by each sqlite3Select/selectInnerLoop, not multiSelect.
  // A zero-source SELECT is one candidate; multirow VALUES needs its own filter.
  if(select.arms.some(arm=>arm.hasDistinct&&arm.origin==='values'))return undefined;
  const arms=select.arms.map(arm=>({...select,result:arm.result,from:arm.from,where:arm.where,
    hasDistinct:arm.hasDistinct,hasGroupBy:arm.hasGroupBy,hasHaving:arm.hasHaving,
    groupBy:arm.groupBy??Object.freeze([]),having:arm.having??null,orderBy:Object.freeze([]),limit:null,offset:null,
    hasOrderBy:false,hasLimit:false,hasCompound:false,
    arms:Object.freeze([{...arm,operatorFromPrior:null,prior:null,next:null}])} as SelectNode)).map(flattenOrdinaryDerived);
  // Limited producers need the ordinary scan's shared iLimit/iOffset contract.
  // Other specialized destinations must carry that contract before admission.
  if((select.limit||select.offset)&&arms.some(arm=>arm.from.cteDerived?.length||selectHasWindow(arm)))return undefined;
  const width=arms[0]!.result.length;
  if(arms.some(arm=>arm.result.length!==width))throw new JSQLiteError('sqlite','SELECTs to the left and right of UNION ALL do not have the same number of result columns',{code:1});
  const builder=owner?.builder??new SelectProgramBuilder<Op>(),ops=builder.ops;
  const parameters:ParameterBuilder=owner?.parameters??{maximum:0,names:[],named:new Map()};
  const destination:SelectDest=owner?.destination??{kind:'output'};
  const limit=computeLimitRegisters(select,ops,()=>builder.register(),parameters),stops:number[]=[];
  const emitRow=(first:number,count:number)=>{
    let skip=-1;if(limit?.offset!==undefined){skip=ops.length;ops.push({code:'IfPos',p1:limit.offset,p2:0,p3:1});}
    emitSelectDestination(ops,destination,first,count);
    if(limit){stops.push(ops.length);ops.push({code:'DecrJumpZero',p1:limit.count,p2:0});}
    if(skip>=0)(ops[skip] as {p2:number}).p2=ops.length;
  };
  let columns:Program['columns']|undefined;
  // Resolve and emit each producer in order into the same VDBE. Errors from
  // any arm abort prepare before a partially constructed Program is published.
  // select.c:multiSelect shares its destination and CteUse across arm bodies.
  // Lowered CTEs are not schema tables; materialize the represented producer
  // in this builder, then scan an independent reader for each arm.
  const cteCursors=new Map<object,number>();
  for(const arm of arms){
    if(selectHasWindow(arm)){
      let expanded:ReturnType<typeof expandAndResolveSelect>;
      try{expanded=expandAndResolveSelect(arm,schema,null,builder.cursors)}catch(error){if(error instanceof NameResolutionError)throw new JSQLiteError('sqlite',error.message,{code:1});throw error;}
      const compiled=compileWindowSelectLowering(expanded,database.encoding,database,maxWorkUnits,maxResultBytes,privateStateLimits,schema,undefined,{builder,parameters,destination});
      if(compiled.program.columns.length!==width)throw new JSQLiteError('unsupported','window compound arm is not fully represented',{unsupportedClassification:'temporary'});
      columns??=compiled.program.columns;
      continue;
    }
    const sources=arm.from.cteDerived;
    if(sources?.length){
      // select.c fromClauseTermCanBeCoroutine (2a)/(2b): NOT MATERIALIZED
      // permits independent repeated producers. Preserve the arm destination
      // in this builder instead of taking the shared CteUse spool branch.
      if(sources.length===1&&arm.from.items.length===1&&sources[0]!.materialization==='not-materialized'){
        const produced=compileDerivedProducer(arm,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{builder,parameters,destination,emitRow});
        if(!produced)throw new JSQLiteError('unsupported','non-materialized compound CTE producer is not represented',{unsupportedClassification:'temporary'});
        columns??=produced.columns;continue;
      }
      const unsupported=()=>new JSQLiteError('unsupported','this compound CTE arm is not implemented',{unsupportedClassification:'temporary'});
      if(sources.length!==1||arm.from.items.length!==1||arm.from.derived?.index!==0||arm.where||arm.hasDistinct||arm.hasGroupBy||arm.hasHaving||arm.result.length!==1)throw unsupported();
      const source=sources[0]!,producer=source.select;
      const physical=producer.from.items.length===1&&!producer.from.derived&&!producer.from.cteDerived?.length;
      if(producer.hasCompound||producer.hasOrderBy||producer.hasDistinct||producer.hasGroupBy||producer.hasHaving||producer.from.derived||selectHasAggregate(producer)||selectHasWindow(producer)||producer.result.length!==1||producer.arms.length!==1||!(["select","values"] as string[]).includes(producer.arms[0]!.origin)||producer.arms[0]!.valuesRows?.some(row=>row.length!==1)||(!physical&&(producer.from.items.length||producer.hasLimit||producer.where)))throw unsupported();
      // resolve.c owns the lexical binding before materialization. The result
      // range is the complete producer payload, not a spelling-based projection.
      const parentPlan=resolveTransientArm(arm,schema),result=parentPlan.result[0]!;
      if(result.resolution!=='direct'||result.columnIndex!==0)throw unsupported();
      const producerColumns=compoundArmColumns(producer,schema);
      columns??=Object.freeze([{...producerColumns[0]!,name:result.name}]);
      let cursor=cteCursors.get(source.use);
      if(cursor===undefined){
        cursor=builder.cursor();cteCursors.set(source.use,cursor);
        ops.push({code:'OpenEphemeral',p1:cursor,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:1,keyFieldCount:1,terms:[{collation:'binary'}]}),insertionOrder:true});
        const ret=builder.register(),call=ops.length;ops.push({code:'Gosub',p1:ret,p2:0},{code:'Goto',p2:0});
        (ops[call] as {p2:number}).p2=ops.length;
        let producerPlan:ReturnType<typeof expandAndResolveSelect>;
        try{producerPlan=expandAndResolveSelect(producer,schema,null,builder.cursors)}catch(error){if(error instanceof NameResolutionError)throw new JSQLiteError('sqlite',error.message,{code:1});throw error;}
        // select.c tag-select-0488 delegates materialized row production
        // to sqlite3Select with SRT_EphemTab, including all VALUES ELists.
        if(physical)compileInnerTableSelect(producer,producerPlan,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{builder,ops,parameters,destination:{kind:'ephemeral',cursor:cursor!}});
        else compileScalarSelect(producer,database.encoding,maxWorkUnits,maxResultBytes,privateStateLimits,schema,database,maxRows,{builder,parameters,emitRow:(first,count)=>emitSelectDestination(ops,{kind:'ephemeral',cursor:cursor!},first,count)});
        ops.push({code:'Return',p1:ret});(ops[call+1] as {p2:number}).p2=ops.length;ops.push({code:'EphemeralSort',p1:cursor});
      }
      const reader=builder.cursor();ops.push({code:'OpenDup',p1:reader,p2:cursor});
      const rewind=ops.length,value=builder.register();ops.push({code:'EphemeralRewind',p1:reader,p2:0});
      const loop=ops.length;ops.push({code:'EphemeralData',p1:reader,p2:value,count:1});
      emitSelectDestination(ops,destination,value,1);ops.push({code:'EphemeralNext',p1:reader,p2:loop});
      (ops[rewind] as {p2:number}).p2=ops.length;
      continue;
    }
    if(selectHasAggregate(arm)||arm.hasGroupBy||arm.hasHaving){
      const result=compileAggregateSelect(arm,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{builder,ops,parameters,destination,compoundLimit:{registers:limit,stops}});
      columns??=result.columns;
    }else if(arm.from.derived){
      // select.c flattenSubquery restrictions (4),(13)-(15): this retained
      // SrcItem needs a producer destination, never physical schema lookup.
      const produced=compileDerivedProducer(arm,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{builder,parameters,destination,emitRow});
      if(!produced)throw new JSQLiteError('unsupported','retained derived arm is not represented',{unsupportedClassification:'temporary'});
      columns??=produced.columns;
    }else if(arm.from.items.length||arm.where){
      let expanded:ReturnType<typeof expandAndResolveSelect>;
      try{expanded=expandAndResolveSelect(arm,schema,null,builder.cursors)}
      catch(error){if(error instanceof NameResolutionError)throw new JSQLiteError('sqlite',error.message,{code:1});throw error;}
      columns??=Object.freeze(expanded.result.map(result=>Object.freeze({name:result.name,declaredType:result.descriptor.declaredType,database:result.descriptor.database,table:result.descriptor.table,origin:result.descriptor.origin})));
      if(expanded.sources.length)compileInnerTableSelect(arm,expanded,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{builder,ops,parameters,destination,compoundLimit:{registers:limit,stops}});
      else {
        if(!arm.hasValues&&!arm.hasGroupBy&&!arm.hasHaving){
          compileScalarSelect(arm,database.encoding,maxWorkUnits,maxResultBytes,privateStateLimits,schema,database,maxRows,{builder,parameters,emitRow});
        }else{
          const allocate=()=>builder.register();let skip=-1;
          if(arm.where?.reduction){const predicate=compileExpressionTree(expressionFromReduction(arm.where.reduction),ops,allocate,parameters);skip=ops.length;ops.push({code:'IfNot',p1:predicate,p2:0});}
          const first=builder.range(width);
          arm.result.forEach((item,index)=>{const value=compileExpression(item,ops,allocate,parameters).register;ops.push({code:'Copy',p1:value,p2:first+index});});
          emitRow(first,width);
          if(skip>=0)(ops[skip] as {p2:number}).p2=ops.length;
        }
      }
    }else{
      // resolve.c resolves even a zero-FROM arm before selectInnerLoop codes
      // its single row. Otherwise a bare unknown column becomes a late VM
      // expression instead of an atomic prepare error.
      let expanded:ReturnType<typeof expandAndResolveSelect>;
      try{expanded=expandAndResolveSelect(arm,schema,null,builder.cursors)}
      catch(error){if(error instanceof NameResolutionError)throw new JSQLiteError('sqlite',error.message,{code:1});throw error;}
      // multiSelectValues/selectInnerLoop owns every VALUES EList. Keep
      // scalar subquery hooks and lexical resolution in the shared row owner.
      if(arm.hasGroupBy||arm.hasHaving)throw new JSQLiteError('unsupported','zero-source grouped compound arm is not represented',{unsupportedClassification:'temporary'});
      const compiled=compileScalarSelect(arm,database.encoding,maxWorkUnits,maxResultBytes,privateStateLimits,schema,database,maxRows,{builder,parameters,emitRow});
      columns??=compiled.columns;
    }
  }
  const end=ops.length;
  if(limit){(ops[limit.ifZero] as {p2:number}).p2=end;for(const stop of stops)(ops[stop] as {p2:number}).p2=end;}
  if(owner)return {columns:columns!};
  ops.push({code:'Halt'});
  return Object.freeze({ops:builder.finish(),registers:builder.registers,encoding:database.encoding,columns:columns!,parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits});
}

function compileSimpleTableCompound(select:SelectNode,schema:SchemaGraph,database:BtreeDatabase,maxRows:number,maxWorkUnits:number,maxResultBytes:number,privateStateLimits:PrivateStateLimits):Program;
function compileSimpleTableCompound(select:SelectNode,schema:SchemaGraph,database:BtreeDatabase,maxRows:number,maxWorkUnits:number,maxResultBytes:number,privateStateLimits:PrivateStateLimits,owner:{builder:SelectProgramBuilder<Op>;parameters:ParameterBuilder;destination:SelectDest}): {columns:Program['columns']};
function compileSimpleTableCompound(select:SelectNode,schema:SchemaGraph,database:BtreeDatabase,maxRows:number,maxWorkUnits:number,maxResultBytes:number,privateStateLimits:PrivateStateLimits,owner?:{builder:SelectProgramBuilder<Op>;parameters:ParameterBuilder;destination:SelectDest}):Program|{columns:Program['columns']} {
  // select.c:sqlite3Select owns GROUP/HAVING in AggInfo, never the raw
  // multiSelect table scan. SelectArm currently lacks a GROUP expression list;
  // preserve the flags and reject before emitting any parent instructions.
  if(select.arms.some(arm=>arm.hasGroupBy||arm.hasHaving))throw new JSQLiteError("unsupported","grouped compound table arms are not implemented",{unsupportedClassification:"temporary"});
  if(select.arms.some(arm=>arm.from.items.length!==1||arm.where!==null||arm.result.length!==1||arm.origin!=="select"))throw new JSQLiteError("unsupported","complex compound table arms are not implemented",{unsupportedClassification:"temporary"});
  const resolved=select.arms.map(arm=>{const name=sqlName(arm.from.items[0]!.tableName),table=schema.findTable(name);if(!table)throw new JSQLiteError("sqlite",`no such table: ${name}`,{code:1});if(table.withoutRowid||table.columns.some(c=>c.generatedExpr))throw new JSQLiteError("unsupported","this table storage shape is not implemented",{unsupportedClassification:"temporary"});const expression=arm.result[0]!,token=expression.tokens;if(token.length!==1)throw new JSQLiteError("unsupported","compound table expression is not implemented",{unsupportedClassification:"temporary"});const columnName=sqlName(token[0]!.text),column=table.columns.findIndex(c=>sqliteIdentifierEqual(c.name,columnName));if(column<0)throw new JSQLiteError("sqlite",`no such column: ${columnName}`,{code:1});return{arm,table,column,expression};});
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
  // select.c:multiSelect copies the caller SelectDest and codes arm scans into
  // the same Vdbe. This bounded table-set owner keeps its typed ephemeral
  // transition but allocates scan cursors, row/key registers and result
  // destination in the enclosing program, never a relocated child Program.
  const builder=owner?.builder??new SelectProgramBuilder<Op>(),ops=builder.ops,parameters:ParameterBuilder=owner?.parameters??{maximum:0,names:[],named:new Map()};
  const row=builder.register(),keys=orderTerms.length?builder.range(orderTerms.length):0;
  const limit=computeLimitRegisters(select,ops,()=>builder.register(),parameters);
  const setCursor=builder.cursor(),auxCursor=builder.cursor(),sorterCursor=builder.cursor();
  const setKeyInfo=new KeyInfo({encoding:database.encoding,totalFieldCount:1,keyFieldCount:1,terms:[{collation:leftCollation as BuiltinCollation}]});
  const orderKeyInfo=orderTerms.length?new KeyInfo({encoding:database.encoding,totalFieldCount:orderTerms.length,keyFieldCount:orderTerms.length,terms:orderTerms}):null;
  if(orderKeyInfo)ops.push({code:"SorterOpen",p1:sorterCursor,keyInfo:orderKeyInfo});
  const haltJumps:number[]=[],emitResult=()=>{let skip:number|undefined;if(limit?.offset!==undefined){skip=ops.length;ops.push({code:"IfPos",p1:limit.offset,p2:0,p3:1});}emitSelectDestination(ops,owner?.destination??{kind:"output"},row,1);if(limit){haltJumps.push(ops.length);ops.push({code:"DecrJumpZero",p1:limit.count,p2:0});}return skip;};
  const emitOrdered=()=>{for(let index=0;index<orderTerms.length;index++)ops.push({code:"Copy",p1:row,p2:keys+index});ops.push({code:"SorterInsert",p1:sorterCursor,keyStart:keys,keyCount:orderTerms.length,payload:row,payloadCount:1,...(limit?{topN:limit.capacity}:{})});};
  const scan=(item:typeof resolved[number],destination:"result"|"order"|"set"|"aux-set"|"delete")=>{const distinct=item.arm.hasDistinct?builder.cursor():undefined; if(distinct!==undefined){const collation=sqliteAsciiFold(item.table.columns[item.column]!.collation??"binary");if(collation!=="binary"&&collation!=="nocase"&&collation!=="rtrim")throw new JSQLiteError("sqlite",`no such collation sequence: ${collation}`,{code:1});ops.push({code:"OpenEphemeral",p1:distinct,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:1,keyFieldCount:1,terms:[{collation}]})});}const cursor=builder.cursor();ops.push({code:"OpenRead",p1:item.table.rootPage,p2:cursor});const rewind=ops.length;ops.push({code:"Rewind",p1:cursor,p2:0});const body=ops.length;ops.push(isIntegerPrimaryKeyAlias(item.table,item.column)?{code:"Rowid",p1:cursor,p2:row}:{code:"Column",p1:item.column,p2:row,p3:cursor,...(item.table.columns[item.column]!.affinity==="real"?{affinity:"real" as const}:{})});let duplicate:number|undefined;if(distinct!==undefined){duplicate=ops.length;ops.push({code:"Found",p1:distinct,keyStart:row,keyCount:1,jump:0},{code:"IdxInsert",p1:distinct,keyStart:row,keyCount:1});}let skip:number|undefined;if(destination==="result")skip=emitResult();else if(destination==="order")emitOrdered();else if(destination==="set")ops.push({code:"IdxInsert",p1:setCursor,keyStart:row,keyCount:1,replace:true});else if(destination==="delete")ops.push({code:"SetDelete",p1:setCursor,keyStart:row,keyCount:1});else ops.push({code:"IdxInsert",p1:auxCursor,keyStart:row,keyCount:1,replace:true});const next=ops.length;ops.push({code:"Next",p1:cursor,p2:body});(ops[rewind] as {p2:number}).p2=ops.length;if(skip!==undefined)(ops[skip] as {p2:number}).p2=next;if(duplicate!==undefined)(ops[duplicate] as {jump:number}).jump=next;};
  const destination=orderKeyInfo?"order" as const:"result" as const;
  if(lastSetArm<0){for(const item of resolved)scan(item,destination);}
  else{
    ops.push({code:"OpenEphemeral",p1:setCursor,keyInfo:setKeyInfo},{code:"OpenEphemeral",p1:auxCursor,keyInfo:setKeyInfo});
    for(let index=0;index<=lastSetArm;index++){const operator=resolved[index]!.arm.operatorFromPrior;if(index===0||operator==="union"||operator==="union-all")scan(resolved[index]!,"set");else if(operator==="except")scan(resolved[index]!,"delete");else{scan(resolved[index]!,"aux-set");ops.push({code:"SetRetainIntersection",p1:setCursor,p2:auxCursor},{code:"ClearEphemeral",p1:auxCursor});}}
    ops.push({code:"EphemeralSort",p1:setCursor});const rewind=ops.length;ops.push({code:"EphemeralRewind",p1:setCursor,p2:0},{code:"EphemeralData",p1:setCursor,p2:row,count:1});let skip:number|undefined;if(orderKeyInfo)emitOrdered();else skip=emitResult();const next=ops.length;ops.push({code:"EphemeralNext",p1:setCursor,p2:rewind+1});(ops[rewind] as {p2:number}).p2=ops.length;if(skip!==undefined)(ops[skip] as {p2:number}).p2=next;
    for(let index=lastSetArm+1;index<resolved.length;index++)scan(resolved[index]!,destination);
  }
  if(orderKeyInfo){const sortAt=ops.length;ops.push({code:"SorterSort",p1:sorterCursor,emptyJump:0},{code:"SorterData",p1:sorterCursor,p2:row,count:1});const skip=emitResult(),next=ops.length;ops.push({code:"SorterNext",p1:sorterCursor,p2:sortAt+1});(ops[sortAt] as {emptyJump:number}).emptyJump=ops.length;if(skip!==undefined)(ops[skip] as {p2:number}).p2=next;}
  const halt=ops.length;if(!owner)ops.push({code:"Halt"});if(limit){(ops[limit.ifZero] as {p2:number}).p2=halt;for(const at of haltJumps)(ops[at] as {p2:number}).p2=halt;}
  if(owner)return {columns:Object.freeze([Object.freeze({name:outputName,declaredType:leftColumn.declaredType,database:"main",table:left.table.name,origin:leftColumn.name})])};
  return Object.freeze({ops:builder.finish(),registers:builder.registers,encoding:database.encoding,columns:Object.freeze([Object.freeze({name:outputName,declaredType:leftColumn.declaredType,database:"main",table:left.table.name,origin:leftColumn.name})]),parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits});
}


/** select.c SRT_EphemTab destination for a single compound FROM producer.
 * The child Program is spliced into this Program and every SRT_Output row is
 * redirected to the consumer sorter. This retains one VDBE, work counter and
 * private-state budget rather than executing a nested public Statement. */
function compileSingleCompoundDerived(select:SelectNode,schema:SchemaGraph,database:BtreeDatabase,maxRows:number,maxWorkUnits:number,maxResultBytes:number,privateStateLimits:PrivateStateLimits,parent?:{builder:SelectProgramBuilder<Op>;parameters:ParameterBuilder;destination:SelectDest}):Program|{columns:Program['columns']}|undefined {
 const derived=select.from.derived;
 if(!derived||derived.index!==0||select.from.items.length!==1||!derived.select.hasCompound||select.where||select.hasDistinct||select.hasGroupBy||select.hasHaving||select.limit||select.offset)return undefined;
 // Table-arm-only lowering does not own no-FROM or ordered child arms.
 if(derived.select.arms.some(arm=>arm.from.items.length===0))return undefined;
 // Admit only one ordinal child key until compound ORDER BY resolution and
 // collation propagation own arbitrary result expressions.
 if(derived.select.hasOrderBy&&(derived.select.orderBy.length!==1||derived.select.orderBy[0]!.nulls!==null))return undefined;
 const item=select.from.items[0]!,alias=item.alias;
 const names=select.result.map(expression=>{if(!expression.reduction)return null;let tree=expressionFromReduction(expression.reduction);while(tree.kind==='collate')tree=tree.value;if(tree.kind!=="column")return null;const parts=tree.name.split('.').map(sqlName);if(parts.length>2||(parts.length===2&&(!alias||!sqliteIdentifierEqual(parts[0]!,alias))))return null;return parts.at(-1)!;});
 if(derived.select.arms.slice(1).some(arm=>arm.operatorFromPrior!=='union-all'))return undefined;
 // Admit only table arms owned by the linked table loop. Keep other derived
 // and compound shapes at their existing fallback boundary, before emitting.
 if(derived.select.arms.some(arm=>arm.from.derived||arm.from.cteDerived?.length||arm.from.items.length===0||arm.hasDistinct||arm.hasGroupBy||arm.hasHaving||arm.result.length!==derived.select.arms[0]!.result.length||!arm.result.length||selectHasWindow({...derived.select,arms:Object.freeze([arm])})))return undefined;
 const arms=derived.select.arms.map(arm=>({...derived.select,result:arm.result,from:arm.from,where:arm.where,hasDistinct:false,hasGroupBy:false,hasHaving:false,groupBy:Object.freeze([]),having:null,orderBy:Object.freeze([]),limit:null,offset:null,hasOrderBy:false,hasLimit:false,hasCompound:false,arms:Object.freeze([{...arm,operatorFromPrior:null,prior:null,next:null}])} as SelectNode));
 const builder=parent?.builder??new SelectProgramBuilder<Op>(),ops=builder.ops,parameters:ParameterBuilder=parent?.parameters??{maximum:0,names:[],named:new Map()};
 // Allocate the sorter before resolving arm cursors: all producer cursor and
 // register identities now belong to this one Parse/Vdbe analogue.
 const sorter=select.hasOrderBy?builder.cursor():-1;
 const flattenedOrder=!derived.select.hasOrderBy&&!derived.select.offset&&select.hasOrderBy;
 const childSorter=derived.select.hasOrderBy||flattenedOrder?builder.cursor():-1;
 const plans=arms.map(arm=>{
  let plan:ReturnType<typeof expandAndResolveSelect>;
  try{plan=expandAndResolveSelect(arm,schema,null,builder.cursors)}catch(error){if(error instanceof NameResolutionError)throw new JSQLiteError('sqlite',error.message,{code:1});throw error;}
  builder.reserveCursorsThrough(Math.max(...plan.sources.map(source=>source.cursorId)));
  return plan;
 });
 const firstColumns=plans[0]!.result,metadataColumns=plans.at(-1)!.result;
 const transientNames=uniqueTransientColumnNames(derived.select.result.map((expression,index)=>expression.alias??firstColumns[index]?.name??`column${index+1}`));
 // select.c:sqlite3ColumnsFromExprList fixes first-arm names before lookupName.
 for(const name of names)if(name!==null&&!transientNames.some(column=>sqliteIdentifierEqual(column,name)))
   throw new JSQLiteError("sqlite",`no such column: ${alias?`${alias}.`:""}${name}`,{code:1});
 if(names.some(value=>value===null))return undefined;
 const indices=names.map(name=>transientNames.findIndex(column=>sqliteIdentifierEqual(column,name!)));if(indices.some(index=>index<0))return undefined;
 const ordinal=select.orderBy.map(term=>{let tree=expressionFromReduction(term.expr.reduction!);while(tree.kind==='collate')tree=tree.value;return tree.kind==='literal'&&typeof tree.value==='bigint'&&tree.value>=1n&&tree.value<=BigInt(indices.length)?Number(tree.value-1n):-1;});
 if(ordinal.some(index=>index<0)||indices.some((index,i)=>index!==i)||ordinal.some((index,i)=>index!==i))return undefined;
 const childTerms=flattenedOrder?select.orderBy:derived.select.orderBy;
 const childOrder=childTerms.map(term=>{let tree=expressionFromReduction(term.expr.reduction!);while(tree.kind==='collate')tree=tree.value;return tree.kind==='literal'&&typeof tree.value==='bigint'&&tree.value>=1n&&tree.value<=BigInt(firstColumns.length)?Number(tree.value-1n):-1;});
 // The sorter destination reads a prefix of the result row; non-prefix
 // keys require select.c:multiSelectByMerge permutation lowering.
 if(childOrder.some((index,position)=>index!==position))return undefined;
 const destination:SelectDest=childSorter>=0?{kind:'sorter',cursor:childSorter,keyCount:childOrder.length}:sorter>=0?{kind:'sorter',cursor:sorter,keyCount:ordinal.length}:parent?.destination??{kind:'output'};
 if(childSorter>=0)ops.push({code:'SorterOpen',p1:childSorter,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:childOrder.length,keyFieldCount:childOrder.length,terms:childTerms.map(term=>({collation:'binary',desc:term.descending,nullsLarge:term.nulls==='last'?!term.descending:term.nulls==='first'?term.descending:false}))})});
 if(sorter>=0)ops.push({code:"SorterOpen",p1:sorter,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:ordinal.length,keyFieldCount:ordinal.length,terms:select.orderBy.map(term=>({collation:'binary',desc:term.descending,nullsLarge:term.nulls==='last'?!term.descending:term.nulls==='first'?term.descending:false}))})});
 // select.c:multiSelect(TK_ALL) forwards iLimit/iOffset to both arms in one
 // Vdbe, and tests exhausted LIMIT before the right arm. Compute once in the
 // parent so the table loop does not reset the shared count or OFFSET.
 const sharedLimit=computeLimitRegisters(derived.select,ops,()=>builder.register(),parameters);
 // Ordered merge limits output after combining both arm streams.
 const scanLimit=childSorter>=0?undefined:sharedLimit;
 // Each arm owns its wherecode loop exits; no finished-child PCs are copied.
 const tailStops:number[]=[];
 for(let i=0;i<arms.length;i++){
  if(i>0&&scanLimit){tailStops.push(ops.length);ops.push({code:'IfNot',p1:scanLimit.count,p2:0});}
  compileInnerTableSelect(arms[i]!,plans[i]!,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{builder,ops,parameters,destination,...(scanLimit?{sharedLimit:scanLimit}:{})});
 }
 if(childSorter>=0){
  const output=builder.range(firstColumns.length),sortAt=ops.length;
  ops.push({code:'SorterSort',p1:childSorter,emptyJump:0},{code:'SorterData',p1:childSorter,p2:output,count:firstColumns.length});
  const offsetAt=sharedLimit?.offset===undefined?-1:ops.length;
  if(sharedLimit?.offset!==undefined)ops.push({code:'IfPos',p1:sharedLimit.offset,p2:0,p3:1});
  emitSelectDestination(ops,sorter>=0?{kind:'sorter',cursor:sorter,keyCount:ordinal.length}:parent?.destination??{kind:'output'},output,firstColumns.length);
  const limitAt=sharedLimit?ops.length:-1;
  if(sharedLimit)ops.push({code:'DecrJumpZero',p1:sharedLimit.count,p2:0});
  const next=ops.length;ops.push({code:'SorterNext',p1:childSorter,p2:sortAt+1});
  const done=ops.length;(ops[sortAt] as {emptyJump:number}).emptyJump=done;
  if(offsetAt>=0)(ops[offsetAt] as {p2:number}).p2=next;
  if(limitAt>=0)(ops[limitAt] as {p2:number}).p2=done;
 }
 const producerEnd=ops.length;
 if(sharedLimit){(ops[sharedLimit.ifZero] as {p2:number}).p2=producerEnd;for(const at of tailStops)(ops[at] as {p2:number}).p2=producerEnd;}

 if(sorter>=0){const output=builder.range(indices.length),sortAt=ops.length;ops.push({code:'SorterSort',p1:sorter,emptyJump:0},{code:'SorterData',p1:sorter,p2:output,count:indices.length} );emitSelectDestination(ops,parent?.destination??{kind:'output'},output,indices.length);ops.push({code:'SorterNext',p1:sorter,p2:sortAt+1});(ops[sortAt] as {emptyJump:number}).emptyJump=ops.length;}
 if(!parent)ops.push({code:'Halt'});
 const columns=indices.map((index,result)=>Object.freeze({name:select.result[result]!.alias??transientNames[index]!,declaredType:metadataColumns[index]!.descriptor.declaredType,database:metadataColumns[index]!.descriptor.database,table:metadataColumns[index]!.descriptor.table,origin:metadataColumns[index]!.descriptor.origin}));
 if(parent)return {columns:Object.freeze(columns)};
 return Object.freeze({ops:builder.finish(),registers:builder.registers,encoding:database.encoding,columns:Object.freeze(columns),parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits});
}

export type FromSubqueryRouteFacts=Readonly<{sourceCount:number;index:number;joinFromLeft:SelectNode["from"]["items"][number]["joinFromLeft"];nextCross:boolean;leftOfRightJoin:boolean;updateFrom:boolean;coroutineOptimization:boolean;isCte:boolean|null;cteMaterialized:boolean|null;cteUseCount:number|null;cteNotMaterialized:boolean|null;earlierSubquery:boolean|null;selfJoinView:boolean|null}>;
/** Direct translation of select.c:fromClauseTermCanBeCoroutine conditions 1a-c/2a-b/3-5. */
export function fromClauseTermCanBeCoroutine(f:FromSubqueryRouteFacts):boolean{if(f.isCte===null||f.selfJoinView===null||f.earlierSubquery===null)return false;if(f.isCte){if(f.cteMaterialized===null||f.cteUseCount===null||f.cteNotMaterialized===null)return false;if(f.cteMaterialized)return false;if(f.cteUseCount>=2&&!f.cteNotMaterialized)return false;}if(f.leftOfRightJoin||!f.coroutineOptimization||f.selfJoinView)return false;if(f.index===0){if(f.sourceCount===1)return true;if(f.nextCross)return true;if(f.updateFrom)return false;return true;}if(f.updateFrom||f.joinFromLeft.outer||f.joinFromLeft.cross||f.earlierSubquery)return false;return true;}

/** select.c tag-select-0488: the admitted window-derived child emits into the
 * enclosing typed materialization destination before the outer consumer.
 * Other non-flattenable derived routes retain their own bounded fallbacks. */
// select.c:multiSelect dispatch is independent of its caller's destination.
// The same specialized producers serve top-level and coroutine consumers.
// select.c:sqlite3ColumnsFromExprList/transient SrcItem descriptor production.
// Resolve the arm without generating a metadata VDBE. CTE producer names are
// lexical NameContext evidence, never persistent schema-table lookup.
// select.c:flattenSubquery4290ff, bounded single ordinary SrcItem owner.
// Called on isolated compound arms as well as standalone sqlite3Select.
function flattenOrdinaryDerived(select:SelectNode):SelectNode {
  const derived=select.from.derived;
  if(select.hasCompound||!derived||derived.index!==0||select.from.items.length!==1||selectHasWindow(derived.select)||selectHasAggregate(derived.select)||derived.select.hasDistinct||derived.select.hasGroupBy||derived.select.hasHaving||derived.select.hasOrderBy||derived.select.hasLimit||derived.select.hasCompound||derived.select.from.items.length<1)return select;
    const names=uniqueTransientColumnNames(derived.select.result.map(expression=>expression.alias??expressionName(expression)));
    const producerQualifier=derived.select.from.items[0]!.alias??derived.select.from.items[0]!.tableName;
    const columns=new Map(derived.select.result.map((expression,index)=>[sqliteAsciiFold(names[index]!),expression]));
    const qualifier=select.from.items[0]!.alias??select.from.items[0]!.tableName;
    // select.c selectExpander expands a transient source's star against its
    // EList before flattenSubquery/substExpr. Do not expand it against the
    // spliced base SrcList: that loses expression projections and USING names.
    // This bounded route needs a named, explicit producer EList; retained stars
    // in that producer still belong to the ordinary materialization route.
    if(derived.select.result.some(expression=>expression.tokens.length===1&&expression.tokens[0]!.text==="*"||expression.tokens.length===3&&expression.tokens[1]!.text==="."&&expression.tokens[2]!.text==="*"))return select;
    const result=Object.freeze(select.result.flatMap(expression=>{
      const tokens=expression.tokens;
      const star=tokens.length===1&&tokens[0]!.text==="*"||tokens.length===3&&tokens[1]!.text==="."&&tokens[2]!.text==="*"&&sqliteIdentifierEqual(sqlName(tokens[0]!.text),qualifier);
      if(star)return derived.select.result.map((value,index)=>Object.freeze({...value,alias:names[index]!}));
      // select.c:sqlite3GenerateColumnNames runs on the resolved transient
      // column before substExpr replaces it with the producer expression.
      // Keep that column's name, not its qualified SQL span, after flattening.
      const directName=tokens.length===1?sqlName(tokens[0]!.text):tokens.length===3&&tokens[1]!.text==='.'&&sqliteIdentifierEqual(sqlName(tokens[0]!.text),qualifier)?sqlName(tokens[2]!.text):undefined;
      const at=directName===undefined?-1:names.findIndex(name=>sqliteIdentifierEqual(name,directName));
      const projected=substituteViewExpression(expression,columns,qualifier,false,producerQualifier);
      return [at>=0&&expression.alias===undefined?Object.freeze({...projected,alias:names[at]!}):projected];
    }));
    const groupBy=Object.freeze(select.groupBy.map(expression=>substituteViewExpression(expression,columns,qualifier,false,producerQualifier)));
    const having=select.having?substituteViewExpression(select.having,columns,qualifier,false,producerQualifier):null;
    const orderBy=Object.freeze(select.orderBy.map(term=>Object.freeze({...term,expr:substituteViewExpression(term.expr,columns,qualifier,false,producerQualifier)})));
    const outerWhere=select.where?substituteViewExpression(select.where,columns,qualifier,false,producerQualifier):null;
    const where=andViewPredicates(derived.select.where,outerWhere);
    const flattened=Object.freeze({...select,result,groupBy,having,orderBy,from:derived.select.from,where,hasSubquery:select.hasSubquery||derived.select.hasSubquery,tokens:select.tokens});
    return flattened;
}

function compoundArmColumns(arm:SelectNode,schema:SchemaGraph):Program['columns'] {
  arm=flattenOrdinaryDerived(arm);
  if(arm.from.derived&&!arm.from.cteDerived?.length){
    const plan=resolveTransientArm(arm,schema);
    return plan.result.map(result=>{
      if(result.resolution!=='direct'||result.columnIndex===null||result.columnIndex<0)throw new JSQLiteError('unsupported','retained derived arm expression is not implemented',{unsupportedClassification:'temporary'});
      const {declaredType,database,table,origin}=result.descriptor;
      return Object.freeze({name:result.name,declaredType,database,table,origin});
    });
  }
  if(arm.hasValues&&!arm.hasCompound&&!arm.from.items.length){
    const rows=arm.arms[0]?.valuesRows,width=rows?.[0]?.length;
    if(!width||rows?.some(row=>row.length!==width))throw new JSQLiteError('sqlite','all VALUES must have the same number of terms',{code:1});
    // select.c:sqlite3ColumnsFromExprList names a VALUES transient Table.
    return Object.freeze(Array.from({length:width},(_,index)=>Object.freeze({name:`column${index+1}`,declaredType:null,database:null,table:null,origin:null})));
  }
  const sources=arm.from.cteDerived;
  if(sources?.length===1&&arm.from.items.length===1){
    const plan=resolveTransientArm(arm,schema);
    return Object.freeze(plan.result.map(result=>{
      if(result.resolution!=='direct')throw new JSQLiteError('unsupported','this compound CTE arm is not implemented',{unsupportedClassification:'temporary'});
      const producerColumns=compoundArmColumns(sources[0]!.select,schema);
      const descriptor=result.columnIndex===null?undefined:producerColumns[result.columnIndex];
      if(!descriptor)throw new JSQLiteError('unsupported','this compound CTE arm is not implemented',{unsupportedClassification:'temporary'});
      return Object.freeze({...descriptor,name:result.name});
    }));
  }
  try{return expandAndResolveSelect(arm,schema).result.map(result=>Object.freeze({name:result.name,declaredType:result.descriptor.declaredType,database:result.descriptor.database,table:result.descriptor.table,origin:result.descriptor.origin}));}catch(error){if(error instanceof NameResolutionError)throw new JSQLiteError('sqlite',error.message,{code:1});throw error;}
}

function compileTableCompoundProducer(select:SelectNode,schema:SchemaGraph,database:BtreeDatabase,maxRows:number,maxWorkUnits:number,maxResultBytes:number,privateStateLimits:PrivateStateLimits,owner?:{builder:SelectProgramBuilder<Op>;parameters:ParameterBuilder;destination:SelectDest}):Program|{columns:Program['columns']}|void {
  if(select.orderBy.length){
    const ordered=owner?compileOrderedCteUnionAll(select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,owner):compileOrderedCteUnionAll(select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits);
    if(ordered)return ordered;
  }
  // select.c multiSelect dispatches complete arm SELECTs before the simple
  // relational fallback gate. GROUP/HAVING are not compound-level clauses.
  const all=owner
    ?compileCteUnionAll(select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,owner)
    :compileCteUnionAll(select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits);
  if(all)return all;
  rejectUnsupportedSelectClauses(select,true);
  if(owner)return compileJoinedUnionAll(select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,owner)??compileSimpleTableCompound(select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,owner);
  return compileJoinedUnionAll(select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits)??compileSimpleTableCompound(select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits);
}

// select.c sqlite3SubqueryColumnTypes: names and collation of transient
// columns come from the leftmost producer. This metadata walk emits no code
// and never substitutes or moves producer LIMIT/predicates into consumers.
function transientSourceTable(producer:SelectNode,name:string,schema:SchemaGraph,cteNames=false):import('./schema.ts').TableNode{
  const metadata=compoundArmColumns(producer,schema),names=uniqueTransientColumnNames(cteNames&&producer.result.length===metadata.length?producer.result.map(item=>item.alias??expressionName(item)):metadata.map(column=>column.name)),collations=transientResultCollations(producer,schema);
  const affinityPlans=producer.arms.map(arm=>resolveTransientArm({...producer,result:arm.result,from:arm.from,where:arm.where,hasCompound:false,arms:Object.freeze([arm])},schema));
  const affinities=metadata.map((_,index)=>resolvedCompoundAffinity(affinityPlans,index));
  const table:import('./schema.ts').TableNode={integerPrimaryKey:null,szTabRow:1,nRowLogEst:200,hasStat1:false,kind:'table',name:name,tableName:name,rootPage:0,sql:'',columns:metadata.map((column,index)=>({szEst:0,name:names[index]!,declaredType:transientDeclaredType((affinityPlans[0]!.result[index]!.expression.reduction?resolvedExpressionDeclaredType(affinityPlans[0]!.result[index]!.expression.reduction!,affinityPlans[0]!):resolvedResultColumn(affinityPlans[0]!.result[index]!)?.declaredType??null),affinities[index]!),affinity:affinities[index]!,collation:collations[index]!,defaultExpr:null,generatedExpr:null,defaultIndex:null,notNull:false,primaryKeyPosition:null,unique:false,generatedStorage:null,checks:[]})),indexes:[],withoutRowid:false,noVisibleRowid:true,primaryKey:[],primaryKeyTerms:[],storageKey:[],checks:[],foreignKeys:[],referencedBy:[]};
  freezeTransientTable(table);
  bindTransientProducer(table,affinityPlans.at(-1)!);
  return table;
}

// One resolved SrcItem context per arm. Descriptor and collation consumers
// share lookupName; later arms are resolved even when only the first arm
// contributes metadata. This never publishes a physical scan plan.
function resolveTransientArm(node:SelectNode,schema:SchemaGraph):ReturnType<typeof expandAndResolveSelect>{
  const bindings=new Map<number,import('./schema.ts').TableNode>();
  if(node.from.derived){const source=node.from.derived;bindings.set(source.index,transientSourceTable(source.select,node.from.items[source.index]!.tableName,schema));}
  for(const source of node.from.cteDerived??[])bindings.set(source.index,transientSourceTable(source.select,node.from.items[source.index]!.tableName,schema,true));
  try{return expandAndResolveSelect(node,schema,null,0,bindings);}
  catch(error){if(error instanceof NameResolutionError)throw new JSQLiteError('sqlite',error.message,{code:1});throw error;}
}

function transientResultCollations(select:SelectNode,schema:SchemaGraph):readonly BuiltinCollation[]{
  // select.c2346 SF_Resolved precondition: resolve every arm before selecting
  // leftmost pPrior metadata. No separate validation/descriptor recursion.
  const plans=select.arms.map(candidate=>resolveTransientArm({...select,result:candidate.result,from:candidate.from,where:candidate.where,hasCompound:false,hasDistinct:candidate.hasDistinct,hasGroupBy:candidate.hasGroupBy,hasHaving:candidate.hasHaving,groupBy:candidate.groupBy??Object.freeze([]),having:candidate.having??null,arms:Object.freeze([candidate])},schema));
  const plan=plans[0]!;
  return plan.result.map(result=>{
    const expression=result.expression.reduction!;
    const name=(expression?resolvedExpressionCollation(expression,plan):resolvedResultColumn(result)?.collation)??result.descriptor.collation;
    const normalized=sqliteAsciiFold(name);
    if(normalized!=='binary'&&normalized!=='nocase'&&normalized!=='rtrim')throw new JSQLiteError('sqlite',`no such collation sequence: ${name}`,{code:1});
    return normalized;
  });
}

// select.c multiSelectByMerge: mutable shared Parse/Vdbe plus destination.
function emitScalarCompoundMerge(child:SelectNode,schema:SchemaGraph|undefined,database:BtreeDatabase,maxRows:number,maxWorkUnits:number,maxResultBytes:number,privateStateLimits:PrivateStateLimits,builder:SelectProgramBuilder<Op>,parameters:ParameterBuilder,destination:SelectDest,emitArm?:(arm:SelectNode,emitRow:(first:number,count:number)=>void,destination:SelectDest)=>void,prepared?:{plans:readonly ReturnType<typeof expandAndResolveSelect>[];limit:LimitRegisters}):void{
    const ops=builder.ops;
    // select.c2987-3003 invents ascending ORDER BY 1 for non-ALL; full
    // comparison keys resolve ties. Recursively compose its prior merge graph.
    const width=child.arms[0]!.result.length;
    const keyPlans=prepared?.plans??child.arms.map(arm=>resolveTransientArm({...child,result:arm.result,from:arm.from,where:arm.where,hasDistinct:arm.hasDistinct,hasGroupBy:arm.hasGroupBy,hasHaving:arm.hasHaving,groupBy:arm.groupBy??Object.freeze([]),having:arm.having??null,hasCompound:false,hasOrderBy:false,orderBy:Object.freeze([]),arms:Object.freeze([arm])},schema!));
    const terms=Array.from({length:width},(_,index)=>{
      const name=resolvedCompoundCollation(keyPlans,index)??'binary',normalized=sqliteAsciiFold(name);
      if(normalized!=='binary'&&normalized!=='nocase'&&normalized!=='rtrim')throw new JSQLiteError('sqlite',`no such collation sequence: ${name}`,{code:1});
      return {collation:normalized as BuiltinCollation};
    });
    const keyInfo=new KeyInfo({encoding:database.encoding,totalFieldCount:width,keyFieldCount:width,terms});
    const order=child.orderBy.map((term,index)=>{
      const tree=expressionFromReduction(term.expr.reduction!),identity=tree.kind==='collate'?tree.value:tree;
      let resultIndex=-1;
      if(identity.kind==='literal'&&typeof identity.value==='bigint'){
        if(identity.value<1n||identity.value>BigInt(width))throw new JSQLiteError('sqlite',`${index+1}${index===0?'st':index===1?'nd':index===2?'rd':'th'} ORDER BY term out of range - should be between 1 and ${width}`,{code:1});
        resultIndex=Number(identity.value-1n);
      }else if(identity.kind==='column'&&!identity.name.includes('.')){
        for(const arm of child.arms){const at=arm.result.findIndex(result=>!!result.alias&&sqliteIdentifierEqual(result.alias,sqlName(identity.name)));if(at>=0){resultIndex=at;break;}}
      }
      if(resultIndex<0)for(const arm of child.arms){const at=arm.result.findIndex(result=>compoundOrderExpressionEqual(identity,expressionFromReduction(result.reduction!)));if(at>=0){resultIndex=at;break;}}
      if(resultIndex<0)throw new JSQLiteError('sqlite',`${index+1}${index===0?'st':index===1?'nd':index===2?'rd':'th'} ORDER BY term does not match any column in the result set`,{code:1});
      return {resultIndex,collation:explicitCollation(tree)??terms[resultIndex]!.collation!,desc:term.descending,nullsLarge:term.nulls==='last'?!term.descending:term.nulls==='first'?term.descending:false};
    });
    // select.c convertCompoundSelectToSubquery5502ff: set equality cannot
    // use an alternative ORDER collation. Produce the un-ordered compound
    // with its own merge/duplicate KeyInfo, then sort its surviving payload.
    if(child.arms.slice(1).some(arm=>arm.operatorFromPrior!=='union-all')&&child.orderBy.some(term=>explicitCollation(expressionFromReduction(term.expr.reduction!))!==undefined)){
      const cursor=builder.cursor(),row=builder.range(width),keys=builder.range(order.length),coroutine=builder.register();
      ops.push({code:'SorterOpen',p1:cursor,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:order.length,keyFieldCount:order.length,terms:order})});
      const init=ops.length;ops.push({code:'InitCoroutine',p1:coroutine,p2:0,p3:ops.length+1});
      emitScalarCompoundMerge({...child,hasOrderBy:false,orderBy:Object.freeze([]),limit:null,offset:null,hasLimit:false},schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,builder,parameters,{kind:'coroutine',register:coroutine,first:row},emitArm);
      ops.push({code:'EndCoroutine',p1:coroutine,p2:0});(ops[init] as {p2:number}).p2=ops.length;
      const limit=prepared?.limit??computeLimitRegisters(child,ops,()=>builder.register(),parameters);
      const loop=ops.length;ops.push({code:'Yield',p1:coroutine,p2:0});
      order.forEach((term,index)=>ops.push({code:'Copy',p1:row+term.resultIndex,p2:keys+index}));
      ops.push({code:'SorterInsert',p1:cursor,keyStart:keys,keyCount:order.length,payload:row,payloadCount:width},{code:'Goto',p2:loop});
      const sort=ops.length;(ops[loop] as {p2:number}).p2=sort;ops.push({code:'SorterSort',p1:cursor,emptyJump:0});
      const read=ops.length;ops.push({code:'SorterData',p1:cursor,p2:row,count:width});
      const skip=limit?.offset!==undefined?ops.length:-1;if(skip>=0)ops.push({code:'IfPos',p1:limit!.offset!,p2:0,p3:1});
      emitSelectDestination(ops,destination,row,width);
      const done=limit?ops.length:-1;if(done>=0)ops.push({code:'DecrJumpZero',p1:limit!.count,p2:0});
      if(skip>=0)(ops[skip] as {p2:number}).p2=ops.length;
      ops.push({code:'SorterNext',p1:cursor,p2:read});const end=ops.length;
      (ops[sort] as {emptyJump:number}).emptyJump=end;
      if(limit){(ops[limit.ifZero] as {p2:number}).p2=end;(ops[done] as {p2:number}).p2=end;}
      return;
    }
    // select.c OP_Permutation maps ORDER terms to payload result slots.
    const mergeOrder=order.length?order:Array.from({length:width},(_,resultIndex)=>({resultIndex,...terms[resultIndex]!,desc:false,nullsLarge:false}));
    const mergeKeyInfo=new KeyInfo({encoding:database.encoding,totalFieldCount:mergeOrder.length,keyFieldCount:mergeOrder.length,terms:mergeOrder});
    const permutation=mergeOrder.map(term=>term.resultIndex);
    const limit=prepared?.limit??computeLimitRegisters(child,ops,()=>builder.register(),parameters);
    const emitMerge=(count:number,destination:SelectDest,root:boolean)=>{
    const operator=child.arms[count-1]!.operatorFromPrior;
    const previous=operator==='union-all'?0:builder.range(width),seen=operator==='union-all'?0:builder.register();if(seen)ops.push({code:'Integer',p1:0n,p2:seen});
    const arms=[0,1].map(side=>{
      const arm=child.arms[side===0?0:count-1]!;
      const returnReg=builder.register(),row=builder.range(width),cursor=builder.cursor();
      const initArm=ops.length;ops.push({code:'InitCoroutine',p1:returnReg,p2:0,p3:ops.length+1});
      if(side===0&&count>2){
        // multiSelectByMerge recursively compiles pPrior into destA. The
        // prefix already emits sorted keys; never materialize a completed graph.
        emitMerge(count-1,{kind:'coroutine',register:returnReg,first:row},false);
        ops.push({code:'EndCoroutine',p1:returnReg,p2:0});
        (ops[initArm] as {p2:number}).p2=ops.length;
        return {returnReg,row};
      }
      const keys=builder.range(mergeOrder.length);ops.push({code:'SorterOpen',p1:cursor,keyInfo:mergeKeyInfo});
      for(const expressions of arm.valuesRows??[arm.result]){
        const rowSelect={...child,result:expressions,from:arm.from,where:arm.where,hasDistinct:arm.hasDistinct,hasGroupBy:arm.hasGroupBy,hasHaving:arm.hasHaving,groupBy:arm.groupBy??Object.freeze([]),having:arm.having??null,hasCompound:false,hasValues:false,hasOrderBy:false,orderBy:Object.freeze([]),limit:null,arms:Object.freeze([{...arm,result:expressions,origin:'select' as const,valuesRows:null}])};
        try{if(!emitArm)expandAndResolveSelect(rowSelect,schema!)}catch(error){if(error instanceof NameResolutionError)throw new JSQLiteError('sqlite',error.message,{code:1});throw error;}
        const emitRow=(first:number,count:number)=>{mergeOrder.forEach((term,index)=>ops.push({code:'Copy',p1:first+term.resultIndex,p2:keys+index}));ops.push({code:'SorterInsert',p1:cursor,keyStart:keys,keyCount:mergeOrder.length,payload:first,payloadCount:count});};
        if(emitArm)emitArm(rowSelect,emitRow,{kind:'sorter',cursor,keyCount:width});
        else compileScalarSelect(rowSelect,database.encoding,maxWorkUnits,maxResultBytes,privateStateLimits,schema,database,maxRows,{builder,parameters,emitRow});
      }
      const sort=ops.length;ops.push({code:'SorterSort',p1:cursor,emptyJump:0},{code:'SorterData',p1:cursor,p2:row,count:width},{code:'Yield',p1:returnReg,p2:0},{code:'SorterNext',p1:cursor,p2:sort+1});
      const end=ops.length;ops.push({code:'EndCoroutine',p1:returnReg,p2:0});(ops[sort] as {emptyJump:number}).emptyJump=end;(ops[initArm] as {p2:number}).p2=ops.length;
      return {returnReg,row};
    });
    const A=arms[0]!,B=arms[1]!,ends:number[]=[];
    const output=(row:number)=>{
      // generateOutputSubroutine: previous-key suppression precedes OFFSET.
      const unseen=seen?ops.length:-1;if(seen)ops.push({code:'IfNot',p1:seen,p2:0});
      const duplicate=operator==='union-all'?-1:ops.length;if(duplicate>=0)ops.push({code:'CompareGroup',left:row,right:previous,count:width,keyInfo,jump:0});
      if(unseen>=0)(ops[unseen] as {p2:number}).p2=ops.length;
      if(seen){for(let i=0;i<width;i++)ops.push({code:'Copy',p1:row+i,p2:previous+i});ops.push({code:'Integer',p1:1n,p2:seen});}
      const skip=root&&limit?.offset!==undefined?ops.length:-1;if(skip>=0)ops.push({code:'IfPos',p1:limit!.offset!,p2:0,p3:1});
      emitSelectDestination(ops,destination,row,width);
      if(root&&limit){ends.push(ops.length);ops.push({code:'DecrJumpZero',p1:limit.count,p2:0});}
      if(duplicate>=0)(ops[duplicate] as {jump:number}).jump=ops.length;if(skip>=0)(ops[skip] as {p2:number}).p2=ops.length;
    };
    const startA=ops.length;ops.push({code:'Yield',p1:A.returnReg,p2:0});
    const startB=ops.length;ops.push({code:'Yield',p1:B.returnReg,p2:0});
    const compare=ops.length;ops.push({code:'CompareJump',left:A.row,right:B.row,count:mergeOrder.length,permutation,keyInfo:mergeKeyInfo,less:0,equal:0,greater:0});
    const less=ops.length;if(operator!=='intersect')output(A.row);
    const nextA=ops.length;ops.push({code:'Yield',p1:A.returnReg,p2:0},{code:'Goto',p2:compare});
    const equal=ops.length;if(operator==='intersect'||operator==='union-all')output(A.row);
    const equalNext=ops.length;ops.push({code:'Yield',p1:A.returnReg,p2:0},{code:'Goto',p2:compare});
    const greater=ops.length;if(operator==='union'||operator==='union-all')output(B.row);
    const nextB=ops.length;ops.push({code:'Yield',p1:B.returnReg,p2:0},{code:'Goto',p2:compare});
    const eofA=ops.length;
    if(operator==='union'||operator==='union-all'){
      output(B.row);const advance=ops.length;ops.push({code:'Yield',p1:B.returnReg,p2:0},{code:'Goto',p2:eofA});ends.push(advance);
    }else{ends.push(ops.length);ops.push({code:'Goto',p2:0});}
    const eofB=ops.length;
    if(operator!=='intersect'){
      output(A.row);const advance=ops.length;ops.push({code:'Yield',p1:A.returnReg,p2:0},{code:'Goto',p2:eofB});ends.push(advance);
    }else{ends.push(ops.length);ops.push({code:'Goto',p2:0});}
    // If A is initially empty, B must first be positioned before eof-A.
    const emptyA=ops.length;const emptyAdvance=ops.length;ops.push({code:'Yield',p1:B.returnReg,p2:0},{code:'Goto',p2:eofA});ends.push(emptyAdvance);
    const end=ops.length;
    (ops[startA] as {p2:number}).p2=emptyA;(ops[startB] as {p2:number}).p2=eofB;
    (ops[nextA] as {p2:number}).p2=eofA;(ops[equalNext] as {p2:number}).p2=eofA;(ops[nextB] as {p2:number}).p2=eofB;
    Object.assign(ops[compare]!,{less,equal,greater});for(const at of ends)(ops[at] as {p2:number}).p2=end;
    if(root&&limit)(ops[limit.ifZero] as {p2:number}).p2=end;
    };
    const lastSet=child.hasOrderBy?child.arms.length-1:child.arms.reduce((last,arm,index)=>arm.operatorFromPrior==='union-all'?last:index,0);
    const sequentialAll=prepared!==undefined&&!child.hasOrderBy&&child.arms.every(arm=>!arm.operatorFromPrior||arm.operatorFromPrior==='union-all');
    if(!sequentialAll)emitMerge(lastSet+1,destination,true);
    // multiSelect TK_ALL: same destination/common LIMIT, sequential right
    // arms after the sorted prefix. Never sort or deduplicate this ALL tail.
    const tailEnds:number[]=[];
    if(limit){tailEnds.push(ops.length);ops.push({code:'IfNot',p1:limit.count,p2:0});}
    for(const arm of child.arms.slice(sequentialAll?0:lastSet+1)){
      for(const expressions of arm.valuesRows??[arm.result]){
        const rowSelect={...child,result:expressions,from:arm.from,where:arm.where,hasCompound:false,hasValues:false,hasOrderBy:false,orderBy:Object.freeze([]),limit:null,arms:Object.freeze([{...arm,result:expressions,origin:'select' as const,valuesRows:null}])};
        if(emitArm){
          // multiSelect TK_ALL tail uses the same linked producer and shared
          // root LIMIT. A coroutine exposes rows before OFFSET/destination;
          // never re-resolve a correlated arm without its NameContext.
          const coroutine=builder.register(),row=builder.range(width),init=ops.length;
          ops.push({code:'InitCoroutine',p1:coroutine,p2:0,p3:ops.length+1});
          emitArm(rowSelect,()=>{}, {kind:'coroutine',register:coroutine,first:row});
          ops.push({code:'EndCoroutine',p1:coroutine,p2:0});(ops[init] as {p2:number}).p2=ops.length;
          const loop=ops.length;ops.push({code:'Yield',p1:coroutine,p2:0});
          const skip=limit?.offset!==undefined?ops.length:-1;if(skip>=0)ops.push({code:'IfPos',p1:limit!.offset!,p2:0,p3:1});
          emitSelectDestination(ops,destination,row,width);
          if(limit){tailEnds.push(ops.length);ops.push({code:'DecrJumpZero',p1:limit.count,p2:0});}
          if(skip>=0)(ops[skip] as {p2:number}).p2=ops.length;
          ops.push({code:'Goto',p2:loop});(ops[loop] as {p2:number}).p2=ops.length;
          continue;
        }
        try{expandAndResolveSelect(rowSelect,schema!)}catch(error){if(error instanceof NameResolutionError)throw new JSQLiteError('sqlite',error.message,{code:1});throw error;}
        compileScalarSelect(rowSelect,database.encoding,maxWorkUnits,maxResultBytes,privateStateLimits,schema,database,maxRows,{builder,parameters,emitRow:(first,count)=>{
          const skip=limit?.offset!==undefined?ops.length:-1;if(skip>=0)ops.push({code:'IfPos',p1:limit!.offset!,p2:0,p3:1});
          emitSelectDestination(ops,destination,first,count);
          if(limit){tailEnds.push(ops.length);ops.push({code:'DecrJumpZero',p1:limit.count,p2:0});}
          if(skip>=0)(ops[skip] as {p2:number}).p2=ops.length;
        }});
      }
    }
    const end=ops.length;for(const at of tailEnds)(ops[at] as {p2:number}).p2=end;
}

function compileDerivedProducer(select:SelectNode,schema:SchemaGraph,database:BtreeDatabase,maxRows:number,maxWorkUnits:number,maxResultBytes:number,privateStateLimits:PrivateStateLimits,owner?:{builder:SelectProgramBuilder<Op>;parameters:ParameterBuilder;destination:SelectDest;scalarRetained?:boolean;emitRow?:(first:number,count:number)=>void}):Program|undefined {
  if(owner?.scalarRetained){
    const child=select.from.derived?.select;
    if(!child||select.from.items.length!==1||select.where||select.hasDistinct||select.hasGroupBy||select.hasHaving||select.hasOrderBy||!owner.scalarRetained&&(!!select.limit||!!select.offset)||child.from.items.length>1||child.from.derived||child.hasCompound&&!owner.scalarRetained||selectHasWindow(child)||selectHasAggregate(child)||child.hasGroupBy||child.hasHaving||child.orderBy.some(term=>term.descending))throw new JSQLiteError('unsupported','retained derived destination shape is not implemented',{unsupportedClassification:'temporary'});
  }
 const derived=select.from.derived;
 if(derived&&derived.index===0&&select.from.items.length===1&&selectHasWindow(derived.select)&&!derived.select.hasCompound&&!select.hasDistinct&&!select.hasGroupBy&&!select.hasHaving&&select.orderBy.length<=1){
  // select.c tag-select-0488 materializes the rewritten window producer into
  // the enclosing destination before evaluating the parent's WHERE/ORDER/LIMIT.
  // Keep its nested coroutine addresses in the one parent builder; Halt exits
  // from the child fall through to the parent's materialized cursor scan.
  const builder=owner?.builder??new SelectProgramBuilder<Op>();builder.reserveCursorsThrough(41);const spool=builder.cursor(),outputSorter=builder.cursor(),ops=builder.ops,base=ops.length;
  let resolved:ReturnType<typeof expandAndResolveSelect>;
  try{resolved=expandAndResolveSelect(derived.select,schema)}catch(error){if(error instanceof NameResolutionError)throw new JSQLiteError('sqlite',error.message,{code:1});throw error;}
  const compilation=compileWindowSelectLowering(resolved,database.encoding,database,maxWorkUnits,maxResultBytes,privateStateLimits,schema,undefined,{builder,...(owner?{parameters:owner.parameters}:{}),destination:{kind:'sorter',cursor:spool,keyCount:0}});
  if(compilation.program.columns.length!==resolved.result.length)throw new JSQLiteError('unsupported','window functions are not implemented',{unsupportedClassification:'temporary'});
  const inner=compilation.program;
  if(inner.parameters.length&&!owner)return undefined;
  const names=uniqueTransientColumnNames(derived.select.result.map((expression,index)=>expression.alias??inner.columns[index]?.name??`column${index+1}`)),alias=select.from.items[0]!.alias;
  const bareStar=select.result.length===1&&select.result[0]!.tokens.length===1&&select.result[0]!.tokens[0]!.text==='*';
  const sourceIndex=(expression:typeof select.result[number]):number=>{if(!expression.reduction)return -1;let tree=expressionFromReduction(expression.reduction);while(tree.kind==='collate')tree=tree.value;if(tree.kind!=='column')return -1;const parts=tree.name.split('.').map(sqlName);if(parts.length>2||(parts.length===2&&(!alias||!sqliteIdentifierEqual(parts[0]!,alias))))return -1;return names.findIndex(name=>sqliteIdentifierEqual(name,parts.at(-1)!));};
  const indices=bareStar?inner.columns.map((_,index)=>index):select.result.map(sourceIndex);if(indices.some(index=>index<0)){const missing=select.result[indices.indexOf(-1)]!;if(missing.reduction){let tree=expressionFromReduction(missing.reduction);while(tree.kind==='collate')tree=tree.value;if(tree.kind==='column')throw new JSQLiteError('sqlite',`no such column: ${tree.name}`,{code:1});}return undefined;}
  let orderIndex=-1,orderTree:Expression|undefined;if(select.hasOrderBy){const term=select.orderBy[0]!;orderTree=expressionFromReduction(term.expr.reduction!);let tree=orderTree;while(tree.kind==='collate')tree=tree.value;if(tree.kind==='literal'&&tree.value===1n)orderIndex=indices[0]??-1;else if(tree.kind==='column'){const parts=tree.name.split('.').map(sqlName);if(parts.length<=2&&(parts.length===1||!!alias&&sqliteIdentifierEqual(parts[0]!,alias)))orderIndex=names.findIndex(name=>sqliteIdentifierEqual(name,parts.at(-1)!));}if(orderIndex<0)return undefined;}
  const first=ops[base]!,ends:number[]=compilation.ownerExit===undefined?[]:[compilation.ownerExit];ops[base]={code:'Goto',p2:0};for(let pc=base+1;pc<ops.length;pc++){const op=ops[pc]!;if(op.code==='Halt'){ends.push(pc);ops[pc]={code:'Goto',p2:0};}}
  const setup=ops.length;ops.push({code:'SorterOpen',p1:spool,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:0,keyFieldCount:0,terms:[]})});if(orderTree){const term=select.orderBy[0]!;ops.push({code:'SorterOpen',p1:outputSorter,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:1+indices.length,keyFieldCount:1,terms:[{collation:collation(orderTree),desc:term.descending,nullsLarge:term.nulls==='last'?!term.descending:term.nulls==='first'?term.descending:false}]})});}
  let registers=inner.registers,output=++registers;registers+=indices.length-1;const payload=++registers;registers+=inner.columns.length-1;const parameters:ParameterBuilder=owner?.parameters??{maximum:0,names:[],named:new Map()};const limit=computeLimitRegisters(select,ops,()=>++registers,parameters);ops.push(first,{code:'Goto',p2:base+1});(ops[base] as {p2:number}).p2=setup;const key=orderTree?++registers:0;const sort=ops.length;for(const end of ends)(ops[end] as {p2:number}).p2=sort;ops.push({code:'SorterSort',p1:spool,emptyJump:0},{code:'SorterData',p1:spool,p2:payload,count:inner.columns.length});
  const bind=(tree:Expression):Expression=>{if(tree.kind==='column'){const parts=tree.name.split('.').map(sqlName);if(parts.length>2||(parts.length===2&&(!alias||!sqliteIdentifierEqual(parts[0]!,alias))))throw new JSQLiteError('sqlite',`no such column: ${tree.name}`,{code:1});const index=names.findIndex(name=>sqliteIdentifierEqual(name,parts.at(-1)!));if(index<0)throw new JSQLiteError('sqlite',`no such column: ${tree.name}`,{code:1});return{kind:'register',index:payload+index}}if(tree.kind==='unary'||tree.kind==='cast'||tree.kind==='collate')return{...tree,value:bind(tree.value)};if(tree.kind==='binary')return{...tree,left:bind(tree.left),right:bind(tree.right)};if(tree.kind==='call')return{...tree,args:tree.args.map(bind)};if(tree.kind==='case')return{...tree,operand:tree.operand?bind(tree.operand):null,pairs:tree.pairs.map(([a,b])=>[bind(a),bind(b)]),otherwise:tree.otherwise?bind(tree.otherwise):null};return tree};
  let skip=-1;if(select.where?.reduction){const predicate=compileExpressionTree(bind(expressionFromReduction(select.where.reduction)),ops,()=>++registers,parameters);skip=ops.length;ops.push({code:'IfNot',p1:predicate,p2:0});}indices.forEach((index,result)=>ops.push({code:'Copy',p1:payload+index,p2:output+result}));if(orderTree){ops.push({code:'Copy',p1:payload+orderIndex,p2:key},{code:'SorterInsert',p1:outputSorter,keyStart:key,keyCount:1,payload:output,payloadCount:indices.length});}else{let offsetSkip:number|undefined;if(limit?.offset!==undefined){offsetSkip=ops.length;ops.push({code:'IfPos',p1:limit.offset,p2:0,p3:1});}emitSelectDestination(ops,owner?.destination??{kind:'output'},output,indices.length);if(limit)ops.push({code:'DecrJumpZero',p1:limit.count,p2:0});if(offsetSkip!==undefined)(ops[offsetSkip] as {p2:number}).p2=ops.length;}
  const next=ops.length;if(skip>=0)(ops[skip] as {p2:number}).p2=next;ops.push({code:'SorterNext',p1:spool,p2:sort+1});const outputDrain=ops.length;(ops[sort] as {emptyJump:number}).emptyJump=outputDrain;
  if(orderTree){const sorted=ops.length;ops.push({code:'SorterSort',p1:outputSorter,emptyJump:0},{code:'SorterData',p1:outputSorter,p2:output,count:indices.length});let offsetSkip:number|undefined;if(limit?.offset!==undefined){offsetSkip=ops.length;ops.push({code:'IfPos',p1:limit.offset,p2:0,p3:1});}emitSelectDestination(ops,owner?.destination??{kind:'output'},output,indices.length);if(limit)ops.push({code:'DecrJumpZero',p1:limit.count,p2:0});const advance=ops.length;if(offsetSkip!==undefined)(ops[offsetSkip] as {p2:number}).p2=advance;ops.push({code:'SorterNext',p1:outputSorter,p2:sorted+1});const halt=ops.length;(ops[sorted] as {emptyJump:number}).emptyJump=halt;if(!owner)ops.push({code:'Halt'});if(limit){(ops[limit.ifZero] as {p2:number}).p2=halt;for(const op of ops.slice(base))if(op.code==='DecrJumpZero'&&op.p1===limit.count&&op.p2===0)(op as {p2:number}).p2=halt;}}
  else{const halt=ops.length;if(!owner)ops.push({code:'Halt'});if(limit){(ops[limit.ifZero] as {p2:number}).p2=halt;for(const op of ops.slice(base))if(op.code==='DecrJumpZero'&&op.p1===limit.count&&op.p2===0)(op as {p2:number}).p2=halt;}}
  builder.registers=Math.max(builder.registers,registers);const columns=indices.map((index,result)=>Object.freeze({...inner.columns[index]!,name:(bareStar?names[index]:select.result[result]!.alias)??names[index]!}));return Object.freeze({ops:owner?ops:builder.finish(),registers,encoding:database.encoding,columns:Object.freeze(columns),parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits});
 }
 if(derived&&derived.index===0&&select.from.items.length===1&&!select.where&&!select.hasDistinct&&!select.hasGroupBy&&!select.hasHaving&&select.orderBy.length<=1){
  // The embedded table compiler currently admits scan directions and residual
  // predicates whose standalone lowering is not yet source-faithful. Do not
  // wrap those programs in a coroutine and publish their valid prefix as a
  // derived-table result. They remain atomic prepare-time exclusions until the
  // owning scan primitive is corrected.
  if(derived.select.from.items.length&&((select.hasOrderBy&&!derived.select.hasOrderBy&&!derived.select.where)||derived.select.orderBy.some(term=>term.descending)))
    throw new JSQLiteError("unsupported","this derived table scan shape is not implemented",{unsupportedClassification:"temporary"});
  // select.c tag-select-0482, single-source form. Compile the child into the
  // parent's coroutine destination rather than letting ordinary table lookup
  // interpret the parser's synthetic "(subquery)" source name.
  const values=derived.select.hasValues&&!derived.select.hasCompound&&!derived.select.where&&!derived.select.hasDistinct&&!derived.select.hasGroupBy&&!derived.select.hasHaving&&!selectHasWindow(derived.select)&&!derived.select.from.items.length?derived.select.arms[0]?.valuesRows:null;
  const valuesWidth=values?.[0]?.length;
  if(values&&(!valuesWidth||values.some(row=>row.length!==valuesWidth)))throw new JSQLiteError('sqlite','all VALUES must have the same number of terms',{code:1});
  // The admitted VALUES producer has not yet emitted a child Program. Its
  // descriptors are select.c:sqlite3ColumnsFromExprList's transient names;
  // the coroutine body below emits selectInnerLoop's rows into one destination.
  // select.c:sqlite3Select tag-select-0482 calls the ordered compound with an
  // SRT_Coroutine destination in the enclosing Vdbe. Admit only finite scalar
  // UNION ALL arms. The typed sorter is the existing documented
  // multiSelectByMerge adaptation; other producers keep their own path.
  // A represented zero-source SELECT has at most one candidate per arm;
  // DISTINCT is redundant there, never a compound-wide deduplication flag.
  // Do not extend this proof to multi-row VALUES or aggregate/group arms.
  const ordered=!values&&!derived.select.from.items.length&&derived.select.hasCompound&&derived.select.hasOrderBy&&derived.select.arms.length>1&&derived.select.arms.every((arm,index)=>(index===0||arm.operatorFromPrior==='union-all')&&!arm.from.items.length&&(!arm.hasDistinct||arm.origin==='select'&&!arm.valuesRows)&&!arm.hasGroupBy&&!arm.hasHaving&&arm.result.length>0&&(arm.valuesRows??[arm.result]).every(row=>row.length===arm.result.length&&row.every(result=>!!result.reduction)))&&!selectHasWindow(derived.select)&&!selectHasAggregate(derived.select)&&!derived.select.hasGroupBy&&!derived.select.hasHaving;
  const orderedWidth=ordered?derived.select.arms[0]!.result.length:0;
  if(ordered&&derived.select.arms.some(arm=>arm.result.length!==orderedWidth))throw new JSQLiteError('sqlite','SELECTs to the left and right of UNION ALL do not have the same number of result columns',{code:1});
  // select.c:multiSelect TK_ALL passes the same SRT_Coroutine to each
  // zero-source arm, sharing the compound LIMIT/OFFSET registers.
  // multiSelect TK_ALL delegates each grouped arm to its own sqlite3Select
  // accumulator owner; each GROUP/HAVING carrier belongs to that arm.
  const groupedAllProducer=derived.select.hasCompound&&!derived.select.hasOrderBy&&!selectHasWindow(derived.select)&&derived.select.arms.every((arm,index)=>
    (index===0||arm.operatorFromPrior==='union-all')&&arm.origin==='select'&&arm.from.items.length===1&&(!arm.hasGroupBy||!!arm.groupBy?.length&&arm.groupBy.every(expr=>!!expr.reduction))&&arm.result.every(expr=>!!expr.reduction)&&(!arm.hasHaving||!!arm.having?.reduction&&(arm.hasGroupBy||selectHasAggregate({...derived.select,result:arm.result,arms:Object.freeze([arm]),hasCompound:false})))&&(!arm.hasGroupBy||simpleGroupShape({...derived.select,result:arm.result,from:arm.from,where:arm.where,groupBy:arm.groupBy??Object.freeze([]),having:arm.having??null,hasGroupBy:arm.hasGroupBy,hasHaving:arm.hasHaving,arms:Object.freeze([arm]),hasCompound:false})))&&derived.select.arms.some(arm=>arm.hasGroupBy);
  const unionProducer=!values&&!ordered&&!derived.select.from.items.length&&derived.select.hasCompound&&!derived.select.hasOrderBy&&!selectHasWindow(derived.select)&&!derived.select.hasGroupBy&&derived.select.arms.length>1&&derived.select.arms.every((arm,index)=>(index===0||arm.operatorFromPrior==='union-all')&&!arm.from.items.length&&(!arm.hasDistinct||arm.origin==='select'&&!arm.valuesRows)&&!arm.hasGroupBy&&(!arm.hasHaving||!!arm.having?.reduction&&selectHasAggregate({...derived.select,result:arm.result,arms:Object.freeze([arm]),hasCompound:false}))&&arm.result.length>0&&(arm.valuesRows??[arm.result]).every(row=>row.length===arm.result.length&&row.every(result=>!!result.reduction)))&&derived.select.arms.every(arm=>arm.result.length===derived.select.arms[0]!.result.length);
  // select.c:multiSelectByMerge handles the set prefix; TK_ALL forwards its
  // destination and shared limit to subsequent arms in the enclosing Vdbe.
  const scalarSetArms=!values&&!ordered&&!derived.select.from.items.length&&derived.select.hasCompound&&(!derived.select.hasOrderBy||derived.select.orderBy.length===1&&derived.select.arms[0]!.result.length===1)&&!selectHasWindow(derived.select)&&!derived.select.hasGroupBy&&!derived.select.hasHaving&&derived.select.arms.length>1&&derived.select.arms.every(arm=>!arm.from.items.length&&(!arm.hasDistinct||arm.origin==='select'&&!arm.valuesRows)&&!arm.hasGroupBy&&!arm.hasHaving&&arm.result.length>0&&(arm.valuesRows??[arm.result]).every(row=>row.length===derived.select.arms[0]!.result.length&&row.every(result=>!!result.reduction))&&!selectHasAggregate({...derived.select,result:arm.result,arms:Object.freeze([arm]),hasCompound:false,hasOrderBy:false,orderBy:Object.freeze([])}));
  const setProducer=scalarSetArms&&derived.select.arms.slice(1).every(arm=>arm.operatorFromPrior==='union'||arm.operatorFromPrior==='except'||arm.operatorFromPrior==='intersect');
  // A UNION ALL prefix before a set operation is accumulated in the same set;
  // only the ALL tail after the final set operator streams without deduplication.
  const mixedProducer=scalarSetArms&&derived.select.arms.slice(1).every(arm=>arm.operatorFromPrior==='union-all'||arm.operatorFromPrior==='union'||arm.operatorFromPrior==='except'||arm.operatorFromPrior==='intersect')&&derived.select.arms.some(arm=>arm.operatorFromPrior==='union-all')&&derived.select.arms.some(arm=>arm.operatorFromPrior==='union'||arm.operatorFromPrior==='except'||arm.operatorFromPrior==='intersect');
  const setWidth=setProducer||mixedProducer?derived.select.arms[0]!.result.length:0;
  const nestedProducer=!values&&!ordered&&!derived.select.hasCompound&&!!derived.select.from.derived&&!derived.select.where&&!derived.select.hasDistinct&&!derived.select.hasGroupBy&&!derived.select.hasHaving&&!derived.select.hasOrderBy&&!selectHasWindow(derived.select)&&!selectHasAggregate(derived.select);
  const tableProducer=!nestedProducer&&!values&&!ordered&&derived.select.from.items.length>0&&!derived.select.hasCompound&&!derived.select.hasValues&&!selectHasWindow(derived.select)&&!selectHasAggregate(derived.select)&&!derived.select.hasGroupBy&&!derived.select.hasHaving;
  // select.c tag-select-0482: the zero-source row feeds the enclosing SRT_Coroutine.
  // A zero-FROM scalar produces at most one row. Resolve the ORDER expression
  // in its NameContext even though no comparison/sorter is needed at runtime.
  // An ungrouped accumulator has one output candidate; all ORDER terms resolve
  // in AggInfo, but none require a result sorter (select.c:sqlite3Select).
  const scalarProducer=!values&&!ordered&&!derived.select.from.items.length&&!derived.select.hasCompound&&!derived.select.hasValues&&!selectHasWindow(derived.select)&&!selectHasAggregate(derived.select)&&!derived.select.hasGroupBy&&!derived.select.hasHaving&&derived.select.result.length>0&&derived.select.result.every(result=>!!result.reduction);
  // resolve.c validates ORDER BY names/ordinals even though a zero-source
  // selectInnerLoop has just one candidate and needs no physical sorter.
  if(scalarProducer){try{expandAndResolveSelect(derived.select,schema)}catch(error){if(error instanceof NameResolutionError)throw new JSQLiteError('sqlite',error.message,{code:1});throw error;}}
  const aggregateProducer=!values&&!ordered&&!derived.select.hasCompound&&!derived.select.hasValues&&!selectHasWindow(derived.select)&&(selectHasAggregate(derived.select)||derived.select.hasGroupBy)&&(!derived.select.hasGroupBy||simpleGroupShape(derived.select))&&derived.select.result.length>0&&derived.select.result.every(result=>!!result.reduction);
  // select.c:sqlite3Select aggregate accumulator and SRT_Coroutine share the
  // enclosing Vdbe. Do not compile an aggregate through scalar expression lowering.

  // multiSelect table arms retain their typed set/order transition, but use
  // this Parse's SRT_Coroutine rather than publishing and relocating a child.
  const tableCompoundProducer=!groupedAllProducer&&derived.select.hasCompound&&derived.select.arms.every(arm=>!arm.from.derived&&!arm.from.cteDerived?.length&&arm.from.items.length===1&&arm.where===null&&arm.result.length===1&&arm.origin==='select');
  // Bounded physical joined first arm plus zero-source scalar tails. These
  // arms are already owned by the ordered ALL composer, now in this Parse.
  const joinedOrderedAllProducer=derived.select.hasCompound&&derived.select.hasOrderBy&&!derived.select.limit&&!derived.select.offset&&!selectHasWindow(derived.select)&&derived.select.arms[0]!.from.items.length>1&&derived.select.arms.every((arm,index)=>!arm.from.derived&&!arm.hasGroupBy&&!arm.hasHaving&&(index===0||arm.operatorFromPrior==='union-all'&&!arm.from.items.length)&&arm.result.length===1&&arm.result.every(result=>!!result.reduction))&&derived.select.orderBy.every(term=>{if(!term.expr.reduction)return false;const tree=expressionFromReduction(term.expr.reduction);return tree.kind==='literal'&&tree.value===1n;});
  // multiSelect TK_ALL: ordinary physical and zero-source SELECT arms share
  // this Parse and destination. Keep CTE/VALUES/group/aggregate owners separate.
  const mixedPhysicalAllProducer=derived.select.hasCompound&&!derived.select.hasOrderBy&&!selectHasWindow(derived.select)&&derived.select.arms.some(arm=>arm.from.items.length>0)&&derived.select.arms.some(arm=>!arm.from.items.length)&&derived.select.arms.every((arm,index)=>(index===0||arm.operatorFromPrior==='union-all')&&arm.origin==='select'&&!arm.valuesRows&&!arm.from.derived&&!arm.from.cteDerived?.length&&!arm.hasGroupBy&&!arm.hasHaving&&arm.result.every(result=>!!result.reduction)&&!selectHasAggregate({...derived.select,result:arm.result,from:arm.from,arms:Object.freeze([arm]),hasCompound:false}));
  let mixedPhysicalPlan:ReturnType<typeof expandAndResolveSelect>|undefined;
  if(mixedPhysicalAllProducer){const last=derived.select.arms.at(-1)!;try{mixedPhysicalPlan=expandAndResolveSelect({...derived.select,result:last.result,from:last.from,where:last.where,hasCompound:false,arms:Object.freeze([last]),hasOrderBy:false,orderBy:Object.freeze([])},schema)}catch(error){if(error instanceof NameResolutionError)throw new JSQLiteError('sqlite',error.message,{code:1});throw error;}}
  let joinedOrderedPlan:ReturnType<typeof expandAndResolveSelect>|undefined;
  if(joinedOrderedAllProducer){const first=derived.select.arms[0]!;try{joinedOrderedPlan=expandAndResolveSelect({...derived.select,result:first.result,from:first.from,where:first.where,hasCompound:false,arms:Object.freeze([first]),hasOrderBy:false,orderBy:Object.freeze([])},schema)}catch(error){if(error instanceof NameResolutionError)throw new JSQLiteError('sqlite',error.message,{code:1});throw error;}}
  let tableCompoundPlan:ReturnType<typeof expandAndResolveSelect>|undefined;
  if(tableCompoundProducer||groupedAllProducer){const first=derived.select.arms[derived.select.arms.length-1]!;try{tableCompoundPlan=expandAndResolveSelect({...derived.select,result:first.result,from:first.from,where:first.where,hasGroupBy:first.hasGroupBy,groupBy:first.groupBy??Object.freeze([]),hasHaving:first.hasHaving,having:first.having??null,hasCompound:false,arms:Object.freeze([first]),hasOrderBy:false,orderBy:Object.freeze([])},schema)}catch(error){if(error instanceof NameResolutionError)throw new JSQLiteError('sqlite',error.message,{code:1});throw error;}}
  let tablePlan:ReturnType<typeof expandAndResolveSelect>|undefined;
  if(tableProducer){try{tablePlan=expandAndResolveSelect(derived.select,schema,null,owner?.builder.cursors??0)}catch(error){if(error instanceof NameResolutionError)throw new JSQLiteError('sqlite',error.message,{code:1});throw error;}}
  const orderedAggregateProducer=derived.select.hasCompound&&selectHasAggregate(derived.select)&&derived.select.hasOrderBy;
  let orderedAggregateColumns:Program['columns']|undefined;
  if(orderedAggregateProducer){
    const first=derived.select.arms[0]!;
    try{orderedAggregateColumns=expandAndResolveSelect({...derived.select,result:first.result,from:first.from,where:first.where,hasCompound:false,hasOrderBy:false,orderBy:Object.freeze([]),arms:Object.freeze([first])},schema).result.map(result=>Object.freeze({name:result.name,declaredType:result.descriptor.declaredType,database:result.descriptor.database,table:result.descriptor.table,origin:result.descriptor.origin}));}catch(error){if(error instanceof NameResolutionError)throw new JSQLiteError('sqlite',error.message,{code:1});throw error;}
  }
  // Residual represented compound arms consume the production multiSelect
  // dispatch and resolver descriptors. Nested derived and window contexts
  // retain their unresolved specialized ownership; never infer schema tables.
  const compoundDestinationProducer=derived.select.hasCompound&&!orderedAggregateProducer&&!values&&!ordered&&!setProducer&&!mixedProducer&&!tableCompoundPlan&&!mixedPhysicalPlan&&!joinedOrderedPlan&&!unionProducer&&!groupedAllProducer&&derived.select.arms.every(arm=>{
    const isolated={...derived.select,result:arm.result,from:arm.from,where:arm.where,hasCompound:false,arms:Object.freeze([arm])} as SelectNode;
    const from=flattenOrdinaryDerived(isolated).from;
    return !from.derived||!!from.cteDerived?.length||from.items.length===1;
  });
  let residualCompoundColumns:Program['columns']|undefined;
  if(compoundDestinationProducer){
    // Producer payload width is independent of parent projection width.
    // columnTypeImpl follows current EList; transient names remain leftmost.
    const armNode=(arm:typeof derived.select.arms[number]):SelectNode=>({...derived.select,result:arm.result,from:arm.from,where:arm.where,hasCompound:false,hasOrderBy:false,orderBy:Object.freeze([]),arms:Object.freeze([arm])});
    const names=compoundArmColumns(armNode(derived.select.arms[0]!),schema);
    const current=compoundArmColumns(armNode(derived.select.arms.at(-1)!),schema);
    residualCompoundColumns=current.map((column,index)=>Object.freeze({...column,name:names[index]!.name}));
  }
  const inner=nestedProducer?{columns:compoundArmColumns(derived.select,schema),registers:0,parameters:[] as {name:string|null}[]}:residualCompoundColumns?{columns:residualCompoundColumns,registers:0,parameters:[] as {name:string|null}[]}:orderedAggregateColumns?{columns:orderedAggregateColumns,registers:0,parameters:[] as {name:string|null}[]}:values?{columns:values[0]!.map((_,index)=>({name:`column${index+1}`,declaredType:null,database:null,table:null,origin:null})),registers:0,parameters:[] as {name:string|null}[]}:ordered?{columns:derived.select.arms[0]!.result.map(result=>({name:expressionName(result),declaredType:null,database:null,table:null,origin:null})),registers:0,parameters:[] as {name:string|null}[]}:setProducer||mixedProducer?{columns:derived.select.arms[0]!.result.map(result=>({name:expressionName(result),declaredType:null,database:null,table:null,origin:null})),registers:0,parameters:[] as {name:string|null}[]}:tableCompoundPlan?{columns:tableCompoundPlan.result.map((result,index)=>({name:expressionName(derived.select.arms[0]!.result[index]!),declaredType:result.descriptor.declaredType,database:result.descriptor.database,table:result.descriptor.table,origin:result.descriptor.origin})),registers:0,parameters:[] as {name:string|null}[]}:mixedPhysicalPlan?{columns:mixedPhysicalPlan.result.map((result,index)=>({name:expressionName(derived.select.arms[0]!.result[index]!),declaredType:result.descriptor.declaredType,database:result.descriptor.database,table:result.descriptor.table,origin:result.descriptor.origin})),registers:0,parameters:[] as {name:string|null}[]}:joinedOrderedPlan?{columns:joinedOrderedPlan.result.map(result=>({name:result.name,declaredType:result.descriptor.declaredType,database:result.descriptor.database,table:result.descriptor.table,origin:result.descriptor.origin})),registers:0,parameters:[] as {name:string|null}[]}:tablePlan?{columns:tablePlan.result.map(result=>({name:result.name,declaredType:result.descriptor.declaredType,database:result.descriptor.database,table:result.descriptor.table,origin:result.descriptor.origin})),registers:0,parameters:[] as {name:string|null}[]}:unionProducer||groupedAllProducer?{columns:derived.select.arms[0]!.result.map((result,index)=>({name:derived.select.arms[0]!.origin==='values'?`column${index+1}`:expressionName(result),declaredType:null,database:null,table:null,origin:null})),registers:0,parameters:[] as {name:string|null}[]}:scalarProducer||aggregateProducer?{columns:derived.select.result.map(result=>({name:expressionName(result),declaredType:null,database:null,table:null,origin:null})),registers:0,parameters:[] as {name:string|null}[]}:{columns:compoundArmColumns(derived.select,schema),registers:0,parameters:[] as {name:string|null}[]};
  const alias=select.from.items[0]!.alias,firstNames=owner?.scalarRetained&&derived.select.hasCompound?compoundArmColumns({...derived.select,result:derived.select.arms[0]!.result,from:derived.select.arms[0]!.from,where:derived.select.arms[0]!.where,hasCompound:false,hasGroupBy:derived.select.arms[0]!.hasGroupBy,groupBy:derived.select.arms[0]!.groupBy??Object.freeze([]),hasHaving:derived.select.arms[0]!.hasHaving,having:derived.select.arms[0]!.having??null,hasOrderBy:false,orderBy:Object.freeze([]),arms:Object.freeze([derived.select.arms[0]!])},schema).map(column=>column.name):derived.select.result.map((expression,index)=>expression.alias??inner.columns[index]?.name??`column${index+1}`),names=uniqueTransientColumnNames(firstNames);
  const bareStar=select.result.length===1&&select.result[0]!.tokens.length===1&&select.result[0]!.tokens[0]!.text==='*';
  const indices=bareStar?inner.columns.map((_,index)=>index):select.result.map(expression=>{if(!expression.reduction)return -1;let tree=expressionFromReduction(expression.reduction);while(tree.kind==='collate')tree=tree.value;if(tree.kind!=='column')return -1;const parts=tree.name.split('.').map(sqlName);if(parts.length>2||(parts.length===2&&(!alias||!sqliteIdentifierEqual(parts[0]!,alias))))return -1;return names.findIndex(name=>sqliteIdentifierEqual(name,parts.at(-1)!));});if(indices.some(index=>index<0)){
    // Resolve expressions in the transient NameContext before capability rejection.
    // A valid non-column expression is not a missing identifier.
    resolveTransientArm(select,schema);
    if(values||ordered||setProducer||mixedProducer||tableCompoundPlan||tablePlan||scalarProducer||unionProducer||aggregateProducer)throw new JSQLiteError('unsupported','retained derived parent expression destination is not implemented',{unsupportedClassification:'temporary'});
    return undefined;
  }
  // resolve.c:resolveOrderGroupBy resolves aliases/ordinals through the
  // parent's EList, then source columns through its NameContext. The sorter
  // key is owned by the complete coroutine row, not the visible projection.
  let orderIndex=-1;
  if(select.hasOrderBy){
    const term=select.orderBy[0]!;
    let tree=expressionFromReduction(term.expr.reduction!);
    while(tree.kind==='collate')tree=tree.value;
    if(tree.kind==='literal'&&typeof tree.value==='bigint'&&tree.value>=1n&&tree.value<=BigInt(indices.length)){
      orderIndex=indices[Number(tree.value)-1]!;
    }else if(tree.kind==='column'){
      const parts=tree.name.split('.').map(sqlName);
      if(parts.length===1){
        const resultIndex=select.result.findIndex(result=>result.alias!=null&&sqliteIdentifierEqual(result.alias,parts[0]!));
        orderIndex=resultIndex>=0?indices[resultIndex]!:names.findIndex(name=>sqliteIdentifierEqual(name,parts[0]!));
      }else if(parts.length===2&&alias&&sqliteIdentifierEqual(parts[0]!,alias)){
        orderIndex=names.findIndex(name=>sqliteIdentifierEqual(name,parts[1]!));
      }
    }
    if(orderIndex<0||term.nulls!==null)return undefined;
  }
  // select.c:multiSelectValues supplies the same coroutine destination to
  // every VALUES term. Other retained producers likewise receive the shared
  // coroutine destination instead of a finished-child register/PC copy.
  const builder=owner?.builder??new SelectProgramBuilder<Op>();
  builder.registers=Math.max(builder.registers,inner.registers);
  const producerOutput=builder.range(inner.columns.length),returnRegister=builder.register(),sorterCursor=Math.max(40,builder.cursors);
  const ops=builder.ops,parameters:ParameterBuilder=owner?.parameters??{maximum:inner.parameters.length,names:inner.parameters.map(parameter=>parameter.name),named:new Map()};
  inner.parameters.forEach((parameter,index)=>{if(parameter.name!==null)parameters.named.set(parameter.name,index+1)});
  const init=ops.length;
  ops.push({code:'InitCoroutine',p1:returnRegister,p2:0,p3:0});
  const producerBase=ops.length,endJumps:number[]=[];
  if(values){
    const producerDest:SelectDest={kind:'coroutine',register:returnRegister,first:producerOutput};
    compileScalarSelect(derived.select,database.encoding,maxWorkUnits,maxResultBytes,privateStateLimits,schema,database,maxRows,{builder,parameters,emitRow:(first,count)=>emitSelectDestination(ops,producerDest,first,count)});
    endJumps.push(ops.length);ops.push({code:'EndCoroutine',p1:returnRegister,p2:0});
  }else if(setProducer||mixedProducer||ordered){
    emitScalarCompoundMerge(derived.select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,builder,parameters,{kind:'coroutine',register:returnRegister,first:producerOutput});
    endJumps.push(ops.length);ops.push({code:'EndCoroutine',p1:returnRegister,p2:0});
  }else if(unionProducer||groupedAllProducer){
    // resolve.c validates all arms before any coroutine op can be stepped.
    for(const arm of derived.select.arms){try{expandAndResolveSelect({...derived.select,result:arm.result,from:arm.from,where:arm.where,groupBy:arm.groupBy??Object.freeze([]),hasGroupBy:arm.hasGroupBy,having:arm.having??null,hasHaving:arm.hasHaving,arms:Object.freeze([arm]),hasCompound:false,hasValues:arm.origin==='values',hasOrderBy:false,orderBy:Object.freeze([])} as SelectNode,schema)}catch(error){if(error instanceof NameResolutionError)throw new JSQLiteError('sqlite',error.message,{code:1});throw error;}}
    // multiSelect TK_ALL: the shared LIMIT is initialized before the first
    // arm; OFFSET counts candidate rows before the common destination.
    const child=derived.select,dest:SelectDest={kind:'coroutine',register:returnRegister,first:producerOutput};
    const limit=computeLimitRegisters(child,ops,()=>builder.register(),parameters);
    const stops:number[]=[];
    for(const arm of child.arms){
      const armSelect={...child,result:arm.result,from:arm.from,where:arm.where,hasDistinct:arm.hasDistinct,hasGroupBy:arm.hasGroupBy,groupBy:arm.groupBy??Object.freeze([]),hasHaving:arm.hasHaving,having:arm.having??null,arms:Object.freeze([arm]),hasCompound:false,hasValues:arm.origin==='values',hasOrderBy:false,orderBy:Object.freeze([]),hasLimit:false,limit:null,offset:null} as SelectNode;
      if(armSelect.hasGroupBy||selectHasAggregate(armSelect)){
        // multiSelect TK_ALL: each accumulator owns WHERE (including the
        // empty-input count row), then forwards its output to shared limits.
        compileAggregateSelect(armSelect,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{builder,ops,parameters,destination:dest,compoundLimit:{registers:limit,stops}});
        continue;
      }
      if(groupedAllProducer){
        let plan:ReturnType<typeof expandAndResolveSelect>;
        try{plan=expandAndResolveSelect(armSelect,schema)}catch(error){if(error instanceof NameResolutionError)throw new JSQLiteError('sqlite',error.message,{code:1});throw error;}
        compileInnerTableSelect(armSelect,plan,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{builder,ops,parameters,destination:dest,compoundLimit:{registers:limit,stops}});
        continue;
      }
      if(arm.origin==='select'&&!arm.valuesRows){
        compileScalarSelect(armSelect,database.encoding,maxWorkUnits,maxResultBytes,privateStateLimits,schema,database,maxRows,{builder,parameters,emitRow:(first,count)=>{
          let skip=-1;
          if(limit?.offset!==undefined){skip=ops.length;ops.push({code:'IfPos',p1:limit.offset,p2:0,p3:1});}
          emitSelectDestination(ops,dest,first,count);
          if(limit){stops.push(ops.length);ops.push({code:'DecrJumpZero',p1:limit.count,p2:0});}
          if(skip>=0)(ops[skip] as {p2:number}).p2=ops.length;
        }});
        continue;
      }
      // multiSelectValues visits each VALUES EList in source order and
      // invokes selectInnerLoop on each one-row node. The shared scalar
      // owner supplies that expression/destination body, not a separate evaluator.
      for(const expressions of arm.valuesRows??[arm.result]){
        const rowSelect={...armSelect,result:expressions,hasValues:false,arms:Object.freeze([{...arm,result:expressions,origin:'select' as const,valuesRows:null}])};
        compileScalarSelect(rowSelect,database.encoding,maxWorkUnits,maxResultBytes,privateStateLimits,schema,database,maxRows,{builder,parameters,emitRow:(first,count)=>{
          let skip=-1;
          if(limit?.offset!==undefined){skip=ops.length;ops.push({code:'IfPos',p1:limit.offset,p2:0,p3:1});}
          emitSelectDestination(ops,dest,first,count);
          if(limit){stops.push(ops.length);ops.push({code:'DecrJumpZero',p1:limit.count,p2:0});}
          if(skip>=0)(ops[skip] as {p2:number}).p2=ops.length;
        }});
      }
    }
    const end=ops.length;endJumps.push(end);ops.push({code:'EndCoroutine',p1:returnRegister,p2:0});
    if(limit){(ops[limit.ifZero] as {p2:number}).p2=end;for(const stop of stops)(ops[stop] as {p2:number}).p2=end;}
  }else if(scalarProducer){
    // select.c tag-select-0482 composes child sqlite3Select with SRT_Coroutine;
    // expr.c owns nested result/predicate subqueries on that same builder.
    compileScalarSelect(derived.select,database.encoding,maxWorkUnits,maxResultBytes,privateStateLimits,schema,database,maxRows,{builder,parameters,emitRow:(first,count)=>emitSelectDestination(ops,{kind:'coroutine',register:returnRegister,first:producerOutput},first,count)});
    endJumps.push(ops.length);ops.push({code:'EndCoroutine',p1:returnRegister,p2:0});
  }else if(aggregateProducer){
    compileAggregateSelect(derived.select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{builder,ops,parameters,destination:{kind:'coroutine',register:returnRegister,first:producerOutput}});
    endJumps.push(ops.length);ops.push({code:'EndCoroutine',p1:returnRegister,p2:0});
  }else if(nestedProducer){
    // select.c tag-select-0482 recursively emits retained SrcItem SELECTs
    // into the same Parse/Vdbe; each coroutine keeps its own SQL limit.
    const produced=compileDerivedProducer(derived.select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{builder,parameters,destination:{kind:'coroutine',register:returnRegister,first:producerOutput},scalarRetained:true});
    if(!produced)throw new JSQLiteError('unsupported','nested retained producer destination is not implemented',{unsupportedClassification:'temporary'});
    endJumps.push(ops.length);ops.push({code:'EndCoroutine',p1:returnRegister,p2:0});
  }else if(tableProducer){
    // select.c tag-select-0482 calls sqlite3Select(pSub,&dest) while the
    // enclosing Parse/Vdbe owns coroutine return and result registers.
    // compileInnerTableSelect owns the source scan, LIMIT and empty exits;
    // its iBreak falls through to EndCoroutine rather than OP_Halt.
    builder.reserveCursorsThrough(sorterCursor);
    compileInnerTableSelect(derived.select,tablePlan!,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{builder,ops,parameters,destination:{kind:'coroutine',register:returnRegister,first:producerOutput}});
    endJumps.push(ops.length);ops.push({code:'EndCoroutine',p1:returnRegister,p2:0});
  }else if(mixedPhysicalAllProducer){
    builder.reserveCursorsThrough(sorterCursor);
    const produced=compileCteUnionAll(derived.select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{builder,parameters,destination:{kind:'coroutine',register:returnRegister,first:producerOutput}});
    if(!produced)throw new JSQLiteError('unsupported','unrepresented mixed physical ALL producer',{unsupportedClassification:'temporary'});
    endJumps.push(ops.length);ops.push({code:'EndCoroutine',p1:returnRegister,p2:0});
  }else if(joinedOrderedAllProducer){
    builder.reserveCursorsThrough(sorterCursor);
    const produced=compileOrderedCteUnionAll(derived.select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{builder,parameters,destination:{kind:'coroutine',register:returnRegister,first:producerOutput}});
    if(!produced)throw new JSQLiteError('unsupported','unrepresented joined ordered ALL producer',{unsupportedClassification:'temporary'});
    endJumps.push(ops.length);ops.push({code:'EndCoroutine',p1:returnRegister,p2:0});
  }else if(orderedAggregateProducer){
    builder.reserveCursorsThrough(sorterCursor);
    compileAggregateSelect(derived.select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{builder,ops,parameters,destination:{kind:'coroutine',register:returnRegister,first:producerOutput}});
    endJumps.push(ops.length);ops.push({code:'EndCoroutine',p1:returnRegister,p2:0});
  }else if(tableCompoundProducer){
    builder.reserveCursorsThrough(sorterCursor);
    compileSimpleTableCompound(derived.select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{builder,parameters,destination:{kind:'coroutine',register:returnRegister,first:producerOutput}});
    endJumps.push(ops.length);ops.push({code:'EndCoroutine',p1:returnRegister,p2:0});
  }else if(compoundDestinationProducer){
    builder.reserveCursorsThrough(sorterCursor);
    compileTableCompoundProducer(derived.select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{builder,parameters,destination:{kind:'coroutine',register:returnRegister,first:producerOutput}});
    endJumps.push(ops.length);ops.push({code:'EndCoroutine',p1:returnRegister,p2:0});
  }else{
    // select.c sqlite3Select dispatches semantic SELECT owners on the same
    // Parse/Vdbe. Metadata is resolved above; never compile a completed child
    // merely to relocate its control-flow targets into this coroutine.
    const child=derived.select,destination:SelectDest={kind:'coroutine',register:returnRegister,first:producerOutput};
    if(child.hasCompound){
      if(child.arms.every(arm=>!arm.from.items.length&&!arm.where&&!arm.hasDistinct&&!arm.hasGroupBy&&!arm.hasHaving)&&!selectHasWindow(child)&&!selectHasAggregate(child)){
        emitScalarCompoundMerge(child,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,builder,parameters,destination);
      }else compileTableCompoundProducer(child,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{builder,parameters,destination});
    }else if(selectHasAggregate(child)||child.hasGroupBy){
      compileAggregateSelect(child,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{builder,ops,parameters,destination});
    }else if(child.from.items.length){
      const plan=resolveTransientArm(child,schema);
      compileInnerTableSelect(child,plan,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{builder,ops,parameters,destination});
    }else compileScalarSelect(child,database.encoding,maxWorkUnits,maxResultBytes,privateStateLimits,schema,database,maxRows,{builder,parameters,emitRow:(first,count)=>emitSelectDestination(ops,destination,first,count)});
    endJumps.push(ops.length);ops.push({code:'EndCoroutine',p1:returnRegister,p2:0});
  }
  const consumer=ops.length;(ops[init] as {p2:number}).p2=consumer;(ops[init] as {p3:number}).p3=producerBase;
  let registers=builder.registers;const allocate=()=>++registers,limit=computeLimitRegisters(select,ops,allocate,parameters),output=allocate();registers+=indices.length-1;const key=allocate();
  if(select.hasOrderBy)ops.push({code:'SorterOpen',p1:sorterCursor,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:1,keyFieldCount:1,terms:[{collation:'binary',desc:select.orderBy[0]!.descending}]})});const resume=ops.length;ops.push({code:'Yield',p1:returnRegister,p2:0});indices.forEach((index,result)=>ops.push({code:'Copy',p1:producerOutput+index,p2:output+result}));if(select.hasOrderBy){ops.push({code:'Copy',p1:producerOutput+orderIndex,p2:key},{code:'SorterInsert',p1:sorterCursor,keyStart:key,keyCount:1,payload:output,payloadCount:indices.length},{code:'Goto',p2:resume});const sort=ops.length;for(const at of endJumps)(ops[at] as {p2:number}).p2=sort;ops.push({code:'SorterSort',p1:sorterCursor,emptyJump:0},{code:'SorterData',p1:sorterCursor,p2:output,count:indices.length});const emit=ops.length;if(limit?.offset!==undefined)ops.push({code:'IfPos',p1:limit.offset,p2:emit+3,p3:1});if(owner?.emitRow)owner.emitRow(output,indices.length);else emitSelectDestination(ops,owner?.destination??{kind:'output'},output,indices.length);let limitBreak:number|undefined;if(limit){limitBreak=ops.length;ops.push({code:'DecrJumpZero',p1:limit.count,p2:0});}ops.push({code:'SorterNext',p1:sorterCursor,p2:sort+1});const halt=ops.length;if(!owner)ops.push({code:'Halt'});(ops[sort] as {emptyJump:number}).emptyJump=halt;if(limit){(ops[limit.ifZero] as {p2:number}).p2=halt;(ops[limitBreak!] as {p2:number}).p2=halt;}}else{const emit=ops.length;const offsetSkip=limit?.offset!==undefined?ops.length:-1;if(offsetSkip>=0)ops.push({code:'IfPos',p1:limit!.offset!,p2:0,p3:1});if(owner?.emitRow)owner.emitRow(output,indices.length);else emitSelectDestination(ops,owner?.destination??{kind:'output'},output,indices.length);let limitBreak:number|undefined;if(limit){limitBreak=ops.length;ops.push({code:'DecrJumpZero',p1:limit.count,p2:0});}if(offsetSkip>=0)(ops[offsetSkip] as {p2:number}).p2=ops.length;ops.push({code:'Goto',p2:resume});const halt=ops.length;for(const at of endJumps)(ops[at] as {p2:number}).p2=halt;if(!owner)ops.push({code:'Halt'});if(limit){(ops[limit.ifZero] as {p2:number}).p2=halt;(ops[limitBreak!] as {p2:number}).p2=halt;}}
  builder.registers=Math.max(builder.registers,registers);
  builder.registers=Math.max(builder.registers,registers);const columns=indices.map((index,result)=>Object.freeze({...inner.columns[index]!,name:(bareStar?names[index]:select.result[result]!.alias)??names[index]!}));return Object.freeze({ops:owner?ops:builder.finish(),registers,encoding:database.encoding,columns:Object.freeze(columns),parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits});
 }
 if(derived&&derived.index===0&&select.from.items.length===2&&!select.where&&!select.hasDistinct&&!select.hasGroupBy&&!select.hasHaving&&select.orderBy.length<=1){
  // select.c tag-select-0488 emits the materialized child into the enclosing
  // Vdbe destination before the following join source is opened.
  const outerItem=select.from.items[1]!,outer=schema.findTable(sqlName(outerItem.tableName));if(!outer)return undefined;
  const inner={columns:compoundArmColumns(derived.select,schema)};
  const derivedItem=select.from.items[0]!,derivedAlias=derivedItem.alias??derivedItem.tableName,outerAlias=outerItem.alias??outer.name,names=uniqueTransientColumnNames(derived.select.result.map((expression,index)=>expression.alias??inner.columns[index]?.name??`column${index+1}`));
  const builder=owner?.builder??new SelectProgramBuilder<Op>(),ops=builder.ops,parameters:ParameterBuilder=owner?.parameters??{maximum:0,names:[],named:new Map()};
  // Preserve physical scan cursor identities until their WHERE callers own
  // nTab allocation. Materialization and parent cursors are builder-owned.
  builder.reserveCursorsThrough(30);
  const spool=builder.cursor(),outputSorter=builder.cursor(),outerCursor=builder.cursor();
  ops.push({code:'SorterOpen',p1:spool,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:0,keyFieldCount:0,terms:[]})});
  const child=derived.select,destination:SelectDest={kind:'sorter',cursor:spool,keyCount:0};
  if(child.hasCompound)compileTableCompoundProducer(child,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{builder,parameters,destination});
  else if(selectHasWindow(child))compileWindowSelectLowering(resolveTransientArm(child,schema),database.encoding,database,maxWorkUnits,maxResultBytes,privateStateLimits,schema,undefined,{builder,parameters,destination});
  else if(selectHasAggregate(child)||child.hasGroupBy||child.hasHaving)compileAggregateSelect(child,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{builder,ops,parameters,destination});
  else if(child.from.items.length)compileInnerTableSelect(child,resolveTransientArm(child,schema),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{builder,ops,parameters,destination});
  else compileScalarSelect(child,database.encoding,maxWorkUnits,maxResultBytes,privateStateLimits,schema,database,maxRows,{builder,parameters,emitRow:(first,count)=>emitSelectDestination(ops,destination,first,count)});
  const payload=builder.range(inner.columns.length),allocate=()=>builder.register();
  const bind=(tree:Expression):Expression=>{if(tree.kind==='column'){const parts=tree.name.split('.').map(sqlName),name=parts.at(-1)!,qualifier=parts.length>1?parts.at(-2):undefined;const derivedColumn=(!qualifier||sqliteIdentifierEqual(qualifier,derivedAlias))?names.findIndex(candidate=>sqliteIdentifierEqual(candidate,name)):-1;const outerColumn=(!qualifier||sqliteIdentifierEqual(qualifier,outerAlias))?outer.columns.findIndex(column=>sqliteIdentifierEqual(column.name,name)):-1;if(derivedColumn>=0&&outerColumn>=0&&!qualifier)throw new JSQLiteError('sqlite',`ambiguous column name: ${tree.name}`,{code:1});if(derivedColumn>=0)return{kind:'register',index:payload+derivedColumn};if(outerColumn>=0){const column=outer.columns[outerColumn]!,index=isIntegerPrimaryKeyAlias(outer,outerColumn)?-1:outerColumn,named=index<0?'binary':sqliteAsciiFold(column.collation??'binary');if(named!=='binary'&&named!=='nocase'&&named!=='rtrim')throw new JSQLiteError('sqlite',`no such collation sequence: ${named}`,{code:1});return{...tree,cursor:outerCursor,index,affinity:index<0?'integer':affinityOf(column.declaredType??''),collation:named};}throw new JSQLiteError('sqlite',`no such column: ${tree.name}`,{code:1});}if(tree.kind==='unary'||tree.kind==='cast'||tree.kind==='collate')return{...tree,value:bind(tree.value)};if(tree.kind==='binary')return{...tree,left:bind(tree.left),right:bind(tree.right)};if(tree.kind==='call')return{...tree,args:tree.args.map(bind)};if(tree.kind==='case')return{...tree,operand:tree.operand?bind(tree.operand):null,pairs:tree.pairs.map(([a,b])=>[bind(a),bind(b)]),otherwise:tree.otherwise?bind(tree.otherwise):null};return tree};
  const results=select.result.map(expression=>expression.reduction?bind(expressionFromReduction(expression.reduction)):null);if(results.some(expression=>!expression))return undefined;const order=select.orderBy[0],orderTree=order?.expr.reduction?bind(expressionFromReduction(order.expr.reduction)):undefined;if(orderTree)ops.push({code:'SorterOpen',p1:outputSorter,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:1,keyFieldCount:1,terms:[{collation:collation(orderTree),desc:order!.descending,nullsLarge:order!.nulls==='last'?!order!.descending:order!.nulls==='first'?order!.descending:false}]})});
  // select.c computeLimitRegisters precedes row production; OFFSET and
  // count apply at final output, after sorter extraction when ordered.
  const parentLimit=computeLimitRegisters(select,ops,allocate,parameters),limitStops:number[]=[];
  const emitParentRow=(continueAt?:number)=>{
   let offsetAt:number|undefined;if(parentLimit?.offset!==undefined){offsetAt=ops.length;ops.push({code:'IfPos',p1:parentLimit.offset,p2:continueAt??0,p3:1});}
   emitSelectDestination(ops,owner?.destination??{kind:'output'},output,results.length);
   if(parentLimit){limitStops.push(ops.length);ops.push({code:'DecrJumpZero',p1:parentLimit.count,p2:0});}
   if(offsetAt!==undefined&&continueAt===undefined)(ops[offsetAt] as {p2:number}).p2=ops.length;
  };
  const sort=ops.length;ops.push({code:'SorterSort',p1:spool,emptyJump:0},{code:'SorterData',p1:spool,p2:payload,count:inner.columns.length},{code:'OpenRead',p1:outer.rootPage,p2:outerCursor});const rewind=ops.length;ops.push({code:'Rewind',p1:outerCursor,p2:0});const loop=ops.length;let predicateSkip:number|undefined;if(outerItem.on?.reduction){const predicate=compileExpressionTree(bind(expressionFromReduction(outerItem.on.reduction)),ops,allocate,parameters);predicateSkip=ops.length;ops.push({code:'IfNot',p1:predicate,p2:0});}
  const output=builder.range(results.length);results.forEach((expression,index)=>{const value=compileExpressionTree(expression!,ops,allocate,parameters);ops.push({code:'Copy',p1:value,p2:output+index});});if(orderTree){const key=allocate(),value=compileExpressionTree(orderTree,ops,allocate,parameters);ops.push({code:'Copy',p1:value,p2:key},{code:'SorterInsert',p1:outputSorter,keyStart:key,keyCount:1,payload:output,payloadCount:results.length});}else emitParentRow();const next=ops.length;ops.push({code:'Next',p1:outerCursor,p2:loop});(ops[rewind] as {p2:number}).p2=ops.length;if(predicateSkip!==undefined)(ops[predicateSkip] as {p2:number}).p2=next;ops.push({code:'SorterNext',p1:spool,p2:sort+1});(ops[sort] as {emptyJump:number}).emptyJump=ops.length;if(orderTree){const outputSort=ops.length;ops.push({code:'SorterSort',p1:outputSorter,emptyJump:0},{code:'SorterData',p1:outputSorter,p2:output,count:results.length});emitParentRow();ops.push({code:'SorterNext',p1:outputSorter,p2:outputSort+1});(ops[outputSort] as {emptyJump:number}).emptyJump=ops.length;}const parentEnd=ops.length;if(parentLimit)(ops[parentLimit.ifZero] as {p2:number}).p2=parentEnd;for(const at of limitStops)(ops[at] as {p2:number}).p2=parentEnd;if(!owner)ops.push({code:'Halt'});
  const columns=select.result.map((expression,index)=>{const tree=results[index]!,source=tree.kind==='register'?inner.columns[tree.index-payload]:undefined;if(source)return Object.freeze({...source,name:expression.alias??source.name});if(tree.kind==='column'&&tree.cursor===outerCursor){const columnIndex=tree.index<0?outer.columns.findIndex((_column,i)=>isIntegerPrimaryKeyAlias(outer,i)):tree.index,column=outer.columns[columnIndex]!;return Object.freeze({name:expression.alias??column.name,declaredType:column.declaredType,database:'main',table:outer.name,origin:column.name});}return Object.freeze({name:expression.alias??expressionName(expression),declaredType:null,database:null,table:null,origin:null});});return Object.freeze({ops:owner?ops:builder.finish(),registers:builder.registers,encoding:database.encoding,columns:Object.freeze(columns),parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits});
 }
 if(!derived||derived.index!==1||select.from.items.length!==2||select.where||select.hasDistinct||select.hasGroupBy||select.hasHaving||select.result.length!==2||select.orderBy.length!==2||select.limit||select.offset)return undefined;
 const item=select.from.items[derived.index]!,coroutine=fromClauseTermCanBeCoroutine({sourceCount:select.from.items.length,index:derived.index,joinFromLeft:item.joinFromLeft,nextCross:false,leftOfRightJoin:select.from.items[0]!.leftOfRightJoin,updateFrom:false,coroutineOptimization:true,isCte:false,cteMaterialized:false,cteUseCount:1,cteNotMaterialized:false,earlierSubquery:false,selfJoinView:false});
 const outerItem=select.from.items[0]!,outer=schema.findTable(sqlName(outerItem.tableName));if(!outer)return undefined;
 const inner={columns:compoundArmColumns(derived.select,schema)};
 const ordinalOrder=select.orderBy.every((term,index)=>term.expr.tokens.length===1&&term.expr.tokens[0]!.text===String(index+1)&&!term.descending&&term.nulls===null);if(!ordinalOrder)return undefined;
 const direct=(expression:SelectNode['result'][number])=>expression.tokens.length===3&&expression.tokens[1]!.text==='.'?{owner:sqlName(expression.tokens[0]!.text),name:sqlName(expression.tokens[2]!.text)}:null,left=direct(select.result[0]!),right=direct(select.result[1]!);if(!left||!right||!sqliteIdentifierEqual(left.owner,outerItem.alias??outer.name)||!sqliteIdentifierEqual(right.owner,derived.alias??'(subquery)'))return undefined;
 const outerColumn=outer.columns.findIndex(column=>sqliteIdentifierEqual(column.name,left.name)),innerColumn=inner.columns.findIndex(column=>sqliteIdentifierEqual(column.name,right.name));if(outerColumn<0||innerColumn<0)return undefined;const outerRowid=isIntegerPrimaryKeyAlias(outer,outerColumn);
 const builder=owner?.builder??new SelectProgramBuilder<Op>(),ops=builder.ops,parameters:ParameterBuilder=owner?.parameters??{maximum:0,names:[],named:new Map()};
 // Parent and child share Parse.nMem/nTab. Reserve legacy physical scan cursor
 // space before allocating the materialized destination.
 builder.reserveCursorsThrough(30);
 const ephemeral=builder.cursor(),keyInfo=new KeyInfo({encoding:database.encoding,totalFieldCount:inner.columns.length,keyFieldCount:inner.columns.length,terms:inner.columns.map(()=>({collation:'binary'}))}),onceRegister=builder.register(),returnRegister=builder.register(),producerOutput=builder.range(inner.columns.length);
 const emitProducer=(destination:SelectDest):void=>{
  const child=derived.select;
  if(child.hasCompound)compileTableCompoundProducer(child,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{builder,parameters,destination});
  else if(selectHasWindow(child))compileWindowSelectLowering(resolveTransientArm(child,schema),database.encoding,database,maxWorkUnits,maxResultBytes,privateStateLimits,schema,undefined,{builder,parameters,destination});
  else if(selectHasAggregate(child)||child.hasGroupBy)compileAggregateSelect(child,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{builder,ops,parameters,destination});
  else if(child.from.items.length)compileInnerTableSelect(child,resolveTransientArm(child,schema),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{builder,ops,parameters,destination});
  else compileScalarSelect(child,database.encoding,maxWorkUnits,maxResultBytes,privateStateLimits,schema,database,maxRows,{builder,parameters,emitRow:(first,count)=>emitSelectDestination(ops,destination,first,count)});
 };

 if(coroutine){
  // select.c tag-select-0482: the subquery destination is a register range.
  // Yield exchanges the producer and consumer PCs; it must not populate a
  // statement-private ephemeral cursor before the consumer starts.
  const init=ops.length;ops.push({code:'InitCoroutine',p1:returnRegister,p2:0,p3:0});const producerBase=ops.length,endJumps:number[]=[];
  emitProducer({kind:'coroutine',register:returnRegister,first:producerOutput});
  endJumps.push(ops.length);ops.push({code:'EndCoroutine',p1:returnRegister,p2:0});
  const consumerStart=ops.length;(ops[init] as {p2:number}).p2=consumerStart;(ops[init] as {p3:number}).p3=producerBase;
  const output=builder.range(2),outerCursor=30;ops.push({code:'OpenRead',p1:outer.rootPage,p2:outerCursor});const outerRewind=ops.length;ops.push({code:'Rewind',p1:outerCursor,p2:0});const outerBody=ops.length;ops.push({code:'InitCoroutine',p1:returnRegister,p2:0,p3:producerBase});const resume=ops.length;ops.push({code:'Yield',p1:returnRegister,p2:0},outerRowid?{code:'Rowid',p1:outerCursor,p2:output}:{code:'Column',p1:outerColumn,p2:output,p3:outerCursor},{code:'Copy',p1:producerOutput+innerColumn,p2:output+1}, );emitSelectDestination(ops,owner?.destination??{kind:'output'},output,2);ops.push({code:'Goto',p2:resume});const innerDone=ops.length;for(const at of endJumps)(ops[at] as {p2:number}).p2=innerDone;ops.push({code:'Next',p1:outerCursor,p2:outerBody});const halt=ops.length;if(!owner)ops.push({code:'Halt'});(ops[outerRewind] as {p2:number}).p2=halt;
  const columns=Object.freeze([Object.freeze({name:select.result[0]!.alias??outer.columns[outerColumn]!.name,declaredType:outer.columns[outerColumn]!.declaredType,database:'main',table:outer.name,origin:outer.columns[outerColumn]!.name}),inner.columns[innerColumn]!]);return Object.freeze({ops:owner?ops:builder.finish(),registers:builder.registers,encoding:database.encoding,columns,parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits});
 }
 const base=ops.length;ops.push({code:'OpenEphemeral',p1:ephemeral,keyInfo},{code:'Once',p1:onceRegister,p2:base+3},{code:'Gosub',p1:returnRegister,p2:base+4},{code:'Goto',p2:0});
 emitProducer({kind:'ephemeral',cursor:ephemeral});
 ops.push({code:'Return',p1:returnRegister});const consumerStart=ops.length;(ops[base+3] as {p2:number}).p2=consumerStart;
 const derivedBase=builder.range(inner.columns.length),output=builder.range(2),outerCursor=0;ops.push({code:'OpenRead',p1:outer.rootPage,p2:outerCursor});const outerRewind=ops.length;ops.push({code:'Rewind',p1:outerCursor,p2:0});const outerBody=ops.length,innerRewind=ops.length;ops.push({code:'EphemeralRewind',p1:ephemeral,p2:0},{code:'EphemeralData',p1:ephemeral,p2:derivedBase,count:inner.columns.length},outerRowid?{code:'Rowid',p1:outerCursor,p2:output}:{code:'Column',p1:outerColumn,p2:output,p3:outerCursor},{code:'Copy',p1:derivedBase+innerColumn,p2:output+1});emitSelectDestination(ops,owner?.destination??{kind:'output'},output,2);const innerNext=ops.length;ops.push({code:'EphemeralNext',p1:ephemeral,p2:innerRewind+1},{code:'Next',p1:outerCursor,p2:outerBody});const halt=ops.length;if(!owner)ops.push({code:'Halt'});(ops[outerRewind] as {p2:number}).p2=halt;(ops[innerRewind] as {p2:number}).p2=innerNext+1;
 const columns=Object.freeze([Object.freeze({name:select.result[0]!.alias??outer.columns[outerColumn]!.name,declaredType:outer.columns[outerColumn]!.declaredType,database:'main',table:outer.name,origin:outer.columns[outerColumn]!.name}),inner.columns[innerColumn]!]);return Object.freeze({ops:owner?ops:builder.finish(),registers:builder.registers,encoding:database.encoding,columns,parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits});
}

type ExprReduction=Extract<LemonValue<SqlToken>,{kind:"reduction"}>;
/** Bounded select.c:flattenSubquery substitution over generated reductions. */
function substituteViewExpression(expression:SelectNode["result"][number],columns:ReadonlyMap<string,SelectNode["result"][number]>,qualifier?:string,qualifiedOnly=false,producerQualifier?:string):SelectNode["result"][number]{
  const directName=expression.tokens.length===1?sqlName(expression.tokens[0]!.text):null;
  const direct=qualifiedOnly||directName===null?undefined:columns.get(sqliteAsciiFold(directName));
  if(direct)return Object.freeze({...direct,...(expression.alias===undefined?{}:{alias:expression.alias})});
  const replace=(node:LemonValue<SqlToken>):LemonValue<SqlToken>=>{
    if(node.kind==='terminal')return node;
    if(node.signature.startsWith('select ::=')&&node.semantic&&typeof node.semantic==='object'&&'kind' in node.semantic&&node.semantic.kind==='select'){
      const nested=node.semantic as SelectNode;
      // select.c substSelect visits nested EList as well as WHERE. Only
      // qualified references can cross this lexical boundary; local bare
      // names must not be substituted by the enclosing transient EList.
      if(!qualifier)return node;
      const qualified=new Map(columns);
      const local=nested.from.items.some(item=>sqliteIdentifierEqual(item.alias??item.tableName,qualifier));
      if(local)return node;
      const substitute=(value:SelectNode['result'][number])=>substituteViewExpression(value,qualified,qualifier,true,producerQualifier);
      const result=Object.freeze(nested.result.map(substitute)),where=nested.where?substitute(nested.where):null;
      const groupBy=Object.freeze(nested.groupBy.map(substitute)),having=nested.having?substitute(nested.having):null;
      const orderBy=Object.freeze(nested.orderBy.map(term=>Object.freeze({...term,expr:substitute(term.expr)})));
      const arms=Object.freeze(nested.arms.map((arm,index)=>Object.freeze({...arm,result:index===0?result:Object.freeze(arm.result.map(substitute)),where:index===0?where:arm.where?substitute(arm.where):null})));
      return Object.freeze({...node,semantic:Object.freeze({...nested,result,where,groupBy,having,orderBy,arms})});
    }
    if(qualifier&&node.signature==='expr ::= nm DOT nm'){
      // The Lemon nm reductions can wrap terminal tokens in multiple layers.
      // Read leaves in source order, as expressionFromReduction does, rather
      // than assuming the terminal is an immediate nm child.
      const names=exprLeaves(node).map(token=>sqlName(token.text));
      const replacement=names.length===3&&names[1]==='.'&&sqliteIdentifierEqual(names[0]!,qualifier)?columns.get(sqliteAsciiFold(names[2]!)):undefined;
      if(replacement?.reduction){
        // Keep the substituted source's lexical qualifier inside a child
        // NameContext; a bare `a` would bind to the child's local table.
        const tokens=exprLeaves(replacement.reduction);
        if(qualifiedOnly&&tokens.length===1&&producerQualifier){
          const leaves=exprLeaves(node),mapped=leaves.map((token,index)=>({...token,text:index===0?producerQualifier!:index===2?tokens[0]!.text:token.text}));let at=0;
          const rename=(value:LemonValue<SqlToken>):LemonValue<SqlToken>=>value.kind==='terminal'?Object.freeze({...value,value:mapped[at++]!}):Object.freeze({...value,children:Object.freeze(value.children.map(rename))});
          return rename(node);
        }
        return replacement.reduction;
      }
    }
    if(!qualifiedOnly&&node.signature==='expr ::= ID|INDEXED|JOIN_KW'){
      const terminal=node.children.find(child=>child.kind==='terminal'&&child.value);
      const replacement=terminal?.kind==='terminal'?columns.get(sqliteAsciiFold(sqlName(terminal.value.text))):undefined;
      if(replacement?.reduction)return replacement.reduction;
    }
    return Object.freeze({...node,children:Object.freeze(node.children.map(replace))});
  };
  const substituted=expression.reduction?replace(expression.reduction):undefined;
  // resolve.c:direct reads ExprNode.tokens for a direct column before walking
  // its reduction. Keep that token carrier aligned when flattening a qualified
  // transient column to an underlying column, not only the reduction tree.
  const tokens=substituted?Object.freeze(exprLeaves(substituted)):expression.tokens;
  return Object.freeze({...expression,tokens,...(substituted?{reduction:substituted}:{})});
}
function andViewPredicates(left:SelectNode["where"],right:SelectNode["where"]):SelectNode["where"]{
  if(!left)return right;if(!right)return left;if(!left.reduction||!right.reduction)throw new JSQLiteError("internal","generated view predicate lost its reduction");
  const at=left.tokens.at(-1)?.endByte??0,andToken:SqlToken={kind:'keyword',text:'AND',startByte:at,endByte:at+3};
  const reduction:ExprReduction=Object.freeze({kind:'reduction',rule:-1,signature:'expr ::= expr AND expr',children:Object.freeze([left.reduction,{kind:'terminal' as const,tokenId:tokenIds.AND,value:andToken},right.reduction])});
  return Object.freeze({kind:'tokens',tokens:Object.freeze([...left.tokens,andToken,...right.tokens]),reduction});
}
function flattenImmutableView(select:SelectNode,view:ViewNode):SelectNode{
  const source=select.from.items[0]!,inner=lowerOrdinaryCtes(view.select)??view.select;
  if(source.databaseName!==null||source.on!==null||source.using!==null||inner.hasCompound||inner.hasDistinct||inner.hasGroupBy||inner.hasHaving||inner.hasOrderBy||inner.hasLimit||inner.from.items.length!==1)
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
  const exposedQualifier=source.alias??source.tableName;
  const result=bareStar?exposed:select.result.map(expression=>substituteViewExpression(expression,columns,exposedQualifier));
  const where=andViewPredicates(inner.where,select.where?substituteViewExpression(select.where,columns,exposedQualifier):null);
  const groupBy=select.groupBy.map(expression=>substituteViewExpression(expression,columns,exposedQualifier));
  const having=select.having?substituteViewExpression(select.having,columns):null;
  const orderBy=select.orderBy.map(term=>Object.freeze({...term,expr:substituteViewExpression(term.expr,columns,exposedQualifier)}));
  return Object.freeze({...inner,result:Object.freeze(result),where,groupBy:Object.freeze(groupBy),having,orderBy:Object.freeze(orderBy),limit:select.limit,offset:select.offset,hasDistinct:select.hasDistinct,hasGroupBy:groupBy.length>0,hasHaving:having!==null,hasOrderBy:orderBy.length>0,hasLimit:select.hasLimit,hasSubquery:select.hasSubquery||inner.hasSubquery,tokens:select.tokens});
}

/** Bounded select.c tag-select-0488/0486 producer for two references to one
 * immutable view. The parent fills one ephemeral destination and opens an
 * independently positioned duplicate reader. SQLite may instead choose 0482
 * for the first occurrence; this route does not assert planner equivalence. */
function compileRepeatedImmutableView(select:SelectNode,schema:SchemaGraph,database:BtreeDatabase,maxRows:number,maxWorkUnits:number,maxResultBytes:number,privateStateLimits:PrivateStateLimits,parent?:{builder:SelectProgramBuilder<Op>;parameters:ParameterBuilder;destination:SelectDest}):Program|{columns:Program['columns']}|undefined{
 if(select.from.items.length!==2||select.hasDistinct||select.hasGroupBy||select.hasHaving||select.hasCompound||select.where)return undefined;
 const [li,ri]=select.from.items,l=schema.views.get(sqliteAsciiFold(sqlName(li!.tableName))),r=schema.views.get(sqliteAsciiFold(sqlName(ri!.tableName)));
 if(!l||l!==r||!li!.alias||!ri!.alias||!ri!.on?.reduction||ri!.using)return undefined;
 const producer=l.select;
 // Only a physical-table view body uses this producer. Do not publish a
 // partial materialization for an as-yet unlowered view body.
 if(producer.from.items.length!==1||producer.hasCompound||producer.hasDistinct||producer.hasGroupBy||producer.hasHaving||selectHasAggregate(producer)||selectHasWindow(producer))return undefined;
 const builder=parent?.builder??new SelectProgramBuilder<Op>(),ops=builder.ops,parameters:ParameterBuilder=parent?.parameters??{maximum:0,names:[],named:new Map()};
 let resolved:ReturnType<typeof expandAndResolveSelect>;
 try{resolved=expandAndResolveSelect(producer,schema,null,builder.cursors)}catch(error){if(error instanceof NameResolutionError)throw new JSQLiteError('sqlite',error.message,{code:1});throw error;}
 const names=uniqueTransientColumnNames(l.columns.length?l.columns:resolved.result.map(result=>result.name));
 if(names.length!==resolved.result.length)return undefined;
 const direct=(tree:Expression):{side:0|1;index:number}|null=>{if(tree.kind!=="column")return null;const p=tree.name.split('.').map(sqlName);if(p.length!==2)return null;const side=sqliteIdentifierEqual(p[0]!,li!.alias!)?0:sqliteIdentifierEqual(p[0]!,ri!.alias!)?1:null;if(side===null)return null;const index=names.findIndex(n=>sqliteIdentifierEqual(n,p[1]!));return index<0?null:{side,index};};
 const on=expressionFromReduction(ri!.on.reduction);if(on.kind!=="binary"||on.op!=="=")return undefined;const a=direct(on.left),b=direct(on.right);if(!a||!b||a.side===b.side)return undefined;
 const projected=select.result.map(e=>e.reduction?direct(expressionFromReduction(e.reduction)):null);
 if(projected.some(x=>x===null)){
  const missing=select.result.find((e,i)=>projected[i]===null);
  const tree=missing?.reduction?expressionFromReduction(missing.reduction):null;
  if(tree?.kind==='column')throw new JSQLiteError('sqlite',`no such column: ${tree.name}`,{code:1});
  return undefined;
 }
 if(select.orderBy.length>1)return undefined;
 if(select.orderBy.length===1){let order=expressionFromReduction(select.orderBy[0]!.expr.reduction!);while(order.kind==='collate')order=order.value;if(order.kind!=="literal"||order.value!==1n||select.orderBy[0]!.descending||select.orderBy[0]!.nulls!==null)return undefined;}
 // sqlite3Select tag-select-0488 fills SRT_EphemTab in the enclosing Vdbe.
 // tag-select-0486 opens independently positioned readers of that one fill.
 const owner=builder.cursor(),dup=builder.cursor(),keyInfo=new KeyInfo({encoding:database.encoding,totalFieldCount:resolved.result.length,keyFieldCount:resolved.result.length,terms:resolved.result.map(()=>({collation:'binary' as const}))});
 ops.push({code:'OpenEphemeral',p1:owner,keyInfo,insertionOrder:true});const ret=builder.register(),call=ops.length;ops.push({code:'Gosub',p1:ret,p2:0},{code:'Goto',p2:0});const bypass=call+1;
 (ops[call] as {p2:number}).p2=ops.length;
 compileInnerTableSelect(producer,resolved,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{builder,ops,parameters,destination:{kind:'ephemeral',cursor:owner}});
 ops.push({code:'Return',p1:ret});(ops[bypass] as {p2:number}).p2=ops.length;
 ops.push({code:'EphemeralSort',p1:owner},{code:'OpenDup',p1:dup,p2:owner});
 const base=builder.range(resolved.result.length),rightBase=builder.range(resolved.result.length),output=builder.range(projected.length),test=builder.register();
 const limit=computeLimitRegisters(select,ops,()=>builder.register(),parameters);
 const rewindLeft=ops.length;ops.push({code:'EphemeralRewind',p1:owner,p2:0});const leftStart=ops.length;ops.push({code:'EphemeralData',p1:owner,p2:base,count:resolved.result.length});
 const rewindRight=ops.length;ops.push({code:'EphemeralRewind',p1:dup,p2:0});const rightStart=ops.length;ops.push({code:'EphemeralData',p1:dup,p2:rightBase,count:resolved.result.length});
 const lhs=(a.side===0?base:rightBase)+a.index,rhs=(b.side===0?base:rightBase)+b.index;
 ops.push({code:'Binary',op:'=',p1:lhs,p2:rhs,p3:test,collation:'binary'});const skip=ops.length;ops.push({code:'IfNot',p1:test,p2:0});
 projected.forEach((v,i)=>ops.push({code:'Copy',p1:(v!.side===0?base:rightBase)+v!.index,p2:output+i}));
 const offsetSkip=limit?.offset!==undefined?ops.length:undefined;if(offsetSkip!==undefined)ops.push({code:'IfPos',p1:limit!.offset!,p2:0,p3:1});
 emitSelectDestination(ops,parent?.destination??{kind:'output'},output,projected.length);
 const limitEnd=limit?ops.length:undefined;if(limit)ops.push({code:'DecrJumpZero',p1:limit.count,p2:0});
 const nextRight=ops.length;ops.push({code:'EphemeralNext',p1:dup,p2:rightStart},{code:'EphemeralNext',p1:owner,p2:leftStart});const halt=ops.length;if(!parent)ops.push({code:'Halt'});
 (ops[rewindLeft] as {p2:number}).p2=halt;(ops[rewindRight] as {p2:number}).p2=nextRight+1;(ops[skip] as {p2:number}).p2=nextRight;
 if(offsetSkip!==undefined)(ops[offsetSkip] as {p2:number}).p2=nextRight;
 if(limitEnd!==undefined)(ops[limitEnd] as {p2:number}).p2=halt;
 if(limit)(ops[limit.ifZero] as {p2:number}).p2=halt;
 const columns=projected.map((v,i)=>{const source=resolved.result[v!.index]!;return Object.freeze({name:select.result[i]!.alias??names[v!.index]!,declaredType:source.descriptor.declaredType,database:source.descriptor.database,table:source.descriptor.table,origin:source.descriptor.origin})});
 if(parent)return {columns:Object.freeze(columns)};
 return Object.freeze({ops:builder.finish(),registers:builder.registers,encoding:database.encoding,columns:Object.freeze(columns),parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits});
}

/** select.c CteUse eM10d/addrM9e materialization route for the represented
 * two-source graph. One fill is emitted per declaration identity and repeated
 * references receive OpenDup cursors with independent positions. */
// select.c:sqlite3Select tag-select-0484/0488: materialize once into a
// shared cursor, then open duplicate readers. Only direct projections and an
// equality join are admitted here; other consumers retain their prior route.
// select.c sqlite3Select FROM-SrcItem materialization: each generated Select
// owns a distinct destination; the bounded derived pair shares the parent Vdbe
// with CTE producers, not a finished child Program or copied PC stream.
// A MATERIALIZED CteUse pair keeps its declaration identity in `owners`;
// sqlite3Select codes multiSelect arms into each SRT_EphemTab before the join.
function compileCteDerivedSources(select:SelectNode,schema:SchemaGraph,database:BtreeDatabase,maxRows:number,maxWorkUnits:number,maxResultBytes:number,privateStateLimits:PrivateStateLimits,parent?:{builder:SelectProgramBuilder<Op>;parameters:ParameterBuilder;destination:SelectDest}):Program|{columns:Program['columns']}|undefined {
 const derived=select.from.derivedSources?.length===2&&select.from.derivedSources.length===select.from.items.length?select.from.derivedSources:undefined;
 const sources=derived?derived.map(source=>({...source,alias:source.alias??'(subquery)',use:source,materialization:'materialized' as const})):select.from.cteDerived;
 // Compound CTEs are admitted only when materialization is explicit. Other
 // declaration/use identities retain their existing coroutine/fallback route.
 const compoundCte=!derived&&sources?.length===2&&sources.some(source=>source.select.hasCompound)&&sources.every(source=>source.materialization==='materialized');
 const compoundOwners=!!derived||!!compoundCte;
 if(derived&&derived.some(source=>!source.select.hasCompound))return undefined;
 if(!sources?.length||sources.length!==select.from.items.length||sources.length>2||select.hasDistinct||select.hasGroupBy||select.hasHaving||select.hasCompound)return compileCteDerivedSourcesFallback(select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,parent);
 if(sources.length===1&&sources[0]!.materialization!=='materialized'&&sources[0]!.use.nUse<2)return undefined;
 const builder=parent?.builder??new SelectProgramBuilder<Op>(),ops=builder.ops,parameters:ParameterBuilder=parent?.parameters??{maximum:0,names:[],named:new Map()};
 const names:(readonly string[])[]=[],metadata=new Map<object,Program['columns']>();
 const direct=(tree:Expression):{source:number;column:number}|null=>{if(tree.kind!=="column")return null;const parts=tree.name.split('.').map(sqlName),name=parts.at(-1)!;const candidates=parts.length===2?sources.filter(source=>sqliteIdentifierEqual(source.alias,parts[0]!)):parts.length===1?sources:[];const found=candidates.flatMap(source=>{const column=names[source.index]!.findIndex(n=>sqliteIdentifierEqual(n,name));return column<0?[]:[{source:source.index,column}]});return found.length===1?found[0]!:null;};
 // Resolve every producer and all outer names before publishing bytecode.
 const expanded=new Map<object,ReturnType<typeof expandAndResolveSelect>>();
 try{for(const source of sources){if(expanded.has(source.use))continue;const producer=source.select;
  if((!compoundOwners&&producer.hasCompound)||producer.hasDistinct||producer.hasGroupBy||producer.hasHaving||(producer.hasOrderBy&&!producer.from.items.length)||(producer.hasLimit&&!producer.from.items.length)||producer.from.derived||producer.from.cteDerived||(!compoundOwners&&producer.from.items.length>1)||(!compoundOwners&&selectHasAggregate(producer))||(!compoundOwners&&selectHasWindow(producer)))return compileCteDerivedSourcesFallback(select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,parent);
  if(producer.from.items.length&&!producer.hasCompound)expanded.set(source.use,expandAndResolveSelect(producer,schema,null,builder.cursors));
  else if(!compoundOwners&&(producer.hasCompound||(producer.arms[0]?.origin!=='values'&&producer.arms[0]?.origin!=='select')))return compileCteDerivedSourcesFallback(select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,parent);
  const columns=compoundOwners&&producer.hasCompound?producer.result.map(r=>({name:r.alias??expressionName(r),declaredType:null,database:null,table:null,origin:null})):expanded.has(source.use)?expanded.get(source.use)!.result.map(r=>({name:r.name,declaredType:r.descriptor.declaredType,database:r.descriptor.database,table:r.descriptor.table,origin:r.descriptor.origin})):producer.result.map(r=>({name:r.alias??expressionName(r),declaredType:null,database:null,table:null,origin:null}));
  metadata.set(source.use,Object.freeze(columns));
 }}catch(error){if(error instanceof NameResolutionError)throw new JSQLiteError('sqlite',error.message,{code:1});throw error;}
 for(const source of sources){const columns=metadata.get(source.use)!;names[source.index]=uniqueTransientColumnNames(source.select.result.map((e,i)=>e.alias??columns[i]?.name??`column${i+1}`));}
 const projected=select.result.map(e=>e.reduction?direct(expressionFromReduction(e.reduction)):null);

 if(projected.some(x=>x===null))return compileCteDerivedSourcesFallback(select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,parent);
 // Outer WHERE runs after SRT_EphemTab production (select.c:sqlite3Select),
 // preserving the MATERIALIZED fence. Unsupported predicates retain fallback.
 let outerFilter:{column:{source:number;column:number};op:string;value:Expression}|null=null;
 if(select.where){const tree=select.where.reduction?expressionFromReduction(select.where.reduction):null;const column=tree?.kind==='binary'?direct(tree.left):null;if(!column||tree?.kind!=='binary'||!['=','>','<','>=','<=','!=','<>'].includes(tree.op)||tree.right.kind!=='literal')return compileCteDerivedSourcesFallback(select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,parent);outerFilter={column,op:tree.op,value:tree.right};}
 let predicate:{left:{source:number;column:number};right:{source:number;column:number}}|null=null;let literalOn:{column:{source:number;column:number};value:Expression;op:string}|null=null;

 if(sources.length===2&&select.from.items[1]!.on?.reduction){const tree=expressionFromReduction(select.from.items[1]!.on!.reduction!);if(tree.kind!=='binary'||tree.op!=='=')return compileCteDerivedSourcesFallback(select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,parent);const left=direct(tree.left),right=direct(tree.right);if(compoundOwners&&left&&tree.right.kind==='literal')literalOn={column:left,value:tree.right,op:tree.op};else if(!left||!right)return compileCteDerivedSourcesFallback(select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,parent);else predicate={left,right};}
 else if(sources.length===2&&!select.from.items[1]!.joinFromLeft.cross)return compileCteDerivedSourcesFallback(select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,parent);
 if(select.orderBy.length>1&&!compoundOwners)return compileCteDerivedSourcesFallback(select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,parent);
 if(select.orderBy.length&&!compoundOwners){let tree=expressionFromReduction(select.orderBy[0]!.expr.reduction!);while(tree.kind==='collate')tree=tree.value;if((tree.kind!=='literal'||tree.value!==1n)&&!(tree.kind==='column'&&projected.length===1&&direct(tree)?.source===projected[0]?.source&&direct(tree)?.column===projected[0]?.column)||select.orderBy[0]!.descending||select.orderBy[0]!.nulls!==null)return compileCteDerivedSourcesFallback(select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,parent);}

 if(compoundOwners&&select.orderBy.some(term=>term.descending||term.nulls!==null||!term.expr.reduction||expressionFromReduction(term.expr.reduction).kind!=='literal'||typeof (expressionFromReduction(term.expr.reduction) as {value?:unknown}).value!=='bigint'||(expressionFromReduction(term.expr.reduction) as {value:bigint}).value<1n||(expressionFromReduction(term.expr.reduction) as {value:bigint}).value>BigInt(projected.length)))return undefined;
 const outerOrder=select.orderBy[0];let outerOrderTree=outerOrder?.expr.reduction?expressionFromReduction(outerOrder.expr.reduction):null;while(outerOrderTree?.kind==='collate')outerOrderTree=outerOrderTree.value;const outerOrderColumn=outerOrderTree?.kind==='column'?direct(outerOrderTree):null;
 const orderIndices=compoundOwners?select.orderBy.map(term=>Number((expressionFromReduction(term.expr.reduction!) as {value:bigint}).value)-1):outerOrder?[outerOrderColumn?projected.findIndex(v=>v!==null&&v.source===outerOrderColumn.source&&v.column===outerOrderColumn.column):Number((outerOrderTree as {value:bigint}).value)-1]:[];
 if(compoundOwners&&(select.limit||select.offset))return undefined;
 const limit=computeLimitRegisters(select,ops,()=>builder.register(),parameters);
 const owners=new Map<object,number>(),cursors:number[]=[],rewinds:number[]=[],starts:number[]=[];
 for(const source of sources){const prior=owners.get(source.use);if(prior!==undefined){const cursor=builder.cursor();ops.push({code:'OpenDup',p1:cursor,p2:prior});cursors[source.index]=cursor;continue;}
  const cursor=builder.cursor(),columns=metadata.get(source.use)!;owners.set(source.use,cursor);cursors[source.index]=cursor;
  const keyInfo=new KeyInfo({encoding:database.encoding,totalFieldCount:columns.length,keyFieldCount:columns.length,terms:columns.map(()=>({collation:'binary'}))});
  ops.push({code:'OpenEphemeral',p1:cursor,keyInfo,insertionOrder:true});const ret=builder.register(),call=ops.length;ops.push({code:'Gosub',p1:ret,p2:0},{code:'Goto',p2:0});const bypass=call+1;
  (ops[call] as {p2:number}).p2=ops.length;
  const producer=source.select,destination:SelectDest={kind:'ephemeral',cursor};
  if(compoundOwners&&producer.hasCompound){
    if(producer.hasOrderBy||producer.hasLimit||producer.arms.slice(1).some(arm=>arm.operatorFromPrior!=='union-all')||producer.arms.some(arm=>arm.result.length!==columns.length||arm.from.items.length>1||arm.from.derived||arm.from.cteDerived||arm.hasDistinct||arm.hasGroupBy||arm.hasHaving||arm.origin!=='select'))return undefined;
    for(const arm of producer.arms){
      // resolve.c validates each arm before publishing the enclosing Vdbe.
      const armSelect:SelectNode={...producer,result:arm.result,from:arm.from,where:arm.where,hasCompound:false,arms:[arm]};
      // Aggregate/window classification belongs to each SELECT arm, not the
      // first-arm column-name carrier of the compound owner.
      if(selectHasAggregate(armSelect)||selectHasWindow(armSelect))return undefined;
      let resolved:ReturnType<typeof expandAndResolveSelect>;
      try{resolved=expandAndResolveSelect(armSelect,schema,null,builder.cursors)}catch(error){if(error instanceof NameResolutionError)throw new JSQLiteError('sqlite',error.message,{code:1});throw error;}
      // multiSelect calls sqlite3Select on each arm with the same destination.
      // The existing table/wherecode producer consumes the enclosing builder
      // and returns to this arm's continuation, rather than relocating PCs.
      if(arm.from.items.length){compileInnerTableSelect(armSelect,resolved,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{builder,ops,parameters,destination});continue;}
      // select.c:sqlite3Select tests each arm's WHERE before selectInnerLoop
      // delivers that arm to multiSelect's SRT_EphemTab destination. Code the
      // gate in this same builder so its jump never skips the next arm.
      const gate=arm.where?compileExpression(arm.where,ops,()=>builder.register(),parameters).register:null;
      const skip=gate===null?null:ops.length;
      if(gate!==null)ops.push({code:'IfNot',p1:gate,p2:0});
      const first=builder.range(columns.length);
      arm.result.forEach((expression,index)=>{const reg=compileExpression(expression,ops,()=>builder.register(),parameters).register;ops.push({code:'Copy',p1:reg,p2:first+index});});
      emitSelectDestination(ops,destination,first,columns.length);
      if(skip!==null)(ops[skip] as {p2:number}).p2=ops.length;
    }
  }
  else if(producer.from.items.length)compileInnerTableSelect(producer,expanded.get(source.use)!,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{builder,ops,parameters,destination});
  else if(producer.arms[0]!.origin==='values')for(const row of producer.arms[0]!.valuesRows!){const first=builder.range(row.length);row.forEach((value,index)=>{const reg=compileExpression(value,ops,()=>builder.register(),parameters).register;ops.push({code:'Copy',p1:reg,p2:first+index});});emitSelectDestination(ops,destination,first,row.length);}
   else {
     // select.c:sqlite3Select codes a no-FROM WHERE gate before
     // selectInnerLoop's SRT_EphemTab. Addresses and registers belong to the
     // enclosing builder, not to a relocated completed Program.
     try{expandAndResolveSelect(producer,schema,null,builder.cursors)}catch(error){if(error instanceof NameResolutionError)throw new JSQLiteError('sqlite',error.message,{code:1});throw error;}
     const gate=producer.where?compileExpression(producer.where,ops,()=>builder.register(),parameters).register:null;
     const skip=gate===null?null:ops.length;
     if(gate!==null)ops.push({code:'IfNot',p1:gate,p2:0});
     const first=builder.range(columns.length);
     producer.result.forEach((value,index)=>{const reg=compileExpression(value,ops,()=>builder.register(),parameters).register;ops.push({code:'Copy',p1:reg,p2:first+index});});
     emitSelectDestination(ops,destination,first,columns.length);
     if(skip!==null)(ops[skip] as {p2:number}).p2=ops.length;
   }
  ops.push({code:'Return',p1:ret});(ops[bypass] as {p2:number}).p2=ops.length;ops.push({code:'EphemeralSort',p1:cursor});
 }
 const sortCursor=orderIndices.length?builder.cursor():undefined;
 if(sortCursor!==undefined)ops.push({code:'SorterOpen',p1:sortCursor,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:orderIndices.length+projected.length,keyFieldCount:orderIndices.length,terms:orderIndices.map(()=>({collation:'binary'}))})});
 const bases=sources.map(source=>builder.range(metadata.get(source.use)!.length));
 for(const source of sources){rewinds[source.index]=ops.length;ops.push({code:'EphemeralRewind',p1:cursors[source.index]!,p2:0});starts[source.index]=ops.length;ops.push({code:'EphemeralData',p1:cursors[source.index]!,p2:bases[source.index]!,count:metadata.get(source.use)!.length});}
 const skips:number[]=[];if(literalOn){const right=compileExpressionTree(literalOn.value,ops,()=>builder.register(),parameters),test=builder.register();ops.push({code:'Binary',op:literalOn.op,p1:bases[literalOn.column.source]!+literalOn.column.column,p2:right,p3:test,collation:'binary'});skips.push(ops.length);ops.push({code:'IfNot',p1:test,p2:0});}if(predicate){const test=builder.register(),at=(ref:{source:number;column:number})=>bases[ref.source]!+ref.column;ops.push({code:'Binary',op:'=',p1:at(predicate.left),p2:at(predicate.right),p3:test,collation:'binary'});skips.push(ops.length);ops.push({code:'IfNot',p1:test,p2:0});}
 if(outerFilter){const right=compileExpressionTree(outerFilter.value,ops,()=>builder.register(),parameters),test=builder.register();ops.push({code:'Binary',op:outerFilter.op,p1:bases[outerFilter.column.source]!+outerFilter.column.column,p2:right,p3:test,collation:'binary'});skips.push(ops.length);ops.push({code:'IfNot',p1:test,p2:0});}
 const output=builder.range(projected.length);projected.forEach((v,i)=>ops.push({code:'Copy',p1:bases[v!.source]!+v!.column,p2:output+i}));
let offsetSkip:number|undefined;if(limit?.offset!==undefined){offsetSkip=ops.length;ops.push({code:'IfPos',p1:limit.offset,p2:0,p3:1});}
 if(sortCursor!==undefined){const keys=builder.range(orderIndices.length);orderIndices.forEach((index,i)=>ops.push({code:'Copy',p1:output+index,p2:keys+i}));ops.push({code:'SorterInsert',p1:sortCursor,keyStart:keys,keyCount:orderIndices.length,payload:output,payloadCount:projected.length});}else emitSelectDestination(ops,parent?.destination??{kind:'output'},output,projected.length);const limitEnd=limit?ops.length:undefined;if(limit)ops.push({code:'DecrJumpZero',p1:limit.count,p2:0});
 const next:number[]=[];for(let i=sources.length-1;i>=0;i--){next[i]=ops.length;ops.push({code:'EphemeralNext',p1:cursors[i]!,p2:starts[i]!});}
 const halt=ops.length;if(sortCursor!==undefined){const start=ops.length;ops.push({code:'SorterSort',p1:sortCursor,emptyJump:0},{code:'SorterData',p1:sortCursor,p2:output,count:projected.length});emitSelectDestination(ops,parent?.destination??{kind:'output'},output,projected.length);ops.push({code:'SorterNext',p1:sortCursor,p2:start+1});(ops[start] as {emptyJump:number}).emptyJump=ops.length;}if(!parent)ops.push({code:'Halt'});if(limitEnd!==undefined)(ops[limitEnd] as {p2:number}).p2=halt;if(limit)(ops[limit.ifZero] as {p2:number}).p2=halt;if(offsetSkip!==undefined)(ops[offsetSkip] as {p2:number}).p2=next.at(-1)!;for(let i=0;i<sources.length;i++)(ops[rewinds[i]!] as {p2:number}).p2=i?next[i-1]!:halt;for(const at of skips)(ops[at] as {p2:number}).p2=next.at(-1)!;
 const columns=projected.map((v,i)=>Object.freeze({...metadata.get(sources[v!.source]!.use)![v!.column]!,name:select.result[i]!.alias??names[v!.source]![v!.column]!}));
 if(parent)return {columns:Object.freeze(columns)};
 return Object.freeze({ops:builder.finish(),registers:builder.registers,encoding:database.encoding,columns:Object.freeze(columns),parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits});
}

function compileCteDerivedSourcesFallback(select:SelectNode,schema:SchemaGraph,database:BtreeDatabase,maxRows:number,maxWorkUnits:number,maxResultBytes:number,privateStateLimits:PrivateStateLimits,parent?:{builder:SelectProgramBuilder<Op>;parameters:ParameterBuilder;destination:SelectDest}):Program|{columns:Program['columns']}|undefined {
 const sources=select.from.cteDerived;if(!sources?.length||sources.length!==select.from.items.length||sources.length>2||select.hasDistinct||select.hasGroupBy||select.hasHaving||select.hasCompound||select.limit||select.offset)return undefined;
 // select.c consults the CteUse facts before tag-select-0482. Preserve the
 // ordinary derived compiler for an eligible coroutine, but retain this owner
 // for forced/repeated materialization. The CteUse object is shared across all
 // references and has its final prepare-time nUse before compilation begins.
 if(sources.length===1){const source=sources[0]!,item=select.from.items[source.index]!;if(fromClauseTermCanBeCoroutine({sourceCount:select.from.items.length,index:source.index,joinFromLeft:item.joinFromLeft,nextCross:false,leftOfRightJoin:select.from.items[0]!.leftOfRightJoin,updateFrom:false,coroutineOptimization:true,isCte:true,cteMaterialized:source.materialization==='materialized',cteUseCount:source.use.nUse,cteNotMaterialized:source.materialization==='not-materialized',earlierSubquery:false,selfJoinView:false}))return undefined;}
 const descriptors=new Map<object,Program['columns']>(),names:(readonly string[])[]=[];
 for(const source of sources){let columns=descriptors.get(source.use);if(!columns){columns=compoundArmColumns(source.select,schema);descriptors.set(source.use,columns);}names[source.index]=uniqueTransientColumnNames(source.select.result.map((e,i)=>e.alias??columns[i]?.name??`column${i+1}`));}
 const direct=(tree:Expression):{source:number;column:number}|null=>{if(tree.kind!=="column")return null;const parts=tree.name.split('.').map(sqlName),name=parts.at(-1)!;let candidates=sources;if(parts.length===2)candidates=sources.filter(source=>sqliteIdentifierEqual(source.alias,parts[0]!));else if(parts.length!==1)return null;const found=candidates.flatMap(source=>{const column=names[source.index]!.findIndex(n=>sqliteIdentifierEqual(n,name));return column<0?[]:[{source:source.index,column}]});return found.length===1?found[0]!:null;};
 const projected=select.result.map(e=>e.reduction?direct(expressionFromReduction(e.reduction)):null);if(projected.some(x=>x===null))return undefined;
 let predicate:{left:{source:number;column:number};right:{source:number;column:number}}|null=null;if(sources.length===2&&select.from.items[1]!.on?.reduction){const tree=expressionFromReduction(select.from.items[1]!.on!.reduction!);if(tree.kind!=="binary"||tree.op!=="=")return undefined;const left=direct(tree.left),right=direct(tree.right);if(!left||!right)return undefined;predicate={left,right};}else if(sources.length===2&&!select.from.items[1]!.joinFromLeft.cross)return undefined;
 if(select.orderBy.length>1)return undefined;if(select.orderBy.length===1){let tree=expressionFromReduction(select.orderBy[0]!.expr.reduction!);while(tree.kind==='collate')tree=tree.value;if(tree.kind!=="literal"||tree.value!==1n||select.orderBy[0]!.descending||select.orderBy[0]!.nulls!==null)return undefined;}
 const builder=parent?.builder??new SelectProgramBuilder<Op>(),ops=builder.ops,parameters:ParameterBuilder=parent?.parameters??{maximum:0,names:[],named:new Map()},owners=new Map<object,number>(),cursors:number[]=[];
 // Legacy physical WHERE cursor identities remain root-owned.
 builder.reserveCursorsThrough(30);
 for(const source of sources){
  const prior=owners.get(source.use);
  if(prior!==undefined){const cursor=builder.cursor();ops.push({code:'OpenDup',p1:cursor,p2:prior});cursors[source.index]=cursor;continue;}
  const columns=descriptors.get(source.use)!,owner=builder.cursor();owners.set(source.use,owner);cursors[source.index]=owner;
  const keyInfo=new KeyInfo({encoding:database.encoding,totalFieldCount:columns.length,keyFieldCount:columns.length,terms:columns.map(()=>({collation:'binary' as const}))});
  ops.push({code:'OpenEphemeral',p1:owner,keyInfo});
  const ret=builder.register(),once=builder.register(),onceAt=ops.length;
  ops.push({code:'Once',p1:once,p2:0});const gosub=ops.length;ops.push({code:'Gosub',p1:ret,p2:0},{code:'Goto',p2:0});
  const skipProducer=gosub+1;(ops[gosub] as {p2:number}).p2=ops.length;
  const child=source.select,destination:SelectDest={kind:'ephemeral',cursor:owner};
  if(child.hasCompound)compileTableCompoundProducer(child,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{builder,parameters,destination});
  else if(selectHasWindow(child))compileWindowSelectLowering(resolveTransientArm(child,schema),database.encoding,database,maxWorkUnits,maxResultBytes,privateStateLimits,schema,undefined,{builder,parameters,destination});
  else if(selectHasAggregate(child)||child.hasGroupBy||child.hasHaving)compileAggregateSelect(child,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{builder,ops,parameters,destination});
  else if(child.from.items.length)compileInnerTableSelect(child,resolveTransientArm(child,schema),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{builder,ops,parameters,destination});
  else compileScalarSelect(child,database.encoding,maxWorkUnits,maxResultBytes,privateStateLimits,schema,database,maxRows,{builder,parameters,emitRow:(first,count)=>emitSelectDestination(ops,destination,first,count)});
  ops.push({code:'Return',p1:ret});const consumer=ops.length;(ops[skipProducer] as {p2:number}).p2=consumer;(ops[onceAt] as {p2:number}).p2=consumer;
  ops.push({code:'EphemeralSort',p1:owner});
 }
 const bases=sources.map(source=>{return builder.range(descriptors.get(source.use)!.length);}),rewinds:number[]=[],starts:number[]=[];for(const source of sources){rewinds[source.index]=ops.length;ops.push({code:'EphemeralRewind',p1:cursors[source.index]!,p2:0});starts[source.index]=ops.length;ops.push({code:'EphemeralData',p1:cursors[source.index]!,p2:bases[source.index]!,count:descriptors.get(source.use)!.length});}
 let skip:number|undefined;if(predicate){const test=builder.register(),at=(ref:{source:number;column:number})=>bases[ref.source]!+ref.column;ops.push({code:'Binary',op:'=',p1:at(predicate.left),p2:at(predicate.right),p3:test,collation:'binary'});skip=ops.length;ops.push({code:'IfNot',p1:test,p2:0});}const output=builder.range(projected.length);projected.forEach((v,i)=>ops.push({code:'Copy',p1:bases[v!.source]!+v!.column,p2:output+i}));emitSelectDestination(ops,parent?.destination??{kind:'output'},output,projected.length);const next:number[]=[];for(let i=sources.length-1;i>=0;i--){next[i]=ops.length;ops.push({code:'EphemeralNext',p1:cursors[i]!,p2:starts[i]!});}const halt=ops.length;if(!parent)ops.push({code:'Halt'});for(let i=0;i<sources.length;i++)(ops[rewinds[i]!] as {p2:number}).p2=i?next[i-1]!:halt;if(skip!==undefined)(ops[skip] as {p2:number}).p2=next.at(-1)!;
 const columns=projected.map((v,i)=>Object.freeze({...descriptors.get(sources[v!.source]!.use)![v!.column]!,name:select.result[i]!.alias??names[v!.source]![v!.column]!}));if(parent)return {columns:Object.freeze(columns)};
 return Object.freeze({ops:Object.freeze(ops),registers:builder.registers,encoding:database.encoding,columns:Object.freeze(columns),parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits});
}

/** Initial resolve.c/select.c-shaped single rowid-table full-scan compiler. */
export function compileTableSelect(select: SelectNode, schema: SchemaGraph, database: BtreeDatabase, maxRows: number, maxWorkUnits = 10_000_000, maxResultBytes = 1_000_000_000, privateStateLimits:PrivateStateLimits=DEFAULT_PRIVATE_STATE_LIMITS, shared?:{builder:SelectProgramBuilder<Op>;parameters:ParameterBuilder;destination:SelectDest}): Program {
  if(shared)return compileTableSelectProducer(select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,shared);
  const builder=new SelectProgramBuilder<Op>();
  builder.reserveCursorsThrough(30);
  const parameters:ParameterBuilder={maximum:0,names:[],named:new Map()};
  const produced=compileTableSelectProducer(select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{builder,parameters,destination:{kind:"output"}});
  if(produced.ops!==builder.ops)throw new JSQLiteError("internal","table producer did not consume enclosing builder");
  builder.ops.push({code:"Halt"});
  return Object.freeze({...produced,ops:builder.finish(),registers:builder.registers});
}

function compileTableSelectProducer(select: SelectNode, schema: SchemaGraph, database: BtreeDatabase, maxRows: number, maxWorkUnits = 10_000_000, maxResultBytes = 1_000_000_000, privateStateLimits:PrivateStateLimits=DEFAULT_PRIVATE_STATE_LIMITS, shared?:{builder:SelectProgramBuilder<Op>;parameters:ParameterBuilder;destination:SelectDest}): Program {
  const builder=shared?.builder??new SelectProgramBuilder<Op>();
  // The parser's bounded flattenSubquery translation retains the generated
  // child in flattenedDerived even though its SrcList has already been spliced.
  // Preserve the accepted outer-ORDER boundary using that semantic carrier;
  // inspecting SQL tokens here would duplicate parser ownership.
  const flattenedOwner=select.from.flattenedDerived??select.arms[0]?.from.flattenedDerived;
  if(select.orderBy.length>0&&flattenedOwner?.select.from.items.length&&!flattenedOwner.select.hasOrderBy&&!flattenedOwner.select.where)
    throw new JSQLiteError("unsupported","this derived table scan shape is not implemented",{unsupportedClassification:"temporary"});
  // json.c's eponymous-only JSON table cursors.  Inputs are evaluated by the
  // ordinary expression VM, then xFilter-shaped state is owned by the statement.
  const jsonNames=new Set(["json_each","json_tree","jsonb_each","jsonb_tree"]);
  if(select.from.items.length===2&&!jsonNames.has(select.from.items[0]!.tableName.toLowerCase())&&jsonNames.has(select.from.items[1]!.tableName.toLowerCase())){
    if(select.hasOrderBy||select.hasGroupBy||select.hasHaving||select.hasDistinct||select.hasLimit)throw new JSQLiteError("unsupported","this mixed JSON table composition is not implemented",{unsupportedClassification:"temporary"});
    const physicalItem=select.from.items[0]!,jsonItem=select.from.items[1]!,table=schema.findTable(physicalItem.tableName);if(!table)throw new JSQLiteError("sqlite",`no such table: ${physicalItem.tableName}`,{code:1});if(table.withoutRowid||table.columns.some(column=>column.generatedExpr))throw new JSQLiteError("unsupported","this table storage shape is not implemented",{unsupportedClassification:"temporary"});
  const parameters:ParameterBuilder=shared?.parameters??{maximum:0,names:[],named:new Map()},ops=builder.ops;let registers=builder.registers;const allocate=()=>{builder.registers=registers;return registers=builder.register()},rowStart=registers+1;registers+=JSON_TABLE_COLUMNS.length;
    const bind=(tree:Expression,jsonAvailable:boolean):Expression=>{if(tree.kind==="column"){const parts=tree.name.split('.'),name=parts.at(-1)!,qualifier=parts.length>1?parts.at(-2)!:null,physicalQualifier=physicalItem.alias??physicalItem.tableName,jsonQualifier=jsonItem.alias??jsonItem.tableName;const physicalIndex=(!qualifier||sqliteIdentifierEqual(qualifier,physicalQualifier))?table.columns.findIndex(column=>sqliteIdentifierEqual(column.name,name)):-1,jsonIndex=jsonAvailable&&(!qualifier||sqliteIdentifierEqual(qualifier,jsonQualifier))?JSON_TABLE_COLUMNS.findIndex(column=>sqliteIdentifierEqual(column,name)):-1;if(physicalIndex>=0&&jsonIndex>=0)throw new JSQLiteError("sqlite",`ambiguous column name: ${name}`,{code:1});if(jsonIndex>=0)return{kind:"register",index:rowStart+jsonIndex};if(physicalIndex>=0){tree.cursor=0;tree.index=isIntegerPrimaryKeyAlias(table,physicalIndex)?-1:physicalIndex;tree.affinity=affinityOf(table.columns[physicalIndex]!.declaredType??"");tree.collation=sqliteAsciiFold(table.columns[physicalIndex]!.collation??"binary") as BuiltinCollation;return tree;}throw new JSQLiteError("sqlite",`no such column: ${tree.name}`,{code:1});}if(tree.kind==="unary")return{...tree,value:bind(tree.value,jsonAvailable)};if(tree.kind==="binary")return{...tree,left:bind(tree.left,jsonAvailable),right:bind(tree.right,jsonAvailable)};if(tree.kind==="collate"||tree.kind==="cast")return{...tree,value:bind(tree.value,jsonAvailable)};if(tree.kind==="call")return{...tree,args:tree.args.map(arg=>bind(arg,jsonAvailable))};return tree;};
    const args=jsonItem.arguments;if(!args||args.length<1||args.length>2||args.some(arg=>!arg.reduction))throw new JSQLiteError("unsupported","this JSON table argument is not implemented",{unsupportedClassification:"temporary"});ops.push({code:"OpenRead",p1:table.rootPage,p2:0});const outerRewind=ops.length;ops.push({code:"Rewind",p1:0,p2:0});const outerLoop=ops.length,input=compileExpressionTree(bind(expressionFromReduction(args[0]!.reduction!),false),ops,allocate,parameters),root=args[1]?.reduction?compileExpressionTree(bind(expressionFromReduction(args[1].reduction),false),ops,allocate,parameters):undefined,innerRewind=ops.length;ops.push({code:"JsonTableRewind",p1:1,input,...(root===undefined?{}:{root}),recursive:jsonItem.tableName.toLowerCase().endsWith("tree"),binaryContainers:jsonItem.tableName.toLowerCase().startsWith("jsonb_"),rowStart,p2:0});const innerLoop=ops.length;let skip:number|null=null;const predicates=[jsonItem.on,select.where].filter((value):value is NonNullable<typeof value>=>value!==null);if(predicates.length){let predicate=bind(expressionFromReduction(predicates[0]!.reduction!),true);for(const item of predicates.slice(1))predicate={kind:"binary",op:"and",left:predicate,right:bind(expressionFromReduction(item.reduction!),true)};const test=compileExpressionTree(predicate,ops,allocate,parameters,undefined,true);skip=ops.length;ops.push({code:"IfNot",p1:test,p2:0});}const outputTrees=select.result.map(result=>{if(!result.reduction)throw new JSQLiteError("unsupported","this mixed JSON projection is not implemented",{unsupportedClassification:"temporary"});return bind(expressionFromReduction(result.reduction),true)}),outputs=outputTrees.map(tree=>compileExpressionTree(tree,ops,allocate,parameters)),out=registers+1;for(const output of outputs){registers++;ops.push({code:"Copy",p1:output,p2:registers});}emitSelectDestination(ops,shared?.destination??{kind:"output"},out,outputs.length);const innerNext=ops.length;if(skip!==null)(ops[skip] as {p2:number}).p2=innerNext;ops.push({code:"JsonTableNext",p1:1,rowStart,p2:innerLoop});const outerNext=ops.length;(ops[innerRewind] as {p2:number}).p2=outerNext;ops.push({code:"Next",p1:0,p2:outerLoop});const halt=ops.length;(ops[outerRewind] as {p2:number}).p2=halt;if(!shared)ops.push({code:"Halt"});builder.registers=registers;return Object.freeze({ops:shared?ops:builder.finish(),registers,encoding:database.encoding,columns:Object.freeze(select.result.map((result,index)=>jsonResultMetadata(result,outputTrees[index]!,[rowStart],[jsonItem.tableName],table))),parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits});
  }
  if(select.from.items.length===2&&select.from.items.every(item=>jsonNames.has(item.tableName.toLowerCase()))){
    if(select.hasOrderBy||select.hasGroupBy||select.hasHaving||select.hasDistinct||select.hasLimit)throw new JSQLiteError("unsupported","this correlated JSON table composition is not implemented",{unsupportedClassification:"temporary"});
    const builder=shared?.builder??new SelectProgramBuilder<Op>(),parameters:ParameterBuilder=shared?.parameters??{maximum:0,names:[],named:new Map()},ops=builder.ops;let registers=builder.registers;const allocate=()=>{builder.registers=registers;return registers=builder.register()};
    const starts=[0,0],bind=(tree:Expression,available:number):Expression=>{
      if(tree.kind==="column"){
        const parts=tree.name.split('.'),name=parts.at(-1)!,qualified=parts.length>1?parts.at(-2)!:null;const candidates=select.from.items.slice(0,available).flatMap((item,index)=>qualified&&!sqliteIdentifierEqual(qualified,item.alias??item.tableName)?[]:[[index,JSON_TABLE_COLUMNS.findIndex(column=>sqliteIdentifierEqual(column,name))] as const]).filter(([,column])=>column>=0);
        if(candidates.length!==1)throw new JSQLiteError("sqlite",candidates.length?`ambiguous column name: ${tree.name}`:`no such column: ${tree.name}`,{code:1});return{kind:"register",index:starts[candidates[0]![0]]!+candidates[0]![1]};
      }
      if(tree.kind==="unary")return{...tree,value:bind(tree.value,available)};if(tree.kind==="binary")return{...tree,left:bind(tree.left,available),right:bind(tree.right,available)};if(tree.kind==="collate"||tree.kind==="cast")return{...tree,value:bind(tree.value,available)};if(tree.kind==="call")return{...tree,args:tree.args.map(value=>bind(value,available))};return tree;
    };
    const open=(index:number):{rewind:number;loop:number}=>{const item=select.from.items[index]!,args=item.arguments;if(!args||args.length<1||args.length>2||args.some(arg=>!arg.reduction))throw new JSQLiteError("unsupported","this JSON table argument is not implemented",{unsupportedClassification:"temporary"});const input=compileExpressionTree(bind(expressionFromReduction(args[0]!.reduction!),index),ops,allocate,parameters),root=args[1]?.reduction?compileExpressionTree(bind(expressionFromReduction(args[1].reduction),index),ops,allocate,parameters):undefined;starts[index]=registers+1;registers+=JSON_TABLE_COLUMNS.length;const rewind=ops.length;ops.push({code:"JsonTableRewind",p1:index,input,...(root===undefined?{}:{root}),recursive:item.tableName.toLowerCase().endsWith("tree"),binaryContainers:item.tableName.toLowerCase().startsWith("jsonb_"),rowStart:starts[index]!,p2:0});return{rewind,loop:ops.length};};
    const outer=open(0),inner=open(1);let skip:number|null=null;if(select.where?.reduction){const predicate=compileExpressionTree(bind(expressionFromReduction(select.where.reduction),2),ops,allocate,parameters,undefined,true);skip=ops.length;ops.push({code:"IfNot",p1:predicate,p2:0});}
    const outputTrees=select.result.map(result=>{if(!result.reduction)throw new JSQLiteError("unsupported","this correlated JSON projection is not implemented",{unsupportedClassification:"temporary"});return bind(expressionFromReduction(result.reduction),2)}),outputs=outputTrees.map(tree=>compileExpressionTree(tree,ops,allocate,parameters)),outputStart=registers+1;for(const output of outputs){registers++;ops.push({code:"Copy",p1:output,p2:registers});}emitSelectDestination(ops,shared?.destination??{kind:"output"},outputStart,outputs.length);const innerNext=ops.length;if(skip!==null)(ops[skip] as {p2:number}).p2=innerNext;ops.push({code:"JsonTableNext",p1:1,rowStart:starts[1]!,p2:inner.loop});const outerNext=ops.length;(ops[inner.rewind] as {p2:number}).p2=outerNext;ops.push({code:"JsonTableNext",p1:0,rowStart:starts[0]!,p2:outer.loop});const halt=ops.length;(ops[outer.rewind] as {p2:number}).p2=halt;if(!shared)ops.push({code:"Halt"});
    builder.registers=registers;return Object.freeze({ops:shared?ops:builder.finish(),registers,encoding:database.encoding,columns:Object.freeze(select.result.map((result,index)=>jsonResultMetadata(result,outputTrees[index]!,starts,select.from.items.map(item=>item.tableName)))),parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits});
  }
  const jsonTableName=select.from.items.length===1?select.from.items[0]!.tableName.toLowerCase():"";
  if(jsonTableName==="json_each"||jsonTableName==="json_tree"||jsonTableName==="jsonb_each"||jsonTableName==="jsonb_tree"){
    if(select.hasDistinct)throw new JSQLiteError("unsupported",`this ${jsonTableName} composition is not implemented`,{unsupportedClassification:"temporary"});
    const source=select.from.items[0]!,args=source.arguments;
    if(args===null||args.length<1||args.length>2||args.some(arg=>!arg.reduction))throw new JSQLiteError("unsupported",`this ${jsonTableName} argument is not implemented`,{unsupportedClassification:"temporary"});
    const builder=shared?.builder??new SelectProgramBuilder<Op>(),parameters:ParameterBuilder=shared?.parameters??{maximum:0,names:[],named:new Map()},ops=builder.ops;let registers=builder.registers;const allocate=()=>{builder.registers=registers;return registers=builder.register()};
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
      const emitSteps=()=>groupedEntries.forEach((entry,index)=>{if(entry){const args=entry.args.map(arg=>{const rebound=arg.kind==="register"?{kind:"register",index:sorted+keyCount+(arg.index-rowStart)} as Expression:arg;return compileExpressionTree(rebound,ops,allocate,parameters)});ops.push({code:"AggStep",name:entry.name,args,p2:states[index]!,collation:entry.collation});}}),emitGroup=()=>{groupedEntries.forEach((entry,index)=>{if(entry)ops.push({code:"AggFinal",name:entry.name,p1:states[index]!})});let reject:number|null=null;if(havingTree){const test=compileExpressionTree(finalized(havingTree),ops,allocate,parameters);reject=ops.length;ops.push({code:"IfNot",p1:test,p2:0});}const out=registers+1;for(let i=0;i<resultTrees.length;i++){registers++;const tree=resultTrees[i]!,source=tree.kind==="aggregate"?states[i]!:saved+groupTrees.findIndex(group=>group.kind==="register"&&tree.kind==="register"&&group.index===tree.index);ops.push({code:"Copy",p1:source,p2:out+i});}emitSelectDestination(ops,shared?.destination??{kind:"output"},out,resultTrees.length);if(reject!==null)(ops[reject] as {p2:number}).p2=ops.length;};
      const step=ops.length;emitSteps();const advance=ops.length;ops.push({code:"SorterNext",p1:sorter,p2:0},{code:"Goto",p2:0});const nextRow=ops.length;(ops[advance] as {p2:number}).p2=nextRow;ops.push({code:"SorterData",p1:sorter,p2:sorted,count:keyCount+JSON_TABLE_COLUMNS.length});const compare=ops.length;ops.push({code:"CompareGroup",left:sorted,right:saved,count:keyCount,keyInfo,jump:step});emitGroup();ops.push({code:"AggReset",registers:states.filter(Boolean)});for(let i=0;i<keyCount;i++)ops.push({code:"Copy",p1:sorted+i,p2:saved+i});ops.push({code:"Goto",p2:step});const finish=ops.length;(ops[advance+1] as {p2:number}).p2=finish;emitGroup();const halt=ops.length;(ops[sort] as {emptyJump:number}).emptyJump=halt;if(!shared)ops.push({code:"Halt"});builder.registers=registers;return Object.freeze({ops:shared?ops:builder.finish(),registers,encoding:database.encoding,columns:Object.freeze(select.result.map(result=>Object.freeze({name:result.alias??expressionName(result),declaredType:null,database:null,table:jsonTableName,origin:null}))),parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits});
    }
    const aggregateOnly=resultTrees.length>0&&resultTrees.every(tree=>tree.kind==="aggregate"&&!tree.distinct&&!tree.filter&&!tree.orderBy.length);
    if(aggregateOnly){
      const states=resultTrees.map(()=>allocate()),rewind=ops.length;ops.push({code:"JsonTableRewind",p1:0,input,...(root===undefined?{}:{root}),recursive:jsonTableName.endsWith("tree"),binaryContainers:jsonTableName.startsWith("jsonb_"),rowStart,p2:0});const loop=ops.length;let skip:number|null=null;if(select.where?.reduction){const predicate=compileExpressionTree(bindColumns(expressionFromReduction(select.where.reduction)),ops,allocate,parameters,undefined,true);skip=ops.length;ops.push({code:"IfNot",p1:predicate,p2:0});}resultTrees.forEach((tree,index)=>{const aggregate=tree as Extract<Expression,{kind:"aggregate"}>,args=aggregate.args.map(arg=>compileExpressionTree(arg,ops,allocate,parameters));ops.push({code:"AggStep",name:aggregate.name,args,p2:states[index]!,collation:aggregate.collation});});const next=ops.length;if(skip!==null)(ops[skip] as {p2:number}).p2=next;ops.push({code:"JsonTableNext",p1:0,rowStart,p2:loop});const finish=ops.length;(ops[rewind] as {p2:number}).p2=finish;resultTrees.forEach((tree,index)=>ops.push({code:"AggFinal",name:(tree as Extract<Expression,{kind:"aggregate"}>).name,p1:states[index]!}));const outputStart=registers+1;for(const state of states){registers++;ops.push({code:"Copy",p1:state,p2:registers});}emitSelectDestination(ops,shared?.destination??{kind:"output"},outputStart,states.length);if(!shared)ops.push({code:"Halt"});builder.registers=registers;return Object.freeze({ops:shared?ops:builder.finish(),registers,encoding:database.encoding,columns:Object.freeze(select.result.map(result=>Object.freeze({name:result.alias??expressionName(result),declaredType:null,database:null,table:jsonTableName,origin:null}))),parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits});
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
      emitSelectDestination(ops,shared?.destination??{kind:"output"},outputStart,outputs.length);
      let limitDone:number|null=null;if(limit){limitDone=ops.length;ops.push({code:"DecrJumpZero",p1:limit.count,p2:0});}
      const next=ops.length;if(predicateJump!==null)(ops[predicateJump] as {p2:number}).p2=next;if(offsetSkip!==null)(ops[offsetSkip] as {p2:number}).p2=next;ops.push({code:"JsonTableNext",p1:0,rowStart,p2:loop});const halt=ops.length;(ops[rewind] as {p2:number}).p2=halt;if(limitDone!==null)(ops[limitDone] as {p2:number}).p2=halt;if(limit)(ops[limit.ifZero] as {p2:number}).p2=halt;if(!shared)ops.push({code:"Halt"});
    }
    if(sorter!==null){
      const next=ops.length;if(predicateJump!==null)(ops[predicateJump] as {p2:number}).p2=next;ops.push({code:"JsonTableNext",p1:0,rowStart,p2:loop});const sort=ops.length;(ops[rewind] as {p2:number}).p2=sort;ops.push({code:"SorterSort",p1:sorter,emptyJump:0},{code:"SorterData",p1:sorter,p2:outputStart,count:outputs.length});let offsetSkip:number|null=null;if(limit?.offset!==undefined){offsetSkip=ops.length;ops.push({code:"IfPos",p1:limit.offset,p2:0,p3:1});}emitSelectDestination(ops,shared?.destination??{kind:"output"},outputStart,outputs.length);let limitDone:number|null=null;if(limit){limitDone=ops.length;ops.push({code:"DecrJumpZero",p1:limit.count,p2:0});}const advance=ops.length;if(offsetSkip!==null)(ops[offsetSkip] as {p2:number}).p2=advance;ops.push({code:"SorterNext",p1:sorter,p2:sort+1});const halt=ops.length;(ops[sort] as {emptyJump:number}).emptyJump=halt;if(limitDone!==null)(ops[limitDone] as {p2:number}).p2=halt;if(limit)(ops[limit.ifZero] as {p2:number}).p2=halt;if(!shared)ops.push({code:"Halt"});
    }
    const columns=star?JSON_EACH_COLUMNS.map(name=>Object.freeze({name,declaredType:null,database:"main",table:jsonTableName,origin:name})):select.result.map((expression,index)=>jsonResultMetadata(expression,resultTrees[index]!,[rowStart],[jsonTableName]));
    builder.registers=registers;return Object.freeze({ops:shared?ops:builder.finish(),registers,encoding:database.encoding,columns:Object.freeze(columns),parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits});
  }
  // Route a compound owner before treating its select-level first-arm carrier
  // as a standalone derived source, which would silently discard later arms.
  if(select.hasCompound){
    const compiled=compileTableCompoundProducer(select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,shared);
    if(compiled&&'ops' in compiled)return compiled;
    if(!shared||!compiled)throw new JSQLiteError('internal','compound destination did not publish columns');
    return Object.freeze({ops:shared.builder.ops,registers:shared.builder.registers,encoding:database.encoding,columns:compiled.columns,parameters:Object.freeze(shared.parameters.names.map(name=>Object.freeze({name}))),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits});
  }
  const derived=select.from.derived;
  // Window rewrite owns the outer ORDER/FILTER before ordinary flatten/scan
  // admission. A retained source supplies rows to its existing coroutine.
  if(derived&&derived.index===0&&select.from.items.length===1&&selectHasWindow(select)&&!select.hasCompound&&!select.hasGroupBy&&!select.hasHaving&&!select.where&&derived.select.from.items.length===1&&!derived.select.from.derived&&!selectHasWindow(derived.select)&&!derived.select.hasDistinct&&!derived.select.hasValues){
    // select.c flattenSubquery runs before window rewrite. Preserve the
    // represented bounded ordinary derived route rather than inventing a
    // second aggregate scan over its synthetic transient schema root.
    const flattened=flattenOrdinaryDerived(select);
    if(!flattened.from.derived&&!selectHasAggregate(derived.select))return compileTableSelect(flattened,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,shared);
    const resolved=resolveTransientArm(select,schema),builder=shared?.builder??new SelectProgramBuilder<Op>();
    const compilation=compileWindowSelectLowering(resolved,database.encoding,database,maxWorkUnits,maxResultBytes,privateStateLimits,schema,undefined,{builder,...(shared?{parameters:shared.parameters}:{}),destination:shared?.destination??{kind:'output'},retainedSource:derived.select});
    if(compilation.program.columns.length!==resolved.result.length)throw new JSQLiteError('unsupported','retained window expression lowering is not implemented',{unsupportedClassification:'temporary'});
    // Only the standalone wrapper is the enclosing Parse owner. Resolve
    // window frame labels only after all late subroutines and the terminal
    // instruction exist (vdbeaux.c sqlite3VdbeResolveLabel/MakeReady).
    if(!shared)builder.ops.push({code:'Halt'});
    return Object.freeze({...compilation.program,ops:shared?builder.ops:builder.finish(),registers:builder.registers});
  }
  const cteSources=compileCteDerivedSources(select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,shared);if(cteSources){if("ops" in cteSources)return cteSources;return Object.freeze({ops:shared!.builder.ops,registers:shared!.builder.registers,encoding:database.encoding,columns:cteSources.columns,parameters:Object.freeze(shared!.parameters.names.map(name=>Object.freeze({name}))),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits});}
  const repeatedView=compileRepeatedImmutableView(select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,shared);if(repeatedView){if("ops" in repeatedView)return repeatedView;return Object.freeze({ops:shared!.builder.ops,registers:shared!.builder.registers,encoding:database.encoding,columns:repeatedView.columns,parameters:Object.freeze(shared!.parameters.names.map(name=>Object.freeze({name}))),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits});}
  const compoundDerived=compileSingleCompoundDerived(select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,shared);if(compoundDerived){if("ops" in compoundDerived)return compoundDerived;return Object.freeze({ops:shared!.builder.ops,registers:shared!.builder.registers,encoding:database.encoding,columns:compoundDerived.columns,parameters:Object.freeze(shared!.parameters.names.map(name=>Object.freeze({name}))),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits});}
  // Keep the accepted derived-table ORDER BY boundary ahead of flattening.
  // flattenSubquery would otherwise erase the derived owner before
  // compileDerivedProducer can reject this physical-table producer shape.
  // VALUES producers have no FROM item and retain their admitted outer sorter.
  if(derived&&derived.index===0&&select.from.items.length===1&&select.orderBy.length>0&&derived.select.from.items.length&&!selectHasWindow(derived.select)&&!derived.select.hasOrderBy&&!derived.select.where)
    throw new JSQLiteError("unsupported","this derived table scan shape is not implemented",{unsupportedClassification:"temporary"});
  const flattened=flattenOrdinaryDerived(select);
  if(flattened!==select)return compileTableSelect(flattened,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,shared);
  const materialized=compileDerivedProducer(select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,shared);if(materialized)return materialized;
  // select.c resolves a CTE SrcItem to its Select before ordinary schema-table
  // lookup. If a represented derived/CTE owner reaches this point, none of the
  // translated coroutine/materialization consumers accepted its complete
  // shape. Reject atomically instead of allowing expandAndResolveSelect() to
  // reinterpret the retained lexical CTE name as a persistent table.
  if(derived)throw new JSQLiteError("unsupported","this derived CTE composition is not implemented",{unsupportedClassification:"temporary"});
  // select.c:selectExpander turns an immutable schema view into its stored
  // generated Select. This first flattenable tranche never reparses schema SQL.
  if(select.from.items.length===1){
    const source=select.from.items[0]!,view=schema.views.get(sqliteAsciiFold(sqlName(source.tableName)));
    if(view){
      const expandedView=flattenImmutableView(select,view);
      return compileTableSelect(expandedView,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,shared);
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
    try{compilation=compileWindowSelectLowering(expanded,database.encoding,database,maxWorkUnits,maxResultBytes,privateStateLimits,schema,undefined,shared);}
    catch(error){if(error instanceof JSQLiteError&&error.kind==="unsupported"){throw new JSQLiteError("unsupported","window functions are not implemented",{unsupportedClassification:"temporary"});}throw error;}
    // Publish only the source-shaped tranche whose complete result list and
    // frame execution were proven by the lowering. A zero-column Program is
    // the atomic unsupported marker for every mixed or incomplete shape.
    if(compilation.program.columns.length===expanded.result.length&&expanded.result.length>0){
      return Object.freeze({...compilation.program,database,maxRows});
    }
    throw new JSQLiteError("unsupported","window functions are not implemented",{unsupportedClassification:"temporary"});
  }
  if(!select.from.items.length&&!select.hasCompound&&!select.hasValues&&!select.hasOrderBy&&!select.hasGroupBy&&!select.hasHaving){
    // select.c WHERE's zero-source candidate uses the same expression owner
    // as scalar result generation, including expr.c subquery destinations.
    return compileScalarSelect(select,database.encoding,maxWorkUnits,maxResultBytes,privateStateLimits,schema,database,maxRows,shared?{...shared,emitRow:(first,count)=>emitSelectDestination(shared.builder.ops,shared.destination,first,count)}:undefined);
  }
  rejectUnsupportedSelectClauses(select, true);
  if (select.from.items.length > 1) {
    if(!shared)return compileInnerTableSelect(select,expanded,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits);
    const whereAccounting=compileInnerTableSelect(select,expanded,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{...shared,ops:shared.builder.ops});
    return Object.freeze({ops:shared.builder.ops,registers:shared.builder.registers,encoding:database.encoding,columns:Object.freeze(expanded.result.map(result=>Object.freeze({name:result.name,declaredType:result.descriptor.declaredType,database:result.descriptor.database,table:result.descriptor.table,origin:result.descriptor.origin}))),parameters:Object.freeze(shared.parameters.names.map(name=>Object.freeze({name}))),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,whereAccounting});
  }
  if (select.from.items.length !== 1) throw new JSQLiteError("unsupported", "joins and complex FROM clauses are not implemented", { unsupportedClassification: "temporary" });
  const tableName = sqlName(select.from.items[0]!.tableName), folded = sqliteAsciiFold(tableName);
  const table = schema.findTable(tableName);
  if (!table) {
    if (schema.views.has(folded)) throw new JSQLiteError("unsupported", "views are not implemented", { unsupportedClassification: "temporary" });
    throw new JSQLiteError("sqlite", `no such table: ${tableName}`, { code: 1 });
  }
  if (table.columns.some(c => c.generatedExpr)) throw new JSQLiteError("unsupported", "this table storage shape is not implemented", { unsupportedClassification: "temporary" });
  // where.c/wherecode.c handoff: choose once from the already-resolved tree and
  // retain the selected physical identity and table-lookup decision unchanged.
  // This lowering slice traverses that persistent index for unsorted
  // single-source plans; covering reads stay on it and non-covering reads use
  // its rowid tail for DeferredSeek. Other selected shapes continue through
  // the existing table path until their seek opcodes are available.

  let selectedOr:WhereLoop|null=null,selectedOrClause:import("./where-plan.ts").WhereClause|null=null;
  let selectedPhysical:PhysicalIndex|null=null,selectedNeedsTableLookup=false,selectedEqualities:readonly IndexConstraintAdmission[]=Object.freeze([]),selectedIndexLower:IndexConstraintAdmission|null=null,selectedIndexUpper:IndexConstraintAdmission|null=null,selectedIndexReverse=false,selectedNSkip=0,selectedNEq=0,selectedInSeekScan=false,selectedLoopTerms:readonly WhereTerm[]=Object.freeze([]),whereAccounting:Program["whereAccounting"],rowidEquality:WhereTerm|null=null,rowidLower:WhereTerm|null=null,rowidUpper:WhereTerm|null=null,rowidReverse=false,rowidOrderConsumed=false,indexOrderConsumed=false;
  try {
    // Covering is determined from every value read after positioning: result,
    // residual WHERE, and sorter inputs. Do not narrow this to projection
    // columns unless the owning WHERE term has first been proven omittable.
    const needed=new Set([
      ...expanded.columnUses.filter(use=>use.source===expanded.sources[0]).map(use=>table.columns[use.columnIndex]!).filter(Boolean),
      ...expanded.result.flatMap(result=>result.source===expanded.sources[0]&&result.columnIndex!==null&&result.columnIndex>=0?[table.columns[result.columnIndex]!]:[]),
      ...select.orderBy.flatMap(term=>{const tokens=term.expr.tokens,name=tokens.length===1?sqlName(tokens[0]!.text):tokens.length===3&&tokens[1]!.text==="."?sqlName(tokens[2]!.text):null;const column=name===null?undefined:table.columns.find(candidate=>sqliteIdentifierEqual(candidate.name,name));return column?[column]:[];}),
    ]);
    if(expanded.result.some(result=>result.source===expanded.sources[0]&&result.columnIndex===-1))needed.add(ROWID_NEEDED as never);
    const orderBy=resolvedWhereOrder(expanded);
    const selection=planWhere(expanded,{neededColumns:[needed],orderBy,planBudget:builder.wherePlanBudget}),loop=selection.path?.loops[0];
    if(loop?.kind==="multi-or"){selectedOr=loop;selectedOrClause=selection.analysis.clause;}
    whereAccounting=Object.freeze({plannerCandidates:selection.plannerCandidates,plannerPaths:selection.plannerPaths});selectedLoopTerms=loop?.terms??Object.freeze([]);
    if(loop?.kind==="table-scan"&&loop.capability){rowidReverse=loop.capability.reverse;rowidOrderConsumed=select.orderBy.length>0&&loop.capability.orderTermsSatisfied===select.orderBy.length;}
    if(loop?.kind==="rowid"&&loop.capability){rowidEquality=loop.capability.rowidEquality?.term??null;rowidLower=loop.capability.rowidLower?.term??null;rowidUpper=loop.capability.rowidUpper?.term??null;rowidReverse=loop.capability.reverse;rowidOrderConsumed=select.orderBy.length>0&&loop.capability.orderTermsSatisfied===select.orderBy.length;}
    if(loop?.kind==="index"&&loop.capability){selectedPhysical=loop.capability.physicalIndex;selectedNeedsTableLookup=loop.capability.needsTableLookup;selectedEqualities=loop.capability.equalitySlots.filter((slot):slot is IndexConstraintAdmission=>slot!==null);selectedNSkip=loop.capability.nSkip;selectedNEq=loop.capability.nEq;selectedInSeekScan=!!loop.capability.inSeekScan;selectedIndexLower=loop.capability.lower;selectedIndexUpper=loop.capability.upper;selectedIndexReverse=loop.capability.reverse;indexOrderConsumed=select.orderBy.length>0&&!loop.capability.equalitySlots.some(admission=>admission?.operator==="in")&&loop.capability.orderTermsSatisfied===select.orderBy.length;}
  } catch(error) { if(error instanceof WherePlanningUnsupportedError)throw new JSQLiteError("unsupported",error.message,{unsupportedClassification:"temporary"});throw error; }
  // expr.c sqlite3ExprCodeGetColumnOfTable maps table columns through the
  // primary index for WITHOUT ROWID, not through declared column ordinals.
  const tableStorageColumn=(column:number):number=>{
    if(!table.withoutRowid)return column;
    const primary=table.indexes.find(index=>index.origin==="primary-key")?.physical;
    const at=primary?.fields.findIndex(field=>field.column===table.columns[column]);
    if(at===undefined||at<0)throw new JSQLiteError("unsupported","WITHOUT ROWID table column layout is not represented",{unsupportedClassification:"temporary"});
    return at;
  };
  const storageColumn=(column:number):number=>{if(!selectedPhysical)return column;const wanted=table.columns[column]!;const at=selectedPhysical.fields.findIndex(field=>field.column===wanted||(field.role==="rowid-tail"&&isIntegerPrimaryKeyAlias(table,column)));return at<0?column:at;};
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
        try{
          // expressionFromReduction retains a qualified name as one semantic
          // column node. Feed its identifier components through the same
          // source-aware resolver as a direct Expr token sequence; otherwise
          // `alias.column` is incorrectly searched as a literal column name.
          const parts=e.name.split('.');
          e.index=resolve(parts.length===2?[{text:parts[0]!},{text:'.'},{text:parts[1]!}]:[{text:e.name}]);e.cursor=0;
        }
        catch(error){const aliases=allowAlias&&!e.name.includes('.')?select.result.filter(item=>item.alias&&sqliteIdentifierEqual(item.alias,e.name)):[];if(aliases[0])return resolveExpression(aliases[0],false);/* resolve.c tries identifier resolution first, then rewrites unresolved TRUE/FALSE to TK_TRUEFALSE. */const truth=sqliteAsciiFold(e.name);if(!e.name.includes('.')&&(truth==="true"||truth==="false"))return{kind:"literal",value:truth==="true"?1n:0n};throw error;}
        if(e.index<0){e.affinity='integer';e.collation='binary';return e;}
        const name=sqliteAsciiFold(table.columns[e.index]!.collation??"binary");if(name!=="binary"&&name!=="nocase"&&name!=="rtrim")throw new JSQLiteError("sqlite",`no such collation sequence: ${table.columns[e.index]!.collation}`,{code:1});e.collation=name;e.affinity=affinityOf(table.columns[e.index]!.declaredType??"");e.index=selectedPhysical&&!selectedNeedsTableLookup?storageColumn(e.index):tableStorageColumn(e.index);e.cursor=0;return e;
      }
      if(e.kind==="unary"||e.kind==="cast"||e.kind==="collate")e.value=assign(e.value);else if(e.kind==="binary"){e.left=assign(e.left);e.right=assign(e.right)}else if(e.kind==="in-subquery")e.left=assign(e.left);else if(e.kind==="in-list"){e.left=assign(e.left);e.values=e.values.map(assign)}else if(e.kind==="between"){e.value=assign(e.value);e.lower=assign(e.lower);e.upper=assign(e.upper)}else if(e.kind==="call"||e.kind==="aggregate")e.args=e.args.map(assign);else if(e.kind==="case"){if(e.operand)e.operand=assign(e.operand);e.pairs=e.pairs.map(x=>[assign(x[0]),assign(x[1])]);if(e.otherwise)e.otherwise=assign(e.otherwise)}return e;
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

  builder.reserveCursorsThrough(30);
  const resultStart=builder.range(projected.length);
  const destination=shared?.destination??{kind:"output"} as SelectDest;
  const tokens=select.tokens,orderAt=tokens.findIndex(t=>t.text.toUpperCase()==="ORDER"),limitAt=tokens.findIndex(t=>t.text.toUpperCase()==="LIMIT");
  // resolve.c:resolveOrderGroupBy walks every ExprList item. Preserve that
  // cardinality here so select.c:pushOntoSorter receives a complete key.
  const orderTerms:{expression:Expression;resultIndex?:number;descending:boolean;nullsLarge:boolean}[]=[];
  if(orderAt>=0&&!rowidOrderConsumed&&!indexOrderConsumed){
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
  const ops=builder.ops;
  const producerExit=builder.label(),scanNext=builder.label();
  const parameters:ParameterBuilder=shared?.parameters??{maximum:0,names:[],named:new Map()};
  const limit=computeLimitRegisters(select,ops,()=>builder.register(),parameters);
  const sorterCursor=builder.cursor(),distinctCursor=builder.cursor(),keyInfo=orderTerms.length===0?null:new KeyInfo({encoding:database.encoding,totalFieldCount:orderTerms.length,keyFieldCount:orderTerms.length,terms:orderTerms.map(term=>({collation:collation(term.expression),desc:term.descending,nullsLarge:term.nullsLarge}))});
  const accessCursor=selectedOr?builder.cursor():selectedPhysical&&selectedNeedsTableLookup?3:0;
  if(selectedPhysical){
    if(selectedNeedsTableLookup){
      if(table.withoutRowid){const primary=table.indexes.find(index=>index.origin==="primary-key")?.physical;if(!primary)throw new JSQLiteError("unsupported","WITHOUT ROWID primary layout is not represented",{unsupportedClassification:"temporary"});ops.push({code:"OpenIndex",p1:table.rootPage,p2:0,physical:primary});}
      else ops.push({code:"OpenRead",p1:table.rootPage,p2:0});
    }
    ops.push({code:"OpenIndex",p1:selectedPhysical.index.rootPage,p2:accessCursor,physical:selectedPhysical});
  }
  else ops.push({code:"OpenRead",p1:table.rootPage,p2:0});
  // Child NameContexts number their SrcList cursors independently, but all of
  // these plans execute in this one VDBE. Relocate child-owned read cursors so
  // an inner scan cannot replace the positioned outer cursor (SQLite keeps
  // SrcList.iCursor unique within the parent Parse/Vdbe).
  builder.reserveCursorsThrough(999);
  const nestedReadCursors=new Map<object,number>();
  for(const nested of scalarPlans.values())for(const source of nested.sources){
    if(nestedReadCursors.has(source))continue;
    const cursor=builder.cursor();
    nestedReadCursors.set(source,cursor);
    if(!nested.source.from.derived?.select.hasCompound)ops.push({code:"OpenRead",p1:source.table.rootPage,p2:cursor});
  }
  if(keyInfo)ops.push({code:"SorterOpen",p1:sorterCursor,keyInfo});
  // select.c's DISTINCT ephemeral key uses the resolved result ExprList
  // collation. In particular, an explicit COLLATE on a direct table column
  // overrides the column's declared collation even though the projection can
  // still use the direct-column fast path.
  if(select.hasDistinct)ops.push({code:"OpenEphemeral",p1:distinctCursor,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:projected.length,keyFieldCount:projected.length,terms:resolvedResultKeyTerms(expanded)})});
  const emitPosition=():FullScanPlan=>{
  let rewindIndex:number,prefixLoop:PrefixLoop|undefined;const inIterators:number[]=[],startNullGuards:number[]=[],equalityNullGuards:number[]=[];
  const boundRhs=(term:WhereTerm):Expression=>{if(term.operator==="is-null")return {kind:"literal",value:null};const expression=resolveExpression(term.expression);if(expression.kind!=="binary")throw new JSQLiteError("internal","rowid bound lost binary expression");return term.originalIndexedOperand==="left"?expression.right:expression.left;};
  const inValues=(term:WhereTerm):Expression[]=>{const expression=resolveExpression(term.expression);if(expression.kind!=="in-list"||expression.negated)throw new JSQLiteError("internal","IN constraint lost value list");return expression.values;};
  if(rowidEquality?.expression.reduction){
    const equality=resolveExpression(rowidEquality.expression);
    if(equality.kind!=="binary")throw new JSQLiteError("internal","rowid equality lost binary expression");
    const rhs=rowidEquality.originalIndexedOperand==="left"?equality.right:equality.left;
    const key=compileExpressionTree(rhs,ops,()=>builder.register(),parameters);
    rewindIndex=ops.length;
    ops.push({code:"SeekRowid",key,p2:0});
  }else if((rowidReverse?rowidUpper:rowidLower)?.expression.reduction){
    const start=rowidReverse?rowidUpper!:rowidLower!,key=compileExpressionTree(boundRhs(start),ops,()=>builder.register(),parameters);rewindIndex=ops.length;ops.push({code:"SeekRowidRange",key,inclusive:start.operator==="le"||start.operator==="ge",reverse:rowidReverse,p2:0});
  }else if(selectedPhysical&&(selectedEqualities.length||selectedIndexLower||selectedIndexUpper)){
    const rangeField=selectedPhysical.fields[selectedNEq];
    const backwardsOnRange=selectedIndexReverse!==!!rangeField?.descending;
    const start=backwardsOnRange?selectedIndexUpper:selectedIndexLower,admissions=start?[...selectedEqualities,start]:selectedEqualities;
    const ordinal=(admission:IndexConstraintAdmission)=>selectedNSkip+admissions.indexOf(admission);
    const skippedKeys=Array.from({length:selectedNSkip},()=>builder.register());
    const skippedAffinities=Array<MemAffinity>(selectedNSkip).fill("blob");
    const prefixEntry=beginPrefixLoop(ops,accessCursor,skippedKeys,skippedAffinities,selectedPhysical.keyInfo,selectedIndexReverse,selectedNSkip);
    const inAdmissions=admissions.filter(admission=>admission?.operator==="in");
    let keys:number[];
    if(inAdmissions.length){
      // where.c:sqlite3WhereEnd advances IN cursors inside-out, resetting
      // each inner cursor on a new outer RHS value.
      const targets=new Map<typeof admissions[number],number>();
      for(const admission of inAdmissions){
        const values=inValues(admission.term).map(value=>compileExpressionTree(value,ops,()=>builder.register(),parameters)),indexRegister=builder.register(),target=builder.register();
        ops.push({code:"Integer",p1:0n,p2:indexRegister});
        const iterator=ops.length;
        ops.push({code:"InListValue",values,indexRegister,target,p2:0,setKey:{affinity:admission.comparison.kind==="comparison"?admission.comparison.affinity:"blob",keyInfo:selectedPhysical.keyInfo,fieldOrdinal:ordinal(admission),reverse:selectedIndexReverse!==!!selectedPhysical.fields[ordinal(admission)]?.descending}});
        inIterators.push(iterator);
        targets.set(admission,target);
      }
      keys=admissions.map(admission=>targets.get(admission)??compileExpressionTree(boundRhs(admission.term),ops,()=>builder.register(),parameters));
    }else keys=admissions.map(admission=>compileExpressionTree(boundRhs(admission.term),ops,()=>builder.register(),parameters));
    // wherecode.c:codeAllEqualityTerms (976–980): nullable equality RHS
    // breaks the whole level before affinity/seek, unlike range addrNxt.
    // Conservatively guard all eq RHS; nonnullable RHS makes this a no-op.
    selectedEqualities.forEach((admission,i)=>{if(admission.operator==="eq"){equalityNullGuards.push(ops.length);ops.push({code:"IsNull",p1:keys[i]!,p2:0});}});
    // wherecode.c Case 4 emits OP_IsNull on the nullable range start RHS
    // before applying affinity or seeking. Equality IS NULL is not a range
    // start: its NULL key must remain searchable.
    if(start&&!start.term.virtualNull){startNullGuards.push(ops.length);ops.push({code:"IsNull",p1:keys[keys.length-1]!,p2:0});}
    const affinities=admissions.map(a=>a.comparison.kind==="comparison"?a.comparison.affinity:"blob" as const);prefixLoop=emitPrefixSeek(ops,prefixEntry,accessCursor,[...skippedKeys,...keys],[...skippedAffinities,...affinities],selectedPhysical.keyInfo,selectedIndexReverse,!!start&&(start.bound==="lower-exclusive"||start.bound==="upper-exclusive"),{enabled:selectedInSeekScan,rowLogEst:selectedPhysical.index.rowLogEst[0]??99,hasRange:!!(selectedIndexLower||selectedIndexUpper)});rewindIndex=prefixLoop.seek;
  }else {
    // wherecode.c Case 4 aStartOp: an unconstrained reverse index loop
    // positions with OP_Last, paired with OP_Prev in sqlite3WhereEnd.
    rewindIndex=ops.length;
    ops.push(selectedPhysical
      ? {code:selectedIndexReverse?"IndexLast":"IndexRewind",p1:accessCursor,p2:0}
      : {code:rowidReverse?"Last":"Rewind",p2:0});
  }
  const selectedPrimarySingleRow=!selectedNSkip&&selectedPhysical?.index.origin==="primary-key"&&selectedNEq===selectedPhysical.keyInfo.keyFieldCount;
  // Pinned where.c whereLoopAddBtreeIndex marks a PRIMARY KEY loop WHERE_ONEROW
  // once nEq reaches nKeyCol. wherecode.c then omits the loop-step opcode. This
  // is safe for WITHOUT ROWID PKs because every key term is non-NULL and unique.
  const scan:FullScanPlan={rewindIndex,loopStart:ops.length,...(prefixLoop?{prefixLoop}:{}),startNullGuards,...(equalityNullGuards.length?{equalityNullGuards}:{}),...(selectedPhysical?{indexCursor:accessCursor}:{}),...(rowidEquality||selectedPrimarySingleRow?{singleRow:true}:{}),...(inIterators.length?{inIterators}:{}),...(selectedPhysical&&selectedIndexReverse?{reverse:true}:{}),...(!selectedPhysical&&rowidReverse?{reverse:true}:{})};
  if(selectedPhysical&&selectedNEq){const seek=prefixLoop??ops[rewindIndex] as Extract<Op,{code:"IndexSeekPrefix"}>;ops.push({code:"IndexPrefixEnd",p1:accessCursor,keys:seek.keys.slice(0,selectedNEq),affinities:seek.affinities.slice(0,selectedNEq),keyInfo:selectedPhysical.keyInfo,p2:0});}
  const rangeBackwards=selectedIndexReverse!==!!selectedPhysical?.fields[selectedNEq]?.descending;
  const indexEnd=rangeBackwards?selectedIndexLower:selectedIndexUpper,indexStart=rangeBackwards?selectedIndexUpper:selectedIndexLower;
  // wherecode.c emits a prefix seek and an Idx* termination check. For a
  // range that begins at the prefix edge in physical scan order, the retained
  // bound is the termination test; no independently reconstructed key exists.
  const rangeEnd=indexEnd??(indexStart&&!selectedEqualities.length?null:indexStart);if(selectedPhysical&&rangeEnd){const key=compileExpressionTree(boundRhs(rangeEnd.term),ops,()=>builder.register(),parameters);if(!rangeEnd.term.virtualNull){startNullGuards.push(ops.length);ops.push({code:"IsNull",p1:key,p2:0});}ops.push({code:"IndexRangeEnd",p1:accessCursor,field:rangeEnd.fieldOrdinal,key,affinity:rangeEnd.comparison.kind==="comparison"?rangeEnd.comparison.affinity:"blob",collation:rangeEnd.comparison.kind==="comparison"?rangeEnd.comparison.collation:"binary",operator:rangeEnd.operator as "lt"|"le"|"gt"|"ge",p2:0});}
  const end=rowidReverse?rowidLower:rowidUpper;if(end?.expression.reduction){const key=compileExpressionTree(boundRhs(end),ops,()=>builder.register(),parameters);ops.push({code:rowidReverse?"RowidLowerBound":"RowidUpperBound",key,inclusive:end.operator==="le"||end.operator==="ge",p2:0});}
  if(selectedPhysical&&selectedNeedsTableLookup){
    if(table.withoutRowid){const primary=table.indexes.find(index=>index.origin==="primary-key")?.physical!;const primaryKeyFields=selectedPhysical.primaryKeyFields;if(primaryKeyFields.length!==primary.keyInfo.keyFieldCount)throw new JSQLiteError("unsupported","WITHOUT ROWID secondary primary-key mapping is not represented",{unsupportedClassification:"temporary"});ops.push({code:"DeferredIndexSeek",p1:accessCursor,p2:0,primaryKeyFields,physical:primary});}
    else ops.push({code:"DeferredSeek",p1:accessCursor,p2:0});
  }
  return scan;
  };
  type Continuation={kind:'ordinary';scan:FullScanPlan}|{kind:'or';returnRegister:number;skipBody:number;covering:PhysicalIndex|null};
  let continuation:Continuation;
  if(!selectedOr)continuation={kind:'ordinary',scan:emitPosition()};
  else {
    const clearAccess=():void=>{
      selectedPhysical=null;selectedNeedsTableLookup=false;selectedEqualities=[];selectedIndexLower=null;selectedIndexUpper=null;rowidEquality=null;rowidLower=null;rowidUpper=null;
    };
    const needed=new Set(table.columns);needed.add(ROWID_NEEDED as never);
    // wherecode.c Case5 recursively invokes WhereBegin for each owned arm.
    // Every level owns its own RowSet and exact Gosub return register while
    // registers, cursors, bindings and the construction budget stay shared.
    const emitOr=(parent:WhereLoop,outer:WhereClause,body?:()=>void):{returnRegister:number;skipBody:number;covering:PhysicalIndex|null}=>{
      const rowset=builder.register(),returnRegister=builder.register(),rowid=builder.register();
      ops.push({code:'Null',p2:rowset});const safeReturn=ops.length;ops.push({code:'Integer',p1:0n,p2:returnRegister});
      const calls:number[]=[],arms=parent.orInfo!.clause.terms.filter(term=>!term.virtual);
      let covering:PhysicalIndex|null=null;
      for(const [ordinal,arm] of arms.entries()){
        const clause=orRuntimeArmClause(arm,0,outer,parent.orInfo!.clause);
        if(!clause)throw new JSQLiteError('internal','selected OR lost owned arm');
        const candidates=btreeLoops(parent.source,0,clause,{forcedIndex:null,neededColumns:needed,orderBy:[],resolved:expanded,planBudget:builder.wherePlanBudget});
        const branch=wherePathSolver([candidates],1).loops[0]!;
        const consumed=branchConsumedTerms(branch,clause,1n<<BigInt(branch.sourceOrdinal));
        const emitArm=(tested=false):void=>{
          const residuals:number[]=[];
          if(!tested)for(const term of arm.info?.kind==='and'?arm.info.clause.terms:[arm]){
            if(term.virtual||consumed.has(term))continue;
            const predicate=resolveExpression(term.expression),truth=compileExpressionTree(predicate,ops,()=>builder.register(),parameters);
            residuals.push(ops.length);ops.push({code:'IfNot',p1:truth,p2:0,residual:true});
          }
          ops.push({code:'Rowid',p2:rowid});const test=ops.length;ops.push({code:'RowSetTest',p1:rowset,p2:0,p3:rowid,p4:ordinal===arms.length-1?-1:ordinal});
          calls.push(ops.length);ops.push({code:'Gosub',p1:returnRegister,p2:0});
          const next=ops.length;for(const residual of residuals)(ops[residual] as {p2:number}).p2=next;(ops[test] as {p2:number}).p2=next;
        };
        if(branch.kind==='multi-or'){
          covering=null;
          emitOr(branch,clause,()=>emitArm(true));
        }else{
          const cap=branch.capability;
          selectedPhysical=cap?.physicalIndex??null;selectedNeedsTableLookup=!!selectedPhysical;
          // Case5 pCov: once any arm disagrees, later arms cannot restore it.
          covering=selectedPhysical&&(ordinal===0||selectedPhysical===covering)?selectedPhysical:null;
          selectedEqualities=cap?.equalitySlots.filter((slot):slot is IndexConstraintAdmission=>slot!==null)??[];selectedNSkip=cap?.nSkip??0;selectedNEq=cap?.nEq??0;selectedInSeekScan=!!cap?.inSeekScan;selectedIndexLower=cap?.lower??null;selectedIndexUpper=cap?.upper??null;selectedIndexReverse=false;
          rowidEquality=cap?.rowidEquality?.term??null;rowidLower=cap?.rowidLower?.term??null;rowidUpper=cap?.rowidUpper?.term??null;rowidReverse=false;
          if(selectedPhysical)ops.push({code:'OpenIndex',p1:selectedPhysical.index.rootPage,p2:accessCursor,physical:selectedPhysical,orBranch:true});
          const scan=emitPosition();
          emitArm();
          sqlite3WhereEnd(ops,scan,scan.loopStart);
        }
      }
      clearAccess();
      const skipBody=ops.length;ops.push({code:'Goto',p2:0});
      (ops[safeReturn] as {p1:bigint}).p1=BigInt(skipBody-1);
      for(const call of calls)(ops[call] as {p2:number}).p2=ops.length;
      if(body){body();ops.push({code:'Return',p1:returnRegister});(ops[skipBody] as {p2:number}).p2=ops.length;}
      return {returnRegister,skipBody,covering};
    };
    continuation={kind:'or',...emitOr(selectedOr,selectedOrClause!)};
  }
  const commonBodyStart=ops.length;
  // select.c/expr.c consume the same Parse register/cursor frontier for
  // the scan, result, and linked scalar producers. Fixed WHERE cursor slots
  // remain reserved; no child publishes or finishes a separate Program.
  // resolve.c pNext references consume the positioned enclosing table row.
  // Linked singleton production must not inherit the child SrcList cursor.
  const physicalScalarBinding:ResolvedExpressionBinding={policy:'scalar',location:ref=>({kind:'cursor',cursor:ref.source===expanded.sources[0]?0:nestedReadCursors.get(ref.source)??ref.source.cursorId})};
  const sharedPhysicalScalar=resolvedScalarSubqueryEmitter(expanded,builder,parameters,{database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits},physicalScalarBinding);
  const compileExpressionSubquery=(expression:SubqueryExpression):number=>{
    const nested=scalarPlans.get(expression.select),source=nested?.sources[0],item=expression.select.result[0];
    if(!nested||!item?.reduction||((expression.kind!=='scalar-subquery')&&(nested.sources.length>1||expression.select.hasDistinct||expression.select.hasGroupBy||expression.select.hasHaving))||(expression.select.hasCompound&&expression.kind!=='scalar-subquery')||expression.select.hasValues||(expression.select.offset&&expression.kind!=='scalar-subquery'))throw new JSQLiteError("unsupported","this expression subquery shape is not implemented",{unsupportedClassification:"temporary"});
    const derived=expression.select.from.derived;
    if(derived){
      // select.c:multiSelect(TK_ALL) feeds the scalar aggregate in the same
      // Parse. expr.c omits Once when resolve.c links an outer NameContext.
      const producer=derived.select,arms=producer.arms;
      if(derived.index!==0||!source||nested.sources.length!==1||!producer.hasCompound||arms.length<2||
         arms.some((arm,index)=>arm.from.items.length!==0||!!arm.where||arm.result.length!==arms[0]!.result.length||arm.result.length===0||arm.result.some(result=>!result.reduction)||(index>0&&arm.operatorFromPrior!=="union-all"))||
         producer.hasOrderBy||producer.limit||producer.offset||producer.hasGroupBy||producer.hasHaving||producer.hasDistinct||
         expression.select.limit||expression.select.hasOrderBy||expression.kind!=="scalar-subquery"||expression.exists||!expression.select.where?.reduction)
        throw new JSQLiteError("unsupported","this derived expression subquery shape is not implemented",{unsupportedClassification:"temporary"});
      const tree=expressionFromReduction(item.reduction);
      if(tree.kind!=="aggregate"||(tree.name!=="count"&&tree.name!=="sum")||tree.distinct||tree.filter||tree.orderBy.length||tree.args.length>1||(tree.name==="sum"&&tree.args.length!==1))
        throw new JSQLiteError("unsupported","this derived scalar aggregate is not implemented",{unsupportedClassification:"temporary"});
      const rows=arms[0]!.result.map(()=>builder.register()),result=builder.register();
      // resolve.c:lookupName already fixed the source and iColumn while walking
      // NameContext.pNext. Bind the same reduction nodes the resolver visited,
      // not another SQL spelling search (which loses implicit rowid and scope).
      const binding:ResolvedExpressionBinding={policy:'derived-predicate',location:(ref,_depth)=>{
        if(ref.source===source){
          const register=rows[ref.columnIndex];
          if(register===undefined)throw new JSQLiteError('unsupported','derived column position is not implemented',{unsupportedClassification:'temporary'});
          return {kind:'register',register,phase:'producer-row'};
        }
        return {kind:'cursor',cursor:ref.source.cursorId};
      }};
      const predicate=bindResolvedExpression(expressionFromReduction(expression.select.where.reduction),resolvedExpressionCarrier(nested,expression.select.where.reduction as Reduction),ref=>ref.cursorId,false,binding);
      const argNodes=resolvedExpressionCarrier(nested,item.reduction as Reduction).children;
      const args=tree.args.map((arg,index)=>bindResolvedExpression(arg,argNodes[index]!,ref=>ref.cursorId,false,binding));
      ops.push({code:"Null",p2:result});
      for(const arm of arms){
        arm.result.forEach((term,index)=>{
          const value=compileExpressionTree(expressionFromReduction(term.reduction!),ops,()=>builder.register(),parameters,compileExpressionSubquery);
          ops.push({code:"Copy",p1:value,p2:rows[index]!});
        });
        const test=compileExpressionTree(predicate,ops,()=>builder.register(),parameters,compileExpressionSubquery);
        const skip=ops.length;ops.push({code:"IfNot",p1:test,p2:0});
        const input=args.map(arg=>compileExpressionTree(arg,ops,()=>builder.register(),parameters,compileExpressionSubquery));
        ops.push({code:"AggStep",name:tree.name,args:input,p2:result,collation:tree.collation});
        (ops[skip] as {p2:number}).p2=ops.length;
      }
      ops.push({code:"AggFinal",name:tree.name,p1:result});
      return result;
    }
    if(expression.kind==='scalar-subquery'&&!(expression.exists&&expressionFromReduction(item.reduction).kind==='aggregate')){
          const result=sharedPhysicalScalar(expression);
      return result;
    }
    if(!source)throw new JSQLiteError('unsupported','this expression subquery shape is not implemented',{unsupportedClassification:'temporary'});
    // resolve.c:lookupName has already selected the lexical NameContext,
    // SrcItem cursor and iColumn. The generated expression reduction is the
    // identity shared by resolution and expr.c-style target lowering.
    const cursorFor=(ref:ResolvedSource)=>nestedReadCursors.get(ref)??ref.cursorId;
    const result=builder.register(),cursor=builder.cursor(),isIn=expression.kind==="in-subquery";
    const aggregate=bindResolvedExpression(expressionFromReduction(item.reduction),resolvedExpressionCarrier(nested,item.reduction as Reduction),cursorFor,true);
    const onceRegister=nested.sources.length>0&&!nested.correlated?builder.register():undefined,onceAt=onceRegister===undefined?-1:ops.length;
    if(onceRegister!==undefined)ops.push({code:"Once",p1:onceRegister,p2:0});
    if(!isIn&&!expression.exists&&aggregate.kind==="aggregate"){
      if(aggregate.distinct||aggregate.filter||aggregate.orderBy.length)throw new JSQLiteError("unsupported","this scalar subquery aggregate is not implemented",{unsupportedClassification:"temporary"});
      ops.push({code:"Null",p2:result});
    }else if(isIn){ops.push({code:"OpenEphemeral",p1:cursor,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:1,keyFieldCount:1,terms:[{collation:collation(expression.left)}]})});}
    else ops.push(expression.exists?{code:"Integer",p1:0n,p2:result}:{code:"Null",p2:result});
    // expr.c:sqlite3CodeSubselect retains a pre-existing LIMIT 0 (and
    // otherwise caps scalar/EXISTS at one row). Initialize SRT_Mem/Exists
    // before the guard, then skip child scan and result disposal entirely.
    // This cursor-local guard is part of the parent Vdbe, not a child Program.
    const childLimit=isIn?computeLimitRegisters(expression.select,ops,()=>builder.register(),parameters):computeScalarLimitRegisters(expression.select,ops,()=>builder.register(),parameters,compileExpressionSubquery);
    const sourceCursor=nestedReadCursors.get(source)??source.cursorId;
    const rewind=ops.length;ops.push({code:"Rewind",p1:sourceCursor,p2:0});const loop=ops.length;let skip:number|undefined;
    if(expression.select.where?.reduction){const predicate=compileExpressionTree(bindResolvedExpression(expressionFromReduction(expression.select.where.reduction),resolvedExpressionCarrier(nested,expression.select.where.reduction as Reduction),cursorFor,true),ops,()=>builder.register(),parameters,compileExpressionSubquery);skip=ops.length;ops.push({code:"IfNot",p1:predicate,p2:0});}
    let done=-1, setLimitExit=-1;
    if(isIn){const value=compileExpressionTree(aggregate,ops,()=>builder.register(),parameters,compileExpressionSubquery);ops.push({code:"IdxInsert",p1:cursor,keyStart:value,keyCount:1});if(childLimit){setLimitExit=ops.length;ops.push({code:"DecrJumpZero",p1:childLimit.count,p2:0});}}
    else if(expression.exists){ops.push({code:"Integer",p1:1n,p2:result});done=ops.length;ops.push({code:"Goto",p2:0});}
    else if(aggregate.kind==="aggregate"){const args=aggregate.args.map(arg=>compileExpressionTree(arg,ops,()=>builder.register(),parameters,compileExpressionSubquery));ops.push({code:"AggStep",name:aggregate.name,args,p2:result,collation:aggregate.collation});}
    else {const value=compileExpressionTree(aggregate,ops,()=>builder.register(),parameters,compileExpressionSubquery);ops.push({code:"Copy",p1:value,p2:result});done=ops.length;ops.push({code:"Goto",p2:0});}
    const next=ops.length;ops.push({code:"Next",p1:sourceCursor,p2:loop});const finish=ops.length;(ops[rewind] as {p2:number}).p2=finish;if(skip!==undefined)(ops[skip] as {p2:number}).p2=next;if(done>=0)(ops[done] as {p2:number}).p2=finish;

    if(!isIn&&!expression.exists&&aggregate.kind==="aggregate")ops.push({code:"AggFinal",name:aggregate.name,p1:result});
    if(onceAt>=0)(ops[onceAt] as {p2:number}).p2=ops.length;
    if(childLimit)(ops[childLimit.ifZero] as {p2:number}).p2=ops.length;
    if(setLimitExit>=0)(ops[setLimitExit] as {p2:number}).p2=ops.length;
    if(isIn){const left=compileExpressionTree(expression.left,ops,()=>builder.register(),parameters,compileExpressionSubquery);ops.push({code:"InSet",p1:cursor,key:left,output:result,affinity:expressionAffinity(aggregate)??"numeric",negated:expression.negated});if(nested.correlated)ops.push({code:"ClearEphemeral",p1:cursor});}
    return result;
  };
  const selectedConstraints=[...selectedEqualities,selectedIndexLower,selectedIndexUpper].filter((item):item is IndexConstraintAdmission=>item!==null);
  // wherecode.c:wherePartIdxExpr may code an exact partial-index predicate, but
  // it never licenses dropping a different query conjunct that merely implied
  // candidate usability. Keep this narrow and structural.
  const partialIdentity=selectedPhysical?.index.partialWhere?expressionStructuralIdentity(selectedPhysical.index.partialWhere):null;
  const allWhereTermsAdmitted=!select.hasSubquery&&(selectedEqualities.length>0||selectedIndexLower!==null||selectedIndexUpper!==null)&&selectedConstraints.length>0&&selectedLoopTerms.filter(term=>!term.virtual).every(term=>(selectedConstraints.some(item=>item.term.id===term.id)&&term.outerJoinSafe.mayOmitResidual)||(partialIdentity!==null&&expressionStructuralIdentity(term.expression)===partialIdentity));
  // wherecode.c marks terms TERM_CODED independently. A rowid bound may omit
  // only its own comparison; it must not suppress an unrelated residual term
  // from the same AND-clause (for example `rowid<7 AND b>2`).
  const rowidConstraints=[rowidEquality,rowidLower,rowidUpper].filter((term):term is WhereTerm=>term!==null),allRowidTermsAdmitted=!select.hasSubquery&&rowidConstraints.length>0&&selectedLoopTerms.filter(term=>!term.virtual).every(term=>rowidConstraints.some(candidate=>candidate.id===term.id&&candidate.outerJoinSafe.mayOmitResidual));
  if (select.where && !(allRowidTermsAdmitted||allWhereTermsAdmitted)) {
    if (!select.where.reduction) throw new JSQLiteError("unsupported", "WHERE predicate is not implemented", { unsupportedClassification: "temporary" });
    // wherecode.c Case5: !untestedTerms disables only the owned OR term.
    // Single-table arm truth is fully evaluated before dedup/Gosub. Other
    // enclosing conjuncts remain independently owned residuals.
    const remainingOrTerms=selectedOr?selectedOrClause!.terms.filter(term=>!term.virtual&&!selectedOr!.terms.includes(term)):null;
    const compilePredicate=(tree:Expression):number=>{
      if(tree.kind==="scalar-subquery"||tree.kind==="in-subquery")return compileExpressionSubquery(tree);
      if(tree.kind==="binary"&&(tree.op==="AND"||tree.op==="OR")){
        const left=compilePredicate(tree.left),output=builder.register(),guard=ops.length;
        ops.push({code:"ShortCircuit",kind:tree.op.toLowerCase() as "and"|"or",p1:left,p2:output,jump:0});
        const right=compilePredicate(tree.right);ops.push({code:"Boolean",kind:tree.op.toLowerCase() as "and"|"or",p1:left,p2:right,p3:output});(ops[guard] as {jump:number}).jump=ops.length;return output;
      }
      return compileExpressionTree(tree,ops,()=>builder.register(),parameters,compileExpressionSubquery);
    };
    for(const expression of remainingOrTerms?remainingOrTerms.map(term=>term.expression):[select.where]){
      const output=compilePredicate(resolveExpression(expression));
      builder.jump(scanNext,{code:"IfNot",p1:output,p2:0,residual:true},(op,pc)=>({...op,p2:pc} as Op));
    }
  }
  const body=ops.length;
  projected.forEach((x,i)=>{if(x.rowid)ops.push({code:"Rowid",p2:resultStart+i});else if(x.column===undefined){const expression=x.expression!,source=compileExpressionTree(expression,ops,()=>builder.register(),parameters,compileExpressionSubquery);ops.push({code:"Copy",p1:source,p2:resultStart+i})}else{const physicalField=selectedPhysical?.fields.findIndex(field=>field.column===table.columns[x.column!]);if(selectedPhysical&&physicalField!==undefined&&physicalField>=0)ops.push({code:"Column",p1:physicalField,p2:resultStart+i,p3:accessCursor});else ops.push({code:"Column",p1:tableStorageColumn(x.column),p2:resultStart+i});if(x.realAffinity)ops.push({code:"RealAffinity",p1:resultStart+i});}});
  if(select.hasDistinct){builder.jump(scanNext,{code:"Found",p1:distinctCursor,keyStart:resultStart,keyCount:projected.length,jump:0},(op,pc)=>({...op,jump:pc} as Op));ops.push({code:"IdxInsert",p1:distinctCursor,keyStart:resultStart,keyCount:projected.length});}
  if(keyInfo){const keyStart=builder.range(orderTerms.length);orderTerms.forEach((term,i)=>{if(term.resultIndex!==undefined)ops.push({code:"Copy",p1:resultStart+term.resultIndex,p2:keyStart+i});else{const source=compileExpressionTree(term.expression,ops,()=>builder.register());ops.push({code:"Copy",p1:source,p2:keyStart+i})}});if(limit)ops.push({code:"IfNotZero",p1:limit.combined,p2:ops.length+1});ops.push({code:"SorterInsert",p1:sorterCursor,keyStart,keyCount:orderTerms.length,payload:resultStart,payloadCount:projected.length,...(limit?{topN:limit.capacity}:{})});}
  if(!keyInfo){
    if(limit?.offset!==undefined)builder.jump(scanNext,{code:"IfPos",p1:limit.offset,p2:0,p3:1},(op,pc)=>({...op,p2:pc} as Op));
    emitSelectDestination(ops,destination,resultStart,projected.length);
    if(limit)builder.jump(producerExit,{code:"DecrJumpZero",p1:limit.count,p2:0},(op,pc)=>({...op,p2:pc} as Op));
  }
  builder.mark(scanNext);
  // Every advance re-enters WHERE positioning/termination and deferred lookup,
  // even when no residual WHERE predicate exists (where.c sqlite3WhereEnd).
  if(continuation.kind==='ordinary')sqlite3WhereEnd(ops,continuation.scan,continuation.scan.loopStart);
  else {
    // sqlite3WhereEnd's covering rewrite uses actual common arm identity,
    // not parent cost slots. Uncovered fields retain deferred table access.
    // Limit the rewrite to this source's common body, never child cursors.
    if(continuation.covering){
      const physical=continuation.covering;
      for(let pc=commonBodyStart;pc<ops.length;pc++){
        const op=ops[pc]!;
        if(op.code==='Column'&&(op.p3??0)===0){
          const column=table.columns.find((_,index)=>tableStorageColumn(index)===op.p1);
          const field=physical.fields.findIndex(field=>field.column===column||
            (field.role==='rowid-tail'&&column!==undefined&&isIntegerPrimaryKeyAlias(table,table.columns.indexOf(column))));
          if(field>=0)ops[pc]={...op,p1:field,p3:accessCursor};
        }else if(op.code==='Rowid'&&(op.p1??0)===0){
          // where.c OP_Rowid -> OP_IdxRowid. Our cursor Rowid consumes
          // the integer tail cached by #loadIndexRecord for an index cursor.
          ops[pc]={...op,p1:accessCursor};
        }
      }
    }
    ops.push({code:'Return',p1:continuation.returnRegister});(ops[continuation.skipBody] as {p2:number}).p2=ops.length;
  }
  if(keyInfo){
    const drain=builder.label(),drainNext=builder.label();
    builder.jump(producerExit,{code:"SorterSort",p1:sorterCursor,emptyJump:0},(op,pc)=>({...op,emptyJump:pc} as Op));
    builder.mark(drain);ops.push({code:"SorterData",p1:sorterCursor,p2:resultStart,count:projected.length});
    if(limit?.offset!==undefined)builder.jump(drainNext,{code:"IfPos",p1:limit.offset,p2:0,p3:1},(op,pc)=>({...op,p2:pc} as Op));
    emitSelectDestination(ops,destination,resultStart,projected.length);
    if(limit)builder.jump(producerExit,{code:"DecrJumpZero",p1:limit.count,p2:0},(op,pc)=>({...op,p2:pc} as Op));
    builder.mark(drainNext);builder.jump(drain,{code:"SorterNext",p1:sorterCursor,p2:0},(op,pc)=>({...op,p2:pc} as Op));
  }
  builder.mark(producerExit);
  if(limit)(ops[limit.ifZero] as {p2:number}).p2=ops.length;
  const columns=expanded.result.map((x,i)=>{
    let descriptor=x.descriptor;
    const expression=projected[i]?.expression;
    if(x.resolution==='expression'&&expression?.kind==='scalar-subquery'&&!expression.exists){const inner=scalarPlans.get(expression.select)?.result[0]?.descriptor;if(inner)descriptor=inner;}
    return Object.freeze({name:x.resolution==='expression'?projected[i]!.name:descriptor.name,declaredType:descriptor.declaredType,database:descriptor.database,table:descriptor.table,origin:descriptor.origin});
  });
  builder.registers=Math.max(builder.registers,...ops.filter((op):op is Extract<Op,{code:"Variable"}>=>op.code==="Variable").map(op=>op.p2),0);
  return Object.freeze({ops,registers:builder.registers,encoding:database.encoding,columns:Object.freeze(columns),parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),table,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,whereAccounting});
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
  case "between": {const x=b as typeof a;return a.negated===x.negated&&sameExpression(a.value,x.value)&&sameExpression(a.lower,x.lower)&&sameExpression(a.upper,x.upper);}
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
function aggregateOrderGroupIndex(select:SelectNode,term:SelectNode["orderBy"][number]):number {
 const order=expressionFromReduction(term.expr.reduction!),identity=order.kind==='collate'?order.value:order;
 return select.groupBy.findIndex(group=>{const key=expressionFromReduction(group.reduction!);return sameExpression(identity,key)||(key.kind==='collate'&&sameExpression(identity,key.value));});
}
function simpleGroupShape(select:SelectNode):boolean {
 if(!select.hasGroupBy||select.hasCompound||select.from.items.some(item=>item.joinFromLeft.error)||reductionHas(select,"over_clause ::= OVER"))return false;
 try {
  const groups=select.groupBy.map(x=>expressionFromReduction(x.reduction!));
  const results=select.result.map(x=>expressionFromReduction(x.reduction!));
  return results.length>0;
 } catch { return false; }
}
function simpleUngroupedAggregateOrder(select:SelectNode):boolean {
 // select.c:sqlite3Select generates one accumulator row without GROUP BY.
 // resolve.c:resolveOrderGroupBy still binds ORDER expressions to that row.
 return !select.hasGroupBy&&!select.hasCompound&&select.hasOrderBy&&
  !reductionHas(select,"over_clause ::= OVER");
}
export function aggregateShapeSupported(select:SelectNode):boolean{return simpleGroupShape(select)||simpleUngroupedAggregateOrder(select)||!(select.hasCompound||select.hasGroupBy||select.hasOrderBy||reductionHas(select,"over_clause ::= OVER"));}


/** select.c SRT_Accumulator fed by a bounded UNION ALL derived source. The
 * producer arms and aggregate consumer remain one Program and one set of
 * execution/resource controls. */
function compileCompoundDerivedAggregate(select:SelectNode,schema:SchemaGraph,database:BtreeDatabase,maxRows:number,maxWorkUnits:number,maxResultBytes:number,privateStateLimits:PrivateStateLimits,parent?:{builder:SelectProgramBuilder<Op>;ops:Op[];parameters:ParameterBuilder;destination:SelectDest}):Program|undefined {
 const derived=select.from.derived;
 // select.c sqlite3Select prep resolves lexical identities before capability
 // decline, including LIMIT0: execution skipping cannot mask prepare errors.
 if(derived&&derived.index===0&&select.from.items.length===1&&derived.select.hasCompound)resolveTransientArm(select,schema);
 if(!derived||derived.index!==0||select.from.items.length!==1||!derived.select.hasCompound||select.where||select.hasGroupBy||select.hasHaving||select.hasDistinct||select.hasOrderBy||(!parent&&(select.limit||select.offset))||derived.select.arms.slice(1).some(arm=>arm.operatorFromPrior!=='union-all'))return undefined;
 // select.c SRT_Coroutine: stream compound rows; only aggregate-local ORDER owns a queue.
 const builder=parent?.builder??new SelectProgramBuilder<Op>(),ops=builder.ops;
 const parameters:ParameterBuilder=parent?.parameters??{maximum:0,names:[],named:new Map()};
 const outerLimit=computeLimitRegisters(select,ops,()=>builder.register(),parameters);
 const producerReturn=builder.register();
 const width=derived.select.arms[0]!.result.length;
 const producerRows=builder.range(width);
 const init=ops.length;ops.push({code:'InitCoroutine',p1:producerReturn,p2:0,p3:0});
 const producerStart=ops.length;
 let columns:Program['columns']|undefined;
 for(const arm of derived.select.arms){
  const single:SelectNode={...derived.select,result:arm.result,from:arm.from,where:arm.where,hasDistinct:arm.hasDistinct,hasGroupBy:false,hasHaving:false,groupBy:Object.freeze([]),having:null,orderBy:Object.freeze([]),limit:null,offset:null,hasOrderBy:false,hasLimit:false,hasCompound:false,arms:Object.freeze([{...arm,operatorFromPrior:null,prior:null,next:null}])};
  let plan:ReturnType<typeof expandAndResolveSelect>;
  try{plan=expandAndResolveSelect(single,schema,null,builder.cursors)}catch(error){if(error instanceof NameResolutionError)throw new JSQLiteError('sqlite',error.message,{code:1});throw error;}
  columns??=plan.result.map(result=>({name:result.name,declaredType:result.descriptor.declaredType,database:result.descriptor.database,table:result.descriptor.table,origin:result.descriptor.origin}));
  if(plan.result.length!==columns.length)throw new JSQLiteError('sqlite','SELECTs to the left and right of UNION ALL do not have the same number of result columns',{code:1});
  const destination:SelectDest={kind:'coroutine',register:producerReturn,first:producerRows};
  if(selectHasAggregate(single))compileAggregateSelect(single,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{builder,ops,parameters,destination});
  else if(plan.sources.length)compileInnerTableSelect(single,plan,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{builder,ops,parameters,destination});
  else{
   let skip=-1;if(single.where?.reduction){const predicate=compileExpressionTree(expressionFromReduction(single.where.reduction),ops,()=>builder.register(),parameters);skip=ops.length;ops.push({code:'IfNot',p1:predicate,p2:0});}
   for(const row of arm.valuesRows??[arm.result]){const first=builder.range(row.length);row.forEach((item,index)=>{const value=compileExpression(item,ops,()=>builder.register(),parameters).register;ops.push({code:'Copy',p1:value,p2:first+index});});emitSelectDestination(ops,destination,first,row.length);}
   if(skip>=0)(ops[skip] as {p2:number}).p2=ops.length;
  }
 }
 ops.push({code:'EndCoroutine',p1:producerReturn,p2:0});
 (ops[init] as {p2:number}).p2=ops.length;
 // Resolve against the derived SrcItem once; phase binding never repeats
 // lookupName against output spellings while the accumulator is stepping.
 const aggregatePlan=resolveTransientArm(select,schema);
 type Entry={name:string;args:Expression[];register:number;collation:BuiltinCollation;orderBy:AggregateOrderTerm[];phase:ResolvedAggregatePhaseCarrier;sorter?:number};const allocate=()=>builder.register();const entries:Entry[]=[];
 const lower=(e:Expression,carrier:ResolvedExpressionCarrier):Expression=>{
  const child=(index:number):ResolvedExpressionCarrier=>{const found=carrier.children[index];if(!found)throw new JSQLiteError('internal','aggregate lowering lost resolved child');return found;};
  if(e.kind==='aggregate'){
   if(e.distinct||e.filter)return e;
   const register=allocate();
   const sortlist=directReduction(carrier.reduction,'sortlist ::=');
   const orderBy=sortlist?sortListItems(sortlist).map(item=>{const node=item.children.find((part):part is Reduction=>part.kind==='reduction'&&(part.signature.startsWith('expr ::=')||part.signature.startsWith('term ::=')));if(!node)throw new JSQLiteError('internal','aggregate order lost expression');return resolvedExpressionCarrier(aggregatePlan,node);}):[];
   const phase:ResolvedAggregatePhaseCarrier=Object.freeze({expression:carrier,arguments:Object.freeze(e.args.map((_,index)=>child(index))),orderBy:Object.freeze(orderBy),accumulator:Object.freeze({phase:'accumulator' as const,register}),output:Object.freeze({phase:'finalized-output' as const,register})});
   entries.push({name:e.name,args:e.args,register,collation:e.collation,orderBy:e.orderBy,phase,...(e.orderBy.length?{sorter:builder.cursor()}:{})});return{kind:'register',index:phase.output.register};
  }
  if(e.kind==='unary'||e.kind==='cast'||e.kind==='collate')e.value=lower(e.value,child(0));
  else if(e.kind==='binary'){e.left=lower(e.left,child(0));e.right=lower(e.right,child(1));}
  else if(e.kind==='call')e.args=e.args.map((arg,index)=>lower(arg,child(index)));
  else if(e.kind==='case'){let index=0;if(e.operand)e.operand=lower(e.operand,child(index++));e.pairs=e.pairs.map(([when,then])=>[lower(when,child(index++)),lower(then,child(index++))]);if(e.otherwise)e.otherwise=lower(e.otherwise,child(index));}
  return e;
 };
 const outputs=select.result.map(item=>lower(expressionFromReduction(item.reduction!),resolvedExpressionCarrier(aggregatePlan,item.reduction! as Reduction)));if(!entries.length||entries.some(entry=>entry.args.some(arg=>arg.kind==='aggregate')))return undefined;
 for(const entry of entries)if(entry.sorter!==undefined)ops.push({code:'SorterOpen',p1:entry.sorter,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:entry.orderBy.length,keyFieldCount:entry.orderBy.length,terms:entry.orderBy.map(term=>({collation:collation(term.expression),desc:term.descending,nullsLarge:term.nullsLarge}))})});
 const row=producerRows;
 const sourceLocation:ResolvedExpressionBinding={policy:'aggregate-source',location:reference=>{
  if(reference.source!==aggregatePlan.sources[0]||reference.columnIndex<0||reference.columnIndex>=columns!.length)throw new JSQLiteError('internal','aggregate source-row location lost identity');
  return{kind:'register',register:row+reference.columnIndex,phase:'source-row'};
 }};
 ops.push({code:'InitCoroutine',p1:producerReturn,p2:0,p3:producerStart});
 const scan=ops.length;ops.push({code:'Yield',p1:producerReturn,p2:0});
 for(const entry of entries){const args=entry.args.map((arg,index)=>compileExpressionTree(bindResolvedExpression(structuredClone(arg),entry.phase.arguments[index]!,ref=>ref.cursorId,true,sourceLocation),ops,allocate));if(entry.sorter===undefined)ops.push({code:'AggStep',name:entry.name,args,p2:entry.phase.accumulator.register,collation:entry.collation});else{const key=builder.range(entry.orderBy.length);entry.orderBy.forEach((term,index)=>{const value=compileExpressionTree(bindResolvedExpression(structuredClone(term.expression),entry.phase.orderBy[index]!,ref=>ref.cursorId,true,sourceLocation),ops,allocate);ops.push({code:'Copy',p1:value,p2:key+index})});const payload=builder.range(args.length);args.forEach((arg,index)=>ops.push({code:'Copy',p1:arg,p2:payload+index}));ops.push({code:'SorterInsert',p1:entry.sorter,keyStart:key,keyCount:entry.orderBy.length,payload,payloadCount:args.length})}
 }
 ops.push({code:'Goto',p2:scan});
 (ops[scan] as {p2:number}).p2=ops.length;
 for(const entry of entries){if(entry.sorter!==undefined){const args=builder.range(entry.args.length);const at=ops.length;ops.push({code:'SorterSort',p1:entry.sorter,emptyJump:0},{code:'SorterData',p1:entry.sorter,p2:args,count:entry.args.length},{code:'AggStep',name:entry.name,args:Array.from({length:entry.args.length},(_,i)=>args+i),p2:entry.phase.accumulator.register,collation:entry.collation},{code:'SorterNext',p1:entry.sorter,p2:at+1});(ops[at] as {emptyJump:number}).emptyJump=ops.length}ops.push({code:'AggFinal',name:entry.name,p1:entry.register})}
 // select.c:finalizeAggFunctions precedes selectInnerLoop on the same Parse.
 const outputStart=builder.range(outputs.length),destination:SelectDest=parent?.destination??{kind:'output'};
 outputs.forEach((output,index)=>{const value=compileExpressionTree(output,ops,allocate,parameters);ops.push({code:'Copy',p1:value,p2:outputStart+index})});
 const offsetAt=outerLimit?.offset!==undefined?ops.length:-1;
 if(offsetAt>=0)ops.push({code:'IfPos',p1:outerLimit!.offset!,p2:0,p3:1});
 emitSelectDestination(ops,destination,outputStart,outputs.length);
 const done=ops.length;
 if(offsetAt>=0)(ops[offsetAt] as {p2:number}).p2=done;
 if(outerLimit)(ops[outerLimit.ifZero] as {p2:number}).p2=done;
 if(!parent)ops.push({code:'Halt'});
 return Object.freeze({ops:parent?ops:builder.finish(),registers:builder.registers,columns:Object.freeze(select.result.map(item=>Object.freeze({name:expressionName(item),declaredType:null,database:null,table:null,origin:null}))),parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,encoding:database.encoding});
}

/** select.c restriction (7) prevents flattening a FROM term whose producer has
 * no FROM clause. Feed that producer's result events into the parent
 * SRT_Accumulator in the same VDBE program. This bounded bridge consumes
 * projected producer registers without opening a physical derived alias;
 * multirow materialization remains outside this branch. */
function compileZeroSourceDerivedCount(select:SelectNode,schema:SchemaGraph,database:BtreeDatabase,maxRows:number,maxWorkUnits:number,maxResultBytes:number,privateStateLimits:PrivateStateLimits,parent?:{builder:SelectProgramBuilder<Op>;ops:Op[];parameters:ParameterBuilder;destination:SelectDest}):Program|undefined {
 const derived=select.from.derived;
 if(!derived||derived.index!==0||select.from.items.length!==1||derived.select.from.items.length!==0||select.result.length!==1||select.hasGroupBy||select.hasDistinct)return undefined;
 if(!select.result[0]!.reduction)return undefined;
 const result=expressionFromReduction(select.result[0]!.reduction);
 const admittedAggregate=(name:string,args:number):boolean=>
   name==="count"?args<=1:name==="group_concat"?args===1||args===2:name==="string_agg"?args===2:
   (name==="sum"||name==="avg"||name==="total"||name==="min"||name==="max")&&args===1;
 if(result.kind!=="aggregate"||!admittedAggregate(result.name,result.args.length)||
    (result.distinct&&result.args.length!==1)||(result.orderBy.length>0&&result.args.length===0))return undefined;
 if(parent&&!derived.select.hasCompound&&!derived.select.hasValues){
  // select.c:flattenSubquery restriction (7): keep the zero-source producer
  // separate, but feed its result event directly into the aggregate owner.
  const source=derived.select;
  if(source.hasCompound||source.hasValues||source.result.length===0||source.result.some(item=>!item.reduction)||
     (source.where&&!source.where.reduction))return undefined;
  // The inner GROUP BY owns its accumulators separately from the outer
  // aggregate. At most one accepted candidate reaches each count step.
  const innerHaving=source.having?.reduction?expressionFromReduction(source.having.reduction):null;
  const innerAggregates: Extract<Expression,{kind:'aggregate'}>[]=[];
  const inspectInner=(tree:Expression):boolean=>{
    if(tree.kind==='aggregate'){
      if(!admittedAggregate(tree.name,tree.args.length)||(tree.orderBy.length>0&&tree.args.length===0)||(tree.distinct&&tree.args.length!==1))return false;
      innerAggregates.push(tree);return true;
    }
    if(tree.kind==='scalar-subquery'||tree.kind==='in-subquery')return false;
    if(tree.kind==='unary'||tree.kind==='cast'||tree.kind==='collate')return inspectInner(tree.value);
    if(tree.kind==='binary')return inspectInner(tree.left)&&inspectInner(tree.right);
    if(tree.kind==='between')return inspectInner(tree.value)&&inspectInner(tree.lower)&&inspectInner(tree.upper);
    if(tree.kind==='in-list')return inspectInner(tree.left)&&tree.values.every(inspectInner);
    if(tree.kind==='call')return tree.args.every(inspectInner);
    if(tree.kind==='case')return (!tree.operand||inspectInner(tree.operand))&&tree.pairs.every(([when,then])=>inspectInner(when)&&inspectInner(then))&&(!tree.otherwise||inspectInner(tree.otherwise));
    return true;
  };
  if(source.hasHaving&&(!source.hasGroupBy||!innerHaving))return undefined;
  // resolve.c:resolveSelectStep and resolveOrderGroupBy validate the inner
  // SELECT independently. A single no-FROM candidate has no row ordering to
  // change, but an ORDER term can still fail preparation (even at LIMIT 0).
  if(source.hasOrderBy||source.hasDistinct||source.hasGroupBy||source.hasHaving){
    try{expandAndResolveSelect(source,schema)}catch(error){if(error instanceof NameResolutionError)throw new JSQLiteError("sqlite",error.message,{code:1});throw error;}
  }
  if(innerHaving&&(!inspectInner(innerHaving)||(selectHasAggregate(source)&&innerAggregates.length===0)))return undefined;
  // resolve.c:resolveOrderGroupBy binds against the derived table's
  // selectExpander column names before select.c suppresses the sorter for
  // this single finalized accumulator. This transient schema entry is used
  // only for name resolution; the producer below emits its actual row event.
  let derivedNames:readonly string[]=[];
  if(select.hasOrderBy||select.where||result.args.length||result.filter||result.orderBy.length||select.hasHaving){
    const names=uniqueTransientColumnNames(source.result.map(expression=>expression.alias??expressionName(expression)));
    derivedNames=names;
    const columns=names.map(name=>Object.freeze({szEst:0,name,declaredType:null,affinity:"blob" as const,defaultExpr:null,generatedExpr:null,defaultIndex:null,notNull:false,primaryKeyPosition:null,unique:false,collation:null,generatedStorage:null,checks:Object.freeze([])}));
    const tableName=select.from.items[0]!.tableName;
    const table:TableNode=freezeTransientTable({integerPrimaryKey:null,szTabRow:1,nRowLogEst:200,hasStat1:false,kind:"table",name:tableName,tableName,rootPage:0,sql:"",columns:Object.freeze(columns),indexes:[],withoutRowid:false,primaryKey:Object.freeze([]),primaryKeyTerms:Object.freeze([]),storageKey:Object.freeze([]),checks:Object.freeze([]),foreignKeys:Object.freeze([]),referencedBy:Object.freeze([])});
    const {derived: _derived,...from}=select.from;
    const resolved:SelectNode={...select,from,having:null};
    // resolve.c:resolveSelectStep reports aggregate misuse in WHERE before
    // ORDER binding. The current TS resolver checks this later in lowering.
    if(select.where?.reduction){
      const rejectAggregate=(tree:Expression):void=>{
        if(tree.kind==="aggregate")throw new JSQLiteError("sqlite",`misuse of aggregate: ${tree.name}()`,{code:1});
        if(tree.kind==="unary"||tree.kind==="cast"||tree.kind==="collate")rejectAggregate(tree.value);
        else if(tree.kind==="binary"){rejectAggregate(tree.left);rejectAggregate(tree.right);}
        else if(tree.kind==="between"){rejectAggregate(tree.value);rejectAggregate(tree.lower);rejectAggregate(tree.upper);}
        else if(tree.kind==="in-list"){rejectAggregate(tree.left);tree.values.forEach(rejectAggregate);}
        else if(tree.kind==="in-subquery")rejectAggregate(tree.left);
        else if(tree.kind==="call")tree.args.forEach(rejectAggregate);
        else if(tree.kind==="case"){if(tree.operand)rejectAggregate(tree.operand);for(const [when,then] of tree.pairs){rejectAggregate(when);rejectAggregate(then);}if(tree.otherwise)rejectAggregate(tree.otherwise);}
      };
      rejectAggregate(expressionFromReduction(select.where.reduction));
    }
    try{expandAndResolveSelect(resolved,schema.withTransientTable(table))}catch(error){if(error instanceof NameResolutionError)throw new JSQLiteError("sqlite",error.message,{code:1});throw error;}
  }
  const {builder,ops,parameters,destination}=parent,allocate=()=>builder.register();
  const accumulator=allocate(),output=allocate();
  // expr.c:AggInfo collects each distinct aggregate expression used by the
  // result or HAVING before generating any row loop. Count arguments share
  // the projected derived-row registers, but not another count's accumulator.
  // resolve.c forbids an aggregate nested inside an aggregate's FILTER or
  // argument, even when LIMIT suppresses all candidate rows.
  const rejectNested=(tree:Expression):void=>{
    if(tree.kind==="aggregate")throw new JSQLiteError("sqlite",`misuse of aggregate function ${tree.name}()`,{code:1});
    if(tree.kind==="unary"||tree.kind==="cast"||tree.kind==="collate")rejectNested(tree.value);
    else if(tree.kind==="binary"){rejectNested(tree.left);rejectNested(tree.right);}
    else if(tree.kind==="between"){rejectNested(tree.value);rejectNested(tree.lower);rejectNested(tree.upper);}
    else if(tree.kind==="in-list"){rejectNested(tree.left);tree.values.forEach(rejectNested);}
    else if(tree.kind==="call")tree.args.forEach(rejectNested);
    else if(tree.kind==="case"){if(tree.operand)rejectNested(tree.operand);for(const [when,then] of tree.pairs){rejectNested(when);rejectNested(then);}if(tree.otherwise)rejectNested(tree.otherwise);}
  };
  const sameCount=(left:Expression,right:Expression):boolean=>left.kind==="aggregate"&&right.kind==="aggregate"&&left.name===right.name&&left.distinct===right.distinct&&
    (left.filter===null?right.filter===null:right.filter!==null&&sameExpression(left.filter,right.filter))&&
    left.orderBy.length===right.orderBy.length&&left.orderBy.every((term,i)=>term.descending===right.orderBy[i]!.descending&&term.nullsLarge===right.orderBy[i]!.nullsLarge&&sameExpression(term.expression,right.orderBy[i]!.expression))&&sameExpression(left,right);
  // select.c:codeDistinct compares this aggregate's argument to earlier
  // accepted arguments before AggStep. The zero-FROM source offers at most
  // one accepted candidate, hence no prior argument to collide with.
  const counts: {tree:Expression;acc:number;value:number;args:Expression[]}[]=[{tree:result,acc:accumulator,value:output,args:result.args}];
  const collectHaving=(tree:Expression):void=>{
    if(tree.kind==="aggregate"){
      if(!admittedAggregate(tree.name,tree.args.length)||(tree.distinct&&tree.args.length!==1)||(tree.orderBy.length>0&&tree.args.length===0))
        throw new JSQLiteError("unsupported","this derived count HAVING aggregate is not implemented",{unsupportedClassification:"temporary"});
      if(!counts.some(entry=>sameCount(entry.tree,tree)))counts.push({tree,acc:allocate(),value:allocate(),args:tree.args});
      return;
    }
    if(tree.kind==="unary"||tree.kind==="cast"||tree.kind==="collate")collectHaving(tree.value);
    else if(tree.kind==="binary"){collectHaving(tree.left);collectHaving(tree.right);}
    else if(tree.kind==="between"){collectHaving(tree.value);collectHaving(tree.lower);collectHaving(tree.upper);}
    else if(tree.kind==="in-list"){collectHaving(tree.left);tree.values.forEach(collectHaving);}
    else if(tree.kind==="call")tree.args.forEach(collectHaving);
    else if(tree.kind==="case"){if(tree.operand)collectHaving(tree.operand);for(const [when,then] of tree.pairs){collectHaving(when);collectHaving(then);}if(tree.otherwise)collectHaving(tree.otherwise);}
  };
  if(select.having?.reduction)collectHaving(expressionFromReduction(select.having.reduction));
  for(const entry of counts){for(const arg of entry.args)rejectNested(arg);if(entry.tree.kind==="aggregate"){
    if(entry.tree.filter)rejectNested(entry.tree.filter);
    for(const term of entry.tree.orderBy)rejectNested(term.expression);
  }}

  // select.c tag-select-0650 computes this SELECT's limit before its
  // nonflattenable FROM producer; the producer has its own limit below.
  const outerLimit=computeLimitRegisters(select,ops,allocate,parameters);
  ops.push({code:"Null",p2:accumulator});
  for(const entry of counts.slice(1))ops.push({code:"Null",p2:entry.acc});
  const limit=computeLimitRegisters(source,ops,allocate,parameters);
  const innerAccs=innerAggregates.map(tree=>({tree,register:allocate()}));
  for(const entry of innerAccs)ops.push({code:'Null',p2:entry.register});
  let whereSkip=-1,offsetSkip=-1;
  if(source.where){const predicate=compileExpressionTree(expressionFromReduction(source.where.reduction!),ops,allocate,parameters);whereSkip=ops.length;ops.push({code:"IfNot",p1:predicate,p2:0});}
  const values=source.result.map(item=>compileExpressionTree(expressionFromReduction(item.reduction!),ops,allocate,parameters));
  let innerHavingSkip=-1;
  if(source.having?.reduction){
    // updateAccumulator evaluates each FILTER before its argument and step.
    // DISTINCT has no earlier value to collide with in a single-row group.
    const names=uniqueTransientColumnNames(source.result.map(item=>item.alias??expressionName(item)));
    const bindInnerColumn=(tree:Expression):Expression=>{
      if(tree.kind==='column'){
        const index=names.findIndex(name=>sqliteIdentifierEqual(name,sqlName(tree.name)));
        if(index<0)throw new JSQLiteError('sqlite',`no such column: ${tree.name}`,{code:1});
        return {kind:'register',index:values[index]!};
      }
      if(tree.kind==='aggregate')throw new JSQLiteError('sqlite',`misuse of aggregate function ${tree.name}()`,{code:1});
      if(tree.kind==='unary'||tree.kind==='cast'||tree.kind==='collate')return {...tree,value:bindInnerColumn(tree.value)};
      if(tree.kind==='binary')return {...tree,left:bindInnerColumn(tree.left),right:bindInnerColumn(tree.right)};
      if(tree.kind==='between')return {...tree,value:bindInnerColumn(tree.value),lower:bindInnerColumn(tree.lower),upper:bindInnerColumn(tree.upper)};
      if(tree.kind==='in-list')return {...tree,left:bindInnerColumn(tree.left),values:tree.values.map(bindInnerColumn)};
      if(tree.kind==='call')return {...tree,args:tree.args.map(bindInnerColumn)};
      if(tree.kind==='case')return {...tree,operand:tree.operand?bindInnerColumn(tree.operand):null,pairs:tree.pairs.map(([when,then])=>[bindInnerColumn(when),bindInnerColumn(then)]),otherwise:tree.otherwise?bindInnerColumn(tree.otherwise):null};
      return tree;
    };
    for(const entry of innerAccs){
      let filterSkip=-1;
      if(entry.tree.filter){const filter=compileExpressionTree(bindInnerColumn(entry.tree.filter),ops,allocate,parameters);filterSkip=ops.length;ops.push({code:'IfNot',p1:filter,p2:0});}
      // updateAccumulator codes ORDER keys ahead of the argument vector.
      // There is at most one accepted group row: no runtime sorter can
      // reorder it, but key expressions must still be bound/evaluated.
      for(const term of entry.tree.orderBy)compileExpressionTree(bindInnerColumn(term.expression),ops,allocate,parameters);
      const args=entry.tree.args.map(arg=>compileExpressionTree(bindInnerColumn(arg),ops,allocate,parameters));
      ops.push({code:'AggStep',name:entry.tree.name,args,p2:entry.register,collation:entry.tree.args[0]?collation(entry.tree.args[0]):'binary'});
      if(filterSkip>=0)(ops[filterSkip] as {p2:number}).p2=ops.length;
    }
    for(const entry of innerAccs)ops.push({code:'AggFinal',name:entry.tree.name,p1:entry.register});
    // select.c GROUP BY result generator evaluates HAVING after the group
    // is formed but before selectInnerLoop delivers it to the destination.
    const bindInnerHaving=(tree:Expression):Expression=>{
      if(tree.kind==='aggregate'){
        const entry=innerAccs.find(entry=>sameCount(entry.tree,tree));
        if(!entry)throw new JSQLiteError('unsupported','this inner HAVING aggregate is not implemented',{unsupportedClassification:'temporary'});
        return {kind:'register',index:entry.register};
      }
      if(tree.kind==='column')return bindInnerColumn(tree);
      if(tree.kind==='unary'||tree.kind==='cast'||tree.kind==='collate')return {...tree,value:bindInnerHaving(tree.value)};
      if(tree.kind==='binary')return {...tree,left:bindInnerHaving(tree.left),right:bindInnerHaving(tree.right)};
      if(tree.kind==='between')return {...tree,value:bindInnerHaving(tree.value),lower:bindInnerHaving(tree.lower),upper:bindInnerHaving(tree.upper)};
      if(tree.kind==='in-list')return {...tree,left:bindInnerHaving(tree.left),values:tree.values.map(bindInnerHaving)};
      if(tree.kind==='call')return {...tree,args:tree.args.map(bindInnerHaving)};
      if(tree.kind==='case')return {...tree,operand:tree.operand?bindInnerHaving(tree.operand):null,pairs:tree.pairs.map(([when,then])=>[bindInnerHaving(when),bindInnerHaving(then)]),otherwise:tree.otherwise?bindInnerHaving(tree.otherwise):null};
      return tree;
    };
    const predicate=compileExpressionTree(bindInnerHaving(expressionFromReduction(source.having.reduction)),ops,allocate,parameters);
    innerHavingSkip=ops.length;ops.push({code:'IfNot',p1:predicate,p2:0});
  }
  // selectInnerLoop applies OFFSET only to rows accepted by GROUP BY HAVING.
  if(limit?.offset!==undefined){offsetSkip=ops.length;ops.push({code:"IfPos",p1:limit.offset,p2:0,p3:1});}
  // select.c aggregate GROUP BY over a zero-source nonaggregate SELECT
  // has at most one group when its WHERE accepted the sole candidate.
  // Name/ordinal/aggregate restrictions are checked by resolve.c above.
  // selectInnerLoop codeDistinct suppresses duplicate result rows before
  // delivering to the destination. This no-FROM producer has at most one
  // candidate, so it can never be a duplicate; retain its projection and
  // OFFSET ordering without opening a redundant ephemeral set.
  // SRT_Accumulator counts the producer's emitted row, not its value.
  // The derived row's projected registers are available only after its own
  // WHERE/OFFSET/LIMIT gates. Bind the outer WHERE to that one-row register,
  // not to a fabricated physical table cursor.
  let outerWhereSkip=-1;
  const bind=(tree:Expression):Expression=>{
      if(tree.kind==="column"){
        const parts=tree.name.split(".").map(sqlName);
        const qualifier=select.from.items[0]!.alias??select.from.items[0]!.tableName;
        const index=derivedNames.findIndex(name=>sqliteIdentifierEqual(name,parts.at(-1)!));
        if(parts.length>2||(parts.length===2&&!sqliteIdentifierEqual(parts[0]!,qualifier))||index<0)
          throw new JSQLiteError("sqlite",`no such column: ${tree.name}`,{code:1});
        return {kind:"register",index:values[index]!};
      }
      if(tree.kind==="aggregate")throw new JSQLiteError("sqlite",`misuse of aggregate: ${tree.name}()`,{code:1});
      if(tree.kind==="scalar-subquery"||tree.kind==="in-subquery")throw new JSQLiteError("unsupported","derived count WHERE subquery is not implemented",{unsupportedClassification:"temporary"});
      if(tree.kind==="unary"||tree.kind==="cast"||tree.kind==="collate")return {...tree,value:bind(tree.value)};
      if(tree.kind==="binary")return {...tree,left:bind(tree.left),right:bind(tree.right)};
      if(tree.kind==="between")return {...tree,value:bind(tree.value),lower:bind(tree.lower),upper:bind(tree.upper)};
      if(tree.kind==="in-list")return {...tree,left:bind(tree.left),values:tree.values.map(bind)};
      if(tree.kind==="call")return {...tree,args:tree.args.map(bind)};
      if(tree.kind==="case")return {...tree,operand:tree.operand?bind(tree.operand):null,pairs:tree.pairs.map(([when,then])=>[bind(when),bind(then)]),otherwise:tree.otherwise?bind(tree.otherwise):null};
      return tree;
  };
  if(select.where?.reduction){
    const predicate=compileExpressionTree(bind(expressionFromReduction(select.where.reduction)),ops,allocate,parameters);
    outerWhereSkip=ops.length;ops.push({code:"IfNot",p1:predicate,p2:0});
  }
  // select.c:tag-select-0820 steps AggInfo with this row's argument, not
  // its cardinality, for count(expr); NULL arguments do not increment count.
  for(const entry of counts){
    const filter=entry.tree.kind==="aggregate"?entry.tree.filter:null;
    // select.c:updateAccumulator tests FILTER before coding arguments or
    // distinct keys, and jumps directly to the next aggregate function.
    let filterSkip=-1;
    if(filter){const test=compileExpressionTree(bind(filter),ops,allocate,parameters);filterSkip=ops.length;ops.push({code:"IfNot",p1:test,p2:0});}
    // select.c:updateAccumulator codes ORDER keys before its argument and
    // inserts them into the aggregate's sorter. With <=1 accepted candidate,
    // the sorter can only replay this row; still resolve/code each key.
    if(entry.tree.kind==="aggregate")for(const term of entry.tree.orderBy)compileExpressionTree(bind(term.expression),ops,allocate,parameters);
    const args=entry.args.map(arg=>compileExpressionTree(bind(arg),ops,allocate,parameters));
    ops.push({code:"AggStep",name:entry.tree.kind==="aggregate"?entry.tree.name:"count",args,p2:entry.acc,collation:entry.args[0]?collation(entry.args[0]):"binary"});
    if(filterSkip>=0)(ops[filterSkip] as {p2:number}).p2=ops.length;
  }
  const done=ops.length;
  if(outerWhereSkip>=0)(ops[outerWhereSkip] as {p2:number}).p2=done;
  if(offsetSkip>=0)(ops[offsetSkip] as {p2:number}).p2=done;
  if(innerHavingSkip>=0)(ops[innerHavingSkip] as {p2:number}).p2=done;
  if(whereSkip>=0)(ops[whereSkip] as {p2:number}).p2=done;
  if(limit)(ops[limit.ifZero] as {p2:number}).p2=done;
  for(const entry of counts)ops.push({code:"AggFinal",name:entry.tree.kind==="aggregate"?entry.tree.name:"count",p1:entry.acc},{code:"Copy",p1:entry.acc,p2:entry.value});
  // select.c:sqlite3Select tag-select-0820 evaluates HAVING after AggFinal
  // and before selectInnerLoop publishes the final row. Reuse the accumulator
  // register for the already-finalized count result (including empty input).
  const finalizedHaving=(tree:Expression):Expression=>{
    if(tree.kind==="aggregate"){
      const entry=counts.find(candidate=>sameCount(candidate.tree,tree));
      if(!entry)throw new JSQLiteError("unsupported","this derived count HAVING aggregate is not implemented",{unsupportedClassification:"temporary"});
      return {kind:"register",index:entry.value};
    }
    if(tree.kind==="column"||tree.kind==="scalar-subquery"||tree.kind==="in-subquery")throw new JSQLiteError("unsupported","this derived count HAVING expression is not implemented",{unsupportedClassification:"temporary"});
    if(tree.kind==="unary"||tree.kind==="collate"||tree.kind==="cast")return {...tree,value:finalizedHaving(tree.value)};
    if(tree.kind==="binary")return {...tree,left:finalizedHaving(tree.left),right:finalizedHaving(tree.right)};
    if(tree.kind==="between")return {...tree,value:finalizedHaving(tree.value),lower:finalizedHaving(tree.lower),upper:finalizedHaving(tree.upper)};
    if(tree.kind==="in-list")return {...tree,left:finalizedHaving(tree.left),values:tree.values.map(finalizedHaving)};
    if(tree.kind==="call")return {...tree,args:tree.args.map(finalizedHaving)};
    if(tree.kind==="case")return {...tree,operand:tree.operand?finalizedHaving(tree.operand):null,pairs:tree.pairs.map(([when,then])=>[finalizedHaving(when),finalizedHaving(then)]),otherwise:tree.otherwise?finalizedHaving(tree.otherwise):null};
    return tree;
  };
  let havingReject=-1;
  if(select.having?.reduction){const test=compileExpressionTree(finalizedHaving(expressionFromReduction(select.having.reduction)),ops,allocate,parameters);havingReject=ops.length;ops.push({code:"IfNot",p1:test,p2:0});}
  let outerOffset=-1;
  if(outerLimit?.offset!==undefined){outerOffset=ops.length;ops.push({code:"IfPos",p1:outerLimit.offset,p2:0,p3:1});}
  emitSelectDestination(ops,destination,output,1);
  const outerDone=ops.length;
  if(havingReject>=0)(ops[havingReject] as {p2:number}).p2=outerDone;
  if(outerOffset>=0)(ops[outerOffset] as {p2:number}).p2=outerDone;
  if(outerLimit)(ops[outerLimit.ifZero] as {p2:number}).p2=outerDone;
  return Object.freeze({ops,registers:builder.registers,columns:Object.freeze([Object.freeze({name:expressionName(select.result[0]!),declaredType:null,database:null,table:null,origin:null})]),parameters:Object.freeze([]),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,encoding:database.encoding});
 }
 // Retain this count-only admission; compile the source to its semantic
 // accumulator destination before publication, never rewrite completed ops.
 if(result.name!=="count"||result.args.length!==0||result.distinct||result.filter||result.orderBy.length||select.hasHaving||select.hasOrderBy||select.limit||select.offset)return undefined;
 const builder=parent?.builder??new SelectProgramBuilder<Op>(),ops=builder.ops,parameters:ParameterBuilder=parent?.parameters??{maximum:0,names:[],named:new Map()},accumulator=builder.register(),output=builder.register();
 const destination:SelectDest={kind:"aggregate-expression",name:"count",register:accumulator,collation:"binary",emitArgument:()=>[]};
 const producer=compileScalarSelect(derived.select,database.encoding,maxWorkUnits,maxResultBytes,privateStateLimits,schema,database,maxRows,{builder,parameters,destination,emitRow:(first,count)=>emitSelectDestination(ops,destination,first,count)});
 ops.push({code:"AggFinal",name:"count",p1:accumulator},{code:"Copy",p1:accumulator,p2:output});
 emitSelectDestination(ops,parent?.destination??{kind:"output"},output,1);
 if(!parent)ops.push({code:"Halt"});
 return Object.freeze({...producer,ops:parent?ops:builder.finish(),registers:builder.registers,columns:Object.freeze([Object.freeze({name:expressionName(select.result[0]!),declaredType:null,database:null,table:null,origin:null})])});
}

/** select.c:sqlite3Select aggregate-without-GROUP tranche. AggInfo entries own
 * accumulator registers; ordinary expression lowering consumes AggFinal values. */
export function compileAggregateSelect(select:SelectNode,schema:SchemaGraph|undefined,database:BtreeDatabase,maxRows:number,maxWorkUnits=10_000_000,maxResultBytes=1_000_000_000,privateStateLimits:PrivateStateLimits=DEFAULT_PRIVATE_STATE_LIMITS, parent?:{builder:SelectProgramBuilder<Op>;ops:Op[];parameters:ParameterBuilder;destination:import("./select-program.ts").SelectDest;compoundLimit?:{registers:LimitRegisters|undefined;stops:number[]};linkedPlan?:ReturnType<typeof expandAndResolveSelect>;scalarPrepared?:boolean;sharedLimit?:LimitRegisters;cursorFor?:(source:ResolvedSource)=>number;expressionBinding?:ResolvedExpressionBinding;input?:{first:number;emit:(consume:()=>void)=>void}}):Program {

 // select.c retained SrcItem coroutine feeds the same grouped sorter capture.
 const groupedStream=select.hasGroupBy&&select.from.derived?.index===0&&select.from.items.length===1&&select.from.derived.select.hasCompound&&select.from.derived.select.arms.slice(1).every(arm=>arm.operatorFromPrior==='union-all')?select.from.derived.select:undefined;
 const selectProgramBuilder=parent?.builder??new SelectProgramBuilder<Op>();const ops=parent?.ops??selectProgramBuilder.ops,parameters:ParameterBuilder=parent?.parameters??{maximum:0,names:[],named:new Map()};const allocate=()=>selectProgramBuilder.register();
 if(groupedStream&&(groupedStream.hasOrderBy||groupedStream.limit||groupedStream.offset))throw new JSQLiteError('unsupported','this grouped compound producer ordering or limit is not implemented',{unsupportedClassification:'temporary'});
 let whereAccounting:Program["whereAccounting"];
 const sourceRegisters=parent?.input?.first??(groupedStream?selectProgramBuilder.range(groupedStream.arms[0]!.result.length):undefined);
 if(!schema&&!parent?.linkedPlan)throw new JSQLiteError("internal","aggregate preparation requires schema or linked plan");
 const zeroSourceDerivedCount=schema&&!parent?.linkedPlan?compileZeroSourceDerivedCount(select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,parent):undefined;if(zeroSourceDerivedCount)return zeroSourceDerivedCount;
 const compoundDerived=schema&&!parent?.linkedPlan?compileCompoundDerivedAggregate(select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,parent):undefined;if(compoundDerived)return compoundDerived;
 const derived=select.from.derived;
 if(derived&&derived.index===0&&select.from.items.length===1&&!derived.select.hasDistinct&&!derived.select.hasGroupBy&&!derived.select.hasHaving&&!derived.select.hasOrderBy&&!derived.select.hasLimit&&!derived.select.hasCompound&&derived.select.from.items.length>=1){
  // select.c:flattenSubquery, bounded aggregate-parent form. Substitute the
  // transient producer columns before inheriting its source. This also retains
  // CTE alias names without fabricating a schema table.
  const names=uniqueTransientColumnNames(derived.select.result.map(expression=>expression.alias??expressionName(expression)));
  const columns=new Map(derived.select.result.map((expression,index)=>[sqliteAsciiFold(names[index]!),expression]));
  const qualifier=select.from.items[0]!.alias??select.from.items[0]!.tableName;
  const result=Object.freeze(select.result.map(expression=>substituteViewExpression(expression,columns,qualifier)));
  const groupBy=Object.freeze(select.groupBy.map(expression=>substituteViewExpression(expression,columns,qualifier)));
  const having=select.having?substituteViewExpression(select.having,columns,qualifier):null;
  const orderBy=Object.freeze(select.orderBy.map(term=>Object.freeze({...term,expr:substituteViewExpression(term.expr,columns,qualifier)})));
  const outerWhere=select.where?substituteViewExpression(select.where,columns,qualifier):null;
  const where=andViewPredicates(derived.select.where,outerWhere);
  const flattened=Object.freeze({...select,result,groupBy,having,orderBy,from:derived.select.from,where,hasSubquery:select.hasSubquery||derived.select.hasSubquery,tokens:select.tokens});
  return compileAggregateSelect(flattened,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,parent);
 }
 // select.c:selectExpander runs before resolveSelectStep/aggregate lowering.
 // Flatten the same bounded immutable-view shape used by ordinary SELECT so
 // view column names, origin/type/affinity and inherited collation reach the
 // grouping KeyInfo without mutating the schema-owned Select.
 if(!select.hasCompound&&select.from.items.length===1){
  const source=select.from.items[0]!,view=schema?.views.get(sqliteAsciiFold(sqlName(source.tableName)));
  if(view)return compileAggregateSelect(flattenImmutableView(select,view),schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,parent);
 }
 if(select.hasCompound){
  const unionAll=select.arms.slice(1).every(arm=>arm.operatorFromPrior==="union-all"),order=select.orderBy[0];
  if(!unionAll||select.orderBy.length!==1||select.limit||select.offset||select.hasDistinct)throw new JSQLiteError("unsupported","this aggregate form is not implemented",{unsupportedClassification:"temporary"});
  let orderTree=expressionFromReduction(order!.expr.reduction!);while(orderTree.kind==="collate")orderTree=orderTree.value;
  if(orderTree.kind!=="literal"||orderTree.value!==1n)throw new JSQLiteError("unsupported","this aggregate form is not implemented",{unsupportedClassification:"temporary"});
  // multiSelect's arm calls consume one enclosing Parse and SelectDest.
  // Retain the documented finite ordered-ALL sorter adaptation, but not
  // completed arm Programs or relocated registers/control addresses.
  const builder=parent?.builder??new SelectProgramBuilder<Op>(),ops=builder.ops;
  const parameters=parent?.parameters??{maximum:0,names:[],named:new Map<string,number>()};
  const width=select.arms[0]!.result.length;
  if(select.arms.some(arm=>arm.result.length!==width))throw new JSQLiteError("sqlite","SELECTs to the left and right of UNION ALL do not have the same number of result columns",{code:1});
  const sorter=builder.cursor();
  ops.push({code:"SorterOpen",p1:sorter,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:1,keyFieldCount:1,terms:[{collation:"binary",desc:order!.descending,nullsLarge:order!.nulls==="last"?!order!.descending:order!.nulls==="first"?order!.descending:false}]})});
  let columns:Program['columns']=[];
  const beforeParameters=parameters.maximum;
  for(const arm of select.arms){
    const single:SelectNode={...select,result:arm.result,from:arm.from,where:arm.where,hasDistinct:arm.hasDistinct,hasGroupBy:arm.hasGroupBy,hasHaving:arm.hasHaving,groupBy:Object.freeze([]),having:null,orderBy:Object.freeze([]),limit:null,offset:null,hasOrderBy:false,hasLimit:false,hasCompound:false,arms:Object.freeze([{...arm,operatorFromPrior:null,prior:null,next:null}])};
    const metadata=compileAggregateSelect(single,schema!,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{builder,ops,parameters,destination:{kind:"sorter",cursor:sorter,keyCount:1}});
    if(!columns.length)columns=metadata.columns;
  }
  if(parameters.maximum!==beforeParameters)throw new JSQLiteError("unsupported","parameters in aggregate compounds are not implemented",{unsupportedClassification:"temporary"});
  const output=builder.range(width),sort=ops.length;
  ops.push({code:"SorterSort",p1:sorter,emptyJump:0});
  const row=ops.length;ops.push({code:"SorterData",p1:sorter,p2:output,count:width});
  emitSelectDestination(ops,parent?.destination??{kind:"output"},output,width);
  ops.push({code:"SorterNext",p1:sorter,p2:row});
  (ops[sort] as {emptyJump:number}).emptyJump=ops.length;
  if(!parent)ops.push({code:"Halt"});
  return Object.freeze({ops:parent?ops:builder.finish(),registers:builder.registers,columns,parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,encoding:database.encoding});

 }
 if(!aggregateShapeSupported(select))throw new JSQLiteError("unsupported","this aggregate form is not implemented",{unsupportedClassification:"temporary"});
 let table:TableNode|undefined;
 // resolve.c:resolveSelectStep resolves GROUP BY result-column ordinals before
 // aggregate code generation. The aggregate lowering below has its own bound
 // expression form, but it must not bypass resolver diagnostics (notably 0 or
 // an in-range signed 32-bit ordinal beyond the result width).
 let aggregatePlan:ReturnType<typeof expandAndResolveSelect>;
 try { aggregatePlan=parent?.linkedPlan??(groupedStream?resolveTransientArm(select,schema!):expandAndResolveSelect(select,schema!)); }
 catch(error){
  if(error instanceof NameResolutionError){
   // Keep the aggregate SELECT public diagnostic produced by this compiler
   // route. resolve.c's WHERE aggregate misuse is surfaced by the pinned
   // public oracle as "misuse of aggregate: name()".
   const misuse=/^misuse of aggregate function (.+\(\))$/.exec(error.message);
   throw new JSQLiteError("sqlite",misuse&&select.where?`misuse of aggregate: ${misuse[1]}`:error.message,{code:1});
  }
  throw error;
 }
 const aggregateSources=select.from.items.map((item,cursor)=>{const name=sqlName(item.tableName),found=parent?.linkedPlan?aggregatePlan.sources[cursor]!.table:groupedStream?aggregatePlan.sources[cursor]!.table:schema?.findTable(name);if(!found)throw new JSQLiteError("sqlite",`no such table: ${name}`,{code:1});if(found.withoutRowid||found.columns.some(c=>c.generatedExpr))throw new JSQLiteError("unsupported","this table storage shape is not implemented",{unsupportedClassification:"temporary"});return{item,table:found,cursor:parent?.cursorFor?parent.cursorFor(aggregatePlan.sources[cursor]!):parent?parent.builder.cursor():select.from.items.length===1?0:cursor+3,base:0}});let sourceWidth=0;for(const source of aggregateSources){source.base=sourceWidth;sourceWidth+=source.table.columns.length;}if(aggregateSources.length===1)table=aggregateSources[0]!.table;
 const rawTrees=select.result.map(x=>expressionFromReduction(x.reduction!));
 // resolve.c resolves aggregate arguments under NC_InAggFunc and rejects a
 // second aggregate before select.c/AggInfo lowering. Keep that diagnostic at
 // prepare time instead of passing an execution-only aggregate to scalar code.
 const nestedAggregate=(e:Expression,inside=false):string|null=>{if(e.kind==="aggregate"){if(inside)return e.name;for(const arg of e.args){const nested=nestedAggregate(arg,true);if(nested)return nested;}if(e.filter){const nested=nestedAggregate(e.filter,true);if(nested)return nested;}for(const term of e.orderBy){const nested=nestedAggregate(term.expression,true);if(nested)return nested;}return null;}if(e.kind==="unary"||e.kind==="cast"||e.kind==="collate")return nestedAggregate(e.value,inside);if(e.kind==="binary")return nestedAggregate(e.left,inside)??nestedAggregate(e.right,inside);if(e.kind==="call"){for(const arg of e.args){const nested=nestedAggregate(arg,inside);if(nested)return nested;}return null;}if(e.kind==="case"){if(e.operand){const nested=nestedAggregate(e.operand,inside);if(nested)return nested;}for(const [when,then] of e.pairs){const nested=nestedAggregate(when,inside)??nestedAggregate(then,inside);if(nested)return nested;}return e.otherwise?nestedAggregate(e.otherwise,inside):null;}return null};
 for(const tree of rawTrees){const nested=nestedAggregate(tree);if(nested)throw new JSQLiteError("sqlite",`misuse of aggregate function ${nested}()`,{code:1});}
 const whereTree=select.where?expressionFromReduction(select.where.reduction!):null;
 if(whereTree){const aggregate=nestedAggregate(whereTree,true);if(aggregate)throw new JSQLiteError("sqlite",`misuse of aggregate: ${aggregate}()`,{code:1});}
 // resolve.c:resolveOrderGroupBy preserves a matching source name, then substitutes a result expression when source lookup misses.
 const columnOwner:import("./resolve.ts").AggregateColumnOwner={directMode:true,useSortingIdx:false,sortingIndexRegister:0,columns:new Map(),...(sourceRegisters===undefined?{}:{sourceRegisters})};
 const resultLocation:ResolvedExpressionBinding={policy:'ordinary-aggregate',location:reference=>{
  const index=aggregatePlan.sources.indexOf(reference.source),source=aggregateSources[index];
  if(!source){if(parent?.expressionBinding)return parent.expressionBinding.location(reference,0);return {kind:'cursor',cursor:parent?.cursorFor?.(reference.source)??reference.source.cursorId};}
  const payload=source.base+(reference.columnIndex<0?source.table.columns.findIndex((_,index)=>isIntegerPrimaryKeyAlias(source.table,index)):reference.columnIndex);
  return{kind:'cursor',cursor:source.cursor,payloadIndex:payload,aggregateColumn:{owner:columnOwner,iAgg:payload}};
 }};
 const trees=rawTrees.map((tree,index)=>bindResolvedExpression(tree,resolvedExpressionCarrier(aggregatePlan,select.result[index]!.reduction! as Reduction),ref=>ref.cursorId,true,resultLocation)),where=whereTree?bindResolvedExpression(whereTree,resolvedExpressionCarrier(aggregatePlan,select.where!.reduction! as Reduction),ref=>ref.cursorId,true,resultLocation):null,groups=select.groupBy.map(x=>{const carrier=resolvedExpressionCarrier(aggregatePlan,x.reduction! as Reduction);return bindResolvedExpression(expressionFromReduction(carrier.reduction as Reduction),carrier,ref=>ref.cursorId,true,resultLocation);}),havingCarrier=select.having?resolvedExpressionCarrier(aggregatePlan,select.having.reduction! as Reduction):null,havingTree=select.having?bindResolvedExpression(expressionFromReduction(select.having.reduction!),havingCarrier!,ref=>ref.cursorId,true,resultLocation):null;
const outputStart=selectProgramBuilder.range(select.result.length);
 // expr.c:sqlite3CodeSubselect + select.c SRT_Mem. Group output is emitted
 // once per completed group, but an uncorrelated scalar aggregate is guarded by
 // Once and retains its destination register across those emissions. Keeping
 // this producer in the parent Program preserves shared work/control budgets.
 // Reserve the still-fixed parent source, sorter, distinct, and modifier ranges
 // before any expression subquery takes a cursor from the enclosing builder.
 const aggregateSubqueryCursor=()=>selectProgramBuilder.cursor();
 const lexicalAggregateRegisters=new Map<Reduction,number>();
 const compileAggregateSubquery=(expression:SubqueryExpression):number=>{
  const delegatedScalar=resolvedScalarSubqueryEmitter(aggregatePlan,selectProgramBuilder,parameters,{database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits},resultLocation);
  if(expression.kind==='scalar-subquery'&&!expression.exists){
   const nested=expression.select,item=nested.result[0],linked=aggregatePlan.nested.find(plan=>plan.source===nested);
   const local=!linked?.aggregateUses||[...linked.aggregateUses.values()].every(depth=>depth===0);
   if(item?.reduction&&nested.result.length===1&&nested.from.items.length<=1&&!nested.from.derived&&!nested.hasDistinct&&!nested.hasGroupBy&&!nested.hasHaving&&!nested.hasCompound&&!nested.hasValues&&local){
    const tree=expressionFromReduction(item.reduction);
    // Ordinary scalar rows consume the same prepared SELECT destination and
    // sorter in finalized AggInfo phase. Outer-owned aggregates stay lexical.
    if(tree.kind!=='aggregate'||(!nested.hasOrderBy&&!nested.offset&&!tree.distinct&&!tree.orderBy.length))return delegatedScalar(expression);
   }
  }
  const nested=expression.select,item=nested.result[0];
  if(expression.kind==='scalar-subquery'&&expression.exists){
   // expr.c:sqlite3CodeSubselect(SRT_Exists) emits correlated loops in the
   // parent VDBE. Inner cursors are disjoint; linked outer references retain
   // the aggregate consumer's source/sorter/saved phase, not an exhausted cursor.
   if(!item?.reduction||nested.from.items.length<1||nested.from.items.some((source,index)=>index>0&&(source.joinFromLeft.left||source.joinFromLeft.right||source.joinFromLeft.cross))||nested.hasDistinct||nested.hasGroupBy||nested.hasHaving||nested.hasOrderBy||nested.hasCompound||nested.hasValues)throw new JSQLiteError('unsupported','this aggregate EXISTS subquery shape is not implemented',{unsupportedClassification:'temporary'});
   const sources=nested.from.items.map(source=>{const name=sqlName(source.tableName),table=schema?.findTable(name);if(!table)throw new JSQLiteError('sqlite',`no such table: ${name}`,{code:1});if(table.withoutRowid||table.columns.some(column=>column.generatedExpr))throw new JSQLiteError('unsupported','this table storage shape is not implemented',{unsupportedClassification:'temporary'});return{source,table,cursor:aggregateSubqueryCursor()};});
   const nestedPlan=aggregatePlan.nested.find(plan=>plan.source===nested);
   if(!nestedPlan)throw new JSQLiteError('internal','aggregate EXISTS lost linked select context');
   const binding:ResolvedExpressionBinding={policy:'ordinary-aggregate',location:(reference,depth)=>{
    const local=nestedPlan.sources.indexOf(reference.source);
    if(local>=0)return{kind:'cursor',cursor:sources[local]!.cursor};
    // analyzeAggregate walks correlated columns with the enclosing AggInfo.
    // The existing parent binding supplies its source/sorter/saved phase owner.
    return resultLocation.location(reference,depth);
   }};
   const bind=(reduction:LemonValue<SqlToken>):Expression=>{if(reduction.kind!=="reduction")throw new JSQLiteError("internal","aggregate EXISTS lost expression reduction");return bindResolvedExpression(expressionFromReduction(reduction),resolvedExpressionCarrier(nestedPlan,reduction),ref=>ref.cursorId,true,binding);};
   const where=nested.where?.reduction?bind(nested.where.reduction):null;
   const isLocal=(node:Expression):boolean=>node.kind==='column'&&sources.some(source=>source.cursor===node.cursor),isOuter=(node:Expression):boolean=>node.kind==='column'&&aggregateSources.some(source=>source.cursor===node.cursor);
   if(where?.kind==='binary'&&['=','=='].includes(where.op)&&((isLocal(where.left)&&isOuter(where.right))||(isLocal(where.right)&&isOuter(where.left)))){
    // where.c may implement this semijoin with an index. This bounded VDBE uses
    // the existing typed ephemeral b-tree: materialize inner correlation keys
    // once, then probe it for each aggregate input row. The rewrite is valid
    // only for a sole equality correlation predicate; all inner JOIN predicates
    // still run before insertion.
    const local=(isLocal(where.left)?where.left:where.right) as Extract<Expression,{kind:'column'}>,outer=(isOuter(where.left)?where.left:where.right) as Extract<Expression,{kind:'column'}>,set=aggregateSubqueryCursor(),once=allocate(),result=allocate(),onceAt=ops.length;
    ops.push({code:'Once',p1:once,p2:0},{code:'OpenEphemeral',p1:set,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:1,keyFieldCount:1,terms:[{collation:collation(local)}]})});
    const joinOn=sources.length===2&&sources[1]!.source.on?.reduction?bind(sources[1]!.source.on!.reduction!):null;
    const sourceIndex=(node:Expression):number=>node.kind==='column'?sources.findIndex(source=>source.cursor===node.cursor):-1;
    const indexedJoin=joinOn?.kind==='binary'&&['=','==','IS'].includes(joinOn.op)&&sourceIndex(joinOn.left)>=0&&sourceIndex(joinOn.right)>=0&&sourceIndex(joinOn.left)!==sourceIndex(joinOn.right);
    if(indexedJoin){
      // The pinned where.c path probes the joined table instead of executing a
      // cartesian product. Preserve that bounded shape with a typed transient
      // index: build the right join-key set once, then scan the correlation-key
      // owner and insert only rows having a join partner.
      const leftJoin=(sourceIndex(joinOn.left)===0?joinOn.left:joinOn.right) as Extract<Expression,{kind:'column'}>;
      const rightJoin=(sourceIndex(joinOn.left)===1?joinOn.left:joinOn.right) as Extract<Expression,{kind:'column'}>;
      const joinSet=aggregateSubqueryCursor(),joinResult=allocate();
      ops.push({code:'OpenEphemeral',p1:joinSet,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:1,keyFieldCount:1,terms:[{collation:binaryCollation(leftJoin,rightJoin)}]})},{code:'OpenRead',p1:sources[1]!.table.rootPage,p2:sources[1]!.cursor});
      const rightRewind=ops.length;ops.push({code:'Rewind',p1:sources[1]!.cursor,p2:0});
      const rightLoop=ops.length,rightKey=compileExpressionTree(rightJoin,ops,allocate,parameters,compileAggregateSubquery);
      ops.push({code:'IdxInsert',p1:joinSet,keyStart:rightKey,keyCount:1},{code:'Next',p1:sources[1]!.cursor,p2:rightLoop});
      (ops[rightRewind] as {p2:number}).p2=ops.length;
      ops.push({code:'EphemeralSort',p1:joinSet});
      ops.push({code:'OpenRead',p1:sources[0]!.table.rootPage,p2:sources[0]!.cursor});
      const leftRewind=ops.length;ops.push({code:'Rewind',p1:sources[0]!.cursor,p2:0});
      const leftLoop=ops.length,leftKey=compileExpressionTree(leftJoin,ops,allocate,parameters,compileAggregateSubquery);
      ops.push({code:'InSet',p1:joinSet,key:leftKey,output:joinResult,affinity:expressionAffinity(leftJoin)??'numeric',negated:false});
      const reject=ops.length;ops.push({code:'IfNot',p1:joinResult,p2:0});
      const key=compileExpressionTree(local,ops,allocate,parameters,compileAggregateSubquery);
      ops.push({code:'IdxInsert',p1:set,keyStart:key,keyCount:1});
      const next=ops.length;ops.push({code:'Next',p1:sources[0]!.cursor,p2:leftLoop});
      (ops[leftRewind] as {p2:number}).p2=ops.length;(ops[reject] as {p2:number}).p2=next;
    }else{
      for(const source of sources)ops.push({code:'OpenRead',p1:source.table.rootPage,p2:source.cursor});
      const rewinds:number[]=[],bodies:number[]=[],rejects:{at:number;level:number}[]=[];
      for(let level=0;level<sources.length;level++){const source=sources[level]!;rewinds[level]=ops.length;ops.push({code:'Rewind',p1:source.cursor,p2:0});bodies[level]=ops.length;if(source.source.on?.reduction){const test=compileExpressionTree(bind(source.source.on.reduction),ops,allocate,parameters,compileAggregateSubquery);const at=ops.length;ops.push({code:'IfNot',p1:test,p2:0});rejects.push({at,level});}}
      const key=compileExpressionTree(local,ops,allocate,parameters,compileAggregateSubquery);ops.push({code:'IdxInsert',p1:set,keyStart:key,keyCount:1});
      const nextAt:number[]=[];for(let level=sources.length-1;level>=0;level--){nextAt[level]=ops.length;ops.push({code:'Next',p1:sources[level]!.cursor,p2:bodies[level]!});}
      const end=ops.length;for(let level=0;level<sources.length;level++)(ops[rewinds[level]!] as {p2:number}).p2=level===0?end:nextAt[level-1]!;for(const reject of rejects)(ops[reject.at] as {p2:number}).p2=nextAt[reject.level]!;
    }
    ops.push({code:'EphemeralSort',p1:set});
    const end=ops.length;(ops[onceAt] as {p2:number}).p2=end;
    const probe=compileExpressionTree(outer,ops,allocate,parameters,compileAggregateSubquery);ops.push({code:'InSet',p1:set,key:probe,output:result,affinity:expressionAffinity(local)??'numeric',negated:false});return result;
   }
   const result=allocate();ops.push({code:'Integer',p1:0n,p2:result});
   // expr.c:sqlite3CodeSubselect preserves LIMIT zero in the enclosing Vdbe.
   const childLimit=computeLimitRegisters(nested,ops,allocate,parameters);
   for(const source of sources)ops.push({code:'OpenRead',p1:source.table.rootPage,p2:source.cursor});
   const localLevel=(node:Expression):number=>{let level=node.kind==='column'?sources.findIndex(source=>source.cursor===node.cursor):-1;const take=(child:Expression)=>{level=Math.max(level,localLevel(child));};if(node.kind==='unary'||node.kind==='cast'||node.kind==='collate')take(node.value);else if(node.kind==='binary'){take(node.left);take(node.right);}else if(node.kind==='call'){node.args.forEach(take);}else if(node.kind==='case'){if(node.operand)take(node.operand);for(const [a,b] of node.pairs){take(a);take(b);}if(node.otherwise)take(node.otherwise);}return level;};
   const whereLevel=Math.max(0,where?localLevel(where):0),rewinds:number[]=[],bodies:number[]=[],rejects:{at:number;level:number}[]=[];for(let level=0;level<sources.length;level++){const source=sources[level]!;rewinds[level]=ops.length;ops.push({code:'Rewind',p1:source.cursor,p2:0});bodies[level]=ops.length;if(source.source.on?.reduction){const test=compileExpressionTree(bind(source.source.on.reduction),ops,allocate,parameters,compileAggregateSubquery);const at=ops.length;ops.push({code:'IfNot',p1:test,p2:0});rejects.push({at,level});}if(where&&level===whereLevel){const test=compileExpressionTree(where,ops,allocate,parameters,compileAggregateSubquery);const at=ops.length;ops.push({code:'IfNot',p1:test,p2:0});rejects.push({at,level});}}
   const offsetSkip=childLimit?.offset===undefined?-1:ops.length;
   if(childLimit?.offset!==undefined)ops.push({code:'IfPos',p1:childLimit.offset,p2:0,p3:1});
   ops.push({code:'Integer',p1:1n,p2:result});const found=ops.length;ops.push({code:'Goto',p2:0});const nextAt:number[]=[];for(let level=sources.length-1;level>=0;level--){nextAt[level]=ops.length;ops.push({code:'Next',p1:sources[level]!.cursor,p2:bodies[level]!});}const end=ops.length;if(childLimit)(ops[childLimit.ifZero] as {p2:number}).p2=end;if(offsetSkip>=0)(ops[offsetSkip] as {p2:number}).p2=nextAt[sources.length-1]!;(ops[found] as {p2:number}).p2=end;for(let level=0;level<sources.length;level++)(ops[rewinds[level]!] as {p2:number}).p2=level===0?end:nextAt[level-1]!;for(const reject of rejects)(ops[reject.at] as {p2:number}).p2=nextAt[reject.level]!;return result;
  }
  if(expression.kind==='in-subquery'){
   if(!item?.reduction||nested.result.length!==1||nested.from.items.length!==1||nested.where||nested.hasDistinct||nested.hasGroupBy||nested.hasHaving||nested.hasOrderBy||nested.hasCompound||nested.hasValues)throw new JSQLiteError('unsupported','this aggregate IN subquery shape is not implemented',{unsupportedClassification:'temporary'});
   const sourceName=sqlName(nested.from.items[0]!.tableName),sourceTable=schema?.findTable(sourceName);if(!sourceTable)throw new JSQLiteError('sqlite',`no such table: ${sourceName}`,{code:1});
   const tree=expressionFromReduction(item.reduction);if(tree.kind!=='column')throw new JSQLiteError('unsupported','this aggregate IN subquery shape is not implemented',{unsupportedClassification:'temporary'});
   const nestedPlan=aggregatePlan.nested.find(plan=>plan.source===nested);
   if(!nestedPlan||item.reduction.kind!=='reduction')throw new JSQLiteError('internal','aggregate IN lost linked select context');
   const cursor=aggregateSubqueryCursor();
   const binding:ResolvedExpressionBinding={policy:'ordinary-aggregate',location:(reference,depth)=>{
    if(nestedPlan.sources.includes(reference.source))return{kind:'cursor',cursor};
    return resultLocation.location(reference,depth);
   }};
   const value=bindResolvedExpression(tree,resolvedExpressionCarrier(nestedPlan,item.reduction),ref=>ref.cursorId,true,binding);
   const result=allocate(),once=nestedPlan.correlated?undefined:allocate(),set=aggregateSubqueryCursor(),onceAt=once===undefined?-1:ops.length;
   if(once!==undefined)ops.push({code:'Once',p1:once,p2:0});
   // expr.c sqlite3CodeRhsOfIN: correlated RHS rebuilds the set per invocation.
   ops.push({code:'OpenEphemeral',p1:set,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:1,keyFieldCount:1,terms:[{collation:collation(expression.left)}]})});const childLimit=computeLimitRegisters(nested,ops,allocate,parameters);ops.push({code:'OpenRead',p1:sourceTable.rootPage,p2:cursor});const rewind=ops.length;ops.push({code:'Rewind',p1:cursor,p2:0});const loop=ops.length,cell=compileExpressionTree(value,ops,allocate,parameters,compileAggregateSubquery);const offsetSkip=childLimit?.offset===undefined?-1:ops.length;if(childLimit?.offset!==undefined)ops.push({code:'IfPos',p1:childLimit.offset,p2:0,p3:1});emitSelectDestination(ops,{kind:'set',cursor:set},cell,1);const limitStop=childLimit===undefined?-1:ops.length;if(childLimit)ops.push({code:'DecrJumpZero',p1:childLimit.count,p2:0});const next=ops.length;ops.push({code:'Next',p1:cursor,p2:loop});const end=ops.length;if(childLimit){(ops[childLimit.ifZero] as {p2:number}).p2=end;(ops[limitStop] as {p2:number}).p2=end;}if(offsetSkip>=0)(ops[offsetSkip] as {p2:number}).p2=next;(ops[rewind] as {p2:number}).p2=end;if(onceAt>=0)(ops[onceAt] as {p2:number}).p2=end;const left=compileExpressionTree(expression.left,ops,allocate,parameters,compileAggregateSubquery);ops.push({code:'InSet',p1:set,key:left,output:result,affinity:expressionAffinity(value)??'numeric',negated:expression.negated});return result;
  }
  if(expression.exists)throw new JSQLiteError('unsupported','this aggregate expression subquery shape is not implemented',{unsupportedClassification:'temporary'});
  if(!item?.reduction||nested.result.length!==1||nested.from.items.length!==1||nested.hasDistinct||nested.hasGroupBy||nested.hasHaving||nested.hasCompound||nested.hasValues||nested.offset)throw new JSQLiteError('unsupported','this aggregate expression subquery shape is not implemented',{unsupportedClassification:'temporary'});
  const sourceName=sqlName(nested.from.items[0]!.tableName),sourceTable=schema?.findTable(sourceName);if(!sourceTable)throw new JSQLiteError('sqlite',`no such table: ${sourceName}`,{code:1});
  const tree=expressionFromReduction(item.reduction);
  const nestedPlan=aggregatePlan.nested.find(plan=>plan.source===nested);
  if(!nestedPlan)throw new JSQLiteError('internal','aggregate scalar lost linked select context');
  // A function owned by an outer NameContext reads that AggInfo output;
  // the local SELECT still decides whether a scalar row exists (SRT_Mem).
  if(item.reduction.kind!=='reduction')throw new JSQLiteError('internal','lexical scalar lost expression reduction');
  const carrier=resolvedExpressionCarrier(nestedPlan,item.reduction);
  const hasLexicalOutput=(part:ResolvedExpressionCarrier):boolean=>lexicalAggregateRegisters.has(part.reduction)||part.children.some(hasLexicalOutput);
  if(!nested.hasOrderBy&&hasLexicalOutput(carrier)){
   const cursor=aggregateSubqueryCursor(),result=allocate();
   const binding:ResolvedExpressionBinding={policy:'ordinary-aggregate',aggregateOutput:reduction=>{
    const output=lexicalAggregateRegisters.get(reduction);
    if(output===undefined)throw new JSQLiteError('unsupported','mixed lexical aggregate scalar ownership is not implemented',{unsupportedClassification:'temporary'});
    return output;
   },location:(reference,depth)=>nestedPlan.sources.includes(reference.source)?{kind:'cursor',cursor}:resultLocation.location(reference,depth)};
   const value=bindResolvedExpression(tree,carrier,ref=>ref.cursorId,true,binding);
   const predicate=nested.where?.reduction?bindResolvedExpression(expressionFromReduction(nested.where.reduction),resolvedExpressionCarrier(nestedPlan,nested.where.reduction as Reduction),ref=>ref.cursorId,true,binding):null;
   ops.push({code:'Null',p2:result});
   let limitSkip:number|undefined;
   const scalarLimit=computeScalarLimitRegisters(nested,ops,allocate,parameters,compileAggregateSubquery);limitSkip=scalarLimit?.ifZero;
   ops.push({code:'OpenRead',p1:sourceTable.rootPage,p2:cursor});
   const empty=ops.length;ops.push({code:'Rewind',p1:cursor,p2:0});const loop=ops.length;
   let reject:number|undefined;
   if(predicate){const test=compileExpressionTree(predicate,ops,allocate,parameters,compileAggregateSubquery);reject=ops.length;ops.push({code:'IfNot',p1:test,p2:0});}
   const output=compileExpressionTree(value,ops,allocate,parameters,compileAggregateSubquery);
   ops.push({code:'Copy',p1:output,p2:result});const found=ops.length;ops.push({code:'Goto',p2:0});
   const next=ops.length;if(reject!==undefined)(ops[reject] as {p2:number}).p2=next;
   ops.push({code:'Next',p1:cursor,p2:loop});const end=ops.length;
   (ops[empty] as {p2:number}).p2=end;(ops[found] as {p2:number}).p2=end;if(limitSkip!==undefined)(ops[limitSkip] as {p2:number}).p2=end;return result;
  }
  if(nested.hasOrderBy||nested.limit){
   // expr.c:sqlite3CodeSubselect initializes SRT_Mem to NULL, guards an
   // uncorrelated producer with Once, and replaces its limit with one row.
   // Lower into this Program so sorter, Mem, cursor, and budgets are shared.
   const limit=nested.limit?.reduction?expressionFromReduction(nested.limit.reduction):null;
   if(!nested.hasOrderBy||limit?.kind!=='literal'||limit.value!==1n||tree.kind==='aggregate')throw new JSQLiteError('unsupported','this aggregate expression subquery shape is not implemented',{unsupportedClassification:'temporary'});
   const nestedPlan=aggregatePlan.nested.find(plan=>plan.source===nested);
   if(!nestedPlan)throw new JSQLiteError('internal','ordered aggregate scalar lost linked select context');
   const cursor=aggregateSubqueryCursor(),sorter=aggregateSubqueryCursor(),result=allocate(),once=nestedPlan.correlated?undefined:allocate(),capacity=allocate();
   const binding:ResolvedExpressionBinding={policy:'ordinary-aggregate',location:(reference,depth)=>{
    if(nestedPlan.sources.includes(reference.source))return{kind:'cursor',cursor};
    return resultLocation.location(reference,depth);
   }};
   const bind=(reduction:LemonValue<SqlToken>):Expression=>{if(reduction.kind!=='reduction')throw new JSQLiteError('internal','ordered aggregate scalar lost expression reduction');return bindResolvedExpression(expressionFromReduction(reduction),resolvedExpressionCarrier(nestedPlan,reduction),ref=>ref.cursorId,true,binding);};
   const order=nested.orderBy.map(term=>({term,expression:bind(term.expr.reduction!)})),value=bind(item.reduction),predicate=nested.where?.reduction?bind(nested.where.reduction):null,onceAt=once===undefined?-1:ops.length;
   if(once!==undefined)ops.push({code:'Once',p1:once,p2:0});
   ops.push({code:'Null',p2:result},{code:'Integer',p1:1n,p2:capacity},{code:'SorterOpen',p1:sorter,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:order.length,keyFieldCount:order.length,terms:order.map(({term,expression})=>({collation:collation(expression),desc:term.descending,nullsLarge:term.nulls==='last'?!term.descending:term.nulls==='first'?term.descending:false}))})},{code:'OpenRead',p1:sourceTable.rootPage,p2:cursor});
   const rewind=ops.length;ops.push({code:'Rewind',p1:cursor,p2:0});const loop=ops.length;let reject:number|undefined;if(predicate){const test=compileExpressionTree(predicate,ops,allocate,parameters,compileAggregateSubquery);reject=ops.length;ops.push({code:'IfNot',p1:test,p2:0});}const keyStart=selectProgramBuilder.range(Math.max(1,order.length));order.forEach(({expression},index)=>{const key=compileExpressionTree(expression,ops,allocate,parameters,compileAggregateSubquery);ops.push({code:'Copy',p1:key,p2:keyStart+index});});const payload=compileExpressionTree(value,ops,allocate,parameters,compileAggregateSubquery);ops.push({code:'SorterInsert',p1:sorter,keyStart,keyCount:order.length,payload,payloadCount:1,topN:capacity});const next=ops.length;if(reject!==undefined)(ops[reject] as {p2:number}).p2=next;ops.push({code:'Next',p1:cursor,p2:loop});const sort=ops.length;(ops[rewind] as {p2:number}).p2=sort;ops.push({code:'SorterSort',p1:sorter,emptyJump:0},{code:'SorterData',p1:sorter,p2:result,count:1});const end=ops.length;(ops[sort] as {emptyJump:number}).emptyJump=end;if(onceAt>=0)(ops[onceAt] as {p2:number}).p2=end;return result;
  }

  if(tree.kind!=='aggregate'||tree.distinct||tree.filter||tree.orderBy.length)throw new JSQLiteError('unsupported','this aggregate expression subquery shape is not implemented',{unsupportedClassification:'temporary'});
  if(nested.where)throw new JSQLiteError('unsupported','this aggregate expression subquery shape is not implemented',{unsupportedClassification:'temporary'});
  const cursor=aggregateSubqueryCursor(),result=allocate(),once=nestedPlan.correlated?undefined:allocate();
  const binding:ResolvedExpressionBinding={policy:'ordinary-aggregate',location:(reference,depth)=>{
   if(nestedPlan.sources.includes(reference.source))return{kind:'cursor',cursor};
   return resultLocation.location(reference,depth);
  }};
  if(item.reduction.kind!=='reduction')throw new JSQLiteError('internal','aggregate scalar lost expression reduction');
  const bound=bindResolvedExpression(tree,resolvedExpressionCarrier(nestedPlan,item.reduction),ref=>ref.cursorId,true,binding);
  if(bound.kind!=='aggregate')throw new JSQLiteError('internal','aggregate scalar lost aggregate expression');
  const onceAt=once===undefined?-1:ops.length;
  if(once!==undefined)ops.push({code:'Once',p1:once,p2:0});
  // sqlite3Select resetAccumulator: each correlated invocation owns fresh state,
  // including the empty-input AggFinal path. Once retains uncorrelated state.
  ops.push({code:'Null',p2:result},{code:'OpenRead',p1:sourceTable.rootPage,p2:cursor});
  const rewind=ops.length;ops.push({code:'Rewind',p1:cursor,p2:0});const loop=ops.length,args=bound.args.map(arg=>compileExpressionTree(arg,ops,allocate,parameters,compileAggregateSubquery));ops.push({code:'AggStep',name:bound.name,args,p2:result,collation:bound.collation},{code:'Next',p1:cursor,p2:loop});(ops[rewind] as {p2:number}).p2=ops.length;ops.push({code:'AggFinal',name:bound.name,p1:result});if(onceAt>=0)(ops[onceAt] as {p2:number}).p2=ops.length;return result;
 };
 type Entry={name:string;args:Expression[];collation:BuiltinCollation;register:number;distinct:boolean;filter:Expression|null;orderBy:AggregateOrderTerm[];phase?:ResolvedAggregatePhaseCarrier;distinctCursor?:number;orderCursor?:number};const entries:Entry[]=[];
 // Original and alias-substituted expressions share linked phase lowering.
 const lowerResult=(e:Expression,carrier:ResolvedExpressionCarrier):Expression=>{
  const child=(index:number)=>{const found=carrier.children[index];if(!found)throw new JSQLiteError('internal','aggregate result child lost');return found;};
  if(e.kind==='aggregate'){
   const register=allocate(),sortlist=directReduction(carrier.reduction,'sortlist ::=');
   const orderBy=sortlist?sortListItems(sortlist).map(item=>{const node=item.children.find((part):part is Reduction=>part.kind==='reduction'&&(part.signature.startsWith('expr ::=')||part.signature.startsWith('term ::=')));if(!node)throw new JSQLiteError('internal','aggregate order identity lost');return resolvedExpressionCarrier(aggregatePlan,node);}):[];
   const phase:ResolvedAggregatePhaseCarrier=Object.freeze({expression:carrier,arguments:Object.freeze(e.args.map((_,index)=>child(index))),orderBy:Object.freeze(orderBy),accumulator:Object.freeze({phase:'accumulator' as const,register}),output:Object.freeze({phase:'finalized-output' as const,register})});
   const args=e.args,ordered=e.orderBy;
   entries.push({name:e.name,args,collation:args[0]?collation(args[0]):e.collation,register,distinct:e.distinct,filter:e.filter,orderBy:ordered,phase});
   return{kind:'register',index:phase.output.register};
  }
  if(e.kind==='unary'||e.kind==='cast'||e.kind==='collate')e.value=lowerResult(e.value,child(0));
  else if(e.kind==='binary'){e.left=lowerResult(e.left,child(0));e.right=lowerResult(e.right,child(1));}
  else if(e.kind==='between'){e.value=lowerResult(e.value,child(0));e.lower=lowerResult(e.lower,child(1));e.upper=lowerResult(e.upper,child(2));}
  else if(e.kind==='in-list'){e.left=lowerResult(e.left,child(0));e.values=e.values.map((x,i)=>lowerResult(x,child(i+1)));}
  else if(e.kind==='in-subquery')e.left=lowerResult(e.left,child(0));
  else if(e.kind==='call'){
   // resolve.c lookupName expands a FULL USING column to coalesce. Its
   // carrier is still the resolved column leaf, not a parsed function call.
   // Aggregate column binding already owns every merged member's phase.
   if(!(carrier.column?.mergedSources&&e.name==='coalesce'))e.args=e.args.map((x,i)=>lowerResult(x,child(i)));
  }
  else if(e.kind==='case'){let i=0;if(e.operand)e.operand=lowerResult(e.operand,child(i++));e.pairs=e.pairs.map(([x,y])=>[lowerResult(x,child(i++)),lowerResult(y,child(i++))]);if(e.otherwise)e.otherwise=lowerResult(e.otherwise,child(i));}
  return e;
 };
 // expr.c analyzeAggregate visits nested SELECTs at matching function depth.
 // Register their outer-owned functions before any accumulator stepping.
 const enrollNested=(plan:import('./resolve.ts').ResolvedSelect,depth:number):void=>{
  for(const [reduction,owner] of plan.aggregateUses??[]){
   if(owner!==depth||lexicalAggregateRegisters.has(reduction))continue;
   const carrier=resolvedExpressionCarrier(plan,reduction);
   const expression=bindResolvedExpression(expressionFromReduction(reduction),carrier,ref=>ref.cursorId,true,resultLocation);
   const output=lowerResult(expression,carrier);
   if(output.kind!=='register')throw new JSQLiteError('internal','lexical aggregate lost accumulator');
   lexicalAggregateRegisters.set(reduction,output.index);
  }
  for(const child of plan.nested)enrollNested(child,depth+1);
 };
 for(const child of aggregatePlan.nested)enrollNested(child,1);
 const outputs=trees.map((x,index)=>lowerResult(x,resolvedExpressionCarrier(aggregatePlan,select.result[index]!.reduction! as Reduction))),having=havingTree?lowerResult(havingTree,havingCarrier!):null;
 // resolve.c:resolveOrderGroupBy substitutes aliases/ordinals; unmatched
 // expressions are resolved in this same NameContext and lowered into AggInfo.
 // Do this before emitting AggStep so ORDER-only aggregates own registers too.
 const orderExpressions=select.orderBy.map(term=>{
  if(aggregateOrderResultIndex(select,term)>=0||aggregateOrderGroupIndex(select,term)>=0)return null;
  const carrier=resolvedExpressionCarrier(aggregatePlan,term.expr.reduction! as Reduction);
  return lowerResult(bindResolvedExpression(expressionFromReduction(term.expr.reduction!),carrier,ref=>ref.cursorId,true,resultLocation),carrier);
 });
 // select.c AggInfo retains bare result columns from the first row that feeds
 // an ordinary (non-GROUP BY) aggregate. Cache those values before Next moves
 // the table cursor; final projection must not reread the last/exhausted cursor.
 const bareColumns:{source:Expression;register:number}[]=[];
 // TK_AGG_COLUMN also owns an IN probe outside the nested SELECT. Preserve
 // its accumulator value before final output closes the physical scan.
 const cacheBare=(e:Expression):Expression=>{if(e.kind==="column"){const existing=bareColumns.find(item=>{const column=item.source as Extract<Expression,{kind:"column"}>;return column.cursor===e.cursor&&column.index===e.index});const register=existing?.register??allocate();if(!existing)bareColumns.push({source:e,register});return{kind:"register",index:register}}if(e.kind==="unary"||e.kind==="cast"||e.kind==="collate")e.value=cacheBare(e.value);else if(e.kind==="binary"){e.left=cacheBare(e.left);e.right=cacheBare(e.right)}else if(e.kind==="in-subquery")e.left=cacheBare(e.left);else if(e.kind==="call")e.args=e.args.map(cacheBare);else if(e.kind==="case"){if(e.operand)e.operand=cacheBare(e.operand);e.pairs=e.pairs.map(([a,b])=>[cacheBare(a),cacheBare(b)]);if(e.otherwise)e.otherwise=cacheBare(e.otherwise)}return e};
 if(!select.hasGroupBy){outputs.forEach((output,index)=>outputs[index]=cacheBare(output));if(having)cacheBare(having);orderExpressions.forEach((order,index)=>{if(order)orderExpressions[index]=cacheBare(order)});}
 // analyzeAggregate owns columns reached through nested SELECTs too. Save
 // their first input row for post-finalization scalar WHERE/projection reads.
 if(!select.hasGroupBy){
  const capture=(plan:import('./resolve.ts').ResolvedSelect):void=>{for(const use of plan.columnUses){if(!aggregatePlan.sources.includes(use.source))continue;const carrier=resolvedExpressionCarrier(plan,use.expression);cacheBare(bindResolvedExpression(expressionFromReduction(use.expression),carrier,ref=>ref.cursorId,true,resultLocation));}plan.nested.forEach(capture);};
  aggregatePlan.nested.forEach(capture);
  for(const item of bareColumns){const column=item.source as Extract<Expression,{kind:'column'}>;if(column.aggregateColumn)columnOwner.columns.set(column.aggregateColumn.iAgg,{iSorterColumn:0,accumulatorRegister:item.register});}
 }
 const bareOnce=bareColumns.length?allocate():undefined;
 // select.c:computeLimitRegisters gates the no-GROUP accumulator too.
 const groupLimit=parent?.compoundLimit?parent.compoundLimit.registers:parent?.sharedLimit??(parent?.scalarPrepared?undefined:computeLimitRegisters(select,ops,allocate,parameters));
 const resolvedOrderResultIndices=select.hasGroupBy&&select.hasOrderBy?select.orderBy.map(term=>aggregateOrderResultIndex(select,term)):[];
 const resolvedOrderGroupIndices=select.hasGroupBy&&select.hasOrderBy?select.orderBy.map(term=>aggregateOrderGroupIndex(select,term)):[];
 const orderKeys=resolvedOrderResultIndices.map((index,i)=>index>=0?{result:index}:resolvedOrderGroupIndices[i]!>=0?{group:resolvedOrderGroupIndices[i]!}:{expression:orderExpressions[i]!});
 const resultSorter=orderKeys.length>0&&select.orderBy.some((term,index)=>term.descending||term.nulls!==null||!groups.some(group=>'result' in orderKeys[index]!&&sameExpression(rawTrees[orderKeys[index]!.result]!,group)))? (parent?selectProgramBuilder.cursor():2):undefined;
 if(resultSorter!==undefined)ops.push({code:"SorterOpen",p1:resultSorter,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:select.orderBy.length,keyFieldCount:select.orderBy.length,terms:select.orderBy.map((term,index)=>({collation:'result' in orderKeys[index]!?collation(outputs[orderKeys[index]!.result]!):'group' in orderKeys[index]!?collation(groups[orderKeys[index]!.group]!):collation(orderKeys[index]!.expression),desc:term.descending,nullsLarge:term.nulls==="last"?!term.descending:term.nulls==="first"?term.descending:false}))})});
 const distinctResultCursor=select.hasDistinct?(parent?selectProgramBuilder.cursor():Math.max(3,...aggregateSources.map(source=>source.cursor))+3):undefined;if(distinctResultCursor!==undefined)ops.push({code:"OpenEphemeral",p1:distinctResultCursor,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:outputs.length,keyFieldCount:outputs.length,terms:outputs.map(output=>({collation:collation(output)}))})});
 let modifierCursor=Math.max(distinctResultCursor??0,2,...aggregateSources.map(source=>source.cursor))+10;for(const entry of entries){if(entry.distinct){entry.distinctCursor=modifierCursor++;ops.push({code:"OpenEphemeral",p1:entry.distinctCursor,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:entry.args.length,keyFieldCount:entry.args.length,terms:entry.args.map(arg=>({collation:collation(arg)}))})});}if(entry.orderBy.length){entry.orderCursor=modifierCursor++;ops.push({code:"SorterOpen",p1:entry.orderCursor,keyInfo:new KeyInfo({encoding:database.encoding,totalFieldCount:entry.orderBy.length,keyFieldCount:entry.orderBy.length,terms:entry.orderBy.map(term=>({collation:collation(term.expression),desc:term.descending,nullsLarge:term.nullsLarge}))})});}}
 selectProgramBuilder.reserveCursorsThrough(Math.max(modifierCursor-1,...aggregateSources.map(source=>source.cursor)));
 const groupLimitJumps:number[]=[];
 // expr.c: sqlite3ExprCode invokes the linked subselect producer in AggStep
 // arguments, filters and ordering just as it does in result expressions.
 const emitSteps=(changed?:number,seen?:number)=>{for(const entry of entries){if(changed!==undefined&&seen!==undefined&&entry.filter&&(entry.name==="min"||entry.name==="max")){ops.push({code:"Not",p1:seen,p2:changed});}let filterJump:number|undefined;if(entry.filter){const test=compileExpressionTree(entry.filter,ops,allocate,parameters,compileAggregateSubquery);filterJump=ops.length;ops.push({code:"IfNot",p1:test,p2:0});}const args=entry.args.map(arg=>compileExpressionTree(arg,ops,allocate,parameters,compileAggregateSubquery));let duplicate:number|undefined;if(entry.distinctCursor!==undefined){const distinctStart=selectProgramBuilder.range(Math.max(1,args.length));args.forEach((arg,index)=>ops.push({code:"Copy",p1:arg,p2:distinctStart+index}));duplicate=ops.length;ops.push({code:"Found",p1:entry.distinctCursor,keyStart:distinctStart,keyCount:args.length,jump:0},{code:"IdxInsert",p1:entry.distinctCursor,keyStart:distinctStart,keyCount:args.length});}if(entry.orderCursor!==undefined){const keyStart=selectProgramBuilder.range(Math.max(1,entry.orderBy.length));entry.orderBy.forEach((term,index)=>{const value=compileExpressionTree(term.expression,ops,allocate,parameters,compileAggregateSubquery);ops.push({code:"Copy",p1:value,p2:keyStart+index});});const payload=selectProgramBuilder.range(Math.max(1,args.length));args.forEach((arg,index)=>ops.push({code:"Copy",p1:arg,p2:payload+index}));ops.push({code:"SorterInsert",p1:entry.orderCursor,keyStart,keyCount:entry.orderBy.length,payload,payloadCount:args.length});}else ops.push({code:"AggStep",name:entry.name,args,p2:entry.phase?.accumulator.register??entry.register,collation:entry.collation,...((entry.name==="min"||entry.name==="max")&&changed!==undefined?{changed}: {})});const end=ops.length;if(filterJump!==undefined)(ops[filterJump] as {p2:number}).p2=end;if(duplicate!==undefined)(ops[duplicate] as {jump:number}).jump=end;}};
 const emitFinals=()=>{for(const entry of entries){if(entry.orderCursor!==undefined){const args=selectProgramBuilder.range(Math.max(1,entry.args.length));const sort=ops.length;ops.push({code:"SorterSort",p1:entry.orderCursor,emptyJump:0},{code:"SorterData",p1:entry.orderCursor,p2:args,count:entry.args.length},{code:"AggStep",name:entry.name,args:Array.from({length:entry.args.length},(_,i)=>args+i),p2:entry.phase?.accumulator.register??entry.register,collation:entry.collation},{code:"SorterNext",p1:entry.orderCursor,p2:sort+1});(ops[sort] as {emptyJump:number}).emptyJump=ops.length;}ops.push({code:"AggFinal",name:entry.name,p1:entry.phase?.accumulator.register??entry.register});}};
 if(select.hasGroupBy){
  const width=sourceWidth,keyCount=groups.length,sorter=parent?selectProgramBuilder.cursor():1,sortedBase=selectProgramBuilder.range(2*(keyCount+width)),savedBase=sortedBase+keyCount+width;
  const keyInfo=new KeyInfo({encoding:database.encoding,totalFieldCount:keyCount,keyFieldCount:keyCount,terms:groups.map(group=>({collation:collation(group)}))});
  ops.push({code:"SorterOpen",p1:sorter,keyInfo});
  let streamReturn:number|undefined,streamScan:number|undefined;
  const rewinds:number[]=[],bodies:number[]=[],afterOn:number[]=[],predicateJumps:{at:number;level:number}[]=[],leftMatches:(number|undefined)[]=[],emptyAt:number[]=[];
  if(!parent?.input&&groupedStream){
   streamReturn=allocate();const init=ops.length;ops.push({code:'InitCoroutine',p1:streamReturn,p2:0,p3:0});const start=ops.length;
   for(const arm of groupedStream.arms){
    const single:SelectNode={...groupedStream,result:arm.result,from:arm.from,where:arm.where,hasDistinct:arm.hasDistinct,hasGroupBy:arm.hasGroupBy,hasHaving:arm.hasHaving,groupBy:arm.groupBy??Object.freeze([]),having:arm.having??null,orderBy:Object.freeze([]),limit:null,offset:null,hasOrderBy:false,hasLimit:false,hasCompound:false,arms:Object.freeze([{...arm,operatorFromPrior:null,prior:null,next:null}])};
    const destination:SelectDest={kind:'coroutine',register:streamReturn,first:sourceRegisters!};
    const plan=expandAndResolveSelect(single,schema!,null,selectProgramBuilder.cursors);
    if(selectHasAggregate(single))compileAggregateSelect(single,schema!,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{builder:selectProgramBuilder,ops,parameters,destination});
    else if(plan.sources.length)compileInnerTableSelect(single,plan,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{builder:selectProgramBuilder,ops,parameters,destination});
    else compileScalarSelect(single,database.encoding,maxWorkUnits,maxResultBytes,privateStateLimits,schema!,database,maxRows,{builder:selectProgramBuilder,parameters,destination,emitRow:(first,count)=>emitSelectDestination(ops,destination,first,count)});
   }
   ops.push({code:'EndCoroutine',p1:streamReturn,p2:0});(ops[init] as {p2:number;p3:number}).p2=ops.length;(ops[init] as {p3:number}).p3=start;
   streamScan=ops.length;ops.push({code:'Yield',p1:streamReturn,p2:0});
  }else if(!parent?.input&&aggregateSources.length<=1&&!aggregatePlan.sources.some(source=>source.joinFromLeft.right)){
  aggregateSources.forEach(source=>ops.push({code:"OpenRead",p1:source.table.rootPage,p2:source.cursor}));for(let level=0;level<aggregateSources.length;level++){const source=aggregateSources[level]!,isLeft=level>0&&source.item.joinFromLeft.left;if(isLeft){leftMatches[level]=allocate();ops.push({code:"Integer",p1:0n,p2:leftMatches[level]!});}rewinds[level]=ops.length;ops.push({code:"Rewind",p1:source.cursor,p2:0});bodies[level]=ops.length;const on=source.item.on;if(on){const test=compileExpressionTree(bindResolvedExpression(expressionFromReduction(on.reduction!),resolvedExpressionCarrier(aggregatePlan,on.reduction! as Reduction),ref=>ref.cursorId,true,resultLocation),ops,allocate,parameters);const at=ops.length;ops.push({code:"IfNot",p1:test,p2:0});predicateJumps.push({at,level});}afterOn[level]=ops.length;if(isLeft)ops.push({code:"Integer",p1:1n,p2:leftMatches[level]!});}
  }
  const insertGroupedRow=()=>{
  let inputReject:number|undefined;
  if(where&&(!sharedJoinInput||parent?.input)){const test=compileExpressionTree(where,ops,allocate,parameters,compileAggregateSubquery);const at=ops.length;ops.push({code:"IfNot",p1:test,p2:0});if(parent?.input||aggregateSources.length>1||aggregatePlan.sources.some(source=>source.joinFromLeft.right))inputReject=at;else predicateJumps.push({at,level:aggregateSources.length-1});}
  // where.c:sqlite3WhereBegin with zero sources still visits one candidate.
  // Its WHERE rejection skips SorterInsert; no Next cursor exists to branch to.
  const keys=groups.map(group=>compileExpressionTree(group,ops,allocate,parameters)),combined=selectProgramBuilder.range(keyCount+width);keys.forEach((value,i)=>ops.push({code:"Copy",p1:value,p2:combined+i}));for(const source of aggregateSources)for(let i=0;i<source.table.columns.length;i++)ops.push(sourceRegisters!==undefined?{code:"Copy",p1:sourceRegisters+i,p2:combined+keyCount+source.base+i}:isIntegerPrimaryKeyAlias(source.table,i)?{code:"Rowid",p1:source.cursor,p2:combined+keyCount+source.base+i}:{code:"Column",p1:i,p2:combined+keyCount+source.base+i,p3:source.cursor});ops.push({code:"SorterInsert",p1:sorter,keyStart:combined,keyCount,payload:combined,payloadCount:keyCount+width});
  if(inputReject!==undefined)(ops[inputReject] as {p2:number}).p2=ops.length;
  };
  const sharedJoinInput=!parent?.input&&(aggregateSources.length>1||aggregatePlan.sources.some(source=>source.joinFromLeft.right));
  if(parent?.input)parent.input.emit(insertGroupedRow);
  else if(sharedJoinInput){
    // select.c GROUP BY: sqlite3WhereBegin supplies rows to the group sorter.
    // ON/match/null/drain ownership stays in WHERE, not aggregate-local scans.
    const inputSelect:SelectNode={...select,orderBy:Object.freeze([]),limit:null,offset:null,hasOrderBy:false,hasLimit:false,hasDistinct:false};
    whereAccounting=compileInnerTableSelect(inputSelect,aggregatePlan,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{builder:selectProgramBuilder,ops,parameters,destination:{kind:'ephemeral',cursor:sorter},cursorFor:source=>aggregateSources[aggregatePlan.sources.indexOf(source)]!.cursor,expressionBinding:resultLocation,consumeRow:insertGroupedRow});
  }else insertGroupedRow();
  const nextAt:number[]=[];if(streamScan!==undefined){nextAt[0]=ops.length;ops.push({code:"Goto",p2:streamScan});}else if(!parent?.input&&!sharedJoinInput)for(let level=aggregateSources.length-1;level>=0;level--){nextAt[level]=ops.length;ops.push({code:"Next",p1:aggregateSources[level]!.cursor,p2:bodies[level]!});const match=leftMatches[level];if(match!==undefined){emptyAt[level]=ops.length;const guard=ops.length;ops.push({code:"IfPos",p1:match,p2:0,p3:0},{code:"Integer",p1:1n,p2:match},{code:"NullRow",p1:aggregateSources[level]!.cursor},{code:"Goto",p2:afterOn[level]!});(ops[guard] as {p2:number}).p2=ops.length;}}const sortAt=ops.length;if(streamScan!==undefined)(ops[streamScan] as {p2:number}).p2=sortAt;for(let level=0;streamScan===undefined&&!parent?.input&&!sharedJoinInput&&level<aggregateSources.length;level++)(ops[rewinds[level]!] as {p2:number}).p2=emptyAt[level]??(level===0?sortAt:nextAt[level-1]!);for(const jump of predicateJumps)(ops[jump.at] as {p2:number}).p2=jump.level<0?sortAt:nextAt[jump.level]!;ops.push({code:"SorterSort",p1:sorter,emptyJump:0},{code:"SorterData",p1:sorter,p2:sortedBase,count:keyCount+width});
  for(let i=0;i<keyCount+width;i++)ops.push({code:"Copy",p1:sortedBase+i,p2:savedBase+i});
  const accumulatorRegisters=entries.map(x=>x.register);ops.push({code:"AggReset",registers:accumulatorRegisters});
  // select.c: sorter payload columns and bare accumulator cells belong to
  // the same AggInfo column; consumers select phase at emission, never by AST rewrite.
  for(let column=0;column<width;column++)columnOwner.columns.set(column,{iSorterColumn:keyCount+column,accumulatorRegister:savedBase+keyCount+column});
  columnOwner.sortingIndexRegister=sortedBase;columnOwner.useSortingIdx=true;
  // select.c:updateAccumulator shares regHit across all NEEDCOLL calls.
  // This inverse magnet retains DISTINCT's previous state; FILTER copies
  // regAcc before jumping. Reset both cells at each group boundary.
  const change=entries.some(e=>(e.name==='min'||e.name==='max')&&e.orderCursor===undefined)?allocate():undefined,seen=allocate();
  ops.push({code:'Integer',p1:0n,p2:seen});if(change!==undefined)ops.push({code:'Integer',p1:1n,p2:change});
  const stepAt=ops.length;columnOwner.directMode=true;emitSteps(change,seen);
  const unchanged=ops.length;ops.push(change===undefined?{code:'IfPos',p1:seen,p2:0,p3:0}:{code:'IfNot',p1:change,p2:0});
  for(let i=0;i<width;i++)ops.push({code:'Copy',p1:sortedBase+keyCount+i,p2:savedBase+keyCount+i});
  (ops[unchanged] as {p2:number}).p2=ops.length;ops.push({code:'Integer',p1:1n,p2:seen});
  const advance=ops.length;ops.push({code:"SorterNext",p1:sorter,p2:advance+2},{code:"Goto",p2:0},{code:"SorterData",p1:sorter,p2:sortedBase,count:keyCount+width});ops.push({code:"CompareGroup",left:sortedBase,right:savedBase,count:keyCount,keyInfo,jump:stepAt});
  const emitGroup=()=>{columnOwner.directMode=false;emitFinals();let reject=-1;if(having){const test=compileExpressionTree(having,ops,allocate,parameters,compileAggregateSubquery);reject=ops.length;ops.push({code:"IfNot",p1:test,p2:0})}outputs.forEach((tree,index)=>{const value=compileExpressionTree(tree,ops,allocate,parameters,compileAggregateSubquery);ops.push({code:"Copy",p1:value,p2:outputStart+index})});let duplicate=-1;if(distinctResultCursor!==undefined){duplicate=ops.length;ops.push({code:"Found",p1:distinctResultCursor,keyStart:outputStart,keyCount:outputs.length,jump:0},{code:"IdxInsert",p1:distinctResultCursor,keyStart:outputStart,keyCount:outputs.length});}if(resultSorter!==undefined){const keyStart=selectProgramBuilder.range(Math.max(1,orderKeys.length));orderKeys.forEach((key,index)=>{const value='result' in key!?outputStart+key.result:'group' in key!?savedBase+key.group:compileExpressionTree(orderExpressions[index]!,ops,allocate,parameters,compileAggregateSubquery);ops.push({code:"Copy",p1:value,p2:keyStart+index});});ops.push({code:"SorterInsert",p1:resultSorter,keyStart,keyCount:orderKeys.length,payload:outputStart,payloadCount:outputs.length,...(groupLimit?{topN:groupLimit.capacity}:{})});}else{let offsetAt:number|undefined;if(groupLimit?.offset!==undefined){offsetAt=ops.length;ops.push({code:"IfPos",p1:groupLimit.offset,p2:0,p3:1});}emitSelectDestination(ops,parent?.destination??{kind:"output"},outputStart,outputs.length);if(groupLimit){groupLimitJumps.push(ops.length);ops.push({code:"DecrJumpZero",p1:groupLimit.count,p2:0});}if(offsetAt!==undefined)(ops[offsetAt] as {p2:number}).p2=ops.length;}if(duplicate>=0)(ops[duplicate] as {jump:number}).jump=ops.length;if(reject>=0)(ops[reject] as {p2:number}).p2=ops.length;};
  emitGroup();ops.push({code:"AggReset",registers:accumulatorRegisters});ops.push({code:'Integer',p1:0n,p2:seen});if(change!==undefined)ops.push({code:'Integer',p1:1n,p2:change});for(const entry of entries){if(entry.distinctCursor!==undefined)ops.push({code:"ClearEphemeral",p1:entry.distinctCursor});if(entry.orderCursor!==undefined)ops.push({code:"ClearSorter",p1:entry.orderCursor});}for(let i=0;i<keyCount+width;i++)ops.push({code:"Copy",p1:sortedBase+i,p2:savedBase+i});ops.push({code:"Goto",p2:stepAt});const finalAt=ops.length;(ops[advance+1] as {p2:number}).p2=finalAt;emitGroup();let resultSortAt:number|undefined,resultOffsetAt:number|undefined,resultLimitAt:number|undefined;if(resultSorter!==undefined){resultSortAt=ops.length;ops.push({code:"SorterSort",p1:resultSorter,emptyJump:0},{code:"SorterData",p1:resultSorter,p2:outputStart,count:outputs.length});if(groupLimit?.offset!==undefined){resultOffsetAt=ops.length;ops.push({code:"IfPos",p1:groupLimit.offset,p2:0,p3:1});}emitSelectDestination(ops,parent?.destination??{kind:"output"},outputStart,outputs.length);if(groupLimit){resultLimitAt=ops.length;ops.push({code:"DecrJumpZero",p1:groupLimit.count,p2:0});}const resultNext=ops.length;ops.push({code:"SorterNext",p1:resultSorter,p2:resultSortAt+1});if(resultOffsetAt!==undefined)(ops[resultOffsetAt] as {p2:number}).p2=resultNext;}const halt=ops.length;if(!parent)ops.push({code:"Halt"});(ops[sortAt] as {emptyJump:number}).emptyJump=halt;if(resultSortAt!==undefined)(ops[resultSortAt] as {emptyJump:number}).emptyJump=halt;if(resultLimitAt!==undefined)(ops[resultLimitAt] as {p2:number}).p2=halt;if(parent?.compoundLimit)parent.compoundLimit.stops.push(...groupLimitJumps);else for(const at of groupLimitJumps)(ops[at] as {p2:number}).p2=halt;if(groupLimit&&!parent?.compoundLimit)(ops[groupLimit.ifZero] as {p2:number}).p2=halt;
  const columns=select.result.map((expression,i)=>{if(groupedStream){const result=aggregatePlan.result[i]!;return Object.freeze({name:result.name,declaredType:result.descriptor.declaredType,database:result.descriptor.database,table:result.descriptor.table,origin:result.descriptor.origin});}const tree=trees[i]!;if(tree.kind==="column"){const source=aggregateSources.find(item=>item.cursor===(tree.cursor??0))!,columnIndex=tree.index<0?(tree.payloadIndex??source.base)-source.base:tree.index,c=source.table.columns[columnIndex]!;return Object.freeze({name:expression.alias??c.name,declaredType:c.declaredType,database:"main",table:source.table.name,origin:c.name})}return Object.freeze({name:expressionName(expression),declaredType:null,database:null,table:null,origin:null})});return Object.freeze({ops:parent?ops:Object.freeze(ops),registers:selectProgramBuilder.registers,columns:Object.freeze(columns),parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,...(whereAccounting?{whereAccounting}:{}),encoding:database.encoding});
 }
 // select.c:resetAccumulator precedes WHERE positioning on every invocation.
 // Standalone execution starts NULL too, but linked correlated production does not.
 ops.push({code:"AggReset",registers:entries.map(entry=>entry.register)});
 let rewind=-1,body=0,skip=-1;
 // select.c:updateAccumulator uses one regHit for NEEDCOLL functions.
 // changed is the inverse polarity of skipFlag. FILTER copies regAcc before
 // its jump; DISTINCT skips retain the previous magnet value.
 const captureChange=bareColumns.length&&entries.some(entry=>(entry.name==='min'||entry.name==='max')&&entry.orderCursor===undefined)?allocate():undefined;
 const captureSeen=captureChange!==undefined?allocate():undefined;
 if(captureSeen!==undefined)ops.push({code:'Integer',p1:0n,p2:captureSeen},{code:'Integer',p1:1n,p2:captureChange!});
 const emitPhysicalAccumulator=()=>{
  emitSteps(captureChange,captureSeen);
  const guard=ops.length;
  if(captureChange!==undefined)ops.push({code:'IfNot',p1:captureChange,p2:0});
  else if(bareOnce!==undefined)ops.push({code:'Once',p1:bareOnce,p2:0});
  for(const item of bareColumns){const value=compileExpressionTree(item.source,ops,allocate,parameters);ops.push({code:'Copy',p1:value,p2:item.register});}
  if(captureChange!==undefined||bareOnce!==undefined)(ops[guard] as {p2:number}).p2=ops.length;
  if(captureSeen!==undefined)ops.push({code:'Integer',p1:1n,p2:captureSeen});
 };
 if(parent?.input){
  parent.input.emit(()=>{
   let reject:number|undefined;
   if(where){const test=compileExpressionTree(where,ops,allocate,parameters,compileAggregateSubquery);reject=ops.length;ops.push({code:'IfNot',p1:test,p2:0});}
   emitPhysicalAccumulator();
   if(reject!==undefined)(ops[reject] as {p2:number}).p2=ops.length;
  });
 }
 else if(aggregateSources.length>1){
  // select.c:sqlite3WhereBegin/updateAccumulator/WhereEnd. The shared WHERE
  // producer owns candidate admission, ON/WHERE timing and outer continuation;
  // the callback consumes physical cursors before aggregate finalization.
  const inputSelect:SelectNode={...select,hasDistinct:false,hasOrderBy:false,
   orderBy:Object.freeze([]),limit:null,offset:null,hasLimit:false};
  whereAccounting=compileInnerTableSelect(inputSelect,aggregatePlan,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,{
   builder:selectProgramBuilder,ops,parameters,destination:{kind:'output'},
   cursorFor:source=>aggregateSources[aggregatePlan.sources.indexOf(source)]!.cursor,
   expressionBinding:resultLocation,consumeRow:emitPhysicalAccumulator
  });
 }
 else if(table){const tableCursor=aggregateSources[0]!.cursor;ops.push({code:"OpenRead",p1:table.rootPage,p2:tableCursor});rewind=ops.length;ops.push({code:"Rewind",p1:tableCursor,p2:0});body=ops.length;if(where){const test=compileExpressionTree(where,ops,allocate,parameters,compileAggregateSubquery);skip=ops.length;ops.push({code:"IfNot",p1:test,p2:0});}emitPhysicalAccumulator();const next=ops.length;ops.push({code:"Next",p1:aggregateSources[0]!.cursor,p2:body});if(skip>=0)(ops[skip] as {p2:number}).p2=next;(ops[rewind] as {p2:number}).p2=ops.length;}else {if(where){const test=compileExpressionTree(where,ops,allocate,parameters);skip=ops.length;ops.push({code:"IfNot",p1:test,p2:0});}emitSteps();if(skip>=0)(ops[skip] as {p2:number}).p2=ops.length;}
 columnOwner.directMode=false;emitFinals();let reject=-1;if(having){const test=compileExpressionTree(having,ops,allocate,parameters,compileAggregateSubquery);reject=ops.length;ops.push({code:"IfNot",p1:test,p2:0})}outputs.forEach((tree,index)=>{const value=compileExpressionTree(tree,ops,allocate,parameters,compileAggregateSubquery);ops.push({code:"Copy",p1:value,p2:outputStart+index})});let duplicate=-1;if(distinctResultCursor!==undefined){duplicate=ops.length;ops.push({code:"Found",p1:distinctResultCursor,keyStart:outputStart,keyCount:outputs.length,jump:0},{code:"IdxInsert",p1:distinctResultCursor,keyStart:outputStart,keyCount:outputs.length});}const offsetSkip=groupLimit?.offset===undefined?-1:ops.length;if(offsetSkip>=0)ops.push({code:"IfPos",p1:groupLimit!.offset!,p2:0,p3:1});emitSelectDestination(ops,parent?.destination??{kind:"output"},outputStart,outputs.length);if(parent?.compoundLimit&&groupLimit){parent.compoundLimit.stops.push(ops.length);ops.push({code:'DecrJumpZero',p1:groupLimit.count,p2:0});}const afterDestination=ops.length;if(duplicate>=0)(ops[duplicate] as {jump:number}).jump=afterDestination;if(reject>=0)(ops[reject] as {p2:number}).p2=ops.length;const halt=ops.length;if(!parent)ops.push({code:"Halt"});if(groupLimit){if(!parent?.compoundLimit)(ops[groupLimit.ifZero] as {p2:number}).p2=halt;if(offsetSkip>=0)(ops[offsetSkip] as {p2:number}).p2=halt;}
 const columns=aggregatePlan.result.map(result=>Object.freeze({name:result.name,declaredType:result.descriptor.declaredType,database:result.descriptor.database,table:result.descriptor.table,origin:result.descriptor.origin}));if(parent)return Object.freeze({ops,registers:selectProgramBuilder.registers,columns,parameters:Object.freeze([]),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,...(whereAccounting?{whereAccounting}:{}),encoding:database.encoding});return Object.freeze({ops:Object.freeze(ops),registers:selectProgramBuilder.registers,columns:Object.freeze(columns),parameters:Object.freeze(parameters.names.map(name=>Object.freeze({name}))),database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,...(whereAccounting?{whereAccounting}:{}),encoding:database.encoding});
}


function truth(m:Mem):boolean|null{if(m.initialStorageClass==="null")return null;return booleanValue(m,0)===1}
const expressionAffinity=(x:Expression):MemAffinity|undefined=>x.kind==="call"&&x.deferredAffinity?expressionAffinity(x.args[0]!):x.kind==="column"?x.affinity:x.kind==="cast"?x.affinity:x.kind==="collate"?expressionAffinity(x.value):undefined;
// expr.c:sqlite3ExprCollSeq follows CAST/unary-plus and propagates EP_Collate
// through expression children (including function argument lists), choosing the
// first collated child in source order. Keep undefined distinct from BINARY so
// select.c:multiSelectCollSeq can continue to a later compound arm.
// expr.c:sqlite3CompareAffinity/comparisonAffinity for IN(SELECT): if both
// operands have affinity use NUMERIC if either is numeric, otherwise NONE;
// with one affine operand use it, with neither use NONE (Mem's BLOB affinity).
function inComparisonAffinity(left:Expression,right:Expression):MemAffinity{
 return comparisonAffinity(expressionAffinity(left),expressionAffinity(right));
}
function comparisonAffinity(a:MemAffinity|undefined,b:MemAffinity|undefined):MemAffinity{
 if(a&&b)return a==="integer"||a==="real"||a==="numeric"||a==="flexnum"||b==="integer"||b==="real"||b==="numeric"||b==="flexnum"?"numeric":"blob";
 return a??b??"blob";
}
// expr.c:sqlite3ExprCollSeq. An absent collation is not BINARY until the
// consuming comparison supplies the default. EP_Collate remains explicit.
const expressionCollation=(x:Expression):BuiltinCollation|undefined=>{
 if(x.kind==='call'&&x.deferredAffinity)return expressionCollation(x.args[0]!);
 if(x.kind==='collate')return x.collation;
 if(x.kind==='mem'||x.kind==='column')return x.collation;
 if(x.kind==='cast'||x.kind==='unary'&&x.op==='+')return expressionCollation(x.value);
 return explicitCollation(x);
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
const binaryCollation=(left:Expression,right:Expression):BuiltinCollation=>explicitCollation(left)??explicitCollation(right)??expressionCollation(left)??expressionCollation(right)??"binary";
// expr.c TK_FUNCTION NEEDCOLL: first non-null argument collation wins,
// even when a later argument carries explicit COLLATE. Function result
// collation is a different contract (sqlite3ExprCollSeq).
function functionArgumentCollation(name:string,args:readonly Expression[]):BuiltinCollation{
 if(!builtinFunction(name)?.flags.includes('need-collation'))return 'binary';
 for(const arg of args){const named=expressionCollation(arg);if(named!==undefined)return named;}
 return 'binary';
}
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
 if(name==="json_pretty")throw new JSQLiteError("internal","pretty requires asynchronous Function execution");
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
 const out=new Mem();if(e.kind==="register"||e.kind==="aggregate"||e.kind==="scalar-subquery"||e.kind==="in-subquery"||e.kind==="in-list"||e.kind==="between")throw new JSQLiteError("internal","lowered expression reached evaluator");if(e.kind==="variable")throw new JSQLiteError("internal","variables are compiled before execution");if(e.kind==="mem")return e.value;if(e.kind==="column"){out.copyFrom(columns![e.index]!);return out}if(e.kind==="literal"){if(e.value===null)out.setNull();else if(typeof e.value==="bigint")out.setInt64(e.value);else if(typeof e.value==="number")out.setDouble(e.value);else if(typeof e.value==="string")out.setText(new TextEncoder().encode(e.value),"utf-8");else out.setBlob(e.value);return out}
 if(e.kind==="unary"){const v=evaluateExpression(e.value,encoding,columns);if(e.op==="+")return v;if(e.op==="-"){const z=new Mem();z.setInt64(0n);return arithmeticBinary("subtract",z,v)}return e.op==="~"?bitwiseNot(v):logicalNot(v)}
 if(e.kind==="cast"){const v=evaluateExpression(e.value,encoding,columns);v.cast(e.affinity,encoding);return v}
 if(e.kind==="collate")return evaluateExpression(e.value,encoding,columns);
 if(e.kind==="binary"){const a=evaluateExpression(e.left,encoding,columns);if(e.op==="AND"&&truth(a)===false){out.setInt64(0n);return out}if(e.op==="OR"&&truth(a)===true){out.setInt64(1n);return out}const b=evaluateExpression(e.right,encoding,columns);if(e.op==="||")return concatenateMem(a,b,encoding);if(e.op==="AND"||e.op==="OR"){const x=truth(a),y=truth(b),v=e.op==="AND"?(x===false||y===false?false:x===null||y===null?null:true):(x===true||y===true?true:x===null||y===null?null:false);v===null?out.setNull():out.setInt64(v?1n:0n);return out}if(["+","-","*","/","%"].includes(e.op)){return arithmeticBinary(({"+":"add","-":"subtract","*":"multiply","/":"divide","%":"remainder"} as const)[e.op as "+"],a,b)}const is=e.op==="IS"||e.op==="IS NOT";if(!is&&(a.initialStorageClass==="null"||b.initialStorageClass==="null")){out.setNull();return out}const bothNull=a.initialStorageClass==="null"&&b.initialStorageClass==="null",oneNull=a.initialStorageClass==="null"||b.initialStorageClass==="null";let cmp=0;if(!oneNull)cmp=compareMem(a,b,binaryCollation(e.left,e.right));let result:boolean;switch(e.op){case "=":case "==":result=cmp===0;break;case "IS":result=bothNull||(!oneNull&&cmp===0);break;case "!=":case "<>":result=cmp!==0;break;case "IS NOT":result=!bothNull&&(oneNull||cmp!==0);break;case "<":result=cmp<0;break;case "<=":result=cmp<=0;break;case ">":result=cmp>0;break;default:result=cmp>=0}out.setInt64(result?1n:0n);return out}
 if(e.kind==="case"){const base=e.operand?evaluateExpression(e.operand,encoding,columns):null;for(const [w,r] of e.pairs){const test=evaluateExpression(w,encoding,columns);if(base?(base.initialStorageClass!=="null"&&test.initialStorageClass!=="null"&&compareMem(base,test,"binary")===0):truth(test)===true)return evaluateExpression(r,encoding,columns)}return e.otherwise?evaluateExpression(e.otherwise,encoding,columns):out}
 const args=()=>e.args.map(x=>evaluateExpression(x,encoding,columns));if(e.name==="coalesce"){for(const x of e.args){const v=evaluateExpression(x,encoding,columns);if(v.initialStorageClass!=="null")return v}return out}const a=args();return evaluateFunction(e.name,a,encoding,functionArgumentCollation(e.name,e.args))
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
function sumStep(context:AggregateFunctionContext<SumCtx>,args:readonly Mem[]):void{const value=args[0]!,numeric=value.valueNumericTypeCopy();if(numeric.initialStorageClass==="null")return;const p=context.state();p.cnt++;if(!p.approx){if(numeric.initialStorageClass!=="integer"){kahanBabuskaNeumaierInit(p,p.iSum);p.approx=true;kahanBabuskaNeumaierStep(p,numeric.valueDouble(context.encoding));}else{const n=numeric.integerValue(),sum=p.iSum+n;if(sum>=INT64_MIN&&sum<=INT64_MAX)p.iSum=sum;else{p.ovrfl=true;kahanBabuskaNeumaierInit(p,p.iSum);p.approx=true;kahanBabuskaNeumaierStepInt64(p,n);}}}else if(numeric.initialStorageClass==="integer")kahanBabuskaNeumaierStepInt64(p,numeric.integerValue());else{p.ovrfl=false;kahanBabuskaNeumaierStep(p,numeric.valueDouble(context.encoding));}}
function sumInverse(context:AggregateFunctionContext<SumCtx>,args:readonly Mem[]):void{const numeric=args[0]!.valueNumericTypeCopy();if(numeric.initialStorageClass==="null")return;const p=context.currentState();if(!p||p.cnt===0n)throw new JSQLiteError("internal","sum inverse without stepped value");p.cnt--;if(!p.approx&&numeric.initialStorageClass==="integer")p.iSum-=numeric.integerValue();else if(numeric.initialStorageClass==="integer")kahanBabuskaNeumaierStepInt64(p,-numeric.integerValue());else{kahanBabuskaNeumaierStep(p,-numeric.valueDouble(context.encoding));p.ovrfl=false}}
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
function extremaDefinition(name:"min"|"max"):AggregateDefinition<ExtremaCtx>{return{name,arities:[1],create:c=>({values:[],bytes:0,inverseCapable:c.inverseCapable}),step:(c,a)=>{const value=a[0];if(!value||value.initialStorageClass==="null")return !c.currentState()?.values.length;const state=c.state(),bytes=valueBytes(value);if(!state.inverseCapable&&state.values.length){const best=state.values[0]!,better=name==="min"?compareMem(best,value,c.collation)>0:compareMem(best,value,c.collation)<0;if(!better)return false;const oldBytes=state.bytes,next=new Mem();c.budget.replace(oldBytes,bytes,"aggregate state exceeds total byte limit");try{next.copyFrom(value)}catch(error){c.budget.replace(bytes,oldBytes);throw error}best.release();state.values[0]=next;state.bytes=bytes;return true}const next=new Mem();c.budget.reserve(bytes,"aggregate state exceeds total byte limit");try{next.copyFrom(value)}catch(error){c.budget.release(bytes);throw error}let at=0;while(at<state.values.length&&(name==="min"?compareMem(state.values[at]!,next,c.collation)<=0:compareMem(state.values[at]!,next,c.collation)>=0))at++;state.values.splice(at,0,next);state.bytes+=bytes;return at===0},inverse:(c,a)=>{const value=a[0],state=c.currentState();if(!value||value.initialStorageClass==="null"||!state)return;if(!state.inverseCapable)throw new JSQLiteError("internal",`${name} inverse without inverse-capable state`);const at=state.values.findIndex(candidate=>compareMem(candidate,value,c.collation)===0);if(at<0)throw new JSQLiteError("internal",`${name} inverse without stepped value`);const [removed]=state.values.splice(at,1),bytes=valueBytes(removed!);removed!.release();state.bytes-=bytes;c.budget.release(bytes)},value:c=>{const out=new Mem(),best=c.currentState()?.values[0];if(best)out.copyFrom(best);c.setResult(out)},final:c=>{const out=new Mem(),best=c.currentState()?.values[0];if(best)out.copyFrom(best);c.setResult(out)},cleanup:s=>{for(const value of s.values)value.release();s.values.length=0}}}
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
  #indexCursors = new Map<number, IndexCursor>();
  #tableSeekCursors = new Map<number, TableCursor>();
  #jsonCursors = new Map<number,JsonTableCursor>();
  #cursorRoots = new Map<number, number>();
  #records = new Map<number, ReturnType<typeof decodeRecord>>();
  // Aggregate programs can retain a decoded row after Next moves the btree
  // cursor past EOF. Cache its rowid alongside it, as the VDBE cursor does.
  #recordRowids = new Map<number, bigint>();
  // vdbe.c OP_DeferredSeek keeps only a pending index-to-table mapping. The
  // table btree is moved (and accounted) on its first uncovered Column read.
  #deferredRowids = new Map<number,bigint>();
  #privateCursors = new Map<number, SorterCursor | EphemeralIndexCursor | FifoCursor | PriorityQueueCursor>();
  // MakeRecord owns only a register-range descriptor until Insert. This avoids an
  // unbudgeted second Mem copy; EphemeralIndexCursor performs the single
  // statement-budgeted copy at the insertion opcode's atomic checkpoint.
  #packedRecords = new Map<number, {start:number;count:number}>();
  // Execution-owned RHS Btree substitute, invalidated by each iterator reset.
  #inSets = new Map<number,{values:Mem[];bytes:number}>();
  #privateBytes: PrivateStateByteBudget;
  #once = new Set<number>();
  readonly #inverseAggregates: ReadonlySet<number>;
  #borrow = new BorrowLifetime();
  #rows = 0;
  #work = 0;
  #savedError: unknown = null;
  #currentTime: bigint|null = null;
  #privateAccounting:VdbePrivateAccounting=zeroPrivateAccounting();
  #executionStarted=false;
  constructor(program: Program, assertConnectionIdle: () => void, admit: () => () => void, onFinalize: () => void) {
    this.#program = program; this.#assertConnectionIdle = assertConnectionIdle; this.#admit = admit; this.#onFinalize = onFinalize;
    this.#registers = Array.from({ length: program.registers + 1 }, () => new Mem());
    this.#bindings = program.parameters.map(() => new Mem());
    this.#privateBytes = new PrivateStateByteBudget(program.privateStateLimits.maxBytes);
    this.#inverseAggregates = new Set(program.ops.filter((op):op is Extract<Op,{code:"AggInverse"}>=>op.code==="AggInverse").map(op=>op.p2));
  }
  get columnCount(): number { return this.#program.columns.length; }
  /** Internal conformance seam. A detached immutable snapshot prevents tests
   * from mutating statement execution state. */
  privateAccounting():VdbePrivateAccounting{return Object.freeze({...this.#privateAccounting,orBranchRoots:Object.freeze([...this.#privateAccounting.orBranchRoots])});}
  get parameterCount(): number { return this.#program.parameters.length; }
  parameterName(index: number): string | null { this.#assertLive(); if (!Number.isInteger(index) || index < 1 || index > this.parameterCount) range(); return this.#program.parameters[index - 1]!.name; }
  parameterIndex(name: string): number { this.#assertLive(); const found = this.#program.parameters.findIndex(parameter => parameter.name === name); return found < 0 ? 0 : found + 1; }
  bind(indexOrName: number | string, value: SqliteValue): void { this.#assertIdle(); if (this.#state !== "prepared") misuse("statement must be reset before binding"); const index = typeof indexOrName === "string" ? this.parameterIndex(indexOrName) : indexOrName; if (!Number.isInteger(index) || index < 1 || index > this.parameterCount) range(); let bound: Mem; try { bound = memFromPublic(value, this.#program.encoding); } catch (error) { throw new JSQLiteError("misuse", (error as Error).message, { cause: error }); } this.#bindings[index - 1]!.moveFrom(bound); }
  clearBindings(): void { this.#assertIdle(); this.#bindings.forEach(value => value.setNull()); }
  async step(options: OperationOptions = {}): Promise<StepResult> {
    this.#assertIdle();
    if(!this.#executionStarted){const plan=this.#program.whereAccounting;this.#privateAccounting={...zeroPrivateAccounting(),plannerCandidates:plan?.plannerCandidates??0,plannerPaths:plan?.plannerPaths??0};this.#executionStarted=true;}
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
          case "OpenIndex":
            if(op.orBranch)this.#privateAccounting={...this.#privateAccounting,orBranchStarts:this.#privateAccounting.orBranchStarts+1,orBranchRoots:[...this.#privateAccounting.orBranchRoots,op.p1]}; {this.#indexCursors.set(op.p2,this.#program.database!.indexCursor(op.p1));break;}
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
            const value=this.#registers[op.p1]!,message=op.boundary==="nth"?"second argument to nth_value must be a positive integer":`frame ${op.boundary} offset must be a non-negative ${op.numeric?"number":"integer"}`;
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
              if(value.initialStorageClass!=="integer"||value.integerValue()<(op.boundary==="nth"?1n:0n))throw new JSQLiteError("sqlite",message,{code:1});
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
          case "OpenEphemeral": this.#privateCursors.set(op.p1,new EphemeralIndexCursor(op.keyInfo,this.#program.privateStateLimits,this.#privateBytes,op.insertionOrder));break;
          case "MakeRecord": this.#packedRecords.set(op.p3,{start:op.p1,count:op.p2});break;
          case "NewRowid": this.#registers[op.p2]!.setInt64(BigInt((this.#privateCursors.get(op.p1) as EphemeralIndexCursor).size+1));break;
          case "Insert": {const record=this.#packedRecords.get(op.p2);if(!record)throw new JSQLiteError("internal","Insert record register was not packed");await (this.#privateCursors.get(op.p1) as EphemeralIndexCursor).insert(this.#registers.slice(record.start,record.start+record.count),this.#privateControl(options,limit,started));this.#packedRecords.delete(op.p2);break;}
          case "SorterInsert": {this.#privateAccounting={...this.#privateAccounting,sorterRows:this.#privateAccounting.sorterRows+1};const cursor=this.#privateCursors.get(op.p1) as SorterCursor,key=this.#registers.slice(op.keyStart,op.keyStart+op.keyCount),payload=this.#registers.slice(op.payload,op.payload+op.payloadCount),control=this.#privateControl(options,limit,started);if(op.topN!==undefined){const capacity=this.#registers[op.topN]!.integerValue();if(capacity>=0n)await cursor.insertBounded(key,payload,capacity,control);else await cursor.insert(key,payload,control);}else await cursor.insert(key,payload,control);break;}
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
          case "EphemeralSeekRowid": {const rowid=this.#registers[op.rowid]!;if(rowid.initialStorageClass==="null"||!(await (this.#privateCursors.get(op.p1) as EphemeralIndexCursor).seekRowid(rowid.integerValue(),this.#privateControl(options,limit,started))))this.#pc=op.jump;break;}
          case "EphemeralRowid": this.#registers[op.p2]!.setInt64((this.#privateCursors.get(op.p1) as EphemeralIndexCursor).rowid());break;
          case "EphemeralData": {const values=(this.#privateCursors.get(op.p1) as EphemeralIndexCursor).data();for(let i=0;i<op.count;i++)this.#registers[op.p2+i]!.copyFrom(values[i]!);break;}
          case "EphemeralNext": if((this.#privateCursors.get(op.p1) as EphemeralIndexCursor).next())this.#pc=op.p2;break;
          case "IfCursorSizeGt": {const threshold=op.thresholdRegister===undefined?op.threshold!:Number(this.#registers[op.thresholdRegister]!.integerValue())+(op.registerAdjustment??1);if((this.#privateCursors.get(op.p1) as EphemeralIndexCursor).size>threshold)this.#pc=op.jump;break;}
          case "IfRegisterGt": if(this.#registers[op.left]!.integerValue()>this.#registers[op.right]!.integerValue())this.#pc=op.jump;break;
          case "EphemeralAdvanceData": {const cursor=this.#privateCursors.get(op.p1) as EphemeralIndexCursor;if(!cursor.next()){if(op.emptyJump!==undefined){this.#pc=op.emptyJump;break;}throw new JSQLiteError("internal","window inverse cursor exhausted");}const values=cursor.data();for(let i=0;i<op.count;i++)this.#registers[op.p2+i]!.copyFrom(values[i]!);break;}
          case "IfEphemeralHasNext": if((this.#privateCursors.get(op.p1) as EphemeralIndexCursor).hasNext())this.#pc=op.jump;break;
          case "EphemeralResetPosition": (this.#privateCursors.get(op.p1) as EphemeralIndexCursor).rewindBeforeFirst();break;
          case "Rewind": {const cursor=op.p1??0,root=this.#cursorRoots.get(cursor);if(root===undefined)throw new JSQLiteError("internal","rewind on unopened cursor");const scan=this.#program.database!.tableScanCursor(root);this.#cursors.set(cursor,scan);this.#tableSeekCursors.delete(cursor);this.#deferredRowids.delete(cursor);this.#records.delete(cursor);this.#recordRowids.delete(cursor);if (!scan.first()) this.#pc = op.p2; else await this.#loadRecord(cursor,options, limit, started); break;}
          case "Last": {const cursor=op.p1??0,root=this.#cursorRoots.get(cursor);if(root===undefined)throw new JSQLiteError("internal","last on unopened cursor");const table=this.#program.database!.tableCursor(root);this.#tableSeekCursors.set(cursor,table);this.#cursors.delete(cursor);this.#records.delete(cursor);this.#recordRowids.delete(cursor);if(!table.last())this.#pc=op.p2;else this.#loadTableSeekRecord(cursor,table);break;}
          case "SeekRowid": {const cursor=op.p1??0,root=this.#cursorRoots.get(cursor);if(root===undefined)throw new JSQLiteError("internal","seek on unopened cursor");const keyMem=new Mem();keyMem.copyFrom(this.#registers[op.key]!);keyMem.applyAffinity("numeric",this.#program.database!.encoding);if(keyMem.initialStorageClass!=="integer"){this.#pc=op.p2;break;}let table=this.#tableSeekCursors.get(cursor);if(!table){table=this.#program.database!.tableCursor(root);this.#tableSeekCursors.set(cursor,table);}this.#privateAccounting={...this.#privateAccounting,tableSeeks:this.#privateAccounting.tableSeeks+1};if(!table.seek(keyMem.integerValue(),"ge")){this.#records.delete(cursor);this.#recordRowids.delete(cursor);this.#pc=op.p2;}else this.#loadTableSeekRecord(cursor,table);break;}
          case "SeekRowidRange": {const cursor=op.p1??0,root=this.#cursorRoots.get(cursor),key=this.#registers[op.key]!;if(root===undefined)throw new JSQLiteError("internal","range seek on unopened cursor");if(key.initialStorageClass!=="integer"){this.#pc=op.p2;break;}let table=this.#tableSeekCursors.get(cursor);if(!table){table=this.#program.database!.tableCursor(root);this.#tableSeekCursors.set(cursor,table);}this.#privateAccounting={...this.#privateAccounting,tableSeeks:this.#privateAccounting.tableSeeks+1};const exact=table.seek(key.integerValue(),op.reverse?"le":"ge");if(!table.valid||(!op.inclusive&&exact&&!(op.reverse?table.previous():table.next()))){this.#pc=op.p2;break;}this.#loadTableSeekRecord(cursor,table);break;}
          case "RowidUpperBound": {const rowid=this.#recordRowids.get(op.p1??0),key=this.#registers[op.key]!;if(rowid===undefined||key.initialStorageClass!=="integer"||(op.inclusive?rowid>key.integerValue():rowid>=key.integerValue()))this.#pc=op.p2;break;}
          case "RowidLowerBound": {const rowid=this.#recordRowids.get(op.p1??0),key=this.#registers[op.key]!;if(rowid===undefined||key.initialStorageClass!=="integer"||(op.inclusive?rowid<key.integerValue():rowid<=key.integerValue()))this.#pc=op.p2;break;}
          case "IndexNullRow": {const cursor=this.#indexCursors.get(op.p1);if(!cursor)throw new JSQLiteError("internal","NullRow on unopened index cursor");cursor.clearPosition();this.#records.delete(op.p1);this.#recordRowids.delete(op.p1);break;}
          case "IndexRewind": {const cursor=this.#indexCursors.get(op.p1);if(!cursor)throw new JSQLiteError("internal","rewind on unopened index cursor");this.#records.delete(op.p1);this.#recordRowids.delete(op.p1);if(!cursor.first())this.#pc=op.p2;else this.#loadIndexRecord(op.p1);break;}
          case "IndexLast": {const cursor=this.#indexCursors.get(op.p1);if(!cursor)throw new JSQLiteError("internal","last on unopened index cursor");this.#records.delete(op.p1);this.#recordRowids.delete(op.p1);if(!cursor.last())this.#pc=op.p2;else this.#loadIndexRecord(op.p1);break;}
          case "InListValue": {
            // expr.c:sqlite3CodeRhsOfIN fills an ephemeral KeyInfo Btree;
            // wherecode.c:codeINTerm reads it in field-specific index order.
            // Cache a bounded ordered set for this RHS cursor until its reset.
            const position=Number(this.#registers[op.indexRegister]!.integerValue());
            const field=op.setKey?.keyInfo.terms[op.setKey.fieldOrdinal??0]?.collation;
            let set=this.#inSets.get(op.indexRegister);
            if(!set){
              const sorted:Mem[]=[];let bytes=0;
              try{
                for(const source of op.values){
                  this.#checkControl(options,limit,started);this.#work++;
                  const value=new Mem();let owned=false;
                  try{
                    value.copyFrom(this.#registers[source]!);
                    if(op.setKey)value.applyAffinity(op.setKey.affinity,this.#program.encoding);
                    if(value.diagnostic().manifest==='null')continue;
                    let at=0,duplicate=false;
                    for(;at<sorted.length;at++){
                      this.#checkControl(options,limit,started);this.#work++;
                      const order=compareMem(sorted[at]!,value,field);
                      if(order===0){duplicate=true;break;}
                      if(op.setKey?.reverse?order<0:order>0)break;
                    }
                    if(!duplicate){
                      if(sorted.length>=this.#program.privateStateLimits.maxEntries)throw new PrivateStateLimitError('IN RHS exceeds private-state entry limit');
                      const size=value.initialStorageClass==='text'?value.textBytes().byteLength:value.initialStorageClass==='blob'?value.blobValue().byteLength:8;
                      if(size>this.#program.privateStateLimits.maxKeyBytes)throw new PrivateStateLimitError('IN RHS key exceeds private-state key limit');
                      this.#privateBytes.reserve(size,'IN RHS exceeds total private-state byte limit');bytes+=size;
                      sorted.splice(at,0,value);owned=true;
                    }
                  }finally{if(!owned)value.release();}
                }
                set={values:sorted,bytes};this.#inSets.set(op.indexRegister,set);
              }catch(error){for(const value of sorted)value.release();this.#privateBytes.release(bytes);throw error;}
            }
            this.#registers[op.indexRegister]!.setInt64(BigInt(position+1));
            if(position>=set.values.length)this.#pc=op.p2;
            else{
              this.#registers[op.target]!.copyFrom(set.values[position]!);
              this.#privateAccounting={...this.#privateAccounting,inProbes:this.#privateAccounting.inProbes+1};
            }
            break;
          }
          case "IndexSeekPrefix": {
            const cursor=this.#indexCursors.get(op.p1);
            if(!cursor)throw new JSQLiteError("internal","seek on unopened index cursor");
            const values:Mem[]=[];
            try {
              for(let index=0;index<op.keys.length;index++){
                const value=new Mem();values.push(value);
                value.copyFrom(this.#registers[op.keys[index]!]!);
                value.applyAffinity(op.affinities[index]!,this.#program.encoding);
              }
              // vdbe.c:5093: only forward inclusive SeekGE may consume
              // SeekScan. Prefix restarts must retain strict GT/LT semantics.
              if(op.seekScan){
                if(op.reverse||op.strict)throw new JSQLiteError("internal","SeekScan requires SeekGE");
                const scanValues=values.map(value=>{const copy=new Mem();copy.copyFrom(value);return copy;});
                const outcome=cursor.seekScan(scanValues,op.keyInfo,op.seekScan.steps,op.seekScan.hasRange,()=>{this.#checkControl(options,limit,started);this.#work++;},()=>{this.#privateAccounting={...this.#privateAccounting,indexNext:this.#privateAccounting.indexNext+1};});
                // Any Next invalidates decoded records, including DONE.
                this.#records.delete(op.p1);this.#recordRowids.delete(op.p1);
                if(outcome==="exhausted"){this.#pc=op.p2;break;}
                if(outcome==="found"){this.#loadIndexRecord(op.p1);break;}
              }
              this.#privateAccounting={...this.#privateAccounting,indexSeeks:this.#privateAccounting.indexSeeks+1};
              // vdbe.c:4935ff: partial-key bias belongs to Seek*, not to
              // an equality callback. All lowering callers share this owner.
              const direction=op.reverse?(op.strict?"lt":"le"):(op.strict?"gt":"ge");
              if(!cursor.seekKey(values,op.keyInfo,direction))this.#pc=op.p2;
              else this.#loadIndexRecord(op.p1);
            } finally {for(const value of values)value.release();}
            break;
          }
          case "IndexPrefixEnd": {const record=this.#records.get(op.p1),values=op.keys.map((register,index)=>{const value=new Mem();value.copyFrom(this.#registers[register]!);value.applyAffinity(op.affinities[index]!,this.#program.encoding);return value;});let matches=!!record;try{if(record)for(let i=0;i<values.length;i++){const raw=record.values[i];if(!raw){matches=false;break;}const current=memFromRawRecord(raw,this.#borrow);try{if(compareMem(current,values[i]!,op.keyInfo.terms[i]!.collation)!==0){matches=false;break;}}finally{current.release();}}}finally{for(const value of values)value.release();}if(!matches)this.#pc=op.p2;break;}
          case "IndexRangeEnd": {const record=this.#records.get(op.p1),raw=record?.values[op.field],key=this.#registers[op.key]!;if(!raw){this.#pc=op.p2;break;}const current=memFromRawRecord(raw,this.#borrow),bound=new Mem();bound.copyFrom(key);bound.applyAffinity(op.affinity,this.#program.encoding);try{const comparison=compareMem(current,bound,op.collation),passes=op.operator==="lt"?comparison<0:op.operator==="le"?comparison<=0:op.operator==="gt"?comparison>0:comparison>=0;if(!passes)this.#pc=op.p2;}finally{current.release();bound.release();}break;}
          case "DeferredSeek": {const index=this.#records.get(op.p1),raw=index?.values.at(-1);if(raw?.storageClass!=="integer")throw new JSQLiteError("internal","index rowid tail is not integer");this.#deferredRowids.set(op.p2,raw.value);this.#records.delete(op.p2);this.#recordRowids.set(op.p2,raw.value);break;}
          case "DeferredIndexSeek": {this.#privateAccounting={...this.#privateAccounting,tableSeeks:this.#privateAccounting.tableSeeks+1};const record=this.#records.get(op.p1),cursor=this.#indexCursors.get(op.p2);if(!record||!cursor)throw new JSQLiteError("internal","deferred index seek on unopened cursor");const values=op.primaryKeyFields.map(ordinal=>{const raw=record.values[ordinal];if(raw===undefined)throw new BtreeFormatError("secondary key is missing a primary-key field");return memFromRawRecord(raw,this.#borrow)});const key=new UnpackedRecordKey(values,0,"seek",op.physical.keyInfo);try{if(!cursor.seek(payload=>compareRecordKey(payload,key,op.physical.keyInfo),"ge"))throw new BtreeFormatError("secondary key does not reference a primary row");this.#loadIndexRecord(op.p2);}finally{key.release();}break;}
          case "NullRow": {
            this.#borrow.invalidate();
            this.#records.delete(op.p1);
            this.#recordRowids.delete(op.p1);
            this.#deferredRowids.delete(op.p1);
            this.#tableSeekCursors.get(op.p1)?.clearPosition();
            this.#indexCursors.get(op.p1)?.clearPosition();
            break;
          }
          case "Column": {const cursorNumber=op.p3??0,pending=this.#deferredRowids.get(cursorNumber);if(pending!==undefined){let table=this.#tableSeekCursors.get(cursorNumber);if(!table){const root=this.#cursorRoots.get(cursorNumber);if(root===undefined)throw new JSQLiteError("internal","deferred seek on unopened table cursor");table=this.#program.database!.tableCursor(root);this.#tableSeekCursors.set(cursorNumber,table);}this.#privateAccounting={...this.#privateAccounting,tableSeeks:this.#privateAccounting.tableSeeks+1};if(!table.seek(pending,"ge"))throw new BtreeFormatError("secondary rowid does not reference a table row");this.#loadTableSeekRecord(cursorNumber,table);this.#deferredRowids.delete(cursorNumber);}const record=this.#records.get(cursorNumber),raw=record?.values[op.p1] ?? {storageClass:"null" as const},borrowed=memFromRawRecord(raw, this.#borrow); this.#registers[op.p2]!.copyFrom(borrowed); borrowed.release(); if(op.affinity){this.#registers[op.p2]!.applyAffinity(op.affinity,this.#program.encoding);if(op.affinity==="real")this.#registers[op.p2]!.cast("real",this.#program.encoding);} break; }
          case "RealAffinity": {const value=this.#registers[op.p1]!;if(value.initialStorageClass==="integer")value.cast("real",this.#program.encoding);break;}
          case "Rowid": {const rowid=this.#recordRowids.get(op.p1??0);if(rowid!==undefined)this.#registers[op.p2]!.setInt64(rowid);else this.#registers[op.p2]!.setNull();break;}
          case "Eq": { const a=this.#registers[op.p1]!, b=this.#registers[op.p2]!, out=this.#registers[op.p3]!; a.applyAffinity(op.affinity,this.#program.database!.encoding); b.applyAffinity(op.affinity,this.#program.database!.encoding); out.setInt64(a.initialStorageClass!=="null" && b.initialStorageClass!=="null" && compareMem(a,b,op.collation)===0 ? 1n : 0n); break; }
          case "IsNull": if(this.#registers[op.p1]!.initialStorageClass==="null")this.#pc=op.p2;break;
          case "IfNot": if(op.residual)this.#privateAccounting={...this.#privateAccounting,residualTests:this.#privateAccounting.residualTests+1};if (truth(this.#registers[op.p1]!)!==true) this.#pc=op.p2; break;
          case "Next": {const cursor=op.p1??0,table=this.#tableSeekCursors.get(cursor);this.#privateAccounting={...this.#privateAccounting,tableNext:this.#privateAccounting.tableNext+1};if(table?table.next():this.#cursors.get(cursor)!.next()){if(table)this.#loadTableSeekRecord(cursor,table);else await this.#loadRecord(cursor,options,limit,started);this.#pc=op.p2;}break;}
          case "Prev": {const cursor=op.p1??0,table=this.#tableSeekCursors.get(cursor);if(!table)throw new JSQLiteError("internal","reverse movement without seek cursor");this.#privateAccounting={...this.#privateAccounting,tableNext:this.#privateAccounting.tableNext+1};if(table.previous()){this.#loadTableSeekRecord(cursor,table);this.#pc=op.p2;}break;}
          case "IndexNext": {this.#privateAccounting={...this.#privateAccounting,indexNext:this.#privateAccounting.indexNext+1};const cursor=this.#indexCursors.get(op.p1);if(!cursor)throw new JSQLiteError("internal","next on unopened index cursor");if(cursor.next()){this.#loadIndexRecord(op.p1);this.#pc=op.p2;}break;}
          case "IndexPrev": {this.#privateAccounting={...this.#privateAccounting,indexNext:this.#privateAccounting.indexNext+1};const cursor=this.#indexCursors.get(op.p1);if(!cursor)throw new JSQLiteError("internal","previous on unopened index cursor");if(cursor.previous()){this.#loadIndexRecord(op.p1);this.#pc=op.p2;}break;}
          case "Integer": {const old=this.#inSets.get(op.p2);if(old){for(const value of old.values)value.release();this.#privateBytes.release(old.bytes);this.#inSets.delete(op.p2);}this.#registers[op.p2]!.setInt64(op.p1);break;}
          case "Real": this.#registers[op.p2]!.setDouble(op.p1); break;
          case "String": this.#registers[op.p2]!.setText(new TextEncoder().encode(op.p1),"utf-8"); break;
          case "Blob": this.#registers[op.p2]!.setBlob(op.p1); break;
          case "RowSetTest": {
            if (!Number.isInteger(op.p4) || op.p4 < -1 || this.#registers[op.p3]!.initialStorageClass !== "integer") throw new JSQLiteError("internal", "invalid RowSetTest operands");
            const control = this.#privateControl(options,limit,started);
            let rowset = this.#registers[op.p1]!.rowSet();
            if (!rowset) {
              this.#registers[op.p1]!.setNull();
              rowset = new RowSet(this.#privateBytes,this.#program.privateStateLimits.maxEntries,control);
              this.#registers[op.p1]!.setRowSet(rowset);
            }
            // A new step call supplies a new deadline/signal closure.
            rowset.control = control;
            const value = this.#registers[op.p3]!.integerValue();
            if (op.p4 !== 0 && await rowset.test(op.p4,value)) { this.#privateAccounting={...this.#privateAccounting,orDuplicateSkips:this.#privateAccounting.orDuplicateSkips+1};this.#pc=op.p2; break; }
            if (op.p4 >= 0) await rowset.insert(value);
            break;
          }
          case "Null": {
            this.#registers[op.p2]!.setNull();break;
          }
          case "Copy": {const source=this.#registers[op.p1]!;this.#chargeValue(source,options,limit,started);this.#registers[op.p2]!.copyFrom(source);break;}
          case "Once": if(this.#once.has(op.p1))this.#pc=op.p2;else this.#once.add(op.p1); break;
          case "Gosub": this.#registers[op.p1]!.setInt64(BigInt(this.#pc));this.#pc=op.p2;break;
          case "BeginSubrtn": this.#registers[op.p2]!.setNull();break;
          case "Return": {const address=this.#registers[op.p1]!;if(address.initialStorageClass==='integer')this.#pc=Number(address.integerValue());else if(!op.fallthrough)throw new JSQLiteError('internal','Return without integer address');break;}
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
          case "CompareJump": {let result=0;for(let i=0;i<op.count;i++){const index=op.permutation?.[i]??i,term=op.keyInfo.terms[i]!;result=compareMem(this.#registers[op.left+index]!,this.#registers[op.right+index]!,term.collation);if(result!==0){if(term.nullsLarge&&(this.#registers[op.left+index]!.initialStorageClass === "null"||this.#registers[op.right+index]!.initialStorageClass === "null"))result=-result;if(term.desc)result=-result;break;}}this.#pc=result<0?op.less:result>0?op.greater:op.equal;break;}
          case "CompareGroup": {let equal=true;for(let i=0;i<op.count;i++)if(compareMem(this.#registers[op.left+i]!,this.#registers[op.right+i]!,op.keyInfo.terms[i]!.collation)!==0){equal=false;break}if(equal)this.#pc=op.jump;break;}
          case "AggStep": {const args=op.args.map(x=>this.#registers[x]!);await this.#chargeScalarInputs(args,options,limit,started);const changed=aggregateStep(this.#registers[op.p2]!,op.name,args,op.collation,this.#program.encoding,this.#program.maxResultBytes,this.#privateBytes,this.#inverseAggregates.has(op.p2));if(op.changed!==undefined)this.#registers[op.changed]!.setInt64(changed?1n:0n);break;}
          case "AggInverse": {const args=op.args.map(x=>this.#registers[x]!);await this.#chargeScalarInputs(args,options,limit,started);aggregateInverse(this.#registers[op.p2]!,op.name,args,op.collation,this.#program.encoding,this.#program.maxResultBytes,this.#privateBytes);break;}
          case "AggFinal": this.#registers[op.p1]!.moveFrom(aggregateResult(this.#registers[op.p1]!,op.name,this.#program.encoding,this.#program.maxResultBytes,this.#privateBytes,true));break;
          case "AggValue": this.#registers[op.p2]!.moveFrom(aggregateResult(this.#registers[op.p1]!,op.name,this.#program.encoding,this.#program.maxResultBytes,this.#privateBytes,false));break;
          case "Function": case "PureFunc": {const args=op.args.map(x=>this.#registers[x]!);await this.#chargeScalarInputs(args,options,limit,started);const control:ScalarControl={maxResultBytes:this.#program.maxResultBytes,checkSize:(bytes)=>{if(!Number.isSafeInteger(bytes)||bytes<0||bytes>this.#program.maxResultBytes)throw new JSQLiteError("limit","string or blob too big")},check:()=>this.#checkControl(options,limit,started),charge:(units)=>{for(let i=0;i<units;i++){this.#checkControl(options,limit,started);this.#work++;}},now:()=>this.#currentTime??(this.#currentTime=(this.#program.dateTimeEnvironment??defaultDateTimeEnvironment).nowUnixMilliseconds()),...(this.#program.dateTimeEnvironment?{dateTimeEnvironment:this.#program.dateTimeEnvironment}:{})};if(op.name==="json_pretty"){
 const prettyControl={reserve:(bytes:number)=>this.#privateBytes.reserve(bytes),release:(bytes:number)=>this.#privateBytes.release(bytes),checkpoint:(units:number)=>this.#privateControl(options,limit,started).checkpoint(units),charge:control.charge,check:control.check,checkSize:control.checkSize};
 this.#registers[op.p2]!.moveFrom(await runAsyncFunctionContext(()=>jsonPretty(args[0]!,args[1],prettyControl)));
 }else this.#registers[op.p2]!.moveFrom(runFunctionContext(()=>evaluateFunction(op.name,args,this.#program.encoding,op.collation,control)));break;}
          case "ShortCircuit": {const value=truth(this.#registers[op.p1]!);if((op.kind==="and"&&value===false)||(op.kind==="or"&&value===true)){this.#registers[op.p2]!.setInt64(op.kind==="and"?0n:1n);this.#pc=op.jump}break;}
          case "Boolean": {const x=truth(this.#registers[op.p1]!),y=truth(this.#registers[op.p2]!),v=op.kind==="and"?(x===false||y===false?false:x===null||y===null?null:true):(x===true||y===true?true:x===null||y===null?null:false);v===null?this.#registers[op.p3]!.setNull():this.#registers[op.p3]!.setInt64(v?1n:0n);break;}
          case "NotNull": if(this.#registers[op.p1]!.initialStorageClass!=="null"){this.#registers[op.p2]!.copyFrom(this.#registers[op.p1]!);this.#pc=op.jump}break;
          case "Variable": {const bound=this.#bindings[op.p1-1];if(!bound)throw new JSQLiteError("internal",`missing binding slot ${op.p1}/${this.#bindings.length}`);const target=this.#registers[op.p2];if(!target)throw new JSQLiteError("internal",`missing variable register ${op.p2}/${this.#registers.length}`);target.copyFrom(bound);break;}
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
  reset(): void {
    this.#assertIdle();
    const primary = this.#savedError; this.#savedError = null;
    let cleanup = this.#halt();
    // sqlite3VdbeReset returns the saved execution error after cleanup. TS
    // destructors may throw: finish releases and restore READY first.
    for (const value of this.#registers) try { value.setNull(); } catch (error) { if (cleanup === null) cleanup = error; }
    this.#rows=0; this.#work=0; this.#currentTime=null; this.#executionStarted=false; this.#privateAccounting=zeroPrivateAccounting(); this.#once.clear();
    this.#pc = 0; this.#state = "prepared";
    if (primary !== null) throw primary;
    if (cleanup !== null) throw cleanup;
  }
  finalize(): void {
    this.#assertIdle();
    const primary = this.#savedError; this.#savedError = null;
    let cleanup = this.#halt();
    for (const value of this.#registers) try { value.release(); } catch (error) { if (cleanup === null) cleanup = error; }
    for (const value of this.#bindings) try { value.release(); } catch (error) { if (cleanup === null) cleanup = error; }
    this.#state = "finalized";
    try { this.#onFinalize(); } catch (error) { if (cleanup === null) cleanup = error; }
    if (primary !== null) throw primary;
    if (cleanup !== null) throw cleanup;
  }
  columnMetadata(index: number): ColumnMetadata { this.#assertColumn(index, false); return Object.freeze({...this.#program.columns[index]!}); }
  columnType(index: number): SqliteStorageClass { return this.#cell(index).initialStorageClass; }
  column(index: number): SqliteValue { return memToPublicInitial(this.#cell(index)); }
  columnInteger(index: number): bigint | null { const cell = this.#cell(index); if(cell.initialStorageClass === "null")return null;const copy=new Mem();copy.copyFrom(cell);copy.cast("integer",this.#program.encoding);return copy.integerValue(); }
  columnReal(index: number): number | null { const cell = this.#cell(index); if(cell.initialStorageClass === "null")return null;const copy=new Mem();copy.copyFrom(cell);copy.cast("real",this.#program.encoding);return copy.realValue(); }
  columnText(index: number): string | null { const cell = this.#cell(index); if (cell.initialStorageClass === "null") return null; const copy = new Mem(); copy.copyFrom(cell); copy.cast("text", "utf-8"); return copy.textValue(); }
  columnBlob(index: number): Uint8Array | null { const cell = this.#cell(index); if (cell.initialStorageClass === "null") return null; const value = memToPublicInitial(cell); return value instanceof Uint8Array ? value : memFromPublic(String(value), "utf-8").textBytes().slice(); }
  #loadTableSeekRecord(cursorId:number,cursor:TableCursor):void {this.#borrow.invalidate();this.#records.set(cursorId,decodeRecord(cursor.payload(),this.#program.database!.encoding));this.#recordRowids.set(cursorId,cursor.rowid);}
  #loadIndexRecord(cursorId:number):void {
    this.#borrow.invalidate();const cursor=this.#indexCursors.get(cursorId);if(!cursor)throw new JSQLiteError("internal","index cursor is not open");
    const record=decodeRecord(cursor.payload(),this.#program.database!.encoding);this.#records.set(cursorId,record);
    const tail=record.values.at(-1);if(tail?.storageClass==="integer")this.#recordRowids.set(cursorId,tail.value);else this.#recordRowids.delete(cursorId);
  }
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
    this.#invalidateRow();this.#cursors.clear();this.#indexCursors.clear();this.#tableSeekCursors.clear();this.#deferredRowids.clear();for(const cursor of this.#jsonCursors.values())cursor.close();this.#jsonCursors.clear();this.#cursorRoots.clear();this.#records.clear();this.#recordRowids.clear();this.#packedRecords.clear();
    let diagnostic:unknown=null;
    for(const cursor of this.#privateCursors.values())try{cursor.close()}catch(error){if(diagnostic===null)diagnostic=error}
    this.#privateCursors.clear();for(const register of this.#registers)if(register.rowSet())try{register.setNull()}catch(error){if(diagnostic===null)diagnostic=error}for(const set of this.#inSets.values()){for(const value of set.values)value.release();this.#privateBytes.release(set.bytes);}this.#inSets.clear();this.#borrow.invalidate();
    return diagnostic;
  }
  #assertLive(): void { if (this.#state === "finalized") misuse("statement is finalized"); }
  #assertIdle(): void { this.#assertLive(); if (this.#state === "running" || this.#state === "suspended") misuse("statement operation is pending"); this.#assertConnectionIdle(); }
  #invalidateRow(): void { this.#rowStart = 0; this.#rowCount = 0; }
  #assertColumn(index: number, requireRow: boolean): void { this.#assertIdle(); if (!Number.isInteger(index) || index < 0 || index >= this.columnCount) range(); if (requireRow && this.#rowCount === 0) misuse("no current row"); }
  #cell(index: number): Mem { this.#assertColumn(index, true); return this.#registers[this.#rowStart + index]!; }
}
