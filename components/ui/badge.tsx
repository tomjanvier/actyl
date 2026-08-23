import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn, initials } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "bg-elev text-mut ring-line",
        outline: "bg-transparent text-mut ring-line",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

const avatarColorMap: Record<string, string> = {
  slate: "bg-slate-600",
  indigo: "bg-indigo-600",
  emerald: "bg-emerald-600",
  amber: "bg-amber-600",
  rose: "bg-rose-600",
  violet: "bg-violet-600",
  sky: "bg-sky-600",
  teal: "bg-teal-600",
  orange: "bg-orange-600",
  fuchsia: "bg-fuchsia-600",
};

function EntityAvatar({
  name,
  color = "indigo",
  size = "md",
  emoji,
  photoUrl,
  className,
}: {
  name: string;
  color?: string;
  size?: "sm" | "md" | "lg" | "xl";
  emoji?: string | null;
  photoUrl?: string | null;
  className?: string;
}) {
  const sizes = {
    sm: "size-6 text-[10px]",
    md: "size-8 text-xs",
    lg: "size-10 text-sm",
    xl: "size-14 text-xl",
  };
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={name}
        loading="lazy"
        referrerPolicy="no-referrer"
        className={cn(
          "inline-flex shrink-0 select-none items-center justify-center rounded-lg object-cover ring-1 ring-inset ring-white/10 dark:ring-white/10",
          sizes[size],
          className,
        )}
      />
    );
  }
  if (emoji) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-lg bg-elev ring-1 ring-inset ring-line",
          sizes[size],
          className,
        )}
      >
        {emoji}
      </span>
    );
  }
  return (
    <span
      title={name}
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-lg font-medium text-white ring-1 ring-inset ring-white/10",
        avatarColorMap[color] ?? avatarColorMap.indigo,
        sizes[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

export { Badge, badgeVariants, EntityAvatar };
