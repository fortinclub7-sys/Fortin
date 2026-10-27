import React from 'react';
import { CheckCircle2, Printer, X, Sparkles } from 'lucide-react';
import { Sale } from '../types';

interface ReceiptModalProps {
  sale: Sale | null;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ sale, onClose }) => {
  if (!sale) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header Banner */}
        <div className={`p-4 text-center text-white ${sale.isTest ? 'bg-purple-600' : 'bg-emerald-600'}`}>
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2">
            <CheckCircle2 className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-black tracking-tight">
            {sale.isTest ? 'VENTA DE PRUEBA REGISTRADA' : '¡VENTA EXITOSA!'}
          </h2>
          <p className="text-xs text-emerald-100 font-medium">
            {sale.isTest ? 'Modo simulación: no afectó existencias reales' : 'Existencias descontadas automáticamente'}
          </p>
        </div>

        {/* Printable Ticket Area */}
        <div id="printable-receipt" className="p-6 bg-slate-50/50 text-slate-800 font-mono text-sm border-b border-dashed border-slate-300">
          <div className="text-center pb-3 border-b border-slate-200">
            <div className="text-xl font-black text-slate-900 tracking-tight">⚽ FORTIN CLUB ⚽</div>
            <div className="text-xs text-slate-600 font-bold">Punto de Venta e Inventario</div>
            <div className="text-xs text-slate-500">Ecuador 🇪🇨 | Moneda: USD ($)</div>
            <div className="mt-2 text-xs font-bold text-slate-700">TICKET: {sale.saleNumber}</div>
            <div className="text-xs text-slate-500">{sale.dateStr} - {sale.timeStr}</div>
          </div>

          {/* Items */}
          <div className="py-3 space-y-1.5 border-b border-slate-200">
            <div className="flex justify-between text-xs text-slate-500 font-semibold uppercase">
              <span>Cant / Producto</span>
              <span>Total</span>
            </div>
            {sale.items.map((item, idx) => (
              <div key={idx} className="flex justify-between items-start text-xs">
                <div className="pr-2">
                  <span className="font-bold">{item.quantity}x</span> {item.name}
                  <div className="text-[10px] text-slate-500">(${item.unitPrice.toFixed(2)} c/u)</div>
                </div>
                <div className="font-bold text-slate-900">
                  ${item.subtotal.toFixed(2)}
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="pt-3 space-y-1 text-xs">
            <div className="flex justify-between items-center text-sm font-black text-slate-900 pt-1">
              <span>TOTAL A PAGAR:</span>
              <span className="text-base text-emerald-700">${sale.totalAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Método de pago:</span>
              <span className="font-bold">{sale.paymentMethod}</span>
            </div>
            {sale.paymentMethod === 'Efectivo' && (
              <>
                <div className="flex justify-between text-slate-600">
                  <span>Efectivo recibido:</span>
                  <span>${(sale.cashReceived || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-sm mt-1">
                  <span>CAMBIO / VUELTO:</span>
                  <span>${(sale.cashChange || 0).toFixed(2)}</span>
                </div>
              </>
            )}
          </div>

          <div className="text-center mt-5 text-[11px] text-slate-500 pt-2 border-t border-slate-200">
            ¡Gracias por su compra! ⚽<br />
            Sistema oficial FORTIN CLUB
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-white flex items-center justify-between gap-3">
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-slate-200 font-bold text-sm text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>Imprimir</span>
          </button>
          
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition-all active:scale-95"
          >
            Nueva Venta
          </button>
        </div>

      </div>
    </div>
  );
};
