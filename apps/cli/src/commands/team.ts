import type { Command } from "commander";
import { api } from "../lib/api";
import { contextFor } from "../lib/context";
import { CliError, usageError } from "../lib/errors";
import { formatMember, parseMember } from "../lib/members";
import { formatWhen, type Ui, uiFor } from "../lib/output";
import { openParticipant, type Team } from "../lib/participant";
import { confirmOrFlag, pickOne } from "../lib/prompts";
import { c, cmd, highlight } from "../lib/style";

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function roleOf(member: Team["members"][number], team: Team): string {
  if (member.userId === team.ownerId) {
    return c.gold("owner");
  }
  return member.status === "pending" ? c.dim("invited") : "member";
}

function renderTeam(ui: Ui, team: Team, myId: string): void {
  ui.result(team);
  ui.kv([
    [
      "Team",
      `${highlight(team.name)} ${c.dim(`· since ${formatWhen(team.createdAt)}`)}`,
    ],
    ["Repo", team.repoUrl ?? c.dim("not set · hackspain team repo <url>")],
    [
      "Stack",
      team.techStack.length
        ? team.techStack.join(", ")
        : c.dim("not set · hackspain stack set <tech…>"),
    ],
  ]);
  ui.table(
    team.members.map((m) => [
      `${m.name ?? formatMember(m)}${m.userId === myId ? c.dim(" (you)") : ""}`,
      c.dim(m.email ?? formatMember(m)),
      roleOf(m, team),
    ]),
    ["Member", "Contact", "Role"]
  );
  if (team.isOwner && team.joinCode) {
    ui.note(
      `${highlight(team.joinCode)}\n\nTeammates run ${cmd(`hackspain team join ${team.joinCode}`)}`,
      "Join code"
    );
  }
}

function noTeam(): never {
  throw new CliError("You are not in a team yet.", {
    code: "NO_TEAM",
    hint: "Create one with `hackspain team create <name>` or join with `hackspain team join <code>`.",
  });
}

