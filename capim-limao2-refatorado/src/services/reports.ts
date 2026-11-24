import Decimal from 'decimal.js';
import { money } from '../lib/format';
import { fetchAllPages } from '../lib/pagination';
import { aggregateConfirmedReceipts, type OnlineOrderReceiptInput, type PosReceiptInput } from '../lib/receipts';
import { requireSupabase } from '../lib/supabase';

export type ReportKind = 'orders' | 'sales' | 'products' | 'revenue' | 'status' | 'stock';
export interface ReportDataset { title: string; columns: string[]; rows: string[][]; summary?: string; note?: string }

interface OrderReportRow extends OnlineOrderReceiptInput { id: string }
interface SalesReportRow { id: string; sale_number: string; subtotal: string | number; discount: string | number; total: string | number; created_at: string; cancelled_at: string | null }
interface SaleItemReportRow { id: string; product_name: string; unit: string; quantity: string | number; line_total: string | number }
interface StockMovementReportRow { id: string; created_at: string; movement_type: string; quantity: string | number; balance_after: string | number; reason: string; products: { name: string; unit: string } | { name: string; unit: string }[] | null }

const statusNames: Record<string, string> = { NEW: 'Novo', CONFIRMED: 'Confirmado', PREPARING: 'Em preparação', READY: 'Pronto', COMPLETED: 'Concluído', CANCELLED: 'Cancelado' };
export const reportNames: Record<ReportKind, string> = {
  orders: 'Pedidos por período', sales: 'Vendas por período', products: 'Produtos mais vendidos',
  revenue: 'Recebimentos confirmados', status: 'Pedidos por status', stock: 'Histórico de movimentações',
};

function rangeForLocalDates(from: string, to: string): { start: string; end: string } {
  const startDate = new Date(`${from}T00:00:00`);
  const endDate = new Date(`${to}T00:00:00`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || from > to) throw new Error('Informe um intervalo de datas válido.');
  endDate.setDate(endDate.getDate() + 1);
  return { start: startDate.toISOString(), end: endDate.toISOString() };
}

function statusLabel(value: string): string { return statusNames[value] ?? value; }

