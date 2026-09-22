import { encodeSql, tokenize, type SqlToken } from "./tokenize.ts";
import { lemonTables, tokenIds } from "../generated/parser-tables.ts";
import { keywordTable } from "../generated/keyword-table.ts";
import { lemonParse, type LemonTrace, type LemonValue } from "./lemon-runtime.ts";

export type ExprNode={readonly kind:"tokens";readonly tokens:readonly SqlToken[];readonly reduction?:LemonValue<SqlToken>;readonly alias?:string;readonly sourceText?:string};
export type WindowFrameType="range"|"rows"|"groups";
export type WindowFrameBoundaryKind="unbounded"|"preceding"|"current"|"following";
export type WindowFrameExclusion="no-others"|"current-row"|"group"|"ties"|null;
export type WindowFrameBoundaryNode=Readonly<{kind:WindowFrameBoundaryKind;expr:ExprNode|null}>;
export type WindowFrameNode=Readonly<{type:WindowFrameType;start:WindowFrameBoundaryNode;end:WindowFrameBoundaryNode;exclusion:WindowFrameExclusion;implicit:boolean}>;
export type WindowDefinitionNode={readonly name:string;readonly baseName:string|null;readonly hasFrame:boolean;readonly frame:WindowFrameNode;readonly frameError:string|null;readonly partitionBy:readonly ExprNode[];readonly orderBy:readonly ExprNode[]};
export type OrderTermNode={readonly expr:ExprNode;readonly descending:boolean;readonly nulls:"first"|"last"|null};
export type CompoundOperator="union-all"|"union"|"intersect"|"except";
export type CteMaterialization="any"|"materialized"|"not-materialized";
export type CteNode=Readonly<{name:string;columns:readonly string[]|null;select:SelectNode;materialization:CteMaterialization}>;
export type WithClause=Readonly<{recursive:boolean;ctes:readonly CteNode[]}>;
export type JoinFlags=Readonly<{inner:boolean;cross:boolean;natural:boolean;left:boolean;right:boolean;outer:boolean;error:boolean}>;
export type SourceItem=Readonly<{databaseName:string|null;tableName:string;arguments:readonly ExprNode[]|null;alias:string|null;indexedBy:string|null;notIndexed:boolean;on:ExprNode|null;using:readonly string[]|null;joinFromLeft:JoinFlags;leftOfRightJoin:boolean;cursorId:null;table:null}>;
type FlattenedDerived=Readonly<{select:SelectNode}>;
export type DerivedSource=Readonly<{index:number;select:SelectNode;alias:string|null}>;
export type CteUseCarrier={readonly nUse:number};
export type CteDerivedSource=Readonly<{index:number;select:SelectNode;alias:string;use:CteUseCarrier;materialization:CteMaterialization}>;
export type SourceList=readonly SqlToken[]&Readonly<{items:readonly SourceItem[];tokens:readonly SqlToken[];flattenedDerived?:FlattenedDerived;derived?:DerivedSource;cteDerived?:readonly CteDerivedSource[]}>;
export type SelectArm={readonly result:readonly ExprNode[];readonly from:SourceList;readonly where:ExprNode|null;readonly hasDistinct:boolean;readonly hasGroupBy:boolean;readonly hasHaving:boolean;readonly origin:"select"|"values";readonly valuesRows:readonly (readonly ExprNode[])[]|null;readonly operatorFromPrior:CompoundOperator|null;readonly prior:number|null;readonly next:number|null};
export type SelectNode={readonly kind:"select";readonly result:readonly ExprNode[];readonly from:SourceList;readonly where:ExprNode|null;readonly groupBy:readonly ExprNode[];readonly having:ExprNode|null;readonly orderBy:readonly OrderTermNode[];readonly windowNames:readonly string[];readonly windowDefinitions:readonly WindowDefinitionNode[];readonly limit:ExprNode|null;readonly offset:ExprNode|null;readonly hasDistinct:boolean;readonly hasGroupBy:boolean;readonly hasHaving:boolean;readonly hasOrderBy:boolean;readonly hasLimit:boolean;readonly hasCompound:boolean;readonly hasValues:boolean;readonly hasSubquery:boolean;readonly with:WithClause|null;readonly arms:readonly SelectArm[];readonly tokens:readonly SqlToken[]};
export interface SchemaColumnDeclaration {readonly name:string;readonly declaredType:string|null;readonly defaultExpr:ExprNode|null;readonly generatedExpr:ExprNode|null;readonly notNull:boolean;readonly primaryKey:boolean;readonly unique:boolean;readonly collation:string|null;readonly generatedStorage:"stored"|"virtual"|null}
export interface SchemaIndexTermDeclaration {readonly expr:ExprNode;readonly descending:boolean;readonly collation:string|null;readonly nulls:"first"|"last"|null}
export type ForeignKeyAction="no-action"|"restrict"|"set-null"|"set-default"|"cascade";
export interface SchemaCheckDeclaration {readonly name:string|null;readonly columnName:string|null;readonly expr:ExprNode;readonly tokens:readonly SqlToken[]}
export interface SchemaForeignKeyDeclaration {readonly name:string|null;readonly columns:readonly string[];readonly referencedTable:string;readonly referencedColumns:readonly string[]|null;readonly onDelete:ForeignKeyAction;readonly onUpdate:ForeignKeyAction;readonly deferrable:boolean;readonly initiallyDeferred:boolean;readonly tokens:readonly SqlToken[]}
export type SchemaDdlNode={readonly kind:"create-table"|"create-index"|"create-view"|"create-trigger";readonly name:string|null;readonly tokens:readonly SqlToken[];readonly columns:readonly SchemaColumnDeclaration[];readonly checks:readonly SchemaCheckDeclaration[];readonly foreignKeys:readonly SchemaForeignKeyDeclaration[];readonly viewColumns:readonly string[];readonly withoutRowid:boolean;readonly indexTerms:readonly SchemaIndexTermDeclaration[];readonly tableUniqueTerms:readonly (readonly SchemaIndexTermDeclaration[])[];readonly tableName:string|null;readonly select:SelectNode|null;readonly indexWhere:ExprNode|null;readonly tableAsSelect:SelectNode|null;readonly primaryKey:readonly string[];readonly indexUnique:boolean};
export type ParsedStatement=SelectNode|SchemaDdlNode;
export interface ParseResult{readonly statement:ParsedStatement|null;readonly tailOffset:number;readonly tailCodeUnit:number;readonly lemon:LemonTrace<SqlToken>|null}
export class SqlParseError extends Error{}
export class SqlUnsupportedError extends Error{}
const tokenKindNames:Partial<Record<SqlToken["kind"],keyof typeof tokenIds>>={id:"ID",integer:"INTEGER",float:"FLOAT",string:"STRING",blob:"BLOB",variable:"VARIABLE"};
const punctuationNames:Readonly<Record<string,keyof typeof tokenIds>>={";":"SEMI","(":"LP",")":"RP",",":"COMMA","=":"EQ","==":"EQ","!=":"NE","<>":"NE",">":"GT","<=":"LE","<":"LT",">=":"GE","+":"PLUS","-":"MINUS","*":"STAR","/":"SLASH","%":"REM","||":"CONCAT","->":"PTR","->>":"PTR","&":"BITAND","|":"BITOR","~":"BITNOT","<<":"LSHIFT",">>":"RSHIFT",".":"DOT"};
function byteToCodeUnit(sql:string,byte:number){let b=0,i=0;for(const s of sql){if(b===byte)return i;b+=new TextEncoder().encode(s).length;i+=s.length;}if(b===byte)return i;throw Error("token ended inside UTF-8 scalar");}
function terminal(t:SqlToken):number|undefined{if(t.kind==="keyword"){const name=keywordTable.get(t.text.toUpperCase())as keyof typeof tokenIds|undefined;return name===undefined?undefined:tokenIds[name];}const name=tokenKindNames[t.kind]??punctuationNames[t.text];return name===undefined?undefined:tokenIds[name];}
/** Port of tokenize.c getToken()/analyze{Window,Over,Filter}Keyword(). */
function contextualTerminals(tokens:readonly SqlToken[]):readonly (number|undefined)[]{
 const raw=tokens.map(terminal),id=tokenIds.ID;
 const identifier=(token:number|undefined)=>token===id||token===tokenIds.STRING||token===tokenIds.JOIN_KW||token===tokenIds.WINDOW||token===tokenIds.OVER||(token!==undefined&&(lemonTables.fallback[token]??0)===id);
 const out:(number|undefined)[]=[];let previous=-1;
 for(let i=0;i<raw.length;i++){
  const token=raw[i],next=raw[i+1],afterNext=raw[i+2];let adapted=token;
  if(token===tokenIds.WINDOW)adapted=identifier(next)&&afterNext===tokenIds.AS?token:id;
  else if(token===tokenIds.OVER)adapted=previous===tokenIds.RP&&(next===tokenIds.LP||identifier(next))?token:id;
  else if(token===tokenIds.FILTER)adapted=previous===tokenIds.RP&&next===tokenIds.LP?token:id;
  out.push(adapted);previous=adapted??-1;
 }
 return out;
}
function leaves(v:LemonValue<SqlToken>|undefined):SqlToken[]{if(!v)return[];return v.kind==="terminal"?(v.value?[v.value]:[]):v.children.flatMap(leaves);}
function exactSource(tokens:readonly SqlToken[],sqlBytes:Uint8Array):string|undefined{const first=tokens[0],last=tokens.at(-1);return first&&last?new TextDecoder().decode(sqlBytes.subarray(first.startByte,last.endByte)):undefined;}
function find(v:LemonValue<SqlToken>|undefined,p:(s:string)=>boolean):LemonValue<SqlToken>|undefined{if(!v||v.kind==="terminal")return; if(p(v.signature))return v;for(const c of v.children){const x=find(c,p);if(x)return x;}}
function findAll(v:LemonValue<SqlToken>|undefined,p:(s:string)=>boolean,out:LemonValue<SqlToken>[]=[]):LemonValue<SqlToken>[] {if(!v||v.kind==="terminal")return out;if(p(v.signature))out.push(v);for(const c of v.children)findAll(c,p,out);return out;}
function direct(v:LemonValue<SqlToken>,prefix:string):LemonValue<SqlToken>|undefined{if(v.kind==="terminal")return;for(const child of v.children)if(child.kind==="reduction"&&child.signature.startsWith(prefix))return child;}
function sqlIdentifier(token:SqlToken|undefined):string{if(!token)throw new SqlParseError("generated schema name is missing");const value=token.text;if(value[0]==="["&&value.at(-1)==="]")return value.slice(1,-1);if((value[0]==='"'||value[0]==="`")&&value.at(-1)===value[0])return value.slice(1,-1).replaceAll(value[0]+value[0],value[0]);return value;}
function ddlColumns(root:LemonValue<SqlToken>):readonly SchemaColumnDeclaration[]{
 const entries=findAll(root,s=>s.startsWith("columnlist ::=")&&s.includes("columnname carglist")).map(declaration=>{
  const column=direct(declaration,"columnname ::="),args=direct(declaration,"carglist ::=");if(!column||!args)throw new SqlParseError("generated column action is incomplete");
  const nameNode=direct(column,"nm ::="),typeNode=direct(column,"typetoken ::="),nameToken=leaves(nameNode)[0],rawTypeTokens=leaves(typeNode),generatedAt=rawTypeTokens.findIndex(token=>token.text.toUpperCase()==="GENERATED"),typeTokens=generatedAt<0?rawTypeTokens:rawTypeTokens.slice(0,generatedAt),constraints=findAll(args,s=>s.startsWith("ccons ::="));
  const expression=(prefix:string):ExprNode|null=>{const constraint=constraints.find(c=>c.kind==="reduction"&&c.signature.startsWith(prefix));if(!constraint)return null;const expr=find(constraint,s=>s.startsWith("expr ::="));if(expr)return{kind:"tokens",tokens:leaves(expr)};const tokens=leaves(constraint).slice(1);if(tokens[0]?.text==="("&&tokens.at(-1)?.text===")")tokens.splice(tokens.length-1,1),tokens.splice(0,1);if(!tokens.length)throw new SqlParseError("generated column expression is missing");return{kind:"tokens",tokens};};
  const has=(prefix:string)=>constraints.some(c=>c.kind==="reduction"&&c.signature.startsWith(prefix));
  const collate=constraints.find(c=>c.kind==="reduction"&&c.signature.startsWith("ccons ::= COLLATE"));
  const generated=constraints.find(c=>c.kind==="reduction"&&(c.signature.startsWith("ccons ::= GENERATED")||c.signature.startsWith("ccons ::= AS generated")));
  const generatedWords=generated?leaves(generated).map(t=>t.text.toUpperCase()):[];
  return{offset:nameToken?.startByte??0,value:Object.freeze({name:sqlIdentifier(nameToken),declaredType:typeTokens.length?typeTokens.map(t=>t.text).join(" "):null,defaultExpr:expression("ccons ::= DEFAULT"),generatedExpr:expression("ccons ::= GENERATED")??expression("ccons ::= AS generated"),notNull:has("ccons ::= NOT NULL"),primaryKey:has("ccons ::= PRIMARY KEY"),unique:has("ccons ::= UNIQUE"),collation:collate?sqlIdentifier(leaves(collate)[1]):null,generatedStorage:generated?(generatedWords.includes("STORED")?"stored":"virtual"):null})};
 });
 return Object.freeze(entries.sort((a,b)=>a.offset-b.offset).map(entry=>entry.value));
}
function selectListItems(root:LemonValue<SqlToken>):LemonValue<SqlToken>[] {const out:LemonValue<SqlToken>[]=[];const walk=(node:LemonValue<SqlToken>)=>{if(node.kind==="terminal")return;if(node!==root&&node.signature.startsWith("oneselect ::="))return;if(node.signature==="selcollist ::= sclp scanpt expr scanpt as"||node.signature==="selcollist ::= sclp scanpt STAR"||node.signature==="selcollist ::= sclp scanpt nm DOT STAR")out.push(node);for(const child of node.children)walk(child);};walk(root);return out;}
function expressionList(node:LemonValue<SqlToken>):readonly ExprNode[]{
 const out:ExprNode[]=[];
 const walk=(n:LemonValue<SqlToken>)=>{if(n.kind!=="reduction")return;for(const c of n.children){if(c.kind!=="reduction")continue;if(c.signature.startsWith("nexprlist ::="))walk(c);else if(c.signature.startsWith("expr ::=")||c.signature.startsWith("term ::="))out.push({kind:"tokens",tokens:leaves(c),reduction:c});}};
 walk(node);return Object.freeze(out);
}
const noJoin:JoinFlags=Object.freeze({inner:true,cross:false,natural:false,left:false,right:false,outer:false,error:false});
function joinFlags(node:LemonValue<SqlToken>|undefined):JoinFlags{const words=leaves(node).map(t=>t.text.toUpperCase()),names=words.filter(w=>w!=="JOIN"&&w!==",");return Object.freeze({inner:words.includes(",")||names.length===0||names.includes("INNER"),cross:names.includes("CROSS"),natural:names.includes("NATURAL"),left:names.includes("LEFT")||names.includes("FULL"),right:names.includes("RIGHT")||names.includes("FULL"),outer:names.includes("OUTER"),error:names.some(w=>!["INNER","CROSS","NATURAL","LEFT","RIGHT","FULL","OUTER"].includes(w))});}
function frozenSource(items:readonly SourceItem[],tokens:readonly SqlToken[],flattenedDerived?:FlattenedDerived,derived?:DerivedSource):SourceList{const out=[...tokens] as SqlToken[]&{items:readonly SourceItem[];tokens:readonly SqlToken[];flattenedDerived?:FlattenedDerived;derived?:DerivedSource};Object.defineProperties(out,{items:{value:Object.freeze([...items]),enumerable:true},tokens:{value:Object.freeze([...tokens]),enumerable:true},...(flattenedDerived?{flattenedDerived:{value:flattenedDerived,enumerable:true}}:{}),...(derived?{derived:{value:derived,enumerable:true}}:{})});return Object.freeze(out);}
/** Translation of parse.y stl_prefix/seltablist semantic actions and sqlite3SrcListShiftJoinType(). */
function sourceList(node:LemonValue<SqlToken>|undefined):SourceList{
 if(!node)return frozenSource([],[]);
 // select.c:flattenSubquery case 1. Admit only a deliberately small safe
 // single-source projection. Retaining the generated Select semantic avoids
 // reparsing SQL; every other shape continues to reject atomically.
 // Search only this SrcItem. The recursive stl_prefix carries earlier items;
 // traversing it associates an earlier derived SELECT with the current table.
 const ownSelect=(n:LemonValue<SqlToken>):LemonValue<SqlToken>|undefined=>{
  if(n.kind==="terminal")return;
  if(n!==node&&n.signature.startsWith("stl_prefix ::="))return;
  if(n.signature.startsWith("select ::="))return n;
  for(const child of n.children){const found=ownSelect(child);if(found)return found;}
 };
 const nested=ownSelect(node);
 if(nested){
  const select=nested.kind==="reduction"?nested.semantic as SelectNode|undefined:undefined;
  const ownAs=direct(node,"as ::="),aliases=leaves(ownAs);
  const projected=select?.result.map(expr=>expr.alias??(expr.tokens.length===1&&["id","keyword"].includes(expr.tokens[0]!.kind)?sqlIdentifier(expr.tokens[0]):null));
  // flattenSubquery restrictions represented by this parser permit a simple
  // projection over one or more ordinary FROM terms.  Do not require a single
  // inner term: that incorrectly rejects the pinned aggregate-over-derived-join
  // route even though flattening only splices the inner SrcList into the parent.
  const directProjection=!!select&&select.result.every(expr=>expr.tokens.length===1&&["id","keyword"].includes(expr.tokens[0]!.kind));
  // select.c:flattenSubquery restriction (25): window SELECTs retain their
  // generated Select owner and are consumed through a subquery destination.
  const hasWindow=!!select&&select.result.some(expr=>{const visit=(part:LemonValue<SqlToken>):boolean=>part.kind==='reduction'&&(part.signature.startsWith('over_clause ::= OVER')||part.children.some(visit));return !!expr.reduction&&visit(expr.reduction)});
  // Upstream resolves the generated Select while its pWith frame is pushed,
  // before flattenSubquery can splice its SrcList. This parser otherwise
  // flattens eagerly, so retain WITH owners until lowerOrdinaryCtes() performs
  // the equivalent innermost-first searchWith resolution.
  const safe=!!select&&!select.with&&!hasWindow&&aliases.length<=1&&select.arms.length===1&&select.from.items.length>0&&!select.hasDistinct&&!select.hasGroupBy&&!select.hasHaving&&!select.hasOrderBy&&!select.hasLimit&&!select.hasCompound&&!select.hasValues&&!select.hasSubquery&&projected?.every((name):name is string=>name!==null)&&(!aliases.length||select.from.items.length===1&&directProjection);
  if(!safe){
   // parse.y's SrcItem owns the generated Select when flattenSubquery is
   // ineligible. Preserve it for sqlite3Select's materialization destination.
   const prefix=direct(node,"stl_prefix ::="),priorNode=prefix?direct(prefix,"seltablist ::="):undefined;
   if(!select)throw new SqlUnsupportedError("this FROM subquery shape is not implemented");
   const prior=priorNode?sourceList(priorNode):frozenSource([],[]),alias=aliases.length?sqlIdentifier(aliases.at(-1)):null,name=alias??"(subquery)",preceding=direct(prefix!,"joinop ::="),onUsing=direct(node,"on_using ::="),onExpr=onUsing?direct(onUsing,"expr ::="):undefined,idlist=onUsing?direct(onUsing,"idlist ::="):undefined,using=idlist?Object.freeze(leaves(idlist).filter(t=>t.text!==",").map(sqlIdentifier)):null;
   const item:SourceItem=Object.freeze({databaseName:null,tableName:name,arguments:null,alias,indexedBy:null,notIndexed:false,on:onExpr?Object.freeze({kind:"tokens",tokens:Object.freeze(leaves(onExpr)),reduction:onExpr} as ExprNode):null,using,joinFromLeft:joinFlags(preceding),leftOfRightJoin:false,cursorId:null,table:null});
   const items=Object.freeze([...prior.items,item]);
   return frozenSource(items,leaves(node),undefined,Object.freeze({index:items.length-1,select,alias}));
  }
  const flattenedItems=aliases.length===1?select.from.items.map((item,index)=>index===0?Object.freeze({...item,alias:sqlIdentifier(aliases[0])}):item):select.from.items;
  return frozenSource(flattenedItems,leaves(node),Object.freeze({select}));
 }
 const items:SourceItem[]=[];
 const append=(list:LemonValue<SqlToken>):void=>{const prefix=direct(list,"stl_prefix ::=");if(prefix?.kind==="reduction"&&prefix.signature!=="stl_prefix ::="){const prior=direct(prefix,"seltablist ::=");if(prior)items.push(...sourceList(prior).items);}const reductions=list.kind==="reduction"?list.children.filter((c):c is LemonValue<SqlToken>&{kind:"reduction"}=>c.kind==="reduction"):[];const names=reductions.filter(c=>c.signature.startsWith("nm ::="));if(!names.length)throw new SqlParseError("generated FROM source name is missing");const first=sqlIdentifier(leaves(names[0])[0]),dbnm=reductions.find(c=>c.signature.startsWith("dbnm ::=")),dbToken=leaves(dbnm).find(t=>t.text!=="."),as=reductions.find(c=>c.signature.startsWith("as ::=")),asToken=leaves(as).find(t=>t.text.toUpperCase()!=="AS"),indexed=reductions.find(c=>c.signature.startsWith("indexed_by ::=")),indexedTokens=leaves(indexed),notIndexed=indexedTokens.some(t=>t.text.toUpperCase()==="NOT"),onUsing=reductions.find(c=>c.signature.startsWith("on_using ::=")),onExpr=onUsing?direct(onUsing,"expr ::="):undefined,idlist=onUsing?direct(onUsing,"idlist ::="):undefined,preceding=prefix?direct(prefix,"joinop ::="):undefined;const using=idlist?Object.freeze(leaves(idlist).filter(t=>t.text!==",").map(sqlIdentifier)):null;const argumentsNode=reductions.find(c=>c.signature.startsWith("exprlist ::=")),argumentsList=argumentsNode?expressionList(argumentsNode):null;items.push(Object.freeze({databaseName:dbToken?first:null,tableName:dbToken?sqlIdentifier(dbToken):first,arguments:argumentsList,alias:asToken?sqlIdentifier(asToken):null,indexedBy:indexedTokens.length&&!notIndexed?sqlIdentifier(indexedTokens.at(-1)):null,notIndexed,on:onExpr?Object.freeze({kind:"tokens",tokens:Object.freeze(leaves(onExpr)),reduction:onExpr} as ExprNode):null,using,joinFromLeft:items.length?joinFlags(preceding):noJoin,leftOfRightJoin:false,cursorId:null,table:null}));};append(node);const rightmost=items.reduce((n,item,i)=>item.joinFromLeft.right?i:n,-1),shifted=rightmost<0?items:items.map((item,i)=>i<rightmost?Object.freeze({...item,leftOfRightJoin:true}):item);return frozenSource(shifted,leaves(node));
}
function armAction(one:LemonValue<SqlToken>,operatorFromPrior:CompoundOperator|null,sqlBytes:Uint8Array):Omit<SelectArm,"prior"|"next">{
 const from=direct(one,"from ::="),fromList=from?find(from,s=>s.startsWith("seltablist ::=")):undefined,where=direct(one,"where_opt ::=");
 const result=selectListItems(one).map(item=>{if(item.kind!=="reduction")throw new SqlParseError("generated result expression is missing");const expr=item.signature.endsWith("expr scanpt as")?item.children[2]:undefined;const tokens=expr?leaves(expr):item.children.slice(2).flatMap(leaves);if(!tokens.length)throw new SqlParseError("generated result expression is missing");const asNode=expr?item.children[4]:undefined,asTokens=leaves(asNode);const alias=asTokens.length?sqlIdentifier(asTokens.at(-1)):undefined;return Object.freeze({kind:"tokens",tokens,...(expr?{reduction:expr}:{}),...(exactSource(tokens,sqlBytes)!==undefined?{sourceText:exactSource(tokens,sqlBytes)}:{}),...(alias!==undefined?{alias}:{})} as ExprNode);}).sort((a,b)=>(a.tokens[0]?.startByte??0)-(b.tokens[0]?.startByte??0));
 const present=(prefix:string,empty:string)=>{const node=direct(one,prefix);return node?.kind==="reduction"&&node.signature!==empty;};
 const expr=where?find(where,s=>s.startsWith("expr ::=")):undefined;
 return{result:Object.freeze(result),from:sourceList(fromList),where:expr?Object.freeze({kind:"tokens",tokens:leaves(expr),reduction:expr} as ExprNode):null,hasDistinct:present("distinct ::=","distinct ::="),hasGroupBy:present("groupby_opt ::=","groupby_opt ::="),hasHaving:present("having_opt ::=","having_opt ::="),origin:"select",valuesRows:null,operatorFromPrior};
}
type ArmDraft=Omit<SelectArm,"prior"|"next">;
type SelectSemantic={readonly arms:readonly ArmDraft[];readonly rightmost:LemonValue<SqlToken>};
function semanticOf<T>(child:LemonValue<SqlToken>|undefined,owner:string):T {if(child?.kind!=="reduction"||child.semantic===undefined)throw new SqlParseError(`generated ${owner} child semantic is missing`);return child.semantic as T;}
function linkedArms(drafts:readonly ArmDraft[]):readonly SelectArm[]{return Object.freeze(drafts.map((arm,i)=>Object.freeze({...arm,prior:i?i-1:null,next:i+1<drafts.length?i+1:null})));}
/** select.c:flattenSubquery moves the inner WHERE into the parent with AND. */
function andFlattenedPredicates(inner:ExprNode|null,outer:ExprNode|null):ExprNode|null{
 if(!inner)return outer;if(!outer)return inner;
 if(!inner.reduction||!outer.reduction)throw new SqlParseError("generated flattened predicate lost its reduction");
 const at=inner.tokens.at(-1)?.endByte??0,and:SqlToken=Object.freeze({kind:"keyword",text:"AND",startByte:at,endByte:at});
 const reduction:LemonValue<SqlToken>=Object.freeze({kind:"reduction",rule:-1,signature:"expr ::= expr AND expr",children:Object.freeze([inner.reduction,Object.freeze({kind:"terminal",tokenId:tokenIds.AND,value:and}),outer.reduction])});
 return Object.freeze({kind:"tokens",tokens:Object.freeze([...inner.tokens,and,...outer.tokens]),reduction});
}
/** Translation of parse.y frame_opt actions and window.c:sqlite3WindowAlloc(). */
export function windowFrame(window:LemonValue<SqlToken>|undefined):WindowFrameNode{
 const frame=window?direct(window,"frame_opt ::="):undefined;
 if(frame?.kind!=="reduction"||frame.signature==="frame_opt ::=")return Object.freeze({type:"range",start:Object.freeze({kind:"unbounded",expr:null}),end:Object.freeze({kind:"current",expr:null}),exclusion:null,implicit:true});
 const words=leaves(frame).map(token=>token.text.toUpperCase());
 const boundary=(prefix:string):WindowFrameBoundaryNode=>{
 const wrappers:{node:Extract<LemonValue<SqlToken>,{kind:"reduction"}>;words:string[]}[]=[];
 const collect=(node:LemonValue<SqlToken>):void=>{if(node.kind!=="reduction")return;if(node.signature.startsWith("frame_bound ::="))wrappers.push({node,words:leaves(node).map(token=>token.text.toUpperCase())});node.children.forEach(collect)};
 collect(frame);
 let bound:Extract<LemonValue<SqlToken>,{kind:"reduction"}>|undefined;
 const wrapper=find(frame,signature=>signature.startsWith(prefix));
 const candidate=wrapper?find(wrapper,signature=>signature.startsWith("frame_bound ::=")):undefined;
 if(candidate?.kind==="reduction")bound=candidate;
 else if(wrapper?.kind==="reduction")bound=wrapper;
 // Some generated reductions inline one/both wrappers. Positional fallback is
 // only valid after the source-specific frame_bound_s/e subtree was searched.
 if(!bound)bound=prefix.startsWith("frame_bound_e")?wrappers[1]?.node:wrappers[0]?.node;
 if(!bound)throw new SqlParseError("generated window frame boundary is missing");
  const boundWords=leaves(bound).map(token=>token.text.toUpperCase());
  const kind:WindowFrameBoundaryKind=boundWords.includes("UNBOUNDED")?"unbounded":boundWords.includes("PRECEDING")?"preceding":boundWords.includes("FOLLOWING")?"following":"current";
  const expression=bound.kind==="reduction"?bound.children.find(child=>child.kind==="reduction"&&(child.signature.startsWith("expr ::=")||child.signature.startsWith("term ::="))):undefined;
  const expr=expression&&expression.kind==="reduction"?Object.freeze({kind:"tokens",tokens:Object.freeze(leaves(expression)),reduction:expression} as ExprNode):null;const zero=expr&&/^[+-]?0(?:_?0)*$/.test(expr.tokens.map(token=>token.text).join(""));return Object.freeze(zero?{kind:"current",expr:null}:{kind,expr});
 };
 const exclusion:WindowFrameExclusion=words.includes("TIES")?"ties":words.includes("GROUP")?"group":words.includes("OTHERS")?"no-others":words.includes("CURRENT")&&words.includes("EXCLUDE")?"current-row":null;
 const start=boundary("frame_bound_s ::=");
 const between=words.includes("BETWEEN");
 const end=between?boundary("frame_bound_e ::="):Object.freeze({kind:"current",expr:null} as WindowFrameBoundaryNode);
 return Object.freeze({type:words.includes("ROWS")?"rows":words.includes("GROUPS")?"groups":"range",start,end,exclusion,implicit:false});
}
function selectAction(semantic:SelectSemantic,all:readonly SqlToken[],sqlBytes:Uint8Array,withModel:WithClause|null=null):SelectNode{
 const one=semantic.rightmost,arms=linkedArms(semantic.arms),hasValues=arms.some(arm=>arm.origin==="values");
 // parse.y accepts this only through error recovery. ORDER/LIMIT tokens before a
 // later compound arm are never owned by the rightmost oneselect and must not be
 // silently dropped into a partial-arm program.
 if(arms.length>1){
  const rightmost=arms.at(-1)!.result[0]!.tokens[0]!.startByte;
  // An ORDER/LIMIT owned by a parenthesized expression subquery in an earlier
  // result is not an arm-local compound clause. parse.y keeps that Select on
  // the expression node; only otherwise-unowned tokens trigger recovery.
  const expressionTokenStarts=new Set(arms.flatMap(arm=>arm.result.flatMap(result=>result.tokens.map(token=>token.startByte))));
  const misplaced=all.find(t=>t.startByte<rightmost&&!expressionTokenStarts.has(t.startByte)&&(t.text.toUpperCase()==="ORDER"||t.text.toUpperCase()==="LIMIT"));
  if(misplaced)throw new SqlParseError(`${misplaced.text.toUpperCase()} BY clause should come after ${arms.at(-1)!.operatorFromPrior!.toUpperCase().replace("-"," ")} not before`);
 }
 const from=direct(one,"from ::="),fromList=from?find(from,s=>s.startsWith("seltablist ::=")):undefined,where=direct(one,"where_opt ::=");
 const result=selectListItems(one).map(item=>{if(item.kind!=="reduction")throw new SqlParseError("generated result expression is missing");const expr=item.signature.endsWith("expr scanpt as")?item.children[2]:undefined;const tokens=expr?leaves(expr):item.children.slice(2).flatMap(leaves);if(!tokens.length)throw new SqlParseError("generated result expression is missing");const asNode=expr?item.children[4]:undefined,asTokens=leaves(asNode);const alias=asTokens.length?sqlIdentifier(asTokens.at(-1)):undefined;return{kind:"tokens",tokens,...(expr?{reduction:expr}:{}),...(exactSource(tokens,sqlBytes)!==undefined?{sourceText:exactSource(tokens,sqlBytes)}:{}),...(alias===undefined?{}:{alias})} as ExprNode;}).sort((a,b)=>(a.tokens[0]?.startByte??0)-(b.tokens[0]?.startByte??0));
 const present=(prefix:string,empty:string)=>{const node=direct(one,prefix);return node?.kind==="reduction"&&node.signature!==empty;};
 const groupNode=direct(one,"groupby_opt ::="),groupList=groupNode?direct(groupNode,"nexprlist ::="):undefined,groupBy=groupList?expressionList(groupList):Object.freeze([] as ExprNode[]),havingNode=direct(one,"having_opt ::="),havingExpr=havingNode?direct(havingNode,"expr ::="):undefined;
 const windowClause=direct(one,"window_clause ::="),windowDefinitions=windowClause?findAll(windowClause,s=>s.startsWith("windowdefn ::=")).map(node=>{const window=direct(node,"window ::="),partList=window?direct(window,"nexprlist ::="):undefined,order=window?direct(window,"orderby_opt ::="):undefined,sort=order?direct(order,"sortlist ::="):window?direct(window,"sortlist ::="):undefined;const orderBy=sort?findAll(sort,s=>s.startsWith("sortlist ::=")).map(item=>{const expr=item.kind==="reduction"?item.children.find(c=>c.kind==="reduction"&&!c.signature.startsWith("sortlist ::=")&&!c.signature.startsWith("sortorder ::=")&&!c.signature.startsWith("nulls ::=")):undefined;if(!expr||expr.kind!=="reduction")throw new SqlParseError("generated window ORDER BY expression is missing");return Object.freeze({kind:"tokens",tokens:leaves(expr),reduction:expr} as ExprNode);}).sort((a,b)=>(a.tokens[0]?.startByte??0)-(b.tokens[0]?.startByte??0)):[];const windowLeaves=window?leaves(window):[],baseToken=window?.kind==="reduction"&&window.signature.startsWith("window ::= nm")?windowLeaves[0]:undefined;return Object.freeze({name:sqlIdentifier(leaves(node)[0]!),baseName:baseToken?sqlIdentifier(baseToken):null,hasFrame:(()=>{const frame=window?direct(window,"frame_opt ::="):undefined;return frame?.kind==='reduction'&&frame.signature!=="frame_opt ::=";})(),frame:windowFrame(window),frameError:(()=>{const frame=window?direct(window,"frame_opt ::="):undefined;if(frame?.kind!=="reduction")return null;const frameWords=leaves(frame).map(token=>token.text.toUpperCase());if(frame.signature.startsWith("frame_opt ::= range_or_rows BETWEEN")){const bounds=frame.children.filter(child=>child.kind==="reduction"&&(child.signature.startsWith("frame_bound_s ::=")||child.signature.startsWith("frame_bound_e ::="))),words=bounds.map(bound=>leaves(bound).map(token=>token.text.toUpperCase())),start=words[0]??[],end=words[1]??[];if((start.includes("CURRENT")&&end.includes("PRECEDING"))||(start.includes("FOLLOWING")&&(end.includes("PRECEDING")||end.includes("CURRENT"))))return "unsupported frame specification";}const offset=find(frame,s=>s==="frame_bound ::= expr PRECEDING|FOLLOWING");if(frameWords.includes("RANGE")&&offset&&orderBy.length!==1)return "RANGE with offset PRECEDING/FOLLOWING requires one ORDER BY expression";return null;})(),partitionBy:partList?expressionList(partList):Object.freeze([] as ExprNode[]),orderBy:Object.freeze(orderBy)});}):[],windowNames=windowDefinitions.map(definition=>definition.name);
 const orderNode=direct(one,"orderby_opt ::="),sortList=orderNode?direct(orderNode,"sortlist ::="):undefined;
 const orderBy=sortList?findAll(sortList,s=>s.startsWith("sortlist ::=")).map(item=>{const expr=item.kind==="reduction"?item.children.find(c=>c.kind==="reduction"&&!c.signature.startsWith("sortlist ::=")&&!c.signature.startsWith("sortorder ::=")&&!c.signature.startsWith("nulls ::=")):undefined;if(!expr||expr.kind!=="reduction")throw new SqlParseError("generated ORDER BY expression is missing");const nullWords=leaves(direct(item,"nulls ::=")).map(t=>t.text.toUpperCase());return Object.freeze({expr:{kind:"tokens",tokens:leaves(expr),reduction:expr} as ExprNode,descending:leaves(direct(item,"sortorder ::=")).some(t=>t.text.toUpperCase()==="DESC"),nulls:nullWords.includes("FIRST")?"first":nullWords.includes("LAST")?"last":null});}).sort((a,b)=>(a.expr.tokens[0]?.startByte??0)-(b.expr.tokens[0]?.startByte??0)):[];
 const limitNode=direct(one,"limit_opt ::="),limitExprs=limitNode?.kind==="reduction"?limitNode.children.filter(c=>c.kind==="reduction"):[];
 let limit:ExprNode|null=null,offset:ExprNode|null=null;if(limitExprs.length){const comma=leaves(limitNode).some(t=>t.text===",");const first={kind:"tokens",tokens:leaves(limitExprs[0]!),reduction:limitExprs[0]!} as ExprNode,second=limitExprs[1]?{kind:"tokens",tokens:leaves(limitExprs[1]),reduction:limitExprs[1]} as ExprNode:null;if(comma){offset=first;limit=second}else{limit=first;offset=second}}
 const left=arms[0]!;
 const outerWhere:(ExprNode|null)=(()=>{const expr=where?find(where,s=>s.startsWith("expr ::=")):undefined;return expr?{kind:"tokens",tokens:leaves(expr),reduction:expr}:null;})();
 const flattened=left.from.flattenedDerived;
 // flattenSubquery case 1 splices the inner SrcList and combines predicates;
 // preserving both reductions keeps ordinary expression lowering as the owner.
 const effectiveFrom=flattened?flattened.select.from:left.from,effectiveWhere=flattened?andFlattenedPredicates(flattened.select.where,outerWhere):outerWhere;
 // flattenSubquery substitutes the subquery result expressions for a parent
 // wildcard. Keeping the underlying table wildcard would expose source order
 // instead of the derived table's ordered projection (for example c,b).
 const parentStar=left.result.length===1&&left.result[0]!.tokens.length===1&&left.result[0]!.tokens[0]!.text==="*";
 const effectiveResult=flattened&&parentStar?flattened.select.result:left.result;
 return{kind:"select",result:effectiveResult,from:effectiveFrom,where:effectiveWhere,groupBy,having:havingExpr?{kind:"tokens",tokens:leaves(havingExpr),reduction:havingExpr}:null,orderBy:Object.freeze(orderBy),windowNames:Object.freeze(windowNames),windowDefinitions:Object.freeze(windowDefinitions),limit,offset,hasDistinct:present("distinct ::=","distinct ::="),hasGroupBy:present("groupby_opt ::=","groupby_opt ::="),hasHaving:present("having_opt ::=","having_opt ::="),hasOrderBy:present("orderby_opt ::=","orderby_opt ::="),hasLimit:present("limit_opt ::=","limit_opt ::="),hasCompound:arms.length>1,hasValues,hasSubquery:!flattened&&findAll(one,s=>s==="seltablist ::= stl_prefix LP select RP as on_using"||s==="expr ::= LP select RP"||s==="expr ::= expr in_op LP select RP"||s==="expr ::= EXISTS LP select RP").length>0,with:withModel,arms,tokens:all};
}
function schemaName(node:LemonValue<SqlToken>|undefined):string|null{const token=leaves(node)[0];return token?sqlIdentifier(token):null;}
function ddlAction(root:LemonValue<SqlToken>,all:readonly SqlToken[]):SchemaDdlNode|undefined{
 const candidates=[["TABLE","create_table ::="],["INDEX","cmd ::= createkw uniqueflag INDEX"],["VIEW","cmd ::= createkw temp VIEW"],["TRIGGER","cmd ::= createkw trigger_decl"]] as const;const matched=candidates.map(([kind,prefix])=>({kind,ddl:find(root,s=>s.startsWith(prefix))})).find(x=>x.ddl);if(!matched)return;const kindWord=matched.kind,ddl=matched.ddl!;
 const words=all.map(t=>t.text.toUpperCase()),options=findAll(root,s=>s.startsWith("table_option ::="));
 const sortlist=kindWord==="INDEX"?find(ddl,s=>s.startsWith("sortlist ::=")):undefined;
 const indexTerms=sortlist?findAll(sortlist,s=>s.startsWith("sortlist ::=")).map(item=>{const expr=direct(item,"expr ::=");if(!expr)throw new SqlParseError("generated index expression is missing");const exprTokens=leaves(expr),collateAt=exprTokens.findIndex(t=>t.text.toUpperCase()==="COLLATE"),nullWords=leaves(direct(item,"nulls ::=")).map(t=>t.text.toUpperCase());return Object.freeze({expr:{kind:"tokens",tokens:collateAt<0?exprTokens:exprTokens.slice(0,collateAt)} as ExprNode,descending:leaves(direct(item,"sortorder ::=")).some(t=>t.text.toUpperCase()==="DESC"),collation:collateAt<0?null:sqlIdentifier(exprTokens[collateAt+1]),nulls:nullWords.includes("FIRST")?"first":nullWords.includes("LAST")?"last":null});}).sort((a,b)=>(a.expr.tokens[0]?.startByte??0)-(b.expr.tokens[0]?.startByte??0)):[];
 const names=ddl.kind==="reduction"?ddl.children.filter(c=>c.kind==="reduction"&&c.signature.startsWith("nm ::=")):[];
 const viewList=kindWord==="VIEW"?find(ddl,s=>s.startsWith("eidlist_opt ::= LP eidlist RP")):undefined;
 const viewColumns=viewList?findAll(viewList,s=>s.startsWith("eidlist ::=")).flatMap(item=>{const own=direct(item,"nm ::=");return own?[sqlIdentifier(leaves(own)[0])]:[]}).reverse():[];
 const selected=kindWord==="VIEW"?find(ddl,s=>s.startsWith("select ::=")):undefined,tableArgs=kindWord==="TABLE"?find(root,s=>s.startsWith("create_table_args ::= AS select")):undefined,tableSelected=tableArgs?find(tableArgs,s=>s.startsWith("select ::=")):undefined;
 const where=kindWord==="INDEX"?find(ddl,s=>s.startsWith("where_opt ::= WHERE")):undefined,whereExpr=where?find(where,s=>s.startsWith("expr ::=")):undefined;
 const tablePrimary=find(root,s=>s.startsWith("tcons ::= PRIMARY KEY")),primaryKey=tablePrimary?findAll(tablePrimary,s=>s.startsWith("sortlist ::=")).map(x=>direct(x,"expr ::=")).filter((x):x is LemonValue<SqlToken>=>!!x).map(x=>sqlIdentifier(leaves(x)[0])).reverse():[];
 const tableUniqueTerms=findAll(root,s=>s.startsWith("tcons ::= UNIQUE")).map(constraint=>{const list=find(constraint,s=>s.startsWith("sortlist ::="));if(!list)return Object.freeze([] as SchemaIndexTermDeclaration[]);return Object.freeze(findAll(list,s=>s.startsWith("sortlist ::=")).map(item=>{const expr=direct(item,"expr ::=");if(!expr)throw new SqlParseError("generated UNIQUE term is missing");const exprTokens=leaves(expr),collateAt=exprTokens.findIndex(t=>t.text.toUpperCase()==="COLLATE"),nullWords=leaves(direct(item,"nulls ::=")).map(t=>t.text.toUpperCase());return Object.freeze({expr:{kind:"tokens",tokens:collateAt<0?exprTokens:exprTokens.slice(0,collateAt)} as ExprNode,descending:leaves(direct(item,"sortorder ::=")).some(t=>t.text.toUpperCase()==="DESC"),collation:collateAt<0?null:sqlIdentifier(exprTokens[collateAt+1]),nulls:nullWords.includes("FIRST")?"first":nullWords.includes("LAST")?"last":null});}).sort((a,b)=>(a.expr.tokens[0]?.startByte??0)-(b.expr.tokens[0]?.startByte??0)));});
 const columnDeclarations=findAll(root,s=>s.startsWith("columnlist ::=")&&s.includes("columnname carglist")).map(node=>{const column=direct(node,"columnname ::="),name=column?sqlIdentifier(leaves(direct(column,"nm ::="))[0]):null,tokens=leaves(node);return{name,start:tokens[0]?.startByte??0,end:tokens.at(-1)?.endByte??0};}).filter((x):x is {name:string;start:number;end:number}=>x.name!==null);
 const containingColumn=(node:LemonValue<SqlToken>)=>{if(node.kind!=="reduction")return null;for(const declaration of findAll(root,s=>s.startsWith("columnlist ::=")&&s.includes("columnname carglist"))){const args=direct(declaration,"carglist ::=");if(args&&find(args,s=>s===node.signature)===node){const column=direct(declaration,"columnname ::=");return column?sqlIdentifier(leaves(direct(column,"nm ::="))[0]):null;}}return null;};
 const listNames=(node:LemonValue<SqlToken>|undefined):readonly string[]=>node?Object.freeze(findAll(node,s=>s.startsWith("eidlist ::=")).flatMap(item=>{const own=direct(item,"nm ::=");return own?[{name:sqlIdentifier(leaves(own)[0]),at:leaves(own)[0]?.startByte??0}]:[]}).sort((a,b)=>a.at-b.at).map(item=>item.name)):Object.freeze([]);
 const constraintName=(node:LemonValue<SqlToken>):string|null=>{const start=leaves(node)[0]?.startByte??0;const declarations=findAll(root,s=>s==="ccons ::= CONSTRAINT nm"||s==="tcons ::= CONSTRAINT nm").map(item=>({item,end:leaves(item).at(-1)?.endByte??0})).filter(item=>item.end<=start).sort((a,b)=>b.end-a.end);const prior=declarations[0];if(!prior)return null;const between=all.filter(token=>token.startByte>=prior.end&&token.endByte<=start);if(between.some(token=>token.text===","))return null;const name=direct(prior.item,"nm ::=");return name?sqlIdentifier(leaves(name)[0]):null;};
 const checks=kindWord==="TABLE"?findAll(root,s=>s.startsWith("ccons ::= CHECK")||s.startsWith("tcons ::= CHECK")).map(node=>{const expr=find(node,s=>s.startsWith("expr ::="));if(!expr)throw new SqlParseError("generated CHECK expression is missing");return Object.freeze({name:constraintName(node),columnName:containingColumn(node),expr:Object.freeze({kind:"tokens",tokens:Object.freeze(leaves(expr)),reduction:expr} as ExprNode),tokens:Object.freeze(leaves(node))});}).sort((a,b)=>(a.tokens[0]?.startByte??0)-(b.tokens[0]?.startByte??0)):[];
 const foreignKeyNodes=kindWord==="TABLE"?findAll(root,s=>s.startsWith("ccons ::= REFERENCES")||s.startsWith("tcons ::= FOREIGN KEY")):[];
 const columnForeignKeyDeferral=(node:LemonValue<SqlToken>):readonly SqlToken[]=>{const column=containingColumn(node),end=leaves(node).at(-1)?.endByte??0;if(!column)return Object.freeze([]);const prior=foreignKeyNodes.filter(candidate=>containingColumn(candidate)===column&&(leaves(candidate).at(-1)?.endByte??0)<end).sort((a,b)=>(leaves(b).at(-1)?.endByte??0)-(leaves(a).at(-1)?.endByte??0))[0];if(prior)return Object.freeze([]);const clause=findAll(root,s=>s.startsWith("ccons ::= defer_subclause")).filter(candidate=>containingColumn(candidate)===column&&(leaves(candidate)[0]?.startByte??-1)>=end).sort((a,b)=>(leaves(a)[0]?.startByte??0)-(leaves(b)[0]?.startByte??0))[0];if(!clause)return Object.freeze([]);const intervening=foreignKeyNodes.some(candidate=>containingColumn(candidate)===column&&(leaves(candidate)[0]?.startByte??0)>end&&(leaves(candidate)[0]?.startByte??0)<(leaves(clause)[0]?.startByte??0));return intervening?Object.freeze([]):Object.freeze(leaves(clause));};
 const foreignKeys=foreignKeyNodes.map(node=>{const ownTokens=leaves(node),tableForm=node.kind==="reduction"&&node.signature.startsWith("tcons ::=");const tokens=tableForm?ownTokens:Object.freeze([...ownTokens,...columnForeignKeyDeferral(node)]);const names=findAll(node,s=>s.startsWith("nm ::="));const tableNode=tableForm?names.find(n=>(leaves(n)[0]?.startByte??0)>(tokens.find(t=>t.text.toUpperCase()==="REFERENCES")?.startByte??-1)):names[0];if(!tableNode)throw new SqlParseError("generated REFERENCES table is missing");const lists=findAll(node,s=>s.startsWith("eidlist ::=")).sort((a,b)=>(leaves(a)[0]?.startByte??0)-(leaves(b)[0]?.startByte??0));const referencesAt=tokens.find(t=>t.text.toUpperCase()==="REFERENCES")?.startByte??-1;const localList=lists.filter(list=>(leaves(list)[0]?.startByte??0)<referencesAt).sort((a,b)=>leaves(b).length-leaves(a).length)[0];const local=tableForm?listNames(localList):Object.freeze([containingColumn(node)!]);const referencedList=find(node,s=>s.startsWith("eidlist_opt ::= LP eidlist RP"));const words=tokens.map(t=>t.text.toUpperCase());const action=(kind:"DELETE"|"UPDATE"):ForeignKeyAction=>{const at=words.findIndex((word,index)=>word==="ON"&&words[index+1]===kind);if(at<0)return "no-action";const pair=words.slice(at+2,at+4).join(" ");if(pair==="SET NULL")return "set-null";if(pair==="SET DEFAULT")return "set-default";if(words[at+2]==="CASCADE")return "cascade";if(words[at+2]==="RESTRICT")return "restrict";return "no-action";};return Object.freeze({name:constraintName(node),columns:local,referencedTable:sqlIdentifier(leaves(tableNode)[0]),referencedColumns:referencedList?listNames(find(referencedList,s=>s.startsWith("eidlist ::="))):null,onDelete:action("DELETE"),onUpdate:action("UPDATE"),deferrable:words.some((word,index)=>word==="DEFERRABLE"&&words[index-1]!=="NOT"),initiallyDeferred:words.some((word,index)=>word==="DEFERRABLE"&&words[index-1]!=="NOT")&&words.some((word,index)=>word==="INITIALLY"&&words[index+1]==="DEFERRED"),tokens:Object.freeze(tokens)});}).sort((a,b)=>(a.tokens[0]?.startByte??0)-(b.tokens[0]?.startByte??0));
 return{kind:`create-${kindWord.toLowerCase()}` as SchemaDdlNode["kind"],name:schemaName(names[0]??find(ddl,s=>s.startsWith("nm ::="))),tokens:all,columns:kindWord==="TABLE"?ddlColumns(root):Object.freeze([]),checks:Object.freeze(checks),foreignKeys:Object.freeze(foreignKeys),viewColumns:Object.freeze(viewColumns),withoutRowid:options.some(option=>option.kind==="reduction"&&option.signature.startsWith("table_option ::= WITHOUT")&&leaves(option).some(token=>token.text.toUpperCase()==="ROWID")),indexTerms:Object.freeze(indexTerms),tableUniqueTerms:Object.freeze(tableUniqueTerms),tableName:kindWord==="INDEX"?schemaName(names.at(-1)):null,select:selected?semanticOf<SelectNode>(selected,"view select"):null,indexWhere:whereExpr?{kind:"tokens",tokens:leaves(whereExpr)}:null,tableAsSelect:tableSelected?semanticOf<SelectNode>(tableSelected,"table AS select"):null,primaryKey:Object.freeze(primaryKey),indexUnique:kindWord==="INDEX"&&leaves(direct(ddl,"uniqueflag ::=")).some(t=>t.text.toUpperCase()==="UNIQUE")};
}
function deepFreeze<T>(value:T):T {if(value&&typeof value==="object"&&!Object.isFrozen(value)){for(const child of Object.values(value as object))deepFreeze(child);Object.freeze(value);}return value;}
function productionAction(signature:string,children:readonly LemonValue<SqlToken>[],sqlBytes:Uint8Array):unknown{
 const root:LemonValue<SqlToken>={kind:"reduction",rule:-1,signature,children};
 if(signature==="wqas ::= AS")return "any" satisfies CteMaterialization;
 if(signature==="wqas ::= AS MATERIALIZED")return "materialized" satisfies CteMaterialization;
 if(signature==="wqas ::= AS NOT MATERIALIZED")return "not-materialized" satisfies CteMaterialization;
 if(signature==="wqitem ::= withnm eidlist_opt wqas LP select RP"){
  const name=sqlIdentifier(leaves(children[0])[0]),aliases=leaves(children[1]).filter(token=>token.text!==","&&token.text!=="("&&token.text!==")").map(sqlIdentifier);
  return Object.freeze({name,columns:aliases.length?Object.freeze(aliases):null,select:semanticOf<SelectNode>(children[4],"CTE select"),materialization:semanticOf<CteMaterialization>(children[2],"CTE materialization")} as CteNode);
 }
 if(signature==="wqlist ::= wqitem")return Object.freeze([semanticOf<CteNode>(children[0],"WITH item")]);
 if(signature==="wqlist ::= wqlist COMMA wqitem")return Object.freeze([...semanticOf<readonly CteNode[]>(children[0],"WITH list"),semanticOf<CteNode>(children[2],"WITH item")]);
 if(signature==="values ::= VALUES LP nexprlist RP"){
  const list=direct(root,"nexprlist ::=");if(!list)throw new SqlParseError("generated VALUES row is missing");return Object.freeze([expressionList(list)]);
 }
 if(signature==="mvalues ::= values COMMA LP nexprlist RP"||signature==="mvalues ::= mvalues COMMA LP nexprlist RP"){
  const prior=semanticOf<readonly (readonly ExprNode[])[]>(children[0],"mvalues");const list=children[3];if(list?.kind!=="reduction")throw new SqlParseError("generated VALUES row is missing");return Object.freeze([...prior,expressionList(list)]);
 }
 if(signature==="oneselect ::= values"||signature==="oneselect ::= mvalues"){
  const rows=semanticOf<readonly (readonly ExprNode[])[]>(children[0],"oneselect VALUES");const arm:ArmDraft=Object.freeze({result:rows[0]!,from:sourceList(undefined),where:null,hasDistinct:false,hasGroupBy:false,hasHaving:false,origin:"values",valuesRows:rows,operatorFromPrior:null});return Object.freeze({arms:Object.freeze([arm]),rightmost:root} as SelectSemantic);
 }
 if(signature.startsWith("oneselect ::= SELECT "))return Object.freeze({arms:Object.freeze([Object.freeze(armAction(root,null,sqlBytes))]),rightmost:root} as SelectSemantic);
 if(signature==="selectnowith ::= oneselect")return semanticOf<SelectSemantic>(children[0],"selectnowith");
 if(signature==="selectnowith ::= selectnowith multiselect_op oneselect"){
  const left=semanticOf<SelectSemantic>(children[0],"compound left"),right=semanticOf<SelectSemantic>(children[2],"compound right");
  const words=leaves(children[1]).map(t=>t.text.toUpperCase()).join(" "),operator:CompoundOperator=words==="UNION ALL"?"union-all":words==="UNION"?"union":words==="INTERSECT"?"intersect":"except";
  if(right.arms.length!==1)throw new SqlParseError("generated compound right arm is incomplete");const arm=Object.freeze({...right.arms[0]!,operatorFromPrior:operator});return Object.freeze({arms:Object.freeze([...left.arms,arm]),rightmost:right.rightmost} as SelectSemantic);
 }
 if(signature==="select ::= selectnowith")return deepFreeze(selectAction(semanticOf<SelectSemantic>(children[0],"select"),leaves(root),sqlBytes));
 if(signature==="select ::= WITH wqlist selectnowith"||signature==="select ::= WITH RECURSIVE wqlist selectnowith"){
  const recursive=signature.includes(" RECURSIVE "),listIndex=recursive?2:1,selectIndex=recursive?3:2,ctes=semanticOf<readonly CteNode[]>(children[listIndex],"WITH list"),seen=new Set<string>();
  for(const cte of ctes){const key=cte.name.replace(/[A-Z]/g,c=>c.toLowerCase());if(seen.has(key))throw new SqlParseError(`duplicate WITH table name: ${cte.name}`);seen.add(key);}
  return deepFreeze(selectAction(semanticOf<SelectSemantic>(children[selectIndex],"select"),leaves(root),sqlBytes,Object.freeze({recursive,ctes})));
 }
 if(signature.startsWith("cmd ::= select"))return semanticOf<SelectNode>(children[0],"cmd select");
 const tokens=leaves(root);
 if(signature.startsWith("cmd ::= create_table")||signature.startsWith("cmd ::= createkw uniqueflag INDEX")||signature.startsWith("cmd ::= createkw temp VIEW")||signature.startsWith("cmd ::= createkw trigger_decl")){
  const ddl=ddlAction(root,tokens);if(ddl)return deepFreeze(ddl);
 }
}
function action(root:LemonValue<SqlToken>,tokens:readonly SqlToken[]):ParsedStatement{const cmd=find(root,s=>s.startsWith("cmd ::="));if(cmd?.kind==="reduction"&&cmd.semantic)return cmd.semantic as ParsedStatement;throw new SqlParseError(`near "${tokens[0]!.text}": syntax error`);}
export interface ParseLimits{readonly maxSqlBytes?:number;readonly maxWorkUnits?:number;readonly maxParserDepth?:number;readonly maxExpressionDepth?:number}
export function parseSql(sql:string,limits:number|ParseLimits=16*1024*1024):ParseResult{const options=typeof limits==="number"?{maxSqlBytes:limits}:limits;const maxSqlBytes=options.maxSqlBytes??16*1024*1024,maxWorkUnits=options.maxWorkUnits??10_000_000,maxParserDepth=options.maxParserDepth??2500,maxExpressionDepth=options.maxExpressionDepth??1000;let bytes:Uint8Array;try{bytes=encodeSql(sql);}catch(e){throw new SqlParseError((e as Error).message);}if(bytes.length>maxSqlBytes)throw new RangeError("SQL exceeds maxSqlBytes");const sig=tokenize(bytes).filter(t=>t.kind!=="space"&&t.kind!=="comment"&&t.kind!=="eof");if(!sig.length)return{statement:null,tailOffset:bytes.length,tailCodeUnit:sql.length,lemon:null};const illegal=sig.find(t=>t.kind==="illegal");if(illegal)throw new SqlParseError(`unrecognized token: "${illegal.text}"`);let depth=0,semi:SqlToken|undefined;for(const t of sig){if(t.text==="(")depth++;else if(t.text===")"){if(--depth<0)throw new SqlParseError('near ")": syntax error');}else if(t.text===";"&&depth===0){semi=t;break;}}if(depth)throw new SqlParseError("incomplete input");const tokens=sig.slice(0,semi?sig.indexOf(semi):undefined),ids=contextualTerminals(tokens);if(ids.some(x=>x===undefined))throw new SqlParseError(`unrecognized token: "${tokens[ids.findIndex(x=>x===undefined)]!.text}"`);const sentinel:SqlToken={kind:"punct",startByte:semi?.startByte??bytes.length,endByte:semi?.endByte??bytes.length,text:";"},lemon=lemonParse([...ids as number[],tokenIds.SEMI,0],[...tokens,sentinel],{maxWorkUnits,maxParserDepth,maxExpressionDepth},(signature,children)=>productionAction(signature,children,bytes));if(!lemon.accepted||!lemon.value){const at=lemon.errorInput??tokens.length,token=tokens[at];throw new SqlParseError(token?`near "${token.text}": syntax error`:"incomplete input");}const statement=action(lemon.value,tokens);const tailOffset=semi?.endByte??bytes.length;return{statement,tailOffset,tailCodeUnit:byteToCodeUnit(sql,tailOffset),lemon};}
