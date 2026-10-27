import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, AlertCircle } from 'lucide-react';
import { Product } from '../types';

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null; // If null, creating new
  allProducts: Product[];
  onSave: (prod: Partial<Product> & { name: string; category: 'Bebidas' | 'Snacks'; salePrice: number }) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  onClose,
  product,
  allProducts,
  onSave,
  onDelete
}) => {
  const [internalCode, setInternalCode] = useState('');
  const [barcode, setBarcode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<'Bebidas' | 'Snacks'>('Bebidas');
  const [salePrice, setSalePrice] = useState('');
  const [purchaseCost, setPurchaseCost] = useState('');
  const [availableStock, setAvailableStock] = useState('');
  const [minStock, setMinStock] = useState('3');
  const [targetStock, setTargetStock] = useState('15');
  const [isSixPack, setIsSixPack] = useState(false);
  const [singleUnitId, setSingleUnitId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (product) {
      setInternalCode(product.internalCode || '');
      setBarcode(product.barcode || '');
      setName(product.name || '');
      setCategory(product.category || 'Bebidas');
      setSalePrice(product.salePrice > 0 ? String(product.salePrice) : '');
      setPurchaseCost(product.purchaseCost > 0 ? String(product.purchaseCost) : '');
      setAvailableStock(String(product.availableStock ?? 0));
      setMinStock(String(product.minStock ?? 3));
      setTargetStock(String(product.targetStock ?? 15));
      setIsSixPack(Boolean(product.isSixPack));
      setSingleUnitId(product.singleUnitId || '');
    } else {
      setInternalCode('');
      setBarcode('');
      setName('');
      setCategory('Bebidas');
      setSalePrice('');
      setPurchaseCost('');
      setAvailableStock('10');
      setMinStock('3');
      setTargetStock('15');
      setIsSixPack(false);
      setSingleUnitId('');
    }
    setError(null);
  }, [product, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('El nombre del producto es obligatorio.');
      return;
    }

    // Support both dot and comma as decimal separator
    const cleanPrice = salePrice.trim().replace(',', '.');
    const price = cleanPrice ? parseFloat(cleanPrice) : 0;
    if (isNaN(price) || price < 0) {
      setError('Ingresa un precio de venta válido en dólares (o 0 si aún no está asignado).');
      return;
    }

    const cleanCost = purchaseCost.trim().replace(',', '.');
    const cost = cleanCost ? parseFloat(cleanCost) : 0;
    if (isNaN(cost) || cost < 0) {
      setError('El costo de compra debe ser un valor positivo o cero.');
      return;
    }

    const stock = parseInt(availableStock, 10);
    if (isNaN(stock) || stock < 0) {
      setError('Ingresa una cantidad de existencias válida (cero o mayor).');
      return;
    }

    const min = parseInt(minStock, 10);
    if (isNaN(min) || min < 0) {
      setError('El stock mínimo debe ser cero o mayor.');
      return;
    }

    const target = parseInt(targetStock, 10) || 15;

    try {
      setIsSubmitting(true);
      await onSave({
        id: product?.id,
        internalCode: internalCode.trim(),
        barcode: barcode.trim(),
        name: name.trim(),
        category,
        salePrice: price,
        purchaseCost: cost,
        availableStock: stock,
        minStock: min,
        targetStock: target,
        isSixPack,
        singleUnitId: isSixPack ? singleUnitId : undefined,
        unitsPerPack: isSixPack ? 6 : undefined
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al guardar el producto.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!product || !onDelete) return;
    const confirmed = window.confirm(
      `¿Confirmas la eliminación del producto "${product.name}" del catálogo activo?\n\nNota: Las ventas pasadas y movimientos en el Kardex se conservarán intactos para mantener la integridad de los reportes.`
    );
    if (!confirmed) return;

    try {
      setIsSubmitting(true);
      await onDelete(product.id);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al eliminar el producto.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-6">
        
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <h3 className="font-bold text-base">
            {product ? 'Editar Producto del Catálogo' : 'Nuevo Producto de Inventario'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-800 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Name & Category */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Nombre del Producto *:
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Gatorade Mora 500ml"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Categoría *:
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                >
                  <option value="Bebidas">🥤 Bebidas</option>
                  <option value="Snacks">🍿 Snacks</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Código Interno:
                </label>
                <input
                  type="text"
                  value={internalCode}
                  onChange={(e) => setInternalCode(e.target.value)}
                  placeholder="Ej: BEB-012"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Código de Barras (Opcional):
              </label>
              <input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Ej: 7861008500114"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Prices in USD */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Precio de Venta ($ USD) *:
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                placeholder="0.00 (ej: 1.50)"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-emerald-800 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">En dólares estadounidenses</span>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Costo de Compra ($ USD):
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={purchaseCost}
                onChange={(e) => setPurchaseCost(e.target.value)}
                placeholder="0.00 (opcional)"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Para cálculo de ganancia</span>
            </div>
          </div>

          {/* Stocks */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Stock Disponible *:
              </label>
              <input
                type="number"
                min="0"
                required
                value={availableStock}
                onChange={(e) => setAvailableStock(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Existencias físicas</span>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Stock Mínimo:
              </label>
              <input
                type="number"
                min="0"
                value={minStock}
                onChange={(e) => setMinStock(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Alerta "Stock bajo"</span>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Stock Objetivo:
              </label>
              <input
                type="number"
                min="0"
                value={targetStock}
                onChange={(e) => setTargetStock(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Para sugerencias</span>
            </div>
          </div>

          {/* SIX Pack Linked Settings */}
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isSixPack"
                checked={isSixPack}
                onChange={(e) => setIsSixPack(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded-sm focus:ring-emerald-500"
              />
              <label htmlFor="isSixPack" className="text-xs font-bold text-slate-800 cursor-pointer">
                ¿Es una presentación SIX PACK (Pack de 6 unidades)?
              </label>
            </div>

            {isSixPack && (
              <div className="pl-6">
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Vincular a la presentación individual correspondiente:
                </label>
                <select
                  value={singleUnitId}
                  onChange={(e) => setSingleUnitId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">-- Seleccionar producto individual --</option>
                  {allProducts
                    .filter(p => !p.isSixPack && p.id !== product?.id)
                    .map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.internalCode})
                      </option>
                    ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Permite convertir 1 SIX en 6 unidades individuales con la operación controlada.
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            {product && onDelete ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="px-3 py-2 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
                title="Eliminar producto del catálogo activo"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar</span>
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-800"
                title="Cerrar sin guardar"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>{isSubmitting ? 'Guardando...' : 'Guardar Producto'}</span>
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
};
