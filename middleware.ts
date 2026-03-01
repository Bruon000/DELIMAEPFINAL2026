import { withAuth } from "next-auth/middleware";

export default withAuth(
  function middleware(req) {},
  {
    pages: { signIn: "/login" },
    callbacks: { authorized: ({ token }) => !!token },
  }
);

export const config = {
  matcher: ["/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)"],
};
