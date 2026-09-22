import type { CteNode, ExprNode, SelectNode, SourceList } from "./parse.ts";
import { SqlParseError } from "./parse.ts";
import { sqliteIdentifierEqual } from "./sqlite-case.ts";

/** Prepare-owned mutable identity corresponding to sqliteInt.h:CteUse. */
export type CteUse = {
  readonly declaration:CteNode;
  nUse:number;
  materializationAddress:number|null;
  returnRegister:number|null;
  cursorId:number|null;
};
export class CtePrepareContext {
  readonly uses=new Map<CteNode,CteUse>();
  use(declaration:CteNode):CteUse {
    let use=this.uses.get(declaration);
    if(!use){use={declaration,nUse:0,materializationAddress:null,returnRegister:null,cursorId:null};this.uses.set(declaration,use);}
    use.nUse++;
    return use;
  }
}
type Scope={readonly declarations:readonly CteNode[];readonly outer:Scope|null};
function lookup(scope:Scope|null,name:string):CteNode|null {
  for(let frame=scope;frame;frame=frame.outer){const found=frame.declarations.find(cte=>sqliteIdentifierEqual(cte.name,name));if(found)return found;}
  return null;
}
function namedProducer(cte:CteNode,select:SelectNode):SelectNode {
  const width=select.result.length;
  if(cte.columns&&cte.columns.length!==width)throw new SqlParseError(`table ${cte.name} has ${width} values for ${cte.columns.length} columns`);
  const result=cte.columns?Object.freeze(select.result.map((expression,index)=>Object.freeze({...expression,alias:cte.columns![index]} as ExprNode))):select.result;
  return Object.freeze({...select,result,with:null});
}
/** Recognize ownership that requires select.c's recursive queue algorithm
 * before ordinary lowering consumes the WITH carrier. A RECURSIVE keyword by
 * itself is not enough: SQLite permits ordinary declarations under it. */
export function recursiveCteOwner(root:SelectNode):string|null {
  const references=(select:SelectNode,name:string):boolean=>{
    if(select.from.items.some(item=>item.databaseName===null&&sqliteIdentifierEqual(item.tableName,name)))return true;
    if(select.arms.some(arm=>arm.from.items.some(item=>item.databaseName===null&&sqliteIdentifierEqual(item.tableName,name))))return true;
    if(select.from.derived&&references(select.from.derived.select,name))return true;
    if(select.from.flattenedDerived&&references(select.from.flattenedDerived.select,name))return true;
    return false;
  };
  const visit=(select:SelectNode):string|null=>{
    for(const cte of select.with?.ctes??[]){if(references(cte.select,cte.name))return cte.name;const nested=visit(cte.select);if(nested)return nested;}
    if(select.from.derived){const nested=visit(select.from.derived.select);if(nested)return nested;}
    if(select.from.flattenedDerived){const nested=visit(select.from.flattenedDerived.select);if(nested)return nested;}
    return null;
  };
  return visit(root);
}

function derivedFrom(root:SelectNode,index:number,producer:SelectNode,cte:CteNode,use:CteUse):SelectNode|null {
  // SourceList currently carries one derived producer. Preserve all unresolved
  // structures atomically until the multi-producer carrier is implemented.
  if(root.from.derived||root.from.flattenedDerived||root.from.items.length!==1||index!==0)return null;
  const item=root.from.items[index]!;if(item.on||item.using||item.indexedBy||item.notIndexed)return null;
  const tokens=root.from.tokens,alias=item.alias??cte.name;
  const items=Object.freeze([Object.freeze({...item,alias})]);
  const cteSource=Object.freeze({index,select:producer,alias,use,materialization:cte.materialization});
  const from=Object.freeze(Object.assign([...tokens],{items,tokens,derived:Object.freeze({index,select:producer,alias}),cteDerived:Object.freeze([cteSource])})) as SourceList;
  return Object.freeze({...root,from,with:null});
}

/** select.c:sqlite3WithPush/sqlite3SelectPopWith and resolveFromTermToCte for
 * represented ordinary single-source owners. Frames are lexical; qualified
 * names bypass CTE lookup; bodies inherit the declaration frame; inner WITHs
 * shadow outer declarations. CteUse is allocated only after successful lookup
 * and shared by declaration identity in this prepare context. */
