"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const PAGE_SIZE = 100;

/**
 * Server-pagination footer (100 rows per page). Links preserve the current
 * query string (category, q, city…) and only swap the `page` param.
 */
export function PaginationBar({
  page,
  pageCount,
  total,
  label = "éléments",
}: {
  page: number;
  pageCount: number;
  total: number;
  label?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (total === 0) return null;

  function hrefFor(p: number) {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("page", String(p));
    return `${pathname}?${sp.toString()}`;
  }

  // Window of numbered pages around the current one.
  const window = 2;
  const pages: Array<number | "…"> = [];
  for (let p = 1; p <= pageCount; p++) {
    if (
      p === 1 ||
      p === pageCount ||
      (p >= page - window && p <= page + window)
    ) {
      pages.push(p);
    } else if (pages[pages.length - 1] !== "…") {
      pages.push("…");
    }
  }

  const start = (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(total, page * PAGE_SIZE);
  const linkCls =
    "inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-[12.5px] font-medium ring-1 ring-inset transition-colors";

  return (
    <nav className="flex flex-wrap items-center gap-2">
      <p className="mr-auto text-[12px] tabular-nums text-faint">
        {start}–{end} sur {total.toLocaleString("fr-FR")} {label} ·{" "}
        {PAGE_SIZE} par page
      </p>
      {page > 1 ? (
        <Link
          href={hrefFor(page - 1)}
          scroll={false}
          className={cn(linkCls, "bg-elev text-mut ring-line hover:text-fg")}
        >
          <ChevronLeft className="size-3.5" /> Précédent
        </Link>
      ) : (
        <span
          aria-disabled
          className={cn(linkCls, "bg-elev text-faint opacity-50 ring-line")}
        >
          <ChevronLeft className="size-3.5" /> Précédent
        </span>
      )}
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} className="px-0.5 text-[12px] text-faint">…</span>
        ) : p === page ? (
          <span
            key={p}
            aria-current="page"
            className={cn(
              linkCls,
              "bg-indigo-600 text-white ring-indigo-600",
            )}
          >
            {p}
          </span>
        ) : (
          <Link
            key={p}
            href={hrefFor(p)}
            scroll={false}
            className={cn(linkCls, "bg-elev text-mut ring-line hover:text-fg")}
          >
            {p}
          </Link>
        ),
      )}
      {page < pageCount ? (
        <Link
          href={hrefFor(page + 1)}
          scroll={false}
          className={cn(linkCls, "bg-elev text-mut ring-line hover:text-fg")}
        >
          Suivant <ChevronRight className="size-3.5" />
        </Link>
      ) : (
        <span
          aria-disabled
          className={cn(linkCls, "bg-elev text-faint opacity-50 ring-line")}
        >
          Suivant <ChevronRight className="size-3.5" />
        </span>
      )}
    </nav>
  );
}
