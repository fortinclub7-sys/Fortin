import React, { useState, useMemo } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  ShoppingBag, 
  Package, 
  Calendar, 
  Download, 
  PieChart, 
  AlertTriangle,
  Award,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  History,
  CheckCircle2,
  XCircle,
  FileSpreadsheet
} from 'lucide-react';
import { Sale, Product, Replenishment, InventoryMovement } from '../types';

interface ReportsModuleProps {
  sales: Sale[];
  products: Product[];
  replenishments: Replenishment[];
  movements: InventoryMovement[];
  onExportSalesCsv: () => void;
  onExportInventoryCsv: () => void;
  onExportMovementsCsv: () => void;
}

export const ReportsModule: React.FC<ReportsModuleProps> = ({
  sales,
  products,
  replenishments,
  movements,
  onExportSalesCsv,
  onExportInventoryCsv,
  onExportMovementsCsv
}) => {
  const [period, setPeriod] = useState<'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom'>('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Real, completed sales (excluding test sales)
  const realSales = useMemo(() => {
    return sales.filter(s => !s.isTest && s.status === 'completed');
  }, [sales]);

  // Date filtering logic
  const filteredSales = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    if (period === 'today') {
      return realSales.filter(s => s.dateStr === todayStr);
    }

    if (period === 'yesterday') {
      return realSales.filter(s => s.dateStr === yesterdayStr);
    }

    if (period === 'week') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(now.getDate() - 7);
      const weekStr = oneWeekAgo.toISOString().slice(0, 10);
      return realSales.filter(s => s.dateStr >= weekStr);
    }

    if (period === 'month') {
      const currentMonthStr = todayStr.slice(0, 7); // YYYY-MM
      return realSales.filter(s => s.dateStr.startsWith(currentMonthStr));
    }

    if (period === 'custom' && customStart && customEnd) {
      return realSales.filter(s => s.dateStr >= customStart && s.dateStr <= customEnd);
    }

    return realSales; // 'all'
  }, [realSales, period, customStart, customEnd]);

  // Specific Totals for Today and Yesterday
  const todayYesterdayStats = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    const todaySales = realSales.filter(s => s.dateStr === todayStr);
    const yesterdaySales = realSales.filter(s => s.dateStr === yesterdayStr);

    const todayTotal = todaySales.reduce((sum, s) => sum + s.totalAmount, 0);
    const yesterdayTotal = yesterdaySales.reduce((sum, s) => sum + s.totalAmount, 0);

    return { todayTotal, yesterdayTotal };
  }, [realSales]);

  // Aggregate KPIs for the selected period
  const kpis = useMemo(() => {
    const totalRevenue = filteredSales.reduce((sum, s) => sum + s.totalAmount, 0);
    const transactionsCount = filteredSales.length;
    const unitsSold = filteredSales.reduce((sum, s) => sum + s.itemsCount, 0);

    // Gross profit estimation
    let totalCostOfSoldGoods = 0;
    let revenueWithKnownCost = 0;

    filteredSales.forEach(s => {
      s.items.forEach(item => {
        if (item.unitCost && item.unitCost > 0) {
          totalCostOfSoldGoods += item.unitCost * item.quantity;
          revenueWithKnownCost += item.subtotal;
        }
      });
    });

    const grossProfitEstimated = revenueWithKnownCost > 0 
      ? revenueWithKnownCost - totalCostOfSoldGoods 
      : 0;

    const inventoryCostValue = products.reduce((sum, p) => sum + (p.availableStock * (p.purchaseCost || 0)), 0);

    return {
      totalRevenue,
      transactionsCount,
      unitsSold,
      grossProfitEstimated,
      totalCostOfSoldGoods,
      hasCostData: revenueWithKnownCost > 0,
      inventoryCostValue
    };
  }, [filteredSales, products]);

  // Payment method breakdown
  const paymentBreakdown = useMemo(() => {
    let efectivo = 0;
    let transferencia = 0;
    let otros = 0;

    filteredSales.forEach(s => {
      if (s.paymentMethod === 'Efectivo') efectivo += s.totalAmount;
      else if (s.paymentMethod === 'Transferencia') transferencia += s.totalAmount;
      else otros += s.totalAmount;
    });

    const total = efectivo + transferencia + otros || 1;
    return {
      efectivo,
      transferencia,
      otros,
      efectivoPct: (efectivo / total) * 100,
      transferenciaPct: (transferencia / total) * 100,
      otrosPct: (otros / total) * 100
    };
  }, [filteredSales]);

  // Category breakdown: Bebidas vs Snacks
  const categoryBreakdown = useMemo(() => {
    let bebidasRevenue = 0;
    let snacksRevenue = 0;
    let bebidasUnits = 0;
    let snacksUnits = 0;

    filteredSales.forEach(s => {
      s.items.forEach(item => {
        if (item.category === 'Bebidas') {
          bebidasRevenue += item.subtotal;
          bebidasUnits += item.quantity;
        } else {
          snacksRevenue += item.subtotal;
          snacksUnits += item.quantity;
        }
      });
    });

    const total = bebidasRevenue + snacksRevenue || 1;
    return {
      bebidasRevenue,
      snacksRevenue,
      bebidasUnits,
      snacksUnits,
      bebidasPct: (bebidasRevenue / total) * 100,
      snacksPct: (snacksRevenue / total) * 100
    };
  }, [filteredSales]);

  // Ranking: Most and Least sold products
  const productSalesMap = useMemo(() => {
    const map = new Map<string, { id: string; name: string; category: string; units: number; revenue: number }>();

    // Initialize all products so 0-sales products show up in least sold
    products.forEach(p => {
      map.set(p.id, {
        id: p.id,
        name: p.name,
        category: p.category,
        units: 0,
        revenue: 0
      });
    });

    filteredSales.forEach(s => {
      s.items.forEach(item => {
        const existing = map.get(item.productId) || {
          id: item.productId,
          name: item.name,
          category: item.category,
          units: 0,
          revenue: 0
        };
        existing.units += item.quantity;
        existing.revenue += item.subtotal;
        map.set(item.productId, existing);
      });
    });

    const all = Array.from(map.values());
    const top = [...all].filter(p => p.units > 0).sort((a, b) => b.units - a.units).slice(0, 10);
    const bottom = [...all].sort((a, b) => a.units - b.units).slice(0, 10);

    return { top, bottom, all };
  }, [filteredSales, products]);

  // Daily sales chart data
  const dailySalesData = useMemo(() => {
    const map = new Map<string, number>();

    filteredSales.forEach(s => {
      const d = s.dateStr;
      map.set(d, (map.get(d) || 0) + s.totalAmount);
    });

    const sortedDates = Array.from(map.keys()).sort();
    const data = sortedDates.map(date => ({
      date,
      amount: map.get(date) || 0
    }));

    const maxAmount = Math.max(...data.map(d => d.amount), 1);
    return { data, maxAmount };
  }, [filteredSales]);

  // Stock status lists
  const outOfStockProducts = useMemo(() => {
    return products.filter(p => p.availableStock === 0);
  }, [products]);

  const lowStockProducts = useMemo(() => {
    return products.filter(p => p.availableStock > 0 && p.availableStock <= p.minStock);
  }, [products]);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 pb-24 md:pb-12 space-y-6">
      
      {/* Top Header & Export Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-emerald-600" />
            <h2 className="text-xl font-black text-slate-800 tracking-tight">Reportes Oficiales FORTIN CLUB</h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Recaudación real, costos, ganancia bruta, rotación de productos y balance de inventario.
          </p>
        </div>

        {/* CSV Export Options */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onExportSalesCsv}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-all active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>Exportar Ventas CSV</span>
          </button>
          <button
            onClick={onExportInventoryCsv}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm rounded-xl transition-colors"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Inventario CSV</span>
          </button>
          <button
            onClick={onExportMovementsCsv}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm rounded-xl transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-slate-500" />
            <span>Kardex CSV</span>
          </button>
        </div>
      </div>

      {/* Date Filters Bar */}
      <div className="flex flex-wrap items-center gap-2 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
        <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
          <Calendar className="w-4 h-4 text-slate-400" />
          Período:
        </span>

        <button
          onClick={() => setPeriod('today')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
            period === 'today'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Hoy (${todayYesterdayStats.todayTotal.toFixed(2)})
        </button>

        <button
          onClick={() => setPeriod('yesterday')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
            period === 'yesterday'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Ayer (${todayYesterdayStats.yesterdayTotal.toFixed(2)})
        </button>

        <button
          onClick={() => setPeriod('week')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
            period === 'week'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Semana Actual
        </button>

        <button
          onClick={() => setPeriod('month')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
            period === 'month'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Mes Actual
        </button>

        <button
          onClick={() => setPeriod('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
            period === 'all'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Histórico Completo
        </button>

        <button
          onClick={() => setPeriod('custom')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
            period === 'custom'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Rango Personalizado
        </button>

        {period === 'custom' && (
          <div className="flex items-center gap-2 ml-2">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
            />
            <span className="text-xs text-slate-400">a</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
            />
          </div>
        )}
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        
        {/* Total Money Sold */}
        <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Vendido</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-700 mt-2 tracking-tight">
            ${kpis.totalRevenue.toFixed(2)}
          </div>
          <span className="text-[11px] text-slate-500 font-medium mt-0.5 block">Ingresos en USD</span>
        </div>

        {/* Total Transactions */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Transacciones</span>
            <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-2 tracking-tight">
            {kpis.transactionsCount}
          </div>
          <span className="text-[11px] text-slate-500 font-medium mt-0.5 block">Ventas cobradas</span>
        </div>

        {/* Units Sold */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Unidades Vendidas</span>
            <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-2 tracking-tight">
            {kpis.unitsSold}
          </div>
          <span className="text-[11px] text-slate-500 font-medium mt-0.5 block">Bebidas y snacks</span>
        </div>

        {/* Gross Profit Breakdown (Ingresos - Costos = Ganancia) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Ganancia Bruta Est.</span>
            <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-800 mt-2 tracking-tight">
            ${kpis.grossProfitEstimated.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {kpis.hasCostData ? (
              <span>Costo mercancía: ${kpis.totalCostOfSoldGoods.toFixed(2)}</span>
            ) : (
              <span>Registra costos para calcular</span>
            )}
          </div>
        </div>

        {/* Inventory Value at Cost */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Valor Inventario</span>
            <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-2 tracking-tight">
            ${kpis.inventoryCostValue.toFixed(2)}
          </div>
          <span className="text-[11px] text-slate-500 font-medium mt-0.5 block">Al costo de compra actual</span>
        </div>

      </div>

      {/* Visual Analytics Grid: Daily Chart + Payment & Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Sales by Day Bar Chart (7 cols) */}
        <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-slate-800 text-base flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-600" />
              <span>Ventas por Día ($ USD)</span>
            </h3>
            <span className="text-xs text-slate-400 font-bold">
              {dailySalesData.data.length} días con ventas
            </span>
          </div>

          {dailySalesData.data.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              No hay ventas registradas en el período seleccionado.
            </div>
          ) : (
            <div className="pt-4">
              <div className="flex items-end gap-2 h-48 border-b border-slate-200 pb-2 px-2">
                {dailySalesData.data.map((item, idx) => {
                  const heightPercent = Math.max(10, (item.amount / dailySalesData.maxAmount) * 100);
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 bg-slate-900 text-white text-[10px] font-mono py-1 px-2 rounded-md pointer-events-none whitespace-nowrap z-20">
                        ${item.amount.toFixed(2)} USD
                      </div>

                      <div className="w-full flex justify-center">
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className="w-full max-w-[36px] bg-emerald-600 group-hover:bg-emerald-700 rounded-t-lg transition-all shadow-xs"
                        />
                      </div>

                      <span className="text-[10px] text-slate-500 font-mono rotate-45 sm:rotate-0 mt-2 truncate w-full text-center">
                        {item.date.slice(5)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Breakdown by Payment Method & Category (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Payment Method Breakdown */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
            <h3 className="font-black text-slate-800 text-sm flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-600" />
              <span>Ingresos por Método de Pago</span>
            </h3>

            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                  <span>💵 Efectivo</span>
                  <span>${paymentBreakdown.efectivo.toFixed(2)} ({paymentBreakdown.efectivoPct.toFixed(1)}%)</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    style={{ width: `${paymentBreakdown.efectivoPct}%` }}
                    className="h-full bg-emerald-600 rounded-full"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                  <span>📲 Transferencia / Deuna</span>
                  <span>${paymentBreakdown.transferencia.toFixed(2)} ({paymentBreakdown.transferenciaPct.toFixed(1)}%)</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    style={{ width: `${paymentBreakdown.transferenciaPct}%` }}
                    className="h-full bg-blue-600 rounded-full"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                  <span>💳 Otros</span>
                  <span>${paymentBreakdown.otros.toFixed(2)} ({paymentBreakdown.otrosPct.toFixed(1)}%)</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    style={{ width: `${paymentBreakdown.otrosPct}%` }}
                    className="h-full bg-purple-600 rounded-full"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
            <h3 className="font-black text-slate-800 text-sm flex items-center gap-2">
              <PieChart className="w-4 h-4 text-emerald-600" />
              <span>Ventas por Categoría</span>
            </h3>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl">
                <span className="text-[11px] font-bold text-blue-700 uppercase">🥤 Bebidas</span>
                <div className="text-lg font-black text-blue-900 mt-1">${categoryBreakdown.bebidasRevenue.toFixed(2)}</div>
                <span className="text-xs text-blue-700 font-semibold">{categoryBreakdown.bebidasUnits} unidades</span>
              </div>

              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl">
                <span className="text-[11px] font-bold text-amber-700 uppercase">🍿 Snacks</span>
                <div className="text-lg font-black text-amber-900 mt-1">${categoryBreakdown.snacksRevenue.toFixed(2)}</div>
                <span className="text-xs text-amber-700 font-semibold">{categoryBreakdown.snacksUnits} unidades</span>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Rankings: Top Selling vs Least Selling Products */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Ranking: Top Products (6 cols) */}
        <div className="lg:col-span-6 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" />
              <h3 className="font-black text-slate-800 text-base">Productos Más Vendidos</h3>
            </div>
            <span className="text-xs text-slate-400 font-semibold">Mayor rotación</span>
          </div>

          <div className="divide-y divide-slate-100 text-xs mt-2">
            {productSalesMap.top.length === 0 ? (
              <div className="py-8 text-center text-slate-400">
                Aún no hay ventas registradas en este período.
              </div>
            ) : (
              productSalesMap.top.map((p, idx) => (
                <div key={idx} className="py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-[11px]">
                      {idx + 1}
                    </span>
                    <div>
                      <span className="font-bold text-slate-800">{p.name}</span>
                      <span className="text-[10px] text-slate-400 block">{p.category}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-black text-emerald-700 block">${p.revenue.toFixed(2)}</span>
                    <span className="text-[11px] text-slate-500">{p.units} unid.</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Ranking: Least Sold Products (6 cols) */}
        <div className="lg:col-span-6 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ArrowDownRight className="w-5 h-5 text-slate-400" />
              <h3 className="font-black text-slate-800 text-base">Productos Menos Vendidos</h3>
            </div>
            <span className="text-xs text-slate-400 font-semibold">Baja rotación</span>
          </div>

          <div className="divide-y divide-slate-100 text-xs mt-2">
            {productSalesMap.bottom.slice(0, 8).map((p, idx) => (
              <div key={idx} className="py-2 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800">{p.name}</span>
                  <span className="text-[10px] text-slate-400 block">{p.category}</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-slate-700 block">${p.revenue.toFixed(2)}</span>
                  <span className="text-[11px] text-slate-400">{p.units} unid. vendidas</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Stock Alerts: Out of stock & Low stock */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        
        {/* Out of Stock (Agotados) */}
        <div className="bg-white p-4 rounded-2xl border border-rose-200 shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-rose-100">
            <div className="flex items-center gap-1.5 text-rose-800 font-bold text-sm">
              <XCircle className="w-4 h-4 text-rose-600" />
              <span>Productos Agotados ({outOfStockProducts.length})</span>
            </div>
            <span className="text-xs text-rose-600 font-semibold">Stock = 0</span>
          </div>

          <div className="divide-y divide-slate-100 text-xs mt-2 max-h-48 overflow-y-auto">
            {outOfStockProducts.length === 0 ? (
              <div className="py-4 text-center text-emerald-600 font-bold">
                ✓ No hay productos agotados actualmente
              </div>
            ) : (
              outOfStockProducts.map(p => (
                <div key={p.id} className="py-2 flex justify-between items-center">
                  <span className="font-bold text-slate-800">{p.name}</span>
                  <span className="bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-md">
                    0 unid.
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Low Stock (Stock bajo) */}
        <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-amber-100">
            <div className="flex items-center gap-1.5 text-amber-800 font-bold text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Productos que necesitan reposición ({lowStockProducts.length})</span>
            </div>
            <span className="text-xs text-amber-600 font-semibold">Stock $\le$ Mínimo</span>
          </div>

          <div className="divide-y divide-slate-100 text-xs mt-2 max-h-48 overflow-y-auto">
            {lowStockProducts.length === 0 ? (
              <div className="py-4 text-center text-emerald-600 font-bold">
                ✓ Todo el inventario está sobre el nivel mínimo
              </div>
            ) : (
              lowStockProducts.map(p => (
                <div key={p.id} className="py-2 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-slate-800">{p.name}</span>
                    <span className="text-[10px] text-slate-400 block">Mínimo: {p.minStock}</span>
                  </div>
                  <span className="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-md">
                    {p.availableStock} disp.
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
