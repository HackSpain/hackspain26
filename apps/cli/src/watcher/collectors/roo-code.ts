import type { Collector } from "../types";
import type { ClineFamily } from "./cline";
import { clineFamilyCollector } from "./cline";

export const ROO_CODE = "roo-code" as const;

/**
 * Roo Code forked Cline and kept its task files: one folder per task under
 * the editor's globalStorage with `ui_messages.json`, where completed
 * `api_req_started` entries carry token counts. Roo does not record the
 * model in `task_metadata.json` (only files in context), so the model reads
 * `unknown`; the working directory comes from `history_item.json`.
 */
export const ROO_CODE_FAMILY: ClineFamily = {
  extension: "rooveterinaryinc.roo-cline",
  id: ROO_CODE,
};

export const rooCodeCollector: Collector =
  clineFamilyCollector(ROO_CODE_FAMILY);
