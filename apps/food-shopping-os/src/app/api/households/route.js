import { NextResponse } from 'next/server';
import { assertSameOrigin, handleApiError, rateLimit, requireUser } from '../../../server/api.js';
import { ensurePersonalHousehold, publicHousehold } from '../../../server/households.js';
import { getDatabase } from '../../../server/mongodb.js';
import { householdSchema } from '../../../server/schemas.js';

export async function GET() {
  try {
    const user = await requireUser();
    await ensurePersonalHousehold(user);
    const db = await getDatabase();
    const memberships = await db.collection('memberships').find({ userId: user.id }).toArray();
    const households = await db.collection('households').find({
      _id: { $in: memberships.map((item) => item.householdId) },
    }).toArray();
    const byHousehold = new Map(memberships.map((item) => [item.householdId.toString(), item]));
    return NextResponse.json(households.map((household) => publicHousehold(
      household,
      byHousehold.get(household._id.toString()),
    )));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    await rateLimit(`households:create:${user.id}`, 10, 3600000);
    const input = householdSchema.parse(await request.json());
    const db = await getDatabase();
    const now = new Date();
    const inserted = await db.collection('households').insertOne({
      name: input.name,
      ownerId: user.id,
      createdAt: now,
      updatedAt: now,
    });
    await db.collection('memberships').insertOne({
      householdId: inserted.insertedId,
      userId: user.id,
      email: user.email || null,
      role: 'owner',
      permissions: ['shopping', 'pantry', 'recipes', 'health', 'admin'],
      createdAt: now,
    });
    return NextResponse.json({ id: inserted.insertedId.toString(), name: input.name, role: 'owner' }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
