// Khmer pack: the Cambodian script drawn as Overdot centrelines, with the
// syllable shaping done here (subscripts, prebase vowels, two-part vowels) so
// the page renders real Khmer text, and the substitution data the OTF carries.
// Contract: docs/scripts.md.
//
// Drawing grammar. Khmer letters are wide, upright and sit on one line: the
// body runs from the top line at 300 to the baseline at 880 (zone 'cap'), the
// small "hair" (សក់) that many letters carry rises to 230, the heads and curls
// of the tall letters reach 180, and the tails of ញ ឋ ឍ hang to about 1000.
// The above vowels and signs sit from 140 upward, over the hair; the below
// vowels and the subscript consonants hang from 920 down. The letters share a
// vocabulary: the "n" arch (ក គ ង ដ ត ន …), the "u" bowl (ប ផ ព ភ ម យ ល វ ស),
// the tooth (a dip in the top line), the inward head hook, the foot curl and
// the head ring, each placed where the letter keeps it in Khmer type.
const line=(...p)=>({kind:'poly',points:p});
const curve=(...p)=>({kind:'bezier',points:p});
const round=(l,t,r,b)=>{const cx=(l+r)/2,cy=(t+b)/2,k=.55228475,rx=(r-l)/2,ry=(b-t)/2;return {kind:'bezier',closed:true,points:[[cx,t],[cx+k*rx,t],[r,cy-k*ry],[r,cy],[r,cy+k*ry],[cx+k*rx,b],[cx,b],[cx-k*rx,b],[l,cy+k*ry],[l,cy],[l,cy-k*ry],[cx-k*rx,t],[cx,t]]};};
const T=300,B=880,H=205,L=130,ABOVE=140,BELOW=920;
// Pieces of the vocabulary, all sharing points with the strokes they meet. A head ring
// hangs under the top line at the left (its top is the bar's left end), a head hook curls
// from the top line into the counter, a foot curls from the baseline into it, and the hair
// is a serif-like tick rising from the top line.
const stem=(x,y0=T,y1=B)=>line([x,y0],[x,y1]);
const hair=(x,y=T)=>line([x,y],[x+70,H]);
const top=(x0,x1,y=T)=>line([x0,y],[x1,y]);
const tooth=(x0,x1,y=T)=>line([x0,y],[(x0+x1)/2,y+130],[x1,y]);
const bowl=(x0,x1,y=B-230)=>curve([x0,y],[x0,B+70],[x1,B+70],[x1,y]);
const foot=x=>curve([x,B-200],[x,B+30],[x+240,B+20],[x+230,B-170]);
const hookIn=(x,d=1)=>curve([x,T+180],[x,T-30],[x+d*240,T-20],[x+d*230,T+170]);
const tail=x=>curve([x,B],[x,B+130],[x-60,B+140],[x-170,B+110]);
const ring=(cx,cy,r)=>round(cx-r,cy-r,cx+r,cy+r);
const RING=90,head=x=>ring(x+RING,T+RING,RING);
// The consonants, ក to អ, in code point order (with the obsolete ឝ ឞ): [body width, paths].
const CONSONANTS={
 'ក':[700,[stem(L),stem(570),top(L,290),tooth(290,490),top(490,570)]],
 'ខ':[700,[curve([150,470],[150,330],[210,T],[300,T]),curve([300,T],[410,T],[440,400],[380,480]),line([380,480],[150,B],[570,B]),top(300,570),stem(570)]],
 'គ':[700,[stem(L),top(L,570),stem(570),curve([L,T],[370,T],[370,460],[220,460])]],
 'ឃ':[780,[stem(L),top(L,650),stem(650),curve([L,T],[370,T],[370,460],[220,460]),tooth(400,580),hair(650)]],
 'ង':[700,[stem(L,T+RING),head(L),top(L+RING,310),tooth(310,490),top(490,570),stem(570)]],
 'ច':[700,[hair(150),top(150,290),tooth(290,490),top(490,570),stem(570,T,B-220),curve([570,B-220],[570,B+50],[220,B+50],[150,B-140])]],
 'ឆ':[700,[curve([150,T],[150,160],[350,160],[350,T]),top(150,290),tooth(290,490),top(490,570),stem(570,T,B-220),curve([570,B-220],[570,B+50],[220,B+50],[150,B-140])]],
 'ជ':[700,[stem(L,T+180),hookIn(L),bowl(L,570),stem(570),hair(570)]],
 'ឈ':[780,[stem(L,T+180),hookIn(L),bowl(L,650),stem(650),top(400,650),tooth(400,580),hair(650)]],
 'ញ':[820,[stem(L),stem(400),stem(670),top(L,400),tooth(400,580),top(580,670),bowl(400,670,B-150),tail(670)]],
 'ដ':[700,[stem(L,T,B-200),foot(L),top(L,570),stem(570)]],
 'ឋ':[700,[stem(L,T,B-200),foot(L),hair(L),top(L,570),stem(570),tail(570)]],
 'ឌ':[700,[stem(L,T,B-200),foot(L),top(L,570),stem(570),curve([290,T],[290,160],[490,160],[490,T])]],
 'ឍ':[700,[stem(L,T,B-200),foot(L),top(L,570),stem(570),curve([290,T],[290,160],[490,160],[490,T]),tail(570)]],
 'ណ':[780,[stem(L),top(L,300),ring(390,T+RING,RING),top(480,650),stem(650),hair(650)]],
 'ត':[700,[stem(L),hair(L),top(L,290),tooth(290,490),top(490,570),stem(570)]],
 'ថ':[700,[head(L),top(L+RING,570),stem(570,T,B-220),curve([570,B-220],[570,B+50],[220,B+50],[150,B-140])]],
 'ទ':[700,[stem(L,T+RING,B-200),foot(L),head(L),top(L+RING,570),stem(570)]],
 'ធ':[780,[stem(L,T+RING,B-200),foot(L),head(L),top(L+RING,650),tooth(400,580),stem(650)]],
 'ន':[700,[stem(L,T,B-200),foot(L),top(L,290),tooth(290,490),top(490,570),stem(570)]],
 'ប':[700,[stem(L),hair(L),bowl(L,570),stem(570)]],
 'ផ':[700,[stem(L,T+RING),head(L),bowl(L,570),stem(570)]],
 'ព':[700,[stem(L),bowl(L,570),stem(570,T+180),hookIn(570,-1)]],
 'ភ':[700,[stem(L,T+RING),head(L),bowl(L,570),stem(570,T+180),hookIn(570,-1)]],
 'ម':[700,[stem(L,T+180),hookIn(L),bowl(L,570),stem(570)]],
 'យ':[820,[stem(L,T+RING),head(L),bowl(L,400),stem(400),bowl(400,670),stem(670),hair(670)]],
 'រ':[480,[stem(250),hair(250),curve([250,B-200],[250,B+30],[100,B+20],[100,B-150])]],
 'ល':[700,[stem(L),hair(L),bowl(L,570),stem(570),curve([L,B-200],[L,B+30],[330,B+20],[330,B-170])]],
 'វ':[640,[stem(L),hair(L),bowl(L,510),stem(510,T+180),curve([510,T+180],[510,T-30],[660,T-20],[660,T+150])]],
 'ឝ':[700,[stem(L),hair(L),bowl(L,570),stem(570),curve([350,B-40],[350,B-250],[330,B-360],[180,B-360]),hair(570)]],
 'ឞ':[700,[stem(L),hair(L),bowl(L,570),stem(570,T+180),hookIn(570,-1)]],
 'ស':[700,[stem(L),hair(L),bowl(L,570),stem(570),curve([350,B-40],[350,B-250],[330,B-360],[180,B-360])]],
 'ហ':[780,[stem(L),hair(L),bowl(L,400),stem(400,T+180),bowl(400,650),stem(650),hair(650)]],
 'ឡ':[800,[stem(L),hair(L),bowl(L,570),stem(570),curve([L,B-200],[L,B+30],[330,B+20],[330,B-170]),curve([570,T+180],[570,T-30],[720,T-20],[720,T+150])]],
 'អ':[700,[stem(L,T+RING),head(L),top(L+RING,570),stem(570),stem(350,T,B-200),foot(350)]],
};
// The independent vowels: the deprecated ឣ ឤ (អ and អា) first, then ឥ to ឳ.
const OU=[curve([150,T+140],[150,T-40],[360,T-40],[360,T+140]),stem(360,T+140,B-230),bowl(360,570,B-230),stem(570),hair(570)];
const RU=[stem(L),hair(L),bowl(L,570),stem(570),curve([350,B-40],[350,B-250],[330,B-360],[180,B-360]),curve([460,B],[460,B+140],[300,B+140],[300,B+40])];
const LU=[stem(L),hair(L),bowl(L,570),stem(570),curve([L,B-200],[L,B+30],[330,B+20],[330,B-170]),curve([460,B],[460,B+140],[300,B+140],[300,B+40])];
const AO=[stem(L,T+RING),head(L),top(L+RING,500),stem(500),stem(760,T),curve([760,T],[720,T-30],[610,T-20],[610,T+130])];
const INDEPENDENT={
 'ឣ':[700,CONSONANTS['អ'][1]],
 'ឤ':[1040,[...CONSONANTS['អ'][1],stem(850),curve([850,T],[810,T-30],[700,T-20],[700,T+130])]],
 'ឥ':[700,[stem(L,T+180),hookIn(L),bowl(L,570),stem(570,T+180),hookIn(570,-1),ring(350,150,60)]],
 'ឦ':[700,[stem(L,T+180),hookIn(L),bowl(L,570),stem(570,T+180),hookIn(570,-1),curve([230,170],[280,80],[420,80],[470,170])]],
 'ឧ':[700,OU],
 'ឨ':[700,[...OU,tail(570)]],
 'ឩ':[700,[...OU,curve([460,B],[460,B+140],[300,B+140],[300,B+40])]],
 'ឪ':[700,[...OU,ring(460,150,60)]],
 'ឫ':[700,RU],
 'ឬ':[700,[...RU,ring(350,150,60)]],
 'ឭ':[700,LU],
 'ឮ':[700,[...LU,ring(350,150,60)]],
 'ឯ':[700,[curve([330,T+40],[280,T-30],[150,T],[150,T+120],[150,T+240],[300,T+260],[350,T+260]),curve([350,T+260],[190,T+260],[150,T+400],[150,B-150],[150,B+30],[400,B+40],[450,B-120]),stem(570,T),top(450,570)]],
 'ឰ':[700,[curve([330,T+40],[280,T-30],[150,T],[150,T+120],[150,T+240],[300,T+260],[350,T+260]),curve([350,T+260],[190,T+260],[150,T+400],[150,B-150],[150,B+30],[400,B+40],[450,B-120]),stem(570,T),top(450,570),curve([230,170],[280,80],[420,80],[470,170])]],
 'ឱ':[880,[...AO,curve([690,160],[640,160],[600,T-20],[640,T+40])]],
 'ឲ':[880,[...AO,ring(690,150,55)]],
 'ឳ':[880,[...AO,curve([620,B],[620,B+140],[480,B+140],[480,B+40])]],
};
// A letter glyph: optical spacing, the vowel line over the hair and under the baseline.
const extent=paths=>{const xs=paths.flatMap(p=>p.points.map(q=>q[0])),ys=paths.flatMap(p=>p.points.map(q=>q[1]));return {x0:Math.min(...xs),x1:Math.max(...xs),y0:Math.min(...ys),y1:Math.max(...ys)};};
const letter=([width,paths],extra={})=>{const e=extent(paths),mid=Math.round((e.x0+e.x1)/2);return {width,zone:'cap',paths,anchors:{above:[mid,e.y0<T-50?ABOVE-(T-50-e.y0):ABOVE],below:[mid,BELOW]},...extra};};
// A combining mark drawn around x 0: its `mark` point meets the host's anchor; its own `above`
// and `below` take the next mark of the stack, and the one across the letter (a below vowel
// after an above sign) lands back on the base's line, since the mark's origin shares the
// base's: a below anchor at 920 under an above mark is the base's own below anchor.
const mark=(kind,paths,o={})=>{const e=extent(paths);return {width:0,fixed:true,zone:'cap',mark:kind,paths,anchors:kind==='above'?{mark:[0,ABOVE],above:[0,e.y0-50],below:[0,BELOW]}:{mark:[0,BELOW],above:[0,ABOVE],below:[0,e.y1+40]},...o};};
const spacing=(width,paths,o={})=>({width,zone:'cap',paths,...o});
// Above vowels and signs: drawn from 140 upward, centred on x 0, a little lighter than
// the letters as accents are.
const A=y=>ABOVE-y;
const mk=paths=>paths.map(p=>({...p,scale:.8}));
const I=[curve([-200,A(10)],[-170,A(170)],[90,A(180)],[170,A(110)]),curve([170,A(110)],[230,A(50)],[170,A(0)],[110,A(30)])];
const II=[curve([-240,A(10)],[-230,A(150)],[-100,A(160)],[-80,A(90)]),curve([-80,A(90)],[-50,A(170)],[110,A(180)],[180,A(110)]),curve([180,A(110)],[240,A(50)],[180,A(0)],[120,A(30)])];
const ABOVE_MARKS={
 'ិ':I,
 'ី':II,
 'ឹ':[...I,line([-30,A(140)],[-30,A(10)])],
 'ឺ':[...II,line([20,A(140)],[20,A(10)])],
 'ំ':[ring(0,A(90),85)],
 '៉':[curve([-90,A(140)],[-90,A(-20)],[90,A(-20)],[90,A(140)])],
 '៊':[line([-100,A(140)],[-40,A(0)]),line([40,A(140)],[100,A(0)])],
 '់':[line([0,A(150)],[0,A(10)])],
 '៌':[line([-50,A(0)],[-50,A(120)]),curve([-50,A(120)],[-30,A(170)],[70,A(170)],[90,A(100)])],
 '៍':[curve([100,A(90)],[80,A(160)],[-70,A(170)],[-90,A(90)],[-100,A(20)],[20,A(0)],[50,A(60)])],
 '៎':[line([-80,A(100)],[80,A(20)]),line([80,A(100)],[-80,A(20)]),line([0,A(160)],[0,A(0)])],
 '៏':[curve([-70,A(130)],[20,A(170)],[90,A(130)],[80,A(60)]),curve([80,A(60)],[70,A(0)],[-40,A(0)],[-70,A(40)])],
 '័':[line([-130,A(10)],[0,A(140)],[130,A(10)]),curve([0,A(140)],[40,A(190)],[110,A(180)],[110,A(130)])],
 '៑':[line([-110,A(50)],[110,A(50)]),line([0,A(50)],[0,A(160)])],
 '៓':[curve([-50,A(90)],[-50,A(170)],[70,A(160)],[70,A(80)],[70,A(0)],[-30,A(0)],[-40,A(50)]),curve([-40,A(50)],[-20,A(80)],[20,A(80)],[25,A(50)])],
 '៝':[line([-90,A(10)],[90,A(150)])],
 // the above part of ើ: ី as a form, the character ើ drawn alike for shapers that split it
 'ើ.above':II,
};
// Below vowels: hanging from 920, centred on x 0.
const BELOW_MARKS={
 'ុ':[curve([-100,BELOW+15],[-100,BELOW+170],[80,BELOW+180],[90,BELOW+70]),curve([90,BELOW+70],[90,BELOW+20],[40,BELOW+20],[30,BELOW+60])],
 'ូ':[curve([-160,BELOW+15],[-160,BELOW+170],[0,BELOW+180],[0,BELOW+70]),curve([0,BELOW+70],[0,BELOW+170],[160,BELOW+180],[160,BELOW+15])],
 'ួ':[curve([-200,BELOW+15],[-200,BELOW+180],[-70,BELOW+180],[-70,BELOW+70]),curve([-70,BELOW+70],[-70,BELOW+180],[70,BELOW+180],[70,BELOW+70]),curve([70,BELOW+70],[70,BELOW+180],[200,BELOW+180],[200,BELOW+15])],
 '្':[curve([-70,BELOW+20],[-70,BELOW+150],[50,BELOW+160],[60,BELOW+80])],
};
// Prebase vowels, drawn to the left of the cluster: the ɛ-like curl of េ, with its
// doubled head (ែ) and its hooked head (ៃ); the prebase coeng ro is the hook that
// stands at the lower left of its base.
const E=[curve([340,T+50],[290,T-30],[150,T],[150,T+130],[150,T+250],[300,T+270],[350,T+270]),curve([350,T+270],[190,T+270],[150,T+410],[150,B-150],[150,B+40],[410,B+50],[460,B-130])];
const PRE={
 'េ':[520,E],
 'ែ':[520,[...E,curve([150,T],[150,150],[350,150],[350,T])]],
 'ៃ':[520,[...E,curve([340,T+50],[340,150],[480,160],[480,T+50])]],
 '្រ.pre':[380,[curve([340,430],[340,650],[340,B+40],[190,B+40],[120,B+40],[120,B-110],[210,B-140])]],
};
// Post vowels and spacing signs. ា is the Thai-like stem with a leftward head; the right
// parts of the two-part vowels are ា with the head of their vowel.
const AA=[stem(300),curve([300,T],[260,T-30],[150,T-20],[150,T+130])];
const dot=(x,y)=>line([x,y],[x,y]);
const KHAN=[curve([430,T],[430,120],[250,120],[220,T]),curve([220,T],[200,T+120],[200,T+320],[200,B-220]),curve([200,B-220],[200,B+70],[440,B+70],[440,B-220])];
const LEKTOO=[curve([150,T+80],[200,T-30],[420,T-20],[420,T+130]),curve([420,T+130],[420,T+270],[150,T+320],[150,B-130]),curve([150,B-130],[150,B+50],[440,B+50],[440,B-150])];
const POST={
 'ា':[440,AA],
 'ោ.post':[440,AA],
 'ៅ.post':[440,[...AA,curve([300,T],[300,140],[450,140],[450,T])]],
 'ៀ.post':[440,[...AA,curve([130,160],[200,90],[340,90],[400,170])]],
 'ឿ.post':[440,[stem(300,T+120),curve([300,T+120],[300,T-50],[100,T-50],[100,T+120]),curve([100,T+120],[100,T+240],[240,T+260],[300,T+170])]],
 'ះ':[320,[ring(160,470,80),ring(160,770,80)]],
 'ៈ':[280,[line([140,440],[140,560]),line([140,720],[140,840])]],
 '។':[580,KHAN],
 '៕':[780,[...KHAN,stem(640)]],
 '៖':[280,[dot(140,470),dot(140,770)]],
 'ៗ':[560,LEKTOO],
 '៘':[680,[...LEKTOO,dot(580,560),dot(580,770)]],
 '៙':[600,[ring(300,560,170),curve([300,390],[300,T-20],[450,T-20],[470,T+90])]],
 '៚':[660,[curve([150,B-120],[150,B+40],[380,B+40],[380,B-150]),curve([380,B-150],[380,T+200],[150,T+200],[150,T+80]),curve([150,T+80],[150,T-40],[380,T-30],[440,T+100]),curve([440,T+100],[470,T+200],[580,T+200],[580,T+60])]],
 '៛':[720,[stem(250),hair(250),curve([250,B-200],[250,B+30],[100,B+20],[100,B-150]),line([360,490],[620,490]),line([360,650],[620,650])]],
 'ៜ':[360,[curve([110,T+110],[150,T],[280,T+20],[260,T+130]),curve([260,T+130],[240,T+220],[130,T+220],[110,T+190])]],
};
// The digits ០ to ៩, figures of the letters' height.
const DIGITS={
 '០':[640,[round(110,T,530,B)]],
 '១':[640,[ring(320,T+170,170),stem(490,T+170,B-200),curve([490,B-200],[490,B+30],[280,B+30],[220,B-150])]],
 '២':[640,[curve([140,T+130],[140,T-30],[380,T-30],[380,T+130]),curve([380,T+130],[380,T+290],[140,T+290],[140,T+430]),line([140,T+430],[140,B],[520,B])]],
 '៣':[800,[stem(L,T+120),hair(L,T+120),bowl(L,400,B-200),stem(400,T+120),bowl(400,670,B-200),stem(670,T+120)]],
 '៤':[640,[stem(L,T+180),hookIn(L),bowl(L,510),stem(510,T+180),hookIn(510,-1)]],
 '៥':[640,[curve([480,T],[300,T],[150,T+80],[150,T+200]),line([150,T+200],[150,B-220]),curve([150,B-220],[150,B+70],[540,B+70],[540,B-180]),curve([540,B-180],[540,B-360],[300,B-380],[150,B-270])]],
 '៦':[640,[stem(L,T+180),hookIn(L),bowl(L,510,B-250),stem(510,T+430,B-250),curve([510,T+430],[510,T+280],[300,T+260],[L,T+380])]],
 '៧':[640,[curve([150,T+90],[200,T-30],[420,T-30],[420,T+130]),curve([420,T+130],[420,T+260],[240,T+280],[300,T+300]),curve([300,T+300],[480,T+320],[540,T+380],[540,B-220]),curve([540,B-220],[540,B+60],[200,B+60],[140,B-160])]],
 '៨':[640,[round(110,T+150,440,B),stem(530,T+180),hookIn(530,-1)]],
 '៩':[640,[stem(L,T+180),hookIn(L),bowl(L,510,B-200),stem(510,T),hair(510),stem(320,T+200,B-230)]],
};
// The glyph table: letters and vowels with optical spacing, marks around their origin,
// the right parts of the two-part vowels both as forms (what `shape` draws) and under
// their own code points (what a shaper that splits the vowel expects: the shapers of
// HarfBuzz, Uniscribe and CoreText insert េ before the base and draw the character
// itself as the right part).
const glyphs={};
for(const [c,def]of Object.entries(CONSONANTS))glyphs[c]=letter(def);
for(const [c,def]of Object.entries(INDEPENDENT))glyphs[c]=letter(def);
for(const [c,paths]of Object.entries(ABOVE_MARKS))glyphs[c]=mark('above',mk(paths),c.length>1?{form:true}:{});
for(const [c,paths]of Object.entries(BELOW_MARKS))glyphs[c]=mark('below',mk(paths));
for(const [c,[width,paths]]of Object.entries(PRE))glyphs[c]=spacing(width,paths,c.length>1?{form:true}:{});
for(const [c,[width,paths]]of Object.entries(POST))glyphs[c]=spacing(width,paths,c.length>1?{form:true}:{});
for(const [c,[width,paths]]of Object.entries(DIGITS))glyphs[c]=spacing(width,paths,{figure:true});
glyphs['ើ']=mark('above',mk(ABOVE_MARKS['ើ.above']));
for(const [c,form]of [['ោ','ោ.post'],['ៅ','ៅ.post'],['ៀ','ៀ.post'],['ឿ','ឿ.post']])glyphs[c]=spacing(420,POST[form][1]);
// Subscript (coeng) forms: each consonant at two thirds of its width and half its height,
// hung from the base's below anchor (its top centre at 920), with lighter modules so its
// counters survive. ្រ is the prebase form '្រ.pre' instead, drawn before the base.
const SUB_X=.66,SUB_Y=.5,SUB_TOP=945;
const subscript=([,paths])=>{const e=extent(paths),cx=(e.x0+e.x1)/2,f=([x,y])=>[Math.round((x-cx)*SUB_X),Math.round(SUB_TOP+(y-e.y0)*SUB_Y)],out=paths.map(p=>({...p,points:p.points.map(f),scale:.8})),bottom=Math.max(...out.flatMap(p=>p.points.map(q=>q[1])));return {form:true,width:0,fixed:true,zone:'cap',mark:'below',paths:out,anchors:{mark:[0,BELOW],above:[0,ABOVE],below:[0,bottom+40]}};};
for(const [c,def]of Object.entries(CONSONANTS))if(c!=='រ')glyphs[c+'.sub']=subscript(def);
// Character classes for the shaping.
const CONS=new Set(Object.keys(CONSONANTS)),INDEP=new Set(Object.keys(INDEPENDENT)),COENG='្';
const PREBASE=new Set(['េ','ែ','ៃ']),TWO_PART={'ើ':'ើ.above','ឿ':'ឿ.post','ៀ':'ៀ.post','ោ':'ោ.post','ៅ':'ៅ.post'};
const ABOVE_VOWELS=new Set(['ិ','ី','ឹ','ឺ','ើ','ំ']),SHIFTERS=new Set(['៉','៊']);
const DEPENDENT=new Set([...'ាិីឹឺុូួើឿៀេែៃោៅំះៈ','឴','឵']),SIGNS=new Set([...'៉៊់៌៍៎៏័៑៓៝']);
const invisible=c=>c==='឴'||c==='឵';
// Khmer syllable shaping. A cluster is a consonant or independent vowel, then (coeng +
// consonant)*, then the dependent vowel, then the signs; the register shifters ៉ ៊ may stand
// before the vowel. Its cells come out in visual order: the prebase ro, the prebase vowel
// (or the prebase half of a two-part vowel), the base, the subscripts under it, then the
// marks, the post vowels and the signs in their written order. The texts of a cluster's
// cells concatenate to its text in logical order, so the cluster's first cell carries its
// whole text when something is reordered and the later cells carry '' (a caret unit of
// zero width); a cluster that keeps its order gives each cell its own characters. A shifter
// under an above vowel becomes the ុ below it, as Khmer orthography writes it.
export function shape(run){
 const chars=[...run],cells=[];let i=0;
 while(i<chars.length){const c=chars[i];
  if(!CONS.has(c)&&!INDEP.has(c)){cells.push({key:c,text:c});i++;continue;}
  const start=i,subs=[];let preRo=false;i++;
  while(chars[i]===COENG&&CONS.has(chars[i+1])){if(chars[i+1]==='រ')preRo=true;else subs.push(chars[i+1]);i+=2;}
  const rest=[];while(i<chars.length&&(DEPENDENT.has(chars[i])||SIGNS.has(chars[i])||(chars[i]===COENG&&!CONS.has(chars[i+1]))))rest.push(chars[i++]);
  // Late subscripts (coeng after a vowel sign, as some keyboards type ្ after ុ): keep them under the base.
  while(chars[i]===COENG&&CONS.has(chars[i+1])){if(chars[i+1]==='រ')preRo=true;else subs.push(chars[i+1]);i+=2;while(i<chars.length&&(DEPENDENT.has(chars[i])||SIGNS.has(chars[i])))rest.push(chars[i++]);}
  const text=chars.slice(start,i).join(''),hasAbove=rest.some(ch=>ABOVE_VOWELS.has(ch)),pre=[],after=[];
  if(preRo)pre.push('្រ.pre');
  for(const ch of rest){
   if(invisible(ch))continue;
   if(PREBASE.has(ch))pre.push(ch);
   else if(TWO_PART[ch]){pre.push('េ');after.push(TWO_PART[ch]);}
   else if(SHIFTERS.has(ch)&&hasAbove)after.push('ុ');
   else after.push(ch);}
  const keys=[...pre,c,...subs.map(s=>s+'.sub'),...after];
  if(pre.length||rest.some(invisible)||keys.length!==1+subs.length+rest.length){cells.push({key:keys[0],text});for(const k of keys.slice(1))cells.push({key:k,text:''});}
  else{cells.push({key:c,text:c});subs.forEach(s=>cells.push({key:s+'.sub',text:COENG+s}));rest.forEach((ch,k)=>cells.push({key:keys[1+subs.length+k],text:ch}));}
 }
 return cells;
}
// GSUB for the OTF, script khmr: the coeng ligatures a shaper asks for. blwf turns coeng +
// consonant into the subscript form; pref turns coeng + រ into the prebase ro, which the
// shaper then moves before the base. The two-part vowels need no lookup: their code points
// are drawn as their right parts and the shaper inserts េ before the base itself (see the
// glyph table). What a single or ligature substitution cannot express is in PROPOSAL.md.
export function features(ctx){
 const gid=key=>ctx.index.get(key),has=(...keys)=>keys.every(k=>gid(k)!==undefined),out=[];
 const blwf=[...CONS].filter(c=>c!=='រ'&&has(COENG,c,c+'.sub')).map(c=>[[gid(COENG),gid(c)],gid(c+'.sub')]);
 if(blwf.length)out.push({tag:'blwf',ligatures:blwf});
 if(has(COENG,'រ','្រ.pre'))out.push({tag:'pref',ligatures:[[[gid(COENG),gid('រ')],gid('្រ.pre')]]});
 return out;
}
const consonants=Object.keys(CONSONANTS).join(''),independent=Object.keys(INDEPENDENT).join('');
export default {
 id:'khmer',label:'Khmer',script:'khmr',ranges:[[0x1780,0x17ff],[0x19e0,0x19ff]],
 marks:'ិីឹឺុូួើំ៉៊់៌៍៎៏័៑្៓៝',
 // A mark's outline moves left by the mean letter advance less half the mean letter width, so
 // it lands over the middle of the letter before it where no positioning applies.
 markShift:320,
 glyphs,shape,features,
 groups:[
  {id:'khmer-consonants',label:'Khmer consonants',characters:consonants},
  {id:'khmer-vowels',label:'Khmer vowels and signs',characters:[...independent+'ាិីឹឺុូួើឿៀេែៃោៅំះៈ៉៊់៌៍៎៏័៑្៓។៕៖ៗ៘៙៚៛ៜ៝','ើ.above','ឿ.post','ៀ.post','ោ.post','ៅ.post']},
  // forms, not characters: `lazy` keeps them out of the mapped-character count (the font maps them as forms)
  {id:'khmer-subscripts',label:'Khmer subscripts',characters:[...consonants].map(c=>c==='រ'?'្រ.pre':c+'.sub'),lazy:60},
  {id:'khmer-digits',label:'Khmer digits',characters:'០១២៣៤៥៦៧៨៩'},
 ],
 languages:[['khm','Khmer']],
 samples:['សួស្តី','ភ្នំពេញ\nសៀមរាប','ភាសាខ្មែរ','អរគុណ ច្រើន','អង្គរវត្ត','ថ្ងៃទី ២០\nឆ្នាំ ២០២៦','ព្រះរាជាណាចក្រ\nកម្ពុជា','សូមស្វាគមន៍'],
 codePages:[],
};
