export interface DirectoryParticipant {
  bio?: string;
  cardScore?: number;
  city: string;
  university?: string;
  company?: string;
  degree?: string;
  team?: { id: string; name: string };
  interests?: string[];
  displayName: string;
  featured?: boolean;
  /** Stable public identifier used in shareable links. Never use an email. */
  id: string;
  lore?: string;
  photoUrl?: string;
  role: string;
  skills: string[];
}
