import { prisma } from "@/lib/prisma";

export type AuditInput = {
  companyId: string;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  payload?: any;
  ip?: string | null;
  userAgent?: string | null;
};

export async function writeAuditLog(input: AuditInput) {
  try {
    await prisma.auditLog.create({
      data: {
        companyId: input.companyId,
        userId: input.userId ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        payload: input.payload ?? null,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      } as any,
    });
  } catch {
    // audit nunca pode derrubar a operação
  }
}
