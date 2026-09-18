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
function derivedFrom(root:SelectNode,index:number,producer:SelectNode,cte:CteNode,use:CteUse):SelectNode|null {
  // SourceList currently carries one derived producer. Preserve all unresolved
  // structures atomically until the multi-producer carrier is implemented.
  if(root.from.derived||root.from.flattenedDerived||root.from.items.length!==1||index!==0)return null;
  const item=root.from.items[index]!;if(item.on||item.using||item.indexedBy||item.notIndexed)return null;
  const tokens=root.from.tokens,alias=item.alias??cte.name;
  const items=Object.freeze([Object.freeze({...item,alias})]);
  const from=Object.freeze(Object.assign([...tokens],{items,tokens,derived:Object.freeze({index,select:producer,alias,cte,use,materialization:cte.materialization})})) as SourceList;
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
      else {const tokens=current.from.tokens,items=Object.freeze(current.from.items.map((item,index)=>{const source=sources.find(candidate=>candidate.index===index);return source?Object.freeze({...item,alias:item.alias??source.alias}):item;}));const from=Object.freeze(Object.assign([...tokens],{items,tokens,cteDerived:Object.freeze(sources)})) as SourceList;current=Object.freeze({...current,from,with:null});}
    }
    // WITH RECURSIVE is only a scope marker. If no body re-entered its own
    // declaration, the ordinary route above remains valid.
    if(current.with!==null)return Object.freeze({...current,with:null});
    return current;
  };
  return walk(root,null);
}
