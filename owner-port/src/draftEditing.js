export function graphemeRanges(value){
 const text=String(value??'');
 if(typeof Intl.Segmenter==='function')return Array.from(new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(text),x=>({start:x.index,end:x.index+x.segment.length}));
 const ranges=[];let offset=0,regional=0;
 for(const character of Array.from(text)){
  const last=ranges[ranges.length-1],isRegional=/^[\u{1F1E6}-\u{1F1FF}]$/u.test(character);
  const joins=last&&(/^[\p{Mark}\uFE0F\uFE0E\u200D\u{1F3FB}-\u{1F3FF}\u{E0020}-\u{E007F}]$/u.test(character)||text.slice(last.start,last.end).endsWith('\u200D')||/[\u094D\u09CD\u0A4D\u0ACD\u0B4D\u0BCD\u0C4D\u0CCD\u0D4D\u0DCA\u1039\u17D2]$/.test(text.slice(last.start,last.end))||(isRegional&&regional%2===1));
  if(joins)last.end=offset+character.length;else ranges.push({start:offset,end:offset+character.length});
  regional=isRegional?regional+1:0;offset+=character.length;
 }
 return ranges;
}
export function eraseDraft(value,selection){
 const text=String(value??'');let start=Math.max(0,Math.min(text.length,Number.isFinite(selection?.start)?selection.start:text.length)),end=Math.max(start,Math.min(text.length,Number.isFinite(selection?.end)?selection.end:start));
 const ranges=graphemeRanges(text);
 if(start!==end){const overlaps=ranges.filter(x=>x.end>start&&x.start<end);if(overlaps.length){start=overlaps[0].start;end=overlaps[overlaps.length-1].end;}}
 else {if(!start)return {value:text,selection:{start:0,end:0}};const previous=ranges.find(x=>x.start<start&&x.end>=start);if(previous){start=previous.start;end=previous.end;}}
 return {value:text.slice(0,start)+text.slice(end),selection:{start,end:start}};
}

