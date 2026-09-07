import type { ChangeEvent, KeyboardEvent, MouseEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ShortlistDecision,
  ShortlistImportResponse,
  ShortlistParticipant,
  ShortlistResponse,
} from "../../lib/shortlist-types";

type DecisionFilter = "all" | "open" | ShortlistDecision;
type AiRecommendationFilter = "all" | "unreviewed" | ShortlistDecision;
type RoleFilter = "all" | "dual" | "student" | "working";
type SortOption = "aiScore" | "name" | "newest" | "score";
type SaveState = "error" | "idle" | "saved" | "saving";
type ReviewPatch = Pick<ShortlistParticipant, "decision" | "notes" | "score">;

interface DecisionControlsProps {
  compact?: boolean;
  decision: ShortlistDecision | null;
  disabled?: boolean;
  onChange: (decision: ShortlistDecision | null) => void;
}

interface ScoreControlsProps {
  compact?: boolean;
  disabled?: boolean;
  onChange: (score: number | null) => void;
  score: number | null;
}

interface CandidateRowProps {
  isSelected: boolean;
  onSelect: () => void;
  participant: ShortlistParticipant;
}

interface DetailPanelProps {
  onClose: () => void;
  onDecision: (decision: ShortlistDecision | null) => void;
  onNotesBlur: () => void;
  onNotesChange: (notes: string) => void;
  onScore: (score: number | null) => void;
  participant: ShortlistParticipant | null;
  saveState: SaveState;
}

interface ToolbarProps {
  aiRecommendationFilter: AiRecommendationFilter;
  csvOnly: boolean;
  decisionFilter: DecisionFilter;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  linkOnly: boolean;
  onAiRecommendationFilterChange: (value: AiRecommendationFilter) => void;
  onCsvOnlyChange: (value: boolean) => void;
  onDecisionFilterChange: (value: DecisionFilter) => void;
  onExportCsv: () => void;
  onExportJson: () => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onImportClick: () => void;
  onLinkOnlyChange: (value: boolean) => void;
  onRoleFilterChange: (value: RoleFilter) => void;
  onSearchChange: (value: string) => void;
  onSortChange: (value: SortOption) => void;
  roleFilter: RoleFilter;
  search: string;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  sort: SortOption;
}

interface ShortlistPageProps {
  initialLoadError: string | null;
  initialParticipants: ShortlistParticipant[];
}

const DECISIONS: readonly ShortlistDecision[] = ["yes", "maybe", "no"];
const SCORES = [1, 2, 3, 4, 5] as const;
const CSV_INJECTION_PATTERN = /^[=+\-@]/;
const WWW_PREFIX_PATTERN = /^www\./;

const stopRowClick = (event: MouseEvent<HTMLElement>): void => {
  event.stopPropagation();
};

const formatRole = (statuses: readonly string[]): string => {
  const isStudent = statuses.includes("student");
  const isWorking = statuses.includes("working");
  if (isStudent && isWorking) {
    return "Student + work";
  }
  if (isStudent) {
    return "Student";
  }
  if (isWorking) {
    return "Working";
  }
  return "Unspecified";
};

const roleMatches = (
  statuses: readonly string[],
  roleFilter: RoleFilter
): boolean => {
  if (roleFilter === "all") {
    return true;
  }
  const isStudent = statuses.includes("student");
  const isWorking = statuses.includes("working");
  if (roleFilter === "dual") {
    return isStudent && isWorking;
  }
  return statuses.includes(roleFilter);
};

const participantHasLinks = (participant: ShortlistParticipant): boolean =>
  Boolean(
    participant.linkedinUrl ||
      participant.githubUrl ||
      participant.xUrl ||
      participant.webUrl
  );

const searchableText = (participant: ShortlistParticipant): string =>
  [
    participant.fullName,
    participant.email,
    participant.studyInstitution,
    participant.employer,
    participant.achievements,
    participant.freeTime,
    participant.notes,
    participant.aiNote,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

const formatDate = (isoDate: string): string =>
  new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(isoDate));

