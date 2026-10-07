"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { cn, fullName, toCSV, downloadFile } from "@/lib/utils";
import { LEVELS, LEVEL_META, STANCE_META } from "@/lib/constants";
import { EntityAvatar } from "@/components/ui/badge";
import { FilterSelect, SearchField } from "@/components/ui/filter-bar";

type EmbedRow = {
  id: string;
  firstName: string;
  lastName: string;
  title: string | null;
  institution: string | null;
  party: string | null;
  region: string | null;
  level: string;
  stance: string;
  photoUrl: string | null;
  themes: string | null;
};

type DirectoryPage = { rows: EmbedRow[]; total: number; page: number; parties: string[]; institutions: string[] };

export function EmbedListTable({
  listName,
  description,
  rows,
  pageSize = 1000,
  listId,
  initialPage,
}: {
  listName: string;
  description: string | null;
  rows: EmbedRow[];
  pageSize?: number;
  listId?: string;
  initialPage?: DirectoryPage;
}) {
  const [query, setQuery] = useState("");
  const [levelF, setLevelF] = useState("");
  const [partyF, setPartyF] = useState("");
  const [institutionF, setInstitutionF] = useState("");
  const [page, setPage] = useState(1);

  const [remote, setRemote] = useState(initialPage);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const searchParams = new URLSearchParams({ page: String(page), pageSize: String(pageSize), q: query, level: levelF, party: partyF, institution: institutionF });
  const requestKey = searchParams.toString();
  useEffect(() => {
    if (!listId) return;
    if (page === 1 && !query && !levelF && !partyF && !institutionF) {
      setRemote(initialPage);
      setLoading(false);
      setError("");
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/public/lists/${encodeURIComponent(listId)}?${requestKey}`, { signal: controller.signal });
        if (!response.ok) throw new Error("L’annuaire est temporairement indisponible.");
        const result: DirectoryPage = await response.json();
        if (!controller.signal.aborted) setRemote(result);
      } catch (error) {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Chargement impossible.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [listId, requestKey, initialPage, page, query, levelF, partyF, institutionF]);

  const localParties = useMemo(
    () => [...new Set(rows.map((r) => r.party).filter(Boolean))] as string[],
    [rows],
  );
  const localInstitutions = useMemo(
    () =>
      [...new Set(rows.map((r) => r.institution).filter(Boolean))].sort() as string[],
    [rows],
  );

  const parties = remote?.parties ?? localParties;
  const institutions = remote?.institutions ?? localInstitutions;
  const filtered = rows.filter((r) => {
    if (levelF && r.level !== levelF) return false;
    if (partyF && r.party !== partyF) return false;
    if (institutionF && r.institution !== institutionF) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return `${r.firstName} ${r.lastName} ${r.title ?? ""} ${r.party ?? ""} ${r.themes ?? ""}`
      .toLowerCase()
      .includes(q);
  });
  const total = listId ? remote?.total ?? 0 : filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = listId ? remote?.page ?? 1 : Math.min(page, pageCount);
  const pageRows = listId ? remote?.rows ?? [] : filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function resetPage(action: () => void) {
    action();
    setPage(1);
  }

  function exportCsv() {
    if (listId) {
      window.location.assign(`/api/public/lists/${encodeURIComponent(listId)}?${requestKey}&format=csv`);
      return;
    }
    const csv = toCSV(
      filtered.map((r) => ({
        prenom: r.firstName,
        nom: r.lastName,
        fonction: r.title ?? "",
        institution: r.institution ?? "",
        parti: r.party ?? "",
        region: r.region ?? "",
      })),
    );
    downloadFile("\uFEFF" + csv, `${listName}.csv`, "text/csv");
  }

  return (
    <div className="crm-surface rounded-xl">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5">
        <h1 className="mr-2 truncate text-[13.5px] font-semibold text-fg">
          {listName}
          <span className="ml-2 font-normal text-faint tabular-nums">({total})</span>
        </h1>
        {description && (
          <p className="hidden max-w-xs truncate text-[11.5px] text-faint md:block">
            {description}
          </p>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <SearchField
            value={query}
            onValueChange={(value) => resetPage(() => setQuery(value))}
            placeholder="Rechercher…"
            size="sm"
            width="w-36"
          />
          <FilterSelect
            size="sm"
            value={levelF}
            onChange={(e) => resetPage(() => setLevelF(e.target.value))}
            active={!!levelF}
            aria-label="Filtrer par niveau"
          >
            <option value="">Niveau</option>
            {LEVELS.map((l) => (
              <option key={l} value={l}>{LEVEL_META[l].label}</option>
            ))}
          </FilterSelect>
          {parties.length > 0 && (
            <FilterSelect
              size="sm"
              value={partyF}
              onChange={(e) => resetPage(() => setPartyF(e.target.value))}
              active={!!partyF}
              aria-label="Filtrer par parti"
            >
              <option value="">Parti</option>
              {parties.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </FilterSelect>
          )}
          {institutions.length > 1 && (
            <FilterSelect
              size="sm"
              value={institutionF}
              onChange={(e) => resetPage(() => setInstitutionF(e.target.value))}
              active={!!institutionF}
              aria-label="Filtrer par institution"
            >
              <option value="">Institution</option>
              {institutions.map((i) => (
                <option key={i} value={i}>{i}</option>
              ))}
            </FilterSelect>
          )}
          <button
            disabled={loading || !!error}
            onClick={exportCsv}
            title="Exporter en CSV"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-[12px] text-mut transition-colors hover:border-accent-ring hover:text-accent-text"
          >
            <Download className="size-3.5" /> CSV
          </button>
        </div>
      </div>

      <p className="px-3 text-sm text-mut" role="status">{loading ? "Chargement…" : error}</p>
      <ul aria-busy={loading}>
        {pageRows.map((r) => {
          const stance = STANCE_META[r.stance as keyof typeof STANCE_META];
          return (
            <li
              key={r.id}
              className="flex items-center gap-3 border-b border-linesoft px-3 py-2 last:border-0 hover:bg-hover"
            >
              <EntityAvatar name={fullName(r)} size="sm" photoUrl={r.photoUrl} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-medium text-fg">{fullName(r)}</p>
                <p className="truncate text-[11px] text-faint">
                  {[r.title, r.party].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              <span className="hidden w-32 truncate text-right text-[11px] text-faint sm:block">
                {r.region ?? ""}
              </span>
              {stance && (
                <span
                  title={stance.label}
                  className={cn("size-2 shrink-0 rounded-full", stance.dot)}
                />
              )}
            </li>
          );
        })}
        {total === 0 && (
          <li className="px-4 py-8 text-center text-[12.5px] text-faint">
            Aucun contact ne correspond à ces filtres.
          </li>
        )}
      </ul>
      {total > 0 && pageSize < total && (
        <nav aria-label="Pagination de la liste" className="flex items-center justify-between border-t border-line px-3 py-2">
          <p className="text-[12px] text-mut" aria-live="polite">
            {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, total)} sur {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Page précédente"
              disabled={loading || currentPage === 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className="inline-flex size-9 items-center justify-center rounded-md border border-line text-mut hover:bg-hover disabled:cursor-not-allowed disabled:opacity-45"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="min-w-16 text-center text-[12px] text-mut">Page {currentPage} / {pageCount}</span>
            <button
              type="button"
              aria-label="Page suivante"
              disabled={loading || currentPage === pageCount}
              onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
              className="inline-flex size-9 items-center justify-center rounded-md border border-line text-mut hover:bg-hover disabled:cursor-not-allowed disabled:opacity-45"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
