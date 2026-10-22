import {Font,Glyph,Path,parse} from '../vendor/opentype.js';
import {DEFAULT,EDGE,generateGlyph,glyphBounds,pairKerning,spaceAdvance} from './modules.js';
import {inkProfile} from './spacing.js';
import {METRICS} from './skeletons.js';
import {PACKS,packOf} from './scripts/index.js';
import {FAMILY_INSTANCES} from './family.js';
import {sceneContours,moduleCircles} from './outlines.js';
import {fontNames,fontVersion,versionString,readFontInfo} from './font-info.js';
import {positioningTable,substitutionTable,definitionTable,hasSubstitutions} from './font-kerning.js';
import {readTables,writeFont,nameTable,patchHead,patchHhea,cffTable,fingerprint} from './sfnt.js';
function widthClass(width){return width<=75?3:width<100?4:width===100?5:width<125?6:7;}
const STROKE=50;
// One underline and strikeout thickness for every style: font checkers expect a
// family to share it, so it does not follow the weight.
export const underlineThickness=()=>STROKE;
// A glyph with accents above at more than one level (Ấ, Ẫ, Ặ); the two dots of
// the diaeresis are one accent.
export const stacked=g=>new Set(g.paths.filter(p=>p.mark==='above').map(p=>p.stack??0)).size>1;
// Code pages whose letters the font covers: Latin 1 (1252) always, Latin 2
// (1250, Central European), Turkish (1254), Baltic (1257) and Vietnamese (1258).
const CODE_PAGES=[[1,'ĄąĆćČčĎďĘęĚěĹĺĽľŁłŃńŇňŐőŔŕŘřŚśŞşŠšŢţŤťŮůŰűŹźŻżŽž'],[4,'ĞğİıŞş'],[7,'ĀāĄąĒēĖėĘęĢģĪīĮįĶķĻļŅņŌōŖŗŪūŲųŠšŽž'],[8,'ạđơư']];
const codePages=chars=>{const set=new Set(chars);return [...CODE_PAGES,...PACKS.flatMap(p=>p.codePages||[])].reduce((bits,[bit,needed])=>[...needed].every(c=>set.has(c))?bits|1<<bit:bits,1);};
// The characters a skeleton set draws, in code point order.
// Characters and forms (keys such as 'ក.sub', drawn by a script's shaping, with `form`), in code point order; the Latin accents are drawings only.
export function fontEntries(skeletons){const entries=Object.entries(skeletons).filter(([c,g])=>c!==' '&&!g.drawingOnly&&([...c].length===1||g.form)).sort(([a],[b])=>a.codePointAt(0)-b.codePointAt(0)||(a<b?-1:1));if(!entries.length||entries.length>60000)throw Error('Use a nonempty supported character set.');return entries;}
// Glyph names: uniXXXX for a character; a form keeps its suffix (uni1780.sub).
export function packNotices(entries){const used=new Set(entries.map(([c])=>c&&packOf(c)?.id));return PACKS.filter(p=>p.notice&&used.has(p.id)).map(p=>p.notice);}
export function glyphName(key){const dot=key.indexOf('.'),chars=[...(dot>0?key.slice(0,dot):key)];return chars.map(c=>'uni'+c.codePointAt(0).toString(16).toUpperCase().padStart(4,'0')).join('_')+(dot>0?key.slice(dot):'');}
// Line spacing (typo and hhea metrics) holds every glyph with at most one
// accent above, capitals included; capitals with stacked accents (Ấ, Ẫ, Ặ) rise
// above it. The Windows clipping box (win metrics) holds every glyph. Both come
// from the ink of the generated glyphs of all the given styles, with room for
// outline rounding.
export function lineMetrics(styles){let ascender=METRICS.ascender,descender=METRICS.descender,top=ascender,bottom=-descender;
 for(const {entries,scenes}of styles)entries.forEach(([,g],i)=>{const {bounds}=scenes[i];if(!(bounds.maxY>=bounds.minY))return;const up=Math.ceil(METRICS.baseline-bounds.minY+21),down=Math.floor(METRICS.baseline-bounds.maxY-21);top=Math.max(top,up);bottom=Math.max(bottom,-down);if(!stacked(g)){ascender=Math.max(ascender,up);descender=Math.min(descender,down);}});
 return {ascender,descender,winAscent:Math.max(top,ascender),winDescent:Math.max(bottom,-descender)};}
