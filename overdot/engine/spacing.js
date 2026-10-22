// Shared preview/export spacing. Side bearings and kerning are measured from the
// placed modules, so redrawn letters space themselves; profiles are conservative
// horizontal ink envelopes.
// The stem bearing (H, n) of a style is a share of its stem rhythm: the n counter
// plus part of a stem, against the Bold Circle layers reference (about 38 units).
// Heavy styles, whose stems are thick beside small counters, open up; light wide
// styles, whose counters are wide beside thin stems, close up.
export function stemBearing(s,radius,edge=1,widen=0){const wd=s.width/100,extra=Math.max(0,s.size-100)*.035;if(!s.optical||!radius)return 36*wd+extra;const counter=Math.max(20,410*wd-2*radius*edge+widen),stem=2*radius*edge;return .0981*(counter+.675*stem)+extra;}
function extent(m,y,band=8){const dy=Math.max(0,Math.abs(y-m.y)-band),r=m.r;if(m.shape==='diamond'){const q=r*1.2;return dy<=q?q-dy:null;}if(m.shape==='square'||m.shape==='rounded'){if(dy>r)return null;const q=m.shape==='rounded'?r*m.roundness/100:0;return dy<=r-q?r:r-q+Math.sqrt(Math.max(0,q*q-(dy-(r-q))**2));}const q=r*(m.shape==='blob'?1.07:m.shape==='arc'?1.06:1);return dy<=q?Math.sqrt(Math.max(0,q*q-dy*dy)):null;}
// Exact ink extremes of rows 8 units apart; rows without ink are left out.
function rowsOf(modules,top,bottom){const rows=[];for(let y=top;y<=bottom;y+=8){let l=Infinity,r=-Infinity;for(const m of modules){const dx=extent(m,y,0);if(dx!==null){l=Math.min(l,m.x-dx);r=Math.max(r,m.x+dx);}}if(l!==Infinity)rows.push([y,l,r]);}return rows;}
// Mean white between one side's extreme and its profile. White deeper than
// `depth` (open sides, overhangs, diagonals) counts only to that depth.
function white(rows,right,depth){const xs=rows.map(r=>right?r[2]:r[1]),extreme=right?Math.max(...xs):Math.min(...xs);return {extreme,white:xs.reduce((n,x)=>n+Math.min(depth,Math.abs(x-extreme)),0)/xs.length};}
// The white of a straight stem of this style (its round ends and module scallops).
const STEM=new Map();
function stemWhite(shape,r,step,top,depth,roundness){const key=[shape,r,step,top,depth,roundness].join();if(!STEM.has(key)){if(STEM.size>500)STEM.clear();const reach=r*(shape==='diamond'?1.2:shape==='blob'?1.07:shape==='arc'?1.06:1),ms=[];for(let y=top+reach;y<880-reach;y+=step)ms.push({x:0,y,r,shape,roundness});ms.push({x:0,y:880-reach,r,shape,roundness});STEM.set(key,white(rowsOf(ms,top,880),false,depth).white);}return STEM.get(key);}
// Side bearings follow the white each side shows within its zone (x-height or
// cap height; punctuation within its own ink): every side gives the same white
// as a straight stem. Round, open and diagonal sides take less space, and parts
// outside the zone (the tail of j, the hook of f) may reach into it. No side
// takes less than half a stem bearing: open and diagonal sides (v, y, the
// crossbars of t and f, the arm of r) keep a share of the style's rhythm, so vv
// and tt sit at about 0.6 of the n–n gap in every style.
export function glyphSpacing(glyph,bounds,s,{radius,edge=1,widen=0,modules,zoneTop,step}={}){const wd=s.width/100,unit=stemBearing(s,radius,edge,widen),inkWidth=bounds.maxX-bounds.minX;let left=unit,right=unit,floating=false;
 if(s.optical&&radius&&modules?.length&&Number.isFinite(zoneTop)){const depth=1.2*unit;let rows=rowsOf(modules,zoneTop,880);if(!rows.length){const ys=modules.map(m=>m.y);rows=rowsOf(modules,Math.min(...ys),Math.max(...ys));}
  if(rows.length){const h=880-zoneTop,top=rows[0][0],bottom=rows.at(-1)[0];floating=top>zoneTop+.2*h&&bottom<880-.2*h;const stem=stemWhite(s.shape,radius,step||radius,zoneTop,depth,s.roundness),a=white(rows,false,depth),b=white(rows,true,depth);left=unit-.8*(a.white-stem)-(a.extreme-bounds.minX);right=unit-.8*(b.white-stem)-(bounds.maxX-b.extreme);}}
 const floor=Math.max(14,Math.round(.5*unit)),leftBearing=Math.max(floor,Math.round(left)),rightBearing=Math.max(floor,Math.round(right)),natural=Math.max(Math.round(inkWidth+leftBearing+rightBearing+s.tracking),Math.ceil(inkWidth+leftBearing+8));
 // Math signs share the advance of the plus sign so they align in columns.
 if(glyph.math&&radius){const side=Math.max(14,Math.round(s.optical?.78*unit:unit)),advance=Math.max(natural,Math.round(460*wd+2*radius*edge+2*side+s.tracking)),l=Math.round((advance-inkWidth)/2);return {offsetX:l-bounds.minX,advance,leftBearing:l,rightBearing:advance-inkWidth-l,unit,floating};}
 return {offsetX:leftBearing-bounds.minX,advance:natural,leftBearing,rightBearing:natural-inkWidth-leftBearing,unit,floating};}
