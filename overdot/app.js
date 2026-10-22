import {PAPERS,INK_DEFAULTS,readAppearance,surfaceSVG} from './engine/ink.js';
import {freshSkeletons,GLYPHS,refreshDefaultDrawings,CHARACTER_GROUPS,REPERTOIRE,CHARACTERS,MARKS,composeAll,compositeDependents,characterCoverage,glyphOf} from './engine/skeletons.js';
import {PACKS,loadPacks,FONT_SETS,SCRIPT_SAMPLES,SCRIPT_LANGUAGES} from './engine/scripts/index.js';
import {DEFAULT,PRESETS,generateGlyph,glyphSVG,moduleSVG,pathData,specimenSVG,specimenContent,layoutText,projectIR,clamp,escapeXML,inkZones,skeletonPoint} from './engine/modules.js';
import {FAMILY_INSTANCES,FAMILY_DEFAULTS,STYLE_ORDER,familySpecimen,familySheetSVG,familyTextSheetSVG} from './engine/family.js';
import {fontStyle,fontNames,defaultFamilyName,versionString,DEFAULT_FAMILY,FORMER_FAMILY,FONT_INFO_FIELDS} from './engine/font-info.js';
import {editPoint,applyProportions} from './engine/edits.js';
import {freshLookSystem,readLookSystem,lookSettings,adjustLookSystem,matchesLook,comparisonGlyphs,lookGlyphSVG} from './engine/looks.js';

const $=id=>document.getElementById(id);
const shapes={circle:['●','Circle'],square:['■','Square'],rounded:['▣','Soft'],diamond:['◆','Diamond'],blob:['✿','Blob'],ring:['⊙','Ring'],arc:['◔','Arc']};
const bounds={weight:[400,900],width:[70,135],size:[26,220],density:[.55,1.8],overlap:[0,70],roundness:[0,100],tracking:[-30,140]};
// The Editor steps through the editable drawings; built glyphs are reached from their parts.
const letters=CHARACTER_GROUPS.filter(g=>!g.lazy).flatMap(g=>[...g.characters]).filter(c=>GLYPHS[c]);
const DRAWING_REVISION='final-round-2026-10-16';
const RELEASED='October 2026';
// About: the designer's record, shown in the About section and used as the default designer name of the fonts. Edit it here.
const ABOUT={name:'Mark Do',role:'Designer and developer',
 bio:['Mark Do designs and builds type in the browser. Overdot is a display typeface drawn from overlapping dots: one set of centrelines, seven looks, nine styles each, and a specimen page that generates the fonts live, with an editor to redraw any letter.','The face began with Latin and Vietnamese, and the Vietnamese marks were placed by rules measured from professionally drawn families. It now sets Korean, Japanese, Chinese, Thai, Lao and Khmer as well.'],
 projects:[['Overdot','2026','A modular dot display typeface with seven looks, nine styles and eight scripts, generated in the browser.','#information'],['Liquid font','','A liquid type generator: letters drawn from nodes that swell and pinch along the stroke and melt into one another, with Vietnamese marks, a poster tool and font export.','https://fluid-font.vercel.app/'],['Circle font','','A modular grid typeface generator: letters built on a grid of circles in the browser.','https://circlefont.vercel.app/']],
 links:[['Website','markdo27.github.io','https://markdo27.github.io/']],
 contact:[['Email','dtcmark@gmail.com','mailto:dtcmark@gmail.com']]};
const initialLook=PRESETS.find(p=>p.id==='layered');
// Black ink on white paper for every export. The page itself draws the specimens in
// the current colour, so the dark theme inverts them. The page starts fresh on every
// load; projects are kept by saving them as files.
const MONO={...INK_DEFAULTS,color:'#111111',opacity:1,layered:false,paper:'white',palette:false};
let appearance={...MONO};
let skeletons=freshSkeletons(),settings={...DEFAULT,weight:700,size:initialLook.size,density:initialLook.density,overlap:initialLook.overlap,roundness:initialLook.roundness},view='specimen',char='a';
let dragRecorded=false,typeSurface='',typeAnchor=null,lookSystem={reference:'layered',adjustments:{size:1,density:1,overlap:0,roundness:0}};
const FONT_INFO_INPUTS={copyright:'fontCopyright',designer:'fontDesigner',manufacturer:'fontManufacturer',website:'fontWebsite',vendorID:'fontVendor',license:'fontLicense',licenseURL:'fontLicenseURL'};
let fontRevision=0;
let selected=null,undo=[],redo=[],preset='',syncEnabled=true,dragging=false,dragSource=null,dragFrame=null;
let toastTimer,raf,deferred=0,sceneCache=new Map(),proportionFrame={x:[1,0,0],y:[0,1,0]},drawingVersion=0,mainSurface='',pageDirty=false;
const typeLayouts=new Map(),memo=new Map();
// Texts: the hero's name, the Tester's one shared text and each specimen row's own.
// Sample texts for the Type Tester: each of the nine rows opens with a different
// one, drawn at random from this pool on every load, in Vietnamese and other
// languages, as titles, short paragraphs, numbers, dates and data. Typing in any
// row replaces them all with one shared text.
const SAMPLES=[
 'Phở bò Hà Nội\nBánh mì Sài Gòn','TIẾNG VIỆT\nĐƯỜNG PHỐ','Trăm năm trong cõi người ta\nchữ tài chữ mệnh khéo là ghét nhau','Vịnh Hạ Long\ndi sản thế giới','Đà Nẵng, 7 giờ sáng\nbiển Mỹ Khê sóng nhẹ','HẢI PHÒNG → HÀ NỘI\n06:40','Giá vé 120.000 ₫\nMở cửa 8:30–17:00','Chúc mừng năm mới\nAn khang thịnh vượng','32 °C · Độ ẩm 78 %\nGió 12 km/h','Số 24 Phố Huế\nQuận Hai Bà Trưng','Dấu hỏi, dấu ngã\ndấu sắc, dấu huyền','ĐẠI HỘI THỂ THAO\nĐÔNG NAM Á','Cà phê sữa đá\nquán cóc vỉa hè','Huế mộng mơ\nsông Hương núi Ngự',
 'The quick brown fox\njumps over the lazy dog','DOT-MATRIX DISPLAY\nSINCE 1972','Seven looks\nnine styles each','Straße, Grüße\nFußball in Zürich','Zażółć gęślą jaźń','Příliš žluťoučký kůň\núpěl ďábelské ódy','Árvíztűrő\ntükörfúrógép','Portez ce vieux whisky\nau juge blond qui fume','El veloz murciélago\ncomía feliz kiwi','Pôr do sol\nem São Paulo','Pijamalı hasta\nyağız şoföre güvendi','Știință și țară\nînvățământ','Smørrebrød og øl\ni København','Selamat pagi\nJakarta!','Habari za asubuhi\nNairobi','ÎLE-DE-FRANCE\nCÔTE D’AZUR','Col·lecció\nparal·lel',
 '0123456789','$1,234.56 · €9.30\n£45 · 125.000 ₫','14/07/2026\n12:45:08','48 % · 21 °C\n1013 hPa · 5‰','№ 24 · Nº 7\n§ 12 · ¶ 3','Flight VN 253\nGate B7 · 06:40','+84 24 3825 1234','½ ¼ ¾ · 3² · 10⁹','Q3 2026 · 1 234 567 €\nQ4 2026 · 2 345 678 €','21.0285° N\n105.8542° E','ISBN 978-3-16-148410-0','2024 · 2025\n2026 · 2027',
];
const shuffled=list=>{const out=[...list];for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;};
let drawnPool;const POOL=[...SAMPLES,...SCRIPT_SAMPLES],sampleOrder=shuffled([...POOL.keys()]),drawn=text=>[...text.normalize('NFC')].every(c=>/\s/.test(c)||glyphOf(skeletons,c)),rowSample=i=>{drawnPool??=sampleOrder.map(k=>POOL[k]).filter(drawn);const n=drawnPool.length;return drawnPool[((i%n)+n)%n];},testerIndex=id=>Math.max(0,STYLE_ORDER.findIndex(s=>'w'+s.weight+'-'+s.width===id));
// texts.tester is null until something is typed: the rows show their samples.
const texts={hero:'Overdot',tester:null};
const WATERFALL=[
 {weight:900,width:135,size:240,lineHeight:1,tracking:10,text:'Overdot'},
 {weight:700,width:100,size:96,lineHeight:1,tracking:10,text:'Pack my box with five dozen liquor jugs'},
 {weight:400,width:70,size:48,lineHeight:1.05,tracking:10,text:'Letters share a rhythm, but each has a voice. Compare shapes, spacing and texture in a complete sentence: Tiếng Việt, Grüße, Žlučký.'},
 {weight:400,width:135,size:240,lineHeight:1,tracking:10,text:'0123456789'},
];
const phoneScale=()=>window.innerWidth<600?.5:window.innerWidth<900?.7:1;
let waterfall=structuredClone(WATERFALL).map(r=>({...r,size:Math.round(r.size*phoneScale())})),testerRows={},activeText='tester',glyphStyle='400,100';
const family={...FAMILY_DEFAULTS};
const ROW_SIZE=[24,240],ROW_TRACKING=bounds.tracking,SPECIMEN_SIZE=[16,360],LINE_HEIGHT=[.75,1.5];
function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3200);}
// Accented letters are rebuilt from their base letters and accents after every
// change. A drawing edit drops only the scenes of the edited glyphs and of the
// accented letters built from them; any other change drops them all.
function clearScenes(chars){skeletons=composeAll(skeletons);drawingVersion++;if(!chars){sceneCache.clear();return;}const dirty=new Set([...chars,...compositeDependents(chars)]);for(const key of [...sceneCache.keys()])if(dirty.has(key[0]))sceneCache.delete(key);}
// Accents are shown on a dotted circle, as they are named in Unicode charts.
const shown=c=>glyphOf(GLYPHS,c)?.mark?'◌'+c:c,derived=c=>!skeletons[c]&&!!glyphOf(skeletons,c);
const ACCENT_NAMES={grave:'grave',acute:'acute',hook:'hook above',tilde:'tilde',dotBelow:'dot below',circumflex:'circumflex',breve:'breve',diaeresis:'diaeresis',ring:'ring above',caron:'caron',cedilla:'cedilla',macron:'macron',dotAbove:'dot above',doubleAcute:'double acute',ogonek:'ogonek',commaBelow:'comma below',commaAccent:'comma caron',turnedComma:'turned comma above'};
function compositeNote(c){const {base,marks,horn,bar,slash}=skeletons[c].composite,link=(glyph,text)=>`<button type="button" data-edit-glyph="${escapeXML(glyph)}">${escapeXML(text)}</button>`,parts=[...(base?[link(base,base)]:[]),...marks.map(name=>link(MARKS[name],shown(MARKS[name])+' '+ACCENT_NAMES[name]))];return `Built from ${parts.join(' and ')}${horn?', with a horn':''}${bar?', with a bar':''}${slash?', with a slash':''}. Edit those and every accented form follows.`;}
function scene(c,s=settings){const key=c+'|'+JSON.stringify(s);if(!sceneCache.has(key))sceneCache.set(key,generateGlyph(glyphOf(skeletons,c),s));return sceneCache.get(key);}
function uiState(){return {selectedGlyph:char,glyphStyle,fontName:$('fontName').value,fontInfo:fontInfo(),fontRevision,sync:syncEnabled,theme:document.body.classList.contains('theme-dark')?'dark':'light'};}
function refreshInitialSettings(s,system){const a=system.adjustments;if(system.reference==='layered'&&a.size===1&&a.density===1&&a.overlap===0&&a.roundness===0&&s.shape==='circle'&&s.size===180&&s.density===.75&&s.overlap===56){return {...s,size:initialLook.size,density:initialLook.density,overlap:initialLook.overlap,tracking:s.tracking===20?DEFAULT.tracking:s.tracking};}return s;}
function validatePaths(paths){
 if(!Array.isArray(paths)||!paths.length||paths.length>24)throw Error('Use 1–24 paths.');
 return paths.map(p=>{if(!['poly','bezier'].includes(p.kind)||!Array.isArray(p.points)||!p.points.length||p.points.length>100)throw Error('Each path needs a kind and 1–100 points.');if(p.kind==='bezier'&&(p.points.length<4||(p.points.length-1)%3!==0))throw Error('Bézier paths need an anchor followed by groups of three points.');return {kind:p.kind,closed:!!p.closed,...(['start','end'].includes(p.taper)?{taper:p.taper}:{}),...(p.optional===true?{optional:true}:{}),...(Number.isFinite(p.scale)&&p.scale>=.3&&p.scale<=1?{scale:p.scale}:{}),...(['above','below','bar','attach','right'].includes(p.mark)?{mark:p.mark}:{}),...([0,1,'side'].includes(p.stack)?{stack:p.stack}:{}),...(p.attach===true?{attach:true}:{}),...(p.horn===true?{horn:true}:{}),...(Number.isFinite(p.sink)&&p.sink>=0&&p.sink<=60?{sink:p.sink}:{}),points:p.points.map(q=>{if(!Array.isArray(q)||q.length!==2||q.some(n=>!Number.isFinite(n)||n< -300||n>2000))throw Error('Points must contain two coordinates between −300 and 2000.');return [...q];})};});
}
function validateSettings(input){
 if(!input||typeof input!=='object')throw Error('Missing settings.');const out={...DEFAULT};
 for(const [key,[a,b]]of Object.entries(bounds))if(key in input){if(!Number.isFinite(input[key])||input[key]<a||input[key]>b)throw Error(`Invalid ${key}.`);out[key]=input[key];}
 if(input.shape&&!shapes[input.shape])throw Error('Unknown module shape.');out.shape=input.shape||DEFAULT.shape;out.optical=input.optical!==false;return out;
}
function readFrame(value){if(!value)return {x:[1,0,0],y:[0,1,0]};if(!['x','y'].every(k=>Array.isArray(value[k])&&value[k].length===3&&value[k].every(n=>Number.isFinite(n)&&Math.abs(n)<3)))throw Error('Invalid proportion frame.');return {x:[...value.x],y:[...value.y]};}
function restoreUI(ui){if(!ui)return;if(GLYPHS[ui.selectedGlyph]&&!GLYPHS[ui.selectedGlyph].drawingOnly||skeletons[ui.selectedGlyph])char=ui.selectedGlyph;glyphStyle=typeof ui.glyphStyle==='string'&&(ui.glyphStyle==='main'||STYLE_ORDER.some(i=>styleKey(i)===ui.glyphStyle))?ui.glyphStyle:'400,100';if(typeof ui.fontName==='string')$('fontName').value=[DEFAULT_FAMILY,FORMER_FAMILY].includes(ui.fontName)?'':ui.fontName.slice(0,60);if(ui.fontInfo&&typeof ui.fontInfo==='object')for(const [key,id]of Object.entries(FONT_INFO_INPUTS))if(typeof ui.fontInfo[key]==='string')$(id).value=ui.fontInfo[key].slice(0,FONT_INFO_FIELDS[key]||4);if(Number.isInteger(ui.fontRevision))fontRevision=clamp(ui.fontRevision,0,998999);syncEnabled=ui.sync!==false;document.body.classList.toggle('theme-dark',ui.theme==='dark');}
// The texts and row settings of a saved project, within the page's own bounds.
const num=(v,[a,b],fallback)=>Number.isFinite(v)?clamp(v,a,b):fallback;
function restoreTexts(data){if(typeof data.text==='string')texts.tester=data.text?data.text.slice(0,500):null;if(typeof data.texts?.hero==='string')texts.hero=data.texts.hero.slice(0,500);
 testerRows={};if(data.tester&&typeof data.tester.rows==='object')for(const [id,row]of Object.entries(data.tester.rows))if(STYLE_ORDER.some(i=>styleId(i)===id)&&row&&typeof row==='object')testerRows[id]={size:num(row.size,ROW_SIZE,rowDefault().size),tracking:num(row.tracking,ROW_TRACKING,DEFAULT.tracking),upper:row.upper===true,tnum:row.tnum===true,case:row.case===true};
 waterfall=structuredClone(WATERFALL);if(Array.isArray(data.waterfall))data.waterfall.slice(0,WATERFALL.length).forEach((row,i)=>{if(!row||typeof row!=='object')return;const base=waterfall[i],instance=STYLE_ORDER.find(s=>s.weight===row.weight&&s.width===row.width);waterfall[i]={weight:instance?instance.weight:base.weight,width:instance?instance.width:base.width,size:num(row.size,SPECIMEN_SIZE,base.size),lineHeight:num(row.lineHeight,LINE_HEIGHT,base.lineHeight),tracking:num(row.tracking,ROW_TRACKING,base.tracking),text:typeof row.text==='string'?row.text.slice(0,500):base.text};});
 activeText='tester';syncTextField();memo.delete('tester-rows');memo.delete('specimen-rows');}
