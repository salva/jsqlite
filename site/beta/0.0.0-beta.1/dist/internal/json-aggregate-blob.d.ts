import { Mem } from './mem.js';
type Control = {
    reserve(n: number): void;
    release(n: number): void;
    checkpoint(n: number): Promise<void>;
};
/** json.c jsonTranslateTextToBlob / jsonBlobAppendNode / ChangePayloadSize.
 * Input and payload positions are bytes, never decoded strings or JSON nodes.
 * Arena growth is accounted while both old and replacement storage are live. */
export declare function aggregateTextToBlob(z: Uint8Array, c: Control, publication?: "validated" | "aggregate"): Promise<Mem>;
export {};