export const spaceAdvance=s=>Math.max(100,Math.round(280*s.width/100+s.tracking));
export function inkProfile(scene){const rows=[];for(let y=Math.floor(scene.bounds.minY/16)*16;y<=scene.bounds.maxY+8;y+=16){let left=Infinity,right=-Infinity;for(const m of scene.modules){const dx=extent(m,y);if(dx!==null){left=Math.min(left,m.x-dx+scene.offsetX);right=Math.max(right,m.x+dx+scene.offsetX);}}if(left!==Infinity)rows.push([y,left,right]);}return rows;}
// How far the second glyph must move right so that every pair of modules keeps
// at least `gap` of white (module reach as in the profiles; square corners
// count in full). Used only where the coarse profiles report a collision.
const reach=m=>m.r*(m.shape==='diamond'?1.2:m.shape==='blob'?1.07:m.shape==='arc'?1.06:m.shape==='square'?Math.SQRT2:m.shape==='rounded'?1+(Math.SQRT2-1)*(1-m.roundness/100):1);
function clearance(left,right,gap){return moduleClearance(left.modules,right.modules,left.advance+right.offsetX-left.offsetX,gap);}
function moduleClearance(A,B,dx,gap){let open=-Infinity;for(const m of A){const rm=reach(m);for(const q of B){const d=gap+rm+reach(q),dy=q.y-m.y;if(Math.abs(dy)<d)open=Math.max(open,Math.sqrt(d*d-dy*dy)-(q.x+dx-m.x));}}return open;}
// Kerning closes the white a pair shows beyond the style's stem gap at its
// closest shared row (the side bearings already balance white within reach):
// the first two stem bearings fully, deeper overhangs (To, P., L’) by 0.45, so
// the second glyph tucks in partly. Marks floating at mid-height (dashes) close
// only the first part, so they do not sit inside an L or a C; so do capitals
// after lowercase (oT, aV, s’), whose arms would otherwise cover the letter
// before them, a word part they do not belong to. Pairs that share no row (.’
// ”, ’.) close on their ink boxes to a quarter of a stem bearing, so the quote
// rides over the edge of the point. Ink in neighbouring rows keeps a round
// clearance of 0.8 of the pair's own gap, so terminals, tails and apertures do
// not collide. A pair whose ink comes closer than half its gap anywhere (an
// accent over the next ascender, a hook beside a quote) opens until it keeps
// that half. Values under a tenth of a stem bearing are dropped; they are
// invisible and only enlarge the font.
export function pairKerning(left,right,s){if(!s.optical||left.fixed||right.fixed||left.markType||right.markType)return 0;const k=basePairKerning(left,right,s);if(!(left.markProfile||right.markProfile))return k;const unit=(left.unit+right.unit)/2||36,open=markClearance(left,right,unit+s.tracking/2);return open>0?Math.max(k,open>=Math.max(3,.1*unit)?Math.ceil(open):0):k;}
// Accents keep half the style's stem gap (half of H–H) from the neighbouring
// letter's ink. Their letter's side bearings ignore them, so the diaeresis and
// circumflex over i overhang its advance and, beside a diagonal, a quote or a
// crossbar (Vï, ’ï, fï, Tî), the pair's own half gap left them 0.35 of H–H apart.
// The profiles say whether a pair comes close; the modules then give the exact
// shift. A pair the base kerning would set closer opens to this instead.
function markClearance(left,right,G){const advance=left.advance,span=G+16;let open=0;
 for(const [A,B]of [[left.markProfile,right.profile],[left.profile,right.markProfile]]){if(!A||!B)continue;for(let i=0,j=0;i<A.length;i++){const a=A[i];while(j<B.length&&B[j][0]<a[0]-span)j++;for(let k=j;k<B.length&&B[k][0]<=a[0]+span;k++){const b=B[k],dy=Math.max(0,Math.abs(b[0]-a[0])-16),h=advance+b[1]-a[2];if(dy<G)open=Math.max(open,Math.sqrt(G*G-dy*dy)-h);}}}
 if(!(open>0))return 0;const dx=advance+right.offsetX-left.offsetX,marks=g=>g.modules.filter(m=>g.paths[m.path]?.mark||g.paths[m.path]?.horn);
 return Math.max(left.markProfile?moduleClearance(marks(left),right.modules,dx,G):0,right.markProfile?moduleClearance(left.modules,marks(right),dx,G):0);}
