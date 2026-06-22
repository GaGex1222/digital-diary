import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? null;
  return NextResponse.json({ email, name: null });
}
