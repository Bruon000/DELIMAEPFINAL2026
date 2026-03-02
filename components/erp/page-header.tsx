"use client";

import * as React from "react";

function cx(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

export function PageHeader({
  title,
  subtitle,
  actions,
  meta,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {meta ? <div className="shrink-0">{meta}</div> : null}
        </div>
        {subtitle ? (
          <p className={cx("mt-1 text-sm text-muted-foreground", "max-w-[72ch]")}>{subtitle}</p>
        ) : null}
      </div>

      {actions ? <div className="shrink-0 flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
