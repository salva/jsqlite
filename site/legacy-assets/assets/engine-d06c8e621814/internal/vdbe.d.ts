import { type SelectInLoopRhs } from './where-plan.js';
import { type ResolvedSource, type ResolvedExpressionBinding } from './resolve.js';
import type { ColumnMetadata, OperationOptions, SqliteStorageClass, SqliteValue, Statement, StepResult } from "../index.js";
import { SelectProgramBuilder, type SelectDest } from "./select-program.js";
import { Mem, type MemAffinity } from "./mem.js";
import type { SelectNode } from "./parse.js";
import { KeyInfo, type BuiltinCollation } from "./comparison.js";
import { type PrivateStateLimits } from "./private-state.js";
import { type BtreeDatabase } from "./btree.js";
import type { PhysicalIndex, SchemaGraph } from "./schema.js";
import type { DatabaseEncoding } from "./record.js";
import { expandAndResolveSelect } from "./resolve.js";
import { type DateTimeEnvironment } from "./date-time.js";
import { sqlite3WindowRewrite, type WindowRewriteGraph } from "./window-rewrite.js";
export { sqlite3WindowRewrite };
export type { WindowRewriteFunction, WindowRewriteSortTerm, WindowRewriteLayer, WindowRewriteGraph } from "./window-rewrite.js";
type Op = {
    readonly code: "Integer";
    readonly p1: bigint;
    readonly p2: number;
} | {
    readonly code: "Real";
    readonly p1: number;
    readonly p2: number;
} | {
    readonly code: "String";
    readonly p1: string;
    readonly p2: number;
} | {
    readonly code: "Blob";
    readonly p1: Uint8Array;
    readonly p2: number;
} | {
    readonly code: "FilterInit";
    readonly p1: number;
    readonly bytes: number;
} | {
    readonly code: "FilterAdd";
    readonly p1: number;
    readonly p3: number;
    readonly p4: number;
} | {
    readonly code: "Filter";
    readonly p1: number;
    readonly p2: number;
    readonly p3: number;
    readonly p4: number;
    readonly probeCursor?: number;
} | {
    readonly code: "Null";
    readonly p2: number;
} | {
    readonly code: "Copy";
    readonly p1: number;
    readonly p2: number;
} | {
    readonly code: "Variable";
    readonly p1: number;
    readonly p2: number;
} | {
    readonly code: "Binary";
    readonly op: string;
    readonly p1: number;
    readonly p2: number;
    readonly p3: number;
    readonly collation: BuiltinCollation;
    readonly affinity?: MemAffinity;
} | {
    readonly code: "IfNullRow";
    readonly p1: number;
    readonly p2: number;
    readonly p3: number;
} | {
    readonly code: "TypeCheck";
    readonly p1: number;
    readonly affinity: MemAffinity;
    readonly table: string;
    readonly column: string;
    readonly type: string;
} | {
    readonly code: "Affinity";
    readonly p1: number;
    readonly affinity: MemAffinity;
} | {
    readonly code: "Cast";
    readonly p1: number;
    readonly p2: number;
    readonly affinity: MemAffinity;
} | {
    readonly code: "Function" | "PureFunc";
    readonly p5?: 'generated';
    readonly name: string;
    readonly args: readonly number[];
    readonly p2: number;
    readonly collation: BuiltinCollation;
} | {
    readonly code: "AggStep";
    readonly name: string;
    readonly args: readonly number[];
    readonly p2: number;
    readonly collation: BuiltinCollation;
    readonly changed?: number;
    readonly windowInverse?: boolean;
} | {
    readonly code: "AggInverse";
    readonly name: string;
    readonly args: readonly number[];
    readonly p2: number;
    readonly collation: BuiltinCollation;
} | {
    readonly code: "AggFinal";
    readonly name: string;
    readonly p1: number;
} | {
    readonly code: "AggValue";
    readonly name: string;
    readonly p1: number;
    readonly p2: number;
} | {
    readonly code: "AggReset";
    readonly registers: readonly number[];
} | {
    readonly code: "CompareJump";
    readonly permutation?: readonly number[];
    readonly left: number;
    readonly right: number;
    readonly count: number;
    readonly keyInfo: KeyInfo;
    readonly less: number;
    readonly equal: number;
    readonly greater: number;
} | {
    readonly code: "CompareGroup";
    readonly left: number;
    readonly right: number;
    readonly count: number;
    readonly keyInfo: KeyInfo;
    readonly jump: number;
} | {
    readonly code: "WindowRangeTest";
    readonly bigNull?: boolean;
    readonly candidate: number;
    readonly current: number;
    readonly offset?: number;
    readonly mode: "end-current" | "end-following" | "end-unbounded" | "start-unbounded" | "start-current" | "start-preceding" | "start-following";
    readonly descending: boolean;
    readonly collation: BuiltinCollation;
    readonly jump: number;
} | {
    readonly code: "CollSeq";
    readonly collation: BuiltinCollation;
} | {
    readonly code: "ElseEq";
    readonly p1: number;
    readonly jump: number;
} | {
    readonly code: "ShortCircuit";
    readonly kind: "and" | "or";
    readonly p1: number;
    readonly p2: number;
    readonly jump: number;
} | {
    readonly code: "Boolean";
    readonly kind: "and" | "or";
    readonly p1: number;
    readonly p2: number;
    readonly p3: number;
} | {
    readonly code: "NotNull";
    readonly p1: number;
    readonly p2: number;
    readonly jump: number;
} | {
    readonly code: "Once";
    readonly p1: number;
    readonly p2: number;
    readonly automaticTable?: number;
} | {
    readonly code: "RowSetTest";
    readonly p1: number;
    readonly p2: number;
    readonly p3: number;
    readonly p4: number;
} | {
    readonly code: "Gosub";
    readonly p1: number;
    readonly p2: number;
} | {
    readonly code: "BeginSubrtn";
    readonly p2: number;
} | {
    readonly code: "Return";
    readonly p1: number;
    readonly fallthrough?: boolean;
} | {
    readonly code: "InitCoroutine";
    readonly p1: number;
    readonly p2: number;
    readonly p3: number;
} | {
    readonly code: "Yield";
    readonly p1: number;
    readonly p2: number;
} | {
    readonly code: "EndCoroutine";
    readonly p1: number;
    readonly p2: number;
} | {
    readonly code: "OpenDup";
    readonly p1: number;
    readonly p2: number;
} | {
    readonly code: "Goto";
    readonly p2: number;
} | {
    readonly code: "Subtract";
    readonly p1: number;
    readonly p2: number;
    readonly p3: number;
} | {
    readonly code: "BitNot" | "Not";
    readonly p1: number;
    readonly p2: number;
} | {
    readonly code: "OpenRead";
    readonly p1: number;
    readonly p2?: number;
} | {
    readonly code: "IndexNullRow";
    readonly p1: number;
} | {
    readonly code: "OpenIndex";
    readonly orBranch?: boolean;
    readonly p1: number;
    readonly p2: number;
    readonly physical: PhysicalIndex;
} | {
    readonly code: "MetadataFilter";
    readonly p1: number;
    readonly schema: SchemaGraph;
    readonly input?: number;
    readonly database?: number;
    readonly module: string;
    readonly rowStart: number;
    readonly rowIdentity?: number;
    readonly p2: number;
} | {
    readonly code: "MetadataNext";
    readonly p1: number;
    readonly rowStart: number;
    readonly rowIdentity?: number;
    readonly p2: number;
} | {
    readonly code: "JsonTableRewind";
    readonly p1: number;
    readonly input?: number;
    readonly root?: number;
    readonly recursive: boolean;
    readonly binaryContainers: boolean;
    readonly rowStart: number;
    readonly columns?: ReadonlySet<number>;
    readonly rowIdentity?: number;
    readonly p2: number;
} | {
    readonly code: 'MetadataClose';
    readonly p1: number;
} | {
    readonly code: "JsonTableColumn";
    readonly p1: number;
    readonly column: number;
    readonly p2: number;
} | {
    readonly code: "JsonTableNullColumn";
    readonly p1: number;
    readonly column: number;
    readonly p2: number;
} | {
    readonly code: "JsonTableClose";
    readonly p1: number;
} | {
    readonly code: "PrivateCursorClose";
    readonly p1: number;
} | {
    readonly code: "JsonTableNext";
    readonly p1: number;
    readonly rowStart: number;
    readonly columns?: ReadonlySet<number>;
    readonly rowIdentity?: number;
    readonly p2: number;
} | {
    readonly code: "SorterOpen";
    readonly p1: number;
    readonly keyInfo: KeyInfo;
} | {
    readonly code: "SorterInsert";
    readonly p1: number;
    readonly keyStart: number;
    readonly keyCount: number;
    readonly payload: number;
    readonly payloadCount: number;
    readonly topN?: number;
} | {
    readonly code: "SorterSort";
    readonly p1: number;
    readonly emptyJump: number;
} | {
    readonly code: "SorterData";
    readonly p1: number;
    readonly p2: number;
    readonly count: number;
} | {
    readonly code: "SorterNext";
    readonly p1: number;
    readonly p2: number;
} | {
    readonly code: "OpenFifo";
    readonly p1: number;
} | {
    readonly code: "OpenPriorityQueue";
    readonly p1: number;
    readonly keyInfo: KeyInfo;
} | {
    readonly code: "PriorityInsert";
    readonly p1: number;
    readonly keyStart: number;
    readonly keyCount: number;
    readonly payloadStart: number;
    readonly payloadCount: number;
} | {
    readonly code: "PriorityShift";
    readonly p1: number;
    readonly p2: number;
    readonly count: number;
    readonly emptyJump: number;
} | {
    readonly code: "FifoInsert";
    readonly p1: number;
    readonly keyStart: number;
    readonly keyCount: number;
} | {
    readonly code: "FifoShift";
    readonly p1: number;
    readonly p2: number;
    readonly count: number;
    readonly emptyJump: number;
} | {
    readonly code: "OpenEphemeral" | "OpenAutoindex";
    readonly p1: number;
    readonly keyInfo: KeyInfo;
    readonly p4KeyInfo?: KeyInfo;
    readonly insertionOrder?: boolean;
    readonly statementEncoding?: boolean;
} | {
    readonly code: "MakeRecord";
    readonly p1: number;
    readonly p2: number;
    readonly p3: number;
    readonly p4Affinity?: readonly MemAffinity[];
} | {
    readonly code: "NewRowid";
    readonly p1: number;
    readonly p2: number;
} | {
    readonly code: "Insert";
    readonly p1: number;
    readonly p2: number;
    readonly p3: number;
} | {
    readonly code: "Found" | "NotFound";
    readonly p1: number;
    readonly keyStart: number;
    readonly keyCount: number;
    readonly jump: number;
} | {
    readonly code: "InSet";
    readonly p1: number;
    readonly key: number;
    readonly output: number;
    readonly affinity: MemAffinity;
    readonly negated: boolean;
    readonly count?: number;
    readonly affinities?: readonly MemAffinity[];
} | {
    readonly code: "IdxInsert";
    readonly p1: number;
    readonly keyStart: number;
    readonly keyCount: number;
    readonly p2?: number;
    readonly useSeekResult?: boolean;
    readonly consumeRecord?: boolean;
    readonly replace?: boolean;
} | {
    readonly code: "SetDelete";
    readonly p1: number;
    readonly keyStart: number;
    readonly keyCount: number;
} | {
    readonly code: "SetRetainIntersection";
    readonly p1: number;
    readonly p2: number;
} | {
    readonly code: "ClearEphemeral";
    readonly p1: number;
} | {
    readonly code: "ClearSorter";
    readonly p1: number;
} | {
    readonly code: "EphemeralSort";
    readonly p1: number;
} | {
    readonly code: "EphemeralRewind";
    readonly p1: number;
    readonly p2: number;
} | {
    readonly code: "EphemeralSeekRowid";
    readonly p1: number;
    readonly rowid: number;
    readonly jump: number;
} | {
    readonly code: "EphemeralRowid";
    readonly p1: number;
    readonly p2: number;
} | {
    readonly code: "EphemeralData";
    readonly p1: number;
    readonly p2: number;
    readonly count: number;
} | {
    readonly code: "EphemeralNext";
    readonly p1: number;
    readonly p2: number;
} | {
    readonly code: "IfCursorSizeGt";
    readonly p1: number;
    readonly threshold?: number;
    readonly thresholdRegister?: number;
    readonly registerAdjustment?: number;
    readonly jump: number;
} | {
    readonly code: "IfRegisterGt";
    readonly left: number;
    readonly right: number;
    readonly jump: number;
} | {
    readonly code: "EphemeralDelete";
    readonly p1: number;
} | {
    readonly code: "EphemeralPeekNextData";
    readonly p1: number;
    readonly p2: number;
    readonly count: number;
    readonly emptyJump: number;
} | {
    readonly code: "EphemeralAdvanceData";
    readonly p1: number;
    readonly p2: number;
    readonly count: number;
    readonly emptyJump?: number;
} | {
    readonly code: "IfEphemeralHasNext";
    readonly p1: number;
    readonly jump: number;
} | {
    readonly code: "EphemeralResetPosition";
    readonly p1: number;
} | {
    readonly code: "MustBeInt";
    readonly p1: number;
    readonly p2?: number;
} | {
    readonly code: "WindowCheck";
    readonly p1: number;
    readonly boundary: "starting" | "ending" | "nth";
    readonly numeric: boolean;
} | {
    readonly code: "OffsetLimit";
    readonly p1: number;
    readonly p2: number;
    readonly p3: number;
} | {
    readonly code: "IfNotZero";
    readonly p1: number;
    readonly p2: number;
} | {
    readonly code: "IfPos";
    readonly p1: number;
    readonly p2: number;
    readonly p3: number;
} | {
    readonly code: "DecrJumpZero";
    readonly p1: number;
    readonly p2: number;
} | {
    readonly code: "Rewind";
    readonly p1?: number;
    readonly p2: number;
} | {
    readonly code: "Last";
    readonly p1?: number;
    readonly p2: number;
} | {
    readonly code: "SeekRowid";
    readonly p1?: number;
    readonly key: number;
    readonly p2: number;
} | {
    readonly code: "SeekRowidRange";
    readonly p1?: number;
    readonly key: number;
    readonly inclusive: boolean;
    readonly reverse: boolean;
    readonly p2: number;
} | {
    readonly code: "RowidUpperBound";
    readonly p1?: number;
    readonly key: number;
    readonly inclusive: boolean;
    readonly p2: number;
} | {
    readonly code: "RowidLowerBound";
    readonly p1?: number;
    readonly key: number;
    readonly inclusive: boolean;
    readonly p2: number;
} | {
    readonly code: "IndexRewind";
    readonly p1: number;
    readonly p2: number;
} | {
    readonly code: "IndexLast";
    readonly p1: number;
    readonly p2: number;
} | {
    readonly code: "InListValue";
    readonly values: readonly number[];
    readonly indexRegister: number;
    readonly target: number;
    readonly p2: number;
    readonly setKey?: {
        readonly affinity: MemAffinity;
        readonly keyInfo: KeyInfo;
        readonly fieldOrdinal?: number;
        readonly reverse?: boolean;
    };
} | {
    readonly code: "IndexSeekPrefix";
    readonly p1: number;
    readonly keys: readonly number[];
    readonly affinities: readonly MemAffinity[];
    readonly keyInfo: KeyInfo;
    readonly reverse: boolean;
    readonly strict?: boolean;
    readonly seekScan?: Readonly<{
        steps: number;
        hasRange: boolean;
    }>;
    readonly p2: number;
} | {
    readonly code: 'IndexSeekHit';
    readonly p1: number;
    readonly keys: readonly number[];
    readonly affinities: readonly MemAffinity[];
    readonly keyInfo: KeyInfo;
} | {
    readonly code: 'IndexIfNoHope';
    readonly p1: number;
    readonly keys: readonly number[];
    readonly affinities: readonly MemAffinity[];
    readonly keyInfo: KeyInfo;
    readonly p2: number;
} | {
    readonly code: "IndexPrefixEnd";
    readonly p1: number;
    readonly keys: readonly number[];
    readonly affinities: readonly MemAffinity[];
    readonly keyInfo: KeyInfo;
    readonly p2: number;
} | {
    readonly code: "IndexRangeEnd";
    readonly p1: number;
    readonly field: number;
    readonly key: number;
    readonly affinity: MemAffinity;
    readonly collation: BuiltinCollation;
    readonly operator: "lt" | "le" | "gt" | "ge";
    readonly p2: number;
} | {
    readonly code: "DeferredSeek";
    readonly p1: number;
    readonly p2: number;
} | {
    readonly code: "DeferredIndexSeek";
    readonly p1: number;
    readonly p2: number;
    readonly primaryKeyFields: readonly number[];
    readonly physical: PhysicalIndex;
} | {
    readonly code: "NullRow";
    readonly p1: number;
} | {
    readonly code: "Column";
    readonly p1: number;
    readonly p2: number;
    readonly p3?: number;
    readonly affinity?: MemAffinity;
    readonly inProbe?: boolean;
} | {
    readonly code: "RealAffinity";
    readonly p1: number;
} | {
    readonly code: "Rowid";
    readonly p1?: number;
    readonly p2: number;
    readonly inProbe?: boolean;
} | {
    readonly code: "Eq";
    readonly p1: number;
    readonly p2: number;
    readonly p3: number;
    readonly affinity: MemAffinity;
    readonly collation: BuiltinCollation;
} | {
    readonly code: "IsNull";
    readonly p1: number;
    readonly p2: number;
} | {
    readonly code: "IfNot";
    readonly p1: number;
    readonly p2: number;
    readonly residual?: boolean;
    readonly whenTrue?: boolean;
    readonly jumpIfNull?: boolean;
} | {
    readonly code: "Next";
    readonly p1?: number;
    readonly p2: number;
} | {
    readonly code: "Prev";
    readonly p1?: number;
    readonly p2: number;
} | {
    readonly code: "IndexNext";
    readonly p1: number;
    readonly p2: number;
} | {
    readonly code: "IndexPrev";
    readonly p1: number;
    readonly p2: number;
} | {
    readonly code: "ResultRow";
    readonly p1: number;
    readonly p2: number;
} | {
    readonly code: "Halt";
};
export interface ParameterDescriptor {
    readonly name: string | null;
}
export interface Program {
    readonly expmask?: number;
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
    readonly whereAccounting?: Readonly<{
        plannerCandidates: number;
        plannerPaths: number;
    }>;
}
/** Production-private sqlite3_stmt_status-shaped accounting. It deliberately
 * does not extend the public Statement contract. */
