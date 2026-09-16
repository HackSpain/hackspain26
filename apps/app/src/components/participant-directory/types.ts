export interface DirectoryParticipant {
  bio?: string;
  cardScore?: number;
  city: string;
  university?: string;
  company?: string;
  degree?: string;
  team?: { id: string; name: string };
  /** The team's chosen challenges; `logoUrl` is the sponsor wordmark. */
  tracks?: { id: string; label: string; logoUrl?: string }[];
  interests?: string[];
  displayName: string;
  featured?: boolean;
  /** Stable public identifier used in shareable links. Never use an email. */
  id: string;
  /** True for the viewer's own card. */
  isMe?: boolean;
  lore?: string;
  photoUrl?: string;
  role: string;
  skills: string[];
}
