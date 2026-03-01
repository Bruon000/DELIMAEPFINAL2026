import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export type AppSession = {
  user?: {
    id: string;
    companyId: string;
    role?: string;
    name?: string | null;
    email?: string | null;
  };
};

/** Session do NextAuth com extras (id/companyId/role) */
export async function getSession(): Promise<AppSession | null> {
  return (await getServerSession(authOptions)) as any;
}
