export interface DirectoryParticipant {
  bio?: string;
  city: string;
  university?: string;
  company?: string;
  degree?: string;
  team?: { id: string; name: string };
  /** The team's chosen challenges; `logoUrl` is the sponsor wordmark. */
  tracks?: { id: string; label: string; logoUrl?: string }[];
  interests?: string[];
  displayName: string;
  /** Stable public identifier used in shareable links. Never use an email. */
  id: string;
  /** True for the viewer's own card. */
  isMe?: boolean;
  /** Already small (convex/lib/photo.ts): the map and lists never need more than 128px. */
  photoUrl?: string;
  role: string;
  skills: string[];
}
