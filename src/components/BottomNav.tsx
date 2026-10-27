import React from 'react';
import { ShoppingBag, Boxes, BarChart3 } from 'lucide-react';

interface BottomNavProps {
  activeTab: 'ventas' | 'inventario' | 'reportes';
  setActiveTab: (tab: 'ventas' | 'inventario' | 'reportes') => void;
  cartItemCount?: number;
  lowStockCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  setActiveTab,
  cartItemCount = 0,
  lowStockCount = 0
}) => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-40 px-3 py-1 shadow-lg pb-[env(safe-area-inset-bottom,8px)]">
      <div className="grid grid-cols-3 gap-1">
        
        {/* 1. Ventas */}
        <button
          onClick={() => setActiveTab('ventas')}
          className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all relative ${
            activeTab === 'ventas'
              ? 'text-emerald-700 bg-emerald-50/80 font-bold'
              : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
        >
          <div className="relative">
            <ShoppingBag className={`w-6 h-6 ${activeTab === 'ventas' ? 'text-emerald-600 stroke-[2.5]' : 'stroke-2'}`} />
            {cartItemCount > 0 && (
              <span className="absolute -top-1.5 -right-2.5 bg-emerald-600 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center ring-2 ring-white">
                {cartItemCount}
              </span>
            )}
          </div>
          <span className="text-xs mt-1">1. Ventas</span>
        </button>

        {/* 2. Inventario */}
        <button
          onClick={() => setActiveTab('inventario')}
          className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all relative ${
            activeTab === 'inventario'
              ? 'text-emerald-700 bg-emerald-50/80 font-bold'
              : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
        >
          <div className="relative">
            <Boxes className={`w-6 h-6 ${activeTab === 'inventario' ? 'text-emerald-600 stroke-[2.5]' : 'stroke-2'}`} />
            {lowStockCount > 0 && (
              <span className="absolute -top-1 -right-2 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full ring-2 ring-white">
                {lowStockCount}
              </span>
            )}
          </div>
          <span className="text-xs mt-1">2. Inventario</span>
        </button>

        {/* 3. Reportes */}
        <button
          onClick={() => setActiveTab('reportes')}
          className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all ${
            activeTab === 'reportes'
              ? 'text-emerald-700 bg-emerald-50/80 font-bold'
              : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
        >
          <BarChart3 className={`w-6 h-6 ${activeTab === 'reportes' ? 'text-emerald-600 stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-xs mt-1">3. Reportes</span>
        </button>

      </div>
    </nav>
  );
};