function basePairKerning(left,right,s){const A=left.profile,B=right.profile,advance=left.advance,target=left.rightBearing+right.leftBearing,unit=(left.unit+right.unit)/2||36,floating=left.floating||right.floating;
 let gap=Infinity,want=0,i=0,j=0,inkRight=-Infinity,inkLeft=Infinity,top=Infinity,bottom=-Infinity,edgeA=-Infinity,edgeB=Infinity;while(i<A.length&&j<B.length){const a=A[i],b=B[j];if(a[0]===b[0]){gap=Math.min(gap,advance+b[1]-a[2]);top=Math.min(top,a[0]);bottom=Math.max(bottom,a[0]);edgeA=Math.max(edgeA,a[2]);edgeB=Math.min(edgeB,b[1]);i++;j++;}else if(a[0]<b[0])i++;else j++;}
 for(const a of A)inkRight=Math.max(inkRight,a[2]);for(const b of B)inkLeft=Math.min(inkLeft,b[1]);const box=advance+inkLeft-inkRight;
 // A single bead floating at mid-height (the middle dot of Catalan l·l) is a
 // letter part: it closes to the stem gap over a foot or under an arm (l·, L·,
 // ·1), so it stands midway between the stems; against ink both above and
 // below it (c·, C·, ·)) it keeps the floating limit, so it never enters an aperture.
 const bead=sc=>sc.floating&&sc.modules.length===1,oneSided=(P,beyond)=>{let above=false,below=false;for(const p of P)if(beyond(p)){if(p[0]<top)above=true;else if(p[0]>bottom)below=true;}return !(above&&below);};
 const nestles=Number.isFinite(gap)&&(bead(right)&&!bead(left)?oneSided(A,a=>a[2]>edgeA+2):bead(left)&&!bead(right)?oneSided(B,b=>b[1]<edgeB-2):false);
 if(Number.isFinite(gap)){const close=gap-Math.max(target,2*unit+s.tracking);if(close>0)want=nestles?close:Math.min(close,2*unit)+(floating||left.zone!=='cap'&&right.zone==='cap'?0:.45*Math.max(0,close-2*unit));}
 else if(!floating&&!left.math&&!right.math)want=Math.max(0,box-.25*unit);
 const D=.8*target,G=.5*target;let open=0;
 if(want>0||box<G){const span=Math.max(D,G)+16;for(let i=0,j=0;i<A.length;i++){const a=A[i];while(j<B.length&&B[j][0]<a[0]-span)j++;for(let k=j;k<B.length&&B[k][0]<=a[0]+span;k++){const b=B[k],dy=Math.max(0,Math.abs(b[0]-a[0])-16),h=advance+b[1]-a[2];if(dy<G)open=Math.max(open,Math.sqrt(G*G-dy*dy)-h);if(want>0&&b[0]!==a[0]&&dy<D)want=Math.min(want,h-Math.sqrt(D*D-dy*dy));}}}
 if(!(want>0)){if(!(open>=Math.max(3,.1*unit)))return 0;const k=Math.ceil(clearance(left,right,G));return k>=Math.max(3,.1*unit)?k:0;}
 // A figure's left side interlocks only a little: numbers set in columns and
 // after decimal points and commas (0.4, 2,4). So do math signs on either side:
 // they keep their own space and do not tuck into an open letter (C÷, T+, L=).
 // The bead closes the whole way to the stem gap, which bounds it; other pairs close by at most 0.36 of the wider advance.
 const limit=right.figure||left.math||right.math?Math.min(50*s.width/100,Math.min(left.advance,right.advance)*.1):nestles?want:Math.max(left.advance,right.advance)*.36,k=Math.ceil(Math.max(-limit,-want));
 return k<=-Math.max(3,.1*unit)?k:0;}
