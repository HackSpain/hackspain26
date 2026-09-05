import type { Command } from "commander";
import { api } from "../lib/api";
import { contextFor } from "../lib/context";
import { uiFor } from "../lib/output";
import { openParticipant, type PerkEntry } from "../lib/participant";
import { c } from "../lib/style";

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
      const entries = await ui.spin(
        "Fetching perks…",
        () => session.client.query(api.perks.listCatalog, {}),
        "Perks"
      );
      ui.result(entries);
      if (entries.length === 0) {
        ui.info(
          "No perks published yet. Partners usually add them right before the event."
        );
        return;
      }
      ui.table(
        entries.map(({ perk: p, claim }) => [
          p.company,
          p.title,
          c.gold(p.value),
          claim ? c.green(perkStatus(p, claim)) : c.dim(perkStatus(p, claim)),
          c.dim(p._id),
        ]),
        ["Partner", "Perk", "Value", "Status", "Id"]
      );
      ui.next([
        ["app.hackspain.com/perks", "claim a perk from the dashboard"],
        [
          "hackspain submit --perk <id>",
          "credit the perks you used in your project",
        ],
      ]);
    });
}