const decisionLabel = (decision: ShortlistDecision): string =>
  `${decision.charAt(0).toUpperCase()}${decision.slice(1)}`;

const sourceLabel = (source: string): string => {
  if (source === "application") {
    return "Application";
  }
  try {
    const hostname = new URL(source).hostname.replace(WWW_PREFIX_PATTERN, "");
    if (hostname === "github.com") {
      return "GitHub";
    }
    if (hostname === "linkedin.com") {
      return "LinkedIn";
    }
    return hostname;
  } catch {
    return source;
  }
};

const AiRecommendation = ({
  participant,
}: {
  participant: ShortlistParticipant;
}) => {
  if (!participant.aiRecommendation || participant.aiScore === null) {
    return <span className="ai-unreviewed">AI pending</span>;
  }

  return (
    <span className="ai-row-suggestion">
      <span
        className={`ai-recommendation-pill is-${participant.aiRecommendation}`}
      >
        AI {decisionLabel(participant.aiRecommendation)}
      </span>
      <span className="ai-score-pill">{participant.aiScore}/5</span>
    </span>
  );
};

const DecisionControls = ({
  compact = false,
  decision,
  disabled = false,
  onChange,
}: DecisionControlsProps) => (
  <fieldset className={`decision-controls${compact ? "is-compact" : ""}`}>
    <legend className="sr-only">Shortlist decision</legend>
    {DECISIONS.map((option) => (
      <button
        aria-pressed={decision === option}
        className={`decision-button decision-${option}`}
        disabled={disabled}
        key={option}
        onClick={(event) => {
          stopRowClick(event);
          onChange(decision === option ? null : option);
        }}
        type="button"
      >
        {decisionLabel(option)}
      </button>
    ))}
    {!compact && (
      <button
        aria-label="Clear decision"
        aria-pressed={decision === null}
        className="decision-button decision-clear"
        disabled={disabled}
        onClick={(event) => {
          stopRowClick(event);
          onChange(null);
        }}
        title="Leave open"
        type="button"
      >
        —
      </button>
    )}
  </fieldset>
);

const ScoreControls = ({
  compact = false,
  disabled = false,
  onChange,
  score,
}: ScoreControlsProps) => (
  <fieldset className={`score-controls${compact ? "is-compact" : ""}`}>
    <legend className="sr-only">Applicant score</legend>
    {SCORES.map((option) => (
      <button
        aria-label={`Score ${option} out of 5`}
        aria-pressed={score === option}
        className="score-button"
        disabled={disabled}
        key={option}
        onClick={(event) => {
          stopRowClick(event);
          onChange(score === option ? null : option);
        }}
        type="button"
      >
        {option}
      </button>
    ))}
  </fieldset>
);

const SocialLinks = ({
  participant,
}: {
  participant: ShortlistParticipant;
}) => {
  const links = [
    ["IN", participant.linkedinUrl, "LinkedIn"],
    ["GH", participant.githubUrl, "GitHub"],
    ["X", participant.xUrl, "X"],
    ["WEB", participant.webUrl, "Website"],
  ] as const;

  return (
    <div className="social-links">
      {links.map(([shortLabel, url, label]) =>
        url ? (
          <a
            aria-label={`Open ${label} for ${participant.fullName}`}
            className="social-link"
            href={url}
            key={label}
            onClick={stopRowClick}
            rel="noopener"
            target="_blank"
            title={label}
          >
            {shortLabel}
          </a>
        ) : null
      )}
    </div>
  );
};

