import {METRICS,AXES,glyphOf} from './skeletons.js';
import {shapeText,isFixedScript} from './scripts/index.js';
import {readAppearance,inkModuleSVG,surfaceSVG} from './ink.js';
import {glyphSpacing,inkProfile,pairKerning,spaceAdvance} from './spacing.js';
export {pairKerning,spaceAdvance} from './spacing.js';
export const DEFAULT={weight:500,width:100,size:64,density:1,overlap:0,roundness:65,shape:'circle',tracking:10,optical:true};
export const PRESETS=[
{id:'layered',name:'01 / Circle layers',note:'Big translucent circles; intersections build darker ink',shape:'circle',weight:500,width:100,size:144,density:.72,overlap:28,roundness:100,featured:true},
{id:'point',name:'02 / Point',note:'Separated circular modules',shape:'circle',weight:450,width:100,size:52,density:1.05,overlap:0,roundness:100},
{id:'soft',name:'03 / Soft grid',note:'Rounded pixel rhythm',shape:'rounded',weight:650,width:95,size:76,density:1.1,overlap:12,roundness:42},
{id:'ink',name:'04 / Ink trap',note:'Overlapping perforated circles',shape:'ring',weight:780,width:105,size:88,density:1,overlap:28,roundness:100},
{id:'diamond',name:'05 / Diamond',note:'Angular modules, round skeleton',shape:'diamond',weight:500,width:105,size:69,density:.95,overlap:0,roundness:0},
{id:'organic',name:'06 / Organic',note:'Joined, lobed modules',shape:'blob',weight:720,width:110,size:75,density:1.1,overlap:30,roundness:100},
{id:'echo',name:'07 / Echo',note:'Concentric directional arcs',shape:'arc',weight:500,width:110,size:110,density:.86,overlap:20,roundness:100},
];
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// Ink reach of each module shape beyond its radius.
export const EDGE={diamond:1.2,blob:1.07,arc:1.06};
const radiusAt=(s,w)=>s.size/2*(.72+.75*w)*(1+s.overlap/180);
// Skeleton zones (SVG y down): cap/ascender, x-height, baseline, descender.
const ZONE={top:180,x:400,base:880,desc:1080},REFERENCE_WEIGHT=.6,DESCENT=1.25;
// The box zone holds the full-em scripts (ideographs, kana, Hangul): their centrelines run
// from 125 to 950, so their Bold ink spans about 50 to 950, a fifth taller than the capitals.
export const BOX={top:125,base:950};
const zoneLines=zone=>zone==='box'?{top:BOX.top,base:BOX.base}:{top:zone==='cap'?ZONE.top:ZONE.x,base:ZONE.base};
// Ink sits on the baseline and keeps the Bold cap and x-heights at every weight:
// heavier modules move the centreline inward instead of growing past the zones.
function verticalMap(zone,r,R){
 const {top:bodyTop,base}=zoneLines(zone),height=base-bodyTop,k=(height+2*R-2*r)/height;
 const map=y=>y>base?base-r+(y-base)*DESCENT:y<bodyTop?y-2*R+r:base-r-(base-y)*k;
 const inverse=v=>v>base-r?base+(v-base+r)/DESCENT:v<bodyTop-2*R+r?v+2*R-r:base-(base-r-v)/k;
 return {map,inverse};
}
// How much a drawing widens as weight grows, in multiples of the added radius.
// Scanlines through its body find counters (white inside one connected shape,
// widened by part of the added weight) and gaps between separate marks (the
// dots of the ellipsis, the strokes of quotes), widened by all of it so the
// space between them stays the same. The value most scanlines reach counts,
// so the small wedges at joins do not.
function widthGrowth(glyph){return drawingFacts(glyph).growth;}
function measureGrowth(glyph){
 const paths=glyph.paths.filter(p=>!p.optional&&!p.mark&&!p.attach),lines=paths.map(p=>{const ps=outlineOf(p);return p.closed&&p.kind==='poly'?ps.concat([ps[0]]):ps;}),dot=ps=>ps.every(q=>Math.hypot(q[0]-ps[0][0],q[1]-ps[0][1])<1);
 const parent=lines.map((_,i)=>i),find=i=>parent[i]===i?i:(parent[i]=find(parent[i])),near=(A,B)=>A.some(p=>B.some((q,j)=>j>0?segmentDistance({x:p[0],y:p[1]},{x:B[j-1][0],y:B[j-1][1]},{x:q[0],y:q[1]})<30:B.length===1&&Math.hypot(p[0]-q[0],p[1]-q[1])<30))||A.some((p,i)=>i>0&&B.some((q,j)=>j>0&&crossing(A[i-1],p,B[j-1],q)));
 for(let i=0;i<lines.length;i++)for(let j=i+1;j<lines.length;j++)if(near(lines[i],lines[j])||near(lines[j],lines[i]))parent[find(i)]=find(j);
 const ys=lines.flat().map(q=>q[1]),lo=Math.min(...ys),hi=Math.max(...ys),values=[];
 for(let k=0;k<=20;k++){const y=hi-lo<1?lo:lo+(hi-lo)*(.1+.04*k)+.5,xs=[];
  lines.forEach((ps,i)=>{if(dot(ps)){if(Math.abs(ps[0][1]-y)<40)xs.push([ps[0][0],find(i)]);return;}for(let j=1;j<ps.length;j++){const [a,b]=[ps[j-1],ps[j]];if((a[1]<=y)!==(b[1]<=y))xs.push([a[0]+(y-a[1])/(b[1]-a[1])*(b[0]-a[0]),find(i)]);}});
  // Flat marks (~) have no counters to keep.
  xs.sort((a,b)=>a[0]-b[0]);const columns=xs.filter((x,i)=>i===0||x[0]-xs[i-1][0]>40);let v=0;for(let i=1;i<columns.length;i++)v+=columns[i][1]!==columns[i-1][1]?2:hi-lo<200?0:.9;values.push(v);}
 values.sort((a,b)=>b-a);const xs=lines.flat().map(q=>q[0]),wide=Math.max(...xs)-Math.min(...xs)>280,v=values[Math.floor(values.length*.35)];
 // Open round letters (c, s, 2) widen like o.
 return Math.min(4,glyph.round&&wide&&v<.9&&hi-lo>300?.9:v);
}
// Accents keep a fixed white gap from the letter at every weight, so heavier
// accents grow away from it. Capitals, and accents over an ascender (ĺ ĥ), take
// a smaller gap. A stacked tone starts where the Vietnamese convention puts it
// against the modifier under it (nested into the breve's cup, beside the
// circumflex with its bottom below the apex, the tilde on top) and rises until
// it keeps its floor of white from that modifier: 0.6 of the gap over it, 0.7
// (at least 26) beside it; the modifier itself never moves. A dot below sits
// 56 under the baseline on both cases (a comma below one gap); beside a
// descender (ỵ) it moves right until it keeps one gap from it. The separate parts of one accent
// (the dots of the diaeresis, the strokes of the double acute) keep that gap
// between them, and a ring keeps its counter, so heavier dots never merge.
// Attached accents (cedilla, ogonek) hang from the letter's lowest stroke where
// they are drawn. The comma beside an ascender (ď ľ ť Ľ) stands one gap right
// of it, at the ascender's height. The bar of đ, ð and ħ crosses the ascender
// centred between the bowl's ink top and the original top of the stem, lifted
// until 1.2 module radii of stem show above its ink, and reaches past the stem
// by about one gap on its short side. Accents above and below follow the
// letter's width in full (a mark on i is as wide as on a); attached accents
// take the square root of the style's width. Gaps are measured on the
// centrelines with the ink radius each module gets there (mark scale, taper
// down to the look's floor, thinner horizontals, the corners of square
// modules).
function placeMarks(paths,r,R,zone,{scaleX=1,wd=1,weight=REFERENCE_WEIGHT,optical=true,shape='circle',roundness=100,tip=TAPER_MIN}={}){
 const marks=paths.filter(p=>p.mark);if(!marks.length)return;
 const gap=Math.max(30,.5*R)*(zone==='cap'?.75:1),of=(side,level)=>marks.filter(p=>p.mark===side&&(p.stack??0)===level);
 const thinning=horizontalThinning(weight,wd),thin=(dx,dy)=>optical?1-thinning*Math.abs(Math.cos(Math.atan2(dy,dx))):1;
 const samples=group=>{const out=[];for(const p of group){const ps=outlineOf(p),line=p.closed&&p.kind==='poly'?ps.concat([ps[0]]):ps,size=p.mark?Math.max(.3,Math.min(1,p.scale||1)):1;
   if(line.every(q=>q[0]===line[0][0]&&q[1]===line[0][1])){out.push([line[0][0],line[0][1],r*size]);continue;}
   const cum=lengths(line),total=cum.at(-1);
   for(let i=1;i<line.length;i++){const [a,b]=[line[i-1],line[i]],n=Math.max(1,Math.ceil((cum[i]-cum[i-1])/8)),k=r*size*thin(b[0]-a[0],b[1]-a[1]);
    for(let j=i===1?0:1;j<=n;j++){const t=(cum[i-1]+(cum[i]-cum[i-1])*j/n)/total;out.push([a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n,p.taper?Math.max(r*Math.min(size,tip),k*(1-.45*(p.taper==='start'?1-t:t))):k]);}}}
  return out;};
 const ink=group=>{let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(const [x,y,k]of samples(group)){x0=Math.min(x0,x-k);x1=Math.max(x1,x+k);y0=Math.min(y0,y-k);y1=Math.max(y1,y+k);}return {x0,y0,x1,y1};};
 // Square modules reach further along diagonals.
 const corner=shape==='square'?Math.SQRT2:shape==='rounded'?Math.SQRT2-(Math.SQRT2-1)*roundness/100:1;
 // Clearance of sampled group a moved by (dx,dy) from sampled group b; groups are
 // sampled once and moved, as moving a drawing moves its samples.
 const clearance=(a,b,dx=0,dy=0,reach=corner)=>{let d=Infinity;for(const p of a)for(const q of b)d=Math.min(d,Math.hypot(p[0]+dx-q[0],p[1]+dy-q[1])-(p[2]+q[2])*reach);return d;};
 // Each mark records its placement, x' = a·x + b and y' = d·y + c, for the editor.
 const placed=p=>p.place??=[1,0,0,1];
 const shift=(group,dx,dy)=>{for(const p of group){const t=placed(p);p.points=p.points.map(([x,y])=>[x+dx,y+dy]);t[1]+=dx;t[2]+=dy;}};
 const stretch=(group,cx,k)=>{for(const p of group){const t=placed(p);p.points=p.points.map(([x,y])=>[cx+(x-cx)*k,y]);t[0]*=k;t[1]=cx+(t[1]-cx)*k;}};
 const stretchY=(group,cy,k)=>{for(const p of group){const t=placed(p);p.points=p.points.map(([x,y])=>[x,cy+(y-cy)*k]);t[3]*=k;t[2]=cy+(t[2]-cy)*k;}};
 const top=(zone==='cap'?ZONE.top:ZONE.x)-2*R,first=of('above',0),stacked=of('above',1),side=of('above','side'),below=of('below',0),attached=marks.filter(p=>p.mark==='attach'),right=marks.filter(p=>p.mark==='right'),bar=marks.filter(p=>p.mark==='bar'),above=[...first,...stacked,...side];
 marks.forEach(placed);
 const letter=samples(paths.filter(p=>!p.mark)),k=(Math.sqrt(wd)+scaleX-wd)/scaleX;
 // Separate parts of one accent keep the gap between them, centred where they
 // were drawn.
 for(const group of [first,stacked,below]){if(group.length<2)continue;const parts=group.map(p=>({p,s:samples([p])})).sort((a,b)=>Math.min(...a.s.map(q=>q[0]))-Math.min(...b.s.map(q=>q[0])));
  if(parts.some((q,i)=>i&&Math.min(...q.p.points.map(t=>t[0]))<=Math.max(...parts[i-1].p.points.map(t=>t[0]))))continue;
  const white=gap,was=ink(group);for(let i=1;i<parts.length;i++){let dx=0;for(let n=0;n<30;n++){const d=clearance(parts[i].s,parts[i-1].s,dx);if(Math.abs(d-white)<.25)break;dx+=white-d;}shift(parts.slice(i).map(q=>q.p),dx,0);for(const q of parts.slice(i))q.s=samples([q.p]);}
  const now=ink(group);shift(group,(was.x0+was.x1)/2-(now.x0+now.x1)/2,0);}
 // A closed accent (the ring) is round, and grows where its modules would close
 // its counter, which stays at least as wide as most of a gap and about half a
 // module (a little less on capitals, whose lighter ring stays low).
 for(const p of above.filter(p=>p.closed)){const size=Math.max(.3,Math.min(1,p.scale||1)),xs=p.points.map(q=>q[0]),ys=p.points.map(q=>q[1]),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys),radius=Math.max(Math.min(x1-x0,y1-y0)/2,r*size+Math.max(.8*gap,(zone==='cap'?.45:.5)*r)/2);
  if(x1>x0)stretch([p],(x0+x1)/2,2*radius/(x1-x0));if(y1>y0)stretchY([p],(y0+y1)/2,2*radius/(y1-y0));}
 // Accents above clear the letter itself where it rises past its zone (the
 // ascender of ĺ and ĥ, not the horn of ơ), with the capitals' gap. A ring
 // resting on a capital's apex (Å) overlaps it by half its own stroke.
 if(first.length){const a=ink(first),under=samples(paths.filter(p=>!p.mark&&!p.attach)).filter(([x,,q])=>x+q>a.x0-gap/2&&x-q<a.x1+gap/2),high=Math.min(top,...under.map(([,y,q])=>y-q)),g=first.every(p=>p.rest)?-.5*r*Math.max(.3,Math.min(1,first[0].scale||1)):zone!=='cap'&&high<top-.5*R?.75*gap:gap;shift(first,0,high-g-a.y1);}
 // Square and rounded modules count with their full corner here, as the topology guard draws them.
 const base=first.length?ink(first):{x0:0,x1:0,y0:top,y1:top},F=stacked.length||side.length?samples(first):[],square=shape==='square'||shape==='rounded'?Math.SQRT2:corner;
 // Capitals keep the convention's floor of 0.035 of the cap height (31) between a tone and its modifier.
 for(const [group,floor]of [[stacked,Math.max(.6*gap,zone==='cap'?31:0)],[side,Math.max(.7*gap,zone==='cap'?31:26)]]){if(!group.length)continue;
  shift(group,0,base.y0+Math.max(...group.map(p=>p.nest??-.6*gap))-ink(group).y1);
  const S=samples(group);let lift=0;for(let i=0;i<40;i++){const d=clearance(S,F,0,-lift,square);if(d>=floor-.5)break;lift+=Math.max(1,.75*(floor-d));}shift(group,0,-lift);}
 // The dot below sits 56 under the baseline on both cases; a comma below keeps the gap.
 if(below.length){shift(below,0,ZONE.base+(below.every(p=>p.points.every(q=>q[0]===p.points[0][0]&&q[1]===p.points[0][1]))?Math.max(gap,56):gap)-ink(below).y0);
  if(letter.some(q=>q[1]+q[2]>ZONE.base+gap)){const B=samples(below);let dx=0;for(let i=0;i<40;i++){const d=clearance(B,letter,dx);if(Math.abs(d-gap)<1)break;dx+=Math.max(-40,Math.min(40,gap-d));}shift(below,dx,0);}}
 // An attached accent starts on the centreline of the letter's lowest stroke
 // under its first point, so it grows out of that stroke at every weight.
 for(const p of attached){const x=p.points[0][0];if(Math.abs(k-1)>1e-9)stretch([p],x,k);const at=letter.filter(q=>Math.abs(q[0]-x)<=Math.max(8,.5*r));shift([p],0,(at.length?Math.max(...at.map(q=>q[1])):ZONE.base-r)-p.points[0][1]);}
 if(right.length){shift(right,0,ZONE.top-2*R-ink(right).y0);
  const upper=letter.filter(q=>q[1]<(zone==='cap'?(ZONE.top+ZONE.base)/2:ZONE.x-2*R+r)),S=samples(right);let dx=0;
  if(upper.length)for(let i=0;i<40;i++){const d=clearance(S,upper,dx);if(Math.abs(d-gap)<.5)break;dx+=Math.max(-60,Math.min(60,gap-d));}shift(right,dx,0);
  // It rises over a crossbar below it (ť) until it keeps the gap.
  const T=samples(right);let lift=0;if(letter.length)for(let i=0;i<40;i++){const d=clearance(T,letter,0,-lift);if(d>=gap-.5)break;lift+=Math.max(1,.75*(gap-d));}shift(right,0,-lift);}
 if(bar.length){const stem=Math.min(...letter.map(q=>q[1]-q[2])),own=Math.min(...samples(paths.filter(p=>!p.mark&&!p.attach)).map(q=>q[1]-q[2]));let b=ink(bar);shift(bar,0,Math.max((own+ZONE.x-2*R)/2,stem+1.2*r+(b.y1-b.y0)/2)-(b.y0+b.y1)/2);
  // It crosses the stem and reaches about one gap past it on its short side.
  b=ink(bar);const band=letter.filter(q=>q[1]+q[2]>b.y0&&q[1]-q[2]<b.y1),xs=bar.flatMap(p=>p.points.map(q=>q[0])),x0=Math.min(...xs),x1=Math.max(...xs),past=.9*gap;
  if(band.length&&x1>x0){const s0=Math.min(...band.map(q=>q[0]-q[2])),s1=Math.max(...band.map(q=>q[0]+q[2]));if(x0+x1<s0+s1)stretch(bar,x0,(x1-x0+s1+past-b.x1)/(x1-x0));else stretch(bar,x1,(x1-x0+b.x0-s0+past)/(x1-x0));}}
}
function resolve(glyph,settings,fixedRadius){
const s={...DEFAULT,...settings},w=(s.weight-400)/500,wd=s.width/100,c=glyph.width/2,edge=EDGE[s.shape]||1,zone=glyph.zone||'lower',reference=radiusAt(s,REFERENCE_WEIGHT);
// Narrow styles draw lighter stems, as condensed type does, so their counters survive.
const narrow=s.optical?1-.4*Math.max(0,1-wd):1,baseRadius=radiusAt(s,w)*narrow;
// Heavier weights widen every counter by part of the weight they add, so heavy
// letters grow wider instead of filling in. Single stems keep their drawing.
// A fixed glyph (full-em scripts and combining marks) keeps its cell: it neither widens with the weight nor takes optical bearings.
const fixed=!!glyph.fixed,letter=glyph.paths.filter(p=>!p.mark&&!p.attach),xs=(letter.length?letter:glyph.paths).flatMap(p=>p.points.map(q=>q[0])),span=Math.max(...xs)-Math.min(...xs),widen=s.optical?(baseRadius-radiusAt(s,0)*narrow)*edge:0,grow=span>1&&!fixed?widthGrowth(glyph)*widen/span:0,scaleX=wd+grow;
// Accents above lighten a little as the weight grows (0.8 of the stem up to Medium, 0.68 at Black), as accents in drawn families do, so their counters and stacks keep their shape.
// A path with `sink` drops by that many units at Black, nothing at Bold and
// below: the bar of e sinks as the weight grows, so the eye above it stays open.
const sinkOf=p=>(p?.sink||0)*Math.max(0,(w-REFERENCE_WEIGHT)/(1-REFERENCE_WEIGHT));
const light=1-.15*Math.max(0,w-.2)/.8,build=radius=>{const v=verticalMap(zone,radius*edge,reference*edge),tx=x=>(x-c)*scaleX+c,paths=glyph.paths.map(p=>({...p,...(p.mark==='above'||p.mark==='right'?{scale:(p.scale??1)*light}:{}),points:p.points.map(([x,y])=>[tx(x),p.mark?y:v.map(y+sinkOf(p))])}));placeMarks(paths,radius*edge,reference*edge,zone,{scaleX,wd,weight:w,optical:s.optical,shape:s.shape,roundness:s.roundness,tip:72/clamp(s.density,.55,1.8)*(1-.10*REFERENCE_WEIGHT)/reference>1.6*edge?TAPER_MIN_APART:TAPER_MIN});return {v,paths};};
const radius=fixedRadius??baseRadius,built=build(radius);
// Module spacing follows module size, so every weight keeps the same overlap texture.
const step=72/clamp(s.density,.55,1.8)*(1-.10*REFERENCE_WEIGHT)*radius/reference,v=built.v,lines=zoneLines(zone),zones={top:zone==='lower'?[v.map(ZONE.top),v.map(ZONE.x)]:[v.map(lines.top)],bottom:[v.map(lines.base),v.map(zone==='box'?lines.base+130:ZONE.desc)]};
// Accent paths invert their own placement; everything else inverts the zones.
// A counter inside a closed accent (the ring) moves with that accent.
const rings=glyph.paths.flatMap((p,i)=>p.mark&&p.closed?[{i,xs:p.points.map(q=>q[0]),ys:p.points.map(q=>q[1])}]:[]);
const inverse=([x,y],index)=>{const place=built.paths[index]?.place;return place?[c+((x-place[1])/place[0]-c)/scaleX,(y-place[2])/(place[3]??1)]:[c+(x-c)/scaleX,v.inverse(y)-sinkOf(glyph.paths[index])];},forward=([x,y])=>{const ring=rings.find(({xs,ys})=>x>=Math.min(...xs)&&x<=Math.max(...xs)&&y>=Math.min(...ys)&&y<=Math.max(...ys)),place=ring&&built.paths[ring.i].place;return place?[place[0]*((x-c)*scaleX+c)+place[1],place[3]*y+place[2]]:[(x-c)*scaleX+c,v.map(y)];};
return {paths:built.paths,radius,baseRadius,widen,step,advance:fixed?glyph.width*scaleX+(glyph.width?s.tracking:0):glyph.width*scaleX+radius*.48+s.tracking,fixed,scaleX,weight:w,metrics:METRICS,zones,overshoot:Math.max(6,.1*reference*edge),inverse,forward};
}
export function resolveGlyph(glyph,settings,radius){const {inverse,forward,...resolved}=resolve(glyph,settings,radius);return resolved;}
// Ink positions of the vertical zones (SVG y down), shared by every glyph of a style.
export function inkZones(settings){const s={...DEFAULT,...settings},R=radiusAt(s,REFERENCE_WEIGHT)*(EDGE[s.shape]||1);return {cap:ZONE.top-2*R,x:ZONE.x-2*R,base:ZONE.base,desc:ZONE.base+(ZONE.desc-ZONE.base)*DESCENT};}
// Converts an editor position back to the skeleton coordinates of a glyph.
export function skeletonPoint(glyph,settings,point,pathIndex){return resolve(glyph,settings,generateGlyph(glyph,settings).radius).inverse(point,pathIndex);}
const mix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
function cubic(a,b,c,d){const length=Math.hypot(b[0]-a[0],b[1]-a[1])+Math.hypot(c[0]-b[0],c[1]-b[1])+Math.hypot(d[0]-c[0],d[1]-c[1]),n=Math.max(18,Math.ceil(length/7)),out=[a];for(let k=1;k<=n;k++){const t=k/n;out.push(mix(mix(mix(a,b,t),mix(b,c,t),t),mix(mix(b,c,t),mix(c,d,t),t),t));}return out;}
function flatten(path){if(path.kind==='poly')return path.points;const out=[path.points[0]];for(let i=0;i+3<path.points.length;i+=3)out.push(...cubic(...path.points.slice(i,i+4)).slice(1));return out;}
// Each line segment or curve segment is sampled on its own, so every corner,
// anchor and terminal receives a module.
function segments(path){if(path.kind==='poly'){const ps=path.points.concat(path.closed&&path.points.length>1?[path.points[0]]:[]);return ps.length===1?[[ps[0]]]:ps.slice(1).map((p,i)=>[ps[i],p]);}const out=[];for(let i=0;i+3<path.points.length;i+=3)out.push(cubic(...path.points.slice(i,i+4)));return out;}
// Strokes are split where another stroke ends on them or crosses them, so joins
// and crossings become shared corners instead of uneven gaps.
function lengths(ps){const out=[0];for(let i=1;i<ps.length;i++)out.push(out[i-1]+Math.hypot(ps[i][0]-ps[i-1][0],ps[i][1]-ps[i-1][1]));return out;}
function project(ps,cum,p){let best={d:Infinity,s:0};for(let i=1;i<ps.length;i++){const [a,b]=[ps[i-1],ps[i]],dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l)):0,d=Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);if(d<best.d)best={d,s:cum[i-1]+t*Math.sqrt(l)};}return best;}
function crossing(a,b,c,d){const r=[b[0]-a[0],b[1]-a[1]],q=[d[0]-c[0],d[1]-c[1]],den=r[0]*q[1]-r[1]*q[0];if(Math.abs(den)<1e-9)return null;const t=((c[0]-a[0])*q[1]-(c[1]-a[1])*q[0])/den,u=((c[0]-a[0])*r[1]-(c[1]-a[1])*r[0])/den;return t>=0&&t<=1&&u>=0&&u<=1?[a[0]+t*r[0],a[1]+t*r[1]]:null;}
function slice(ps,cum,s0,s1){const at=s=>{let i=1;while(i<ps.length-1&&cum[i]<s)i++;const t=(s-cum[i-1])/((cum[i]-cum[i-1])||1);return [i,mix(ps[i-1],ps[i],Math.max(0,Math.min(1,t)))];},[i0,p0]=at(s0),[i1,p1]=at(s1);return [p0,...ps.slice(i0,i1).filter((q,k)=>k>0||Math.hypot(q[0]-p0[0],q[1]-p0[1])>1e-6),p1];}
const box=ps=>{let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(const [x,y]of ps){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}return [x0,y0,x1,y1];};
const touches=(a,b,pad=0)=>a[0]-pad<=b[2]&&b[0]-pad<=a[2]&&a[1]-pad<=b[3]&&b[1]-pad<=a[3];
function splitRuns(lines,step,owners=[]){
 const info=lines.map(ps=>({ps,cum:lengths(ps),box:box(ps)})),cuts=lines.map(()=>[]),margin=step*.3,ends=lines.flatMap(ps=>[ps[0],ps.at(-1)]);
 info.forEach(({ps,cum,box:b},k)=>{if(ps.length<2)return;const total=cum.at(-1);for(const e of ends){if(!touches(b,[e[0],e[1],e[0],e[1]],4))continue;const {d,s}=project(ps,cum,e);if(d<4&&s>margin&&s<total-margin)cuts[k].push(s);}});
 for(let k=0;k<lines.length;k++)for(let l=k+1;l<lines.length;l++){const A=info[k],B=info[l];if(A.ps.length<2||B.ps.length<2||!touches(A.box,B.box))continue;
  for(let i=1;i<A.ps.length;i++){const a0=A.ps[i-1],a1=A.ps[i],sa=[Math.min(a0[0],a1[0]),Math.min(a0[1],a1[1]),Math.max(a0[0],a1[0]),Math.max(a0[1],a1[1])];if(!touches(sa,B.box))continue;
   for(let j=1;j<B.ps.length;j++){const b0=B.ps[j-1],b1=B.ps[j];if(Math.max(b0[0],b1[0])<sa[0]||Math.min(b0[0],b1[0])>sa[2]||Math.max(b0[1],b1[1])<sa[1]||Math.min(b0[1],b1[1])>sa[3])continue;const x=crossing(a0,a1,b0,b1);if(!x)continue;
    const pa=A.cum[i-1]+Math.hypot(x[0]-a0[0],x[1]-a0[1]),pb=B.cum[j-1]+Math.hypot(x[0]-b0[0],x[1]-b0[1]);if(pa>margin&&pa<A.cum.at(-1)-margin)cuts[k].push(pa);if(pb>margin&&pb<B.cum.at(-1)-margin)cuts[l].push(pb);}}}
 return info.flatMap(({ps,cum},k)=>{const marks=[0,...cuts[k].sort((a,b)=>a-b),cum.at(-1)].filter((s,i,a)=>i===0||s-a[i-1]>margin||i===a.length-1);return (ps.length<2||marks.length<3?[ps]:marks.slice(1).map((s,i)=>slice(ps,cum,marks[i],s))).map(run=>Object.assign(run,{path:owners[k]}));});
}
// Tapered marks (quotes, commas, the acute and grave) shrink toward their tip,
// but never below this share of the look's module, so they keep its character.
const TAPER_MIN=.45;
// Where modules stand apart as single beads (Point), a smaller bead reads as a
// different, fainter mark, so tapered strokes keep this larger share there.
const TAPER_MIN_APART=.6;
// Samples a tapered stroke from its larger end: each module is followed at the
// step of its own size, so neighbours overlap as much as in an even stroke of
// that size; the steps are then stretched slightly (by up to 15%) or else
// compressed to end exactly on the tip, as even strokes are.
function sampleBy(ps,step,size){const cum=lengths(ps),L=cum.at(-1);if(!(L>0))return [{x:ps[0][0],y:ps[0][1],angle:0}];
 const at=s=>{let i=1;while(i<ps.length-1&&cum[i]<s)i++;const a=ps[i-1],b=ps[i],t=(s-cum[i-1])/((cum[i]-cum[i-1])||1);return {p:mix(a,b,Math.max(0,Math.min(1,t))),angle:Math.atan2(b[1]-a[1],b[0]-a[0])};};
 const forward=size(ps[0])>=size(ps.at(-1)),pos=s=>forward?s:L-s,marks=[0];while(marks.at(-1)<L&&marks.length<200){const s=marks.at(-1);marks.push(s+step*Math.max(.05,size(at(pos(s)).p)));}
 const use=marks.length>2&&L/marks.at(-2)<=1.15?marks.slice(0,-1):marks,k=L/use.at(-1),out=use.map(s=>{const q=at(pos(s*k));return {x:q.p[0],y:q.p[1],angle:q.angle};});return forward?out:out.reverse();}
