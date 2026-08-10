// Content-quality filter: block/flag low-quality generated items before they reach the learner.
export function isQualityItem(item){
  if(!item || !item.fr) return false;
  if(item.fr.length<2) return false;
  if(/xxx|nsfw/i.test(item.fr)) return false;
  return true;
}
export function filterQuality(items){ return (items||[]).filter(isQualityItem); }

export function benchmarkCorrections(pairs){
  // pairs: [{ original, corrected, why }]
  // Returns share with an explanation vs bare replacement
  if(!pairs.length) return { total:0, explained:0, rate:0 };
  const explained = pairs.filter(p=> p.why && p.why.length>8).length;
  return { total: pairs.length, explained, rate: Math.round(explained/pairs.length*100) };
}
