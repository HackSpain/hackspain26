import { AFFINITY_KINDS, sharedAffinities } from "./affinities";
import type { AffinityKind } from "./affinities";
import type { DirectoryParticipant } from "./types";

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

/** One undirected edge per pair and type. Isolated participants remain in the graph. */
export function buildNetwork(participants: DirectoryParticipant[]): Network {
  const people = [
    ...new Map(participants.map((person) => [person.id, person])).values(),
  ].sort((a, b) => a.id.localeCompare(b.id));
  const edges: NetworkEdge[] = [];
  for (let i = 0; i < people.length; i++) {
    for (let j = i + 1; j < people.length; j++) {
      const affinities = sharedAffinities(people[i], people[j]);
      for (const kind of AFFINITY_KINDS) {
        const values = affinities
          .filter((item) => item.kind === kind)
          .map((item) => item.value);
        if (values.length)
          edges.push({
            id: JSON.stringify([people[i].id, people[j].id, kind]),
            source: people[i].id,
            target: people[j].id,
            kind,
            values,
          });
      }
    }
  }
  return { participants: people, edges };
}

export function networkSprings(network: Network): Spring[] {
  const pairs = new Map<string, Spring>();
  for (const edge of network.edges) {
    const key = JSON.stringify([edge.source, edge.target]);
    const existing = pairs.get(key);
    if (existing) existing.team ||= edge.kind === "team";
    else
      pairs.set(key, {
        source: edge.source,
        target: edge.target,
        team: edge.kind === "team",
      });
  }
  return [...pairs.values()];
}

function seed(value: string) {
  let hash = 2166136261;
  for (const char of value)
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0) / 4294967296;
}

/** A deterministic force layout: no random server/client positions or fixed central person. */
export function initialPoints(network: Network): GraphPoint[] {
  const teams = [
    ...new Set(
      network.participants.flatMap((p) => (p.team ? [p.team.id] : [])),
    ),
  ].sort();
  const points = network.participants.map((person) => {
    const group = person.team ? teams.indexOf(person.team.id) : -1;
    const angle = group >= 0 ? group * 2.399963 : seed(person.id) * Math.PI * 2;
    const radius = group >= 0 ? 250 : 420;
    return {
      id: person.id,
      x: Math.cos(angle) * radius + (seed(person.id + "x") - 0.5) * 180,
      y: Math.sin(angle) * radius + (seed(person.id + "y") - 0.5) * 180,
      vx: 0,
      vy: 0,
    };
  });
  const springs = networkSprings(network);
  for (let i = 0; i < 220; i++) tickForces(points, springs, 0.7);
  // Orient the natural layout along the wide canvas, without changing its relationships.
  const meanX = points.reduce((sum, p) => sum + p.x, 0) / (points.length || 1);
  const meanY = points.reduce((sum, p) => sum + p.y, 0) / (points.length || 1);
  let xx = 0,
    yy = 0,
    xy = 0;
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

/** Pair repulsion, weak graph links and stronger team links. Dragged nodes stay under the pointer. */
export function tickForces(
  points: GraphPoint[],
  springs: Spring[],
  heat: number,
  pinnedId?: string,
) {
  const byId = new Map(points.map((point) => [point.id, point]));
  const teammates = new Map<string, Set<string>>();
  for (const spring of springs) {
    if (!spring.team) continue;
    for (const [source, target] of [
      [spring.source, spring.target],
      [spring.target, spring.source],
    ]) {
      const peers = teammates.get(source) ?? new Set<string>();
      peers.add(target);
      teammates.set(source, peers);
    }
  }
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const a = points[i],
        b = points[j];
      const dx = b.x - a.x || 0.01,
        dy = b.y - a.y || 0.01;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const sameTeam = teammates.get(a.id)?.has(b.id);
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
  for (const spring of springs) {
    const a = byId.get(spring.source),
      b = byId.get(spring.target);
    if (!a || !b) continue;
    const dx = b.x - a.x,
      dy = b.y - a.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const force =
      (distance - (spring.team ? 64 : 330)) *
      (spring.team ? 0.075 : 0.0012) *
      heat;
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
}
