import { withAuth } from "next-auth/middleware";

export default withAuth(
  function middleware(req) {},
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
  matcher: ["/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)"],
};
