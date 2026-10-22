// OpenType layout writers: GPOS (pair kerning, mark-to-base and mark-to-mark
// positioning), GSUB (single, multiple and ligature substitution) and GDEF
// (glyph classes). The bundled outline writer reads these tables but cannot
// serialize them, so this app builds them.
const join=parts=>{const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let at=0;for(const p of parts){out.set(p,at);at+=p.length;}return out;};
const u16=(...values)=>{const out=new Uint8Array(values.length*2),v=new DataView(out.buffer);values.forEach((n,i)=>{if(!Number.isInteger(n)||n<0||n>65535)throw Error('Layout table value out of range: '+n+'.');v.setUint16(i*2,n);});return out;};
const i16=(...values)=>{const out=new Uint8Array(values.length*2),v=new DataView(out.buffer);values.forEach((n,i)=>{if(!Number.isInteger(n)||n<-32768||n>32767)throw Error('Layout table value out of range: '+n+'.');v.setInt16(i*2,n);});return out;};
const tag=s=>{s=String(s);if(s.length!==4)throw Error('OpenType tags are four characters: '+s+'.');return new TextEncoder().encode(s);};
const u32=value=>{const out=new Uint8Array(4);new DataView(out.buffer).setUint32(0,value);return out;};
const byId=(a,b)=>a-b;
const coverage=ids=>join([u16(1,ids.length),u16(...ids)]);
// Subtables placed one after another, each reached by a 16-bit offset from a
// header of the given size; the offsets are checked so an oversized table is
// refused rather than written broken.
function place(head,tables){let at=head;const offsets=tables.map(t=>{const o=at;at+=t.length;return o;});if(at>65535)throw Error('Layout subtable exceeds 64 KB.');return offsets;}
function pairTable(entries){const sets=entries.map(([,ps])=>join([u16(ps.length),...ps.sort((a,b)=>a[0]-b[0]).map(p=>join([u16(p[0]),i16(p[1])]))])),offsets=place(10+entries.length*2,sets),end=offsets.length?offsets.at(-1)+sets.at(-1).length:10+entries.length*2;if(end+4+entries.length*2>65535)throw Error('Kerning subtable exceeds supported size.');return join([u16(1,end,4,0,entries.length,...offsets),...sets,coverage(entries.map(([id])=>id))]);}
// Pairs are split into subtables of under 64 KB, each reached through an
// extension subtable with a 32-bit offset, so large character sets still fit.
function pairSubtables(pairs){const groups=new Map();for(const [left,right,value]of pairs){if(!groups.has(left))groups.set(left,[]);groups.get(left).push([right,value]);}const entries=[...groups].sort((a,b)=>a[0]-b[0]),chunks=[[]];let size=14;for(const entry of entries){const cost=6+entry[1].length*4;if(size+cost>60000&&chunks.at(-1).length){chunks.push([]);size=14;}chunks.at(-1).push(entry);size+=cost;}return chunks[0].length?chunks.map(pairTable):[];}
// Class definitions: listed glyphs take classes 1 and up, all others class 0.
function classDef(map){const ids=[...map.keys()].sort(byId);if(!ids.length)return u16(2,0);const ranges=[];for(const id of ids){const last=ranges.at(-1);if(last&&last[1]===id-1&&last[2]===map.get(id))last[1]=id;else ranges.push([id,id,map.get(id)]);}const first=ids[0],span=ids.at(-1)-first+1;
 return 6+2*span<4+6*ranges.length?join([u16(1,first,span),u16(...Array.from({length:span},(_,i)=>map.get(first+i)||0))]):join([u16(2,ranges.length),...ranges.map(r=>u16(...r))]);}
