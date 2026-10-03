import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';
const root=path.resolve('test/fixtures');const current=JSON.parse(fs.readFileSync(path.join(root,'CURRENT.json'),'utf8'));
const bytes=fs.readFileSync(path.join(root,'generations',current.generationId,'generated/subquery-utf8.db'));
const cases=[
 ['SELECT (SELECT count(*) FROM (SELECT 9 AS x LIMIT 0) d HAVING count(*)=0) AS n, EXISTS(SELECT count(*) FROM (SELECT 9 AS x LIMIT 0) d HAVING count(*)=0) AS hit, 0 IN (SELECT count(*) FROM (SELECT 9 AS x LIMIT 0) d HAVING count(*)=0) AS member',['n','hit','member'],[[['integer',0n],['integer',1n],['integer',1n]]]],
 ['SELECT (SELECT count(*) FROM (SELECT 9 AS x LIMIT 1) d HAVING count(*)=0) AS n, EXISTS(SELECT count(*) FROM (SELECT 9 AS x LIMIT 1) d HAVING count(*)=0) AS hit',['n','hit'],[[['null',null],['integer',0n]]]],
 ['SELECT (SELECT count(*) FROM (SELECT 9 AS x LIMIT 1) d HAVING count(*)=1 LIMIT 0) AS n',['n'],[[['null',null]]]],
 ['SELECT (SELECT count(*) FROM (SELECT 9 AS x LIMIT 0) d HAVING count(*)=1) AS n',['n'],[[['null',null]]]],
 ['SELECT (SELECT count(*) FROM (SELECT 9 AS x LIMIT 0) d HAVING count(*)=0 LIMIT 1 OFFSET 1) AS n',['n'],[[['null',null]]]],
 ['SELECT (SELECT count(*) FROM (SELECT 9 AS x LIMIT 1) d HAVING count(*)>0) AS n',['n'],[[['integer',1n]]]],
 ['SELECT (SELECT count(*) FROM (SELECT 9 AS x LIMIT 1) d HAVING count(*)=1 AND 1) AS n',['n'],[[['integer',1n]]]],
 ['SELECT (SELECT count(*) AS n FROM (SELECT 9 AS x LIMIT 0) d HAVING count(*)=0 ORDER BY n DESC) AS v, 0 IN (SELECT count(*) FROM (SELECT 9 AS x LIMIT 0) d HAVING count(*)=0 ORDER BY count(*)) AS member',['v','member'],[[['integer',0n],['integer',1n]]]],
 ['SELECT (SELECT count(*) FROM (SELECT 9 AS x LIMIT 0) d HAVING count(*)=0 ORDER BY 9+0) AS v',['v'],[[['integer',0n]]]],
 ['SELECT (SELECT count(*) FROM (SELECT 9 AS x LIMIT 0) d HAVING count(*)=0 ORDER BY d.x DESC) AS n, EXISTS(SELECT count(*) FROM (SELECT 9 AS x LIMIT 0) d HAVING count(*)=0 ORDER BY x) AS hit',['n','hit'],[[['integer',0n],['integer',1n]]]],
 ['SELECT (SELECT count(*) FROM (SELECT 9 AS x LIMIT 1) d ORDER BY d.x LIMIT 0) AS n',['n'],[[['null',null]]]],
 ['SELECT (SELECT count(*) FROM (SELECT 9 AS x LIMIT 1) d ORDER BY x+1 LIMIT 1 OFFSET 1) AS n',['n'],[[['null',null]]]],
 ['SELECT (SELECT count(*) FROM (SELECT 9 AS x LIMIT 0) d WHERE 0) AS n, EXISTS(SELECT count(*) FROM (SELECT 9 AS x LIMIT 0) d WHERE 0) AS hit',['n','hit'],[[['integer',0n],['integer',1n]]]],
 ['SELECT (SELECT count(*) FROM (SELECT 9 AS x LIMIT 1) d WHERE d.x=9 HAVING count(*)=1) AS n, 0 IN (SELECT count(*) FROM (SELECT 9 AS x LIMIT 1) d WHERE x=8) AS member',['n','member'],[[['integer',1n],['integer',1n]]]],
 ['SELECT (SELECT count(*) FROM (SELECT 9 AS x, 8 AS y LIMIT 1) d WHERE d.y=8) AS n, EXISTS(SELECT count(*) FROM (SELECT 9 AS x, 8 AS y LIMIT 0) d WHERE y=8) AS hit',['n','hit'],[[['integer',1n],['integer',1n]]]],
 ['SELECT 0 IN (SELECT count(*) FROM (SELECT 9 AS x, 8 AS y LIMIT 1) d WHERE d.y=0) AS member, (SELECT count(*) FROM (SELECT 9 AS x, 8 AS y LIMIT 1) d WHERE d.y=8 ORDER BY d.y) AS n',['member','n'],[[['integer',1n],['integer',1n]]]],
 ['SELECT (SELECT count(*) FROM (SELECT 9 AS x, 8 AS y LIMIT 1) d ORDER BY d.y LIMIT 0) AS n',['n'],[[['null',null]]]],
 ['SELECT (SELECT count(*) FROM (SELECT 9 AS x, 8 AS x LIMIT 1) d WHERE d."x:1"=8) AS n',['n'],[[['integer',1n]]]],
 ['SELECT (SELECT count(*) FROM (SELECT 9 AS x, 8 AS x LIMIT 1) d WHERE d.x=8) AS n',['n'],[[['integer',0n]]]],
 ['SELECT (SELECT count(*) FROM (SELECT 9 AS x, 8 AS y LIMIT 1) d WHERE d.y IS NULL) AS n',['n'],[[['integer',0n]]]],
 ['SELECT (SELECT count(*) FROM (SELECT 9 AS x, 8 AS y LIMIT 0) d WHERE d.y=8 HAVING count(*)=0) AS n',['n'],[[['integer',0n]]]],
 ['SELECT (SELECT count(*) FROM (SELECT 9 AS x, 8 AS y ORDER BY x DESC LIMIT 1) d WHERE d.y=8) AS n, EXISTS(SELECT count(*) FROM (SELECT 9 AS x, 8 AS y ORDER BY y LIMIT 0) d) AS hit',['n','hit'],[[['integer',1n],['integer',1n]]]],
 ['SELECT 0 IN (SELECT count(*) FROM (SELECT 9 AS x, 8 AS y ORDER BY 2 LIMIT 1) d WHERE d.y=7) AS member, (SELECT count(*) FROM (SELECT 9 AS x, 8 AS y ORDER BY y+0 LIMIT 1) d HAVING count(*)=1) AS n',['member','n'],[[['integer',1n],['integer',1n]]]],
 ['SELECT (SELECT count(*) FROM (SELECT 9 AS x, 8 AS y ORDER BY 8+0 LIMIT 0) d) AS n',['n'],[[['integer',0n]]]],
 ['SELECT (SELECT count(*) FROM (SELECT DISTINCT 9 AS x, 8 AS y LIMIT 1) d WHERE d.y=8) AS n, EXISTS(SELECT count(*) FROM (SELECT DISTINCT 9 AS x LIMIT 0) d) AS hit',['n','hit'],[[['integer',1n],['integer',1n]]]],
 ['SELECT 0 IN (SELECT count(*) FROM (SELECT DISTINCT 9 AS x, 8 AS y WHERE 0) d) AS member, (SELECT count(*) FROM (SELECT DISTINCT 9 AS x, 8 AS y ORDER BY y DESC LIMIT 1) d HAVING count(*)=1) AS n',['member','n'],[[['integer',1n],['integer',1n]]]],
 ['SELECT (SELECT count(d.x) FROM (SELECT NULL AS x, 8 AS y) d) AS n, EXISTS(SELECT count(d.x) FROM (SELECT NULL AS x) d) AS hit',['n','hit'],[[['integer',0n],['integer',1n]]]],
 ['SELECT 0 IN (SELECT count(d.x) FROM (SELECT NULL AS x) d) AS member, (SELECT count(d.x) FROM (SELECT 9 AS x, 8 AS y LIMIT 1) d WHERE d.y=8 HAVING count(d.x)=1) AS n',['member','n'],[[['integer',1n],['integer',1n]]]],
 ['SELECT (SELECT count(d.x) FROM (SELECT 9 AS x, 8 AS y LIMIT 0) d HAVING count(d.x)=0) AS n',['n'],[[['integer',0n]]]],
 ['SELECT (SELECT count(d.x+1) FROM (SELECT 9 AS x) d HAVING count(d.x+1)=1) AS n',['n'],[[['integer',1n]]]],
 ['SELECT (SELECT count(d.x) FROM (SELECT NULL AS x, 8 AS y) d HAVING count(d.y)=1) AS n, EXISTS(SELECT count(d.x) FROM (SELECT NULL AS x, 8 AS y) d HAVING count(d.y)=0) AS hit',['n','hit'],[[['integer',0n],['integer',0n]]]],
 ['SELECT 0 IN (SELECT count(d.x) FROM (SELECT NULL AS x, 8 AS y) d HAVING count(d.y)=1) AS member, (SELECT count(d.x) FROM (SELECT 9 AS x, 8 AS y LIMIT 0) d HAVING count(d.y)=0) AS n',['member','n'],[[['integer',1n],['integer',0n]]]],
 ['SELECT (SELECT count(d.x) FROM (SELECT NULL AS x, 8 AS y) d HAVING count(d.y)>0 AND count(d.x)=0) AS n',['n'],[[['integer',0n]]]],
 ['SELECT (SELECT count(DISTINCT d.x) FROM (SELECT NULL AS x, 8 AS y) d) AS n, EXISTS(SELECT count(DISTINCT d.x) FROM (SELECT 9 AS x) d) AS hit',['n','hit'],[[['integer',0n],['integer',1n]]]],
 ['SELECT 0 IN (SELECT count(DISTINCT d.x) FROM (SELECT NULL AS x) d) AS member, (SELECT count(d.x) FROM (SELECT 9 AS x, NULL AS y) d HAVING count(DISTINCT d.y)=0 AND count(DISTINCT d.x)=1) AS n',['member','n'],[[['integer',1n],['integer',1n]]]],
 ['SELECT (SELECT count(DISTINCT d.x) FROM (SELECT 9 AS x, 8 AS y LIMIT 0) d HAVING count(DISTINCT d.y)=0) AS n',['n'],[[['integer',0n]]]],
 ['SELECT (SELECT count(*) FILTER (WHERE d.x IS NULL) FROM (SELECT NULL AS x, 8 AS y) d) AS n, EXISTS(SELECT count(*) FILTER (WHERE d.x=9) FROM (SELECT NULL AS x) d) AS hit',['n','hit'],[[['integer',1n],['integer',1n]]]],
 ['SELECT 0 IN (SELECT count(d.x) FILTER (WHERE d.y=8) FROM (SELECT NULL AS x, 8 AS y) d) AS member, (SELECT count(*) FROM (SELECT 9 AS x, NULL AS y) d HAVING count(*) FILTER (WHERE d.y IS NULL)=1 AND count(*) FILTER (WHERE d.x IS NULL)=0) AS n',['member','n'],[[['integer',1n],['integer',1n]]]],
 ['SELECT (SELECT count(*) FILTER (WHERE d.x=9) FROM (SELECT 9 AS x LIMIT 0) d HAVING count(*) FILTER (WHERE d.x=9)=0) AS n',['n'],[[['integer',0n]]]],
 ['SELECT (SELECT count(DISTINCT d.x) FILTER (WHERE d.y=8) FROM (SELECT 9 AS x, 8 AS y) d HAVING count(d.x) FILTER (WHERE d.y=0)=0) AS n',['n'],[[['integer',1n]]]],
 ['SELECT (SELECT count(d.x ORDER BY d.y DESC) FROM (SELECT 9 AS x,8 AS y) d) AS n, EXISTS(SELECT count(d.x ORDER BY d.x) FROM (SELECT 9 AS x) d) AS hit',['n','hit'],[[['integer',1n],['integer',1n]]]],
 ['SELECT 0 IN (SELECT count(d.x ORDER BY d.x) FROM (SELECT NULL AS x) d) AS member, (SELECT count(d.x ORDER BY d.y) FROM (SELECT 9 AS x,8 AS y LIMIT 0) d HAVING count(d.x ORDER BY d.y)=0) AS n',['member','n'],[[['integer',1n],['integer',0n]]]],
 ['SELECT (SELECT count(d.x ORDER BY d.y) FILTER (WHERE d.y=8) FROM (SELECT 9 AS x,8 AS y) d HAVING count(d.x ORDER BY d.y) FILTER (WHERE d.y=8)=1) AS n',['n'],[[['integer',1n]]]],
 ['SELECT (SELECT sum(d.x) FROM (SELECT 9 AS x) d) AS s, EXISTS(SELECT total(d.x) FROM (SELECT NULL AS x) d) AS hit',['s','hit'],[[['integer',9n],['integer',1n]]]],
 ['SELECT NULL IN (SELECT sum(d.x) FROM (SELECT NULL AS x) d) AS member, (SELECT total(d.x) FROM (SELECT 9 AS x LIMIT 0) d) AS total, (SELECT avg(d.x) FROM (SELECT 9 AS x LIMIT 0) d) AS avg',['member','total','avg'],[[['null',null],['real',0],['null',null]]]],
 ['SELECT (SELECT sum(d.x) FROM (SELECT 9 AS x, 8 AS y) d HAVING avg(d.y)=8) AS s',['s'],[[['integer',9n]]]],
 ['SELECT (SELECT sum(d.x) FROM (SELECT 1.5 AS x) d) AS s, (SELECT avg(d.x) FROM (SELECT 9 AS x) d) AS a, (SELECT total(d.x) FROM (SELECT NULL AS x) d) AS t',['s','a','t'],[[['real',1.5],['real',9],['real',0]]]],
 ['SELECT (SELECT sum(DISTINCT d.x) FILTER (WHERE d.y=8) FROM (SELECT 9 AS x,8 AS y) d HAVING total(d.y)=8 AND avg(d.x)=9) AS s',['s'],[[['integer',9n]]]],
 ['SELECT (SELECT sum(d.x) FROM (SELECT 9 AS x LIMIT 0) d HAVING count(*)=0) AS s, (SELECT total(d.x) FROM (SELECT 9 AS x LIMIT 0) d HAVING sum(d.x) IS NULL) AS t',['s','t'],[[['null',null],['real',0]]]],
 ['SELECT (SELECT min(d.x) FROM (SELECT 9 AS x) d) AS lo, EXISTS(SELECT max(d.x) FROM (SELECT NULL AS x) d) AS hit',['lo','hit'],[[['integer',9n],['integer',1n]]]],
 ['SELECT NULL IN (SELECT min(d.x) FROM (SELECT NULL AS x) d) AS member, (SELECT max(d.x) FROM (SELECT 9 AS x LIMIT 0) d) AS empty',['member','empty'],[[['null',null],['null',null]]]],
 ['SELECT (SELECT min(d.x COLLATE NOCASE) FROM (SELECT 9 AS x, 8 AS y) d HAVING max(d.y)=8) AS lo',['lo'],[[['integer',9n]]]],
 ['SELECT (SELECT max(d.x) FILTER (WHERE d.y=8) FROM (SELECT 9 AS x,8 AS y) d HAVING min(d.y)=8) AS hi',['hi'],[[['integer',9n]]]],
 ["SELECT (SELECT min(d.x COLLATE NOCASE) FROM (SELECT 'Zulu' AS x) d) AS lo",['lo'],[[['text','Zulu']]]],
 ["SELECT (SELECT min(d.x) FROM (SELECT NULL AS x) d HAVING min(d.x) IS NULL) AS lo, (SELECT max(d.x) FROM (SELECT 'a' AS x LIMIT 0) d) AS hi",['lo','hi'],[[['null',null],['null',null]]]],
 ["SELECT (SELECT group_concat(d.x) FROM (SELECT 'Hi' AS x) d) AS s, EXISTS(SELECT group_concat(d.x) FROM (SELECT NULL AS x) d) AS hit",['s','hit'],[[['text','Hi'],['integer',1n]]]],
 ["SELECT 'Hi' IN (SELECT group_concat(d.x, d.sep) FROM (SELECT 'Hi' AS x, ':' AS sep) d) AS member, (SELECT string_agg(d.x,d.sep) FROM (SELECT 'Hi' AS x, ':' AS sep LIMIT 0) d) AS empty",['member','empty'],[[['integer',1n],['null',null]]]],
 ["SELECT (SELECT group_concat(d.x, d.sep) FROM (SELECT 'Hi' AS x, ':' AS sep) d HAVING string_agg(d.x,d.sep)='Hi') AS s",['s'],[[['text','Hi']]]],
 ["SELECT (SELECT group_concat(d.x,d.sep) FILTER (WHERE d.keep=1) FROM (SELECT 'Hi' AS x, ':' AS sep, 1 AS keep) d HAVING count(*)=1) AS s",['s'],[[['text','Hi']]]],
 ["SELECT (SELECT group_concat(DISTINCT d.x ORDER BY d.sep) FROM (SELECT 'Hi' AS x, ':' AS sep) d HAVING group_concat(d.x,d.sep)='Hi') AS s",['s'],[[['text','Hi']]]],
 ["SELECT (SELECT string_agg(d.x,d.sep) FROM (SELECT NULL AS x, ':' AS sep) d) AS s, (SELECT group_concat(d.x) FROM (SELECT 'Hi' AS x LIMIT 0) d) AS empty",['s','empty'],[[['null',null],['null',null]]]],
 ['SELECT (SELECT count(*) FROM (SELECT 9 AS x GROUP BY 1) d) AS n, EXISTS(SELECT count(*) FROM (SELECT 9 AS x GROUP BY 1) d) AS hit',['n','hit'],[[['integer',1n],['integer',1n]]]],
 ['SELECT 9 IN (SELECT sum(d.x) FROM (SELECT 9 AS x GROUP BY x) d) AS member, (SELECT count(*) FROM (SELECT 9 AS x WHERE 0 GROUP BY 1) d) AS empty',['member','empty'],[[['integer',1n],['integer',0n]]]],
 ['SELECT (SELECT count(*) FROM (SELECT 9 AS x GROUP BY 1 ORDER BY 1 DESC LIMIT 0) d) AS n',['n'],[[['integer',0n]]]],
 ['SELECT (SELECT sum(d.x) FROM (SELECT 9 AS x, 8 AS y GROUP BY y ORDER BY 1 DESC) d HAVING count(*)=1) AS s',['s'],[[['integer',9n]]]],
 ['SELECT (SELECT count(*) FROM (SELECT 9 AS x GROUP BY x HAVING x=9) d) AS n, EXISTS(SELECT count(*) FROM (SELECT 9 AS x GROUP BY x HAVING x=0) d HAVING count(*)>0) AS hit',['n','hit'],[[['integer',1n],['integer',0n]]]],
 ['SELECT 9 IN (SELECT sum(d.x) FROM (SELECT 9 AS x GROUP BY 1 HAVING x=9) d) AS member, (SELECT count(*) FROM (SELECT 9 AS x GROUP BY 1 HAVING NULL) d) AS empty',['member','empty'],[[['integer',1n],['integer',0n]]]],
 ['SELECT (SELECT count(*) FROM (SELECT 9 AS x GROUP BY x HAVING x=9 LIMIT 1 OFFSET 1) d) AS n',['n'],[[['integer',0n]]]],
 ['SELECT (SELECT count(*) FROM (SELECT 9 AS x GROUP BY x HAVING x=9 LIMIT 1 OFFSET 0) d) AS n',['n'],[[['integer',1n]]]],
 ['SELECT (SELECT count(*) FROM (SELECT 9 AS x GROUP BY x HAVING count(*)=1) d) AS n, (SELECT count(*) FROM (SELECT 9 AS x GROUP BY x HAVING count(*)=2) d) AS absent',['n','absent'],[[['integer',1n],['integer',0n]]]],
 ['SELECT 9 IN (SELECT sum(d.x) FROM (SELECT 9 AS x GROUP BY 1 HAVING count(*)=1) d) AS member, EXISTS(SELECT count(*) FROM (SELECT 9 AS x GROUP BY 1 HAVING count(*)=0) d HAVING count(*)>0) AS empty',['member','empty'],[[['integer',1n],['integer',0n]]]],
 ['SELECT (SELECT count(*) FROM (SELECT 9 AS x WHERE 0 GROUP BY x HAVING count(*)=0) d) AS n, (SELECT count(*) FROM (SELECT 9 AS x GROUP BY x HAVING count(*)=1 LIMIT 1 OFFSET 1) d) AS off',['n','off'],[[['integer',0n],['integer',0n]]]],
 ['SELECT (SELECT count(*) FROM (SELECT 9 AS x GROUP BY x HAVING count(*)=1 AND x=9 ORDER BY 1 DESC LIMIT 1) d) AS n',['n'],[[['integer',1n]]]],
 ['SELECT (SELECT count(*) FROM (SELECT 9 AS x GROUP BY x HAVING count(*)=2 AND x=9 LIMIT 0) d) AS n',['n'],[[['integer',0n]]]],
 ['SELECT (SELECT count(*) FROM (SELECT 9 AS x GROUP BY x HAVING count(x)=1) d) AS n, (SELECT count(*) FROM (SELECT NULL AS x GROUP BY x HAVING count(x)=1) d) AS absent',['n','absent'],[[['integer',1n],['integer',0n]]]],
 ['SELECT 9 IN (SELECT sum(d.x) FROM (SELECT 9 AS x GROUP BY x HAVING count(DISTINCT x)=1) d) AS member, EXISTS(SELECT count(*) FROM (SELECT 9 AS x GROUP BY x HAVING count(x) FILTER (WHERE 0)=1) d HAVING count(*)>0) AS empty',['member','empty'],[[['integer',1n],['integer',0n]]]],
 ['SELECT (SELECT count(*) FROM (SELECT 9 AS x WHERE 0 GROUP BY x HAVING count(x)=0) d) AS n',['n'],[[['integer',0n]]]],
 ['SELECT (SELECT count(*) FROM (SELECT 9 AS x GROUP BY x HAVING sum(x)=9 AND avg(x)=9.0 AND total(x)=9.0) d) AS n',['n'],[[['integer',1n]]]],
 ['SELECT (SELECT count(*) FROM (SELECT NULL AS x GROUP BY x HAVING sum(x) IS NULL AND total(x)=0.0) d) AS n',['n'],[[['integer',1n]]]],
 ['SELECT (SELECT count(*) FROM (SELECT 9 AS x GROUP BY x HAVING min(x)=9 AND max(x)=9) d) AS n',['n'],[[['integer',1n]]]],
 ["SELECT (SELECT count(*) FROM (SELECT 'Hi' AS x, ':' AS sep GROUP BY x HAVING group_concat(x,sep)='Hi' AND string_agg(x,sep)='Hi') d) AS n",['n'],[[['integer',1n]]]],
 ["SELECT (SELECT count(*) FROM (SELECT NULL AS x, ':' AS sep GROUP BY x HAVING group_concat(x) IS NULL) d) AS n",['n'],[[['integer',1n]]]],
 ["SELECT (SELECT count(*) FROM (SELECT 'Hi' AS x GROUP BY x HAVING max(x COLLATE NOCASE)='Hi') d) AS n",['n'],[[['integer',1n]]]],
 ["SELECT (SELECT count(*) FROM (SELECT 9 AS x GROUP BY x HAVING group_concat(x ORDER BY x DESC)='9') d) AS n",['n'],[[['integer',1n]]]],
 ["SELECT (SELECT count(*) FROM (SELECT 9 AS x, ':' AS sep GROUP BY x HAVING string_agg(x,sep ORDER BY x DESC)='9') d) AS n",['n'],[[['integer',1n]]]],
 ['SELECT 9 IN (SELECT sum(d.x) FROM (SELECT 9 AS x GROUP BY x HAVING sum(x ORDER BY x DESC)=9) d) AS member',['member'],[[['integer',1n]]]],
 ['SELECT (SELECT count(*) FROM (SELECT NULL AS x GROUP BY x HAVING group_concat(x ORDER BY x) IS NULL) d) AS n',['n'],[[['integer',1n]]]],
 // select.c nested producer LIMIT gates input; outer LIMIT/OFFSET gates its final count row.
 ['SELECT (SELECT count(*) FROM (SELECT 9 AS x LIMIT 1) d LIMIT -1 OFFSET -1) AS n',['n'],[[['integer',1n]]]],
 ['SELECT (SELECT count(*) FROM (SELECT 9 AS x LIMIT 1) d LIMIT 1 OFFSET 4) AS n',['n'],[[['null',null]]]],
 ['SELECT (SELECT count(*) FROM (SELECT 9 AS x LIMIT 0) d LIMIT 0) AS n, EXISTS(SELECT count(*) FROM (SELECT 9 AS x LIMIT 0) d LIMIT 0) AS hit',['n','hit'],[[['null',null],['integer',0n]]]],
 ['SELECT (SELECT count(*) FROM (SELECT 9 AS x LIMIT 0) d LIMIT 1 OFFSET 0) AS n, EXISTS(SELECT count(*) FROM (SELECT 9 AS x LIMIT 0) d LIMIT 1 OFFSET 1) AS hit',['n','hit'],[[['integer',0n],['integer',0n]]]],
 ['SELECT (SELECT count(*) FROM (SELECT 9 AS x LIMIT 1) d LIMIT 1 OFFSET 1) AS n, 1 IN (SELECT count(*) FROM (SELECT 9 AS x LIMIT 1) d LIMIT 0) AS member',['n','member'],[[['null',null],['integer',0n]]]],
 // Pinned select.c GROUP BY has one zero-source input only if WHERE accepts it.
 ['SELECT (SELECT 7 GROUP BY 7+0) AS v, EXISTS(SELECT 7 GROUP BY 7+0) AS hit, 7 IN (SELECT 7 GROUP BY 7+0) AS member',['v','hit','member'],[[['integer',7n],['integer',1n],['integer',1n]]]],
 ['SELECT (SELECT 7 WHERE 0 GROUP BY 7+0) AS v, EXISTS(SELECT 7 WHERE 0 GROUP BY 7+0) AS hit',['v','hit'],[[['null',null],['integer',0n]]]],
 ['SELECT (SELECT count(*) GROUP BY 7+0) AS v',['v'],[[['integer',1n]]]],
 ['SELECT (SELECT 7 GROUP BY 7+0 LIMIT 0) AS v',['v'],[[['null',null]]]],
 // Pinned 3.53.4 resolve.c validates ORDER before select.c's one-candidate
 // WhereBegin; independent nonordinal keys need no result sorter.
 ['SELECT (SELECT 7 ORDER BY 8+0) AS v, EXISTS(SELECT 9 ORDER BY 10+0) AS hit, 7 IN (SELECT 7 ORDER BY 8+0) AS member',['v','hit','member'],[[['integer',7n],['integer',1n],['integer',1n]]]],
 ['SELECT (SELECT 7 WHERE 0 ORDER BY 8+0) AS v, EXISTS(SELECT 7 WHERE 0 ORDER BY 8+0) AS hit, 7 IN (SELECT 7 WHERE 0 ORDER BY 8+0) AS member',['v','hit','member'],[[['null',null],['integer',0n],['integer',0n]]]],
 ['SELECT (SELECT 7 ORDER BY 8+0 LIMIT 0) AS v',['v'],[[['null',null]]]],
 // select.c tag-select-0820: ORDER aggregates are lowered in AggInfo but
 // one ungrouped accumulator output row never needs a result sorter.
 ['SELECT (SELECT count(*) ORDER BY sum(1)) AS n, EXISTS(SELECT count(*) ORDER BY sum(1)) AS hit, 1 IN (SELECT count(*) ORDER BY sum(1)) AS member',['n','hit','member'],[[['integer',1n],['integer',1n],['integer',1n]]]],
 ['SELECT (SELECT count(*) WHERE 0 ORDER BY sum(1)) AS n, EXISTS(SELECT count(*) WHERE 0 ORDER BY sum(1)) AS hit, 0 IN (SELECT count(*) WHERE 0 ORDER BY sum(1)) AS member',['n','hit','member'],[[['integer',0n],['integer',1n],['integer',1n]]]],
 ['SELECT (SELECT sum(1) ORDER BY count(*) LIMIT 0) AS n',['n'],[[['null',null]]]],
 ['SELECT (SELECT count(*) HAVING count(*)=1 ORDER BY sum(1)) AS n',['n'],[[['integer',1n]]]],
 // Pinned select.c tag-select-0820: HAVING filters finalized accumulator
 // output; WHERE filters its sole input before AggStep.
 ['SELECT (SELECT count(*) HAVING count(*)=1) AS n, EXISTS(SELECT count(*) HAVING count(*)>1) AS hit, 1 IN (SELECT count(*) HAVING count(*)=1) AS member',['n','hit','member'],[[['integer',1n],['integer',0n],['integer',1n]]]],
 ['SELECT (SELECT sum(1) HAVING sum(1)>1) AS n, EXISTS(SELECT sum(1) HAVING sum(1)=1) AS hit',['n','hit'],[[['null',null],['integer',1n]]]],
 ['SELECT (SELECT count(*) WHERE 0 HAVING count(*)=0) AS n, EXISTS(SELECT count(*) WHERE 0 HAVING count(*)>0) AS hit',['n','hit'],[[['integer',0n],['integer',0n]]]],
 ['SELECT (SELECT count(*) HAVING count(*)=1 LIMIT 0) AS n',['n'],[[['null',null]]]],
 // SQLite 3.53.4 select.c tag-select-0820: no FROM still finalizes once;
 // WHERE suppresses stepping, not the aggregate's result row.
 ['SELECT (SELECT count(*)) AS n, EXISTS(SELECT count(*)) AS hit, 0 IN (SELECT count(*)) AS member',['n','hit','member'],[[['integer',1n],['integer',1n],['integer',0n]]]],
 ['SELECT (SELECT count(*) WHERE 0) AS n, EXISTS(SELECT count(*) WHERE 0) AS hit, 0 IN (SELECT count(*) WHERE 0) AS member',['n','hit','member'],[[['integer',0n],['integer',1n],['integer',1n]]]],
 ['SELECT (SELECT sum(1)) AS n, EXISTS(SELECT sum(1)) AS hit, 0 IN (SELECT sum(1)) AS member',['n','hit','member'],[[['integer',1n],['integer',1n],['integer',0n]]]],
 ['SELECT (SELECT count(*) LIMIT 0) AS n',['n'],[[['null',null]]]],
 ['SELECT (SELECT count(*) FROM t2 ORDER BY sum(x)) AS n, EXISTS(SELECT count(*) FROM t2 ORDER BY sum(x)) AS hit, 2 IN (SELECT count(*) FROM t2 ORDER BY sum(x)) AS member',['n','hit','member'],[[['integer',4n],['integer',1n],['integer',0n]]]],
 ['SELECT (SELECT count(*) FROM t2 ORDER BY sum(x) LIMIT 0) AS n',['n'],[[['null',null]]]],
 ['SELECT (SELECT count(*) FROM t1 JOIN t2 ON t1.a=t2.x WHERE t1.a>1) AS n, EXISTS(SELECT count(*) FROM t1 JOIN t2 ON t1.a=t2.x WHERE t1.a>99) AS empty_group, 1 IN (SELECT count(*) FROM t1 JOIN t2 ON t1.a=t2.x WHERE t1.a>1) AS member',['n','empty_group','member'],[[['integer',1n],['integer',1n],['integer',1n]]]],
 ['SELECT (SELECT count(*) FROM t1 JOIN t2 ON t1.a=t2.x AND t1.a>99) AS zero, (SELECT count(*) FROM t1, t2 WHERE t1.a=t2.x HAVING count(*)>99) AS absent, (SELECT count(*) FROM t1, t2 WHERE t1.a=t2.x LIMIT 0 OFFSET NULL) AS skipped',['zero','absent','skipped'],[[['integer',0n],['null',null],['null',null]]]],
 ['SELECT (SELECT count(*) FROM t1, t2 WHERE t1.a=t2.x) AS total, EXISTS(SELECT count(*) FROM t1, t2 WHERE t1.a=t2.x LIMIT 0) AS absent, 2 IN (SELECT count(*) FROM t1, t2 WHERE t1.a=t2.x) AS member',['total','absent','member'],[[['integer',3n],['integer',0n],['integer',0n]]]],
 ['SELECT (SELECT t1.a FROM t1, t2 WHERE t1.a=t2.x LIMIT 0 OFFSET NULL) AS empty, EXISTS(SELECT t1.a FROM t1, t2 WHERE t1.a=t2.x LIMIT 0 OFFSET NULL) AS absent, 3 IN (SELECT t1.a FROM t1, t2 WHERE t1.a=t2.x LIMIT 0 OFFSET NULL) AS miss',['empty','absent','miss'],[[['null',null],['integer',0n],['integer',0n]]]],
 ['SELECT (SELECT t1.a FROM t1, t2 WHERE t1.a=t2.x) AS first, EXISTS(SELECT t1.a FROM t1, t2 WHERE t1.a=t2.x) AS present, 3 IN (SELECT t1.a FROM t1, t2 WHERE t1.a=t2.x) AS member',['first','present','member'],[[['integer',1n],['integer',1n],['integer',1n]]]],
 ['SELECT (SELECT t1.b FROM t1 JOIN t2 ON t1.a=t2.x WHERE t1.b>2 LIMIT 1) AS value, EXISTS(SELECT t2.x FROM t1 JOIN t2 ON t1.a=t2.x WHERE t2.x>99) AS absent, 3 IN (SELECT t2.x FROM t1 JOIN t2 ON t1.a=t2.x WHERE t2.x>=3 LIMIT 1) AS member',['value','absent','member'],[[['integer',4n],['integer',0n],['integer',1n]]]],
 ['SELECT (SELECT t1.b FROM t1 JOIN t2 ON t1.a=t2.x WHERE t1.a=3 LIMIT 1) AS value, EXISTS(SELECT t2.x FROM t1 JOIN t2 ON t1.a=t2.x WHERE t1.a=7) AS absent, 3 IN (SELECT t2.x FROM t1 JOIN t2 ON t1.a=t2.x WHERE t1.a=3) AS member',['value','absent','member'],[[['integer',4n],['integer',0n],['integer',1n]]]],
 ['SELECT (SELECT t1.a FROM t1, t2 WHERE t1.a=t2.x ORDER BY t1.a DESC LIMIT 1 OFFSET 1) AS second, EXISTS(SELECT t1.a FROM t1, t2 WHERE t1.a=t2.x AND t1.a>99) AS absent, 3 IN (SELECT t1.a FROM t1, t2 WHERE t1.a=t2.x) AS member',['second','absent','member'],[[['integer',1n],['integer',0n],['integer',1n]]]],
 ['SELECT (SELECT count(*) FROM t1, t2 WHERE t1.a=t2.x AND t1.a>99 GROUP BY t1.a) AS empty, EXISTS(SELECT count(*) FROM t1, t2 WHERE t1.a=t2.x GROUP BY t1.a LIMIT 0 OFFSET NULL) AS absent, 9 IN (SELECT count(*) FROM t1, t2 WHERE t1.a=t2.x GROUP BY t1.a LIMIT 0 OFFSET NULL) AS miss',['empty','absent','miss'],[[['null',null],['integer',0n],['integer',0n]]]],
 ['SELECT (SELECT count(*) FROM t1, t2 WHERE t1.a=t2.x GROUP BY t1.a ORDER BY t1.a LIMIT 1 OFFSET 1) AS second, EXISTS(SELECT count(*) FROM t1, t2 WHERE t1.a=t2.x GROUP BY t1.a HAVING count(*)>0) AS any_group, 1 IN (SELECT count(*) FROM t1, t2 WHERE t1.a=t2.x GROUP BY t1.a) AS member',['second','any_group','member'],[[['integer',1n],['integer',1n],['integer',1n]]]],
 ['SELECT (SELECT 7 AS n ORDER BY n DESC LIMIT 1) AS value, EXISTS(SELECT 8 AS n ORDER BY 1 LIMIT 1 OFFSET 1) AS absent, 7 IN (SELECT 7 AS n ORDER BY n LIMIT 1) AS member',['value','absent','member'],[[['integer',7n],['integer',0n],['integer',1n]]]],
 ['SELECT (SELECT 7 AS n WHERE 0 ORDER BY n) AS empty, EXISTS(SELECT 8 AS n WHERE 0 ORDER BY 1) AS absent, 7 IN (SELECT 7 AS n WHERE 0 ORDER BY n) AS miss',['empty','absent','miss'],[[['null',null],['integer',0n],['integer',0n]]]],
 ['SELECT 11 AS n LIMIT 0 OFFSET NULL',['n'],[]],
 ['SELECT x AS n FROM t2 ORDER BY x LIMIT 0 OFFSET NULL',['n'],[]],
 ['SELECT (SELECT 8 LIMIT 0 OFFSET NULL) AS child, 2 AS n LIMIT 0 OFFSET NULL',['child','n'],[]],
 ['SELECT (SELECT q.vb FROM v1 AS q WHERE q.vb>2 LIMIT 0 OFFSET NULL) AS empty, EXISTS(SELECT q.vb FROM v1 AS q LIMIT 0 OFFSET NULL) AS absent, 6 IN (SELECT q.vb FROM v1 AS q LIMIT 0 OFFSET NULL) AS miss',['empty','absent','miss'],[[['null',null],['integer',0n],['integer',0n]]]],
 ['SELECT (SELECT q.vb FROM v1 AS q WHERE q.vb>2 ORDER BY q.vb DESC LIMIT 1) AS high, EXISTS(SELECT q.vc FROM v1 AS q WHERE q.vb>9) AS absent, 6 IN (SELECT q.vb FROM v1 AS q WHERE q.vb>2) AS member',['high','absent','member'],[[['integer',6n],['integer',0n],['integer',1n]]]],
 ['SELECT (SELECT q.b FROM v_inferred AS q WHERE q.b>1 LIMIT 1 OFFSET 1) AS next, EXISTS(SELECT q.vb FROM v1 AS q LIMIT 0) AS zero, 3 IN (SELECT q.vb FROM v1 AS q WHERE q.vb>2 LIMIT 0) AS absent',['next','zero','absent'],[[['integer',4n],['integer',0n],['integer',0n]]]],
 ['SELECT (SELECT 4 WHERE 1) AS yes, (SELECT 9 WHERE 0) AS no, EXISTS(SELECT 5 WHERE NULL) AS absent, 4 IN (SELECT 4 WHERE 1) AS member, 4 IN (SELECT 4 WHERE 0) AS miss',['yes','no','absent','member','miss'],[[['integer',4n],['null',null],['integer',0n],['integer',1n],['integer',0n]]]],
 ['SELECT (SELECT 7 WHERE 1 LIMIT 1 OFFSET 1) AS skipped, EXISTS(SELECT 7 WHERE 1 LIMIT 0) AS zero, 7 IN (SELECT 7 WHERE 1 LIMIT 1 OFFSET 1) AS absent',['skipped','zero','absent'],[[['null',null],['integer',0n],['integer',0n]]]],
 ['SELECT (SELECT 7 WHERE 0 LIMIT 0 OFFSET NULL) AS empty, (SELECT 7 WHERE NULL) AS unknown, NULL IN (SELECT NULL WHERE 1) AS nullable',['empty','unknown','nullable'],[[['null',null],['null',null],['null',null]]]],
 ['SELECT (SELECT vb FROM v1 WHERE vb>2 ORDER BY vb DESC LIMIT 1) AS high, EXISTS(SELECT vc FROM v1 WHERE vb>9) AS absent, 3 IN (SELECT vb FROM v1 WHERE vb>2) AS member',['high','absent','member'],[[['integer',6n],['integer',0n],['integer',0n]]]],
 ['SELECT (SELECT b FROM v_inferred WHERE b>1 LIMIT 1 OFFSET 1) AS next, EXISTS(SELECT vb FROM v1 LIMIT 0) AS zero, 3 IN (SELECT vb FROM v1 WHERE vb>2 LIMIT 0) AS absent',['next','zero','absent'],[[['integer',4n],['integer',0n],['integer',0n]]]],
 ['SELECT (SELECT d.x+1 FROM (SELECT x FROM t2) AS d WHERE d.x>1 ORDER BY d.x DESC LIMIT 1 OFFSET 1) AS value, EXISTS(SELECT d.x FROM (SELECT x FROM t2) AS d WHERE d.x>9) AS absent, 4 IN (SELECT d.x+1 FROM (SELECT x FROM t2) AS d WHERE d.x>1) AS member',['value','absent','member'],[[['integer',4n],['integer',0n],['integer',1n]]]],
 ['SELECT (SELECT d.x FROM (SELECT x AS x FROM t2 WHERE x>2) AS d WHERE d.x<5 LIMIT 1) AS first, EXISTS(SELECT d.x FROM (SELECT x AS x FROM t2 WHERE x>2) AS d LIMIT 0) AS zero, 3 IN (SELECT d.x FROM (SELECT x AS x FROM t2 WHERE x>2) AS d) AS member',['first','zero','member'],[[['integer',3n],['integer',0n],['integer',1n]]]],
 ['SELECT (SELECT x+1 FROM (SELECT x FROM t2) AS d WHERE x>1 ORDER BY x DESC LIMIT 1 OFFSET 1) AS value, EXISTS(SELECT x FROM (SELECT x FROM t2) AS d WHERE x>9) AS absent, 4 IN (SELECT x+1 FROM (SELECT x FROM t2) AS d WHERE x>1) AS member',['value','absent','member'],[[['integer',4n],['integer',0n],['integer',1n]]]],
 ['SELECT (SELECT x FROM (SELECT x AS x FROM t2 WHERE x>2) AS d WHERE x<5 LIMIT 1) AS first, EXISTS(SELECT x FROM (SELECT x AS x FROM t2 WHERE x>2) AS d LIMIT 0) AS zero, 3 IN (SELECT x FROM (SELECT x AS x FROM t2 WHERE x>2) AS d) AS member',['first','zero','member'],[[['integer',3n],['integer',0n],['integer',1n]]]],
 ['SELECT (SELECT 4 AS n UNION SELECT 5 ORDER BY n DESC) AS high, EXISTS(SELECT 4 AS n EXCEPT SELECT 4 ORDER BY n) AS absent, 5 IN (SELECT 4 AS n UNION SELECT 5 ORDER BY n DESC) AS member',['high','absent','member'],[[['integer',5n],['integer',0n],['integer',1n]]]],
 ['SELECT (SELECT NULL AS n UNION SELECT 5 ORDER BY n ASC LIMIT 1 OFFSET 1) AS second, NULL IN (SELECT NULL AS n UNION SELECT 5 ORDER BY n DESC) AS unknown',['second','unknown'],[[['integer',5n],['null',null]]]],
 ['SELECT (SELECT 4 AS n UNION SELECT 5 INTERSECT SELECT 5 ORDER BY n DESC LIMIT 0) AS empty, EXISTS(SELECT 4 AS n UNION SELECT 5 INTERSECT SELECT 5 ORDER BY n DESC) AS hit',['empty','hit'],[[['null',null],['integer',1n]]]],
 ['SELECT (SELECT 4 UNION SELECT 5 UNION ALL SELECT 4) AS first, 4 IN (SELECT 4 UNION SELECT 5 UNION ALL SELECT 4) AS member, EXISTS(SELECT 4 EXCEPT SELECT 4 UNION ALL SELECT 9) AS hit',['first','member','hit'],[[['integer',4n],['integer',1n],['integer',1n]]]],
 ['SELECT (SELECT 4 EXCEPT SELECT 4 UNION ALL SELECT 9 LIMIT 1) AS first, (SELECT 4 EXCEPT SELECT 4 UNION ALL SELECT 9 LIMIT 0) AS empty, 9 IN (SELECT 4 EXCEPT SELECT 4 UNION ALL SELECT 9 LIMIT 1) AS member',['first','empty','member'],[[['integer',9n],['null',null],['integer',1n]]]],
 ['SELECT (SELECT 4 UNION SELECT 5 UNION ALL SELECT 9 LIMIT 1 OFFSET 1) AS second, 9 IN (SELECT 4 UNION SELECT 5 UNION ALL SELECT 9 LIMIT 1 OFFSET 1) AS absent',['second','absent'],[[['integer',5n],['integer',0n]]]],
 ['SELECT (SELECT 4 UNION SELECT 4 UNION SELECT 5) AS first, EXISTS(SELECT 4 INTERSECT SELECT 5) AS absent, 5 IN (SELECT 4 UNION SELECT 5) AS member',['first','absent','member'],[[['integer',4n],['integer',0n],['integer',1n]]]],
 ['SELECT (SELECT 4 UNION SELECT 5 EXCEPT SELECT 4) AS first, 4 IN (SELECT 4 UNION SELECT 5 EXCEPT SELECT 4) AS absent, NULL IN (SELECT NULL UNION SELECT 5) AS unknown',['first','absent','unknown'],[[['integer',5n],['integer',0n],['null',null]]]],
 ['SELECT (SELECT 4 UNION SELECT 5 INTERSECT SELECT 5) AS first, EXISTS(SELECT 4 UNION SELECT 5 INTERSECT SELECT 5 LIMIT 0) AS absent, 5 IN (SELECT 4 UNION SELECT 5 INTERSECT SELECT 5) AS member',['first','absent','member'],[[['integer',5n],['integer',0n],['integer',1n]]]],
 ['SELECT (SELECT 4 AS n UNION ALL SELECT 5 ORDER BY n DESC) AS first, EXISTS(SELECT 4 AS n UNION ALL SELECT 5 ORDER BY n DESC) AS hit, 4 IN (SELECT 4 AS n UNION ALL SELECT 5 ORDER BY n DESC) AS member',['first','hit','member'],[[['integer',5n],['integer',1n],['integer',1n]]]],
 ['SELECT (SELECT NULL AS n UNION ALL SELECT 5 ORDER BY 1 LIMIT 1 OFFSET 1) AS second, 5 IN (SELECT NULL AS n UNION ALL SELECT 5 ORDER BY 1 LIMIT 1 OFFSET 1) AS member',['second','member'],[[['integer',5n],['integer',1n]]]],
 ["SELECT (SELECT 4 UNION ALL SELECT 5 LIMIT 0 OFFSET 'bad') AS empty, 5 IN (SELECT 4 UNION ALL SELECT 5 LIMIT 0 OFFSET 'bad') AS member",['empty','member'],[[['null',null],['integer',0n]]]],
 ['SELECT (SELECT 4 UNION ALL SELECT 5 LIMIT 0) AS empty, EXISTS(SELECT 4 UNION ALL SELECT 5 LIMIT 0) AS absent, 5 IN (SELECT 4 UNION ALL SELECT 5 LIMIT 0) AS member',['empty','absent','member'],[[['null',null],['integer',0n],['integer',0n]]]],
 ['SELECT (SELECT 4 UNION ALL SELECT 5 LIMIT 1 OFFSET 1) AS second, 5 IN (SELECT 4 UNION ALL SELECT 5 LIMIT 1 OFFSET 1) AS member',['second','member'],[[['integer',5n],['integer',1n]]]],
 ['SELECT (SELECT 4 UNION ALL SELECT 5) AS first, EXISTS(SELECT 4 UNION ALL SELECT 5) AS hit, 5 IN (SELECT 4 UNION ALL SELECT 5) AS member',['first','hit','member'],[[['integer',4n],['integer',1n],['integer',1n]]]],
 ['SELECT (SELECT NULL UNION ALL SELECT 5) AS first, NULL IN (SELECT NULL UNION ALL SELECT 5) AS unknown, 5 IN (SELECT NULL UNION ALL SELECT 5) AS member',['first','unknown','member'],[[['null',null],['null',null],['integer',1n]]]],
 ['SELECT (VALUES(4),(5)) AS first, EXISTS(VALUES(4),(5)) AS hit, 5 IN (VALUES(4),(5)) AS member',['first','hit','member'],[[['integer',4n],['integer',1n],['integer',1n]]]],
 ['SELECT (VALUES(NULL),(5)) AS first, NULL IN (VALUES(NULL),(5)) AS unknown, 5 IN (VALUES(NULL),(5)) AS member',['first','unknown','member'],[[['null',null],['null',null],['integer',1n]]]],
 ['SELECT (SELECT CASE WHEN x>1 THEN x+1 ELSE 0 END FROM t2 ORDER BY x DESC LIMIT 1 OFFSET 1) AS value, EXISTS(SELECT CASE WHEN x>1 THEN x+1 ELSE 0 END FROM t2 LIMIT 0) AS absent, 4 IN (SELECT CASE WHEN x>1 THEN x+1 ELSE 0 END FROM t2) AS member',['value','absent','member'],[[['integer',4n],['integer',0n],['integer',1n]]]],
 ['SELECT (SELECT CASE x WHEN 1 THEN 9 ELSE x+2 END FROM t2 ORDER BY x DESC LIMIT 1 OFFSET 1) AS value, 9 IN (SELECT CASE x WHEN 1 THEN 9 ELSE x+2 END FROM t2 LIMIT 2) AS member',['value','member'],[[['integer',5n],['integer',1n]]]],
 ['SELECT (SELECT x+2 FROM t2 ORDER BY x*2 DESC LIMIT 1 OFFSET 1) AS shifted, EXISTS(SELECT x+2 FROM t2 ORDER BY x*2 DESC LIMIT 0) AS absent, 4 IN (SELECT x+2 FROM t2 ORDER BY x*2 DESC LIMIT 2) AS member',['shifted','absent','member'],[[['integer',5n],['integer',0n],['integer',0n]]]],
 ['SELECT (SELECT DISTINCT count(*) FROM t2 LIMIT 1 OFFSET 1) AS skipped, EXISTS(SELECT DISTINCT count(*) FROM t2 LIMIT 0) AS absent, 2 IN (SELECT DISTINCT count(*) FROM t2 LIMIT 1) AS member',['skipped','absent','member'],[[['null',null],['integer',0n],['integer',0n]]]],
 ['SELECT (SELECT DISTINCT count(*) FROM t2 WHERE x>100) AS zero, 0 IN (SELECT DISTINCT count(*) FROM t2 WHERE x>100) AS member',['zero','member'],[[['integer',0n],['integer',1n]]]],
 ['SELECT (SELECT DISTINCT count(*) FROM t2 GROUP BY x ORDER BY count(*) DESC LIMIT 1 OFFSET 1) AS second_group, EXISTS(SELECT DISTINCT count(*) FROM t2 GROUP BY x ORDER BY count(*) DESC LIMIT 0) AS absent, 2 IN (SELECT DISTINCT count(*) FROM t2 GROUP BY x ORDER BY count(*) DESC) AS member',['second_group','absent','member'],[[['integer',1n],['integer',0n],['integer',1n]]]],
 ['SELECT (SELECT count(*) FROM t2 GROUP BY x ORDER BY count(*) DESC LIMIT 1 OFFSET 1) AS second_group, EXISTS(SELECT count(*) FROM t2 GROUP BY x ORDER BY count(*) DESC LIMIT 0) AS absent, 2 IN (SELECT count(*) FROM t2 GROUP BY x ORDER BY count(*) DESC) AS member',['second_group','absent','member'],[[['integer',1n],['integer',0n],['integer',1n]]]],
 ['SELECT (SELECT DISTINCT count(*) FROM t2 GROUP BY x LIMIT 1 OFFSET 1) AS second_group, EXISTS(SELECT DISTINCT count(*) FROM t2 GROUP BY x LIMIT 0) AS absent, 2 IN (SELECT DISTINCT count(*) FROM t2 GROUP BY x) AS member',['second_group','absent','member'],[[['integer',1n],['integer',0n],['integer',1n]]]],
 ['SELECT (SELECT DISTINCT count(*) FROM t2 GROUP BY x HAVING count(*)>1) AS first_group, 1 IN (SELECT DISTINCT count(*) FROM t2 GROUP BY x HAVING count(*)>1) AS member',['first_group','member'],[[['integer',2n],['integer',0n]]]],
 ['SELECT (SELECT count(*) FROM t2 GROUP BY x HAVING count(*)>1) AS first_group, EXISTS(SELECT count(*) FROM t2 GROUP BY x HAVING count(*)>9) AS absent, 2 IN (SELECT count(*) FROM t2 GROUP BY x HAVING count(*)>1) AS member',['first_group','absent','member'],[[['integer',2n],['integer',0n],['integer',1n]]]],
 ['SELECT (SELECT count(*) FROM t2 GROUP BY x LIMIT 1 OFFSET 1) AS second_group, EXISTS(SELECT count(*) FROM t2 GROUP BY x LIMIT 1 OFFSET 4) AS absent_group, 2 IN (SELECT count(*) FROM t2 GROUP BY x) AS has_two',['second_group','absent_group','has_two'],[[['integer',1n],['integer',0n],['integer',1n]]]],
 ['SELECT (SELECT count(*) FROM t2 GROUP BY x LIMIT 0) AS no_group, EXISTS(SELECT count(*) FROM t2 GROUP BY x LIMIT 0) AS no_exists',['no_group','no_exists'],[[['null',null],['integer',0n]]]],
 ['SELECT (SELECT y FROM t2 LIMIT 0 OFFSET 1) AS none, EXISTS(SELECT y FROM t2 LIMIT 0 OFFSET 1) AS no_rows, 1 IN (SELECT x FROM t2 LIMIT 0 OFFSET 1) AS empty_set',['none','no_rows','empty_set'],[[['null',null],['integer',0n],['integer',0n]]]],
 ['SELECT (SELECT y FROM t2 WHERE x>=1 LIMIT 1 OFFSET 1) AS second, EXISTS(SELECT y FROM t2 WHERE x>=1 LIMIT 1 OFFSET 4) AS absent, 2 IN (SELECT x FROM t2 WHERE x>=1 LIMIT 1 OFFSET 1) AS hit',['second','absent','hit'],[[['integer',12n],['integer',0n],['integer',0n]]]],
 ['SELECT (SELECT y FROM t2 ORDER BY y DESC LIMIT 1 OFFSET 1) AS sorted_second, 2 IN (SELECT x FROM t2 ORDER BY x DESC LIMIT 1 OFFSET 1) AS sorted_hit, EXISTS(SELECT x FROM t2 ORDER BY x DESC LIMIT 1 OFFSET 4) AS sorted_absent',['sorted_second','sorted_hit','sorted_absent'],[[['integer',12n],['integer',0n],['integer',0n]]]],
 ['SELECT (SELECT y FROM t2 WHERE x=1 ORDER BY y DESC) AS v',['v'],[[['integer',12n]]]],
 ['SELECT (SELECT y FROM t2 ORDER BY y DESC LIMIT 1) AS v, 3 IN (SELECT x FROM t2 ORDER BY x DESC LIMIT 1) AS last, EXISTS(SELECT x FROM t2 ORDER BY x DESC LIMIT 0) AS none',['v','last','none'],[[['integer',33n],['integer',0n],['integer',0n]]]],
 ['SELECT (SELECT x AS y FROM t2 ORDER BY t2.y DESC LIMIT 1) AS qualified_source, (SELECT x AS y FROM t2 ORDER BY y DESC LIMIT 1) AS alias_key',['qualified_source','alias_key'],[[['integer',3n],['integer',9n]]]],
 ['SELECT (SELECT x AS y FROM t2 ORDER BY y DESC LIMIT 1) AS alias_collision, (SELECT x FROM t2 ORDER BY y DESC LIMIT 1) AS source_key',['alias_collision','source_key'],[[['integer',9n],['integer',3n]]]],
 ['SELECT (SELECT y AS x FROM t2 ORDER BY x DESC LIMIT 1) AS alias_wins, (SELECT x FROM t2 ORDER BY y DESC LIMIT 1) AS other_key',['alias_wins','other_key'],[[['integer',33n],['integer',3n]]]],
 ['SELECT 1 IN (SELECT x FROM t2 ORDER BY x DESC LIMIT 2) AS first_two, 3 IN (SELECT x FROM t2 ORDER BY x DESC LIMIT 2) AS third, EXISTS(SELECT x FROM t2 ORDER BY x ASC LIMIT 1) AS present',['first_two','third','present'],[[['integer',0n],['integer',1n],['integer',1n]]]],
 ['SELECT (SELECT y FROM t2 WHERE x>1 ORDER BY y ASC LIMIT 1) AS v, 2 IN (SELECT x FROM t2 ORDER BY x ASC LIMIT 1) AS first',['v','first'],[[['null',null],['integer',0n]]]],
 ['SELECT (SELECT y FROM t2) AS v, EXISTS(SELECT x FROM t2) AS hit, 1 IN (SELECT x FROM t2) AS member',['v','hit','member'],[[['integer',11n],['integer',1n],['integer',1n]]]],
 ["SELECT (SELECT DISTINCT CAST(x AS TEXT) COLLATE NOCASE FROM t2 ORDER BY 1 DESC LIMIT 1 OFFSET 1) AS text_value, '3' IN (SELECT CAST(x AS TEXT) COLLATE NOCASE FROM t2) AS member",['text_value','member'],[[['text','3'],['integer',1n]]]],
 ['SELECT (SELECT x COLLATE NOCASE FROM t2 WHERE x IS NOT NULL ORDER BY x LIMIT 1 OFFSET 1) AS value',['value'],[[['integer',1n]]]],
 ['SELECT (SELECT DISTINCT x COLLATE NOCASE FROM t2 ORDER BY x LIMIT 1 OFFSET 1) AS value, 3 IN (SELECT x COLLATE NOCASE FROM t2 LIMIT 2) AS member',['value','member'],[[['integer',3n],['integer',0n]]]],
 ['SELECT (SELECT DISTINCT x+1 COLLATE NOCASE FROM t2 ORDER BY 1 LIMIT 1 OFFSET 1) AS value',['value'],[[['integer',4n]]]],
 ['SELECT (SELECT DISTINCT x+1 AS y FROM t2 ORDER BY y DESC LIMIT 1 OFFSET 1) AS second, 10 IN (SELECT DISTINCT x+1 AS y FROM t2 ORDER BY y DESC LIMIT 1) AS member',['second','member'],[[['integer',4n],['integer',1n]]]],
 ['SELECT (SELECT x+1 FROM t2 ORDER BY x+1 DESC LIMIT 1 OFFSET 1) AS second, 10 IN (SELECT x+1 FROM t2 ORDER BY x+1 DESC LIMIT 1) AS member',['second','member'],[[['integer',4n],['integer',1n]]]],
 ['SELECT (SELECT x+1 FROM t2 ORDER BY 1 DESC LIMIT 1 OFFSET 1) AS second, 10 IN (SELECT x+1 FROM t2 ORDER BY 1 DESC LIMIT 1) AS member',['second','member'],[[['integer',4n],['integer',1n]]]],
 ['SELECT (SELECT x+1 FROM t2 ORDER BY x+1 DESC LIMIT 0) AS skipped, EXISTS(SELECT x+1 FROM t2 ORDER BY x+1 DESC LIMIT 1 OFFSET 1) AS hit',['skipped','hit'],[[['null',null],['integer',1n]]]],
 ['SELECT (SELECT x+1 FROM t2 WHERE x>1 LIMIT 0 OFFSET 1) AS skipped, 4 IN (SELECT x+1 FROM t2 WHERE x>1 LIMIT 0) AS empty',['skipped','empty'],[[['null',null],['integer',0n]]]],
 ['SELECT (SELECT x+1 FROM t2 WHERE x>1 LIMIT 1 OFFSET 1) AS shifted, EXISTS(SELECT x+1 FROM t2 WHERE x>1 LIMIT 0) AS absent, 4 IN (SELECT x+1 FROM t2 WHERE x>1 LIMIT 2) AS member',['shifted','absent','member'],[[['integer',10n],['integer',0n],['integer',1n]]]],
 ['SELECT (SELECT x+1 FROM t2 WHERE x>1 ORDER BY x DESC LIMIT 1 OFFSET 1) AS shifted, 10 IN (SELECT x+1 FROM t2 WHERE x>1 ORDER BY x DESC LIMIT 1) AS member',['shifted','member'],[[['integer',4n],['integer',1n]]]],
 ['SELECT (SELECT DISTINCT x+1 FROM t2 WHERE x>1 LIMIT 1 OFFSET 1) AS shifted, 4 IN (SELECT DISTINCT x+1 FROM t2 WHERE x>1 LIMIT 2) AS member',['shifted','member'],[[['integer',10n],['integer',1n]]]],
 ['SELECT (SELECT DISTINCT 7 LIMIT 1 OFFSET 1) AS skipped, EXISTS(SELECT DISTINCT 7 LIMIT 0) AS absent, 7 IN (SELECT DISTINCT 7 LIMIT 1 OFFSET 1) AS member',['skipped','absent','member'],[[['null',null],['integer',0n],['integer',0n]]]],
 ['SELECT (SELECT DISTINCT 7 LIMIT 1 OFFSET 0) AS v, EXISTS(SELECT DISTINCT 7 LIMIT 1 OFFSET 0) AS hit, 7 IN (SELECT DISTINCT 7) AS member',['v','hit','member'],[[['integer',7n],['integer',1n],['integer',1n]]]],
 ['SELECT (SELECT DISTINCT x FROM t2 ORDER BY x DESC LIMIT 1 OFFSET 1) AS second, 1 IN (SELECT DISTINCT x FROM t2 ORDER BY x DESC LIMIT 2) AS miss',['second','miss'],[[['integer',3n],['integer',0n]]]],
 ['SELECT (SELECT DISTINCT x FROM t2 LIMIT 1 OFFSET 1) AS second, EXISTS(SELECT DISTINCT x FROM t2 LIMIT 0) AS absent, 1 IN (SELECT DISTINCT x FROM t2) AS member',['second','absent','member'],[[['integer',3n],['integer',0n],['integer',1n]]]],
 ['SELECT (SELECT DISTINCT x FROM t2 WHERE x>1 LIMIT 1 OFFSET 1) AS skipped, 2 IN (SELECT DISTINCT x FROM t2 WHERE x>1 LIMIT 1) AS member',['skipped','member'],[[['integer',9n],['integer',0n]]]],
 ['SELECT (SELECT y FROM t2 LIMIT 0) AS v, EXISTS(SELECT x FROM t2 LIMIT 0) AS hit, 1 IN (SELECT x FROM t2 LIMIT 0) AS member',['v','hit','member'],[[['null',null],['integer',0n],['integer',0n]]]],
 ['SELECT (SELECT y FROM t2 LIMIT 2) AS v, 3 IN (SELECT x FROM t2 LIMIT 1) AS first_only, 3 IN (SELECT x FROM t2 LIMIT 2) AS second',['v','first_only','second'],[[['integer',11n],['integer',0n],['integer',0n]]]],
 ['SELECT (SELECT y FROM t2 WHERE x=1) AS v, EXISTS(SELECT y FROM t2 WHERE x=9) AS hit, 3 IN (SELECT x FROM t2 WHERE x>2) AS member',['v','hit','member'],[[['integer',11n],['integer',1n],['integer',1n]]]],
 ['SELECT (SELECT y FROM t2 WHERE x=9 LIMIT 0) AS v, 1 IN (SELECT x FROM t2 WHERE x>0 LIMIT 1) AS first',['v','first'],[[['null',null],['integer',1n]]]],
 ['SELECT 1 IN (SELECT x FROM t2) AS hit, 3 IN (SELECT x FROM t2) AS miss',['hit','miss'],[[['integer',1n],['integer',1n]]]],
 ['SELECT 3 IN (SELECT x FROM t2 ORDER BY x LIMIT 1) AS hit, 1 IN (SELECT x FROM t2 LIMIT 0) AS empty',['hit','empty'],[[['integer',0n],['integer',0n]]]],
 ['SELECT 2 IN (SELECT y FROM t2 ORDER BY y DESC LIMIT 1) AS miss, 2 NOT IN (SELECT y FROM t2 WHERE x=9) AS unknown',['miss','unknown'],[[['integer',0n],['null',null]]]],
 ['SELECT 3 IN (SELECT x FROM t2 LIMIT 1) AS hit, 1 IN (SELECT x FROM t2 LIMIT 0) AS empty',['hit','empty'],[[['integer',0n],['integer',0n]]]],
 ['SELECT (SELECT 7 LIMIT 1 OFFSET 1) AS skipped, EXISTS(SELECT 7 LIMIT 1 OFFSET 1) AS absent, 7 IN (SELECT 7 LIMIT 1 OFFSET 1) AS miss',['skipped','absent','miss'],[[['null',null],['integer',0n],['integer',0n]]]],
 ['SELECT (SELECT 7 LIMIT 1 OFFSET 0) AS present, EXISTS(SELECT 7 LIMIT 1 OFFSET 0) AS hit, 7 IN (SELECT 7 LIMIT 1 OFFSET 0) AS member',['present','hit','member'],[[['integer',7n],['integer',1n],['integer',1n]]]],
 ['SELECT (SELECT 7 LIMIT 0 OFFSET 1) AS none, 7 IN (SELECT 7 LIMIT 0 OFFSET 1) AS empty',['none','empty'],[[['null',null],['integer',0n]]]],
 ['SELECT 1 IN (SELECT 1) AS hit, 2 NOT IN (SELECT NULL) AS unknown',['hit','unknown'],[[['integer',1n],['null',null]]]],
 ['SELECT 1 IN (SELECT 1) AS hit, 1 NOT IN (SELECT 2) AS miss',['hit','miss'],[[['integer',1n],['integer',1n]]]],
 ['SELECT 1 IN (SELECT 1 LIMIT 0) AS empty, 1 IN (SELECT 1 LIMIT 1) AS hit, (SELECT 7 LIMIT 0) AS none',['empty','hit','none'],[[['integer',0n],['integer',1n],['null',null]]]],
 ["SELECT '1' IN (SELECT CAST(1 AS INTEGER)) AS numeric_hit, 1 IN (SELECT '1') AS blob_miss",['numeric_hit','blob_miss'],[[['integer',1n],['integer',0n]]]],
 ["SELECT '1' IN (SELECT CAST(x AS INTEGER) FROM t2 WHERE x=1) AS numeric_hit, 1 IN (SELECT CAST(x AS TEXT) FROM t2 WHERE x=1) AS text_hit",['numeric_hit','text_hit'],[[['integer',1n],['integer',1n]]]],
 ['SELECT (SELECT y FROM t2 WHERE x=-1) AS v, EXISTS(SELECT 1 FROM t2 WHERE x=-1) AS hit',['v','hit'],[[['null',null],['integer',0n]]]],
 ['SELECT (SELECT count(*) FROM t2) AS n, EXISTS(SELECT count(*) FROM t2) AS present, 3 IN (SELECT count(*) FROM t2) AS member',['n','present','member'],[[['integer',4n],['integer',1n],['integer',0n]]]],
 ['SELECT (SELECT count(*) FROM t2 LIMIT 0) AS none, EXISTS(SELECT count(*) FROM t2 LIMIT 0) AS absent, 4 IN (SELECT count(*) FROM t2 LIMIT 0) AS empty',['none','absent','empty'],[[['null',null],['integer',0n],['integer',0n]]]],
 ['SELECT (SELECT count(*) FROM t2 WHERE x>1) AS n, EXISTS(SELECT count(*) FROM t2 WHERE x>9) AS hit, 0 IN (SELECT count(*) FROM t2 WHERE x>9) AS member',['n','hit','member'],[[['integer',2n],['integer',1n],['integer',1n]]]],
 ['SELECT (SELECT count(*) FROM (SELECT x FROM t2) AS d WHERE d.x>1 LIMIT 1 OFFSET 1) AS skipped, (SELECT count(*) FROM (SELECT x FROM t2) AS d WHERE d.x>1) AS filtered, 2 IN (SELECT count(*) FROM (SELECT x FROM t2) AS d WHERE d.x>1) AS member',['skipped','filtered','member'],[[['null',null],['integer',2n],['integer',1n]]]],
 ['SELECT (SELECT count(*) FROM (SELECT x FROM t2) AS d WHERE x>1 LIMIT 1 OFFSET 1) AS skipped, (SELECT count(*) FROM (SELECT x FROM t2) AS d WHERE x>1) AS filtered, 2 IN (SELECT count(*) FROM (SELECT x FROM t2) AS d WHERE x>1) AS member',['skipped','filtered','member'],[[['null',null],['integer',2n],['integer',1n]]]],
 ['SELECT (SELECT count(*) FROM (SELECT x FROM t2) AS d LIMIT 1) AS derived_n, EXISTS(SELECT count(*) FROM (SELECT x FROM t2) AS d LIMIT 0) AS derived_hit, 3 IN (SELECT count(*) FROM (SELECT x FROM t2) AS d) AS derived_member',['derived_n','derived_hit','derived_member'],[[['integer',4n],['integer',0n],['integer',0n]]]],
 ['SELECT (SELECT count(*) FROM t2 WHERE x>1 LIMIT 1 OFFSET 1) AS n, EXISTS(SELECT count(*) FROM t2 LIMIT 0) AS hit, 2 IN (SELECT count(*) FROM t2 WHERE x>1) AS member',['n','hit','member'],[[['null',null],['integer',0n],['integer',1n]]]],
 ['SELECT count(*) IN (SELECT x FROM t2) AS aggregate_left, EXISTS(SELECT count(*) FROM t2) AS child_exists FROM t2',['aggregate_left','child_exists'],[[['integer',0n],['integer',1n]]]],
 ['SELECT count(*) AS n FROM t2 WHERE EXISTS(SELECT x FROM t2 LIMIT 0)',['n'],[[['integer',0n]]]],
 ['SELECT count(*) AS n FROM t2 WHERE EXISTS(SELECT x FROM t2 LIMIT 1)',['n'],[[['integer',4n]]]],
 ['SELECT count(*) AS n FROM t2 WHERE EXISTS(SELECT x FROM t2 LIMIT 1 OFFSET 4)',['n'],[[['integer',0n]]]],
 ['SELECT count(*)-3 IN (SELECT x FROM t2 LIMIT 0) AS hit FROM t2',['hit'],[[['integer',0n]]]],
 ['SELECT count(*)-3 IN (SELECT x FROM t2 LIMIT 1) AS hit FROM t2',['hit'],[[['integer',1n]]]],
 ['SELECT count(*)-3 IN (SELECT x FROM t2 LIMIT 1 OFFSET 1) AS hit FROM t2',['hit'],[[['integer',1n]]]],
 ['SELECT count(*)-3 IN (SELECT x FROM t2 LIMIT 1 OFFSET 1) AS hit FROM t2 WHERE EXISTS(SELECT x FROM t2 LIMIT 1)',['hit'],[[['integer',1n]]]],
 ['SELECT a,(SELECT count(*) FROM t2 WHERE x=t1.a) AS n FROM t1 ORDER BY a',['a','n'],[[['integer',1n],['integer',2n]],[['integer',3n],['integer',1n]],[['integer',5n],['integer',0n]],[['integer',7n],['integer',0n]]]],
 ['SELECT a,EXISTS(SELECT 1 FROM t2 WHERE x=t1.a) AS hit FROM t1 ORDER BY a',['a','hit'],[[['integer',1n],['integer',1n]],[['integer',3n],['integer',1n]],[['integer',5n],['integer',0n]],[['integer',7n],['integer',0n]]]],
 ['SELECT a,a IN (SELECT x FROM t2 WHERE x<=t1.a) AS hit FROM t1 ORDER BY a',['a','hit'],[[['integer',1n],['integer',1n]],[['integer',3n],['integer',1n]],[['integer',5n],['integer',0n]],[['integer',7n],['integer',0n]]]],
 ['SELECT a,(SELECT y FROM t2 WHERE x=t1.a LIMIT 0) AS v, EXISTS(SELECT 1 FROM t2 WHERE x=t1.a LIMIT 0) AS hit FROM t1 ORDER BY a',['a','v','hit'],[[['integer',1n],['null',null],['integer',0n]],[['integer',3n],['null',null],['integer',0n]],[['integer',5n],['null',null],['integer',0n]],[['integer',7n],['null',null],['integer',0n]]]],
 ['SELECT a,a IN (SELECT x FROM t2 WHERE x<=t1.a LIMIT 1) AS hit FROM t1 ORDER BY a',['a','hit'],[[['integer',1n],['integer',1n]],[['integer',3n],['integer',0n]],[['integer',5n],['integer',0n]],[['integer',7n],['integer',0n]]]],
 ['SELECT a,(SELECT y FROM t2 WHERE x=t1.a LIMIT 2) AS v, EXISTS(SELECT 1 FROM t2 WHERE x=t1.a LIMIT 2) AS hit FROM t1 ORDER BY a',['a','v','hit'],[[['integer',1n],['integer',11n],['integer',1n]],[['integer',3n],['integer',33n],['integer',1n]],[['integer',5n],['null',null],['integer',0n]],[['integer',7n],['null',null],['integer',0n]]]],
 ['SELECT a,a IN (SELECT x FROM t2 WHERE x<=t1.a LIMIT 0) AS hit FROM t1 ORDER BY a',['a','hit'],[[['integer',1n],['integer',0n]],[['integer',3n],['integer',0n]],[['integer',5n],['integer',0n]],[['integer',7n],['integer',0n]]]],
 ['SELECT (SELECT count(*) FROM (SELECT x FROM t2) AS d GROUP BY d.x ORDER BY count(*) DESC LIMIT 1 OFFSET 1) AS second, EXISTS(SELECT count(*) FROM (SELECT x FROM t2) AS d GROUP BY d.x LIMIT 0) AS absent, 2 IN (SELECT count(*) FROM (SELECT x FROM t2) AS d GROUP BY d.x HAVING count(*)>1) AS member',['second','absent','member'],[[['integer',1n],['integer',0n],['integer',1n]]]],
 ['SELECT (SELECT count(*) FROM (SELECT x FROM t2 WHERE x>99) AS d GROUP BY d.x) AS empty, EXISTS(SELECT count(*) FROM (SELECT x FROM t2) AS d GROUP BY d.x HAVING count(*)>99) AS absent',['empty','absent'],[[['null',null],['integer',0n]]]],
 ['SELECT (SELECT count(*) FROM v1 AS q GROUP BY q.vb ORDER BY count(*) DESC LIMIT 1 OFFSET 1) AS second, EXISTS(SELECT count(*) FROM v1 AS q GROUP BY q.vb LIMIT 0) AS absent',['second','absent'],[[['integer',1n],['integer',0n]]]],
 ['SELECT (SELECT count(*) FROM (SELECT x FROM t2) AS d GROUP BY d.x ORDER BY d.x DESC LIMIT 1 OFFSET 1) AS second, EXISTS(SELECT count(*) FROM (SELECT x FROM t2) AS d GROUP BY d.x ORDER BY d.x DESC LIMIT 0) AS absent',['second','absent'],[[['integer',1n],['integer',0n]]]],
 ['SELECT (SELECT count(*) FROM t2 ORDER BY count(*) DESC LIMIT 1 OFFSET 1) AS skipped, EXISTS(SELECT count(*) FROM t2 ORDER BY count(*) DESC LIMIT 0) AS absent, 3 IN (SELECT count(*) FROM t2 ORDER BY count(*) DESC) AS member',['skipped','absent','member'],[[['null',null],['integer',0n],['integer',0n]]]],
 ['SELECT (SELECT count(*) AS n FROM t2 WHERE x>99 ORDER BY n DESC) AS empty_count, EXISTS(SELECT count(*) AS n FROM t2 WHERE x>99 ORDER BY n DESC) AS present',['empty_count','present'],[[['integer',0n],['integer',1n]]]],
 ['SELECT (SELECT count(*) FROM (SELECT 7 AS n)) AS one, EXISTS(SELECT count(*) FROM (SELECT 7 AS n)) AS present, 1 IN (SELECT count(*) FROM (SELECT 7 AS n)) AS member',['one','present','member'],[[['integer',1n],['integer',1n],['integer',1n]]]],
 ['SELECT (SELECT count(*) FROM (SELECT 7 AS n WHERE 0)) AS zero, EXISTS(SELECT count(*) FROM (SELECT 7 AS n LIMIT 0)) AS empty_present, 0 IN (SELECT count(*) FROM (SELECT 7 AS n WHERE 0)) AS empty_member',['zero','empty_present','empty_member'],[[['integer',0n],['integer',1n],['integer',1n]]]],
 ['SELECT (SELECT count(*) FROM (SELECT 7 AS n LIMIT 1 OFFSET 1)) AS zero, EXISTS(SELECT count(*) FROM (SELECT 7 AS n LIMIT 1 OFFSET 1)) AS present',['zero','present'],[[['integer',0n],['integer',1n]]]],
 ['SELECT (SELECT d.n FROM (SELECT 7 AS n LIMIT 1) AS d) AS value, EXISTS(SELECT d.n FROM (SELECT 7 AS n LIMIT 0) AS d) AS absent, 7 IN (SELECT d.n FROM (SELECT 7 AS n LIMIT 1) AS d) AS member',['value','absent','member'],[[['integer',7n],['integer',0n],['integer',1n]]]],
 ['SELECT (SELECT d.n FROM (SELECT 7 AS n WHERE 0) AS d) AS none, EXISTS(SELECT d.n FROM (SELECT 7 AS n LIMIT 1 OFFSET 1) AS d) AS absent, 7 IN (SELECT d.n FROM (SELECT 7 AS n LIMIT 1 OFFSET 1) AS d) AS miss',['none','absent','miss'],[[['null',null],['integer',0n],['integer',0n]]]],
 ['SELECT (SELECT d.n FROM (SELECT 7 AS n LIMIT 1) AS d LIMIT 1 OFFSET 1) AS skipped, EXISTS(SELECT d.n FROM (SELECT 7 AS n LIMIT 1) AS d LIMIT 0) AS absent, 7 IN (SELECT d.n FROM (SELECT 7 AS n LIMIT 1) AS d LIMIT 1 OFFSET 1) AS miss',['skipped','absent','miss'],[[['null',null],['integer',0n],['integer',0n]]]],
 ['SELECT (SELECT d.n FROM (SELECT 7 AS n LIMIT 1 OFFSET 1) AS d LIMIT 1) AS none, EXISTS(SELECT d.n FROM (SELECT 7 AS n LIMIT 1 OFFSET 1) AS d LIMIT 1) AS absent',['none','absent'],[[['null',null],['integer',0n]]]],
 ['SELECT (SELECT d.n FROM (SELECT 7 AS n LIMIT 1) AS d WHERE d.n=7) AS value, EXISTS(SELECT d.n FROM (SELECT 7 AS n LIMIT 1) AS d WHERE d.n=8) AS absent, 7 IN (SELECT d.n FROM (SELECT 7 AS n LIMIT 1) AS d WHERE d.n=7) AS member',['value','absent','member'],[[['integer',7n],['integer',0n],['integer',1n]]]],
 ['SELECT (SELECT d.n FROM (SELECT 7 AS n WHERE 0) AS d WHERE d.n=7) AS none, EXISTS(SELECT d.n FROM (SELECT 7 AS n LIMIT 0) AS d WHERE d.n=7) AS absent',['none','absent'],[[['null',null],['integer',0n]]]],
 ['SELECT (SELECT d.n+1 FROM (SELECT 7 AS n LIMIT 1) AS d) AS value, EXISTS(SELECT d.n+1 FROM (SELECT 7 AS n LIMIT 0) AS d) AS absent, 8 IN (SELECT d.n+1 FROM (SELECT 7 AS n LIMIT 1) AS d) AS member',['value','absent','member'],[[['integer',8n],['integer',0n],['integer',1n]]]],
 ['SELECT (SELECT d.n+1 FROM (SELECT 7 AS n WHERE 0) AS d) AS none, 8 IN (SELECT d.n+1 FROM (SELECT 7 AS n LIMIT 1 OFFSET 1) AS d) AS miss',['none','miss'],[[['null',null],['integer',0n]]]],
 ['SELECT (SELECT d.b FROM (SELECT 7 AS a, 8 AS b LIMIT 1) AS d) AS value, EXISTS(SELECT d.b FROM (SELECT 7 AS a, 8 AS b LIMIT 0) AS d) AS absent, 8 IN (SELECT d.b FROM (SELECT 7 AS a, 8 AS b LIMIT 1) AS d) AS member',['value','absent','member'],[[['integer',8n],['integer',0n],['integer',1n]]]],
 ['SELECT (SELECT d.b+d.a FROM (SELECT 7 AS a, 8 AS b WHERE 0) AS d) AS none, (SELECT d.b+d.a FROM (SELECT 7 AS a, 8 AS b LIMIT 1) AS d WHERE d.a=7 LIMIT 1) AS sum',['none','sum'],[[['null',null],['integer',15n]]]],
 ['SELECT (SELECT d.b FROM (SELECT DISTINCT 7 AS a, 8 AS b LIMIT 1) AS d) AS value, EXISTS(SELECT d.b FROM (SELECT DISTINCT 7 AS a, 8 AS b LIMIT 0) AS d) AS absent, 8 IN (SELECT d.b FROM (SELECT DISTINCT 7 AS a, 8 AS b LIMIT 1) AS d) AS member',['value','absent','member'],[[['integer',8n],['integer',0n],['integer',1n]]]],
 ['SELECT (SELECT d.b FROM (SELECT 7 AS a, 8 AS b ORDER BY b DESC LIMIT 1) AS d) AS ordered, EXISTS(SELECT d.b FROM (SELECT 7 AS a, 8 AS b ORDER BY a LIMIT 0) AS d) AS absent, 8 IN (SELECT d.b FROM (SELECT 7 AS a, 8 AS b ORDER BY b LIMIT 1) AS d) AS member',['ordered','absent','member'],[[['integer',8n],['integer',0n],['integer',1n]]]],
 ['SELECT (SELECT d.b FROM (SELECT 7 AS a, 8 AS b ORDER BY 2 DESC LIMIT 1) AS d) AS ordinal, (SELECT d.b FROM (SELECT 7 AS a, 8 AS b ORDER BY b LIMIT 1) AS d) AS alias',['ordinal','alias'],[[['integer',8n],['integer',8n]]]],
 ['SELECT (SELECT d.x FROM (SELECT x FROM t2 ORDER BY x DESC) d WHERE d.x>0) AS value, EXISTS(SELECT d.x FROM (SELECT x FROM t2 ORDER BY x DESC) d WHERE d.x>99) AS absent, 7 IN (SELECT d.x FROM (SELECT x FROM t2 ORDER BY x DESC) d WHERE d.x>0) AS member',['value','absent','member'],[[['integer',9n],['integer',0n],['integer',0n]]]],
 ['SELECT (SELECT d.x FROM (SELECT x FROM t2 ORDER BY x DESC LIMIT 1) d) AS value, EXISTS(SELECT d.x FROM (SELECT x FROM t2 LIMIT 0) d) AS absent, 7 IN (SELECT d.x FROM (SELECT x FROM t2 ORDER BY x LIMIT 2) d) AS member',['value','absent','member'],[[['integer',9n],['integer',0n],['integer',0n]]]],
 ['SELECT (SELECT d.x FROM (SELECT x AS x FROM t2 ORDER BY 1 DESC LIMIT 1) d) AS ordinal, (SELECT d.x FROM (SELECT x AS x FROM t2 ORDER BY x DESC LIMIT 1) d) AS alias',['ordinal','alias'],[[['integer',9n],['integer',9n]]]],
 ['SELECT (SELECT d.y FROM (SELECT x+1 AS y FROM t2 ORDER BY y DESC LIMIT 1) d) AS alias, (SELECT d.y FROM (SELECT x+1 AS y FROM t2 ORDER BY 1 DESC LIMIT 1) d) AS ordinal',['alias','ordinal'],[[['integer',10n],['integer',10n]]]],
 ['SELECT (SELECT d.b FROM (SELECT x AS a, x+1 AS b FROM t2 ORDER BY 2 DESC LIMIT 1) d) AS ordinal, (SELECT d.b FROM (SELECT x AS a, x+1 AS b FROM t2 ORDER BY b DESC LIMIT 1) d) AS alias',['ordinal','alias'],[[['integer',10n],['integer',10n]]]],
 ['SELECT (SELECT d.y FROM (SELECT x+1 AS y FROM t2 ORDER BY y COLLATE BINARY DESC LIMIT 1) d) AS alias, (SELECT d.y FROM (SELECT x+1 AS y FROM t2 ORDER BY 1 COLLATE BINARY DESC LIMIT 1) d) AS ordinal',['alias','ordinal'],[[['integer',10n],['integer',10n]]]],
 ['SELECT (SELECT d.y FROM (SELECT x+1 AS y FROM t2 LIMIT 1) d WHERE d.y>2) AS filtered, EXISTS(SELECT d.y FROM (SELECT x+1 AS y FROM t2 LIMIT 1) d WHERE d.y>2) AS absent, 3 IN (SELECT d.y FROM (SELECT x+1 AS y FROM t2 LIMIT 1) d WHERE d.y>2) AS member',['filtered','absent','member'],[[['null',null],['integer',0n],['integer',0n]]]],
 ['SELECT (SELECT d.y FROM (SELECT x+1 AS y FROM t2 ORDER BY y DESC LIMIT 2) d WHERE d.y<10) AS filtered, EXISTS(SELECT d.y FROM (SELECT x+1 AS y FROM t2 ORDER BY y DESC LIMIT 2) d WHERE d.y<10) AS present, 4 IN (SELECT d.y FROM (SELECT x+1 AS y FROM t2 ORDER BY y DESC LIMIT 2) d WHERE d.y<10) AS member',['filtered','present','member'],[[['integer',4n],['integer',1n],['integer',1n]]]],
 ['SELECT (SELECT d.a FROM (SELECT x AS a, x+1 AS b FROM t2 ORDER BY 2 DESC LIMIT 2) d WHERE d.a<9) AS filtered, EXISTS(SELECT d.a FROM (SELECT x AS a, x+1 AS b FROM t2 ORDER BY 2 DESC LIMIT 2) d WHERE d.a<9) AS present, 3 IN (SELECT d.a FROM (SELECT x AS a, x+1 AS b FROM t2 ORDER BY 2 DESC LIMIT 2) d WHERE d.a<9) AS member',['filtered','present','member'],[[['integer',3n],['integer',1n],['integer',1n]]]],
 ['SELECT (SELECT d.b FROM (SELECT x AS a, x+1 AS b FROM t2 ORDER BY 2 DESC LIMIT 2) d WHERE d.a<9) AS filtered, EXISTS(SELECT d.b FROM (SELECT x AS a, x+1 AS b FROM t2 ORDER BY 2 DESC LIMIT 2) d WHERE d.a<9) AS present, 4 IN (SELECT d.b FROM (SELECT x AS a, x+1 AS b FROM t2 ORDER BY 2 DESC LIMIT 2) d WHERE d.a<9) AS member',['filtered','present','member'],[[['integer',4n],['integer',1n],['integer',1n]]]],
 ['SELECT (SELECT d.b FROM (SELECT x AS a, x+1 AS b FROM t2 ORDER BY 2 DESC LIMIT 2) d WHERE d.b<10) AS filtered, EXISTS(SELECT d.b FROM (SELECT x AS a, x+1 AS b FROM t2 ORDER BY 2 DESC LIMIT 2) d WHERE d.b<10) AS present, 4 IN (SELECT d.b FROM (SELECT x AS a, x+1 AS b FROM t2 ORDER BY 2 DESC LIMIT 2) d WHERE d.b<10) AS member',['filtered','present','member'],[[['integer',4n],['integer',1n],['integer',1n]]]],
 ['SELECT (SELECT d.b FROM (SELECT x AS a, x+1 AS b FROM t2 ORDER BY 2 DESC LIMIT 2 OFFSET 1) d WHERE d.a<9) AS filtered, EXISTS(SELECT d.b FROM (SELECT x AS a, x+1 AS b FROM t2 ORDER BY 2 DESC LIMIT 2 OFFSET 1) d WHERE d.a<9) AS present, 4 IN (SELECT d.b FROM (SELECT x AS a, x+1 AS b FROM t2 ORDER BY 2 DESC LIMIT 2 OFFSET 1) d WHERE d.a<9) AS member',['filtered','present','member'],[[['integer',4n],['integer',1n],['integer',1n]]]],
 ['SELECT (SELECT d.b FROM (SELECT x AS a, x+1 AS b FROM t2 LIMIT 3) d WHERE d.a>1) AS filtered, EXISTS(SELECT d.b FROM (SELECT x AS a, x+1 AS b FROM t2 LIMIT 3) d WHERE d.a>1) AS present, 4 IN (SELECT d.b FROM (SELECT x AS a, x+1 AS b FROM t2 LIMIT 3) d WHERE d.a>1) AS member',['filtered','present','member'],[[['integer',4n],['integer',1n],['integer',1n]]]],
 ['SELECT (SELECT x FROM t2 ORDER BY (SELECT 1) DESC LIMIT 2) AS first, EXISTS(SELECT x FROM t2 ORDER BY (SELECT 1) DESC LIMIT 2) AS present, 4 IN (SELECT x FROM t2 ORDER BY (SELECT 1) DESC LIMIT 2) AS member',['first','present','member'],[[['integer',1n],['integer',1n],['integer',0n]]]],
 ['SELECT (SELECT x FROM t2 WHERE x IN (SELECT 4) ORDER BY x LIMIT 1) AS first, EXISTS(SELECT x FROM t2 WHERE x IN (SELECT 4)) AS present, 4 IN (SELECT x FROM t2 WHERE x IN (SELECT 4)) AS member',['first','present','member'],[[['null',null],['integer',0n],['integer',0n]]]],
 ['SELECT (SELECT x FROM t2 WHERE x IN (SELECT 1) ORDER BY x LIMIT 1) AS first, EXISTS(SELECT x FROM t2 WHERE x IN (SELECT 1)) AS present, 1 IN (SELECT x FROM t2 WHERE x IN (SELECT 1)) AS member',['first','present','member'],[[['integer',1n],['integer',1n],['integer',1n]]]],
 ['SELECT (SELECT x FROM t2 WHERE x IN (SELECT x) ORDER BY x DESC LIMIT 1) AS first, EXISTS(SELECT x FROM t2 WHERE x IN (SELECT x)) AS present, 7 IN (SELECT x FROM t2 WHERE x IN (SELECT x)) AS member',['first','present','member'],[[['integer',9n],['integer',1n],['integer',0n]]]],
 ['SELECT (SELECT x FROM t2 WHERE x IN (SELECT x WHERE x>1) ORDER BY x DESC LIMIT 1) AS first, EXISTS(SELECT x FROM t2 WHERE x IN (SELECT x WHERE x>1)) AS present, 1 IN (SELECT x FROM t2 WHERE x IN (SELECT x WHERE x>1)) AS member',['first','present','member'],[[['integer',9n],['integer',1n],['integer',0n]]]],
 ['SELECT (SELECT x FROM t2 WHERE x IN (SELECT abs(x) WHERE abs(x)>1) ORDER BY x DESC LIMIT 1) AS first, EXISTS(SELECT x FROM t2 WHERE x IN (SELECT abs(x) WHERE abs(x)>1)) AS present, 1 IN (SELECT x FROM t2 WHERE x IN (SELECT abs(x) WHERE abs(x)>1)) AS member',['first','present','member'],[[['integer',9n],['integer',1n],['integer',0n]]]],
 ['SELECT (SELECT x FROM t2 ORDER BY y DESC, x DESC LIMIT 1) AS first, EXISTS(SELECT x FROM t2 ORDER BY y DESC, x DESC LIMIT 0) AS absent, 1 IN (SELECT x FROM t2 ORDER BY y DESC, x DESC) AS member',['first','absent','member'],[[['integer',3n],['integer',0n],['integer',1n]]]],
 ['SELECT (SELECT x FROM t2 WHERE x>1 ORDER BY y DESC, x DESC LIMIT 1 OFFSET 1) AS second, EXISTS(SELECT x FROM t2 WHERE x>1 ORDER BY y DESC, x DESC LIMIT 1 OFFSET 1) AS present',['second','present'],[[['integer',9n],['integer',1n]]]],
 ['SELECT (SELECT count(*) FROM t1 LEFT JOIN t2 ON t1.a=t2.x GROUP BY t1.a ORDER BY t1.a DESC LIMIT 1) AS first, EXISTS(SELECT count(*) FROM t1 LEFT JOIN t2 ON t1.a=t2.x GROUP BY t1.a LIMIT 0) AS absent, 1 IN (SELECT count(*) FROM t1 LEFT JOIN t2 ON t1.a=t2.x GROUP BY t1.a) AS member',['first','absent','member'],[[['integer',1n],['integer',0n],['integer',1n]]]],
 ['SELECT (SELECT count(*) FROM t1 LEFT JOIN t2 ON t1.a=t2.x GROUP BY t1.a ORDER BY t1.a DESC LIMIT 1) AS unmatched, 0 IN (SELECT count(*) FROM t1 LEFT JOIN t2 ON t1.a=t2.x GROUP BY t1.a) AS zero, 1 IN (SELECT count(*) FROM t1 LEFT JOIN t2 ON t1.a=t2.x GROUP BY t1.a) AS one',['unmatched','zero','one'],[[['integer',1n],['integer',0n],['integer',1n]]]],
 ['SELECT (SELECT count(t2.x) FROM t1 LEFT JOIN t2 ON t1.a=t2.x GROUP BY t1.a ORDER BY t1.a DESC LIMIT 1) AS unmatched, 0 IN (SELECT count(t2.x) FROM t1 LEFT JOIN t2 ON t1.a=t2.x GROUP BY t1.a) AS zero, EXISTS(SELECT count(t2.x) FROM t1 LEFT JOIN t2 ON t1.a=t2.x WHERE t2.x IS NULL GROUP BY t1.a) AS absent_partner',['unmatched','zero','absent_partner'],[[['integer',0n],['integer',1n],['integer',1n]]]],
 ['SELECT (SELECT count(t2.x) FROM t1 LEFT JOIN t2 ON t1.a=t2.x AND t2.y>99 GROUP BY t1.a ORDER BY t1.a LIMIT 1) AS rejected_on, 0 IN (SELECT count(t2.x) FROM t1 LEFT JOIN t2 ON t1.a=t2.x AND t2.y>99 GROUP BY t1.a) AS zero',['rejected_on','zero'],[[['integer',0n],['integer',1n]]]],
 ['SELECT (SELECT count(r.x) FROM t1 LEFT JOIN t2 AS m ON t1.a=m.x LEFT JOIN t2 AS r ON m.x=r.x AND r.y>99 GROUP BY t1.a ORDER BY t1.a LIMIT 1) AS tail, 0 IN (SELECT count(r.x) FROM t1 LEFT JOIN t2 AS m ON t1.a=m.x LEFT JOIN t2 AS r ON m.x=r.x AND r.y>99 GROUP BY t1.a) AS zero',['tail','zero'],[[['integer',0n],['integer',1n]]]],
 ['SELECT (SELECT count(*) FROM t2 GROUP BY x ORDER BY count(*)+1 DESC LIMIT 1) AS top, EXISTS(SELECT count(*) FROM t2 GROUP BY x ORDER BY count(*)+1 DESC LIMIT 0) AS absent, 2 IN (SELECT count(*) FROM t2 GROUP BY x ORDER BY count(*)+1 DESC) AS member',['top','absent','member'],[[['integer',2n],['integer',0n],['integer',1n]]]],
 ['SELECT (SELECT count(*) FROM t2 GROUP BY x ORDER BY count(*)+1 DESC LIMIT 1 OFFSET 1) AS next, 2 IN (SELECT count(*) FROM t2 GROUP BY x ORDER BY count(*)+1 DESC LIMIT 1 OFFSET 1) AS member',['next','member'],[[['integer',1n],['integer',0n]]]],
 ['SELECT (SELECT x FROM t2 GROUP BY x ORDER BY x+1 DESC LIMIT 1) AS last, EXISTS(SELECT x FROM t2 GROUP BY x ORDER BY x+1 DESC LIMIT 0) AS absent',['last','absent'],[[['integer',9n],['integer',0n]]]],
 ['SELECT (SELECT count(*) FROM t2 GROUP BY x ORDER BY sum(y) DESC LIMIT 1) AS sorted, EXISTS(SELECT count(*) FROM t2 GROUP BY x ORDER BY sum(y) DESC LIMIT 0) AS absent',['sorted','absent'],[[['integer',1n],['integer',0n]]]],
 ['SELECT 3 IN (SELECT x FROM t2 WHERE x>1 UNION ALL SELECT a FROM t1 WHERE a>1) AS hit, 2 IN (SELECT x FROM t2 WHERE x>1 UNION ALL SELECT a FROM t1 WHERE a>1) AS miss',['hit','miss'],[[['integer',1n],['integer',0n]]]],
 ['SELECT (SELECT x FROM t2 WHERE x>1 UNION ALL SELECT a FROM t1 WHERE a>1) AS first, EXISTS(SELECT x FROM t2 WHERE x>1 UNION ALL SELECT a FROM t1 WHERE a>1) AS present, (SELECT x FROM t2 WHERE x>100 UNION ALL SELECT a FROM t1 WHERE a>100) AS absent',['first','present','absent'],[[['integer',3n],['integer',1n],['null',null]]]],
 ['SELECT (SELECT x FROM t2 WHERE x>100 UNION ALL SELECT a FROM t1 WHERE a>1) AS second, EXISTS(SELECT x FROM t2 WHERE x>100 UNION ALL SELECT a FROM t1 WHERE a>1) AS present',['second','present'],[[['integer',3n],['integer',1n]]]],
 ['SELECT (SELECT NULL FROM t2 WHERE x=1 UNION ALL SELECT a FROM t1) AS null_first, EXISTS(SELECT NULL FROM t2 WHERE x=1 UNION ALL SELECT a FROM t1) AS present',['null_first','present'],[[['null',null],['integer',1n]]]],
 ['SELECT (SELECT x FROM t2 WHERE x>100 UNION ALL SELECT 7) AS value, EXISTS(SELECT x FROM t2 WHERE x>100 UNION ALL SELECT 7) AS present, 7 IN (SELECT x FROM t2 WHERE x>100 UNION ALL SELECT 7) AS member',['value','present','member'],[[['integer',7n],['integer',1n],['integer',1n]]]],
 ['SELECT (SELECT x FROM t2 WHERE x>1 UNION ALL SELECT 7) AS value, 7 IN (SELECT x FROM t2 WHERE x>1 UNION ALL SELECT 7) AS member',['value','member'],[[['integer',3n],['integer',1n]]]],
 ['SELECT (SELECT x FROM t2 WHERE x>100 UNION ALL SELECT NULL UNION ALL SELECT 7) AS value, EXISTS(SELECT x FROM t2 WHERE x>100 UNION ALL SELECT NULL UNION ALL SELECT 7) AS present',['value','present'],[[['null',null],['integer',1n]]]],
 ['SELECT (SELECT 7 UNION ALL SELECT x FROM t2 WHERE x>1) AS first, EXISTS(SELECT 7 UNION ALL SELECT x FROM t2 WHERE x>1) AS present, 3 IN (SELECT 7 UNION ALL SELECT x FROM t2 WHERE x>1) AS member',['first','present','member'],[[['integer',7n],['integer',1n],['integer',1n]]]],
 ['SELECT (SELECT NULL UNION ALL SELECT x FROM t2 WHERE x>1) AS first_null, EXISTS(SELECT NULL UNION ALL SELECT x FROM t2 WHERE x>1) AS present, 3 IN (SELECT NULL UNION ALL SELECT x FROM t2 WHERE x>1) AS member',['first_null','present','member'],[[['null',null],['integer',1n],['integer',1n]]]],
 ['SELECT (SELECT 7 WHERE 0 UNION ALL SELECT x FROM t2 WHERE x>1) AS first, EXISTS(SELECT 7 WHERE 0 UNION ALL SELECT x FROM t2 WHERE x>1) AS present, 3 IN (SELECT 7 WHERE 0 UNION ALL SELECT x FROM t2 WHERE x>1) AS member',['first','present','member'],[[['integer',3n],['integer',1n],['integer',1n]]]],
 ['SELECT (SELECT NULL WHERE 1 UNION ALL SELECT x FROM t2 WHERE x>1) AS first_null, EXISTS(SELECT NULL WHERE 1 UNION ALL SELECT x FROM t2 WHERE x>1) AS present, 3 IN (SELECT NULL WHERE 1 UNION ALL SELECT x FROM t2 WHERE x>1) AS member',['first_null','present','member'],[[['null',null],['integer',1n],['integer',1n]]]],
 ['SELECT (SELECT 7 WHERE 0 UNION ALL SELECT 3 WHERE 1) AS first, EXISTS(SELECT 7 WHERE 0 UNION ALL SELECT 3 WHERE 1) AS present, 3 IN (SELECT 7 WHERE 0 UNION ALL SELECT 3 WHERE 1) AS member',['first','present','member'],[[['integer',3n],['integer',1n],['integer',1n]]]],
 ['SELECT (SELECT NULL WHERE 1 UNION ALL SELECT 3 WHERE 1) AS first_null, EXISTS(SELECT NULL WHERE 1 UNION ALL SELECT 3 WHERE 1) AS present, 3 IN (SELECT NULL WHERE 1 UNION ALL SELECT 3 WHERE 1) AS member',['first_null','present','member'],[[['null',null],['integer',1n],['integer',1n]]]],
 ['SELECT (SELECT count(*) FROM (SELECT x FROM t2 ORDER BY x DESC LIMIT 2) d) AS n',['n'],[[['integer',2n]]]],
 ['SELECT (SELECT count(*) FROM (SELECT x FROM t2 ORDER BY x DESC LIMIT 0) d) AS n',['n'],[[['integer',0n]]]],
 ['SELECT (SELECT count(*) FROM (SELECT x FROM t2 ORDER BY x DESC LIMIT 2 OFFSET 1) d) AS n',['n'],[[['integer',2n]]]],
 ['SELECT EXISTS(SELECT count(*) FROM (SELECT x FROM t2 ORDER BY x DESC LIMIT 2) d) AS hit, 2 IN (SELECT count(*) FROM (SELECT x FROM t2 ORDER BY x DESC LIMIT 2) d) AS member',['hit','member'],[[['integer',1n],['integer',1n]]]],
 ['SELECT (SELECT max(d.z) FROM (SELECT z FROM t2 ORDER BY rowid LIMIT 3) d) AS v',['v'],[[['text','q']]]],
 ['SELECT (SELECT max(d.z||\'\') FROM (SELECT z FROM t2 ORDER BY rowid LIMIT 3) d) AS v',['v'],[[['text','q ']]]],
 ['SELECT (SELECT max(d.z COLLATE BINARY) FROM (SELECT z FROM t2 ORDER BY rowid LIMIT 3) d) AS v',['v'],[[['text','q ']]]],
 ['SELECT (SELECT count(DISTINCT d.x) FROM (SELECT x FROM t2 ORDER BY x DESC LIMIT 4) d) AS v',['v'],[[['integer',3n]]]],
 ['SELECT (SELECT sum(DISTINCT d.x) FILTER (WHERE d.x<9) FROM (SELECT x FROM t2 ORDER BY x DESC LIMIT 4) d) AS v',['v'],[[['integer',4n]]]],
 ['SELECT (SELECT max(DISTINCT d.z) FROM (SELECT z FROM t2 ORDER BY rowid LIMIT 3) d) AS v',['v'],[[['text','q']]]],
 ['SELECT 3 IN (SELECT count(DISTINCT d.x) FROM (SELECT x FROM t2 ORDER BY x DESC LIMIT 4) d) AS member, EXISTS(SELECT sum(DISTINCT d.x) FROM (SELECT x FROM t2 LIMIT 0) d) AS hit',['member','hit'],[[['integer',1n],['integer',1n]]]],
 ['SELECT 5 IN (SELECT sum(d.x ORDER BY d.x DESC) FILTER (WHERE d.x<9) FROM (SELECT x FROM t2 ORDER BY x DESC LIMIT 4) d) AS member, EXISTS(SELECT count(d.x ORDER BY d.x DESC) FROM (SELECT x FROM t2 LIMIT 0) d) AS hit',['member','hit'],[[['integer',1n],['integer',1n]]]],
 ['SELECT (SELECT sum(DISTINCT d.x ORDER BY d.x DESC) FROM (SELECT x FROM t2 ORDER BY x DESC LIMIT 4) d) AS v',['v'],[[['integer',13n]]]],
 ['SELECT (SELECT sum(d.x ORDER BY d.x DESC) FILTER (WHERE d.x<9) FROM (SELECT x FROM t2 ORDER BY x DESC LIMIT 4) d) AS v',['v'],[[['integer',5n]]]],
 ['SELECT (SELECT group_concat(d.z ORDER BY d.x) FROM (SELECT x,z FROM t2 ORDER BY x DESC LIMIT 4) d) AS v',['v'],[[['text','q,q ,n']]]],
 ['SELECT (SELECT group_concat(DISTINCT d.z ORDER BY d.x) FILTER (WHERE d.x<9) FROM (SELECT x,z FROM t2 ORDER BY x DESC LIMIT 4) d) AS v',['v'],[[['text','q']]]],
 ['SELECT (SELECT group_concat(d.z ORDER BY d.x) FROM (SELECT x,z FROM t2 LIMIT 0) d) AS v',['v'],[[['null',null]]]],
 ["SELECT 'q,q ,n' IN (SELECT group_concat(d.z ORDER BY d.x) FROM (SELECT x,z FROM t2 ORDER BY x DESC LIMIT 4) d) AS m",['m'],[[['integer',1n]]]],
 ['SELECT (SELECT group_concat(d.z,d.sep ORDER BY d.x) FROM (SELECT x,z, \':\' AS sep FROM t2 ORDER BY x DESC LIMIT 4) d) AS v',['v'],[[['text','q:q :n']]]],
 ["SELECT (SELECT string_agg(d.z,d.sep ORDER BY d.x) FILTER (WHERE d.x<9) FROM (SELECT x,z, ';' AS sep FROM t2 ORDER BY x DESC LIMIT 4) d) AS v",['v'],[[['text','q;q ']]]],
 ["SELECT (SELECT group_concat(d.z,d.sep ORDER BY d.x) FROM (SELECT x,z, ':' AS sep FROM t2 LIMIT 0) d) AS v",['v'],[[['null',null]]]],
 ["SELECT 'q:q :n' IN (SELECT group_concat(d.z,d.sep ORDER BY d.x) FROM (SELECT x,z, ':' AS sep FROM t2 ORDER BY x DESC LIMIT 4) d) AS m",['m'],[[['integer',1n]]]],
 ['SELECT (SELECT count(*) FROM (SELECT x FROM t2 ORDER BY x DESC LIMIT 4) d WHERE d.x<3) AS n',['n'],[[['integer',2n]]]],
 ['SELECT (SELECT sum(DISTINCT d.x ORDER BY d.x DESC) FILTER (WHERE d.x IS NOT NULL) FROM (SELECT x FROM t2 ORDER BY x DESC LIMIT 4) d WHERE d.x<9) AS v',['v'],[[['integer',4n]]]],
 ["SELECT (SELECT group_concat(d.z, ':' ORDER BY d.x) FROM (SELECT x,z FROM t2 ORDER BY x DESC LIMIT 4) d WHERE d.x<9) AS v",['v'],[[['text','q:q ']]]],
 ['SELECT (SELECT count(*) FROM (SELECT x FROM t2 LIMIT 0) d WHERE d.x>0) AS v',['v'],[[['integer',0n]]]],
 ['SELECT 1 IN (SELECT count(*) FROM (SELECT x FROM t2 ORDER BY x DESC LIMIT 4) d WHERE d.x<3) AS m',['m'],[[['integer',0n]]]],
 ['SELECT (SELECT count(d.x ORDER BY d.x DESC) FROM (SELECT x FROM t2 LIMIT 0) d) AS v',['v'],[[['integer',0n]]]],
 ['SELECT (SELECT count(DISTINCT d.x) FROM (SELECT x FROM t2 ORDER BY x DESC LIMIT 0) d) AS v',['v'],[[['integer',0n]]]],
 ['SELECT (SELECT sum(d.x+1) FILTER (WHERE d.x>3) FROM (SELECT x FROM t2 ORDER BY x DESC LIMIT 3) d) AS v',['v'],[[['integer',10n]]]],
 ['SELECT (SELECT count(*) FILTER (WHERE d.x<3) FROM (SELECT x FROM t2 ORDER BY x DESC LIMIT 2) d) AS v',['v'],[[['integer',0n]]]],
 ['SELECT (SELECT count(d.x) FILTER (WHERE d.x IS NULL) FROM (SELECT x FROM t2 ORDER BY x DESC LIMIT 2) d) AS v',['v'],[[['integer',0n]]]],
 ['SELECT (SELECT sum(d.x) FILTER (WHERE d.x>3) FROM (SELECT x FROM t2 ORDER BY x DESC LIMIT 0) d) AS v',['v'],[[['null',null]]]],
 ['SELECT (SELECT sum(d.x) FROM (SELECT x FROM t2 ORDER BY x DESC LIMIT 2) d) AS v',['v'],[[['integer',12n]]]],
 // Pinned 3.53.4 select.c:updateAccumulator evaluates the enclosing argument
 // on accepted producer rows, not on the producer's unsorted scan input.
 ['SELECT (SELECT sum(d.x+1) FROM (SELECT x FROM t2 ORDER BY x DESC LIMIT 2) d) AS v',['v'],[[['integer',14n]]]],
 ['SELECT (SELECT count(NULLIF(d.x,3)) FROM (SELECT x FROM t2 ORDER BY x DESC LIMIT 2 OFFSET 1) d) AS v',['v'],[[['integer',1n]]]],
 ['SELECT (SELECT count(*) FROM (SELECT x FROM t2 ORDER BY x DESC LIMIT 4) d WHERE d.x<3 LIMIT 0) AS v',['v'],[[['null',null]]]],
 ['SELECT (SELECT sum(d.x) FROM (SELECT x FROM t2 ORDER BY x DESC LIMIT 4) d WHERE d.x<3 LIMIT 1 OFFSET 0) AS v',['v'],[[['integer',2n]]]],
 ["SELECT (SELECT group_concat(d.z,':' ORDER BY d.x) FROM (SELECT x,z FROM t2 ORDER BY x DESC LIMIT 4) d LIMIT 2 OFFSET 0) AS v",['v'],[[['text','q:q :n']]]],
 ['SELECT 2 IN (SELECT count(*) FROM (SELECT x FROM t2 ORDER BY x DESC LIMIT 4) d WHERE d.x<3 LIMIT 0) AS m',['m'],[[['integer',0n]]]],
 ['SELECT EXISTS(SELECT count(*) FROM (SELECT x FROM t2 ORDER BY x DESC LIMIT 4) d WHERE d.x<3 LIMIT 0) AS e',['e'],[[['integer',0n]]]],
 ['SELECT (SELECT count(*) AS n FROM (SELECT x FROM t2 ORDER BY x DESC LIMIT 4) d WHERE d.x<3 ORDER BY n DESC LIMIT 0) AS v',['v'],[[['null',null]]]],
 ['SELECT (SELECT sum(d.x) AS n FROM (SELECT x FROM t2 ORDER BY x DESC LIMIT 4) d WHERE d.x<3 ORDER BY n DESC LIMIT 1 OFFSET 0) AS v',['v'],[[['integer',2n]]]],
 ["SELECT (SELECT group_concat(d.z,':' ORDER BY d.x) AS n FROM (SELECT x,z FROM t2 ORDER BY x DESC LIMIT 4) d ORDER BY n DESC) AS v",['v'],[[['text','q:q :n']]]],
 ['SELECT 2 IN (SELECT count(*) AS n FROM (SELECT x FROM t2 ORDER BY x DESC LIMIT 4) d WHERE d.x<3 ORDER BY n LIMIT 0) AS m',['m'],[[['integer',0n]]]],
 ['SELECT EXISTS(SELECT count(*) AS n FROM (SELECT x FROM t2 ORDER BY x DESC LIMIT 4) d WHERE d.x<3 ORDER BY n LIMIT 0) AS e',['e'],[[['integer',0n]]]],
 ['SELECT (SELECT count(*) AS n FROM (SELECT x FROM t2 LIMIT 0) d ORDER BY 9+0 LIMIT 0) AS v',['v'],[[['null',null]]]],
 ['SELECT (SELECT count(*) AS n FROM (SELECT x FROM t2 LIMIT 0) d ORDER BY d.x LIMIT 0) AS v',['v'],[[['null',null]]]],
 ['SELECT (SELECT avg(d.x*2) FROM (SELECT x FROM t2 ORDER BY x DESC LIMIT 0) d) AS v',['v'],[[['null',null]]]],
 ['SELECT (SELECT min(d.x+1) FROM (SELECT x FROM t2 ORDER BY x DESC LIMIT 2) d) AS v',['v'],[[['integer',4n]]]],
 ['SELECT (SELECT count(d.x) FROM (SELECT x FROM t2 ORDER BY x DESC LIMIT 0) d) AS v',['v'],[[['integer',0n]]]],
 ['SELECT (SELECT avg(d.x) FROM (SELECT x FROM t2 ORDER BY x DESC LIMIT 2 OFFSET 1) d) AS v',['v'],[[['real',2]]]],
 ['SELECT (SELECT sum(d.x) FROM (SELECT x FROM t2 ORDER BY x DESC LIMIT 0) d) AS v',['v'],[[['null',null]]]],
 ['SELECT 3 IN (SELECT sum(d.x) FROM (SELECT x FROM t2 ORDER BY x DESC LIMIT 2) d) AS member',['member'],[[['integer',0n]]]],
 ['SELECT (SELECT min(d.x) FROM (SELECT x FROM t2 ORDER BY x DESC LIMIT 2) d) AS v',['v'],[[['integer',3n]]]],
 ['SELECT (SELECT max(d.x) FROM (SELECT x FROM t2 ORDER BY x DESC LIMIT 2 OFFSET 1) d) AS v',['v'],[[['integer',3n]]]],
 ['SELECT (SELECT min(d.x) FROM (SELECT x FROM t2 ORDER BY x DESC LIMIT 0) d) AS v',['v'],[[['null',null]]]],
 ['SELECT (SELECT min(d.x COLLATE NOCASE) FROM (SELECT x FROM t2 ORDER BY x DESC LIMIT 2) d) AS v',['v'],[[['integer',3n]]]],
 ['SELECT 3 IN (SELECT min(d.x) FROM (SELECT x FROM t2 ORDER BY x DESC LIMIT 2) d) AS member',['member'],[[['integer',1n]]]],
 ['SELECT EXISTS(SELECT min(d.x) FROM (SELECT x FROM t2 ORDER BY x DESC LIMIT 0) d) AS hit',['hit'],[[['integer',1n]]]],
];
test('public scalar, correlated aggregate, EXISTS and IN preserve pinned destination rows, types, names, reset',async()=>{
 const server=http.createServer((_req,res)=>{res.writeHead(200,{'Content-Length':bytes.length});res.end(bytes)});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let db;
 try{db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
  for(const [sql,expectedNames,expectedRows] of cases){const stmt=db.prepare(sql).statement;try{
   const names=Array.from({length:stmt.columnCount},(_,i)=>stmt.columnMetadata(i).name);
   const iterations=[];for(let j=0;j<2;j++){const rows=[];while(await stmt.step()==='row')rows.push(Array.from({length:stmt.columnCount},(_,i)=>[stmt.columnType(i),stmt.column(i)]));iterations.push(rows);stmt.reset()}
   assert.deepEqual(iterations[0],iterations[1]);
   assert.deepEqual(names,expectedNames);assert.deepEqual(iterations[0],expectedRows,sql);
  }finally{stmt.finalize()}}
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()))}
});
test('no-FROM ORDER ordinal range errors match pinned preparation without publishing a statement',async()=>{
 const server=http.createServer((_req,res)=>{res.writeHead(200,{'Content-Length':bytes.length});res.end(bytes)});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let db;
 try{db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
  assert.throws(()=>db.prepare('SELECT (SELECT min(d.z) FROM (SELECT x FROM t2 ORDER BY x DESC LIMIT 0) d) AS v'),/no such column: d.z/);
  assert.throws(()=>db.prepare('SELECT (SELECT sum(d.x ORDER BY d.z) FROM (SELECT x FROM t2 LIMIT 0) d) AS v'),/no such column: d.z/);
  assert.throws(()=>db.prepare('SELECT (SELECT count(DISTINCT d.z) FROM (SELECT x FROM t2 LIMIT 0) d) AS v'),/no such column: d.z/);
  assert.throws(()=>db.prepare('SELECT (SELECT count(*) FILTER (WHERE d.z>0) FROM (SELECT x FROM t2 ORDER BY x DESC LIMIT 0) d) AS v'),/no such column: d.z/);
  assert.throws(()=>db.prepare('SELECT (SELECT sum(d.z+1) FROM (SELECT x FROM t2 ORDER BY x DESC LIMIT 0) d) AS v'),/no such column: d.z/);
  assert.throws(()=>db.prepare('SELECT (SELECT count(*) FROM (SELECT x FROM t2 LIMIT 0) d WHERE d.bad>0) AS v'),/no such column: d.bad/);
  assert.throws(()=>db.prepare('SELECT (SELECT count(*) FROM (SELECT x FROM t2 LIMIT 0) d WHERE d.bad>0 LIMIT 0) AS v'),/no such column: d.bad/);
  assert.throws(()=>db.prepare('SELECT (SELECT count(*) AS n FROM (SELECT x FROM t2 LIMIT 0) d ORDER BY d.bad LIMIT 0) AS v'),/no such column: d.bad/);
  assert.throws(()=>db.prepare('SELECT (SELECT count(*) AS n FROM (SELECT x FROM t2 LIMIT 0) d ORDER BY 2 LIMIT 0) AS v'),/1st ORDER BY term out of range - should be between 1 and 1/);
  assert.throws(()=>db.prepare('SELECT (SELECT group_concat(d.z,d.bad ORDER BY d.x) FROM (SELECT x,z FROM t2 LIMIT 0) d) AS v'),/no such column: d.bad/);
  assert.throws(()=>db.prepare('SELECT (SELECT sum(d.z) FROM (SELECT x FROM t2 ORDER BY x DESC LIMIT 0) d) AS v'),/no such column: d.z/);
  assert.throws(()=>db.prepare('SELECT (SELECT sum(q.x) FROM (SELECT x FROM t2 ORDER BY x DESC LIMIT 0) d) AS v'),/no such column: q.x/);
  assert.throws(()=>db.prepare('SELECT (SELECT sum(d.x) FROM (SELECT x FROM t2 ORDER BY x DESC LIMIT 0) d) AS v, (SELECT sum(d.z) FROM (SELECT x FROM t2 ORDER BY x DESC LIMIT 0) d) AS invalid'),/no such column: d.z/);
  for(const sql of ['SELECT (SELECT 7 ORDER BY 2) AS v','SELECT (SELECT 7 ORDER BY 2 LIMIT 0) AS v'])assert.throws(()=>db.prepare(sql),/1st ORDER BY term out of range - should be between 1 and 1/);
  assert.throws(()=>db.prepare('SELECT (SELECT 7 ORDER BY nonexistent) AS v'),/no such column: nonexistent/);
  assert.throws(()=>db.prepare('SELECT (SELECT count(*) FROM (SELECT 9 AS x LIMIT 1) d HAVING count(*)=1 ORDER BY 2 LIMIT 0) AS v'),/1st ORDER BY term out of range - should be between 1 and 1/);
  assert.throws(()=>db.prepare('SELECT (SELECT count(*) FROM (SELECT 9 AS x LIMIT 1) d HAVING count(*)=1 ORDER BY missing LIMIT 0) AS v'),/no such column: missing/);
  assert.throws(()=>db.prepare('SELECT (SELECT count(*) FROM (SELECT 9 AS x LIMIT 1) d ORDER BY d.y LIMIT 0) AS v'),/no such column: d.y/);
  assert.throws(()=>db.prepare('SELECT (SELECT count(*) FROM (SELECT 9 AS x LIMIT 1) d WHERE d.missing=0 LIMIT 0) AS v'),/no such column: d.missing/);
  assert.throws(()=>db.prepare('SELECT (SELECT count(*) FROM (SELECT 9 AS x, 8 AS y LIMIT 1) d WHERE d.z=8 LIMIT 0) AS v'),/no such column: d.z/);
  assert.throws(()=>db.prepare('SELECT (SELECT count(*) FROM (SELECT 9 AS x, 8 AS y ORDER BY 3 LIMIT 0) d) AS v'),/1st ORDER BY term out of range - should be between 1 and 2/);
  assert.throws(()=>db.prepare('SELECT (SELECT count(*) FROM (SELECT 9 AS x, 8 AS y ORDER BY missing LIMIT 0) d) AS v'),/no such column: missing/);
  assert.throws(()=>db.prepare('SELECT (SELECT count(*) FROM (SELECT DISTINCT 9 AS x ORDER BY 2 LIMIT 0) d) AS v'),/1st ORDER BY term out of range - should be between 1 and 1/);
  assert.throws(()=>db.prepare('SELECT (SELECT count(d.z) FROM (SELECT 9 AS x LIMIT 0) d) AS v'),/no such column: d.z/);
  assert.throws(()=>db.prepare('SELECT (SELECT count(d.x) FROM (SELECT NULL AS x, 8 AS y LIMIT 0) d HAVING count(d.z)=0) AS v'),/no such column: d.z/);
  assert.throws(()=>db.prepare('SELECT (SELECT count(DISTINCT d.z) FROM (SELECT 9 AS x LIMIT 0) d) AS v'),/no such column: d.z/);
  assert.throws(()=>db.prepare('SELECT (SELECT count(*) FILTER (WHERE d.z=1) FROM (SELECT 9 AS x LIMIT 0) d) AS v'),/no such column: d.z/);
  assert.throws(()=>db.prepare('SELECT (SELECT count(*) FILTER (WHERE count(*)>0) FROM (SELECT 9 AS x LIMIT 0) d) AS v'),/misuse of aggregate function count\(\)/);
  assert.throws(()=>db.prepare('SELECT (SELECT count(d.x ORDER BY d.z) FROM (SELECT 9 AS x LIMIT 0) d) AS v'),/no such column: d.z/);
  assert.throws(()=>db.prepare('SELECT (SELECT count(d.x ORDER BY count(*)) FROM (SELECT 9 AS x LIMIT 0) d) AS v'),/misuse of aggregate function count\(\)/);
  assert.throws(()=>db.prepare('SELECT (SELECT sum(d.z) FROM (SELECT 9 AS x LIMIT 0) d) AS v'),/no such column: d.z/);
  assert.throws(()=>db.prepare('SELECT (SELECT min(d.z) FROM (SELECT 9 AS x LIMIT 0) d) AS v'),/no such column: d.z/);
  assert.throws(()=>db.prepare("SELECT (SELECT group_concat(d.z) FROM (SELECT 'Hi' AS x LIMIT 0) d) AS v"),/no such column: d.z/);
  assert.throws(()=>db.prepare('SELECT (SELECT count(*) FROM (SELECT 9 AS x GROUP BY 2) d) AS v'),/1st GROUP BY term out of range - should be between 1 and 1/);
  assert.throws(()=>db.prepare('SELECT (SELECT count(*) FROM (SELECT 9 AS x WHERE 0 GROUP BY z) d) AS v'),/no such column: z/);
  assert.throws(()=>db.prepare('SELECT (SELECT count(*) FROM (SELECT 9 AS x GROUP BY count(*)) d) AS v'),/aggregate functions are not allowed in the GROUP BY clause/);
  assert.throws(()=>db.prepare('SELECT (SELECT count(*) FROM (SELECT 9 AS x GROUP BY x HAVING z=1 LIMIT 0) d) AS v'),/no such column: z/);
  assert.throws(()=>db.prepare('SELECT (SELECT count(*) FROM (SELECT 9 AS x GROUP BY x HAVING count(z)>0 LIMIT 0) d) AS v'),/no such column: z/);
  assert.throws(()=>db.prepare("SELECT (SELECT count(*) FROM (SELECT 'Hi' AS x GROUP BY x HAVING group_concat(z)='Hi' LIMIT 0) d) AS v"),/no such column: z/);
  assert.throws(()=>db.prepare("SELECT (SELECT count(*) FROM (SELECT 9 AS x GROUP BY x HAVING group_concat(x ORDER BY z)='9' LIMIT 0) d) AS n"),/no such column: z/);
  assert.throws(()=>db.prepare('SELECT (SELECT count(*) FROM (SELECT 9 AS x GROUP BY x HAVING count(*)=1 AND bad=1 LIMIT 0) d) AS v'),/no such column: bad/);
  assert.throws(()=>db.prepare('SELECT (SELECT count(*) FROM (SELECT 9 AS x LIMIT 1) d WHERE count(*)=1) AS v'),/misuse of aggregate: count\(\)/);
  for(const position of [0,3])assert.throws(()=>db.prepare(`SELECT (SELECT d.b FROM (SELECT 7 AS a, 8 AS b ORDER BY ${position} LIMIT 1) AS d)`),/1st ORDER BY term out of range - should be between 1 and 2/);
  assert.throws(()=>db.prepare('SELECT (SELECT d.b FROM (SELECT x AS a, x+1 AS b FROM t2 ORDER BY 3 LIMIT 1) d)'),/1st ORDER BY term out of range - should be between 1 and 2/);
  const stmt=db.prepare('SELECT (SELECT d.b FROM (SELECT 7 AS a, 8 AS b ORDER BY 2 LIMIT 1) AS d)').statement;
  try{assert.equal(await stmt.step(),'row');assert.equal(stmt.columnType(0),'integer');assert.equal(stmt.column(0),8n);stmt.reset();assert.equal(await stmt.step(),'row');assert.equal(stmt.column(0),8n)}finally{stmt.finalize()}
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()))}
});
test('producer ORDER ordinal binds producer width and result before flatten transfer',()=>{
 const text=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const caller=text.slice(text.indexOf('export function compileScalarSelect('),text.indexOf('function compileInnerTableSelect('));
 assert.match(caller,/const width=derived\.select\.result\.length;[^]*?ORDER BY term out of range[^]*?bound=derived\.select\.result\[Number\(key\.value\)-1\]/);
});
test('producer ORDER alias binds producer EList before flatten transfer',()=>{
 const text=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const caller=text.slice(text.indexOf('export function compileScalarSelect('),text.indexOf('function compileInnerTableSelect('));
 assert.match(caller,/resolveOrderGroupBy binds the producer ORDER against its[^]*?bound=derived\.select\.result\.find\(item=>item\.alias[^]*?bound!\.reduction/);
});
test('source-permitted derived LIMIT and ORDER move into parent scan with SRT destination',()=>{
 const text=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const caller=text.slice(text.indexOf('export function compileScalarSelect('),text.indexOf('function compileInnerTableSelect('));
 assert.match(caller,/!nested\.where&&!nested\.hasLimit&&!derived\.select\.offset/);
 assert.match(caller,/limit:derived\.select\.limit\?\?nested\.limit,offset:derived\.select\.offset\?\?nested\.offset,hasLimit:derived\.select\.hasLimit\|\|nested\.hasLimit/);
});
test('nonzero-source derived ORDER transfers into parent without child program relocation',()=>{
 const text=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const caller=text.slice(text.indexOf('export function compileScalarSelect('),text.indexOf('function compileInnerTableSelect('));
 assert.match(caller,/flattenSubquery substitutes transient result columns[^]*?derived\.select\.hasOrderBy\?derived\.select\.orderBy:nested\.orderBy[^]*?return compileSubquery\(\{\.\.\.expression,select:flattened\}\)/);
});
test('nonaggregate joined child consumes enclosing builder at scan and sorter drain',()=>{
 const text=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const producer=text.slice(text.indexOf('function compileInnerTableSelect(',text.indexOf('function compileInnerTableSelect(')+1),text.indexOf('function sqlName(',text.indexOf('function compileInnerTableSelect(')+1));
 const caller=text.slice(text.indexOf('export function compileScalarSelect('),text.indexOf('function compileInnerTableSelect('));
 assert.match(producer,/owner\?owner\.builder\.range\(expanded\.result\.length\)/);
 assert.match(producer,/emitSelectDestination\(ops,owner\.destination,resultStart,expanded\.result\.length\)/);
 assert.match(caller,/compileInnerTableSelect\(nested,expanded,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,\{builder:selectProgramBuilder/);
});
test('grouped scalar child consumes enclosing aggregate builder and destination',()=>{
 const text=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const caller=text.slice(text.indexOf('export function compileScalarSelect('),text.indexOf('function compileInnerTableSelect('));
 assert.match(caller,/if\(nested\.hasGroupBy[^]*?compileAggregateSelect\(nested,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,\{builder:selectProgramBuilder/);
 const aggregate=text.slice(text.indexOf('export function compileAggregateSelect('),text.indexOf('function truth(',text.indexOf('export function compileAggregateSelect(')));
 assert.match(aggregate,/emitSelectDestination\(ops,parent\?\.destination\?\?\{kind:"output"\},outputStart,outputs\.length\)/);
});
test('flattenable derived and view grouped children consume the aggregate parent builder',()=>{
 const text=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const caller=text.slice(text.indexOf('export function compileScalarSelect('),text.indexOf('function compileInnerTableSelect('));
 const aggregate=text.slice(text.indexOf('export function compileAggregateSelect('),text.indexOf('function truth(',text.indexOf('export function compileAggregateSelect(')));
 assert.match(caller,/flattenableGroupedDerived\|\|groupedView/);
 assert.match(caller,/compileAggregateSelect\(nested,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,\{builder:selectProgramBuilder/);
 assert.match(aggregate,/return compileAggregateSelect\(flattened,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,parent\)/);
 assert.match(aggregate,/return compileAggregateSelect\(flattenImmutableView\(select,view\),schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,parent\)/);
});
test('grouped result sorter binds unprojected ORDER group keys from saved accumulator state',()=>{
 const text=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const aggregate=text.slice(text.indexOf('export function compileAggregateSelect('),text.indexOf('function truth(',text.indexOf('export function compileAggregateSelect(')));
 assert.match(text,/function aggregateOrderGroupIndex\(/);
 assert.match(aggregate,/resolvedOrderGroupIndices=select\.hasGroupBy/);
 assert.match(aggregate,/savedBase\+key\.group:compileExpressionTree\(orderExpressions\[index\]!/);
});
test('ungrouped ordered aggregate child retains the enclosing destination',()=>{
 const text=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const caller=text.slice(text.indexOf('export function compileScalarSelect('),text.indexOf('function compileInnerTableSelect('));
 assert.match(text,/function simpleUngroupedAggregateOrder\(/);
 assert.match(caller,/selectHasAggregate\(nested\)&&aggregateShapeSupported\(nested\)/);
 assert.match(caller,/compileAggregateSelect\(nested,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,\{builder:selectProgramBuilder/);
});
test('zero-source derived count child emits producer cardinality into parent aggregate destination',()=>{
 const text=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const producer=text.slice(text.indexOf('function compileZeroSourceDerivedCount('),text.indexOf('/** select.c:sqlite3Select aggregate-without-GROUP'));
 const caller=text.slice(text.indexOf('export function compileScalarSelect('),text.indexOf('function compileInnerTableSelect('));
 assert.match(producer,/if\(parent&&!derived\.select\.hasCompound&&!derived\.select\.hasValues\)[^]*?computeLimitRegisters\(source,ops,allocate,parameters\)[^]*?AggStep[^]*?AggFinal[^]*?emitSelectDestination\(ops,destination,output,1\)/);
 assert.match(text,/compileZeroSourceDerivedCount\(select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,parent\)/);
 assert.match(caller,/compileAggregateSelect\(nested,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,\{builder:selectProgramBuilder/);
});
test('nonflattenable zero-source derived column emits producer row into enclosing destination',()=>{
 const text=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const caller=text.slice(text.indexOf('export function compileScalarSelect('),text.indexOf('function compileInnerTableSelect('));
 assert.match(caller,/flattenSubquery restriction \(7\)[^]*?const limit=computeLimitRegisters\(source,resultOps,allocate,parameters\)[^]*?emitSelectDestination\(resultOps,isIn\?\{kind:"set"[^]*?InSet/);
});
test('nonflattenable zero-source derived column allocates outer limit before producer and drains after both offsets',()=>{
 const text=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const caller=text.slice(text.indexOf('export function compileScalarSelect('),text.indexOf('function compileInnerTableSelect('));
 assert.match(caller,/flattenSubquery restriction \(7\)[^]*?const outerLimit=computeLimitRegisters\(nested,resultOps,allocate,parameters\);[^]*?const limit=computeLimitRegisters\(source,resultOps,allocate,parameters\);[^]*?if\(outerLimit\?\.offset[^]*?emitSelectDestination/);
});
test('nonflattenable zero-source derived column binds outer WHERE after producer admission',()=>{
 const text=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const caller=text.slice(text.indexOf('export function compileScalarSelect('),text.indexOf('function compileInnerTableSelect('));
 assert.match(caller,/flattenSubquery restriction \(7\)[^]*?if\(source\.where\)[^]*?source\.result\.forEach[^]*?if\(outerWhere\)[^]*?outerWhereSkip[^]*?emitSelectDestination/);
});
test('nonflattenable zero-source derived expression binds projected result in enclosing destination',()=>{
 const text=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const caller=text.slice(text.indexOf('export function compileScalarSelect('),text.indexOf('function compileInnerTableSelect('));
 assert.match(caller,/flattenSubquery restriction \(7\)[^]*?const sourceRegisters=source\.result\.map\(\(\)=>allocate\(\)\)[^]*?const outerTree=bind\(expressionFromReduction\(nested\.result\[0\]!\.reduction!\)\)[^]*?compileExpressionTree\(outerTree,resultOps,allocate,parameters,compileSubquery\)[^]*?emitSelectDestination/);
});
test('nonflattenable zero-source multi-column producer retains transient row registers',()=>{
 const text=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const caller=text.slice(text.indexOf('export function compileScalarSelect('),text.indexOf('function compileInnerTableSelect('));
 assert.match(caller,/flattenSubquery restriction \(7\)[^]*?derived\.select\.result\.every\(item=>item\.reduction\)[^]*?const sourceRegisters=source\.result\.map\(\(\)=>allocate\(\)\)[^]*?source\.result\.forEach\(\(item,index\)=>[^]*?p2:sourceRegisters\[index\]![^]*?if\(outerWhere\)[^]*?emitSelectDestination/);
});
test('no-FROM DISTINCT producer admits its sole row without a dedup cursor',()=>{
 const text=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const caller=text.slice(text.indexOf('export function compileScalarSelect('),text.indexOf('function compileInnerTableSelect('));
 assert.match(caller,/flattenSubquery restriction \(7\)[^]*?derived\.select\.from\.items\.length===0[^]*?!selectHasWindow\(derived\.select\)[^]*?WHERE_DISTINCT_UNIQUE[^]*?source\.result\.forEach[^]*?emitSelectDestination/);
});
test('no-FROM ORDER producer evaluates bound keys before producer OFFSET',()=>{
 const text=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const caller=text.slice(text.indexOf('export function compileScalarSelect('),text.indexOf('function compileInnerTableSelect('));
 assert.match(caller,/flattenSubquery restriction \(7\)[^]*?resolveOrderGroupBy[^]*?const orderTrees=source\.orderBy\.map[^]*?source\.result\.forEach[^]*?for\(const tree of orderTrees\)compileExpressionTree[^]*?if\(limit\?\.offset[^]*?emitSelectDestination/);
});
test('scalar child selects compile into the parent builder rather than splice relocated completed Programs',()=>{
 const text=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const body=text.slice(text.indexOf('export function compileScalarSelect('),text.indexOf('function compileInnerTableSelect('));
 assert.doesNotMatch(body,/const child\s*=\s*selectHasAggregate/);
 assert.doesNotMatch(body,/child\.ops\.map\(original/);
});

// Pinned 3.53.4 expr.c:sqlite3CodeSubselect -> select.c:multiSelect / tag-select-0820:
// the UNION ALL arms feed the outer aggregate before its Mem/Exists/Set destination.
// Native source-ID and twice-stepped typed results captured with the ctypes probe
// in the card work area (compound-probe/oracle.py); the public regression is
// deliberately kept red until the compound producer owns the enclosing builder.
test('compound-derived aggregate child uses parent Mem/Exists/Set destinations',async()=>{
 const server=http.createServer((_req,res)=>{res.writeHead(200,{'Content-Length':bytes.length});res.end(bytes)});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
  for(const [sql,name,want] of [
   ['SELECT (SELECT count(*) FROM (SELECT 1 AS x UNION ALL SELECT 2) d) AS n','n',2n],
   ['SELECT EXISTS(SELECT sum(x) FROM (SELECT 1 AS x UNION ALL SELECT 2) d) AS e','e',1n],
   ['SELECT 3 IN (SELECT sum(x) FROM (SELECT 1 AS x UNION ALL SELECT 2) d) AS i','i',1n],
   ['SELECT (SELECT sum(x) FROM (SELECT 1 AS x UNION ALL SELECT 2) d) AS n','n',3n],
  ]){
   const stmt=db.prepare(sql).statement;
   try{
    assert.equal(stmt.columnMetadata(0).name,name);
    for(let pass=0;pass<2;pass++){
     assert.equal(await stmt.step(),'row',sql);
     assert.deepEqual([stmt.columnType(0),stmt.column(0)],['integer',want],sql);
     assert.equal(await stmt.step(),'done',sql);
     stmt.reset();
    }
   }finally{stmt.finalize()}
  }
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()))}
});

// Pinned SQLite 3.53.4 source-ID checked ctypes capture: compound-probe/oracle.py.
// select.c:computeLimitRegisters exits before row publication; expr.c:sqlite3CodeSubselect
// initializes the scalar Mem/Exists/Set before calling sqlite3Select.
test('compound-derived aggregate destination respects outer LIMIT and OFFSET',async()=>{
 const server=http.createServer((_req,res)=>{res.writeHead(200,{'Content-Length':bytes.length});res.end(bytes)});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
  for(const [sql,name,type,want] of [
   ['SELECT (SELECT sum(x) FROM (SELECT 1 AS x UNION ALL SELECT 2) d LIMIT 1) AS n','n','integer',3n],
   ['SELECT (SELECT count(*) FROM (SELECT 1 AS x UNION ALL SELECT 2) d LIMIT 0) AS n','n','null',null],
   ['SELECT (SELECT count(*) FROM (SELECT 1 AS x UNION ALL SELECT 2) d LIMIT 1 OFFSET 1) AS n','n','null',null],
   ['SELECT (SELECT count(*) FROM (SELECT 1 AS x UNION ALL SELECT 2) d LIMIT 0 OFFSET NULL) AS n','n','null',null],
   ['SELECT EXISTS(SELECT sum(x) FROM (SELECT 1 AS x UNION ALL SELECT 2) d LIMIT 0) AS e','e','integer',0n],
   ['SELECT 3 IN (SELECT sum(x) FROM (SELECT 1 AS x UNION ALL SELECT 2) d LIMIT 0) AS i','i','integer',0n],
  ]){
   const stmt=db.prepare(sql).statement;
   try{
    assert.equal(stmt.columnMetadata(0).name,name);
    for(let pass=0;pass<2;pass++){
     assert.equal(await stmt.step(),'row',sql);
     assert.deepEqual([stmt.columnType(0),stmt.column(0)],[type,want],sql);
     assert.equal(await stmt.step(),'done',sql);stmt.reset();
    }
   }finally{stmt.finalize()}
  }
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()))}
});
