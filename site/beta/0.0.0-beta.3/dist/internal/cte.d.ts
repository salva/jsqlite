import type { CteNode, SelectNode } from "./parse.js";
/** Prepare-owned mutable identity corresponding to sqliteInt.h:CteUse. */
export type CteUse = {
    readonly declaration: CteNode;
    nUse: number;
    materializationAddress: number | null;
    returnRegister: number | null;
    cursorId: number | null;
};
export declare class CtePrepareContext {
    readonly uses: Map<Readonly<{
        name: string;
        columns: readonly string[] | null;
        select: SelectNode;
        materialization: import("./parse.js").CteMaterialization;
    }>, CteUse>;
    use(declaration: CteNode): CteUse;
}
/** Recognize ownership that requires select.c's recursive queue algorithm
 * before ordinary lowering consumes the WITH carrier. A RECURSIVE keyword by
 * itself is not enough: SQLite permits ordinary declarations under it. */
export declare function recursiveCteOwner(root: SelectNode): string | null;
/** select.c:sqlite3WithPush/sqlite3SelectPopWith and resolveFromTermToCte for
 * represented ordinary single-source owners. Frames are lexical; qualified
 * names bypass CTE lookup; bodies inherit the declaration frame; inner WITHs
 * shadow outer declarations. CteUse is allocated only after successful lookup
 * and shared by declaration identity in this prepare context. */
export declare function lowerOrdinaryCtes(root: SelectNode, context?: CtePrepareContext): SelectNode | null;
