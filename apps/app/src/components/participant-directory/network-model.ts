import { normalize, valuesFor } from "./affinities";
import type { AffinityKind } from "./affinities";
import type { DirectoryParticipant } from "./types";

export const ENTITY_KINDS = [
  "city",
  "university",
  "company",
  "degree",
  "team",
] as const;
export type EntityKind = (typeof ENTITY_KINDS)[number];

export interface NetworkEntity {
  id: string;
  kind: EntityKind;
  label: string;
  memberIds: string[];
}

export interface NetworkEdge {
  id: string;
  source: string;
  target: string;
  kind: AffinityKind;
  values: string[];
}
export interface Network {
  participants: DirectoryParticipant[];
  edges: NetworkEdge[];
  entities: NetworkEntity[];
}
export interface GraphPoint {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}
export interface Spring {
  source: string;
  target: string;
  team: boolean;
}

// Ignore subpixel floating-point differences between the server and browser engines.
export function graphCoordinate(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** A bipartite graph: one membership per person and entity, never person pairs. */
export function buildNetwork(participants: DirectoryParticipant[]): Network {
  const people = [
    ...new Map(participants.map((person) => [person.id, person])).values(),
  ].toSorted((a, b) => a.id.localeCompare(b.id));
  const entities = new Map<string, NetworkEntity>();
  const edges: NetworkEdge[] = [];
  for (const person of people) {
    for (const kind of ENTITY_KINDS) {
      for (const raw of valuesFor(person, kind)) {
        const value = raw.trim().replaceAll(/\s+/g, " ");
        const key = kind === "team" ? person.team?.id : normalize(value);
        if (!key) {
          continue;
        }
        const id = `entity:${JSON.stringify([kind, key])}`;
        const entity = entities.get(id) ?? {
          id,
          kind,
          label: value,
          memberIds: [],
        };
        entity.memberIds.push(person.id);
        entities.set(id, entity);
        edges.push({
          id: JSON.stringify([person.id, id]),
          source: person.id,
          target: id,
          kind,
          values: [entity.label],
        });
      }
    }
  }
  return {
    edges,
    participants: people,
    entities: [...entities.values()].toSorted((a, b) =>
      a.id.localeCompare(b.id),
    ),
  };
}

/** Expand the selected entity, or traverse person → entity → people on demand. */
export function networkNeighbors(
  network: Network,
  id: string,
  kinds: ReadonlySet<AffinityKind>,
) {
  const selectedEntity = network.entities.find((entity) => entity.id === id);
  const entities = network.entities.filter(
    (entity) =>
      kinds.has(entity.kind) &&
      (selectedEntity ? entity.id === id : entity.memberIds.includes(id)),
  );
  const byPeer = new Map<string, NetworkEdge[]>();
  for (const entity of entities) {
    for (const memberId of entity.memberIds) {
      if (memberId === id) {
        continue;
      }
      const links = byPeer.get(memberId) ?? [];
      links.push({
        id: JSON.stringify([memberId, entity.id]),
        source: memberId,
        target: entity.id,
        kind: entity.kind,
        values: [entity.label],
      });
      byPeer.set(memberId, links);
    }
  }
  return network.participants
    .flatMap((person) => {
      const links = byPeer.get(person.id);
      return links ? [{ person, links }] : [];
    })
    .toSorted(
      (a, b) =>
        b.links.length - a.links.length ||
        a.person.displayName.localeCompare(b.person.displayName, "es"),
    );
}

export function networkSprings(network: Network): Spring[] {
  const pairs = new Map<string, Map<string, Spring>>();
  for (const edge of network.edges) {
    const targets = pairs.get(edge.source) ?? new Map<string, Spring>();
    const existing = targets.get(edge.target);
    if (existing) {
      existing.team ||= edge.kind === "team";
    } else {
      targets.set(edge.target, {
        source: edge.source,
        target: edge.target,
        team: edge.kind === "team",
      });
      pairs.set(edge.source, targets);
    }
  }
  return [...pairs.values()].flatMap((targets) => [...targets.values()]);
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

/** A deterministic force layout: no random server/client positions or fixed central person. */
export function initialPoints(network: Network): GraphPoint[] {
  const nodes = [
    ...network.participants.map((person) => ({ id: person.id, entity: false })),
    ...network.entities.map((entity) => ({ id: entity.id, entity: true })),
  ];
  const points = nodes.map((node) => {
    const angle = seed(node.id) * Math.PI * 2;
    const radius = node.entity ? 240 : 480;
    return {
      id: node.id,
      vx: 0,
      vy: 0,
      x: Math.cos(angle) * radius + (seed(node.id + "x") - 0.5) * 180,
      y: Math.sin(angle) * radius + (seed(node.id + "y") - 0.5) * 180,
    };
  });
  const springs = networkSprings(network);
  const tick = prepareForces(points, springs);
  for (let i = 0; i < 220; i++) {
    tick(0.7);
  }
  // Orient the natural layout along the wide canvas, without changing its relationships.
  const meanX = points.reduce((sum, p) => sum + p.x, 0) / (points.length || 1);
  const meanY = points.reduce((sum, p) => sum + p.y, 0) / (points.length || 1);
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

/** Pair repulsion and membership springs. Dragged nodes stay under the pointer. */
export function tickForces(
  points: GraphPoint[],
  springs: Spring[],
  heat: number,
  pinnedId?: string,
) {
  prepareForces(points, springs)(heat, pinnedId);
}

/** Resolve topology once, not on each of the 220 layout iterations. */
function prepareForces(points: GraphPoint[], springs: Spring[]) {
  const byId = new Map(points.map((point, index) => [point.id, index]));
  const teammates = new Set<number>();
  const links = springs.flatMap((spring) => {
    const a = byId.get(spring.source),
      b = byId.get(spring.target);
    if (a === undefined || b === undefined) {
      return [];
    }
    if (spring.team) {
      teammates.add(a * points.length + b);
      teammates.add(b * points.length + a);
    }
    return [{ a: points[a], b: points[b], team: spring.team }];
  });
  return (heat: number, pinnedId?: string) => {
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const a = points[i],
          b = points[j];
        const dx = b.x - a.x || 0.01,
          dy = b.y - a.y || 0.01;
        // Coordinates are bounded; this hot loop does not need hypot’s overflow scaling.
        // oxlint-disable-next-line unicorn/prefer-modern-math-apis
        const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const sameTeam = teammates.has(i * points.length + j);
        const force =
          ((sameTeam ? 900 : 4800) / (distance * distance) +
            Math.max(0, (sameTeam ? 70 : 135) - distance) * 0.035) *
          heat;
        a.vx -= (dx / distance) * force;
        a.vy -= (dy / distance) * force;
        b.vx += (dx / distance) * force;
        b.vy += (dy / distance) * force;
      }
    }
    for (const { a, b, team } of links) {
      const dx = b.x - a.x,
        dy = b.y - a.y;
      // Coordinates are bounded; this hot loop does not need hypot’s overflow scaling.
      // oxlint-disable-next-line unicorn/prefer-modern-math-apis
      const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const force =
        (distance - (team ? 64 : 160)) * (team ? 0.075 : 0.025) * heat;
      a.vx += (dx / distance) * force;
      a.vy += (dy / distance) * force;
      b.vx -= (dx / distance) * force;
      b.vy -= (dy / distance) * force;
    }
    for (const point of points) {
      if (point.id === pinnedId) {
        point.vx = 0;
        point.vy = 0;
        continue;
      }
      point.vx = (point.vx - point.x * 0.0008 * heat) * 0.78;
      point.vy = (point.vy - point.y * 0.0008 * heat) * 0.78;
      point.x += Math.max(-8, Math.min(8, point.vx));
      point.y += Math.max(-8, Math.min(8, point.vy));
    }
  };
}
