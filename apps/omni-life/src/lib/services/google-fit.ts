import axios from 'axios';

const GOOGLE_FIT_API_URL = 'https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate';

export const getDailySteps = async (accessToken: string, date: Date) => {
  const startTimeMillis = new Date(date.setHours(0, 0, 0, 0)).getTime();
  const endTimeMillis = new Date(date.setHours(23, 59, 59, 999)).getTime();

  try {
    const response = await axios.post(
      GOOGLE_FIT_API_URL,
      {
        aggregateBy: [{ dataTypeName: 'com.google.step_count.delta', dataSourceId: 'derived:com.google.step_count.delta:com.google.android.gms:estimated_steps' }],
        bucketByTime: { durationMillis: 86400000 },
        startTimeMillis,
        endTimeMillis,
      },
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const bucket = response.data.bucket[0];
    const steps = bucket?.dataset[0]?.point[0]?.value[0]?.intVal || 0;
    return steps;
  } catch (error) {
    console.error('Error fetching Google Fit steps:', error);
    return 0;
  }
};

export const getActiveCalories = async (accessToken: string, date: Date) => {
  const startTimeMillis = new Date(date.setHours(0, 0, 0, 0)).getTime();
  const endTimeMillis = new Date(date.setHours(23, 59, 59, 999)).getTime();

  try {
    const response = await axios.post(
      GOOGLE_FIT_API_URL,
      {
        aggregateBy: [{ dataTypeName: 'com.google.calories.expended' }],
        bucketByTime: { durationMillis: 86400000 },
        startTimeMillis,
        endTimeMillis,
      },
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const bucket = response.data.bucket[0];
    const calories = bucket?.dataset[0]?.point[0]?.value[0]?.fpVal || 0;
    return Math.round(calories);
  } catch (error) {
    console.error('Error fetching Google Fit calories:', error);
    return 0;
  }
};

export const getSleepDuration = async (accessToken: string, date: Date) => {
  const startTimeMillis = new Date(date.getTime() - 24 * 60 * 60 * 1000).setHours(18, 0, 0, 0);
  const endTimeMillis = new Date(date.getTime()).setHours(12, 0, 0, 0);

  try {
    const response = await axios.post(
      GOOGLE_FIT_API_URL,
      {
        aggregateBy: [{ dataTypeName: 'com.google.sleep.segment' }],
        bucketByTime: { durationMillis: 86400000 * 2 },
        startTimeMillis,
        endTimeMillis,
      },
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    let totalSleepMillis = 0;
    response.data.bucket.forEach((bucket: any) => {
      bucket.dataset[0].point.forEach((point: any) => {
        const start = parseInt(point.startTimeNanos) / 1000000;
        const end = parseInt(point.endTimeNanos) / 1000000;
        totalSleepMillis += (end - start);
      });
    });

    return parseFloat((totalSleepMillis / (1000 * 60 * 60)).toFixed(2));
  } catch (error) {
    console.error('Error fetching Google Fit sleep:', error);
    return 0;
  }
};

export const getWeeklyActivity = async (accessToken: string) => {
  const now = new Date();

  const steps = await getDailySteps(accessToken, now);
  const calories = await getActiveCalories(accessToken, now);
  const sleep = await getSleepDuration(accessToken, now);

  return {
    today: { steps, calories, sleep },
    summary: 'Activity summary for the last 7 days'
  };
};
