import { NextResponse } from "next/server";
import { runDaily } from "@/lib/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Called by Vercel Cron (see vercel.json) or any scheduler:
//   curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/daily
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const report = await runDaily();
  return NextResponse.json(report);
}
