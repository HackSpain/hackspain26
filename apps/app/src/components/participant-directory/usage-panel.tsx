"use client";

import { useEffect, useState } from "react";
import { compact, HARNESSES } from "@/app/insights/mock-data";
import { LoadingText } from "@/components/page";
import { HARNESS_ICONS } from "@/lib/tv-icons";

type HarnessRow = {
  harness: string;
  requests: number;
  tokens: number;
};

type ModelRow = {
  family: string;
  name: string;
  requests: number;
  tokens: number;
};

type UsagePayload = {
  harnesses: HarnessRow[];
  models: ModelRow[];
  status: "ok" | "empty" | "unconfigured" | "unscheduled";
};

function harnessMeta(id: string) {
  return HARNESSES.find((item) => item.id === id);
}

function HarnessMark({ id }: { id: string }) {
  const meta = harnessMeta(id);
  const icon = HARNESS_ICONS[id];
  if (icon) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- generated brand marks, not user photos.
      <img src={icon} alt="" className="size-5 object-contain" />
    );
  }
  return (
    <span
      className="grid size-5 place-items-center font-mono text-[9px] font-bold"
      style={{ color: meta?.color ?? "#4a2c1f" }}
      aria-hidden
    >
      {meta?.mark ?? id.slice(0, 2)}
    </span>
  );
}

export function UsagePanel({ userId }: { userId: string }) {
  const [result, setResult] = useState<{
    failed?: boolean;
    payload?: UsagePayload;
    userId: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/directory/usage?userId=${encodeURIComponent(userId)}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Uso no disponible.");
        }
        return (await response.json()) as UsagePayload;
      })
      .then((payload) => {
        if (!cancelled) {
          setResult({ payload, userId });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResult({ failed: true, userId });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const data = result?.userId === userId ? result.payload : undefined;
  const failed = result?.userId === userId && result.failed === true;

  if (failed) {
    return (
      <section className="space-y-3">
        <h3 className="font-bungee text-sm uppercase">IA</h3>
        <p className="text-sm text-hs-brown">Uso no disponible.</p>
      </section>
    );
  }
  if (data === undefined) {
    return (
      <section className="space-y-3">
        <h3 className="font-bungee text-sm uppercase">IA</h3>
        <LoadingText />
      </section>
    );
  }
  if (
    data.status !== "ok" ||
    (data.harnesses.length === 0 && data.models.length === 0)
  ) {
    return null;
  }

  const harnessTotal = data.harnesses.reduce((sum, row) => sum + row.tokens, 0);

  return (
    <section className="space-y-4">
      <h3 className="font-bungee text-sm uppercase">IA</h3>
      {data.harnesses.length ? (
        <div className="space-y-2">
          <p className="font-bungee text-xs">Harnesses</p>
          <ul className="grid gap-2">
            {data.harnesses.map((row) => {
              const meta = harnessMeta(row.harness);
              const pct =
                harnessTotal > 0
                  ? Math.round((row.tokens / harnessTotal) * 100)
                  : 0;
              return (
                <li key={row.harness}>
                  <div className="flex items-center gap-2 text-sm">
                    <HarnessMark id={row.harness} />
                    <span className="min-w-0 flex-1 font-medium">
                      {meta?.name ?? row.harness}
                    </span>
                    <span className="tabular-nums text-hs-brown">
                      {compact(row.tokens)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 bg-hs-sand">
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
      {data.models.length ? (
        <div className="space-y-2">
          <p className="font-bungee text-xs">Modelos</p>
          <ul className="grid gap-1.5">
            {data.models.map((row) => (
              <li
                key={row.name}
                className="flex items-baseline justify-between gap-3 text-sm"
              >
                <span className="min-w-0 truncate font-medium">{row.name}</span>
                <span className="shrink-0 tabular-nums text-hs-brown">
                  {compact(row.tokens)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
