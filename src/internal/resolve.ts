import {windowFrame,type ExprNode,type SelectNode,type SourceItem,type WindowDefinitionNode,type WindowFrameNode} from './parse.ts';
import type {ColumnNode,TableNode} from './schema.ts';
import {sqliteAsciiFold,sqliteIdentifierEqual} from './sqlite-case.ts';
import type {LemonValue} from './lemon-runtime.ts';
import type {SqlToken} from './tokenize.ts';

export class NameResolutionError extends Error{}
// select.c:sqlite3ColumnsFromExprList installs unique names on the transient
// subquery Table before resolve.c:lookupName walks linked NameContexts.
export function transientColumnNames(names:readonly string[]):readonly string[]{
 const used=new Set<string>(),result:string[]=[];
 for(const original of names){
  let name=original,counter=0;
  while(used.has(sqliteAsciiFold(name)))name=`${name.replace(/:\d*$/, '')}:${++counter}`;
  used.add(sqliteAsciiFold(name));result.push(name);
 }
 return Object.freeze(result);
}

export interface ResolutionSchema {readonly tables:ReadonlyMap<string,TableNode>}
export interface ResolvedSource extends Omit<SourceItem,'cursorId'|'table'>{readonly cursorId:number;readonly table:TableNode}
export interface ResultColumnDescriptor {readonly name:string;readonly declaredType:string|null;readonly database:string|null;readonly table:string|null;readonly origin:string|null;readonly affinity:ColumnNode['affinity']|null;readonly collation:string}
export interface ResolvedColumnRef {readonly source:ResolvedSource;readonly columnIndex:number;readonly name:string}
export interface ResolvedResult {readonly name:string;readonly expression:ExprNode;readonly source:ResolvedSource|null;readonly columnIndex:number|null;readonly mergedSources:readonly ResolvedColumnRef[]|null;readonly resolution:'direct'|'coalesce'|'expression';readonly descriptor:ResultColumnDescriptor}
export interface ResolvedWindow {readonly functionName:string;readonly argumentCount:number;readonly owner:ExprNode;readonly filter:ExprNode|null;readonly definitionName:string|null;readonly partitionBy:readonly ExprNode[];readonly orderBy:readonly ExprNode[];readonly frame:WindowFrameNode;readonly compatibleGroup:number}
export interface ResolvedWindowDefinition {readonly name:string;readonly partitionBy:readonly ExprNode[];readonly orderBy:readonly ExprNode[];readonly frame:WindowFrameNode}
export interface ResolvedColumnUse {readonly expression:ExprReduction;readonly source:ResolvedSource;readonly columnIndex:number;readonly selectDepth:number;readonly mergedSources?:readonly ResolvedColumnRef[]|null}
export interface ResolvedSelect {readonly aliasUses?:ReadonlyMap<ExprReduction,ExprReduction>;readonly orderResultColumns:readonly (number|null)[];readonly source:SelectNode;readonly sources:readonly ResolvedSource[];readonly result:readonly ResolvedResult[];readonly correlated:boolean;readonly nested:readonly ResolvedSelect[];readonly columnUses:readonly ResolvedColumnUse[];readonly windowDefinitions:readonly ResolvedWindowDefinition[];readonly windows:readonly ResolvedWindow[];readonly multipleWindowPartitions:boolean}
/** Transient resolve.c NameContext frame; never attached to immutable schema AST. */
interface NameContext {readonly aliasUses?:Map<ExprReduction,ExprReduction>;readonly sources:readonly ResolvedSource[];readonly pNext:NameContext|null;readonly columnUses:ResolvedColumnUse[];nRef:number}
type ExprReduction=LemonValue<SqlToken>&{readonly kind:'reduction'};
export function expressionStructurallyEqual(left:ExprNode,right:ExprNode,sources:SelectNode['arms'][number]['from']['items'],ignoreTopLevelCollate=true):boolean{
 if(!left.reduction||!right.reduction)return false;
 const unwrap=(node:ExprReduction,collate=false):ExprReduction=>{
  let current=node,grouped=false;
  while(current.signature==='expr ::= LP expr RP'||!grouped&&collate&&current.signature.startsWith('expr ::= expr COLLATE')){
   if(current.signature==='expr ::= LP expr RP')grouped=true;
   const child=current.children.find((value):value is ExprReduction=>value.kind==='reduction'&&value.signature.startsWith('expr ::='));
   if(!child)break;
   current=child;
  }
  return current;
 };
 const leaf=(node:ExprReduction):string|null=>{
  const current=unwrap(node);
  if(current.signature==='expr ::= ID|INDEXED|JOIN_KW'){
   const token=current.children.find(value=>value.kind==='terminal');
   return token&&token.kind==='terminal'?identifier(token.value.text):null;
  }
  if(current.signature==='expr ::= nm DOT nm'||current.signature==='expr ::= nm DOT nm DOT nm'){
   const names=current.children.filter((value):value is ExprReduction=>value.kind==='reduction'&&value.signature.startsWith('nm ::='));
   const token=names.at(-1)?.children.find(value=>value.kind==='terminal');
   return token&&token.kind==='terminal'?identifier(token.value.text):null;
  }
  return null;
 };
 const compare=(a0:ExprReduction,b0:ExprReduction):boolean=>{
  const a=unwrap(a0,ignoreTopLevelCollate),b=unwrap(b0,ignoreTopLevelCollate),aLeaf=leaf(a),bLeaf=leaf(b);
  if(aLeaf!==null||bLeaf!==null){
   const resolvedBoolean=a.signature==='expr ::= nm DOT nm'||a.signature==='expr ::= nm DOT nm DOT nm'||b.signature==='expr ::= nm DOT nm'||b.signature==='expr ::= nm DOT nm DOT nm';
   const valid=(node:ExprReduction):boolean=>{if(node.signature==='expr ::= nm DOT nm'){const first=node.children.find((value):value is ExprReduction=>value.kind==='reduction'&&value.signature.startsWith('nm ::='));const token=first?.children.find(value=>value.kind==='terminal');return !!token&&token.kind==='terminal'&&sources.some(source=>sqliteIdentifierEqual(identifier(token.value.text),source.alias??source.tableName));}if(node.signature==='expr ::= nm DOT nm DOT nm'){const names=node.children.filter((value):value is ExprReduction=>value.kind==='reduction'&&value.signature.startsWith('nm ::='));const values=names.map(name=>name.children.find(value=>value.kind==='terminal')).filter((value):value is Extract<LemonValue<SqlToken>,{kind:'terminal'}>=>value?.kind==='terminal').map(value=>identifier(value.value.text));return sources.some(source=>sqliteIdentifierEqual(values[0]??'',source.databaseName??'main')&&sqliteIdentifierEqual(values[1]??'',source.alias??source.tableName));}return true;};
   if(!valid(a)||!valid(b))return false;
   if(aLeaf!==null&&bLeaf!==null){const boolean=['true','false'];if(!resolvedBoolean&&(boolean.includes(sqliteAsciiFold(aLeaf))||boolean.includes(sqliteAsciiFold(bLeaf)))){const at=a.children.find(value=>value.kind==='terminal'),bt=b.children.find(value=>value.kind==='terminal');return at?.kind==='terminal'&&bt?.kind==='terminal'&&at.value.text===bt.value.text;}return sqliteIdentifierEqual(aLeaf,bLeaf);}
   const literal=(node:ExprReduction):string|null=>{const token=node.children.length===1&&node.children[0]?.kind==='reduction'&&node.children[0].children.length===1&&node.children[0].children[0]?.kind==='terminal'?node.children[0].children[0].value:null;return token?.kind==='string'?token.text.slice(1,-1).replaceAll("''","'"):null;};
   return aLeaf!==null?aLeaf===literal(b):bLeaf===literal(a);
  }
  const nullTest=(node:ExprReduction):{operand:ExprReduction;negative:boolean}|null=>{
   if(node.signature==='expr ::= expr ISNULL|NOTNULL'||node.signature==='expr ::= expr NOT NULL'){const operand=node.children.find((value):value is ExprReduction=>value.kind==='reduction'&&value.signature.startsWith('expr ::='));const terminals=node.children.filter(value=>value.kind==='terminal');return operand&&terminals.length?{operand,negative:node.signature==='expr ::= expr NOT NULL'||terminals.some(value=>value.kind==='terminal'&&sqliteAsciiFold(value.value.text)==='notnull')}:null;}
   if(node.signature==='expr ::= expr IS expr'||node.signature==='expr ::= expr IS NOT expr'){const operands=node.children.filter((value):value is ExprReduction=>value.kind==='reduction'&&value.signature.startsWith('expr ::='));const rhs=operands[1];if(rhs&&rhs.children.some(value=>value.kind==='reduction'&&value.children.some(child=>child.kind==='terminal'&&sqliteAsciiFold(child.value.text)==='null')))return{operand:operands[0]!,negative:node.signature.includes(' IS NOT ')};}
   return null;
  };
  if((a.signature.startsWith('in_op ::=')&&b.signature.startsWith('in_op ::='))||(a.signature.startsWith('between_op ::=')&&b.signature.startsWith('between_op ::=')))return true;
  const an=nullTest(a),bn=nullTest(b);if(an||bn)return !!an&&!!bn&&an.negative===bn.negative&&compare(an.operand,bn.operand);
  const pattern=(node:ExprReduction):{negative:boolean;operator:string;operands:readonly ExprReduction[]}|null=>{let current=node,negative=false;if(current.signature==='expr ::= NOT expr'){negative=true;const child=current.children.find((value):value is ExprReduction=>value.kind==='reduction'&&value.signature.startsWith('expr ::='));if(!child)return null;current=unwrap(child);}if(!current.signature.startsWith('expr ::= expr likeop expr'))return null;const operands=current.children.filter((value):value is ExprReduction=>value.kind==='reduction'&&value.signature.startsWith('expr ::=')),like=current.children.find((value):value is ExprReduction=>value.kind==='reduction'&&value.signature.startsWith('likeop ::=')),words=like?.children.filter(value=>value.kind==='terminal').map(value=>value.kind==='terminal'?sqliteAsciiFold(value.value.text):'')??[];if(words[0]==='not'){negative=!negative;words.shift();}return operands.length>=2&&words[0]?{negative,operator:words[0],operands}:null;};
  const ap=pattern(a),bp=pattern(b);if(ap||bp)return !!ap&&!!bp&&ap.negative===bp.negative&&ap.operator===bp.operator&&ap.operands.length===bp.operands.length&&ap.operands.every((value,index)=>compare(value,bp.operands[index]!));
  const negated=(node:ExprReduction):{node:ExprReduction;negative:boolean}=>{if(node.signature==='expr ::= NOT expr'){const child=node.children.find((value):value is ExprReduction=>value.kind==='reduction'&&value.signature.startsWith('expr ::='));return child?{node:unwrap(child),negative:true}:{node,negative:false};}return{node,negative:false};};
  const aneg=negated(a),bneg=negated(b),predicate=(node:ExprReduction)=>node.children.some(value=>value.kind==='reduction'&&(value.signature==='in_op ::= NOT IN'||value.signature==='between_op ::= NOT BETWEEN'));
  const predicateSignature=(node:ExprReduction)=>node.signature;
  if(aneg.negative||bneg.negative||predicate(aneg.node)||predicate(bneg.node)){
   const av=aneg.negative!==predicate(aneg.node),bv=bneg.negative!==predicate(bneg.node),as=predicateSignature(aneg.node),bs=predicateSignature(bneg.node);
   if(as===bs&&av===bv){const ar=aneg.node.children.filter((value):value is ExprReduction=>value.kind==='reduction'),br=bneg.node.children.filter((value):value is ExprReduction=>value.kind==='reduction');return ar.length===br.length&&ar.every((value,index)=>compare(value,br[index]!));}
  }
  const equivalentIs=(node:ExprReduction):{operands:readonly ExprReduction[];operator:'is'|'isnot'}|null=>{const operands=node.children.filter((value):value is ExprReduction=>value.kind==='reduction'&&value.signature.startsWith('expr ::='));if(operands.length!==2)return null;if(node.signature==='expr ::= expr IS DISTINCT FROM expr'||node.signature==='expr ::= expr IS NOT expr')return{operands,operator:'isnot'};if(node.signature==='expr ::= expr IS NOT DISTINCT FROM expr'||node.signature==='expr ::= expr IS expr')return{operands,operator:'is'};return null;};
  const ai=equivalentIs(a),bi=equivalentIs(b);if(ai||bi)return !!ai&&!!bi&&ai.operator===bi.operator&&compare(ai.operands[0]!,bi.operands[0]!)&&compare(ai.operands[1]!,bi.operands[1]!);
  const signature=(value:string):string=>value;
  if(signature(a.signature)!==signature(b.signature)||a.children.length!==b.children.length)return false;
  return a.children.every((value,index)=>{
   const other=b.children[index]!;
   if(value.kind==='reduction'||other.kind==='reduction')return value.kind==='reduction'&&other.kind==='reduction'&&compare(value,other);
   if((a.signature.startsWith('typetoken ::=')||a.signature.startsWith('typename ::='))&&(b.signature.startsWith('typetoken ::=')||b.signature.startsWith('typename ::='))){const text=(node:ExprReduction)=>node.children.flatMap(value=>value.kind==='terminal'?[value.value.text]:value.kind==='reduction'?value.children.flatMap(child=>child.kind==='terminal'?[child.value.text]:[]):[]).join(' ');return text(a)===text(b);}
   const x=value.value,y=other.value;
   if(x.kind==='variable'||y.kind==='variable')return x.kind==='variable'&&y.kind==='variable'&&x.text!=='?'&&x.text===y.text;
   if(x.kind==='integer'&&y.kind==='integer'){
    const xv=BigInt(x.text.replaceAll('_','')),yv=BigInt(y.text.replaceAll('_','')),max=9223372036854775807n;
    return xv<=max&&yv<=max?xv===yv:x.text===y.text;
   }
   if(['true','false'].includes(sqliteAsciiFold(x.text))||['true','false'].includes(sqliteAsciiFold(y.text)))return x.kind===y.kind&&x.text===y.text;
   if(x.kind==='id'&&y.kind==='id')return sqliteIdentifierEqual(identifier(x.text),identifier(y.text));
   const stringValue=(token:SqlToken):string|null=>token.kind==='string'?token.text.slice(1,-1).replaceAll("''","'"):token.text.startsWith('"')&&token.text.endsWith('"')?identifier(token.text):null;
   const xs=stringValue(x),ys=stringValue(y);if(xs!==null&&ys!==null)return xs===ys;
   if(x.kind==='blob'||y.kind==='blob'||x.kind==='float'||y.kind==='float')return x.kind===y.kind&&x.text===y.text;
   const operator=(text:string)=>text==='!='||text==='<>'?'!=':text==='=='||text==='='?'=':sqliteAsciiFold(text);
   return x.kind===y.kind&&operator(x.text)===operator(y.text);
  });
 };
 return compare(left.reduction as ExprReduction,right.reduction as ExprReduction);
}
function groupByInteger(expression:ExprNode):bigint|null{
 const visit=(node:import('./lemon-runtime.ts').LemonValue<import('./tokenize.ts').SqlToken>):bigint|null=>{
  if(node.kind!=='reduction')return null;
  if(node.signature.startsWith('expr ::= LP expr RP')||node.signature.startsWith('expr ::= expr COLLATE ')){
   const nested=node.children.find(child=>child.kind==='reduction'&&child.signature.startsWith('expr ::='));return nested?visit(nested):null;
  }
  if(node.signature==='expr ::= term'){const term=node.children[0];return term?visit(term):null;}
  if(node.signature==='term ::= INTEGER'){const token=node.children.find(child=>child.kind==='terminal')?.value;return token?.kind==='integer'?BigInt(token.text):null;}
  if(node.signature==='expr ::= PLUS|MINUS expr'){
   const sign=node.children.find(child=>child.kind==='terminal')?.value?.text,nested=node.children.find(child=>child.kind==='reduction'&&child.signature.startsWith('expr ::=')),value=nested?visit(nested):null;return value===null?null:sign==='-'?-value:value;
  }
  return null;
 };
 return expression.reduction?visit(expression.reduction):null;
}
function bareName(expression:ExprNode):string|null{
 const visit=(node:import('./lemon-runtime.ts').LemonValue<import('./tokenize.ts').SqlToken>):string|null=>{
  if(node.kind!=='reduction')return null;
  if(node.signature.startsWith('expr ::= LP expr RP')){const nested=node.children.find(child=>child.kind==='reduction'&&child.signature.startsWith('expr ::='));return nested?visit(nested):null;}
  if(node.signature==='expr ::= ID|INDEXED|JOIN_KW'){const token=node.children.find(child=>child.kind==='terminal')?.value;return token?identifier(token.text):null;}
  return null;
 };
 return expression.reduction?visit(expression.reduction):null;
}
function collatedBareName(expression:ExprNode):string|null{
 let collated=false;
 const visit=(node:import('./lemon-runtime.ts').LemonValue<import('./tokenize.ts').SqlToken>):string|null=>{
  if(node.kind!=='reduction')return null;
  if(node.signature.startsWith('expr ::= LP expr RP')||node.signature.startsWith('expr ::= expr COLLATE ')||node.signature==='expr ::= PLUS|MINUS expr'){if(node.signature.includes('COLLATE'))collated=true;const nested=node.children.find(child=>child.kind==='reduction'&&child.signature.startsWith('expr ::='));return nested?visit(nested):null;}
  if(node.signature==='expr ::= ID|INDEXED|JOIN_KW'){const token=node.children.find(child=>child.kind==='terminal')?.value;return token?identifier(token.text):null;}
  return null;
 };
 const name=expression.reduction?visit(expression.reduction):null;return collated?name:null;
}
function firstAggregateName(expression:ExprNode):string|null{
 const aggregates=new Set(['avg','count','group_concat','max','min','sum','total','string_agg','json_group_array','jsonb_group_array','json_group_object','jsonb_group_object','median','percentile','percentile_cont','percentile_disc']);
 const visit=(node:import('./lemon-runtime.ts').LemonValue<import('./tokenize.ts').SqlToken>):string|null=>{
  if(node.kind!=='reduction')return null;
  if(node.signature.startsWith('expr ::= ID|INDEXED|JOIN_KW LP')){const token=node.children.find(child=>child.kind==='terminal')?.value;if(token&&aggregates.has(sqliteAsciiFold(identifier(token.text))))return identifier(token.text);}
  for(const child of node.children){const found=visit(child);if(found)return found;}return null;
 };
 return expression.reduction?visit(expression.reduction):null;
}
function firstWindowName(expression:ExprNode):string|null{
 const visit=(node:import('./lemon-runtime.ts').LemonValue<import('./tokenize.ts').SqlToken>):string|null=>{
  if(node.kind!=='reduction')return null;
  if(node.signature.startsWith('expr ::= ID|INDEXED|JOIN_KW LP')&&node.children.some(child=>child.kind==='reduction'&&child.signature.startsWith('filter_over ::=')&&child.children.some(part=>part.kind==='reduction'&&part.signature.startsWith('over_clause ::=')))){const token=node.children.find(child=>child.kind==='terminal'&&child.value);return token?.kind==='terminal'&&token.value?identifier(token.value.text):null;}
  for(const child of node.children){const found=visit(child);if(found)return found;}return null;
 };
 return expression.reduction?visit(expression.reduction):null;
}
function functionArgumentCount(node:import('./lemon-runtime.ts').LemonValue<import('./tokenize.ts').SqlToken>):number|null{
 if(node.kind!=='reduction'||!node.signature.startsWith('expr ::= ID|INDEXED|JOIN_KW LP'))return null;
 if(node.signature.includes(' STAR RP'))return 0;
 const list=node.children.find(child=>child.kind==='reduction'&&child.signature.startsWith('exprlist ::='));
 if(!list)return null;
 const count=(part:import('./lemon-runtime.ts').LemonValue<import('./tokenize.ts').SqlToken>):number=>part.kind==='reduction'&&part.signature==='nexprlist ::= nexprlist COMMA expr'?count(part.children[0]!)+1:part.kind==='reduction'&&part.signature==='nexprlist ::= expr'?1:part.kind==='reduction'?Math.max(0,...part.children.map(count)):0;
 return count(list);
}
function hasAggregate(expression:ExprNode):boolean{
 const aggregates=new Set(['avg','count','group_concat','max','min','sum','total','string_agg','json_group_array','jsonb_group_array','json_group_object','jsonb_group_object','median','percentile','percentile_cont','percentile_disc']);
 const visit=(node:import('./lemon-runtime.ts').LemonValue<import('./tokenize.ts').SqlToken>):boolean=>{
  if(node.kind!=='reduction')return false;
  if(node.signature.startsWith('expr ::= ID|INDEXED|JOIN_KW LP')){
   const name=node.children.find(child=>child.kind==='terminal')?.value?.text;
   if(name&&aggregates.has(sqliteAsciiFold(identifier(name)))){
    // resolve.c does not classify the aggregate-function owner of a window
    // expression as an ordinary aggregate. Its arguments can still contain one.
    const filterOver=node.children.find(child=>child.kind==='reduction'&&child.signature.startsWith('filter_over ::='));
    if(filterOver?.kind==='reduction'&&filterOver.children.some(child=>child.kind==='reduction'&&child.signature.startsWith('over_clause ::=')))return node.children.filter(child=>child!==filterOver).some(visit);
    if((sqliteIdentifierEqual(name,'min')||sqliteIdentifierEqual(name,'max'))){
     const exprList=node.children.find(child=>child.kind==='reduction'&&child.signature.startsWith('exprlist ::='));
     const count=(part:import('./lemon-runtime.ts').LemonValue<import('./tokenize.ts').SqlToken>):number=>part.kind==='reduction'&&part.signature==='nexprlist ::= nexprlist COMMA expr'?count(part.children[0]!)+1:part.kind==='reduction'&&part.signature==='nexprlist ::= expr'?1:part.kind==='reduction'?Math.max(0,...part.children.map(count)):0;
     if(exprList&&count(exprList)!==1)return false;
    }
    return true;
   }
  }
  return node.children.some(visit);
 };
 return expression.reduction?visit(expression.reduction):false;
}
function identifier(text:string):string{if(text[0]==='['&&text.at(-1)===']')return text.slice(1,-1);if((text[0]==='"'||text[0]==='`')&&text.at(-1)===text[0])return text.slice(1,-1).replaceAll(text[0]+text[0],text[0]);return text;}
function integerPrimaryKeyIndex(table:TableNode):number{
 if(table.withoutRowid||table.primaryKey.length!==1)return -1;
 const column=table.primaryKey[0]!;
 return column.declaredType?.trim().toUpperCase()==='INTEGER'?table.columns.indexOf(column):-1;
}
function direct(expression:ExprNode,sources:readonly ResolvedSource[]):{resolved:ResolvedColumnRef;mergedSources:readonly ResolvedColumnRef[]|null}|null{
 let expressionTokens=[...expression.tokens];
 let reduction=expression.reduction;
 while(reduction?.kind==='reduction'&&(reduction.signature.startsWith('expr ::= LP expr RP')||reduction.signature.startsWith('expr ::= expr COLLATE '))){const nested=reduction.children.find(child=>child.kind==='reduction'&&child.signature.startsWith('expr ::='));if(!nested||nested.kind!=='reduction')break;reduction=nested;expressionTokens=[];const collect=(node:import('./lemon-runtime.ts').LemonValue<import('./tokenize.ts').SqlToken>):void=>{if(node.kind==='terminal'){if(node.value)expressionTokens.push(node.value);return;}node.children.forEach(collect);};collect(nested);}
 while(!expression.reduction&&expressionTokens.length>=3&&expressionTokens[0]!.text==='('&&expressionTokens.at(-1)!.text===')')expressionTokens=expressionTokens.slice(1,-1);
 if(expressionTokens.length===1&&['string','integer','float','blob','variable'].includes(expressionTokens[0]!.kind)||expressionTokens.length===1&&expressionTokens[0]!.kind==='keyword'&&sqliteAsciiFold(expressionTokens[0]!.text)==='null')return null;
 const words=expressionTokens.map(t=>t.text);let database:string|null=null,qualifier:string|null=null,name:string;if(words.length===1)name=identifier(words[0]!);else if(words.length===3&&words[1]==='.') {qualifier=identifier(words[0]!);name=identifier(words[2]!);}else if(words.length===5&&words[1]==='.'&&words[3]==='.') {database=identifier(words[0]!);qualifier=identifier(words[2]!);name=identifier(words[4]!);}else return null;
 const eligible=qualifier===null?sources:sources.filter(s=>sqliteIdentifierEqual(s.alias??s.tableName,qualifier!)&&(!database||(!s.alias&&sqliteIdentifierEqual(s.databaseName??'main',database))));let found:{source:ResolvedSource;columnIndex:number;name:string}[]=[];const rowidCandidates:{source:ResolvedSource;columnIndex:number;name:string}[]=[];
 for(const source of eligible){const at=source.table.columns.findIndex(c=>sqliteIdentifierEqual(c.name,name));if(at>=0)found.push({source,columnIndex:at===integerPrimaryKeyIndex(source.table)?-1:at,name:source.table.columns[at]!.name});else if(!source.table.withoutRowid&&!source.table.noVisibleRowid&&['rowid','_rowid_','oid'].some(x=>sqliteIdentifierEqual(x,name))&&!source.table.columns.some(c=>sqliteIdentifierEqual(c.name,name)))rowidCandidates.push({source,columnIndex:-1,name});}
 // resolve.c:lookupName retains rowid candidates only when no real column
 // matched anywhere in the current NameContext.
 if(found.length===0)found=rowidCandidates;
 // lookupName/tableAndColumnIndex: an unqualified USING name denotes one
 // merged column. RIGHT selects the RHS; INNER/LEFT retain the left-most.
 let mergedSources:readonly ResolvedColumnRef[]|null=null;
 if(qualifier===null)for(let i=1;i<sources.length;i++){const rhs=sources[i]!;if(!rhs.using?.some(x=>sqliteIdentifierEqual(x,name)))continue;const members=found.filter(x=>sources.indexOf(x.source)<=i);if(members.length>1){if(rhs.joinFromLeft.left&&rhs.joinFromLeft.right){mergedSources=Object.freeze(members);found=[members[0]!,...found.filter(x=>sources.indexOf(x.source)>i)];}else found=[...(rhs.joinFromLeft.right?[members.at(-1)!]:[members[0]!]),...found.filter(x=>sources.indexOf(x.source)>i)];}}
 const display=database?`${database}.${qualifier}.${name}`:qualifier===null?name:`${qualifier}.${name}`;if(found.length>1)throw new NameResolutionError(`ambiguous column name: ${display}`);if(!found.length){if(qualifier===null&&expressionTokens.length===1&&['current_date','current_time','current_timestamp'].includes(sqliteAsciiFold(expressionTokens[0]!.text)))return null;if(qualifier===null&&expressionTokens.length===1&&(expressionTokens[0]!.text.startsWith('"')&&expressionTokens[0]!.text.endsWith('"')||['true','false'].includes(sqliteAsciiFold(expressionTokens[0]!.text))))return null;throw new NameResolutionError(`no such column: ${display}`);}return {resolved:found[0]!,mergedSources};
}
/** resolve.c:lookupName: ambiguity at an inner level is final; only a true
 * miss advances through NameContext.pNext. The originating frame records an
 * outer reference so lowering can distinguish correlated nested SELECTs. */
