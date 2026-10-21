// Development-only regression capture: retain every typed expected row, sharing
// repeated rowsets instead of committing duplicated native query output.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
export function readSkiprangeCapture(url) {
  const capture=JSON.parse(fs.readFileSync(url,'utf8'));
  if(capture.captureFormat!=='skiprange-rowsets-v1')throw Error('Unknown skiprange capture format');
  const checked=new Set();
  for(const variant of capture.variants)for(const profile of ['stat4','control'])for(const item of variant[profile]) {
    const key=item.rowsRef,rows=capture.rowsets[key];
    if(!rows)throw Error(`Missing native expected rowset ${key}`);
    if(!checked.has(key)) {
      // Captured cells contain only ASCII keys/storage tags/hex/decimal strings.
      const digest=createHash('sha256').update(JSON.stringify(rows)).digest('hex');
      if(digest!==key)throw Error(`Native expected rowset hash mismatch ${key}`);
      checked.add(key);
    }
    item.rows=rows;delete item.rowsRef;
  }
  delete capture.captureFormat;delete capture.rowsets;
  return capture;
}
