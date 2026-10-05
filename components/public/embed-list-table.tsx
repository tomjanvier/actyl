"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import { cn, fullName, toCSV, downloadFile } from "@/lib/utils";
import { LEVELS, LEVEL_META, STANCE_META } from "@/lib/constants";
import { EntityAvatar } from "@/components/ui/badge";

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

export function EmbedListTable({
  listName,
  description,
  rows,
  pageSize = 1000,
}: {
  listName: string;
  description: string | null;
  rows: EmbedRow[];
  pageSize?: number;
}) {
  const [query, setQuery] = useState("");
  const [levelF, setLevelF] = useState("");
  const [partyF, setPartyF] = useState("");
  const [institutionF, setInstitutionF] = useState("");
  const [page, setPage] = useState(1);

  const parties = useMemo(
    () => [...new Set(rows.map((r) => r.party).filter(Boolean))] as string[],
    [rows],
  );
  const institutions = useMemo(
    () =>
      [...new Set(rows.map((r) => r.institution).filter(Boolean))].sort() as string[],
    [rows],
  );

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
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function resetPage(action: () => void) {
    action();
    setPage(1);
  }

  function exportCsv() {
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

  const selCls =
    "h-8 rounded-lg border border-line bg-elev px-2 text-[12px] text-fg outline-none [&>option]:bg-raised";

  return (
    <div className="rounded-xl border border-line bg-raised">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5">
        <h1 className="mr-2 truncate text-[13.5px] font-semibold text-fg">
          {listName}
          <span className="ml-2 font-normal text-faint tabular-nums">({filtered.length})</span>
        </h1>
        {description && (
          <p className="hidden max-w-xs truncate text-[11.5px] text-faint md:block">
            {description}
          </p>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
            <input
              value={query}
              onChange={(e) => resetPage(() => setQuery(e.target.value))}
              placeholder="Rechercher…"
              className="h-8 w-36 rounded-lg border border-line bg-elev pl-7 pr-2 text-[12px] text-fg outline-none focus:border-coral-500/60"
            />
          </div>
          <select value={levelF} onChange={(e) => resetPage(() => setLevelF(e.target.value))} className={cn(selCls, levelF && "border-coral-500/40")}>
            <option value="">Niveau</option>
            {LEVELS.map((l) => (
              <option key={l} value={l}>{LEVEL_META[l].label}</option>
            ))}
          </select>
          {parties.length > 0 && (
            <select value={partyF} onChange={(e) => resetPage(() => setPartyF(e.target.value))} className={cn(selCls, partyF && "border-coral-500/40")}>
              <option value="">Parti</option>
              {parties.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          )}
          {institutions.length > 1 && (
            <select value={institutionF} onChange={(e) => resetPage(() => setInstitutionF(e.target.value))} className={cn(selCls, institutionF && "border-coral-500/40")}>
              <option value="">Institution</option>
              {institutions.map((i) => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
          )}
          <button
            onClick={exportCsv}
            title="Exporter en CSV"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-[12px] text-mut transition-colors hover:border-coral-500/50 hover:text-coral-700 dark:hover:text-coral-400"
          >
            <Download className="size-3.5" /> CSV
          </button>
        </div>
      </div>

      <ul>
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
        {filtered.length === 0 && (
          <li className="px-4 py-8 text-center text-[12.5px] text-faint">
            Aucun contact ne correspond à ces filtres.
          </li>
        )}
      </ul>
      {filtered.length > 0 && pageSize < filtered.length && (
        <nav aria-label="Pagination de la liste" className="flex items-center justify-between border-t border-line px-3 py-2">
          <p className="text-[12px] text-mut" aria-live="polite">
            {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} sur {filtered.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Page précédente"
              disabled={currentPage === 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className="inline-flex size-9 items-center justify-center rounded-md border border-line text-mut hover:bg-hover disabled:cursor-not-allowed disabled:opacity-45"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="min-w-16 text-center text-[12px] text-mut">Page {currentPage} / {pageCount}</span>
            <button
              type="button"
              aria-label="Page suivante"
              disabled={currentPage === pageCount}
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