function lookupName(expression:ExprNode,context:NameContext,owner:NameContext=context,reduction?:ExprReduction):{resolved:ResolvedColumnRef;mergedSources:readonly ResolvedColumnRef[]|null}|null{
 let frame:NameContext|null=context,depth=0;
 while(frame){
  try{const match=direct(expression,frame.sources);if(match){if(depth>0)owner.nRef++;if(reduction){
    // resolveExprStep resolves TK_ID below TK_COLLATE/parentheses. direct()
    // unwraps these for lookup, so publish that same leaf identity for linked
    // lowering as well as the wrapper used by result metadata consumers.
    let leaf=reduction;
    while(leaf.signature==='expr ::= LP expr RP'||leaf.signature.startsWith('expr ::= expr COLLATE ')){
     const child=leaf.children.find((part):part is ExprReduction=>part.kind==='reduction'&&part.signature.startsWith('expr ::='));
     if(!child)break;leaf=child;
    }
    const use={source:match.resolved.source,columnIndex:match.resolved.columnIndex,selectDepth:depth,mergedSources:match.mergedSources};
    owner.columnUses.push(Object.freeze({expression:reduction,...use}));
    if(leaf!==reduction)owner.columnUses.push(Object.freeze({expression:leaf,...use}));
   }return match;}}
  catch(error){if(!(error instanceof NameResolutionError)||!error.message.startsWith('no such column: '))throw error;}
  frame=frame.pNext;depth++;
 }
 // Re-run the innermost lookup to retain its exact missing-name spelling.
 return direct(expression,context.sources);
}
function descriptor(name:string,resolved:ResolvedColumnRef|null):ResultColumnDescriptor{if(!resolved)return Object.freeze({name,declaredType:null,database:null,table:null,origin:null,affinity:null,collation:'BINARY'});const producer=transientProducerPlans.get(resolved.source.table);
 if(producer){const child=producer.result[resolved.columnIndex]?.descriptor;return Object.freeze({name,declaredType:child?.declaredType??null,database:child?.database??null,table:child?.table??null,origin:child?.origin??null,affinity:resolved.source.table.columns[resolved.columnIndex]?.affinity??null,collation:resolved.source.table.columns[resolved.columnIndex]?.collation??'BINARY'});}
 const c=resolved.columnIndex<0?resolved.source.table.columns.find(column=>sqliteIdentifierEqual(column.name,resolved.name)):resolved.source.table.columns[resolved.columnIndex];if(!c){
 // select.c:columnTypeImpl maps a real table's implicit TK_COLUMN rowid
 // (iColumn<0 and no INTEGER PRIMARY KEY alias) to INTEGER metadata whose
 // physical origin is the canonical "rowid", regardless of the SQL alias
 // spelling (_rowid_ or oid). Keep database/table provenance as for columns.
 return Object.freeze({name,declaredType:'INTEGER',database:'main',table:resolved.source.table.name,origin:'rowid',affinity:'integer',collation:'BINARY'});
}return Object.freeze({name,declaredType:c.declaredType,database:'main',table:resolved.source.table.name,origin:c.name,affinity:c.affinity,collation:c.collation??'BINARY'});}
function mergedDescriptor(name:string,sources:readonly ResolvedColumnRef[]):ResultColumnDescriptor{const first=sources[0],column=first&&first.columnIndex>=0?first.source.table.columns[first.columnIndex]:null;return Object.freeze({name,declaredType:null,database:null,table:null,origin:null,affinity:column?.affinity??(first?'integer':null),collation:column?.collation??'BINARY'});}
function result(expression:ExprNode,resolved:ResolvedColumnRef|null,name:string,mergedSources:readonly ResolvedColumnRef[]|null=null):ResolvedResult{let resultDescriptor=mergedSources?mergedDescriptor(name,mergedSources):descriptor(name,resolved);if(resolved){const collateAt=expression.tokens.map(token=>token.text.toUpperCase()).lastIndexOf('COLLATE');if(collateAt>=0&&expression.tokens[collateAt+1]){const explicit=identifier(expression.tokens[collateAt+1]!.text),supported=['binary','nocase','rtrim'].find(name=>sqliteIdentifierEqual(name,explicit));if(!supported)throw new NameResolutionError(`no such collation sequence: ${explicit}`);resultDescriptor=Object.freeze({...resultDescriptor,collation:supported});}}return Object.freeze({name,expression,source:mergedSources?null:resolved?.source??null,columnIndex:mergedSources?null:resolved?.columnIndex??null,mergedSources:mergedSources?Object.freeze([...mergedSources]):null,resolution:mergedSources?'coalesce':resolved?'direct':'expression',descriptor:resultDescriptor});}
function resolveAgainstSources(expression:ExprNode,sources:readonly ResolvedSource[],aliases:readonly ExprNode[]=[],rejectAliasAggregate=false,rejectAggregateFunctions=false,rejectWindowFunctions=false,selectWindowNames:readonly string[]=[],windowDefinitions:readonly WindowDefinitionNode[]=[],context:NameContext={sources,pNext:null,columnUses:[],nRef:0},resolveNested?:(select:SelectNode)=>void):void{
 const tokens=(node:import('./lemon-runtime.ts').LemonValue<import('./tokenize.ts').SqlToken>):import('./tokenize.ts').SqlToken[]=>node.kind==='terminal'?(node.value?[node.value]:[]):node.children.flatMap(tokens);
 const walk=(node:import('./lemon-runtime.ts').LemonValue<import('./tokenize.ts').SqlToken>):void=>{
  if(node.kind==='terminal')return;
  // A generated scalar SELECT owns a new NameContext. Never resolve its leaves
  // in the parent frame (resolveSelectStep descends with pNext instead).
  if(node.signature==='expr ::= LP select RP'||node.signature==='expr ::= EXISTS LP select RP'||node.signature==='expr ::= expr in_op LP select RP'){
   // resolveExprStep resolves the left operand of TK_IN in the current
   // NameContext before descending into the SELECT's child NameContext.
   if(node.signature==='expr ::= expr in_op LP select RP'){
    const left=node.children.find((child):child is ExprReduction=>child.kind==='reduction'&&child.signature.startsWith('expr ::='));
    if(left)walk(left);
   }
   const selectReduction=node.children.find((child):child is ExprReduction=>child.kind==='reduction'&&child.signature.startsWith('select ::='));
   const nested=selectReduction?.semantic;
   if(nested&&typeof nested==='object'&&'kind' in nested&&nested.kind==='select')resolveNested?.(nested as SelectNode);
   return;
  }
  // resolve.c walks only Window.pPartition and Window.pOrderBy here. Frame
  // boundary expressions are validated later by window lowering, not NameContext.
  if(node.signature.startsWith('frame_bound'))return;
  if(node.signature.startsWith('expr ::= ID|INDEXED|JOIN_KW LP')){
   const filterOver=node.children.find(child=>child.kind==='reduction'&&child.signature.startsWith('filter_over ::='));
   const filter=filterOver?.kind==='reduction'?filterOver.children.find(child=>child.kind==='reduction'&&child.signature.startsWith('filter_clause ::=')):undefined;
   const over=filterOver?.kind==='reduction'?filterOver.children.find(child=>child.kind==='reduction'&&child.signature.startsWith('over_clause ::=')):undefined;
   const ownerChild=node.children.find(child=>child.kind==='terminal'&&child.value);
   const ownerToken=ownerChild?.kind==='terminal'?ownerChild.value:undefined;
   const ownerName=ownerToken?sqliteAsciiFold(identifier(ownerToken.text)):'';
   const ownerCount=functionArgumentCount(node);
   const ownerDistinct=node.children.some(child=>child.kind==='reduction'&&child.signature==='distinct ::= DISTINCT');
   if(over?.kind==='reduction'&&over.signature==='over_clause ::= OVER LP window RP'){
    const findReduction=(part:import('./lemon-runtime.ts').LemonValue<import('./tokenize.ts').SqlToken>,prefix:string):import('./lemon-runtime.ts').LemonValue<import('./tokenize.ts').SqlToken>|undefined=>part.kind==='reduction'&&part.signature.startsWith(prefix)?part:part.kind==='reduction'?part.children.map(child=>findReduction(child,prefix)).find(Boolean):undefined;
    const window=findReduction(over,'window ::='),baseToken=window?.kind==='reduction'&&window.signature.startsWith('window ::= nm')?tokens(window)[0]:undefined;
    if(baseToken){const baseName=identifier(baseToken.text),base=[...windowDefinitions].reverse().find(candidate=>sqliteIdentifierEqual(candidate.name,baseName));if(!base)throw new NameResolutionError(`no such window: ${baseName}`);const hasPartition=window?.kind==='reduction'&&window.signature.includes(' PARTITION BY '),hasOrder=window?.kind==='reduction'&&window.signature.includes(' ORDER BY ');if(hasPartition)throw new NameResolutionError(`cannot override PARTITION clause of window: ${baseName}`);if(base.orderBy.length&&hasOrder)throw new NameResolutionError(`cannot override ORDER BY clause of window: ${baseName}`);if(base.hasFrame)throw new NameResolutionError(`cannot override frame specification of window: ${baseName}`);}
    const frame=findReduction(over,'frame_opt ::=');
    if(frame?.kind==='reduction'&&frame.signature.startsWith('frame_opt ::= range_or_rows BETWEEN')){const bounds=frame.children.filter(child=>child.kind==='reduction'&&(child.signature.startsWith('frame_bound_s ::=')||child.signature.startsWith('frame_bound_e ::='))),words=bounds.map(bound=>tokens(bound).map(item=>item.text.toUpperCase()));const start=words[0]??[],end=words[1]??[];if((start.includes('CURRENT')&&end.includes('PRECEDING'))||(start.includes('FOLLOWING')&&(end.includes('PRECEDING')||end.includes('CURRENT'))))throw new NameResolutionError('unsupported frame specification');}
    const range=frame&&tokens(frame).some(item=>item.text.toUpperCase()==='RANGE'),offset=frame&&findReduction(frame,'frame_bound ::= expr PRECEDING|FOLLOWING');
    if(range&&offset){const sort=findReduction(over,'sortlist ::='),countSort=(part:import('./lemon-runtime.ts').LemonValue<import('./tokenize.ts').SqlToken>):number=>part.kind==='reduction'&&part.signature.startsWith('sortlist ::= sortlist COMMA')?countSort(part.children[0]!)+1:1;if(!sort||countSort(sort)!==1)throw new NameResolutionError('RANGE with offset PRECEDING/FOLLOWING requires one ORDER BY expression');}
   }
   if(over?.kind==='reduction'&&over.signature==='over_clause ::= OVER nm'){const nameToken=tokens(over).at(-1),name=nameToken?identifier(nameToken.text):'';if(!selectWindowNames.some(candidate=>sqliteIdentifierEqual(candidate,name)))throw new NameResolutionError(`no such window: ${name}`);}
   if(over&&ownerDistinct)throw new NameResolutionError('DISTINCT is not supported for window functions');
   const ownerArityValid=ownerCount!==null?(['row_number','rank','dense_rank','percent_rank','cume_dist'].includes(ownerName)?ownerCount===0:ownerName==='ntile'?ownerCount===1:['lag','lead'].includes(ownerName)?ownerCount>=1&&ownerCount<=3:['first_value','last_value'].includes(ownerName)?ownerCount===1:ownerName==='nth_value'?ownerCount===2:true):true;
   if(filter&&over&&ownerToken&&ownerArityValid&&['row_number','rank','dense_rank','percent_rank','cume_dist','random','sqlite_version','changes','total_changes','last_insert_rowid','ntile','lag','lead','first_value','last_value','nth_value'].includes(ownerName)){const nested=firstWindowName({kind:'tokens',tokens:[],reduction:filter});if(nested)throw new NameResolutionError(`misuse of window function ${nested}()`);walk(filter);throw new NameResolutionError('FILTER clause may only be used with aggregate window functions');}
   node.children.filter(child=>child!==filterOver).forEach(walk);
   const token=node.children.find(child=>child.kind==='terminal')?.value,count=functionArgumentCount(node);
   if(token&&count!==null){const name=sqliteAsciiFold(identifier(token.text)),star=node.signature.includes(' STAR RP'),valid=name==='count'?count<=1:star?false:name==='group_concat'?count===1||count===2:name==='string_agg'?count===2:['avg','sum','total'].includes(name)?count===1:['min','max'].includes(name)?count>=1:name==='median'?count===1:['percentile','percentile_cont','percentile_disc'].includes(name)?count===2:['json_group_array','jsonb_group_array'].includes(name)?count===1:['json_group_object','jsonb_group_object','median','percentile','percentile_cont','percentile_disc'].includes(name)?count===2:['row_number','rank','dense_rank','percent_rank','cume_dist'].includes(name)?count===0:name==='ntile'?count===1:['lag','lead'].includes(name)?count>=1&&count<=3:['first_value','last_value'].includes(name)?count===1:name==='nth_value'?count===2:['abs','lower','upper','quote','zeroblob','randomblob','unistr','unistr_quote','hex','length','octet_length','typeof','subtype','unicode','json','jsonb','json_error_position','json_quote','json_parse','sqlite_compileoption_used','sqlite_compileoption_get','sqlite_offset','sign'].includes(name)?count===1:name==='nullif'||name==='replace'?count===2+(name==='replace'?1:0):name==='substr'?count===2||count===3:name==='coalesce'?count>=2:['likely','unlikely'].includes(name)?count===1:['ltrim','rtrim','trim','unhex','round','load_extension'].includes(name)?count===1||count===2:name==='like'?count===2||count===3:['glob','json_patch','jsonb_patch'].includes(name)?count===2:['json_array_length','json_pretty','json_type','json_valid'].includes(name)?count===1||count===2:['instr','ifnull','sqlite_log','timediff'].includes(name)?count===2:name==='substring'?count===2||count===3:name==='concat'?count>=0:name==='concat_ws'?count>=1:['iif','if'].includes(name)?count>=2:name==='likelihood'?count===2:['ceil','ceiling','floor','trunc','ln','log10','log2','exp','acos','asin','atan','cos','sin','tan','cosh','sinh','tanh','acosh','asinh','atanh','sqrt','radians','degrees'].includes(name)?count===1:['pow','power','mod','atan2'].includes(name)?count===2:name==='log'?count===1||count===2:['random','sqlite_version','sqlite_source_id','changes','total_changes','last_insert_rowid','pi'].includes(name)?count===0:true;if(!valid)throw new NameResolutionError(`wrong number of arguments to function ${identifier(token.text)}()`);const distinct=node.children.some(child=>child.kind==='reduction'&&child.signature==='distinct ::= DISTINCT'),aggregate=['avg','count','group_concat','string_agg','sum','total','json_group_array','jsonb_group_array','json_group_object','jsonb_group_object','median','percentile','percentile_cont','percentile_disc'].includes(name)||(['min','max'].includes(name)&&count===1);if(aggregate&&distinct&&count!==1)throw new NameResolutionError('DISTINCT aggregates must have exactly one argument');}
   // window.c:sqlite3WindowFunctions registers these with SQLITE_FUNC_WINDOW.
   // Unlike ordinary aggregates, they have no scalar form when OVER is absent.
   if(!over&&ownerToken&&ownerCount!==null&&['row_number','rank','dense_rank','percent_rank','cume_dist','ntile','lag','lead','first_value','last_value','nth_value'].includes(ownerName))throw new NameResolutionError(`misuse of window function ${identifier(ownerToken.text)}()`);
   if(rejectAggregateFunctions&&!over&&hasAggregate({kind:'tokens',tokens:[],reduction:node})&&token)throw new NameResolutionError(`misuse of aggregate function ${identifier(token.text)}()`);
   if(ownerName==='likelihood'&&ownerCount===2){let argumentList=node.children.find(child=>child.kind==='reduction'&&child.signature.startsWith('exprlist ::='));if(argumentList?.kind==='reduction'&&argumentList.signature==='exprlist ::= nexprlist')argumentList=argumentList.children[0];const allArguments:(typeof argumentList)[]=[];const collectArguments=(part:typeof argumentList):void=>{if(part?.kind!=='reduction')return;if(part.signature.includes('::= nexprlist COMMA')){collectArguments(part.children[0]);allArguments.push(part.children.at(-1));}else allArguments.push(part.children.find(child=>child.kind==='reduction'&&child.signature.startsWith('expr ::=')));};collectArguments(argumentList);const second=allArguments[1],literal=second?tokens(second).map(item=>item.text).join(''):'';let unwrapped=literal;while(unwrapped.startsWith('(')&&unwrapped.endsWith(')'))unwrapped=unwrapped.slice(1,-1);const probability=/^(?:\d+\.\d+|\.\d+|\d+(?:\.\d+)?[eE][+-]?\d+)$/.test(unwrapped)?Number(unwrapped):NaN;if(!Number.isFinite(probability)||probability<0||probability>1)throw new NameResolutionError('second argument to likelihood() must be a constant between 0.0 and 1.0');}
   if(token&&count!==null){const name=sqliteAsciiFold(identifier(token.text)),known=['avg','count','group_concat','string_agg','sum','total','min','max','abs','lower','upper','quote','zeroblob','randomblob','unistr','unistr_quote','hex','length','octet_length','typeof','unicode','nullif','replace','substr','coalesce','char','likely','unlikely','likelihood','random','sqlite_version','changes','total_changes','last_insert_rowid','ltrim','rtrim','trim','instr','printf','format','unhex','subtype','round','concat','concat_ws','ifnull','sqlite_source_id','sqlite_log','unistr','unistr_quote','substring','iif','if','date','time','datetime','julianday','unixepoch','strftime','timediff','like','glob','load_extension','json','jsonb','json_array','jsonb_array','json_array_length','json_error_position','json_patch','jsonb_patch','json_pretty','json_quote','json_type','json_valid','json_extract','jsonb_extract','json_insert','jsonb_insert','json_object','jsonb_object','json_remove','jsonb_remove','json_replace','jsonb_replace','json_set','jsonb_set','json_array_insert','jsonb_array_insert','json_parse','json_group_array','jsonb_group_array','json_group_object','jsonb_group_object','median','percentile','percentile_cont','percentile_disc','sqlite_compileoption_used','sqlite_compileoption_get','sign','ceil','ceiling','floor','trunc','ln','log','log10','log2','exp','pow','power','mod','acos','asin','atan','atan2','cos','sin','tan','cosh','sinh','tanh','acosh','asinh','atanh','sqrt','radians','degrees','pi','median','percentile','percentile_cont','percentile_disc','sqlite_offset','row_number','rank','dense_rank','percent_rank','cume_dist','ntile','lag','lead','first_value','last_value','nth_value'].includes(name);if(!known)throw new NameResolutionError(`no such function: ${identifier(token.text)}`);}
   if(token&&count!==null){const name=sqliteAsciiFold(identifier(token.text)),aggregate=['avg','count','group_concat','string_agg','sum','total','json_group_array','jsonb_group_array','json_group_object','jsonb_group_object','median','percentile','percentile_cont','percentile_disc'].includes(name)||(['min','max'].includes(name)&&count===1),argumentsNode=node.children.find(child=>child.kind==='reduction'&&child.signature.startsWith('exprlist ::='));const nested=aggregate&&argumentsNode?firstAggregateName({kind:'tokens',tokens:[],reduction:argumentsNode}):null;if(nested)throw new NameResolutionError(`misuse of aggregate function ${nested}()`);}
   if(over&&token&&rejectWindowFunctions)throw new NameResolutionError(`misuse of window function ${identifier(token.text)}()`);
   if(over&&token&&count!==null){const name=sqliteAsciiFold(identifier(token.text)),window=['row_number','rank','dense_rank','percent_rank','cume_dist','ntile','lag','lead','first_value','last_value','nth_value','avg','count','group_concat','string_agg','sum','total','min','max','json_group_array','jsonb_group_array','json_group_object','jsonb_group_object','median','percentile','percentile_cont','percentile_disc'].includes(name);if(!window)throw new NameResolutionError(`${identifier(token.text)}() may not be used as a window function`);}
   if(over&&firstWindowName({kind:'tokens',tokens:[],reduction:over}))throw new NameResolutionError(`misuse of window function ${firstWindowName({kind:'tokens',tokens:[],reduction:over})}()`);
   if(over)resolveAgainstSources({kind:'tokens',tokens:[],reduction:over},sources,[],false,false,rejectWindowFunctions,selectWindowNames,windowDefinitions,context,resolveNested);
   const argumentsNode=node.children.find(child=>child.kind==='reduction'&&child.signature.startsWith('exprlist ::='));
   if(argumentsNode&&firstWindowName({kind:'tokens',tokens:[],reduction:argumentsNode}))throw new NameResolutionError(`misuse of window function ${firstWindowName({kind:'tokens',tokens:[],reduction:argumentsNode})}()`);
   if(filter&&firstWindowName({kind:'tokens',tokens:[],reduction:filter}))throw new NameResolutionError(`misuse of window function ${firstWindowName({kind:'tokens',tokens:[],reduction:filter})}()`);
   if(filter)walk(filter);
   if(filter){const nested=firstAggregateName({kind:'tokens',tokens:[],reduction:filter});if(nested)throw new NameResolutionError(`misuse of aggregate function ${nested}()`);}
   if(filter&&token&&count!==null){const name=sqliteAsciiFold(identifier(token.text)),aggregate=['avg','count','group_concat','string_agg','sum','total','json_group_array','jsonb_group_array','json_group_object','jsonb_group_object','median','percentile','percentile_cont','percentile_disc'].includes(name)||(['min','max'].includes(name)&&count===1);if(over&&!aggregate)throw new NameResolutionError('FILTER clause may only be used with aggregate window functions');if(!over&&!aggregate)throw new NameResolutionError(`FILTER may not be used with non-aggregate ${identifier(token.text)}()`);}
   return;
  }
  if(node.signature.startsWith('expr ::= expr COLLATE ')){node.children.forEach(walk);const collationToken=tokens(node).at(-1);if(collationToken){const name=identifier(collationToken.text);if(!['binary','nocase','rtrim'].some(candidate=>sqliteIdentifierEqual(candidate,name)))throw new NameResolutionError(`no such collation sequence: ${name}`);}return;}
  if(node.signature.startsWith('expr ::= nm DOT nm DOT nm')){lookupName({kind:'tokens',tokens:tokens(node)},{sources,pNext:context.pNext,columnUses:context.columnUses,nRef:0},context,node);return;}
  if(node.signature.startsWith('expr ::= nm DOT nm')){lookupName({kind:'tokens',tokens:tokens(node)},{sources,pNext:context.pNext,columnUses:context.columnUses,nRef:0},context,node);return;}
  if(node.signature.startsWith('expr ::= ID')||node.signature.startsWith('expr ::= INDEXED')||node.signature.startsWith('expr ::= JOIN_KW')){const tokens=node.children.flatMap(child=>child.kind==='terminal'&&child.value?[child.value]:[]);if(tokens.length){try{lookupName({kind:'tokens',tokens},{sources,pNext:context.pNext,columnUses:context.columnUses,nRef:0},context,node);}catch(error){if(!(error instanceof NameResolutionError)||!error.message.startsWith('no such column: '))throw error;const name=identifier(tokens[0]!.text),matches=aliases.filter(item=>item.alias&&sqliteIdentifierEqual(item.alias,name));if(!matches[0])throw error;if(rejectAliasAggregate){const aggregate=firstAggregateName(matches[0]);if(aggregate)throw new NameResolutionError(`misuse of aggregate: ${aggregate}()`);}if(rejectWindowFunctions&&firstWindowName(matches[0]))throw new NameResolutionError(`misuse of aliased window function ${name}`);if(matches[0].reduction)context.aliasUses?.set(node,matches[0].reduction as ExprReduction);resolveAgainstSources(matches[0],sources,[],rejectAliasAggregate,rejectAggregateFunctions,rejectWindowFunctions,selectWindowNames,windowDefinitions,context,resolveNested);}return;}}
  node.children.forEach(walk);
 };
 if(expression.reduction)walk(expression.reduction);
}
const builtinWindowArity:Readonly<Record<string,readonly number[]>>=Object.freeze({row_number:[0],dense_rank:[0],rank:[0],percent_rank:[0],cume_dist:[0],ntile:[1],last_value:[1],nth_value:[2],first_value:[1],lead:[1,2,3],lag:[1,2,3]});
function bareBuiltinWindowName(expression:ExprNode):string|null{
 const visit=(node:import('./lemon-runtime.ts').LemonValue<import('./tokenize.ts').SqlToken>):string|null=>{
  if(node.kind!=='reduction')return null;
  if(node.signature.startsWith('expr ::= ID|INDEXED|JOIN_KW LP')){
   const terminal=node.children.find((child):child is Extract<typeof child,{kind:'terminal'}>=>child.kind==='terminal'&&!!child.value),token=terminal?.value,count=functionArgumentCount(node);
   if(token&&count!==null){const name=sqliteAsciiFold(identifier(token.text)),arities=builtinWindowArity[name],hasOver=node.children.some(child=>child.kind==='reduction'&&child.signature.startsWith('filter_over ::=')&&child.children.some(part=>part.kind==='reduction'&&part.signature.startsWith('over_clause ::=')));if(arities?.includes(count)&&!hasOver)return identifier(token.text);}
  }
  for(const child of node.children){const found=visit(child);if(found)return found;}return null;
 };
 return expression.reduction?visit(expression.reduction):null;
}
export function rejectBareBuiltinWindowFunctions(select:SelectNode):void{
 const expressions=[...select.result,...select.groupBy,...select.orderBy.map(term=>term.expr),...(select.where?[select.where]:[]),...(select.having?[select.having]:[]),...(select.limit?[select.limit]:[]),...(select.offset?[select.offset]:[])];
 for(const expression of expressions){const name=bareBuiltinWindowName(expression);if(name)throw new NameResolutionError(`misuse of window function ${name}()`);}
}
const aggregateWindowNames=new Set(['avg','count','group_concat','string_agg','sum','total','min','max','json_group_array','jsonb_group_array','json_group_object','jsonb_group_object','median','percentile','percentile_cont','percentile_disc']);
function resolvedWindowDefinitions(select:SelectNode):readonly ResolvedWindowDefinition[]{
 const out:ResolvedWindowDefinition[]=[];
 for(const definition of select.windowDefinitions){
  if(definition.frameError)throw new NameResolutionError(definition.frameError);
  let partitionBy=definition.partitionBy,orderBy=definition.orderBy;
  if(definition.baseName){
   const base=[...out].reverse().find(candidate=>sqliteIdentifierEqual(candidate.name,definition.baseName!));
   if(!base)throw new NameResolutionError(`no such window: ${definition.baseName}`);
   if(definition.partitionBy.length)throw new NameResolutionError(`cannot override PARTITION clause of window: ${definition.baseName}`);
   if(base.orderBy.length&&definition.orderBy.length)throw new NameResolutionError(`cannot override ORDER BY clause of window: ${definition.baseName}`);
   if(!base.frame.implicit)throw new NameResolutionError(`cannot override frame specification of window: ${definition.baseName}`);
   partitionBy=base.partitionBy;if(base.orderBy.length)orderBy=base.orderBy;
  }
  out.push(Object.freeze({name:definition.name,partitionBy:Object.freeze([...partitionBy]),orderBy:Object.freeze([...orderBy]),frame:definition.frame}));
 }
 return Object.freeze(out);
}
function frameForBuiltin(name:string,frame:WindowFrameNode):WindowFrameNode{
 const shape:Readonly<Record<string,readonly [WindowFrameNode['type'],WindowFrameNode['start']['kind'],WindowFrameNode['end']['kind']]>>={row_number:['rows','unbounded','current'],dense_rank:['range','unbounded','current'],rank:['range','unbounded','current'],percent_rank:['groups','current','unbounded'],cume_dist:['groups','following','unbounded'],ntile:['rows','current','unbounded'],lead:['rows','unbounded','unbounded'],lag:['rows','unbounded','current']};
 const coerced=shape[name];if(!coerced)return frame;
 return Object.freeze({type:coerced[0],start:Object.freeze({kind:coerced[1],expr:name==='cume_dist'?Object.freeze({kind:'tokens',tokens:Object.freeze([{kind:'integer',text:'1',startByte:0,endByte:1}])} as ExprNode):null}),end:Object.freeze({kind:coerced[2],expr:null}),exclusion:null,implicit:frame.implicit});
}
function collectResolvedWindows(select:SelectNode,definitions:readonly ResolvedWindowDefinition[]):{windows:readonly ResolvedWindow[];multiple:boolean}{
 const found:Omit<ResolvedWindow,'compatibleGroup'>[]=[];
 const reductions=(node:ExprReduction,prefix:string):ExprReduction|undefined=>{if(node.signature.startsWith(prefix))return node;for(const child of node.children)if(child.kind==='reduction'){const value=reductions(child,prefix);if(value)return value;}};
 const nodeTokens=(node:LemonValue<SqlToken>):SqlToken[]=>node.kind==='terminal'?(node.value?[node.value]:[]):node.children.flatMap(nodeTokens);
 const scan=(owner:ExprNode,node:LemonValue<SqlToken>):void=>{
  if(node.kind==='terminal')return;
  if(node.signature==='expr ::= LP select RP'||node.signature==='expr ::= EXISTS LP select RP'||node.signature==='expr ::= expr in_op LP select RP')return;
  if(node.signature.startsWith('expr ::= ID|INDEXED|JOIN_KW LP')){
   const filterOver=node.children.find(child=>child.kind==='reduction'&&child.signature.startsWith('filter_over ::='));
   const over=filterOver?.kind==='reduction'?filterOver.children.find(child=>child.kind==='reduction'&&child.signature.startsWith('over_clause ::=')):undefined;
   if(over?.kind==='reduction'){
    const terminal=node.children.find((child):child is Extract<LemonValue<SqlToken>,{kind:'terminal'}>=>child.kind==='terminal'&&!!child.value);const token=terminal?.value;if(!token)return;
    const functionName=sqliteAsciiFold(identifier(token.text)),argumentCount=functionArgumentCount(node)??0;
    const allowed=builtinWindowArity[functionName];if(allowed&&!allowed.includes(argumentCount))throw new NameResolutionError(`wrong number of arguments to function ${identifier(token.text)}()`);
    const filterReduction=filterOver?.kind==='reduction'?filterOver.children.find(child=>child.kind==='reduction'&&child.signature.startsWith('filter_clause ::=')):undefined;
    if(filterReduction&&allowed)throw new NameResolutionError('FILTER clause may only be used with aggregate window functions');
    let definitionName:string|null=null,partitionBy:readonly ExprNode[]=Object.freeze([]),orderBy:readonly ExprNode[]=Object.freeze([]),frame:WindowFrameNode;
    if(over.signature==='over_clause ::= OVER nm'){
     const nameToken=nodeTokens(over).at(-1)!;definitionName=identifier(nameToken.text);const definition=[...definitions].reverse().find(value=>sqliteIdentifierEqual(value.name,definitionName!));if(!definition)throw new NameResolutionError(`no such window: ${definitionName}`);({partitionBy,orderBy,frame}=definition);
    }else{
     const window=reductions(over,'window ::=');if(!window)throw new NameResolutionError('generated window semantic is missing');
     const base=window.signature.startsWith('window ::= nm')?identifier(nodeTokens(window)[0]!.text):null;
     const definition=base?[...definitions].reverse().find(value=>sqliteIdentifierEqual(value.name,base)):undefined;if(base&&!definition)throw new NameResolutionError(`no such window: ${base}`);
     const part=reductions(window,'nexprlist ::=');const order=reductions(window,'sortlist ::=');
     const ownPart=part?expressionListForResolve(part):Object.freeze([]),ownOrder=order?sortExpressionsForResolve(order):Object.freeze([]);
     if(definition){if(ownPart.length)throw new NameResolutionError(`cannot override PARTITION clause of window: ${base}`);if(definition.orderBy.length&&ownOrder.length)throw new NameResolutionError(`cannot override ORDER BY clause of window: ${base}`);if(!definition.frame.implicit)throw new NameResolutionError(`cannot override frame specification of window: ${base}`);partitionBy=definition.partitionBy;orderBy=definition.orderBy.length?definition.orderBy:ownOrder;}else{partitionBy=ownPart;orderBy=ownOrder;}
     frame=windowFrame(window);
    }
    frame=frameForBuiltin(functionName,frame!);
    if(frame.type==='range'&&(frame.start.expr||frame.end.expr)&&orderBy.length!==1)throw new NameResolutionError('RANGE with offset PRECEDING/FOLLOWING requires one ORDER BY expression');
    found.push({functionName,argumentCount,owner,filter:filterReduction?Object.freeze({kind:'tokens',tokens:Object.freeze(nodeTokens(filterReduction)),reduction:filterReduction}):null,definitionName,partitionBy,orderBy,frame});
   }
  }
  node.children.forEach(child=>scan(owner,child));
 };
 for(const owner of [...select.result,...select.orderBy.map(term=>term.expr),...(select.having?[select.having]:[])])if(owner.reduction)scan(owner,owner.reduction);
 const equalList=(a:readonly ExprNode[],b:readonly ExprNode[])=>a.length===b.length&&a.every((value,index)=>expressionStructurallyEqual(value,b[index]!,select.from.items,false));
 const groups:typeof found=[];let multiple=false;
 const windows=found.map(value=>{let compatibleGroup=groups.findIndex(group=>group.frame.type===value.frame.type&&group.frame.start.kind===value.frame.start.kind&&group.frame.end.kind===value.frame.end.kind&&group.frame.exclusion===value.frame.exclusion&&((!group.frame.start.expr&&!value.frame.start.expr)||(!!group.frame.start.expr&&!!value.frame.start.expr&&expressionStructurallyEqual(group.frame.start.expr,value.frame.start.expr,select.from.items)))&&((!group.frame.end.expr&&!value.frame.end.expr)||(!!group.frame.end.expr&&!!value.frame.end.expr&&expressionStructurallyEqual(group.frame.end.expr,value.frame.end.expr,select.from.items)))&&equalList(group.partitionBy,value.partitionBy)&&equalList(group.orderBy,value.orderBy));if(compatibleGroup<0){if(groups.length&& !equalList(groups[0]!.partitionBy,value.partitionBy))multiple=true;compatibleGroup=groups.length;groups.push(value);}return Object.freeze({...value,compatibleGroup});});
 return{windows:Object.freeze(windows),multiple};
}
function expressionListForResolve(node:LemonValue<SqlToken>):readonly ExprNode[]{const out:ExprNode[]=[];const walk=(part:LemonValue<SqlToken>):void=>{if(part.kind!=='reduction')return;for(const child of part.children)if(child.kind==='reduction'){if(child.signature.startsWith('nexprlist ::='))walk(child);else if(child.signature.startsWith('expr ::=')||child.signature.startsWith('term ::='))out.push(Object.freeze({kind:'tokens',tokens:Object.freeze(child.children.flatMap(function leaves(n):SqlToken[]{return n.kind==='terminal'?(n.value?[n.value]:[]):n.children.flatMap(leaves);})),reduction:child}));}};walk(node);return Object.freeze(out);}
function sortExpressionsForResolve(node:LemonValue<SqlToken>):readonly ExprNode[]{const items:ExprNode[]=[];const visit=(part:LemonValue<SqlToken>):void=>{if(part.kind!=='reduction')return;if(part.signature.startsWith('sortlist ::=')){const expression=part.children.find(child=>child.kind==='reduction'&&!child.signature.startsWith('sortlist ::=')&&!child.signature.startsWith('sortorder ::=')&&!child.signature.startsWith('nulls ::='));if(expression?.kind==='reduction'){const leaves=(n:LemonValue<SqlToken>):SqlToken[]=>n.kind==='terminal'?(n.value?[n.value]:[]):n.children.flatMap(leaves);items.push(Object.freeze({kind:'tokens',tokens:Object.freeze(leaves(expression)),reduction:expression}));}}for(const child of part.children)if(child.kind==='reduction'&&child.signature.startsWith('sortlist ::='))visit(child);};visit(node);return Object.freeze(items.sort((a,b)=>(a.tokens[0]?.startByte??0)-(b.tokens[0]?.startByte??0)));}

