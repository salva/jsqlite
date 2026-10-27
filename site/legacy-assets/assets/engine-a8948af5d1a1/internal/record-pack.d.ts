import { Mem } from './mem.js';
import type { DatabaseEncoding } from './record.js';
export declare function recordSize(values: readonly Mem[]): number;
export declare function packRecord(values: readonly Mem[], encoding: DatabaseEncoding): Uint8Array;
