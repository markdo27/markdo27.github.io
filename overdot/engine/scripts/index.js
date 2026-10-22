// Script packs: the drawings, samples, languages and shaping of the scripts
// beyond Latin. Each pack owns one file in this folder and follows the
// contract in docs/scripts.md: `glyphs` are hand-drawn skeletons keyed by
// character (or by a form key such as 'ក.sub'), merged into the default
// drawings; `derive` makes glyphs that are built rather than drawn (Hangul
// syllables from jamo, ideographs from stroke data); `shape` turns a run of
// text into the glyph keys it is drawn with; `fontSets` are derived sets a
// download may include; `load` fetches data the pack needs.
import hangul from './hangul.js';
import kana from './kana.js';
import ideographs from './ideographs.js';
import thai from './thai.js';
import lao from './lao.js';
import khmer from './khmer.js';
export const PACKS=[hangul,kana,ideographs,thai,lao,khmer];
// The pack whose script a character belongs to, by its `ranges` (inclusive code point pairs).
const RANGES=PACKS.flatMap(p=>(p.ranges||[]).map(r=>[r,p]));
export function packOf(c){const cp=c.codePointAt(0);for(const [[a,b],p]of RANGES)if(cp>=a&&cp<=b)return p;return null;}
export const isFixedScript=c=>!!packOf(c)?.fixed;
export const isMarkChar=c=>{const p=packOf(c);return !!p?.marks&&p.marks.includes(c);};
// A derived glyph (not in the given skeletons): the first pack that builds it.
export function deriveGlyph(skeletons,c){for(const p of PACKS){const g=p.derive?.(c,skeletons);if(g)return g;}return undefined;}
export function glyphOf(skeletons,c){return skeletons[c]||deriveGlyph(skeletons,c);}
// Text runs shaped by their script's pack; characters without one map to themselves.
export function shapeText(text){const cells=[];let run='',pack=null;const flush=()=>{if(!run)return;const shaped=pack?.shape?pack.shape(run):[...run].map(ch=>({key:ch,text:ch}));cells.push(...shaped);run='';};for(const ch of text){const p=packOf(ch);if(p!==pack&&run){flush();}pack=p;run+=ch;}flush();return cells;}
export const loadPacks=()=>Promise.all(PACKS.map(p=>p.load?.()));
export const SCRIPT_GROUPS=PACKS.flatMap(p=>p.groups||[]);
export const SCRIPT_SAMPLES=PACKS.flatMap(p=>p.samples||[]);
export const SCRIPT_LANGUAGES=PACKS.flatMap(p=>(p.languages||[]).map(([iso,name])=>[iso,name,p]));
export const FONT_SETS=PACKS.flatMap(p=>(p.fontSets||[]).map(s=>({...s,pack:p})));
