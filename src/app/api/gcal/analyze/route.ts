import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { google } from "googleapis";

export interface CalendarPattern {
  email: string;
  eventCount: number;
  wakeHour: number;
  sleepHour: number;
  workStart: number;
  workEnd: number;
  lunchHour: number;
  hasExercise: boolean;
  exerciseHour: number | null;
  recurringTitles: string[];
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

function hourFromISO(dt: string): number {
  // dt is like "2024-01-15T09:30:00+05:00"
  const d = new Date(dt);
  return d.getHours();
}

export async function GET() {
  const cookieStore = await cookies();
  const gcalInfo = cookieStore.get("gcal_info")?.value;

  // Default pattern if no GCal or no events found
  const defaults: CalendarPattern = {
    email: gcalInfo ? JSON.parse(gcalInfo).email ?? "" : "",
    eventCount: 0,
    wakeHour: 7,
    sleepHour: 23,
    workStart: 9,
    workEnd: 18,
    lunchHour: 13,
    hasExercise: false,
    exerciseHour: null,
    recurringTitles: [],
  };

  const oauth2Client = await getOAuth2Client();
  if (!oauth2Client) {
    return NextResponse.json({ pattern: defaults });
  }

  try {
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(now.getDate() - 90);

    const { data } = await calendar.events.list({
      calendarId: "primary",
      timeMin: pastDate.toISOString(),
      timeMax: now.toISOString(),
      maxResults: 500,
      singleEvents: true,
      orderBy: "startTime",
    });

    const events = (data.items ?? []).filter(
      (e) => e.start?.dateTime && e.status !== "cancelled"
    );

    if (events.length === 0) {
      return NextResponse.json({ pattern: defaults });
    }

    // ── Hour frequency analysis ──────────────────────────────────────────
    const hourCounts: Record<number, number> = {};
    const titleCounts: Record<string, number> = {};
    const EXERCISE_KW = ["gym", "ejercicio", "entrena", "yoga", "run", "correr", "deporte", "crossfit", "pilates", "natación", "swim", "cycling", "bici"];
    const MEAL_KW = ["almuerzo", "lunch", "comida", "cena", "dinner", "desayuno", "breakfast"];
    let exerciseCount = 0;
    const exerciseHours: number[] = [];
    const mealHours: number[] = [];
    const workdayStartHours: number[] = [];
    const workdayEndHours: number[] = [];

    for (const evt of events) {
      const startDT = evt.start?.dateTime ?? "";
      const endDT = evt.end?.dateTime ?? "";
      const title = (evt.summary ?? "").toLowerCase();
      const h = hourFromISO(startDT);
      const d = new Date(startDT).getDay(); // 0=Sun, 6=Sat
      const isWeekday = d >= 1 && d <= 5;

      // Hour frequency
      hourCounts[h] = (hourCounts[h] ?? 0) + 1;

      // Recurring titles
      const normalTitle = (evt.summary ?? "").trim();
      if (normalTitle) titleCounts[normalTitle] = (titleCounts[normalTitle] ?? 0) + 1;

      // Exercise detection
      if (EXERCISE_KW.some((kw) => title.includes(kw))) {
        exerciseCount++;
        exerciseHours.push(h);
      }

      // Meal detection
      if (MEAL_KW.some((kw) => title.includes(kw))) {
        mealHours.push(h);
      }

      // Work start/end on weekdays
      if (isWeekday) {
        if (h >= 6 && h <= 11) workdayStartHours.push(h);
        if (h >= 14 && h <= 21 && endDT) {
          const endH = hourFromISO(endDT);
          workdayEndHours.push(endH);
        }
      }
    }

    // ── Derive patterns ──────────────────────────────────────────────────
    const median = (arr: number[]) => {
      if (!arr.length) return null;
      const s = [...arr].sort((a, b) => a - b);
      return s[Math.floor(s.length / 2)];
    };

    const workStart = median(workdayStartHours) ?? 9;
    const workEnd = median(workdayEndHours.filter((h) => h > workStart)) ?? 18;
    const lunchHour = median(mealHours.filter((h) => h >= 11 && h <= 15)) ?? 13;
    const exerciseHour = exerciseCount >= 3 ? (median(exerciseHours) ?? null) : null;

    // Find recurring event titles (appears 4+ times)
    const recurringTitles = Object.entries(titleCounts)
      .filter(([, count]) => count >= 4)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([title]) => title);

    const pattern: CalendarPattern = {
      email: defaults.email,
      eventCount: events.length,
      wakeHour: 7,         // hard to infer from calendar alone
      sleepHour: 23,       // hard to infer from calendar alone
      workStart,
      workEnd,
      lunchHour,
      hasExercise: exerciseCount >= 3,
      exerciseHour,
      recurringTitles,
    };

    return NextResponse.json({ pattern });
  } catch (err) {
    console.error("[gcal/analyze]", err);
    return NextResponse.json({ pattern: defaults });
  }
}
