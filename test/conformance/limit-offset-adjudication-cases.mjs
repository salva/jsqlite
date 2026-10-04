// Shared cases consumed by the public lifecycle check and pinned ctypes oracle.
export const limitCases = [
  {sql:"SELECT 1 LIMIT 0 OFFSET 'x'",rows:[]},
  {sql:'SELECT 1 LIMIT 0 OFFSET NULL',rows:[]},
  {sql:"SELECT 1 LIMIT 0.0 OFFSET 'x'",rows:[]},
  {sql:"SELECT 1 LIMIT '0' OFFSET 'x'",rows:[]},
  {sql:"SELECT 1 LIMIT NULL OFFSET 'x'",error:20},
  {sql:"SELECT 1 LIMIT 1.5 OFFSET 'x'",error:20},
  {sql:"SELECT 1 LIMIT -1 OFFSET 'x'",error:20},
  {sql:'SELECT 1 LIMIT 1 OFFSET NULL',error:20},
  {sql:'SELECT 1 LIMIT -1 OFFSET -2',rows:[[1]]},
  {sql:'SELECT 1 LIMIT ? OFFSET ?',bindings:[0,'bad'],rows:[]},
  {sql:'SELECT 1 LIMIT ? OFFSET ?',bindings:[1,'bad'],error:20},
  {sql:'SELECT 1 LIMIT ? OFFSET ?',bindings:[-1,1],rows:[]},
  {sql:"SELECT (SELECT 1 LIMIT 0 OFFSET 'x')",rows:[[null]]},
  {sql:"SELECT v FROM (SELECT 1 AS v LIMIT 0 OFFSET NULL)",rows:[]},
  {sql:"SELECT count(*) OVER () FROM storage_values LIMIT 0 OFFSET 'x'",rows:[]},
  {sql:"SELECT 1 UNION ALL SELECT 2 LIMIT 0 OFFSET 'x'",rows:[]},
];
