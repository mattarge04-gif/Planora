import {build} from '../../../../../app/node_modules/esbuild/lib/main.js';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
const dir=dirname(fileURLToPath(import.meta.url));
for(const name of ['szene','ui'])await build({entryPoints:[join(dir,name+'.js')],outfile:join(dir,name+'.bundle.js'),bundle:true,minify:true,format:'iife',platform:'browser'});
