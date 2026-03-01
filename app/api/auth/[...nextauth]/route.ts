import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth-options";
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // @ts-expect-error
        token.role = user.role;
        // @ts-expect-error
        token.companyId = user.companyId;
        token.sub = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        // @ts-expect-error
        session.user.id = token.sub;
        // @ts-expect-error
        session.user.role = token.role;
        // @ts-expect-error
        session.user.companyId = token.companyId;
      }
      return session;
    },
  },
  pages: { signIn: "/login" },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };

