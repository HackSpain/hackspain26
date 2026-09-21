import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { authedMutation, authedQuery, directoryQuery } from "./lib/customFunctions";
import {
	directoryFieldValidator,
	directoryValidator,
	isDirectoryComplete,
	missingDirectoryFields,
	parseDirectoryCard,
} from "./lib/directory";
import { avatarThumbnailFor } from "./lib/photo";
import { membershipForUser } from "./lib/team";
import { urlsValidator } from "./lib/urls";
import type { Doc, Id } from "./_generated/dataModel";

/** What the graph component consumes (src/components/participant-directory/types.ts). */
const participantReturn = v.object({
	achievements: v.optional(v.string()),
	bio: v.optional(v.string()),
	city: v.string(),
	company: v.optional(v.string()),
	degree: v.optional(v.string()),
	displayName: v.string(),
	freeTime: v.optional(v.string()),
	githubUsername: v.optional(v.string()),
	id: v.string(),
	interests: v.array(v.string()),
	isMe: v.boolean(),
	photoUrl: v.optional(v.string()),
	projectName: v.optional(v.string()),
	role: v.string(),
	skills: v.array(v.string()),
	urls: v.optional(urlsValidator),
	team: v.optional(v.object({ id: v.string(), name: v.string() })),
	/** The team's chosen challenges, with the sponsor wordmark when there is one. */
	tracks: v.array(
		v.object({
			id: v.string(),
			label: v.string(),
			logoUrl: v.optional(v.string()),
			slug: v.string(),
		}),
	),
	university: v.optional(v.string()),
});

/**
 * The viewer's own card, what is still missing, and prefills for the form:
 * the travel origin as city, the team's stack as skills.
 */
export const me = authedQuery({
	args: {},
	handler: async (ctx) => {
		const card = ctx.user.directory;
		const missing = missingDirectoryFields(card);
		const membership = await membershipForUser(ctx, ctx.user._id);
		const team = membership ? await ctx.db.get(membership.teamId) : null;
		return {
			card,
			complete: missing.length === 0,
			missing,
			suggestions: {
				city: ctx.user.travelOrigin,
				skills: team?.techStack ?? [],
			},
		};
	},
	returns: v.object({
		card: v.optional(directoryValidator),
		complete: v.boolean(),
		missing: v.array(directoryFieldValidator),
		suggestions: v.object({
			city: v.optional(v.string()),
			skills: v.array(v.string()),
		}),
	}),
});

export const save = authedMutation({
	args: directoryValidator.omit("updatedAt").fields,
	handler: async (ctx, args) => {
		const directory = parseDirectoryCard(args);
		await ctx.db.patch(ctx.user._id, { directory });
		return null;
	},
	returns: v.null(),
});

/**
 * One-off after the vocabularies change: re-run every stored card through
 * `parseDirectoryCard` so old free text ("UPM", "ReactJS") lands on the
 * curated spellings the graph groups by. Incomplete cards are left alone.
 *
 *   pnpm --filter app exec convex run directory:normalizeCards
 */
export const normalizeCards = internalMutation({
	args: {},
	handler: async (ctx) => {
		let changed = 0;
		let skipped = 0;
		const users = await ctx.db.query("users").collect();
		for (const user of users) {
			const card = user.directory;
			if (!card) {
				continue;
			}
			let next;
			try {
				next = parseDirectoryCard(card);
			} catch {
				skipped += 1;
				continue;
			}
			const { updatedAt: _a, ...before } = card;
			const { updatedAt: _b, ...after } = next;
			if (JSON.stringify(before) === JSON.stringify(after)) {
				continue;
			}
			await ctx.db.patch(user._id, {
				directory: { ...next, updatedAt: card.updatedAt },
			});
			changed += 1;
		}
		return { changed, skipped };
	},
	returns: v.object({ changed: v.number(), skipped: v.number() }),
});

