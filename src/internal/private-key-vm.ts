import type {KeyInfo,UnpackedRecordKey} from './comparison.ts';
import type {PrivateBlobkeyPages,PrivateBlobkeyCursor} from './private-blobkey-pages.ts';
import type {PrivateStateControl} from './private-state.ts';

/** vdbe.c OpenEphemeral/Found/IdxInsert VM state owner. The Btree owns page
 * positioning; signed seekResult is diagnostic, never trusted Insert authority. */
export class PrivateKeyVmCursor {
  readonly arena:PrivateBlobkeyPages;
  readonly cursor:PrivateBlobkeyCursor;
  readonly info:KeyInfo;
  nullRow=true;
  cacheStale=true;
  deferredMoveto=false;
  seekResult:-1|0|1=0;
  constructor(arena:PrivateBlobkeyPages,cursor:PrivateBlobkeyCursor,info:KeyInfo){this.arena=arena;this.cursor=cursor;this.info=info}
  async reuse(control:PrivateStateControl):Promise<void>{
    this.cacheStale=true;
    await this.arena.clearTable(control);
    // Native reuse changes nullRow only after ClearTable succeeds. Existing
    // seekResult/deferredMoveto are not reset by this opcode.
    this.nullRow=true;
  }
  async seek(key:UnpackedRecordKey,control:PrivateStateControl):Promise<boolean>{
    const result=await this.cursor.indexMoveto(key,control);
    this.seekResult=result.res;
    const exists=result.res===0;
    this.nullRow=!exists;
    this.deferredMoveto=false;
    this.cacheStale=true;
    return exists;
  }
  async first(control:PrivateStateControl):Promise<boolean>{
    const positioned=await this.cursor.first(control);
    this.nullRow=!positioned;this.cacheStale=true;this.deferredMoveto=false;return positioned;
  }
  async next(control:PrivateStateControl):Promise<boolean>{
    const positioned=await this.cursor.next(control);
    this.nullRow=!positioned;this.cacheStale=true;return positioned;
  }
  async insert(packed:Uint8Array,control:PrivateStateControl):Promise<void>{
    // Primitive packed reseek is the accepted bounded USESEEKRESULT fallback.
    // Cache invalidation follows BtreeInsert return even when rc is an error.
    try{await this.cursor.insertIndex(packed,{},control)}finally{this.cacheStale=true}
  }
  close():void{this.cursor.close()}
}
