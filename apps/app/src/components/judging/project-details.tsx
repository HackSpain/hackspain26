import { LinkedText } from "@/components/linked-text";
import { MetaLink, MetaRow } from "@/components/page";
import { TrackTag } from "@/components/track-tag";
import { Badge } from "@/components/ui/badge";
import type { UrlEntry, UrlKind } from "@/lib/urls";
import { urlDisplay, urlLabel } from "@/lib/urls";
import { perkName } from "@/lib/utils";

const DETAIL_URL_ORDER: UrlKind[] = [
  "repo",
  "demo",
  "web",
  "github",
  "video",
  "x",
  "linkedin",
];

export type ProjectInfo = {
  challenges: { _id: string; label: string; logoUrl?: string }[];
  description: string;
  members: string[];
  perks: { _id: string; company: string; title: string }[];
  teamName?: string;
  techStack: string[];
  urls: UrlEntry[];
};

export function ProjectDetails({ item }: { item: ProjectInfo }) {
  const links = DETAIL_URL_ORDER.flatMap((kind) => {
    const entry = item.urls.find((url) => url.kind === kind);
    return entry ? [entry] : [];
  });
  const leftover = item.urls.filter(
    (entry) => !DETAIL_URL_ORDER.includes(entry.kind),
  );
  const urlRows = [...links, ...leftover];
  const hasMeta =
    Boolean(item.teamName) ||
    item.members.length > 0 ||
    item.perks.length > 0 ||
    item.techStack.length > 0 ||
    urlRows.length > 0;
  return (
    <div className="space-y-4">
      {item.challenges.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {item.challenges.map((challenge) => (
            <TrackTag key={challenge._id} track={challenge} />
          ))}
        </div>
      ) : null}
      {item.description.trim() ? (
        <MetaRow label="Notas">
          <span className="whitespace-pre-wrap">
            <LinkedText text={item.description} />
          </span>
        </MetaRow>
      ) : null}
      {hasMeta ? (
        <div className="grid gap-3">
          {item.teamName ? (
            <MetaRow label="Equipo">{item.teamName}</MetaRow>
          ) : null}
          {item.members.length > 0 ? (
            <MetaRow label="Miembros">{item.members.join(" · ")}</MetaRow>
          ) : null}
          {item.perks.length > 0 ? (
            <MetaRow label="Partners">
              {item.perks
                .map((perk) => perkName(perk.company, perk.title))
                .join(" · ")}
            </MetaRow>
          ) : null}
          {item.techStack.length > 0 ? (
            <MetaRow label="Stack">
              <span className="flex flex-wrap gap-2">
                {item.techStack.map((tag) => (
                  <Badge key={tag}>{tag}</Badge>
                ))}
              </span>
            </MetaRow>
          ) : null}
          {urlRows.map((entry) => (
            <MetaRow key={entry.kind} label={urlLabel(entry.kind)}>
              <MetaLink href={entry.url}>
                {urlDisplay(entry.kind, entry.url)}
              </MetaLink>
            </MetaRow>
          ))}
        </div>
      ) : null}
    </div>
  );
}