/**
 * Staff only (sponsors, judges, admins). The card itself is still filled
 * during onboarding; browsing the graph is not.
 */
export const list = directoryQuery({
	args: {},
	handler: async (ctx) => {
		const [users, teams, memberships, submissions, tracks, signups] =
			await Promise.all([
				ctx.db.query("users").collect(),
				ctx.db.query("teams").collect(),
				ctx.db.query("teamMembers").collect(),
				ctx.db.query("submissions").collect(),
				ctx.db.query("tracks").collect(),
				ctx.db.query("signups").collect(),
			]);
		const signupById = new Map(signups.map((row) => [row._id, row]));
		const signupByEmail = new Map<string, Doc<"signups">>();
		for (const row of signups) {
			signupByEmail.set(row.email.toLowerCase(), row);
		}
		const signupOf = (user: (typeof users)[number]) => {
			if (user.signupId) {
				const byId = signupById.get(user.signupId);
				if (byId) {
					return byId;
				}
			}
			return user.email
				? signupByEmail.get(user.email.toLowerCase())
				: undefined;
		};
		const projectByTeam = new Map<Id<"teams">, string>();
		for (const submission of submissions) {
			if (!submission.teamId) {
				continue;
			}
			const name = submission.name.trim();
			if (!name) {
				continue;
			}
			const current = projectByTeam.get(submission.teamId);
			if (!current || submission.status === "submitted") {
				projectByTeam.set(submission.teamId, name);
			}
		}
		const teamsById = new Map(teams.map((team) => [team._id, team]));
		// One read instead of one index lookup per person. Same row as
		// membershipForUser: the earliest membership, whatever its status.
		const membershipByUser = new Map<Id<"users">, (typeof memberships)[number]>();
		for (const membership of memberships) {
			if (membership.userId && !membershipByUser.has(membership.userId)) {
				membershipByUser.set(membership.userId, membership);
			}
		}
		const teamOf = (userId: Id<"users">) => {
			const membership = membershipByUser.get(userId);
			if (!membership || membership.status !== "member") {
				return;
			}
			const team = teamsById.get(membership.teamId);
			return team ? { id: team._id, name: team.name } : undefined;
		};
		const tracksById = new Map(tracks.map((track) => [track._id, track]));
		const tracksByTeam = new Map<Id<"teams">, typeof tracks>();
		for (const submission of submissions) {
			if (submission.teamId && !tracksByTeam.has(submission.teamId)) {
				tracksByTeam.set(
					submission.teamId,
					submission.challengeIds.flatMap((trackId) => {
						const track = tracksById.get(trackId);
						return track ? [track] : [];
					}),
				);
			}
		}
		const out = [];
		for (const user of users) {
			const card = user.directory;
			if (!card || !isDirectoryComplete(card)) {
				continue;
			}
			const team = teamOf(user._id);
			const application = signupOf(user);
			out.push({
				achievements: application?.achievements,
				bio: card.bio,
				city: card.city,
				company: card.company,
				degree: card.degree,
				displayName: user.name ?? application?.fullName ?? "Participante",
				freeTime: application?.freeTime,
				githubUsername:
					user.githubUsername ?? application?.githubUsername,
				id: user._id,
				interests: card.interests,
				isMe: user._id === ctx.user._id,
				photoUrl: avatarThumbnailFor(user),
				projectName: team
					? projectByTeam.get(team.id as Id<"teams">)
					: undefined,
				role: card.role,
				skills: card.skills,
				urls: application?.urls,
				team,
				tracks: (team
					? (tracksByTeam.get(team.id as Id<"teams">) ?? [])
					: []
				).map((track) => ({
					id: track._id,
					label: track.label,
					logoUrl: track.logoUrl,
					slug: track.slug,
				})),
				university: card.university,
			});
		}
		return out.toSorted((a, b) =>
			a.displayName.localeCompare(b.displayName, "es"),
		);
	},
	returns: v.array(participantReturn),
});
