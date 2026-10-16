export interface PatternControl {
    charge(units: number): void;
    check(): void;
}
/**
 * Browser-safe state-machine form of pinned func.c:patternCompare.  SQLite's
 * routine recursively resumes after matchAll; the explicit work-list preserves
 * the same alternatives without depending on the host call-stack.  Visited
 * (pattern,input) states remove only repeated searches and do not alter results.
 */
export declare function sqlitePatternCompare(patternText: string, inputText: string, mode: "like" | "glob", escape: string | null, control?: PatternControl): boolean;
export declare function validateLikeEscape(value: string): string;
