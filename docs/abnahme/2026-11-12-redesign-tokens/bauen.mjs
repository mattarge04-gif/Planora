import {build} from '../../../app/node_modules/esbuild/lib/main.js';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
const dir=dirname(fileURLToPath(import.meta.url));
await build({entryPoints:[join(dir,'uebersicht.ts')],outfile:join(dir,'uebersicht.bundle.js'),bundle:true,minify:true,format:'iife',platform:'browser'});
