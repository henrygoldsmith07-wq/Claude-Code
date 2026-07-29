import { z } from 'zod';

export const stateSchema = z.object({
  schemaVersion: z.number().int().min(1).max(100).optional(),
  onboarded: z.boolean(),
}).catchall(z.unknown());

export const syncSchema = z.object({
  version: z.number().int().min(0),
  deviceId: z.string().min(8).max(100),
  state: stateSchema,
});

export const householdSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export const invitationSchema = z.object({
  email: z.string().email().max(254),
  role: z.enum(['adult', 'child']),
  permissions: z.array(z.enum(['shopping', 'pantry', 'recipes', 'health'])).max(4),
});

export const aiRequestSchema = z.object({
  task: z.enum(['shopping', 'nutrition', 'recipe', 'pantry', 'substitution', 'meal-plan', 'budget', 'waste', 'route', 'cooking']),
  prompt: z.string().trim().min(1).max(4000),
  context: z.record(z.string(), z.unknown()).optional(),
});

export const calendarEventSchema = z.object({
  provider: z.enum(['google', 'azure-ad']),
  title: z.string().trim().min(1).max(160),
  notes: z.string().max(2000).optional(),
  start: z.iso.datetime(),
  end: z.iso.datetime(),
}).refine((value) => new Date(value.end) > new Date(value.start), {
  message: 'Event end must be after its start.',
});

export const retailerQuerySchema = z.object({
  retailer: z.enum(['tesco', 'sainsburys', 'asda', 'aldi', 'lidl', 'morrisons', 'waitrose', 'ocado', 'amazon-fresh']),
  query: z.string().trim().min(2).max(120),
});

export const retailerResultSchema = z.object({
  name: z.string().max(200),
  price: z.number().nonnegative().nullable(),
  currency: z.literal('GBP').default('GBP'),
  offer: z.string().max(300).nullable().optional(),
  availability: z.enum(['available', 'unavailable', 'unknown']),
  deliveryUrl: z.url().nullable().optional(),
  checkedAt: z.iso.datetime(),
});
