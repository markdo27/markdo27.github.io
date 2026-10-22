// Final OpenType assembly. The bundled outline writer produces the tables; this
// module replaces the ones it cannot write correctly (names, CFF outlines) and
// rebuilds checksums.
const join=parts=>{const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let at=0;for(const p of parts){out.set(p,at);at+=p.length;}return out;};
const tag=s=>new TextEncoder().encode(s);
function sum(bytes){let total=0;for(let at=0;at<bytes.length;at+=4){let word=0;for(let i=0;i<4;i++)word=word*256+(bytes[at+i]||0);total=(total+word)>>>0;}return total;}
export function readTables(buffer){const view=new DataView(buffer),tables=new Map();for(let i=0;i<view.getUint16(4);i++){const at=12+i*16,name=new TextDecoder().decode(new Uint8Array(buffer,at,4)),offset=view.getUint32(at+8),length=view.getUint32(at+12);tables.set(name,new Uint8Array(buffer.slice(offset,offset+length)));}return tables;}
export function writeFont(tables,flavor='OTTO'){
 const list=[...tables].map(([name,data])=>({name,data})).sort((a,b)=>a.name<b.name?-1:1),head=list.find(t=>t.name==='head');if(!head)throw Error('Missing font head table.');new DataView(head.data.buffer,head.data.byteOffset).setUint32(8,0);
 const count=list.length,selector=Math.floor(Math.log2(count));let length=12+16*count;for(const table of list){table.offset=length;length+=Math.ceil(table.data.length/4)*4;}
 const out=new Uint8Array(length),v=new DataView(out.buffer);out.set(tag(flavor));v.setUint16(4,count);v.setUint16(6,16*2**selector);v.setUint16(8,selector);v.setUint16(10,16*count-16*2**selector);
 for(const [i,table]of list.entries()){const at=12+i*16;out.set(tag(table.name),at);v.setUint32(at+4,sum(table.data));v.setUint32(at+8,table.offset);v.setUint32(at+12,table.data.length);out.set(table.data,table.offset);}
 v.setUint32(head.offset+8,(0xb1b0afba-sum(out))>>>0);return out.buffer;
}
// Windows Unicode English records only: no blank entries, no Macintosh or
// Unicode-platform duplicates, so no AAT language-tag table is needed.
export function nameTable(records){
 const entries=records.filter(([,value])=>typeof value==='string'&&value.trim()).sort((a,b)=>a[0]-b[0]).map(([id,value])=>{const bytes=new Uint8Array(value.length*2),v=new DataView(bytes.buffer);for(let i=0;i<value.length;i++)v.setUint16(i*2,value.charCodeAt(i));return {id,bytes};});
 const header=new Uint8Array(6+entries.length*12),v=new DataView(header.buffer);v.setUint16(2,entries.length);v.setUint16(4,header.length);let offset=0;
 entries.forEach(({id,bytes},i)=>{const at=6+i*12;v.setUint16(at,3);v.setUint16(at+2,1);v.setUint16(at+4,0x409);v.setUint16(at+6,id);v.setUint16(at+8,bytes.length);v.setUint16(at+10,offset);offset+=bytes.length;});
 return join([header,...entries.map(e=>e.bytes)]);
}
export function patchHead(data,{fontRevision,bounds}){const v=new DataView(data.buffer,data.byteOffset);v.setInt32(4,Math.round(fontRevision*65536));[bounds.xMin,bounds.yMin,bounds.xMax,bounds.yMax].forEach((n,i)=>v.setInt16(36+i*2,n));return data;}
export function patchHhea(data,{advanceWidthMax,minLeftSideBearing,minRightSideBearing,xMaxExtent}){const v=new DataView(data.buffer,data.byteOffset);v.setUint16(10,advanceWidthMax);v.setInt16(12,minLeftSideBearing);v.setInt16(14,minRightSideBearing);v.setInt16(16,xMaxExtent);return data;}
export function fingerprint(bytes){let h=0x811c9dc5;for(const b of bytes)h=Math.imul(h^b,0x01000193)>>>0;return h.toString(16).padStart(8,'0');}

// CFF INDEX: a count, offset size, offsets and the items.
function writeIndex(items){if(!items.length)return new Uint8Array(2);const total=items.reduce((n,x)=>n+x.length,0)+1,size=total<0x100?1:total<0x10000?2:total<0x1000000?3:4,offsets=new Uint8Array((items.length+1)*size);let offset=1;for(let i=0;i<=items.length;i++){for(let k=0,n=offset;k<size;k++,n=Math.floor(n/256))offsets[i*size+size-1-k]=n%256;if(i<items.length)offset+=items[i].length;}return join([Uint8Array.of(items.length>>8,items.length&255,size),offsets,...items]);}

