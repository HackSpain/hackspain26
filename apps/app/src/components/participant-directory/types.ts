import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";

type Participant = FunctionReturnType<typeof api.directory.list>[number];
type CardFields = "city" | "displayName" | "role" | "skills";
type Track = Participant["tracks"][number];

/** Cards accept partial enrichment and public string IDs, including TV demo cards. */
export type DirectoryParticipant = Pick<Participant, CardFields> &
  Partial<
    Omit<Participant, CardFields | "id" | "team" | "project" | "tracks">
  > & {
    id: string;
    team?: Omit<NonNullable<Participant["team"]>, "id"> & { id: string };
    project?: Omit<NonNullable<Participant["project"]>, "id"> & { id: string };
    tracks?: (Omit<Track, "id" | "slug"> &
      Partial<Pick<Track, "slug">> & { id: string })[];
  };

export function personHeading(
  person: Pick<DirectoryParticipant, "displayName" | "role">
): string {
  return person.role
    ? `${person.displayName} · ${person.role}`
    : person.displayName;
}