const CandidateRow = ({
  isSelected,
  onSelect,
  participant,
}: CandidateRowProps) => {
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
    }
  };

  const organization =
    [participant.employer, participant.studyInstitution]
      .filter(Boolean)
      .join(" · ") || "No organization supplied";

  return (
    <div
      aria-label={`Review ${participant.fullName}`}
      aria-selected={isSelected}
      className={`candidate-row${isSelected ? "is-selected" : ""}`}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      role="option"
      tabIndex={0}
    >
      <div className="candidate-pick" data-label="AI pick">
        <DecisionControls
          compact
          decision={participant.aiRecommendation}
          disabled
          onChange={() => {
            /* empty */
          }}
        />
      </div>
      <div className="candidate-score" data-label="AI score">
        <ScoreControls
          compact
          disabled
          onChange={() => {
            /* empty */
          }}
          score={participant.aiScore}
        />
      </div>
      <div className="candidate-identity" data-label="Name">
        <strong>{participant.fullName}</strong>
        <span>{participant.email}</span>
        <AiRecommendation participant={participant} />
      </div>
      <div className="candidate-profile" data-label="Role / org">
        <strong>{formatRole(participant.occupationStatuses)}</strong>
        <span>{organization}</span>
      </div>
      <div className="candidate-snapshot" data-label="AI note">
        {participant.aiNote ||
          participant.achievements ||
          participant.freeTime ||
          "No profile snapshot"}
      </div>
      <div className="candidate-links" data-label="Links">
        <SocialLinks participant={participant} />
      </div>
    </div>
  );
};

