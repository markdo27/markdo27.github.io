// Immutable document edits. Sync uses a shared normalized design space,
// rather than an arbitrary node index across unrelated glyph topologies.
export function editPoint(skeletons,char,selection,target,{sync=false,radius=.32}={}){
 const source=skeletons[char],point=source.paths[selection.p].points[selection.i];
 const dx=target[0]-point[0],dy=target[1]-point[1],origin=[point[0]/source.width,point[1]/1000];
 // Only glyphs that move are copied; the rest keep their identity, so their
 // cached renderings stay valid. Accents and accented letters never follow a
 // sync: accented letters are rebuilt from their base letters and accents.
 const output={...skeletons},changed=[];
 for(const [letter,original]of Object.entries(skeletons)){
  if(letter!==char&&(!sync||original.composite||original.mark))continue;let g=null;
  for(let pi=0;pi<original.paths.length;pi++){
   const p=original.paths[pi],points=p.points,shifts=new Map();
   for(let i=0;i<points.length;i++){
    if(p.kind==='bezier'&&i%3!==0)continue;
    const q=points[i],exact=letter===char&&Math.abs(q[0]-point[0])<.01&&Math.abs(q[1]-point[1])<.01;
    const distance=Math.hypot((q[0]/original.width-origin[0])*1.05,q[1]/1000-origin[1]);
    const amount=exact?1:sync&&distance<radius?(1-distance/radius)**2*(1+2*distance/radius):0;
    if(!amount)continue;const shift=[dx*(letter===char?1:original.width/source.width)*amount,dy*amount];
    g??=structuredClone(original);g.paths[pi].points[i]=[q[0]+shift[0],q[1]+shift[1]];shifts.set(i,shift);
   }
   if(p.kind==='bezier')for(let i=0;i<points.length;i++){
    if(i%3===0)continue;const owner=i%3===1?i-1:i+1,shift=shifts.get(owner);
    if(shift)g.paths[pi].points[i]=[points[i][0]+shift[0],points[i][1]+shift[1]];
   }
  }
  if(letter===char&&source.paths[selection.p].kind==='bezier'&&selection.i%3!==0){g??=structuredClone(original);g.paths[selection.p].points[selection.i]=[...target];}
  if(g){output[letter]=g;changed.push(letter);}
 }
 return {skeletons:output,changed};
}
const normalized=(point,g)=>[(point[0]-g.width/2)/g.width,(point[1]-880)/700];
function solve(matrix,vector){const rows=matrix.map((r,i)=>[...r,vector[i]]);for(let i=0;i<3;i++){let pivot=i;for(let j=i+1;j<3;j++)if(Math.abs(rows[j][i])>Math.abs(rows[pivot][i]))pivot=j;[rows[i],rows[pivot]]=[rows[pivot],rows[i]];if(Math.abs(rows[i][i])<1e-9)return null;const scale=rows[i][i];for(let k=i;k<4;k++)rows[i][k]/=scale;for(let j=0;j<3;j++)if(j!==i){const factor=rows[j][i];for(let k=i;k<4;k++)rows[j][k]-=factor*rows[i][k];}}return rows.map(r=>r[3]);}
export function fitProportions(canonical,edited){
 if(canonical.paths.length!==edited.paths.length||canonical.paths.some((p,i)=>p.points.length!==edited.paths[i].points.length))throw Error('Proportion matching needs the original path structure. Use Sync for a custom structure.');
 const pairs=[];canonical.paths.forEach((p,pi)=>p.points.forEach((q,i)=>{if(p.kind==='poly'||i%3===0)pairs.push([normalized(q,canonical),normalized(edited.paths[pi].points[i],edited)]);}));
 const matrix=Array.from({length:3},()=>[0,0,0]),vx=[0,0,0],vy=[0,0,0];for(const [a,b]of pairs){const row=[a[0],a[1],1];for(let i=0;i<3;i++){vx[i]+=row[i]*b[0];vy[i]+=row[i]*b[1];for(let j=0;j<3;j++)matrix[i][j]+=row[i]*row[j];}}
 const x=solve(matrix,vx),y=solve(matrix,vy);if(!x||!y)throw Error('Choose a letter with points across both directions, such as H, O or a.');
 if(x[0]<.55||x[0]>1.65||y[1]<.55||y[1]>1.65||Math.abs(x[1])>.65||Math.abs(y[0])>.35||Math.abs(x[2])>.35||Math.abs(y[2])>.35)throw Error('These edits are too large to match safely. Try a smaller change or use Sync.');
 return {x,y,error:Math.sqrt(pairs.reduce((sum,[a,b])=>sum+(x[0]*a[0]+x[1]*a[1]+x[2]-b[0])**2+(y[0]*a[0]+y[1]*a[1]+y[2]-b[1])**2,0)/pairs.length)};
}
export function applyProportions(skeletons,canonical,char,previous={x:[1,0,0],y:[0,1,0]}){
 const fit=fitProportions(canonical[char],skeletons[char]);const next=structuredClone(skeletons);
 const determinant=previous.x[0]*previous.y[1]-previous.x[1]*previous.y[0];
 if(!Number.isFinite(determinant)||Math.abs(determinant)<1e-6)throw Error('The previous proportion frame is invalid.');
 const inverseX=[previous.y[1]/determinant,-previous.x[1]/determinant],inverseY=[-previous.y[0]/determinant,previous.x[0]/determinant];
 const unapply=([x,y])=>[inverseX[0]*(x-previous.x[2])+inverseX[1]*(y-previous.y[2]),inverseY[0]*(x-previous.x[2])+inverseY[1]*(y-previous.y[2])];
 // Apply only the selected letter's delta to the other letters. Its detailed
 // drawing and the existing individual edits in the other letters are retained.
 // Accents keep their drawing and accented letters are rebuilt from their bases.
 for(const [letter,g]of Object.entries(next))if(letter!==char&&!g.composite&&!g.mark)for(const p of g.paths)p.points=p.points.map(q=>{const [x,y]=unapply(normalized(q,g));return [(fit.x[0]*x+fit.x[1]*y+fit.x[2])*g.width+g.width/2,(fit.y[0]*x+fit.y[1]*y+fit.y[2])*700+880];});
 return {skeletons:next,fit};
}
