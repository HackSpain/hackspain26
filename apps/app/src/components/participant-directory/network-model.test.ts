import { test } from "node:test";
import assert from "node:assert/strict";
import {
	clusterParticipants,
	clustersOverlap,
	labelDirections,
	memberHomes,
	clusterRadius,
	createLayout,
	initialPoints,
	layoutBounds,
	LENSES,
	linksFor,
	MAX_LINKS,
	NODE_RADIUS,
	placeClusters,
	SETTLED,
	symbolBox,
} from "./network-model";
import type { DirectoryParticipant } from "./types";

const person: DirectoryParticipant = {
	city: "Madrid",
	displayName: "Ana",
	id: "a",
	role: "Developer",
	skills: ["React"],
	interests: ["IA"],
	university: "UPM",
};
const peer = { ...person, displayName: "Bruno", id: "b" };

test("clusters group by the lens value, largest first, loose cluster last", () => {
	const stranger = { ...person, id: "c", city: "", university: undefined };
	const other = { ...person, id: "d", city: "Bilbao" };
	const clusters = clusterParticipants([other, stranger, peer, person], "city");
	assert.deepEqual(
		clusters.map((cluster) => [cluster.label, cluster.memberIds]),
		[
			["Madrid", ["a", "b"]],
			["Bilbao", ["d"]],
			["Sin ciudad", ["c"]],
		],
	);
	assert.equal(clusters.at(-1)?.loose, true);
	assert.deepEqual(
		clusterParticipants([person, peer, person], "university").map(
			(cluster) => cluster.memberIds,
		),
		[["a", "b"]],
	);
});

test("cluster identities normalize accents and spaces; teams key on their id", () => {
	const a = {
		...person,
		city: " Málaga ",
		team: { id: "one", name: "Órbita" },
	};
	const b = { ...peer, city: "MALAGA", team: { id: "two", name: "Órbita" } };
	assert.equal(clusterParticipants([a, b], "city").length, 1);
	assert.equal(clusterParticipants([a, b], "team").length, 2);
	for (const lens of LENSES) {
		assert.ok(clusterParticipants([a, b], lens).length >= 1);
	}
});

test("the track lens puts people in every challenge of their team, with the wordmark", () => {
	const maisa = { id: "t1", label: "Maisa", logoUrl: "/tracks/maisa.png" };
	const embat = { id: "t2", label: "Embat" };
	const a = { ...person, tracks: [maisa, embat] };
	const b = { ...peer, tracks: [maisa] };
	const c = { ...person, id: "c", tracks: [embat] };
	const d = { ...person, id: "d" };
	const clusters = clusterParticipants([d, c, b, a], "track");
	assert.deepEqual(
		clusters.map((cluster) => [
			cluster.label,
			cluster.logoUrl,
			cluster.memberIds,
		]),
		[
			["Embat", undefined, ["a", "c"]],
			["Maisa", "/tracks/maisa.png", ["a", "b"]],
			["Sin reto", undefined, ["d"]],
		],
	);
	assert.equal(clustersOverlap(clusters), true);
	assert.equal(
		clustersOverlap(clusterParticipants([a, b, c, d], "city")),
		false,
	);
});

test("members of a track with a symbol ring it instead of covering it", () => {
	const track = { id: "t", label: "Maisa", logoUrl: "/tracks/maisa.png" };
	const people = Array.from({ length: 9 }, (_, i) => ({
		...person,
		id: `p${i}`,
		tracks: [track],
	}));
	const clusters = clusterParticipants(people, "track");
	const places = placeClusters(clusters);
	const box = symbolBox(9);
	assert.ok(places[0].r > clusterRadius(9), "a symbol needs a bigger circle");
	const points = initialPoints(clusters, places);
	const layout = createLayout(points, clusters, places);
	for (let i = 0; i < 300; i++) {
		layout.tick(0.97 ** i);
	}
	for (const point of points) {
		const nx = (point.x - places[0].x) / (box.width / 2 + NODE_RADIUS);
		const ny = (point.y - places[0].y) / (box.height / 2 + NODE_RADIUS);
		assert.ok(Math.hypot(nx, ny) >= 0.98, `${point.id} sits on the symbol`);
		assert.ok(
			Math.hypot(point.x - places[0].x, point.y - places[0].y) <
				places[0].r * 1.2,
		);
	}
});

