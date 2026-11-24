export type SaleUnit = 'un' | 'g' | 'kg';
export type Role = 'OWNER' | 'MANAGER' | 'EMPLOYEE';
export type OrderStatus = 'NEW' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';
export type PaymentStatus = 'UNPAID' | 'PENDING' | 'PAID' | 'REFUNDED';

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category_id: string | null;
  category?: Pick<Category, 'id' | 'name' | 'slug'> | null;
  price: string | number;
  unit: SaleUnit;
  stock_balance: string | number;
  minimum_stock: string | number;
  is_available: boolean;
  is_published: boolean;
  is_featured: boolean;
  created_at?: string;
  product_images?: Array<{ id: string; path: string; alt_text: string | null; sort_order: number }>;
}

export interface CartItem {
  productId: string;
  name: string;
  slug: string;
  unit: SaleUnit;
  unitPrice: string;
  imagePath: string | null;
  quantity: string;
}

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  role: Role | null;
}

export interface OrderSummary {
  id: string;
  order_number: string;
  total: string | number;
  reservation_expires_at: string;
}

export interface StockMovement {
  id: string;
  product_id: string;
  movement_type: string;
  quantity: string | number;
  balance_after: string | number;
  reason: string;
  actor_id: string | null;
  created_at: string;
}

export interface ProductFilters {
  query?: string;
  category?: string;
  categoryIds?: string[];
  orderBy?: 'name' | 'price_asc' | 'price_desc' | 'newest';
  limit?: number;
  offset?: number;
}
