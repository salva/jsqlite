import type {ExprNode,SelectNode,SourceItem} from './parse.ts';
import type {ColumnNode,TableNode} from './schema.ts';
import {sqliteAsciiFold,sqliteIdentifierEqual} from './sqlite-case.ts';

export class NameResolutionError extends Error{}
export interface ResolutionSchema {readonly tables:ReadonlyMap<string,TableNode>}
export interface ResolvedSource extends Omit<SourceItem,'cursorId'|'table'>{readonly cursorId:number;readonly table:TableNode}
export interface ResultColumnDescriptor {readonly name:string;readonly declaredType:string|null;readonly database:string|null;readonly table:string|null;readonly origin:string|null;readonly affinity:ColumnNode['affinity']|null;readonly collation:string}
export interface ResolvedColumnRef {readonly source:ResolvedSource;readonly columnIndex:number;readonly name:string}
export interface ResolvedResult {readonly name:string;readonly expression:ExprNode;readonly source:ResolvedSource|null;readonly columnIndex:number|null;readonly mergedSources:readonly ResolvedColumnRef[]|null;readonly resolution:'direct'|'coalesce'|'expression';readonly descriptor:ResultColumnDescriptor}
export interface ResolvedSelect {readonly source:SelectNode;readonly sources:readonly ResolvedSource[];readonly result:readonly ResolvedResult[]}
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
  if(node.signature.startsWith('expr ::= LP expr RP')||node.signature.startsWith('expr ::= expr COLLATE ')){if(node.signature.includes('COLLATE'))collated=true;const nested=node.children.find(child=>child.kind==='reduction'&&child.signature.startsWith('expr ::='));return nested?visit(nested):null;}
  if(node.signature==='expr ::= ID|INDEXED|JOIN_KW'){const token=node.children.find(child=>child.kind==='terminal')?.value;return token?identifier(token.text):null;}
  return null;
 };
 const name=expression.reduction?visit(expression.reduction):null;return collated?name:null;
}
function firstAggregateName(expression:ExprNode):string|null{
 const aggregates=new Set(['avg','count','group_concat','max','min','sum','total','string_agg']);
 const visit=(node:import('./lemon-runtime.ts').LemonValue<import('./tokenize.ts').SqlToken>):string|null=>{
  if(node.kind!=='reduction')return null;
  if(node.signature.startsWith('expr ::= ID|INDEXED|JOIN_KW LP')){const token=node.children.find(child=>child.kind==='terminal')?.value;if(token&&aggregates.has(sqliteAsciiFold(identifier(token.text))))return identifier(token.text);}
  for(const child of node.children){const found=visit(child);if(found)return found;}return null;
 };
 return expression.reduction?visit(expression.reduction):null;
}
function functionArgumentCount(node:import('./lemon-runtime.ts').LemonValue<import('./tokenize.ts').SqlToken>):number|null{
 if(node.kind!=='reduction'||!node.signature.startsWith('expr ::= ID|INDEXED|JOIN_KW LP'))return null;
 if(node.signature.includes(' STAR RP'))return 1;
 const list=node.children.find(child=>child.kind==='reduction'&&child.signature.startsWith('exprlist ::='));
 if(!list)return null;
 const count=(part:import('./lemon-runtime.ts').LemonValue<import('./tokenize.ts').SqlToken>):number=>part.kind==='reduction'&&part.signature==='nexprlist ::= nexprlist COMMA expr'?count(part.children[0]!)+1:part.kind==='reduction'&&part.signature==='nexprlist ::= expr'?1:part.kind==='reduction'?Math.max(0,...part.children.map(count)):0;
 return count(list);
}
function hasAggregate(expression:ExprNode):boolean{
 const aggregates=new Set(['avg','count','group_concat','max','min','sum','total','string_agg']);
 const visit=(node:import('./lemon-runtime.ts').LemonValue<import('./tokenize.ts').SqlToken>):boolean=>{
  if(node.kind!=='reduction')return false;
  if(node.signature.startsWith('expr ::= ID|INDEXED|JOIN_KW LP')){
   const name=node.children.find(child=>child.kind==='terminal')?.value?.text;
   if(name&&aggregates.has(sqliteAsciiFold(identifier(name)))){
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
 const words=expressionTokens.map(t=>t.text);let database:string|null=null,qualifier:string|null=null,name:string;if(words.length===1)name=identifier(words[0]!);else if(words.length===3&&words[1]==='.') {qualifier=identifier(words[0]!);name=identifier(words[2]!);}else if(words.length===5&&words[1]==='.'&&words[3]==='.') {database=identifier(words[0]!);qualifier=identifier(words[2]!);name=identifier(words[4]!);}else return null;
 const eligible=qualifier===null?sources:sources.filter(s=>sqliteIdentifierEqual(s.alias??s.tableName,qualifier!)&&(!database||(!s.alias&&sqliteIdentifierEqual(s.databaseName??'main',database))));let found:{source:ResolvedSource;columnIndex:number;name:string}[]=[];const rowidCandidates:{source:ResolvedSource;columnIndex:number;name:string}[]=[];
 for(const source of eligible){const at=source.table.columns.findIndex(c=>sqliteIdentifierEqual(c.name,name));if(at>=0)found.push({source,columnIndex:at===integerPrimaryKeyIndex(source.table)?-1:at,name:source.table.columns[at]!.name});else if(!source.table.withoutRowid&&['rowid','_rowid_','oid'].some(x=>sqliteIdentifierEqual(x,name))&&!source.table.columns.some(c=>sqliteIdentifierEqual(c.name,name)))rowidCandidates.push({source,columnIndex:-1,name});}
 // resolve.c:lookupName retains rowid candidates only when no real column
 // matched anywhere in the current NameContext.
 if(found.length===0)found=rowidCandidates;
 // lookupName/tableAndColumnIndex: an unqualified USING name denotes one
 // merged column. RIGHT selects the RHS; INNER/LEFT retain the left-most.
 let mergedSources:readonly ResolvedColumnRef[]|null=null;
 if(qualifier===null)for(let i=1;i<sources.length;i++){const rhs=sources[i]!;if(!rhs.using?.some(x=>sqliteIdentifierEqual(x,name)))continue;const members=found.filter(x=>sources.indexOf(x.source)<=i);if(members.length>1){if(rhs.joinFromLeft.left&&rhs.joinFromLeft.right){mergedSources=Object.freeze(members);found=[members[0]!,...found.filter(x=>sources.indexOf(x.source)>i)];}else found=[...(rhs.joinFromLeft.right?[members.at(-1)!]:[members[0]!]),...found.filter(x=>sources.indexOf(x.source)>i)];}}
 const display=database?`${database}.${qualifier}.${name}`:qualifier===null?name:`${qualifier}.${name}`;if(found.length>1)throw new NameResolutionError(`ambiguous column name: ${display}`);if(!found.length)throw new NameResolutionError(`no such column: ${display}`);return {resolved:found[0]!,mergedSources};
}
function descriptor(name:string,resolved:ResolvedColumnRef|null):ResultColumnDescriptor{if(!resolved)return Object.freeze({name,declaredType:null,database:null,table:null,origin:null,affinity:null,collation:'BINARY'});const c=resolved.columnIndex<0?resolved.source.table.columns.find(column=>sqliteIdentifierEqual(column.name,resolved.name)):resolved.source.table.columns[resolved.columnIndex];if(!c)return Object.freeze({name,declaredType:null,database:'main',table:resolved.source.table.name,origin:null,affinity:'integer',collation:'BINARY'});return Object.freeze({name,declaredType:c.declaredType,database:'main',table:resolved.source.table.name,origin:c.name,affinity:c.affinity,collation:c.collation??'BINARY'});}
function mergedDescriptor(name:string,sources:readonly ResolvedColumnRef[]):ResultColumnDescriptor{const first=sources[0],column=first&&first.columnIndex>=0?first.source.table.columns[first.columnIndex]:null;return Object.freeze({name,declaredType:null,database:null,table:null,origin:null,affinity:column?.affinity??(first?'integer':null),collation:column?.collation??'BINARY'});}
function result(expression:ExprNode,resolved:ResolvedColumnRef|null,name:string,mergedSources:readonly ResolvedColumnRef[]|null=null):ResolvedResult{let resultDescriptor=mergedSources?mergedDescriptor(name,mergedSources):descriptor(name,resolved);if(resolved){const collateAt=expression.tokens.map(token=>token.text.toUpperCase()).lastIndexOf('COLLATE');if(collateAt>=0&&expression.tokens[collateAt+1]){const explicit=identifier(expression.tokens[collateAt+1]!.text),supported=['binary','nocase','rtrim'].find(name=>sqliteIdentifierEqual(name,explicit));if(!supported)throw new NameResolutionError(`no such collation sequence: ${explicit}`);resultDescriptor=Object.freeze({...resultDescriptor,collation:supported});}}return Object.freeze({name,expression,source:mergedSources?null:resolved?.source??null,columnIndex:mergedSources?null:resolved?.columnIndex??null,mergedSources:mergedSources?Object.freeze([...mergedSources]):null,resolution:mergedSources?'coalesce':resolved?'direct':'expression',descriptor:resultDescriptor});}
function resolveAgainstSources(expression:ExprNode,sources:readonly ResolvedSource[],aliases:readonly ExprNode[]=[],rejectAliasAggregate=false,rejectAggregateFunctions=false):void{
 const tokens=(node:import('./lemon-runtime.ts').LemonValue<import('./tokenize.ts').SqlToken>):import('./tokenize.ts').SqlToken[]=>node.kind==='terminal'?(node.value?[node.value]:[]):node.children.flatMap(tokens);
 const walk=(node:import('./lemon-runtime.ts').LemonValue<import('./tokenize.ts').SqlToken>):void=>{
  if(node.kind==='terminal')return;
  if(node.signature.startsWith('expr ::= ID|INDEXED|JOIN_KW LP')){
   node.children.forEach(walk);
   const token=node.children.find(child=>child.kind==='terminal')?.value,count=functionArgumentCount(node);
   if(token&&count!==null){const name=sqliteAsciiFold(identifier(token.text)),star=node.signature.includes(' STAR RP'),valid=name==='count'?count<=1:star?false:name==='group_concat'?count===1||count===2:name==='string_agg'?count===2:['avg','sum','total'].includes(name)?count===1:['min','max'].includes(name)?count>=1:['abs','hex','length','octet_length','typeof','unicode'].includes(name)?count===1:name==='nullif'||name==='replace'?count===2+(name==='replace'?1:0):name==='substr'?count===2||count===3:name==='coalesce'?count>=2:true;if(!valid)throw new NameResolutionError(`wrong number of arguments to function ${identifier(token.text)}()`);const distinct=node.children.some(child=>child.kind==='reduction'&&child.signature==='distinct ::= DISTINCT'),aggregate=['avg','count','group_concat','string_agg','sum','total'].includes(name)||(['min','max'].includes(name)&&count===1);if(aggregate&&distinct&&count!==1)throw new NameResolutionError('DISTINCT aggregates must have exactly one argument');}
   if(rejectAggregateFunctions&&hasAggregate({kind:'tokens',tokens:[],reduction:node})&&token)throw new NameResolutionError(`misuse of aggregate function ${identifier(token.text)}()`);
   if(token&&count!==null){const name=sqliteAsciiFold(identifier(token.text)),aggregate=['avg','count','group_concat','string_agg','sum','total'].includes(name)||(['min','max'].includes(name)&&count===1),argumentsNode=node.children.find(child=>child.kind==='reduction'&&child.signature.startsWith('exprlist ::='));const nested=aggregate&&argumentsNode?firstAggregateName({kind:'tokens',tokens:[],reduction:argumentsNode}):null;if(nested)throw new NameResolutionError(`misuse of aggregate function ${nested}()`);}
   const filter=node.children.find(child=>child.kind==='reduction'&&child.signature==='filter_over ::= filter_clause');
   if(filter){const nested=firstAggregateName({kind:'tokens',tokens:[],reduction:filter});if(nested)throw new NameResolutionError(`misuse of aggregate function ${nested}()`);}
   if(filter&&token&&count!==null){const name=sqliteAsciiFold(identifier(token.text)),aggregate=['avg','count','group_concat','string_agg','sum','total'].includes(name)||(['min','max'].includes(name)&&count===1);if(!aggregate)throw new NameResolutionError(`FILTER may not be used with non-aggregate ${identifier(token.text)}()`);}
   return;
  }
  if(node.signature.startsWith('expr ::= expr COLLATE ')){node.children.forEach(walk);const collationToken=tokens(node).at(-1);if(collationToken){const name=identifier(collationToken.text);if(!['binary','nocase','rtrim'].some(candidate=>sqliteIdentifierEqual(candidate,name)))throw new NameResolutionError(`no such collation sequence: ${name}`);}return;}
  if(node.signature.startsWith('expr ::= nm DOT nm DOT nm')){direct({kind:'tokens',tokens:tokens(node)},sources);return;}
  if(node.signature.startsWith('expr ::= nm DOT nm')){direct({kind:'tokens',tokens:tokens(node)},sources);return;}
  if(node.signature.startsWith('expr ::= ID')||node.signature.startsWith('expr ::= INDEXED')||node.signature.startsWith('expr ::= JOIN_KW')){const tokens=node.children.flatMap(child=>child.kind==='terminal'&&child.value?[child.value]:[]);if(tokens.length){try{direct({kind:'tokens',tokens},sources);}catch(error){if(!(error instanceof NameResolutionError)||!error.message.startsWith('no such column: '))throw error;const name=identifier(tokens[0]!.text),matches=aliases.filter(item=>item.alias&&sqliteIdentifierEqual(item.alias,name));if(!matches[0])throw error;if(rejectAliasAggregate){const aggregate=firstAggregateName(matches[0]);if(aggregate)throw new NameResolutionError(`misuse of aggregate: ${aggregate}()`);}resolveAgainstSources(matches[0],sources,[],rejectAliasAggregate,rejectAggregateFunctions);}return;}}
  node.children.forEach(walk);
 };
 if(expression.reduction)walk(expression.reduction);
}
/** Bounded ports of select.c:selectExpander and resolve.c:lookupName for ordinary tables. */
export function expandAndResolveSelect(select:SelectNode,schema:ResolutionSchema):ResolvedSelect{
 const bound=select.from.items.map((item,cursorId)=>{if(item.databaseName&&!sqliteIdentifierEqual(item.databaseName,'main'))throw new NameResolutionError(`no such table: ${item.databaseName}.${item.tableName}`);const table=schema.tables.get(sqliteAsciiFold(item.tableName));if(!table)throw new NameResolutionError(`no such table: ${item.databaseName?`${item.databaseName}.`:''}${item.tableName}`);if(item.indexedBy!==null&&!table.indexes.some(index=>sqliteIdentifierEqual(index.name,item.indexedBy!)))throw new NameResolutionError(`no such index: ${item.indexedBy}`);return {...item,cursorId,table} as ResolvedSource;});
 for(let i=1;i<bound.length;i++){const source=bound[i]!,left=bound.slice(0,i);if(source.joinFromLeft.natural){if(source.on||source.using)throw new NameResolutionError('a NATURAL join may not have an ON or USING clause');(source as unknown as {using:readonly string[]}).using=Object.freeze(source.table.columns.filter(column=>left.some(candidate=>candidate.table.columns.some(c=>sqliteIdentifierEqual(c.name,column.name)))).map(column=>column.name));}if(source.using)for(const name of source.using){if(!source.table.columns.some(c=>sqliteIdentifierEqual(c.name,name))||!left.some(candidate=>candidate.table.columns.some(c=>sqliteIdentifierEqual(c.name,name))))throw new NameResolutionError(`cannot join using column ${name} - column not present in both tables`);}}
 const sources=Object.freeze(bound.map(source=>Object.freeze(source)));
 const output:ResolvedResult[]=[];
 for(const expression of select.result){const tokens=expression.tokens,star=tokens.length===1&&tokens[0]!.text==='*',qualifiedStar=tokens.length===3&&tokens[1]!.text==='.'&&tokens[2]!.text==='*';if(star||qualifiedStar){const qualifier=qualifiedStar?identifier(tokens[0]!.text):null,selected=qualifier===null?sources:sources.filter(s=>sqliteIdentifierEqual(s.alias??s.tableName,qualifier));if(!selected.length)throw new NameResolutionError(`no such table: ${qualifier}`);for(const source of selected)source.table.columns.forEach((column,columnIndex)=>{if(qualifier===null&&source.using?.some(name=>sqliteIdentifierEqual(name,column.name)))return;output.push(result(expression,{source,columnIndex:columnIndex===integerPrimaryKeyIndex(source.table)?-1:columnIndex,name:column.name},column.name));});continue;}const match=direct(expression,sources);if(!match)resolveAgainstSources(expression,sources);const resolved=match?.resolved??null,name=expression.alias??resolved?.name??tokens.map(t=>t.text).join(' ');output.push(result(expression,resolved,name,match?.mergedSources??null));}
 if(select.having){if(!select.groupBy.length&&!select.result.some(hasAggregate))throw new NameResolutionError('HAVING clause on a non-aggregate query');resolveAgainstSources(select.having,sources,select.result);}
 if(select.where)resolveAgainstSources(select.where,sources,select.result,true,true);
 for(let i=1;i<sources.length;i++){const source=sources[i]!;if(!source.on)continue;resolveAgainstSources(source.on,sources,select.result,true,true);if(source.joinFromLeft.left||source.joinFromLeft.right||source.joinFromLeft.outer){try{resolveAgainstSources(source.on,sources.slice(0,i+1),select.result,true,true);}catch(error){if(error instanceof NameResolutionError)throw new NameResolutionError('ON clause references tables to its right');throw error;}}}
 for(let i=0;i<select.groupBy.length;i++){
  const expression=select.groupBy[i]!,parsed=groupByInteger(expression);
  if(parsed!==null){
   const isOrdinal=parsed>=-2147483647n&&parsed<=2147483647n;
   if(!isOrdinal)continue;
   const ordinal=Number(parsed);
   if(ordinal<1||ordinal>output.length){const n=i+1,suffix=n%100>=11&&n%100<=13?'th':n%10===1?'st':n%10===2?'nd':n%10===3?'rd':'th';throw new NameResolutionError(`${n}${suffix} GROUP BY term out of range - should be between 1 and ${output.length}`);}
   if(hasAggregate(select.result[ordinal-1]!))throw new NameResolutionError('aggregate functions are not allowed in the GROUP BY clause');
   continue;
  }
  resolveAgainstSources(expression,sources,select.result,bareName(expression)===null);
  const collatedAlias=collatedBareName(expression);
  if(collatedAlias){const alias=select.result.find(item=>item.alias&&sqliteIdentifierEqual(item.alias,collatedAlias)),aggregate=alias?firstAggregateName(alias):null;if(aggregate)throw new NameResolutionError(`misuse of aggregate: ${aggregate}()`);}
  let groupHasAggregate=hasAggregate(expression);
  if(!groupHasAggregate){
   const name=bareName(expression);
   if(name)try{direct(expression,sources);}
   catch(error){if(error instanceof NameResolutionError&&error.message.startsWith('no such column: ')){const alias=select.result.find(item=>item.alias&&sqliteIdentifierEqual(item.alias,name));groupHasAggregate=alias?hasAggregate(alias):false;}}
  }
  if(groupHasAggregate)throw new NameResolutionError('aggregate functions are not allowed in the GROUP BY clause');
 }
 return Object.freeze({source:select,sources,result:Object.freeze(output)});
}
