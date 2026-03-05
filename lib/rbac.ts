import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export type RequireRoleResult =
  | { ok: true; session: NonNullable<Awaited<ReturnType<typeof getSession>>> }
  | { ok: false; res: NextResponse };

/**
 * Exige sessão e que o usuário tenha um dos roles informados.
 * Retorna { ok: true, session } ou { ok: false, res } (401/403).
 */
export async function requireRole(allowedRoles: string[]): Promise<RequireRoleResult> {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, res: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  const role = String((session.user as { role?: string }).role ?? "");
  if (!allowedRoles.includes(role)) {
    return { ok: false, res: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { ok: true, session };
}
