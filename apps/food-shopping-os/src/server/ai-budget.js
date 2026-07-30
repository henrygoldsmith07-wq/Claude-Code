import { ApiError } from './api.js';
import { getDatabase } from './mongodb.js';

const DEFAULT_MONTHLY_LIMIT = 250000;

export const monthlyAiLimit = () => {
  const configured = Number(process.env.AI_MONTHLY_TOKEN_LIMIT);
  return Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_MONTHLY_LIMIT;
};

export const tokenReservation = (input, outputLimit = 1200) =>
  Math.min(monthlyAiLimit(), JSON.stringify(input).length + outputLimit);

const usageId = (householdId, date = new Date()) =>
  `${householdId}:${date.toISOString().slice(0, 7)}`;

export async function reserveAiBudget(householdId, tokens) {
  const db = await getDatabase();
  const limit = monthlyAiLimit();
  const _id = usageId(householdId);
  try {
    const usage = await db.collection('aiUsage').findOneAndUpdate(
      {
        _id,
        $expr: { $lte: [{ $add: [{ $ifNull: ['$used', 0] }, { $ifNull: ['$reserved', 0] }, tokens] }, limit] },
      },
      {
        $inc: { reserved: tokens },
        $setOnInsert: { householdId, month: _id.slice(-7), used: 0, createdAt: new Date() },
        $set: { updatedAt: new Date(), limit },
      },
      { upsert: true, returnDocument: 'after', includeResultMetadata: false },
    );
    if (!usage) throw new ApiError(429, 'This household has reached its monthly AI allowance.');
  } catch (error) {
    if (error?.code === 11000) throw new ApiError(429, 'This household has reached its monthly AI allowance.');
    throw error;
  }
  return { id: _id, reserved: tokens };
}

export async function settleAiBudget(reservation, used = 0) {
  if (!reservation) return;
  const db = await getDatabase();
  await db.collection('aiUsage').updateOne(
    { _id: reservation.id },
    {
      $inc: {
        reserved: -reservation.reserved,
        used: Math.max(0, Math.min(reservation.reserved, Number(used) || reservation.reserved)),
      },
      $set: { updatedAt: new Date() },
    },
  );
}

export async function releaseAiBudget(reservation) {
  if (!reservation) return;
  const db = await getDatabase();
  await db.collection('aiUsage').updateOne(
    { _id: reservation.id },
    { $inc: { reserved: -reservation.reserved }, $set: { updatedAt: new Date() } },
  );
}
