/**
 * Cron endpoint: run the proposal-time alerting poll cycle.
 * Call every ~15s (e.g. Vercel Cron or external cron).
 * Secure with CRON_SECRET: Authorization: Bearer <CRON_SECRET>
 */

import { NextResponse } from "next/server";
import { runPollCycle } from "@/lib/alerting/poller";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function getCronSecret(): string | null {
  return process.env.CRON_SECRET ?? process.env.ALERT_CRON_SECRET ?? null;
}

function isAuthorized(request: Request): boolean {
  const secret = getCronSecret();
  if (!secret) return true; // No secret set: allow (dev only)
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  return auth.slice(7) === secret;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runPollCycle();
    return NextResponse.json({
      ok: true,
      processed: result.processed,
      newEvents: result.newEvents,
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[cron/alerts-poll]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
