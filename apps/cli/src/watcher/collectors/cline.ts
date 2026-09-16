import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { readJsonFile } from "../../lib/config";
import { projectRef } from "../project";
import type { HarnessId, RawEvent } from "../schema";
import { eventId, modelFamily } from "../schema";
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
  model_usage?: {
    model_id?: string;
    model_provider_id?: string;
    ts?: number;
  }[];
  cwdOnTaskInitialization?: string;
};

export type ClineTask = {
  taskId: string;
  messages: unknown;
  metadata?: TaskMetadata | null;
  /** Roo-style `history_item.json`: the workspace stands in for cwd. */
  workspace?: string;
};

type HistoryItem = { workspace?: string };

/** What differs between Cline and its forks. */
export type ClineFamily = {
  id: HarnessId;
  /** `<publisher>.<name>` folder under the editor's globalStorage. */
  extension: string;
};

export const CLINE_FAMILY: ClineFamily = {
  extension: "saoudrizwan.claude-dev",
  id: CLINE,
};

/**
 * Emit usage for every completed api_req_started entry newer than `afterTs`.
 * Stops at the first entry without token counts so an in-flight request is
 * picked up on the next pass instead of being skipped forever.
 */
export function normalizeCline(
  task: ClineTask,
  afterTs: number,
  harness: HarnessId = CLINE
): { events: RawEvent[]; mark: number } {
  const events: RawEvent[] = [];
  let mark = afterTs;
  if (!Array.isArray(task.messages)) {
    return { events, mark };
  }
  const models = (task.metadata?.model_usage ?? [])
    .filter((m) => typeof m.model_id === "string")
    .toSorted((a, b) => (a.ts ?? 0) - (b.ts ?? 0));
  const modelAt = (ts: number) => {
    let current = models[0];
    for (const m of models) {
      if ((m.ts ?? 0) <= ts) {
        current = m;
      }
    }
    return current;
  };
  const cwd = task.metadata?.cwdOnTaskInitialization ?? task.workspace;
  const sorted = (task.messages as UiMessage[])
    .filter(
      (m) =>
        m?.type === "say" &&
        m.say === "api_req_started" &&
        typeof m.ts === "number"
    )
    .toSorted((a, b) => (a.ts ?? 0) - (b.ts ?? 0));
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
      eventId: eventId(harness, task.taskId, ts),
      harness,
      model: {
        family: modelFamily(raw),
        provider: model?.model_provider_id,
        raw,
      },
      occurredAt: new Date(ts).toISOString(),
      project: projectRef(cwd),
      sessionId: task.taskId,
      tokens: {
        cacheRead: req.cacheReads ?? 0,
        cacheWrite: req.cacheWrites ?? 0,
        input: req.tokensIn ?? 0,
        output: req.tokensOut ?? 0,
      },
      type: "usage",
      ...(typeof req.cost === "number" ? { costUsd: req.cost } : {}),
    });
    mark = ts;
  }
  return { events, mark };
}

const EDITORS = ["Code", "Code - Insiders", "VSCodium", "Cursor", "Windsurf"];

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

export function globalStorageRoots(extension: string): string[] {
  const roots: string[] = [];
  for (const base of [storageBase()]) {
    for (const editor of EDITORS) {
      const dir = join(
        base,
        editor,
        "User",
        "globalStorage",
        extension,
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
  ctx: CollectorContext,
  harness: HarnessId = CLINE
): AsyncIterable<RawEvent> {
  for (const root of roots) {
    let taskDirs: string[];
    try {
      taskDirs = readdirSync(root, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => join(root, d.name));
    } catch (error) {
      ctx.log(`${harness}: cannot list ${root}: ${String(error)}`);
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
      } catch (error) {
        ctx.log(`${harness}: cannot parse ${file}: ${String(error)}`);
        continue;
      }
      const afterTs =
        typeof previous?.mark === "number" ? previous.mark : ctx.since;
      const { events, mark } = normalizeCline(
        {
          messages,
          metadata: readJsonFile<TaskMetadata>(join(dir, "task_metadata.json")),
          taskId: basename(dir) || dir,
          workspace: readJsonFile<HistoryItem>(join(dir, "history_item.json"))
            ?.workspace,
        },
        afterTs,
        harness
      );
      const announced = new Set(previous?.seenSessions);
      for (const event of events) {
        if (!announced.has(event.sessionId)) {
          announced.add(event.sessionId);
          yield {
            eventId: eventId(harness, event.sessionId, "start"),
            harness,
            occurredAt: event.occurredAt,
            project: event.project,
            sessionId: event.sessionId,
            type: "session.start",
          };
        }
        yield event;
      }
      ctx.cursors.set(file, {
        mark,
        mtimeMs: stat.mtimeMs,
        offset: 0,
        seenSessions: [...announced],
      });
    }
    await Promise.resolve();
  }
}

/** A collector for Cline or one of its forks. */
export function clineFamilyCollector(family: ClineFamily): Collector {
  return {
    collect: (ctx) =>
      collectCline(globalStorageRoots(family.extension), ctx, family.id),
    discover: () => Promise.resolve(globalStorageRoots(family.extension)),
    id: family.id,
  };
}

export const clineCollector: Collector = clineFamilyCollector(CLINE_FAMILY);
