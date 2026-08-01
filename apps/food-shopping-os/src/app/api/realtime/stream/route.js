import { handleApiError, rateLimit, requireUser } from '../../../../server/api.js';
import { getDatabase } from '../../../../server/database.js';
import { requireHousehold } from '../../../../server/households.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const encoder = new TextEncoder();
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function GET(request) {
  try {
    const user = await requireUser();
    await rateLimit(`realtime-stream:${user.id}`, 240, 3600000);
    const params = new URL(request.url).searchParams;
    const { household } = await requireHousehold(user, params.get('householdId'));
    const initialSince = new Date(params.get('since') || Date.now() - 10000);
    const db = await getDatabase();

    const stream = new ReadableStream({
      async start(controller) {
        let since = Number.isNaN(initialSince.getTime()) ? new Date(Date.now() - 10000) : initialSince;
        let closed = false;
        const close = () => {
          if (closed) return;
          closed = true;
          try { controller.close(); } catch { /* already closed */ }
        };
        const send = (value) => {
          if (!closed) controller.enqueue(encoder.encode(value));
        };

        send('retry: 3000\n\n');
        for (let tick = 0; tick < 12 && !closed; tick += 1) {
          const events = await db.collection('realtimeEvents').find({
            householdId: household._id,
            createdAt: { $gte: since },
          }).sort({ createdAt: 1 }).limit(25).toArray();
          for (const item of events) {
            send(`event: changed\ndata: ${JSON.stringify(item.event)}\n\n`);
            if (item.createdAt instanceof Date && item.createdAt > since) since = item.createdAt;
          }
          if (tick < 11) await wait(2000);
        }
        close();
      },
    });

    return new Response(stream, {
      headers: {
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
        'content-type': 'text/event-stream; charset=utf-8',
        'x-accel-buffering': 'no',
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
