// A standard ZIP archive with stored entries. All data stays on this device.
const encoder=new TextEncoder(),crcTable=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
export function crc32(bytes){let crc=0xffffffff;for(const b of bytes)crc=crcTable[(crc^b)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
export function zipArchive(entries,{date=new Date()}={}){
 if(!entries.length||entries.length>65535)throw Error('Use 1–65535 archive files.');
 const names=new Set(),files=entries.map(({name,content})=>{if(typeof name!=='string'||!name||/^[\\/]|(^|[\\/])\.\.([\\/]|$)|\x00/.test(name)||name.includes('\\')||names.has(name))throw Error('Invalid or duplicate archive filename.');names.add(name);const filename=encoder.encode(name),bytes=typeof content==='string'?encoder.encode(content):content instanceof ArrayBuffer?new Uint8Array(content):content;if(!(bytes instanceof Uint8Array)||filename.length>65535||bytes.length>0xffffffff)throw Error('Invalid archive content.');return {filename,bytes,crc:crc32(bytes)};});
 const dataSize=files.reduce((n,f)=>n+30+f.filename.length+f.bytes.length,0),directorySize=files.reduce((n,f)=>n+46+f.filename.length,0),total=dataSize+directorySize+22;
 if(total>0xffffffff)throw Error('Archive is too large.');
 const buffer=new ArrayBuffer(total),bytes=new Uint8Array(buffer),view=new DataView(buffer),year=Math.max(1980,Math.min(2107,date.getFullYear())),day=((year-1980)<<9)|((date.getMonth()+1)<<5)|date.getDate(),time=(date.getHours()<<11)|(date.getMinutes()<<5)|(date.getSeconds()>>1);
 let offset=0;const u16=(at,value)=>view.setUint16(at,value,true),u32=(at,value)=>view.setUint32(at,value,true);
 for(const f of files){f.offset=offset;u32(offset,0x04034b50);u16(offset+4,20);u16(offset+6,0x800);u16(offset+10,time);u16(offset+12,day);u32(offset+14,f.crc);u32(offset+18,f.bytes.length);u32(offset+22,f.bytes.length);u16(offset+26,f.filename.length);bytes.set(f.filename,offset+30);bytes.set(f.bytes,offset+30+f.filename.length);offset+=30+f.filename.length+f.bytes.length;}
 for(const f of files){u32(offset,0x02014b50);u16(offset+4,20);u16(offset+6,20);u16(offset+8,0x800);u16(offset+12,time);u16(offset+14,day);u32(offset+16,f.crc);u32(offset+20,f.bytes.length);u32(offset+24,f.bytes.length);u16(offset+28,f.filename.length);u32(offset+42,f.offset);bytes.set(f.filename,offset+46);offset+=46+f.filename.length;}
 u32(offset,0x06054b50);u16(offset+8,files.length);u16(offset+10,files.length);u32(offset+12,directorySize);u32(offset+16,dataSize);return buffer;
}