function restoreFamily(value){if(!value)return;if(['foundry','sentence','paragraph','scale'].includes(value.mode))family.mode=value.mode;for(const key of ['sentence','paragraph'])if(typeof value[key]==='string')family[key]=value[key].slice(0,key==='sentence'?180:600);}
skeletons=composeAll(skeletons);
const coverage=characterCoverage();
$('glyphPicker').innerHTML=`<label for="allGlyphs">Character</label><select id="allGlyphs" aria-label="Choose any character">${CHARACTER_GROUPS.filter(g=>!g.lazy).map(g=>`<optgroup label="${g.label}">${[...g.characters].map(c=>`<option value="${escapeXML(c)}">${escapeXML(shown(c))}</option>`).join('')}</optgroup>`).join('')}</select>`;
$('characterCoverage').innerHTML=`<strong>Basic Latin: ${coverage.basicLatin.supported} / ${coverage.basicLatin.total}</strong><p>52 letters · 10 numbers · 32 symbols · space<br>8 extra punctuation characters · 39 currency, legal and typographic signs<br>${coverage.latin} Western and Central European letters and ${coverage.vietnamese} Vietnamese letters, built from ${coverage.accents} editable accents. All drawings are editable.</p>${coverage.scripts.length?`<p>${coverage.scripts.map(p=>escapeXML(p.label)+': '+(p.drawn?p.drawn+' drawings':'')+(p.sets.map(s=>(p.drawn?' and ':'')+s.count.toLocaleString('en')+' '+s.label.toLowerCase()).join(', '))).join(' · ')}.</p>`:''}<p>Sets English and the Western and Central European languages (all of Windows-1252, Latin Extended-A and Romanian), Vietnamese, Indonesian, Malay and Swahili${coverage.scripts.length?', and '+coverage.scripts.map(p=>escapeXML(p.label)).join(', '):''}. ${escapeXML(coverage.notIncluded[1])} are not included yet.</p>`;
function displayAppearance(){return appearance;}
// Names. The main font is the chosen look in the chosen style: "Overdot Circle Layers Bold".
const styleId=s=>'w'+s.weight+'-'+s.width,styleKey=s=>s.weight+','+s.width;
const styleName=s=>fontStyle(s)||'Regular';
function activeLookName(){const look=PRESETS.find(p=>matchesLook(p,settings,lookSystem));return look?look.name.split(' / ')[1]:null;}
function activeLook(){return PRESETS.find(p=>matchesLook(p,settings,lookSystem))||null;}
function familyTitle(){return defaultFamilyName(activeLookName()||'Custom '+shapes[settings.shape][1]);}
function mainFontTitle(){return familyTitle()+' '+styleName(settings);}
function mainFontName(){const named=[400,700,900].includes(settings.weight)&&[70,100,135].includes(settings.width);return (activeLookName()||'Custom '+shapes[settings.shape][1])+' · '+(named?styleName(settings):settings.weight+' / '+settings.width+'%');}
function rowDefault(){return {size:window.innerWidth<600?64:window.innerWidth<900?84:120,tracking:DEFAULT.tracking,upper:false,tnum:false,case:false};}
function rowState(id){if(!testerRows[id])testerRows[id]=rowDefault();return testerRows[id];}
const pad=(n,w=3)=>{const v=Math.round(n);return (v<0?'−':'')+String(Math.abs(v)).padStart(w,'0');};
function remember(key,value){if(memo.get(key)===value)return false;memo.set(key,value);return true;}
const drawingKey=()=>JSON.stringify(settings)+'|'+JSON.stringify(lookSystem)+'|'+drawingVersion;
// Plain specimens: the glyphs in the current colour, so the page's theme sets the ink.
function art(text,s,options={}){return specimenSVG(text,skeletons,s,{idPrefix:'art',...options});}
// One glyph centred in a square frame at a shared scale, for cells and the glyph card.
function cellSVG(c,s=settings,prefix='cell'){const sc=scene(c,s),top=Math.min(-50,sc.bounds.minY-60),bottom=Math.max(1270,sc.bounds.maxY+60),side=Math.max(1320,bottom-top),cx=(sc.bounds.minX+sc.bounds.maxX)/2,wide=Math.max(side,sc.bounds.maxX-sc.bounds.minX+240),box=[cx-wide/2,top-(side-(bottom-top))/2,wide,side].map(n=>+n.toFixed(1));return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="'+box.join(' ')+'" fill="currentColor" role="img" aria-label="'+escapeXML(shown(c))+'"><title>'+escapeXML(shown(c))+'</title>'+glyphSVG(sc)+'</svg>';}
function singleSVG(c,s=settings,{surface=false,prefix='single',ink=displayAppearance()}={}){const sc=scene(c,s),a=ink,left=Math.min(-20,sc.bounds.minX-20),top=Math.min(80,sc.bounds.minY-20),box=[left,top,Math.max(650,sc.advance+40)-Math.min(0,sc.bounds.minX),Math.max(1120,sc.bounds.maxY-top+20)],content=glyphSVG(sc,surface?a:undefined);return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="'+box.join(' ')+'" fill="currentColor" role="img" aria-label="Glyph '+escapeXML(c)+'"><title>'+escapeXML(c)+'</title>'+(surface?surfaceSVG(content,box,a,{idPrefix:prefix,pitch:100}):content)+'</svg>';}
// A row of text at a size in pixels, fitted so its longest word stays on the line.
// Typography rules for a row: the text keeps the lines it was written with
// (no ragged wrapping, no single words left on a line) and shrinks until its
// longest line fits the row, down to half the row's size; only text longer than
// that wraps, and then by whole words.
function fitPx(text,s,width,requested){const lines=String(text).split('\n').map(l=>l.trim()).filter(Boolean);if(!lines.length)return requested;const longest=Math.max(1000,...lines.map(line=>layoutText(line,skeletons,s).width)),byLine=width*970/longest;if(byLine>=requested*.5)return Math.max(8,Math.min(requested,byLine));const words=lines.flatMap(l=>l.split(/\s+/)).filter(Boolean),widest=Math.max(1000,...words.map(word=>layoutText(word,skeletons,s).width));return Math.max(8,Math.min(requested*.5,width*970/widest));}
function withLineHeight(l,f){if(!l.carets.length||Math.abs(f-1)<1e-6)return l;const y0=Math.min(...l.carets.map(c=>c.y)),shift=y=>y+Math.round((y-y0)/l.lineAdvance)*l.lineAdvance*(f-1);return {...l,items:l.items.map(i=>({...i,y:shift(i.y)})),carets:l.carets.map(c=>({...c,y:shift(c.y)})),height:l.height+Math.max(0,l.lines-1)*l.lineAdvance*(f-1)};}
function rowSVG(surface,model,text,s,{width,size,features,lineHeight=1,idPrefix}){const shownText=text||'Type here',px=fitPx(shownText,s,width,size),layout=withLineHeight(layoutText(shownText,skeletons,s,{maxWidth:width*1000/px,features}),lineHeight);typeLayouts.set(surface,{layout,px,empty:!text,model});const svg=art(shownText,s,{layout,idPrefix}),box=layout;return {html:svg.replace('<svg ','<svg style="width:'+(box.width*px/1000).toFixed(2)+'px;height:'+(box.height*px/1000).toFixed(2)+'px" '),px};}
function sizeSVGs(root){for(const svg of root.querySelectorAll('svg[data-px]')){const box=svg.viewBox.baseVal,px=+svg.dataset.px;svg.style.width=box.width*px/1000+'px';svg.style.height=box.height*px/1000+'px';}}

// Header and facts.
function renderChrome(){
 const title=mainFontTitle();$('mainFontPill').textContent=title;$('mainFontPill').title=title+' is the main font';$('factMain').textContent=title;$('editorMain').textContent=title;
 $('looksMenuList').innerHTML=PRESETS.map(p=>{const active=matchesLook(p,settings,lookSystem),[number,name]=p.name.split(' / ');return `<button type="button" role="menuitemradio" data-look="${p.id}" aria-checked="${active}">${escapeXML(name)}<span class="look-number">${number}</span></button>`;}).join('');
 $('factStyles').textContent=`${PRESETS.length} looks × ${STYLE_ORDER.length} styles (${PRESETS.length*STYLE_ORDER.length} fonts)`;$('factVersion').textContent=versionString(fontVersionNumber()).replace('Version ','');$('factReleased').textContent=RELEASED;$('factDesigner').textContent=($('fontDesigner')?.value||'').trim()||ABOUT.name;$('factCharacters').textContent=`${(CHARACTERS.length+1).toLocaleString('en')} drawn · Latin, Vietnamese${coverage.scripts.length?', '+coverage.scripts.map(p=>p.label).join(', '):''}`;$('factLanguages').textContent=`${supportedLanguages().length} languages`;
 $('stylesMeta').textContent='Three weights across three widths. Click a name to make it the main style.';$('testerMeta').textContent=(activeLookName()||'Custom')+' · '+STYLE_ORDER.length+' styles · one shared text';$('glyphsMeta').textContent=`${CHARACTERS.length+1} characters · ${coverage.accents} accents · hover a cell, click to keep it`;$('buildNote').textContent='Build '+DRAWING_REVISION+' · fonts generated in the browser';
 for(const id of ['undo','editorUndo'])$(id).disabled=!undo.length;for(const id of ['redo','editorRedo'])$(id).disabled=!redo.length;
 $('themeToggle').setAttribute('aria-pressed',String(document.body.classList.contains('theme-dark')));
}
// Hero: the name, white on black, over a grid of the look's own modules.
// The hero's dot field: one dot per cell of the hero, each floating on its own slow loop, and
// pulled towards the pointer when it comes near, following it as it moves and easing back
// when it leaves. Readers who ask for less motion get a still grid that still answers the pointer.
const hero={dots:[],mouse:null,raf:0,visible:true,still:matchMedia('(prefers-reduced-motion: reduce)').matches};
function heroField(pitch,m){
 const box=$('hero'),w=box.clientWidth,h=box.clientHeight,cols=Math.ceil(w/pitch)+1,rows=Math.ceil(h/pitch)+1,dots=[];
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const i=dots.length,k=(i*2654435761>>>0)%1000/1000;dots.push({x0:c*pitch+pitch/2,y0:r*pitch+pitch/2,x:0,y:0,phase:k*Math.PI*2,speed:.45+.4*((i*40503>>>0)%1000/1000),amp:2+3*((i*97>>>0)%1000/1000)});}
 $('heroTexture').innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'" aria-hidden="true"><defs><symbol id="heroDot" overflow="visible">'+moduleSVG({...m,x:0,y:0})+'</symbol></defs><g fill="#ffffff" color="#ffffff" opacity=".11">'+dots.map(d=>'<use href="#heroDot" transform="translate('+d.x0+' '+d.y0+')"/>').join('')+'</g></svg>';
 const uses=$('heroTexture').querySelectorAll('use');dots.forEach((d,i)=>d.el=uses[i]);
 hero.dots=dots;hero.pitch=pitch;cancelAnimationFrame(hero.raf);hero.raf=requestAnimationFrame(heroStep);
}
function heroStep(now){
 hero.raf=0;const t=now/1000,R=hero.pitch*6,pull=hero.pitch*1.1;let moving=false;
 for(const d of hero.dots){
  let tx=hero.still?0:Math.cos(t*d.speed+d.phase)*d.amp,ty=hero.still?0:Math.sin(t*d.speed*.8+d.phase)*d.amp;
  if(hero.mouse){const dx=hero.mouse.x-d.x0,dy=hero.mouse.y-d.y0,dist=Math.hypot(dx,dy);if(dist<R&&dist>0){const k=(1-dist/R)**2,s=Math.min(pull,dist*.7)*k/dist;tx+=dx*s;ty+=dy*s;}}
  const nx=d.x+(tx-d.x)*.14,ny=d.y+(ty-d.y)*.14;if(Math.abs(nx-d.x)>.02||Math.abs(ny-d.y)>.02)moving=true;d.x=nx;d.y=ny;
  d.el.setAttribute('transform','translate('+(d.x0+d.x).toFixed(1)+' '+(d.y0+d.y).toFixed(1)+')');
 }
 if(hero.visible&&(moving||!hero.still||hero.mouse))hero.raf=requestAnimationFrame(heroStep);
}
function heroWake(){if(!hero.raf&&hero.dots.length)hero.raf=requestAnimationFrame(heroStep);}
function renderHero(){
 const box=$('heroArt'),width=Math.max(120,box.clientWidth);if(!remember('hero',drawingKey()+'|'+texts.hero+'|'+width))return;
 const pitch=44,m={x:pitch/2,y:pitch/2,r:pitch*.17,shape:settings.shape,roundness:settings.roundness,angle:-.6,dot:settings.shape==='arc'?0:undefined};
 heroField(pitch,m);
 const requested=clamp(width*.24,96,380),{html}=rowSVG('hero','hero',texts.hero,settings,{width,size:requested,idPrefix:'hero'});
 box.innerHTML='<div class="hero-surface" data-type-surface="hero" data-text="hero"'+(texts.hero?'':' data-empty')+'>'+html+'</div>';
 $('heroEyebrow').innerHTML='<span>Display typeface</span><span>'+escapeXML(activeLookName()||'Custom')+' · '+PRESETS.length+' looks · '+STYLE_ORDER.length+' styles · '+PRESETS.length*STYLE_ORDER.length+' fonts</span>';
}
function renderIntro(){if(!remember('intro',drawingKey()))return;$('introAa').innerHTML=art('Aa',settings,{idPrefix:'intro-aa'});}
// Styles: each of the nine names set in its own style; the seven looks as Aa tiles.
// Axes: the word set live at the sliders' weight and width; the sweep animates both axes.
const axes={weight:700,width:100,playing:false,frame:0,t:0};
function axisStyle(){return {...settings,weight:axes.weight,width:axes.width};}
function renderAxes(){const key=drawingKey()+'|'+axes.weight+'|'+axes.width;if(!remember('axes',key))return;const s=axisStyle();$('axesArt').innerHTML=art(texts.hero||'Overdot',s,{idPrefix:'axes'});$('axesName').textContent=styleName(s)+' · '+axes.weight+' / '+axes.width+'%';$('axisWeight').value=axes.weight;$('axisWidth').value=axes.width;$('axisWeightOut').textContent=axes.weight;$('axisWidthOut').textContent=String(axes.width).padStart(3,'0');}
function sweepAxes(now){if(!axes.playing)return;axes.t+=1/180;const w=Math.round(650+250*Math.sin(axes.t*2*Math.PI*.5)),wd=Math.round(102.5+32.5*Math.sin(axes.t*2*Math.PI*.35+Math.PI/2));axes.weight=w;axes.width=wd;renderAxes();axes.frame=requestAnimationFrame(sweepAxes);}
function renderStyles(){
 renderAxes();
 if(!remember('styles',drawingKey()))return;
 $('styleNames').innerHTML=STYLE_ORDER.map((instance,i)=>{const s={...settings,weight:instance.weight,width:instance.width},active=s.weight===settings.weight&&s.width===settings.width,name=styleName(s);return `<button type="button" class="style-name" role="radio" data-use-style="${styleKey(s)}" aria-checked="${active}" title="${escapeXML(name)} · ${s.weight} / ${s.width}%">${art(name,s,{idPrefix:'style-'+styleId(s)})}<span>${String(i+1).padStart(2,'0')} ${escapeXML(name)}</span></button>`;}).join('');
 $('looks').innerHTML=PRESETS.map(p=>{const s=lookSettings(p,settings,lookSystem),active=matchesLook(p,settings,lookSystem),[number,name]=p.name.split(' / ');return `<button type="button" class="look-tile" role="radio" data-look="${p.id}" aria-checked="${active}" title="${escapeXML(p.note)}"><span class="look-aa">${art('Aa',s,{idPrefix:'look-'+p.id})}</span><span class="look-label"><span class="look-number">${number}</span><b>${escapeXML(name)}</b></span><small>${escapeXML(p.note)}</small></button>`;}).join('');
}
// The Tester: the nine styles of the main look, condensed to extended, one shared text.
const rowControls=(id,row,sizeRange)=>`<label class="control"><span>Size.</span><input type="range" min="${sizeRange[0]}" max="${sizeRange[1]}" value="${row.size}" data-row-control="size" aria-label="Size in pixels"><output>${pad(row.size)}</output></label><label class="control"><span>Tracking.</span><input type="range" min="${ROW_TRACKING[0]}" max="${ROW_TRACKING[1]}" value="${row.tracking}" data-row-control="tracking" aria-label="Tracking"><output>${pad(row.tracking)}</output></label>`;
function renderTester(){
 const container=$('testerRows'),width=Math.max(90,container.clientWidth);mainSurface=styleId(settings);
 const styles=STYLE_ORDER.map(instance=>{const s={...settings,weight:instance.weight,width:instance.width};return {s,id:styleId(s),name:styleName(s),active:s.weight===settings.weight&&s.width===settings.width};});
 if(remember('tester-rows',mainSurface)){memo.delete('tester-art');container.innerHTML=styles.map((st,i)=>{const row=rowState(st.id);return `<article class="row style-row${st.active?' is-main':''}" data-style="${st.id}"><div class="row-controls"><span class="row-style"><span class="look-number">${String(i+1).padStart(2,'0')}</span>${escapeXML(st.name)}</span>${rowControls(st.id,row,ROW_SIZE)}<div class="toggle-group" role="group" aria-label="Case"><button type="button" data-row-case="false" aria-pressed="${!row.upper}">Aa</button><button type="button" data-row-case="true" aria-pressed="${row.upper}">AA</button></div><div class="toggle-group" role="group" aria-label="OpenType features"><button type="button" class="tag" data-row-feature="tnum" aria-pressed="${row.tnum}" title="Tabular figures">tnum</button><button type="button" class="tag" data-row-feature="case" aria-pressed="${row.case}" title="Case-sensitive forms">case</button></div><span class="row-main">${st.active?'<span class="pill pill-main">Main style</span>':`<button type="button" class="pill" data-use-style="${styleKey(st.s)}" aria-label="Use ${escapeXML(st.name)} as the main style">Set as main</button>`}</span></div><div class="row-art" data-type-surface="${st.id}" data-text="tester"></div></article>`;}).join('');}
 if(!remember('tester-art',drawingKey()+'|'+texts.tester+'|'+JSON.stringify(testerRows)+'|'+width))return;
 for(const st of styles){const row=rowState(st.id),el=container.querySelector('[data-style="'+st.id+'"]'),shared=texts.tester??rowSample(styles.indexOf(st)),text=row.upper?shared.toUpperCase():shared,{html,px}=rowSVG(st.id,'tester',text,{...st.s,tracking:row.tracking},{width,size:row.size,features:{tnum:row.tnum,case:row.case},idPrefix:'tester-'+st.id});const target=el.querySelector('.row-art');target.innerHTML=html;target.toggleAttribute('data-empty',!shared);const outputs=el.querySelectorAll('.control output');outputs[0].textContent=pad(px);outputs[1].textContent=pad(row.tracking);}
 drawCaret();
}
// Specimens: a waterfall of independent rows, each with its own text and controls.
function renderWaterfall(){
 const container=$('specimenRows'),width=Math.max(90,container.clientWidth);
 if(remember('specimen-rows',JSON.stringify(waterfall.map(r=>[r.weight,r.width])))){memo.delete('specimen-art');container.innerHTML=waterfall.map((row,i)=>`<article class="row specimen-row" data-row="${i}"><div class="row-controls"><select class="pill-select row-select" data-row-style aria-label="Style">${STYLE_ORDER.map(s=>`<option value="${styleKey(s)}"${s.weight===row.weight&&s.width===row.width?' selected':''}>${escapeXML(styleName(s))}</option>`).join('')}</select><label class="control"><span>Size.</span><input type="range" min="${SPECIMEN_SIZE[0]}" max="${SPECIMEN_SIZE[1]}" value="${row.size}" data-row-control="size" aria-label="Size in pixels"><output>${pad(row.size)}</output></label><label class="control" title="Line height"><span aria-hidden="true">↕</span><input type="range" min="${LINE_HEIGHT[0]}" max="${LINE_HEIGHT[1]}" step=".01" value="${row.lineHeight}" data-row-control="lineHeight" aria-label="Line height"><output>${row.lineHeight.toFixed(2)}</output></label><label class="control" title="Tracking"><span aria-hidden="true">↔</span><input type="range" min="${ROW_TRACKING[0]}" max="${ROW_TRACKING[1]}" value="${row.tracking}" data-row-control="tracking" aria-label="Tracking"><output>${pad(row.tracking)}</output></label></div><div class="row-art" data-type-surface="row:${i}" data-text="row:${i}"></div></article>`).join('');}
 if(!remember('specimen-art',drawingKey()+'|'+JSON.stringify(waterfall)+'|'+width))return;
 waterfall.forEach((row,i)=>{const el=container.querySelector('[data-row="'+i+'"]'),s={...settings,weight:row.weight,width:row.width,tracking:row.tracking},{html,px}=rowSVG('row:'+i,'row:'+i,row.text,s,{width,size:row.size,lineHeight:row.lineHeight,idPrefix:'specimen-'+i});const target=el.querySelector('.row-art');target.innerHTML=html;target.toggleAttribute('data-empty',!row.text);const outputs=el.querySelectorAll('.control output');outputs[0].textContent=pad(px);outputs[1].textContent=row.lineHeight.toFixed(2);outputs[2].textContent=pad(row.tracking);});
 drawCaret();
}
// Glyphs: the character set by group beside a record of the chosen glyph.
function glyphSettings(){if(glyphStyle==='main')return settings;const [weight,width]=glyphStyle.split(',').map(Number);return {...settings,weight,width};}
function renderGlyphCard(){
 const s=glyphSettings(),sc=scene(char,s),code=char.codePointAt(0);$('glyphCardArt').innerHTML=cellSVG(char,s,'card');$('glyphCardName').textContent=familyTitle()+' '+styleName(s);$('glyphCodepoint').textContent='U+'+code.toString(16).toUpperCase().padStart(4,'0');$('glyphName').textContent=shown(char)+(glyphOf(GLYPHS,char)?.mark?' (combining)':'')+(derived(char)?' · built from '+(PACKS.find(p=>p.derive?.(char,skeletons))?.derivedFrom?.(char)||'drawings')+'':'');$('glyphEdit').disabled=derived(char);$('glyphEdit').title=derived(char)?'Built from other drawings; edit those instead.':'';$('glyphEntity').textContent='&#'+code+';';$('glyphAdvance').textContent=Math.round(sc.advance)+' units';
 for(const cell of $('glyphGroups').querySelectorAll('.glyph-cell'))cell.setAttribute('aria-pressed',String(cell.dataset.glyph===char));
}
const setCell=(c,s)=>`<button type="button" class="glyph-cell" data-glyph="${escapeXML(c)}" aria-label="${escapeXML(shown(c))}" aria-pressed="false">${cellSVG(c,s)}</button>`;
// The rest of a long group (Hangul syllables, ideographs) is drawn in slices between frames.
function showWholeGroup(id){const group=CHARACTER_GROUPS.find(g=>g.id===id),section=$('glyphGroups').querySelector(`[data-group="${id}"]`);if(!group||!section)return;const cells=section.querySelector('.glyph-cells'),s=glyphSettings(),chars=[...group.characters].filter(c=>glyphOf(skeletons,c)).slice(cells.children.length);section.querySelector('.glyph-more')?.remove();const key=drawingKey()+'|'+glyphStyle;let i=0;const step=()=>{if(!section.isConnected||memo.get('glyphs')!==key)return;cells.insertAdjacentHTML('beforeend',chars.slice(i,i+40).map(c=>setCell(c,s)).join(''));i+=40;if(i<chars.length)requestAnimationFrame(step);};step();}
function renderGlyphs(){
 if(remember('glyph-style',drawingKey()))$('glyphStyle').innerHTML='<option value="main">Main style · '+escapeXML(styleName(settings))+'</option>'+STYLE_ORDER.map(s=>`<option value="${styleKey(s)}"${glyphStyle===styleKey(s)?' selected':''}>${escapeXML(styleName(s))}</option>`).join('');
 if(remember('glyphs',drawingKey()+'|'+glyphStyle)){const s=glyphSettings();$('glyphGroups').innerHTML=CHARACTER_GROUPS.map(g=>{const chars=[...g.characters].filter(c=>glyphOf(skeletons,c)),first=g.lazy?chars.slice(0,g.lazy):chars;return `<section class="glyph-group" data-group="${g.id}"><h3>${g.label} <span class="look-number">${chars.length.toLocaleString('en')}</span></h3><div class="glyph-cells">${first.map(c=>setCell(c,s)).join('')}</div>${first.length<chars.length?`<p class="glyph-more"><button type="button" class="pill" data-show-group="${g.id}">Show all ${chars.length.toLocaleString('en')}</button></p>`:''}</section>`;}).join('');}
 renderGlyphCard();
}
// Features: off and on, as compiled into the fonts.
const FEATURES=[{tag:'tnum',name:'Tabular Figures',sample:'11\n00',affected:'0123456789',note:'Every figure takes the width of the widest, so columns of numbers line up. Proportional figures are the default.'},{tag:'case',name:'Case-Sensitive Forms',sample:'«H»',affected:'-‐–—()[]{}«»‹›@·¡¿',note:'Dashes, brackets, guillemets, the at sign and inverted punctuation rise to centre on the capitals.'}];
function renderFeatures(){
 if(!remember('features',drawingKey()))return;const s=settings;
 $('featureList').innerHTML=FEATURES.map(f=>`<article class="feature" data-feature="${f.tag}"><div class="feature-pair">${[false,true].map(on=>`<div class="feature-state"><header><code>${f.tag}</code><b>${on?'On':'Off'}</b></header><div class="feature-art">${art(f.sample,s,{idPrefix:'feature-'+f.tag+'-'+on,features:{[f.tag]:on}})}</div></div>`).join('')}</div><div class="feature-body"><h3><code>${f.tag}</code>${f.name}</h3><p>${f.note}</p><div class="glyph-cells">${[...f.affected].filter(c=>skeletons[c]).map(c=>`<button type="button" class="glyph-cell" data-glyph="${escapeXML(c)}" aria-label="${escapeXML(c)}">${cellSVG(c,s,'feature')}</button>`).join('')}</div></div></article>`).join('');
}
// Languages: the Latin-script languages whose letters are all drawn.
const LANGUAGES=[['afr','Afrikaans','êëïôû'],['sqi','Albanian','çë'],['arg','Aragonese','ñáéíóú'],['ast','Asturian','ñáéíóúü'],['rup','Aromanian','ãâ'],['eus','Basque','ñ'],['bem','Bemba',''],['bis','Bislama',''],['bos','Bosnian','čćđšž'],['bre','Breton','âêñùü'],['cat','Catalan','àçèéíïòóúü·'],['ceb','Cebuano',''],['nya','Chichewa',''],['cos','Corsican','àèìòù'],['hrv','Croatian','čćđšž'],['ces','Czech','áčďéěíňóřšťúůýž'],['dan','Danish','æøå'],['nld','Dutch','éëïóöü'],['eng','English',''],['epo','Esperanto','ĉĝĥĵŝŭ'],['est','Estonian','äõöüšž'],['fao','Faroese','áðíóúýæø'],['fij','Fijian',''],['fil','Filipino','ñ'],['fin','Finnish','äöåšž'],['fra','French','àâæçéèêëîïôœùûüÿ'],['fur','Friulian','àâèêìîòôùû'],['gag','Gagauz','äçêöşţü'],['glg','Galician','áéíñóúü'],['deu','German','äöüß'],['kal','Greenlandic','áâãéêíîôúû'],['grn','Guarani','ãẽĩõũỹñ'],['hat','Haitian Creole','èò'],['hun','Hungarian','áéíóöőúüű'],['isl','Icelandic','áðéíóúýþæö'],['ind','Indonesian',''],['ina','Interlingua',''],['gle','Irish','áéíóú'],['ita','Italian','àèéìíîòóùú'],['jav','Javanese','éè'],['kam','Kamba','ĩũ'],['csb','Kashubian','ąãéëłńòóôùżć'],['kik','Kikuyu','ĩũ'],['kin','Kinyarwanda',''],['kur','Kurdish (Kurmanji)','çêîşû'],['lld','Ladin','ëéè'],['lat','Latin','āēīōū'],['lav','Latvian','āčēģīķļņšūž'],['lim','Limburgish','äöüéè'],['lit','Lithuanian','ąčęėįšųūž'],['lmo','Lombard','àèéìòóù'],['dsb','Lower Sorbian','čćěłńóŕšśźž'],['nds','Low German','äöüß'],['ltz','Luxembourgish','äéëü'],['mlg','Malagasy',''],['msa','Malay',''],['mlt','Maltese','ċġħżà'],['glv','Manx','ç'],['mri','Māori','āēīōū'],['mer','Meru','ĩũ'],['mwl','Mirandese','ãçéíõú'],['mfe','Morisyen',''],['nap','Neapolitan','àèéìòóù'],['nde','North Ndebele',''],['frr','North Frisian','äöüåø'],['nso','Northern Sotho','šê'],['nob','Norwegian Bokmål','æøå'],['nno','Norwegian Nynorsk','æøå'],['oci','Occitan','àáèéíïòóúüç'],['pap','Papiamento','èòùü'],['pms','Piedmontese','àèéìòóë'],['pol','Polish','ąćęłńóśźż'],['por','Portuguese','àáâãçéêíóôõú'],['que','Quechua','ñ'],['ron','Romanian','ăâîșț'],['roh','Romansh','àèéìòù'],['sag','Sango','âäêëîïôöûü'],['srd','Sardinian','àèìòù'],['gla','Scottish Gaelic','àèìòù'],['srp','Serbian (Latin)','čćđšž'],['sna','Shona',''],['scn','Sicilian','àèìòù'],['szl','Silesian','ãćłńōŏõśźż'],['slk','Slovak','áäčďéíĺľňóôŕšťúýž'],['slv','Slovenian','čšž'],['som','Somali',''],['spa','Spanish','áéíñóúü¡¿'],['srn','Sranan Tongo',''],['sun','Sundanese','é'],['swa','Swahili',''],['ssw','Swati',''],['swe','Swedish','åäö'],['gsw','Swiss German','äöü'],['tet','Tetum',''],['ton','Tongan','āēīōūʻ'],['tsn','Tswana','š'],['tur','Turkish','çğıİöşü'],['tuk','Turkmen','äçňöşüýž'],['hsb','Upper Sorbian','čćěłńóřšźž'],['vec','Venetian','àèéòó'],['vie','Vietnamese','ăâđêôơưàảãáạằẳẵắặầẩẫấậèẻẽéẹềểễếệìỉĩíịòỏõóọồổỗốộờởỡớợùủũúụừửữứựỳỷỹýỵ'],['wln','Walloon','åâêîôûç'],['cym','Welsh','âêîôûŵŷáéíóú'],['fry','Western Frisian','âêôûú'],['wol','Wolof','àéëñó'],['xho','Xhosa',''],['yor','Yoruba','ẹọṣ'],['zul','Zulu','']];
function supportedLanguages(){return [...LANGUAGES.filter(([,,letters])=>[...letters].every(c=>GLYPHS[c]||GLYPHS[c.toUpperCase()])).map(([iso,name])=>({iso,name})),...SCRIPT_LANGUAGES.filter(([,,p])=>Object.keys(p.glyphs||{}).length||p.ready?.()).map(([iso,name,p])=>({iso,name,script:p.label}))].sort((a,b)=>a.name.localeCompare(b.name));}
// About: the name set in the main font, the bio and a record of role, projects, links and contact.
function renderAbout(){if(remember('about',drawingKey()))$('aboutName').innerHTML=art(ABOUT.name,settings,{idPrefix:'about-name'});if(!remember('about-record','once'))return;const link=(text,href)=>`<a href="${escapeXML(href)}"${/^https?:/.test(href)?' target="_blank" rel="noopener"':''}>${escapeXML(text)}</a>`;$('aboutCopy').innerHTML=ABOUT.bio.map(p=>`<p>${escapeXML(p)}</p>`).join('');$('aboutFacts').innerHTML=[['Name',escapeXML(ABOUT.name)],['Role',escapeXML(ABOUT.role)],['Projects',`<div class="about-list">${ABOUT.projects.map(([name,year,what,href])=>`<span>${[href?link(name,href):escapeXML(name),escapeXML(year),escapeXML(what)].filter(Boolean).join(' · ')}</span>`).join('')}</div>`],['Links',`<div class="about-list">${ABOUT.links.map(([label,text,href])=>`<span>${escapeXML(label)} · ${link(text,href)}</span>`).join('')}</div>`],['Contact',`<div class="about-list">${ABOUT.contact.map(([label,text,href])=>`<span>${escapeXML(label)} · ${link(text,href)}</span>`).join('')}</div>`]].map(([dt,dd])=>`<div><dt>${dt}</dt><dd>${dd}</dd></div>`).join('');}
function renderLanguages(){const query=$('languageFilter').value.trim().toLowerCase(),all=supportedLanguages(),list=all.filter(l=>!query||l.name.toLowerCase().includes(query)||l.iso.includes(query));$('languageList').innerHTML=list.map(l=>`<li><code>${l.iso}</code><span>${escapeXML(l.name)}${l.script?' <small>'+escapeXML(l.script)+'</small>':''}</span></li>`).join('')||'<li><span>No language matches.</span></li>';$('languageCount').textContent=query?`${list.length} of ${all.length} languages`:`${all.length} languages, derived from the character set`;}
// The editor compares the selected letter in all seven looks; the main font leads.
function renderLookGrid(target){
 const grid=$(target),comparison=comparisonGlyphs(skeletons[char],settings,lookSystem);
 const looks=[...comparison.looks].sort((x,y)=>matchesLook(y.look,settings,lookSystem)-matchesLook(x.look,settings,lookSystem));
 grid.innerHTML=looks.map(({look,settings:s,scene})=>{const name=look.name.split(' / ')[1],active=matchesLook(look,settings,lookSystem);return '<article class="look-card '+(active?'is-editing is-main':'')+'" data-look="'+look.id+'"><header><span class="look-number">'+look.name.split(' / ')[0]+'</span><h3>'+name+'</h3><span class="look-badge">'+(active?'Main font':'')+'</span></header><div class="look-art look-letter">'+lookGlyphSVG(scene,comparison.viewBox,char,undefined,target+'-'+look.id)+'</div><div class="look-card-footer"><span>'+shapes[s.shape][1]+' modules</span>'+(active?'':'<button type="button" data-look-use="'+look.id+'" aria-label="Use '+name+' as the main font">Use as main font</button>')+'</div></article>';}).join('');
}
// The editor's module controls change the main font's drawing recipe (every look
// follows through the look system) and the ink opacity of the whole page.
const MODULE_CONTROLS=['density','size','overlap','roundness'];let moduleGesture='';
function syncModuleControls(sc){for(const k of MODULE_CONTROLS){const input=$(k);if(!input)return;input.value=settings[k];$(k+'Value').textContent=k==='density'?settings[k].toFixed(2)+'×':k==='size'?String(settings[k]):settings[k]+'%';}$('roundnessControl').hidden=settings.shape!=='rounded';$('inkOpacity').value=Math.round(appearance.opacity*100);$('inkOpacityValue').textContent=Math.round(appearance.opacity*100)+'%';if(sc)$('moduleCount').textContent=sc.modules.length+' modules';}
function applyInkOpacity(){document.documentElement.style.setProperty('--ink-opacity',String(appearance.opacity));}
for(const k of MODULE_CONTROLS){const input=$(k);if(!input)continue;input.addEventListener('pointerdown',()=>{moduleGesture='';});input.addEventListener('input',()=>{const next=clamp(+input.value,...bounds[k]);if(next===settings[k])return;if(moduleGesture!==k){snapshot();moduleGesture=k;}lookSystem=adjustLookSystem(lookSystem,k,next);settings[k]=next;preset='';clearScenes();schedule();});for(const event of ['change','blur','pointerup','keyup'])input.addEventListener(event,()=>{moduleGesture='';});}
$('inkOpacity').addEventListener('pointerdown',()=>{moduleGesture='';});$('inkOpacity').addEventListener('input',()=>{const next=clamp(+$('inkOpacity').value,15,100)/100;if(next===appearance.opacity)return;if(moduleGesture!=='inkOpacity'){snapshot();moduleGesture='inkOpacity';}appearance.opacity=next;appearance.layered=next<1;applyInkOpacity();syncModuleControls();schedule();});for(const event of ['change','blur','pointerup','keyup'])$('inkOpacity').addEventListener(event,()=>{moduleGesture='';});
function setStyle(weight,width){if(settings.weight===weight&&settings.width===width)return;snapshot();settings.weight=weight;settings.width=width;preset='';clearScenes();render();toast(mainFontTitle()+' is now the main style.');}
// The text lives in one hidden field; the caret and selection are drawn in the
// specimen being typed in, so every style shows the same words as they change.
const SVG_NS='http://www.w3.org/2000/svg';
function textModel(key){if(key==='hero')return {get:()=>texts.hero,set:v=>{texts.hero=v;}};if(key.startsWith('row:')){const row=waterfall[+key.slice(4)];return {get:()=>row.text,set:v=>{row.text=v;}};}return {get:()=>texts.tester??rowSample(testerIndex(typeSurface)),set:v=>{texts.tester=v;}};}
function syncTextField(){$('text').value=textModel(activeText).get();}
function typeEntry(){return typeLayouts.get(typeSurface)||typeLayouts.get(mainSurface)||typeLayouts.values().next().value;}
function surfaceOf(id){return document.querySelector('[data-type-surface="'+id+'"]');}
function drawCaret(){
 for(const old of document.querySelectorAll('.type-caret,.type-selection'))old.remove();document.querySelectorAll('.is-typing').forEach(c=>c.classList.remove('is-typing'));
 const input=$('text');if(document.activeElement!==input||view!=='specimen')return;
 const id=typeLayouts.has(typeSurface)?typeSurface:typeLayouts.has(mainSurface)?mainSurface:typeLayouts.keys().next().value,entry=typeLayouts.get(id),surface=surfaceOf(id);if(!entry||!surface||entry.model!==activeText)return;
 const svg=surface.querySelector('svg'),{layout,px,empty}=entry,carets=layout.carets,at=i=>carets[Math.max(0,Math.min(carets.length-1,i))],top=150,height=840,start=empty?0:input.selectionStart,end=empty?0:input.selectionEnd;
 (surface.closest('.row')||surface.closest('.hero-art'))?.classList.add('is-typing');
 const rect=(x,y,w,cls)=>{const r=document.createElementNS(SVG_NS,'rect');r.setAttribute('class',cls);r.setAttribute('x',x);r.setAttribute('y',y+top);r.setAttribute('width',Math.max(0,w));r.setAttribute('height',height);svg.appendChild(r);};
 let run=null;for(let i=start;i<end;i++){const a=at(i),b=at(i+1),right=b.y===a.y?b.x:a.x+300;if(run&&run.y===a.y&&Math.abs(run.x1-a.x)<1)run.x1=right;else{if(run)rect(run.x0,run.y,run.x1-run.x0,'type-selection');run={x0:a.x,x1:right,y:a.y};}}if(run)rect(run.x0,run.y,run.x1-run.x0,'type-selection');
 const c=at(input.selectionDirection==='backward'?start:end),w=Math.max(16,2.5*1000/px);rect(c.x-w/2,c.y,w,'type-caret');
 // The hidden field follows the caret, so input-method windows open beside it.
 const ctm=svg.getScreenCTM();if(ctm){const p=new DOMPoint(c.x,c.y+top).matrixTransform(ctm);input.style.left=clamp(p.x,0,innerWidth-4)+'px';input.style.top=clamp(p.y,0,innerHeight-30)+'px';}
}
function caretAt(surface,e){const entry=typeLayouts.get(surface.dataset.typeSurface);if(!entry||entry.empty)return 0;const svg=surface.querySelector('svg'),pt=new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse()),carets=entry.layout.carets,lines=[...new Set(carets.map(c=>c.y))],line=lines.reduce((best,y)=>pt.y>=y?y:best,lines[0]);let index=0,distance=Infinity;carets.forEach((c,i)=>{const d=Math.abs(c.x-pt.x);if(c.y===line&&d<distance){distance=d;index=i;}});return index;}
function normalizeText(){const input=$('text'),v=input.value,n=v.normalize('NFC').slice(0,500);if(n===v)return;const caret=Math.min(n.length,v.slice(0,input.selectionEnd).normalize('NFC').length);input.value=n;input.setSelectionRange(caret,caret);}

