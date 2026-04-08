import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { google } from "googleapis";

async function getOAuth2Client() {
  const cookieStore = await cookies();
  const tokensStr = cookieStore.get("gcal_tokens")?.value;
  if (!tokensStr) return null;
  const tokens = JSON.parse(tokensStr);
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI ?? "http://localhost:3000/api/gcal/callback"
  );
  oauth2Client.setCredentials(tokens);
  if (tokens.expiry_date && tokens.expiry_date < Date.now() + 60000) {
    const { credentials } = await oauth2Client.refreshAccessToken();
    oauth2Client.setCredentials(credentials);
  }
  return oauth2Client;
}

export async function DELETE(req: NextRequest) {
  const { gcalEventId, calendarId = "primary" } = await req.json();

  if (!gcalEventId) {
    return NextResponse.json({ error: "gcalEventId required" }, { status: 400 });
  }

  const oauth2Client = await getOAuth2Client();
  if (!oauth2Client) {
    return NextResponse.json({ error: "not_connected" }, { status: 401 });
  }

  try {
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });
    await calendar.events.delete({ calendarId, eventId: gcalEventId });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[gcal/delete-event]", err);
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }
}
