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

        if (pathname.startsWith("/admin")) {
          return (token as { role?: string }).role === "ADMIN";
        }
        return true;
      },
    },
  }
);

export const config = {
  matcher: ["/((?!api|login|_next/static|_next/image|favicon.ico).*)"],
};
