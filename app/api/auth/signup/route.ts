import { NextResponse } from "next/server";
import { authCredentialsSchema } from "@/lib/schemas";
import { supabaseAuthRequest } from "@/lib/supabase-auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const parsed = authCredentialsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Email or password is invalid" }, { status: 400 });
  const result = await supabaseAuthRequest("signup", parsed.data);
  if (!result) return NextResponse.json({ error: "Supabase Auth is not configured" }, { status: 503 });
  if (!result.ok || !result.data.user?.id) return NextResponse.json({ error: result.data.error_description ?? result.data.msg ?? "Sign-up failed" }, { status: 400 });

  const response = NextResponse.json({ data: { userId: result.data.user.id, needsVerification: !result.data.access_token } }, { status: 201 });
  await prisma.user.upsert({ where: { id: result.data.user.id }, create: { id: result.data.user.id, email: result.data.user.email ?? parsed.data.email }, update: { email: result.data.user.email ?? parsed.data.email } });
  if (result.data.access_token) {
    response.cookies.set("nivara-access-token", result.data.access_token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 3600 });
    if (result.data.refresh_token) response.cookies.set("nivara-refresh-token", result.data.refresh_token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  }
  return response;
}
