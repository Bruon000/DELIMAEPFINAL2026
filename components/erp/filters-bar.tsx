"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function cx(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

export type FilterChip = { label: string; onClear: () => void };

export function FiltersBar({
  search,
  onSearchChange,
  placeholder = "Buscar...",
  leftSlot,
  rightSlot,
  chips,
  onClearAll,
  className,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  placeholder?: string;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  chips?: FilterChip[];
  onClearAll?: () => void;
  className?: string;
}) {
  const hasChips = (chips?.length ?? 0) > 0;

  return (
    <Card className={cx("p-3", className)}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-2 lg:flex-row lg:items-center">
          <div className="w-full lg:max-w-sm">
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={placeholder}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">{leftSlot}</div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {hasChips && onClearAll ? (
            <Button variant="ghost" onClick={onClearAll}>
              Limpar filtros
            </Button>
          ) : null}
          {rightSlot}
        </div>
      </div>

      {hasChips ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {chips!.map((c, i) => (
            <button
              key={i}
              onClick={c.onClear}
              className="inline-flex items-center gap-2 rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
              type="button"
              title="Remover filtro"
            >
              <span>{c.label}</span>
              <span className="text-xs">×</span>
            </button>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
