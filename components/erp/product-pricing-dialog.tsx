"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  product: { id: string; name: string; salePrice?: any; costPrice?: any; type?: any };
  pricing: any;
  setPricing: (next: any) => void;
  onSuggest: (payload: any) => Promise<{ suggestedSalePrice?: number }>;
  onApply: (salePrice: number) => Promise<void>;
  onSaveRule: (payload: any) => Promise<void>;
  onLoadRule: () => Promise<any | null>;
  onClearRule: () => Promise<void>;
};

export function ProductPricingDialog(props: Props) {
  const { open, onOpenChange, product } = props;
  const cfg = props.pricing ?? {};

  const mode = cfg.mode ?? "MARGIN";
  const rounding = cfg.rounding ?? "R99";
  const overheadPercent = Number(cfg.overheadPercent ?? 0);
  const feesPercent = Number(cfg.feesPercent ?? 0);
  const marginPercent = Number(cfg.marginPercent ?? 30);
  const markupPercent = Number(cfg.markupPercent ?? 0);

  const set = (patch: any) => props.setPricing({ ...(props.pricing ?? {}), ...patch });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Precificação — {product.name}</DialogTitle>
          <DialogDescription>
            Regra premium: calcula preço sugerido a partir do custo (BOM) + percentuais. Você pode aplicar o preço sugerido no produto.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Modo</Label>
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={mode} onChange={(e) => set({ mode: e.target.value })}>
                <option value="MARGIN">MARGIN (margem % sobre preço final)</option>
                <option value="MARKUP">MARKUP (% sobre custo)</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label>Arredondamento</Label>
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={rounding} onChange={(e) => set({ rounding: e.target.value })}>
                <option value="R99">.99</option>
                <option value="R05">0,50</option>
                <option value="NONE">Normal (2 casas)</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label>Overhead (%)</Label>
              <Input type="number" step="0.01" value={overheadPercent} onChange={(e) => set({ overheadPercent: Number(e.target.value) })} />
              <div className="text-xs text-muted-foreground">Custos indiretos antes do cálculo (energia, produção, etc.).</div>
            </div>

            <div className="space-y-1">
              <Label>Fees (%)</Label>
              <Input type="number" step="0.01" value={feesPercent} onChange={(e) => set({ feesPercent: Number(e.target.value) })} />
              <div className="text-xs text-muted-foreground">Taxas antes do cálculo (cartão, marketplace, etc.).</div>
            </div>

            {mode === "MARGIN" ? (
              <div className="space-y-1 md:col-span-2">
                <Label>Margem (%)</Label>
                <Input type="number" step="0.01" value={marginPercent} onChange={(e) => set({ marginPercent: Number(e.target.value) })} />
                <div className="text-xs text-muted-foreground">Ex.: 30% ⇒ preço = custo / (1 - 0,30)</div>
              </div>
            ) : (
              <div className="space-y-1 md:col-span-2">
                <Label>Markup (%)</Label>
                <Input type="number" step="0.01" value={markupPercent} onChange={(e) => set({ markupPercent: Number(e.target.value) })} />
                <div className="text-xs text-muted-foreground">Ex.: 45% ⇒ preço = custo × (1 + 0,45)</div>
              </div>
            )}
          </div>

          <div className="rounded-md border p-3 text-sm space-y-1">
            <div><b>Preço atual:</b> R$ {Number(product.salePrice ?? 0).toFixed(2)}</div>
            <div><b>Custo atual:</b> R$ {Number(product.costPrice ?? 0).toFixed(2)} (recalc via BOM se necessário)</div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>

          <Button
            variant="outline"
            onClick={async () => {
              try {
                const rule = await props.onLoadRule();
                if (!rule) return toast.message("Sem regra salva.");
                props.setPricing({
                  mode: rule.mode,
                  rounding: rule.rounding,
                  overheadPercent: Number(rule.overheadPercent ?? 0),
                  feesPercent: Number(rule.feesPercent ?? 0),
                  marginPercent: Number(rule.marginPercent ?? 30),
                  markupPercent: Number(rule.markupPercent ?? 0),
                });
                toast.success("Regra carregada.");
              } catch (e: any) {
                toast.error(e?.message ?? "Erro ao carregar regra");
              }
            }}
          >
            Carregar regra
          </Button>

          <Button
            variant="outline"
            onClick={async () => {
              try {
                const payload: any = { mode, rounding, overheadPercent, feesPercent };
                if (mode === "MARGIN") payload.marginPercent = marginPercent;
                else payload.markupPercent = markupPercent;
                await props.onSaveRule(payload);
                toast.success("Regra salva.");
              } catch (e: any) {
                toast.error(e?.message ?? "Erro ao salvar regra");
              }
            }}
          >
            Salvar regra
          </Button>

          <Button
            onClick={async () => {
              try {
                const payload: any = { mode, rounding, overheadPercent, feesPercent };
                if (mode === "MARGIN") payload.marginPercent = marginPercent;
                else payload.markupPercent = markupPercent;

                const res = await props.onSuggest(payload);
                const v = Number(res?.suggestedSalePrice ?? 0);
                if (!v || v <= 0) return toast.message("Sugestão indisponível. Verifique custo/BOM e %.");

                toast.success(`Sugestão: R$ ${v.toFixed(2)}`);
                await props.onApply(v);
                toast.success("Preço aplicado no produto.");
              } catch (e: any) {
                toast.error(e?.message ?? "Erro ao sugerir/aplicar");
              }
            }}
          >
            Sugerir e aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
