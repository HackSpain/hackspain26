import type { DirectoryParticipant } from "@/components/participant-directory/types";

/** What `tv.teamFormation` publishes about a person: who, and which team. */
export type FormationPerson = {
  id: string;
  name: string;
  photoUrl?: string;
  team?: { id: string; name: string };
};

export type FormationEvent = {
  key: string;
  /** "new": this person's arrival is what put the team on the map. */
  kind: "join" | "new";
  personId: string;
  person: string;
  team: string;
  at: number;
};

/** The map draws directory cards; the screen only fills in what it may show. */
export function toParticipants(people: FormationPerson[]): DirectoryParticipant[] {
  return people.map((person) => ({
    city: "", displayName: person.name, id: person.id, photoUrl: person.photoUrl,
    role: "", skills: [], team: person.team,
  }));
}

export function formationStats(people: FormationPerson[]) {
  const teams = new Set<string>();
  let placed = 0;
  for (const person of people) {
    if (person.team) {
      placed += 1;
      teams.add(person.team.id);
    }
  }
  return { loose: people.length - placed, placed, teams: teams.size, total: people.length };
}

/**
 * What changed between two snapshots, as the screen tells it: people joining
 * a team, and the first of them founding it when nobody was in it before.
 * Leaving a team is not news for a venue screen; the person just drifts back.
 */
export function formationEvents(before: FormationPerson[], after: FormationPerson[], at: number): FormationEvent[] {
  const previous = new Map(before.map((person) => [person.id, person.team?.id]));
  const existing = new Set(before.flatMap((person) => (person.team ? [person.team.id] : [])));
  const events: FormationEvent[] = [];
  for (const person of after) {
    if (!person.team || previous.get(person.id) === person.team.id) { continue; }
    const kind = existing.has(person.team.id) ? "join" : "new";
    existing.add(person.team.id);
    events.push({ at, key: `${person.id}:${person.team.id}:${at}`, kind, person: person.name, personId: person.id, team: person.team.name });
  }
  return events;
}

/* ------------------------------------------------------------------ demo */

const DEMO_NAMES = [
  "Lucía", "Dani", "Irene", "Pablo", "Nuria", "Álex", "Sara", "Jorge", "Marta", "Hugo", "Carla", "Iván", "Elena", "Marcos",
  "Aitana", "Bruno", "Noa", "Leo", "Vera", "Adrián", "Julia", "Mateo", "Alba", "Nico", "Laia", "Óscar", "Claudia", "Rubén",
  "Inés", "Samuel", "Paula", "Guille", "Carmen", "Diego", "Olivia", "Martín", "Sofía", "Andrés", "Lola", "Raúl",
];
const DEMO_SURNAMES = ["Fernández", "Ruiz", "Vega", "Molina", "Serrano", "Ortega", "Cano", "Prieto", "Gil", "Marín", "Pascual", "Soler"];
const DEMO_TEAMS = [
  "Los Molinos", "Rocinante Labs", "Dulcinea", "Sancho Stack", "La Mancha ML", "Clavileño", "Barataria", "Yelmo de Mambrino",
  "Maese Pedro", "Cueva de Montesinos", "Bachiller Carrasco", "Tizona", "Venta del Puerto", "Alcalá Bytes", "Galeotes",
  "Toboso Tech", "Babieca", "Ínsula", "Rucio", "Mambrino", "Altisidora", "Micomicona", "Caraculiambro", "Frestón",
];
const DEMO_PEOPLE = 96;
const DEMO_TEAM_SIZE = 4;

/**
 * Invented people for `/tv?view=equipos&demo=1`. At `step` 0 nobody has a
 * team; every step places one more person in a fixed shuffled order, so teams are
 * founded first and then fill up to four, and once everybody is placed the formation starts over.
 */
export function demoFormation(step: number): FormationPerson[] {
  const placed = step % (DEMO_PEOPLE + 12);
  return Array.from({ length: DEMO_PEOPLE }, (_, index) => {
    // A fixed stride visits every person once, so the order looks shuffled but never changes.
    const turn = (index * 37) % DEMO_PEOPLE;
    const team = (turn * 7) % (DEMO_PEOPLE / DEMO_TEAM_SIZE);
    return {
      id: `demo-${index}`,
      name: `${DEMO_NAMES[index % DEMO_NAMES.length]} ${DEMO_SURNAMES[(index * 5) % DEMO_SURNAMES.length]}`,
      team: turn < placed ? { id: `demo-team-${team}`, name: DEMO_TEAMS[team % DEMO_TEAMS.length] ?? `Equipo ${team + 1}` } : undefined,
    };
  });
}
