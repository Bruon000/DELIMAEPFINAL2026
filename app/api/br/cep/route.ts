import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

function onlyDigits(s: string) {
  return (s ?? "").replace(/\D/g, "");
}

/** GET /api/br/cep?q=00000000 - Consulta ViaCEP e retorna endereço normalizado */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const q = onlyDigits(url.searchParams.get("q") ?? "");

  if (q.length !== 8) return NextResponse.json({ error: "cep_invalid" }, { status: 400 });

  const res = await fetch(`https://viacep.com.br/ws/${q}/json/`, { cache: "no-store" });
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;

  if (!res.ok || !data || data.erro === true) {
    return NextResponse.json(
      { error: "cep_not_found", message: "CEP não encontrado." },
      { status: 404 }
    );
  }

  const out = {
    cep: q,
    logradouro: (data.logradouro as string) ?? null,
    bairro: (data.bairro as string) ?? null,
    localidade: (data.localidade as string) ?? null,
    uf: (data.uf as string) ?? null,
    ibge: (data.ibge as string) ?? null,
  };

  return NextResponse.json({ ok: true, data: out });
}
