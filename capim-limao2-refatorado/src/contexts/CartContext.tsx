import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import Decimal from 'decimal.js';
import { isValidQuantity } from '../lib/format';
import type { CartItem, Product } from '../types/domain';

interface CartContextValue {
  items: CartItem[];
  count: number;
  subtotal: Decimal;
  addProduct: (product: Product, quantity: string) => void;
  setQuantity: (productId: string, quantity: string) => void;
  removeProduct: (productId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = 'capim-limao-cart-v1';

function loadCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]') as CartItem[];
    return Array.isArray(parsed) ? parsed.filter((item) => item.productId && isValidQuantity(item.quantity, item.unit)) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setItems(loadCart());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  const addProduct = useCallback((product: Product, quantity: string) => {
    if (!isValidQuantity(quantity, product.unit)) throw new Error(`Informe uma quantidade válida em ${product.unit}.`);
    setItems((previous) => {
      const existing = previous.find((item) => item.productId === product.id);
      if (!existing) {
        return [...previous, {
          productId: product.id,
          name: product.name,
          slug: product.slug,
          unit: product.unit,
          unitPrice: String(product.price),
          imagePath: product.product_images?.[0]?.path ?? null,
          quantity,
        }];
      }
      const nextQuantity = new Decimal(existing.quantity).plus(quantity).toFixed(product.unit === 'kg' ? 3 : 0);
      if (!isValidQuantity(nextQuantity, product.unit)) throw new Error('A quantidade somada não é válida.');
      return previous.map((item) => item.productId === product.id ? { ...item, quantity: nextQuantity } : item);
    });
  }, []);

  const setQuantity = useCallback((productId: string, quantity: string) => {
    setItems((previous) => previous.map((item) => item.productId === productId && isValidQuantity(quantity, item.unit)
      ? { ...item, quantity }
      : item));
  }, []);

  const removeProduct = useCallback((productId: string) => {
    setItems((previous) => previous.filter((item) => item.productId !== productId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum.plus(new Decimal(item.unitPrice).mul(item.quantity)), new Decimal(0));
    return { items, count: items.length, subtotal, addProduct, setQuantity, removeProduct, clear };
  }, [items, addProduct, setQuantity, removeProduct, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart precisa estar dentro de CartProvider.');
  return context;
}
