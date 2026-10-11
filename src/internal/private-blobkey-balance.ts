import {balanceStaging,balanceEditLifetime,balanceDivider,balanceChildPointer,balanceDividerInsert} from "./private-blobkey-staging.ts";
import {PrivateStateByteBudget, type PrivateStateControl} from './private-state.ts';

/** btree.c:balance_nonroot 8546–8652, BLOBKEY leafData==0 branch.
 * Counts delimit ordered CellArray cells, with the cell at each nonfinal
 * boundary retained as a parent divider. No sorting, key comparison or page
 * publication occurs here. Held nonroot owns gather/edit/rekey and publication.
 * Input counters include resident and staged cell sizes plus their 2-byte slots.
 * The returned fixed-capacity arrays stay charged until explicit release. */
export async function partitionBlobkeyCells(
  nCell:number,cellSize:(index:number)=>number,oldCounts:readonly number[],
  oldBytes:readonly number[],usableSpace:number,bulk:boolean,
  budget:PrivateStateByteBudget,control:PrivateStateControl,
):Promise<{counts:number[];bytes:number[];release():void}>{
  const invalid=()=>{throw new Error('corrupt private BLOBKEY partition')};
  if(!Number.isSafeInteger(nCell)||nCell<0||oldCounts.length<1||oldCounts.length>3||oldCounts.length!==oldBytes.length||!Number.isInteger(usableSpace)||usableSpace<6||usableSpace>4088)invalid();
  // Five sibling capacity, two mutable arrays and result/cleanup descriptors.
  const charge=256;budget.reserve(charge);let retained=false;
  try{
    const counts=new Array<number>(5).fill(0),bytes=new Array<number>(5).fill(0);
    for(let i=0;i<oldCounts.length;i++){
      const c=oldCounts[i]!,s=oldBytes[i]!;
      if(!Number.isInteger(c)||c<0||c>nCell||(i>0&&c<=oldCounts[i-1]!)||!Number.isSafeInteger(s)||s<0)invalid();
      counts[i]=c;bytes[i]=s;
    }
    if(counts[oldCounts.length-1]!==nCell)invalid();
    const size=(index:number)=>{
      if(index<0||index>=nCell)invalid();
      const s=cellSize(index);
      if(!Number.isInteger(s)||s<4||s>4096)invalid();
      return s;
    };
    let k=oldCounts.length;
    for(let i=0;i<k;i++){
      while(bytes[i]!>usableSpace){
        await control.checkpoint(1);
        if(i+1>=k){k=i+2;if(k>5)invalid();bytes[k-1]=0;counts[k-1]=nCell}
        let sz=2+size(counts[i]!-1);bytes[i]!-=sz;
        sz=counts[i]!<nCell?2+size(counts[i]!):0;
        bytes[i+1]!+=sz;counts[i]!--;
      }
      while(counts[i]!<nCell){
        await control.checkpoint(1);
        let sz=2+size(counts[i]!);
        if(bytes[i]!+sz>usableSpace)break;
        bytes[i]!+=sz;counts[i]!++;
        sz=counts[i]!<nCell?2+size(counts[i]!):0;
        bytes[i+1]!-=sz;
      }
      if(counts[i]!>=nCell)k=i+1;
      else if(counts[i]!<=(i>0?counts[i-1]!:0))invalid();
    }
    // Mandatory right-to-left redistribution. The final-page condition differs
    // by two bytes: translate the source, do not replace with an even split.
    for(let i=k-1;i>0;i--){
      let right=bytes[i]!,left=bytes[i-1]!,r=counts[i-1]!-1,d=r+1;
      size(d);
      do{
        await control.checkpoint(1);
        const szR=size(r),szD=size(d);
        if(right!==0&&(bulk||right+szD+2>left-(szR+(i===k-1?0:2))))break;
        right+=szD+2;left-=szR+2;counts[i-1]=r;r--;d--;
      }while(r>=0);
      bytes[i]=right;bytes[i-1]=left;
      if(counts[i-1]!<=(i>1?counts[i-2]!:0))invalid();
    }
    counts.length=k;bytes.length=k;
    let released=false;
    const result={counts,bytes,release(){if(!released){released=true;budget.release(charge)}}};
    retained=true;return result;
  }finally{if(!retained)budget.release(charge)}
}

