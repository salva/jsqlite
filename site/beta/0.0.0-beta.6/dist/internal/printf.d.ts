import { Mem } from "./mem.js";
export interface SqliteFormatControl {
    readonly maxBytes: number;
    charge?(units: number): void;
    check?(): void;
}
export declare function sqliteFormat(formatValue: Mem, args: readonly Mem[], control: SqliteFormatControl): string | null;
export declare function sqliteRound(value: Mem, digits?: Mem): number | null;
