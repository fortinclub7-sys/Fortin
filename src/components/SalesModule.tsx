import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Barcode, 
  Plus, 
  Minus, 
  Trash2, 
  CreditCard, 
  Banknote, 
  ArrowRightLeft, 
  AlertTriangle,
  ShoppingBag,
  DollarSign,
  CheckCircle,
  FlaskConical,
  Tag,
  X
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Product, CartItem, PaymentMethod, Sale } from '../types';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { ReceiptModal } from './ReceiptModal';

interface SalesModuleProps {
  products: Product[];
  onExecuteSale: (
    items: CartItem[],
    paymentMethod: PaymentMethod,
    cashReceived: number,
    isTestSale: boolean
  ) => Promise<Sale>;
  onUpdateProductPrice: (productId: string, price: number) => Promise<void>;
  isDemoMode: boolean;
}

export const SalesModule: React.FC<SalesModuleProps> = ({
  products,
  onExecuteSale,
  onUpdateProductPrice,
  isDemoMode
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'Todos' | 'Bebidas' | 'Snacks'>('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Efectivo');
  const [cashReceivedInput, setCashReceivedInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Quick Price Setup Modal
  const [priceSetupProduct, setPriceSetupProduct] = useState<Product | null>(null);
  const [newPriceInput, setNewPriceInput] = useState<string>('');
  const [isSavingPrice, setIsSavingPrice] = useState(false);

  // Filter products by category and search query
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchCategory = selectedCategory === 'Todos' || p.category === selectedCategory;
      const matchQuery = 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.internalCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.barcode && p.barcode.includes(searchQuery));
      return matchCategory && matchQuery;
    });
  }, [products, selectedCategory, searchQuery]);

  // Cart calculations
  const totalAmount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.subtotal, 0);
  }, [cart]);

  const totalItemsCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  const parsedCashReceived = parseFloat(cashReceivedInput) || 0;
  const cashChange = paymentMethod === 'Efectivo' 
    ? Math.max(0, parsedCashReceived - totalAmount) 
    : 0;

  const isCashInsufficient = paymentMethod === 'Efectivo' && parsedCashReceived > 0 && parsedCashReceived < totalAmount;

  // Add product to cart with strict validation
  const handleAddToCart = (product: Product) => {
    setErrorMessage(null);

    // Strict validation: Require valid price before selling
    if (!product.salePrice || product.salePrice <= 0) {
      setPriceSetupProduct(product);
      setNewPriceInput('');
      return;
    }

    if (product.availableStock <= 0) {
      setErrorMessage(`El producto "${product.name}" está agotado.`);
      return;
    }

    setCart(prevCart => {
      const existingIndex = prevCart.findIndex(item => item.product.id === product.id);

      if (existingIndex !== -1) {
        const currentQty = prevCart[existingIndex].quantity;
        if (currentQty + 1 > product.availableStock) {
          setErrorMessage(`Stock máximo alcanzado para "${product.name}" (Disponible: ${product.availableStock}).`);
          return prevCart;
        }

        const updated = [...prevCart];
        const newQty = currentQty + 1;
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: newQty,
          subtotal: Number((newQty * updated[existingIndex].unitPrice).toFixed(2))
        };
        return updated;
      } else {
        return [
          ...prevCart,
          {
            product,
            quantity: 1,
            unitPrice: product.salePrice,
            unitCost: product.purchaseCost || 0,
            subtotal: product.salePrice
          }
        ];
      }
    });
  };

  // Quick price save
  const handleSavePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!priceSetupProduct) return;
    const cleanPrice = newPriceInput.trim().replace(',', '.');
    const p = parseFloat(cleanPrice);
    if (isNaN(p) || p <= 0) {
      setErrorMessage('Ingresa un precio mayor a $0.00');
      return;
    }

    try {
      setIsSavingPrice(true);
      await onUpdateProductPrice(priceSetupProduct.id, p);
      // Auto add to cart once price is set
      const updatedProduct = { ...priceSetupProduct, salePrice: p };
      handleAddToCart(updatedProduct);
      setPriceSetupProduct(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al guardar el precio.');
    } finally {
      setIsSavingPrice(false);
    }
  };

  // Update quantity in cart
  const handleUpdateQuantity = (productId: string, delta: number) => {
    setErrorMessage(null);
    setCart(prevCart => {
      return prevCart
        .map(item => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;

            const currentStock = item.product.availableStock;
            if (newQty > currentStock) {
              setErrorMessage(`Stock disponible alcanzado (${currentStock} unidades).`);
              return item;
            }

            return {
              ...item,
              quantity: newQty,
              subtotal: Number((newQty * item.unitPrice).toFixed(2))
            };
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  // Remove from cart
  const handleRemoveItem = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  // Clear cart
  const handleClearCart = () => {
    if (cart.length === 0) return;
    setCart([]);
    setCashReceivedInput('');
    setErrorMessage(null);
  };

  const setExactCash = () => {
    setCashReceivedInput(totalAmount.toFixed(2));
  };

  const setPresetCash = (val: number) => {
    setCashReceivedInput(val.toFixed(2));
  };

  // Execute Sale with double-click protection and atomic validation
  const handleFinalizeSale = async () => {
    if (isSubmitting) return; // Prevent double click
    setErrorMessage(null);

    if (cart.length === 0) {
      setErrorMessage('Agrega al menos un producto al carrito para finalizar la venta.');
      return;
    }

    // Check that all items in cart have a valid price
    const itemWithoutPrice = cart.find(i => i.unitPrice <= 0);
    if (itemWithoutPrice) {
      setErrorMessage(`El producto "${itemWithoutPrice.product.name}" no tiene precio de venta válido.`);
      return;
    }

    if (paymentMethod === 'Efectivo') {
      if (parsedCashReceived < totalAmount) {
        setErrorMessage(
          `Efectivo insuficiente. Total a pagar: $${totalAmount.toFixed(2)}, entregado: $${parsedCashReceived.toFixed(2)}.`
        );
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const sale = await onExecuteSale(
        cart,
        paymentMethod,
        paymentMethod === 'Efectivo' ? parsedCashReceived : totalAmount,
        isDemoMode
      );

      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.8 },
          colors: ['#10b981', '#059669', '#34d399', '#f59e0b']
        });
      } catch (e) {}

      setCart([]);
      setCashReceivedInput('');
      setCompletedSale(sale);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al procesar la venta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 pb-24 md:pb-12">
      
      {/* Test Mode Banner Alert */}
      {isDemoMode && (
        <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-xl flex items-center justify-between text-purple-900 text-xs sm:text-sm">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-purple-600 shrink-0" />
            <div>
              <span className="font-bold">MODO DE PRUEBA ACTIVO:</span> Las ventas registradas se marcarán como prueba y NO descontarán existencias oficiales de FORTIN CLUB.
            </div>
          </div>
        </div>
      )}

      {/* Main POS Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Products Grid */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          
          {/* Top Bar: Search, Category Buttons, Barcode Scanner */}
          <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
            
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar producto por nombre o código (ej: Pilsener, Chifles, Agua)..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-medium"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Barcode Scanner */}
              <button
                onClick={() => setIsScannerOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl font-bold text-sm transition-all shrink-0 active:scale-95 shadow-xs"
                title="Escanear código de barras con la cámara"
              >
                <Barcode className="w-5 h-5 text-emerald-600" />
                <span className="hidden sm:inline">Escanear</span>
              </button>
            </div>

            {/* Category Selector Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setSelectedCategory('Todos')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  selectedCategory === 'Todos'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>Todos ({products.length})</span>
              </button>

              <button
                onClick={() => setSelectedCategory('Bebidas')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  selectedCategory === 'Bebidas'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-100'
                }`}
              >
                <span>🥤 Bebidas ({products.filter(p => p.category === 'Bebidas').length})</span>
              </button>

              <button
                onClick={() => setSelectedCategory('Snacks')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  selectedCategory === 'Snacks'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-100'
                }`}
              >
                <span>🍿 Snacks ({products.filter(p => p.category === 'Snacks').length})</span>
              </button>
            </div>

          </div>

          {/* Product Grid: Large touch buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredProducts.map(product => {
              const isOutOfStock = product.availableStock <= 0;
              const isLowStock = product.availableStock > 0 && product.availableStock <= product.minStock;
              const hasPrice = product.salePrice && product.salePrice > 0;
              const cartQuantity = cart.find(i => i.product.id === product.id)?.quantity || 0;

              return (
                <button
                  key={product.id}
                  disabled={isOutOfStock}
                  onClick={() => handleAddToCart(product)}
                  className={`group relative p-3.5 rounded-2xl border text-left transition-all duration-150 flex flex-col justify-between min-h-[140px] ${
                    isOutOfStock
                      ? 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed'
                      : 'bg-white border-slate-200/90 hover:border-emerald-500 hover:shadow-md active:scale-98'
                  }`}
                >
                  {/* Cart badge if product in cart */}
                  {cartQuantity > 0 && (
                    <div className="absolute -top-2 -right-2 bg-emerald-600 text-white text-xs font-black w-6 h-6 rounded-full flex items-center justify-center ring-2 ring-white shadow-sm z-10">
                      {cartQuantity}
                    </div>
                  )}

                  {/* Top: Category Tag & Code */}
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        product.category === 'Bebidas'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-amber-50 text-amber-800'
                      }`}>
                        {product.category === 'Bebidas' ? '🥤 Bebida' : '🍿 Snack'}
                      </span>

                      {product.isSixPack && (
                        <span className="text-[10px] font-black bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded-md">
                          SIX PACK
                        </span>
                      )}
                    </div>

                    {/* Product Name */}
                    <h4 className="font-bold text-slate-800 text-sm leading-snug line-clamp-2 group-hover:text-emerald-700 transition-colors">
                      {product.name}
                    </h4>
                  </div>

                  {/* Bottom: Stock indicator & Price */}
                  <div className="pt-2 mt-2 border-t border-slate-100 flex items-end justify-between">
                    <div>
                      <div className="text-[10px] text-slate-400 font-mono">{product.internalCode}</div>
                      <div className={`text-xs font-bold ${
                        isOutOfStock 
                          ? 'text-rose-600 font-extrabold' 
                          : isLowStock 
                            ? 'text-amber-600 font-bold' 
                            : 'text-slate-500'
                      }`}>
                        {isOutOfStock ? 'Agotado' : `Stock: ${product.availableStock}`}
                      </div>
                    </div>

                    {/* Price or 'Sin precio' button */}
                    <div className="text-right">
                      {hasPrice ? (
                        <span className="text-base sm:text-lg font-black text-emerald-700">
                          ${product.salePrice.toFixed(2)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-black text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md group-hover:bg-amber-200 transition-colors">
                          <Tag className="w-3 h-3" />
                          <span>Fijar $</span>
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {filteredProducts.length === 0 && (
            <div className="bg-white p-8 rounded-2xl text-center border border-slate-200">
              <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="font-bold text-slate-700">No se encontraron productos</p>
              <p className="text-xs text-slate-400 mt-1">Prueba con otro término o selecciona otra categoría.</p>
            </div>
          )}

        </div>

        {/* Right Column: Shopping Cart & Fast Checkout Panel */}
        <div className="lg:col-span-5 xl:col-span-4">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-md p-4 sticky top-20 flex flex-col min-h-[500px]">
            
            {/* Cart Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-emerald-600" />
                <h3 className="font-black text-slate-800 text-base">Carrito de Cobro</h3>
                {totalItemsCount > 0 && (
                  <span className="bg-emerald-100 text-emerald-800 text-xs font-black px-2 py-0.5 rounded-full">
                    {totalItemsCount} {totalItemsCount === 1 ? 'ítem' : 'ítems'}
                  </span>
                )}
              </div>

              {cart.length > 0 && (
                <button
                  onClick={handleClearCart}
                  className="text-xs text-slate-400 hover:text-rose-600 font-bold transition-colors"
                >
                  Vaciar
                </button>
              )}
            </div>

            {/* Error Message Alert */}
            {errorMessage && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-rose-800 text-xs">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="font-semibold">{errorMessage}</span>
              </div>
            )}

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto max-h-[300px] py-2 space-y-2 divide-y divide-slate-100">
              {cart.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <span className="text-3xl block mb-2">⚽</span>
                  <p className="text-sm font-bold text-slate-600">Carrito vacío</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Toca cualquier producto a la izquierda o escanea el código de barras para agregarlo.
                  </p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.product.id} className="pt-2 flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h5 className="font-bold text-slate-800 text-xs truncate">
                        {item.product.name}
                      </h5>
                      <div className="text-[11px] text-slate-400">
                        ${item.unitPrice.toFixed(2)} c/u
                      </div>
                    </div>

                    {/* Quantity controls (+ / -) */}
                    <div className="flex items-center gap-1.5 bg-slate-100 rounded-lg p-1">
                      <button
                        onClick={() => handleUpdateQuantity(item.product.id, -1)}
                        className="w-6 h-6 flex items-center justify-center rounded-md bg-white hover:bg-slate-200 text-slate-700 shadow-2xs font-black transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-5 text-center font-bold text-xs text-slate-800">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => handleUpdateQuantity(item.product.id, 1)}
                        className="w-6 h-6 flex items-center justify-center rounded-md bg-white hover:bg-slate-200 text-slate-700 shadow-2xs font-black transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Subtotal & Delete */}
                    <div className="text-right flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-xs">
                        ${item.subtotal.toFixed(2)}
                      </span>
                      <button
                        onClick={() => handleRemoveItem(item.product.id)}
                        className="text-slate-300 hover:text-rose-500 transition-colors p-1"
                        title="Quitar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Payment & Checkout Section */}
            {cart.length > 0 && (
              <div className="pt-3 border-t border-slate-200 space-y-3">
                
                {/* Grand Total */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/70 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">Total a Cobrar</span>
                    <span className="text-xs text-slate-400">USD - FORTIN CLUB</span>
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-emerald-700 tracking-tight">
                    ${totalAmount.toFixed(2)}
                  </div>
                </div>

                {/* Payment Method Selector */}
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                    Método de Pago:
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('Efectivo')}
                      className={`py-2 px-1 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all ${
                        paymentMethod === 'Efectivo'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <Banknote className="w-4 h-4" />
                      <span>Efectivo</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('Transferencia')}
                      className={`py-2 px-1 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all ${
                        paymentMethod === 'Transferencia'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <ArrowRightLeft className="w-4 h-4" />
                      <span>Transferencia</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('Otros')}
                      className={`py-2 px-1 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all ${
                        paymentMethod === 'Otros'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Otros</span>
                    </button>
                  </div>
                </div>

                {/* Cash Change Calculator */}
                {paymentMethod === 'Efectivo' && (
                  <div className="space-y-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>Efectivo Recibido ($):</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={cashReceivedInput}
                        onChange={(e) => setCashReceivedInput(e.target.value)}
                        placeholder="0.00"
                        className="w-24 text-right px-2 py-1 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                      />
                    </div>

                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={setExactCash}
                        className="px-2 py-1 bg-white border border-slate-200 rounded-md text-[11px] font-bold text-emerald-700 hover:bg-emerald-50 transition-colors"
                      >
                        Exacto (${totalAmount.toFixed(2)})
                      </button>
                      {[1, 2, 5, 10, 20].map(amt => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setPresetCash(amt)}
                          className="px-2 py-1 bg-white border border-slate-200 rounded-md text-[11px] font-bold text-slate-700 hover:bg-slate-100 transition-colors"
                        >
                          ${amt}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-200 text-xs">
                      <span className="font-bold text-slate-600">Cambio / Vuelto:</span>
                      <span className={`font-mono font-black text-sm ${
                        isCashInsufficient ? 'text-rose-600' : 'text-emerald-700'
                      }`}>
                        {isCashInsufficient ? 'Falta dinero' : `$${cashChange.toFixed(2)}`}
                      </span>
                    </div>
                  </div>
                )}

                {/* Transfer Info */}
                {paymentMethod === 'Transferencia' && (
                  <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs">
                    <p className="font-bold">Pago por Transferencia / Deuna</p>
                    <p className="text-[11px] text-blue-700 mt-0.5">
                      Verifica el comprobante digital en el celular del cliente antes de confirmar.
                    </p>
                  </div>
                )}

                {/* BIG BUTTON: FINALIZAR VENTA */}
                <button
                  onClick={handleFinalizeSale}
                  disabled={isSubmitting || (paymentMethod === 'Efectivo' && parsedCashReceived < totalAmount)}
                  className={`w-full py-4 px-6 rounded-2xl font-black text-base text-white shadow-lg transition-all flex items-center justify-center gap-2 active:scale-98 ${
                    isSubmitting || (paymentMethod === 'Efectivo' && parsedCashReceived < totalAmount)
                      ? 'bg-slate-300 cursor-not-allowed shadow-none'
                      : isDemoMode 
                        ? 'bg-purple-600 hover:bg-purple-700 ring-2 ring-purple-400' 
                        : 'bg-emerald-600 hover:bg-emerald-700 hover:shadow-emerald-600/30'
                  }`}
                >
                  {isSubmitting ? (
                    <span>Procesando venta...</span>
                  ) : (
                    <>
                      <span>⚽ FINALIZAR VENTA</span>
                      <span className="text-sm font-semibold opacity-90">(${totalAmount.toFixed(2)})</span>
                    </>
                  )}
                </button>

              </div>
            )}

          </div>
        </div>

      </div>

      {/* Quick Price Setup Modal */}
      {priceSetupProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-100 p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h4 className="font-black text-slate-800 text-sm flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-emerald-600" />
                <span>Asignar Precio de Venta</span>
              </h4>
              <button
                onClick={() => setPriceSetupProduct(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              <span className="font-bold text-slate-800">{priceSetupProduct.name}</span> aún no tiene precio de venta asignado en FORTIN CLUB. Ingresa su precio oficial en USD:
            </p>

            <form onSubmit={handleSavePrice} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Precio de Venta ($ USD):</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    autoFocus
                    value={newPriceInput}
                    onChange={(e) => setNewPriceInput(e.target.value)}
                    placeholder="Ej: 1.50"
                    className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPriceSetupProduct(null)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingPrice}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs"
                >
                  {isSavingPrice ? 'Guardando...' : 'Guardar y Agregar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        products={products}
        onProductFound={(p) => {
          handleAddToCart(p);
          setIsScannerOpen(false);
        }}
      />

      {/* Digital Receipt Modal */}
      <ReceiptModal
        sale={completedSale}
        onClose={() => setCompletedSale(null)}
      />

    </div>
  );
};
