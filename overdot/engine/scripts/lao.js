// lao pack: the Lao block (U+0E81–0EDF) drawn by hand in Overdot's geometric
// monoline style. See docs/scripts.md for the contract.
//
// Lao letters are loop-and-curve forms. Every loop is a true ring, 240 units
// across on the centreline (a counter of about 165 at Bold in the default look,
// the eye of the Latin e in the heavy layered look), placed where the chart
// puts it: on top of a stem (ຍ ຫ ຜ), inside a corner (ດ ຕ ອ) or at the start
// of an S-body (ຂ ຊ). Hooks that could not keep a counter stay single hooks
// (the ear of ທ, the curls of ວ ຈ). Consonant bodies run from 330 to the
// baseline (0.8 of the capitals), ascenders (ປ ຝ ຟ ຢ ໄ) to 180, descenders
// (ຖ ຐ ງ ຊ) to about 1000. Letters take optical spacing like Latin: `width` is
// the body width, strokes start at x=100. Parallel strokes stay 260 or more
// apart, as the Latin m's do, so the counters survive the heavy looks.
//
// Marks are drawn around their own origin and hang on the engine's ink
// anchors: a mark's attachment point is the middle of its ink bottom (top for
// a mark below), a consonant's `above` anchor 30 units over its ink top, so the
// white between a consonant and its vowel, and between the vowel and a tone
// stacked on it, is the same at every weight and look. Only the four ascender
// letters set an `above` anchor of their own, left of the ascender.
const line=(...p)=>({kind:'poly',points:p});
const curve=(...p)=>({kind:'bezier',points:p});
const round=(l,t,r,b)=>{const cx=(l+r)/2,cy=(t+b)/2,k=.55228475,rx=(r-l)/2,ry=(b-t)/2,R=v=>Math.round(v);return {kind:'bezier',closed:true,points:[[cx,t],[R(cx+k*rx),t],[r,R(cy-k*ry)],[r,cy],[r,R(cy+k*ry)],[R(cx+k*rx),b],[cx,b],[R(cx-k*rx),b],[l,R(cy+k*ry)],[l,cy],[l,R(cy-k*ry)],[R(cx-k*rx),t],[cx,t]]};};
const T=330,B=880;
// The loop: a ring of radius 120. A top-left ring sits at (220,450) on a stem at x=220 or at the start of a top bar; a bottom-left ring at (220,760) inside the foot of a leg at x=100.
const ring=(cx,cy,r=120)=>round(cx-r,cy-r,cx+r,cy+r);
// An arch between two stems whose top is exactly `top`, and a bowl whose bottom is exactly `bottom`.
const arch=(xl,xr,y=560,top=T)=>{const c=Math.round(top-(y-top)/3);return curve([xl,y],[xl,c],[xr,c],[xr,y]);};
const bowl=(xl,xr,y=650,bottom=B)=>{const c=Math.round(bottom+(bottom-y)/3);return curve([xl,y],[xl,c],[xr,c],[xr,y]);};
// The ear of ທ ຏ ຎ: a hook at the top of a stem at x, curling into the letter.
const ear=x=>curve([x+140,430],[x+140,340],[x,330],[x,450]);
// The S-wave of the Pali letters' left side, from the bottom of a ring on a stem at x down to (x-45,760).
const wave=x=>curve([x,570],[x,600],[x+100,600],[x+100,650],[x+100,700],[x-45,700],[x-45,760]);
// The descender tail of ຖ ຐ ໗ from the foot of a stem at x, and the foot hook of ຓ ໆ ໓.
const tail=x=>curve([x,B],[x,990],[x-100,1010],[x-160,980]);
const foot=(x,y=760)=>curve([x,y],[x,B],[x-70,900],[x-150,860]);
const extent=paths=>{const xs=paths.flatMap(p=>p.points.map(q=>q[0]));return {x0:Math.min(...xs),x1:Math.max(...xs)};};
// A letter: body width from its paths, round extremes; `above` is the x of an explicit above anchor (ascender letters).
const letter=(paths,extra={})=>{const {above,...rest}=extra;return {width:extent(paths).x1+100,zone:'cap',round:true,paths,...(above?{anchors:{above:[above,215]}}:{}),...rest};};
const figure=(paths,extra={})=>letter(paths,{figure:true,width:650,...extra});
const glyphs={};
// Consonants.
// ກ: the plain arch; ດ ຕ ຐ ຓ hang a ring inside the foot of the left leg (ຕ with the dipped top); ຄ carries its ring higher.
const dip=[curve([100,560],[100,253],[300,253],[320,480]),curve([320,480],[340,253],[540,253],[540,560])];
glyphs['ກ']=letter([line([100,B],[100,560]),arch(100,540),line([540,560],[540,B])]);
glyphs['ດ']=letter([ring(220,760),line([100,760],[100,560]),arch(100,540),line([540,560],[540,B])]);
glyphs['ຕ']=letter([ring(220,760),line([100,760],[100,560]),...dip,line([540,560],[540,B])]);
glyphs['ຐ']=letter([ring(220,760),line([100,760],[100,560]),arch(100,540),line([540,560],[540,B]),tail(540)]);
glyphs['ຓ']=letter([ring(220,760),line([100,760],[100,560]),arch(100,540),line([540,560],[540,760]),foot(540)]);
glyphs['ຄ']=letter([ring(220,660),line([100,560],[100,B]),arch(100,540),line([540,560],[540,B])]);
// ຖ ຠ ໞ: two rings on the left stem, the arch leaving the top ring; ຖ descends, ໞ takes a hooked crossbar.
const twoRings=[ring(220,450),line([220,570],[220,640]),ring(220,760),curve([220,T],[430,T],[560,400],[560,560])];
glyphs['ຖ']=letter([...twoRings,line([560,560],[560,B]),tail(560)]);
glyphs['ຠ']=letter([...twoRings,line([560,560],[560,B])]);
glyphs['ໞ']=letter([...twoRings,line([560,560],[560,B]),line([560,650],[700,650]),curve([700,650],[750,650],[760,600],[730,570])]);
// ລ ໗: the stroke rises out of the ring and swells left before the arch.
const lo=[ring(220,760),curve([220,640],[130,590],[130,T],[330,T],[500,T],[560,440],[560,600])];
glyphs['ລ']=letter([...lo,line([560,600],[560,B])]);
glyphs['໗']=figure([...lo,line([560,600],[560,B]),tail(560)]);
// ບ ປ: the cup; ປ ascends. ນ ທ ຫ ຑ: the cup with an arch beside it; ທ starts with an ear, ຫ with a ring, ຑ with a ring and a wave.
glyphs['ບ']=letter([line([100,T],[100,650]),bowl(100,540),line([540,650],[540,T])]);
glyphs['ປ']=letter([line([100,T],[100,650]),bowl(100,540),line([540,650],[540,180])],{above:230});
const cupArch=(x,m,r,y=650)=>[bowl(x,m,y),line([m,y],[m,560]),arch(m,r),line([r,560],[r,B])];
glyphs['ນ']=letter([line([100,T],[100,650]),...cupArch(100,360,640)]);
glyphs['ທ']=letter([ear(100),line([100,450],[100,650]),...cupArch(100,360,640)]);
glyphs['ຫ']=letter([ring(220,450),line([220,570],[220,650]),...cupArch(220,480,760)]);
glyphs['ຑ']=letter([ring(220,450),wave(220),...cupArch(175,480,760,760)]);
// ຍ ຢ ຩ ໟ: a ring on the left stem of a cup; ຢ ascends, ຩ ໟ add a ring inside the right stem, ໟ a crossbar.
glyphs['ຍ']=letter([ring(220,450),line([220,570],[220,650]),bowl(220,500),line([500,650],[500,T])]);
glyphs['ຢ']=letter([ring(220,450),line([220,570],[220,650]),bowl(220,500),line([500,650],[500,180])],{above:190});
const ringCup=[ring(220,450),line([220,570],[220,650]),bowl(220,620),line([620,650],[620,T]),ring(500,600)];
glyphs['ຩ']=letter([...ringCup,line([620,T],[670,280])]);
glyphs['ໟ']=letter([...ringCup,line([620,T],[670,280]),line([620,740],[760,740]),curve([760,740],[810,740],[820,690],[790,660])]);
// ມ: the ring, a diagonal into the cup, a straight right stem.
glyphs['ມ']=letter([ring(220,450),line([220,570],[350,770]),curve([350,770],[390,900],[580,900],[580,700]),line([580,700],[580,T])]);
// ຜ ຝ ຆ: ring on the left stem, two cups round a middle cusp; ພ ຟ: the ring on the middle stem instead; ຒ: a ring in each cup.
const twoCups=(x,m,r,cusp=480,y=650)=>[bowl(x,m,y),line([m,y],[m,cusp]),bowl(m,r)];
glyphs['ຜ']=letter([ring(220,450),line([220,570],[220,650]),...twoCups(220,480,740),line([740,650],[740,T])]);
glyphs['ຝ']=letter([ring(220,450),line([220,570],[220,650]),...twoCups(220,480,740),line([740,650],[740,180])],{above:340});
glyphs['ຆ']=letter([ring(220,450),wave(220),...twoCups(175,480,740,480,760),line([740,650],[740,T])]);
glyphs['ພ']=letter([line([100,T],[100,650]),...twoCups(100,360,620,570),ring(360,450),line([620,650],[620,T])]);
glyphs['ຟ']=letter([line([100,T],[100,650]),...twoCups(100,360,620,570),ring(360,450),line([620,650],[620,180])],{above:300});
glyphs['ຒ']=letter([ring(220,450),line([220,570],[220,795]),ring(305,795,85),line([305,B],[520,B]),line([520,B],[520,480]),ring(605,795,85),line([605,B],[820,B]),line([820,B],[820,T]),line([820,T],[870,280])]);
// ງ ໆ ຯ: a ring, a bar and a right stem; ງ descends and hooks, ໆ hooks on the baseline, ຯ bowls back and takes a slash.
const barStem=[ring(220,450),curve([220,T],[420,T],[500,360],[500,520])];
glyphs['ງ']=letter([...barStem,line([500,520],[500,B]),curve([500,B],[500,990],[400,1010],[340,980])]);
glyphs['ໆ']=letter([...barStem,line([500,520],[500,760]),foot(500)]);
glyphs['ຯ']=letter([ring(220,450),curve([220,T],[440,T],[540,360],[540,520]),curve([540,520],[540,760],[420,880],[270,860]),line([580,700],[180,1000])]);
// ວ ຈ ຉ ອ: the open bowl; ວ curls at the top, ຈ at the bottom, ອ ends in a ring, ຉ curls at the top and ends in a ring.
const curlTop=[[160,500],[120,470],[110,400],[180,350],[260,320],[540,300],[540,605]];
glyphs['ວ']=letter([curve(...curlTop,[540,910],[160,940],[110,780])]);
glyphs['ຈ']=letter([line([110,440],[110,380]),curve([110,440],[150,320],[540,300],[540,605],[540,910],[160,940],[130,790],[120,740],[180,700],[250,730])]);
glyphs['ອ']=letter([curve([110,440],[150,320],[540,300],[540,605],[540,B],[400,B],[220,B]),ring(220,760)]);
glyphs['ຉ']=letter([curve(...curlTop,[540,B],[400,B],[220,B]),ring(220,760)]);
// ຂ ຊ ຌ: a ring, then a mirrored S; ຂ ends curling up, ຊ ຌ in a descending tail, ຌ breaks the waist with a cusp.
const sTop=[ring(220,450),curve([220,T],[430,T],[560,380],[560,500])];
const sLow=[[150,620],[100,720],[100,790],[100,B],[260,900],[380,B]];
glyphs['ຂ']=letter([...sTop,curve([560,500],[560,600],[420,620],[320,620],...sLow,[450,865],[500,840],[500,790])]);
const tailEnd=[[500,870],[520,980],[460,1010]];
glyphs['ຊ']=letter([...sTop,curve([560,500],[560,600],[420,620],[320,620],...sLow,...tailEnd)]);
glyphs['ຌ']=letter([...sTop,curve([560,500],[560,620],[350,650],[260,640]),curve([260,640],[120,660],[100,760],[100,800],[100,B],[260,900],[380,B],...tailEnd)]);
// ຣ ຮ ສ ຬ ຘ: a top, a side down to the waist, a ring at the lower left and a bottom that rises at the right.
// ຣ starts with a hook, ຮ with a tick, ສ has a flat top and a tick at the right, ຬ a round top with the tick, ຘ a dipped bottom.
const waist=curve([560,560],[560,650],[340,640],[220,640]),rise=curve([220,B],[400,B],[560,860],[560,760]);
const sBottom=[waist,ring(220,760),rise];
const roundTop=curve([160,470],[110,470],[110,400],[150,350],[250,300],[560,300],[560,560]);
glyphs['ຣ']=letter([roundTop,...sBottom]);
glyphs['ຮ']=letter([curve([90,300],[150,370],[300,290],[560,330],[560,420],[560,500],[560,560]),...sBottom]);
glyphs['ສ']=letter([curve([110,380],[250,340],[430,340],[520,360]),line([520,360],[560,300]),curve([520,360],[570,450],[540,560],[420,600],[340,630],[220,620],[220,640]),ring(220,760),rise]);
glyphs['ຬ']=letter([curve([110,440],[150,320],[560,300],[560,560]),line([560,560],[560,T]),line([560,T],[610,270]),...sBottom]);
glyphs['ຘ']=letter([roundTop,waist,ring(220,760),curve([220,B],[300,B],[360,840],[390,800]),curve([390,800],[420,840],[480,B],[560,860]),line([560,860],[560,760])]);
// ຎ ຨ: a box with an ear, a ring in the lower left corner and a tick; ຨ waves its left side. ຏ: the ear and the ring on a cup.
const box=[ring(220,760),line([220,B],[560,B]),line([560,B],[560,T]),line([560,T],[610,270]),curve([240,430],[240,340],[400,330],[560,330])];
glyphs['ຎ']=letter([ear(100),line([100,450],[100,760]),...box]);
glyphs['ຨ']=letter([ear(100),curve([100,450],[100,490],[220,490],[220,570]),wave(220),line([175,760],[160,760]),ring(280,760),line([280,B],[560,B]),line([560,B],[560,T]),line([560,T],[610,270]),curve([240,430],[240,340],[400,330],[560,330])]);
glyphs['ຏ']=letter([ear(100),line([100,450],[100,760]),ring(220,760),curve([220,B],[400,B],[560,860],[560,700]),line([560,700],[560,T])]);
// ໜ ໝ: ຫ ligated with ນ and ມ, sharing the leg between them.
const hoPart=[ring(220,450),line([220,570],[220,650]),bowl(220,480),line([480,650],[480,560]),arch(480,760)];
glyphs['ໜ']=letter([...hoPart,line([760,560],[760,650]),bowl(760,1020),line([1020,650],[1020,560]),arch(1020,1300),line([1300,560],[1300,B])]);
glyphs['ໝ']=letter([...hoPart,line([760,560],[890,770]),curve([890,770],[930,900],[1120,900],[1120,700]),line([1120,700],[1120,T])]);
// Vowels and signs that take their own cell.
glyphs['ະ']=letter([curve([110,380],[200,350],[270,400],[270,460],[270,520],[200,540],[120,520]),curve([110,700],[200,670],[270,720],[270,790],[270,860],[200,B],[120,860])]);
glyphs['າ']=letter([curve([120,470],[120,T],[280,T],[280,470]),line([280,470],[280,B])]);
glyphs['ຳ']=letter([{...ring(125,190,60),scale:.8},curve([240,470],[240,T],[400,T],[400,470]),line([400,470],[400,B])]);
glyphs['ຽ']=letter([line([160,360],[480,360]),line([480,360],[530,300]),curve([480,360],[480,700],[460,B],[220,B]),ring(220,760)]);
const stemRing=x=>[line([x,760],[x,450]),ring(x+120,760)];
const eHook=x=>curve([x,450],[x,340],[x+120,T],[x+170,380]);
glyphs['ເ']=letter([...stemRing(100),eHook(100)]);
glyphs['ແ']=letter([...stemRing(100),eHook(100),...stemRing(460),eHook(460)]);
glyphs['ໂ']=letter([...stemRing(100),curve([100,450],[100,T],[200,T],[260,370],[320,410],[390,380],[400,310])]);
glyphs['ໃ']=letter([line([100,760],[100,450]),ring(220,760),ring(220,450)]);
glyphs['ໄ']=letter([line([130,760],[130,250]),ring(250,760),curve([130,250],[130,170],[60,180],[40,250])]);
// Digits: figure width, body height, the forms of the chart.
glyphs['໐']=figure([round(150,T,500,B)]);
glyphs['໑']=figure([ring(260,760),curve([260,640],[170,600],[160,T],[330,T],[500,T],[520,500],[520,620]),line([520,620],[520,B])]);
glyphs['໒']=figure([curve([540,440],[500,320],[150,300],[150,605],[150,B],[300,B],[430,B]),ring(430,760)]);
glyphs['໓']=figure([ring(220,760),curve([220,640],[180,560],[160,T],[340,T],[480,T],[520,420],[520,520]),line([520,520],[520,760]),foot(520),line([520,420],[560,340])]);
const fourBody=[curve([150,560],[150,650],[300,640],[430,640]),ring(430,760),curve([430,B],[300,B],[150,860],[150,760])];
glyphs['໔']=figure([curve([540,460],[520,330],[150,300],[150,560]),...fourBody]);
glyphs['໕']=figure([curve([560,340],[480,330],[150,300],[150,560]),...fourBody]);
glyphs['໖']=figure([ring(220,760),curve([100,760],[100,T],[330,T],[330,480]),curve([330,480],[330,T],[500,T],[540,400]),line([540,B],[540,T]),line([540,T],[580,280])]);
glyphs['໘']=figure([ring(220,760),line([100,760],[100,560]),...dip,line([540,560],[540,B]),line([540,820],[220,1010])]);
glyphs['໙']=figure([ring(220,760),curve([220,640],[150,600],[150,T],[330,T],[500,T],[520,500],[520,620]),curve([520,620],[520,760],[560,B],[600,B])]);
// Combining marks, drawn about their origin at the height they take over a plain consonant in the default look; the engine's ink anchors place them.
// Above vowels are 300 wide and 180 tall, the size of the Latin circumflex, so their counters outlive the heavy looks; tones are 80 to 110 tall.
const mark=(side,paths)=>({width:0,fixed:true,mark:side,paths:paths.map(p=>({...p,scale:.8}))});
const above=paths=>mark('above',paths),below=paths=>mark('below',paths);
const iArch=curve([-150,200],[-150,40],[150,40],[150,200]);
const flagArch=[curve([-150,200],[-150,40],[140,40],[140,160]),line([140,160],[210,160])];
glyphs['ັ']=above([curve([-140,130],[-130,205],[90,210],[120,150]),line([120,150],[160,100])]);
glyphs['ິ']=above([iArch]);
glyphs['ີ']=above(flagArch);
glyphs['ຶ']=above([iArch,line([0,185],[0,185])]);
glyphs['ື']=above([...flagArch,line([0,185],[0,185])]);
glyphs['ົ']=above([curve([-140,160],[-70,40],[110,40],[140,140],[150,190],[110,215],[50,205])]);
glyphs['ໍ']=above([ring(0,130,65)]);
glyphs['່']=above([line([0,100],[0,200])]);
glyphs['້']=above([curve([-80,140],[-50,80],[60,80],[60,140],[60,200],[-40,200],[-80,190])]);
glyphs['໊']=above([curve([-130,200],[-130,100],[-30,100],[0,160]),curve([0,160],[30,100],[130,100],[130,200])]);
glyphs['໋']=above([line([0,100],[0,200]),line([-60,150],[60,150])]);
glyphs['໌']=above([curve([40,110],[-70,90],[-70,200],[0,200],[50,200],[80,180],[90,140])]);
glyphs['໎']=above([curve([-150,200],[-140,110],[-60,110],[-40,170]),curve([-40,170],[-20,110],[60,110],[80,170]),curve([80,170],[100,110],[150,130],[150,200])]);
glyphs['ຸ']=below([curve([-40,955],[50,950],[60,1020],[-20,1050])]);
glyphs['ູ']=below([curve([-90,955],[-90,1050],[70,1050],[70,985]),line([70,985],[110,950])]);
glyphs['ຼ']=below([curve([-150,995],[-130,940],[-50,945],[-30,1000],[-10,1055],[70,1060],[100,1005],[120,965],[160,965],[170,985])]);
glyphs['຺']=below([line([0,985],[0,985])]);
const CONSONANTS='ກຂຄຆງຈຉຊຌຍຎຏຐຑຒຓດຕຖທຘນບປຜຝພຟຠມຢຣລວຨຩສຫຬອຮໜໝໞໟ';
const VOWELS='ະາຳຽເແໂໃໄໆຯ';
const MARKS='ັິີຶືົໍ່້໊໋໌໎ຸູຼ຺';
const DIGITS='໐໑໒໓໔໕໖໗໘໙';
export default {
 id:'lao',label:'Lao',script:'lao ',ranges:[[0x0e81,0x0edf]],fixed:false,marks:MARKS,glyphs,markShift:540,
 // One cell per character in logical order: Lao never reorders.
 shape(run){return [...run].map(ch=>({key:ch,text:ch}));},
 groups:[
  {id:'lao-consonants',label:'Lao consonants',characters:CONSONANTS},
  {id:'lao-vowels',label:'Lao vowels and signs',characters:VOWELS},
  {id:'lao-marks',label:'Lao marks',characters:MARKS},
  {id:'lao-digits',label:'Lao digits',characters:DIGITS},
 ],
 languages:[['lao','Lao']],
 samples:['ສະບາຍດີ','ວຽງຈັນ\nຫຼວງພະບາງ','ພາສາລາວ','ຂອບໃຈ ຫຼາຍໆ','໒໕໖໙\nເດືອນ ໑໒','ຂ້ອຍຮັກເຈົ້າ','ບຸນປີໃໝ່ລາວ','ຂໍ້ມູນ ຂ່າວສານ','ສາທາລະນະລັດ\nປະຊາທິປະໄຕ'],
 codePages:[],
};
