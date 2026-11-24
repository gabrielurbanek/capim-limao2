import { createContext, useContext, type ReactNode } from 'react';
import type { Product } from '../types/domain';

const StaticProductContext = createContext<Product | null>(null);
export function StaticProductProvider({ product, children }: { product: Product | null; children: ReactNode }) {
  return <StaticProductContext.Provider value={product}>{children}</StaticProductContext.Provider>;
}
export function useStaticProduct(): Product | null {
  return useContext(StaticProductContext);
}
