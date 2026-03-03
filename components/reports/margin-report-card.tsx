"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function fmtMoney(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function MarginReportCard() {
  const [data, setData] = React.useState<any>(null);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/reports/margins")
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error ?? "Erro ao carregar");
        return j;
      })
      .then(setData)
      .catch((e) => setErr(e?.message ?? "Erro"));
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lucratividade por produto (BOM)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {err && <div className="text-sm text-muted-foreground">{err}</div>}
        {!data && !err && <div className="text-sm text-muted-foreground">Carregando...</div>}

        {data && (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-sm font-medium mb-2">Top margem (%)</div>
              <div className="space-y-2">
                {(data.topMarginPct ?? []).map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between border rounded p-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{r.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Venda {fmtMoney(r.salePrice)} · Custo {fmtMoney(r.costPrice)}
                      </div>
                    </div>
                    <div className="text-sm font-semibold">{r.marginPct}%</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-sm font-medium mb-2">Pior margem (%)</div>
              <div className="space-y-2">
                {(data.worstMarginPct ?? []).map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between border rounded p-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{r.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Venda {fmtMoney(r.salePrice)} · Custo {fmtMoney(r.costPrice)}
                      </div>
                    </div>
                    <div className="text-sm font-semibold">{r.marginPct}%</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          Dica: mantenha o custo atualizado em <Link className="underline" href="/cadastros/produtos">Produtos</Link> (botão “Recalcular custo (BOM)”).
        </div>
      </CardContent>
    </Card>
  );
}