// A class definition always written as ranges (format 2).
function rangeClassDef(map){const ids=[...map.keys()].sort(byId),ranges=[];for(const id of ids){const last=ranges.at(-1);if(last&&last[1]===id-1&&last[2]===map.get(id))last[1]=id;else ranges.push([id,id,map.get(id)]);}return join([u16(2,ranges.length),...ranges.map(r=>u16(...r))]);}
function classTable(rows,leftClass,rightClass,columns){const cover=[...leftClass.keys()].sort(byId),c1=classDef(leftClass),c2=classDef(rightClass),matrix=i16(...rows.flat()),head=16,at=head+matrix.length;
 return join([u16(2,at,4,0,at+cover.length*2+4,at+cover.length*2+4+c1.length,rows.length,columns),matrix,coverage(cover),c1,c2]);}
// Glyphs whose kerning rows (or columns) agree share a class, so the table
// stores one row per class: Vietnamese letters follow their base letters.
// Members are grouped greedily, a glyph joining the class whose first member it
// differs from in the fewest pairs, up to a limit tried at a few values. Every
// pair whose value differs from its class value is kept as a glyph pair in
// subtables read before the class table, so the font gives exactly the
// computed kerning while it stores a small fraction of the pairs.
function cluster(keys,vector,limit){const classes=[],of=new Map();for(const key of keys){const v=vector(key);let best=-1,fewest=limit+1;for(let k=0;k<classes.length;k++){const w=classes[k].vector;let d=0;for(const [id,value]of v)if(w.get(id)!==value&&++d>=fewest)break;if(d<fewest)for(const [id,value]of w)if(!v.has(id)&&value&&++d>=fewest)break;if(d<fewest){fewest=d;best=k;}}if(best<0){best=classes.length;classes.push({vector:v,members:[]});}classes[best].members.push(key);of.set(key,best);}return {classes,of};}
function classKerning(pairs,limit){const rows=new Map(),cols=new Map();for(const [l,r,v]of pairs){if(!rows.has(l))rows.set(l,new Map());rows.get(l).set(r,v);if(!cols.has(r))cols.set(r,new Map());cols.get(r).set(l,v);}
 const left=cluster([...rows.keys()].sort(byId),k=>rows.get(k),limit),right=cluster([...cols.keys()].sort(byId),k=>cols.get(k),limit),value=(l,r)=>rows.get(l).get(r)||0;
 // Each class cell takes the value most of its member pairs have.
 const cells=left.classes.map(lc=>right.classes.map(rc=>{const count=new Map();for(const l of lc.members)for(const r of rc.members){const v=value(l,r);count.set(v,(count.get(v)||0)+1);}let best=0,most=-1;for(const [v,n]of count)if(n>most||n===most&&v===0){most=n;best=v;}return best;}));
 const exceptions=[];for(const [l,row]of rows){const cl=left.of.get(l);for(const r of cols.keys()){const v=row.get(r)||0;if(v!==cells[cl][right.of.get(r)])exceptions.push([l,r,v]);}}
 return {left,right,cells,exceptions,size:4*exceptions.length+2*left.classes.length*(right.classes.length+1)};}
function classSubtables({left,right,cells}){const rightClass=new Map();for(const [r,k]of right.of)rightClass.set(r,k+1);const columns=right.classes.length+1,used=left.classes.map((c,k)=>k).filter(k=>cells[k].some(v=>v)),tables=[];
 // Rows are split so each subtable stays under 64 KB.
 const per=Math.max(1,Math.floor(50000/(2*columns)));for(let i=0;i<used.length;i+=per){const chunk=used.slice(i,i+per),leftClass=new Map();chunk.forEach((k,j)=>{for(const l of left.classes[k].members)leftClass.set(l,j+1);});tables.push(classTable([new Array(columns).fill(0),...chunk.map(k=>[0,...cells[k]])],leftClass,rightClass,columns));}return tables;}
// The kerning subtables of a set of pairs: glyph pairs, or class kerning with glyph-pair exceptions when that is smaller.
function kerningSubtables(pairs){let best=null;for(const limit of [8,16,32]){const option=classKerning(pairs,limit);if(!best||option.size<best.size)best=option;}
 return best.size<4*pairs.length?[...pairSubtables(best.exceptions),...classSubtables(best)]:pairSubtables(pairs);}
