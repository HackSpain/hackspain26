"use client";

import { useEffect, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { normalizeGithubLogin } from "@convex/lib/githubProfile";
import { errorMessage, LoadingText, MetaLink, MetaRow } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import type { DirectoryParticipant } from "./types";

const EVENT_LABELS: Record<string, string> = {
  pull_request: "PRs",
  push: "pushes",
  release: "releases",
  tag: "tags",
};

const HEAT = ["#e8dcc4", "#eab61966", "#eab619", "#d96b2a", "#35858a"];

export function githubLoginOf(person: DirectoryParticipant): string | null {
  return (
    normalizeGithubLogin(person.githubUsername ?? "") ??
    normalizeGithubLogin(
      person.urls?.find((entry) => entry.kind === "github")?.url ?? "",
    )
  );
}

function formatCount(value: number): string {
  return value.toLocaleString("es");
}

function heatFill(count: number, max: number): string {
  if (count <= 0 || max <= 0) {
    return HEAT[0] ?? "#e8dcc4";
  }
  const rank = Math.min(
    HEAT.length - 1,
    Math.ceil((count / max) * (HEAT.length - 1)),
  );
  return HEAT[rank] ?? "#35858a";
}

export function GithubPanel({ person }: { person: DirectoryParticipant }) {
  const username = githubLoginOf(person);
  const data = useQuery(
    api.directory.github,
    username ? { username } : "skip",
  );
  const refresh = useAction(api.directoryGithub.refresh);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!username) {
      return;
    }
    let cancelled = false;
    void refresh({ username }).catch((error: unknown) => {
      if (!cancelled) {
        setLoadError(errorMessage(error, "GitHub no responde."));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [refresh, username]);

  if (!username) {
    return (
      <section className="space-y-3">
        <h3 className="font-bungee text-sm uppercase">GitHub</h3>
        <p className="text-sm text-hs-brown">No tiene GitHub.</p>
      </section>
    );
  }

  const profile = data?.profile;
  const loading = data === undefined || (!profile && !loadError);
  const year = profile?.year;
  const languageTotal =
    profile?.languages.reduce((sum, language) => sum + language.bytes, 0) ?? 0;
  const heatMax = Math.max(
    1,
    ...(profile?.calendar.map((day) => day.count) ?? [0]),
  );
  const repos = (profile?.pinned.length ? profile.pinned : profile?.repos) ?? [];

  return (
    <section className="space-y-4">
      <h3 className="font-bungee text-sm uppercase">GitHub</h3>
      {loading ? <LoadingText /> : null}
      {loadError ? <p className="text-sm text-hs-red">{loadError}</p> : null}
      {profile?.missing ? (
        <p className="text-sm text-hs-brown">
          No sale @{username} en GitHub.
        </p>
      ) : null}
      {profile && !profile.missing ? (
        <>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <MetaLink href={profile.url}>@{profile.login}</MetaLink>
            {profile.name && profile.name !== profile.login ? (
              <span className="text-sm text-hs-brown">{profile.name}</span>
            ) : null}
            {profile.hireable ? (
              <Badge variant="gold">Disponible</Badge>
            ) : null}
          </div>
          {profile.bio ? (
            <p className="text-sm leading-relaxed text-pretty">{profile.bio}</p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            {profile.company ? (
              <MetaRow label="Empresa">{profile.company}</MetaRow>
            ) : null}
            {profile.location ? (
              <MetaRow label="Lugar">{profile.location}</MetaRow>
            ) : null}
            {profile.createdAt ? (
              <MetaRow label="Desde">
                {new Date(profile.createdAt).getFullYear()}
              </MetaRow>
            ) : null}
            {profile.orgs.length ? (
              <MetaRow label="Orgs">
                {profile.orgs.map((org, index) => (
                  <span key={org.login}>
                    {index > 0 ? " · " : null}
                    <MetaLink href={org.url}>{org.login}</MetaLink>
                  </span>
                ))}
              </MetaRow>
            ) : null}
            {profile.blog ? (
              <MetaRow label="Web">
                <MetaLink
                  href={
                    /^https?:\/\//i.test(profile.blog)
                      ? profile.blog
                      : `https://${profile.blog}`
                  }
                >
                  {profile.blog}
                </MetaLink>
              </MetaRow>
            ) : null}
            {profile.twitter ? (
              <MetaRow label="X">
                <MetaLink href={`https://x.com/${profile.twitter}`}>
                  @{profile.twitter}
                </MetaLink>
              </MetaRow>
            ) : null}
          </div>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Repos" value={profile.publicRepos} />
            <Stat label="Seguidores" value={profile.followers} />
            {year ? <Stat label="Aportes" value={year.contributions} /> : null}
            {year ? <Stat label="Commits" value={year.commits} /> : null}
            {year ? <Stat label="PRs" value={year.pullRequests} /> : null}
            {year ? <Stat label="Reviews" value={year.reviews} /> : null}
          </dl>
          {profile.calendar.length ? (
            <div className="space-y-2">
              <p className="font-bungee text-xs">Actividad</p>
              <div
                aria-label="Actividad en GitHub"
                className="grid grid-flow-col grid-rows-7 gap-px overflow-x-auto pb-1"
              >
                {profile.calendar.map((day) => (
                  <span
                    key={day.date}
                    title={`${day.date}: ${day.count}`}
                    className="size-2"
                    style={{ background: heatFill(day.count, heatMax) }}
                  />
                ))}
              </div>
            </div>
          ) : null}
          {profile.languages.length ? (
            <div className="space-y-2">
              <p className="font-bungee text-xs">Lenguajes</p>
              <ul className="grid gap-2">
                {profile.languages.map((language) => {
                  const pct =
                    languageTotal > 0
                      ? Math.round((language.bytes / languageTotal) * 100)
                      : 0;
                  return (
                    <li key={language.name}>
                      <div className="flex justify-between gap-3 text-sm">
                        <span>{language.name}</span>
                        <span className="tabular-nums text-hs-brown">{pct}%</span>
                      </div>
                      <div className="mt-1 h-2 bg-hs-sand">
                        <div
                          className="h-full bg-hs-teal"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
          {repos.length ? (
            <div className="space-y-2">
              <p className="font-bungee text-xs">
                {profile.pinned.length ? "Fijados" : "Repos"}
              </p>
              <ul className="grid gap-2">
                {repos.map((repo) => (
                  <li key={repo.url}>
                    <a
                      href={repo.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block border-[3px] border-hs-ink bg-hs-sand px-3 py-2 hs-hover-bright"
                    >
                      <span className="block font-medium">{repo.name}</span>
                      <span className="block text-sm text-hs-brown">
                        {[
                          repo.language,
                          repo.stars
                            ? `${formatCount(repo.stars)} ★`
                            : null,
                          repo.description,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}
      {data?.hackathon.total ? (
        <div className="space-y-2">
          <p className="font-bungee text-xs">En el evento</p>
          <p className="text-sm text-hs-brown">
            {data.hackathon.events
              .map(
                (row) =>
                  `${formatCount(row.count)} ${EVENT_LABELS[row.event] ?? row.event}`,
              )
              .join(" · ")}
          </p>
          <ul className="grid gap-2">
            {data.hackathon.recent.map((item) => (
              <li key={`${item.at}-${item.url}`}>
                <MetaLink href={item.url}>{item.text}</MetaLink>
                <span className="mt-0.5 block text-xs text-hs-brown">
                  {item.repo}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-[3px] border-hs-ink bg-hs-sand px-3 py-2">
      <dt className="font-bungee text-xs">{label}</dt>
      <dd className="text-lg leading-none tabular-nums">{formatCount(value)}</dd>
    </div>
  );
}