const DetailSection = ({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) => (
  <section className="detail-section">
    <h3>{label}</h3>
    <div className="detail-copy">{children}</div>
  </section>
);

const DetailPanel = ({
  onClose,
  onDecision,
  onNotesBlur,
  onNotesChange,
  onScore,
  participant,
  saveState,
}: DetailPanelProps) => {
  if (!participant) {
    return (
      <aside className="detail-panel is-empty">
        <p>Select an applicant to review their full profile.</p>
      </aside>
    );
  }

  const organization = [participant.employer, participant.studyInstitution]
    .filter(Boolean)
    .join(" · ");

  return (
    <aside aria-label="Selected applicant details" className="detail-panel">
      <div className="detail-scroll">
        <header className="detail-header">
          <div>
            <p className="eyebrow">Pending applicant</p>
            <h2>{participant.fullName}</h2>
            <a href={`mailto:${participant.email}`}>{participant.email}</a>
            <p className="detail-role">
              <strong>{formatRole(participant.occupationStatuses)}</strong>
              {organization ? <span>{organization}</span> : null}
            </p>
          </div>
          <button
            aria-label="Close applicant details"
            className="detail-close"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </header>

        <section className="ai-review-card">
          <div className="ai-review-heading">
            <div>
              <span className="field-label">AI recommendation</span>
              <p className="ai-review-subtitle">
                Suggestion only — the final decision remains human.
              </p>
            </div>
            <AiRecommendation participant={participant} />
          </div>
          {participant.aiNote ? (
            <p className="ai-review-note">{participant.aiNote}</p>
          ) : (
            <p className="ai-review-note is-empty">
              This application has not been reviewed by AI yet.
            </p>
          )}
          {participant.aiEvidenceSources.length > 0 && (
            <div className="ai-source-list" title="Sources reviewed">
              {participant.aiEvidenceSources.map((source) =>
                source.startsWith("http") ? (
                  <a
                    className="ai-source-chip"
                    href={source}
                    key={source}
                    rel="noopener"
                    target="_blank"
                  >
                    {sourceLabel(source)}
                  </a>
                ) : (
                  <span className="ai-source-chip" key={source}>
                    {sourceLabel(source)}
                  </span>
                )
              )}
            </div>
          )}
          {participant.aiReviewedAt && (
            <p className="ai-review-meta">
              Reviewed {formatDate(participant.aiReviewedAt)}
              {participant.aiRubricVersion
                ? ` · ${participant.aiRubricVersion}`
                : ""}
            </p>
          )}
        </section>

        <div className="review-block">
          <div className="review-control">
            <span className="field-label">Decision</span>
            <DecisionControls
              decision={participant.decision}
              onChange={onDecision}
            />
          </div>
          <div className="review-control">
            <span className="field-label">Score</span>
            <ScoreControls onChange={onScore} score={participant.score} />
          </div>
          <label className="notes-field">
            <span className="field-label">
              Your notes
              <small className={`save-state is-${saveState}`}>
                {saveState === "saving" && "Saving…"}
                {saveState === "saved" && "Saved"}
                {saveState === "error" && "Not saved"}
              </small>
            </span>
            <textarea
              maxLength={10_000}
              onBlur={onNotesBlur}
              onChange={(event) => onNotesChange(event.target.value)}
              placeholder="Why yes / why not, team fit, flags…"
              rows={4}
              value={participant.notes}
            />
          </label>
          <p className="review-safety-note">
            Internal review only — this does not accept, reject, or email
            anyone.
          </p>
        </div>

        <DetailSection label="Achievements">
          <p>{participant.achievements || "No answer provided."}</p>
        </DetailSection>
        <DetailSection label="Free time">
          <p>{participant.freeTime || "No answer provided."}</p>
        </DetailSection>
        {participant.wantsAmbassador && (
          <DetailSection label="Ambassador interest">
            <p>
              {participant.ambassadorMotivation ||
                "Interested, with no motivation note supplied."}
            </p>
          </DetailSection>
        )}
        <DetailSection label="Links">
          {participantHasLinks(participant) ? (
            <SocialLinks participant={participant} />
          ) : (
            <p>No links supplied.</p>
          )}
        </DetailSection>
        <DetailSection label="Application">
          <dl className="meta-grid">
            <div>
              <dt>Applied</dt>
              <dd>{formatDate(participant.createdAt)}</dd>
            </div>
            <div>
              <dt>Heard from</dt>
              <dd>{participant.heardFrom.join(", ") || "—"}</dd>
            </div>
            <div>
              <dt>Referral</dt>
              <dd>{participant.referralCode || "—"}</dd>
            </div>
            <div>
              <dt>CSV matched</dt>
              <dd>
                {participant.importedAt
                  ? formatDate(participant.importedAt)
                  : "No"}
              </dd>
            </div>
          </dl>
        </DetailSection>
      </div>
    </aside>
  );
};

const Toolbar = ({
  aiRecommendationFilter,
  csvOnly,
  decisionFilter,
  fileInputRef,
  linkOnly,
  onCsvOnlyChange,
  onAiRecommendationFilterChange,
  onDecisionFilterChange,
  onExportCsv,
  onExportJson,
  onFileChange,
  onImportClick,
  onLinkOnlyChange,
  onRoleFilterChange,
  onSearchChange,
  onSortChange,
  roleFilter,
  search,
  searchInputRef,
  sort,
}: ToolbarProps) => (
  <div className="shortlist-toolbar">
    <label className="search-field">
      <span className="sr-only">Search applicants</span>
      <span aria-hidden="true" className="search-icon">
        ⌕
      </span>
      <input
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search people, orgs, notes…"
        ref={searchInputRef}
        type="search"
        value={search}
      />
      <kbd>/</kbd>
    </label>
    <div className="toolbar-controls">
      <label>
        <span className="sr-only">Filter by AI recommendation</span>
        <select
          onChange={(event) =>
            onAiRecommendationFilterChange(
              event.target.value as AiRecommendationFilter
            )
          }
          value={aiRecommendationFilter}
        >
          <option value="all">All AI recommendations</option>
          <option value="unreviewed">AI unreviewed</option>
          <option value="yes">AI Yes</option>
          <option value="maybe">AI Maybe</option>
          <option value="no">AI No</option>
        </select>
      </label>
      <label>
        <span className="sr-only">Filter by human decision</span>
        <select
          onChange={(event) =>
            onDecisionFilterChange(event.target.value as DecisionFilter)
          }
          value={decisionFilter}
        >
          <option value="all">All human decisions</option>
          <option value="open">Human open only</option>
          <option value="yes">Human Yes</option>
          <option value="maybe">Human Maybe</option>
          <option value="no">Human No</option>
        </select>
      </label>
      <label>
        <span className="sr-only">Filter by role</span>
        <select
          onChange={(event) =>
            onRoleFilterChange(event.target.value as RoleFilter)
          }
          value={roleFilter}
        >
          <option value="all">All roles</option>
          <option value="student">Students</option>
          <option value="working">Working</option>
          <option value="dual">Student + work</option>
        </select>
      </label>
      <label>
        <span className="sr-only">Sort applicants</span>
        <select
          onChange={(event) => onSortChange(event.target.value as SortOption)}
          value={sort}
        >
          <option value="name">Name</option>
          <option value="aiScore">Highest AI score</option>
          <option value="score">Highest human score</option>
          <option value="newest">Newest</option>
        </select>
      </label>
      <label className="links-toggle">
        <input
          checked={csvOnly}
          onChange={(event) => onCsvOnlyChange(event.target.checked)}
          type="checkbox"
        />
        CSV set
      </label>
      <label className="links-toggle">
        <input
          checked={linkOnly}
          onChange={(event) => onLinkOnlyChange(event.target.checked)}
          type="checkbox"
        />
        Links
      </label>
      <button
        className="toolbar-button is-primary"
        onClick={onExportJson}
        type="button"
      >
        Export JSON
      </button>
      <button className="toolbar-button" onClick={onExportCsv} type="button">
        CSV
      </button>
      <button className="toolbar-button" onClick={onImportClick} type="button">
        Import
      </button>
      <input
        accept=".csv,text/csv"
        className="sr-only"
        onChange={onFileChange}
        ref={fileInputRef}
        tabIndex={-1}
        type="file"
      />
    </div>
  </div>
);

const csvCell = (value: unknown): string => {
  const stringValue = String(value ?? "");
  const protectedValue = CSV_INJECTION_PATTERN.test(stringValue)
    ? `'${stringValue}`
    : stringValue;
  return `"${protectedValue.replaceAll('"', '""')}"`;
};

const downloadFile = (
  filename: string,
  content: string,
  contentType: string
): void => {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const exportRows = (participants: readonly ShortlistParticipant[]) =>
  participants.map((participant) => ({
    ai_evidence_sources: participant.aiEvidenceSources.join(" | "),
    ai_note: participant.aiNote,
    ai_recommendation: participant.aiRecommendation,
    ai_reviewed_at: participant.aiReviewedAt,
    ai_rubric_version: participant.aiRubricVersion,
    ai_score: participant.aiScore,
    decision: participant.decision,
    email: participant.email,
    full_name: participant.fullName,
    id: participant.id,
    notes: participant.notes,
    score: participant.score,
  }));

const ShortlistPage = ({
  initialLoadError,
  initialParticipants,
}: ShortlistPageProps) => {
  const [participants, setParticipants] =
    useState<ShortlistParticipant[]>(initialParticipants);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [aiRecommendationFilter, setAiRecommendationFilter] =
    useState<AiRecommendationFilter>("all");
  const [decisionFilter, setDecisionFilter] = useState<DecisionFilter>("all");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [sort, setSort] = useState<SortOption>("name");
  const [linkOnly, setLinkOnly] = useState(false);
  const [csvOnly, setCsvOnly] = useState(
    initialParticipants.some((participant) => participant.importedAt !== null)
  );
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(initialLoadError);
  const [notice, setNotice] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initializedDatasetRef = useRef(true);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const noteTimersRef = useRef(
    new Map<string, ReturnType<typeof setTimeout>>()
  );

  const loadParticipants = useCallback(async (): Promise<void> => {
    const response = await fetch("/api/shortlist");
    if (!response.ok) {
      throw new Error("Unable to load pending applicants");
    }
    const data = (await response.json()) as ShortlistResponse;
    setParticipants(data.participants);
    if (!initializedDatasetRef.current) {
      setCsvOnly(
        data.participants.some((participant) => participant.importedAt !== null)
      );
      initializedDatasetRef.current = true;
    }
    setSelectedId(
      (current) =>
        current ??
        (window.innerWidth > 900 ? (data.participants[0]?.id ?? null) : null)
    );
  }, []);

  useEffect(() => {
    let isActive = true;
    const load = async (): Promise<void> => {
      try {
        await loadParticipants();
      } catch {
        if (isActive && initialParticipants.length === 0) {
          setLoadError(
            "The shortlist could not load. Check the local database connection and apply the latest migration."
          );
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };
    load().catch(() => {
      /* empty */
    });
    return () => {
      isActive = false;
    };
  }, [initialParticipants.length, loadParticipants]);

  const filteredParticipants = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const filtered = participants.filter((participant) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        searchableText(participant).includes(normalizedSearch);
      const matchesDecision =
        decisionFilter === "all" ||
        (decisionFilter === "open"
          ? participant.decision === null
          : participant.decision === decisionFilter);
      const matchesAiRecommendation =
        aiRecommendationFilter === "all" ||
        (aiRecommendationFilter === "unreviewed"
          ? participant.aiRecommendation === null
          : participant.aiRecommendation === aiRecommendationFilter);
      return (
        matchesSearch &&
        matchesDecision &&
        matchesAiRecommendation &&
        (!csvOnly || participant.importedAt !== null) &&
        roleMatches(participant.occupationStatuses, roleFilter) &&
        (!linkOnly || participantHasLinks(participant))
      );
    });

    return filtered.toSorted((left, right) => {
      if (sort === "aiScore") {
        return (right.aiScore ?? 0) - (left.aiScore ?? 0);
      }
      if (sort === "score") {
        return (right.score ?? 0) - (left.score ?? 0);
      }
      if (sort === "newest") {
        return right.createdAt.localeCompare(left.createdAt);
      }
      return left.fullName.localeCompare(right.fullName, "es");
    });
  }, [
    aiRecommendationFilter,
    csvOnly,
    decisionFilter,
    linkOnly,
    participants,
    roleFilter,
    search,
    sort,
  ]);

  const scopedParticipants = useMemo(
    () =>
      csvOnly
        ? participants.filter((participant) => participant.importedAt !== null)
        : participants,
    [csvOnly, participants]
  );

  const selectedParticipant =
    selectedId === null
      ? null
      : (filteredParticipants.find(
          (participant) => participant.id === selectedId
        ) ??
        filteredParticipants[0] ??
        null);

  const summary = useMemo(
    () => ({
      aiMaybe: scopedParticipants.filter(
        ({ aiRecommendation }) => aiRecommendation === "maybe"
      ).length,
      aiNo: scopedParticipants.filter(
        ({ aiRecommendation }) => aiRecommendation === "no"
      ).length,
      aiReviewed: scopedParticipants.filter(
        ({ aiRecommendation }) => aiRecommendation !== null
      ).length,
      aiYes: scopedParticipants.filter(
        ({ aiRecommendation }) => aiRecommendation === "yes"
      ).length,
      humanReviewed: scopedParticipants.filter(
        ({ decision, score, notes }) =>
          decision !== null || score !== null || notes.length > 0
      ).length,
      total: scopedParticipants.length,
    }),
    [scopedParticipants]
  );

  const updateParticipant = useCallback(
    (signupId: string, patch: Partial<ReviewPatch>): void => {
      setParticipants((current) =>
        current.map((participant) =>
          participant.id === signupId
            ? { ...participant, ...patch }
            : participant
        )
      );
    },
    []
  );

  const saveReview = useCallback(
    async (signupId: string, patch: Partial<ReviewPatch>): Promise<void> => {
      setSaveState("saving");
      try {
        const response = await fetch("/api/shortlist", {
          body: JSON.stringify({ ...patch, signupId }),
          headers: { "content-type": "application/json" },
          method: "PATCH",
        });
        if (!response.ok) {
          throw new Error("Review save failed");
        }
        const data = (await response.json()) as { updatedAt: string };
        setParticipants((current) =>
          current.map((participant) =>
            participant.id === signupId
              ? { ...participant, updatedAt: data.updatedAt }
              : participant
          )
        );
        setSaveState("saved");
      } catch {
        setSaveState("error");
        setNotice("That change was not saved. Try again.");
      }
    },
    []
  );

  const changeDecision = useCallback(
    (
      participant: ShortlistParticipant,
      decision: ShortlistDecision | null
    ): void => {
      updateParticipant(participant.id, { decision });
      saveReview(participant.id, { decision }).catch(() => {
        /* empty */
      });
    },
    [saveReview, updateParticipant]
  );

  const changeScore = useCallback(
    (participant: ShortlistParticipant, score: number | null): void => {
      updateParticipant(participant.id, { score });
      saveReview(participant.id, { score }).catch(() => {
        /* empty */
      });
    },
    [saveReview, updateParticipant]
  );

  const changeNotes = (
    participant: ShortlistParticipant,
    notes: string
  ): void => {
    updateParticipant(participant.id, { notes });
    setSaveState("saving");
    const existingTimer = noteTimersRef.current.get(participant.id);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    const timer = setTimeout(() => {
      noteTimersRef.current.delete(participant.id);
      saveReview(participant.id, { notes }).catch(() => {
        /* empty */
      });
    }, 600);
    noteTimersRef.current.set(participant.id, timer);
  };

  const flushNotes = (participant: ShortlistParticipant): void => {
    const existingTimer = noteTimersRef.current.get(participant.id);
    if (!existingTimer) {
      return;
    }
    clearTimeout(existingTimer);
    noteTimersRef.current.delete(participant.id);
    saveReview(participant.id, { notes: participant.notes }).catch(() => {
      /* empty */
    });
  };

  useEffect(() => {
    const handleShortcut = (event: globalThis.KeyboardEvent): void => {
      const { target } = event;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement;

      if (event.key === "/" && !isTyping) {
        event.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (isTyping || !selectedParticipant) {
        return;
      }

      if (["y", "m", "n"].includes(event.key.toLowerCase())) {
        const decisionByKey = {
          m: "maybe",
          n: "no",
          y: "yes",
        } as const;
        const decision =
          decisionByKey[event.key.toLowerCase() as "m" | "n" | "y"];
        changeDecision(selectedParticipant, decision);
        return;
      }

      const score = Number(event.key);
      if (SCORES.includes(score as (typeof SCORES)[number])) {
        changeScore(selectedParticipant, score);
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [changeDecision, changeScore, selectedParticipant]);

  const handleFileChange = async (
    event: ChangeEvent<HTMLInputElement>
  ): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    setNotice("Matching CSV to pending applicants…");
    try {
      const response = await fetch("/api/shortlist", {
        body: JSON.stringify({ csvText: await file.text() }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Import failed");
      }
      const result = (await response.json()) as ShortlistImportResponse;
      await loadParticipants();
      setCsvOnly(true);
      setNotice(
        `Matched ${result.matched} of ${result.imported} CSV rows${
          result.unmatched > 0 ? ` · ${result.unmatched} unmatched` : ""
        }.`
      );
    } catch {
      setNotice(
        "The CSV could not be imported. Check that it has an ID or email column."
      );
    }
  };

  const handleExportJson = (): void => {
    downloadFile(
      `hackspain-shortlist-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(exportRows(scopedParticipants), null, 2),
      "application/json"
    );
  };

  const handleExportCsv = (): void => {
    const rows = exportRows(scopedParticipants);
    const headers = [
      "id",
      "full_name",
      "email",
      "ai_recommendation",
      "ai_score",
      "ai_note",
      "ai_evidence_sources",
      "ai_reviewed_at",
      "ai_rubric_version",
      "decision",
      "score",
      "notes",
    ];
    const csvRows = [
      headers.map(csvCell).join(","),
      ...rows.map((row) =>
        [
          row.id,
          row.full_name,
          row.email,
          row.ai_recommendation,
          row.ai_score,
          row.ai_note,
          row.ai_evidence_sources,
          row.ai_reviewed_at,
          row.ai_rubric_version,
          row.decision,
          row.score,
          row.notes,
        ]
          .map(csvCell)
          .join(",")
      ),
    ];
    downloadFile(
      `hackspain-shortlist-${new Date().toISOString().slice(0, 10)}.csv`,
      csvRows.join("\r\n"),
      "text/csv;charset=utf-8"
    );
  };

  if (isLoading) {
    return (
      <main className="shortlist-loading">
        <div className="loading-mark">S</div>
        <p>Loading pending applicants…</p>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="shortlist-error">
        <p className="eyebrow">Local shortlist</p>
        <h1>Dashboard unavailable</h1>
        <p>{loadError}</p>
      </main>
    );
  }

  return (
    <main className="shortlist-app" id="main">
      <header className="shortlist-header">
        <div className="shortlist-brand">
          <h1>Shortlist</h1>
          <span>HackSpain · internal</span>
          <span className="local-badge">Local only</span>
        </div>
        <section aria-label="Shortlist totals" className="summary-pills">
          <span>
            Total <strong>{summary.total}</strong>
          </span>
          <span className="is-yes">
            AI Yes <strong>{summary.aiYes}</strong>
          </span>
          <span className="is-maybe">
            AI Maybe <strong>{summary.aiMaybe}</strong>
          </span>
          <span className="is-no">
            AI No <strong>{summary.aiNo}</strong>
          </span>
          <span>
            AI reviewed <strong>{summary.aiReviewed}</strong>
          </span>
          <span>
            Human touched <strong>{summary.humanReviewed}</strong>
          </span>
        </section>
        <Toolbar
          aiRecommendationFilter={aiRecommendationFilter}
          csvOnly={csvOnly}
          decisionFilter={decisionFilter}
          fileInputRef={fileInputRef}
          linkOnly={linkOnly}
          onAiRecommendationFilterChange={setAiRecommendationFilter}
          onCsvOnlyChange={setCsvOnly}
          onDecisionFilterChange={setDecisionFilter}
          onExportCsv={handleExportCsv}
          onExportJson={handleExportJson}
          onFileChange={(event) =>
            handleFileChange(event).catch(() => {
              /* empty */
            })
          }
          onImportClick={() => fileInputRef.current?.click()}
          onLinkOnlyChange={setLinkOnly}
          onRoleFilterChange={setRoleFilter}
          onSearchChange={setSearch}
          onSortChange={setSort}
          roleFilter={roleFilter}
          search={search}
          searchInputRef={searchInputRef}
          sort={sort}
        />
        {notice && (
          <button
            className="notice-bar"
            onClick={() => setNotice(null)}
            type="button"
          >
            {notice} <span aria-hidden="true">×</span>
          </button>
        )}
      </header>

      <div className="shortlist-workspace">
        <section aria-label="Pending applicants" className="candidate-list">
          <div aria-hidden="true" className="list-header">
            <span>AI pick</span>
            <span>AI score</span>
            <span>Name</span>
            <span>Role / org</span>
            <span>AI note</span>
            <span>Links</span>
          </div>
          <div className="candidate-scroll" role="listbox">
            {filteredParticipants.length > 0 ? (
              filteredParticipants.map((participant) => (
                <CandidateRow
                  isSelected={selectedParticipant?.id === participant.id}
                  key={participant.id}
                  onSelect={() => setSelectedId(participant.id)}
                  participant={participant}
                />
              ))
            ) : (
              <div className="empty-list">
                <strong>No applicants match these filters.</strong>
                <button
                  onClick={() => {
                    setSearch("");
                    setAiRecommendationFilter("all");
                    setDecisionFilter("all");
                    setRoleFilter("all");
                    setLinkOnly(false);
                  }}
                  type="button"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
          <footer className="shortcut-footer">
            <span>
              <kbd>Y</kbd>/<kbd>M</kbd>/<kbd>N</kbd> decide
            </span>
            <span>
              <kbd>1</kbd>–<kbd>5</kbd> score
            </span>
            <span>
              <kbd>/</kbd> search
            </span>
            <span>
              {filteredParticipants.length}/{scopedParticipants.length} shown ·{" "}
              {participants.length} pending
            </span>
          </footer>
        </section>

        <DetailPanel
          onClose={() => setSelectedId(null)}
          onDecision={(decision) =>
            selectedParticipant && changeDecision(selectedParticipant, decision)
          }
          onNotesBlur={() =>
            selectedParticipant && flushNotes(selectedParticipant)
          }
          onNotesChange={(notes) =>
            selectedParticipant && changeNotes(selectedParticipant, notes)
          }
          onScore={(score) =>
            selectedParticipant && changeScore(selectedParticipant, score)
          }
          participant={selectedParticipant}
          saveState={saveState}
        />
      </div>
    </main>
  );
};

export default ShortlistPage;
