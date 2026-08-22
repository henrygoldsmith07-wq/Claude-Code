// Glutes — hip-dominant work. Romanian deadlift sits here (as the original
// library chose) because its primary driver is hip extension.
export const GLUTES_EXERCISES = [
  { id: 'romanian-deadlift', name: 'Romanian Deadlift', muscle: 'Glutes', equipment: ['dumbbells','barbell'], level: 'Intermediate', cues: ['Soft knee','Hinge, hamstrings stretch','Neutral spine'], substitution: ['glute-bridge','kettlebell-swing','hamstring-curl','sumo-deadlift'], progression: 'load', rom: true },
  { id: 'hip-thrust', name: 'Hip Thrust', muscle: 'Glutes', equipment: ['bench'], level: 'Beginner', cues: ['Shoulders on bench','Squeeze glutes at top'], substitution: ['glute-bridge','single-leg-glute-bridge','cable-kickback'], progression: 'load', rom: true },
  { id: 'glute-bridge', name: 'Glute Bridge', muscle: 'Glutes', equipment: ['bodyweight'], level: 'Beginner', cues: ['Feet flat','Drive hips up'], substitution: ['hip-thrust','romanian-deadlift','single-leg-glute-bridge'], supportsWeighted: true, progression: 'reps', rom: true },
  { id: 'single-leg-glute-bridge', name: 'Single-Leg Glute Bridge', muscle: 'Glutes', equipment: ['bodyweight'], level: 'Intermediate', cues: ['Level hips','Drive through one heel','No arching low back'], substitution: ['glute-bridge','hip-thrust','cable-kickback'], unilateral: true, progression: 'reps', rom: true },
  { id: 'cable-kickback', name: 'Cable Kickback', muscle: 'Glutes', equipment: ['cable'], level: 'Beginner', cues: ['Hinge slightly','Push back and up','Squeeze, no swing'], substitution: ['hip-thrust','single-leg-glute-bridge'], unilateral: true, progression: 'load' },
  { id: 'sumo-deadlift', name: 'Sumo Deadlift', muscle: 'Glutes', equipment: ['barbell'], level: 'Advanced', cues: ['Wide stance, toes out','Knees track wide','Lock out with glutes'], substitution: ['romanian-deadlift','barbell-squat'], unilateral: false, progression: 'load', rom: true },
];