export async function loadReportDataset(kind: ReportKind, from: string, to: string): Promise<ReportDataset> {
  const client = requireSupabase();
  const { start, end } = rangeForLocalDates(from, to);

  if (kind === 'revenue') {
    const [orders, sales] = await Promise.all([
      fetchAllPages<OrderReportRow>((fromIndex, toIndex) => client.from('orders_staff_read')
        .select('id,order_number,customer_name,status,payment_status,total,created_at').eq('payment_status', 'PAID')
        .gte('created_at', start).lt('created_at', end).order('created_at').order('id').range(fromIndex, toIndex)),
      fetchAllPages<PosReceiptInput & { id: string }>((fromIndex, toIndex) => client.from('sales')
        .select('id,sale_number,created_at,sale_payments(amount,status)')
        .gte('created_at', start).lt('created_at', end).order('created_at').order('id').range(fromIndex, toIndex)),
    ]);
    const receipts = aggregateConfirmedReceipts(orders, sales);
    return {
      title: reportNames[kind], columns: ['Origem', 'Registro', 'Estado', 'Valor recebido', 'Data do registro'],
      rows: receipts.rows.map((row) => [row.source, row.reference, row.status, money(row.amount), new Date(row.createdAt).toLocaleString('pt-BR')]),
      summary: `Total confirmado por data de criação: ${money(receipts.total)}`,
      note: 'Inclui somente pedidos atualmente pagos e parcelas PDV atualmente confirmadas; o período é pela data de criação do pedido/venda, não pela data da liquidação bancária. O estado operacional e o estado financeiro são distintos.',
    };
  }

  if (kind === 'orders' || kind === 'status') {
    const rows = await fetchAllPages<OrderReportRow>((fromIndex, toIndex) => client.from('orders_staff_read')
      .select('id,order_number,customer_name,status,payment_status,total,created_at')
      .gte('created_at', start).lt('created_at', end).order('created_at').order('id').range(fromIndex, toIndex));
    if (kind === 'status') {
      const counts = new Map<string, number>();
      rows.forEach((row) => counts.set(row.status, (counts.get(row.status) ?? 0) + 1));
      return { title: reportNames[kind], columns: ['Status', 'Pedidos'], rows: [...counts.entries()].map(([status, count]) => [statusLabel(status), String(count)]) };
    }
    return {
      title: reportNames[kind], columns: ['Pedido', 'Cliente', 'Status operacional', 'Pagamento', 'Total', 'Criado em'],
      rows: rows.map((row) => [row.order_number, row.customer_name, statusLabel(row.status), row.payment_status ?? 'Não disponível', row.total === null ? 'Não disponível' : money(row.total), new Date(row.created_at).toLocaleString('pt-BR')]),
    };
  }

  if (kind === 'sales') {
    const rows = await fetchAllPages<SalesReportRow>((fromIndex, toIndex) => client.from('sales')
      .select('id,sale_number,subtotal,discount,total,created_at,cancelled_at')
      .gte('created_at', start).lt('created_at', end).order('created_at').order('id').range(fromIndex, toIndex));
    return {
      title: reportNames[kind], columns: ['Venda', 'Subtotal', 'Desconto', 'Total', 'Estado', 'Data'],
      rows: rows.map((row) => [row.sale_number, money(row.subtotal), money(row.discount), money(row.total), row.cancelled_at ? 'Cancelada' : 'Registrada', new Date(row.created_at).toLocaleString('pt-BR')]),
    };
  }

  if (kind === 'products') {
    const rows = await fetchAllPages<SaleItemReportRow>((fromIndex, toIndex) => client.from('sale_items')
      .select('id,product_name,unit,quantity,line_total,sales!inner(created_at,cancelled_at)')
      .gte('sales.created_at', start).lt('sales.created_at', end).is('sales.cancelled_at', null).order('id').range(fromIndex, toIndex));
    const totals = new Map<string, { quantity: Decimal; gross: Decimal; unit: string }>();
    for (const row of rows) {
      const key = `${row.product_name} (${row.unit})`;
      const previous = totals.get(key) ?? { quantity: new Decimal(0), gross: new Decimal(0), unit: row.unit };
      totals.set(key, { quantity: previous.quantity.plus(row.quantity), gross: previous.gross.plus(row.line_total), unit: previous.unit });
    }
    return {
      title: reportNames[kind], columns: ['Produto', 'Quantidade vendida', 'Subtotal dos itens antes do desconto da venda'],
      rows: [...totals.entries()].sort((a, b) => b[1].quantity.comparedTo(a[1].quantity))
        .map(([name, value]) => [name, `${value.quantity.toString()} ${value.unit}`, money(value.gross.toFixed(2))]),
      note: 'O subtotal soma os valores de linha; não rateia o desconto aplicado ao total da venda.',
    };
  }

  const rows = await fetchAllPages<StockMovementReportRow>((fromIndex, toIndex) => client.from('stock_movements')
    .select('id,created_at,movement_type,products(name,unit),quantity,balance_after,reason')
    .gte('created_at', start).lt('created_at', end).order('created_at').order('id').range(fromIndex, toIndex));
  return {
    title: reportNames.stock, columns: ['Data', 'Produto', 'Movimento', 'Variação', 'Saldo após', 'Justificativa'],
    rows: rows.map((row) => {
      const product = Array.isArray(row.products) ? row.products[0] : row.products;
      return [new Date(row.created_at).toLocaleString('pt-BR'), product?.name ?? 'Produto', row.movement_type, `${row.quantity} ${product?.unit ?? ''}`.trim(), `${row.balance_after} ${product?.unit ?? ''}`.trim(), row.reason];
    }),
  };
}
