import { redirect } from "next/navigation";

export default function OrcamentosPage() {
  // mantém um ponto único: Comercial
  redirect("/comercial/orcamentos");
}
