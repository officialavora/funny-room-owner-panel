import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';
const source=process.argv[2];if(!source)throw Error('Supply the authorized native source checkout');
const manifest=JSON.parse(await fs.readFile('assets-manifest.json','utf8'));let copied=0;
for(const [name,expected] of Object.entries(manifest.assets)){const data=await fs.readFile(path.join(source,name));if(data.length!==expected.bytes||crypto.createHash('sha256').update(data).digest('hex')!==expected.sha256)throw Error('Original asset mismatch: '+name);await fs.mkdir(path.dirname(name),{recursive:true});await fs.writeFile(name,data);copied++;}console.log('Verified and copied '+copied+' original assets');
