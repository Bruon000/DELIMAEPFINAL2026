/**
 * Status Pipeline - Pedidos e Produção
 * Centralizado para uso em badges, filtros e validações
 */

export const ORDER_STATUS = {
  DRAFT: { label: "Rascunho", color: "secondary" },
  OPEN: { label: "Aberto", color: "default" },
  CONFIRMED: { label: "Confirmado", color: "primary" },
  IN_PRODUCTION: { label: "Em produção", color: "warning" },
  READY: { label: "Pronto", color: "success" },
  INSTALLED: { label: "Instalado", color: "success" },
  DELIVERED: { label: "Entregue", color: "success" },
  CANCELED: { label: "Cancelado", color: "destructive" },
} as const;

export const PRODUCTION_ORDER_STATUS = {
  QUEUED: { label: "Na fila", color: "secondary" },
  IN_PROGRESS: { label: "Em andamento", color: "warning" },
  BLOCKED: { label: "Bloqueado", color: "destructive" },
  DONE: { label: "Concluído", color: "success" },
} as const;

export const PRODUCTION_STEPS = [
  "CORTE",
  "SOLDA",
  "PINTURA",
  "MONTAGEM",
  "ACABAMENTO",
] as const;

export type OrderStatusKey = keyof typeof ORDER_STATUS;
export type ProductionOrderStatusKey = keyof typeof PRODUCTION_ORDER_STATUS;
