// Shoulders — vertical/horizontal pressing plus delt isolation.
export const SHOULDERS_EXERCISES = [
  { id: 'overhead-press-dumbbell', name: 'Dumbbell Overhead Press', muscle: 'Shoulders', equipment: ['dumbbells'], level: 'Beginner', cues: ['Ribs down','Press overhead without arching'], substitution: ['push-up','pike-push-up','arnold-press'], progression: 'load', rom: true },
  { id: 'pike-push-up', name: 'Pike Push-up', muscle: 'Shoulders', equipment: ['bodyweight'], level: 'Intermediate', cues: ['Hips high','Head between arms'], substitution: ['overhead-press-dumbbell'], supportsWeighted: true, progression: 'reps' },
  { id: 'lateral-raise', name: 'Lateral Raise', muscle: 'Shoulders', equipment: ['dumbbells'], level: 'Beginner', cues: ['Slight lean','Lead with elbows'], substitution: ['band-lateral-raise','rear-delt-fly','upright-row'], progression: 'load' },
  { id: 'band-lateral-raise', name: 'Banded Lateral Raise', muscle: 'Shoulders', equipment: ['bands'], level: 'Beginner', cues: ['Slow tempo'], substitution: ['lateral-raise'], progression: 'reps' },
  { id: 'face-pull', name: 'Face Pull', muscle: 'Shoulders', equipment: ['cable','bands'], level: 'Beginner', cues: ['Elbows high','Pull to forehead','Squeeze rear delts'], substitution: ['band-row','dumbbell-row','rear-delt-fly','upright-row'], progression: 'load' },
  { id: 'arnold-press', name: 'Arnold Press', muscle: 'Shoulders', equipment: ['dumbbells'], level: 'Intermediate', cues: ['Palms start facing you','Rotate as you press','No lower-back arch'], substitution: ['overhead-press-dumbbell'], unilateral: false, progression: 'load', rom: true },
  { id: 'rear-delt-fly', name: 'Rear Delt Fly', muscle: 'Shoulders', equipment: ['dumbbells','bands'], level: 'Beginner', cues: ['Hinge over','Lead with pinkies','No rowing the weight'], substitution: ['face-pull','lateral-raise'], unilateral: false, progression: 'load' },
  { id: 'upright-row', name: 'Upright Row', muscle: 'Shoulders', equipment: ['dumbbells','barbell'], level: 'Intermediate', cues: ['Pull to sternum height','Elbows lead','Stop below shoulder strain'], substitution: ['lateral-raise','face-pull'], unilateral: false, progression: 'load' },
];
