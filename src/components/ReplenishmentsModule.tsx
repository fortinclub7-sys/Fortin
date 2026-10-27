import React, { useState, useMemo } from 'react';
import { 
  PackagePlus, 
  AlertTriangle, 
  CheckCircle2, 
  Search, 
  History, 
  ArrowUpRight, 
  TrendingUp, 
  Settings2,
  DollarSign,
  Plus,
  ArrowRight
} from 'lucide-react';
import { Product, Replenishment } from '../types';

interface ReplenishmentsModuleProps {
  products: Product[];
  replenishments: Replenishment[];
  targetStock: number;
  onSetTargetStock: (target: number) => void;
  onRegisterReplenishment: (
    productId: string,
    quantityAdded: number,
    purchaseCost: number,
    notes: string
  ) => Promise<void>;
  onBackToInventory?: () => void;
}

export const ReplenishmentsModule: React.FC<ReplenishmentsModuleProps> = ({
  products,
  replenishments,
  targetStock,
  onSetTargetStock,
  onRegisterReplenishment,
  onBackToInventory
}) => {
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [quantityAddedInput, setQuantityAddedInput] = useState<string>('');
  const [costInput, setCostInput] = useState<string>('');
  const [notesInput, setNotesInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isConfiguringTarget, setIsConfiguringTarget] = useState(false);
  const [targetStockInput, setTargetStockInput] = useState<string>(String(targetStock));
  const [historySearch, setHistorySearch] = useState('');

  // Products with low or out of stock
  const criticalProducts = useMemo(() => {
    return products.filter(p => p.availableStock <= p.minStock || p.availableStock === 0);
  }, [products]);

  // Selected product object
  const currentProduct = useMemo(() => {
    return products.find(p => p.id === selectedProductId);
  }, [products, selectedProductId]);

  // Suggested replenishment quantity: targetStock - availableStock (if available < target)
  const suggestedReplenishment = useMemo(() => {
    if (!currentProduct) return 0;
    const tgt = currentProduct.targetStock || targetStock;
    return Math.max(0, tgt - currentProduct.availableStock);
  }, [currentProduct, targetStock]);

  // Computed preview of stock
  const parsedQty = parseInt(quantityAddedInput, 10) || 0;
  const previewNewStock = currentProduct ? currentProduct.availableStock + parsedQty : 0;

  // Replenishments summary per product
  const productReplenishmentTotals = useMemo(() => {
    const map = new Map<string, { name: string; totalUnits: number; totalCost: number }>();
    replenishments.forEach(r => {
      const existing = map.get(r.productId) || { name: r.productName, totalUnits: 0, totalCost: 0 };
      existing.totalUnits += r.quantityAdded;
      existing.totalCost += r.totalCost || 0;
      map.set(r.productId, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.totalUnits - a.totalUnits);
  }, [replenishments]);

  const filteredHistory = useMemo(() => {
    if (!historySearch) return replenishments;
    return replenishments.filter(r => 
      r.productName.toLowerCase().includes(historySearch.toLowerCase()) ||
      r.internalCode.toLowerCase().includes(historySearch.toLowerCase()) ||
      (r.notes && r.notes.toLowerCase().includes(historySearch.toLowerCase()))
    );
  }, [replenishments, historySearch]);

  const handleSelectProduct = (product: Product) => {
    setSelectedProductId(product.id);
    const tgt = product.targetStock || targetStock;
    const suggested = Math.max(0, tgt - product.availableStock);
    setQuantityAddedInput(suggested > 0 ? String(suggested) : '12');
    setCostInput(product.purchaseCost > 0 ? product.purchaseCost.toFixed(2) : '');
    setStatusMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) {
      setStatusMessage({ type: 'error', text: 'Por favor selecciona un producto.' });
      return;
    }

    const qty = parseInt(quantityAddedInput, 10);
    if (isNaN(qty) || qty <= 0) {
      setStatusMessage({ type: 'error', text: 'Ingresa una cantidad válida mayor a cero.' });
      return;
    }

    const cost = parseFloat(costInput) || 0;

    try {
      setIsSubmitting(true);
      await onRegisterReplenishment(selectedProductId, qty, cost, notesInput.trim());
      setStatusMessage({
        type: 'success',
        text: `¡Reposición registrada con éxito! ${currentProduct?.name}: Stock anterior ${currentProduct?.availableStock} unid. + Reposición ${qty} unid. ➔ Stock nuevo: ${previewNewStock} unid.`
      });
      setQuantityAddedInput('');
      setCostInput('');
      setNotesInput('');
      setSelectedProductId('');
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Error al guardar la reposición.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveTargetStock = () => {
    const val = parseInt(targetStockInput, 10);
    if (!isNaN(val) && val > 0) {
      onSetTargetStock(val);
      setIsConfiguringTarget(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Title & Target Stock Setting */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <PackagePlus className="w-6 h-6 text-emerald-600" />
            <h2 className="text-xl font-black text-slate-800 tracking-tight">Registrar reposición de mercadería</h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Ingreso de nuevo stock a FORTIN CLUB. Las reposiciones NO se contabilizan como ventas ni ingresos.
          </p>
        </div>

        {/* Target Stock Setting */}
        <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
          <Settings2 className="w-4 h-4 text-emerald-700" />
          <span className="text-xs font-bold text-emerald-900">
            Stock Objetivo Global: <span className="font-black text-emerald-700">{targetStock} unid.</span>
          </span>
          <button
            onClick={() => setIsConfiguringTarget(!isConfiguringTarget)}
            className="text-xs text-emerald-700 hover:text-emerald-900 font-bold underline ml-1"
          >
            {isConfiguringTarget ? 'Cerrar' : 'Ajustar'}
          </button>
        </div>
      </div>

      {isConfiguringTarget && (
        <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-center gap-3">
          <label className="text-xs font-bold text-emerald-900">
            Definir Stock Objetivo sugerido para la siguiente compra (unidades):
          </label>
          <input
            type="number"
            min="1"
            value={targetStockInput}
            onChange={(e) => setTargetStockInput(e.target.value)}
            className="w-20 px-2 py-1 bg-white border border-emerald-300 rounded-lg text-sm font-bold text-center"
          />
          <button
            onClick={handleSaveTargetStock}
            className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-lg shadow-xs"
          >
            Guardar
          </button>
        </div>
      )}

      {/* Low Stock Urgent Replenishment Cards */}
      {criticalProducts.length > 0 && (
        <div className="bg-amber-50/80 border border-amber-200 p-4 rounded-2xl">
          <div className="flex items-center gap-2 text-amber-900 font-bold text-sm mb-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <span>Productos con stock bajo o agotado ({criticalProducts.length})</span>
          </div>
          <p className="text-xs text-amber-800 mb-3">
            Toca cualquiera para cargar su reposición sugerida según el stock objetivo:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {criticalProducts.map(p => {
              const tgt = p.targetStock || targetStock;
              const suggested = Math.max(0, tgt - p.availableStock);
              return (
                <button
                  key={p.id}
                  onClick={() => handleSelectProduct(p)}
                  className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                    selectedProductId === p.id
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-white hover:bg-amber-100/50 border-amber-200 text-slate-800'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-bold text-xs truncate">{p.name}</div>
                    <div className={`text-[11px] font-semibold ${selectedProductId === p.id ? 'text-emerald-100' : 'text-rose-600'}`}>
                      Stock: {p.availableStock} (Mín: {p.minStock})
                    </div>
                  </div>
                  <div className={`text-right shrink-0 px-2 py-1 rounded-lg text-xs font-black ${
                    selectedProductId === p.id ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    +{suggested} sug.
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Replenishment Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Form: Register Replenishment (7 cols) */}
        <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <h3 className="font-black text-slate-800 text-base flex items-center gap-2">
            <Plus className="w-5 h-5 text-emerald-600" />
            <span>Formulario de Ingreso de Mercadería</span>
          </h3>

          {statusMessage && (
            <div className={`p-3 rounded-xl border flex items-start gap-2 text-xs font-bold ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Product selection */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Seleccionar Producto:
              </label>
              <select
                value={selectedProductId}
                onChange={(e) => {
                  const p = products.find(prod => prod.id === e.target.value);
                  if (p) handleSelectProduct(p);
                  else setSelectedProductId('');
                }}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              >
                <option value="">-- Elige un producto de FORTIN CLUB --</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    [{p.category}] {p.name} — Stock actual: {p.availableStock}
                  </option>
                ))}
              </select>
            </div>

            {/* Visual Example Calculation Card */}
            {currentProduct && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                <span className="font-bold text-slate-600 block uppercase tracking-wider text-[10px]">
                  Cálculo de Existencias Resultantes:
                </span>
                <div className="flex items-center justify-between text-slate-800 font-mono">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Stock anterior:</span>
                    <span className="font-bold text-sm">{currentProduct.availableStock} unid.</span>
                  </div>
                  <span className="text-emerald-600 font-bold text-lg">+</span>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Reposición:</span>
                    <span className="font-bold text-sm text-emerald-700">{parsedQty} unid.</span>
                  </div>
                  <span className="text-slate-400 font-bold text-lg">=</span>
                  <div className="text-right">
                    <span className="text-slate-400 block text-[10px]">Stock nuevo:</span>
                    <span className="font-black text-sm text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                      {previewNewStock} unid.
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Quantity and Unit Purchase Cost */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Cantidad Recibida (Unidades) *:
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={quantityAddedInput}
                  onChange={(e) => setQuantityAddedInput(e.target.value)}
                  placeholder="Ej: 24"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Costo Unitario de Compra ($ USD):
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={costInput}
                    onChange={(e) => setCostInput(e.target.value)}
                    placeholder="0.00 (opcional)"
                    className="w-full pl-7 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* Total purchase cost calculation */}
            {parseFloat(costInput) > 0 && parsedQty > 0 && (
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex justify-between text-xs text-slate-700">
                <span className="font-semibold">Inversión Total en esta reposición:</span>
                <span className="font-bold text-emerald-800">
                  ${(parseFloat(costInput) * parsedQty).toFixed(2)} USD
                </span>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Detalle / Proveedor / Factura (Opcional):
              </label>
              <input
                type="text"
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                placeholder="Ej: Pedido semanal cerveza Pilsener"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !selectedProductId}
              className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-black text-sm rounded-xl shadow-md transition-all active:scale-98"
            >
              {isSubmitting ? 'Guardando reposición...' : '✓ Confirmar Ingreso de Mercadería'}
            </button>

          </form>
        </div>

        {/* Right: Replenishment History & Totals Purchased (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Summary of Units Purchased per Product */}
          {productReplenishmentTotals.length > 0 && (
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
              <h4 className="font-black text-slate-800 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>Total de Unidades Compradas por Producto</span>
              </h4>
              <div className="max-h-36 overflow-y-auto space-y-1 text-xs divide-y divide-slate-100">
                {productReplenishmentTotals.map((item, idx) => (
                  <div key={idx} className="pt-1 flex justify-between items-center">
                    <span className="text-slate-700 font-bold truncate pr-2">{item.name}</span>
                    <span className="font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md shrink-0">
                      {item.totalUnits} unid.
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detailed History */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-slate-600" />
                <h3 className="font-black text-slate-800 text-sm">Historial de Reposiciones</h3>
              </div>
              <span className="text-xs text-slate-400 font-bold">
                {replenishments.length} registros
              </span>
            </div>

            <div className="my-2">
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Buscar en el historial..."
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              />
            </div>

            <div className="flex-1 overflow-y-auto max-h-[350px] py-2 space-y-2 divide-y divide-slate-100">
              {filteredHistory.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <PackagePlus className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <p className="font-bold text-xs">Sin registros de reposiciones</p>
                </div>
              ) : (
                filteredHistory.map(rep => (
                  <div key={rep.id} className="pt-2 text-xs">
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-slate-800">{rep.productName}</span>
                      <span className="font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                        +{rep.quantityAdded} unid.
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-500 mt-1">
                      <span>Stock: {rep.previousStock} ➔ {rep.newStock}</span>
                      <span>{rep.dateStr}</span>
                    </div>
                    {rep.totalCost > 0 && (
                      <div className="text-[11px] text-slate-600 mt-0.5">
                        Costo: ${rep.purchaseCost.toFixed(2)} c/u (Total: ${rep.totalCost.toFixed(2)})
                      </div>
                    )}
                    {rep.notes && (
                      <div className="text-[10px] text-slate-400 italic mt-0.5">
                        Nota: {rep.notes}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
