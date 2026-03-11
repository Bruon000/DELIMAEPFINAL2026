"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/erp/page-header";

export default function AjudaComprasEstoquePage() {
  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <PageHeader
        title="Como usar: Compras e Estoque"
        subtitle="Passo a passo para o dia a dia — importar nota, criar pedido, receber mercadoria e conferir movimentações."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/compras/pedidos">Ir para Compras</Link>
          </Button>
        }
      />

      {/* Fluxo 1: Tenho o XML */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">1. Quando você já tem o XML da nota (NF-e)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ol className="list-decimal list-inside space-y-2 pl-2">
            <li>Vá em <strong className="text-foreground">Compras</strong> e clique em <strong className="text-foreground">Importar NF-e (XML)</strong> (no card “Tenho o XML da nota fiscal”).</li>
            <li>Selecione o arquivo <strong className="text-foreground">.xml</strong> que o fornecedor enviou (e-mail, portal, etc.).</li>
            <li>O sistema cria sozinho o pedido de compra, o fornecedor, os itens (com CFOP/NCM) e o valor. Confira e, se quiser, clique em <strong className="text-foreground">Abrir pedido</strong> para ver os detalhes.</li>
            <li>No detalhe do pedido: quando a mercadoria chegar, clique em <strong className="text-foreground">Receber (entrada estoque)</strong>. Isso dá entrada no estoque, atualiza custos e gera as movimentações (ledger).</li>
          </ol>
          <p className="pt-2 border-t">
            Se a nota já foi importada antes, o sistema avisa. Você pode abrir o pedido existente pela lista em Compras.
          </p>
        </CardContent>
      </Card>

      {/* Fluxo 2: Ainda não tenho a nota */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">2. Quando ainda não tem a nota — só quer anotar o pedido</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ol className="list-decimal list-inside space-y-2 pl-2">
            <li>Em <strong className="text-foreground">Compras</strong>, no card “Ainda não tenho a nota”, escolha o <strong className="text-foreground">fornecedor</strong> e clique em <strong className="text-foreground">Criar pedido</strong>.</li>
            <li>Você cai no detalhe do pedido em <strong className="text-foreground">Rascunho</strong>. Adicione os itens (material, quantidade, preço). Pode editar e remover itens à vontade.</li>
            <li>Quando o pedido for enviado ao fornecedor, clique em <strong className="text-foreground">Marcar como Enviado</strong>. A partir daí o pedido não pode mais ser editado.</li>
            <li>Quando a mercadoria e a nota chegarem, você pode:
              <ul className="list-disc list-inside mt-2 ml-2 space-y-1">
                <li><strong className="text-foreground">Importar o XML</strong> da NF-e (Compras → Importar NF-e) e, se der, vincular ao pedido; ou</li>
                <li>No próprio pedido, clicar em <strong className="text-foreground">Receber (entrada estoque)</strong> para dar entrada com os itens que você cadastrou.</li>
              </ul>
            </li>
          </ol>
        </CardContent>
      </Card>

      {/* O que é cada status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">3. O que significa cada status do pedido?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <ul className="space-y-2">
            <li><strong className="text-foreground">Rascunho:</strong> pode editar itens. Depois use “Marcar como Enviado”. Quando a mercadoria chegar, use “Receber (entrada estoque)”.</li>
            <li><strong className="text-foreground">Enviado:</strong> pedido já enviado ao fornecedor; não dá mais para editar. Quando a mercadoria chegar, use “Receber (entrada estoque)”.</li>
            <li><strong className="text-foreground">Recebido:</strong> entrada no estoque já feita. Os itens ficam só para consulta.</li>
            <li><strong className="text-foreground">Cancelado:</strong> pedido não será processado.</li>
          </ul>
        </CardContent>
      </Card>

      {/* Ledger e Movimentações */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">4. Ledger e Movimentações de Estoque</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            O <strong className="text-foreground">Ledger</strong> é o histórico de entradas e saídas por material. Cada linha é uma movimentação (entrada de compra, saída de venda, ajuste, etc.).
          </p>
          <ul className="space-y-1 list-disc list-inside">
            <li>Na lista de <strong className="text-foreground">Compras</strong>, o botão <strong className="text-foreground">Ledger</strong> abre a tela de Movimentações já filtrada por aquele pedido (referência <strong className="text-foreground">PO:…</strong> ou <strong className="text-foreground">NFE:…</strong>).</li>
            <li>Na tela de <strong className="text-foreground">Movimentações de Estoque</strong> você vê todas as entradas/saídas/ajustes. No topo, quando veio do Ledger, aparece o botão <strong className="text-foreground">Voltar ao pedido de compra</strong> para retornar ao pedido. Use <strong className="text-foreground">Limpar filtro e ver todas</strong> para ver todas as movimentações.</li>
            <li><strong className="text-foreground">Referência</strong> = identificador do movimento (ex.: PO: id do pedido, NFE: chave da nota). Você pode colar no campo “Referência” para filtrar.</li>
          </ul>
        </CardContent>
      </Card>

      {/* Resumo rápido */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-lg">Resumo rápido</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p><strong className="text-foreground">Tenho XML</strong> → Compras → Importar NF-e → abrir pedido → quando chegar, Receber (entrada estoque).</p>
          <p><strong className="text-foreground">Não tenho XML</strong> → Compras → Criar pedido (fornecedor) → adicionar itens → Marcar como Enviado → quando chegar, Receber (entrada estoque).</p>
          <p><strong className="text-foreground">Conferir movimentações</strong> → Compras → Ledger (no pedido) ou Estoque → Movimentações. Para voltar ao pedido, use o botão “Voltar ao pedido de compra” no topo.</p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/compras/pedidos">Abrir Compras</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/estoque/movimentacoes">Abrir Movimentações</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/compras/importar-nfe">Importar NF-e</Link>
        </Button>
      </div>
    </div>
  );
}