// A style exported on its own takes the line metrics of its family (the nine
// styles of the same look), so styles exported one at a time share line
// spacing. Only glyphs that can set those metrics are generated in the nine
// styles: those within 50 units of this style's highest and lowest ink, and
// those this style draws lighter (they may stand taller in another style).
// The style's own glyphs are always held.
function familyLineMetrics(entries,scenes,settings){
 const all=entries.map((_,i)=>i),plain=all.filter(i=>!stacked(entries[i][1])),top=list=>Math.min(...list.map(i=>scenes[i].bounds.minY)),bottom=list=>Math.max(...list.map(i=>scenes[i].bounds.maxY));
 const limits=[[plain,top(plain),bottom(plain)],[all,top(all),bottom(all)]],near=i=>limits.some(([list,t,b])=>list.includes(i)&&(scenes[i].bounds.minY<=t+50||scenes[i].bounds.maxY>=b-50));
 const picked=all.filter(i=>near(i)||scenes[i].radius<scenes[i].baseRadius-1e-9).map(i=>entries[i]);
 return lineMetrics([{entries,scenes},...FAMILY_INSTANCES.map(({weight,width})=>({entries:picked,scenes:picked.map(([,g])=>({bounds:glyphBounds(g,{...settings,weight,width})}))}))]);}
// The union of modules is a polygon on the integer grid whose runs of points
// follow module circles. A run of four or more edges on one circle is written
// as cubic arcs, split where the circle turns through a quadrant, so outlines
// are smoother and smaller. On-curve points stay on the integer grid and every
// control point stays within its arc's end points, so a glyph's bounds are those
// of its points. A contour that is a whole circle (a lone dot) takes four arcs.
const ARC_TOLERANCE=1;
function fitArcs(contour,circles){const n=contour.length;if(n<5)return contour;
 let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(const [x,y]of contour){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}
 const near=circles.filter(([X,Y,R])=>R>=6&&X+R+1>=x0&&X-R-1<=x1&&Y+R+1>=y0&&Y-R-1<=y1);if(!near.length)return contour;
 const on=contour.map(([x,y])=>near.flatMap(([X,Y,R],k)=>Math.abs(Math.hypot(x-X,y-Y)-R)<=ARC_TOLERANCE?[k]:[]));
 // Circles an edge follows: both ends on the circle, its middle no further out than the circle and no further in than the chord.
 const follows=Array.from({length:n},(_,i)=>{const a=contour[i],b=contour[(i+1)%n];return on[i].filter(k=>{if(!on[(i+1)%n].includes(k))return false;const [X,Y,R]=near[k],h=Math.hypot(b[0]-a[0],b[1]-a[1])/2;if(h>.95*R)return false;const d=Math.hypot((a[0]+b[0])/2-X,(a[1]+b[1])/2-Y)-R;return d<=ARC_TOLERANCE&&d>=-(R-Math.sqrt(R*R-h*h))-ARC_TOLERANCE;});});
 const shared=(a,b)=>a.filter(k=>b.includes(k));let start=-1;for(let i=0;i<n;i++)if(!shared(follows[(i+n-1)%n],follows[i]).length){start=i;break;}
 const quarter=Math.PI/2,round=p=>p.map(Math.round),steps=[];
 const arc=(X,Y,R,pts,sweep)=>{const dir=Math.sign(sweep),a0=Math.atan2(pts[0][1]-Y,pts[0][0]-X),cuts=[a0];for(let q=dir>0?Math.floor((a0+.05)/quarter)+1:Math.ceil((a0-.05)/quarter)-1;dir>0?q*quarter<a0+sweep-.05:q*quarter>a0+sweep+.05;q+=dir)cuts.push(q*quarter);cuts.push(a0+sweep);
  const P=cuts.map((a,c)=>c===0?pts[0]:c===cuts.length-1?pts.at(-1):round([X+R*Math.cos(a),Y+R*Math.sin(a)])),tangent=a=>[-Math.sin(a)*dir,Math.cos(a)*dir],within=(v,u,w)=>Math.min(Math.max(u,w),Math.max(Math.min(u,w),Math.round(v)));
  return cuts.slice(1).map((b,c)=>{const p0=P[c],p3=P[c+1],a=c===0?a0:cuts[c],end=c===cuts.length-2?b+Math.atan2(Math.sin(Math.atan2(p3[1]-Y,p3[0]-X)-b),Math.cos(Math.atan2(p3[1]-Y,p3[0]-X)-b)):b,h=4/3*Math.tan(Math.abs(end-a)/4)*R,t0=tangent(a),t1=tangent(end);
   return [[0,1].map(d=>within(p0[d]+h*t0[d],p0[d],p3[d])),[0,1].map(d=>within(p3[d]-h*t1[d],p0[d],p3[d])),p3];});};
 const sweepOf=(X,Y,pts)=>{let total=0;for(let q=1;q<pts.length;q++){let d=Math.atan2(pts[q][1]-Y,pts[q][0]-X)-Math.atan2(pts[q-1][1]-Y,pts[q-1][0]-X);if(d>Math.PI)d-=2*Math.PI;if(d<-Math.PI)d+=2*Math.PI;total+=d;}return total;};
 if(start<0){const common=follows.reduce(shared);if(!common.length)return contour;const [X,Y,R]=near[common[0]],sweep=sweepOf(X,Y,[...contour,contour[0]]);if(Math.abs(Math.abs(sweep)-2*Math.PI)>.1)return contour;
  const p=round([X+R,Y]);return arc(X,Y,R,[p,p],Math.sign(sweep)*2*Math.PI);}
 for(let i=0;i<n;){let set=follows[(start+i)%n],j=i+1;while(j<n){const next=shared(set,follows[(start+j)%n]);if(!next.length)break;set=next;j++;}
  const pts=[];for(let q=i;q<=j;q++)pts.push(contour[(start+q)%n]);
  if(set.length&&j-i>=4){let best=null;for(const k of set){const [X,Y,R]=near[k],error=Math.max(...pts.map(([x,y])=>Math.abs(Math.hypot(x-X,y-Y)-R)));if(!best||error<best.error)best={k,error};}
   const [X,Y,R]=near[best.k],sweep=sweepOf(X,Y,pts),curves=arc(X,Y,R,pts,sweep);if(6*curves.length+2<2*(j-i)){steps.push(...curves);i=j;continue;}}
  for(let q=i+1;q<=j;q++)steps.push(contour[(start+q)%n]);i=j;}
 return steps;}