/** Bounded ports of select.c:selectExpander and resolve.c:lookupName for ordinary tables. */
export function expandAndResolveSelect(select:SelectNode,schema:ResolutionSchema,outer:NameContext|null=null,cursorBase=0,transientTables:ReadonlyMap<number,TableNode>=new Map()):ResolvedSelect{
 const bound=select.from.items.map((item,cursorOffset)=>{const cursorId=cursorBase+cursorOffset;if(item.databaseName&&!sqliteIdentifierEqual(item.databaseName,'main'))throw new NameResolutionError(`no such table: ${item.databaseName}.${item.tableName}`);const table=transientTables.get(cursorOffset)??schema.tables.get(sqliteAsciiFold(item.tableName));if(!table)throw new NameResolutionError(`no such table: ${item.databaseName?`${item.databaseName}.`:''}${item.tableName}`);if(item.indexedBy!==null&&!table.indexes.some(index=>sqliteIdentifierEqual(index.name,item.indexedBy!)))throw new NameResolutionError(`no such index: ${item.indexedBy}`);return {...item,cursorId,table} as ResolvedSource;});
 for(let i=1;i<bound.length;i++){const source=bound[i]!,left=bound.slice(0,i);if(source.joinFromLeft.natural){if(source.on||source.using)throw new NameResolutionError('a NATURAL join may not have an ON or USING clause');(source as unknown as {using:readonly string[]}).using=Object.freeze(source.table.columns.filter(column=>left.some(candidate=>candidate.table.columns.some(c=>sqliteIdentifierEqual(c.name,column.name)))).map(column=>column.name));}if(source.using)for(const name of source.using){if(!source.table.columns.some(c=>sqliteIdentifierEqual(c.name,name))||!left.some(candidate=>candidate.table.columns.some(c=>sqliteIdentifierEqual(c.name,name))))throw new NameResolutionError(`cannot join using column ${name} - column not present in both tables`);try{direct({kind:'tokens',tokens:Object.freeze([{kind:'id',text:name,startByte:0,endByte:name.length}])},left);}catch(error){if(error instanceof NameResolutionError&&error.message.startsWith('ambiguous column name:'))throw new NameResolutionError(`ambiguous reference to ${name} in USING()`);throw error;}}}
 const sources=Object.freeze(bound.map(source=>Object.freeze(source)));
 const columnUses:ResolvedColumnUse[]=[];
 const context:NameContext={sources,pNext:outer,columnUses,aliasUses:new Map(),nRef:0},nested:ResolvedSelect[]=[];
 let nextCursor=cursorBase+sources.length;
 const lastCursor=(resolved:ResolvedSelect):number=>Math.max(-1,...resolved.sources.map(source=>source.cursorId),...resolved.nested.map(lastCursor));
 const seenNested=new Set<SelectNode>();
 const resolveNested=(child:SelectNode):void=>{if(seenNested.has(child))return;seenNested.add(child);if(child.result.length!==1)throw new NameResolutionError(`sub-select returns ${child.result.length} columns - expected 1`);// select.c:selectExpander installs a derived SrcItem's transient columns
 // before resolveSelectStep walks the linked child/parent NameContexts. The
 // storage cursor is supplied later by the derived producer, not schema lookup.
 const derived=child.from.derived;
 const childBindings=new Map<number,TableNode>();
 if(derived&&derived.index===0&&child.from.items.length===1&&derived.select.hasCompound){
  const first=derived.select.arms[0];
  if(first&&first.result.length&&derived.select.arms.every(arm=>arm.result.length===first.result.length)){
   // select.c:sqlite3ColumnsFromExprList resolves TK_COLUMN before naming
   // a transient Table. Qualified token text is not its column name.
   const armPlans=derived.select.arms.map(arm=>expandAndResolveSelect({...derived.select,result:arm.result,from:arm.from,where:arm.where,arms:Object.freeze([arm]),hasCompound:false,hasOrderBy:false,orderBy:Object.freeze([])} as SelectNode,schema,null,nextCursor));
   const firstResolved=armPlans[0]!;
   const names=transientColumnNames(firstResolved.result.map(item=>item.name));
   const columns=names.map((name,index)=>({name,declaredType:transientDeclaredType(resolvedExpressionDeclaredType(firstResolved.result[index]!.expression.reduction!,firstResolved),resolvedCompoundAffinity(armPlans,index)),affinity:resolvedCompoundAffinity(armPlans,index),collation:resolvedExpressionCollation(firstResolved.result[index]!.expression.reduction!,firstResolved)??'binary',primaryKeyPosition:null} as ColumnNode));
   const name=child.from.items[0]!.tableName;
   const table={kind:'table',name,tableName:name,rootPage:0,columns,indexes:[],withoutRowid:false,noVisibleRowid:true,primaryKey:[],primaryKeyTerms:[],storageKey:[],checks:[],foreignKeys:[],referencedBy:[],sql:''} as TableNode;
   bindTransientProducer(table,armPlans.at(-1)!);
   childBindings.set(derived.index,table);
  }
 }
 const resolved=expandAndResolveSelect(child,schema,context,nextCursor,childBindings);nested.push(resolved);nextCursor=Math.max(nextCursor,lastCursor(resolved)+1);};
 const output:ResolvedResult[]=[];
 const windowDefinitions=resolvedWindowDefinitions(select);
 for(let i=0;i<select.windowDefinitions.length;i++){const definition=select.windowDefinitions[i]!;if(definition.frameError)throw new NameResolutionError(definition.frameError);if(definition.baseName){let base:typeof definition|undefined;for(let j=i-1;j>=0;j--){const candidate=select.windowDefinitions[j]!;if(sqliteIdentifierEqual(candidate.name,definition.baseName)){base=candidate;break;}}if(base){if(base.hasFrame)throw new NameResolutionError(`cannot override frame specification of window: ${definition.baseName}`);if(base.partitionBy.length&&definition.partitionBy.length)throw new NameResolutionError(`cannot override PARTITION clause of window: ${definition.baseName}`);if(base.orderBy.length&&definition.orderBy.length)throw new NameResolutionError(`cannot override ORDER BY clause of window: ${definition.baseName}`);}}}
 const activeWindowDefinitions=new Set<WindowDefinitionNode>();
 const activateWindow=(name:string):void=>{const definition=[...select.windowDefinitions].reverse().find(candidate=>sqliteIdentifierEqual(candidate.name,name));if(!definition||activeWindowDefinitions.has(definition))return;activeWindowDefinitions.add(definition);if(definition.baseName)activateWindow(definition.baseName);};
 const scanWindowReferences=(node:import('./lemon-runtime.ts').LemonValue<import('./tokenize.ts').SqlToken>):void=>{if(node.kind==='terminal')return;if(node.signature==='over_clause ::= OVER nm'){const token=node.children.flatMap(child=>child.kind==='reduction'?child.children:[]).find(child=>child.kind==='terminal'&&child.value);if(token?.kind==='terminal'&&token.value)activateWindow(identifier(token.value.text));}else if(node.signature==='over_clause ::= OVER LP window RP'){const window=node.children.find(child=>child.kind==='reduction'&&child.signature.startsWith('window ::='));if(window?.kind==='reduction'&&window.signature.startsWith('window ::= nm')){const token=window.children.flatMap(child=>child.kind==='reduction'?child.children:[]).find(child=>child.kind==='terminal'&&child.value);if(token?.kind==='terminal'&&token.value)activateWindow(identifier(token.value.text));}}node.children.forEach(scanWindowReferences);};
 for(const expression of [...select.result,...select.groupBy,...select.orderBy.map(term=>term.expr),...(select.where?[select.where]:[]),...(select.having?[select.having]:[])])if(expression.reduction)scanWindowReferences(expression.reduction);
 for(const definition of activeWindowDefinitions){for(const expression of definition.partitionBy){const nested=firstWindowName(expression);if(nested)throw new NameResolutionError(`misuse of window function ${nested}()`);resolveAgainstSources(expression,sources,[],false,false,false,select.windowNames,select.windowDefinitions,context,resolveNested);}for(const expression of definition.orderBy){const nested=firstWindowName(expression);if(nested)throw new NameResolutionError(`misuse of window function ${nested}()`);resolveAgainstSources(expression,sources,[],false,false,false,select.windowNames,select.windowDefinitions,context,resolveNested);}}
 for(const expression of select.result){const tokens=expression.tokens,star=tokens.length===1&&tokens[0]!.text==='*',qualifiedStar=tokens.length===3&&tokens[1]!.text==='.'&&tokens[2]!.text==='*';if(star||qualifiedStar){const qualifier=qualifiedStar?identifier(tokens[0]!.text):null,selected=qualifier===null?sources:sources.filter(s=>sqliteIdentifierEqual(s.alias??s.tableName,qualifier));if(!selected.length)throw new NameResolutionError(`no such table: ${qualifier}`);for(const source of selected)source.table.columns.forEach((column,columnIndex)=>{if(qualifier===null&&source.using?.some(name=>sqliteIdentifierEqual(name,column.name)))return;const participates=sources.slice(1).some(rhs=>rhs.joinFromLeft.right&&rhs.using?.some(name=>sqliteIdentifierEqual(name,column.name)));if(participates){const match=direct({kind:'tokens',tokens:Object.freeze([{...tokens[0]!,text:column.name,kind:'id' as const}])},sources);if(match){output.push(result(expression,match.resolved,column.name,match.mergedSources));return;}}output.push(result(expression,{source,columnIndex:columnIndex===integerPrimaryKeyIndex(source.table)?-1:columnIndex,name:column.name},column.name));});continue;}const bareWindow=bareBuiltinWindowName(expression);if(bareWindow)throw new NameResolutionError(`misuse of window function ${bareWindow}()`);const match=lookupName(expression,context,context,expression.reduction as ExprReduction|undefined);if(!match)resolveAgainstSources(expression,sources,[],false,false,false,select.windowNames,select.windowDefinitions,context,resolveNested);const resolved=match?.resolved??null,name=expression.alias??resolved?.name??expression.sourceText??tokens.map(t=>t.text).join(' ');output.push(result(expression,resolved,name,match?.mergedSources??null));}
 if(select.having){if(!select.groupBy.length&&!select.result.some(hasAggregate))throw new NameResolutionError('HAVING clause on a non-aggregate query');resolveAgainstSources(select.having,sources,select.result,false,false,true,select.windowNames,select.windowDefinitions,context,resolveNested);}
 if(select.where)resolveAgainstSources(select.where,sources,select.result,true,true,true,select.windowNames,select.windowDefinitions,context,resolveNested);
 for(let i=1;i<sources.length;i++){const source=sources[i]!;if(!source.on)continue;resolveAgainstSources(source.on,sources,select.result,true,true,true,select.windowNames,select.windowDefinitions,context,resolveNested);if(source.joinFromLeft.left||source.joinFromLeft.right||source.joinFromLeft.outer){try{resolveAgainstSources(source.on,sources.slice(0,i+1),select.result,true,true,true,select.windowNames,select.windowDefinitions,context,resolveNested);}catch(error){if(error instanceof NameResolutionError)throw new NameResolutionError('ON clause references tables to its right');throw error;}}}
 for(let i=0;i<select.groupBy.length;i++){
  const expression=select.groupBy[i]!,parsed=groupByInteger(expression);
  if(parsed!==null){
   const isOrdinal=parsed>=-2147483647n&&parsed<=2147483647n;
   if(!isOrdinal)continue;
   const ordinal=Number(parsed);
   if(ordinal<1||ordinal>output.length){const n=i+1,suffix=n%100>=11&&n%100<=13?'th':n%10===1?'st':n%10===2?'nd':n%10===3?'rd':'th';throw new NameResolutionError(`${n}${suffix} GROUP BY term out of range - should be between 1 and ${output.length}`);}
   if(firstWindowName(select.result[ordinal-1]!))throw new NameResolutionError(`misuse of window function ${firstWindowName(select.result[ordinal-1]!)}()`);
   if(hasAggregate(select.result[ordinal-1]!))throw new NameResolutionError('aggregate functions are not allowed in the GROUP BY clause');
   continue;
  }
  resolveAgainstSources(expression,sources,select.result,bareName(expression)===null&&collatedBareName(expression)===null,false,true,select.windowNames,select.windowDefinitions,context,resolveNested);
  const collatedAlias=collatedBareName(expression);
  if(collatedAlias){const alias=select.result.find(item=>item.alias&&sqliteIdentifierEqual(item.alias,collatedAlias));if(alias&&firstWindowName(alias))throw new NameResolutionError(`misuse of aliased window function ${collatedAlias}`);const aggregate=alias?firstAggregateName(alias):null;if(aggregate)throw new NameResolutionError(`misuse of aggregate: ${aggregate}()`);}
  let groupHasAggregate=hasAggregate(expression);
  if(!groupHasAggregate){
   const name=bareName(expression);
   if(name)try{direct(expression,sources);}
   catch(error){if(error instanceof NameResolutionError&&error.message.startsWith('no such column: ')){const alias=select.result.find(item=>item.alias&&sqliteIdentifierEqual(item.alias,name));groupHasAggregate=alias?hasAggregate(alias):false;}}
  }
  if(groupHasAggregate)throw new NameResolutionError('aggregate functions are not allowed in the GROUP BY clause');
 }
 if(select.limit)resolveAgainstSources(select.limit,[],[],false,true,true,select.windowNames,select.windowDefinitions,context,resolveNested);
 if(select.offset)resolveAgainstSources(select.offset,[],[],false,true,true,select.windowNames,select.windowDefinitions,context,resolveNested);
 const orderResultColumns:(number|null)[]=[];
 for(let i=0;i<select.orderBy.length;i++){
  const expression=select.orderBy[i]!.expr,parsed=groupByInteger(expression);
  // resolve.c:resolveOrderGroupBy marks AS-name matches before ordinals and
  // source lookup. Keep the result ownership for immutable window rewrite.
  const name=bareName(expression)??collatedBareName(expression);
  const aliasIndex=name===null?-1:select.result.findIndex(item=>item.alias&&sqliteIdentifierEqual(item.alias,name));
  orderResultColumns.push(aliasIndex>=0?aliasIndex:parsed!==null&&parsed>=1n&&parsed<=BigInt(output.length)?Number(parsed)-1:null);
  if(parsed!==null&&parsed>=-2147483647n&&parsed<=2147483647n){const ordinal=Number(parsed);if(ordinal<1||ordinal>output.length){const n=i+1,suffix=n%100>=11&&n%100<=13?'th':n%10===1?'st':n%10===2?'nd':n%10===3?'rd':'th';throw new NameResolutionError(`${n}${suffix} ORDER BY term out of range - should be between 1 and ${output.length}`);}continue;}
  if(select.hasCompound){const collationAt=expression.tokens.map(token=>sqliteAsciiFold(token.text)).lastIndexOf('collate');if(collationAt>=0&&expression.tokens[collationAt+1]){const value=identifier(expression.tokens[collationAt+1]!.text);if(!['binary','nocase','rtrim'].some(item=>sqliteIdentifierEqual(item,value)))throw new NameResolutionError(`no such collation sequence: ${value}`);}const name=bareName(expression)??collatedBareName(expression),matchesAlias=name!==null&&select.arms.some(arm=>arm.result.some(item=>item.alias&&sqliteIdentifierEqual(item.alias,name))),matchesExpression=select.arms.some(arm=>arm.result.some(item=>expressionStructurallyEqual(item,expression,arm.from.items)));if(!matchesAlias&&!matchesExpression){const n=i+1,suffix=n%100>=11&&n%100<=13?'th':n%10===1?'st':n%10===2?'nd':n%10===3?'rd':'th';throw new NameResolutionError(`${n}${suffix} ORDER BY term does not match any column in the result set`);}}
  else resolveAgainstSources(expression,sources,select.result,false,false,false,select.windowNames,select.windowDefinitions,context,resolveNested);
  const aggregate=hasAggregate(expression)?firstAggregateName(expression):null;
  if(aggregate&&!select.groupBy.length&&!select.result.some(hasAggregate))throw new NameResolutionError(`misuse of aggregate: ${aggregate}()`);
 }
 const resolvedWindowGraph=collectResolvedWindows(select,windowDefinitions);
 const plan:ResolvedSelect=Object.freeze({aliasUses:context.aliasUses!,orderResultColumns:Object.freeze(orderResultColumns),source:select,sources,result:Object.freeze(output),correlated:context.nRef>0,nested:Object.freeze(nested),columnUses:Object.freeze(columnUses),windowDefinitions,windows:resolvedWindowGraph.windows,multipleWindowPartitions:resolvedWindowGraph.multiple});
 const metadataResults=plan.result.map(item=>{
  const expression=item.expression.reduction;
  if(!expression||!linkedScalarMetadataExpression(expression))return item;
  const descriptor=resolvedExpressionMetadata(expression,plan);

  // select.c columnTypeImpl TK_SELECT inherits type/origin, not affinity or
  // collation. Keep the parent's result name and semantic expression binding.
  return Object.freeze({...item,descriptor:Object.freeze({...item.descriptor,declaredType:descriptor.declaredType,database:descriptor.database,table:descriptor.table,origin:descriptor.origin})});
 });
 return Object.freeze({...plan,result:Object.freeze(metadataResults)});
}

