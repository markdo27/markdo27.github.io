import {layoutText,specimenContent,escapeXML} from './modules.js';
import {PAPERS,surfaceSVG} from './ink.js';
export const FAMILY_INSTANCES=[400,700,900].flatMap((weight,i)=>[70,100,135].map((width,j)=>({weight,width,name:['Regular','Bold','Extra Bold'][i]+(j===1?'':' '+['Condensed','','Extended'][j]),widthName:['Condensed','Normal','Extended'][j]})));
export const FAMILY_DEFAULTS={mode:'foundry',sentence:'Pack my box with five dozen liquor jugs.',paragraph:'Letters share a rhythm, but each has a voice. Compare shapes, spacing and texture in a complete sentence.'};
export function familySpecimen(skeletons,settings,options={}){
 const {appearance,mode='foundry',sentence=FAMILY_DEFAULTS.sentence,paragraph=FAMILY_DEFAULTS.paragraph,width=300,idPrefix='family'}=options;
 const blocks=mode==='paragraph'?[[paragraph,27]]:mode==='sentence'?[[sentence,40]]:mode==='scale'?[[sentence,42],[sentence,30],[sentence,21]]:[['Typeface',38],[sentence,25],[paragraph,21],['0123456789  /  & @ ! ?',19]];
 let y=0,content='',missing=new Set();blocks.forEach(([text,size],i)=>{const l=layoutText(text,skeletons,settings,{maxWidth:width*1000/size});l.missing.forEach(c=>missing.add(c));content+='<g data-specimen-block="'+i+'" transform="translate(0 '+y.toFixed(2)+') scale('+size/1000+')">'+specimenContent(l,idPrefix+'-'+i,appearance)+'</g>';y+=l.height*size/1000+(i<blocks.length-1?12:0);});
 const description=mode==='paragraph'?paragraph:mode==='sentence'||mode==='scale'?sentence:'Typeface '+sentence+' '+paragraph+' 0123456789';
 return {height:y,width,missing:[...missing],svg:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+width+' '+y.toFixed(2)+'" fill="currentColor" role="img" aria-label="'+escapeXML(description)+'"><title>'+escapeXML(description)+'</title>'+surfaceSVG(content,[0,0,width,y],appearance,{idPrefix,pitch:12})+'</svg>'};
}
export function familySheetSVG(skeletons,settings,options={}){
 const name=escapeXML(options.familyName||'Overdot'),width=340,gap=28,padding=32,specimens=FAMILY_INSTANCES.map((instance,i)=>familySpecimen(skeletons,{...settings,...instance},{...options,width,idPrefix:'export-family-'+i}));
 let y=padding,content='';for(let row=0;row<3;row++){const rowHeight=Math.max(...specimens.slice(row*3,row*3+3).map(s=>s.height))+82;for(let col=0;col<3;col++){const i=row*3+col,instance=FAMILY_INSTANCES[i],s=specimens[i],x=padding+col*(width+gap);content+='<g transform="translate('+x+' '+y+')"><text y="16" font-family="Arial, sans-serif" font-size="16" font-weight="bold">'+name+' '+instance.name+'</text><text y="36" font-family="monospace" font-size="11" fill="#666">Weight '+instance.weight+' / Width '+instance.width+'%</text>'+s.svg.replace('<svg ','<svg x="0" y="52" width="'+width+'" height="'+s.height.toFixed(2)+'" ')+'</g>';}y+=rowHeight+gap;}
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+(padding*2+width*3+gap*2)+' '+y.toFixed(2)+'" fill="#0a0a0a" color="#0a0a0a" role="img"><title>'+name+' — nine family specimens</title><rect width="100%" height="100%" fill="'+(options.appearance?PAPERS[options.appearance.paper]:'#fff')+'"/>'+content+'</svg>';
}
// The Tester's order: condensed to extended, and regular to extra bold within each width.
export const STYLE_ORDER=[70,100,135].flatMap(width=>[400,700,900].map(weight=>FAMILY_INSTANCES.find(i=>i.weight===weight&&i.width===width)));
// One text set in the nine styles of a variation, one row each, at one size.
export function familyTextSheetSVG(skeletons,settings,{text='Overdot',size=48,familyName='Overdot',appearance,width=1200}={}){
 const padding=40;let y=padding,content='';
 STYLE_ORDER.forEach((instance,i)=>{const l=layoutText(text,skeletons,{...settings,...instance},{maxWidth:width*1000/size});content+='<text y="'+(y+14)+'" font-family="Arial, sans-serif" font-size="13" font-weight="bold">'+escapeXML(familyName+' '+instance.name)+'</text><g transform="translate(0 '+(y+26)+') scale('+size/1000+')">'+specimenContent(l,'tester-'+i,appearance)+'</g>';y+=26+l.height*size/1000+30;});
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+(width+padding*2)+' '+(y+padding).toFixed(2)+'" fill="#111111" color="#111111" role="img"><title>'+escapeXML(familyName)+' — nine styles</title><rect width="100%" height="100%" fill="#ffffff"/><g transform="translate('+padding+' 0)">'+content+'</g></svg>';
}
