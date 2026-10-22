export const DEFAULT_FAMILY='Overdot';
// Overdot was called Moduletext until October 2026; projects may still carry that name.
export const FORMER_FAMILY='Moduletext';
export function fontStyle(settings){const weight=Math.round(settings.weight),width=Math.round(settings.width);const w=weight===400?'Regular':weight===500?'Medium':weight===700?'Bold':weight===900?'Extra Bold':'Weight '+weight;const wd=width===70?'Condensed':width===100?'':width===135?'Extended':'Width '+width;return [wd,w].filter(Boolean).join(' ');}
export function safeName(value){return String(value||DEFAULT_FAMILY).normalize('NFKC').replace(/[\x00-\x1f\x7f]/g,'').trim().slice(0,60)||DEFAULT_FAMILY;}
export function psName(value){return String(value).normalize('NFKD').replace(/[̀-ͯ]/g,'').replace(/[^A-Za-z0-9-]/g,'').slice(0,63);}
// Without a chosen name, each look installs as its own family.
export function defaultFamilyName(look){return look?DEFAULT_FAMILY+' '+look.replace(/(^|\s)\p{Ll}/gu,c=>c.toUpperCase()):DEFAULT_FAMILY;}
const ABBREVIATIONS=[['Extra Bold','XBd'],['Condensed','Cn'],['Extended','Ex'],['Regular','Rg'],['Medium','Md'],['Bold','Bd'],['Weight ','W'],['Width ','Wd']];
// Typographic names keep the full family. Legacy family names stay within the
// 31 characters Windows menus support, abbreviating the style before the family.
// The full name must then start with that shortened family for Office embedding.
export function fontNames(familyName,settings){
 const family=safeName(familyName),style=fontStyle(settings),weight=Math.round(settings.weight),width=Math.round(settings.width),ribbi=width===100&&(weight===400||weight===700);
 let suffix=ribbi?'':' '+style;const shortened=(family+suffix).length>31;if(shortened&&suffix)suffix=' '+ABBREVIATIONS.reduce((s,[from,to])=>s.replaceAll(from,to),style);
 const legacyFamily=(family.slice(0,Math.max(1,31-suffix.length)).trimEnd()||family[0])+suffix,psStyle=psName(style)||'Regular',psFamily=psName(family).replace(/-/g,'')||DEFAULT_FAMILY,postScriptName=psFamily.slice(0,62-psStyle.length)+'-'+psStyle;
 return {familyName:family,styleName:style,legacyFamily,legacyStyle:width===100&&weight===700?'Bold':'Regular',fullName:shortened?(ribbi?legacyFamily+' '+style:legacyFamily):family+' '+style,postScriptName,fileName:postScriptName+'.otf'};
}
export function fontVersion(value=1){const version=Math.round(Number(value)*1000)/1000;if(!Number.isFinite(version)||version<1||version>999.999)throw Error('Font version must be between 1.000 and 999.999.');return version;}
export const versionString=version=>'Version '+version.toFixed(3);
// Optional rights and contact records. Blank fields are omitted from the font.
export const FONT_INFO_FIELDS={copyright:200,designer:100,manufacturer:100,website:200,license:1000,licenseURL:200};
export function readFontInfo(input={}){
 const out={};for(const [key,max]of Object.entries(FONT_INFO_FIELDS)){const value=String(input?.[key]??'').normalize('NFC');out[key]=(key==='license'?value.replace(/\r\n?/g,'\n').replace(/[\x00-\x09\x0b-\x1f\x7f]/g,' '):value.replace(/[\x00-\x1f\x7f]/g,' ')).trim().slice(0,max);}
 const vendor=String(input?.vendorID??'').trim();if(vendor&&!/^[A-Za-z0-9]{1,4}$/.test(vendor))throw Error('Vendor ID must be one to four letters or numbers.');out.vendorID=vendor;return out;
}