function sample(ps,step){const dist=[0];for(let i=1;i<ps.length;i++)dist.push(dist[i-1]+Math.hypot(ps[i][0]-ps[i-1][0],ps[i][1]-ps[i-1][1]));const total=dist.at(-1);if(!(total>0))return [{x:ps[0][0],y:ps[0][1],angle:0}];const n=Math.max(1,Math.ceil(total/step-.1)),out=[];let idx=1;for(let k=0;k<=n;k++){const d=total*k/n;while(idx<dist.length-1&&dist[idx]<d)idx++;const a=ps[idx-1],b=ps[idx],t=(d-dist[idx-1])/(dist[idx]-dist[idx-1]||1),p=mix(a,b,t);out.push({x:p[0],y:p[1],angle:Math.atan2(b[1]-a[1],b[0]-a[0])});}return out;}
// A free stroke end heading toward another stroke is shortened until the
// aperture between them keeps a clearance proportional to the module size.
function openApertures(modules,r,edge){
 // Tapered marks (quotes, commas) are complete shapes and are never shortened.
 const all=r.paths.map(flatten),lines=all.filter((ps,i)=>!r.paths[i].closed&&!r.paths[i].taper&&!r.paths[i].mark&&ps.length>1),clearance=Math.max(18,.42*r.radius*edge),join=r.step*.9;
 const part=(ps,cum,from,to)=>{const a=Math.max(0,from),b=Math.min(cum.at(-1),to);return b>a?slice(ps,cum,a,b):null;};
 const distance=(p,part)=>{if(!part)return Infinity;const b=part.box||(part.box=box(part));if(p[0]<b[0]-r.step||p[0]>b[2]+r.step||p[1]<b[1]-r.step||p[1]>b[3]+r.step)return Infinity;let d=Infinity;for(let i=1;i<part.length;i++)d=Math.min(d,segmentDistance({x:p[0],y:p[1]},{x:part[i-1][0],y:part[i-1][1]},{x:part[i][0],y:part[i][1]}));return d;};
 const whole=all.map(ps=>ps.length>1?ps:null);
 for(const line of lines)for(const atEnd of [false,true]){
  const ps=atEnd?line:[...line].reverse(),cum=lengths(ps),total=cum.at(-1),tip=ps.at(-1);if(total<2*r.step)continue;
  // Joins (an end touching another stroke) are never trimmed.
  if(whole.some((o,i)=>all[i]!==line&&distance(tip,o)<join)||distance(tip,part(ps,cum,0,total-2*r.step))<join)continue;
  const reach=Math.min(total*.3,2*r.step),tailPart=part(ps,cum,total-reach,total),nearPart=part(ps,cum,total-reach-1.5*r.step,total);
  const tail=modules.filter(m=>distance([m.x,m.y],tailPart)<r.step*.6),near=new Set(modules.filter(m=>distance([m.x,m.y],nearPart)<r.step*.6)),foreign=modules.filter(m=>!near.has(m));
  const positions=new Map(tail.map(m=>[m,project(ps,cum,[m.x,m.y]).s]));tail.sort((a,b)=>positions.get(b)-positions.get(a));
  for(const m of tail){const s=positions.get(m),k=cum.findIndex(c=>c>=s-1e-6),i=k<0?cum.length-1:Math.max(1,k),dx=ps[i][0]-ps[i-1][0],dy=ps[i][1]-ps[i-1][1],l=Math.hypot(dx,dy)||1;
   const ahead=f=>{const vx=f.x-m.x,vy=f.y-m.y,d=Math.hypot(vx,vy);return d-(m.r+f.r)*edge<clearance&&(vx*dx+vy*dy)/(d*l||1)>Math.cos(75*Math.PI/180);},blocked=foreign.filter(ahead);
   if(!blocked.length)break;
   // A dot above the stroke (i, j) rises; anything else shortens the stroke.
   const dots=blocked.filter(f=>f.dot!==undefined&&f.y<m.y);if(dots.length===blocked.length){for(const f of dots){const need=(m.r+f.r)*edge+clearance-Math.hypot(f.x-m.x,f.y-m.y);if(need>0)f.y-=need;}break;}
   modules.splice(modules.indexOf(m),1);}
 }
}
// Arc modules (Echo) open toward their stroke's direction, so the module at a
// free stroke end would read as a "c"; it takes the full ring set, as a lone
// dot does. Ends that join another stroke, or the stroke itself, are not free.
function markFreeEnds(modules,r){const all=r.paths.map(flatten),join=r.step*.9;
 const near=(p,ps)=>{let d=Infinity;for(let i=1;i<ps.length;i++)d=Math.min(d,segmentDistance({x:p[0],y:p[1]},{x:ps[i-1][0],y:ps[i-1][1]},{x:ps[i][0],y:ps[i][1]}));return d;};
 r.paths.forEach((path,i)=>{const ps=all[i];if(path.closed||ps.length<2)return;const own=modules.filter(m=>m.path===i),cum=lengths(ps),total=cum.at(-1);if(own.length<2||total<2*r.step)return;
  for(const [end,body]of [[ps[0],slice(ps,cum,2*r.step,total)],[ps.at(-1),slice(ps,cum,0,total-2*r.step)]]){if(all.some((o,j)=>j!==i&&o.length>1&&near(end,o)<join)||near(end,body)<join)continue;let best=null,d=Infinity;for(const m of own){const e=Math.hypot(m.x-end[0],m.y-end[1]);if(e<d){d=e;best=m;}}if(best&&d<1.5*r.step)best.end=true;}});}
function segmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l)):0;return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
// Accents are placed apart from their letter, so a letter keeps exactly the
// modules it has alone and accented letters space like their base letter.
function placeModules(glyph,s,r){if(!r.paths.some(p=>p.mark)||r.paths.every(p=>p.mark))return placePaths(glyph,s,r);
 const part=keep=>{const index=r.paths.flatMap((p,i)=>!!p.mark===keep?[i]:[]);return placePaths(glyph,s,{...r,paths:index.map(i=>r.paths[i])}).map(m=>({...m,path:index[m.path],...(m.dot!==undefined?{dot:index[m.dot]}:{})}));};
 return [...part(false),...part(true)];}
// Horizontal strokes are thinner, and more so at heavy weights, as in drawn type.
// Wide styles thin them further, since their horizontals lengthen with the
// width while stems keep their thickness: without it, letters with three
// horizontals (e s z B E) darken as the style widens (e 1.28 times n at 400/135
// against 1.15 at 400/100). Heavy styles, already thinned by weight, take half.
export const horizontalThinning=(weight,wd)=>.10+.14*weight+.45*Math.max(0,wd-1)*(1-.5*weight);
function placePaths(glyph,s,r){const modules=[],edge=EDGE[s.shape]||1,thinning=horizontalThinning(r.weight,s.width/100),apart=r.step>1.6*r.radius*edge,tip=apart?TAPER_MIN_APART:TAPER_MIN;
 const factor=p=>s.optical?1-thinning*Math.abs(Math.cos(p.angle)):1,owners=r.paths.flatMap((path,i)=>segments(path).map(()=>i));
 const flat=r.paths.map(flatten),cums=flat.map(lengths),scaleOf=path=>Math.max(.3,Math.min(1,path?.scale||1)),taper=(p,i)=>{const path=r.paths[i],scale=scaleOf(path);if(!path?.taper)return scale;const ps=flat[i],cum=cums[i],t=project(ps,cum,[p.x,p.y]).s/(cum.at(-1)||1);return Math.max(Math.min(scale,tip),scale*(1-.45*(path.taper==='start'?1-t:t)));};
 // Tapered strokes of solid looks are sampled densely, so they read as one
 // smooth teardrop; in looks whose modules show their own shape (separate beads,
 // diamonds, rings and arcs) they are sampled at the step of their local module
 // size, so each module keeps its shape, its trap or its rings.
 const beads=s.shape==='ring'||s.shape==='arc'||s.shape==='diamond'||r.step>1.6*r.radius*edge;
 const runs=splitRuns(r.paths.flatMap(segments),r.step,owners).map(seg=>{const path=r.paths[seg.path];if(path?.taper&&beads){const at=q=>taper({x:q[0],y:q[1]},seg.path),run=sampleBy(seg,r.step,at);return Object.assign(run,{path:seg.path,size:Math.min(...run.map(p=>at([p.x,p.y])))});}const size=scaleOf(path)*(path?.taper?.55:1);return Object.assign(sample(seg,r.step*size),{path:seg.path,size});});
 const near=(p,d)=>modules.find(m=>Math.hypot(m.x-p.x,m.y-p.y)<d);
 // A corner or join takes the fuller of the strokes passing through it.
 const boxes=runs.map(run=>box(run.map(q=>[q.x,q.y]))),joint=p=>{let f=factor(p);runs.forEach((run,k)=>{if(!touches(boxes[k],[p.x,p.y,p.x,p.y],4))return;for(let i=1;i<run.length;i++)if(segmentDistance(p,run[i-1],run[i])<4)f=Math.max(f,factor(run[i]));});return f;};
 // Corners and terminals first, then the samples between them.
 const size=(p,f,i)=>{const k=f*taper(p,i);return r.paths[i]?.taper?Math.max(Math.min(scaleOf(r.paths[i]),tip),k):k;};
 const add=(p,f,run)=>modules.push({...p,r:r.radius*size(p,run.length===1?1:f,run.path),shape:s.shape,roundness:s.roundness,path:run.path,...(run.length===1?{dot:run.path}:{})});
 // Duplicates are judged at each stroke's own spacing, so finer strokes keep their samples.
 for(const run of runs)for(const p of [run[0],run.at(-1)]){const hit=near(p,r.step*.35*run.size),f=joint(p);if(hit){hit.r=Math.max(hit.r,r.radius*size(p,f,run.path));continue;}add(p,f,run);}
 for(const run of runs)for(const p of run.slice(1,-1))if(!near(p,r.step*.4*run.size))add(p,factor(p),run);
 // Thinner strokes keep their outer edge on the zone; round extremes overshoot it.
 // The correction fades over one module radius, so curve extremes stay smooth.
 if(s.optical){const reach=r.radius*edge,fade=(m,zones)=>Math.max(0,...zones.map(z=>1-Math.abs(m.y-z)/reach));for(const m of modules){if(r.paths[m.path]?.mark)continue;const lift=(r.radius-m.r)*edge+(glyph.round&&Math.abs(Math.cos(m.angle))>.7?r.overshoot:0),up=fade(m,r.zones.top),down=fade(m,r.zones.bottom);if(up>=down)m.y-=lift*up;else m.y+=lift*down;}}
 if(s.optical)openApertures(modules,r,edge);
 if(s.shape==='arc')markFreeEnds(modules,r);
 // Optional marks (the dot of the zero) disappear where they would close a counter.
 r.paths.forEach((path,i)=>{if(!path.optional)return;const own=modules.filter(m=>m.path===i),clearance=Math.max(8,.1*r.radius*edge);if(own.some(m=>modules.some(f=>f.path!==i&&Math.hypot(f.x-m.x,f.y-m.y)-(m.r+f.r)*edge<clearance)))for(const m of own)modules.splice(modules.indexOf(m),1);});
 return modules;
}
// Facts that depend only on the drawing are kept per drawing, so editing a
// point or changing a setting does not recompute them for every other glyph.
const FACTS=new Map();
// A coarse centreline, flattened apart from the sampling code so that code keeps
// its own fast paths.
function outlineOf(path){const ps=path.points.map(([x,y])=>[x,y]);if(path.kind==='poly')return ps;const out=[ps[0]];for(let i=0;i+3<ps.length;i+=3){const [a,b,c,d]=ps.slice(i,i+4);for(let k=1;k<=16;k++){const t=k/16,u=1-t;out.push([u*u*u*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t*t*t*d[0],u*u*u*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t*t*t*d[1]]);}}return out;}
function drawingFacts(glyph){const key=JSON.stringify(glyph.paths)+(glyph.round?'r':'');let facts=FACTS.get(key);if(!facts){if(FACTS.size>4000)FACTS.clear();const drawn=glyph.paths.some(p=>!p.optional&&p.points.length);facts=drawn?{growth:measureGrowth(glyph),topology:skeletonTopology(glyph.paths)}:{growth:0,topology:{islands:0,counters:[]}};FACTS.set(key,facts);}return facts;}
// Topology on a coarse grid: connected components of ink (8-connected) and of
// white (4-connected), with their sizes and whether they reach the border.
const GRID=10;
function components(ink,W,H){
 const label=new Int32Array(W*H).fill(-1),stack=new Int32Array(W*H),ring=[-1,1,-W,W,-W-1,-W+1,W-1,W+1],parts=[];
 for(let start=0;start<W*H;start++){if(label[start]>=0)continue;const on=ink[start],reach=on?8:4,id=parts.length;let top=0,size=0,edge=false;label[start]=id;stack[top++]=start;
  while(top){const c=stack[--top],x=c%W,border=x===0||x===W-1||c<W||c>=W*H-W;size++;if(border)edge=true;
   for(let k=0;k<reach;k++){const n=c+ring[k];if(border&&(n<0||n>=W*H||Math.abs(n%W-x)>1))continue;if(label[n]<0&&ink[n]===on){label[n]=id;stack[top++]=n;}}}
  parts.push({on,size,edge});}
 return {label,parts};
}
function grid(box){const x0=box[0]-2*GRID,y0=box[1]-2*GRID,W=Math.ceil((box[2]-x0)/GRID)+3,H=Math.ceil((box[3]-y0)/GRID)+3;return {x0,y0,W,H,ink:new Uint8Array(W*H)};}
// The drawing's own islands and counters, from its centrelines. Strokes that
// end within about two cells of each other count as joined. Each counter is
// represented by its deepest point, the one farthest from every stroke.
function skeletonTopology(paths){
 const lines=paths.filter(p=>!p.optional).map(p=>{const ps=outlineOf(p);return p.closed&&p.kind==='poly'?ps.concat([ps[0]]):ps;}),g=grid(box(lines.flat())),{W,H,ink}=g,mark=(x,y)=>{const i=Math.round((x-g.x0)/GRID),j=Math.round((y-g.y0)/GRID);for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++)ink[(j+dj)*W+i+di]=1;};
 for(const ps of lines){mark(...ps[0]);for(let i=1;i<ps.length;i++){const [a,b]=[ps[i-1],ps[i]],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/(GRID/2));for(let k=1;k<=n;k++)mark(a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n);}}
 const {label,parts}=components(ink,W,H),depth=new Int32Array(W*H).fill(-1),queue=new Int32Array(W*H);let head=0,tail=0;
 for(let c=0;c<W*H;c++)if(ink[c]){depth[c]=0;queue[tail++]=c;}
 while(head<tail){const c=queue[head++],x=c%W;for(const n of [c-1,c+1,c-W,c+W]){if(n<0||n>=W*H||Math.abs(n%W-x)>1||depth[n]>=0)continue;depth[n]=depth[c]+1;queue[tail++]=n;}}
 // Of equally deep points the first represents the counter; the middle one of
 // its row is a second chance, so a wide, flat counter (Ħ) whose first point
 // sits beside a thick stem still counts as open.
 const deepest=new Map();for(let c=0;c<W*H;c++){const part=parts[label[c]];if(part.on||part.edge||part.size<1500/GRID**2)continue;const d=deepest.get(label[c]);if(!d||depth[c]>d.depth)deepest.set(label[c],{depth:depth[c],cells:[c]});else if(depth[c]===d.depth)d.cells.push(c);}
 const at=c=>[g.x0+(c%W)*GRID,g.y0+Math.floor(c/W)*GRID],row=cells=>cells.filter(c=>Math.floor(c/W)===Math.floor(cells[0]/W));
 return {islands:parts.filter(p=>p.on).length,counters:[...deepest.values()].map(({cells})=>at(cells[0])),alternates:[...deepest.values()].map(({cells})=>at(row(cells)[Math.floor((row(cells).length-1)/2)]))};
}
// The placed modules keep those counters open and those marks apart: each
// counter keeps white at its deepest point, unless the white there flows out
// between separate beads (Point, Diamond). Small holes between barely touching
// modules (the lace of Diamond and Organic) are texture; only a hole the size of
// a module step counts as a new counter.
function keepsTopology(modules,expected,r,edge){
 const own=modules.filter(m=>!r.paths[m.path]?.optional);if(!own.length)return true;
 const reach=m=>m.r*(m.shape==='diamond'?1.2:m.shape==='blob'?1.07:1),g=grid(box(own.flatMap(m=>[[m.x-reach(m),m.y-reach(m)],[m.x+reach(m),m.y+reach(m)]])));
 for(const m of own){const R=reach(m),i0=Math.ceil((m.x-R-g.x0)/GRID),i1=Math.floor((m.x+R-g.x0)/GRID),j0=Math.ceil((m.y-R-g.y0)/GRID),j1=Math.floor((m.y+R-g.y0)/GRID);
  for(let j=j0;j<=j1;j++){const dy=Math.abs(g.y0+j*GRID-m.y),h=m.shape==='diamond'?R-dy:m.shape==='square'||m.shape==='rounded'?R:Math.sqrt(Math.max(0,R*R-dy*dy)),a=Math.max(i0,Math.ceil((m.x-h-g.x0)/GRID)),b=Math.min(i1,Math.floor((m.x+h-g.x0)/GRID));if(b>=a)g.ink.fill(1,j*g.W+a,j*g.W+b+1);}}
 const {label,parts}=components(g.ink,g.W,g.H),islands=parts.filter(p=>p.on).length;
 if(islands!==expected.islands)return islands>expected.islands;
 const hole=Math.max(4,.16*(r.radius*edge)**2/GRID**2),big=Math.max(15,r.step**2/GRID**2);
 const closed=point=>{const [x,y]=r.forward(point),i=Math.round((x-g.x0)/GRID),j=Math.round((y-g.y0)/GRID);if(i<0||j<0||i>=g.W||j>=g.H)return false;const part=parts[label[j*g.W+i]];return part.on||!part.edge&&part.size<hole;};
 if(expected.counters.some((point,k)=>closed(point)&&(!expected.alternates?.[k]||closed(expected.alternates[k]))))return false;
 return parts.filter(p=>!p.on&&!p.edge&&p.size>=big).length<=expected.counters.length;
}
function placeGlyph(glyph,s,edge){let r=resolve(glyph,s),modules=placeModules(glyph,s,r);
 // A glyph whose counters would close, or whose separate marks would merge, is
 // drawn lighter, down to about seven tenths of its weight. If even that would
 // not keep them, it keeps its full weight.
 // The guard serves the Latin drawings; the script packs set their own module scale, and their
 // letters of separate parts (jamo, strokes) keep one weight instead of a lighter one here and there.
 if(s.optical&&s.shape!=='arc'&&modules.length&&!glyph.script&&!glyph.fixed){const expected=drawingFacts(glyph).topology;if(!keepsTopology(modules,expected,r,edge)){const full={r,modules};let kept=false;for(let k=0;k<4&&!kept;k++){r=resolve(glyph,s,r.radius*.92);modules=placeModules(glyph,s,r);kept=keepsTopology(modules,expected,r,edge);}if(!kept)({r,modules}=full);}}
 const ink=m=>m.r*edge;return {r,modules,bounds:{minX:Math.min(...modules.map(m=>m.x-ink(m))),maxX:Math.max(...modules.map(m=>m.x+ink(m))),minY:Math.min(...modules.map(m=>m.y-ink(m))),maxY:Math.max(...modules.map(m=>m.y+ink(m)))}};}