// The chosen look becomes the main font: the name, every specimen, the editor and
// downloads all use it.
function useLook(id){const look=PRESETS.find(p=>p.id===id);if(!look)return;const changed=!matchesLook(look,settings,lookSystem),next=validateSettings(lookSettings(look,settings,lookSystem));if(JSON.stringify(next)!==JSON.stringify(settings)||lookSystem.reference!==id){snapshot();settings=next;lookSystem={...lookSystem,reference:id};preset=id;clearScenes();}render();if(changed)toast(look.name.split(' / ')[1]+' is now the main font.');}

function glyphCell(c){const safe=escapeXML(c);return `<button type="button" class="glyph-cell ${c===char?'selected':''}" data-linked-glyph="${safe}" title="Edit ${safe}" aria-label="Edit character ${safe}" aria-pressed="${c===char}">${cellSVG(c,settings,'linked')}<span>${escapeXML(shown(c))}<span>${Math.round(scene(c).advance)}</span></span></button>`;}
// The linked alphabet lists the editable drawings: the built glyphs (syllables, ideographs) follow their parts and are not shown here.
function renderLinked(){ $('linkedAlphabet').innerHTML=CHARACTER_GROUPS.filter(g=>!g.lazy).map(g=>{const chars=[...g.characters].filter(c=>skeletons[c]);return chars.length?'<h2 class="character-group">'+g.label+'</h2>'+chars.map(c=>glyphCell(c)).join(''):'';}).join('');}
function syncPoint(){const p=selected?skeletons[char].paths[selected.p]?.points[selected.i]:null;for(const [id,i]of [['pointX',0],['pointY',1]]){$(id).disabled=!p;$(id).value=p?Math.round(p[i]):'';}}
function renderGlyph(){
 const sc=scene(char),locked=!!skeletons[char].composite,show=$('handles').checked,left=Math.min(-70,sc.bounds.minX-40),top=Math.min(80,sc.bounds.minY-40),box=dragging&&dragFrame?dragFrame:[left,top,Math.max(770,sc.bounds.maxX+50-left),Math.max(1120,sc.bounds.maxY+50-top)];
 const zones=inkZones(settings),guides=[zones.cap,zones.x,zones.base,zones.desc].map((y,i)=>`<line class="guide" x1="-15" x2="900" y1="${y}" y2="${y}"/><text class="guide-text" x="-20" y="${y-8}">${['CAP','X','BASE','DESC'][i]}</text>`).join('');
 let lines='',nodes='';if(show)for(let pi=0;pi<sc.paths.length;pi++){
  const p=sc.paths[pi];lines+=`<path class="skeleton-line" d="${pathData(p)}"/>`;
  p.points.forEach((q,i)=>{if(p.kind==='bezier'&&i%3===1)lines+=`<line class="handle-line" x1="${p.points[i-1][0]}" y1="${p.points[i-1][1]}" x2="${q[0]}" y2="${q[1]}"/>`;if(p.kind==='bezier'&&i%3===2)lines+=`<line class="handle-line" x1="${q[0]}" y1="${q[1]}" x2="${p.points[i+1][0]}" y2="${p.points[i+1][1]}"/>`;const control=p.kind==='bezier'&&i%3!==0;if(!locked)nodes+=`<circle class="node ${control?'control-node':''} ${selected?.p===pi&&selected?.i===i?'selected':''}" data-path="${pi}" data-point="${i}" cx="${q[0]}" cy="${q[1]}" r="${control?8:12}"/>`;});
 }
 $('glyphArt').innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.join(' ')}" fill="currentColor" aria-label="Editable glyph ${escapeXML(char)}">${surfaceSVG(glyphSVG(sc,displayAppearance()),box,displayAppearance(),{idPrefix:'editor-'+char.codePointAt(0),pitch:72})}${guides}${lines}${nodes}</svg>`;
 $('skeletonJson').value=JSON.stringify(skeletons[char].paths,null,2);$('editingLetter').textContent=shown(char);  // Accented letters are read-only; their note links to the base letter and accents.
 $('compositeNote').hidden=!locked;$('compositeNote').innerHTML=locked?compositeNote(char):'';for(const id of ['applySkeleton','generateSet'])$(id).disabled=locked||id==='generateSet'&&!!skeletons[char].mark;$('resetGlyph').disabled=false;$('skeletonJson').readOnly=locked;$('glyphPosition').textContent=`${letters.indexOf(char)+1} / ${letters.length}`;
 $('allGlyphs').value=char;syncPoint();$('editorTitle').textContent='Editor · '+shown(char);syncModuleControls(sc);
 $('syncAlphabet').setAttribute('aria-checked',String(syncEnabled));$('syncValue').textContent=syncEnabled?'On':'Off';$('syncHint').textContent=syncEnabled?'Nearby points across the alphabet move with your edit. Curve handles stay local.':'Only this letter changes. Shared style controls still update the alphabet.';$('generateSet').disabled=JSON.stringify(skeletons[char].paths)===JSON.stringify(GLYPHS[char].paths);
}
function familyOptions(){return {appearance:displayAppearance(),mode:family.mode,sentence:family.sentence,paragraph:family.paragraph};}
function renderPage(){
 const missing=[...new Set([...textModel(activeText).get().normalize('NFC')].filter(c=>!/\s/.test(c)&&!glyphOf(skeletons,c)))];$('unsupported').textContent=missing.length?'Not in Overdot yet: '+missing.join(' '):'';
 renderHero();renderIntro();renderStyles();renderTester();renderWaterfall();pageDirty=false;
 // The character set, features and languages follow after the first paint.
 clearTimeout(deferred);deferred=setTimeout(()=>{if(view!=='specimen')return;renderGlyphs();renderFeatures();if(remember('languages',drawingVersion))renderLanguages();renderAbout();},0);
}
function render(){applyInkOpacity();
 renderChrome();
 if(view==='editor'){renderGlyph();renderLookGrid('editorLooks');renderLinked();renderStyles();pageDirty=true;}
 else renderPage();
}
function schedule(){cancelAnimationFrame(raf);raf=requestAnimationFrame(render);}
// The Editor is a full-screen view over the specimen page.
function openEditor(c){if(c&&skeletons[c])char=c;selected=null;view='editor';document.body.classList.add('editor-open');$('editorView').hidden=false;$('page').inert=true;$('siteHeader').inert=true;drawCaret();render();$('closeEditor').focus({preventScroll:true});$('editorView').scrollTop=0;}
function closeEditor(){if(view!=='editor')return;view='specimen';document.body.classList.remove('editor-open');$('editorView').hidden=true;$('page').inert=false;$('siteHeader').inert=false;selected=null;render();$('openEditor').focus({preventScroll:true});}
function chooseGlyph(c){char=c;selected=null;if(view!=='editor')openEditor(c);else render();$('syncReadout').textContent='Drag a point to move it. Small handles bend the curves.';}
function historyState(){return {skeletons:structuredClone(skeletons),proportionFrame:structuredClone(proportionFrame),appearance:{...appearance},settings:{...settings},lookSystem:structuredClone(lookSystem),preset};}
function snapshot(){undo.push(historyState());if(undo.length>50)undo.shift();redo=[];}
function restoreHistory(state){({skeletons,proportionFrame,settings,lookSystem,preset}=state);appearance=readAppearance(state.appearance);selected=null;clearScenes();render();}
function undoEdit(){if(!undo.length)return;redo.push(historyState());restoreHistory(undo.pop());$('syncReadout').textContent='Last change undone.';}
function redoEdit(){if(!redo.length)return;undo.push(historyState());restoreHistory(redo.pop());$('syncReadout').textContent='Last change restored.';}
function movePoint(nx,ny){const base=dragging?dragSource:skeletons;const isHandle=base[char].paths[selected.p].kind==='bezier'&&selected.i%3!==0;const result=editPoint(base,char,selected,[nx,ny],{sync:syncEnabled&&!isHandle});skeletons=result.skeletons;clearScenes(result.changed);$('syncReadout').textContent=syncEnabled&&!isHandle?`${result.changed.length} characters updated. Undo restores the whole edit.`:`${char} updated. Other letters kept their drawings.`;}

