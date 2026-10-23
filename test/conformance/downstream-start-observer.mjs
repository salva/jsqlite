import {BtreeDatabase} from '../../src/internal/btree.ts';

// The repeated-right-full fixture owns c at root4 and c_k at root7.
// Observe physical starts, not cursor opens or Next. Equality NULL guards
// (wherecode.c codeAllEqualityTerms; vdbe.ts equalityNullGuards) can reach a
// LEFT null continuation without either start. Callers assert scan and
// selected expectations separately; scan counts must not be relabeled seeks.
export function observeDownstreamStart(onStart) {
 const table=BtreeDatabase.prototype.tableScanCursor;
 const index=BtreeDatabase.prototype.indexCursor;
 function wrap(cursor,operations,kind){
  for(const operation of operations){const original=cursor[operation];cursor[operation]=function(...args){onStart(kind,operation);return original.apply(this,args)}}
  return cursor;
 }
 BtreeDatabase.prototype.tableScanCursor=function(root){const cursor=table.call(this,root);return root===4?wrap(cursor,['first'],'table'):cursor};
 BtreeDatabase.prototype.indexCursor=function(root){const cursor=index.call(this,root);return root===7?wrap(cursor,['first','seek'],'index'):cursor};
 return ()=>{BtreeDatabase.prototype.tableScanCursor=table;BtreeDatabase.prototype.indexCursor=index};
}
