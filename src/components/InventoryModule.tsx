import React, { useState, useMemo } from 'react';
import { 
  Package, 
  PackagePlus, 
  PackageOpen, 
  Search, 
  Edit3, 
  Filter, 
  Plus, 
  FileSpreadsheet, 
  History, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  ArrowUpDown,
  RotateCcw,
  SlidersHorizontal,
  DollarSign,
  Tag,
  Boxes,
  ClipboardList,
  ShieldAlert,
  HelpCircle,
  X
} from 'lucide-react';
import { Product, InventoryMovement, AdminUser } from '../types';
import { ProductFormModal } from './ProductFormModal';
import { SixPackModal } from './SixPackModal';
import { CsvImportModal } from './CsvImportModal';
import { INITIAL_PRODUCTS_OCT_2026 } from '../data/initialProducts';

interface InventoryModuleProps {
  products: Product[];
  movements: InventoryMovement[];
  adminUser: AdminUser;
  onOpenAdminModal: () => void;
  onOpenReplenishments: () => void;
  onSaveProduct: (prod: Partial<Product> & { name: string; category: 'Bebidas' | 'Snacks'; salePrice: number }) => Promise<void>;
  onUpdateProductPrice: (productId: string, price: number) => Promise<void>;
  onAdjustStock: (productId: string, newStock: number, reason: string) => Promise<void>;
  onDeleteProduct: (id: string) => Promise<void>;
  onConvertSixPack: (sixPackProductId: string, packs: number) => Promise<void>;
  onImportCsv: (csvText: string) => Promise<number>;
  onExportCsv: () => void;
  onExportMovementsCsv: () => void;
  onResetInitialInventory: () => void;
}

