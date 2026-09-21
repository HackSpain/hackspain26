"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
	ArrowUpRight,
	LocateFixed,
	Minus,
	Plus,
	Scan,
	Search,
	X,
} from "lucide-react";
import { initialsOf } from "@/components/avatar";
import { contentWidth } from "@/lib/layout";
import { cn } from "@/lib/utils";
import { normalize, searchHaystack } from "./affinities";
import {
	LENS_LABELS,
	LENSES,
	linksFor,
	uniqueParticipants,
} from "./network-model";
import type { Lens, Link } from "./network-model";
import { CONNECTION_STYLES, NetworkCanvas } from "./network-canvas";
import type { NetworkHandle } from "./network-canvas";
import type { DirectoryParticipant } from "./types";
import { personHeading } from "./types";
import "./connection-graph.css";

const PANEL_WIDTH = 340;
/** `contentWidth` is max-w-6xl with px-4: the overlays sit inside that box. */
const CONTAINER_MAX = 1152;
const CONTAINER_PAD = 16;
const CONTAINER = contentWidth("/participantes");

/** Left edge of the profile panel for a viewport width, or null when it is a sheet. */
function panelLeft(viewportWidth: number): number | null {
	if (viewportWidth < 900) {
		return null;
	}
	const box = Math.min(CONTAINER_MAX, viewportWidth);
	return (viewportWidth - box) / 2 + box - CONTAINER_PAD - PANEL_WIDTH;
}
const URL_LABELS: Record<string, string> = {
	github: "GitHub",
	linkedin: "LinkedIn",
	web: "Web",
	x: "X",
};

function Portrait({ person }: { person: DirectoryParticipant }) {
	return person.photoUrl ? (
		// eslint-disable-next-line @next/next/no-img-element -- profile images may use authenticated app URLs or GitHub avatars.
		<img className="pg-portrait" src={person.photoUrl} alt="" />
	) : (
		<span className="pg-portrait" aria-hidden="true">
			{initialsOf(person.displayName)}
		</span>
	);
}

export function ProfilePanel({
	person,
	links,
	onClose,
	onFocus,
}: {
	person: DirectoryParticipant;
	links: Link[];
	onClose: () => void;
	onFocus: (id: string) => void;
}) {
	const facts = [
		person.city,
		person.university,
		person.company,
		person.degree,
	].filter(Boolean);
	const linksOut = (person.urls ?? []).filter(
		(entry) => URL_LABELS[entry.kind] && entry.url,
	);
	return (
		<aside className="pg-panel" aria-label={`Perfil de ${person.displayName}`}>
			<div className="pg-panel-head">
				<Portrait person={person} />
				<div className="pg-panel-identity">
					<h2>
						{personHeading(person)}
						{person.isMe ? <span className="pg-me-chip">Tú</span> : null}
					</h2>
				</div>
				<button type="button" aria-label="Cerrar perfil" onClick={onClose}>
					<X size={18} />
				</button>
			</div>
			{facts.length ? (
				<p className="pg-panel-facts">{facts.join(" · ")}</p>
			) : null}
			{person.team ? (
				<p className="pg-panel-team">
					<span style={{ background: CONNECTION_STYLES.team.color }} />
					{person.projectName
						? `${person.team.name} · ${person.projectName}`
						: person.team.name}
				</p>
			) : person.projectName ? (
				<p className="pg-panel-team">{person.projectName}</p>
			) : null}
			{person.bio ? <p className="pg-panel-bio">{person.bio}</p> : null}
			{person.achievements ? (
				<p className="pg-panel-bio">{person.achievements}</p>
			) : null}
			{person.freeTime ? (
				<p className="pg-panel-bio">{person.freeTime}</p>
			) : null}
			{linksOut.length || person.githubUsername ? (
				<p className="pg-panel-links">
					{linksOut.map((entry) => (
						<a
							key={entry.kind}
							href={entry.url}
							rel="noreferrer"
							target="_blank"
						>
							{URL_LABELS[entry.kind]}
						</a>
					))}
					{person.githubUsername &&
					!linksOut.some((entry) => entry.kind === "github") ? (
						<a
							href={`https://github.com/${person.githubUsername}`}
							rel="noreferrer"
							target="_blank"
						>
							GitHub
						</a>
					) : null}
				</p>
			) : null}
			{person.skills.length ? (
				<ul className="pg-chips" aria-label="Habilidades">
					{person.skills.slice(0, 8).map((skill) => (
						<li key={skill}>{skill}</li>
					))}
				</ul>
			) : null}
			<div className="pg-panel-section">
				<h3>En común</h3>
				<span>{links.length}</span>
			</div>
			{links.length ? (
				<ul className="pg-links-list">
					{links.map((link) => (
						<li key={link.participant.id}>
							<button
								type="button"
								onClick={() => onFocus(link.participant.id)}
							>
								<Portrait person={link.participant} />
								<span className="pg-link-body">
                      <span className="pg-link-name">
										{personHeading(link.participant)}
										<ArrowUpRight size={14} aria-hidden="true" />
									</span>
									<span className="pg-link-reasons">
										{link.affinities.slice(0, 4).map((affinity) => (
											<span
												key={`${affinity.kind}:${affinity.value}`}
												style={{
													color: CONNECTION_STYLES[affinity.kind].color,
												}}
											>
												{affinity.value}
											</span>
										))}
										{link.affinities.length > 4 ? (
											<span className="pg-link-more">
												+{link.affinities.length - 4}
											</span>
										) : null}
									</span>
								</span>
							</button>
						</li>
					))}
				</ul>
			) : (
				<p className="pg-panel-empty">
					Todavía no comparte ciudad, estudios, empresa, equipo, habilidades ni
					intereses con nadie.
				</p>
			)}
		</aside>
	);
}

