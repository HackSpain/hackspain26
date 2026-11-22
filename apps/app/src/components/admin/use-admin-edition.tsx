"use client";

import { useQuery } from "convex/react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

export const ADMIN_EDITION_KEY = "hackspain.admin.edition";
const EDITION_EVENT = "hackspain-admin-edition";

export type AdminEdition = {
  _id: Id<"editions">;
  current: boolean;
  label: string;
  slug: string;
};

type AdminEditionValue = {
  editionId: Id<"editions"> | undefined;
  editions: AdminEdition[];
  isCurrent: boolean;
  ready: boolean;
  selected: AdminEdition | undefined;
  select: (slug: string) => void;
};

const AdminEditionContext = createContext<AdminEditionValue | null>(null);

function readStoredSlug(): string | null {
  try {
    return window.localStorage.getItem(ADMIN_EDITION_KEY);
  } catch {
    return null;
  }
}

function writeStoredSlug(slug: string): void {
  try {
    window.localStorage.setItem(ADMIN_EDITION_KEY, slug);
  } catch {
    // Private mode; the select still updates this tab.
  }
}

function subscribeToEdition(onStoreChange: () => void): () => void {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(EDITION_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(EDITION_EVENT, onStoreChange);
  };
}

export function AdminEditionProvider({ children }: { children: ReactNode }) {
  const editions = useQuery(api.editions.list);
  const slug = useSyncExternalStore(
    subscribeToEdition,
    readStoredSlug,
    () => null
  );

  const select = useCallback((next: string) => {
    writeStoredSlug(next);
    window.dispatchEvent(new Event(EDITION_EVENT));
  }, []);

  const value = useMemo<AdminEditionValue>(() => {
    const list = editions ?? [];
    const current = list.find((edition) => edition.current);
    const selected = list.find((edition) => edition.slug === slug) ?? current;
    return {
      editionId: selected?._id,
      editions: list,
      isCurrent: selected?.current === true,
      ready: editions !== undefined,
      selected,
      select,
    };
  }, [editions, select, slug]);

  return (
    <AdminEditionContext.Provider value={value}>
      {children}
    </AdminEditionContext.Provider>
  );
}

export function useAdminEdition(): AdminEditionValue {
  const value = useContext(AdminEditionContext);
  if (!value) {
    throw new Error("useAdminEdition requires the admin layout");
  }
  return value;
}

export function useAdminEditionArgs(): { editionId: Id<"editions"> } | "skip" {
  const { editionId, ready } = useAdminEdition();
  return ready && editionId ? { editionId } : "skip";
}
