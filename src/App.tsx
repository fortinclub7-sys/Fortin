/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, testFirestoreConnection } from './firebase';
import { dbService } from './services/db';
import { Product, Sale, Replenishment, InventoryMovement, CartItem, PaymentMethod, AdminUser } from './types';
import { Navbar } from './components/Navbar';
import { BottomNav } from './components/BottomNav';
import { SalesModule } from './components/SalesModule';
import { InventoryModule } from './components/InventoryModule';
import { ReplenishmentsModule } from './components/ReplenishmentsModule';
import { ReportsModule } from './components/ReportsModule';
import { AdminAuthModal } from './components/AdminAuthModal';
import { HelpAndVerificationModal } from './components/HelpAndVerificationModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<'ventas' | 'inventario' | 'reportes'>('ventas');
  const [inventorySubScreen, setInventorySubScreen] = useState<'inventory' | 'replenishments'>('inventory');

  // Live database state
  const [products, setProducts] = useState<Product[]>(dbService.getProducts());
  const [sales, setSales] = useState<Sale[]>(dbService.getSales());
  const [replenishments, setReplenishments] = useState<Replenishment[]>(dbService.getReplenishments());
  const [movements, setMovements] = useState<InventoryMovement[]>(dbService.getMovements());
  const [isDemoMode, setIsDemoMode] = useState<boolean>(dbService.getIsDemoMode());
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);
  const [targetStock, setTargetStock] = useState<number>(dbService.getTargetStock());

  // Admin user
  const [adminUser, setAdminUser] = useState<AdminUser>({
    uid: '',
    email: null,
    displayName: null,
    isAdmin: false
  });

  // Modals
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

  // Initialize DB and subscribe
  useEffect(() => {
    // Initial sync
    dbService.initSync().then(() => {
      setIsLiveConnected(dbService.getIsLiveConnected());
    });

    testFirestoreConnection().then(connected => {
      if (connected) setIsLiveConnected(true);
    });

    const unsubscribe = dbService.subscribe(() => {
      setProducts(dbService.getProducts());
      setSales(dbService.getSales());
      setReplenishments(dbService.getReplenishments());
      setMovements(dbService.getMovements());
      setIsDemoMode(dbService.getIsDemoMode());
      setIsLiveConnected(dbService.getIsLiveConnected());
      setTargetStock(dbService.getTargetStock());
    });

    return () => unsubscribe();
  }, []);

  // Auth state listener
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const isOfficialAdmin = user.email?.toLowerCase() === 'fortinclub7@gmail.com';
        setAdminUser({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          isAdmin: isOfficialAdmin || adminUser.isAdmin
        });
        // Immediately sync with Cloud Firestore once authenticated
        dbService.initSync().then(() => {
          setIsLiveConnected(true);
        });
      } else {
        if (!adminUser.isAdmin) {
          setAdminUser({
            uid: '',
            email: null,
            displayName: null,
            isAdmin: false
          });
        }
      }
    });

    return () => unsubAuth();
  }, [adminUser.isAdmin]);

  // Execute Sale
  const handleExecuteSale = async (
    items: CartItem[],
    paymentMethod: PaymentMethod,
    cashReceived: number,
    isTestSale: boolean
  ): Promise<Sale> => {
    return await dbService.executeSale(items, paymentMethod, cashReceived, isTestSale);
  };

  // Update Product Price
  const handleUpdateProductPrice = async (productId: string, price: number): Promise<void> => {
    await dbService.updateProductPrice(productId, price);
  };

  // Adjust Product Stock (Physical count / Audit)
  const handleAdjustStock = async (productId: string, newStock: number, reason: string): Promise<void> => {
    await dbService.adjustStock(productId, newStock, reason);
  };

  // Register Replenishment
  const handleRegisterReplenishment = async (
    productId: string,
    quantityAdded: number,
    purchaseCost: number,
    notes: string
  ): Promise<void> => {
    await dbService.registerReplenishment(productId, quantityAdded, purchaseCost, notes);
  };

  // Convert Six Pack
  const handleConvertSixPack = async (
    sixPackProductId: string,
    packsToUnpack: number
  ): Promise<void> => {
    await dbService.convertSixPackToIndividual(sixPackProductId, packsToUnpack);
  };

  // Upsert Product
  const handleSaveProduct = async (
    product: Partial<Product> & { name: string; category: 'Bebidas' | 'Snacks'; salePrice: number }
  ): Promise<void> => {
    await dbService.upsertProduct(product);
  };

  // Delete Product
  const handleDeleteProduct = async (id: string): Promise<void> => {
    await dbService.deleteProduct(id);
  };

  // Import CSV
  const handleImportCsv = async (csvText: string): Promise<number> => {
    return await dbService.importProductsFromCSV(csvText);
  };

  // Export CSV helpers
  const triggerDownload = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportSalesCsv = () => {
    const csv = dbService.exportSalesCSV();
    triggerDownload(`ventas_fortinclub_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  const handleExportInventoryCsv = () => {
    const csv = dbService.exportProductsCSV();
    triggerDownload(`inventario_fortinclub_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  const handleExportMovementsCsv = () => {
    const csv = dbService.exportMovementsCSV();
    triggerDownload(`kardex_movimientos_fortinclub_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  const handleResetInitialInventory = () => {
    dbService.resetToInitialInventory();
  };

  // Low stock count for navigation badge
  const lowStockCount = products.filter(p => p.availableStock <= p.minStock).length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          if (tab === 'inventario') setInventorySubScreen('inventory');
        }}
        adminUser={adminUser}
        onOpenAdminModal={() => setIsAdminModalOpen(true)}
        isLiveConnected={isLiveConnected}
        isDemoMode={isDemoMode}
        onToggleDemoMode={(val) => dbService.setDemoMode(val)}
        onOpenHelpModal={() => setIsHelpModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {activeTab === 'ventas' && (
          <SalesModule
            products={products}
            onExecuteSale={handleExecuteSale}
            onUpdateProductPrice={handleUpdateProductPrice}
            isDemoMode={isDemoMode}
          />
        )}

        {activeTab === 'inventario' && (
          <>
            {inventorySubScreen === 'inventory' ? (
              <InventoryModule
                products={products}
                movements={movements}
                adminUser={adminUser}
                onOpenAdminModal={() => setIsAdminModalOpen(true)}
                onOpenReplenishments={() => setInventorySubScreen('replenishments')}
                onSaveProduct={handleSaveProduct}
                onUpdateProductPrice={handleUpdateProductPrice}
                onAdjustStock={handleAdjustStock}
                onDeleteProduct={handleDeleteProduct}
                onConvertSixPack={handleConvertSixPack}
                onImportCsv={handleImportCsv}
                onExportCsv={handleExportInventoryCsv}
                onExportMovementsCsv={handleExportMovementsCsv}
                onResetInitialInventory={handleResetInitialInventory}
              />
            ) : (
              <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 pb-24 md:pb-12 space-y-4">
                <button
                  onClick={() => setInventorySubScreen('inventory')}
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 rounded-xl text-xs font-bold text-slate-700 transition-colors flex items-center gap-1.5"
                >
                  ← Volver al Catálogo de Inventario
                </button>
                <ReplenishmentsModule
                  products={products}
                  replenishments={replenishments}
                  targetStock={targetStock}
                  onSetTargetStock={(tgt) => dbService.setTargetStock(tgt)}
                  onRegisterReplenishment={handleRegisterReplenishment}
                  onBackToInventory={() => setInventorySubScreen('inventory')}
                />
              </div>
            )}
          </>
        )}

        {activeTab === 'reportes' && (
          <ReportsModule
            sales={sales}
            products={products}
            replenishments={replenishments}
            movements={movements}
            onExportSalesCsv={handleExportSalesCsv}
            onExportInventoryCsv={handleExportInventoryCsv}
            onExportMovementsCsv={handleExportMovementsCsv}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation (1. Ventas, 2. Inventario, 3. Reportes) */}
      <BottomNav
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          if (tab === 'inventario') setInventorySubScreen('inventory');
        }}
        lowStockCount={lowStockCount}
      />

      {/* Admin Authorization Modal */}
      <AdminAuthModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        adminUser={adminUser}
        onSetAdminStatus={(isAdmin) => {
          setAdminUser(prev => ({ ...prev, isAdmin }));
        }}
      />

      {/* Help & System Operational Verification Modal */}
      <HelpAndVerificationModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
      />

    </div>
  );
}