// The ink box of a glyph as generateGlyph places it, without its spacing (for line metrics).
export function glyphBounds(glyph,settings){const s={...DEFAULT,...settings};return placeGlyph(glyph,s,EDGE[s.shape]||1).bounds;}
export function generateGlyph(glyph,settings){const s={...DEFAULT,...settings},edge=EDGE[s.shape]||1;let {r,modules,bounds}=placeGlyph(glyph,s,edge);
 const {inverse,forward,...resolved}=r;r=resolved;
 const ink=m=>m.r*edge;
 // Side bearings and advance follow the letter; accents may overhang, as in drawn type.
 // Its white is measured from the x-height (or cap height) ink to the baseline,
 // on the letter placed without its accents, so accented letters keep its advance.
 // The comma beside an ascender (ď ľ ť) and the bar of đ, ð and ħ count as letter,
 // so they keep at least half a stem bearing from the next letter. The horn of
 // ơ ư does not: the advance stays the letter's and the kerning keeps the next
 // letter clear of it.
 const letter=modules.filter(m=>{const p=r.paths[m.path],mark=p?.mark;return !mark&&!p?.horn||mark==='right'||mark==='bar';});
 // Ink in the lower half of the descender (the tail of j and ƒ) does not set
 // the left side bearing: it hangs past the fitted side, as in drawn type, so j
 // stands at the i's distance after a space and its tail passes under the
 // letter before it; where it would meet a descender (gj, jj) the kerning opens
 // the pair.
 const hang=forward([0,(ZONE.base+ZONE.desc)/2])[1],body=letter.filter(m=>m.y<=hang),fitted=body.length?body:letter,fit=letter.length?{minX:Math.min(...fitted.map(m=>m.x-ink(m))),maxX:Math.max(...letter.map(m=>m.x+ink(m)))}:bounds;
 // A fixed glyph keeps its drawn cell, scaled with the width: the cell's left edge is the pen position.
 const c=glyph.width/2,cellLeft=c-c*r.scaleX,cell=glyph.fixed?{offsetX:-cellLeft,advance:r.advance,leftBearing:bounds.minX-cellLeft,rightBearing:cellLeft+glyph.width*r.scaleX-bounds.maxX,unit:0,floating:false}:null;
 const spacing=cell||glyphSpacing(glyph,fit,s,{radius:r.baseRadius,edge,widen:r.widen,modules:letter,zoneTop:r.zones.top.at(-1)-r.radius*edge,step:r.step}),scene={...r,...spacing,bounds,modules,figure:!!glyph.figure,math:!!glyph.math,zone:glyph.zone||'lower',markType:typeof glyph.mark==='string'?glyph.mark:null};scene.profile=inkProfile(scene);
 // Attachment points for combining marks, in the scene's coordinates: a base's `above` and
 // `below` (default: the middle of its ink, 30 above its top and 30 under its bottom) and a
 // mark's own `mark` point (default: the bottom middle of an above mark, the top middle of a
 // below mark). A mark's `above` and `below` take the next mark of a stack.
 const given=glyph.anchors||{},mid=(bounds.minX+bounds.maxX)/2,at=(name,fallback)=>given[name]?forward(given[name]):fallback;
 scene.anchors={above:at('above',[mid,bounds.minY-30]),below:at('below',[mid,bounds.maxY+30]),mark:at('mark',glyph.mark==='below'?[mid,bounds.minY]:[mid,bounds.maxY])};
 // The accents' and the horn's own ink envelope, so kerning can keep them clear
 // of the next letter.
 const marks=modules.filter(m=>r.paths[m.path]?.mark||r.paths[m.path]?.horn);if(marks.length)scene.markProfile=inkProfile({...scene,modules:marks});return scene;}
