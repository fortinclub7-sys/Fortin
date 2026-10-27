import React from 'react';
import { CheckCircle2, ShieldCheck, X, HelpCircle, AlertCircle, Database, Smartphone, Tag, RefreshCw } from 'lucide-react';

interface HelpAndVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpAndVerificationModal: React.FC<HelpAndVerificationModalProps> = ({
  isOpen,
  onClose
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-6">
        
        {/* Header */}
        <div className="p-4 bg-emerald-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚽</span>
            <div>
              <h3 className="font-bold text-base">Validación y Operación Oficial FORTIN CLUB</h3>
              <p className="text-xs text-emerald-200">Punto de Venta e Inventario</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs sm:text-sm text-slate-700">
          
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-emerald-900">Catálogo e Inventario Oficial del 27 de Octubre de 2026</h4>
              <p className="text-xs text-emerald-800 mt-1">
                Se cargaron con exactitud los 22 productos y 165 unidades iniciales proporcionadas (24 unidades de snacks y 141 unidades de bebidas).
              </p>
            </div>
          </div>

          {/* Detailed Verification Checklist */}
          <div className="space-y-3">
            <h4 className="font-black text-slate-800 text-sm border-b pb-1">
              Verificaciones de Seguridad y Operatividad:
            </h4>

            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-800">1. Catálogo real de 22 productos y 165 unidades:</span>
                  <p className="text-slate-500 text-xs">
                    Panchitos (3), Chifles pequeños (3), Papa crema cebolla (1), Galletas Amor (2), Chupetes (3), Mentas (0), Gomitas (0), Lark individual (6), Marlboro sandía (3), Marlboro mora (3), Six Pilsener (1), Six Club (1), Six Corona (1), Güitig (5), Agua Cielo pequeña (23), Agua Cielo grande (9), Agua grande Omizu (5), Powerade grande (4), Powerade pequeño (1), Colas pequeñas (17), Pilsener (65), Club (9).
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-800">2. Precios en USD y protección contra precios no asignados:</span>
                  <p className="text-slate-500 text-xs">
                    No se inventaron precios. Cada producto muestra "Fijar Precio" hasta que el administrador le asigne su valor oficial. El POS impide vender productos sin precio válido.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-800">3. Transacciones atómicas y descuento estricto de existencias:</span>
                  <p className="text-slate-500 text-xs">
                    Al confirmar la venta se descuentan exactamente las unidades vendidas. Si el stock no alcanza, la operación se cancela sin admitir ventas parciales ni duplicadas.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-800">4. Conversión controlada de presentaciones SIX:</span>
                  <p className="text-slate-500 text-xs">
                    SIX PILSENER, SIX CLUB y SIX CORONA tienen stock independiente. El botón "Desempacar SIX" resta 1 pack y suma 6 botellas individuales al producto vinculado, registrando el movimiento en el Kardex.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-800">5. Reposiciones de mercadería y Kardex auditable:</span>
                  <p className="text-slate-500 text-xs">
                    El botón "Registrar reposición" suma mercadería (ej: 10 + 24 = 34) y guarda el costo de compra sin computarse jamás como ingreso por ventas.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-800">6. Reportes oficiales y separación de pruebas:</span>
                  <p className="text-slate-500 text-xs">
                    Filtros de hoy, ayer, semana, mes y rango. Diferenciación estricta entre ventas reales y ventas de prueba, con cálculo de ganancia bruta estimada y exportación CSV.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Manual checks reminder */}
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
            <h5 className="font-bold text-amber-900 text-xs mb-1">📋 Comprobaciones recomendadas antes de iniciar jornada:</h5>
            <ol className="list-decimal list-inside text-xs text-amber-800 space-y-1">
              <li>Haz clic en "⚠️ Fijar Precio" en la sección Inventario para colocar los precios de venta en dólares a los productos que vayas a comercializar hoy.</li>
              <li>Inicia sesión con tu cuenta Google oficial (<span className="font-mono font-bold">fortinclub7@gmail.com</span>) para sincronizar Firestore Cloud entre todos los celulares y computadoras del club.</li>
              <li>Verifica que la barra superior indique <strong>"Operación Real"</strong>.</li>
            </ol>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs"
          >
            Entendido
          </button>
        </div>

      </div>
    </div>
  );
};
