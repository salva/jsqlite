import {JSQLiteError} from '../index.ts';
import type {ResolvedSelect,ResolvedSource} from './resolve.ts';
import {jsonTableConstraints,jsonTableInputReady,planJsonTableConstraints,type JsonTableSourceConstraint,type JsonTableIndex} from './json-table-plan.ts';
import {sqliteLogEst} from './schema.ts';

export interface JsonWhereLoop {
 readonly kind:'json-module';
 readonly capability?:never;
 readonly terms:readonly [];
 readonly sortIdentity:0;
 readonly indexRowSize?:never;
 readonly orInfo?:never;
 readonly source:ResolvedSource;
 readonly sourceOrdinal:number;
 readonly prereq:bigint;
 readonly setupCost:bigint;
 readonly runCost:bigint;
 readonly outputRows:bigint;
 readonly index:JsonTableIndex;
 readonly arguments:readonly JsonTableSourceConstraint[];
}
/** Bounded translation of whereLoopAddVirtual/One for JSON's EQ-only
 * BestIndex. External sources must be positioned by the caller; lexical scope
 * does not make them usable. Constraint rejection drops a candidate, not the
 * whole query. No runtime admission or physical capability is manufactured.
 * IN/LIMIT virtual terms and orderByConsumed are not represented here yet. */
export function jsonWhereLoops(plan:ResolvedSelect,source:ResolvedSource,
 externalAvailable:ReadonlySet<ResolvedSource>,sourcePrereq=0n,unusable=0n):readonly JsonWhereLoop[]{
 const ordinal=plan.sources.indexOf(source);
 if(ordinal<0||source.table.kind!=='json-module')throw new JSQLiteError('internal','expected linked JSON module');
 const constraints=jsonTableConstraints(plan,source);
 const bit=(i:number)=>1n<<BigInt(i);
 const self=bit(ordinal),all=(1n<<BigInt(plan.sources.length))-1n;
 const available=(mask:bigint)=>new Set([...externalAvailable,...plan.sources.filter((_,i)=>(mask&bit(i))!==0n)]);
 // Derive prereqRight over this invocation's source identities. The carrier
 // walker excludes SELECT-local producers but retains their external uses.
 const possible=available(all&~self&~unusable);
 const dependencies=constraints.map(constraint=>{
  let mask=0n;
  for(let i=0;i<plan.sources.length;i++){
   if(!possible.has(plan.sources[i]!))continue;
   const without=new Set(possible);without.delete(plan.sources[i]!);
   if(!jsonTableInputReady(constraint.rhs,without))mask|=bit(i);
  }
  return mask;
 });
 // Native visits distinct nonzero prereqRight masks in numeric order, then
 // the no-prerequisite fallback. Do not make lexical constraint order a tie
 // breaker for the shared path solver.
 const masks=[all&~self&~unusable,...[...new Set(dependencies.map(mask=>mask&~sourcePrereq))]
  .filter(mask=>mask!==0n).sort((a,b)=>a<b?-1:a>b?1:0),0n];
 const result:JsonWhereLoop[]=[],seen=new Set<string>();
 for(const mask of masks){
  let index:JsonTableIndex;
  try{index=planJsonTableConstraints(constraints,available((mask|sourcePrereq)&~self&~unusable));}
  catch(error){if(error instanceof JSQLiteError&&error.kind==='sqlite'&&error.message==='no query solution')continue;throw error;}
  const args=index.arguments.map(i=>constraints[i]!);
  const prereq=index.arguments.reduce((value,i)=>value|dependencies[i]!,sourcePrereq);
  const key=`${prereq}:${index.idxNum}:${index.arguments.join(',')}`;
  if(seen.has(key))continue;seen.add(key);
  result.push(Object.freeze({kind:'json-module',source,sourceOrdinal:ordinal,prereq,terms:Object.freeze([]) as readonly [],sortIdentity:0,
   setupCost:0n,
   // jsonEachBestIndex sets cost=1 for JSON input, leaves initial 1e99/2
   // otherwise; estimatedRows remains whereLoopAddVirtualOne's default 25.
   runCost:index.idxNum===0?3280n:0n,outputRows:BigInt(sqliteLogEst(25n)),
   index,arguments:Object.freeze(args)}));
  // No IN terms are admitted by this bounded constraint producer. Native
  // stops after an initial no-additional-prerequisites solution.
  if(result.length===1&&(prereq&~sourcePrereq)===0n)break;
 }
 return Object.freeze(result);
}
