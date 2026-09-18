export type Arrival = {
  id: string;
  checkedInAt: number;
  number: number;
  name: string;
  image: string | null;
  role: string;
  city: string;
  company: string;
  university: string;
  skills: string[];
};

export type ArrivalQueue = { pending: Arrival[]; seen: Set<string> };

/** Retain chronological order, drop undone entries, and never replay profile edits. */
export function reconcileArrivals(state: ArrivalQueue, entries: Arrival[]): ArrivalQueue {
  const available = new Map(entries.map((entry) => [entry.id, entry]));
  const fresh = entries.filter((entry) => !state.seen.has(entry.id));
  const pending = state.pending.flatMap((entry) => {
    const current = available.get(entry.id);
    return current ? [current] : [];
  });
  return {
    pending: [...pending, ...fresh].toSorted((a, b) =>
      a.checkedInAt - b.checkedInAt || a.id.localeCompare(b.id)),
    seen: new Set([...state.seen, ...entries.map((entry) => entry.id)]),
  };
}