// The header shared by GSUB and GPOS: a script list (every script's default
// language system lists the features that apply to it), a feature list sorted
// by tag, and the lookup list. `features` are {tag, lookups:[index], scripts?}
// (no `scripts`: the feature applies to every script); `lookupList` is the
// complete lookup list. A script lists each tag once: the features of one tag
// that apply to it are merged into one feature record, in the order given, and
// scripts whose merged features agree share the record.
function layoutTable(scripts,features,lookupList){
 const tags=[...new Set(scripts.map(s=>String(s)))].sort(),records=[],keyOf=new Map(),langSys=new Map();
 for(const t of tags){const merged=new Map();for(const f of features)if(!f.scripts||f.scripts.includes(t)){if(!merged.has(f.tag))merged.set(f.tag,[]);merged.get(f.tag).push(...f.lookups);}
  langSys.set(t,[...merged].map(([tag,lookups])=>{const key=tag+':'+[...new Set(lookups)].join(',');if(!keyOf.has(key)){keyOf.set(key,records.length);records.push({tag,lookups:[...new Set(lookups)]});}return keyOf.get(key);}));}
 const order=records.map((_,i)=>i).sort((a,b)=>records[a].tag<records[b].tag?-1:records[a].tag>records[b].tag?1:a-b),indexOf=new Map(order.map((i,k)=>[i,k]));
 const scriptTables=tags.map(t=>{const indices=langSys.get(t).map(i=>indexOf.get(i)).sort(byId);return join([u16(4,0),u16(0,0xffff,indices.length,...indices)]);}),scriptOffsets=place(2+6*tags.length,scriptTables);
 const scriptList=join([u16(tags.length),...tags.map((t,i)=>join([tag(t),u16(scriptOffsets[i])])),...scriptTables]);
 const featureTables=order.map(i=>u16(0,records[i].lookups.length,...records[i].lookups)),featureOffsets=place(2+6*order.length,featureTables);
 const featureList=join([u16(order.length),...order.map((i,k)=>join([tag(records[i].tag),u16(featureOffsets[k])])),...featureTables]);
 return join([u16(1,0,10,10+scriptList.length,10+scriptList.length+featureList.length),scriptList,featureList,lookupList]);}
// A lookup list of complete lookups (GSUB: its lookups are small).
function lookupList(lookups){const offsets=place(2+2*lookups.length,lookups);return join([u16(lookups.length,...offsets),...lookups]);}
// A lookup list whose subtables sit behind extension subtables (type 9 in GPOS)
// with 32-bit offsets: the lookup headers and their extension records come
// first, within 16-bit reach of the list, and every subtable follows them, so
// the kerning may run to hundreds of kilobytes while the mark lookups after it
// stay reachable. `lookups` are {type, flag, subtables}.
function extensionLookupList(lookups){const heads=[],extensions=[],bodies=[];let at=2+2*lookups.length;const offsets=[];
 for(const l of lookups){offsets.push(at);heads.push(u16(9,l.flag,l.subtables.length,...l.subtables.map((_,i)=>6+2*l.subtables.length+8*i)));at+=6+10*l.subtables.length;}
 if(at>65535)throw Error('Lookup list exceeds 64 KB.');
 lookups.forEach((l,k)=>{l.subtables.forEach((s,i)=>{const from=offsets[k]+6+2*l.subtables.length+8*i;extensions.push(join([u16(1,l.type),u32(at-from)]));bodies.push(s);at+=s.length;});});
 // Each lookup's header and extension records are contiguous, in lookup order.
 const parts=[u16(lookups.length,...offsets)];let e=0;lookups.forEach((l,k)=>{parts.push(heads[k]);for(let i=0;i<l.subtables.length;i++)parts.push(extensions[e++]);});return join([...parts,...bodies]);}
