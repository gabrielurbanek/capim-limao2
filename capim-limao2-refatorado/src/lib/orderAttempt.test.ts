import { describe, expect, it } from 'vitest';
import { checkoutAttemptFingerprint, clearPersistentOrderAttempt, persistentOrderAttempt } from './orderAttempt';

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

const FIRST_KEY = '11111111-1111-4111-8111-111111111111';
const SECOND_KEY = '22222222-2222-4222-8222-222222222222';

describe('idempotência de pedidos online', () => {
  it('reutiliza o ID de retry após remount quando dados e itens não mudam', () => {
    const storage = new MemoryStorage();
    const first = persistentOrderAttempt('{"items":[["p",1]]}', storage, () => FIRST_KEY);
    const afterReload = persistentOrderAttempt('{"items":[["p",1]]}', storage, () => SECOND_KEY);
    expect(first).toBe(FIRST_KEY);
    expect(afterReload).toBe(FIRST_KEY);
  });

  it('cria outra tentativa se o payload muda, para não devolver snapshot antigo', () => {
    const storage = new MemoryStorage();
    persistentOrderAttempt('pedido A', storage, () => FIRST_KEY);
    expect(persistentOrderAttempt('pedido B', storage, () => SECOND_KEY)).toBe(SECOND_KEY);
  });

  it('normaliza telefone/e-mail e a ordem dos itens ao gerar fingerprint', () => {
    const customer = { name: '  Ana  ', phone: '(46) 99999-1111', email: ' ANA@EXAMPLE.COM ' };
    const first = checkoutAttemptFingerprint(customer, [{ product_id: 'B', quantity: 2 }, { product_id: 'A', quantity: '0.500' }]);
    const reordered = checkoutAttemptFingerprint({ name: 'Ana', phone: '46999991111', email: 'ana@example.com' }, [{ product_id: 'a', quantity: '0.500' }, { product_id: 'b', quantity: '2' }]);
    expect(first).toBe(reordered);
  });

  it('apaga o registro somente quando a chave removida corresponde', () => {
    const storage = new MemoryStorage();
    persistentOrderAttempt('pedido A', storage, () => FIRST_KEY);
    persistentOrderAttempt('pedido B', storage, () => SECOND_KEY);
    clearPersistentOrderAttempt(FIRST_KEY, storage);
    expect(persistentOrderAttempt('pedido B', storage, () => FIRST_KEY)).toBe(SECOND_KEY);
    clearPersistentOrderAttempt(SECOND_KEY, storage);
    expect(persistentOrderAttempt('pedido B', storage, () => FIRST_KEY)).toBe(FIRST_KEY);
  });
});
