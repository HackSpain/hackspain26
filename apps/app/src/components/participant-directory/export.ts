import { urlOf } from "@/lib/urls";
import { toCsv } from "@/lib/judging-export";
import type { DirectoryParticipant } from "./types";

const HEADER = [
  "id",
  "email",
  "nombre",
  "rol",
  "ciudad",
  "universidad",
  "empresa",
  "estudios",
  "bio",
  "habilidades",
  "intereses",
  "equipo",
  "proyecto",
  "retos",
  "github",
  "linkedin",
  "x",
  "web",
  "logros",
  "tiempo_libre",
  "repo",
  "demo",
  "video",
] as const;

function join(values: readonly string[] | undefined): string {
  return (values ?? []).filter(Boolean).join("; ");
}

export function directoryCsv(
  people: readonly DirectoryParticipant[],
): string {
  return toCsv(
    [...HEADER],
    people.map((person) => [
      person.id,
      person.email,
      person.displayName,
      person.role,
      person.city,
      person.university,
      person.company,
      person.degree,
      person.bio,
      join(person.skills),
      join(person.interests),
      person.team?.name,
      person.project?.name ?? person.projectName,
      join(person.tracks?.map((track) => track.label)),
      person.githubUsername ?? urlOf(person.urls, "github"),
      urlOf(person.urls, "linkedin"),
      urlOf(person.urls, "x"),
      urlOf(person.urls, "web"),
      person.achievements,
      person.freeTime,
      urlOf(person.project?.urls, "repo") ?? urlOf(person.urls, "repo"),
      urlOf(person.project?.urls, "demo"),
      urlOf(person.project?.urls, "video"),
    ]),
  );
}

export function directoryCsvFileName(now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `hackspain-participantes-${stamp}.csv`;
}