test("clusters with people in common overlap like a Venn diagram; others keep clear", () => {
	const track = (id: string) => ({ id, label: id });
	const people = [
		...Array.from({ length: 6 }, (_, i) => ({
			...person,
			id: `ab${i}`,
			tracks: [track("A"), track("B")],
		})),
		...Array.from({ length: 8 }, (_, i) => ({
			...person,
			id: `a${i}`,
			tracks: [track("A")],
		})),
		...Array.from({ length: 5 }, (_, i) => ({
			...person,
			id: `b${i}`,
			tracks: [track("B")],
		})),
		...Array.from({ length: 7 }, (_, i) => ({
			...person,
			id: `c${i}`,
			tracks: [track("C")],
		})),
	];
	const clusters = clusterParticipants(people, "track");
	const places = placeClusters(clusters);
	const at = (label: string) =>
		places[clusters.findIndex((c) => c.label === label)];
	const gap = (p: { x: number; y: number; r: number }, q: typeof p) =>
		Math.hypot(p.x - q.x, p.y - q.y) - p.r - q.r;
	assert.ok(gap(at("A"), at("B")) < -NODE_RADIUS * 2, "A and B must overlap");
	assert.ok(
		gap(at("A"), at("C")) > 0 && gap(at("B"), at("C")) > 0,
		"C stays apart",
	);
	const homes = memberHomes(clusters, places);
	const inside = (
		h: { x: number; y: number },
		p: { x: number; y: number; r: number },
	) => Math.hypot(h.x - p.x, h.y - p.y) <= p.r;
	const shared = homes.get("ab0");
	assert.ok(shared && inside(shared, at("A")) && inside(shared, at("B")));
	const directions = labelDirections(clusters, places);
	const a = clusters.findIndex((c) => c.label === "A");
	const b = clusters.findIndex((c) => c.label === "B");
	const away =
		(at("A").x - at("B").x) * directions[a].x +
		(at("A").y - at("B").y) * directions[a].y;
	assert.ok(away > 0, "A's label points away from B");
	assert.deepEqual(directions[clusters.findIndex((c) => c.label === "C")], {
		x: 0,
		y: -1,
	});
	assert.ok(
		directions[b].x * directions[a].x + directions[b].y * directions[a].y < 0,
	);
	const points = initialPoints(clusters, places);
	const layout = createLayout(points, clusters, places);
	for (let i = 0; i < 300; i++) {
		layout.tick(0.97 ** i);
	}
	const logoClusters = clusterParticipants(
		people.map((p) => ({
			...p,
			tracks: p.tracks.map((t) => ({ ...t, logoUrl: `/${t.id}.png` })),
		})),
		"track",
	);
	const logoPlaces = placeClusters(logoClusters);
	const logoA = logoPlaces[logoClusters.findIndex((c) => c.label === "A")];
	const logoB = logoPlaces[logoClusters.findIndex((c) => c.label === "B")];
	assert.ok(
		Math.hypot(logoA.x - logoB.x, logoA.y - logoB.y) > logoA.r + logoB.r,
		"sponsor circles keep a gap",
	);
	const logoPoints = initialPoints(logoClusters, logoPlaces);
	const logoLayout = createLayout(logoPoints, logoClusters, logoPlaces);
	for (let i = 0; i < 300; i++) {
		logoLayout.tick(0.97 ** i);
	}
	for (const point of logoPoints) {
		for (const [index, place] of logoPlaces.entries()) {
			const box = symbolBox(logoClusters[index].memberIds.length);
			const nx = (point.x - place.x) / (box.width / 2 + NODE_RADIUS);
			const ny = (point.y - place.y) / (box.height / 2 + NODE_RADIUS);
			assert.ok(
				Math.hypot(nx, ny) >= 0.98,
				`${point.id} covers ${logoClusters[index].label}`,
			);
		}
	}
	for (const point of points) {
		if (point.id.startsWith("ab")) {
			assert.ok(
				inside(point, at("A")) && inside(point, at("B")),
				`${point.id} left the overlap`,
			);
		}
	}
});

test("links rank the strongest affinities first and stay capped", () => {
	const cityOnly = { ...person, id: "c", university: "Other", skills: [] };
	const links = linksFor(person, [person, peer, cityOnly]);
	assert.deepEqual(
		links.map((link) => link.participant.id),
		["b", "c"],
	);
	assert.ok(links[0].affinities.length > links[1].affinities.length);
	const crowd = Array.from({ length: 80 }, (_, i) => ({
		...person,
		id: `p${i}`,
	}));
	assert.equal(linksFor(person, crowd).length, MAX_LINKS);
	assert.equal(linksFor(person, [person]).length, 0);
});

test("cluster places never overlap, are deterministic and hold their members", () => {
	const people = Array.from({ length: 120 }, (_, i) => ({
		...person,
		id: `p${i}`,
		city: `City ${i % 9}`,
	}));
	const clusters = clusterParticipants(people, "city");
	const places = placeClusters(clusters);
	assert.deepEqual(places, placeClusters(clusters));
	for (let i = 0; i < places.length; i++) {
		for (let j = i + 1; j < places.length; j++) {
			const a = places[i],
				b = places[j];
			assert.ok(
				Math.hypot(a.x - b.x, a.y - b.y) >= a.r + b.r - 1,
				`${a.id} overlaps ${b.id}`,
			);
		}
	}
	assert.ok(clusterRadius(14) > NODE_RADIUS * 4);
	assert.ok(clusterRadius(1) >= NODE_RADIUS * 2);
	const points = initialPoints(clusters, places);
	assert.equal(points.length, 120);
	assert.deepEqual(points, initialPoints(clusters, places));
	const bounds = layoutBounds(places);
	assert.ok(bounds.width > 0 && bounds.height > 0);
	assert.ok(
		points.every(
			(point) =>
				Math.abs(point.x - bounds.x) <= bounds.width / 2 &&
				Math.abs(point.y - bounds.y) <= bounds.height / 2,
		),
	);
	assert.deepEqual(layoutBounds([]), { height: 600, width: 900, x: 0, y: 0 });
});