export function lowerOrdinaryCtes(root:SelectNode,context=new CtePrepareContext()):SelectNode|null {
  const resolving=new Set<CteNode>();
  const walk=(select:SelectNode,outer:Scope|null):SelectNode|null=>{
    const scope:Scope=select.with?{declarations:select.with.ctes,outer}:outer??{declarations:[],outer:null};
    let current=select;
    // Derived SELECTs are separate owners but inherit the lexical WITH frame.
    if(current.from.derived){
      const child=walk(current.from.derived.select,scope);if(!child)return null;
      const tokens=current.from.tokens,from=Object.freeze(Object.assign([...tokens],{...current.from,items:current.from.items,tokens,derived:Object.freeze({...current.from.derived,select:child})})) as SourceList;
      current=Object.freeze({...current,from});
    }
    if(current.from.flattenedDerived){
      const child=walk(current.from.flattenedDerived.select,scope);if(!child)return null;
      const tokens=current.from.tokens,from=Object.freeze(Object.assign([...tokens],{...current.from,items:current.from.items,tokens,flattenedDerived:Object.freeze({select:child})})) as SourceList;
      current=Object.freeze({...current,from});
    }
    const sources:NonNullable<SourceList["cteDerived"]>[number][]=[];
    for(let index=0;index<current.from.items.length;index++){
      const item=current.from.items[index]!;
      const declaration=item.databaseName===null?lookup(scope,item.tableName):null;
      if(!declaration)continue;
      if(resolving.has(declaration))throw new SqlParseError(`circular reference: ${declaration.name}`);
      resolving.add(declaration);const body=walk(declaration.select,scope);resolving.delete(declaration);if(!body)return null;
      const producer=namedProducer(declaration,body),use=context.use(declaration),alias=item.alias??declaration.name;
      sources.push(Object.freeze({index,select:producer,alias,use,materialization:declaration.materialization}));
    }
    if(sources.length){
      if(sources.length===1&&current.from.items.length===1){const source=sources[0]!,use=source.use as CteUse,declaration=use.declaration;const lowered=derivedFrom(current,0,source.select,declaration,use);if(!lowered)return null;current=lowered;}
      else {const tokens=current.from.tokens,items=Object.freeze(current.from.items.map((item,index)=>{const source=sources.find(candidate=>candidate.index===index);return source?Object.freeze({...item,alias:item.alias??source.alias}):item;}));
        // A single CTE among ordinary sources uses the existing derived-source
        // carrier so the established mixed table/subquery compiler owns join
        // execution. Keep cteDerived as the declaration/use identity carrier.
        const only=sources.length===1?sources[0]:undefined;
        const from=Object.freeze(Object.assign([...tokens],{items,tokens,cteDerived:Object.freeze(sources),...(only?{derived:Object.freeze({index:only.index,select:only.select,alias:only.alias})}:{})})) as SourceList;current=Object.freeze({...current,from,with:null});}
    }
    // WITH RECURSIVE is only a scope marker. If no body re-entered its own
    // declaration, the ordinary route above remains valid.
    // The parser retains the first arm alongside the select-level fields.
    // Keep that ownership carrier coherent so graph walkers and compound
    // lowering do not retain the pre-resolution WITH source.
    let arms=current.arms.length?Object.freeze(current.arms.map((arm,index)=>index===0?Object.freeze({...arm,from:current.from}):arm)):current.arms;
    if(current.hasCompound){
      const lowered=[];
      for(let index=1;index<arms.length;index++){
        const arm=arms[index]!;
        const single:SelectNode={...current,result:arm.result,from:arm.from,where:arm.where,hasDistinct:arm.hasDistinct,hasGroupBy:arm.hasGroupBy,hasHaving:arm.hasHaving,groupBy:Object.freeze([]),having:null,orderBy:Object.freeze([]),limit:null,offset:null,hasOrderBy:false,hasLimit:false,hasCompound:false,with:null,arms:Object.freeze([{...arm,operatorFromPrior:null,prior:null,next:null}])};
        const child=walk(single,scope);if(!child)return null;
        lowered.push(Object.freeze({...arm,result:child.result,from:child.from,where:child.where}));
      }
      arms=Object.freeze([arms[0]!,...lowered]);
    }
    if(current.with!==null||arms!==current.arms)return Object.freeze({...current,arms,with:null});
    return current;
  };
  return walk(root,null);
}
