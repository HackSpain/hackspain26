import { api } from "@convex/_generated/api";
import { checkBotId } from "botid/server";
import { fetchAction } from "convex/nextjs";
import { NextResponse } from "next/server";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const verification = await checkBotId();
    if (verification.isBot) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
  } catch (error) {
    console.error("BotID check failed:", error);
  }

  let email = "";
  try {
    const body: unknown = await request.json();
    if (
      typeof body === "object" &&
      body !== null &&
      "email" in body &&
      typeof body.email === "string"
    ) {
      email = body.email.trim().toLowerCase();
    }
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  try {
    const result = await fetchAction(api.auth.signIn, {
      params: { email },
      provider: "resend-otp",
    });
    return NextResponse.json({ ok: true, started: Boolean(result.started) });
  } catch (error) {
    console.error("OTP send failed:", error);
    return NextResponse.json({ error: "Could not send code" }, { status: 500 });
  }
}
