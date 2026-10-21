export type TokenKind = "space" | "comment" | "id" | "keyword" | "integer" | "float" | "string" | "blob" | "variable" | "punct" | "illegal" | "eof";
export interface SqlToken {
    readonly kind: TokenKind;
    readonly startByte: number;
    readonly endByte: number;
    readonly text: string;
}
export declare function encodeSql(sql: string): Uint8Array;
export declare function tokenize(bytes: Uint8Array): readonly SqlToken[];
