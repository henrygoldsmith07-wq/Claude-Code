import Ably from 'ably';

export async function publishHousehold(householdId, event) {
  if (!process.env.ABLY_API_KEY) return;
  try {
    const client = new Ably.Rest(process.env.ABLY_API_KEY);
    await client.channels.get(`household:${householdId}`).publish('changed', event);
  } catch (error) {
    console.error('Forq realtime publish failed', { householdId, message: error.message });
  }
}
