// Shared development fixture root; absent inputs remain hard failures.
import path from 'node:path';
import {pathToFileURL} from 'node:url';
export function skipscanRoot(legacy){
 const root=process.env.SKIPSCAN_NATIVE_ROOT;
 return root?pathToFileURL(path.resolve(root)+path.sep):legacy;
}
