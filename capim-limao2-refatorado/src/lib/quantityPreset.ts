import type { SaleUnit } from '../types/domain';

export const portionPresets = ['250g', '500g', '1kg'] as const;
export type PortionPreset = (typeof portionPresets)[number];

export function isPortionPreset(value: string | null | undefined): value is PortionPreset {
  return portionPresets.includes(value as PortionPreset);
}

/** Interpreta o preset como ponto de partida no carrinho; unidades mantêm uma unidade. */
export function quantityForPortion(preset: PortionPreset | undefined, unit: SaleUnit): string {
  if (!preset) return unit === 'kg' ? '0.250' : unit === 'g' ? '100' : '1';
  if (unit === 'un') return '1';
  const grams = preset === '1kg' ? 1000 : Number.parseInt(preset, 10);
  return unit === 'kg' ? (grams / 1000).toFixed(3) : String(grams);
}
