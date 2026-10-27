import type { MemAffinity } from './mem.js';
/** build.c:sqlite3AffinityType, pCol == NULL. Empty CAST tokens are NUMERIC. */
export declare function typeAffinity(s: string): MemAffinity;
/** parse.y CAST / expr.c sqlite3ExprAlloc(dequote=1), util.c sqlite3Dequote.
 * Dequote the production's complete token, not each typename component. The
 * first unescaped closing quote terminates it, even for multiword typenames. */
export declare function castTypeAffinity(semantic: unknown): MemAffinity;
/** build.c:sqlite3AddColumn owns absence, not sqlite3AffinityType. */
export declare function columnDeclaredAffinity(type: string | null | undefined): MemAffinity;
