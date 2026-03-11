/**
 * Formata quantidade para exibição (sem separador de milhares).
 * - un / UN: inteiro quando for número redondo, senão até 2 decimais
 * - m, kg, L, etc.: 2 decimais
 */
export function formatQuantity(value: number, unitCode?: string | null): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  const u = String(unitCode ?? "").trim().toLowerCase();
  // Unidade (un, peça, etc.): evita 10.0000, mostra 10 ou 10,5
  if (u === "un" || u === "unidade" || u === "pc" || u === "pç" || u === "") {
    if (Number.isInteger(n)) return String(n);
    const s = n.toFixed(2);
    return s.replace(/\.?0+$/, "") || "0";
  }
  // m, kg, L: 2 decimais, remove zeros à direita
  const s = n.toFixed(2);
  return s.replace(/\.?0+$/, "") || "0";
}