/** Nonroot8410–8524 CellArray resident/staged/divider producer.
 * Private bridge borrows adjacent staged descriptors without consuming them.
 * Resident bytes are borrowed and must remain under the caller's admission;
 * divider bytes are copied into charged scratch before child-pointer rewrite.
 * No page edits, refcounts, entry ownership or overflow chains are changed. */
export async function gatherBlobkeyCells(
  pages:readonly import('./private-blobkey-pages.ts').PrivateIndexPage[],
  dividers:readonly Uint8Array[],budget:PrivateStateByteBudget,control:PrivateStateControl,
):Promise<{cells:Uint8Array[];oldCounts:number[];oldBytes:number[];release():void}>{
  if(pages.length<1||pages.length>3||dividers.length!==pages.length-1)throw new Error('invalid CellArray siblings');
  const leaf=pages[0]!.leaf;
  let n=dividers.length,copyBytes=0;
  for(const p of pages){if(p.leaf!==leaf)throw new Error('CellArray requires same-type siblings');n+=p.nCell+p.nOverflow}
  for(const d of dividers){if(d.length<7||d.length>1025)throw new Error('invalid CellArray divider');copyBytes+=Math.max(d.length,8)}
  // Three array headers64 + counters6*8 + result/cleanup16 in256.
  // Each64-byte cell allowance covers reference8, borrowed view/size48 and
  // spare8. Resident leaf maximum3*681+2=2045; pending descriptors are
  // included dynamically in n (page-owned pending bytes remain charged).
  // Pointer/view/size descriptor per cell, counters, result/cleanup; owned
  // scratch is separately included before allocation. Not native heap parity.
  const charge=256+n*64+copyBytes;budget.reserve(charge);let retained=false;
  try{
    const cells:Uint8Array[]=[],oldCounts:number[]=[],oldBytes:number[]=[];
    for(let i=0;i<pages.length;i++){
      const p=pages[i]!;let used=4088-p.childPtrSize-p.computeFreeSpace();
      const staging=balanceStaging.get(p);
      const nOverflow=staging?.count()??0;
      if(nOverflow!==p.nOverflow)throw new Error('missing CellArray staged authority');
      const first=nOverflow?staging!.at(0).index:p.nCell;
      if(first<0||first>p.nCell)throw new Error('invalid CellArray staging index');
      const resident=async(j:number)=>{
        await control.checkpoint(1);
        const c=p.parseCell(j);cells.push(p.bytes.subarray(c.offset,c.offset+c.nSize));
      };
      for(let j=0;j<first;j++)await resident(j);
      for(let j=0;j<nOverflow;j++){
        await control.checkpoint(1);
        const c=staging!.at(j);
        if(c.index!==first+j)throw new Error('nonadjacent CellArray staging');
        const parsed=p.parseCellBytes(c.bytes);
        if(parsed.nSize!==c.bytes.length)throw new Error('invalid CellArray staged size');
        cells.push(c.bytes);used+=c.bytes.length+2;
      }
      for(let j=first;j<p.nCell;j++)await resident(j);
      oldCounts.push(cells.length);oldBytes.push(used);
      if(i<dividers.length){
        await control.checkpoint(dividers[i]!.length);
        const d=dividers[i]!,cell=new Uint8Array(leaf?Math.max(4,d.length-4):d.length);
        cell.set(leaf?d.subarray(4):d);
        if(!leaf)cell.set(p.bytes.subarray(8,12),0);
        // Validate copied physical representation, including overflow-pointer
        // span; do not follow or clear that chain while gathering ownership.
        const parsed=p.parseCellBytes(cell);
        if(parsed.nSize!==cell.length)throw new Error('invalid CellArray divider size');
        cells.push(cell);
      }
    }
    let released=false;const result={cells,oldCounts,oldBytes,release(){if(!released){released=true;budget.release(charge)}}};
    retained=true;return result;
  }finally{if(!retained)budget.release(charge)}
}

