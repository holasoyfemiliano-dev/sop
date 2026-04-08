import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function DELETE() {
  const cookieStore = await cookies();

  try {
    const tokensStr = cookieStore.get("gcal_tokens")?.value;
    if (tokensStr) {
      const tokens = JSON.parse(tokensStr);
      // Attempt to revoke token
      if (tokens.access_token) {
        await fetch(
          `https://oauth2.googleapis.com/revoke?token=${tokens.access_token}`,
          { method: "POST" }
        ).catch(() => {});
      }
    }
  } catch {
    // ignore revoke errors
  }

  cookieStore.delete("gcal_tokens");
  cookieStore.delete("gcal_info");
  cookieStore.delete("gcal_state");

  return NextResponse.json({ success: true });
}
