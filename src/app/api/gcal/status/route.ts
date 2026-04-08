import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const configured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

  const cookieStore = await cookies();
  const gcalInfoStr = cookieStore.get("gcal_info")?.value;
  let connected = false;
  let email: string | null = null;

  if (gcalInfoStr) {
    try {
      const info = JSON.parse(gcalInfoStr);
      connected = info.connected === true;
      email = info.email ?? null;
    } catch { /* ignore */ }
  }

  return NextResponse.json({ configured, connected, email });
}