export interface VdbePrivateAccounting {
    /** Opaque realm-local identities. Null before execution, never SQL hashes. */
    readonly executionId: string | null;
    readonly planId: string | null;
    readonly automaticBuilds: number;
    readonly automaticInserts: number;
    readonly automaticSeeks: number;
    readonly automaticCoveringReads: number;
    readonly filterAdds: number;
    readonly filterAbsent: number;
    readonly filterPresent: number;
    readonly plannerCandidates: number;
    readonly plannerPaths: number;
    readonly indexSeeks: number;
    readonly indexNext: number;
    readonly tableSeeks: number;
    readonly tableNext: number;
    readonly residualTests: number;
    readonly sorterRows: number;
    /** Number of separate RHS values used to drive an index IN loop. */
    readonly inProbes: number;
    readonly orBranchStarts: number;
    readonly orBranchRoots: readonly number[];
    readonly orDuplicateSkips: number;
}
export type WindowDeleteMode = "retain" | "agg-inverse" | "return-row" | "agg-step";
export interface WindowSetupLayer {
    readonly compatibleGroup: number;
    readonly regPart: number | null;
    readonly regPartInitialized: number | null;
    readonly partitionRegisters: readonly number[];
    readonly regOne: number;
    readonly regOutputReady: number;
    readonly boundRegisters: Readonly<{
        start: number | null;
        end: number | null;
    }>;
    readonly regStartRowid: number | null;
    readonly regEndRowid: number | null;
    readonly applicationCursor: number | null;
    readonly valueApplications: readonly Readonly<{
        result: number;
        start: number;
        end: number;
        cursor: number;
    }>[];
    readonly deleteMode: WindowDeleteMode;
    readonly partitionKeyInfo: KeyInfo | null;
    readonly peerKeyInfo: KeyInfo | null;
    readonly regNew: number;
    readonly inputRegisters: readonly number[];
    readonly regRecord: number;
    readonly regRowid: number;
    readonly regPeer: number | null;
    readonly startPeerRegisters: readonly number[];
    readonly currentPeerRegisters: readonly number[];
    readonly endPeerRegisters: readonly number[];
}
export interface WindowLoopBinding {
    readonly compatibleGroup: number;
    readonly producerKind: "original" | "rewritten-select";
    readonly producerCoroutine: number;
    readonly childCoroutine: number;
    readonly loopBody: number;
    readonly gosub: number;
    readonly returnAddress: number;
    readonly sorterCursor: number;
    readonly ownedClauses: readonly ("from" | "where" | "groupBy" | "having")[];
    readonly producerOrderBy: WindowRewriteGraph["layers"][number]["producerOrderBy"];
}
export interface WindowLoweringCompilation {
    readonly ownerExit?: number;
    readonly rewrite: WindowRewriteGraph;
    readonly setup: readonly WindowSetupLayer[];
    readonly loopBindings: readonly WindowLoopBinding[];
    readonly program: Program;
}
/** Internal, deliberately non-publishable SELECT lowering through the boundary
 * immediately before sqlite3WindowCodeStep. Unlike the earlier setup snapshot,
 * this owns the ordinary source scan and places each select.c Gosub in that
 * producer loop. The matching Return is the outer continuation. */
