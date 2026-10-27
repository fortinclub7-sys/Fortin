export type ProductCategory = 'Bebidas' | 'Snacks';

export type ProductStatus = 'Disponible' | 'Stock bajo' | 'Agotado';

export interface Product {
  id: string;
  internalCode: string;
  barcode?: string;
  name: string;
  category: ProductCategory;
  salePrice: number;     // USD (0 if not yet assigned)
  purchaseCost: number;  // USD
  initialStock: number;
  availableStock: number;
  minStock: number;
  targetStock?: number;  // Configurable target quantity for replenishment
  status: ProductStatus;
  isSixPack?: boolean;
  singleUnitId?: string; // Id of the single bottle/can version
  unitsPerPack?: number; // Usually 6
  createdAt?: string;
  updatedAt?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  subtotal: number;
}

export type PaymentMethod = 'Efectivo' | 'Transferencia' | 'Otros';

export interface SaleItem {
  productId: string;
  internalCode: string;
  name: string;
  category: ProductCategory;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  subtotal: number;
}

export interface Sale {
  id: string;
  saleNumber: string;
  createdAt: string;       // ISO string
  dateStr: string;         // YYYY-MM-DD
  timeStr: string;         // HH:mm
  items: SaleItem[];
  itemsCount: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  cashReceived?: number;
  cashChange?: number;
  status: 'completed' | 'cancelled';
  isTest?: boolean;
}

export interface Replenishment {
  id: string;
  productId: string;
  productName: string;
  internalCode: string;
  quantityAdded: number;
  purchaseCost: number; // Costo unitario
  totalCost: number;
  previousStock: number;
  newStock: number;
  createdAt: string;
  dateStr: string;
  notes?: string;
}

export type MovementType = 'VENTA' | 'REPOSICION' | 'DESEMPAQUE_SIX' | 'AJUSTE_INICIAL' | 'EDICION' | 'AJUSTE_STOCK';

export interface InventoryMovement {
  id: string;
  productId: string;
  productName: string;
  internalCode: string;
  movementType: MovementType;
  previousStock: number;
  quantityChanged: number; // + or -
  finalStock: number;
  referenceId?: string;
  createdAt: string;
  dateStr: string;
  notes?: string;
}

export type ReportPeriod = 'today' | 'yesterday' | 'week' | 'month' | 'custom' | 'all';

export interface SalesReportFilter {
  period: ReportPeriod;
  startDate?: string;
  endDate?: string;
}

export interface AdminUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  isAdmin: boolean;
}
