"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductPricingDialog } from "@/components/erp/product-pricing-dialog";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Product = {
  id: string;
  name: string;
  code?: string | null;
  salePrice?: number | null;
  costPrice?: number | null;
  type?: string | null;
  isActive: boolean;
};

async function fetchProducts(): Promise<Product[]> {
  const res = await fetch("/api/products");
  if (!res.ok) throw new Error("Erro ao carregar produtos");
  const data = await res.json();
  const list = data?.products ?? data?.rows ?? data;
  return Array.isArray(list) ? list : [];
}

async function createProduct(payload: any) {
  const res = await fetch("/api/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erro ao criar");
  return data.product;
}

async function updateProduct(id: string, payload: any) {
  const res = await fetch(`/api/products/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erro ao atualizar");
  return data.product;
}

async function deleteProduct(id: string) {
  const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erro ao remover");
  return data;
}

async function recalcCost(id: string) {
  const res = await fetch(`/api/products/${id}/recalc-cost`, { method: "POST" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erro ao recalcular custo");
  return data;
}

async function suggestPrice(id: string, payload: any) {
  const res = await fetch(`/api/products/${id}/suggest-price`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "missing_pricing_params");
  return data;
}

async function loadPricingRule(id: string) {
  const res = await fetch(`/api/products/${id}/pricing-rule`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erro ao carregar regra");
  return data.pricingRule ?? null;
}

async function savePricingRule(id: string, payload: any) {
  const res = await fetch(`/api/products/${id}/pricing-rule`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erro ao salvar regra");
  return data.pricingRule ?? null;
}

async function deletePricingRule(id: string) {
  const res = await fetch(`/api/products/${id}/pricing-rule`, { method: "DELETE" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erro ao remover regra");
  return data;
}

type FiscalOption = { id: string; code: string; description: string; label: string };

async function fetchProductFiscal(productId: string) {
  const res = await fetch(`/api/products/${productId}/fiscal`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao carregar fiscal do produto");
  return data as { product: { id: string; name: string; code?: string | null }; fiscal: unknown | null };
}

async function saveProductFiscal(productId: string, payload: { origin: number; ncmId: string | null; cestId: string | null; cfopId: string | null; cstId: string | null; csosnId: string | null; taxProfileId: string | null }) {
  const res = await fetch(`/api/products/${productId}/fiscal`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao salvar fiscal do produto");
  return data as { ok: boolean; fiscal: unknown };
}

async function searchFiscal(kind: "ncm" | "cfop" | "cst" | "csosn", q: string) {
  const sp = new URLSearchParams();
  sp.set("q", q);
  sp.set("take", "8");
  const res = await fetch(`/api/fiscal/${kind}?${sp.toString()}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao buscar");
  return (data?.results ?? []) as FiscalOption[];
}

async function searchFiscalAny(path: string, q: string) {
  const sp = new URLSearchParams();
  sp.set("q", q);
  sp.set("take", "8");
  const res = await fetch(`${path}?${sp.toString()}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao buscar");
  return (data?.results ?? []) as FiscalOption[];
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-sm font-medium">{label}</div>
      {children}
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export default function ProdutosPage() {
  const autoLoadedRef = React.useRef<Record<string, boolean>>({});
  const markDirty = (id: string) => setPricingDirty((prev) => ({ ...prev, [id]: true }));
  const qc = useQueryClient();
  const { data: productsRaw, isLoading } = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const products = React.useMemo(() => {
    return Array.isArray(productsRaw) ? productsRaw : [];
  }, [productsRaw]);

  // AUTO-LOAD pricing-rule: ao carregar produtos, busca regra salva (sem sobrescrever edição manual)
  React.useEffect(() => {
    if (!products || !Array.isArray(products)) return;

    (async () => {
      for (const p of products) {
        const id = String(p?.id ?? "");
        if (!id) continue;

        // já carregou uma vez? não repete
        if (autoLoadedRef.current[id]) continue;

        // usuário já mexeu nos campos? não sobrescreve
        if (pricingDirtyRef.current[id]) {
          autoLoadedRef.current[id] = true;
          continue;
        }

        // já tem config no state? não sobrescreve
        const existing = pricingRef.current[id];
        if (existing && Object.keys(existing).length > 0) {
          autoLoadedRef.current[id] = true;
          continue;
        }

        try {
          const rule = await loadPricingRule(id);
          autoLoadedRef.current[id] = true;

          if (!rule) continue;

          setPricing((prev) => ({
            ...prev,
            [id]: {
              mode: rule.mode,
              rounding: rule.rounding,
              overheadPercent: Number(rule.overheadPercent ?? 0),
              feesPercent: Number(rule.feesPercent ?? 0),
              marginPercent: Number(rule.marginPercent ?? 0),
              markupPercent: Number(rule.markupPercent ?? 0),
            },
          }));
        } catch {
          // silencioso: não trava a tela se a regra não existir / der erro
          autoLoadedRef.current[id] = true;
        }
      }
    })();
  }, [products]);
  const [form, setForm] = React.useState({ name: "", code: "", salePrice: 0, costPrice: 0, type: "COMPOSTO" });
  const [editing, setEditing] = React.useState<Product | null>(null);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [suggested, setSuggested] = React.useState<Record<string, number>>({});

  const [pricingOpen, setPricingOpen] = React.useState(false);
  const [pricingProduct, setPricingProduct] = React.useState<Product | null>(null);

  const [suggestInfo, setSuggestInfo] = React.useState<Record<string, any>>({});
const [pricing, setPricing] = React.useState<Record<string, any>>({});
  const [pricingDirty, setPricingDirty] = React.useState<Record<string, boolean>>({});
  React.useEffect(() => { pricingRef.current = pricing; }, [pricing]);
  React.useEffect(() => { pricingDirtyRef.current = pricingDirty; }, [pricingDirty]);
  const pricingRef = React.useRef<Record<string, any>>({});
  const pricingDirtyRef = React.useRef<Record<string, boolean>>({});

  // FISCAL DO PRODUTO (Dialog)
  const [fiscalOpen, setFiscalOpen] = React.useState(false);
  const [fiscalProduct, setFiscalProduct] = React.useState<Product | null>(null);
  const [origin, setOrigin] = React.useState<number>(0);
  const [ncm, setNcm] = React.useState<FiscalOption | null>(null);
  const [cest, setCest] = React.useState<FiscalOption | null>(null);
  const [cfop, setCfop] = React.useState<FiscalOption | null>(null);
  const [cst, setCst] = React.useState<FiscalOption | null>(null);
  const [csosn, setCsosn] = React.useState<FiscalOption | null>(null);
  const [taxProfile, setTaxProfile] = React.useState<FiscalOption | null>(null);
  const [qNcm, setQNcm] = React.useState("");
  const [qCest, setQCest] = React.useState("");
  const [qCfop, setQCfop] = React.useState("");
  const [qCst, setQCst] = React.useState("");
  const [qCsosn, setQCsosn] = React.useState("");
  const [qTaxProfile, setQTaxProfile] = React.useState("");

  const fiscalQ = useQuery({
    queryKey: ["product-fiscal", fiscalProduct?.id],
    queryFn: () => fetchProductFiscal(String(fiscalProduct?.id ?? "")),
    enabled: Boolean(fiscalOpen && fiscalProduct?.id),
  });

  React.useEffect(() => {
    if (!fiscalOpen) return;
    if (!fiscalQ.data) return;
    const f = fiscalQ.data?.fiscal as {
      origin?: number;
      ncm?: { id: string; code: string; description: string };
      cest?: { id: string; code: string; description: string };
      cfop?: { id: string; code: string; description: string };
      cst?: { id: string; code: string; description: string };
      csosn?: { id: string; code: string; description: string };
      taxProfile?: { id: string; name: string; description: string | null };
    } | null;
    setOrigin(Number(f?.origin ?? 0));
    setNcm(f?.ncm ? { id: f.ncm.id, code: f.ncm.code, description: f.ncm.description, label: `${f.ncm.code} - ${f.ncm.description}` } : null);
    setCest(f?.cest ? { id: f.cest.id, code: f.cest.code, description: f.cest.description, label: `${f.cest.code} - ${f.cest.description}` } : null);
    setCfop(f?.cfop ? { id: f.cfop.id, code: f.cfop.code, description: f.cfop.description, label: `${f.cfop.code} - ${f.cfop.description}` } : null);
    setCst(f?.cst ? { id: f.cst.id, code: f.cst.code, description: f.cst.description, label: `${f.cst.code} - ${f.cst.description}` } : null);
    setCsosn(f?.csosn ? { id: f.csosn.id, code: f.csosn.code, description: f.csosn.description, label: `${f.csosn.code} - ${f.csosn.description}` } : null);
    setTaxProfile(
      f?.taxProfile
        ? { id: f.taxProfile.id, code: f.taxProfile.name, description: f.taxProfile.description ?? "", label: f.taxProfile.description ? `${f.taxProfile.name} - ${f.taxProfile.description}` : f.taxProfile.name }
        : null
    );
    setQNcm(f?.ncm ? `${f.ncm.code} - ${f.ncm.description}` : "");
    setQCest(f?.cest ? `${f.cest.code} - ${f.cest.description}` : "");
    setQCfop(f?.cfop ? `${f.cfop.code}` : "");
    setQCst(f?.cst ? `${f.cst.code}` : "");
    setQCsosn(f?.csosn ? `${f.csosn.code}` : "");
    setQTaxProfile(f?.taxProfile ? (f.taxProfile.description ? `${f.taxProfile.name} - ${f.taxProfile.description}` : `${f.taxProfile.name}`) : "");
  }, [fiscalOpen, fiscalQ.data]);

  const ncmQ = useQuery({
    queryKey: ["fiscal-ncm", qNcm],
    queryFn: () => searchFiscal("ncm", qNcm.trim()),
    enabled: fiscalOpen && qNcm.trim().length >= 2,
  });
  const cfopQ = useQuery({
    queryKey: ["fiscal-cfop", qCfop],
    queryFn: () => searchFiscal("cfop", qCfop.trim()),
    enabled: fiscalOpen && qCfop.trim().length >= 2,
  });
  const cstQ = useQuery({
    queryKey: ["fiscal-cst", qCst],
    queryFn: () => searchFiscal("cst", qCst.trim()),
    enabled: fiscalOpen && qCst.trim().length >= 1,
  });
  const csosnQ = useQuery({
    queryKey: ["fiscal-csosn", qCsosn],
    queryFn: () => searchFiscal("csosn", qCsosn.trim()),
    enabled: fiscalOpen && qCsosn.trim().length >= 1,
  });

  const cestQ = useQuery({
    queryKey: ["fiscal-cest", qCest],
    queryFn: () => searchFiscalAny("/api/fiscal/cest", qCest.trim()),
    enabled: fiscalOpen && qCest.trim().length >= 2,
  });

  const taxProfileQ = useQuery({
    queryKey: ["fiscal-tax-profile", qTaxProfile],
    queryFn: () => searchFiscalAny("/api/fiscal/tax-profiles", qTaxProfile.trim()),
    enabled: fiscalOpen && qTaxProfile.trim().length >= 2,
  });

  const saveFiscalMut = useMutation({
    mutationFn: async () => {
      if (!fiscalProduct?.id) throw new Error("produto_invalido");
      return saveProductFiscal(fiscalProduct.id, {
        origin,
        ncmId: ncm?.id ?? null,
        cestId: cest?.id ?? null,
        cfopId: cfop?.id ?? null,
        cstId: cst?.id ?? null,
        csosnId: csosn?.id ?? null,
        taxProfileId: taxProfile?.id ?? null,
      });
    },
    onSuccess: async () => {
      toast.success("Fiscal do produto salvo.");
      await qc.invalidateQueries({ queryKey: ["products"] });
      await qc.invalidateQueries({ queryKey: ["product-fiscal", fiscalProduct?.id] });
      setFiscalOpen(false);
    },
    onError: (e: Error) => toast.error(e?.message ?? "Erro ao salvar fiscal"),
  });

  const createMut = useMutation({
    mutationFn: createProduct,
    onSuccess: async () => {
      setMsg("Produto criado!");
      setForm({ name: "", code: "", salePrice: 0, costPrice: 0, type: "COMPOSTO" });
      await qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: any) => updateProduct(id, payload),
    onSuccess: async () => {
      setMsg("Produto atualizado!");
      setEditing(null);
      await qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });

  const delMut = useMutation({
    mutationFn: deleteProduct,
    onSuccess: async () => {
      setMsg("Produto removido!");
      await qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });

  const recalcMut = useMutation({
    mutationFn: (id: string) => recalcCost(id),
    onSuccess: async () => {
      setMsg("Custo recalculado via BOM!");
      await qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });

  const suggestMut = useMutation({
    mutationFn: ({ id, payload }: any) => suggestPrice(id, payload),
    onSuccess: (data: any, vars: any) => {
      
      const id = String(vars?.id ?? "");
      const v = Number(data?.suggestedSalePrice ?? 0);
      if (id) setSuggestInfo((prev) => ({ ...prev, [id]: data }));
      if (id && v > 0) setSuggested((prev) => ({ ...prev, [id]: v }));
      setMsg(v > 0 ? `Sugestão gerada: R$ ${v.toFixed(2)}` : "Sugestão indisponível");

    },
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });

  const applySuggestMut = useMutation({
    mutationFn: async ({ id, salePrice }: any) => updateProduct(id, { salePrice }),
    onSuccess: async () => {
      setMsg("Preço aplicado!");
      await qc.invalidateQueries({ queryKey: ["products"] });
},
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });

  const saveRuleMut = useMutation({
    mutationFn: ({ id, payload }: any) => savePricingRule(id, payload),
    onSuccess: async () => {
      setMsg("Regra salva!");
      await qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });

  const loadRuleMut = useMutation({
    mutationFn: (id: string) => loadPricingRule(id),
    onSuccess: (rule: any, id: string) => {
      
      // se o usuário já mexeu nos campos desse produto, não sobrescreve
      const already = pricing[id];
      if (already && Object.keys(already).length > 0) {
        setMsg("Já existe edição nos campos. Use 'Carregar regra' se quiser sobrescrever.");
        return;
      }

if (!rule) return setMsg("Sem regra salva nesse produto.");
      setPricing((prev) => ({
        ...prev,
        [id]: {
          mode: rule.mode,
          rounding: rule.rounding,
          overheadPercent: Number(rule.overheadPercent ?? 0),
          feesPercent: Number(rule.feesPercent ?? 0),
          marginPercent: Number(rule.marginPercent ?? 30),
          markupPercent: Number(rule.markupPercent ?? 0),
        },
      }));
      setMsg("Regra carregada!");
    },
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });

  const clearRuleMut = useMutation({
    mutationFn: (id: string) => deletePricingRule(id),
    onSuccess: () => setMsg("Regra removida!"),
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });
  const current: any = editing ?? form;
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Produtos</h1>
<Button asChild variant="outline">
          <Link href="/cadastros">Voltar</Link>
        </Button>
      </div>

      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}

      <Card>
        <CardHeader><CardTitle>{editing ? "Editar produto" : "Novo produto"}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nome *" hint="Ex.: Portão basculante, Grade janela, Corrimão...">
              <Input
                placeholder="Nome do produto"
                value={current.name ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  editing ? setEditing({ ...editing, name: v }) : setForm({ ...form, name: v });
                }}
              />
            </Field>

            <Field label="Código / SKU" hint="Ex.: 000025, PT-01, CORR-10...">
              <Input
                placeholder="Código (opcional)"
                value={current.code ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  editing ? setEditing({ ...editing, code: v }) : setForm({ ...form, code: v });
                }}
              />
            </Field>

            <Field label="Preço de venda (R$)" hint="Ex.: 1999.90">
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={Number(current.salePrice ?? 0)}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  editing ? setEditing({ ...editing, salePrice: v }) : setForm({ ...form, salePrice: v });
                }}
              />
            </Field>

            <Field label="Custo (R$)" hint="Ex.: 1200.00">
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={Number(current.costPrice ?? 0)}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  editing ? setEditing({ ...editing, costPrice: v }) : setForm({ ...form, costPrice: v });
                }}
              />
            </Field>

            <Field label="Tipo" hint="COMPOSTO usa BOM; SIMPLES não usa BOM.">
              <div className="text-xs text-muted-foreground mb-1">
  <b>Regra de preço:</b> escolha <b>MARGIN</b> (margem sobre o preço) ou <b>MARKUP</b> (acréscimo sobre o custo).
  <span className="ml-1">Over/Fee ajustam o custo antes do cálculo. “Sugerir preço” só funciona se % obrigatória estiver preenchida.</span>
</div>
<select
                className="border rounded p-2 w-full"
                value={String(current.type ?? "COMPOSTO")}
                onChange={(e) => {
                  const v = e.target.value;
                  editing ? setEditing({ ...editing, type: v }) : setForm({ ...form, type: v });
                }}
              >
                <option value="COMPOSTO">COMPOSTO</option>
                <option value="SIMPLE">SIMPLE</option>
              </select>
            </Field>
          </div>

          <div className="flex gap-2">
            {!editing ? (
              <Button onClick={() => createMut.mutate(form)} disabled={createMut.isPending || !form.name.trim()}>
                {createMut.isPending ? "Salvando..." : "Criar"}
              </Button>
            ) : (
              <>
                <Button onClick={() => updateMut.mutate({ id: editing.id, payload: editing })} disabled={updateMut.isPending || !editing.name.trim()}>
                  {updateMut.isPending ? "Salvando..." : "Salvar"}
                </Button>
                <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Lista</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {isLoading && <p>Carregando...</p>}
          {products.map((p) => (
            <div key={p.id} className="flex items-center justify-between border rounded p-3">
              <div>
                <div className="font-medium">
                  {p.code ? `${p.code} - ` : ""}{p.name} {!p.isActive && <span className="text-xs text-muted-foreground">(inativo)</span>}
                </div>
                <div className="text-sm text-muted-foreground">
                  Venda: R$ {Number(p.salePrice ?? 0).toFixed(2)} · Custo: R$ {Number(p.costPrice ?? 0).toFixed(2)} · Tipo: {p.type}
                </div>
              </div>
              <div className="flex gap-2">
  <Button asChild variant="outline" size="sm">
    <Link href={`/cadastros/produtos/${p.id}/bom`}>BOM</Link>
  </Button>
  <Button
    variant="outline"
    size="sm"
    onClick={() => {
      setFiscalProduct(p);
      setFiscalOpen(true);
    }}
    title="Cadastro fiscal do produto (NCM/CFOP/CST/CSOSN)"
  >
    Fiscal
  </Button>
  <select
  className="border rounded p-2 text-sm"
  title="MARGIN = margem % sobre o preço final | MARKUP = % sobre o custo"
  value={pricing[p.id]?.mode ?? "MARGIN"}
  onChange={(e) => { setPricing((prev) => ({ ...prev, [p.id]: { ...(prev[p.id] ?? {}), mode: e.target.value } })); markDirty(p.id); }}
>
  <option value="MARGIN">MARGIN</option>
  <option value="MARKUP">MARKUP</option>
</select>

<select
  className="border rounded p-2 text-sm"
  title="Arredondamento do preço: .99 | múltiplos de 0,50 | normal (2 casas)"
  value={pricing[p.id]?.rounding ?? "R99"}
  onChange={(e) => { setPricing((prev) => ({ ...prev, [p.id]: { ...(prev[p.id] ?? {}), rounding: e.target.value } })); markDirty(p.id); }}
>
  <option value="R99">.99</option>
  <option value="R05">0,50</option>
  <option value="NONE">Normal</option>
</select>

<Input
  className="w-24"
  type="number"
  step="0.01"
  placeholder="% over" title="Overhead (%): custos indiretos antes do cálculo (produção, energia, perdas gerais, etc.)"
  value={Number(pricing[p.id]?.overheadPercent ?? 0)}
  onChange={(e) => { setPricing((prev) => ({ ...prev, [p.id]: { ...(prev[p.id] ?? {}), overheadPercent: Number(e.target.value) } })); markDirty(p.id); }}
 />

<Input
  className="w-24"
  type="number"
  step="0.01"
  placeholder="% taxas" title="Fees (%): taxas antes do cálculo (cartão, marketplace, etc.)"
  value={Number(pricing[p.id]?.feesPercent ?? 0)}
  onChange={(e) => { setPricing((prev) => ({ ...prev, [p.id]: { ...(prev[p.id] ?? {}), feesPercent: Number(e.target.value) } })); markDirty(p.id); }}
 />

{(pricing[p.id]?.mode ?? "MARGIN") === "MARGIN" ? (
  <Input
    className="w-24"
    type="number"
    step="0.01"
    placeholder="% margem" title="Margem (%): lucro como % do preço. Ex: 30% => preço = custo/(1-0,30)"
    value={Number(pricing[p.id]?.marginPercent ?? 30)}
    onChange={(e) => { setPricing((prev) => ({ ...prev, [p.id]: { ...(prev[p.id] ?? {}), marginPercent: Number(e.target.value) } })); markDirty(p.id); }}
  />
) : null}{(pricing[p.id]?.mode ?? "MARGIN") === "MARKUP" ? (
  <Input
    className="w-24"
    type="number"
    step="0.01"
    placeholder="% markup" title="Markup (%): acréscimo sobre custo. Ex: 45% => preço = custo*(1+0,45)"
    value={Number(pricing[p.id]?.markupPercent ?? 0)}
    onChange={(e) => { setPricing((prev) => ({ ...prev, [p.id]: { ...(prev[p.id] ?? {}), markupPercent: Number(e.target.value) } })); markDirty(p.id); }}
  />
) : null}<Button
  variant="outline"
  size="sm"
  onClick={() => {
    const cfg = pricing[p.id] ?? {};
    const mode = cfg.mode ?? "MARGIN";
    const rounding = cfg.rounding ?? "R99";

    const payload: any = {
      mode,
      rounding,
      overheadPercent: Number(cfg.overheadPercent ?? 0),
      feesPercent: Number(cfg.feesPercent ?? 0),
    };

    if (mode === "MARGIN") payload.marginPercent = Number(cfg.marginPercent ?? 30);
    else payload.markupPercent = Number(cfg.markupPercent ?? 0);

    suggestMut.mutate({ id: p.id, payload });
  }}
  disabled={suggestMut.isPending || (() => {
  const cfg = pricing[p.id] ?? {};
  const mode = cfg.mode ?? "MARGIN";
  const m = Number(cfg.marginPercent ?? 0);
  const k = Number(cfg.markupPercent ?? 0);
  if (mode === "MARGIN") return !isFinite(m) || m <= 0;
  return !isFinite(k) || k < 0;
})()}
>
  {suggestMut.isPending ? "Sugerindo..." : "Sugerir preço"}
</Button>
<Button
  variant="outline"
  size="sm"
  onClick={() => {
    const cfg = pricing[p.id] ?? {};
    const mode = cfg.mode ?? "MARGIN";
    const rounding = cfg.rounding ?? "R99";

    const payload: any = {
      mode,
      rounding,
      overheadPercent: Number(cfg.overheadPercent ?? 0),
      feesPercent: Number(cfg.feesPercent ?? 0),
    };

    if (mode === "MARGIN") payload.marginPercent = Number(cfg.marginPercent ?? 0);
    else payload.markupPercent = Number(cfg.markupPercent ?? 0);

    saveRuleMut.mutate({ id: p.id, payload });
  }}
  disabled={saveRuleMut.isPending}
>
  {saveRuleMut.isPending ? "Salvando..." : "Salvar regra"}
</Button>

<Button
  variant="outline"
  size="sm"
  disabled={loadRuleMut.isPending}
>
  {loadRuleMut.isPending ? "Carregando..." : "Carregar regra"}
</Button>

<Button
  variant="outline"
  size="sm"
  onClick={() => clearRuleMut.mutate(p.id)}
  disabled={clearRuleMut.isPending}
>
  {clearRuleMut.isPending ? "Removendo..." : "Limpar regra"}
</Button>
{suggestInfo[p.id] ? (
  <div className="text-xs text-muted-foreground px-1">
    <div><b>Custo BOM:</b> R$ {Number(suggestInfo[p.id]?.costBase ?? 0).toFixed(4)}</div>
    <div><b>Over/Fee:</b> {Number(suggestInfo[p.id]?.overheadPercent ?? 0).toFixed(2)}% / {Number(suggestInfo[p.id]?.feesPercent ?? 0).toFixed(2)}%</div>
    <div><b>Custo ajustado:</b> R$ {Number(suggestInfo[p.id]?.costPrice ?? 0).toFixed(4)}</div>
    <div><b>Preço bruto:</b> R$ {Number(suggestInfo[p.id]?.rawSalePrice ?? 0).toFixed(4)} · <b>Sugerido:</b> R$ {Number(suggestInfo[p.id]?.suggestedSalePrice ?? 0).toFixed(2)}</div>
    <div><b>Modo:</b> {String(suggestInfo[p.id]?.mode ?? "")} · <b>%</b> {suggestInfo[p.id]?.mode === "MARGIN" ? Number(suggestInfo[p.id]?.marginPercent ?? 0).toFixed(2) : Number(suggestInfo[p.id]?.markupPercent ?? 0).toFixed(2)} · <b>Round:</b> {String(suggestInfo[p.id]?.rounding ?? "")}</div>
  </div>
) : null}

{suggested[p.id] ? (
  <Button
    variant="outline"
    size="sm"
    onClick={() => applySuggestMut.mutate({ id: p.id, salePrice: suggested[p.id] })}
    disabled={applySuggestMut.isPending}
  >
    {applySuggestMut.isPending ? "Aplicando..." : `Aplicar (R$ ${suggested[p.id].toFixed(2)})`}
  </Button>
) : null}<Button variant="outline" size="sm" onClick={() => recalcMut.mutate(p.id)} disabled={recalcMut.isPending}>
  {recalcMut.isPending ? "Recalculando..." : "Recalcular custo (BOM)"}
</Button>

<Button
  variant="secondary"
  size="sm"
  onClick={() => {
    setPricingProduct(p);
    setPricingOpen(true);
  }}
>
  Precificar
</Button>

<Button variant="outline" size="sm" onClick={() => setEditing(p)}>Editar</Button>
  <Button variant="destructive" size="sm" onClick={() => delMut.mutate(p.id)} disabled={delMut.isPending}>Remover</Button>
</div>
            </div>
          ))}
        </CardContent>
      </Card>

      {pricingProduct ? (
        <ProductPricingDialog
          open={pricingOpen}
          onOpenChange={setPricingOpen}
          product={pricingProduct as any}
          pricing={pricing[pricingProduct.id] ?? {}}
          setPricing={(next) => {
            setPricing((prev) => ({ ...prev, [pricingProduct.id]: next }));
            setPricingDirty((prev) => ({ ...prev, [pricingProduct.id]: true }));
          }}
          onSuggest={(payload) => suggestPrice(pricingProduct.id, payload)}
          onApply={async (salePrice) => { await updateProduct(pricingProduct.id, { salePrice }); await qc.invalidateQueries({ queryKey: ["products"] }); }}
          onSaveRule={async (payload) => { await savePricingRule(pricingProduct.id, payload); }}
          onLoadRule={async () => loadPricingRule(pricingProduct.id)}
          onClearRule={async () => { await deletePricingRule(pricingProduct.id); toast.success("Regra removida."); }}
        />
      ) : null}

      <Dialog open={fiscalOpen} onOpenChange={setFiscalOpen}>
        <DialogContent className="max-w-[760px]">
          <DialogHeader>
            <DialogTitle>Fiscal do Produto</DialogTitle>
            <DialogDescription>
              Configure NCM/CFOP/CST/CSOSN para o emissor fiscal no futuro. (ADMIN)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="text-sm">
              <div className="font-medium">{fiscalProduct?.name ?? "Produto"}</div>
              <div className="text-xs text-muted-foreground">ID: {fiscalProduct?.id ?? "—"}</div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1 md:col-span-2">
                <Label>Informe o vínculo deste produto</Label>
                <Input value={qTaxProfile} onChange={(e) => setQTaxProfile(e.target.value)} placeholder="Digite o nome do vínculo..." />
                {taxProfile ? <div className="text-xs text-muted-foreground">Selecionado: {taxProfile.label}</div> : null}
                {qTaxProfile.trim().length >= 2 && taxProfileQ.data?.length === 0 ? (
                  <div className="text-xs text-muted-foreground">Sem resultados.</div>
                ) : null}
                {taxProfileQ.data?.length ? (
                  <div className="max-h-40 overflow-auto border rounded">
                    {taxProfileQ.data.map((opt) => (
                      <button
                        type="button"
                        key={opt.id}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                        onClick={() => {
                          setTaxProfile(opt);
                          setQTaxProfile(opt.label);
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="space-y-1">
                <Label>Origem</Label>
                <select
                  className="border rounded p-2 w-full"
                  value={String(origin)}
                  onChange={(e) => setOrigin(Number(e.target.value))}
                >
                  <option value="0">0 - Nacional</option>
                  <option value="1">1 - Estrangeira (Importação direta)</option>
                  <option value="2">2 - Estrangeira (Adquirida no mercado interno)</option>
                  <option value="3">3 - Nacional (conteúdo importação &gt; 40%)</option>
                  <option value="4">4 - Nacional (produção básica)</option>
                  <option value="5">5 - Nacional (conteúdo importação ≤ 40%)</option>
                  <option value="6">6 - Estrangeira (Importação sem similar nacional)</option>
                  <option value="7">7 - Estrangeira (Adquirida internamente sem similar)</option>
                  <option value="8">8 - Nacional (conteúdo importação &gt; 70%)</option>
                </select>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>NCM</Label>
                <Input value={qNcm} onChange={(e) => setQNcm(e.target.value)} placeholder="Digite código ou descrição..." />
                {ncm ? <div className="text-xs text-muted-foreground">Selecionado: {ncm.label}</div> : null}
                {qNcm.trim().length >= 2 && ncmQ.data?.length === 0 ? (
                  <div className="text-xs text-muted-foreground">Sem resultados.</div>
                ) : null}
                {ncmQ.data?.length ? (
                  <div className="max-h-40 overflow-auto border rounded">
                    {ncmQ.data.map((opt) => (
                      <button
                        type="button"
                        key={opt.id}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                        onClick={() => {
                          setNcm(opt);
                          setQNcm(opt.label);
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="space-y-1">
                <Label>CEST</Label>
                <Input value={qCest} onChange={(e) => setQCest(e.target.value)} placeholder="Digite CEST (código ou descrição)..." />
                {cest ? <div className="text-xs text-muted-foreground">Selecionado: {cest.label}</div> : null}
                {qCest.trim().length >= 2 && cestQ.data?.length === 0 ? (
                  <div className="text-xs text-muted-foreground">Sem resultados.</div>
                ) : null}
                {cestQ.data?.length ? (
                  <div className="max-h-40 overflow-auto border rounded">
                    {cestQ.data.map((opt) => (
                      <button
                        type="button"
                        key={opt.id}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                        onClick={() => {
                          setCest(opt);
                          setQCest(opt.label);
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>CFOP</Label>
                <Input value={qCfop} onChange={(e) => setQCfop(e.target.value)} placeholder="Digite CFOP (ex.: 5101)..." />
                {cfop ? <div className="text-xs text-muted-foreground">Selecionado: {cfop.label}</div> : null}
                {qCfop.trim().length >= 2 && cfopQ.data?.length === 0 ? (
                  <div className="text-xs text-muted-foreground">Sem resultados.</div>
                ) : null}
                {cfopQ.data?.length ? (
                  <div className="max-h-40 overflow-auto border rounded">
                    {cfopQ.data.map((opt) => (
                      <button
                        type="button"
                        key={opt.id}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                        onClick={() => {
                          setCfop(opt);
                          setQCfop(opt.label);
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>CST (regime normal)</Label>
                <Input value={qCst} onChange={(e) => setQCst(e.target.value)} placeholder='Ex.: "00", "20", "40"...' />
                {cst ? <div className="text-xs text-muted-foreground">Selecionado: {cst.label}</div> : null}
                {cstQ.data?.length ? (
                  <div className="max-h-40 overflow-auto border rounded">
                    {cstQ.data.map((opt) => (
                      <button
                        type="button"
                        key={opt.id}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                        onClick={() => {
                          setCst(opt);
                          setCsosn(null);
                          setQCsosn("");
                          setQCst(opt.code);
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="text-xs text-muted-foreground">Se selecionar CST, CSOSN será limpo.</div>
              </div>

              <div className="space-y-1">
                <Label>CSOSN (Simples Nacional)</Label>
                <Input value={qCsosn} onChange={(e) => setQCsosn(e.target.value)} placeholder='Ex.: "101", "102", "500"...' />
                {csosn ? <div className="text-xs text-muted-foreground">Selecionado: {csosn.label}</div> : null}
                {csosnQ.data?.length ? (
                  <div className="max-h-40 overflow-auto border rounded">
                    {csosnQ.data.map((opt) => (
                      <button
                        type="button"
                        key={opt.id}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                        onClick={() => {
                          setCsosn(opt);
                          setCst(null);
                          setQCst("");
                          setQCsosn(opt.code);
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="text-xs text-muted-foreground">Se selecionar CSOSN, CST será limpo.</div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFiscalOpen(false)}>
              Voltar
            </Button>
            <Button onClick={() => saveFiscalMut.mutate()} disabled={saveFiscalMut.isPending}>
              {saveFiscalMut.isPending ? "Salvando..." : "Salvar fiscal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