export declare function compileWindowSelectLowering(resolved: ReturnType<typeof expandAndResolveSelect>, encoding: DatabaseEncoding, database?: BtreeDatabase, maxWorkUnits?: number, maxResultBytes?: number, privateStateLimits?: PrivateStateLimits, schema?: SchemaGraph, recursiveProducer?: {
    select: SelectNode;
    maxRows: number;
}, owner?: {
    builder: SelectProgramBuilder<Op>;
    destination: SelectDest;
    parameters?: ParameterBuilder;
    retainedSource?: SelectNode;
}): WindowLoweringCompilation;
export declare function programOpcodeNames(program: Program): readonly string[];
/** Test/review projection of register ownership; values and function internals remain private. */
export declare function programRegisterFacts(program: Program): readonly Readonly<{
    index: number;
    code: string;
    p1?: number;
    p2?: number;
    p3?: number;
}>[];
/** Source-control projection: membership cursors must have packed-only producers.
 * Exposes no record values or execution state. */
export declare function programMembershipStorage(program: Program): readonly Readonly<{
    cursor: number;
    packed: boolean;
}>[];
export declare function programControlTargets(program: Program): readonly Readonly<{
    index: number;
    code: string;
    target: number;
    targetCode: string | undefined;
}>[];
export declare const DEFAULT_PRIVATE_STATE_LIMITS: PrivateStateLimits;
interface ParameterBuilder {
    maximum: number;
    readonly names: (string | null)[];
    readonly named: Map<string, number>;
    positions?: Map<number, number>;
}
/** Shared scalar-result owner, corresponding to sqlite3_context and its result Mem. */
export declare class FunctionContext {
    #private;
    readonly callSite: {
        name: string;
        pureContext?: 'generated';
    } | undefined;
    constructor(callSite?: {
        name: string;
        pureContext?: 'generated';
    });
    notPure(): void;
    firstError: unknown;
    setResult(value: Mem, cleanup?: (() => void) | null): void;
    setError(error: unknown): void;
    setAuxData(index: number, value: unknown, cleanup?: (() => void) | null): void;
    getAuxData(index: number): unknown;
    cleanupAuxData(index?: number): void;
    cleanupResult(): void;
    takeResult(): Mem;
}
export declare function rejectUnimplementedAggregateSelect(select: SelectNode): void;
/** resolve.c classifies aggregate calls from generated Expr structure. Identifiers
 * and aliases merely spelled like aggregate functions are not aggregate calls. */
