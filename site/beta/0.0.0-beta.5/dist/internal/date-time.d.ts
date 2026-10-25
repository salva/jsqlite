import { Mem } from "./mem.js";
import type { DatabaseEncoding } from "./record.js";
export interface DateTimeEnvironment {
    nowUnixMilliseconds(): bigint;
    localFieldsAtUnixSecond(second: bigint): {
        year: number;
        month: number;
        day: number;
        hour: number;
        minute: number;
        second: number;
    } | null;
}
/** Internal construction seam; deliberately absent from public OpenOptions. */
export declare const dateTimeEnvironmentOption: unique symbol;
export declare class LocalTimeUnavailableError extends Error {
    constructor();
}
export declare const invalidDateTimeClock: bigint;
export declare function acquireDateTimeClock(env: DateTimeEnvironment): bigint;
export declare const defaultDateTimeEnvironment: DateTimeEnvironment;
export interface DateTimeControl {
    notPure?(): void;
    readonly maxResultBytes: number;
    charge(units: number): void;
    check(): void;
    checkSize(bytes: number): void;
}
export declare function evaluateDateTime(name: string, args: Mem[], encoding: DatabaseEncoding, now: () => bigint, env?: DateTimeEnvironment, control?: DateTimeControl): Mem;