test("the layout settles members near their cluster and respects a pinned node", () => {
	const people = Array.from({ length: 40 }, (_, i) => ({
		...person,
		id: `p${i}`,
		city: i < 30 ? "Madrid" : "Bilbao",
	}));
	const clusters = clusterParticipants(people, "city");
	const places = placeClusters(clusters);
	const points = initialPoints(clusters, places);
	const layout = createLayout(points, clusters, places);
	const pinned = { ...points[0] };
	let alpha = 1;
	for (let i = 0; i < 300; i++) {
		layout.tick(alpha, pinned.id);
		alpha *= 0.97;
	}
	assert.equal(points[0].x, pinned.x);
	assert.equal(points[0].y, pinned.y);
	const homes = new Map(
		clusters.flatMap((cluster) => {
			const place = places.find((item) => item.id === cluster.id);
			return cluster.memberIds.map((id) => [id, place] as const);
		}),
	);
	for (const point of points.slice(1)) {
		const home = homes.get(point.id);
		assert.ok(home);
		assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
		assert.ok(
			Math.hypot(point.x - home.x, point.y - home.y) < home.r * 1.35,
			`${point.id} strayed from its cluster`,
		);
	}
	for (let i = 1; i < points.length; i++) {
		for (let j = i + 1; j < points.length; j++) {
			const a = points[i],
				b = points[j];
			assert.ok(
				Math.hypot(a.x - b.x, a.y - b.y) > NODE_RADIUS * 1.6,
				`${a.id} sits on ${b.id}`,
			);
		}
	}
});

test("a tick reports how far people moved, and a settled layout stops moving", () => {
	const people = Array.from({ length: 40 }, (_, i) => ({
		...person,
		id: `p${i}`,
		city: i % 2 ? "Madrid" : "Bilbao",
	}));
	const clusters = clusterParticipants(people, "city");
	const places = placeClusters(clusters);
	const layout = createLayout(initialPoints(clusters, places), clusters, places);
	assert.ok(layout.tick(1) > SETTLED, "the first frame moves people");
	let frames = 1;
	let alpha = 0.97;
	while (frames < 400 && layout.tick(alpha) > SETTLED) {
		alpha *= 0.97;
		frames++;
	}
	assert.ok(frames < 182, `settled in ${frames} frames, before alpha runs out`);
	assert.ok(layout.tick(alpha) <= SETTLED, "and stays still afterwards");
});

test("people carried over from another lens end up centred in their new circle", () => {
	const people = Array.from({ length: 90 }, (_, i) => ({
		...person,
		id: `p${i}`,
		city: `City ${i % 5}`,
		team: { id: `t${i % 30}`, name: `Team ${i % 30}` },
	}));
	const teams = clusterParticipants(people, "team");
	const carried = new Map(
		initialPoints(teams, placeClusters(teams)).map((point) => [point.id, point]),
	);
	const clusters = clusterParticipants(people, "city");
	const places = placeClusters(clusters);
	const points = initialPoints(clusters, places).map(
		(point) => carried.get(point.id) ?? point,
	);
	const layout = createLayout(points, clusters, places);
	let alpha = 1;
	for (let i = 0; i < 378 && layout.tick(alpha) > SETTLED; i++) {
		alpha *= 0.97;
	}
	const byId = new Map(points.map((point) => [point.id, point]));
	for (const [index, cluster] of clusters.entries()) {
		const members = cluster.memberIds.map((id) => byId.get(id));
		const x = members.reduce((sum, p) => sum + (p?.x ?? 0), 0) / members.length;
		const y = members.reduce((sum, p) => sum + (p?.y ?? 0), 0) / members.length;
		const place = places[index];
		assert.ok(
			Math.hypot(x - place.x, y - place.y) < place.r * 0.05,
			`${cluster.label} sits off-centre`,
		);
		for (const member of members) {
			assert.ok(
				member && Math.hypot(member.x - place.x, member.y - place.y) < place.r,
				`${member?.id} was left outside ${cluster.label}`,
			);
		}
	}
});

test("overlapping tracks with symbols come to rest instead of jittering", () => {
	const track = (id: string) => ({ id, label: id, logoUrl: `/${id}.svg` });
	const people = Array.from({ length: 120 }, (_, i) => ({
		...person,
		id: `p${i}`,
		tracks: i % 3 ? [track(`T${i % 4}`)] : [track(`T${i % 4}`), track(`T${(i + 1) % 4}`)],
	}));
	const clusters = clusterParticipants(people, "track");
	const places = placeClusters(clusters);
	const layout = createLayout(initialPoints(clusters, places), clusters, places);
	let alpha = 1;
	let moved = Number.POSITIVE_INFINITY;
	for (let i = 0; i < 378; i++) {
		moved = layout.tick(alpha);
		alpha *= 0.97;
	}
	assert.ok(moved < 0.5, `people still move ${moved.toFixed(2)} per frame`);
});
