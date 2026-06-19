import type { ReactNode } from "react";

export type StatusBadgeTone = "success" | "warning" | "danger" | "neutral";

export interface StatusBadgeProps {
  children: ReactNode;
  tone?: StatusBadgeTone;
}

const toneClasses: Record<StatusBadgeTone, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-red-200 bg-red-50 text-red-700",
  neutral: "border-slate-200 bg-slate-50 text-slate-700"
};

export function StatusBadge({ children, tone = "neutral" }: StatusBadgeProps) {
  return (
    <span
      className={[
        "inline-flex w-fit items-center rounded-md border px-2.5 py-1 text-xs font-semibold",
        toneClasses[tone]
      ].join(" ")}
    >
      {children}
    </span>
  );
}