export function ConnectionGraph({
	participants: input,
}: {
	participants: DirectoryParticipant[];
}) {
	const participants = useMemo(() => uniqueParticipants(input), [input]);
	const [lens, setLens] = useState<Lens>("team");
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [query, setQuery] = useState("");
	const [searchOpen, setSearchOpen] = useState(false);
	const canvas = useRef<NetworkHandle>(null);
	const searchInput = useRef<HTMLInputElement>(null);

	// Links are computed lazily per person and remembered until the data changes.
	const linksOf = useMemo(() => {
		const cache = new Map<string, Link[]>();
		return (id: string) => {
			const cached = cache.get(id);
			if (cached) {
				return cached;
			}
			const person = participants.find((item) => item.id === id);
			const links = person ? linksFor(person, participants) : [];
			// oxlint-disable-next-line react/immutability -- the cache is private to this closure and reset with the data.
			cache.set(id, links);
			return links;
		};
	}, [participants]);

	const me = useMemo(
		() => participants.find((person) => person.isMe),
		[participants],
	);
	const selected = useMemo(
		() => participants.find((person) => person.id === selectedId) ?? null,
		[participants, selectedId],
	);
	const searchIndex = useMemo(
		() =>
			new Map(
				participants.map((person) => [person.id, searchHaystack(person)]),
			),
		[participants],
	);
	const search = normalize(query);
	const matches = useMemo(
		() =>
			search
				? new Set(
						participants
							.filter((person) => searchIndex.get(person.id)?.includes(search))
							.map((person) => person.id),
					)
				: null,
		[participants, searchIndex, search],
	);
	const results = useMemo(
		() =>
			matches
				? participants
						.filter((person) => matches.has(person.id))
						.toSorted((a, b) => {
							const aName = normalize(a.displayName).startsWith(search);
							const bName = normalize(b.displayName).startsWith(search);
							return (
								Number(bName) - Number(aName) ||
								a.displayName.localeCompare(b.displayName, "es")
							);
						})
						.slice(0, 8)
				: [],
		[participants, matches, search],
	);

	const select = useCallback((id: string | null) => {
		setSelectedId(id);
		if (id) {
			setQuery("");
			setSearchOpen(false);
		}
	}, []);
	function focus(id: string) {
		canvas.current?.focus(id);
	}
	function changeLens(next: Lens) {
		setLens(next);
		if (selectedId) {
			// The clusters move under the selection; keep it in view once they settle.
			requestAnimationFrame(() =>
				setTimeout(() => canvas.current?.focus(selectedId), 500),
			);
		}
	}

	return (
		<section
			className="pg-stage"
			id="participantes"
			aria-label="Mapa de participantes"
			style={{ "--pg-panel-width": `${PANEL_WIDTH}px` } as React.CSSProperties}
		>
			<NetworkCanvas
				ref={canvas}
				participants={participants}
				lens={lens}
				selectedId={selected ? selected.id : null}
				matches={matches}
				linksOf={linksOf}
				panelLeft={panelLeft}
				onSelect={select}
			/>

			<div className={cn("pg-overlay", CONTAINER)}>
				<div className="pg-lenses" role="group" aria-label="Agrupar por">
					{LENSES.map((item) => (
						<button
							key={item}
							type="button"
							aria-pressed={lens === item}
							onClick={() => changeLens(item)}
						>
							{LENS_LABELS[item].label}
						</button>
					))}
				</div>

				<div className="pg-tools">
					{me ? (
						<button
							type="button"
							className="pg-tool"
							aria-label="Ir a mi ficha"
							title="Ir a mi ficha"
							onClick={() => focus(me.id)}
						>
							<LocateFixed size={17} aria-hidden="true" />
							<span>Tú</span>
						</button>
					) : null}
					<div
						className="pg-search"
						data-open={searchOpen || query ? "" : undefined}
					>
						<Search size={17} aria-hidden="true" />
						<input
							ref={searchInput}
							type="search"
							aria-label="Buscar participantes"
							placeholder="Nombre, equipo, proyecto…"
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							onFocus={() => setSearchOpen(true)}
							onBlur={() => setSearchOpen(false)}
							onKeyDown={(event) => {
								if (event.key === "Enter" && results[0]) {
									event.preventDefault();
									focus(results[0].id);
									searchInput.current?.blur();
								}
								if (event.key === "Escape") {
									setQuery("");
									searchInput.current?.blur();
								}
							}}
						/>
						{query ? (
							<button
								type="button"
								aria-label="Limpiar búsqueda"
								onMouseDown={(event) => event.preventDefault()}
								onClick={() => {
									setQuery("");
									searchInput.current?.focus();
								}}
							>
								<X size={15} />
							</button>
						) : null}
						{search ? (
							<div className="pg-results" aria-label="Resultados">
								<p aria-live="polite">
									{matches?.size
										? `${matches.size} ${matches.size === 1 ? "persona" : "personas"}`
										: "Sin resultados"}
								</p>
								{results.map((person) => (
									<button
										key={person.id}
										type="button"
										onMouseDown={(event) => event.preventDefault()}
										onClick={() => focus(person.id)}
									>
										<Portrait person={person} />
										<span>
											<strong>{personHeading(person)}</strong>
											<small>
												{[person.team?.name, person.projectName, person.city]
													.filter(Boolean)
													.join(" · ")}
											</small>
										</span>
									</button>
								))}
							</div>
						) : null}
					</div>
				</div>

				{selected ? (
					<ProfilePanel
						key={selected.id}
						person={selected}
						links={linksOf(selected.id)}
						onClose={() => canvas.current?.clear()}
						onFocus={focus}
					/>
				) : null}

				<div className="pg-hint" aria-hidden="true">
					Arrastra para moverte · Rueda para ampliar
				</div>
				<div className="pg-zoom" role="group" aria-label="Zoom">
					<button
						type="button"
						onClick={() => canvas.current?.zoom(1 / 1.3)}
						aria-label="Alejar"
					>
						<Minus size={18} />
					</button>
					<button
						type="button"
						onClick={() => canvas.current?.fit()}
						aria-label="Encajar todo"
					>
						<Scan size={18} />
					</button>
					<button
						type="button"
						onClick={() => canvas.current?.zoom(1.3)}
						aria-label="Acercar"
					>
						<Plus size={18} />
					</button>
				</div>

				{!participants.length ? (
					<p className="pg-empty" role="status">
						El mapa se llenará cuando haya fichas completas.
					</p>
				) : null}
			</div>
		</section>
	);
}