// resolve.c lookupName preserves a deferred coalesce argument list. Lemon
// parentheses are representation wrappers, not new semantic expression owners.
function resolvedDeferredCoalesce(expression:LemonValue<SqlToken>,plan:ResolvedSelect):{readonly mergedSources?:readonly ResolvedColumnRef[]|null}|undefined{
 const identity=(value:LemonValue<SqlToken>):LemonValue<SqlToken>=>{
  while(value.kind==='reduction'&&value.signature==='expr ::= LP expr RP'){
   const child=value.children.find(child=>child.kind==='reduction'&&child.signature.startsWith('expr ::='));if(!child)break;value=child;
  }
  return value;
 };
 const node=identity(expression);
 return plan.columnUses.find(use=>use.mergedSources&&identity(use.expression)===node)??plan.result.find(result=>result.resolution==='coalesce'&&result.expression.reduction&&identity(result.expression.reduction)===node);
}

/** expr.c:sqlite3ExprCollSeq implicit column path. CAST and UPLUS preserve
 * column collation; other operators do not inherit it without EP_Collate.
 * Explicit COLLATE is handled by the expression generator's flagged walk. */
export function resolvedImplicitCollation(expression:LemonValue<SqlToken>,plan:ResolvedSelect):string|undefined{
 if(expression.kind!=='reduction')return undefined;
 let node=expression;
 for(;;){
  const merged=resolvedDeferredCoalesce(node,plan)?.mergedSources?.[0];
  if(merged)return merged.columnIndex<0?undefined:merged.source.table.columns[merged.columnIndex]?.collation??'binary';

  const children=node.children.filter((child):child is ExprReduction=>child.kind==='reduction'&&child.signature.startsWith('expr ::='));
  const terminals=node.children.flatMap(child=>child.kind==='terminal'&&child.value?[child.value.text]:[]);
  if(node.signature==='expr ::= LP expr RP'||node.signature.startsWith('expr ::= CAST')||(children.length===1&&terminals.length===1&&terminals[0]==='+')){
   if(!children[0])return undefined;
   node=children[0];continue;
  }
  const use=plan.columnUses.find(use=>use.expression===node);
  if(use)return use.columnIndex<0?undefined:use.source.table.columns[use.columnIndex]?.collation??'binary';
  const result=plan.result.find(result=>result.expression.reduction===node||result.expression.reduction===expression);
  if(!result?.source||result.columnIndex===null||result.columnIndex<0)return undefined;
  return result.source.table.columns[result.columnIndex]?.collation??'binary';
 }
}

