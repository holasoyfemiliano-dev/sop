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
    const store = await cookies();
    store.set("gcal_tokens", JSON.stringify(credentials), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
  }

  return oauth2Client;
}

export async function POST(req: NextRequest) {
  try {
    const { taskId, title, scheduledDate, scheduledStart, scheduledEnd, gcalEventId } =
      await req.json();

    const oauth2Client = await getOAuth2Client();
    if (!oauth2Client) {
      return NextResponse.json({ error: "Not connected to Google Calendar" }, { status: 401 });
    }

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    const startISO = `${scheduledDate}T${scheduledStart}:00`;
    const endISO = `${scheduledDate}T${scheduledEnd}:00`;

    const eventBody = {
      summary: title,
      description: `SOP | ID: ${taskId}`,
      start: { dateTime: startISO, timeZone: "America/Bogota" },
      end: { dateTime: endISO, timeZone: "America/Bogota" },
      colorId: "9",  // Blueberry — matches SOP blue
      extendedProperties: {
        private: { sopTaskId: taskId },
      },
    };

    if (gcalEventId) {
      await calendar.events.update({
        calendarId: "primary",
        eventId: gcalEventId,
        requestBody: eventBody,
      });
      return NextResponse.json({ gcalEventId });
    } else {
      const { data } = await calendar.events.insert({
        calendarId: "primary",
        requestBody: eventBody,
      });
      return NextResponse.json({ gcalEventId: data.id });
    }
  } catch (err) {
    console.error("[gcal/sync-task]", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
