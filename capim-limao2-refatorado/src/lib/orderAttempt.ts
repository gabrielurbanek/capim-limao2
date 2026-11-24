const ORDER_ATTEMPT_KEY = 'capim-limao.checkout-attempt.v1';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface CheckoutCustomerFingerprint {
  name: string;
  phone: string;
  email: string | null;
}

export interface CheckoutItemFingerprint {
  product_id: string;
  quantity: string | number;
}

interface StoredAttempt {
  fingerprint: string;
  key: string;
}

export function checkoutAttemptFingerprint(customer: CheckoutCustomerFingerprint, items: CheckoutItemFingerprint[]): string {
  const normalizedItems = items
    .map((item) => [item.product_id.toLowerCase(), String(item.quantity)] as const)
    .sort(([left], [right]) => left.localeCompare(right));
  return JSON.stringify({
    customer: {
      name: customer.name.trim(),
      phone: customer.phone.replace(/\D/g, ''),
      email: customer.email?.trim().toLowerCase() || null,
    },
    items: normalizedItems,
  });
}

export function persistentOrderAttempt(
  fingerprint: string,
  storage: Pick<Storage, 'getItem' | 'setItem'> = window.localStorage,
  createId: () => string = () => window.crypto.randomUUID(),
): string {
  try {
    const serialized = storage.getItem(ORDER_ATTEMPT_KEY);
    if (serialized) {
      const existing = JSON.parse(serialized) as Partial<StoredAttempt>;
      if (existing.fingerprint === fingerprint && typeof existing.key === 'string' && UUID.test(existing.key)) return existing.key;
    }
    const key = createId();
    storage.setItem(ORDER_ATTEMPT_KEY, JSON.stringify({ fingerprint, key } satisfies StoredAttempt));
    return key;
  } catch {
    return createId();
  }
}

export function clearPersistentOrderAttempt(
  key: string,
  storage: Pick<Storage, 'getItem' | 'removeItem'> = window.localStorage,
): void {
  try {
    const serialized = storage.getItem(ORDER_ATTEMPT_KEY);
    if (!serialized) return;
    const existing = JSON.parse(serialized) as Partial<StoredAttempt>;
    if (existing.key === key) storage.removeItem(ORDER_ATTEMPT_KEY);
  } catch {
    // A resposta persistida pelo servidor continua sendo a fonte de verdade.
  }
}
