import type {ExprNode,SelectNode,SourceItem,WindowDefinitionNode} from './parse.ts';
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
 if(node.signature.includes(' STAR RP'))return 1;
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
 for(const source of eligible){const at=source.table.columns.findIndex(c=>sqliteIdentifierEqual(c.name,name));if(at>=0)found.push({source,columnIndex:at===integerPrimaryKeyIndex(source.table)?-1:at,name:source.table.columns[at]!.name});else if(!source.table.withoutRowid&&['rowid','_rowid_','oid'].some(x=>sqliteIdentifierEqual(x,name))&&!source.table.columns.some(c=>sqliteIdentifierEqual(c.name,name)))rowidCandidates.push({source,columnIndex:-1,name});}
 // resolve.c:lookupName retains rowid candidates only when no real column
 // matched anywhere in the current NameContext.
 if(found.length===0)found=rowidCandidates;
 // lookupName/tableAndColumnIndex: an unqualified USING name denotes one
 // merged column. RIGHT selects the RHS; INNER/LEFT retain the left-most.
 let mergedSources:readonly ResolvedColumnRef[]|null=null;
 if(qualifier===null)for(let i=1;i<sources.length;i++){const rhs=sources[i]!;if(!rhs.using?.some(x=>sqliteIdentifierEqual(x,name)))continue;const members=found.filter(x=>sources.indexOf(x.source)<=i);if(members.length>1){if(rhs.joinFromLeft.left&&rhs.joinFromLeft.right){mergedSources=Object.freeze(members);found=[members[0]!,...found.filter(x=>sources.indexOf(x.source)>i)];}else found=[...(rhs.joinFromLeft.right?[members.at(-1)!]:[members[0]!]),...found.filter(x=>sources.indexOf(x.source)>i)];}}
 const display=database?`${database}.${qualifier}.${name}`:qualifier===null?name:`${qualifier}.${name}`;if(found.length>1)throw new NameResolutionError(`ambiguous column name: ${display}`);if(!found.length){if(qualifier===null&&expressionTokens.length===1&&['current_date','current_time','current_timestamp'].includes(sqliteAsciiFold(expressionTokens[0]!.text)))return null;if(qualifier===null&&expressionTokens.length===1&&(expressionTokens[0]!.text.startsWith('"')&&expressionTokens[0]!.text.endsWith('"')||['true','false'].includes(sqliteAsciiFold(expressionTokens[0]!.text))))return null;throw new NameResolutionError(`no such column: ${display}`);}return {resolved:found[0]!,mergedSources};
}
function descriptor(name:string,resolved:ResolvedColumnRef|null):ResultColumnDescriptor{if(!resolved)return Object.freeze({name,declaredType:null,database:null,table:null,origin:null,affinity:null,collation:'BINARY'});const c=resolved.columnIndex<0?resolved.source.table.columns.find(column=>sqliteIdentifierEqual(column.name,resolved.name)):resolved.source.table.columns[resolved.columnIndex];if(!c)return Object.freeze({name,declaredType:null,database:'main',table:resolved.source.table.name,origin:null,affinity:'integer',collation:'BINARY'});return Object.freeze({name,declaredType:c.declaredType,database:'main',table:resolved.source.table.name,origin:c.name,affinity:c.affinity,collation:c.collation??'BINARY'});}
function mergedDescriptor(name:string,sources:readonly ResolvedColumnRef[]):ResultColumnDescriptor{const first=sources[0],column=first&&first.columnIndex>=0?first.source.table.columns[first.columnIndex]:null;return Object.freeze({name,declaredType:null,database:null,table:null,origin:null,affinity:column?.affinity??(first?'integer':null),collation:column?.collation??'BINARY'});}
function result(expression:ExprNode,resolved:ResolvedColumnRef|null,name:string,mergedSources:readonly ResolvedColumnRef[]|null=null):ResolvedResult{let resultDescriptor=mergedSources?mergedDescriptor(name,mergedSources):descriptor(name,resolved);if(resolved){const collateAt=expression.tokens.map(token=>token.text.toUpperCase()).lastIndexOf('COLLATE');if(collateAt>=0&&expression.tokens[collateAt+1]){const explicit=identifier(expression.tokens[collateAt+1]!.text),supported=['binary','nocase','rtrim'].find(name=>sqliteIdentifierEqual(name,explicit));if(!supported)throw new NameResolutionError(`no such collation sequence: ${explicit}`);resultDescriptor=Object.freeze({...resultDescriptor,collation:supported});}}return Object.freeze({name,expression,source:mergedSources?null:resolved?.source??null,columnIndex:mergedSources?null:resolved?.columnIndex??null,mergedSources:mergedSources?Object.freeze([...mergedSources]):null,resolution:mergedSources?'coalesce':resolved?'direct':'expression',descriptor:resultDescriptor});}
function resolveAgainstSources(expression:ExprNode,sources:readonly ResolvedSource[],aliases:readonly ExprNode[]=[],rejectAliasAggregate=false,rejectAggregateFunctions=false,rejectWindowFunctions=false,selectWindowNames:readonly string[]=[],windowDefinitions:readonly WindowDefinitionNode[]=[]):void{
 const tokens=(node:import('./lemon-runtime.ts').LemonValue<import('./tokenize.ts').SqlToken>):import('./tokenize.ts').SqlToken[]=>node.kind==='terminal'?(node.value?[node.value]:[]):node.children.flatMap(tokens);
 const walk=(node:import('./lemon-runtime.ts').LemonValue<import('./tokenize.ts').SqlToken>):void=>{
  if(node.kind==='terminal')return;
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
   if(filter&&over&&ownerToken&&ownerArityValid&&['row_number','rank','dense_rank','percent_rank','cume_dist','random','sqlite_version','changes','total_changes','last_insert_rowid','ntile','lag','lead','first_value','last_value','nth_value'].includes(ownerName)){walk(filter);throw new NameResolutionError('FILTER clause may only be used with aggregate window functions');}
   node.children.filter(child=>child!==filterOver).forEach(walk);
   const token=node.children.find(child=>child.kind==='terminal')?.value,count=functionArgumentCount(node);
   if(token&&count!==null){const name=sqliteAsciiFold(identifier(token.text)),star=node.signature.includes(' STAR RP'),valid=name==='count'?count<=1:star?false:name==='group_concat'?count===1||count===2:name==='string_agg'?count===2:['avg','sum','total'].includes(name)?count===1:['min','max'].includes(name)?count>=1:name==='median'?count===1:['percentile','percentile_cont','percentile_disc'].includes(name)?count===2:['json_group_array','jsonb_group_array'].includes(name)?count===1:['json_group_object','jsonb_group_object','median','percentile','percentile_cont','percentile_disc'].includes(name)?count===2:['row_number','rank','dense_rank','percent_rank','cume_dist'].includes(name)?count===0:name==='ntile'?count===1:['lag','lead'].includes(name)?count>=1&&count<=3:['first_value','last_value'].includes(name)?count===1:name==='nth_value'?count===2:['abs','lower','upper','quote','zeroblob','randomblob','unistr','unistr_quote','hex','length','octet_length','typeof','subtype','unicode','json','jsonb','json_error_position','json_quote','json_parse','sqlite_compileoption_used','sqlite_compileoption_get','sqlite_offset','sign'].includes(name)?count===1:name==='nullif'||name==='replace'?count===2+(name==='replace'?1:0):name==='substr'?count===2||count===3:name==='coalesce'?count>=2:['likely','unlikely'].includes(name)?count===1:['ltrim','rtrim','trim','unhex','round','load_extension'].includes(name)?count===1||count===2:name==='like'?count===2||count===3:['glob','json_patch','jsonb_patch'].includes(name)?count===2:['json_array_length','json_pretty','json_type','json_valid'].includes(name)?count===1||count===2:['instr','ifnull','sqlite_log','timediff'].includes(name)?count===2:name==='substring'?count===2||count===3:name==='concat'?count>=0:name==='concat_ws'?count>=1:['iif','if'].includes(name)?count>=2:name==='likelihood'?count===2:['ceil','ceiling','floor','trunc','ln','log10','log2','exp','acos','asin','atan','cos','sin','tan','cosh','sinh','tanh','acosh','asinh','atanh','sqrt','radians','degrees'].includes(name)?count===1:['pow','power','mod','atan2'].includes(name)?count===2:name==='log'?count===1||count===2:['random','sqlite_version','sqlite_source_id','changes','total_changes','last_insert_rowid','pi'].includes(name)?count===0:true;if(!valid)throw new NameResolutionError(`wrong number of arguments to function ${identifier(token.text)}()`);const distinct=node.children.some(child=>child.kind==='reduction'&&child.signature==='distinct ::= DISTINCT'),aggregate=['avg','count','group_concat','string_agg','sum','total','json_group_array','jsonb_group_array','json_group_object','jsonb_group_object','median','percentile','percentile_cont','percentile_disc'].includes(name)||(['min','max'].includes(name)&&count===1);if(aggregate&&distinct&&count!==1)throw new NameResolutionError('DISTINCT aggregates must have exactly one argument');}
   if(rejectAggregateFunctions&&!over&&hasAggregate({kind:'tokens',tokens:[],reduction:node})&&token)throw new NameResolutionError(`misuse of aggregate function ${identifier(token.text)}()`);
   if(ownerName==='likelihood'&&ownerCount===2){let argumentList=node.children.find(child=>child.kind==='reduction'&&child.signature.startsWith('exprlist ::='));if(argumentList?.kind==='reduction'&&argumentList.signature==='exprlist ::= nexprlist')argumentList=argumentList.children[0];const allArguments:(typeof argumentList)[]=[];const collectArguments=(part:typeof argumentList):void=>{if(part?.kind!=='reduction')return;if(part.signature.includes('::= nexprlist COMMA')){collectArguments(part.children[0]);allArguments.push(part.children.at(-1));}else allArguments.push(part.children.find(child=>child.kind==='reduction'&&child.signature.startsWith('expr ::=')));};collectArguments(argumentList);const second=allArguments[1],literal=second?tokens(second).map(item=>item.text).join(''):'';let unwrapped=literal;while(unwrapped.startsWith('(')&&unwrapped.endsWith(')'))unwrapped=unwrapped.slice(1,-1);const probability=/^(?:\d+\.\d+|\.\d+|\d+(?:\.\d+)?[eE][+-]?\d+)$/.test(unwrapped)?Number(unwrapped):NaN;if(!Number.isFinite(probability)||probability<0||probability>1)throw new NameResolutionError('second argument to likelihood() must be a constant between 0.0 and 1.0');}
   if(token&&count!==null){const name=sqliteAsciiFold(identifier(token.text)),known=['avg','count','group_concat','string_agg','sum','total','min','max','abs','lower','upper','quote','zeroblob','randomblob','unistr','unistr_quote','hex','length','octet_length','typeof','unicode','nullif','replace','substr','coalesce','char','likely','unlikely','likelihood','random','sqlite_version','changes','total_changes','last_insert_rowid','ltrim','rtrim','trim','instr','printf','format','unhex','subtype','round','concat','concat_ws','ifnull','sqlite_source_id','sqlite_log','unistr','unistr_quote','substring','iif','if','date','time','datetime','julianday','unixepoch','strftime','timediff','like','glob','load_extension','json','jsonb','json_array','jsonb_array','json_array_length','json_error_position','json_patch','jsonb_patch','json_pretty','json_quote','json_type','json_valid','json_extract','jsonb_extract','json_insert','jsonb_insert','json_object','jsonb_object','json_remove','jsonb_remove','json_replace','jsonb_replace','json_set','jsonb_set','json_array_insert','jsonb_array_insert','json_parse','json_group_array','jsonb_group_array','json_group_object','jsonb_group_object','median','percentile','percentile_cont','percentile_disc','sqlite_compileoption_used','sqlite_compileoption_get','sign','ceil','ceiling','floor','trunc','ln','log','log10','log2','exp','pow','power','mod','acos','asin','atan','atan2','cos','sin','tan','cosh','sinh','tanh','acosh','asinh','atanh','sqrt','radians','degrees','pi','median','percentile','percentile_cont','percentile_disc','sqlite_offset','row_number','rank','dense_rank','percent_rank','cume_dist','ntile','lag','lead','first_value','last_value','nth_value'].includes(name);if(!known)throw new NameResolutionError(`no such function: ${identifier(token.text)}`);}
   if(token&&count!==null){const name=sqliteAsciiFold(identifier(token.text)),aggregate=['avg','count','group_concat','string_agg','sum','total','json_group_array','jsonb_group_array','json_group_object','jsonb_group_object','median','percentile','percentile_cont','percentile_disc'].includes(name)||(['min','max'].includes(name)&&count===1),argumentsNode=node.children.find(child=>child.kind==='reduction'&&child.signature.startsWith('exprlist ::='));const nested=aggregate&&argumentsNode?firstAggregateName({kind:'tokens',tokens:[],reduction:argumentsNode}):null;if(nested)throw new NameResolutionError(`misuse of aggregate function ${nested}()`);}
   if(over&&token&&rejectWindowFunctions)throw new NameResolutionError(`misuse of window function ${identifier(token.text)}()`);
   if(over&&token&&count!==null){const name=sqliteAsciiFold(identifier(token.text)),window=['row_number','rank','dense_rank','percent_rank','cume_dist','ntile','lag','lead','first_value','last_value','nth_value','avg','count','group_concat','string_agg','sum','total','min','max','json_group_array','jsonb_group_array','json_group_object','jsonb_group_object','median','percentile','percentile_cont','percentile_disc'].includes(name);if(!window)throw new NameResolutionError(`${identifier(token.text)}() may not be used as a window function`);}
   if(over&&firstWindowName({kind:'tokens',tokens:[],reduction:over}))throw new NameResolutionError(`misuse of window function ${firstWindowName({kind:'tokens',tokens:[],reduction:over})}()`);
   if(over)resolveAgainstSources({kind:'tokens',tokens:[],reduction:over},sources,[],false,false,rejectWindowFunctions,selectWindowNames,windowDefinitions);
   const argumentsNode=node.children.find(child=>child.kind==='reduction'&&child.signature.startsWith('exprlist ::='));
   if(argumentsNode&&firstWindowName({kind:'tokens',tokens:[],reduction:argumentsNode}))throw new NameResolutionError(`misuse of window function ${firstWindowName({kind:'tokens',tokens:[],reduction:argumentsNode})}()`);
   if(filter&&firstWindowName({kind:'tokens',tokens:[],reduction:filter}))throw new NameResolutionError(`misuse of window function ${firstWindowName({kind:'tokens',tokens:[],reduction:filter})}()`);
   if(filter)walk(filter);
   if(filter){const nested=firstAggregateName({kind:'tokens',tokens:[],reduction:filter});if(nested)throw new NameResolutionError(`misuse of aggregate function ${nested}()`);}
   if(filter&&token&&count!==null){const name=sqliteAsciiFold(identifier(token.text)),aggregate=['avg','count','group_concat','string_agg','sum','total','json_group_array','jsonb_group_array','json_group_object','jsonb_group_object','median','percentile','percentile_cont','percentile_disc'].includes(name)||(['min','max'].includes(name)&&count===1);if(over&&!aggregate)throw new NameResolutionError('FILTER clause may only be used with aggregate window functions');if(!over&&!aggregate)throw new NameResolutionError(`FILTER may not be used with non-aggregate ${identifier(token.text)}()`);}
   return;
  }
  if(node.signature.startsWith('expr ::= expr COLLATE ')){node.children.forEach(walk);const collationToken=tokens(node).at(-1);if(collationToken){const name=identifier(collationToken.text);if(!['binary','nocase','rtrim'].some(candidate=>sqliteIdentifierEqual(candidate,name)))throw new NameResolutionError(`no such collation sequence: ${name}`);}return;}
  if(node.signature.startsWith('expr ::= nm DOT nm DOT nm')){direct({kind:'tokens',tokens:tokens(node)},sources);return;}
  if(node.signature.startsWith('expr ::= nm DOT nm')){direct({kind:'tokens',tokens:tokens(node)},sources);return;}
  if(node.signature.startsWith('expr ::= ID')||node.signature.startsWith('expr ::= INDEXED')||node.signature.startsWith('expr ::= JOIN_KW')){const tokens=node.children.flatMap(child=>child.kind==='terminal'&&child.value?[child.value]:[]);if(tokens.length){try{direct({kind:'tokens',tokens},sources);}catch(error){if(!(error instanceof NameResolutionError)||!error.message.startsWith('no such column: '))throw error;const name=identifier(tokens[0]!.text),matches=aliases.filter(item=>item.alias&&sqliteIdentifierEqual(item.alias,name));if(!matches[0])throw error;if(rejectAliasAggregate){const aggregate=firstAggregateName(matches[0]);if(aggregate)throw new NameResolutionError(`misuse of aggregate: ${aggregate}()`);}if(rejectWindowFunctions&&firstWindowName(matches[0]))throw new NameResolutionError(`misuse of aliased window function ${name}`);resolveAgainstSources(matches[0],sources,[],rejectAliasAggregate,rejectAggregateFunctions,rejectWindowFunctions,selectWindowNames,windowDefinitions);}return;}}
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
 for(let i=0;i<select.windowDefinitions.length;i++){const definition=select.windowDefinitions[i]!;if(definition.frameError)throw new NameResolutionError(definition.frameError);if(definition.baseName){let base:typeof definition|undefined;for(let j=i-1;j>=0;j--){const candidate=select.windowDefinitions[j]!;if(sqliteIdentifierEqual(candidate.name,definition.baseName)){base=candidate;break;}}if(base){if(base.hasFrame)throw new NameResolutionError(`cannot override frame specification of window: ${definition.baseName}`);if(base.partitionBy.length&&definition.partitionBy.length)throw new NameResolutionError(`cannot override PARTITION clause of window: ${definition.baseName}`);if(base.orderBy.length&&definition.orderBy.length)throw new NameResolutionError(`cannot override ORDER BY clause of window: ${definition.baseName}`);}}}
 const activeWindowDefinitions=new Set<WindowDefinitionNode>();
 const activateWindow=(name:string):void=>{const definition=[...select.windowDefinitions].reverse().find(candidate=>sqliteIdentifierEqual(candidate.name,name));if(!definition||activeWindowDefinitions.has(definition))return;activeWindowDefinitions.add(definition);if(definition.baseName)activateWindow(definition.baseName);};
 const scanWindowReferences=(node:import('./lemon-runtime.ts').LemonValue<import('./tokenize.ts').SqlToken>):void=>{if(node.kind==='terminal')return;if(node.signature==='over_clause ::= OVER nm'){const token=node.children.flatMap(child=>child.kind==='reduction'?child.children:[]).find(child=>child.kind==='terminal'&&child.value);if(token?.kind==='terminal'&&token.value)activateWindow(identifier(token.value.text));}else if(node.signature==='over_clause ::= OVER LP window RP'){const window=node.children.find(child=>child.kind==='reduction'&&child.signature.startsWith('window ::='));if(window?.kind==='reduction'&&window.signature.startsWith('window ::= nm')){const token=window.children.flatMap(child=>child.kind==='reduction'?child.children:[]).find(child=>child.kind==='terminal'&&child.value);if(token?.kind==='terminal'&&token.value)activateWindow(identifier(token.value.text));}}node.children.forEach(scanWindowReferences);};
 for(const expression of [...select.result,...select.groupBy,...select.orderBy.map(term=>term.expr),...(select.where?[select.where]:[]),...(select.having?[select.having]:[])])if(expression.reduction)scanWindowReferences(expression.reduction);
 for(const definition of activeWindowDefinitions){for(const expression of definition.partitionBy)resolveAgainstSources(expression,sources,[],false,false,false,select.windowNames,select.windowDefinitions);for(const expression of definition.orderBy)resolveAgainstSources(expression,sources,[],false,false,false,select.windowNames,select.windowDefinitions);}
 for(const expression of select.result){const tokens=expression.tokens,star=tokens.length===1&&tokens[0]!.text==='*',qualifiedStar=tokens.length===3&&tokens[1]!.text==='.'&&tokens[2]!.text==='*';if(star||qualifiedStar){const qualifier=qualifiedStar?identifier(tokens[0]!.text):null,selected=qualifier===null?sources:sources.filter(s=>sqliteIdentifierEqual(s.alias??s.tableName,qualifier));if(!selected.length)throw new NameResolutionError(`no such table: ${qualifier}`);for(const source of selected)source.table.columns.forEach((column,columnIndex)=>{if(qualifier===null&&source.using?.some(name=>sqliteIdentifierEqual(name,column.name)))return;output.push(result(expression,{source,columnIndex:columnIndex===integerPrimaryKeyIndex(source.table)?-1:columnIndex,name:column.name},column.name));});continue;}const match=direct(expression,sources);if(!match)resolveAgainstSources(expression,sources,[],false,false,false,select.windowNames,select.windowDefinitions);const resolved=match?.resolved??null,name=expression.alias??resolved?.name??tokens.map(t=>t.text).join(' ');output.push(result(expression,resolved,name,match?.mergedSources??null));}
 if(select.having){if(!select.groupBy.length&&!select.result.some(hasAggregate))throw new NameResolutionError('HAVING clause on a non-aggregate query');resolveAgainstSources(select.having,sources,select.result,false,false,true,select.windowNames,select.windowDefinitions);}
 if(select.where)resolveAgainstSources(select.where,sources,select.result,true,true,true,select.windowNames,select.windowDefinitions);
 for(let i=1;i<sources.length;i++){const source=sources[i]!;if(!source.on)continue;resolveAgainstSources(source.on,sources,select.result,true,true,true,select.windowNames,select.windowDefinitions);if(source.joinFromLeft.left||source.joinFromLeft.right||source.joinFromLeft.outer){try{resolveAgainstSources(source.on,sources.slice(0,i+1),select.result,true,true,true,select.windowNames,select.windowDefinitions);}catch(error){if(error instanceof NameResolutionError)throw new NameResolutionError('ON clause references tables to its right');throw error;}}}
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
  resolveAgainstSources(expression,sources,select.result,bareName(expression)===null&&collatedBareName(expression)===null,false,true,select.windowNames,select.windowDefinitions);
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
 if(select.limit)resolveAgainstSources(select.limit,[],[],false,true,true,select.windowNames,select.windowDefinitions);
 if(select.offset)resolveAgainstSources(select.offset,[],[],false,true,true,select.windowNames,select.windowDefinitions);
 for(let i=0;i<select.orderBy.length;i++){
  const expression=select.orderBy[i]!.expr,parsed=groupByInteger(expression);
  if(parsed!==null&&parsed>=-2147483647n&&parsed<=2147483647n){const ordinal=Number(parsed);if(ordinal<1||ordinal>output.length){const n=i+1,suffix=n%100>=11&&n%100<=13?'th':n%10===1?'st':n%10===2?'nd':n%10===3?'rd':'th';throw new NameResolutionError(`${n}${suffix} ORDER BY term out of range - should be between 1 and ${output.length}`);}continue;}
  if(select.hasCompound){const normalizedTokens=(value:ExprNode,arm:SelectNode['arms'][number],skipLikely=false)=>{let tokens=[...value.tokens];if(skipLikely&&tokens.length>=4&&['likely','unlikely','likelihood'].includes(sqliteAsciiFold(identifier(tokens[0]!.text)))&&tokens[1]!.text==='('&&tokens.at(-1)!.text===')'){let depth=0,end=tokens.length-1;for(let i=2;i<tokens.length-1;i++){if(tokens[i]!.text==='(')depth++;else if(tokens[i]!.text===')')depth--;else if(tokens[i]!.text===','&&depth===0){end=i;break;}}tokens=tokens.slice(2,end);}while(tokens.length>=2&&tokens.at(-2)?.text.toUpperCase()==='COLLATE')tokens=tokens.slice(0,-2);while(tokens.length>=2&&tokens[0]?.text==='('&&tokens.at(-1)?.text===')')tokens=tokens.slice(1,-1);const output:typeof tokens=[];for(let i=0;i<tokens.length;){if(i+2<tokens.length&&sqliteAsciiFold(tokens[i]!.text)==='is'&&sqliteAsciiFold(tokens[i+1]!.text)==='not'&&sqliteAsciiFold(tokens[i+2]!.text)==='null'){output.push({...tokens[i]!,text:'notnull'});i+=3;continue;}if(i+1<tokens.length&&sqliteAsciiFold(tokens[i]!.text)==='is'&&sqliteAsciiFold(tokens[i+1]!.text)==='null'){output.push({...tokens[i]!,text:'isnull'});i+=2;continue;}const three=i+4<tokens.length&&tokens[i+1]?.text==='.'&&tokens[i+3]?.text==='.'&&arm.from.items.some(source=>sqliteIdentifierEqual(identifier(tokens[i]!.text),source.databaseName??'main')&&sqliteIdentifierEqual(identifier(tokens[i+2]!.text),source.alias??source.tableName));if(three){output.push(tokens[i+4]!);i+=5;continue;}const two=i+2<tokens.length&&tokens[i+1]?.text==='.'&&arm.from.items.some(source=>sqliteIdentifierEqual(identifier(tokens[i]!.text),source.alias??source.tableName));if(two){output.push(tokens[i+2]!);i+=3;continue;}output.push(tokens[i]!);i++;}return output;},collationTokens=expression.tokens,collationAt=collationTokens.map(token=>sqliteAsciiFold(token.text)).lastIndexOf('collate'),_validatedCollation=collationAt>=0&&collationTokens[collationAt+1]?(()=>{const value=identifier(collationTokens[collationAt+1]!.text);if(!['binary','nocase','rtrim'].some(item=>sqliteIdentifierEqual(item,value)))throw new NameResolutionError(`no such collation sequence: ${value}`);return true;})():false,name=bareName(expression)??collatedBareName(expression),sameExpression=(left:ExprNode,right:ExprNode,arm:SelectNode['arms'][number])=>{const a=normalizedTokens(left,arm,true),b=normalizedTokens(right,arm);if(a.some(token=>token.kind==='variable'&&token.text==='?')||b.some(token=>token.kind==='variable'&&token.text==='?'))return false;return a.length===b.length&&a.every((token,index)=>{const other=b[index]!;const operator=(text:string)=>text==='!='||text==='<>'?'!=':text==='=='||text==='='?'=':sqliteAsciiFold(text)==='isnull'?'is null':sqliteAsciiFold(text);const stringValue=(item:typeof token):string|null=>item.kind==='string'?item.text.slice(1,-1).replaceAll("''","'"):item.text.startsWith('\"')&&item.text.endsWith('\"')?identifier(item.text):null,aString=stringValue(token),bString=stringValue(other);if(aString!==null&&bString!==null)return aString===bString;return token.kind===other.kind&&(token.kind==='id'||token.kind==='keyword'||['!=','<>','==','='].includes(token.text)?operator(token.text)===operator(other.text):token.kind==='integer'?BigInt(token.text)===BigInt(other.text):token.text===other.text);});},matchesAlias=name!==null&&select.arms.some(arm=>arm.result.some(item=>item.alias&&sqliteIdentifierEqual(item.alias,name))),matchesExpression=select.arms.some(arm=>arm.result.some(item=>sameExpression(item,expression,arm)));if(!matchesAlias&&!matchesExpression){const n=i+1,suffix=n%100>=11&&n%100<=13?'th':n%10===1?'st':n%10===2?'nd':n%10===3?'rd':'th';throw new NameResolutionError(`${n}${suffix} ORDER BY term does not match any column in the result set`);}}
  else resolveAgainstSources(expression,sources,select.result,false,false,false,select.windowNames,select.windowDefinitions);
  const aggregate=hasAggregate(expression)?firstAggregateName(expression):null;
  if(aggregate&&!select.groupBy.length&&!select.result.some(hasAggregate))throw new NameResolutionError(`misuse of aggregate: ${aggregate}()`);
 }
 return Object.freeze({source:select,sources,result:Object.freeze(output)});
}
