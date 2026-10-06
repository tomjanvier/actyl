import * as React from "react";
import { cn } from "@/lib/utils";

export { Badge, EntityAvatar } from "@/components/ui/badge";

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "crm-surface rounded-xl",
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1 p-4", className)} {...props} />;
}

function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3 className={cn("text-[14px] font-semibold text-fg", className)} {...props} />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-[12.5px] text-faint", className)} {...props} />;
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-4 pt-0", className)} {...props} />;
}

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div className="w-full overflow-x-auto">
      <table
        className={cn("w-full caption-bottom border-collapse text-[13px]", className)}
        {...props}
      />
    </div>
  );
}

function THead({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      className={cn(
        "sticky top-0 z-10 bg-card/95 [&_th]:h-10 [&_th]:border-b [&_th]:border-line [&_th]:px-3 [&_th]:text-left [&_th]:align-middle [&_th]:text-[11px] [&_th]:font-semibold [&_th]:tracking-normal [&_th]:text-faint",
        className,
      )}
      {...props}
    />
  );
}

function TBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      className={cn(
        "[&_tr]:border-b [&_tr]:border-line [&_tr:last-child]:border-0 [&_td]:h-[48px] [&_td]:max-w-[280px] [&_td]:truncate [&_td]:px-3 [&_td]:align-middle [&_td]:text-mut",
        "[&_tr:hover]:bg-hover [&_tr]:transition-colors",
        className,
      )}
      {...props}
    />
  );
}

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-elev", className)}
      {...props}
    />
  );
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-transparent px-6 py-14 text-center">
      <div className="mb-1 flex size-11 items-center justify-center rounded-xl bg-elev text-faint ring-1 ring-inset ring-line">
        {icon}
      </div>
      <p className="text-[14px] font-medium text-fg">{title}</p>
      {description && (
        <p className="max-w-md text-[13px] leading-relaxed text-faint">{description}</p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

function StatCard({
  label,
  value,
  suffix,
  hint,
  icon,
  progress,
}: {
  label: string;
  value: React.ReactNode;
  /** Secondary figure rendered after the value, e.g. « / 1 200 ». */
  suffix?: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  /** 0–1. Replaces the block with a bar plus its percentage. */
  progress?: number;
}) {
  return (
    <Card className="p-4">
      <p className="crm-kicker flex items-center gap-1.5">
        {icon}
        {label}
      </p>
      <p className="mt-1.5 flex items-baseline gap-1.5 text-[24px] font-semibold tracking-[-0.02em] tabular-nums text-fg">
        {value}
        {suffix && (
          <span className="text-[13px] font-normal text-mut">{suffix}</span>
        )}
      </p>
      {progress !== undefined && (
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-hover">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent to-accent-hover"
              style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
            />
          </div>
          <span className="text-[11.5px] tabular-nums text-faint">
            {Math.round(progress * 100)}%
          </span>
        </div>
      )}
      {hint && <p className="mt-1 text-[12px] text-faint">{hint}</p>}
    </Card>
  );
}

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Table,
  THead,
  TBody,
  Skeleton,
  EmptyState,
  StatCard,
};
