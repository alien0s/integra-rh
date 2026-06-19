import type { ReactNode } from "react";

export interface KpiCardProps {
  icon?: ReactNode;
  label: string;
  value: string;
  caption?: string;
}

export function KpiCard({ icon, label, value, caption }: KpiCardProps) {
  return (
    <article className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-normal text-card-foreground">
            {value}
          </p>
        </div>
        {icon ? (
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            {icon}
          </div>
        ) : null}
      </div>
      {caption ? (
        <p className="mt-3 text-xs font-medium text-muted-foreground">{caption}</p>
      ) : null}
    </article>
  );
}