export declare function selectHasAggregate(select: SelectNode): boolean;
/** select.c's Select.pWin ownership is local to one SELECT. */
export declare function selectHasWindow(select: SelectNode): boolean;
/** window.c:sqlite3WindowAttach rejects DISTINCT while attaching the OVER
 * clause, before source planning (including recursive-CTE planning). */
export declare function rejectDistinctWindowFunctions(select: SelectNode): void;
interface LimitRegisters {
    count: number;
    offset?: number;
    combined: number;
    capacity: number;
    ifZero: number;
}
export declare function compileRecursiveCteSelect(select: SelectNode, encoding: DatabaseEncoding, maxWorkUnits?: number, maxResultBytes?: number, privateStateLimits?: PrivateStateLimits, maxRows?: number, producerOnly?: boolean, shared?: {
    builder: SelectProgramBuilder<Op>;
    destination: SelectDest;
    parameters?: ParameterBuilder;
}): Program;
/** select.c tag-select-0482: a recursive SrcItem that is not the sole input
 * is retained as a materialized producer; WHERE/AggInfo own its consumers. */
export declare function compileRecursiveCompoundSelect(select: SelectNode, schema: SchemaGraph, database: BtreeDatabase, maxRows: number, maxWorkUnits: number, maxResultBytes: number, privateStateLimits: PrivateStateLimits): Program | undefined;
export declare function compileRecursiveJoinedSelect(select: SelectNode, schema: SchemaGraph, database: BtreeDatabase, maxRows: number, maxWorkUnits: number, maxResultBytes: number, privateStateLimits: PrivateStateLimits, shared: {
    builder: SelectProgramBuilder<Op>;
    parameters: ParameterBuilder;
    destination: SelectDest;
}): Program | undefined;
export declare function compileRecursiveAggregateSelect(select: SelectNode, schema: SchemaGraph, database: BtreeDatabase, maxRows: number, maxWorkUnits?: number, maxResultBytes?: number, privateStateLimits?: PrivateStateLimits, shared?: {
    builder: SelectProgramBuilder<Op>;
    parameters: ParameterBuilder;
    destination: SelectDest;
}): Program | undefined;
export declare function compileRecursiveWindowSelect(select: SelectNode, schema: SchemaGraph, database: BtreeDatabase, maxRows?: number, maxWorkUnits?: number, maxResultBytes?: number, privateStateLimits?: PrivateStateLimits, shared?: {
    builder: SelectProgramBuilder<Op>;
    parameters: ParameterBuilder;
    destination: SelectDest;
}): Program | undefined;
/** Compose multiple bounded recursive producers by redirecting each iterative
 * queue's output into a VDBE sorter, then draining the materializations with an
 * ordinary nested loop. No recursive host-language evaluation is introduced. */