/** balance_nonroot sibling update loop (two passes). BLOBKEY divider cells
 * remain outside the new page ranges. Caller owns parent publication, physical
 * page identity, entry reconciliation and one admission across all pages. */
export async function editBlobkeySiblings(
  pages:readonly import('./private-blobkey-pages.ts').PrivateIndexPage[],
  cells:readonly Uint8Array[],oldCounts:readonly number[],newCounts:readonly number[],
  budget:PrivateStateByteBudget,control:PrivateStateControl,
):Promise<void>{
  const n=pages.length;
  if(n<1||n>5||newCounts.length!==n||oldCounts.length<1||oldCounts.length>3||newCounts[n-1]!==cells.length)throw new Error('invalid sibling edit counters');
  for(const counters of [oldCounts,newCounts])for(let i=0;i<counters.length;i++)if(!Number.isInteger(counters[i])||counters[i]!<0||counters[i]!>cells.length||(i>0&&counters[i]!<=counters[i-1]!))throw new Error('invalid sibling boundary');
  budget.reserve(128);let held=0,success=false;
  try{
    for(const p of pages){balanceEditLifetime.get(p)!.begin();held++}
    const done=new Array<boolean>(5).fill(false);
    for(let i=1-n;i<n;i++){
      await control.checkpoint(1);
      const pg=i<0?-i:i;
      if(done[pg])continue;
      if(i>=0||oldCounts[pg-1]!>=newCounts[pg-1]!){
        const oldFirst=pg===0?0:pg<oldCounts.length?oldCounts[pg-1]!+1:cells.length;
        const newFirst=pg===0?0:newCounts[pg-1]!+1;
        const count=newCounts[pg]!-newFirst;
        await pages[pg]!.editCells(cells,oldFirst,newFirst,count,control);
        done[pg]=true;
      }
    }
    success=true;
  }finally{for(let i=held-1;i>=0;i--)balanceEditLifetime.get(pages[i]!)!.finish(success);budget.release(128)}
}

/** Native nonroot8670ff identity rekey. The sibling objects and their data stay
 * in CellArray order; only pager identities move. The arena callback owns map,
 * derived pgno, primary-error FAULT and cleanup. No key sorting occurs here. */
export async function rekeyBlobkeySiblings<T extends {readonly pgno:number}>(
  pages:readonly T[],rekey:(page:T,number:number)=>Promise<void>,
  budget:PrivateStateByteBudget,control:PrivateStateControl,
):Promise<{oldNumbers:number[];release():void}>{
  const temporary=262145; // (PENDING_BYTE / private4096)+1
  if(pages.length<1||pages.length>5)throw new Error('invalid rekey siblings');
  for(let i=0;i<pages.length;i++){
    const number=pages[i]!.pgno;
    if(!Number.isInteger(number)||number<3||number>0xffffffff||number===temporary)throw new Error('invalid sibling identity');
    for(let j=0;j<i;j++)if(pages[j]!.pgno===number)throw new Error('duplicate sibling identity');
  }
  budget.reserve(128);let retained=false;
  try{
    const oldNumbers=pages.map(p=>p.pgno);
    for(let i=0;i<pages.length-1;i++){
      await control.checkpoint(1);let smallest=i;
      for(let j=i+1;j<pages.length;j++)if(pages[j]!.pgno<pages[smallest]!.pgno)smallest=j;
      if(smallest!==i){
        const a=pages[i]!,b=pages[smallest]!,numberA=a.pgno,numberB=b.pgno;
        // No cancellation between the three identity publications. Callback
        // failures still terminate; caller cleanup must handle a temporary key.
        await rekey(a,temporary);await rekey(b,numberA);await rekey(a,numberB);
      }
    }
    let released=false;retained=true;
    return {oldNumbers,release(){if(!released){released=true;budget.release(128)}}};
  }finally{if(!retained)budget.release(128)}
}

/** balance_nonroot8312–8340 sibling selection. Caller supplies logical child
 * pointers (including pending parent divider adjustment), not sorted keys.
 * Descending producer order matches native acquire/drop traversal. */
