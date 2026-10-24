import {readdir,readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));process.chdir(root);
const major=Number(process.versions.node.split('.')[0]);if(major!==24)throw new Error('Usa Node.js 24 LTS.');
const files=[];async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory())await walk(p);else if(/\.(mjs|js)$/.test(e.name))files.push(p);}};
for(const dir of ['game','server','scripts','tests'])await walk(dir);
for(const file of files){const result=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});if(result.status)process.exit(result.status||1);}
const html=await readFile('game/index.html','utf8');if(!html.includes('./app.js')||!html.includes('./style.css'))throw new Error('Faltan los recursos de entrada.');
console.log(`Build correcto: ${files.length} módulos comprobados. El servidor publica game/ directamente.`);
