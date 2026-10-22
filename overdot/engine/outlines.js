import Clipper from '../vendor/clipper.js';
import {METRICS} from './skeletons.js';
// Curves are flattened at sub-unit tolerance, then united on the font's integer
// grid. Rounding before union prevents new overlaps from CFF quantization.
const TOLERANCE=.18;
function arc(x,y,r,a,b){const step=2*Math.acos(Math.max(-1,1-TOLERANCE/Math.max(r,TOLERANCE))),n=Math.max(2,Math.ceil(Math.abs(b-a)/step));return Array.from({length:n+1},(_,i)=>{const t=a+(b-a)*i/n;return [x+r*Math.cos(t),y+r*Math.sin(t)];});}
function circle(x,y,r){return arc(x,y,r,0,Math.PI*2).slice(0,-1);}
export function moduleContours(m){
 const {x,y,r,shape,roundness}=m;if(![x,y,r,m.angle].every(Number.isFinite)||r<=0)throw Error('Invalid module geometry.');
 if(shape==='square'||shape==='rounded'){
  const q=shape==='square'?0:r*roundness/100;
  if(q<.01)return [[[x-r,y-r],[x+r,y-r],[x+r,y+r],[x-r,y+r]]];
  return [[...arc(x+r-q,y-r+q,q,-Math.PI/2,0),...arc(x+r-q,y+r-q,q,0,Math.PI/2),...arc(x-r+q,y+r-q,q,Math.PI/2,Math.PI),...arc(x-r+q,y-r+q,q,Math.PI,Math.PI*1.5)]];
 }
 if(shape==='diamond')return [[[x,y-r*1.2],[x+r*1.2,y],[x,y+r*1.2],[x-r*1.2,y]]];
 if(shape==='ring')return [circle(x,y,r),circle(x,y,Math.max(2.5,r*.16)).reverse()];
 if(shape==='blob')return [circle(x,y,r*.83),...Array.from({length:4},(_,i)=>{const a=m.angle+i*Math.PI/2;return circle(x+Math.cos(a)*r*.67,y+Math.sin(a)*r*.67,r*.39);})];
 // A lone module (the dot of i, a full stop) has no neighbour to close its
 // arcs, and a free stroke end would read as a "c", so both take complete rings.
 if(shape==='arc'&&(m.dot!==undefined||m.end)){const t=Math.max(3,r*.11)/2;return [1,.74,.48].flatMap(k=>[circle(x,y,r*k+t),circle(x,y,r*k-t).reverse()]);}
 if(shape==='arc'){
  const a=m.angle+.42,b=a+Math.PI*1.68,t=Math.max(3,r*.11)/2;
  return [1,.74,.48].flatMap(k=>{const rr=r*k,start=[x+rr*Math.cos(a),y+rr*Math.sin(a)],end=[x+rr*Math.cos(b),y+rr*Math.sin(b)];return [[...arc(x,y,rr+t,a,b),...arc(x,y,rr-t,b,a)],circle(...start,t),circle(...end,t)];});
 }
 if(shape!=='circle')throw Error('Unknown module shape.');return [circle(x,y,r)];
}
// The circles each module's outline is made of (centre and radius, skeleton
// coordinates), so the font writer can draw their arcs as curves.
export function moduleCircles(m){const {x,y,r,shape}=m;if(shape==='circle')return [[x,y,r]];if(shape==='ring')return [[x,y,r],[x,y,Math.max(2.5,r*.16)]];
 if(shape==='blob')return [[x,y,r*.83],...Array.from({length:4},(_,i)=>{const a=m.angle+i*Math.PI/2;return [x+Math.cos(a)*r*.67,y+Math.sin(a)*r*.67,r*.39];})];
 if(shape==='rounded'){const q=r*m.roundness/100;return q<.01?[]:[[1,1],[1,-1],[-1,1],[-1,-1]].map(([i,j])=>[x+i*(r-q),y+j*(r-q),q]);}
 if(shape==='arc'){const t=Math.max(3,r*.11)/2,full=m.dot!==undefined||m.end;return [1,.74,.48].flatMap(k=>{const rr=r*k,a=m.angle+.42,b=a+Math.PI*1.68;return full?[[x,y,rr+t],[x,y,rr-t]]:[[x,y,rr+t],[x,y,rr-t],[x+rr*Math.cos(a),y+rr*Math.sin(a),t],[x+rr*Math.cos(b),y+rr*Math.sin(b),t]];});}
 return [];}
const inside=(c,p)=>{let odd=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a.Y>c.Y)!==(b.Y>c.Y)&&c.X<(b.X-a.X)*(c.Y-a.Y)/(b.Y-a.Y)+a.X)odd=!odd;}return odd;};
export function sceneContours(scene,{fontCoordinates=false}={}){
 const scale=fontCoordinates?1:64;
 const transform=([x,y])=>({X:Math.round((fontCoordinates?x+scene.offsetX:x)*scale),Y:Math.round((fontCoordinates?METRICS.baseline-y:y)*scale)});
 const paths=scene.modules.flatMap(m=>moduleContours(m).map(p=>p.map(transform))).map(p=>p.filter((q,i)=>i===0||q.X!==p[i-1].X||q.Y!==p[i-1].Y)).filter(p=>p.length>=3&&Math.abs(Clipper.Clipper.Area(p))>=.5);
 const clip=new Clipper.Clipper();clip.StrictlySimple=true;clip.AddPaths(paths,Clipper.PolyType.ptSubject,true);const solution=[];
 if(!clip.Execute(Clipper.ClipType.ctUnion,solution,Clipper.PolyFillType.pftNonZero,Clipper.PolyFillType.pftNonZero))throw Error('Could not merge the glyph outlines.');
 // Pinholes left where modules nearly meet are filled. Ring and arc modules keep
 // their designed openings, which are larger than this threshold. Slivers the
 // union leaves where lobes graze each other are dropped.
 // Ring holes stay open at every module size (small tapered modules included).
 const pinhole=.045*(scene.radius||0)**2*scale*scale,sliver=4*scale*scale,centres=scene.modules[0]?.shape==='ring'?scene.modules.map(m=>transform([m.x,m.y])):[];
 return solution.filter(p=>{const area=Clipper.Clipper.Area(p);return area>=0?area>=sliver:scene.modules[0]?.shape==='arc'||-area>=pinhole||centres.some(c=>inside(c,p));}).map(p=>p.map(q=>[q.X/scale,q.Y/scale]));
}
export function contourArea(points){return points.reduce((area,[x,y],i)=>{const [nx,ny]=points[(i+1)%points.length];return area+x*ny-nx*y;},0)/2;}