// expr.c sqlite3ExprAffinity: affinity belongs to the resolved column, CAST,
// or COLLATE operand. Unlike collation, unary plus removes affinity. Parentheses
// are absent in C Expr and are peeled here only as a Lemon representation step.
export function resolvedExpressionAffinity(expression:LemonValue<SqlToken>,plan:ResolvedSelect):ColumnNode['affinity']|undefined{
 if(expression.kind!=='reduction')return undefined;
 let node=expression;
 for(;;){
  const merged=resolvedDeferredCoalesce(node,plan)?.mergedSources?.[0];
  if(merged)return merged.columnIndex<0?'integer':merged.source.table.columns[merged.columnIndex]?.affinity;

  const child=node.children.find((child):child is ExprReduction=>child.kind==='reduction'&&child.signature.startsWith('expr ::='));
  if(node.signature==='expr ::= LP expr RP'||node.signature.startsWith('expr ::= expr COLLATE')){if(!child)return undefined;node=child;continue;}
  if(node.signature==='expr ::= LP nexprlist COMMA expr RP'){
   const first=vectorFirstExpression(node);
   return first?resolvedExpressionAffinity(first,plan):undefined;
  }
  if(node.signature==='expr ::= LP select RP'){
   const select=node.children.find((child):child is ExprReduction=>child.kind==='reduction'&&child.signature.startsWith('select ::='))?.semantic;
   const nested=plan.nested.find(nested=>nested.source===select);
   // Resolve owns this link; do not infer affinity from SQL text, sibling
   // position, or a newly independently resolved NameContext.
   if(!nested?.result[0]?.expression.reduction)return undefined;
   return resolvedExpressionAffinity(nested.result[0].expression.reduction,nested);
  }
  if(node.signature.startsWith('expr ::= CAST')){
   const tokens:SqlToken[]=[];const collect=(value:LemonValue<SqlToken>):void=>{if(value.kind==='terminal'){if(value.value)tokens.push(value.value);}else value.children.forEach(collect);};
   // The type-name nonterminal is owned by CAST, not nested operand tokens.
   const type=node.children.find(child=>child.kind==='reduction'&&child.signature.startsWith('typetoken ::='));
   if(!type)return undefined;collect(type);const name=tokens.map(token=>token.text).join(' ').toUpperCase();
   if(name.includes('INT'))return 'integer';if(/CHAR|CLOB|TEXT/.test(name))return 'text';if(!name||name.includes('BLOB'))return 'blob';if(/REAL|FLOA|DOUB/.test(name))return 'real';return 'numeric';
  }
  const use=plan.columnUses.find(use=>use.expression===node);
  if(!use){
   const result=plan.result.find(result=>(result.expression.reduction===node||result.expression.reduction===expression));
   if(result?.source&&result.columnIndex!==null)return result.columnIndex<0?'integer':result.source.table.columns[result.columnIndex]?.affinity;
   return undefined;
  }
  return use.columnIndex<0?'integer':use.source.table.columns[use.columnIndex]?.affinity;
 }
}