// Typing: one hidden field; click places the caret, drag selects, a double click
// selects a word, in the hero, any Tester style or any specimen row.
$('text').addEventListener('input',e=>{if(!e.isComposing){if($('text').value.length>500)toast('Text limited to 500 characters.');normalizeText();}textModel(activeText).set($('text').value);schedule();});$('text').addEventListener('compositionend',()=>{normalizeText();textModel(activeText).set($('text').value);schedule();});
for(const event of ['focus','blur','select','keyup'])$('text').addEventListener(event,()=>requestAnimationFrame(drawCaret));document.addEventListener('selectionchange',()=>{if(document.activeElement===$('text'))requestAnimationFrame(drawCaret);});
// Up and down move between the lines of the specimen being typed in.
$('text').addEventListener('keydown',e=>{if(!['ArrowUp','ArrowDown'].includes(e.key)||e.altKey||e.ctrlKey||e.metaKey)return;const entry=typeEntry();if(!entry||entry.empty)return;e.preventDefault();const input=$('text'),carets=entry.layout.carets,backward=input.selectionDirection==='backward',from=backward?input.selectionStart:input.selectionEnd,anchor=backward?input.selectionEnd:input.selectionStart,c=carets[from],lines=[...new Set(carets.map(q=>q.y))],line=lines.indexOf(c.y)+(e.key==='ArrowUp'?-1:1);let to=line<0?0:input.value.length;if(line>=0&&line<lines.length){let best=Infinity;carets.forEach((q,i)=>{if(q.y===lines[line]&&Math.abs(q.x-c.x)<best){best=Math.abs(q.x-c.x);to=i;}});}if(e.shiftKey)input.setSelectionRange(Math.min(anchor,to),Math.max(anchor,to),to<anchor?'backward':'forward');else input.setSelectionRange(to,to);drawCaret();});
document.addEventListener('pointerdown',e=>{const surface=e.target.closest('[data-type-surface]');if(!surface||e.button!==0||view!=='specimen')return;e.preventDefault();typeSurface=surface.dataset.typeSurface;if(surface.dataset.text==='tester'&&texts.tester==null){texts.tester=rowSample(testerIndex(typeSurface));memo.delete('tester-art');renderTester();activeText='tester';syncTextField();}else if(surface.dataset.text!==activeText){activeText=surface.dataset.text;syncTextField();}const input=$('text'),i=caretAt(surface,e);input.focus({preventScroll:true});if(e.shiftKey){const anchor=input.selectionDirection==='backward'?input.selectionEnd:input.selectionStart;typeAnchor=anchor;input.setSelectionRange(Math.min(anchor,i),Math.max(anchor,i),i<anchor?'backward':'forward');}else{typeAnchor=i;input.setSelectionRange(i,i);}surface.setPointerCapture(e.pointerId);drawCaret();});
document.addEventListener('pointermove',e=>{if(typeAnchor===null)return;const surface=surfaceOf(typeSurface);if(!surface)return;const i=caretAt(surface,e),input=$('text');input.setSelectionRange(Math.min(typeAnchor,i),Math.max(typeAnchor,i),i<typeAnchor?'backward':'forward');drawCaret();});
for(const event of ['pointerup','pointercancel'])document.addEventListener(event,()=>{typeAnchor=null;});
document.addEventListener('dblclick',e=>{const surface=e.target.closest('[data-type-surface]');if(!surface)return;const input=$('text'),v=input.value,i=caretAt(surface,e);let a=i,b=i;while(a>0&&/\S/.test(v[a-1]))a--;while(b<v.length&&/\S/.test(v[b]))b++;input.setSelectionRange(a,b);drawCaret();});
// Looks and styles: the header menu, the tiles, the names and every "Set as main".
document.addEventListener('click',e=>{
 const look=e.target.closest('[data-look]');if(look&&!e.target.closest('#editorLooks')){useLook(look.dataset.look);const menu=look.closest('details');if(menu)menu.open=false;return;}
 const style=e.target.closest('[data-use-style]');if(style){const [weight,width]=style.dataset.useStyle.split(',').map(Number);setStyle(weight,width);return;}
 const use=e.target.closest('[data-look-use]');if(use){useLook(use.dataset.lookUse);return;}
 const cell=e.target.closest('#glyphGroups .glyph-cell, #featureList .glyph-cell');if(cell){char=cell.dataset.glyph;selected=null;renderGlyphCard();return;}
 const linked=e.target.closest('[data-linked-glyph]');if(linked){chooseGlyph(linked.dataset.linkedGlyph);if(window.innerWidth<900)$('glyphArt').scrollIntoView({block:'center',behavior:'smooth'});return;}
 const edit=e.target.closest('[data-edit-glyph]');if(edit){chooseGlyph(edit.dataset.editGlyph);return;}
 const caseButton=e.target.closest('[data-row-case]');if(caseButton){const row=rowState(caseButton.closest('.row').dataset.style);row.upper=caseButton.dataset.rowCase==='true';for(const b of caseButton.parentElement.children)b.setAttribute('aria-pressed',String(b===caseButton));schedule();return;}
 const feature=e.target.closest('[data-row-feature]');if(feature){const row=rowState(feature.closest('.row').dataset.style),tag=feature.dataset.rowFeature;row[tag]=!row[tag];feature.setAttribute('aria-pressed',String(row[tag]));schedule();}
});
$('glyphGroups').addEventListener('click',e=>{const more=e.target.closest('[data-show-group]');if(more)showWholeGroup(more.dataset.showGroup);});
$('glyphGroups').addEventListener('mouseover',e=>{const cell=e.target.closest('.glyph-cell');if(cell&&cell.dataset.glyph!==char){char=cell.dataset.glyph;selected=null;renderGlyphCard();}});
// Row controls: sliders update only their row's art; a select changes a specimen row's style.
document.addEventListener('input',e=>{const control=e.target.closest('[data-row-control]');if(!control)return;const rowEl=control.closest('.row'),value=+control.value;if(rowEl.dataset.style)rowState(rowEl.dataset.style)[control.dataset.rowControl]=value;else waterfall[+rowEl.dataset.row][control.dataset.rowControl]=value;schedule();});
document.addEventListener('change',e=>{const select=e.target.closest('[data-row-style]');if(!select)return;const [weight,width]=select.value.split(',').map(Number),row=waterfall[+select.closest('.row').dataset.row];row.weight=weight;row.width=width;schedule();});
$('glyphStyle').addEventListener('change',()=>{glyphStyle=$('glyphStyle').value;render();});
$('glyphEdit').addEventListener('click',()=>chooseGlyph(char));
$('languageFilter').addEventListener('input',renderLanguages);
for(const id of ['openEditor','introEditor','footerEditor'])$(id).addEventListener('click',()=>openEditor());
for(const [id,key]of [['axisWeight','weight'],['axisWidth','width']])$(id).addEventListener('input',()=>{if(axes.playing){stopSweep();axes.paused=true;}axes[key]=+$(id).value;renderAxes();});
function stopSweep(){axes.playing=false;cancelAnimationFrame(axes.frame);$('axesPlay').setAttribute('aria-pressed','false');$('axesPlay').textContent='Sweep';}
function startSweep(){if(axes.playing)return;axes.playing=true;$('axesPlay').setAttribute('aria-pressed','true');$('axesPlay').textContent='Stop';axes.frame=requestAnimationFrame(sweepAxes);}
$('axesPlay').addEventListener('click',()=>{if(axes.playing){stopSweep();axes.paused=true;return;}axes.paused=false;startSweep();});
// The sweep plays by itself while the Styles section is on screen, until the reader stops it or
// takes a slider; it rests off screen. Readers who ask for less motion get the still word.
if(!matchMedia('(prefers-reduced-motion: reduce)').matches&&'IntersectionObserver'in window)new IntersectionObserver(entries=>{for(const e of entries){if(e.isIntersecting){if(!axes.paused)startSweep();}else if(axes.playing)stopSweep();}},{threshold:.35}).observe($('axes'));
$('axesUse').addEventListener('click',()=>{stopSweep();setStyle(axes.weight,axes.width);});
$('closeEditor').addEventListener('click',closeEditor);
for(const id of ['introDownload','footerDownload','editorDownload'])$(id).addEventListener('click',()=>$('exportOTF').click());
$('handles').addEventListener('change',renderGlyph);
$('themeToggle').addEventListener('click',()=>{document.body.classList.toggle('theme-dark');renderChrome();});
$('syncAlphabet').addEventListener('click',()=>{syncEnabled=!syncEnabled;renderGlyph();});
$('allGlyphs').addEventListener('change',()=>chooseGlyph($('allGlyphs').value));
$('previousGlyph').addEventListener('click',()=>chooseGlyph(letters[(letters.indexOf(char)+letters.length-1)%letters.length]));$('nextGlyph').addEventListener('click',()=>chooseGlyph(letters[(letters.indexOf(char)+1)%letters.length]));
window.addEventListener('resize',()=>{setHeaderHeight();schedule();});
$('hero').addEventListener('pointermove',e=>{const r=$('hero').getBoundingClientRect();hero.mouse={x:e.clientX-r.left,y:e.clientY-r.top};heroWake();});
$('hero').addEventListener('pointerleave',()=>{hero.mouse=null;heroWake();});
if('IntersectionObserver'in window)new IntersectionObserver(entries=>{for(const e of entries){hero.visible=e.isIntersecting;if(hero.visible)heroWake();}}).observe($('hero'));
$('glyphArt').addEventListener('pointerdown',e=>{const node=e.target.closest('.node');if(!node)return;e.preventDefault();selected={p:+node.dataset.path,i:+node.dataset.point};dragSource=structuredClone(skeletons);const frame=$('glyphArt').querySelector('svg').viewBox.baseVal;dragFrame=[frame.x,frame.y,frame.width,frame.height];dragRecorded=false;dragging=true;$('glyphArt').setPointerCapture(e.pointerId);renderGlyph();});
$('glyphArt').addEventListener('pointermove',e=>{if(!dragging||!selected)return;const svg=$('glyphArt').querySelector('svg'),point=new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse()),g=dragSource[char],[x,y]=skeletonPoint(g,settings,[point.x,point.y],selected.p),original=g.paths[selected.p].points[selected.i];const nx=Math.round(clamp(x,-100,1000)),ny=Math.round(clamp(y,100,1170));if(!dragRecorded&&Math.hypot(nx-original[0],ny-original[1])<1)return;if(!dragRecorded){snapshot();dragRecorded=true;}movePoint(nx,ny);renderGlyph();renderLookGrid('editorLooks');});
// The character set refreshes when the drag ends; during it, the glyph and its
// seven looks follow the pointer.
function endDrag(){if(!dragging)return;dragging=false;dragSource=null;dragFrame=null;render();}
$('glyphArt').addEventListener('pointerup',endDrag);$('glyphArt').addEventListener('pointercancel',endDrag);
for(const [id,index]of [['pointX',0],['pointY',1]])$(id).addEventListener('change',()=>{if(!selected)return;const v=+$(id).value;if(!Number.isFinite(v)||v< -100||v>1170){toast('Use a coordinate from −100 to 1170.');syncPoint();return;}const old=skeletons[char].paths[selected.p].points[selected.i];if(Math.abs(old[index]-v)<.001)return;snapshot();movePoint(index===0?v:old[0],index===1?v:old[1]);render();});
for(const id of ['undo','editorUndo'])$(id).addEventListener('click',()=>{undoEdit();closeMenus();});for(const id of ['redo','editorRedo'])$(id).addEventListener('click',()=>{redoEdit();closeMenus();});
$('generateSet').addEventListener('click',()=>{try{const result=applyProportions(skeletons,GLYPHS,char,proportionFrame);if([...result.fit.x,...result.fit.y].every((n,i)=>Math.abs(n-[...proportionFrame.x,...proportionFrame.y][i])<1e-8)){toast('These proportions are already shared.');return;}snapshot();skeletons=result.skeletons;proportionFrame={x:result.fit.x,y:result.fit.y};selected=null;clearScenes();render();const message=`Proportions from ${char} applied to the other ${letters.length-1} characters. Individual details kept.`;$('syncReadout').textContent=message;toast(message);}catch(error){toast(error.message);}});
// Reset in the editor restores every letter, not only the one on screen.
$('resetGlyph').addEventListener('click',()=>{snapshot();skeletons=freshSkeletons();proportionFrame=readFrame();selected=null;clearScenes();render();toast('All letters restored to the default drawings. Undo is available.');});
$('applySkeleton').addEventListener('click',()=>{try{const paths=validatePaths(JSON.parse($('skeletonJson').value));snapshot();skeletons[char].paths=paths;selected=null;clearScenes();render();toast('Paths updated for this letter.');}catch(e){toast(e.message);}});
$('resetAllGlyphs').addEventListener('click',()=>{snapshot();skeletons=freshSkeletons();proportionFrame=readFrame();char='a';selected=null;clearScenes();render();closeMenus();toast('All character drawings restored to default. Undo is available.');});
function closeMenus(){for(const menu of document.querySelectorAll('details.menu[open]'))menu.open=false;}
document.addEventListener('click',e=>{if(!e.target.closest('details.menu'))closeMenus();});
document.addEventListener('keydown',e=>{const editing=e.target.closest('input:not([type=range]):not([type=checkbox]),textarea,select,[contenteditable]');if(e.key==='Escape'){if(document.querySelector('details.menu[open]')){closeMenus();return;}if(view==='editor'&&!$('fontExportDialog').open){e.preventDefault();closeEditor();}return;}if(editing)return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redoEdit():undoEdit();}else if(view==='editor'&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();chooseGlyph(letters[(letters.indexOf(char)+(e.key==='ArrowRight'?1:letters.length-1))%letters.length]);}});
function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
// The specimen SVG: the Tester's text in the nine styles of the main look; from the
// Editor, the glyph being edited. Always black ink on white paper.
function exportSVG(){
 const glyph=view==='editor';const svg=glyph?singleSVG(char,settings,{surface:true,prefix:'export-glyph'}):familyTextSheetSVG(skeletons,settings,{text:texts.tester??rowSample(0),size:64,familyName:exportFamilyName(),appearance:displayAppearance()});
 download(`overdot-${glyph?'glyph':'specimen'}-${settings.weight}-${settings.width}.svg`,svg,'image/svg+xml');closeMenus();toast('SVG exported.');return {view:glyph?'glyph':'specimen',weight:settings.weight,width:settings.width};
}
$('export').addEventListener('click',exportSVG);$('specimenSVG').addEventListener('click',exportSVG);$('editorExport').addEventListener('click',exportSVG);
function editableProject(){return {...projectIR(skeletons,settings),drawingRevision:DRAWING_REVISION,lookSystem:structuredClone(lookSystem),appearance:{...appearance},text:texts.tester??'',texts:{hero:texts.hero},tester:{rows:structuredClone(testerRows)},waterfall:structuredClone(waterfall),ui:uiState(),proportionFrame,family:familyOptions()};}
let fontWorker=null;
// An unnamed export takes the look's name, so different looks never install as the same family.
function exportFamilyName(){return $('fontName').value.trim()||defaultFamilyName(activeLookName()||'Custom');}
// The designer record defaults to the About section's name when the field is left blank.
function fontInfo(){const info=Object.fromEntries(Object.entries(FONT_INFO_INPUTS).map(([key,id])=>[key,$(id).value]));if(!String(info.designer||'').trim())info.designer=ABOUT.name;return info;}
// Every export gets a new version, so installed copies and caches can tell revisions apart.
function fontVersionNumber(){return 1+fontRevision/1000;}
function chosenSets(){return FONT_SETS.filter(set=>$('fontSets').querySelector(`[data-set="${set.id}"]`)?.checked);}
// The derived glyphs of the chosen sets join the drawings for the download.
function exportSkeletons(){const out=structuredClone(skeletons);for(const set of chosenSets())for(const c of set.chars())if(!out[c]){const g=glyphOf(skeletons,c);if(g)out[c]=g;}return out;}
function renderFontSets(){const box=$('fontSets');if(!FONT_SETS.length){box.hidden=true;return;}box.innerHTML='<span class="font-sets-label">Also include</span>'+FONT_SETS.map(set=>`<label><input type="checkbox" data-set="${set.id}"${set.default?' checked':''}${set.pack.ready&&!set.pack.ready()?' disabled':''}> ${escapeXML(set.label)} <span class="look-number">${set.count.toLocaleString('en')}</span></label>`).join('')+'<p class="hint font-sets-note" id="fontSetsNote" hidden></p>';}
// Packs whose data carries its own terms: their notice shows in the dialog and their licence file joins a family ZIP.
function exportNotices(){const packs=new Set([...chosenSets().map(s=>s.pack),...PACKS.filter(p=>Object.keys(p.glyphs||{}).length)]);return [...packs].filter(p=>p.notice);}
function exportFiles(){return exportNotices().filter(p=>p.license?.text()).map(p=>({name:p.license.file,content:p.license.text()}));}
function updateExportSummary(){const whole=$('fontExportScope').value==='family',extra=chosenSets().reduce((n,set)=>n+set.count,0),count=CHARACTERS.length+1+extra;$('fontExportSummary').textContent=(whole?'Nine styles · three weights × three widths':styleName(settings))+' · '+shapes[settings.shape][1]+' modules · '+count.toLocaleString('en')+' characters'+(count>3000?' · about '+Math.ceil(count*(whole?9:1)/100)*1+' s to build':'');$('fontExportHint').textContent=whole?'One ZIP with nine installable OTFs, a family proof and your editable project. Every style uses your current drawings and module settings.':'The complete character set, using your current drawings and style. Install the downloaded .otf file like any other font.';$('fontInkNote').textContent='SVG keeps the specimen as drawn. OTF exports solid letter shapes with tnum, case and kern features, and mark positioning and shaping for Thai, Lao and Khmer.';const note=$('fontSetsNote');if(note){const notices=exportNotices();note.hidden=!notices.length;note.textContent=notices.map(p=>p.notice).join(' ');}$('downloadOTF').textContent=whole?'Download family ZIP':'Download OTF';$('fontName').placeholder=defaultFamilyName(activeLookName()||'Custom');const names=fontNames(exportFamilyName(),settings);$('fontIdentity').textContent='Installs as '+(whole?names.familyName+' · nine styles':names.fullName)+' · '+versionString(fontVersionNumber());}
function stopFontExport(){if(fontWorker){fontWorker.terminate();fontWorker=null;}$('downloadOTF').disabled=false;$('fontName').disabled=false;$('fontExportScope').disabled=false;$('fontInfoFields').disabled=false;$('fontExportProgress').hidden=true;}
function closeFontExport(){stopFontExport();$('fontExportDialog').close();}
$('exportOTF').addEventListener('click',()=>{$('fontExportScope').value='current';renderFontSets();updateExportSummary();$('fontExportStatus').textContent='Ready to export.';$('fontExportDialog').showModal();});
$('fontExportScope').addEventListener('change',updateExportSummary);$('fontSets').addEventListener('change',updateExportSummary);$('cancelFontExport').addEventListener('click',closeFontExport);$('closeFontExport').addEventListener('click',closeFontExport);$('fontExportDialog').addEventListener('cancel',stopFontExport);$('fontName').addEventListener('input',updateExportSummary);$('fontVendor').addEventListener('invalid',()=>{$('fontInfo').open=true;});
$('fontExportForm').addEventListener('submit',e=>{e.preventDefault();if(fontWorker)return;const scope=$('fontExportScope').value;$('downloadOTF').disabled=true;$('fontName').disabled=true;$('fontExportScope').disabled=true;$('fontInfoFields').disabled=true;$('fontExportProgress').value=0;$('fontExportProgress').hidden=false;$('fontExportStatus').textContent=scope==='family'?'Building your family…':'Building your font…';
 try{fontWorker=new Worker(new URL('./engine/otf-worker.js',import.meta.url),{type:'module'});const runningWorker=fontWorker;fontWorker.onmessage=async({data})=>{if(fontWorker!==runningWorker)return;if(data.type==='progress'){$('fontExportProgress').max=data.total;$('fontExportProgress').value=data.completed;$('fontExportStatus').textContent=data.fontCount?data.style+' · font '+data.font+' / '+data.fontCount:'Preparing characters '+data.completed+' / '+data.total;return;}if(data.type==='error'){$('fontExportStatus').textContent=data.message;stopFontExport();return;}
 if(data.type==='complete'){try{const fonts=data.fonts||[data];for(let i=0;i<fonts.length;i++){if(fontWorker!==runningWorker)return;$('fontExportStatus').textContent='Checking font '+(i+1)+' / '+fonts.length;await new FontFace('OverdotExportCheck'+i,fonts[i].buffer).load();}if(fontWorker!==runningWorker)return;download(data.fileName,data.buffer,data.fonts?'application/zip':'font/otf');const exported=versionString(fontVersionNumber());fontRevision++;closeFontExport();renderChrome();toast(data.fonts?'Family exported · '+data.fontCount+' OTFs + proof + editable project · '+exported:'OTF exported · '+data.characterCount+' characters · '+data.styleName+' · '+exported);}catch(error){if(fontWorker!==runningWorker)return;$('fontExportStatus').textContent='Font validation failed. '+error.message;stopFontExport();}}};fontWorker.onerror=()=>{if(fontWorker!==runningWorker)return;$('fontExportStatus').textContent='Font export could not start. Reload the app and try again.';stopFontExport();};fontWorker.postMessage({scope,skeletons:exportSkeletons(),files:scope==='family'?exportFiles():[],settings:{...settings},familyName:exportFamilyName(),version:fontVersionNumber(),fontInfo:fontInfo(),familyOptions:familyOptions(),project:scope==='family'?{drawingRevision:DRAWING_REVISION,appearance:{...appearance},lookSystem:structuredClone(lookSystem),text:texts.tester??'',texts:{hero:texts.hero},tester:{rows:structuredClone(testerRows)},waterfall:structuredClone(waterfall),ui:uiState(),proportionFrame:structuredClone(proportionFrame)}:undefined});}catch(error){$('fontExportStatus').textContent=error.message;stopFontExport();}
});

