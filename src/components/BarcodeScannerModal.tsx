import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, X, AlertCircle, Barcode, CheckCircle2 } from 'lucide-react';
import { Product } from '../types';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onProductFound: (product: Product) => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  products,
  onProductFound
}) => {
  const [manualCode, setManualCode] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const readerElementId = 'barcode-reader-viewport';

  // Sound beep
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // 880 Hz
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) {
      // Audio not allowed or failed
    }
  };

  const processBarcode = (scannedCode: string) => {
    const clean = scannedCode.trim();
    if (!clean) return;

    // Search product by barcode or internal code
    const matched = products.find(
      p => (p.barcode && p.barcode.trim() === clean) || p.internalCode.toLowerCase() === clean.toLowerCase()
    );

    if (matched) {
      playBeep();
      setSuccessMessage(`¡Encontrado! ${matched.name} (${matched.category})`);
      setErrorMessage(null);
      setTimeout(() => {
        onProductFound(matched);
        setSuccessMessage(null);
      }, 600);
    } else {
      setErrorMessage(`No se encontró ningún producto con el código: ${clean}`);
      setSuccessMessage(null);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      if (scannerRef.current && isScanning) {
        scannerRef.current.stop().then(() => {
          scannerRef.current?.clear();
          setIsScanning(false);
        }).catch(console.error);
      }
      return;
    }

    let isMounted = true;

    const startScanner = async () => {
      try {
        const html5QrCode = new Html5Qrcode(readerElementId);
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 160 },
            aspectRatio: 1.33
          },
          (decodedText) => {
            if (isMounted) {
              processBarcode(decodedText);
            }
          },
          () => {
            // Frame error - ignore
          }
        );

        if (isMounted) {
          setIsScanning(true);
          setErrorMessage(null);
        }
      } catch (err: any) {
        if (isMounted) {
          setIsScanning(false);
          setErrorMessage(
            'No se pudo acceder a la cámara. Puedes ingresar el código manualmente abajo o verificar los permisos.'
          );
        }
      }
    };

    // Small delay to ensure DOM element exists
    const timer = setTimeout(() => {
      startScanner();
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (scannerRef.current) {
        scannerRef.current.stop().then(() => {
          scannerRef.current?.clear();
        }).catch(() => {});
      }
    };
  }, [isOpen]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    processBarcode(manualCode.trim());
    setManualCode('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-base">Escanear Código de Barras</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera Viewport Area */}
        <div className="p-4 bg-slate-100">
          <div className="relative rounded-xl overflow-hidden bg-black aspect-4/3 flex items-center justify-center shadow-inner">
            <div id={readerElementId} className="w-full h-full" />
            {!isScanning && !errorMessage && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-slate-900/90 p-4 text-center">
                <Camera className="w-8 h-8 text-emerald-400 animate-pulse mb-2" />
                <p className="text-sm font-semibold">Iniciando cámara...</p>
                <p className="text-xs text-slate-400 mt-1">Apunta hacia el código de barras del snack o bebida</p>
              </div>
            )}
          </div>

          {/* Feedback messages */}
          {successMessage && (
            <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-xs font-bold animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-800 text-xs font-medium">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Manual Barcode / Scanner Gun Input */}
        <div className="p-4 bg-white border-t border-slate-100">
          <p className="text-xs font-bold text-slate-600 mb-2 flex items-center gap-1.5">
            <Barcode className="w-4 h-4 text-slate-400" />
            O ingresa el código (o pistola de código de barras USB):
          </p>
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              autoFocus
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Ej: 7861001400015 o BEB-001"
              className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-all"
            >
              Agregar
            </button>
          </form>
          <p className="text-[11px] text-slate-400 mt-2 text-center">
            Compatible con lectores ópticos USB/Bluetooth y cámara de teléfonos.
          </p>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-900"
          >
            Cerrar Escáner
          </button>
        </div>

      </div>
    </div>
  );
};
