// Shadowing progression: listen → shadow → free, tracking WPM/filler delta.

export const SHADOW_LEVELS = [
  { id: 1, label: 'Listen', hint: 'Listen only, no speaking' },
  { id: 2, label: 'Shadow', hint: 'Speak along quietly' },
  { id: 3, label: 'Free', hint: 'Repeat freely, scored' },
];

export function nextShadowLevel(current, accuracy){
  if(accuracy>=80 && current<3) return current+1;
  if(accuracy<50 && current>1) return current-1;
  return current;
}

export function shadowScoreDelta(prevWpm, nextWpm, prevFillers, nextFillers){
  return { wpmDelta: nextWpm - prevWpm, fillerDelta: nextFillers - prevFillers, improving: nextWpm>=prevWpm && nextFillers<=prevFillers };
}
