import { Email } from "@convex-dev/auth/providers/Email";
import { generateRandomString } from "@oslojs/crypto/random";
import type { RandomReader } from "@oslojs/crypto/random";
import { Resend as ResendAPI } from "resend";
import { internal } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";
import { STUB_CODE, emailOtpStubEnabled } from "./devOtp";

function randomDigits(length: number): string {
  const random: RandomReader = {
    read(bytes) {
      crypto.getRandomValues(bytes);
    },
  };
  return generateRandomString(random, "0123456789", length);
}

type VerificationRequest = {
  identifier: string;
  token: string;
  expires: Date;
  provider: { apiKey?: string };
};

// Convex Auth passes the action ctx as a second argument, but the Auth.js
// EmailConfig type only declares one. Optional keeps this assignable.
async function sendVerificationRequest(
  { identifier: email, provider, token, expires }: VerificationRequest,
  ctx?: ActionCtx
): Promise<void> {
  if (!provider.apiKey) {
    console.log(`[auth] Email OTP for ${email}: ${token}`);
    if (emailOtpStubEnabled()) {
      if (!ctx) {
        throw new Error("Action ctx missing in sendVerificationRequest");
      }
      await ctx.runMutation(internal.devOtp.remember, {
        code: token,
        email,
        expiresAt: expires.getTime(),
      });
      console.log(
        `[auth] ALLOW_EMAIL_OTP_STUB is on. ${STUB_CODE} also works.`
      );
    } else {
      console.log(
        "[auth] AUTH_RESEND_KEY is not set. The code was logged instead of emailed."
      );
    }
    return;
  }

  const resend = new ResendAPI(provider.apiKey);
  const from = process.env.AUTH_EMAIL ?? "HackSpain <onboarding@resend.dev>";
  const { error } = await resend.emails.send({
    from,
    subject: "Your HackSpain sign-in code",
    text: `Your HackSpain dashboard code is ${token}. It expires in 15 minutes.`,
    to: [email],
  });
  if (error) {
    throw new Error(JSON.stringify(error));
  }
}

export const ResendOTP = Email({
  apiKey: process.env.AUTH_RESEND_KEY,
  generateVerificationToken() {
    return randomDigits(8);
  },
  id: "resend-otp",
  maxAge: 60 * 15,
  sendVerificationRequest,
});
