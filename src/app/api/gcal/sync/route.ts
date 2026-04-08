import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { google } from "googleapis";
import type { TimeBlock } from "@/lib/types";

function blockToGCalEvent(block: TimeBlock) {
  const dateStr = block.date;
  const startISO = `${dateStr}T${block.startTime}:00`;
  const endISO = `${dateStr}T${block.endTime}:00`;

  const colorMap: Record<string, string> = {
    negocio: "9",    // Blueberry
    salud: "10",     // Sage
    aprendizaje: "3", // Grape
    relaciones: "6", // Flamingo
    finanzas: "5",   // Banana
    personal: "6",   // Tangerine
    travel: "8",     // Graphite
  };

  const colorId = block.category
    ? colorMap[block.category] ?? "1"
    : block.type === "travel"
    ? "8"
    : "1";

  return {
    summary: block.title,
    description: `SOP - ${block.type === "travel" ? "Traslado" : "Tarea"} | ID: ${block.id}`,
    start: { dateTime: startISO, timeZone: "America/Bogota" },
    end: { dateTime: endISO, timeZone: "America/Bogota" },
    colorId,
    extendedProperties: {
      private: {
        sopBlockId: block.id,
        sopTaskId: block.taskId ?? "",
        sopType: block.type,
      },
    },
  };
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

  // Refresh token if expired
  if (tokens.expiry_date && tokens.expiry_date < Date.now() + 60000) {
    const { credentials } = await oauth2Client.refreshAccessToken();
    oauth2Client.setCredentials(credentials);
    const cookieStore2 = await cookies();
    cookieStore2.set("gcal_tokens", JSON.stringify(credentials), {
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
    const { blocks, calendarId = "primary" }: { blocks: TimeBlock[]; calendarId?: string } =
      await req.json();

    const oauth2Client = await getOAuth2Client();
    if (!oauth2Client) {
      return NextResponse.json({ error: "Not connected to Google Calendar" }, { status: 401 });
    }

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });
    const results: { blockId: string; gcalEventId: string; status: string }[] = [];

    for (const block of blocks) {
      try {
        const eventBody = blockToGCalEvent(block);

        if (block.gcalEventId) {
          // Update existing event
          await calendar.events.update({
            calendarId,
            eventId: block.gcalEventId,
            requestBody: eventBody,
          });
          results.push({ blockId: block.id, gcalEventId: block.gcalEventId, status: "updated" });
        } else {
          // Create new event
          const { data } = await calendar.events.insert({
            calendarId,
            requestBody: eventBody,
          });
          results.push({ blockId: block.id, gcalEventId: data.id!, status: "created" });
        }
      } catch (blockErr) {
        console.error(`[gcal/sync] Block ${block.id} failed:`, blockErr);
        results.push({ blockId: block.id, gcalEventId: "", status: "failed" });
      }
    }

    return NextResponse.json({ results });
  } catch (err) {
    console.error("[gcal/sync]", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
