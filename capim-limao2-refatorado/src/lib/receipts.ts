import Decimal from 'decimal.js';

export interface OnlineOrderReceiptInput {
  order_number: string;
  customer_name: string;
  status: string;
  payment_status: string | null;
  total: string | number | null;
  created_at: string;
}
export interface PosPaymentInput { amount: string | number; status: string }
export interface PosReceiptInput { sale_number: string; created_at: string; sale_payments: PosPaymentInput[] | null }
export interface ReceiptRow { source: 'Pedido online' | 'PDV'; reference: string; status: string; amount: string; createdAt: string }

const operationLabels: Record<string, string> = { NEW: 'Novo', CONFIRMED: 'Confirmado', PREPARING: 'Em preparação', READY: 'Pronto', COMPLETED: 'Concluído', CANCELLED: 'Cancelado' };

/** Soma pedidos ainda pagos e parcelas POS confirmadas; o estado operacional não equivale a estorno. */
export function aggregateConfirmedReceipts(orders: OnlineOrderReceiptInput[], sales: PosReceiptInput[]) {
  const rows: ReceiptRow[] = [];
  for (const order of orders) {
    if (order.payment_status !== 'PAID' || order.total === null) continue;
    const amount = new Decimal(order.total);
    if (amount.isNegative()) continue;
    rows.push({ source: 'Pedido online', reference: `${order.order_number} · ${order.customer_name}`, status: `Pago · ${operationLabels[order.status] ?? order.status}`, amount: amount.toFixed(2), createdAt: order.created_at });
  }
  for (const sale of sales) {
    const amount = (sale.sale_payments ?? []).filter((payment) => payment.status === 'CONFIRMED')
      .reduce((sum, payment) => sum.plus(payment.amount), new Decimal(0));
    if (!amount.gt(0)) continue;
    rows.push({ source: 'PDV', reference: sale.sale_number, status: 'Recebido', amount: amount.toFixed(2), createdAt: sale.created_at });
  }
  rows.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const total = rows.reduce((sum, row) => sum.plus(row.amount), new Decimal(0)).toFixed(2);
  return { rows, total };
}
