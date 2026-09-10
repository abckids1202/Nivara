import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ data: { signedOut: true } });
  response.cookies.delete("nivara-access-token");
  response.cookies.delete("nivara-refresh-token");
  return response;
}
