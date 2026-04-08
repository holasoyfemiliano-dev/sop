import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { google } from "googleapis";

export interface GCalEvent {
  id: string;
  gcalId: string;
  title: string;
  startTime: string;   // HH:MM
  endTime: string;     // HH:MM
  date: string;        // YYYY-MM-DD
  allDay: boolean;
  colorId?: string;
}

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

function toHHMM(dt: string, allDay: boolean): string {
  if (allDay) return "00:00";
  const d = new Date(dt);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function toDateStr(dt: string, dateOnly?: string): string {
  if (dateOnly) return dateOnly; // all-day event
  return new Date(dt).toISOString().split("T")[0];
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from"); // YYYY-MM-DD
  const to = searchParams.get("to");     // YYYY-MM-DD

  if (!from || !to) {
    return NextResponse.json({ events: [] });
  }

  const oauth2Client = await getOAuth2Client();
  if (!oauth2Client) {
    return NextResponse.json({ events: [], error: "not_connected" });
  }

  try {
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });
    const timeMin = new Date(from + "T00:00:00").toISOString();
    const timeMax = new Date(to + "T23:59:59").toISOString();

    const { data } = await calendar.events.list({
      calendarId: "primary",
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 250,
    });

    const events: GCalEvent[] = (data.items ?? [])
      .filter((e) => e.status !== "cancelled" && (e.start?.dateTime || e.start?.date))
      .map((e) => {
        const allDay = !e.start?.dateTime;
        const startDT = e.start?.dateTime ?? "";
        const startDate = e.start?.date ?? "";
        return {
          id: e.id ?? "",
          gcalId: e.id ?? "",
          title: e.summary ?? "(Sin título)",
          startTime: toHHMM(startDT, allDay),
          endTime: e.end?.dateTime ? toHHMM(e.end.dateTime, false) : "23:59",
          date: toDateStr(startDT, startDate),
          allDay,
          colorId: e.colorId ?? undefined,
        };
      });

    return NextResponse.json({ events });
  } catch (err) {
    console.error("[gcal/events]", err);
    return NextResponse.json({ events: [], error: "fetch_failed" });
  }
}
