import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { readJsonFile } from "../../lib/config";
import { projectRef } from "../project";
import { eventId, modelFamily, type RawEvent } from "../schema";
import type { Collector, CollectorContext } from "../types";

export const CLINE = "cline" as const;

/**
 * Cline keeps one folder per task under the VS Code global storage:
 * tasks/<taskId>/ui_messages.json (rewritten whole file). Entries with
 * say === "api_req_started" carry a JSON string in `text` that Cline fills in
 * with token counts once the request completes. task_metadata.json lists the
 * models used. Written from the documented format; fails soft.
 */
type UiMessage = {
  ts?: number;
  type?: string;
  say?: string;
  text?: string;
};

type ApiReq = {
  tokensIn?: number;
  tokensOut?: number;
  cacheWrites?: number;
  cacheReads?: number;
  cost?: number;
};

type TaskMetadata = {
  model_usage?: Array<{
    model_id?: string;
    model_provider_id?: string;
    ts?: number;
  }>;
  cwdOnTaskInitialization?: string;
};

export type ClineTask = {
  taskId: string;
  messages: unknown;
  metadata?: TaskMetadata | null;
};

/**
 * Emit usage for every completed api_req_started entry newer than `afterTs`.
 * Stops at the first entry without token counts so an in-flight request is
 * picked up on the next pass instead of being skipped forever.
 */
export function normalizeCline(
  task: ClineTask,
  afterTs: number
): { events: RawEvent[]; mark: number } {
  const events: RawEvent[] = [];
  let mark = afterTs;
  if (!Array.isArray(task.messages)) {
    return { events, mark };
  }
  const models = (task.metadata?.model_usage ?? [])
    .filter((m) => typeof m.model_id === "string")
    .sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0));
  const modelAt = (ts: number) => {
    let current = models[0];
    for (const m of models) {
      if ((m.ts ?? 0) <= ts) {
        current = m;
      }
    }
    return current;
  };
  const cwd = task.metadata?.cwdOnTaskInitialization;
  const sorted = (task.messages as UiMessage[])
    .filter(
      (m) =>
        m?.type === "say" &&
        m.say === "api_req_started" &&
        typeof m.ts === "number"
    )
    .sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0));
  for (const message of sorted) {
    const ts = message.ts ?? 0;
    if (ts <= afterTs) {
      continue;
    }
    let req: ApiReq;
    try {
      req = JSON.parse(message.text ?? "{}") as ApiReq;
    } catch {
      continue;
    }
    if (typeof req.tokensIn !== "number" && typeof req.tokensOut !== "number") {
      break;
    }
    const model = modelAt(ts);
    const raw = model?.model_id ?? "unknown";
    events.push({
      type: "usage",
      eventId: eventId(CLINE, task.taskId, ts),
      occurredAt: new Date(ts).toISOString(),
      harness: CLINE,
      sessionId: task.taskId,
      project: projectRef(cwd),
      model: {
        raw,
        family: modelFamily(raw),
        provider: model?.model_provider_id,
      },
      tokens: {
        input: req.tokensIn ?? 0,
        output: req.tokensOut ?? 0,
        cacheRead: req.cacheReads ?? 0,
        cacheWrite: req.cacheWrites ?? 0,
      },
      ...(typeof req.cost === "number" ? { costUsd: req.cost } : {}),
    });
    mark = ts;
  }
  return { events, mark };
}

const EDITORS = ["Code", "Code - Insiders", "VSCodium", "Cursor", "Windsurf"];
const EXTENSION = "saoudrizwan.claude-dev";

function storageBase(): string {
  const home = homedir();
  if (process.platform === "darwin") {
    return join(home, "Library", "Application Support");
  }
  if (process.platform === "win32") {
    return process.env.APPDATA ?? join(home, "AppData", "Roaming");
  }
  return process.env.XDG_CONFIG_HOME?.trim() || join(home, ".config");
}

function globalStorageRoots(): string[] {
  const roots: string[] = [];
  for (const base of [storageBase()]) {
    for (const editor of EDITORS) {
      const dir = join(
        base,
        editor,
        "User",
        "globalStorage",
        EXTENSION,
        "tasks"
      );
      if (existsSync(dir)) {
        roots.push(dir);
      }
    }
  }
  return roots;
}

export async function* collectCline(
  roots: string[],
  ctx: CollectorContext
): AsyncIterable<RawEvent> {
  for (const root of roots) {
    let taskDirs: string[];
    try {
      taskDirs = readdirSync(root, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => join(root, d.name));
    } catch (err) {
      ctx.log(`cline: cannot list ${root}: ${String(err)}`);
      continue;
    }
    for (const dir of taskDirs) {
      const file = join(dir, "ui_messages.json");
      if (!existsSync(file)) {
        continue;
      }
      const stat = statSync(file);
      const previous = ctx.cursors.get(file);
      if (previous && previous.mtimeMs === stat.mtimeMs) {
        continue;
      }
      if (!previous && stat.mtimeMs < ctx.since) {
        continue;
      }
      let messages: unknown;
      try {
        messages = JSON.parse(readFileSync(file, "utf8"));
      } catch (err) {
        ctx.log(`cline: cannot parse ${file}: ${String(err)}`);
        continue;
      }
      const afterTs =
        typeof previous?.mark === "number" ? previous.mark : ctx.since;
      const { events, mark } = normalizeCline(
        {
          taskId: basename(dir) || dir,
          messages,
          metadata: readJsonFile<TaskMetadata>(join(dir, "task_metadata.json")),
        },
        afterTs
      );
      const announced = new Set(previous?.seenSessions ?? []);
      for (const event of events) {
        if (!announced.has(event.sessionId)) {
          announced.add(event.sessionId);
          yield {
            type: "session.start",
            eventId: eventId(CLINE, event.sessionId, "start"),
            occurredAt: event.occurredAt,
            harness: CLINE,
            sessionId: event.sessionId,
            project: event.project,
          };
        }
        yield event;
      }
      ctx.cursors.set(file, {
        offset: 0,
        mtimeMs: stat.mtimeMs,
        seenSessions: [...announced],
        mark,
      });
    }
    await Promise.resolve();
  }
}

export const clineCollector: Collector = {
  id: CLINE,
  discover: () => Promise.resolve(globalStorageRoots()),
  collect: (ctx) => collectCline(globalStorageRoots(), ctx),
};
