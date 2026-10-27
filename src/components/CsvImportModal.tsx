import React, { useState } from 'react';
import { Upload, Download, FileText, CheckCircle2, AlertCircle, X } from 'lucide-react';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (csvText: string) => Promise<number>;
  onExport: () => void;
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
  onExport
}) => {
  const [csvContent, setCsvContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvContent(text);
      setErrorMessage(null);
    };
    reader.readAsText(file);
  };

  const handleDownloadSample = () => {
    const sample = `codigo_interno,codigo_barras,nombre,categoria,precio_venta,costo_compra,stock_inicial,stock_disponible,stock_minimo
BEB-012,7861001400999,Agua con Gas 600ml,Bebidas,0.90,0.55,24,24,6
SNK-010,7861007700999,Platanitos Dulces 50g,Snacks,0.60,0.35,30,30,10`;
    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'plantilla_inventario_cancha.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async () => {
    if (!csvContent.trim()) {
      setErrorMessage('Pega el texto CSV o carga un archivo primero.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      const count = await onImport(csvContent);
      setResultMessage(`¡Se importaron ${count} productos correctamente!`);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al procesar el archivo CSV.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-base">Importar / Exportar Inventario CSV</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">Opciones Rápidas:</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDownloadSample}
                className="text-xs text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar Plantilla CSV</span>
              </button>
              <button
                type="button"
                onClick={onExport}
                className="text-xs text-blue-700 hover:text-blue-900 font-bold flex items-center gap-1 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar Inventario Actual</span>
              </button>
            </div>
          </div>

          {/* File input */}
          <div className="border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-xl p-4 text-center cursor-pointer bg-slate-50 transition-colors">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileUpload}
              className="hidden"
              id="csv-file-input"
            />
            <label htmlFor="csv-file-input" className="cursor-pointer block">
              <FileText className="w-8 h-8 text-slate-400 mx-auto mb-1.5" />
              <p className="text-xs font-bold text-slate-700">
                Haz clic para seleccionar tu archivo CSV
              </p>
              <p className="text-[11px] text-slate-400">o pega el texto en el cuadro inferior</p>
            </label>
          </div>

          {/* Text area */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Contenido CSV (Encabezados: codigo_interno, nombre, categoria, precio_venta, stock_inicial...):
            </label>
            <textarea
              rows={5}
              value={csvContent}
              onChange={(e) => setCsvContent(e.target.value)}
              placeholder="codigo_interno,nombre,categoria,precio_venta,stock_disponible&#10;BEB-100,Gatorade Lima 500ml,Bebidas,1.50,20"
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            />
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-800 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {resultMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{resultMessage}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-800"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isSubmitting || !csvContent.trim()}
              onClick={handleSubmit}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center gap-1.5"
            >
              <Upload className="w-4 h-4" />
              <span>{isSubmitting ? 'Importando...' : 'Importar al Inventario'}</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
