import { withAuth } from "next-auth/middleware";

/**
 * API retorna 401 JSON; páginas redirecionam para /login.
 * - /api/** não passa por este middleware (excluído no matcher): rotas usam getSession() e respondem 401 JSON.
 * - Páginas passam por withAuth: não autenticado → redirect /login; /admin exige role ADMIN.
 * - login, _next/static, _next/image, favicon.ico também excluídos.
 */
export default withAuth(
  function middleware() {},
  {
    pages: { signIn: "/login" },
    callbacks: {
      authorized: ({ token, req }) => {
        if (!token) return false;

        const pathname = req.nextUrl.pathname;
        const role = (token as { role?: string }).role ?? "";

        if (pathname.startsWith("/admin")) {
          return role === "ADMIN";
        }

        // Cadastros (produtos/materiais/BOM/fornecedores etc): somente ADMIN
        if (pathname.startsWith("/cadastros")) return role === "ADMIN";

        // Financeiro: CAIXA/ADMIN/CONTADOR
        if (pathname.startsWith("/financeiro")) return role === "CAIXA" || role === "ADMIN" || role === "CONTADOR";

        // Compras: ADMIN (por enquanto)
        if (pathname.startsWith("/compras")) return role === "ADMIN";

        // Produção: PRODUCAO/ADMIN
        if (pathname.startsWith("/producao")) return role === "PRODUCAO" || role === "ADMIN";

        // Estoque: VENDEDOR/PRODUCAO/ADMIN (somente telas; API controla o resto)
        if (pathname.startsWith("/estoque")) return role === "VENDEDOR" || role === "PRODUCAO" || role === "ADMIN";

        // Clientes e Comercial: VENDEDOR/ADMIN
        if (pathname.startsWith("/clientes") || pathname.startsWith("/comercial") || pathname.startsWith("/pedidos") || pathname.startsWith("/orcamentos")) {
          return role === "VENDEDOR" || role === "ADMIN";
        }

        return true;
      },
    },
  }
);

export const config = {
  matcher: ["/((?!api|login|_next/static|_next/image|favicon.ico).*)"],
};