const anchor=([x,y])=>join([u16(1),i16(x,y)]);
// A mark array (mark records with classes and anchors) and an anchor array
// (one anchor offset per class for each base or second mark), the two halves
// of the mark-to-base and mark-to-mark subtables.
function markArray(marks){const records=marks.map(m=>anchor(m.anchor)),offsets=place(2+4*marks.length,records);return join([u16(marks.length),...marks.map((m,i)=>u16(m.class,offsets[i])),...records]);}
function anchorArray(items,classCount){const anchors=items.flatMap(it=>it.anchors.filter(Boolean).map(anchor)),offsets=place(2+2*classCount*items.length,anchors);let k=0;
 return join([u16(items.length),...items.map(it=>u16(...it.anchors.map(a=>a?offsets[k++]:0))),...anchors]);}
// Mark-to-base (format 1, also the mark-to-mark layout): mark coverage, base
// coverage, class count, mark array, base (or second mark) array.
function attachmentSubtable(marks,bases,classCount){marks=[...marks].sort((a,b)=>a.id-b.id);bases=[...bases].sort((a,b)=>a.id-b.id);const parts=[coverage(marks.map(m=>m.id)),coverage(bases.map(b=>b.id)),markArray(marks),anchorArray(bases,classCount)],offsets=place(12,parts);
 return join([u16(1,offsets[0],offsets[1],classCount,offsets[2],offsets[3]),...parts]);}
// Bases are split into subtables so each stays under 64 KB with the whole mark array repeated.
function attachmentSubtables(marks,bases,classCount){if(!marks.length||!bases.length)return [];const markSize=2+10*marks.length+4+2*marks.length,per=Math.max(1,Math.floor((60000-markSize-20)/(2*classCount+6*classCount+2))),tables=[];
 for(let i=0;i<bases.length;i+=per)tables.push(attachmentSubtable(marks,bases.slice(i,i+per),classCount));return tables;}
// GPOS: pair kerning (one `kern` lookup, type 2, ignoring marks so letters kern
// across their vowel signs), mark-to-base (`mark`, type 4: every mark attaches
// to a base's `above` or `below` anchor by its class) and mark-to-mark (`mkmk`,
// type 6: one lookup per class, filtered to that class by its mark attachment
// type, so a tone mark over a vowel sign climbs to the vowel's `above` anchor
// while a vowel below the same letter is passed over). `pairs` are
// [left, right, value]; `marks` are {id, class:'above'|'below', anchor:[x,y],
// above:[x,y], below:[x,y]}; `bases` are {id, above:[x,y], below:[x,y]};
// `scripts` lists the script tags beyond DFLT and latn.
export const MARK_CLASSES=['above','below'];
export function positioningTable({pairs=[],marks=[],bases=[],scripts=[]}){const lookups=[],features=[];
 if(pairs.length){features.push({tag:'kern',lookups:[lookups.length]});lookups.push({type:2,flag:marks.length?8:0,subtables:kerningSubtables(pairs)});}
 const classed=marks.filter(m=>MARK_CLASSES.includes(m.class)&&m.anchor).map(m=>({...m,class:MARK_CLASSES.indexOf(m.class)}));
 const toBase=attachmentSubtables(classed,bases.map(b=>({id:b.id,anchors:[b.above,b.below]})).filter(b=>b.anchors.some(Boolean)),2);
 if(toBase.length){features.push({tag:'mark',lookups:[lookups.length]});lookups.push({type:4,flag:0,subtables:toBase});}
 const stacks=[];for(const [k,name]of MARK_CLASSES.entries()){const own=classed.filter(m=>m.class===k).map(m=>({...m,class:0})),hosts=own.filter(m=>m[name]).map(m=>({id:m.id,anchors:[m[name]]})),tables=attachmentSubtables(own,hosts,1);if(tables.length){stacks.push(lookups.length);lookups.push({type:6,flag:(k+1)<<8,subtables:tables});}}
 if(stacks.length)features.push({tag:'mkmk',lookups:stacks});
 if(!lookups.length)return null;return layoutTable(['DFLT','latn',...scripts],features,extensionLookupList(lookups));}
