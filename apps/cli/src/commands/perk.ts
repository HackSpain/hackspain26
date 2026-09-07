import type { Command } from "commander";
import { api } from "../lib/api";
import { contextFor } from "../lib/context";
import { uiFor } from "../lib/output";
import { openParticipant, type PerkEntry } from "../lib/participant";

function perkStatus(
  perk: PerkEntry["perk"],
  claim: PerkEntry["claim"]
): string {
  if (claim) {
    return claim.code ? `claimed: ${claim.code}` : `claimed (${claim.status})`;
  }
  if (perk.type === "code") {
    return `${perk.availableCodes ?? 0} codes left`;
  }
  return "by email";
}

export function registerPerk(program: Command): void {
  const perk = program.command("perk").description("Partner perks");

  perk
    .command("list")
    .description("Perks from partners and whether you claimed them")
    .action(async (_opts: unknown, command: Command) => {
      const ctx = contextFor(command);
      const ui = uiFor(ctx);
      const { session } = await openParticipant(ctx);
      const entries = await session.client.query(api.perks.listCatalog, {});
      ui.result(entries);
      if (entries.length === 0) {
        ui.info("No perks published yet.");
        return;
      }
      ui.table(
        entries.map(({ perk: p, claim }) => [
          p.company,
          p.title,
          p.value,
          perkStatus(p, claim),
          p._id,
        ]),
        ["Partner", "Perk", "Value", "Status", "Id"]
      );
      ui.info(
        "Claim perks from the dashboard; pass ids to `hackspain submit --perk <id>`."
      );
    });
}
