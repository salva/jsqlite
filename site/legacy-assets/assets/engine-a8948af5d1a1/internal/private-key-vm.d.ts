import { UnpackedRecordKey, type KeyInfo } from './comparison.js';
import type { PrivateBlobkeyPages, PrivateBlobkeyCursor } from './private-blobkey-pages.js';
import type { PrivateStateControl } from './private-state.js';
import { Mem } from './mem.js';
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
    /** vdbe.c SeekGE/GT/LE/LT over BLOBKEY. Unlike Found, a prefix
     * positions at its edge using default_rc, then corrects the adjacent slot.
     * Caller retains its Mem values; IndexMoveto owns the await-time snapshot. */
    seekBound(values: readonly Mem[], op: 'SeekGE' | 'SeekGT' | 'SeekLE' | 'SeekLT', control: PrivateStateControl): Promise<boolean>;
    /** vdbe.c IdxGT/GE/LT/LE: compare only the prefix at the current
     * packed position, never decoded retained rows or a second search. */
    boundJump(values: readonly Mem[], op: 'IdxGT' | 'IdxGE' | 'IdxLT' | 'IdxLE', control: PrivateStateControl): Promise<boolean>;
    first(control: PrivateStateControl): Promise<boolean>;
    last(control: PrivateStateControl): Promise<boolean>;
    next(control: PrivateStateControl): Promise<boolean>;
    previous(control: PrivateStateControl): Promise<boolean>;
    /** OP_Column register publication/deephemeralization (vdbe.c:3195ff).
     * Copy inside withPayload: its temporary Mem is not a lasting register. */
    column(field: number, output: Mem, control: PrivateStateControl): Promise<void>;
    /** OP_Column over the page-owned private index. TEXT/BLOB borrow the
     * charged payload snapshot only until consume returns. A register consumer
     * must copy while that borrow is live; no cached record/page view escapes.
     * This branch has no P4 default: absent trailing columns produce SQL NULL. */
    withColumn<T>(field: number, control: PrivateStateControl, consume: (value: Mem) => T | Promise<T>): Promise<T>;
    insert(packed: Uint8Array, control: PrivateStateControl): Promise<void>;
    deleteCurrent(options: {
        savePosition?: boolean;
    }, control: PrivateStateControl): Promise<void>;
    /** OpenDup starts nullRow, with separate VM cache and packed cursor state.
     * Arena registration already retains last-handle lifetime across duplicates. */
    duplicate(): PrivateKeyVmCursor;
    close(): void;
}
