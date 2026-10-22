// hangul pack: Korean by algorithmic syllable composition. The 14 basic
// consonants and 10 basic vowels (and four old-Korean letters) are drawn once;
// doubled consonants, compound vowels and cluster finals are those drawings
// placed side by side, and the 11,172 syllables are built on demand from the
// current jamo drawings in the skeleton set, so an edit to ㄱ in the Editor
// reaches 가, 까, 각 and 갂 at once. See docs/scripts.md for the contract.
const line=(...p)=>({kind:'poly',points:p});
const loop=(...p)=>({kind:'poly',closed:true,points:p});
// Four cubic segments preserve continuous tangents around each oval.
const round=(l,t,r,b)=>{const cx=(l+r)/2,cy=(t+b)/2,k=.55228475,rx=(r-l)/2,ry=(b-t)/2;return {kind:'bezier',closed:true,points:[[cx,t],[cx+k*rx,t],[r,cy-k*ry],[r,cy],[r,cy+k*ry],[cx+k*rx,b],[cx,b],[cx-k*rx,b],[l,cy+k*ry],[l,cy],[l,cy-k*ry],[cx-k*rx,t],[cx,t]]};};
// The atomic letters, drawn in a unit square (x right, y down) in Overdot's
// monoline manner: straight strokes, a true oval for ㅇ, meeting strokes share a
// point. Each is fitted into whatever box the composer gives it, so only the
// internal proportions matter here: the bars of ㄹ and ㅌ divide the height in
// thirds, the top stroke of ㅊ and ㅎ joins its bar, the ring of ㅎ fills the
// lower six tenths.
const UNIT={
 'ㄱ':[line([0,0],[1,0],[1,1])],
 'ㄴ':[line([0,0],[0,1],[1,1])],
 'ㄷ':[line([1,0],[0,0],[0,1],[1,1])],
 'ㄹ':[line([0,0],[1,0],[1,.5],[0,.5],[0,1],[1,1])],
 'ㅁ':[loop([0,0],[1,0],[1,1],[0,1])],
 'ㅂ':[line([0,0],[0,1],[1,1],[1,0]),line([0,.55],[1,.55])],
 'ㅅ':[line([0,1],[.5,0],[1,1])],
 'ㅇ':[round(0,0,1,1)],
 'ㅈ':[line([0,0],[1,0]),line([0,1],[.5,0],[1,1])],
 'ㅊ':[line([.5,0],[.5,.26]),line([0,.26],[1,.26]),line([0,1],[.5,.26],[1,1])],
 'ㅋ':[line([0,0],[1,0],[1,1]),line([0,.5],[1,.5])],
 'ㅌ':[line([1,0],[0,0],[0,1],[1,1]),line([0,.5],[1,.5])],
 'ㅍ':[line([0,0],[1,0]),line([.26,0],[.26,1]),line([.74,0],[.74,1]),line([0,1],[1,1])],
 'ㅎ':[line([.5,0],[.5,.2]),line([0,.2],[1,.2]),round(.1,.42,.9,1)],
 // Old Korean: ㅿ bansiot, ㆁ yesieung, ㆆ yeorinhieuh, ㆍ araea.
 'ㅿ':[loop([.5,0],[1,1],[0,1])],
 'ㆁ':[line([.5,0],[.5,.22]),round(0,.22,1,1)],
 'ㆆ':[line([0,0],[1,0]),round(.1,.26,.9,1)],
 'ㆍ':[line([.5,.5],[.5,.5])],
 // Vowel elements: a stem with its ticks, or a bar with its ticks. The width
 // of a stem letter is its tick, the height of a bar letter is its tick.
 'ㅏ':[line([0,0],[0,1]),line([0,.5],[1,.5])],
 'ㅑ':[line([0,0],[0,1]),line([0,.34],[1,.34]),line([0,.66],[1,.66])],
 'ㅓ':[line([1,0],[1,1]),line([0,.5],[1,.5])],
 'ㅕ':[line([1,0],[1,1]),line([0,.34],[1,.34]),line([0,.66],[1,.66])],
 'ㅗ':[line([0,1],[1,1]),line([.5,0],[.5,1])],
 'ㅛ':[line([0,1],[1,1]),line([.34,0],[.34,1]),line([.66,0],[.66,1])],
 'ㅜ':[line([0,0],[1,0]),line([.5,0],[.5,1])],
 'ㅠ':[line([0,0],[1,0]),line([.34,0],[.34,1]),line([.66,0],[.66,1])],
 'ㅡ':[line([0,.5],[1,.5])],
 'ㅣ':[line([.5,0],[.5,1])],
};
// Letters that should stay roughly as wide as they are tall: a box may be far
// wider than tall (a consonant over ㅗ) or taller than wide (a consonant beside
// ㅏ), and these keep their width within [min,max] × height, centred.
const ASPECT={'ㅇ':[.8,1.4],'ㅁ':[.75,1.5],'ㅎ':[.75,1.5],'ㆁ':[.8,1.25],'ㆆ':[.75,1.35],'ㅿ':[.8,1.4],'ㅅ':[.7,1.5],'ㅈ':[.7,1.5],'ㅊ':[.7,1.5]};
// Module size per letter: the letters with three horizontal rows or a ring under
// a bar lose a little weight so their counters stay open in a short box.
const DENSITY={};
// The module scale shared by every Korean glyph (jamo and syllables), and the floor the fuse rule may lower a dense syllable to.
const SCALE=.72,FLOOR=.52;
// The closest pair of parallel strokes (bars over bars, stems beside stems) in a drawing; the Bold module
// (radius 97 at scale 1) must fit between them, so a syllable whose bars sit 120 apart drops to about .55.
function fused(paths){let gap=Infinity;const segs=[];for(const p of paths)for(let i=1;i<p.points.length;i++){const [a,b]=[p.points[i-1],p.points[i]];if(Math.abs(a[1]-b[1])<2&&Math.abs(a[0]-b[0])>40)segs.push(['h',a[1],Math.min(a[0],b[0]),Math.max(a[0],b[0])]);else if(Math.abs(a[0]-b[0])<2&&Math.abs(a[1]-b[1])>40)segs.push(['v',a[0],Math.min(a[1],b[1]),Math.max(a[1],b[1])]);}for(let i=0;i<segs.length;i++)for(let j=i+1;j<segs.length;j++){const [s,t]=[segs[i],segs[j]];if(s[0]!==t[0])continue;const d=Math.abs(s[1]-t[1]);if(d>8&&Math.min(s[3],t[3])-Math.max(s[2],t[2])>30)gap=Math.min(gap,d);}return gap;}
function settle(paths){const gap=fused(paths),limit=gap<Infinity?Math.max(FLOOR,Math.min(SCALE,(gap-12)/194)):SCALE;for(const p of paths)p.scale=+Math.min(p.scale??SCALE,limit).toFixed(3);return paths;}
// The compositions: every Compatibility Jamo as its atomic letters, side by side
// ('|'), stacked ('/'), or, for vowels, a bar letter followed by stem letters.
const PARTS={
 'ㄲ':'ㄱ|ㄱ','ㄳ':'ㄱ|ㅅ','ㄵ':'ㄴ|ㅈ','ㄶ':'ㄴ|ㅎ','ㄸ':'ㄷ|ㄷ','ㄺ':'ㄹ|ㄱ','ㄻ':'ㄹ|ㅁ','ㄼ':'ㄹ|ㅂ','ㄽ':'ㄹ|ㅅ','ㄾ':'ㄹ|ㅌ','ㄿ':'ㄹ|ㅍ','ㅀ':'ㄹ|ㅎ','ㅃ':'ㅂ|ㅂ','ㅄ':'ㅂ|ㅅ','ㅆ':'ㅅ|ㅅ','ㅉ':'ㅈ|ㅈ',
 'ㅐ':'ㅏㅣ','ㅒ':'ㅑㅣ','ㅔ':'ㅓㅣ','ㅖ':'ㅕㅣ','ㅘ':'ㅗㅏ','ㅙ':'ㅗㅏㅣ','ㅚ':'ㅗㅣ','ㅝ':'ㅜㅓ','ㅞ':'ㅜㅓㅣ','ㅟ':'ㅜㅣ','ㅢ':'ㅡㅣ',
 'ㅥ':'ㄴ|ㄴ','ㅦ':'ㄴ|ㄷ','ㅧ':'ㄴ|ㅅ','ㅨ':'ㄴ|ㅿ','ㅩ':'ㄹ|ㄱ|ㅅ','ㅪ':'ㄹ|ㄷ','ㅫ':'ㄹ|ㅂ|ㅅ','ㅬ':'ㄹ|ㅿ','ㅭ':'ㄹ|ㆆ','ㅮ':'ㅁ|ㅂ','ㅯ':'ㅁ|ㅅ','ㅰ':'ㅁ|ㅿ','ㅱ':'ㅁ/ㅇ','ㅲ':'ㅂ|ㄱ','ㅳ':'ㅂ|ㄷ','ㅴ':'ㅂ|ㅅ|ㄱ','ㅵ':'ㅂ|ㅅ|ㄷ','ㅶ':'ㅂ|ㅈ','ㅷ':'ㅂ|ㅌ','ㅸ':'ㅂ/ㅇ','ㅹ':'ㅂ|ㅂ/ㅇ','ㅺ':'ㅅ|ㄱ','ㅻ':'ㅅ|ㄴ','ㅼ':'ㅅ|ㄷ','ㅽ':'ㅅ|ㅂ','ㅾ':'ㅅ|ㅈ','ㆀ':'ㅇ|ㅇ','ㆂ':'ㆁ|ㅅ','ㆃ':'ㆁ|ㅿ','ㆄ':'ㅍ/ㅇ','ㆅ':'ㅎ|ㅎ',
 'ㆇ':'ㅛㅑ','ㆈ':'ㅛㅑㅣ','ㆉ':'ㅛㅣ','ㆊ':'ㅠㅕ','ㆋ':'ㅠㅕㅣ','ㆌ':'ㅠㅣ','ㆎ':'ㆍㅣ',
};
const INITIALS=[...'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'],VOWELS=[...'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'],FINALS=[...'ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ'];
const CONSONANTS=[...'ㄱㄲㄳㄴㄵㄶㄷㄸㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅃㅄㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'],OLD=Array.from({length:0x318e-0x3165+1},(_,i)=>String.fromCodePoint(0x3165+i));
const isBar=c=>'ㅗㅛㅜㅠㅡㆍ'.includes(c),stemOf=c=>'ㅏㅑ'.includes(c)?'right':'ㅓㅕ'.includes(c)?'left':'stem';
// A vowel as its bar letter (ㅗ in ㅘ) and its stem letters (ㅏ in ㅘ, ㅏ and ㅣ in ㅐ).
const vowelParts=v=>{const p=[...(PARTS[v]||v)];return {bar:p.find(isBar)||null,stems:p.filter(c=>!isBar(c))};};
const consonantParts=c=>(PARTS[c]||c).split('/').map(row=>row.split('|'));
// Fits paths into a box [x0,y0,x1,y1] by their bounding box; a dimension the
// drawing lacks (the width of ㅣ, the height of ㅡ) is centred. Returns point
// copies rounded to the grid with the given module scale.
function fit(paths,[x0,y0,x1,y1],scale,aspect){
 const xs=paths.flatMap(p=>p.points.map(q=>q[0])),ys=paths.flatMap(p=>p.points.map(q=>q[1]));
 const bx0=Math.min(...xs),bx1=Math.max(...xs),by0=Math.min(...ys),by1=Math.max(...ys),bw=bx1-bx0,bh=by1-by0;
 let w=x1-x0,h=y1-y0,cx=(x0+x1)/2,cy=(y0+y1)/2;
 if(aspect&&h>0){if(w>h*aspect[1])w=h*aspect[1];if(w<h*aspect[0])h=w/aspect[0];}
 const sx=bw>0?w/bw:0,sy=bh>0?h/bh:0;
 const tx=x=>Math.round(cx+(x-(bx0+bx1)/2)*sx),ty=y=>Math.round(cy+(y-(by0+by1)/2)*sy);
 return paths.map(p=>({kind:p.kind,...(p.closed?{closed:true}:{}),points:p.points.map(([x,y])=>[tx(x),ty(y)]),scale:+Math.max(FLOOR,Math.min(1,scale)).toFixed(3)}));
}
// Splits a box into n columns (or rows) with a gap between neighbours.
const columns=([x0,y0,x1,y1],n,gap)=>Array.from({length:n},(_,i)=>{const w=(x1-x0-gap*(n-1))/n;return [x0+i*(w+gap),y0,x0+i*(w+gap)+w,y1];});
const rows=([x0,y0,x1,y1],n,gap)=>Array.from({length:n},(_,i)=>{const h=(y1-y0-gap*(n-1))/n;return [x0,y0+i*(h+gap),x1,y0+i*(h+gap)+h];});
// A consonant (possibly doubled or a cluster) placed in a box from the given
// atomic drawings; doubled letters and clusters share the box in columns.
function placeConsonant(c,box,scale,atoms){
 const grid=consonantParts(c),out=[];
 const rowBoxes=grid.length>1?rows(box,grid.length,110):[box];
 grid.forEach((row,i)=>{const cols=row.length>1?columns(rowBoxes[i],row.length,110):[rowBoxes[i]];row.forEach((a,j)=>out.push(...fit(atoms(a),cols[j],scale*(DENSITY[a]||1)*(row.length>1?.9:1),ASPECT[a])));});
 return out;
}
// Stem letters of a vowel laid out as columns from the right: each stem is
// `s` left of the next, a tick is `t` long and meets the next stem (ㅐ).
// Returns the boxes and the group's left edge, which is a stem or a tick tip.
function stemBoxes(stems,xR,s,t,y0,y1){
 const boxes=[];let x=xR;
 for(let i=stems.length-1;i>=0;i--){const c=stems[i],kind=stemOf(c);
  if(i===stems.length-1&&kind==='right')x=xR-t;
  boxes.unshift(kind==='right'?[x,y0,x+t,y1]:kind==='left'?[x-t,y0,x,y1]:[x,y0,x,y1]);x-=s;}
 const left=Math.min(...boxes.map(b=>b[0])),edge=stemOf(stems[0])==='left'?'tip':'stem';
 return {boxes,left,edge};
}
const VX0=110,VX1=890,BY0=170,BY1=900;
// The classic six layouts. Boxes are centreline boxes in the 1000-wide cell,
// box zone (y 125–950). Returns the boxes of L, each vowel part and T, and the
// module scale.
function syllableLayout(L,V,T){
 const {bar,stems}=vowelParts(V),hasT=!!T,n=hasT?3:2,lParts=consonantParts(L)[0].length,tParts=hasT?consonantParts(T)[0].length:0;
 // One module scale for every syllable, so the set reads as one weight; `fused` lowers it only where strokes would merge.
 let scale=SCALE;
 const out={scale,L:null,V:[],T:null};
 const vy1=hasT?620:BY1,vScale=scale*1.02;
 if(hasT){const wide=tParts>1||'ㅍㅌㄹ'.includes(T);out.T=[wide?110:150,665,wide?890:850,BY1];}
 if(bar&&!stems.length){
  // Consonant over a bar vowel (고, 구, 그): the bar runs the body's width.
  const base=hasT?{'ㅗ':[430,530],'ㅜ':[450,560],'ㅡ':[505,505]}:{'ㅗ':[620,760],'ㅜ':[650,820],'ㅡ':[720,720]};
  const [t0,t1]=base[bar==='ㅛ'?'ㅗ':bar==='ㅠ'?'ㅜ':bar],top=bar==='ㅡ'?t0-(hasT?100:70):bar==='ㅜ'||bar==='ㅠ'?t0-60:t0-80;
  out.V.push([bar,[VX0,t0,VX1,t1],vScale]);
  out.L=[220,hasT?170:180,780,top];
 }else if(!bar){
  // Consonant beside a stem vowel (가, 게): the consonant takes the width left of the stems.
  const {boxes,left,edge}=stemBoxes(stems,880,hasT?150:160,hasT?150:160,BY0,vy1);
  boxes.forEach((b,i)=>out.V.push([stems[i],b,vScale]));
  out.L=[VX0,hasT?190:230,left-(edge==='tip'?110:150),hasT?600:840];
 }else{
  // Consonant top-left, bar under it, stems at the right (과, 워, 의).
  const {boxes,left,edge}=stemBoxes(stems,880,hasT?150:160,hasT?150:160,BY0,vy1);
  boxes.forEach((b,i)=>out.V.push([stems[i],b,vScale]));
  const base=hasT?{'ㅗ':[410,500],'ㅜ':[430,540],'ㅡ':[470,470]}:{'ㅗ':[580,700],'ㅜ':[600,760],'ㅡ':[680,680]};
  const [t0,t1]=base[bar==='ㅛ'?'ㅗ':bar==='ㅠ'?'ㅜ':bar],right=left-(edge==='tip'?90:120);
  out.V.push([bar,[VX0,t0,right,t1],vScale]);
  out.L=[150,hasT?170:180,Math.max(right-30,480),t0-(bar==='ㅗ'||bar==='ㅛ'?70:50)];
 }
 return out;
}
// The standalone jamo, built once from the unit drawings for the glyph set.
function standalone(c,atoms){
 const glyph={width:1000,fixed:true,zone:'box',paths:[]};
 if(CONSONANTS.includes(c)||OLD.includes(c)&&!PARTS[c]||PARTS[c]&&/[|\/]/.test(PARTS[c])){const grid=consonantParts(c),n=Math.max(...grid.map(r=>r.length));glyph.paths=placeConsonant(c,n>2?[110,215,890,835]:n>1||grid.length>1?[150,180,850,890]:[200,215,800,835],1,atoms);return glyph;}
 const {bar,stems}=vowelParts(c);
 if(bar&&!stems.length){const b={'ㅗ':[420,600],'ㅜ':[480,660],'ㅡ':[540,540],'ㆍ':[540,540]}[bar==='ㅛ'?'ㅗ':bar==='ㅠ'?'ㅜ':bar];glyph.paths=fit(atoms(bar),bar==='ㆍ'?[500,540,500,540]:[150,b[0],850,b[1]],1);return glyph;}
 if(!bar){const w=stems.reduce((a,s,i)=>a+(i?200:0)+(stemOf(s)==='stem'?0:200),0),{boxes}=stemBoxes(stems,500+w/2,200,200,BY0,BY1);boxes.forEach((b,i)=>glyph.paths.push(...fit(atoms(stems[i]),b,1)));return glyph;}
 const {boxes,left,edge}=stemBoxes(stems,880,200,200,BY0,BY1);boxes.forEach((b,i)=>glyph.paths.push(...fit(atoms(stems[i]),b,1)));
 const b={'ㅗ':[480,640],'ㅜ':[560,720],'ㅡ':[600,600],'ㆍ':[540,540]}[bar==='ㅛ'?'ㅗ':bar==='ㅠ'?'ㅜ':bar];glyph.paths.push(...fit(atoms(bar),bar==='ㆍ'?[left-200,540,left-200,540]:[120,b[0],left-(edge==='tip'?90:120),b[1]],1));return glyph;
}
const unitAtoms=c=>UNIT[c];
// The filler U+3164 is blank and stays out: the set has no empty drawings.
const glyphs={};for(let cp=0x3131;cp<=0x318e;cp++){const c=String.fromCodePoint(cp);if(c!=='ㅤ')glyphs[c]=standalone(c,unitAtoms);}
// Syllables: U+AC00 + (L×21 + V)×28 + T.
const SBase=0xac00,SCount=11172;
const decompose=c=>{const i=c.codePointAt(0)-SBase;if(!(i>=0&&i<SCount))return null;return {L:INITIALS[Math.floor(i/588)],V:VOWELS[Math.floor(i%588/28)],T:i%28?FINALS[i%28-1]:null};};
const memo=new Map();
export function derive(c,skeletons){
 const cp=c.codePointAt(0);
 // The conjoining jamo blocks map to the compatibility drawings (initials, medials, finals of modern Korean).
 if(cp>=0x1100&&cp<=0x1112)return skeletons[INITIALS[cp-0x1100]]||glyphs[INITIALS[cp-0x1100]];
 if(cp>=0x1161&&cp<=0x1175)return skeletons[VOWELS[cp-0x1161]]||glyphs[VOWELS[cp-0x1161]];
 if(cp>=0x11a8&&cp<=0x11c2)return skeletons[FINALS[cp-0x11a8]]||glyphs[FINALS[cp-0x11a8]];
 const d=decompose(c);if(!d)return undefined;
 // The atomic drawings come from the given set (edits propagate); a compound's
 // parts are read, not the compound, so ㄲ follows ㄱ.
 const atoms=a=>(skeletons[a]||glyphs[a]).paths;
 const used=[...new Set([d.L,d.V,d.T].filter(Boolean).flatMap(j=>[...(PARTS[j]||j)].filter(a=>UNIT[a])))];
 const key=c+JSON.stringify(used.map(a=>atoms(a)));
 const hit=memo.get(key);if(hit)return hit;if(memo.size>12000)memo.clear();
 const lay=syllableLayout(d.L,d.V,d.T),paths=[];
 paths.push(...placeConsonant(d.L,lay.L,lay.scale,atoms));
 for(const [part,box,s]of lay.V)paths.push(...fit(atoms(part),box,s));
 if(d.T)paths.push(...placeConsonant(d.T,lay.T,lay.scale,atoms));
 const glyph={width:1000,fixed:true,zone:'box',paths:settle(paths)};memo.set(key,glyph);return glyph;
}
export function derivedFrom(c){const d=decompose(c);return d?[d.L,d.V,d.T].filter(Boolean).join(' '):undefined;}
// KS X 1001's 2,350 syllables (the EUC-KR set, OS/2 code page 949) as a bitmap over the 11,172, base64.
const KSX='kwf/PhGwAxMBKBARAACTBXseEbADlwE7EhGgAJOVazBRsAIRATIwEbACEQEKMHm4BhMBMBAAgAATAQsQEQAAkwMrEAAAAJMFa3RRsCMTATswEAAAAAAAcBGwAxMAKRARgCEBAAAwFbAOAwEwMAAAAhEBIxAAAAATgWsQEAADEwETEBEwAAEAADBVuCIAAAAwEbAClwf7OhGwAxMBIQAAAAAbDTs4EbADEwEzEQEAABMFKxwRAAEAAAAQEbAAEwEqMBmwAgEAEBAAAAARAQMwEDACEwdrFBEAABMFK3T5uI8TATsQAAAAAAAAcNmwShMBOxARAAMRAAAwWbEqEQEAEAAAAREBCxAAAAATASsQAAABAQAgEBGgAhEBITBZsAIBAAAwGbAHEwE7OBGwAwAAAAAAAAATDTs4EbADAQAQAAAAABMBIBAQAAABAAAQAQAAAAAAMBEYAgAAABAAAAARASMAAAAAkwELEBEwABEBKzARsMcTATswAYACAAAAMBGwgxMBKzARsAMRAAowEbACEQAgAAAAAREBKxARoAITASsQAAABAQAAMBGQAhMBKzARsGYAAAAwEbAC0wdrOhGwBwMBIAAAAAATBWs4EbADEwG4EAAAABsFKxABAAMAAAAQEaACEQEKcHmwohEBChAAAAARAQAQEZAAEQEJAAAAAJMFu/L5sCITATsyASAAAAAAMFmwBpMBOzARoCMRAABwEbACEQAQEAAAARMBAxABAACTBysWEAABAQAAMBEAAhEBKTARsAAAAAAwUbAOEwU7OBGwAwMAAQAAAACTATkQAAACAwA7AAAAABMBIwAAAAAAAAAQAAAAAQAgMBGQAgAAAAAAAAAAAAAQAAACEQEDAAAAABMBK7B5sCMTATswEbACEQEh8NmwQxMBOzARsAMRASBwUbAiEwEgEBGQAREBCzARsAKTAasWAAABEwEhMBGwAgMBKTAxsAIAAAAwGbhCGwEzOBEwAwAAIAAAAAATBTMQEQAAAAAAAAEAAJMFIzABAAEBABAQETAAAQAAMBEwAgEAEBAAAAARAAAAAAACE4UDEBEQABMBKzB3uGMTATswkbCiEQECMHvwVxMBK3DR8OMRARswcbkKEwE7MAGQAhMBKzARsAITByswETADEwEjMBGwAhMBqzARtP4RAQkwcbhH0wV7MBGwA1MBIRARAAATBWswEbACEQEzEAAAABMF6zgQoAIBADAQEbACEwAgMHGwAgEAEBAAAAATAQsQERAAEwErAAAAAJMFazaVsAMTATsQAQACAAAAMBGwAwEAIBAAAAEAAAAwEbAKAwEQEAAAAREBAwAAAAITASMQAAADAAAAEAAAAAEAABAAkAIAAAAwETCGUwF7MBGwA1EBIQAAAAATATswEbACEQAQEAEAAhMBKxARAAIAAAAQEbACAQABMBGwAgEAEBABAAARASsQERACEwErAAAAAJMDKzARsAITATswAAACAAAAMBmwAxMBKxARsAMBAAAwEbACEwEhEAAAAgEBABAAAAATASsQEQACAQAgMBGwAhEBATARMAIAAAAwEbACEwM7MBGwAwEAIAAAAAATBTswEbACEQAQEAEAABMBKxQBAAABAAAQAYACAQAAMBGwAgEAEBAAAAATASMQERACkwULEBEwABMBK3BRsCMTATswAAAAAAAAMBGwAxMBKxARMAMBAQowEbACAQAgAAAAABEAABARoACTBSsQAAACAAAAEBGQABEBKRARsAAAAAAwEbACEyErMBGwAwEAIAAAAAATBSswEbACEwE7EBEgABMhKzIRgAITACgwEaACEQEKMBGSAhEBITARAAITASswEZAC0wMrEhEwAhMBKwA=';
const b64=s=>{const A='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',out=[];let bits=0,n=0;for(const ch of s){if(ch==='=')break;bits=bits<<6|A.indexOf(ch);n+=6;if(n>=8){n-=8;out.push(bits>>n&255);}}return out;};
let ksx=null;const ksx1001=()=>{if(ksx)return ksx;const bytes=b64(KSX);let s='';for(let i=0;i<SCount;i++)if(bytes[i>>3]>>(i&7)&1)s+=String.fromCodePoint(SBase+i);return ksx=s;};
let all=null;const allSyllables=()=>all??=Array.from({length:SCount},(_,i)=>String.fromCodePoint(SBase+i)).join('');
export default {
 id:'hangul',label:'Korean',script:'hang',ranges:[[0x1100,0x11ff],[0x3131,0x318e],[0xac00,0xd7a3]],fixed:true,
 glyphs:Object.fromEntries(Object.entries(glyphs).map(([c,g])=>[c,{...g,paths:settle(g.paths.map(p=>({...p,scale:Math.min(p.scale??1,SCALE)})))}])),derive,derivedFrom,
 groups:[
  {id:'hangul-consonants',label:'Korean consonants',characters:CONSONANTS.join('')},
  {id:'hangul-vowels',label:'Korean vowels',characters:VOWELS.join('')},
  {id:'hangul-old',label:'Korean old letters',characters:OLD.join('')},
  {id:'hangul-syllables',label:'Korean syllables',get characters(){return ksx1001();},lazy:60},
 ],
 languages:[['kor','Korean']],
 samples:['서울특별시\n한강의 아침','안녕하세요','2026년 10월 18일','김치 · 비빔밥 · 불고기','훈민정음\n세종대왕','가나다라마바사\n아자차카타파하','대한민국\n부산광역시','봄 여름 가을 겨울'],
 fontSets:[
  {id:'hangul-ksx1001',label:'Korean syllables (KS X 1001)',count:2350,default:false,chars:ksx1001},
  {id:'hangul-all',label:'All Korean syllables',count:11172,default:false,chars:allSyllables},
 ],
 get codePages(){return [[19,ksx1001()]];},
};