// CFF outlines written directly (Type 2 charstrings). Each contour is a move to
// its lowest point and a body of relative segments; operators take as many
// segments as the argument stack holds. A body that recurs in the font (a base
// letter inside each of its accented forms, a figure in its tabular form, the
// dot of i and j) is stored once as a global subroutine, because a body does not
// depend on where the contour sits.
const csNumber=v=>v>=-107&&v<=107?[v+139]:v>=108&&v<=1131?[(v-108>>8)+247,v-108&255]:v>=-1131&&v<=-108?[(-v-108>>8)+251,-v-108&255]:[28,v>>8&255,v&255];
const dictNumber=v=>v>=-32768&&v<=32767?csNumber(v):[29,v>>>24&255,v>>>16&255,v>>>8&255,v&255];
const offset32=v=>[29,v>>>24&255,v>>>16&255,v>>>8&255,v&255];
// A contour step is a point [x,y] reached by a line, or a curve [c1,c2,point].
export const stepEnd=step=>Array.isArray(step[0])?step[2]:step;
// Segments are [dx,dy] lines and [dx1,dy1,dx2,dy2,dx3,dy3] curves.
function segmentBytes(segments){const out=[];for(let i=0;i<segments.length;){const n=segments[i].length,args=[];while(i<segments.length&&segments[i].length===n&&args.length+n<=48)args.push(...segments[i++]);for(const a of args)out.push(...csNumber(a));out.push(n===2?5:8);}return out;}
// A closed contour starts at its lowest, then leftmost point; a closing line is implicit.
function contourProgram(steps){const n=steps.length;let s=0;for(let i=1;i<n;i++){const [x,y]=stepEnd(steps[i]),[bx,by]=stepEnd(steps[s]);if(y<by||y===by&&x<bx)s=i;}
 const at=i=>steps[(s+i)%n],segments=[];let [x,y]=stepEnd(at(0));const start=[x,y];
 for(let i=1;i<=n;i++){const step=at(i);if(Array.isArray(step[0])){const flat=[];for(const [px,py]of step){flat.push(px-x,py-y);[x,y]=[px,py];}segments.push(flat);}else if(i<n){segments.push([step[0]-x,step[1]-y]);[x,y]=step;}}
 return {start,end:[x,y],body:segmentBytes(segments)};}
const subrBias=n=>n<1240?107:n<33900?1131:32768;
export function cffTable({fontName,version,fullName,familyName,weight,bbox,glyphs}){
 const text=s=>new TextEncoder().encode(String(s).normalize('NFKD').replace(/[̀-ͯ]/g,'').replace(/[^\x20-\x7e]/g,''));
 const programs=glyphs.map(g=>g.contours.map(contourProgram)),bodies=new Map();
 for(const contours of programs)for(const c of contours){const k=c.body.join();let b=bodies.get(k);if(!b)bodies.set(k,b={bytes:c.body,uses:0});b.uses++;c.key=k;}
 // A body becomes a subroutine when its calls cost less than its copies; the
 // most used bodies take the shortest call numbers.
 const subrs=[...bodies.values()].filter(b=>b.uses>1&&(b.uses-1)*b.bytes.length>3*b.uses+1).sort((a,b)=>b.uses*b.bytes.length-a.uses*a.bytes.length||b.uses-a.uses),bias=subrBias(subrs.length);subrs.forEach((b,i)=>b.index=i);
 const charStrings=glyphs.map((g,i)=>{const out=[...csNumber(g.width)];let x=0,y=0;for(const c of programs[i]){out.push(...csNumber(c.start[0]-x),...csNumber(c.start[1]-y),21);const b=bodies.get(c.key);if(b.index!==undefined)out.push(...csNumber(b.index-bias),29);else out.push(...c.body);[x,y]=c.end;}out.push(14);return Uint8Array.from(out);});
 // Strings: .notdef and space are standard; every other name is stored.
 const stored=[],sid=s=>{if(s==='.notdef')return 0;if(s==='space')return 1;stored.push(text(s));return 390+stored.length;};
 const top=[[0,sid(version)],[2,sid(fullName)],[3,sid(familyName)],[4,sid(weight)]],ranges=[];
 for(const s of glyphs.slice(1).map(g=>sid(g.name))){const last=ranges.at(-1);if(last&&last[0]+last[1]+1===s)last[1]++;else ranges.push([s,0]);}
 const charset=Uint8Array.from([2,...ranges.flatMap(([s,n])=>[s>>8,s&255,n>>8,n&255])]),strings=writeIndex(stored),globals=writeIndex(subrs.map(b=>Uint8Array.from([...b.bytes,11]))),charStringIndex=writeIndex(charStrings);
 const dict=(charsetAt,charStringsAt,privateAt)=>writeIndex([Uint8Array.from([...top.flatMap(([op,v])=>[...dictNumber(v),op]),...bbox.flatMap(dictNumber),5,...offset32(charsetAt),15,...offset32(charStringsAt),17,...dictNumber(0),...offset32(privateAt),18])]);
 const header=Uint8Array.of(1,0,4,4),nameIndex=writeIndex([text(fontName)]),charsetAt=header.length+nameIndex.length+dict(0,0,0).length+strings.length+globals.length,charStringsAt=charsetAt+charset.length;
 return join([header,nameIndex,dict(charsetAt,charStringsAt,charStringsAt+charStringIndex.length),strings,globals,charset,charStringIndex]);}
