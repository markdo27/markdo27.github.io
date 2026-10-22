// ideographs pack: Chinese hanzi (simplified and traditional) and Japanese kanji,
// drawn by the module engine from open stroke-centreline data (see docs/scripts.md
// for the contract). The drawings are not in this file: `ideographs/*.json` hold,
// per character, [scale×100, strokes as flat integer polylines, source] built by
// tools/ideographs/build.py from Make Me a Hanzi medians (Chinese forms) and
// KanjiVG paths (Japanese forms of the Jōyō kanji). The files load lazily:
// `load()` fetches their text, `derive()` parses a file the first time one of its
// characters is asked for and builds the glyph on demand.
// Licences: both sources are copyleft (Arphic Public License, CC BY-SA 3.0);
// see ideographs/LICENSE-ideographs.md. A font that embeds this data carries them.
import {ORDER,HANZI_COMMON,KANJI_JOYO,FILES} from './ideographs/sets.js';
const node=typeof window==='undefined'&&typeof process!=='undefined'&&!!process.versions?.node;
// Per data file: a string (fetched, not parsed yet), a function (Node: reads the
// file from disk on first use) or the parsed table {char: entry}.
const tables=new Map();const glyphs=new Map();let loaded=false,loading=null;
const fileOf=cp=>FILES.find(([lo,hi])=>cp>=lo&&cp<=hi)?.[2];
function tableOf(name){let t=tables.get(name);if(t===undefined)return undefined;if(typeof t==='function')t=t();if(typeof t==='string'){t=JSON.parse(t);tables.set(name,t);}return t;}
const entryOf=c=>{const cp=c.codePointAt(0);if(cp<0x4e00||cp>0x9fff||c.length!==1)return undefined;const name=fileOf(cp);return name&&tableOf(name)?.[c];};
async function fetchAll(){
 if(node){const fs=await import('node:fs');for(const [,,name]of FILES)tables.set(name,()=>fs.readFileSync(new URL('./ideographs/'+name,import.meta.url),'utf8'));return;}
 await Promise.all(FILES.map(async ([,,name])=>{const r=await fetch(new URL('./ideographs/'+name,import.meta.url));if(!r.ok)throw new Error('ideographs: '+name+' '+r.status);tables.set(name,await r.text());}));
}
// The licence file travels with the data: fonts that embed the ideographs carry its notice, and a family ZIP carries the file.
let licenseText='';const fetchLicense=async()=>{try{if(node){const fs=await import('node:fs');licenseText=fs.readFileSync(new URL('./ideographs/LICENSE-ideographs.md',import.meta.url),'utf8');}else licenseText=await (await fetch(new URL('./ideographs/LICENSE-ideographs.md',import.meta.url))).text();}catch{licenseText='';}};
const load=()=>{if(loaded)return Promise.resolve(false);if(!loading)loading=Promise.all([fetchAll(),fetchLicense()]).then(()=>{loaded=true;return true;}).catch(e=>{loading=null;throw e;});return loading;};
const ready=()=>loaded;
// A glyph from its strokes: every stroke a polyline in the box zone, the modules
// of a dense character scaled down together so its counters survive at Bold.
// The ideographic zero 〇 (U+3007) is a number written with the ideographs: a ring
// on the box zone's optical centre, as wide as a plain character body. It is derived
// rather than drawn so the Latin drawing counts stay as they are.
const round=(l,t,r,b)=>{const cx=(l+r)/2,cy=(t+b)/2,k=.55228475,rx=(r-l)/2,ry=(b-t)/2;return {kind:'bezier',closed:true,points:[[cx,t],[cx+k*rx,t],[r,cy-k*ry],[r,cy],[r,cy+k*ry],[cx+k*rx,b],[cx,b],[cx-k*rx,b],[l,cy+k*ry],[l,cy],[l,cy-k*ry],[cx-k*rx,t],[cx,t]]};};
const ZERO={width:1000,fixed:true,zone:'box',round:true,paths:[{...round(190,230,810,850),scale:1}]};
const ALL=ORDER+'〇';
function derive(c){
 if(c==='〇')return ZERO;if(!loaded)return undefined;const cached=glyphs.get(c);if(cached)return cached;const e=entryOf(c);if(!e)return undefined;
 const scale=Math.min(.72,e[0]/100),paths=e[1].map(s=>{const points=[];for(let i=0;i<s.length;i+=2)points.push([s[i],s[i+1]]);return {kind:'poly',points,scale};});
 const g={width:1000,fixed:true,zone:'box',paths};glyphs.set(c,g);return g;
}
const derivedFrom=c=>{if(c==='〇')return 'a ring';const e=loaded&&entryOf(c);return e?e[2]?'stroke data (KanjiVG)':'stroke data (Make Me a Hanzi)':undefined;};
export const SOURCE_NAMES=['Make Me a Hanzi','KanjiVG'];
const chars=s=>[...s];
export default {
 id:'ideographs',label:'Chinese and Japanese ideographs',script:'hani',ranges:[[0x4e00,0x9fff],[0x3007,0x3007]],fixed:true,
 glyphs:{},load,ready,derive,derivedFrom,
 notice:'Ideograph outlines derived from KanjiVG (CC BY-SA 3.0) and Make Me a Hanzi stroke data (Arphic Public License); see LICENSE-ideographs.md.',license:{file:'LICENSE-ideographs.md',text:()=>licenseText},
 groups:[{id:'ideographs',label:'Chinese and Japanese ideographs',characters:ALL,lazy:60}],
 languages:[['zho','Chinese'],['cmn','Mandarin Chinese'],['yue','Cantonese'],['jpn','Japanese']],
 samples:['北京欢迎你','你好世界\n汉字与假名','繁體中文\n香港 台灣','二〇二六年十月','東京・大阪','日本語の文字','春夏秋冬','中国語 日本語\n漢字 文字'],
 fontSets:[
  {id:'hanzi-common',label:'Chinese characters (common)',count:chars(HANZI_COMMON).length,default:false,chars:()=>HANZI_COMMON},
  {id:'kanji-joyo',label:'Japanese Jōyō kanji',count:chars(KANJI_JOYO).length,default:false,chars:()=>KANJI_JOYO},
  {id:'hanzi-all',label:'All ideographs in the pack',count:chars(ALL).length,default:false,chars:()=>ALL}],
 codePages:[[18,HANZI_COMMON],[17,KANJI_JOYO],[20,HANZI_COMMON]],
};
// In Node the data is on disk next to this file: load it at import so tests and
// scripts can derive without an explicit load (the browser fetches on load()).
if(node)await load();
