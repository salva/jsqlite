import {JSQLiteError} from '../index.ts';
import type {KeyInfo} from './comparison.ts';
import type {MemAffinity} from './mem.ts';
import type {SelectInLoopRhs} from './where-plan.ts';
import {SelectProgramBuilder,type SelectDest} from './select-program.ts';

export type SelectedInProducerOp =
 | {readonly code:'Once';readonly p1:number;readonly p2:number}
 | {readonly code:'OpenEphemeral';readonly p1:number;readonly keyInfo:KeyInfo;readonly p4KeyInfo:KeyInfo};
export interface SelectedInSet {
 readonly rhs:SelectInLoopRhs;
 readonly cursor:number;
 readonly keyInfo:KeyInfo;
 readonly destination:Extract<SelectDest,{kind:'set'}>;
 readonly onceRegister:number;
 readonly start:number;
 readonly end:number;
}
/** expr.c sqlite3CodeRhsOfIN, uncorrelated SELECT/ephemeral branch only.
 * The linked SELECT compiler owns row production, ORDER/LIMIT and parameters.
 * This boundary emits no LHS expression or InSet membership tail. Its caller
 * must iterate the resulting UNIQUE BLOBKEY cursor through WhereInLoop.
 * No direct RHS-index reuse, vector mapping or correlated schedule is claimed.
 */
export function emitSelectedInRhs<Op extends {readonly code:string}>(
 builder:SelectProgramBuilder<Op>,rhs:SelectInLoopRhs,keyInfo:KeyInfo,affinity:MemAffinity,
 emitSelect:(resolved:SelectInLoopRhs['resolved'],destination:Extract<SelectDest,{kind:'set'}>)=>void,
):SelectedInSet {
 // Reject unsupported construction before consuming cursor/register identity.
 if(!rhs.scalar||rhs.correlated||rhs.prereq!==0n)throw new JSQLiteError('unsupported','selected SELECT IN requires scalar uncorrelated RHS',{unsupportedClassification:'temporary'});
 if(keyInfo.keyFieldCount!==1||keyInfo.totalFieldCount!==1)throw new JSQLiteError('internal','selected scalar IN requires scalar KeyInfo');
 const cursor=builder.cursor(),onceRegister=builder.register(),packedRegister=builder.register();
 const destination=Object.freeze({kind:'set' as const,cursor,width:1,affinities:Object.freeze([affinity]),packedRegister});
 const start=builder.ops.length;
 builder.emit({code:'Once',p1:onceRegister,p2:0} as unknown as Op);
 builder.emit({code:'OpenEphemeral',p1:cursor,keyInfo,p4KeyInfo:keyInfo} as unknown as Op);
 // Pass the original resolved SELECT, never reconstructed SQL or fake literals.
 emitSelect(rhs.resolved,destination);
 const end=builder.ops.length;
 builder.ops[start]={code:'Once',p1:onceRegister,p2:end} as unknown as Op;
 return Object.freeze({rhs,cursor,keyInfo,destination,onceRegister,start,end});
}
