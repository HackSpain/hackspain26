import { Resend as ResendAPI } from "resend";

const DEFAULT_FROM = "HackSpain <onboarding@resend.dev>";

export const RESEND_BATCH_LIMIT = 100;

/** Prefer the dashboard names (`RESEND_*`); keep `AUTH_*` as a fallback. */
export function resendApiKey(): string | undefined {
  return process.env.RESEND_API_KEY ?? process.env.AUTH_RESEND_KEY;
}

export function resendFrom(): string {
  return process.env.RESEND_FROM ?? process.env.AUTH_EMAIL ?? DEFAULT_FROM;
}

export type ResendBatchItem = {
  from?: string;
  html?: string;
  subject: string;
  text?: string;
  to: string[];
};

export type ResendBatchFailure = { email: string; error: string };

/**
 * Send in Resend's batch size. A failed chunk is recorded per address and
 * the rest of the queue still goes out (notifications' failure log).
 */
export async function sendBatchedEmails(items: ResendBatchItem[]): Promise<{
  failures: ResendBatchFailure[];
  sentCount: number;
}> {
  const apiKey = resendApiKey();
  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY is not set on the Convex deployment; cannot send email"
    );
  }
  const resend = new ResendAPI(apiKey);
  const from = resendFrom();
  let sentCount = 0;
  const failures: ResendBatchFailure[] = [];

  for (let i = 0; i < items.length; i += RESEND_BATCH_LIMIT) {
    const chunk = items.slice(i, i + RESEND_BATCH_LIMIT);
    try {
      const { error } = await resend.batch.send(
        chunk.map((item) => ({
          from: item.from ?? from,
          html: item.html,
          subject: item.subject,
          text: item.text ?? "",
          to: item.to,
        }))
      );
      if (error) {
        for (const item of chunk) {
          for (const email of item.to) {
            failures.push({ email, error: error.message });
          }
        }
      } else {
        sentCount += chunk.length;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      for (const item of chunk) {
        for (const email of item.to) {
          failures.push({ email, error: message });
        }
      }
    }
  }

  return { failures, sentCount };
}
