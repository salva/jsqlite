// Development browser lane ledger. Assertion results, never declared counts,
// determine success; launch failure leaves every case unattempted.
export function browserLedger(encodings, settled = [], failure = null) {
 const cases=encodings.map((encoding,index)=>{
  const result=settled[index];
  if(result)return {encoding,status:'passed',result};
  if(failure?.index===index)return {encoding,status:'failed',error:String(failure.error)};
  return {encoding,status:'unattempted'};
 });
 const passed=cases.filter(c=>c.status==='passed').length;
 const failed=cases.filter(c=>c.status==='failed').length;
 return {lane:'browser-public-internal-no-upstream-credit',declared:cases.length,
  attempted:passed+failed,passed,failed,unattempted:cases.length-passed-failed,
  ...(failure?{error:String(failure.error)}:{}),cases};
}