export async function selectBlobkeySiblingWindow(
  parentCells:number,index:number,bulk:boolean,child:(slot:number)=>number,
  budget:PrivateStateByteBudget,control:PrivateStateControl,
):Promise<{first:number;pages:number[];release():void}>{
  if(!Number.isInteger(parentCells)||parentCells<0||parentCells>683||!Number.isInteger(index)||index<0||index>parentCells)throw new Error('invalid sibling selection');
  budget.reserve(128);let retained=false;
  try{
    let dividers=parentCells,first=0;
    if(dividers>=2){
      first=index===0?0:index===dividers?dividers-2+(bulk?1:0):index-1;
      dividers=2-(bulk?1:0);
    }
    const pages=new Array<number>(dividers+1);
    for(let i=dividers;i>=0;i--){
      await control.checkpoint(1);const pgno=child(first+i);
      if(!Number.isSafeInteger(pgno)||pgno<3||pgno===262145)throw new Error('invalid sibling page');
      for(let j=i+1;j<pages.length;j++)if(pages[j]===pgno)throw new Error('duplicate sibling page');
      pages[i]=pgno;
    }
    let released=false;const result={first,pages,release(){if(!released){released=true;budget.release(128)}}};retained=true;return result;
  }finally{if(!retained)budget.release(128)}
}

/** Nonroot8310–8388 acquire/drop chain. Caller retains exclusive parent gate
 * and owns logical reconciliation/global FAULT on failure after any drop. */
export async function acquireBlobkeySiblings(
  parent:import('./private-blobkey-pages.ts').PrivateIndexPage,index:number,bulk:boolean,
  acquire:(number:number)=>Promise<{page:import('./private-blobkey-pages.ts').PrivateIndexPage;release():void}>,
  budget:PrivateStateByteBudget,control:PrivateStateControl,
):Promise<{first:number;rightOffset:number;pages:import('./private-blobkey-pages.ts').PrivateIndexPage[];dividers:Uint8Array[];release():void}>{
  if(parent.leaf||parent.nOverflow>1)throw new Error('invalid balance parent');
  const pending=balanceStaging.get(parent),overflow=parent.nOverflow;
  if(overflow&&pending!.at(0).index!==index)throw new Error('invalid parent pending index');
  const total=parent.nCell+overflow;
  if(!Number.isInteger(index)||index<0||index>total)throw new Error('invalid balance child index');
  // Native window logic, without eager child reads: acquiring and dropping
  // must interleave, since nOverflow changes the resident index adjustment.
  const first=total<2||index===0?0:index===total?total-2+(bulk?1:0):index-1;
  const count=total<2?total+1:3-(bulk?1:0);
  const rightIndex=first+count-1-overflow;
  const rightOffset=rightIndex===parent.nCell?8:parent.findCell(rightIndex);
  const read=(b:Uint8Array,o=0)=>((b[o]!<<24)>>>0)+((b[o+1]!<<16)>>>0)+(b[o+2]!<<8)+b[o+3]!;
  budget.reserve(256);
  const leases=new Array<Awaited<ReturnType<typeof acquire>>>(count),owned=new Array<{bytes:Uint8Array;release():void}>(count-1);
  const cleanup=()=>{let error:unknown;for(const d of owned)if(d)try{d.release()}catch(e){error??=e}for(const p of leases)if(p)try{p.release()}catch(e){error??=e}budget.release(256);if(error!==undefined)throw error};
  try{
    let number=read(parent.bytes,rightOffset);
    for(let i=count-1;i>=0;i--){
      await control.checkpoint(1);if(number<3||number===262145)throw new Error('invalid sibling child');
      for(let j=i+1;j<count;j++)if(leases[j]!.page.pgno===number)throw new Error('duplicate sibling child');
      const lease=await acquire(number);leases[i]=lease;lease.page.computeFreeSpace();
      if(i){
        const logical=first+i-1;
        const staged=parent.nOverflow!==0&&pending!.at(0).index===logical;
        const slot=staged?logical:logical-parent.nOverflow;
        owned[i-1]=await balanceDivider.get(parent)!.take(slot,control,!staged);
        number=read(owned[i-1]!.bytes);
      }
    }
    let released=false;const result={first,rightOffset,pages:leases.map(p=>p.page),dividers:owned.map(d=>d.bytes),release(){if(!released){released=true;cleanup()}}};return result;
  }catch(error){try{cleanup()}catch{}throw error}
}