export function registerTeam(program: Command): void {
  const team = program
    .command("team")
    .description("Create, join and manage your team");

  team
    .command("show")
    .description("Your team, members and join code")
    .action(async (_opts: unknown, command: Command) => {
      const ctx = contextFor(command);
      const ui = uiFor(ctx);
      const { session, me } = await openParticipant(ctx);
      const mine = await ui.spin(
        "Fetching your team…",
        () => session.client.query(api.teams.mine, {}),
        "Your team"
      );
      if (!mine) {
        noTeam();
      }
      renderTeam(ui, mine, me._id);
    });

  team
    .command("list")
    .description("All teams with member counts, tracks and repos")
    .action(async (_opts: unknown, command: Command) => {
      const ctx = contextFor(command);
      const ui = uiFor(ctx);
      const { session } = await openParticipant(ctx);
      const teams = await ui.spin(
        "Fetching teams…",
        () => session.client.query(api.teams.list, {}),
        "Teams"
      );
      ui.result(teams);
      if (teams.length === 0) {
        ui.info("No teams yet. Be the first: hackspain team create <name>.");
        return;
      }
      ui.table(
        teams.map((t) => [
          t.isMine ? `${highlight(t.name)}${c.dim(" (you)")}` : t.name,
          `${t.memberCount}${t.pendingCount ? c.dim(` +${t.pendingCount} invited`) : ""}`,
          t.tracks.map((x) => x.slug).join(", ") || c.dim("–"),
          t.submissionStatus === "submitted"
            ? c.green("submitted")
            : (t.submissionStatus ?? c.dim("–")),
          t.repoUrl
            ? c.dim(t.repoUrl.replace("https://github.com/", ""))
            : c.dim("–"),
        ]),
        ["Team", "Members", "Tracks", "Project", "Repo"]
      );
    });

  team
    .command("create <name>")
    .description("Create a team; you become its owner")
    .option(
      "-m, --member <member>",
      "invite by github:<login>, email:<address> or twitter:<handle> (repeatable)",
      collect,
      [] as string[]
    )
    .action(
      async (name: string, opts: { member: string[] }, command: Command) => {
        const ctx = contextFor(command);
        const ui = uiFor(ctx);
        const { session, me } = await openParticipant(ctx);
        const members = opts.member.map(parseMember);
        ui.intro("team create");
        const mine = await ui.spin(
          `Creating ${name}…`,
          async () => {
            await session.client.mutation(api.teams.create, { name, members });
            return await session.client.query(api.teams.mine, {});
          },
          "Team created"
        );
        if (!mine) {
          throw new CliError("Team was created but could not be read back.");
        }
        ui.celebrate(`${highlight(mine.name)} is live and you own it.`);
        renderTeam(ui, mine, me._id);
        ui.next([
          ["hackspain team repo <url>", "point organisers at your GitHub repo"],
          ["hackspain track list", "choose the tracks you are entering"],
          ["hackspain stack set <tech…>", "brag about your stack"],
        ]);
        ui.outro("Now go find your teammates.");
      }
    );

  team
    .command("join <code>")
    .description("Join a team with the 8-character code from its owner")
    .action(async (code: string, _opts: unknown, command: Command) => {
      const ctx = contextFor(command);
      const ui = uiFor(ctx);
      const { session, me } = await openParticipant(ctx);
      ui.intro("team join");
      const mine = await ui.spin(
        "Joining…",
        async () => {
          await session.client.mutation(api.teams.join, { code });
          return await session.client.query(api.teams.mine, {});
        },
        "Joined"
      );
      if (!mine) {
        throw new CliError("Joined, but the team could not be read back.");
      }
      ui.celebrate(`You are in ${highlight(mine.name)}. Welcome aboard.`);
      renderTeam(ui, mine, me._id);
      ui.next([
        ["hackspain", "see where the team stands"],
        ["hackspain watch", "start reporting your usage to the live board"],
      ]);
      ui.outro("Go build.");
    });

  team
    .command("leave")
    .description("Leave your team (owners cannot leave)")
    .option("-y, --yes", "skip the confirmation")
    .action(async (opts: { yes?: boolean }, command: Command) => {
      const ctx = contextFor(command);
      const ui = uiFor(ctx);
      const { session } = await openParticipant(ctx);
      const mine = await session.client.query(api.teams.mine, {});
      if (!mine) {
        noTeam();
      }
      if (mine.isOwner) {
        throw new CliError("Owners cannot leave their team.", {
          code: "NOT_ALLOWED",
          hint: "Hand it over with `hackspain team transfer`, or delete it with `hackspain team dissolve` once everyone else has left.",
        });
      }
      const ok = await confirmOrFlag(ctx, opts.yes, {
        flag: "--yes",
        message: `Leave ${mine.name}?`,
        initialValue: false,
      });
      if (!ok) {
        ui.info("Kept your membership.");
        return;
      }
      await session.client.mutation(api.teams.leave, {});
      ui.result({ left: mine.name });
      ui.success(`Left ${mine.name}.`);
    });

  team
    .command("code")
    .description("Show the join code (owner only)")
    .option("--regenerate", "invalidate the current code and mint a new one")
    .action(async (opts: { regenerate?: boolean }, command: Command) => {
      const ctx = contextFor(command);
      const ui = uiFor(ctx);
      const { session } = await openParticipant(ctx);
      const mine = await session.client.query(api.teams.mine, {});
      if (!mine) {
        noTeam();
      }
      if (!mine.isOwner) {
        throw new CliError(
          "Only the team owner can see or change the join code.",
          {
            code: "NOT_OWNER",
            hint: `Ask ${mine.members.find((m) => m.userId === mine.ownerId)?.name ?? "the owner"} to run \`hackspain team code\`.`,
          }
        );
      }
      const code = opts.regenerate
        ? await session.client.mutation(api.teams.regenerateCode, {})
        : mine.joinCode;
      if (!code) {
        throw new CliError("This team has no join code yet.", {
          hint: "Run `hackspain team code --regenerate`.",
        });
      }
      ui.result({ code, regenerated: Boolean(opts.regenerate) });
      if (opts.regenerate) {
        ui.success("New code minted; the old one no longer works.");
      }
      ui.note(
        `${highlight(code)}\n\nTeammates run ${cmd(`hackspain team join ${code}`)}`,
        "Join code"
      );
    });

  team
    .command("repo [url]")
    .description(
      "Show or set the team's GitHub repository (organisers pull activity from it)"
    )
    .option("--clear", "remove the repository")
    .action(
      async (
        url: string | undefined,
        opts: { clear?: boolean },
        command: Command
      ) => {
        const ctx = contextFor(command);
        const ui = uiFor(ctx);
        const { session } = await openParticipant(ctx);
        if (url && opts.clear) {
          throw usageError("Pass either a URL or --clear, not both.");
        }
        if (!(url || opts.clear)) {
          const mine = await session.client.query(api.teams.mine, {});
          if (!mine) {
            noTeam();
          }
          ui.result({ repoUrl: mine.repoUrl ?? null });
          ui.line(mine.repoUrl ?? "(not set)");
          return;
        }
        const saved = await session.client.mutation(api.teams.setRepoUrl, {
          url: opts.clear ? null : (url ?? ""),
        });
        ui.result({ repoUrl: saved });
        ui.success(
          saved ? `Repository set to ${saved}` : "Repository cleared."
        );
      }
    );

  team
    .command("transfer [member]")
    .description(
      "Hand the team to a teammate (owner only); match by email, GitHub login or name"
    )
    .option("-y, --yes", "skip the confirmation")
    .action(
      async (
        memberArg: string | undefined,
        opts: { yes?: boolean },
        command: Command
      ) => {
        const ctx = contextFor(command);
        const ui = uiFor(ctx);
        const { session, me } = await openParticipant(ctx);
        const mine = await session.client.query(api.teams.mine, {});
        if (!mine) {
          noTeam();
        }
        if (!mine.isOwner) {
          throw new CliError("Only the team owner can transfer it.", {
            code: "NOT_OWNER",
          });
        }
        const candidates = mine.members.filter(
          (m) => m.status === "member" && m.userId && m.userId !== me._id
        );
        if (candidates.length === 0) {
          throw new CliError("Nobody else has joined the team yet.", {
            code: "NO_MEMBERS",
            hint: "Share the join code first, or run `hackspain team dissolve` if you want to delete it.",
          });
        }
        const label = (m: (typeof candidates)[number]) =>
          [m.name, m.email ?? formatMember(m)].filter(Boolean).join(" · ");
        let memberId: string | undefined;
        if (memberArg) {
          const needle = memberArg.trim().toLowerCase();
          const matches = candidates.filter((m) =>
            [m.name, m.email, m.identifier]
              .filter((v): v is string => Boolean(v))
              .some(
                (v) =>
                  v.toLowerCase() === needle || v.toLowerCase().includes(needle)
              )
          );
          if (matches.length !== 1) {
            throw usageError(
              matches.length === 0
                ? `No teammate matches "${memberArg}".`
                : `"${memberArg}" matches several teammates.`,
              `Teammates: ${candidates.map(label).join("; ")}`
            );
          }
          memberId = matches[0]?._id;
        }
        const chosen = await pickOne(ctx, memberId, {
          flag: "<member>",
          message: "Transfer ownership to",
          choices: candidates.map((m) => ({
            value: m._id as string,
            label: label(m),
          })),
        });
        const target = candidates.find((m) => m._id === chosen);
        const ok = await confirmOrFlag(ctx, opts.yes, {
          flag: "--yes",
          message: `Make ${target ? label(target) : chosen} the owner of ${mine.name}? You stay as a member.`,
          initialValue: false,
        });
        if (!ok) {
          ui.info("Ownership unchanged.");
          return;
        }
        await session.client.mutation(api.teams.transferOwnership, {
          memberId: chosen as (typeof candidates)[number]["_id"],
        });
        const after = await session.client.query(api.teams.mine, {});
        if (after) {
          renderTeam(ui, after, me._id);
        }
        ui.success(
          `${target ? label(target) : "Your teammate"} now owns ${mine.name}.`
        );
      }
    );

  team
    .command("dissolve")
    .description("Delete a team nobody else has joined (owner only)")
    .option("-y, --yes", "skip the confirmation")
    .action(async (opts: { yes?: boolean }, command: Command) => {
      const ctx = contextFor(command);
      const ui = uiFor(ctx);
      const { session, me } = await openParticipant(ctx);
      const mine = await session.client.query(api.teams.mine, {});
      if (!mine) {
        noTeam();
      }
      if (!mine.isOwner) {
        throw new CliError("Only the team owner can dissolve it.", {
          code: "NOT_OWNER",
          hint: "Run `hackspain team leave` to leave it instead.",
        });
      }
      const others = mine.members.filter(
        (m) => m.status === "member" && m.userId && m.userId !== me._id
      );
      if (others.length > 0) {
        throw new CliError("The team still has other members.", {
          code: "VALIDATION",
          hint: "Transfer it with `hackspain team transfer`, or ask them to `hackspain team leave` first.",
        });
      }
      const ok = await confirmOrFlag(ctx, opts.yes, {
        flag: "--yes",
        message: `Delete ${mine.name}? Its draft project, milestones and pending invites go with it.`,
        initialValue: false,
      });
      if (!ok) {
        ui.info("Kept the team.");
        return;
      }
      await session.client.mutation(api.teams.dissolve, {});
      ui.result({ dissolved: mine.name });
      ui.success(`Dissolved ${mine.name}.`);
    });
}
