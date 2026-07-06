import axios from 'axios';
import * as cheerio from 'cheerio';

// Define TypeScript types for Hevy data
export interface HevySet {
  reps: number;
  weight: number;
  unit: string;
}

export interface HevyExercise {
  name: string;
  sets: HevySet[];
}

export interface HevyWorkout {
  name: string;
  start_time: string;
  duration_seconds: number;
  exercises: HevyExercise[];
}

function parseDurationToSeconds(durationText: string): number {
  const hours = parseInt(durationText.match(/(\d+)\s*h/)?.[1] || '0', 10);
  const minutes = parseInt(durationText.match(/(\d+)\s*m/)?.[1] || '0', 10);
  return hours * 3600 + minutes * 60;
}

function parseWorkoutDate(dateText: string): string {
  const parsed = new Date(dateText);
  return (isNaN(parsed.getTime()) ? new Date() : parsed).toISOString();
}

const HEVY_USERNAME = process.env.HEVY_USERNAME || '';
const HEVY_PROFILE_URL = `https://hevy.com/user/${HEVY_USERNAME}`;

/**
 * Fetches recent workouts by scraping the Hevy public profile page.
 * @returns A promise that resolves to an array of HevyWorkout objects.
 */
export const fetchRecentWorkouts = async (): Promise<HevyWorkout[]> => {
  try {
    const { data } = await axios.get(HEVY_PROFILE_URL);
    const $ = cheerio.load(data);
    const workouts: HevyWorkout[] = [];

    // This is a simplified example. The actual scraping logic will depend on the Hevy page structure.
    // You would need to inspect the HTML of a Hevy profile page to get the correct selectors.
    // For demonstration, let's assume a basic structure.
    $('div.workout-card').each((_i, element) => {
      const dateText = $(element).find('.workout-date').text().trim();
      const durationText = $(element).find('.workout-duration').text().trim();
      const exercises: HevyExercise[] = [];

      $(element).find('.exercise-item').each((_j, exElement) => {
        const name = $(exElement).find('.exercise-name').text().trim();
        const sets: HevySet[] = [];

        $(exElement).find('.set-item').each((_k, setElement) => {
          const reps = parseInt($(setElement).find('.set-reps').text().trim(), 10);
          const weight = parseFloat($(setElement).find('.set-weight').text().trim());
          const unit = $(setElement).find('.set-unit').text().trim();
          sets.push({ reps, weight, unit });
        });
        exercises.push({ name, sets });
      });

      workouts.push({
        name: exercises[0]?.name ? `${exercises[0].name} Workout` : 'Workout',
        start_time: parseWorkoutDate(dateText),
        duration_seconds: parseDurationToSeconds(durationText),
        exercises,
      });
    });

    return workouts;
  } catch (error) {
    console.error(`Error scraping Hevy profile for ${HEVY_USERNAME}:`, error);
    return [];
  }
};

/**
 * Retrieves the latest workout from the public profile.
 * @returns A promise that resolves to the latest HevyWorkout object or null if none found.
 */
export const getLatestWorkout = async (): Promise<HevyWorkout | null> => {
  const workouts = await fetchRecentWorkouts();
  return workouts.length > 0 ? workouts[0] : null;
};

/**
 * Calculates and returns workout statistics (e.g., total volume, max lifts).
 * This is a placeholder and would require more detailed parsing of exercises and sets.
 * @returns A promise that resolves to an object containing workout statistics.
 */
export const getWorkoutStats = async (): Promise<any> => {
  const workouts = await fetchRecentWorkouts();
  let totalVolume = 0;
  const maxLifts: { [key: string]: number } = {};

  workouts.forEach(workout => {
    workout.exercises.forEach(exercise => {
      exercise.sets.forEach(set => {
        totalVolume += set.reps * set.weight;
        if (!maxLifts[exercise.name] || set.weight > maxLifts[exercise.name]) {
          maxLifts[exercise.name] = set.weight;
        }
      });
    });
  });

  return { totalVolume, maxLifts, workoutCount: workouts.length };
};
