"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";

function cx(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

export type Column<T> = {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
};

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  selectedKey,
  emptyTitle = "Sem registros",
  emptyHint,
  className,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  selectedKey?: string | null;
  emptyTitle?: string;
  emptyHint?: string;
  className?: string;
}) {
  return (
    <Card className={cx("overflow-hidden", className)}>
      <div className="w-full overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="border-b">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cx("px-4 py-3 text-left font-medium text-muted-foreground", c.headerClassName)}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-10" colSpan={columns.length}>
                  <div className="text-center">
                    <div className="font-medium">{emptyTitle}</div>
                    {emptyHint ? <div className="mt-1 text-xs text-muted-foreground">{emptyHint}</div> : null}
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const clickable = Boolean(onRowClick);
                const key = rowKey(r);
                const selected = selectedKey != null && key === selectedKey;
                return (
                  <tr
                    key={key}
                    className={cx(
                      "border-b last:border-b-0 transition-colors",
                      clickable && "cursor-pointer hover:bg-muted/40",
                      selected && "bg-blue-50 hover:bg-blue-50/80",
                    )}
                    onClick={clickable ? () => onRowClick?.(r) : undefined}
                  >
                    {columns.map((c) => (
                      <td key={c.key} className={cx("px-4 py-3 align-middle", c.className)}>
                        {c.cell(r)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