/** BLOBKEY divider representation producer, nonroot8830–8889. Parent insert
 * and left sibling right-child publication remain caller-owned. */
export async function promoteBlobkeyDivider(
  parent:import('./private-blobkey-pages.ts').PrivateIndexPage,cell:Uint8Array,leaf:boolean,left:number,
  budget:PrivateStateByteBudget,control:PrivateStateControl,
):Promise<{bytes:Uint8Array;rightChild:number|null;release():void}>{
  if(parent.leaf||!Number.isInteger(left)||left<3||left>0xffffffff||left===262145)throw new Error('invalid divider promotion');
  const charge=64+cell.length+(leaf?4:0);budget.reserve(charge);let retained=false;
  try{
    await control.checkpoint(cell.length);
    const bytes=new Uint8Array(cell.length+(leaf?4:0));bytes.set(cell,leaf?4:0);
    const rightChild=leaf?null:((bytes[0]!<<24)>>>0)+((bytes[1]!<<16)>>>0)+(bytes[2]!<<8)+bytes[3]!;
    bytes[0]=left>>>24;bytes[1]=left>>>16;bytes[2]=left>>>8;bytes[3]=left;
    const info=parent.parseCellBytes(bytes);
    // Native minimum leaf extent may include padding; interior owns true size.
    if(info.nSize!==bytes.length&&(!leaf||cell.length!==4))throw new Error('invalid promoted divider extent');
    const resultBytes=bytes.subarray(0,info.nSize);let released=false;
    const result={bytes:resultBytes,rightChild,release(){if(!released){released=true;budget.release(charge)}}};retained=true;return result;
  }finally{if(!retained)budget.release(charge)}
}

/** Native nonroot8755/8830 parent publication phase. Caller holds all leases,
 * owns logical counts and globally faults any failed admitted balance. */
export async function publishBlobkeyDividers(
 parent:import('./private-blobkey-pages.ts').PrivateIndexPage,first:number,rightOffset:number,
 siblings:readonly import('./private-blobkey-pages.ts').PrivateIndexPage[],counts:readonly number[],cells:readonly Uint8Array[],
 oldRight:number,oldCount:number,budget:PrivateStateByteBudget,control:PrivateStateControl,
):Promise<void>{
 if(siblings.length<1||siblings.length>5||counts.length!==siblings.length||!Number.isInteger(first)||first<0)throw new Error('invalid divider publication');
 const leaf=siblings[0]!.leaf;
 for(const p of siblings)if(p.leaf!==leaf)throw new Error('mixed balance siblings');
 await balanceChildPointer.get(parent)!.publish(rightOffset,siblings[siblings.length-1]!.pgno,control);
 // Native transfers the old right child only when sibling count changes.
 if(!leaf&&siblings.length!==oldCount)await balanceChildPointer.get(siblings[siblings.length-1]!)!.publish(8,oldRight,control);
 for(let i=0;i<siblings.length-1;i++){
   const index=counts[i]!;if(!Number.isInteger(index)||index<0||index>=cells.length)throw new Error('invalid divider boundary');
   const divider=await promoteBlobkeyDivider(parent,cells[index]!,leaf,siblings[i]!.pgno,budget,control);
   let error:unknown;
   try{
     if(divider.rightChild!==null)await balanceChildPointer.get(siblings[i]!)!.publish(8,divider.rightChild,control);
     await balanceDividerInsert.get(parent)!.insert(first+i,divider.bytes,siblings[i]!.pgno,control);
   }catch(e){error=e}finally{try{divider.release()}catch(e){error??=e}}
   if(error!==undefined)throw error;
 }
}
