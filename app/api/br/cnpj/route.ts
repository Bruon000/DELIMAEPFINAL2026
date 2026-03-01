import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

function onlyDigits(s: string) {
  return (s ?? "").replace(/\D/g, "");
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const q = onlyDigits(url.searchParams.get("q") ?? "");

  if (q.length !== 14) return NextResponse.json({ error: "cnpj_invalid" }, { status: 400 });

  const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${q}`, {
    cache: "no-store",
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    return NextResponse.json({ error: "cnpj_not_found", details: data }, { status: 404 });
  }

  // normaliza retorno (BrasilAPI)
  const out = {
    cnpj: q,
    razaoSocial: data?.razao_social ?? data?.nome_empresarial ?? null,
    nomeFantasia: data?.nome_fantasia ?? null,
    email: data?.email ?? null,
    telefone: data?.ddd_telefone_1 ?? data?.telefone ?? null,
    cep: data?.cep ?? null,
    uf: data?.uf ?? null,
    municipio: data?.municipio ?? null,
    bairro: data?.bairro ?? null,
    logradouro: data?.logradouro ?? null,
    numero: data?.numero ?? null,
    complemento: data?.complemento ?? null,
  };

  return NextResponse.json({ ok: true, data: out });
}
