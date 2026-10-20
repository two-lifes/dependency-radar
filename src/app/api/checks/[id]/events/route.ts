import { z } from "zod";
import { encodeSseEvent, SSE_PING } from "@/server/check/events";
import { serveCheck } from "@/server/check/serve-check";
import { createPgCheckStore } from "@/server/db/check-store";
import { getDb } from "@/server/db/client";
import { createPgCache } from "@/server/sources/cache";
import { createLimiter } from "@/server/sources/limiter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// decisions 16: the check runs inside this stream, up to Vercel's limit.
export const maxDuration = 300;

// Hands the check over before Vercel kills the function: the lease is freed
// and the stream closes, EventSource reconnects and a new run goes on.
// Without it the check would wait for its lease to expire first.
const SOFT_DEADLINE_MS = 280_000;
const PING_MS = 15_000;
const SOURCE_CONCURRENCY = 8;

const idSchema = z.uuid();

/** SSE progress of one check; the stream also runs it (see `serveCheck`). */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) return notFound();

  const db = getDb();
  const store = createPgCheckStore(db);
  if (!(await store.getCheck(id))) return notFound();

  const closed = new AbortController();
  // Next.js aborts request.signal when the response closes before it ends;
  // cancel() covers the same from the stream side.
  const signal = AbortSignal.any([request.signal, closed.signal]);
  const deadline = AbortSignal.timeout(SOFT_DEADLINE_MS);
  const encoder = new TextEncoder();
  let open = true;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (chunk: string) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // The client went away between our check and the write.
          open = false;
        }
      };
      const ping = setInterval(() => write(SSE_PING), PING_MS);

      serveCheck(
        id,
        {
          store,
          cache: createPgCache(db),
          limit: createLimiter(SOURCE_CONCURRENCY),
        },
        { signal, deadline, emit: (event) => write(encodeSseEvent(event)) },
      )
        .catch((error: unknown) => {
          console.error(`[check] stream for ${id} failed`, error);
          write(encodeSseEvent({ type: "error" }));
        })
        .finally(() => {
          clearInterval(ping);
          if (!open) return;
          open = false;
          controller.close();
        });
    },
    // Closing the EventSource is how the page cancels a check it runs.
    cancel() {
      open = false;
      closed.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Proxies that buffer would hold events until the check ends.
      "X-Accel-Buffering": "no",
    },
  });
}

function notFound() {
  return new Response(null, { status: 404 });
}
