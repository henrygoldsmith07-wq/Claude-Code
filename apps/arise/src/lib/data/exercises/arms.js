// Arms — curls and tricep work, including the bodyweight diamond push-up so
// no-kit users have an arm option.
export const ARMS_EXERCISES = [
  { id: 'bicep-curl', name: 'Dumbbell Bicep Curl', muscle: 'Arms', equipment: ['dumbbells'], level: 'Beginner', cues: ['Elbows pinned','No swinging'], substitution: ['band-curl','hammer-curl'], unilateral: true, progression: 'load' },
  { id: 'band-curl', name: 'Banded Bicep Curl', muscle: 'Arms', equipment: ['bands'], level: 'Beginner', cues: ['Step on band','Control up and down'], substitution: ['bicep-curl','hammer-curl'], progression: 'reps' },
  { id: 'tricep-dip-bench', name: 'Bench Dip', muscle: 'Arms', equipment: ['bench'], level: 'Beginner', cues: ['Shoulders down','Elbows back'], substitution: ['push-up','tricep-pushdown','overhead-tricep-extension','diamond-push-up'], supportsWeighted: true, progression: 'reps', rom: true },
  { id: 'hammer-curl', name: 'Hammer Curl', muscle: 'Arms', equipment: ['dumbbells'], level: 'Beginner', cues: ['Neutral grip throughout','Elbows still','Squeeze at the top'], substitution: ['bicep-curl','band-curl'], unilateral: true, progression: 'load' },
  { id: 'tricep-pushdown', name: 'Tricep Pushdown', muscle: 'Arms', equipment: ['cable'], level: 'Beginner', cues: ['Upper arms pinned','Full lockout','Elbows stay in'], substitution: ['tricep-dip-bench','overhead-tricep-extension'], unilateral: false, progression: 'load' },
  { id: 'overhead-tricep-extension', name: 'Overhead Tricep Extension', muscle: 'Arms', equipment: ['dumbbells'], level: 'Beginner', cues: ['Elbows narrow','Deep stretch behind head','Extend fully'], substitution: ['tricep-pushdown','tricep-dip-bench'], unilateral: false, progression: 'load', rom: true },
  { id: 'diamond-push-up', name: 'Diamond Push-up', muscle: 'Arms', equipment: ['bodyweight'], level: 'Intermediate', cues: ['Hands form a diamond','Elbows brush ribs','Chest to hands'], substitution: ['push-up','tricep-dip-bench'], unilateral: false, supportsWeighted: true, progression: 'reps', rom: true },
];