export const kerningTable=pairs=>positioningTable({pairs});
// GDEF (version 1.0): glyph classes (base 1, ligature 2, mark 3) as ranges and
// the mark attachment classes (above 1, below 2) the mark-to-mark lookups filter by.
export function definitionTable({classes,attachClasses=new Map()}){const glyphClass=rangeClassDef(classes),attach=rangeClassDef(attachClasses);return join([u16(1,0,12,0,0,12+glyphClass.length),glyphClass,attach]);}
// Glyph substitution. Each feature {tag, script?, pairs?, sequences?,
// ligatures?} makes one lookup per kind it carries, in the order the features
// are given: a single substitution (type 1, format 2) for pairs [[from, to]], a
// multiple substitution (type 2) for sequences [[from, [to, ...]]] (one
// character drawn as several glyphs), a ligature substitution (type 4) for ligatures
// [[[first, ...rest], to]], whose sets are keyed by the first component and try
// longer ligatures first. A feature with `script` is listed for that script
// only; the others apply to every script: DFLT, latn and the given tags.
const singleSubtable=pairs=>{pairs=[...pairs].sort((a,b)=>a[0]-b[0]);return join([u16(2,6+2*pairs.length,pairs.length,...pairs.map(p=>p[1])),coverage(pairs.map(p=>p[0]))]);};
function multipleSubtable(sequences){sequences=[...sequences].sort((a,b)=>a[0]-b[0]);const tables=sequences.map(([,to])=>u16(to.length,...to)),offsets=place(6+2*sequences.length,tables),end=offsets.length?offsets.at(-1)+tables.at(-1).length:6;return join([u16(1,end,sequences.length,...offsets),...tables,coverage(sequences.map(s=>s[0]))]);}
function ligatureSubtable(ligatures){const sets=new Map();for(const [parts,to]of ligatures){if(!sets.has(parts[0]))sets.set(parts[0],[]);sets.get(parts[0]).push([parts,to]);}
 const firsts=[...sets.keys()].sort(byId),tables=firsts.map(first=>{const ligs=sets.get(first).sort((a,b)=>b[0].length-a[0].length).map(([parts,to])=>u16(to,parts.length,...parts.slice(1))),offsets=place(2+2*ligs.length,ligs);return join([u16(ligs.length,...offsets),...ligs]);});
 const offsets=place(6+2*firsts.length,tables),end=offsets.length?offsets.at(-1)+tables.at(-1).length:6;return join([u16(1,end,firsts.length,...offsets),...tables,coverage(firsts)]);}
export const hasSubstitutions=f=>!!(f.pairs?.length||f.sequences?.length||f.ligatures?.length);
export function substitutionTable(features,scripts=[]){features=features.filter(hasSubstitutions);const lookups=[],list=[];
 for(const f of features){const own=[];if(f.pairs?.length){own.push(lookups.length);lookups.push(join([u16(1,0,1,8),singleSubtable(f.pairs)]));}
  if(f.sequences?.length){own.push(lookups.length);lookups.push(join([u16(2,0,1,8),multipleSubtable(f.sequences)]));}
  if(f.ligatures?.length){own.push(lookups.length);lookups.push(join([u16(4,0,1,8),ligatureSubtable(f.ligatures)]));}
  list.push({tag:f.tag,lookups:own,...(f.script?{scripts:[f.script]}:{})});}
 if(!lookups.length)return null;return layoutTable(['DFLT','latn',...scripts,...features.flatMap(f=>f.script?[f.script]:[])],list,lookupList(lookups));}
