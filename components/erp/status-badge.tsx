"use client";

import * as React from "react";

type Variant = "neutral" | "info" | "success" | "warning" | "danger";

function cx(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

function variantClasses(v: Variant) {
  switch (v) {
    case "info":
      return "bg-blue-50 text-blue-800 border-blue-200";
    case "success":
      return "bg-emerald-50 text-emerald-800 border-emerald-200";
    case "warning":
      return "bg-amber-50 text-amber-900 border-amber-200";
    case "danger":
      return "bg-red-50 text-red-800 border-red-200";
    default:
      return "bg-zinc-50 text-zinc-800 border-zinc-200";
  }
}

export function StatusBadge({
  label,
  variant = "neutral",
  size = "sm",
}: {
  label: string;
  variant?: Variant;
  size?: "sm" | "md";
}) {
  const base = "inline-flex items-center rounded-md border font-medium";
  const pad = size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-xs";
  return <span className={cx(base, pad, variantClasses(variant))}>{label}</span>;
}

export function PurchaseOrderStatusBadge({ status }: { status: string }) {
  const s = String(status || "").toUpperCase();
  if (s === "SENT") return <StatusBadge label="ENVIADO" variant="info" />;
  if (s === "RECEIVED") return <StatusBadge label="RECEBIDO" variant="success" />;
  if (s === "CANCELED") return <StatusBadge label="CANCELADO" variant="danger" />;
  return <StatusBadge label="RASCUNHO" variant="neutral" />;
}