export declare function compileMultipleRecursiveCtes(select: SelectNode, encoding: DatabaseEncoding, maxWorkUnits?: number, maxResultBytes?: number, privateStateLimits?: PrivateStateLimits, maxRows?: number, shared?: {
    builder: SelectProgramBuilder<Op>;
    parameters: ParameterBuilder;
    destination: SelectDest;
}): Program | undefined;
export declare function compileScalarSelect(select: SelectNode, encoding: DatabaseEncoding, maxWorkUnits?: number, maxResultBytes?: number, privateStateLimits?: PrivateStateLimits, schema?: SchemaGraph, database?: BtreeDatabase, maxRows?: number, owner?: {
    builder: SelectProgramBuilder<Op>;
    parameters: ParameterBuilder;
    emitRow: (first: number, count: number) => void;
    destination?: SelectDest;
    sharedLimit?: LimitRegisters;
    scalarPrepared?: boolean;
    linkedPlan?: ReturnType<typeof expandAndResolveSelect>;
    expressionBinding?: ResolvedExpressionBinding;
}): Program;
export declare function compileSelectedInRhs(rhs: SelectInLoopRhs, outer: ReturnType<typeof expandAndResolveSelect>, builder: SelectProgramBuilder<Op>, parameters: ParameterBuilder, environment: {
    schema?: SchemaGraph | undefined;
    database: BtreeDatabase;
    maxRows: number;
    maxWorkUnits: number;
    maxResultBytes: number;
    privateStateLimits: PrivateStateLimits;
}, selectedFields?: readonly number[], binding?: ResolvedExpressionBinding): {
    rhs: SelectInLoopRhs;
    fieldMap: number[];
    storage: import("./where-in-producer.js").SelectedInStorage;
    cursor: number;
    keyInfo: KeyInfo;
    destination: Extract<SelectDest, {
        kind: "set";
    }> | null;
    onceRegister: number;
    start: number;
    end: number;
};
export declare function compileOrderedCteUnionAll(select: SelectNode, schema: SchemaGraph, database: BtreeDatabase, maxRows: number, maxWorkUnits: number, maxResultBytes: number, privateStateLimits: PrivateStateLimits): Program | undefined;
export declare function compileOrderedCteUnionAll(select: SelectNode, schema: SchemaGraph, database: BtreeDatabase, maxRows: number, maxWorkUnits: number, maxResultBytes: number, privateStateLimits: PrivateStateLimits, owner: {
    builder: SelectProgramBuilder<Op>;
    parameters: ParameterBuilder;
    destination: SelectDest;
}): {
    columns: Program['columns'];
} | undefined;
type CompoundSelectOwner = {
    builder: SelectProgramBuilder<Op>;
    parameters: ParameterBuilder;
    destination: SelectDest;
    linkedPlan?: ReturnType<typeof expandAndResolveSelect>;
    expressionBinding?: ResolvedExpressionBinding;
    sharedLimit?: LimitRegisters;
    scalarPrepared?: boolean;
};
export declare function compileCteUnionAll(select: SelectNode, schema: SchemaGraph, database: BtreeDatabase, maxRows: number, maxWorkUnits: number, maxResultBytes: number, privateStateLimits: PrivateStateLimits): Program | undefined;
export declare function compileCteUnionAll(select: SelectNode, schema: SchemaGraph, database: BtreeDatabase, maxRows: number, maxWorkUnits: number, maxResultBytes: number, privateStateLimits: PrivateStateLimits, owner: CompoundSelectOwner): {
    columns: Program['columns'];
} | undefined;
export type FromSubqueryRouteFacts = Readonly<{
    sourceCount: number;
    index: number;
    joinFromLeft: SelectNode["from"]["items"][number]["joinFromLeft"];
    nextCross: boolean;
    leftOfRightJoin: boolean;
    updateFrom: boolean;
    coroutineOptimization: boolean;
    isCte: boolean | null;
    cteMaterialized: boolean | null;
    cteUseCount: number | null;
    cteNotMaterialized: boolean | null;
    earlierSubquery: boolean | null;
    selfJoinView: boolean | null;
}>;
export declare function precedingFromCoroutineBarrier(select: SelectNode, index: number, schema: SchemaGraph): boolean;
/** Direct translation of select.c:fromClauseTermCanBeCoroutine conditions 1a-c/2a-b/3-5. */
export declare function fromClauseTermCanBeCoroutine(f: FromSubqueryRouteFacts): boolean;
/** Initial resolve.c/select.c-shaped single rowid-table full-scan compiler. */
export declare function compileTableSelect(select: SelectNode, schema: SchemaGraph, database: BtreeDatabase, maxRows: number, maxWorkUnits?: number, maxResultBytes?: number, privateStateLimits?: PrivateStateLimits, shared?: {
    builder: SelectProgramBuilder<Op>;
    parameters: ParameterBuilder;
    destination: SelectDest;
    scalarPrepared?: boolean;
    sharedLimit?: LimitRegisters;
    linkedPlan?: ReturnType<typeof expandAndResolveSelect>;
    expressionBinding?: ResolvedExpressionBinding;
}): Program;
export declare function aggregateShapeSupported(select: SelectNode): boolean;
/** select.c:sqlite3Select aggregate-without-GROUP tranche. AggInfo entries own
 * accumulator registers; ordinary expression lowering consumes AggFinal values. */
