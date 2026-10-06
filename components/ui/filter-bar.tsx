"use client";

import * as React from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The one search field of the platform: an inset well, a leading magnifier, a
 * real clear affordance and an optional shortcut hint. Every list view reuses
 * it so search reads the same whether it sits above contacts or signatories.
 */
function SearchField({
  value,
  onValueChange,
  placeholder = "Rechercher…",
  label,
  hint,
  size = "md",
  width = "w-full sm:w-72",
  className,
  inputClassName,
  ...props
}: Omit<React.ComponentProps<"input">, "value" | "onChange" | "size"> & {
  value: string;
  onValueChange: (value: string) => void;
  label?: string;
  /** Shortcut rendered on the right while the field is empty. */
  hint?: string;
  /** `md` follows the toolbar height, `sm` the compact embed tables. */
  size?: "sm" | "md";
  width?: string;
  inputClassName?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  return (
    <div className={cn("relative min-w-0", width, className)}>
      <Search
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-faint"
      />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label ?? placeholder}
        className={cn(
          "peer w-full min-w-0 rounded-lg border border-line bg-elev pl-9 pr-9 text-[13px] text-fg",
          "outline-none transition-[border-color,box-shadow,background-color]",
          "placeholder:text-faint hover:border-hoverstrong",
          "focus:border-accent focus:bg-card focus:shadow-[0_0_0_3px_var(--accent-soft)]",
          "[&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden",
          // 44px on touch, 36px in the toolbar.
          size === "sm" ? "h-11 sm:h-8" : "h-11 sm:h-9",
          inputClassName,
        )}
        {...props}
      />
      {value ? (
        <button
          type="button"
          onClick={() => {
            onValueChange("");
            inputRef.current?.focus();
          }}
          aria-label="Effacer la recherche"
          className="absolute right-2 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-md text-faint transition-colors hover:bg-hoverstrong hover:text-fg"
        >
          <X className="size-3.5" />
        </button>
      ) : hint ? (
        <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-line px-1.5 py-0.5 font-mono text-[10px] text-faint sm:block">
          {hint}
        </kbd>
      ) : null}
    </div>
  );
}

/** Native select wearing the same well as the search field. */
function FilterSelect({
  className,
  size = "md",
  active = false,
  children,
  ...props
}: Omit<React.ComponentProps<"select">, "size"> & {
  size?: "sm" | "md";
  active?: boolean;
}) {
  return (
    <span className="relative inline-flex min-w-0 items-center">
      <select
        {...props}
        className={cn(
          "w-full min-w-0 appearance-none rounded-lg border bg-elev pl-3 pr-8 text-[12.5px] outline-none",
          "transition-[border-color,box-shadow,color] [&>option]:bg-raised [&>option]:text-fg",
          active
            ? "border-accent-ring text-accent-text"
            : "border-line text-mut hover:border-hoverstrong",
          "focus:border-accent focus:text-fg focus:shadow-[0_0_0_3px_var(--accent-soft)]",
          // 44px on touch keeps the native control usable with a thumb.
          size === "sm" ? "h-11 sm:h-8" : "h-11 sm:h-9",
          className,
        )}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-2.5 size-3.5 text-faint"
      />
    </span>
  );
}

/** Row that carries the search field, the filters and the row actions. */
function FilterBar({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 border-b border-line bg-card/70 px-4 py-3 sm:px-7",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export { SearchField, FilterSelect, FilterBar };