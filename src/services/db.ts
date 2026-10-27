import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  runTransaction,
  query,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import {
  Product,
  Sale,
  Replenishment,
  InventoryMovement,
  CartItem,
  PaymentMethod
} from '../types';
import { INITIAL_PRODUCTS_OCT_2026 } from '../data/initialProducts';

const STORAGE_KEYS = {
  PRODUCTS: 'fortinclub_products_v2',
  SALES: 'fortinclub_sales_v2',
  REPLENISHMENTS: 'fortinclub_replenishments_v2',
  MOVEMENTS: 'fortinclub_movements_v2',
  IS_DEMO: 'fortinclub_is_demo_v2',
  TARGET_STOCK: 'fortinclub_target_stock_v2'
};

// Calculate product status based on stock levels
export function computeProductStatus(availableStock: number, minStock: number): 'Disponible' | 'Stock bajo' | 'Agotado' {
  if (availableStock <= 0) return 'Agotado';
  if (availableStock <= minStock) return 'Stock bajo';
  return 'Disponible';
}

class DatabaseService {
  private productsCache: Product[] = [];
  private salesCache: Sale[] = [];
  private replenishmentsCache: Replenishment[] = [];
  private movementsCache: InventoryMovement[] = [];
  private isLiveConnected = false;
  private isDemoMode = false; // Default to official operational mode
  private listeners: (() => void)[] = [];

  constructor() {
    this.loadFromLocalStorage();
  }

