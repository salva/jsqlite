import type {PrivateIndexPage} from './private-blobkey-pages.ts';
/** Module-internal CellArray borrowing bridge, not exported by product entrypoints.
 * No take/refund/count mutation: owner keeps staged authority alive until edit. */
export const balanceStaging=new WeakMap<PrivateIndexPage,{
  count():number;at(slot:number):{index:number;bytes:Uint8Array};
}>();

/** Scheduler-held lifetime. Physical staging survives every page edit until
 * all consumers have copied it. This bridge does not reconcile arena entries. */
export const balanceEditLifetime=new WeakMap<PrivateIndexPage,{begin():void;finish(success:boolean):void}>();

/** Parent divider transit: physical removal conserves logical count. */
export const balanceDivider=new WeakMap<PrivateIndexPage,{
  take(index:number,control:import('./private-state.ts').PrivateStateControl,resident?:boolean):Promise<{bytes:Uint8Array;release():void}>;
}>();

/** Nonroot pRight and interior right-child publication, held parent/sibling. */
export const balanceChildPointer=new WeakMap<PrivateIndexPage,{
 publish(offset:number,pgno:number,control:import('./private-state.ts').PrivateStateControl):Promise<void>;
}>();

/** Conserving balance divider insertion; caller owns count reconciliation. */
export const balanceDividerInsert=new WeakMap<PrivateIndexPage,{
 insert(index:number,cell:Uint8Array,child:number,control:import('./private-state.ts').PrivateStateControl):Promise<void>;
}>();
