'use strict';
const fs=require('node:fs');
const path=require('node:path');
const sharp=require('sharp');
const dest=path.resolve('../receipts');
(async()=>{
 if(!fs.existsSync(dest))return;
 for(const width of [390,1440]){
   for(const mode of ['dark','light']){
     const prefix=width+'-'+mode+'-fig';
     const files=fs.readdirSync(dest).filter(f=>f.startsWith(prefix)&&f.endsWith('.jpg')).sort();
     for(let pos=0;pos<files.length;pos+=4){
       const chunks=files.slice(pos,pos+4);
       const col=width===390?390:620;
       const prepared=await Promise.all(chunks.map(f=>sharp(path.join(dest,f)).resize({width:col,withoutEnlargement:true}).toBuffer({resolveWithObject:true})));
       const high=Math.max(...prepared.map(p=>p.info.height))+8;
       const canvas=sharp({create:{width:(col+8)*2+8,height:high*Math.ceil(prepared.length/2)+8,channels:3,background:mode==='light'?'#eeeeef':'#1b1c1f'}});
       await canvas.composite(prepared.map((p,i)=>({input:p.data,left:8+(i%2)*(col+8),top:8+Math.floor(i/2)*high}))).jpeg({quality:82}).toFile(path.join(dest,width+'-'+mode+'-sheet'+(1+pos/4)+'.jpg'));
     }
   }
 }
})().catch(e=>{console.error(e);process.exitCode=1;});