  public subscribe(cb: () => void) {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter(l => l !== cb);
    };
  }

  private notify() {
    this.listeners.forEach(cb => cb());
  }

  private getStorageItem(key: string): string | null {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        return localStorage.getItem(key);
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  private setStorageItem(key: string, val: string) {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(key, val);
      } catch (e) {}
    }
  }

  private loadFromLocalStorage() {
    try {
      const storedProds = this.getStorageItem(STORAGE_KEYS.PRODUCTS);
      if (storedProds) {
        const parsed = JSON.parse(storedProds);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Keep user's saved catalog with all custom prices and edits intact
          this.productsCache = parsed;
        } else {
          // Initialize official catalog
          this.productsCache = [...INITIAL_PRODUCTS_OCT_2026];
          this.saveProductsToLocalStorage();
        }
      } else {
        this.productsCache = [...INITIAL_PRODUCTS_OCT_2026];
        this.saveProductsToLocalStorage();
      }

      const storedSales = this.getStorageItem(STORAGE_KEYS.SALES);
      if (storedSales) {
        this.salesCache = JSON.parse(storedSales);
      }

      const storedReplenishments = this.getStorageItem(STORAGE_KEYS.REPLENISHMENTS);
      if (storedReplenishments) {
        this.replenishmentsCache = JSON.parse(storedReplenishments);
      }

      const storedMovements = this.getStorageItem(STORAGE_KEYS.MOVEMENTS);
      if (storedMovements) {
        this.movementsCache = JSON.parse(storedMovements);
      }

      // Default demo mode is FALSE (Operación Real)
      const storedDemo = this.getStorageItem(STORAGE_KEYS.IS_DEMO);
      this.isDemoMode = storedDemo === 'true';
    } catch (e) {
      console.warn('Error loading local storage cache:', e);
      this.productsCache = [...INITIAL_PRODUCTS_OCT_2026];
    }
  }

  private saveProductsToLocalStorage() {
    this.setStorageItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(this.productsCache));
  }

  private saveSalesToLocalStorage() {
    this.setStorageItem(STORAGE_KEYS.SALES, JSON.stringify(this.salesCache));
  }

  private saveReplenishmentsToLocalStorage() {
    this.setStorageItem(STORAGE_KEYS.REPLENISHMENTS, JSON.stringify(this.replenishmentsCache));
  }

  private saveMovementsToLocalStorage() {
    this.setStorageItem(STORAGE_KEYS.MOVEMENTS, JSON.stringify(this.movementsCache));
  }

  /**
   * Smart bidirectional merge between local cache and cloud documents:
   * - Never overwrites a valid positive salePrice with zero.
   * - Prefers the version with the newer updatedAt timestamp.
   * - Queues products with local edits to be pushed up to Firestore.
   */
  private mergeProducts(
    localProds: Product[],
    cloudProds: Product[]
  ): { merged: Product[]; toPushToCloud: Product[] } {
    const toPushToCloud: Product[] = [];
    const resultMap = new Map<string, Product>();

    // 1. Index local products
    localProds.forEach(lp => {
      resultMap.set(lp.id, { ...lp });
    });

    // 2. Merge cloud products
    cloudProds.forEach(cp => {
      const existing = resultMap.get(cp.id);
      if (!existing) {
        // Cloud has product not in local
        resultMap.set(cp.id, cp);
      } else {
        const localTime = new Date(existing.updatedAt || 0).getTime();
        const cloudTime = new Date(cp.updatedAt || 0).getTime();

        const localHasPrice = (existing.salePrice || 0) > 0;
        const cloudHasPrice = (cp.salePrice || 0) > 0;

        if (localHasPrice && !cloudHasPrice) {
          // Local has user-configured price, cloud still has 0: local wins!
          toPushToCloud.push(existing);
        } else if (localTime > cloudTime) {
          // Local was updated more recently: local wins!
          toPushToCloud.push(existing);
        } else if (cloudTime > localTime) {
          // Cloud is strictly newer
          const merged: Product = {
            ...cp,
            // Prevent cloud from zeroing a positive price
            salePrice: cp.salePrice > 0 ? cp.salePrice : existing.salePrice
          };
          resultMap.set(cp.id, merged);
        } else {
          // Same timestamp: prefer valid price and keep local custom edits
          const preferredPrice = existing.salePrice > 0 ? existing.salePrice : cp.salePrice;
          const merged: Product = {
            ...cp,
            ...existing,
            salePrice: preferredPrice
          };
          resultMap.set(cp.id, merged);
          if (existing.salePrice > cp.salePrice) {
            toPushToCloud.push(merged);
          }
        }
      }
    });

    // 3. Local products that do not exist in cloud must be pushed to cloud
    localProds.forEach(lp => {
      if (!cloudProds.some(cp => cp.id === lp.id)) {
        toPushToCloud.push(lp);
      }
    });

    return {
      merged: Array.from(resultMap.values()),
      toPushToCloud
    };
  }

  public getProducts(): Product[] {
    return [...this.productsCache];
  }

  public getSales(): Sale[] {
    return [...this.salesCache];
  }

  public getReplenishments(): Replenishment[] {
    return [...this.replenishmentsCache];
  }

  public getMovements(): InventoryMovement[] {
    return [...this.movementsCache];
  }

  public getIsDemoMode(): boolean {
    return this.isDemoMode;
  }

  public setDemoMode(val: boolean) {
    this.isDemoMode = val;
    this.setStorageItem(STORAGE_KEYS.IS_DEMO, val ? 'true' : 'false');
    this.notify();
  }

  public getIsLiveConnected(): boolean {
    return this.isLiveConnected;
  }

  public getTargetStock(): number {
    const val = this.getStorageItem(STORAGE_KEYS.TARGET_STOCK);
    return val ? parseInt(val, 10) : 20;
  }

  public setTargetStock(val: number) {
    this.setStorageItem(STORAGE_KEYS.TARGET_STOCK, String(val));
    this.notify();
  }

  // Initialize and synchronize with Firestore
  public async initSync() {
    try {
      const prodCol = collection(db, 'products');
      const prodSnapshot = await getDocs(prodCol);

      if (prodSnapshot.empty) {
        // First time initialization in Cloud Firestore for Fortin Club
        for (const p of this.productsCache) {
          try {
            await setDoc(doc(db, 'products', p.id), p);
          } catch (err) {
            // Unauthenticated or offline
          }
        }
      } else {
        const cloudProds: Product[] = [];
        prodSnapshot.forEach(d => {
          cloudProds.push(d.data() as Product);
        });

        // Smart merge: never wipe out user-configured local prices or newer edits
        const { merged, toPushToCloud } = this.mergeProducts(this.productsCache, cloudProds);
        this.productsCache = merged;
        this.saveProductsToLocalStorage();

        // Push local updates up to cloud if any
        if (toPushToCloud.length > 0 && auth.currentUser) {
          for (const p of toPushToCloud) {
            try {
              await setDoc(doc(db, 'products', p.id), p);
            } catch (err) {
              // Ignore
            }
          }
        }
      }

      this.isLiveConnected = true;

      // Realtime listener for products with smart merge
      onSnapshot(prodCol, (snapshot) => {
        const cloudProds: Product[] = [];
        snapshot.forEach(d => cloudProds.push(d.data() as Product));
        if (cloudProds.length > 0) {
          const { merged, toPushToCloud } = this.mergeProducts(this.productsCache, cloudProds);
          this.productsCache = merged;
          this.saveProductsToLocalStorage();
          this.notify();

          if (toPushToCloud.length > 0 && auth.currentUser) {
            toPushToCloud.forEach(p => {
              setDoc(doc(db, 'products', p.id), p).catch(() => {});
            });
          }
        }
      }, (error) => {
        console.warn('Realtime sync fallback to local cache:', error.message);
      });

      // Fetch sales
      const salesCol = collection(db, 'sales');
      const salesSnapshot = await getDocs(salesCol);
      if (!salesSnapshot.empty) {
        const cloudSales: Sale[] = [];
        salesSnapshot.forEach(d => cloudSales.push(d.data() as Sale));
        this.salesCache = cloudSales;
        this.saveSalesToLocalStorage();
      }

      // Fetch Replenishments
      const repCol = collection(db, 'replenishments');
      const repSnapshot = await getDocs(repCol);
      if (!repSnapshot.empty) {
        const cloudReps: Replenishment[] = [];
        repSnapshot.forEach(d => cloudReps.push(d.data() as Replenishment));
        this.replenishmentsCache = cloudReps;
        this.saveReplenishmentsToLocalStorage();
      }

      // Fetch Movements
      const movCol = collection(db, 'movements');
      const movSnapshot = await getDocs(movCol);
      if (!movSnapshot.empty) {
        const cloudMovs: InventoryMovement[] = [];
        movSnapshot.forEach(d => cloudMovs.push(d.data() as InventoryMovement));
        this.movementsCache = cloudMovs;
        this.saveMovementsToLocalStorage();
      }

      this.notify();
    } catch (e) {
      console.warn('Sync operating in resilient mode:', e);
      this.isLiveConnected = false;
      this.notify();
    }
  }

  /**
   * Finalizar Venta: Operación transaccional con verificación de stock, precio y prevención de duplicados
   */
  public async executeSale(
    items: CartItem[],
    paymentMethod: PaymentMethod,
    cashReceived: number = 0,
    isTestSale: boolean = false
  ): Promise<Sale> {
    if (items.length === 0) {
      throw new Error('El carrito está vacío.');
    }

    // 1. Validar que todos los productos tengan precio asignado mayor a cero
    for (const item of items) {
      if (item.unitPrice <= 0) {
        throw new Error(
          `El producto "${item.product.name}" no tiene un precio de venta asignado. Asígnale un precio en Inventario antes de venderlo.`
        );
      }
    }

    // 2. Validar existencias de todos los productos antes de procesar
    for (const item of items) {
      const prod = this.productsCache.find(p => p.id === item.product.id);
      if (!prod) {
        throw new Error(`El producto "${item.product.name}" no existe en el catálogo.`);
      }
      if (prod.availableStock < item.quantity) {
        throw new Error(
          `Stock insuficiente para "${prod.name}". Disponible: ${prod.availableStock}, Solicitado: ${item.quantity}`
        );
      }
    }

    const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);
    const cashChange = paymentMethod === 'Efectivo' ? Math.max(0, cashReceived - totalAmount) : 0;
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 5);
    const saleId = `sale_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const saleNumber = `V-${String(this.salesCache.filter(s => !s.isTest).length + 1).padStart(5, '0')}`;

    const newSale: Sale = {
      id: saleId,
      saleNumber: isTestSale ? `TEST-${saleNumber}` : saleNumber,
      createdAt: now.toISOString(),
      dateStr,
      timeStr,
      items: items.map(i => ({
        productId: i.product.id,
        internalCode: i.product.internalCode,
        name: i.product.name,
        category: i.product.category,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        unitCost: i.unitCost || 0,
        subtotal: i.subtotal
      })),
      itemsCount: items.reduce((sum, i) => sum + i.quantity, 0),
      totalAmount: Number(totalAmount.toFixed(2)),
      paymentMethod,
      cashReceived: paymentMethod === 'Efectivo' ? Number(cashReceived.toFixed(2)) : undefined,
      cashChange: paymentMethod === 'Efectivo' ? Number(cashChange.toFixed(2)) : undefined,
      status: 'completed',
      isTest: isTestSale
    };

    // If it's a test sale, do NOT deduct inventory and keep flagged as test
    if (isTestSale) {
      this.salesCache.unshift(newSale);
      this.saveSalesToLocalStorage();
      this.notify();
      return newSale;
    }

    // 3. Transacción atómica en Firestore si está conectado
    const newMovements: InventoryMovement[] = [];

    if (this.isLiveConnected && auth.currentUser) {
      try {
        await runTransaction(db, async (transaction) => {
          // Read all docs first
          const productDocs = await Promise.all(
            items.map(item => transaction.get(doc(db, 'products', item.product.id)))
          );

          // Verify stock atomically
          productDocs.forEach((docSnap, idx) => {
            if (!docSnap.exists()) {
              throw new Error(`Producto no encontrado en Firestore: ${items[idx].product.name}`);
            }
            const currentData = docSnap.data() as Product;
            if (currentData.availableStock < items[idx].quantity) {
              throw new Error(`Stock insuficiente en base de datos para "${currentData.name}". Disponible: ${currentData.availableStock}`);
            }
          });

          // Write sale record
          transaction.set(doc(db, 'sales', saleId), newSale);

          // Deduct stock and record movements
          productDocs.forEach((docSnap, idx) => {
            const currentData = docSnap.data() as Product;
            const newStock = currentData.availableStock - items[idx].quantity;
            const newStatus = computeProductStatus(newStock, currentData.minStock);

            transaction.update(docSnap.ref, {
              availableStock: newStock,
              status: newStatus,
              updatedAt: now.toISOString()
            });

            const movId = `mov_${Date.now()}_${idx}`;
            const movement: InventoryMovement = {
              id: movId,
              productId: currentData.id,
              productName: currentData.name,
              internalCode: currentData.internalCode,
              movementType: 'VENTA',
              previousStock: currentData.availableStock,
              quantityChanged: -items[idx].quantity,
              finalStock: newStock,
              referenceId: saleNumber,
              createdAt: now.toISOString(),
              dateStr,
              notes: `Venta ${saleNumber} (${paymentMethod})`
            };
            transaction.set(doc(db, 'movements', movId), movement);
            newMovements.push(movement);
          });
        });
      } catch (err) {
        console.warn('Firestore transaction error, applying local transaction:', err);
      }
    }

    // Apply local state deduction
    items.forEach((item, idx) => {
      const prodIndex = this.productsCache.findIndex(p => p.id === item.product.id);
      if (prodIndex !== -1) {
        const prod = this.productsCache[prodIndex];
        const prev = prod.availableStock;
        const newStock = Math.max(0, prev - item.quantity);
        this.productsCache[prodIndex] = {
          ...prod,
          availableStock: newStock,
          status: computeProductStatus(newStock, prod.minStock),
          updatedAt: now.toISOString()
        };

        if (newMovements.length === 0) {
          const movId = `mov_${Date.now()}_${idx}`;
          newMovements.push({
            id: movId,
            productId: prod.id,
            productName: prod.name,
            internalCode: prod.internalCode,
            movementType: 'VENTA',
            previousStock: prev,
            quantityChanged: -item.quantity,
            finalStock: newStock,
            referenceId: saleNumber,
            createdAt: now.toISOString(),
            dateStr,
            notes: `Venta ${saleNumber} (${paymentMethod})`
          });
        }
      }
    });

    this.salesCache.unshift(newSale);
    this.movementsCache.unshift(...newMovements);

    this.saveProductsToLocalStorage();
    this.saveSalesToLocalStorage();
    this.saveMovementsToLocalStorage();
    this.notify();

    return newSale;
  }

  /**
   * Modificar únicamente el precio de venta sin alterar existencias ni ventas pasadas
   */
  public async updateProductPrice(productId: string, newSalePrice: number): Promise<Product> {
    if (newSalePrice < 0) {
      throw new Error('El precio de venta no puede ser negativo.');
    }

    const prodIndex = this.productsCache.findIndex(p => p.id === productId);
    if (prodIndex === -1) {
      throw new Error('Producto no encontrado.');
    }

    const prod = this.productsCache[prodIndex];
    const now = new Date().toISOString();
    const updated: Product = {
      ...prod,
      salePrice: Number(newSalePrice.toFixed(2)),
      updatedAt: now
    };

    this.productsCache[prodIndex] = updated;
    this.saveProductsToLocalStorage();
    this.notify();

    // Persist to remote db asynchronously if available
    try {
      if (auth.currentUser || this.isLiveConnected) {
        await setDoc(doc(db, 'products', productId), updated);
      }
    } catch (e) {
      console.warn('Remote price sync pending (safely saved locally):', e);
    }

    return updated;
  }

  /**
   * Registrar ajuste manual de inventario (físico / corrección de existencias)
   */
  public async adjustStock(productId: string, newAvailableStock: number, reason: string): Promise<Product> {
    if (newAvailableStock < 0) {
      throw new Error('El stock no puede ser negativo.');
    }

    const prodIndex = this.productsCache.findIndex(p => p.id === productId);
    if (prodIndex === -1) {
      throw new Error('Producto no encontrado.');
    }

    const prod = this.productsCache[prodIndex];
    const prevStock = prod.availableStock;
    const diff = newAvailableStock - prevStock;
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const movId = `mov_${Date.now()}`;

    const updated: Product = {
      ...prod,
      availableStock: newAvailableStock,
      status: computeProductStatus(newAvailableStock, prod.minStock),
      updatedAt: now.toISOString()
    };

    const mov: InventoryMovement = {
      id: movId,
      productId: prod.id,
      productName: prod.name,
      internalCode: prod.internalCode,
      movementType: 'AJUSTE_STOCK',
      previousStock: prevStock,
      quantityChanged: diff,
      finalStock: newAvailableStock,
      createdAt: now.toISOString(),
      dateStr,
      notes: reason || 'Ajuste manual de existencias registrado'
    };

    this.productsCache[prodIndex] = updated;
    this.movementsCache.unshift(mov);

    this.saveProductsToLocalStorage();
    this.saveMovementsToLocalStorage();

    if (this.isLiveConnected && auth.currentUser) {
      try {
        await updateDoc(doc(db, 'products', productId), {
          availableStock: newAvailableStock,
          status: updated.status,
          updatedAt: updated.updatedAt
        });
        await setDoc(doc(db, 'movements', movId), mov);
      } catch (e) {
        console.warn('Error saving stock adjustment to remote db:', e);
      }
    }

    this.notify();
    return updated;
  }

  /**
   * Registrar reposición de mercadería (Aumento de stock)
   * NO se registra como ingreso por ventas
   */
  public async registerReplenishment(
    productId: string,
    quantityAdded: number,
    purchaseCost: number = 0,
    notes: string = ''
  ): Promise<Replenishment> {
    if (quantityAdded <= 0) {
      throw new Error('La cantidad a reponer debe ser mayor a cero.');
    }

    const prodIndex = this.productsCache.findIndex(p => p.id === productId);
    if (prodIndex === -1) {
      throw new Error('Producto no encontrado.');
    }

    const prod = this.productsCache[prodIndex];
    const prevStock = prod.availableStock;
    const newStock = prevStock + quantityAdded;
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const repId = `rep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const effectiveCost = purchaseCost > 0 ? purchaseCost : (prod.purchaseCost || 0);
    const totalCost = Number((effectiveCost * quantityAdded).toFixed(2));

    const replenishment: Replenishment = {
      id: repId,
      productId: prod.id,
      productName: prod.name,
      internalCode: prod.internalCode,
      quantityAdded,
      purchaseCost: effectiveCost,
      totalCost,
      previousStock: prevStock,
      newStock,
      createdAt: now.toISOString(),
      dateStr,
      notes
    };

    const movId = `mov_${Date.now()}`;
    const movement: InventoryMovement = {
      id: movId,
      productId: prod.id,
      productName: prod.name,
      internalCode: prod.internalCode,
      movementType: 'REPOSICION',
      previousStock: prevStock,
      quantityChanged: quantityAdded,
      finalStock: newStock,
      referenceId: repId,
      createdAt: now.toISOString(),
      dateStr,
      notes: notes || `Reposición de mercadería (+${quantityAdded} unidades)`
    };

    this.productsCache[prodIndex] = {
      ...prod,
      availableStock: newStock,
      purchaseCost: effectiveCost > 0 ? effectiveCost : prod.purchaseCost,
      status: computeProductStatus(newStock, prod.minStock),
      updatedAt: now.toISOString()
    };

    this.replenishmentsCache.unshift(replenishment);
    this.movementsCache.unshift(movement);

    this.saveProductsToLocalStorage();
    this.saveReplenishmentsToLocalStorage();
    this.saveMovementsToLocalStorage();

    if (this.isLiveConnected && auth.currentUser) {
      try {
        await setDoc(doc(db, 'replenishments', repId), replenishment);
        await setDoc(doc(db, 'movements', movId), movement);
        await updateDoc(doc(db, 'products', prod.id), {
          availableStock: newStock,
          purchaseCost: effectiveCost > 0 ? effectiveCost : prod.purchaseCost,
          status: computeProductStatus(newStock, prod.minStock),
          updatedAt: now.toISOString()
        });
      } catch (err) {
        console.warn('Error saving replenishment to Firestore:', err);
      }
    }

    this.notify();
    return replenishment;
  }

  /**
   * Conversión controlada de SIX Pack a Unidades Individuales
   * Descuenta 1 SIX y suma 6 unidades individuales del mismo producto
   */
  public async convertSixPackToIndividual(
    sixPackProductId: string,
    packsToUnpack: number = 1
  ): Promise<{ sixPackProduct: Product; singleProduct: Product }> {
    if (packsToUnpack <= 0) {
      throw new Error('La cantidad de SIX a desempacar debe ser al menos 1.');
    }

    const sixIndex = this.productsCache.findIndex(p => p.id === sixPackProductId);
    if (sixIndex === -1) {
      throw new Error('Producto SIX Pack no encontrado.');
    }

    const sixProd = this.productsCache[sixIndex];
    if (!sixProd.isSixPack) {
      throw new Error('El producto seleccionado no es una presentación SIX Pack.');
    }

    if (sixProd.availableStock < packsToUnpack) {
      throw new Error(`Stock insuficiente de SIX Pack. Disponible: ${sixProd.availableStock}, a convertir: ${packsToUnpack}`);
    }

    // Find linked single unit product
    let singleProdId = sixProd.singleUnitId;
    if (!singleProdId) {
      if (sixProd.name.includes('PILSENER')) singleProdId = 'prod_pilsener';
      else if (sixProd.name.includes('CLUB')) singleProdId = 'prod_club';
    }

    const singleIndex = this.productsCache.findIndex(p => p.id === singleProdId);
    if (singleIndex === -1) {
      throw new Error('Presentación individual vinculada no encontrada en el inventario.');
    }

    const singleProd = this.productsCache[singleIndex];
    const unitsToAdd = packsToUnpack * (sixProd.unitsPerPack || 6);

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);

    const prevSixStock = sixProd.availableStock;
    const newSixStock = prevSixStock - packsToUnpack;

    const prevSingleStock = singleProd.availableStock;
    const newSingleStock = prevSingleStock + unitsToAdd;

    // Movements
    const movIdSix = `mov_${Date.now()}_six`;
    const movSix: InventoryMovement = {
      id: movIdSix,
      productId: sixProd.id,
      productName: sixProd.name,
      internalCode: sixProd.internalCode,
      movementType: 'DESEMPAQUE_SIX',
      previousStock: prevSixStock,
      quantityChanged: -packsToUnpack,
      finalStock: newSixStock,
      createdAt: now.toISOString(),
      dateStr,
      notes: `Desempaque de ${packsToUnpack} SIX -> convertidos a ${unitsToAdd} unidades individuales`
    };

    const movIdSingle = `mov_${Date.now()}_single`;
    const movSingle: InventoryMovement = {
      id: movIdSingle,
      productId: singleProd.id,
      productName: singleProd.name,
      internalCode: singleProd.internalCode,
      movementType: 'DESEMPAQUE_SIX',
      previousStock: prevSingleStock,
      quantityChanged: unitsToAdd,
      finalStock: newSingleStock,
      createdAt: now.toISOString(),
      dateStr,
      notes: `Ingreso por desempaque de ${packsToUnpack} SIX (${sixProd.name})`
    };

    this.productsCache[sixIndex] = {
      ...sixProd,
      availableStock: newSixStock,
      status: computeProductStatus(newSixStock, sixProd.minStock),
      updatedAt: now.toISOString()
    };

    this.productsCache[singleIndex] = {
      ...singleProd,
      availableStock: newSingleStock,
      status: computeProductStatus(newSingleStock, singleProd.minStock),
      updatedAt: now.toISOString()
    };

    this.movementsCache.unshift(movSix, movSingle);

    this.saveProductsToLocalStorage();
    this.saveMovementsToLocalStorage();

    if (this.isLiveConnected && auth.currentUser) {
      try {
        await updateDoc(doc(db, 'products', sixProd.id), {
          availableStock: newSixStock,
          status: computeProductStatus(newSixStock, sixProd.minStock),
          updatedAt: now.toISOString()
        });
        await updateDoc(doc(db, 'products', singleProd.id), {
          availableStock: newSingleStock,
          status: computeProductStatus(newSingleStock, singleProd.minStock),
          updatedAt: now.toISOString()
        });
        await setDoc(doc(db, 'movements', movIdSix), movSix);
        await setDoc(doc(db, 'movements', movIdSingle), movSingle);
      } catch (err) {
        console.warn('Firestore update for six-pack unpack failed:', err);
      }
    }

    this.notify();
    return {
      sixPackProduct: this.productsCache[sixIndex],
      singleProduct: this.productsCache[singleIndex]
    };
  }

  /**
   * Crear o actualizar un producto (Administración)
   */
  public async upsertProduct(product: Partial<Product> & { name: string; category: 'Bebidas' | 'Snacks'; salePrice: number }): Promise<Product> {
    const now = new Date().toISOString();
    const isNew = !product.id || !this.productsCache.some(p => p.id === product.id);
    const prodId = product.id || `prod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    let finalProduct: Product;

    if (isNew) {
      const initialStock = Number(product.initialStock ?? 0);
      const availableStock = Number(product.availableStock ?? initialStock);
      const minStock = Number(product.minStock ?? 3);
      const targetStock = Number(product.targetStock ?? 15);

      finalProduct = {
        id: prodId,
        internalCode: product.internalCode || (product.category === 'Bebidas' ? `BEB-${String(this.productsCache.length + 1).padStart(3, '0')}` : `SNK-${String(this.productsCache.length + 1).padStart(3, '0')}`),
        barcode: product.barcode || '',
        name: product.name.trim(),
        category: product.category,
        salePrice: Number(product.salePrice),
        purchaseCost: Number(product.purchaseCost ?? 0),
        initialStock,
        availableStock,
        minStock,
        targetStock,
        status: computeProductStatus(availableStock, minStock),
        isSixPack: Boolean(product.isSixPack),
        singleUnitId: product.singleUnitId || '',
        unitsPerPack: product.unitsPerPack || 6,
        createdAt: now,
        updatedAt: now
      };

      this.productsCache.push(finalProduct);

      if (availableStock > 0) {
        const movId = `mov_${Date.now()}`;
        const mov: InventoryMovement = {
          id: movId,
          productId: finalProduct.id,
          productName: finalProduct.name,
          internalCode: finalProduct.internalCode,
          movementType: 'AJUSTE_INICIAL',
          previousStock: 0,
          quantityChanged: availableStock,
          finalStock: availableStock,
          createdAt: now,
          dateStr: now.slice(0, 10),
          notes: 'Creación de producto e inventario inicial'
        };
        this.movementsCache.unshift(mov);
        this.saveMovementsToLocalStorage();
      }
    } else {
      const existingIndex = this.productsCache.findIndex(p => p.id === prodId);
      const existing = this.productsCache[existingIndex];
      const availableStock = product.availableStock !== undefined ? Number(product.availableStock) : existing.availableStock;
      const minStock = product.minStock !== undefined ? Number(product.minStock) : existing.minStock;
      const targetStock = product.targetStock !== undefined ? Number(product.targetStock) : (existing.targetStock || 15);

      finalProduct = {
        ...existing,
        ...product,
        availableStock,
        minStock,
        targetStock,
        status: computeProductStatus(availableStock, minStock),
        updatedAt: now
      };

      if (existing.availableStock !== availableStock) {
        const diff = availableStock - existing.availableStock;
        const movId = `mov_${Date.now()}`;
        const mov: InventoryMovement = {
          id: movId,
          productId: finalProduct.id,
          productName: finalProduct.name,
          internalCode: finalProduct.internalCode,
          movementType: 'EDICION',
          previousStock: existing.availableStock,
          quantityChanged: diff,
          finalStock: availableStock,
          createdAt: now,
          dateStr: now.slice(0, 10),
          notes: 'Ajuste manual de existencias desde administración'
        };
        this.movementsCache.unshift(mov);
        this.saveMovementsToLocalStorage();
      }

      this.productsCache[existingIndex] = finalProduct;
    }

    this.saveProductsToLocalStorage();
    this.notify();

    // Persist to remote db asynchronously if available
    try {
      if (auth.currentUser || this.isLiveConnected) {
        await setDoc(doc(db, 'products', finalProduct.id), finalProduct);
      }
    } catch (err) {
      console.warn('Firestore setDoc failed, safely stored in local cache:', err);
    }

    return finalProduct;
  }

  /**
   * Eliminar producto (Solo admin)
   */
  public async deleteProduct(productId: string) {
    this.productsCache = this.productsCache.filter(p => p.id !== productId);
    this.saveProductsToLocalStorage();

    if (this.isLiveConnected && auth.currentUser) {
      try {
        await deleteDoc(doc(db, 'products', productId));
      } catch (err) {
        console.warn('Firestore deleteDoc failed:', err);
      }
    }

    this.notify();
  }

  /**
   * Importar catálogo desde CSV
   */
  public async importProductsFromCSV(csvText: string): Promise<number> {
    const lines = csvText.trim().split(/\r?\n/);
    if (lines.length < 2) {
      throw new Error('El archivo CSV debe contener encabezados y al menos una fila de datos.');
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    let importedCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = cols[idx] || '';
      });

      const name = row['nombre'] || row['name'] || row['producto'] || '';
      if (!name) continue;

      const category = (row['categoria'] || row['category'] || '').toLowerCase().includes('snack')
        ? 'Snacks'
        : 'Bebidas';

      const internalCode = row['codigo_interno'] || row['codigo'] || row['code'] || `IMP-${String(i).padStart(3, '0')}`;
      const barcode = row['codigo_barras'] || row['barcode'] || '';
      const salePrice = parseFloat(row['precio_venta'] || row['precio'] || row['price'] || '0') || 0;
      const purchaseCost = parseFloat(row['costo_compra'] || row['costo'] || row['cost'] || '0') || 0;
      const initialStock = parseInt(row['stock_inicial'] || row['stock'] || '10', 10) || 10;
      const availableStock = parseInt(row['stock_disponible'] || row['stock'] || String(initialStock), 10) || initialStock;
      const minStock = parseInt(row['stock_minimo'] || '3', 10) || 3;
      const targetStock = parseInt(row['stock_objetivo'] || '15', 10) || 15;

      await this.upsertProduct({
        internalCode,
        barcode,
        name,
        category,
        salePrice,
        purchaseCost,
        initialStock,
        availableStock,
        minStock,
        targetStock,
        status: computeProductStatus(availableStock, minStock)
      });

      importedCount++;
    }

    return importedCount;
  }

  public exportProductsCSV(): string {
    const headers = [
      'codigo_interno',
      'codigo_barras',
      'nombre',
      'categoria',
      'precio_venta_usd',
      'costo_compra_usd',
      'stock_inicial',
      'stock_disponible',
      'stock_minimo',
      'stock_objetivo',
      'estado'
    ];

    const rows = this.productsCache.map(p => [
      `"${p.internalCode}"`,
      `"${p.barcode || ''}"`,
      `"${p.name}"`,
      `"${p.category}"`,
      p.salePrice.toFixed(2),
      p.purchaseCost.toFixed(2),
      p.initialStock,
      p.availableStock,
      p.minStock,
      p.targetStock || 20,
      `"${p.status}"`
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  public exportSalesCSV(): string {
    const headers = [
      'numero_venta',
      'fecha',
      'hora',
      'metodo_pago',
      'total_usd',
      'total_items',
      'detalle_productos',
      'es_prueba'
    ];

    const rows = this.salesCache.map(s => {
      const details = s.items.map(i => `${i.quantity}x ${i.name} ($${i.unitPrice.toFixed(2)})`).join(' | ');
      return [
        `"${s.saleNumber}"`,
        `"${s.dateStr}"`,
        `"${s.timeStr}"`,
        `"${s.paymentMethod}"`,
        s.totalAmount.toFixed(2),
        s.itemsCount,
        `"${details}"`,
        s.isTest ? 'SI' : 'NO'
      ];
    });

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  public exportMovementsCSV(): string {
    const headers = [
      'id_movimiento',
      'fecha',
      'producto',
      'codigo',
      'tipo_movimiento',
      'stock_anterior',
      'cambio',
      'stock_final',
      'referencia',
      'notas'
    ];

    const rows = this.movementsCache.map(m => [
      `"${m.id}"`,
      `"${m.createdAt}"`,
      `"${m.productName}"`,
      `"${m.internalCode}"`,
      `"${m.movementType}"`,
      m.previousStock,
      m.quantityChanged,
      m.finalStock,
      `"${m.referenceId || ''}"`,
      `"${m.notes || ''}"`
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  /**
   * Restablecer al Inventario Oficial de FORTIN CLUB al 27 de Octubre de 2026 (22 productos - 165 unidades)
   */
  public resetToInitialInventory() {
    this.productsCache = [...INITIAL_PRODUCTS_OCT_2026];
    this.saveProductsToLocalStorage();
    this.notify();
  }
}

export const dbService = new DatabaseService();
