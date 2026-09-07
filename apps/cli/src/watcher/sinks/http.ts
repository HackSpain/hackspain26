import { createHash } from "node:crypto";
import { appendFileSync, existsSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  ensureDir,
  readJsonFile,
  stateDir,
  writeFileAtomic,
} from "../../lib/config";
import { CliError } from "../../lib/errors";
import { VERSION } from "../../version";
import type { TelemetryEvent } from "../schema";
import type { Sink } from "./spool";

type PendingUpload = {
  version: 1;
  url: string;
  events: TelemetryEvent[];
};

type IngestRejection = {
  line: number;
  eventId?: string;
  reason: string;
};

type IngestReceipt = {
  accepted: number;
  rejected: number;
  rejections: IngestRejection[];
  stored: true;
};

export type HttpSinkOptions = {
  pendingPath?: string;
  pendingScope?: string;
  rejectionsPath?: string;
  onRejected?: (message: string) => void;
};

function defaultPendingPath(scope = "default"): string {
  const suffix = createHash("sha256").update(scope).digest("hex").slice(0, 16);
  return join(stateDir(), `telemetry-upload-pending-${suffix}.json`);
}

function defaultRejectionsPath(): string {
  return join(stateDir(), "telemetry-upload-rejections.ndjson");
}

function isPendingUpload(value: unknown): value is PendingUpload {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<PendingUpload>;
  return (
    candidate.version === 1 &&
    typeof candidate.url === "string" &&
    candidate.url.length > 0 &&
    Array.isArray(candidate.events)
  );
}

function isIngestReceipt(value: unknown): value is IngestReceipt {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<IngestReceipt>;
  return (
    Number.isSafeInteger(candidate.accepted) &&
    (candidate.accepted ?? -1) >= 0 &&
    Number.isSafeInteger(candidate.rejected) &&
    (candidate.rejected ?? -1) >= 0 &&
    Array.isArray(candidate.rejections) &&
    candidate.rejections.length === candidate.rejected &&
    candidate.stored === true
  );
}

function sameUpload(left: PendingUpload, right: PendingUpload): boolean {
  return (
    left.url === right.url &&
    JSON.stringify(left.events) === JSON.stringify(right.events)
  );
}

/**
 * Generic NDJSON POST. Off unless a URL is configured. Shaped so a ClickHouse
 * HTTP endpoint (behind an auth proxy doing `INSERT … FORMAT JSONEachRow`) or
 * any other NDJSON receiver works without client changes.
 */
export function httpSink(
  url: string,
  token: () => Promise<string | null>,
  fetchImpl: typeof fetch = fetch,
  options: HttpSinkOptions = {}
): Sink {
  const pendingPath =
    options.pendingPath ?? defaultPendingPath(options.pendingScope);
  const rejectionsPath = options.rejectionsPath ?? defaultRejectionsPath();

  const loadPending = (): PendingUpload | null => {
    if (!existsSync(pendingPath)) {
      return null;
    }
    const pending = readJsonFile<unknown>(pendingPath);
    if (!isPendingUpload(pending)) {
      throw new CliError("The pending telemetry upload is damaged.", {
        code: "SINK_HTTP_PENDING",
        hint: "Keep the file for recovery and report this error to the organisers.",
      });
    }
    return pending;
  };

  const clearPending = (): void => {
    try {
      unlinkSync(pendingPath);
    } catch (error) {
      if (
        typeof error !== "object" ||
        error === null ||
        !("code" in error) ||
        error.code !== "ENOENT"
      ) {
        throw error;
      }
    }
  };

  const recordRejections = (receipt: IngestReceipt): void => {
    if (receipt.rejected === 0) {
      return;
    }
    ensureDir(dirname(rejectionsPath), 0o700);
    appendFileSync(
      rejectionsPath,
      `${JSON.stringify({ at: new Date().toISOString(), rejections: receipt.rejections })}\n`,
      { mode: 0o600 }
    );
    const reasons = [
      ...new Set(receipt.rejections.map(({ reason }) => reason)),
    ];
    options.onRejected?.(
      `${receipt.rejected} telemetry event${receipt.rejected === 1 ? " was" : "s were"} rejected (${reasons.join(", ")}); details were kept locally.`
    );
  };

  const send = async (upload: PendingUpload): Promise<void> => {
    const bearer = await token();
    const response = await fetchImpl(upload.url, {
      method: "POST",
      headers: {
        "content-type": "application/x-ndjson",
        "user-agent": `hackspain-cli/${VERSION}`,
        ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
      },
      body: `${upload.events.map((event) => JSON.stringify(event)).join("\n")}\n`,
    });
    if (!response.ok) {
      throw new CliError(
        `Telemetry endpoint answered ${response.status} ${response.statusText}`,
        { code: "SINK_HTTP" }
      );
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return;
    }
    const body: unknown = await response.json();
    if (
      typeof body !== "object" ||
      body === null ||
      !("ok" in body) ||
      body.ok !== true ||
      !("value" in body)
    ) {
      return;
    }
    if (!isIngestReceipt(body.value)) {
      throw new CliError("Telemetry endpoint returned an invalid receipt.", {
        code: "SINK_HTTP_RECEIPT",
      });
    }
    if (body.value.accepted + body.value.rejected !== upload.events.length) {
      throw new CliError(
        "Telemetry endpoint did not account for every event.",
        {
          code: "SINK_HTTP_RECEIPT",
        }
      );
    }
    recordRejections(body.value);
  };

  const flushPending = async (): Promise<void> => {
    const pending = loadPending();
    if (!pending) {
      return;
    }
    await send(pending);
    clearPending();
  };

  return {
    name: "http",
    write: async (events) => {
      if (events.length === 0) {
        return;
      }
      const upload: PendingUpload = { version: 1, url, events };
      const previous = loadPending();
      if (previous) {
        const alreadyPending = sameUpload(previous, upload);
        await send(previous);
        clearPending();
        if (alreadyPending) {
          return;
        }
      }

      writeFileAtomic(pendingPath, `${JSON.stringify(upload)}\n`, 0o600);
      await send(upload);
      clearPending();
    },
    flushPending,
    pending: () => {
      if (!existsSync(pendingPath)) {
        return 0;
      }
      const pending = readJsonFile<unknown>(pendingPath);
      return isPendingUpload(pending) ? pending.events.length : 1;
    },
  };
}
