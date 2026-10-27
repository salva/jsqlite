import { Mem } from "./mem.js";
import type { DatabaseEncoding } from "./record.js";
export declare function isMathFunction(name: string): boolean;
export declare function evaluateMathFunction(name: string, args: readonly Mem[], encoding: DatabaseEncoding): Mem;
