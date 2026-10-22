// Thai pack: the Thai block (U+0E01–0E5B) drawn by hand in Overdot's geometric
// monoline, following docs/scripts.md. Thai letters are loop-and-stroke forms:
// a stroke starts at a "head" (a loop, a notch or a curl) and runs through
// stems, arches and bowls. The heads are the natural fit for dot modules, so
// every loop is a true ring, 200 units across on the centreline, which keeps a
// counter about 135 units wide at Bold (its modules are drawn at .85 so the
// counter survives one weight heavier).
//
// Zone 'cap': the body runs from 330 (top) to the 880 baseline, about 0.8 of
// the Latin capitals, so Thai sits a little under Latin caps and over the
// x-height, as in mixed setting. Ascenders (ป ฝ ฟ ฬ ช ซ ส ศ) rise to 180–240,
// descenders (ฎ ฏ ฐ ญ ฤ ฦ ๅ ๆ ๙) go to about 1000–1075. Stems stand at x=100
// and at width−100, like the Latin letters, so the optical spacing fits them
// the same way.
//
// Marks are drawn around their own origin at the height they take over a plain
// consonant: above vowels between 185 and 265, tone marks between 10 and 100
// (their `mark` anchor at [0,140] meets a vowel's `above` anchor 15 under it,
// and a consonant's `above` anchor at 290 lowers a lone tone mark to the vowel
// level, 160 to 250, as Thai sets it). Below vowels hang between 975 and 1075.
const K=.55228475,R=n=>Math.round(n);
const line=(...p)=>({kind:'poly',points:p});
const round=(l,t,r,b)=>{const cx=(l+r)/2,cy=(t+b)/2,rx=(r-l)/2,ry=(b-t)/2;return {kind:'bezier',closed:true,points:[[cx,t],[cx+K*rx,t],[r,cy-K*ry],[r,cy],[r,cy+K*ry],[cx+K*rx,b],[cx,b],[cx-K*rx,b],[l,cy+K*ry],[l,cy],[l,cy-K*ry],[cx-K*rx,t],[cx,t]]};};
// A head loop: a ring 200 across, tangent to the stroke it starts; its modules
// are drawn at .85 so the counter stays open at Black.
const ring=(cx,cy,d=200,scale=.85)=>({...round(cx-d/2,cy-d/2,cx+d/2,cy+d/2),scale});
// One continuous stroke as a cubic run: L x,y (a straight piece), A cx,cy,x,y
// (a quarter arc round the virtual corner cx,cy), C x1,y1,x2,y2,x,y (a cubic).
function P(start,...segs){const pts=[start];let c=start;for(const [k,...a]of segs){if(k==='L'){const [x,y]=a;pts.push([c[0]+(x-c[0])/3,c[1]+(y-c[1])/3],[c[0]+(x-c[0])*2/3,c[1]+(y-c[1])*2/3],[x,y]);c=[x,y];}else if(k==='A'){const [cx,cy,x,y]=a;pts.push([c[0]+K*(cx-c[0]),c[1]+K*(cy-c[1])],[x+K*(cx-x),y+K*(cy-y)],[x,y]);c=[x,y];}else{const [x1,y1,x2,y2,x,y]=a;pts.push([x1,y1],[x2,y2],[x,y]);c=[x,y];}}return {kind:'bezier',points:pts.map(([x,y])=>[R(x),R(y)])};}
const T=330,B=880;
// Recurring parts. The notch head (ข ช ถ ท …) is the hook Thai draws at the top
// left, cut as a V so two dot rows read it; the stem rises to the top line and
// dips before the top line continues. The arch is a flat top with 150-unit
// corners, squarer than the Latin n so the Thai top line stays level.
const headL=[['L',100,350],['L',210,490],['L',320,T]];       // ข-type head on the stem at 100
const hookL=[['L',100,400],['L',190,480],['L',270,T]];       // smaller hook head (ถ ท ธ ณ …)
const archR=r=>[['L',r-150,T],['A',r,T,r,T+150]];              // top line into the right corner
const stemNotch=[['L',100,700],['L',170,640],['L',100,580]];    // the ฃ ฅ ซ notch on the left stem
// A consonant: body width, paths, and its mark anchors (above the right part of
// the body, 290; under it, 930). Tall letters set their own.
const cons=(width,paths,anchors={})=>({width,zone:'cap',paths,anchors:{above:[R(width/2)+30,290],below:[R(width/2)+60,930],...anchors}});
const asc=(width,paths,stem)=>cons(width,paths,{above:[stem-270,260]});   // marks sit left of an ascender, at its height
const flick=x=>line([x,B],[x,T],[x,300],[x+45,235]);           // the ช ซ ส ศ tail: the right stem runs on past the top line

const consonants={
 'ก':cons(620,[P([100,B],['L',100,480],['A',100,T,250,T],...archR(520),['L',520,B])]),
 'ข':cons(620,[P([100,B],...headL,...archR(520),['L',520,B])]),
 'ฃ':cons(620,[P([100,B],...stemNotch,...headL,...archR(520),['L',520,B])]),
 // ค ต ฅ ศ: a straight stem with the loop tucked inside under the closed top;
 // ต cuts its tooth into the top line, ฅ notches the stem under the loop.
 'ค':cons(620,[ring(200,560),P([100,B],['L',100,430],['A',100,T,200,T],...archR(520),['L',520,B])]),
 'ฅ':cons(620,[ring(200,560),P([100,B],['L',100,840],['L',170,790],['L',100,740],['L',100,430],['A',100,T,200,T],...archR(520),['L',520,B])]),
 'ฆ':cons(700,[ring(200,780),P([100,780],...headL,['L',380,T],['C',460,T,500,360,510,420],['L',600,B]),line([600,B],[600,T])]),
 'ง':cons(600,[P([110,T],['L',110,560],['C',110,700,200,B,350,B],['L',400,B],['A',500,B,500,780],['L',500,T])]),
 'จ':cons(620,[P([110,360],['L',130,T],['L',400,T],['A',520,T,520,450],['L',520,700],['A',520,B,340,B],['L',290,B],['A',110,B,110,700],['L',110,640])]),
 // ฉ closes its bottom: the loop at the foot of the left stem runs on along the baseline.
 'ฉ':cons(640,[ring(200,780),P([100,780],...hookL,...archR(540),['L',540,B],['L',200,B])]),
 'ช':cons(620,[P([100,B],...headL,['L',520,T]),flick(520)],{above:[300,290]}),
 'ซ':cons(620,[P([100,B],...stemNotch,...headL,['L',520,T]),flick(520)],{above:[300,290]}),
 // ฌ ญ ณ: the arch lands on a middle stem; ฌ hangs a second loop on it and a
 // diagonal to the right stem, ณ the diagonal alone, ญ a bowl and its tail.
 'ฌ':cons(870,[ring(200,780),ring(520,780),P([100,780],...hookL,['L',600,T],['L',770,B]),line([420,T],[420,780]),line([770,B],[770,T])],{above:[500,290]}),
 'ญ':cons(740,[ring(200,780),P([100,780],...hookL,['L',270,T],['A',420,T,420,480],['L',420,B],['L',640,B],['L',640,T]),P([400,975],['A',400,1035,470,1035],['L',590,1035],['A',660,1035,660,975])],{above:[430,290],below:[530,1085]}),
 'ฎ':cons(620,[ring(200,430),P([100,430],['L',100,700],['A',100,B,280,B],['L',340,B],['A',520,B,520,700],['L',520,T]),P([240,975],['A',240,1035,310,1035],['L',450,1035],['A',520,1035,520,975])],{below:[420,1085]}),
 'ฏ':cons(620,[ring(200,560),P([100,B],['L',100,430],['A',100,T,200,T],['L',310,T],['L',370,430],['L',430,T],['L',450,T],['A',520,T,520,400],['L',520,B]),line([220,975],[320,1040],[420,975],[520,1040])],{below:[420,1085]}),
 'ฐ':cons(620,[ring(200,780),P([100,780],...hookL,...archR(520),['L',520,1010],['L',395,1010]),ring(330,1010,130,.6)],{below:[300,1085]}),
 'ฑ':cons(680,[ring(200,780),P([100,780],...hookL,['L',300,T],['C',380,T,420,360,430,420],['L',580,B]),line([580,B],[580,T])]),
 // ภ ฒ ฤ: the bowed left stroke leaves the loop's top, bellies right and curls over into the top line.
 'ฒ':cons(680,[ring(200,780),P([200,680],['C',255,590,245,430,150,385],['C',110,360,130,T,230,T],['L',300,T],['C',380,T,420,360,430,420],['L',580,B]),line([580,B],[580,T])]),
 'ณ':cons(740,[ring(200,780),P([100,780],...hookL,['L',420,T],['L',640,B]),line([420,T],[420,B]),line([640,B],[640,T])],{above:[430,290]}),
 'ด':cons(620,[ring(200,430),P([100,430],['L',100,700],['A',100,B,280,B],['L',340,B],['A',520,B,520,700],['L',520,T])]),
 'ต':cons(620,[ring(200,560),P([100,B],['L',100,430],['A',100,T,200,T],['L',310,T],['L',370,430],['L',430,T],['L',450,T],['A',520,T,520,400],['L',520,B])]),
 'ถ':cons(620,[ring(200,780),P([100,780],...hookL,...archR(520),['L',520,B])]),
 'ท':cons(680,[P([100,B],...hookL,['L',300,T],['C',380,T,420,360,430,420],['L',580,B]),line([580,B],[580,T])]),
 // ธ: the top line with its head, the right stem, and a closed box in the lower half.
 'ธ':cons(620,[P([100,400],['L',190,480],['L',270,T],['L',450,T],['A',520,T,520,400],['L',520,700],['A',520,B,340,B],['L',280,B],['A',100,B,100,700],['L',100,560],['L',520,560])]),
 // น บ ป ผ ฝ พ ฟ ย ษ ห ฬ อ ฮ: the head is a loop at the top of the left stem.
 'น':cons(620,[ring(200,430),ring(420,780),line([100,430],[100,B],[420,B]),line([520,780],[520,T])]),
 'บ':cons(620,[ring(200,430),line([100,430],[100,B],[520,B],[520,T])]),
 'ป':asc(620,[ring(200,430),line([100,430],[100,B],[520,B],[520,180])],520),
 'ผ':cons(640,[ring(200,430),line([100,430],[100,B],[540,B],[540,T],[250,B])]),
 'ฝ':asc(640,[ring(200,430),line([100,430],[100,B],[540,B],[540,180],[250,B])],540),
 'พ':cons(700,[ring(200,430),line([100,430],[100,B],[600,B],[600,T]),line([250,B],[400,T],[600,B])]),
 'ฟ':asc(700,[ring(200,430),line([100,430],[100,B],[600,B],[600,180]),line([250,B],[400,T],[600,B])],600),
 'ภ':cons(620,[ring(200,780),P([200,680],['C',255,590,245,430,150,385],['C',110,360,130,T,230,T],...archR(520),['L',520,B])]),
 'ม':cons(660,[ring(200,780),P([100,780],['L',100,480],['A',100,T,250,T],['L',320,T],['C',400,T,440,360,450,420],['L',560,B]),line([560,B],[560,T])]),
 'ย':cons(620,[ring(200,430),line([100,430],[100,B],[520,B],[520,T]),line([100,640],[400,640],[430,600])]),
 // ร: a hook head starts the top line; the stem ends in a loop that bulges left.
 'ร':cons(560,[P([110,420],['L',200,480],['L',280,T],['L',440,T],['L',460,350],['L',460,780]),ring(360,780)]),
 // ล ส: the left stroke bows out and runs smoothly into the top line, no head notch.
 'ล':cons(620,[ring(200,780),P([100,780],['C',90,640,95,480,140,400],['C',165,360,220,T,300,T],...archR(520),['L',520,B])]),
 'ว':{width:520,zone:'cap',round:true,paths:[P([200,440],['C',180,T,520,320,520,560],['C',520,780,400,890,280,B],['C',190,875,110,800,110,700])],anchors:{above:[320,290],below:[320,930]}},
 'ศ':cons(620,[ring(200,560),P([100,B],['L',100,430],['A',100,T,200,T],['L',520,T]),flick(520)],{above:[300,290]}),
 'ษ':cons(620,[ring(200,430),line([100,430],[100,B],[520,B],[520,T]),line([520,640],[260,640],[230,600])]),
 'ส':cons(620,[ring(200,780),P([100,780],['C',90,640,95,480,140,400],['C',165,360,220,T,300,T],['L',520,T]),flick(520)],{above:[300,290]}),
 'ห':cons(620,[ring(200,430),line([100,430],[100,B]),P([130,870],['C',200,600,320,T,400,T],['C',470,T,520,380,520,480],['L',520,B])]),
 'ฬ':asc(620,[ring(200,430),line([100,430],[100,B]),P([130,870],['C',200,600,320,T,400,T],['C',470,T,520,380,520,480],['L',520,B]),line([520,480],[520,260]),ring(520,195,130,.65)],520),
 'อ':cons(620,[ring(200,430),P([200,T],['L',370,T],['A',520,T,520,480],['L',520,700],['A',520,B,340,B],['L',280,B],['A',100,B,100,700],['L',100,430])]),
 // ฮ: อ with the loop lowered so the top line can run on past it and curl down at the left.
 'ฮ':cons(620,[ring(200,620),P([140,420],['C',110,400,100,345,170,332],['L',370,T],['A',520,T,520,480],['L',520,700],['A',520,B,340,B],['L',280,B],['A',100,B,100,700],['L',100,620])]),
};
// The independent vowels and signs of the consonant range and after it.
const signs={
 'ฤ':cons(620,[ring(200,780),P([200,680],['C',255,590,245,430,150,385],['C',110,360,130,T,230,T],...archR(520),['L',520,1000])],{below:[400,1050]}),
 'ฦ':cons(620,[P([150,800],['C',90,650,95,480,140,400],['C',165,360,220,T,300,T],...archR(520),['L',520,1000])],{below:[400,1050]}),
 // ะ: two open rings stacked, each opening at its upper left as the written form does.
 'ะ':cons(400,[P([170,400],['C',250,340,330,400,330,470],['C',330,540,230,580,170,540]),P([170,660],['C',250,600,330,660,330,730],['C',330,800,230,840,170,800])]),
 // า carries its above anchor over the head, so nikhahit + า (the decomposition
 // HarfBuzz applies to ำ) draws the ring exactly where ำ has it.
 'า':cons(500,[P([150,480],['C',105,470,100,400,125,365],['C',145,340,180,T,240,T],['L',290,T],['A',400,T,400,480],['L',400,B])],{above:[170,270]}),
 // ำ: the nikhahit ring above-left of า, drawn as one glyph (the web layout uses it directly).
 'ำ':cons(500,[{...round(115,145,225,255),scale:.55},P([150,480],['C',105,470,100,400,125,365],['C',145,340,180,T,240,T],['L',290,T],['A',400,T,400,480],['L',400,B])]),
 'เ':cons(400,[ring(200,780),line([300,780],[300,T])]),
 'แ':cons(720,[ring(200,780),line([300,780],[300,T]),ring(520,780),line([620,780],[620,T])]),
 'โ':asc(440,[ring(200,780),line([300,780],[300,180],[410,190],[450,150])],300),
 'ใ':asc(400,[ring(200,780),P([300,780],['L',300,330],['C',300,220,250,150,180,160],['C',130,170,115,230,160,260])],300),
 'ไ':asc(400,[ring(200,780),line([300,780],[300,240],[250,195],[205,230]),line([300,240],[350,160])],300),
 'ๅ':cons(500,[P([150,480],['C',105,470,100,400,125,365],['C',145,340,180,T,240,T],['L',290,T],['A',400,T,400,480],['L',400,1000])],{above:[170,270],below:[300,1050]}),
 'ฯ':cons(500,[ring(200,430),P([200,T],['L',330,T],['A',400,T,400,400],['L',400,B])]),
 'ๆ':cons(500,[P([100,400],['L',190,480],['L',270,T],['L',330,T],['A',400,T,400,400],['L',400,1000])],{below:[300,1050]}),
 '฿':{width:660,zone:'cap',round:true,paths:[line([100,880],[100,180]),P([100,180],['C',710,100,710,575,100,525]),P([100,525],['C',740,440,740,965,100,880]),line([330,110],[330,950])]},
 '๏':{width:600,zone:'cap',round:true,paths:[round(140,440,460,760),line([300,600],[300,600])]},
 '๚':cons(660,[ring(200,430),P([200,T],['L',330,T],['A',400,T,400,400],['L',400,B]),line([540,T],[540,B])]),
 '๛':cons(860,[ring(200,600),line([300,600],[360,650],[420,550],[480,650],[540,550],[600,650],[660,600],[760,600])]),
};
// Digits: body height, widths like the Latin figures, `figure` for tabular setting.
const fig=(width,paths,round)=>({width,zone:'cap',figure:true,...(round?{round:true}:{}),paths});
const digits={
 '๐':fig(650,[round(125,430,525,880)],true),
 // ๑ is a spiral: an outer turn from the foot at the lower left, then an inner turn 120 units in.
 '๑':fig(650,[P([210,848],['C',130,760,110,620,170,520],['C',230,420,420,400,500,490],['C',580,580,560,760,450,800],['C',360,830,290,760,300,680],['C',310,610,380,590,400,620])],true),
 '๒':fig(620,[P([130,T],['L',130,760],['A',130,B,250,B],['L',400,B],['A',520,B,520,760],['L',520,640],['C',520,560,430,540,390,600])]),
 '๓':fig(640,[line([100,B],[100,540]),P([100,540],['A',100,400,210,400],['A',320,400,320,520],['A',320,400,430,400],['A',540,400,540,520],['L',540,760],['A',540,B,460,B],['L',400,B])]),
 '๔':fig(680,[line([430,270],[380,T],[100,T],[100,B],[480,B]),ring(480,780)]),
 '๕':fig(640,[line([430,270],[380,T],[100,T],[100,B],[480,B],[540,860],[560,800]),ring(200,560)]),
 '๖':fig(620,[ring(200,780),P([100,780],['L',100,480],['A',100,T,250,T],...archR(520),['L',520,640],['C',520,700,470,720,440,690])]),
 '๗':fig(620,[ring(200,430),P([100,430],['L',100,700],['A',100,B,280,B],['L',340,B],['A',520,B,520,700],['L',520,480],['C',520,400,470,370,430,400])]),
 '๘':fig(620,[P([260,380],['C',160,370,100,450,100,580],['L',100,700],['A',100,B,280,B],['L',420,B]),ring(420,780),line([520,780],[520,T])]),
 '๙':fig(620,[ring(200,780),P([100,780],['L',100,480],['A',100,T,250,T],...archR(520),['L',520,1000])]),
};
// Combining marks, drawn around their origin at the height they take over a
// plain consonant (above anchor at 290). `mark` is the point that meets the
// host's anchor; `above` is where a tone mark stacks on a vowel. Mark modules
// are drawn at .8, like the Latin accents, so two rows of them stay apart.
const m=(paths,{mark,above,below,type='above'})=>({width:0,zone:'cap',fixed:true,mark:type,paths:paths.map(p=>({scale:.8,...p})),anchors:{mark,...(above?{above}:{}),...(below?{below}:{})}});
const bar=[P([-150,265],['A',-150,185,-70,185],['L',90,185],['A',150,185,150,230])];   // sara i: a flat hook, its left end turned down
const marks={
 'ั':m([line([-110,265],[-30,180],[90,245])],{mark:[0,290],above:[0,125]}),
 'ิ':m(bar,{mark:[0,290],above:[0,125]}),
 'ี':m([...bar,line([90,185],[90,120])],{mark:[0,290],above:[-20,65]}),
 'ึ':m([...bar,line([10,105],[10,105])],{mark:[0,290],above:[-30,60]}),
 'ื':m([...bar,line([-20,185],[-20,120]),line([100,185],[100,120])],{mark:[0,290],above:[-30,65]}),
 '็':m([P([50,268],['C',-30,272,-60,235,-60,225],['C',-60,200,-20,182,50,182])],{mark:[0,290],above:[0,125]}),
 'ํ':m([{...round(-55,165,55,275),scale:.55}],{mark:[0,290],above:[0,125]}),
 // Tone marks, at the stacked height; on a bare consonant they drop to the vowel level.
 '่':m([line([8,25],[-8,100])],{mark:[0,140],above:[0,-40]}),
 '้':m([P([15,100],['L',15,50],['A',15,12,-20,12],['L',-50,18])],{mark:[0,140],above:[0,-40]}),
 '๊':m([line([40,15],[-40,30],[40,75],[-25,100])],{mark:[0,140],above:[0,-40]}),
 '๋':m([line([-45,55],[45,55]),line([0,10],[0,100])],{mark:[0,140],above:[0,-40]}),
 '์':m([P([-35,15],['C',20,15,50,40,50,57],['C',50,75,20,100,-35,100])],{mark:[0,140],above:[0,-40]}),
 '๎':m([line([-45,100],[0,15],[45,100]),line([-25,65],[25,65])],{mark:[0,140],above:[0,-40]}),
 // Below vowels: cups under the body; sara uu is the taller one.
 'ุ':m([P([-70,975],['A',-70,1040,-10,1040],['L',10,1040],['A',70,1040,70,975])],{mark:[0,930],below:[0,1070],type:'below'}),
 'ู':m([P([-70,960],['L',-70,1030],['A',-70,1075,-25,1075],['L',20,1075],['A',70,1075,70,1030],['L',70,1000])],{mark:[0,930],below:[0,1105],type:'below'}),
 'ฺ':m([line([0,1000],[0,1000])],{mark:[0,930],below:[0,1045],type:'below'}),
};
const glyphs={...consonants,...signs,...digits,...marks};
const CONSONANTS='กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮ',VOWELS='ฤฦะาำเแโใไๅฯๆ฿๏๚๛',MARKS='ัิีึืฺุู็่้๊๋์ํ๎',DIGITS='๐๑๒๓๔๕๖๗๘๙';
const ALL=[...Array(0x0e3a-0x0e01+1)].map((_,i)=>String.fromCodePoint(0x0e01+i)).join('')+[...Array(0x0e5b-0x0e3f+1)].map((_,i)=>String.fromCodePoint(0x0e3f+i)).join('');
export default {
 id:'thai',label:'Thai',script:'thai',ranges:[[0x0e01,0x0e5b]],
 marks:MARKS,glyphs,markShift:560,
 // Thai needs no reordering: marks follow their base in logical order, which
 // is also visual order; a mark without a base still maps to itself and the
 // layout hangs it on whatever precedes it, or draws it alone.
 shape:run=>[...run].map(ch=>({key:ch,text:ch})),
 groups:[{id:'thai-consonants',label:'Thai consonants',characters:[...CONSONANTS]},{id:'thai-vowels',label:'Thai vowels and signs',characters:[...VOWELS]},{id:'thai-marks',label:'Thai marks',characters:[...MARKS]},{id:'thai-digits',label:'Thai digits',characters:[...DIGITS]}],
 languages:[['tha','Thai']],
 codePages:[[16,ALL]],
 samples:['สวัสดี\nยินดีต้อนรับ','กรุงเทพมหานคร','ภาษาไทย','ต้มยำกุ้ง · ผัดไทย','๒๕๖๙','เชียงใหม่\nภูเก็ต','น้ำใจ\nปีใหม่','โรงเรียน\nหนังสือ'],
};
