import Decimal from 'decimal.js';
import type { SaleUnit } from '../types/domain';

Decimal.set({ precision: 24, rounding: Decimal.ROUND_HALF_UP });

export function money(value: string | number | Decimal): string {
  const amount = new Decimal(value || 0).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  return `R$ ${amount.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

export function quantityText(value: string | number, unit: SaleUnit): string {
  const quantity = new Decimal(value || 0);
  const rendered = unit === 'kg' ? quantity.toFixed(3).replace(/\.?0+$/, '') : quantity.toFixed(0);
  return `${rendered.replace('.', ',')} ${unit}`;
}

const UNIT_TO_GRAMS: Record<SaleUnit, Decimal> = {
  un: new Decimal(0),
  g: new Decimal(1),
  kg: new Decimal(1000),
};

export function convertQuantity(value: string | number, from: SaleUnit, to: SaleUnit): string {
  if (from === 'un' || to === 'un') {
    if (from !== to) throw new Error('Não é possível converter unidade para peso.');
    return new Decimal(value).toFixed(0);
  }
  return new Decimal(value)
    .mul(UNIT_TO_GRAMS[from])
    .div(UNIT_TO_GRAMS[to])
    .toDecimalPlaces(3, Decimal.ROUND_HALF_UP)
    .toFixed(3);
}

export function isValidQuantity(value: string | number, unit: SaleUnit): boolean {
  try {
    const quantity = new Decimal(value);
    if (!quantity.isFinite() || quantity.lte(0)) return false;
    if ((unit === 'un' || unit === 'g') && !quantity.isInteger()) return false;
    if (unit === 'kg' && quantity.decimalPlaces() > 3) return false;
    return quantity.lessThanOrEqualTo('999999999.999');
  } catch {
    return false;
  }
}

export function provisionalLineTotal(unitPrice: string | number, quantity: string | number): string {
  return new Decimal(unitPrice).mul(quantity).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
