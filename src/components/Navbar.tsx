import React, { useState } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Wifi, 
  WifiOff, 
  FlaskConical, 
  CheckCircle2,
  HelpCircle,
  AlertTriangle
} from 'lucide-react';
import { AdminUser } from '../types';

interface NavbarProps {
  activeTab: 'ventas' | 'inventario' | 'reportes';
  setActiveTab: (tab: 'ventas' | 'inventario' | 'reportes') => void;
  adminUser: AdminUser;
  onOpenAdminModal: () => void;
  isLiveConnected: boolean;
  isDemoMode: boolean;
  onToggleDemoMode: (enableDemo: boolean) => void;
  onOpenHelpModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  adminUser,
  onOpenAdminModal,
  isLiveConnected,
  isDemoMode,
  onToggleDemoMode,
  onOpenHelpModal
}) => {
  const [showModeConfirm, setShowModeConfirm] = useState(false);
  const [targetMode, setTargetMode] = useState<boolean>(false);

  const handleModeButtonClick = () => {
    setTargetMode(!isDemoMode);
    setShowModeConfirm(true);
  };

  const handleConfirmModeChange = () => {
    onToggleDemoMode(targetMode);
    setShowModeConfirm(false);
  };

  return (
    <>
      <header className="bg-white border-b border-emerald-100 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6">
          <div className="flex items-center justify-between h-16">
            
            {/* Logo & FORTIN CLUB Identity */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-sm ring-2 ring-emerald-500/20">
                <span className="text-xl">⚽</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-lg text-slate-900 tracking-tight">FORTIN CLUB</span>
                  <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-sm">
                    ECUADOR 🇪🇨
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  Punto de Venta e Inventario
                </p>
              </div>
            </div>

            {/* Desktop Navigation Tabs */}
            <nav className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('ventas')}
                className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                  activeTab === 'ventas'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                🛒 Ventas (POS)
              </button>
              <button
                onClick={() => setActiveTab('inventario')}
                className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                  activeTab === 'inventario'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                📦 Inventario
              </button>
              <button
                onClick={() => setActiveTab('reportes')}
                className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                  activeTab === 'reportes'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                📊 Reportes
              </button>
            </nav>

            {/* Right Controls: Cloud sync status, Mode Switch, Admin status */}
            <div className="flex items-center gap-2">
              
              {/* Firestore Cloud Sync Status */}
              <button
                onClick={onOpenAdminModal}
                title={isLiveConnected ? "Conectado a Firestore Cloud" : "Haz clic para conectar con tu cuenta de Google"}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                  isLiveConnected 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100' 
                    : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                }`}
              >
                {isLiveConnected ? <Wifi className="w-3.5 h-3.5 text-emerald-600" /> : <WifiOff className="w-3.5 h-3.5 text-amber-600" />}
                <span className="hidden lg:inline">{isLiveConnected ? 'Firestore Conectado' : 'Conectar Nube'}</span>
              </button>

              {/* Mode Switch: Operación Real vs Modo Pruebas */}
              <button
                onClick={handleModeButtonClick}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs ${
                  isDemoMode 
                    ? 'bg-purple-600 text-white animate-pulse' 
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200'
                }`}
                title="Cambiar entre Operación Real y Modo de Pruebas"
              >
                {isDemoMode ? <FlaskConical className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />}
                <span>{isDemoMode ? 'Pruebas: ACTIVO' : 'Operación Real'}</span>
              </button>

              {/* Admin Profile & Unlock button */}
              <button
                onClick={onOpenAdminModal}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  adminUser.isAdmin
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {adminUser.isAdmin ? (
                  <>
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span className="hidden sm:inline">Admin</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-4 h-4 text-slate-400" />
                    <span className="hidden sm:inline">Cajero</span>
                  </>
                )}
              </button>

              {/* Help & Info */}
              <button
                onClick={onOpenHelpModal}
                title="Validación del Sistema FORTIN CLUB"
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <HelpCircle className="w-5 h-5" />
              </button>

            </div>

          </div>
        </div>
      </header>

      {/* Confirmation Modal to switch between Real Operation and Test Mode */}
      {showModeConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className={`p-2.5 rounded-xl ${targetMode ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {targetMode ? <FlaskConical className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
              </div>
              <div>
                <h4 className="font-black text-slate-800 text-base">
                  {targetMode ? '¿Activar Modo de Pruebas?' : '¿Activar OPERACIÓN REAL Oficial?'}
                </h4>
                <p className="text-xs text-slate-600 mt-1">
                  {targetMode ? (
                    'En el Modo de Pruebas podrás simular ventas y cobros sin alterar las existencias oficiales ni contaminar los reportes de ingresos de FORTIN CLUB.'
                  ) : (
                    'Al activar la OPERACIÓN REAL oficial, todas las ventas descontarán stock real de los 22 productos y se registrarán como ingresos oficiales en los reportes.'
                  )}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowModeConfirm(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmModeChange}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs ${
                  targetMode ? 'bg-purple-600 hover:bg-purple-700' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                Confirmar y Cambiar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