function glyphContours(scene){const circles=scene.modules.flatMap(m=>moduleCircles(m).map(([x,y,r])=>[x+scene.offsetX,METRICS.baseline-y,r]));return sceneContours(scene,{fontCoordinates:true}).map(c=>fitArcs(c,circles));}
// Alternates reached through OpenType features. Tabular figures (tnum) share
// the advance of the 0, which sets the colour of a column of figures; each is
// centred on that advance, so its side bearings keep their balance, and none
// of them is kerned. A figure whose ink would leave less than 0.75 of the H–H
// gap in a column (the 4) is compressed to leave 0.8 of it, as drawn tabular
// fours are narrower. Currency signs take the same width; the point, comma and
// colon take half of it, so sums align without the point floating in a
// figure-wide cell. Superiors (sups) and ordinals (ordn) map to the drawn
// superior figures and ordinal letters, and fractions (frac) to the drawn
// ¼ ½ ¾ through a ligature of figure, solidus and figure. Case forms (case)
// move punctuation that centres on the x-height or hangs around it (dashes,
// brackets, guillemets, @) to the middle of the capitals.
const FIGURES='0123456789',TABULAR='$€£¥',TABULAR_HALF='.,:',CASE='-‐–—()[]{}«»‹›@·¡¿',SUPERIORS=[['0','⁰'],['1','¹'],['2','²'],['3','³'],['4','⁴'],['5','⁵'],['6','⁶'],['7','⁷'],['8','⁸'],['9','⁹']],ORDINALS=[['a','ª'],['o','º']],FRACTIONS=[['1/4','¼'],['1/2','½'],['3/4','¾']];
// A drawing compressed horizontally about its centre by k; the stroke keeps its weight.
const squeeze=(g,k)=>{const c=g.width/2;return {...g,paths:g.paths.map(p=>({...p,points:p.points.map(([x,y])=>[c+(x-c)*k,y])}))};};
const moveContours=(contours,dx,dy)=>contours.map(c=>c.map(step=>Array.isArray(step[0])?step.map(([x,y])=>[x+dx,y+dy]):[step[0]+dx,step[1]+dy]));
function contourBox(contours){let x1=Infinity,y1=Infinity,x2=-Infinity,y2=-Infinity;for(const c of contours)for(const step of c)for(const [x,y]of Array.isArray(step[0])?step:[step]){if(x<x1)x1=x;if(x>x2)x2=x;if(y<y1)y1=y;if(y>y2)y2=y;}return {x1,y1,x2,y2};}
function raisedScene(scene,dy){const modules=scene.modules.map(m=>({...m,y:m.y-dy})),moved={...scene,modules,bounds:{...scene.bounds,minY:scene.bounds.minY-dy,maxY:scene.bounds.maxY-dy}};moved.profile=inkProfile(moved);return moved;}
// `packs` are the script packs the font is built with (the registered packs by default; tests pass fixtures).
export function compileOTF(skeletons,inputSettings,{familyName='Overdot',version=1,fontInfo,onProgress=()=>{},verticalMetrics,scenes,packs=PACKS}={}){
 const settings={...DEFAULT,...inputSettings},entries=fontEntries(skeletons);scenes??=entries.map(([,g])=>generateGlyph(g,settings));
 // The pack a key belongs to, by code point ranges (a form key such as 'ក.sub' follows its first character).
 const ranges=packs.flatMap(p=>(p.ranges||[]).map(r=>[r,p])),packFor=c=>{const cp=c.codePointAt(0);for(const [[a,b],p]of ranges)if(cp>=a&&cp<=b)return p;return null;};
 const names=fontNames(familyName,settings),revision=fontVersion(version),info=readFontInfo(fontInfo),space=spaceAdvance(settings);
 // A pack whose data carries its own terms (the ideograph stroke data) adds its attribution to the licence record when its glyphs are in the font.
 const notices=packNotices(entries);if(notices.length)info.license=[info.license,...notices].filter(Boolean).join(' ').slice(0,1000);
 // The space glyph also serves the no-break space.
 // The no-break space shares the space. The soft hyphen is left to text
 // software, which hides it or draws a hyphen, as font validators advise.
 const records=[{name:'.notdef',advance:600,contours:[[[70,0],[70,700],[530,700],[530,0]],[[135,65],[465,65],[465,635],[135,635]]]},{name:'space',unicodes:[32,0xa0],advance:space,contours:[]}],boxes={},index=new Map();
 // A combining mark takes no advance. Its outline is moved left by its script's `markShift`, so
 // it still lands over the glyph before it where mark positioning is not applied; its anchors
 // (font units, baseline at 0) are kept on the record for the positioning tables.
 const fontAnchor=(scene,[x,y],shift)=>[Math.round(x+scene.offsetX-shift),Math.round(METRICS.baseline-y)];
 for(let i=0;i<entries.length;i++){const [c,g]=entries[i],scene=scenes[i],mark=scene.markType,shift=mark?packFor(c)?.markShift||0:0,contours=shift?moveContours(glyphContours(scene),-shift,0):glyphContours(scene);if(!contours.length)throw Error('No outline for '+c+'.');index.set(c,records.length);const anchors=Object.fromEntries(Object.entries(scene.anchors||{}).map(([k,a])=>[k,fontAnchor(scene,a,shift)]));records.push({name:glyphName(c),...(g.form?{}:{unicodes:[c.codePointAt(0)]}),advance:mark?0:Math.round(scene.advance),contours,scene,stacked:stacked(g),mark,anchors,key:c});boxes[c]=contourBox(contours);onProgress({completed:i+1,total:entries.length,character:c});}
 const {H,x}=boxes,features=[{tag:'tnum',pairs:[]},{tag:'case',pairs:[]},{tag:'sups',pairs:[]},{tag:'ordn',pairs:[]},{tag:'frac',ligatures:[]}],digits=[...FIGURES].filter(c=>index.has(c)),tabular=index.has('0')?records[index.get('0')].advance:Math.max(0,...digits.map(c=>records[index.get(c)].advance)),capMiddle=H?(H.y1+H.y2)/2:METRICS.capHeight/2;
 const stemGap=index.has('H')?records[index.get('H')].scene.leftBearing+records[index.get('H')].scene.rightBearing:72;
 for(const [chars,width]of [[FIGURES+TABULAR,tabular],[TABULAR_HALF,Math.round(tabular/2)]])for(const c of chars){if(!index.has(c))continue;const base=records[index.get(c)];let scene=base.scene,contours=base.contours,box=boxes[c];const advance=base.advance;
  // Too wide for its cell: the drawing is compressed until its ink leaves 0.8 of the stem gap (a few passes, as the ends of bars and bowls do not scale with the centreline).
  const room=width-.8*stemGap;let squeezed=false;if(box.x2-box.x1>width-.75*stemGap)for(let k=1,ink=box.x2-box.x1,pass=0;Math.abs(ink-room)>3&&pass<4;pass++){const reach=2*scene.radius*(EDGE[settings.shape]||1);k*=Math.max(.5,(room-reach)/Math.max(1,ink-reach));scene=generateGlyph(squeeze(skeletons[c],k),settings);contours=glyphContours(scene);box=contourBox(contours);ink=box.x2-box.x1;squeezed=true;}
  // A compressed glyph centres its ink in the cell; the others keep their own bearings, centred on the cell.
  features[0].pairs.push([index.get(c),records.length]);records.push({name:base.name+'.tnum',advance:width,contours:moveContours(contours,Math.round(squeezed?(width-(box.x2-box.x1))/2-box.x1:(width-advance)/2),0)});}
 for(const [from,to]of SUPERIORS)if(index.has(from)&&index.has(to))features[2].pairs.push([index.get(from),index.get(to)]);
 for(const [from,to]of ORDINALS)if(index.has(from)&&index.has(to))features[3].pairs.push([index.get(from),index.get(to)]);
 for(const [from,to]of FRACTIONS)if([...from].every(c=>index.has(c))&&index.has(to))features[4].ligatures.push([[...from].map(c=>index.get(c)),index.get(to)]);
 for(const c of CASE){if(!index.has(c))continue;const base=records[index.get(c)],box=boxes[c],dy=Math.round(capMiddle-(box.y1+box.y2)/2);if(Math.abs(dy)<10)continue;features[1].pairs.push([index.get(c),records.length]);records.push({name:base.name+'.case',advance:base.advance,contours:moveContours(base.contours,0,dy),scene:raisedScene(base.scene,dy)});}
 // Each script pack adds its shaping features (Khmer subscript ligatures, two-part vowels); a
 // feature may name the script it serves. Features without entries are dropped by the writer.
 for(const pack of packs)for(const f of pack.features?.({index,records})||[])if(f&&f.tag)features.push(f);
 // Script tags of the packs with glyphs in the font, for the layout tables' script lists.
 const scriptTags=[...new Set(packs.filter(p=>/^[A-Za-z][A-Za-z0-9 ]{3}$/.test(p.script||'')&&records.some(r=>r.key&&packFor(r.key)===p)).map(p=>p.script))];
 // Mark positioning: every combining mark attaches to the `above` or `below` anchor of the
 // letters of the scripts with marks (and their forms), and to the previous mark of a stack.
 const marks=records.flatMap((r,i)=>r.mark&&r.anchors?.mark?[{id:i,class:r.mark,anchor:r.anchors.mark,above:r.anchors.above,below:r.anchors.below}]:[]);
 // Latin letters become bases too once the font carries combining Latin marks (U+0300…).
 const latinMarks=marks.some(m=>!packFor(records[m.id].key));
 const bases=records.flatMap((r,i)=>!r.mark&&r.key&&r.contours.length&&(packFor(r.key)?.marks||(latinMarks&&!packFor(r.key)))?[{id:i,above:r.anchors.above,below:r.anchors.below}]:[]),attached=marks.length&&bases.length;
 // Glyph classes for GDEF: marks (3), the outputs of ligatures (2), every other drawn glyph (1); marks also take their attachment class (above 1, below 2).
 const ligated=new Set(features.flatMap(f=>(f.ligatures||[]).map(([,to])=>to))),glyphClasses=new Map(records.flatMap((r,i)=>r.mark?[[i,3]]:ligated.has(i)?[[i,2]]:r.contours.length?[[i,1]]:[])),attachClasses=new Map(marks.map(m=>[m.id,m.class==='below'?2:1]));
 for(const r of records)r.box=r.contours.length?contourBox(r.contours):null;
 // Font-wide bounds and side bearings come from the final outlines of every glyph.
 const bounds={xMin:Infinity,yMin:Infinity,xMax:-Infinity,yMax:-Infinity},sides={advanceWidthMax:0,minLeftSideBearing:Infinity,minRightSideBearing:Infinity,xMaxExtent:-Infinity};
 for(const {box,advance}of records){sides.advanceWidthMax=Math.max(sides.advanceWidthMax,advance);if(!box)continue;bounds.xMin=Math.min(bounds.xMin,box.x1);bounds.yMin=Math.min(bounds.yMin,box.y1);bounds.xMax=Math.max(bounds.xMax,box.x2);bounds.yMax=Math.max(bounds.yMax,box.y2);sides.minLeftSideBearing=Math.min(sides.minLeftSideBearing,box.x1);sides.minRightSideBearing=Math.min(sides.minRightSideBearing,advance-box.x2);sides.xMaxExtent=Math.max(sides.xMaxExtent,box.x2);}
 const linkedBold=settings.width===100&&settings.weight===700;
 const {ascender,descender,winAscent,winDescent}=verticalMetrics||familyLineMetrics(entries,scenes,settings);
 let lineTop=-Infinity,lineBottom=Infinity;for(const r of records)if(r.box&&!r.stacked){lineTop=Math.max(lineTop,r.box.y2);lineBottom=Math.min(lineBottom,r.box.y1);}
 if(![ascender,descender,winAscent,winDescent].every(Number.isInteger)||ascender<Math.max(METRICS.ascender,lineTop)||descender>Math.min(METRICS.descender,lineBottom)||winAscent<Math.max(ascender,bounds.yMax)||winDescent<Math.max(-descender,-bounds.yMin)||winAscent>65535||winDescent>65535||descender< -32768)throw Error('Vertical font metrics do not contain every outline.');
 // Kerning covers the drawn glyphs and the case forms; tabular figures keep their advance.
 // Pairs are kerned within a script (Latin with Latin, Thai with Thai): letters of different scripts meet rarely and keep their own fit.
 const kerned=records.flatMap((r,i)=>r.scene&&!r.scene.fixed&&!r.mark?[[i,r.scene,(r.key&&packOf(r.key)?.id)||'latin']]:[]),pairs=[];for(const [a,left,sa]of kerned)for(const [b,right,sb]of kerned){if(sa!==sb)continue;const value=pairKerning(left,right,settings);if(value)pairs.push([a,b,value]);}
 // Heights describe the ink of H and x. Modules extend below the baseline, so
 // the underline sits under that overhang; the strikeout crosses the x-height.
 const stroke=underlineThickness(settings),underline=Math.max(descender+stroke,Math.min(-stroke,Math.round(H?H.y1:0)-30)),strikeout=Math.round(x?(x.y1+x.y2+stroke)/2:METRICS.xHeight/2+stroke/2);
 const description='Overdot typeface: '+settings.shape+' modules, weight '+settings.weight+', width '+settings.width+'%.';
 // The outline writer builds the other tables; outlines and names are written below.
 const glyphs=records.map(r=>new Glyph({name:r.name,...(r.unicodes?{unicode:r.unicodes[0],unicodes:r.unicodes}:{}),advanceWidth:r.advance,leftSideBearing:r.box?r.box.x1:0,path:new Path()}));
 const font=new Font({familyName:names.familyName,styleName:names.styleName,unitsPerEm:METRICS.unitsPerEm,ascender,descender,glyphs,weightClass:linkedBold?700:400,fsSelection:(linkedBold?32:64)|128,widthClass:widthClass(settings.width),version:versionString(revision),description,tables:{os2:{usWeightClass:Math.round(settings.weight),fsType:0,sTypoAscender:ascender,sTypoDescender:descender,sTypoLineGap:0,usWinAscent:winAscent,usWinDescent:winDescent,usDefaultChar:0,sxHeight:Math.round(x?x.y2:METRICS.xHeight),sCapHeight:Math.round(H?H.y2:METRICS.capHeight),yStrikeoutSize:stroke,yStrikeoutPosition:strikeout,achVendID:(info.vendorID||'NONE').padEnd(4),ulCodePageRange1:codePages(entries.map(([c])=>c)),ulCodePageRange2:0,usMaxContext:Math.max(pairs.length?2:0,attached?2:0,features.some(f=>f.pairs?.length||f.sequences?.length)?1:0,...features.flatMap(f=>(f.ligatures||[]).map(([parts])=>parts.length)))},post:{underlinePosition:underline,underlineThickness:stroke}}});
 for(const platform of ['unicode','macintosh','windows'])Object.assign(font.names[platform],{fontFamily:{en:names.legacyFamily},fontSubfamily:{en:names.legacyStyle},preferredFamily:{en:names.familyName},preferredSubfamily:{en:names.styleName},fullName:{en:names.fullName},postScriptName:{en:names.postScriptName}});
 const tables=readTables(font.toArrayBuffer()),vendor=info.vendorID||'NONE';
 const cff=cffTable({fontName:names.postScriptName,version:revision.toFixed(3),fullName:names.fullName,familyName:names.legacyFamily,weight:names.legacyStyle,bbox:[bounds.xMin,bounds.yMin,bounds.xMax,bounds.yMax],glyphs:records.map(r=>({name:r.name,width:r.advance,contours:r.contours}))});
 // Version, PostScript name and an outline fingerprint make every export distinct.
 const uniqueID=[revision.toFixed(3),vendor,names.postScriptName,fingerprint(cff)].join(';');
 // OS/2 version 4 defines the use-typo-metrics flag set above; its layout matches version 3.
 const os2=tables.get('OS/2'),os2View=new DataView(os2.buffer,os2.byteOffset,os2.byteLength);os2View.setUint16(0,4);os2View.setInt16(2,Math.round(records.reduce((n,r)=>n+r.advance,0)/records.length));
 tables.delete('ltag');tables.set('name',nameTable([[0,info.copyright],[1,names.legacyFamily],[2,names.legacyStyle],[3,uniqueID],[4,names.fullName],[5,versionString(revision)],[6,names.postScriptName],[8,info.manufacturer],[9,info.designer],[10,description],[11,info.website],[13,info.license],[14,info.licenseURL],[16,names.familyName],[17,names.styleName]]));
 const gpos=positioningTable({pairs,marks:attached?marks:[],bases:attached?bases:[],scripts:scriptTags}),gsub=substitutionTable(features,scriptTags);if(gpos)tables.set('GPOS',gpos);if(gsub)tables.set('GSUB',gsub);
 if(marks.length)tables.set('GDEF',definitionTable({classes:glyphClasses,attachClasses}));
 patchHead(tables.get('head'),{fontRevision:revision,bounds});patchHhea(tables.get('hhea'),sides);tables.set('CFF ',cff);
 const buffer=writeFont(tables),checked=parse(buffer);
 if(checked.glyphs.length!==records.length||entries.some(([c,g])=>!g.form&&!checked.hasChar(c))||checked.charToGlyphIndex('\u00a0')!==1)throw Error('Font validation failed.');
 return {buffer,fileName:names.fileName,familyName:names.familyName,styleName:names.styleName,postScriptName:names.postScriptName,version:revision,glyphCount:records.length,characterCount:entries.filter(([,g])=>!g.form).length+1,ascender,descender,winAscent,winDescent,kerningPairCount:pairs.length,markCount:attached?marks.length:0,features:[...new Set([...features.filter(hasSubstitutions).map(f=>f.tag),...(attached?['mark','mkmk']:[])])]};
}