$('saveProject').addEventListener('click',()=>{download('moduletext-project.json',JSON.stringify(editableProject(),null,2),'application/json');closeMenus();toast('Editable project saved.');});
$('loadProject').addEventListener('change',async()=>{try{const file=$('loadProject').files[0];if(!file)return;if(file.size>25e6)throw Error('Project must be smaller than 25 MB.');const data=JSON.parse(await file.text());if(data.schema!=='module-type.project'||data.version!==1)throw Error('Use an Overdot project file (version 1).');const next=freshSkeletons();for(const [c,g]of Object.entries(data.skeletons||{}))if(GLYPHS[c])next[c]={...GLYPHS[c],paths:validatePaths(g.paths)};const nextAppearance=readAppearance(data.appearance),nextSettings=validateSettings(data.settings),nextFrame=readFrame(data.proportionFrame),nextLooks=readLookSystem(data.lookSystem,nextSettings);skeletons=data.drawingRevision===DRAWING_REVISION?next:refreshDefaultDrawings(next).skeletons;settings=data.drawingRevision===DRAWING_REVISION?nextSettings:refreshInitialSettings(nextSettings,nextLooks);appearance={...MONO,grid:nextAppearance.grid,opacity:nextAppearance.opacity,layered:nextAppearance.opacity<1};lookSystem=nextLooks;selected=null;undo=[];redo=[];restoreUI(data.ui);restoreFamily(data.family);restoreTexts(data);proportionFrame=nextFrame;clearScenes();render();toast('Project opened.');}catch(e){toast(e.message);}finally{$('loadProject').value='';closeMenus();}});
// The sticky section nav marks the section in view; the header's height is measured
// so the hero and the phone nav sit under it.
function setHeaderHeight(){document.documentElement.style.setProperty('--header-h',$('siteHeader').offsetHeight+'px');}
const navLinks=[...$('sectionNav').querySelectorAll('a')],navSections=navLinks.map(a=>$(a.getAttribute('href').slice(1)));
function markSection(){const line=window.innerHeight*.4;let current=null;for(const section of navSections)if(section.getBoundingClientRect().top<=line)current=section;navLinks.forEach(a=>{if(current&&a.getAttribute('href')==='#'+current.id)a.setAttribute('aria-current','true');else a.removeAttribute('aria-current');});}
let navFrame=0;window.addEventListener('scroll',()=>{cancelAnimationFrame(navFrame);navFrame=requestAnimationFrame(markSection);},{passive:true});
setHeaderHeight();syncTextField();render();markSection();
// Packs that fetch their data (the ideographs) redraw the page once they are in.
loadPacks().then(loaded=>{if(!loaded.some(Boolean))return;clearScenes();typeLayouts.clear();render();}).catch(error=>console.warn('A script pack did not load.',error));
if(skeletons[location.hash.slice(1)]&&location.hash.length>1)openEditor(location.hash.slice(1));else if(location.hash==='#editor')openEditor();
const context=document.modelContext;
if(context?.registerTool){const life=new AbortController();for(const tool of [{name:'read_type_system',description:'Read the current Overdot style settings and character set.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>({settings:{...settings},appearance:{...appearance},view,sync:syncEnabled,glyphs:Object.keys(skeletons)})},{name:'configure_type_system',description:'Set the shared typeface controls and update every letter.',inputSchema:{type:'object',properties:Object.fromEntries([...Object.entries(bounds).map(([k,[min,max]])=>[k,{type:'number',minimum:min,maximum:max}]),['shape',{type:'string',enum:Object.keys(shapes)}],['optical',{type:'boolean'}]]),additionalProperties:false},execute:input=>{if(Object.keys(input).some(k=>!Object.keys(DEFAULT).includes(k)))throw Error('Unknown setting.');const next=validateSettings({...settings,...input});if(JSON.stringify(next)!==JSON.stringify(settings))snapshot();for(const k of Object.keys(input))lookSystem=adjustLookSystem(lookSystem,k,next[k]);settings=next;preset='';clearScenes();render();return {settings:{...settings}};}}])try{Promise.resolve(context.registerTool(tool,{signal:life.signal})).catch(()=>{});}catch{}window.addEventListener('pagehide',()=>life.abort(),{once:true});}
