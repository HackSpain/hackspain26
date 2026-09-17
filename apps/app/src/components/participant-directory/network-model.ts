import type { DirectoryParticipant } from "./types";

export const HUB_KINDS = ["team", "university", "company"] as const;
export type HubKind = (typeof HUB_KINDS)[number];

export const HUB_STYLES: Record<
  HubKind,
  { color: string; label: string; plural: string }
> = {
  company: { color: "#35858a", label: "Empresa", plural: "Empresas" },
  team: { color: "#eab619", label: "Equipo", plural: "Equipos" },
  university: {
    color: "#1e3958",
    label: "Universidad",
    plural: "Universidades",
  },
};

export interface Hub {
  id: string;
  kind: HubKind;
  label: string;
  members: string[];
}
export interface NetworkEdge {
  id: string;
  person: string;
  hub: string;
  kind: HubKind;
}
export interface Network {
  participants: DirectoryParticipant[];
  hubs: Hub[];
  edges: NetworkEdge[];
}
export interface GraphPoint {
  id: string;
  hub: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
}
export interface Spring {
  person: string;
  hub: string;
  length: number;
}

export function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036F]/g, "")
    .trim()
    .replaceAll(/\s+/g, " ")
    .toLowerCase();
}

// Ignore subpixel floating-point differences between the server and browser engines.
export function graphCoordinate(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function hubKey(
  person: DirectoryParticipant,
  kind: HubKind
): { id: string; label: string } | undefined {
  switch (kind) {
    case "team": {
      return person.team
        ? { id: `team:${person.team.id}`, label: person.team.name }
        : undefined;
    }
    case "university":
    case "company": {
      const label = person[kind]?.trim();
      return label
        ? { id: `${kind}:${normalize(label)}`, label }
        : undefined;
    }
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

/**
 * People never link to each other directly: each person hangs off the hubs
 * they belong to (team, university, company) and shares them with the rest.
 */
export function buildNetwork(participants: DirectoryParticipant[]): Network {
  const people = [
    ...new Map(participants.map((person) => [person.id, person])).values(),
  ].toSorted((a, b) => a.id.localeCompare(b.id));
  const hubs = new Map<string, Hub>();
  const edges: NetworkEdge[] = [];
  for (const person of people) {
    for (const kind of HUB_KINDS) {
      const key = hubKey(person, kind);
      if (!key) {
        continue;
      }
      const hub = hubs.get(key.id) ?? {
        id: key.id,
        kind,
        label: key.label,
        members: [],
      };
      hub.members.push(person.id);
      hubs.set(key.id, hub);
      edges.push({ hub: key.id, id: `${person.id}→${key.id}`, kind, person: person.id });
    }
  }
  return {
    edges,
    hubs: [...hubs.values()].toSorted(
      (a, b) =>
        HUB_KINDS.indexOf(a.kind) - HUB_KINDS.indexOf(b.kind) ||
        a.label.localeCompare(b.label, "es")
    ),
    participants: people,
  };
}

export function networkSprings(network: Network): Spring[] {
  return network.edges.map((edge) => ({
    hub: edge.hub,
    length: edge.kind === "team" ? 90 : 160,
    person: edge.person,
  }));
}

function seed(value: string) {
  let hash = 2_166_136_261;
  for (const char of value) {
    // oxlint-disable-next-line no-bitwise, unicorn/prefer-code-point -- FNV-1a hashes UTF-16 code units intentionally.
    hash = Math.imul(hash ^ char.charCodeAt(0), 16_777_619);
  }
  // oxlint-disable-next-line no-bitwise -- unsigned coercion is part of FNV-1a normalization.
  return (hash >>> 0) / 4_294_967_296;
}

/** A deterministic force layout: identical on the server and in every browser. */
export function initialPoints(network: Network): GraphPoint[] {
  const teams = network.hubs.filter((hub) => hub.kind === "team");
  const others = network.hubs.filter((hub) => hub.kind !== "team");
  const points: GraphPoint[] = [];
  const place = (id: string, hub: boolean, angle: number, radius: number) =>
    points.push({
      hub,
      id,
      vx: 0,
      vy: 0,
      x: Math.cos(angle) * radius + (seed(id + "x") - 0.5) * 120,
      y: Math.sin(angle) * radius + (seed(id + "y") - 0.5) * 120,
    });
  for (const [index, hub] of teams.entries()) {
    place(hub.id, true, (index / teams.length) * Math.PI * 2, 260);
  }
  for (const [index, hub] of others.entries()) {
    place(hub.id, true, index * 2.399963, 480);
  }
  const hubPoint = new Map(points.map((point) => [point.id, point]));
  for (const person of network.participants) {
    const home = person.team ? hubPoint.get(`team:${person.team.id}`) : undefined;
    if (home) {
      const angle = seed(person.id) * Math.PI * 2;
      points.push({
        hub: false,
        id: person.id,
        vx: 0,
        vy: 0,
        x: home.x + Math.cos(angle) * 70,
        y: home.y + Math.sin(angle) * 70,
      });
    } else {
      place(person.id, false, seed(person.id) * Math.PI * 2, 520);
    }
  }
  const springs = networkSprings(network);
  for (let i = 0; i < 260; i++) {
    tickForces(points, springs, 0.7);
  }
  // Lay the cloud's long axis along the wide canvas without changing distances.
  const n = points.length || 1;
  const meanX = points.reduce((sum, p) => sum + p.x, 0) / n;
  const meanY = points.reduce((sum, p) => sum + p.y, 0) / n;
  let xx = 0,
    xy = 0,
    yy = 0;
  for (const point of points) {
    xx += (point.x - meanX) ** 2;
    yy += (point.y - meanY) ** 2;
    xy += (point.x - meanX) * (point.y - meanY);
  }
  const angle = -0.5 * Math.atan2(2 * xy, xx - yy);
  for (const point of points) {
    const x = point.x - meanX,
      y = point.y - meanY;
    point.x = graphCoordinate(x * Math.cos(angle) - y * Math.sin(angle));
    point.y = graphCoordinate(x * Math.sin(angle) + y * Math.cos(angle));
    point.vx = 0;
    point.vy = 0;
  }
  return points;
}

// Indexed by how many of the two nodes are hubs: hubs keep far apart, people pack.
const REPULSION = [
  { charge: 3000, spacing: 70 },
  { charge: 5000, spacing: 95 },
  { charge: 40_000, spacing: 290 },
];

/** Hubs repel each other strongly, people settle around theirs. Dragged nodes stay under the pointer. */
export function tickForces(
  points: GraphPoint[],
  springs: Spring[],
  heat: number,
  pinnedId?: string
) {
  const byId = new Map(points.map((point) => [point.id, point]));
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const a = points[i],
        b = points[j];
      const dx = b.x - a.x || 0.01,
        dy = b.y - a.y || 0.01;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const { charge, spacing } = REPULSION[Number(a.hub) + Number(b.hub)];
      const force =
        (charge / (distance * distance) +
          Math.max(0, spacing - distance) * 0.04) *
        heat;
      a.vx -= (dx / distance) * force;
      a.vy -= (dy / distance) * force;
      b.vx += (dx / distance) * force;
      b.vy += (dy / distance) * force;
    }
  }
  for (const spring of springs) {
    const a = byId.get(spring.person),
      b = byId.get(spring.hub);
    if (!a || !b) {
      continue;
    }
    const dx = b.x - a.x,
      dy = b.y - a.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const force = (distance - spring.length) * 0.03 * heat;
    a.vx += (dx / distance) * force;
    a.vy += (dy / distance) * force;
    b.vx -= (dx / distance) * force * 0.35;
    b.vy -= (dy / distance) * force * 0.35;
  }
  for (const point of points) {
    if (point.id === pinnedId) {
      point.vx = 0;
      point.vy = 0;
      continue;
    }
    point.vx = (point.vx - point.x * 0.0009 * heat) * 0.78;
    point.vy = (point.vy - point.y * 0.0009 * heat) * 0.78;
    point.x += Math.max(-8, Math.min(8, point.vx));
    point.y += Math.max(-8, Math.min(8, point.vy));
  }
}
