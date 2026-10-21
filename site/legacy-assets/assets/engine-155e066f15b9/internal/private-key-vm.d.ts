import type { KeyInfo, UnpackedRecordKey } from './comparison.js';
import type { PrivateBlobkeyPages, PrivateBlobkeyCursor } from './private-blobkey-pages.js';
import type { PrivateStateControl } from './private-state.js';
/** vdbe.c OpenEphemeral/Found/IdxInsert VM state owner. The Btree owns page
 * positioning; signed seekResult is diagnostic, never trusted Insert authority. */
export declare class PrivateKeyVmCursor {
    readonly arena: PrivateBlobkeyPages;
    readonly cursor: PrivateBlobkeyCursor;
    readonly info: KeyInfo;
    nullRow: boolean;
    cacheStale: boolean;
    deferredMoveto: boolean;
    seekResult: -1 | 0 | 1;
    constructor(arena: PrivateBlobkeyPages, cursor: PrivateBlobkeyCursor, info: KeyInfo);
    reuse(control: PrivateStateControl): Promise<void>;
    seek(key: UnpackedRecordKey, control: PrivateStateControl): Promise<boolean>;
    first(control: PrivateStateControl): Promise<boolean>;
    next(control: PrivateStateControl): Promise<boolean>;
    insert(packed: Uint8Array, control: PrivateStateControl): Promise<void>;
    close(): void;
}