// expr.c sqlite3ExprDataType, numeric/text/blob bits (NULL contributes zero).
// This is static producer metadata, not an evaluator of CASE conditions.
export function resolvedExpressionDataType(expression:LemonValue<SqlToken>,plan:ResolvedSelect):number{
 if(expression.kind!=='reduction')return 0;
 let node=expression;
 for(;;){
  if(resolvedDeferredCoalesce(node,plan))return 7;
  const exprs=node.children.filter((child):child is ExprReduction=>child.kind==='reduction'&&child.signature.startsWith('expr ::='));
  if(node.signature==='expr ::= term') {const term=node.children.find((child):child is ExprReduction=>child.kind==='reduction');if(!term)return 0;node=term;continue;}
  const terminals=node.children.flatMap(child=>child.kind==='terminal'&&child.value?[child.value.text]:[]);
  if(node.signature==='expr ::= LP expr RP'||node.signature.startsWith('expr ::= expr COLLATE')||node.signature==='expr ::= PLUS|MINUS expr'&&terminals[0]==='+'){if(!exprs[0])return 0;node=exprs[0];continue;}
  if(node.signature==='term ::= NULL|FLOAT|BLOB'){const token=node.children.find(child=>child.kind==='terminal'&&child.value);if(token?.kind==='terminal')return token.value?.text.toUpperCase()==='NULL'?0:token.value?.text.match(/^[xX]'/)?4:1;}
  if(node.signature==='term ::= NULL')return 0;
  if(node.signature==='term ::= STRING')return 2;
  if(node.signature==='term ::= BLOB')return 4;
  if(node.signature.includes('CONCAT'))return 6;
  if(node.signature.includes('VARIABLE')||/^expr ::= ID(?:\|INDEXED\|JOIN_KW)? LP /.test(node.signature))return 7;
  if(node.signature.startsWith('expr ::= CASE')){
   let mask=0;
   const branches=(value:LemonValue<SqlToken>):void=>{
    if(value.kind!=='reduction')return;
    if(value.signature.startsWith('case_exprlist ::=')){
     const outputs=value.children.filter((child):child is ExprReduction=>child.kind==='reduction'&&child.signature.startsWith('expr ::='));
     if(outputs[1])mask|=resolvedExpressionDataType(outputs[1],plan);
     value.children.filter(child=>child.kind==='reduction'&&child.signature.startsWith('case_exprlist ::=')).forEach(branches);
    }else if(value.signature.startsWith('case_else ::='))for(const child of value.children)if(child.kind==='reduction'&&child.signature.startsWith('expr ::='))mask|=resolvedExpressionDataType(child,plan);
   };node.children.forEach(branches);return mask;
  }
  if(node.signature.startsWith('expr ::= CAST')||node.signature==='expr ::= LP select RP'||node.signature==='expr ::= LP nexprlist COMMA expr RP'||node.signature.startsWith('expr ::= ID|')||node.signature==='expr ::= nm DOT nm'||node.signature==='expr ::= nm DOT nm DOT nm'){
   const affinity=resolvedExpressionAffinity(node,plan);
   return affinity==='integer'||affinity==='real'||affinity==='numeric'||affinity==='flexnum'?5:affinity==='text'?6:7;
  }
  return 1;
 }
}

// select.c sqlite3SubqueryColumnTypes: earlier NONE arms and later arms both
// contribute datatype conflicts. BLOB is a real affinity, not NONE.
export function resolvedCompoundAffinity(plans:readonly ResolvedSelect[],index:number):ColumnNode['affinity']{
 let arm=0,mask=0;
 const expr=(at:number)=>plans[at]!.result[index]!.expression.reduction!;
 let affinity=resolvedExpressionAffinity(expr(arm),plans[arm]!);
 while(!affinity&&arm+1<plans.length){mask|=resolvedExpressionDataType(expr(arm),plans[arm]!);affinity=resolvedExpressionAffinity(expr(++arm),plans[arm]!);}
 affinity??='blob';
 if(affinity!=='blob'&&plans.length>1){
  for(let tail=arm+1;tail<plans.length;tail++)mask|=resolvedExpressionDataType(expr(tail),plans[tail]!);
  if(affinity==='text'&&(mask&1)||affinity!=='text'&&(mask&2))return 'blob';
  // select.c: numeric leftmost CAST preserves real/integer with FLEXNUM.
  let first=expr(0);
  // parse.y parentheses return the same Expr pointer; only TS retains a
  // Lemon wrapper. COLLATE is a real C Expr and must not be stripped here.
  while(first.kind==='reduction'&&first.signature==='expr ::= LP expr RP'){
   const child=first.children.find((child):child is ExprReduction=>child.kind==='reduction'&&child.signature.startsWith('expr ::='));
   if(!child)break;first=child;
  }
  if(affinity!=='text'&&first.kind==='reduction'&&first.signature.startsWith('expr ::= CAST'))return 'flexnum';
 }
 return affinity;
}

/** expr.c sqlite3ExprCollSeq: implicit column/CAST/UPLUS ownership precedes
 * EP_Collate child selection. SELECT contents do not propagate Expr flags. */
export function resolvedExpressionCollation(expression:LemonValue<SqlToken>,plan:ResolvedSelect):string|undefined{
 if(expression.kind!=='reduction')return undefined;
 const merged=resolvedDeferredCoalesce(expression,plan)?.mergedSources?.[0];
 if(merged)return merged.columnIndex<0?undefined:merged.source.table.columns[merged.columnIndex]?.collation??'binary';
 const children=expression.children.filter((child):child is ExprReduction=>child.kind==='reduction'&&child.signature.startsWith('expr ::='));
 if(expression.signature==='expr ::= LP expr RP'||expression.signature.startsWith('expr ::= CAST')||expression.signature==='expr ::= PLUS|MINUS expr'&&expression.children.some(child=>child.kind==='terminal'&&child.value?.text==='+'))return children[0]?resolvedExpressionCollation(children[0],plan):undefined;
 if(expression.signature.startsWith('expr ::= expr COLLATE')){
  const token=expression.children.filter(child=>child.kind==='terminal'&&child.value).at(-1);
  return token?.kind==='terminal'?identifier(token.value.text):undefined;
 }
 if(expression.signature==='expr ::= LP nexprlist COMMA expr RP'){
  const first=vectorFirstExpression(expression);
  return first?resolvedExpressionCollation(first,plan):undefined;
 }
 const implicit=resolvedImplicitCollation(expression,plan);
 if(implicit)return implicit;
 const flagged=(value:LemonValue<SqlToken>):string|undefined=>{
  if(value.kind!=='reduction'||value.signature.startsWith('select ::=')||value.signature==='expr ::= LP select RP')return undefined;
  if(value.signature.startsWith('expr ::= expr COLLATE'))return resolvedExpressionCollation(value,plan);
  for(const child of value.children){const found=flagged(child);if(found)return found;}
  return undefined;
 };
 return flagged(expression);
}

// Parser representation of Expr.x.pList->a[0], shared by affinity/collation.
function vectorFirstExpression(node:ExprReduction):ExprReduction|undefined{
 let list=node.children.find((child):child is ExprReduction=>child.kind==='reduction'&&child.signature.startsWith('nexprlist ::='));
 while(list){
  const prior=list.children.find((child):child is ExprReduction=>child.kind==='reduction'&&child.signature.startsWith('nexprlist ::='));
  if(prior){list=prior;continue;}
  return list.children.find((child):child is ExprReduction=>child.kind==='reduction'&&child.signature.startsWith('expr ::='));
 }
 return undefined;
}

// select.c multiSelectCollSeq: pPrior before current, first non-null wins.
// Do not default BINARY at each expression: literals have no collation.
export function resolvedCompoundCollation(plans:readonly ResolvedSelect[],index:number):string|undefined{
 for(const plan of plans){const expression=plan.result[index]?.expression.reduction;if(!expression)continue;const collation=resolvedExpressionCollation(expression,plan);if(collation!==undefined)return collation;}
 return undefined;
}

// select.c2399 sqlite3SubqueryColumnTypes type normalization. Original type
// is columnType's result, not inferred from affinity or runtime values.
export function transientDeclaredType(original:string|null,affinity:ColumnNode['affinity']):string{
 if(original){const type=original.toUpperCase();const mapped=type.includes('INT')?'integer':/CHAR|CLOB|TEXT/.test(type)?'text':!type||type.includes('BLOB')?'blob':/REAL|FLOA|DOUB/.test(type)?'real':'numeric';if(mapped===affinity)return original;}
 return affinity==='numeric'||affinity==='flexnum'?'NUM':affinity==='integer'?'INT':affinity==='real'?'REAL':affinity==='text'?'TEXT':'BLOB';
}

/** select.c columnTypeImpl: only TK_COLUMN and linked TK_SELECT own types.
 * Parentheses are the same Expr pointer in C; do not peel CAST or UPLUS. */
function linkedScalarMetadataExpression(expression:LemonValue<SqlToken>):boolean{
 if(expression.kind!=='reduction')return false;
 if(expression.signature==='expr ::= LP expr RP'){
  const child=expression.children.find(child=>child.kind==='reduction'&&child.signature.startsWith('expr ::='));return !!child&&linkedScalarMetadataExpression(child);
 }
 return expression.signature==='expr ::= LP select RP';
}
export function resolvedExpressionMetadata(expression:LemonValue<SqlToken>,plan:ResolvedSelect):Pick<ResolvedResult['descriptor'],'declaredType'|'database'|'table'|'origin'>{
 const empty={declaredType:null,database:null,table:null,origin:null};
 if(expression.kind!=='reduction')return empty;
 // resolve.c lookupName rewrites FULL USING matches to TK_FUNCTION coalesce.
 // TS retains original Lemon expression and records the rewrite on ResolvedResult.
 // Its child columnUses are not the metadata owner (columnTypeImpl default).
 if(resolvedDeferredCoalesce(expression,plan))return empty;
 if(expression.signature==='expr ::= LP expr RP'){
  const child=expression.children.find((child):child is ExprReduction=>child.kind==='reduction'&&child.signature.startsWith('expr ::='));const direct=plan.result.find(result=>result.expression.reduction===expression&&result.resolution==='direct');return direct?.descriptor??(child?resolvedExpressionMetadata(child,plan):empty);
 }
 if(expression.signature==='expr ::= LP select RP'){
  const select=expression.children.find((child):child is ExprReduction=>child.kind==='reduction'&&child.signature.startsWith('select ::='))?.semantic;
  const nested=plan.nested.find(nested=>nested.source===select),first=nested?.result[0]?.expression.reduction;
  return nested&&first?resolvedExpressionMetadata(first,nested):empty;
 }
 if(expression.signature!=='expr ::= ID|INDEXED|JOIN_KW'&&!expression.signature.startsWith('expr ::= nm DOT'))return empty;
 const result=plan.result.find(result=>result.expression.reduction===expression&&result.resolution==='direct');
 if(result)return result.descriptor;
 const use=plan.columnUses.find(use=>use.expression===expression);
 if(use)return descriptor('',{source:use.source,columnIndex:use.columnIndex,name:use.columnIndex<0?'rowid':use.source.table.columns[use.columnIndex]!.name});
 const direct=plan.result.find(result=>result.expression.reduction===expression);
 return direct?.resolution==='direct'?direct.descriptor:empty;
}

export function resolvedExpressionDeclaredType(expression:LemonValue<SqlToken>,plan:ResolvedSelect):string|null{
 return resolvedExpressionMetadata(expression,plan).declaredType;
}

// SrcItem.u4.pSubq metadata relationship: WeakMap preserves shared TableNode
// representation without pretending rootPage=0 is a physical origin.
const transientProducerPlans=new WeakMap<TableNode,ResolvedSelect>();
export function bindTransientProducer(table:TableNode,producer:ResolvedSelect):void{transientProducerPlans.set(table,producer);}

/** resolve.c linked lookup results retained through expression code generation.
 * Reduction identity, not SQL spelling, owns the lexical source and depth.
 * Unsupported productions remain present so consumers reject before execution.
 */
export interface ResolvedExpressionCarrier {
 readonly reduction:ExprReduction;
 readonly column:ResolvedColumnUse|null;
 readonly children:readonly ResolvedExpressionCarrier[];
}
export function resolvedExpressionCarrier(plan:ResolvedSelect,reduction:ExprReduction):ResolvedExpressionCarrier {
 const uses=new Map(plan.columnUses.map(use=>[use.expression,use]));
 const expressionChildren=(node:LemonValue<SqlToken>):ExprReduction[]=>{
  if(node.kind!=='reduction')return [];
  return node.children.flatMap(child=>child.kind==='reduction'&&(child.signature.startsWith('expr ::=')||child.signature.startsWith('term ::='))?[child]:expressionChildren(child));
 };
 const build=(node:ExprReduction):ResolvedExpressionCarrier=>{
  // resolve.c resolveAlias substitutes the result expression after lexical
  // source lookup fails; retain its identity rather than rebind its spelling.
  const alias=plan.aliasUses?.get(node);if(alias)return build(alias);
  while(node.signature==='expr ::= LP expr RP'){
   const child=expressionChildren(node)[0];if(!child)throw new NameResolutionError('parenthesized expression lost identity');node=child;
  }
  return Object.freeze({reduction:node,column:uses.get(node)??null,children:Object.freeze(expressionChildren(node).map(build))});
 };
 return build(reduction);
}

/** Physical location is selected after linked resolution, never by name lookup.
 * Producer-row registers are distinct from aggregate finalized-row registers.
 * The latter phase has no consumer here and must not be inferred from a number.
 */
export type ResolvedExpressionLocation =
 | {readonly kind:'cursor';readonly cursor:number;readonly payloadIndex?:number}
 | {readonly kind:'register';readonly register:number;readonly phase:'producer-row'|'source-row'};
export interface ResolvedExpressionBinding {
 readonly location:(reference:ResolvedColumnRef,selectDepth:number)=>ResolvedExpressionLocation;
 readonly policy:'joined-aggregate'|'scalar'|'derived-predicate'|'window-filter'|'window-source'|'aggregate-source'|'ordinary-aggregate';
}

/** select.c AggInfo functions own one accumulator until AggFinal publishes it.
 * Argument and ORDER expressions retain their resolved source-row identities;
 * output location is only consumed after the owning finalization operation.
 */
export interface ResolvedAggregatePhaseCarrier {
 readonly expression:ResolvedExpressionCarrier;
 readonly arguments:readonly ResolvedExpressionCarrier[];
 readonly orderBy:readonly ResolvedExpressionCarrier[];
 readonly accumulator:Readonly<{phase:'accumulator';register:number}>;
 readonly output:Readonly<{phase:'finalized-output';register:number}>;
}
