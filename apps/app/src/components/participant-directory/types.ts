export interface DirectoryUrl {
  kind: "x" | "linkedin" | "github" | "web" | "repo" | "demo" | "video";
  url: string;
}

export interface DirectoryParticipant {
  achievements?: string;
  bio?: string;
  city: string;
  university?: string;
  company?: string;
  degree?: string;
  freeTime?: string;
  githubUsername?: string;
  project?: {
    description: string;
    id: string;
    name: string;
    techStack: string[];
    urls: DirectoryUrl[];
  };
  projectName?: string;
  team?: { id: string; name: string };
  /** The team's chosen challenges; `logoUrl` is the sponsor wordmark, `slug` finds its symbol. */
  tracks?: { id: string; label: string; logoUrl?: string; slug?: string }[];
  interests?: string[];
  displayName: string;
  email?: string;
  /** Stable public identifier used in shareable links. Never use an email. */
  id: string;
  /** True for the viewer's own card. */
  isMe?: boolean;
  /** Already small (convex/lib/photo.ts): the map and lists never need more than 128px. */
  photoUrl?: string;
  role: string;
  skills: string[];
  urls?: DirectoryUrl[];
}

export function personHeading(person: Pick<DirectoryParticipant, "displayName" | "role">): string {
  return person.role ? `${person.displayName} · ${person.role}` : person.displayName;
}
