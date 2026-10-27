import type { DatabaseEncoding } from './record.js';
/** whereexpr.c:isLikeOrGlob and exprAnalyze TERM_LIKEOPT. Keep bounds as
 * UTF-8 bytes: successor construction can create a noncanonical byte sequence,
 * which must not pass through a WHATWG decoder. The caller owns literal/bound
 * TEXT admission, parameter varmask, resolved function identity, and join marks.
 * This primitive alone is NOT permission to select a TEXT-only range: the
 * default pinned build also requires whereLikeOptimizationStringFixup's BLOB
 * pass, paired range enrollment, and disableTerm/continuation ownership.
 */
export interface LikePrefixRange {
    readonly lower: Uint8Array;
    readonly upper: Uint8Array;
    readonly complete: boolean;
    readonly noCase: boolean;
}
/** func.c:sqlite3IsLikeFunction admits only a literal, one-byte ESCAPE
 * different from matchAll/matchOne. Runtime validates other ESCAPE shapes;
 * optimizer rejection must not replace their runtime behavior with an error.
 */
export declare function likePrefixRange(pattern: Uint8Array, mode: 'like' | 'glob', encoding: DatabaseEncoding, textColumn: boolean, escape?: Uint8Array): LikePrefixRange | null;