export const InventoryModule: React.FC<InventoryModuleProps> = ({
  products,
  movements,
  adminUser,
  onOpenAdminModal,
  onOpenReplenishments,
  onSaveProduct,
  onUpdateProductPrice,
  onAdjustStock,
  onDeleteProduct,
  onConvertSixPack,
  onImportCsv,
  onExportCsv,
  onExportMovementsCsv,
  onResetInitialInventory
}) => {
  const [subView, setSubView] = useState<'catalog' | 'pending_replenishment' | 'kardex'>('catalog');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'Bebidas' | 'Snacks'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Disponible' | 'Stock bajo' | 'Agotado'>('all');
  
  // Modals
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isSixModalOpen, setIsSixModalOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);

  // Quick Price Edit Modal
  const [priceModalProduct, setPriceModalProduct] = useState<Product | null>(null);
  const [priceInput, setPriceInput] = useState<string>('');
  const [isSavingPrice, setIsSavingPrice] = useState(false);

  // Stock Adjustment Modal
  const [adjustModalProduct, setAdjustModalProduct] = useState<Product | null>(null);
  const [adjustStockInput, setAdjustStockInput] = useState<string>('');
  const [adjustReasonInput, setAdjustReasonInput] = useState<string>('');
  const [isSavingAdjust, setIsSavingAdjust] = useState(false);

  // Audit Diagnostic Banner state
  const [showAuditModal, setShowAuditModal] = useState(false);

  // Stats
  const stats = useMemo(() => {
    const total = products.length;
    const available = products.filter(p => p.status === 'Disponible').length;
    const low = products.filter(p => p.status === 'Stock bajo').length;
    const out = products.filter(p => p.status === 'Agotado').length;
    const totalStock = products.reduce((sum, p) => sum + p.availableStock, 0);
    const totalValueCost = products.reduce((sum, p) => sum + (p.availableStock * (p.purchaseCost || 0)), 0);
    const totalValueSale = products.reduce((sum, p) => sum + (p.availableStock * (p.salePrice || 0)), 0);

    return { total, available, low, out, totalStock, totalValueCost, totalValueSale };
  }, [products]);

  // Initial Inventory Reconciliation Diagnostic (Specifically checking 27/10/2026 stock vs movements)
  const auditDiscrepancies = useMemo(() => {
    const list: {
      productId: string;
      name: string;
      initialOct27: number;
      currentStock: number;
      movementsSum: number;
      theoreticalStock: number;
      difference: number;
      movementsList: InventoryMovement[];
    }[] = [];

    INITIAL_PRODUCTS_OCT_2026.forEach(initP => {
      const current = products.find(p => p.id === initP.id || p.internalCode === initP.internalCode);
      const prodMovements = movements.filter(m => m.productId === initP.id || m.internalCode === initP.internalCode);
      const movSum = prodMovements.reduce((sum, m) => sum + m.quantityChanged, 0);
      const theoretical = initP.initialStock + movSum;
      const currentVal = current ? current.availableStock : 0;

      if (currentVal !== theoretical) {
        list.push({
          productId: current ? current.id : initP.id,
          name: initP.name,
          initialOct27: initP.initialStock,
          currentStock: currentVal,
          movementsSum: movSum,
          theoreticalStock: theoretical,
          difference: currentVal - theoretical,
          movementsList: prodMovements
        });
      }
    });

    return list;
  }, [products, movements]);

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchCat = categoryFilter === 'all' || p.category === categoryFilter;
      const matchStatus = statusFilter === 'all' || p.status === statusFilter;
      const matchSearch = 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.internalCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.barcode && p.barcode.includes(searchQuery));
      return matchCat && matchStatus && matchSearch;
    });
  }, [products, categoryFilter, statusFilter, searchQuery]);

  // Pending Replenishments (Stock bajo or Agotado)
  const pendingReplenishments = useMemo(() => {
    return products.filter(p => p.availableStock <= p.minStock || p.availableStock === 0);
  }, [products]);

  // Movements filter
  const filteredMovements = useMemo(() => {
    if (!searchQuery) return movements;
    return movements.filter(m => 
      m.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.internalCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.movementType.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [movements, searchQuery]);

  const sixPackProducts = useMemo(() => {
    return products.filter(p => p.isSixPack);
  }, [products]);

  // Open edit modal directly
  const handleEditClick = (product: Product) => {
    setEditingProduct(product);
    setIsProductModalOpen(true);
  };

  // Open create modal directly
  const handleCreateClick = () => {
    setEditingProduct(null);
    setIsProductModalOpen(true);
  };

  const handlePriceClick = (product: Product) => {
    setPriceModalProduct(product);
    setPriceInput(product.salePrice > 0 ? product.salePrice.toFixed(2) : '');
  };

  const handleSavePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!priceModalProduct) return;
    const cleanPrice = priceInput.trim().replace(',', '.');
    const p = parseFloat(cleanPrice);
    if (isNaN(p) || p < 0) {
      alert('Ingresa un precio válido en dólares.');
      return;
    }

    try {
      setIsSavingPrice(true);
      await onUpdateProductPrice(priceModalProduct.id, p);
      setPriceModalProduct(null);
    } catch (err: any) {
      alert(err.message || 'Error al guardar el precio.');
    } finally {
      setIsSavingPrice(false);
    }
  };

  const handleAdjustClick = (product: Product) => {
    setAdjustModalProduct(product);
    setAdjustStockInput(String(product.availableStock));
    setAdjustReasonInput('Ajuste de inventario físico verificado');
  };

  const handleSaveAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustModalProduct) return;
    const newStock = parseInt(adjustStockInput, 10);
    if (isNaN(newStock) || newStock < 0) {
      alert('Ingresa una cantidad de existencias válida.');
      return;
    }

    try {
      setIsSavingAdjust(true);
      await onAdjustStock(adjustModalProduct.id, newStock, adjustReasonInput.trim() || 'Ajuste manual de existencias');
      setAdjustModalProduct(null);
    } catch (err: any) {
      alert(err.message || 'Error al ajustar existencias.');
    } finally {
      setIsSavingAdjust(false);
    }
  };

  // Quick reconcile for an audited product
  const handleReconcileToTheoretical = async (productId: string, theoreticalStock: number, name: string) => {
    const confirmed = window.confirm(
      `¿Deseas conciliar las existencias de "${name}" a ${theoreticalStock} unidades según el inventario oficial del 27/10/2026? Se registrará un movimiento de auditoría en el Kardex.`
    );
    if (!confirmed) return;

    await onAdjustStock(productId, theoreticalStock, `Conciliación con inventario oficial inicial (27/10/2026): ${theoreticalStock} unidades`);
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 pb-24 md:pb-12 space-y-6">
      
      {/* Top Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Package className="w-6 h-6 text-emerald-600" />
            <h2 className="text-xl font-black text-slate-800 tracking-tight">Inventario Oficial FORTIN CLUB</h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            22 productos oficiales. Control de existencias, precios en USD, reposiciones y kardex auditable.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* VISIBLE BUTTON: REGISTRAR REPOSICIÓN */}
          <button
            type="button"
            onClick={onOpenReplenishments}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-xl shadow-md transition-all active:scale-95"
            title="Registrar entrada de mercadería"
          >
            <PackagePlus className="w-4 h-4" />
            <span>Registrar reposición</span>
          </button>

          {/* SIX Pack unpack button */}
          {sixPackProducts.length > 0 && (
            <button
              type="button"
              onClick={() => setIsSixModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-xl font-bold text-xs sm:text-sm transition-all"
              title="Convertir cajas SIX a unidades individuales"
            >
              <PackageOpen className="w-4 h-4 text-purple-600" />
              <span>Desempacar SIX ({sixPackProducts.length})</span>
            </button>
          )}

          {/* Audit Diagnostic Trigger */}
          <button
            type="button"
            onClick={() => setShowAuditModal(true)}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-colors ${
              auditDiscrepancies.length > 0
                ? 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
            title="Auditoría de existencias al 27 de octubre de 2026"
          >
            <ClipboardList className="w-4 h-4 text-amber-700" />
            <span>Auditoría 27/10 {auditDiscrepancies.length > 0 && `(${auditDiscrepancies.length})`}</span>
          </button>

          {/* CSV Import/Export */}
          <button
            type="button"
            onClick={() => setIsCsvModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs sm:text-sm transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-slate-600" />
            <span>CSV</span>
          </button>

          {/* New Product */}
          <button
            type="button"
            onClick={handleCreateClick}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs sm:text-sm shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>+ Nuevo Producto</span>
          </button>

        </div>
      </div>

      {/* KPI Stats Cards - Clickable to instantly filter */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <button
          type="button"
          onClick={() => {
            setStatusFilter('all');
            setCategoryFilter('all');
            setSubView('catalog');
          }}
          className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs text-left hover:border-slate-400 transition-all active:scale-98"
        >
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Catálogo Oficial</span>
          <div className="text-xl font-black text-slate-900 mt-1">{stats.total} productos</div>
          <span className="text-[11px] text-slate-500 font-medium">{stats.totalStock} unidades en total</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusFilter('Disponible');
            setSubView('catalog');
          }}
          className={`p-3.5 rounded-2xl border shadow-xs text-left transition-all active:scale-98 ${
            statusFilter === 'Disponible' ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/30' : 'bg-white border-emerald-200 hover:bg-emerald-50/50'
          }`}
        >
          <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">Disponibles</span>
          <div className="text-xl font-black text-emerald-700 mt-1">{stats.available}</div>
          <span className="text-[11px] text-emerald-600 font-semibold">Clic para filtrar</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusFilter('Stock bajo');
            setSubView('catalog');
          }}
          className={`p-3.5 rounded-2xl border shadow-xs text-left transition-all active:scale-98 ${
            statusFilter === 'Stock bajo' ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/30' : 'bg-white border-amber-200 hover:bg-amber-50/50'
          }`}
        >
          <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">Stock Bajo</span>
          <div className="text-xl font-black text-amber-600 mt-1">{stats.low}</div>
          <span className="text-[11px] text-amber-600 font-semibold">Clic para filtrar</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusFilter('Agotado');
            setSubView('catalog');
          }}
          className={`p-3.5 rounded-2xl border shadow-xs text-left transition-all active:scale-98 ${
            statusFilter === 'Agotado' ? 'bg-rose-50 border-rose-500 ring-2 ring-rose-500/30' : 'bg-white border-rose-200 hover:bg-rose-50/50'
          }`}
        >
          <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider block">Agotados</span>
          <div className="text-xl font-black text-rose-600 mt-1">{stats.out}</div>
          <span className="text-[11px] text-rose-600 font-semibold">Existencias en 0</span>
        </button>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Valor al Costo</span>
          <div className="text-xl font-black text-slate-900 mt-1">${stats.totalValueCost.toFixed(2)}</div>
          <span className="text-[11px] text-slate-400">Capital invertido</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">Valor Venta Proy.</span>
          <div className="text-xl font-black text-emerald-700 mt-1">${stats.totalValueSale.toFixed(2)}</div>
          <span className="text-[11px] text-emerald-600">Ingresos proyectados</span>
        </div>
      </div>

      {/* Sub-view switcher: Catálogo | Pendientes de reposición | Kardex */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 pb-2 gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSubView('catalog')}
            className={`px-4 py-2 font-bold text-sm rounded-xl transition-all ${
              subView === 'catalog'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            📋 Catálogo de Productos ({filteredProducts.length})
          </button>
          
          <button
            type="button"
            onClick={() => setSubView('pending_replenishment')}
            className={`px-4 py-2 font-bold text-sm rounded-xl transition-all flex items-center gap-1.5 ${
              subView === 'pending_replenishment'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-amber-800 bg-amber-50 hover:bg-amber-100'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Pendientes de reposición ({pendingReplenishments.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubView('kardex')}
            className={`px-4 py-2 font-bold text-sm rounded-xl transition-all ${
              subView === 'kardex'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            📜 Kardex / Movimientos ({movements.length})
          </button>
        </div>

        {subView === 'kardex' && (
          <button
            type="button"
            onClick={onExportMovementsCsv}
            className="text-xs font-bold text-slate-700 hover:text-emerald-700 flex items-center gap-1"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Descargar Kardex CSV</span>
          </button>
        )}
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre, código interno o código de barras..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
          />
        </div>

        {subView === 'catalog' && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as any)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-hidden cursor-pointer"
            >
              <option value="all">Todas las Categorías</option>
              <option value="Bebidas">🥤 Bebidas</option>
              <option value="Snacks">🍿 Snacks</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-hidden cursor-pointer"
            >
              <option value="all">Todos los Estados</option>
              <option value="Disponible">🟢 Disponible</option>
              <option value="Stock bajo">🟡 Stock bajo</option>
              <option value="Agotado">🔴 Agotado</option>
            </select>

            {(statusFilter !== 'all' || categoryFilter !== 'all' || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('all');
                  setCategoryFilter('all');
                  setSearchQuery('');
                }}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 underline px-1"
              >
                Limpiar
              </button>
            )}
          </div>
        )}
      </div>

      {/* SUB-VIEW 1: PRODUCT CATALOG TABLE */}
      {subView === 'catalog' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Producto</th>
                  <th className="px-4 py-3">Categoría</th>
                  <th className="px-4 py-3 text-right">P. Venta (USD)</th>
                  <th className="px-4 py-3 text-right">Costo (USD)</th>
                  <th className="px-4 py-3 text-center">Inicial (27/10)</th>
                  <th className="px-4 py-3 text-center">Disponible</th>
                  <th className="px-4 py-3 text-center">Mínimo</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {filteredProducts.map(product => {
                  const isLow = product.availableStock <= product.minStock && product.availableStock > 0;
                  const isOut = product.availableStock <= 0;
                  const hasPrice = product.salePrice && product.salePrice > 0;

                  return (
                    <tr key={product.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-mono text-slate-500 text-xs">
                        {product.internalCode}
                        {product.barcode && (
                          <div className="text-[10px] text-slate-400 font-mono">{product.barcode}</div>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{product.name}</div>
                        {product.isSixPack && (
                          <span className="text-[10px] font-black bg-purple-100 text-purple-800 px-1.5 py-0.2 rounded-md">
                            SIX PACK (x6)
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-bold ${
                          product.category === 'Bebidas'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-amber-50 text-amber-800'
                        }`}>
                          {product.category}
                        </span>
                      </td>

                      {/* Sale price */}
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handlePriceClick(product)}
                          className={`font-mono font-bold px-2 py-1 rounded-lg transition-all ${
                            hasPrice 
                              ? 'text-emerald-700 hover:bg-emerald-50' 
                              : 'text-amber-700 bg-amber-50 hover:bg-amber-100 text-xs font-black'
                          }`}
                          title="Clic para editar precio de venta"
                        >
                          {hasPrice ? `$${product.salePrice.toFixed(2)}` : '⚠️ Fijar Precio'}
                        </button>
                      </td>

                      <td className="px-4 py-3 text-right font-mono text-slate-500 text-xs">
                        {product.purchaseCost > 0 ? `$${product.purchaseCost.toFixed(2)}` : '-'}
                      </td>

                      <td className="px-4 py-3 text-center font-mono text-slate-400 text-xs">
                        {product.initialStock}
                      </td>

                      {/* Available Stock with quick adjust */}
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleAdjustClick(product)}
                          className={`font-black font-mono text-sm px-2.5 py-0.5 rounded-lg transition-all hover:scale-105 ${
                            isOut 
                              ? 'bg-rose-100 text-rose-800' 
                              : isLow 
                                ? 'bg-amber-100 text-amber-800' 
                                : 'bg-emerald-50 text-emerald-800'
                          }`}
                          title="Clic para ajustar stock manualmente"
                        >
                          {product.availableStock}
                        </button>
                      </td>

                      <td className="px-4 py-3 text-center font-mono text-slate-500 text-xs">
                        {product.minStock}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          product.status === 'Disponible'
                            ? 'bg-emerald-100 text-emerald-800'
                            : product.status === 'Stock bajo'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                        }`}>
                          {product.status === 'Disponible' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                          {product.status === 'Stock bajo' && <AlertTriangle className="w-3 h-3 text-amber-600" />}
                          {product.status === 'Agotado' && <XCircle className="w-3 h-3 text-rose-600" />}
                          <span>{product.status}</span>
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* Price edit */}
                          <button
                            type="button"
                            onClick={() => handlePriceClick(product)}
                            className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50 transition-colors"
                            title="Editar precio de venta ($)"
                          >
                            <DollarSign className="w-4 h-4" />
                          </button>

                          {/* Stock adjust */}
                          <button
                            type="button"
                            onClick={() => handleAdjustClick(product)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                            title="Ajuste manual de existencias"
                          >
                            <SlidersHorizontal className="w-4 h-4" />
                          </button>

                          {/* Full Edit Modal */}
                          <button
                            type="button"
                            onClick={() => handleEditClick(product)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-slate-100 transition-colors"
                            title="Editar ficha completa del producto"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {/* SIX pack unpack */}
                          {product.isSixPack && product.availableStock > 0 && (
                            <button
                              type="button"
                              onClick={() => setIsSixModalOpen(true)}
                              className="p-1.5 rounded-lg text-purple-600 hover:bg-purple-50 transition-colors"
                              title="Desempacar este SIX pack"
                            >
                              <PackageOpen className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-VIEW 2: PENDIENTES DE REPOSICIÓN */}
      {subView === 'pending_replenishment' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="p-4 bg-amber-50/70 border-b border-amber-200 flex items-center justify-between">
            <div>
              <h3 className="font-black text-amber-900 text-sm flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Vista: Pendientes de reposición de mercadería</span>
              </h3>
              <p className="text-xs text-amber-800 mt-0.5">
                Productos con existencias en cero o inferiores al stock mínimo de seguridad.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenReplenishments}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-xs"
            >
              + Ir a Registrar Reposición
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Producto</th>
                  <th className="px-4 py-3">Categoría</th>
                  <th className="px-4 py-3 text-center">Stock Disponible</th>
                  <th className="px-4 py-3 text-center">Stock Mínimo</th>
                  <th className="px-4 py-3 text-center">Stock Objetivo</th>
                  <th className="px-4 py-3 text-center">Cantidad Sugerida</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {pendingReplenishments.map(p => {
                  const target = p.targetStock || 15;
                  const suggested = Math.max(0, target - p.availableStock);

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-mono text-slate-500 text-xs">{p.internalCode}</td>
                      <td className="px-4 py-3 font-bold text-slate-900">{p.name}</td>
                      <td className="px-4 py-3">
                        <span className="text-[11px] font-bold text-slate-600">{p.category}</span>
                      </td>
                      <td className="px-4 py-3 text-center font-black font-mono text-sm">
                        <span className={`px-2 py-0.5 rounded-md ${
                          p.availableStock === 0 ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {p.availableStock}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-slate-500">{p.minStock}</td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-slate-700">{target}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-900 rounded-lg font-black font-mono text-xs">
                          +{suggested} unid.
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          p.availableStock === 0 ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={onOpenReplenishments}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-2xs"
                        >
                          Reponer
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {pendingReplenishments.length === 0 && (
            <div className="py-12 text-center text-slate-400">
              <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-600 mb-2" />
              <p className="font-bold text-slate-700">¡Todo en orden!</p>
              <p className="text-xs text-slate-500">Ningún producto se encuentra agotado o con stock bajo.</p>
            </div>
          )}
        </div>
      )}

      {/* SUB-VIEW 3: KARDEX / MOVEMENTS AUDIT LOG */}
      {subView === 'kardex' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700">
              Registro inmutable de movimientos: Ventas, Reposiciones, Desempaque de SIX y Ajustes
            </span>
            <span className="text-slate-400 font-mono">{filteredMovements.length} movimientos</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-3">Fecha / Hora</th>
                  <th className="px-4 py-3">Producto</th>
                  <th className="px-4 py-3">Tipo Movimiento</th>
                  <th className="px-4 py-3 text-center">Stock Anterior</th>
                  <th className="px-4 py-3 text-center">Variación</th>
                  <th className="px-4 py-3 text-center">Stock Final</th>
                  <th className="px-4 py-3">Referencia / Notas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {filteredMovements.map(mov => {
                  const isPositive = mov.quantityChanged > 0;
                  return (
                    <tr key={mov.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">
                        {new Date(mov.createdAt).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>

                      <td className="px-4 py-3 font-bold text-slate-900">
                        {mov.productName}
                        <div className="text-[10px] text-slate-400 font-mono">{mov.internalCode}</div>
                      </td>

                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                          mov.movementType === 'VENTA'
                            ? 'bg-emerald-100 text-emerald-800'
                            : mov.movementType === 'REPOSICION'
                              ? 'bg-blue-100 text-blue-800'
                              : mov.movementType === 'DESEMPAQUE_SIX'
                                ? 'bg-purple-100 text-purple-800'
                                : mov.movementType === 'AJUSTE_STOCK'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-100 text-slate-700'
                        }`}>
                          {mov.movementType}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center font-mono text-slate-500">
                        {mov.previousStock}
                      </td>

                      <td className="px-4 py-3 text-center font-mono font-black">
                        <span className={`px-2 py-0.5 rounded-md ${
                          isPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}>
                          {isPositive ? `+${mov.quantityChanged}` : mov.quantityChanged}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center font-mono font-bold text-slate-900">
                        {mov.finalStock}
                      </td>

                      <td className="px-4 py-3 text-xs text-slate-600">
                        {mov.notes || mov.referenceId || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredMovements.length === 0 && (
            <div className="py-12 text-center text-slate-400">
              <History className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="font-bold">No se registran movimientos aún</p>
              <p className="text-xs mt-1">Realiza ventas o reposiciones para poblar el kardex.</p>
            </div>
          )}
        </div>
      )}

      {/* QUICK PRICE EDIT MODAL */}
      {priceModalProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-100 p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h4 className="font-black text-slate-800 text-sm flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                <span>Editar Precio de Venta (USD)</span>
              </h4>
              <button
                type="button"
                onClick={() => setPriceModalProduct(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                title="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Producto: <span className="font-bold text-slate-800">{priceModalProduct.name}</span>
            </p>

            <form onSubmit={handleSavePrice} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Nuevo Precio de Venta ($ USD):
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    autoFocus
                    value={priceInput}
                    onChange={(e) => setPriceInput(e.target.value)}
                    placeholder="1.50"
                    className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Las ventas pasadas conservarán sus precios históricos originales.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPriceModalProduct(null)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingPrice}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs"
                >
                  {isSavingPrice ? 'Guardando...' : 'Guardar Precio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STOCK ADJUSTMENT MODAL */}
      {adjustModalProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h4 className="font-black text-slate-800 text-sm flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-emerald-600" />
                <span>Ajuste Manual de Existencias</span>
              </h4>
              <button
                type="button"
                onClick={() => setAdjustModalProduct(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                title="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <span className="font-bold text-slate-800">{adjustModalProduct.name}</span>
              <div className="flex justify-between mt-1">
                <span>Stock registrado actual:</span>
                <span className="font-black text-slate-900">{adjustModalProduct.availableStock} unidades</span>
              </div>
            </div>

            <form onSubmit={handleSaveAdjust} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Existencias Reales Físicas (Nuevo Stock):
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  autoFocus
                  value={adjustStockInput}
                  onChange={(e) => setAdjustStockInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Motivo del Ajuste (Auditoría Kardex):
                </label>
                <input
                  type="text"
                  required
                  value={adjustReasonInput}
                  onChange={(e) => setAdjustReasonInput(e.target.value)}
                  placeholder="Ej: Conteo físico, rotura o ajuste auditado"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustModalProduct(null)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingAdjust}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs"
                >
                  {isSavingAdjust ? 'Guardando...' : 'Registrar Ajuste'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INITIAL INVENTORY AUDIT MODAL (Section 6) */}
      {showAuditModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 my-6">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-base">Auditoría de Existencias Oficiales (27/10/2026)</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAuditModal(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto text-xs text-slate-700">
              <p className="text-slate-600">
                Esta herramienta compara las existencias actuales con el inventario inicial oficial del <strong>27 de octubre de 2026 (165 unidades en 22 productos)</strong> y verifica si las diferencias corresponden a ventas reales, reposiciones o si requieren conciliación:
              </p>

              {auditDiscrepancies.length === 0 ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center text-emerald-800 font-bold">
                  ✓ Todas las existencias coinciden matemáticamente con el inventario oficial del 27/10/2026 y los movimientos registrados en el Kardex.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 font-bold flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                    <span>Se detectaron {auditDiscrepancies.length} productos con variación frente al balance teórico:</span>
                  </div>

                  <div className="space-y-2">
                    {auditDiscrepancies.map(d => (
                      <div key={d.productId} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                        <div className="flex justify-between items-start font-bold">
                          <span className="text-slate-900 text-sm">{d.name}</span>
                          <span className="text-slate-500">
                            Actual: <strong className="text-slate-900 font-mono">{d.currentStock}</strong> | Oficial 27/10: <strong className="font-mono">{d.initialOct27}</strong>
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-600">
                          {d.movementsList.length > 0 ? (
                            <span>
                              Movimientos registrados: {d.movementsList.map(m => `${m.movementType} (${m.quantityChanged > 0 ? '+' : ''}${m.quantityChanged})`).join(', ')}.
                            </span>
                          ) : (
                            <span className="text-amber-800 font-semibold">
                              ⚠️ No existen ventas ni movimientos que justifiquen la variación de {d.initialOct27} a {d.currentStock} unidades.
                            </span>
                          )}
                        </div>

                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            onClick={() => handleReconcileToTheoretical(d.productId, d.initialOct27, d.name)}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs"
                          >
                            Conciliar a {d.initialOct27} unidades
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowAuditModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl"
              >
                Cerrar Auditoría
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Form Modal */}
      <ProductFormModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        product={editingProduct}
        allProducts={products}
        onSave={onSaveProduct}
        onDelete={onDeleteProduct}
      />

      {/* Six Pack Modal */}
      <SixPackModal
        isOpen={isSixModalOpen}
        onClose={() => setIsSixModalOpen(false)}
        sixPackProducts={sixPackProducts}
        allProducts={products}
        onConvert={onConvertSixPack}
      />

      {/* CSV Import Modal */}
      <CsvImportModal
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        onImport={onImportCsv}
        onExport={onExportCsv}
      />

    </div>
  );
};
