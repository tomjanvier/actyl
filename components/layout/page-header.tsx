import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type Crumb = { label: string; href?: string };

export function PageHeader({
  crumbs,
  title,
  description,
  actions,
  className,
}: {
  crumbs?: Crumb[];
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-between gap-3 border-b border-line px-6 pb-4 pt-5",
        className,
      )}
    >
      <div className="min-w-0">
        {crumbs && crumbs.length > 0 && (
          <nav className="mb-1 flex items-center gap-1 text-[12px] text-faint">
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="size-3 text-faint" />}
                {c.href ? (
                  <Link
                    href={c.href}
                    className="transition-colors hover:text-mut"
                  >
                    {c.label}
                  </Link>
                ) : (
                  <span className="text-faint">{c.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1 className="truncate text-[19px] font-semibold tracking-tight text-fg">
          {title}
        </h1>
        {description && (
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-faint">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