const f=n=>Number(n.toFixed(3));
export function pathData(p){let d=`M ${p.points[0].map(f).join(' ')}`;if(p.kind==='poly'){for(const point of p.points.slice(1))d+=` L ${point.map(f).join(' ')}`;}else for(let i=1;i+2<p.points.length;i+=3)d+=` C ${p.points.slice(i,i+3).flat().map(f).join(' ')}`;return d+(p.closed?' Z':'');}
export function moduleSVG(m){const {x,y,r,shape,roundness}=m,X=f(x),Y=f(y),R=f(r);if(shape==='square'||shape==='rounded')return `<rect x="${f(x-r)}" y="${f(y-r)}" width="${f(r*2)}" height="${f(r*2)}" rx="${shape==='square'?0:f(r*roundness/100)}"/>`;if(shape==='diamond')return `<path d="M ${X} ${f(y-r*1.2)} L ${f(x+r*1.2)} ${Y} L ${X} ${f(y+r*1.2)} L ${f(x-r*1.2)} ${Y} Z"/>`;if(shape==='ring'){const hole=Math.max(2.5,r*.16);return `<path fill-rule="evenodd" d="M ${f(x+r)} ${Y} a ${R} ${R} 0 1 0 ${f(-2*r)} 0 a ${R} ${R} 0 1 0 ${f(2*r)} 0 M ${f(x+hole)} ${Y} a ${f(hole)} ${f(hole)} 0 1 0 ${f(-2*hole)} 0 a ${f(hole)} ${f(hole)} 0 1 0 ${f(2*hole)} 0"/>`;}
if(shape==='arc'&&(m.dot!==undefined||m.end))return [1,.74,.48].map(k=>`<circle cx="${X}" cy="${Y}" r="${f(r*k)}" fill="none" stroke="currentColor" stroke-width="${f(Math.max(3,r*.11))}"/>`).join('');
if(shape==='arc'){let out='';for(const k of [1,.74,.48]){const rr=r*k,a=m.angle+.42,b=a+Math.PI*1.68;out+=`<path fill="none" stroke="currentColor" stroke-width="${f(Math.max(3,r*.11))}" stroke-linecap="round" d="M ${f(x+rr*Math.cos(a))} ${f(y+rr*Math.sin(a))} A ${f(rr)} ${f(rr)} 0 1 1 ${f(x+rr*Math.cos(b))} ${f(y+rr*Math.sin(b))}"/>`;}return out;}
if(shape==='blob'){let out=`<circle cx="${X}" cy="${Y}" r="${f(r*.83)}"/>`;for(let i=0;i<4;i++){const a=m.angle+i*Math.PI/2;out+=`<circle cx="${f(x+Math.cos(a)*r*.67)}" cy="${f(y+Math.sin(a)*r*.67)}" r="${f(r*.39)}"/>`;}return out;}
return `<circle cx="${X}" cy="${Y}" r="${R}"/>`;}
export function glyphSVG(scene,appearance){const a=appearance?readAppearance(appearance):null;return scene.modules.map(m=>{const svg=moduleSVG(m);return a?inkModuleSVG(svg,a):svg;}).join('');}
export const escapeXML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const FEATURE_FIGURES='0123456789',FEATURE_CASE='-‐–—()[]{}«»‹›@·¡¿';
export function layoutText(text,skeletons,settings,options={}){
 text=String(text).normalize('NFC');
 const s={...DEFAULT,...settings},limit=options.maxWidth||Infinity,cache=new Map(),items=[],missing=new Set();let x=30,y=0,max=0,widest=0,previous=null,last=null;
 // Glyphs by key: a drawing, or one a script pack builds; a shaped run may use form keys.
 const glyph=key=>glyphOf(skeletons,key),get=key=>{if(!cache.has(key))cache.set(key,generateGlyph(glyph(key),s));return cache.get(key);},isMark=key=>typeof glyph(key)?.mark==='string';
 // Live OpenType features for the specimens, matching the compiled fonts: tabular
 // figures share the widest figure's advance, centred, without kerning; case forms
 // centre dashes, brackets, guillemets and @ on the capitals.
 const features=options.features||{},tabularFigure=c=>features.tnum&&FEATURE_FIGURES.includes(c)&&!!glyph(c),tabular=features.tnum?Math.max(0,...[...FEATURE_FIGURES].filter(c=>glyph(c)).map(c=>get(c).advance)):0,capMiddle=features.case&&glyph('H')?(get('H').bounds.minY+get('H').bounds.maxY)/2:null;
 const caseShift=c=>{if(capMiddle===null||!FEATURE_CASE.includes(c))return 0;const b=get(c).bounds,dy=Math.round(capMiddle-(b.minY+b.maxY)/2);return Math.abs(dy)<10?0:dy;};
 const advance=key=>key===' '?spaceAdvance(s):glyph(key)?isMark(key)?0:tabularFigure(key)?tabular:get(key).advance:spaceAdvance(s);
 const kern=(a,b)=>options.kerning===false||!a||!b||!glyph(a)||!glyph(b)||isMark(b)||tabularFigure(a)||tabularFigure(b)?0:pairKerning(get(a),get(b),s);
 // Words are shaped by their scripts into the cells they are drawn with (a cell is a glyph key and the text it stands for).
 const tokens=String(text).replace(/\r/g,'').split(/(\n| +)/).filter(Boolean).map(t=>t==='\n'||/^ +$/.test(t)?t:shapeText(t));
 const used=[...new Set(tokens.flatMap(t=>typeof t==='string'?[]:t.map(c=>c.key)).filter(k=>glyph(k)))].map(get),minY=used.length?Math.min(...used.map(sc=>sc.bounds.minY)):30,maxY=used.length?Math.max(...used.map(sc=>sc.bounds.maxY)):1180,topMargin=Math.max(0,30-minY),lineAdvance=Math.max(1250,maxY-minY+120);
 const newline=()=>{max=Math.max(max,x);x=30;y+=lineAdvance;previous=null;last=null;};
 // Where a caret stands before each character (UTF-16 index), and after the last.
 const carets=[],caret=(n=1)=>{for(let i=0;i<n;i++)carets.push({x,y:y+topMargin});};
 const write=cell=>{const key=cell.key,n=cell.text.length;
  // A combining mark hangs on the glyph before it: its attachment point meets the host's
  // above or below anchor, and a stack of marks climbs from mark to mark. It takes no advance.
  if(glyph(key)&&isMark(key)&&last){const scene=get(key),anchor=last.scene.anchors[scene.markType==='below'?'below':'above'],at=scene.anchors.mark,item={char:key,x:last.x+anchor[0]-at[0],y:last.y+anchor[1]-at[1],scene,kerning:0,mark:true};items.push(item);caret(n);last=item;return;}
  const a=advance(key);widest=Math.max(widest,a+60);let k=kern(previous,key);if(Number.isFinite(limit)&&x>30&&x+k+a+30>limit){newline();k=0;}x+=k;caret(n);if(glyph(key)){const scene=get(key),item={char:key,x:x+scene.offsetX+(tabularFigure(key)?(tabular-scene.advance)/2:0),y:y+topMargin+caseShift(key),scene,kerning:k};items.push(item);previous=key;last=item;}else{if(key!==' ')missing.add(key);previous=null;last=null;}x+=a;};
 for(const token of tokens){
  if(token==='\n'){caret();newline();continue;}
  if(typeof token==='string'){const moves=!Number.isFinite(limit)||x>30;for(let i=0;i<token.length;i++){caret();if(moves)x+=advance(' ');}previous=null;last=null;continue;}
  // Lines break between words and, in the scripts written without spaces, between
  // characters: each full-em character is its own unit, with its marks.
  const units=[];for(const cell of token){const fixed=isFixedScript(cell.key),m=glyph(cell.key)&&isMark(cell.key);if(!units.length||(!m&&(fixed||units.at(-1).fixed)))units.push({cells:[cell],fixed});else units.at(-1).cells.push(cell);}
  for(const unit of units){let l=previous,length=0;for(const c of unit.cells){length+=advance(c.key)+kern(l,c.key);if(glyph(c.key)&&!isMark(c.key))l=c.key;}
   if(Number.isFinite(limit)&&x>30&&x+length+30>limit)newline();
   for(const c of unit.cells)write(c);}
 }
 caret();
 // Ink hanging left of a line start (the tail of j) moves the whole layout right
 // by that amount, so the stems of every line stay aligned and nothing is clipped.
 let under=0,right=0,above=0,below=0;for(const i of items){under=Math.min(under,i.x+i.scene.bounds.minX);above=Math.min(above,i.y+i.scene.bounds.minY-30);below=Math.max(below,i.y+i.scene.bounds.maxY+30);}if(under<0){for(const i of items)i.x-=under;for(const c of carets)c.x-=under;x-=under;max-=under;}
 // Marks stacked above the first line (a tone over a vowel sign) move every line down by their reach, so they are not clipped.
 if(above<0){for(const i of items)i.y-=above;for(const c of carets)c.y-=above;}for(const i of items)right=Math.max(right,i.x+i.scene.bounds.maxX+30);
 return {items,carets,width:Number.isFinite(limit)?Math.max(limit,widest,right):Math.max(250,max+30,x+30),height:Math.max(y+Math.max(1210,maxY+30)+topMargin,below)-Math.min(0,above),missing:[...missing],lines:y/lineAdvance+1,lineAdvance};
}
export function specimenContent(layout,idPrefix='module-glyph',appearance){
 const unique=new Map();for(const item of layout.items)if(!unique.has(item.char))unique.set(item.char,item.scene);
 const id=char=>idPrefix+'-'+char.codePointAt(0);
 return '<defs>'+[...unique].map(([char,scene])=>'<g id="'+id(char)+'">'+glyphSVG(scene,appearance)+'</g>').join('')+'</defs>'+layout.items.map(i=>'<use href="#'+id(i.char)+'" x="'+f(i.x)+'" y="'+i.y+'"/>').join('');
}
export function specimenSVG(text,skeletons,settings,options={}){
 const l=options.layout||layoutText(text,skeletons,settings,options);
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+f(l.width)+' '+l.height+'" fill="currentColor" color="#111111" role="img" aria-label="'+escapeXML(text)+'"><title>'+escapeXML(text)+'</title>'+surfaceSVG(specimenContent(l,options.idPrefix,options.appearance),[0,0,l.width,l.height],options.appearance,{idPrefix:options.idPrefix||'specimen',pitch:options.gridPitch||120})+'</svg>';
}
// Serializable IR is the seam for future outline union and font compilation.
export function projectIR(skeletons,settings){return {schema:'module-type.project',version:1,metrics:METRICS,axes:AXES,settings,skeletons,glyphs:Object.entries(skeletons).map(([char,g])=>({unicode:char.codePointAt(0),name:char,advanceWidth:generateGlyph(g,settings).advance,originX:generateGlyph(g,settings).offsetX,modules:generateGlyph(g,settings).modules})),compiler:{status:'static-otf-ready',formats:['OTF'],outlinePrecision:'Integer font grid; sub-unit polygon flattening before outline union',plannedFormats:['TTF','WOFF2','variable fonts'],stages:['module primitives to cubic outlines','boolean union / remove overlaps','counter and winding validation','fixed-topology masters','font tables and metrics','OTF / TTF / WOFF2 packaging'],variableFontNote:'Sampling is discrete in this MVP. Variable-font masters require stable point topology; not directly compilable yet.'}};}
