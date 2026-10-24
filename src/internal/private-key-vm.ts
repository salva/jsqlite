import {compareRecordKey, UnpackedRecordKey, type KeyInfo} from './comparison.ts';
import type {PrivateBlobkeyPages,PrivateBlobkeyCursor} from './private-blobkey-pages.ts';
import type {PrivateStateControl} from './private-state.ts';
import {BorrowLifetime,Mem,memFromRawRecord} from './mem.ts';
import {RawRecordReader} from './record.ts';

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
  /** vdbe.c SeekGE/GT/LE/LT over BLOBKEY. Unlike Found, a prefix
   * positions at its edge using default_rc, then corrects the adjacent slot.
   * Caller retains its Mem values; IndexMoveto owns the await-time snapshot. */
  async seekBound(values:readonly Mem[],op:'SeekGE'|'SeekGT'|'SeekLE'|'SeekLT',control:PrivateStateControl):Promise<boolean>{
    if(values.length===0||values.length>this.info.keyFieldCount)throw new Error('invalid private bound width');
    const key=new UnpackedRecordKey(values,op==='SeekGT'||op==='SeekLE'?-1:1,'seek',this.info,false);
    this.nullRow=false;this.cacheStale=true;this.deferredMoveto=false;
    try{
      const {res,state}=await this.cursor.indexMoveto(key,control);
      let positioned:boolean;
      if(op==='SeekGE'||op==='SeekGT'){
        positioned=res<0||(res===0&&op==='SeekGT')?await this.cursor.next(control):true;
      }else{
        positioned=res>0||(res===0&&op==='SeekLT')?await this.cursor.previous(control):state==='VALID';
      }
      this.nullRow=!positioned;return positioned;
    }finally{key.release()}
  }
  /** vdbe.c IdxGT/GE/LT/LE: compare only the prefix at the current
   * packed position, never decoded retained rows or a second search. */
  async boundJump(values:readonly Mem[],op:'IdxGT'|'IdxGE'|'IdxLT'|'IdxLE',control:PrivateStateControl):Promise<boolean>{
    if(values.length===0||values.length>this.info.keyFieldCount)throw new Error('invalid private bound width');
    const copies:Mem[]=[];let charge=0;
    try{
      let bytes=0;
      for(const value of values){const d=value.diagnostic();bytes+=d.byteLength+(d.numeric?8:0)}
      control.snapshotCheckpoint?.(0);
      const requested=128+values.length*128+bytes;
      this.arena.reserveScratch(requested);charge=requested;
      for(const value of values){const copy=new Mem();copies.push(copy);copy.copyFromSnapshot(value,units=>control.snapshotCheckpoint?.(units))}
      const key=new UnpackedRecordKey(copies,op==='IdxGT'||op==='IdxLE'?-1:0,'seek',this.info,false);
      try{
        const res=await this.cursor.withPayload(control,async bytes=>{
          await control.checkpoint(values.length);
          return compareRecordKey(bytes,key,this.info);
        });
        return op==='IdxLE'||op==='IdxLT'?-res>0:res+1>0;
      }finally{key.release()}
    }finally{for(const copy of copies)copy.release();this.arena.releaseScratch(charge)}
  }
  async first(control:PrivateStateControl):Promise<boolean>{
    // vdbe.c OP_Rewind publishes cache/deferred before checking rc;
    // nullRow changes only after success.
    let positioned:boolean;
    try{positioned=await this.cursor.first(control)}finally{this.cacheStale=true;this.deferredMoveto=false}
    this.nullRow=!positioned;return positioned;
  }
  async last(control:PrivateStateControl):Promise<boolean>{
    // OP_Last initializes res=0 and publishes all three fields before rc.
    let positioned=true;
    try{positioned=await this.cursor.last(control);return positioned}
    finally{this.nullRow=!positioned;this.cacheStale=true;this.deferredMoveto=false}
  }
  async next(control:PrivateStateControl):Promise<boolean>{
    let positioned:boolean;
    try{positioned=await this.cursor.next(control)}finally{this.cacheStale=true}
    this.nullRow=!positioned;return positioned;
  }
  async previous(control:PrivateStateControl):Promise<boolean>{
    // OP_Prev shares next_tail: stale cache on error, but retain nullRow.
    let positioned:boolean;
    try{positioned=await this.cursor.previous(control)}finally{this.cacheStale=true}
    this.nullRow=!positioned;return positioned;
  }
  /** OP_Column register publication/deephemeralization (vdbe.c:3195ff).
   * Copy inside withPayload: its temporary Mem is not a lasting register. */
  async column(field:number,output:Mem,control:PrivateStateControl):Promise<void>{
    await this.withColumn(field,control,value=>output.copyFrom(value));
  }
  /** OP_Column over the page-owned private index. TEXT/BLOB borrow the
   * charged payload snapshot only until consume returns. A register consumer
   * must copy while that borrow is live; no cached record/page view escapes.
   * This branch has no P4 default: absent trailing columns produce SQL NULL. */
  async withColumn<T>(field:number,control:PrivateStateControl,consume:(value:Mem)=>T|Promise<T>):Promise<T>{
    if(!Number.isInteger(field)||field<0)throw new Error('invalid private column ordinal');
    if(this.nullRow){
      const value=new Mem();
      try{return await consume(value)}finally{value.release()}
    }
    return this.cursor.withRestoredPayload(control,different=>{this.cacheStale=true;if(different)this.nullRow=true},async bytes=>{
      if(bytes===null){
        const value=new Mem();
        try{return await consume(value)}finally{value.release()}
      }
      const lifetime=new BorrowLifetime();
      let value:Mem|undefined;
      try{
        const reader=new RawRecordReader(bytes,this.info.encoding);
        for(let i=0;i<=field;i++){
          await control.checkpoint(1);
          const raw=reader.next();
          if(raw===null){value=new Mem();break}
          if(i===field)value=memFromRawRecord(raw,lifetime);
        }
        return await consume(value!);
      }finally{lifetime.invalidate();value?.release()}
    });
  }
  async insert(packed:Uint8Array,control:PrivateStateControl):Promise<void>{
    // Primitive packed reseek is the accepted bounded USESEEKRESULT fallback.
    // Cache invalidation follows BtreeInsert return even when rc is an error.
    try{await this.cursor.insertIndex(packed,{},control)}finally{this.cacheStale=true}
  }
  async deleteCurrent(options:{savePosition?:boolean},control:PrivateStateControl):Promise<void>{
    // OP_Delete stales cache and clears seekResult before checking rc.
    // With SAVEPOSITION the packed cursor retains directional state, while
    // Column must expose no old row.
    try{await this.cursor.deleteCurrent(options,control);this.nullRow=true}
    finally{this.cacheStale=true;this.seekResult=0;this.deferredMoveto=false}
  }
  /** OpenDup starts nullRow, with separate VM cache and packed cursor state.
   * Arena registration already retains last-handle lifetime across duplicates. */
  duplicate():PrivateKeyVmCursor{
    return new PrivateKeyVmCursor(this.arena,this.cursor.duplicate(),this.info);
  }
  close():void{this.cursor.close()}
}
