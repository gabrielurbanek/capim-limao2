import { describe, expect, it } from 'vitest';
import { aggregateConfirmedReceipts } from './receipts';

const baseOrder = { order_number: '1001', customer_name: 'Ana', status: 'COMPLETED', created_at: '2026-11-17T10:00:00Z' };

describe('recebimentos confirmados', () => {
  it('exclui pedidos não pagos e estornados, sem confundir operação cancelada com estorno', () => {
    const result = aggregateConfirmedReceipts([
      { ...baseOrder, payment_status: 'PAID', total: '10.25' },
      { ...baseOrder, order_number: '1002', status: 'CANCELLED', payment_status: 'PAID', total: '5.00' },
      { ...baseOrder, order_number: '1003', payment_status: 'PENDING', total: '90.00' },
      { ...baseOrder, order_number: '1004', payment_status: 'REFUNDED', total: '30.00' },
      { ...baseOrder, order_number: '1005', payment_status: 'UNPAID', total: '70.00' },
    ], []);
    expect(result.rows.map((row) => row.reference)).toEqual(['1001 · Ana', '1002 · Ana']);
    expect(result.rows[1]?.status).toBe('Pago · Cancelado');
    expect(result.total).toBe('15.25');
  });

  it('soma somente parcelas confirmadas do PDV e usa aritmética decimal exata', () => {
    const result = aggregateConfirmedReceipts([], [{
      sale_number: 'PDV-10', created_at: '2026-11-17T11:00:00Z', sale_payments: [
        { amount: '12.20', status: 'CONFIRMED' },
        { amount: '0.30', status: 'CONFIRMED' },
        { amount: '40.00', status: 'REFUNDED' },
        { amount: '18.00', status: 'PENDING' },
      ],
    }]);
    expect(result.rows[0]?.amount).toBe('12.50');
    expect(result.total).toBe('12.50');
  });
});