export declare function compileAggregateSelect(select: SelectNode, schema: SchemaGraph | undefined, database: BtreeDatabase, maxRows: number, maxWorkUnits?: number, maxResultBytes?: number, privateStateLimits?: PrivateStateLimits, parent?: {
    builder: SelectProgramBuilder<Op>;
    ops: Op[];
    parameters: ParameterBuilder;
    destination: import("./select-program.js").SelectDest;
    compoundLimit?: {
        registers: LimitRegisters | undefined;
        stops: number[];
    };
    linkedPlan?: ReturnType<typeof expandAndResolveSelect>;
    scalarPrepared?: boolean;
    sharedLimit?: LimitRegisters;
    cursorFor?: (source: ResolvedSource) => number;
    retainedCursors?: ReadonlySet<number>;
    expressionBinding?: ResolvedExpressionBinding;
    input?: {
        first: number;
        sourceRegister?: (index: number) => number;
        rowIdentities?: boolean;
        emit: (consume: () => void) => void;
    };
}): Program;
export declare class VdbeStatement implements Statement {
    #private;
    readonly recompile: ((bindings: readonly Mem[], check: () => void) => Program) | undefined;
    constructor(program: Program, assertConnectionIdle: () => void, admit: () => () => void, onFinalize: () => void, recompile?: (bindings: readonly Mem[], check: () => void) => Program);
    get columnCount(): number;
    privateAccounting(): Readonly<{
        completedAutomaticBuilds: number;
        coveringTableLookups: number;
        collisionRejects: number;
        emittedOps: readonly ("Integer" | "Real" | "String" | "Blob" | "FilterInit" | "FilterAdd" | "Filter" | "Null" | "Copy" | "Variable" | "Binary" | "IfNullRow" | "TypeCheck" | "Affinity" | "Cast" | "Function" | "PureFunc" | "AggStep" | "AggInverse" | "AggFinal" | "AggValue" | "AggReset" | "CompareJump" | "CompareGroup" | "WindowRangeTest" | "CollSeq" | "ElseEq" | "ShortCircuit" | "Boolean" | "NotNull" | "Once" | "RowSetTest" | "Gosub" | "BeginSubrtn" | "Return" | "InitCoroutine" | "Yield" | "EndCoroutine" | "OpenDup" | "Goto" | "Subtract" | "BitNot" | "Not" | "OpenRead" | "IndexNullRow" | "OpenIndex" | "MetadataFilter" | "MetadataNext" | "JsonTableRewind" | "MetadataClose" | "JsonTableColumn" | "JsonTableNullColumn" | "JsonTableClose" | "PrivateCursorClose" | "JsonTableNext" | "SorterOpen" | "SorterInsert" | "SorterSort" | "SorterData" | "SorterNext" | "OpenFifo" | "OpenPriorityQueue" | "PriorityInsert" | "PriorityShift" | "FifoInsert" | "FifoShift" | "OpenEphemeral" | "OpenAutoindex" | "MakeRecord" | "NewRowid" | "Insert" | "Found" | "NotFound" | "InSet" | "IdxInsert" | "SetDelete" | "SetRetainIntersection" | "ClearEphemeral" | "ClearSorter" | "EphemeralSort" | "EphemeralRewind" | "EphemeralSeekRowid" | "EphemeralRowid" | "EphemeralData" | "EphemeralNext" | "IfCursorSizeGt" | "IfRegisterGt" | "EphemeralDelete" | "EphemeralPeekNextData" | "EphemeralAdvanceData" | "IfEphemeralHasNext" | "EphemeralResetPosition" | "MustBeInt" | "WindowCheck" | "OffsetLimit" | "IfNotZero" | "IfPos" | "DecrJumpZero" | "Rewind" | "Last" | "SeekRowid" | "SeekRowidRange" | "RowidUpperBound" | "RowidLowerBound" | "IndexRewind" | "IndexLast" | "InListValue" | "IndexSeekPrefix" | "IndexSeekHit" | "IndexIfNoHope" | "IndexPrefixEnd" | "IndexRangeEnd" | "DeferredSeek" | "DeferredIndexSeek" | "NullRow" | "Column" | "RealAffinity" | "Rowid" | "Eq" | "IsNull" | "IfNot" | "Next" | "Prev" | "IndexNext" | "IndexPrev" | "ResultRow" | "Halt")[];
        executedOps: readonly ("Integer" | "Real" | "String" | "Blob" | "FilterInit" | "FilterAdd" | "Filter" | "Null" | "Copy" | "Variable" | "Binary" | "IfNullRow" | "TypeCheck" | "Affinity" | "Cast" | "Function" | "PureFunc" | "AggStep" | "AggInverse" | "AggFinal" | "AggValue" | "AggReset" | "CompareJump" | "CompareGroup" | "WindowRangeTest" | "CollSeq" | "ElseEq" | "ShortCircuit" | "Boolean" | "NotNull" | "Once" | "RowSetTest" | "Gosub" | "BeginSubrtn" | "Return" | "InitCoroutine" | "Yield" | "EndCoroutine" | "OpenDup" | "Goto" | "Subtract" | "BitNot" | "Not" | "OpenRead" | "IndexNullRow" | "OpenIndex" | "MetadataFilter" | "MetadataNext" | "JsonTableRewind" | "MetadataClose" | "JsonTableColumn" | "JsonTableNullColumn" | "JsonTableClose" | "PrivateCursorClose" | "JsonTableNext" | "SorterOpen" | "SorterInsert" | "SorterSort" | "SorterData" | "SorterNext" | "OpenFifo" | "OpenPriorityQueue" | "PriorityInsert" | "PriorityShift" | "FifoInsert" | "FifoShift" | "OpenEphemeral" | "OpenAutoindex" | "MakeRecord" | "NewRowid" | "Insert" | "Found" | "NotFound" | "InSet" | "IdxInsert" | "SetDelete" | "SetRetainIntersection" | "ClearEphemeral" | "ClearSorter" | "EphemeralSort" | "EphemeralRewind" | "EphemeralSeekRowid" | "EphemeralRowid" | "EphemeralData" | "EphemeralNext" | "IfCursorSizeGt" | "IfRegisterGt" | "EphemeralDelete" | "EphemeralPeekNextData" | "EphemeralAdvanceData" | "IfEphemeralHasNext" | "EphemeralResetPosition" | "MustBeInt" | "WindowCheck" | "OffsetLimit" | "IfNotZero" | "IfPos" | "DecrJumpZero" | "Rewind" | "Last" | "SeekRowid" | "SeekRowidRange" | "RowidUpperBound" | "RowidLowerBound" | "IndexRewind" | "IndexLast" | "InListValue" | "IndexSeekPrefix" | "IndexSeekHit" | "IndexIfNoHope" | "IndexPrefixEnd" | "IndexRangeEnd" | "DeferredSeek" | "DeferredIndexSeek" | "NullRow" | "Column" | "RealAffinity" | "Rowid" | "Eq" | "IsNull" | "IfNot" | "Next" | "Prev" | "IndexNext" | "IndexPrev" | "ResultRow" | "Halt")[];
        orBranchRoots: readonly number[];
        memBytes: number;
        memHighwaterBytes: number;
        scratchBytes: number;
        scratchHighwaterBytes: number;
        recordBytes: number;
        recordHighwaterBytes: number;
        payloadScratchBytes: number;
        payloadScratchHighwaterBytes: number;
        packedPages: number;
        packedPagesHighwater: number;
        highwaterEntries: number;
        highwaterKeyBytes: number;
        ownerId: number;
        chargedBytes: number;
        refundedBytes: number;
        ownedBytes: number;
        highwaterBytes: number;
        executionId: string | null;
        planId: string | null;
        automaticBuilds: number;
        automaticInserts: number;
        automaticSeeks: number;
        automaticCoveringReads: number;
        filterAdds: number;
        filterAbsent: number;
        filterPresent: number;
        plannerCandidates: number;
        plannerPaths: number;
        indexSeeks: number;
        indexNext: number;
        tableSeeks: number;
        tableNext: number;
        residualTests: number;
        sorterRows: number;
        inProbes: number;
        orBranchStarts: number;
        orDuplicateSkips: number;
        openCursors: number;
        onceActive: boolean;
        filterBytes: number;
        version: 1;
        planKind: "other" | "automatic-index" | "standalone-bloom";
        builds: number;
        insertedRecords: number;
        probes: number;
        planIdentity: string | null;
    }>;
    get parameterCount(): number;
    parameterName(index: number): string | null;
    parameterIndex(name: string): number;
    bind(indexOrName: number | string, value: SqliteValue): void;
    clearBindings(): void;
    step(options?: OperationOptions): Promise<StepResult>;
    reset(): void;
    finalize(): void;
    columnMetadata(index: number): ColumnMetadata;
    columnType(index: number): SqliteStorageClass;
    column(index: number): SqliteValue;
    columnInteger(index: number): bigint | null;
    columnReal(index: number): number | null;
    columnText(index: number): string | null;
    columnBlob(index: number): Uint8Array | null;
}
