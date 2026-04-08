import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { google } from "googleapis";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL("/settings?gcal=error", req.url));
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get("gcal_state")?.value;
  if (!savedState || savedState !== state) {
    return NextResponse.redirect(new URL("/settings?gcal=csrf_error", req.url));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? "http://localhost:3000/api/gcal/callback";

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  try {
    const { tokens } = await oauth2Client.getToken(code!);
    oauth2Client.setCredentials(tokens);

    // Get user email
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    // Get primary calendar
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });
    const { data: calList } = await calendar.calendarList.list({ maxResults: 1 });
    const primaryCal = calList.items?.find((c) => c.primary) ?? calList.items?.[0];

    // Store tokens in httpOnly cookie
    cookieStore.set("gcal_tokens", JSON.stringify(tokens), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });

    // Store user info in readable cookie (for client to display)
    cookieStore.set(
      "gcal_info",
      JSON.stringify({
        email: userInfo.email,
        calendarId: primaryCal?.id ?? "primary",
        connected: true,
      }),
      {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
      }
    );

    // Clear state/from cookies and redirect
    const from = cookieStore.get("gcal_from")?.value ?? "settings";
    cookieStore.delete("gcal_state");
    cookieStore.delete("gcal_from");

    const dest = from === "onboarding" ? "/onboarding?connected=true" : "/settings?gcal=connected";
    return NextResponse.redirect(new URL(dest, req.url));
  } catch (err) {
    console.error("[gcal/callback]", err);
    return NextResponse.redirect(new URL("/settings?gcal=token_error", req.url));
  }
}
