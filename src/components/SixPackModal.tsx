import React, { useState } from 'react';
import { PackageOpen, ArrowRight, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { Product } from '../types';

interface SixPackModalProps {
  isOpen: boolean;
  onClose: () => void;
  sixPackProducts: Product[];
  allProducts: Product[];
  onConvert: (sixPackProductId: string, packsToUnpack: number) => Promise<void>;
}

export const SixPackModal: React.FC<SixPackModalProps> = ({
  isOpen,
  onClose,
  sixPackProducts,
  allProducts,
  onConvert
}) => {
  const [selectedSixId, setSelectedSixId] = useState<string>(
    sixPackProducts[0]?.id || ''
  );
  const [packsCount, setPacksCount] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const currentSix = sixPackProducts.find(p => p.id === selectedSixId) || sixPackProducts[0];
  const linkedSingle = currentSix?.singleUnitId 
    ? allProducts.find(p => p.id === currentSix.singleUnitId) 
    : null;

  const unitsResult = packsCount * (currentSix?.unitsPerPack || 6);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSix) return;
    setError(null);

    if (currentSix.availableStock < packsCount) {
      setError(`Stock insuficiente. Solo tienes ${currentSix.availableStock} SIX disponibles.`);
      return;
    }

    try {
      setIsSubmitting(true);
      await onConvert(currentSix.id, packsCount);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Error al desempacar SIX Pack');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-4 bg-emerald-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PackageOpen className="w-5 h-5 text-emerald-200" />
            <h3 className="font-bold text-base">Operación Controlada: Desempacar SIX Pack</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          
          <p className="text-xs text-slate-600">
            Convierte cajas/packs de SIX en unidades individuales para la venta al detalle. Esta acción descuenta los packs seleccionados y suma automáticamente las unidades a la presentación individual correspondiente, registrando la auditoría en el Kardex.
          </p>

          {/* Select SIX pack product */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Seleccionar Producto SIX Pack:
            </label>
            <select
              value={selectedSixId}
              onChange={(e) => {
                setSelectedSixId(e.target.value);
                setPacksCount(1);
              }}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            >
              {sixPackProducts.map(sp => (
                <option key={sp.id} value={sp.id}>
                  {sp.name} — Stock actual: {sp.availableStock} packs
                </option>
              ))}
            </select>
          </div>

          {currentSix && linkedSingle && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400 block font-semibold">PRESENTACIÓN SIX:</span>
                  <span className="font-bold text-slate-800">{currentSix.name}</span>
                  <span className="text-emerald-700 font-mono block">Stock: {currentSix.availableStock} packs</span>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-400 shrink-0 mx-2" />
                <div className="text-right">
                  <span className="text-slate-400 block font-semibold">INDIVIDUAL VINCULADO:</span>
                  <span className="font-bold text-slate-800">{linkedSingle.name}</span>
                  <span className="text-blue-700 font-mono block">Stock: {linkedSingle.availableStock} botellas</span>
                </div>
              </div>

              {/* Number of packs to unpack */}
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700">
                  Cantidad de SIX a desempacar:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max={Math.max(1, currentSix.availableStock)}
                    value={packsCount}
                    onChange={(e) => setPacksCount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 px-2 py-1.5 text-center font-bold text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                  <span className="text-xs text-slate-500">pack(s)</span>
                </div>
              </div>

              {/* Result preview */}
              <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 text-xs text-emerald-800 font-semibold flex items-center justify-between">
                <span>Resultado:</span>
                <span className="font-bold">
                  -{packsCount} SIX  ➔  +{unitsResult} unidades individuales
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-800 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>¡Conversión completada con éxito!</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !currentSix || currentSix.availableStock < packsCount}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold text-sm rounded-xl shadow-md transition-all"
            >
              {isSubmitting ? 'Procesando...' : 'Confirmar Conversión'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
