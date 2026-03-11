import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

function onlyDigits(s: string) {
  return (s ?? "").replace(/\D/g, "");
}

type RawCnpj = Record<string, unknown> & {
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  nome?: string;
  fantasia?: string;
  razaoSocial?: string;
  nomeFantasia?: string;
  email?: string;
  telefone?: string;
  telefones?: Array<{ ddd?: string; numero?: string }>;
  ddd_telefone_1?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  complemento?: string;
  codigo_municipio?: number | string;
  endereco?: { logradouro?: string; numero?: string; bairro?: string; municipio?: string; uf?: string; cep?: string };
};

/** Formato unificado esperado pelo front (clientes/fornecedores) */
function normalize(raw: RawCnpj, cnpjDigits: string) {
  const addr = raw.endereco ?? raw;
  const tel =
    raw.telefone ??
    (Array.isArray(raw.telefones) && raw.telefones[0]
      ? `${raw.telefones[0].ddd ?? ""}${raw.telefones[0].numero ?? ""}`.trim() || null
      : null) ??
    raw.ddd_telefone_1 ??
    null;
  return {
    cnpj: cnpjDigits,
    razaoSocial: (raw.razaoSocial ?? raw.razao_social ?? raw.nome ?? null) as string | null,
    nomeFantasia: (raw.nomeFantasia ?? raw.nome_fantasia ?? raw.fantasia ?? null) as string | null,
    email: (raw.email ?? null) as string | null,
    telefone: tel ? String(tel) : null,
    cep: (raw.cep ?? addr?.cep) ? String((raw.cep ?? addr?.cep) ?? "").replace(/\D/g, "").slice(0, 8) || null : null,
    uf: (raw.uf ?? addr?.uf ?? null) as string | null,
    municipio: (raw.municipio ?? addr?.municipio ?? null) as string | null,
    bairro: (raw.bairro ?? addr?.bairro ?? null) as string | null,
    logradouro: (raw.logradouro ?? addr?.logradouro ?? null) as string | null,
    numero: (raw.numero ?? addr?.numero) != null ? String(raw.numero ?? addr?.numero) : null,
    complemento: (raw.complemento ?? null) as string | null,
    cityCodeIbge: raw.codigo_municipio != null ? String(raw.codigo_municipio) : null,
  };
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const q = onlyDigits(url.searchParams.get("q") ?? "");

  if (q.length !== 14) return NextResponse.json({ error: "cnpj_invalid" }, { status: 400 });

  // 1) OpenCNPJ (api.opencnpj.org) – gratuito, CDN, até 50 req/s, base Receita Federal atualizada mensalmente
  let res = await fetch(`https://api.opencnpj.org/${q}`, { cache: "no-store" });
  let data: unknown = await res.json().catch(() => null);

  if (res.ok && data && typeof data === "object") {
    const out = normalize(data as Record<string, unknown>, q);
    return NextResponse.json({ ok: true, data: out });
  }

  // 2) Fallback: BrasilAPI
  res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${q}`, { cache: "no-store" });
  data = await res.json().catch(() => null);
  if (res.ok && data && typeof data === "object") {
    const out = normalize((data ?? {}) as RawCnpj, q);
    return NextResponse.json({ ok: true, data: out });
  }

  // 3) Fallback: ReceitaWS (até 3 consultas/min, cache)
  res = await fetch(`https://receitaws.com.br/v1/cnpj/${q}`, { cache: "no-store" });
  data = await res.json().catch(() => null);
  if (res.ok && data && typeof data === "object") {
    const d = data as RawCnpj & { status?: string };
    if (d.status !== "ERROR") {
      const out = normalize(d, q);
      return NextResponse.json({ ok: true, data: out });
    }
  }

  return NextResponse.json(
    { error: "cnpj_not_found", message: "CNPJ não encontrado nas bases públicas. Preencha manualmente." },
    { status: 404 }
  );
}
