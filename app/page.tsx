'use client';

import { useState, useRef, useEffect } from 'react';
import type { BrandingSettings } from '@/types';

interface WholesaleTier { min_qty: number; price: number; label: string; }
interface Category { id: string; name: string; parent_id: string | null; children?: Category[]; }
interface ProductSize { size: string; price: number; stock: number; }
interface Product {
  id: string; name: string; price: number; brand: string | null; category_id: string | null;
  image_url: string | null; additional_images: string[] | null; quantity: number;
  wholesale_tiers: WholesaleTier[] | null;
  product_code: string | null;
  sizes: ProductSize[] | null;
  specifications: Record<string, string> | null;
  description: string | null;
}
interface CartItem {
  id: string; quantity: number; unit_price: number; is_wholesale: boolean; tier_label: string | null;
  retail_price: number; subtotal: number; discount: number;
  product: Product;
  size: string | null;
}

export default function ShopPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryTree, setCategoryTree] = useState<Category[]>([]);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Cart
  const [cartId, setCartId] = useState<string | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartTotal, setCartTotal] = useState(0);
  const [cartDiscount, setCartDiscount] = useState(0);
  const [sessionId, setSessionId] = useState('');

  // Search & Scan
  const [searchQuery, setSearchQuery] = useState('');
  const [correctedQuery, setCorrectedQuery] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [mode, setMode] = useState<'browse' | 'cart' | 'scan'>('browse');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraActive, setCameraActive] = useState(false);

  // Product detail
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [addQty, setAddQty] = useState(1);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [fullscreenPhoto, setFullscreenPhoto] = useState<string | null>(null);
  const [branding, setBranding] = useState<Pick<BrandingSettings, 'title' | 'subtitle'>>({
    title: 'PriceScan',
    subtitle: 'Wholesale Lookup',
  });
  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  // Transfer
  const [transferCode, setTransferCode] = useState<string | null>(null);
  const [transferExpires, setTransferExpires] = useState<string | null>(null);

  useEffect(() => {
    let sid = localStorage.getItem('shop_session');
    if (!sid) {
      sid = 'sess_' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('shop_session', sid);
    }
    setSessionId(sid);
    fetchData();
    fetchCart(sid);
    fetchBranding();
  }, []);

  useEffect(() => {
    if (searchQuery.length > 2) {
      const delay = setTimeout(() => handleSearch(), 400);
      return () => clearTimeout(delay);
    } else if (searchQuery.length === 0) {
      setCorrectedQuery(null);
      fetchData(); // Reset
    }
  }, [searchQuery]);

  // AI-powered smart search
  const handleSearch = async () => {
    setSearchLoading(true);
    try {
      const res = await fetch('/api/smart-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery })
      });
      const data = await res.json();
      if (data.results) {
        setProducts(data.results);
      }
      if (data.correctedQuery) {
        setCorrectedQuery(data.correctedQuery);
      } else {
        setCorrectedQuery(null);
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setSearchLoading(false);
    }
  };

  // Handle Camera Stream
  useEffect(() => {
    let stream: MediaStream | null = null;
    if (mode === 'scan' && cameraActive) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(s => {
          stream = s;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
          }
        })
        .catch(err => console.error("Camera access denied:", err));
    }
    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, [mode, cameraActive]);

  const fetchData = async () => {
    setLoading(true);
    const [allRes, catRes] = await Promise.all([
      fetch('/api/search-products?all=true'),
      fetch('/api/categories')
    ]);
    const allProds = await allRes.json();
    const cats = await catRes.json();

    setProducts(allProds.products || []);
    setCategories(cats.categories || []);
    setCategoryTree(cats.tree || []);
    setLoading(false);
  };

  const fetchCart = async (sid: string) => {
    const res = await fetch(`/api/cart?session=${sid}`);
    const data = await res.json();
    setCartId(data.cart_id);
    setCartItems(data.items || []);
    setCartTotal(data.total || 0);
    setCartDiscount(data.total_discount || 0);
  };

  const fetchBranding = async () => {
    try {
      const res = await fetch('/api/branding');
      if (res.ok) {
        const data = await res.json();
        setBranding({
          title: data.title || 'PriceScan',
          subtitle: data.subtitle || 'Wholesale Lookup',
        });
      }
    } catch (error) {
      console.error('Branding load failed:', error);
    }
  };

  const addToCart = async (productId: string, qty: number, size?: string | null) => {
    await fetch('/api/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, productId, quantity: qty, size })
    });
    fetchCart(sessionId);
    setSelectedProduct(null);
    setAddQty(1);
    setSelectedSize(null);
    setMode('browse');
  };

  const updateCartItem = async (itemId: string, qty: number) => {
    await fetch('/api/cart', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, itemId, quantity: qty })
    });
    fetchCart(sessionId);
  };

  const removeCartItem = async (itemId: string) => {
    await fetch(`/api/cart?itemId=${itemId}`, { method: 'DELETE' });
    fetchCart(sessionId);
  };

  const generateTransferCode = async () => {
    if (!cartId) return;
    const res = await fetch('/api/transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cartId })
    });
    const data = await res.json();
    if (data.code) {
      setTransferCode(data.code);
      setTransferExpires(data.expires_at);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processImage(file);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        canvasRef.current.toBlob(blob => {
          if (blob) processImage(blob);
        }, 'image/jpeg');
      }
    }
  };

  const processImage = async (fileOrBlob: Blob) => {
    setScanning(true);
    // Stop camera if active
    setCameraActive(false);

    const reader = new FileReader();
    reader.onload = async () => {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: reader.result })
      });
      const data = await res.json();
      if (data.product) {
        setSelectedProduct(data.product);
      } else if (data.similarProducts?.length) {
        setProducts(data.similarProducts);
      }
      setScanning(false);
      setMode('browse');
    };
    reader.readAsDataURL(fileOrBlob);
  };

  const filteredProducts = selectedCat
    ? products.filter(p => p.category_id === selectedCat)
    : products;

  const getPriceDisplay = (product: Product, qty: number) => {
    const tiers = product.wholesale_tiers || [];
    const sorted = [...tiers].sort((a, b) => b.min_qty - a.min_qty);
    for (const tier of sorted) {
      if (qty >= tier.min_qty) {
        return { price: tier.price, isWholesale: true, label: tier.label, discount: product.price - tier.price };
      }
    }
    return { price: product.price, isWholesale: false, label: null, discount: 0 };
  };

  const cartItemCount = cartItems.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-orange-500 selection:text-white">
      {/* Background Gradients - Light Mode */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-orange-100/50 to-transparent opacity-60" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-100/40 rounded-full blur-3xl opacity-50" />
      </div>

      <div className="relative z-10 max-w-md mx-auto min-h-screen flex flex-col bg-white shadow-2xl overflow-hidden border-x border-gray-100">

        {/* Scan Mode UI */}
        {mode === 'scan' && (
          <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-between py-10">
            <div className="relative w-full flex-1 flex items-center justify-center bg-black overflow-hidden">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              <canvas ref={canvasRef} className="hidden" />
              <div className="absolute inset-0 border-[60px] border-black/50 pointer-events-none">
                <div className="w-full h-full border-2 border-white/50 relative">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-orange-500 -mt-1 -ml-1"></div>
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-orange-500 -mt-1 -mr-1"></div>
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-orange-500 -mb-1 -ml-1"></div>
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-orange-500 -mb-1 -mr-1"></div>
                </div>
              </div>
              {scanning && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                  <div className="text-white font-bold text-xl animate-pulse">Scanning...</div>
                </div>
              )}
            </div>

            <div className="w-full px-6 flex justify-between items-center mt-6">
              <button onClick={() => { setMode('browse'); setCameraActive(false); }} className="text-white p-4 rounded-full bg-white/10 backdrop-blur">
                ✕
              </button>
              <button onClick={capturePhoto} className="w-20 h-20 bg-white rounded-full border-4 border-gray-300 shadow-xl active:scale-95 transition-transform flex items-center justify-center">
                <div className="w-16 h-16 bg-white rounded-full border-2 border-black/10" />
              </button>
              <label className="text-white p-4 rounded-full bg-white/10 backdrop-blur cursor-pointer">
                🖼️
                <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
          </div>
        )}

        {/* Header Area */}
        {mode === 'browse' && (
          <>
            <div className="p-6 sticky top-0 bg-white/90 backdrop-blur-xl z-30 border-b border-gray-100 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h1 className="text-2xl font-black italic bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent">{branding.title}</h1>
                  <p className="text-xs text-gray-400 font-medium tracking-wider uppercase">{branding.subtitle}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div onClick={() => setMode('cart')} className="relative p-3 bg-gray-50 border border-gray-200 rounded-2xl active:scale-95 transition-all cursor-pointer hover:bg-gray-100">
                    🛒
                    {cartItemCount > 0 && (
                      <span className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-r from-orange-500 to-pink-500 rounded-full text-white text-xs flex items-center justify-center font-bold shadow-lg shadow-orange-500/40 border-2 border-white">
                        {cartItemCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="relative group flex gap-2">
                <div className="relative flex-1">
                  <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search in any language..."
                    className="w-full pl-10 pr-4 py-4 bg-gray-100 border-none rounded-2xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all font-medium"
                  />
                  <span className="absolute left-3 top-4 text-gray-400 text-lg">
                    {searchLoading ? '⏳' : '🔍'}
                  </span>
                </div>
                <button
                  onClick={() => { setMode('scan'); setCameraActive(true); }}
                  className="px-4 bg-gray-900 text-white rounded-2xl text-2xl active:scale-95 transition-transform shadow-lg shadow-gray-900/20"
                >
                  📷
                </button>
              </div>

              {/* Spell correction hint */}
              {correctedQuery && (
                <div className="mt-3 text-sm text-gray-500">
                  <span className="text-gray-400">Did you mean: </span>
                  <button
                    onClick={() => setSearchQuery(correctedQuery)}
                    className="text-orange-600 font-bold hover:underline"
                  >
                    {correctedQuery}
                  </button>
                  <span className="text-gray-300 ml-2">• AI-powered search</span>
                </div>
              )}
            </div>

            {/* Categories */}
            <div className="px-6 mb-4 overflow-x-auto no-scrollbar py-2 flex gap-3 z-0">
              <button
                onClick={() => setSelectedCat(null)}
                className={`whitespace-nowrap px-6 py-3 rounded-full text-sm font-bold transition-all shadow-sm ${!selectedCat ? 'bg-gray-900 text-white shadow-gray-900/20' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}
              >
                All Items
              </button>
              {categoryTree.map(cat => (
                <button key={cat.id} onClick={() => setSelectedCat(cat.id)}
                  className={`whitespace-nowrap px-6 py-3 rounded-full text-sm font-bold transition-all shadow-sm ${selectedCat === cat.id ? 'bg-gray-900 text-white shadow-gray-900/20' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Product Grid */}
            <div className="flex-1 px-6 pb-24 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                {products.length === 0 && !loading && (
                  <div className="col-span-2 text-center py-20 text-gray-400">
                    <p className="text-4xl mb-4 opacity-50">🔦</p>
                    <p>No products found</p>
                  </div>
                )}
                {filteredProducts.map(p => (
                  <div key={p.id} onClick={() => { setSelectedProduct(p); setActiveImageIndex(0); setAddQty(1); setSelectedSize(p.sizes?.[0]?.size || null); }}
                    className="group bg-white border border-gray-100 rounded-3xl p-3 cursor-pointer hover:shadow-xl hover:shadow-orange-500/5 transition-all active:scale-95 relative overflow-hidden">
                    <div className="relative aspect-square rounded-2xl overflow-hidden mb-3 bg-gray-100">
                      {p.image_url ? (
                        <img src={p.image_url} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 mix-blend-multiply" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl bg-gray-100 text-gray-300">📦</div>
                      )}
                      {p.wholesale_tiers && p.wholesale_tiers.length > 0 && (
                        <div className="absolute top-2 left-2 bg-yellow-400/90 text-black text-[10px] font-bold px-2 py-1 rounded-full shadow-lg backdrop-blur-sm border border-white/20">
                          WHOLESALE
                        </div>
                      )}
                      <div className="absolute bottom-2 right-2 w-8 h-8 bg-black rounded-full flex items-center justify-center text-white font-bold shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                        +
                      </div>
                    </div>
                    <div className="px-1">
                      <h3 className="text-gray-900 font-bold truncate text-sm mb-1">{p.name}</h3>
                      <p className="text-gray-400 text-xs truncate mb-2">{p.brand || 'Generic'}</p>
                      <div className="flex justify-between items-end">
                        <span className="text-orange-500 font-black text-lg">₱{p.price.toFixed(0)}</span>
                        {p.quantity < 5 && <span className="text-[10px] text-red-500 font-medium bg-red-50 px-2 py-0.5 rounded-full">{p.quantity} left</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Cart Mode */}
        {mode === 'cart' && (
          <div className="flex flex-col h-screen bg-white z-50">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0">
              <h2 className="text-2xl font-black text-gray-900">Your Cart</h2>
              <button onClick={() => setMode('browse')} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/50">
              {cartItems.length === 0 ? (
                <div className="text-center py-20 opacity-50">
                  <p className="text-6xl mb-4">🛒</p>
                  <p className="text-xl text-gray-400">Your cart is empty</p>
                  <button onClick={() => setMode('browse')} className="mt-8 text-orange-500 font-bold underline">Start Shopping</button>
                </div>
              ) : (
                cartItems.map(item => (
                  <div key={item.id} className="flex gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm items-center">
                    <img src={item.product.image_url || ''} className="w-20 h-20 rounded-xl object-cover bg-gray-100 mix-blend-multiply" />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-gray-900 truncate">{item.product.name}</h4>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-sm text-gray-500">₱{item.unit_price}</span>
                        {item.size && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded border border-gray-200 uppercase font-bold">{item.size}</span>}
                        {item.is_wholesale && <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-bold">BULK</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-3">
                        <button onClick={() => updateCartItem(item.id, item.quantity - 1)} className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center hover:bg-gray-200">-</button>
                        <span className="font-bold w-4 text-center text-gray-900">{item.quantity}</span>
                        <button onClick={() => updateCartItem(item.id, item.quantity + 1)} className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center hover:bg-gray-200">+</button>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-lg text-gray-900">₱{item.subtotal.toFixed(0)}</p>
                      <button onClick={() => removeCartItem(item.id)} className="text-red-400 text-xs mt-2 font-medium hover:text-red-500">Remove</button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cartItems.length > 0 && (
              <div className="p-6 bg-white rounded-t-3xl border-t border-gray-100 shadow-[0_-5px_30px_rgba(0,0,0,0.05)]">
                {cartDiscount > 0 && (
                  <div className="flex justify-between mb-2 text-green-600 text-sm font-medium">
                    <span>Wholesale Savings</span>
                    <span>-₱{cartDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between mb-6 text-3xl font-black text-gray-900">
                  <span>Total</span>
                  <span>₱{cartTotal.toFixed(2)}</span>
                </div>

                {transferCode ? (
                  <div className="bg-gray-50 rounded-2xl p-6 text-center border border-gray-200 border-dashed">
                    <p className="text-gray-400 mb-2 uppercase tracking-wide text-xs font-bold">Show to Cashier</p>
                    <p className="text-5xl font-mono font-black text-gray-900 tracking-widest my-4">{transferCode}</p>
                    <p className="text-red-500 text-xs font-medium">Expires {new Date(transferExpires!).toLocaleTimeString()}</p>
                    <button onClick={() => setTransferCode(null)} className="mt-4 text-gray-400 text-sm underline hover:text-gray-600">Cancel</button>
                  </div>
                ) : (
                  <button onClick={generateTransferCode} className="w-full py-4 bg-gray-900 text-white font-black text-lg rounded-2xl shadow-xl shadow-gray-900/20 active:scale-95 transition-transform">
                    GET CHECKOUT CODE 🎫
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedProduct(null)} />
          <div className="relative bg-white w-full max-w-md h-[90vh] sm:h-auto sm:max-h-[90vh] sm:rounded-3xl rounded-t-3xl overflow-y-auto flex flex-col shadow-2xl animate-slide-up">

            {/* Image Gallery */}
            <div className="relative h-80 bg-gray-100">
              <img
                src={[selectedProduct.image_url, ...(selectedProduct.additional_images || [])].filter(Boolean)[activeImageIndex] || ''}
                className="w-full h-full object-cover mix-blend-multiply cursor-zoom-in hover:opacity-90 transition-opacity"
                onClick={() => setFullscreenPhoto([selectedProduct.image_url, ...(selectedProduct.additional_images || [])].filter(Boolean)[activeImageIndex] || null)}
              />
              <button onClick={() => setSelectedProduct(null)} className="absolute top-4 right-4 w-10 h-10 bg-white/80 backdrop-blur rounded-full text-black flex items-center justify-center z-20 shadow-sm hover:bg-white transition-colors">✕</button>

              {/* Dots */}
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-20">
                {[selectedProduct.image_url, ...(selectedProduct.additional_images || [])].filter(Boolean).map((_, i) => (
                  <button key={i} onClick={() => setActiveImageIndex(i)}
                    className={`w-2 h-2 rounded-full transition-all shadow-sm ${i === activeImageIndex ? 'bg-black w-6' : 'bg-white'}`}
                  />
                ))}
              </div>
            </div>

            <div className="p-6 flex-1 flex flex-col">
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-orange-500 text-xs font-bold tracking-wider uppercase">{selectedProduct.brand || 'No Brand'}</span>
                  {selectedProduct.quantity > 0 ? (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">✓ In Stock</span>
                  ) : (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">Out of Stock</span>
                  )}
                </div>
                <h2 className="text-3xl font-black leading-tight mb-3 text-gray-900">{selectedProduct.name}</h2>

                {/* Quick Info Bar */}
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <div className="text-xs bg-gray-100 px-3 py-1.5 rounded-full text-gray-500 font-medium flex items-center gap-1">
                    <span className="opacity-60">SKU:</span> {selectedProduct.product_code || selectedProduct.id.slice(0, 6).toUpperCase()}
                  </div>
                  {selectedProduct.quantity > 0 && selectedProduct.quantity < 10 && (
                    <div className="text-xs bg-orange-50 text-orange-600 px-3 py-1.5 rounded-full font-bold">
                      Only {selectedProduct.quantity} left!
                    </div>
                  )}
                </div>

                {/* Large Price Display */}
                <div className="flex items-end gap-2 mb-2">
                  <span className="text-4xl font-black text-gray-900">₱{selectedProduct.price.toFixed(2)}</span>
                  {selectedProduct.wholesale_tiers && selectedProduct.wholesale_tiers.length > 0 && (
                    <span className="text-sm bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded font-bold mb-1">Wholesale Available</span>
                  )}
                </div>
              </div>

              {/* Size Selector */}
              {selectedProduct.sizes && selectedProduct.sizes.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-bold text-gray-400 mb-3 uppercase tracking-wider">Select Size</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedProduct.sizes.map((s, i) => (
                      <button key={i}
                        onClick={() => setSelectedSize(s.size)}
                        className={`px-5 py-3 rounded-xl text-sm font-bold border-2 transition-all ${selectedSize === s.size ? 'bg-black text-white border-black shadow-lg shadow-black/20' : 'bg-white text-gray-600 border-gray-100 hover:border-gray-200'}`}
                      >
                        {s.size} <span className="opacity-60 font-normal ml-1">₱{s.price}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Wholesale Tiers */}
              {(!selectedSize || (selectedProduct.sizes?.find(s => s.size === selectedSize)?.price === selectedProduct.price)) && (
                <div className="mb-8">
                  <h4 className="text-sm font-bold text-gray-400 mb-3 uppercase tracking-wider">Pricing Tiers</h4>
                  <div className="space-y-2">
                    <div className={`p-3 rounded-xl flex justify-between items-center ${addQty < (selectedProduct.wholesale_tiers?.[0]?.min_qty || 999) ? 'bg-indigo-50 border border-indigo-100' : 'bg-gray-50 border border-gray-100'}`}>
                      <span className="font-medium text-sm text-gray-600">Retail (1+ pcs)</span>
                      <span className="font-bold text-gray-900">₱{selectedProduct.price.toFixed(2)}</span>
                    </div>
                    {selectedProduct.wholesale_tiers?.sort((a, b) => a.min_qty - b.min_qty).map((tier, i) => (
                      <div key={i} className={`p-3 rounded-xl flex justify-between items-center transition-all ${addQty >= tier.min_qty && (addQty < (selectedProduct.wholesale_tiers?.[i + 1]?.min_qty || 9999)) ? 'bg-green-50 border border-green-200 shadow-lg shadow-green-500/10' : 'bg-gray-50 border border-gray-100'}`}>
                        <span className="font-medium text-sm text-gray-600">{tier.label || `${tier.min_qty}+ pcs`}</span>
                        <span className="font-bold text-green-600">₱{tier.price.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Specifications */}
              {selectedProduct.specifications && Object.keys(selectedProduct.specifications).length > 0 && (
                <div className="mb-8">
                  <h4 className="text-sm font-bold text-gray-400 mb-3 uppercase tracking-wider">Specifications</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(selectedProduct.specifications).map(([key, value]) => (
                      <div key={key} className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <span className="block text-xs text-gray-400 uppercase font-bold mb-1">{key}</span>
                        <span className="block text-sm text-gray-900 font-medium">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              {selectedProduct.description && (
                <div className="mb-8">
                  <h4 className="text-sm font-bold text-gray-400 mb-2 uppercase tracking-wider">About</h4>
                  <p className="text-gray-600 leading-relaxed text-sm">{selectedProduct.description}</p>
                </div>
              )}

              {/* Spacer */}
              <div className="flex-1" />

              {/* Footer Actions */}
              <div className="pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3 bg-gray-100 rounded-xl p-1">
                    <button onClick={() => setAddQty(Math.max(1, addQty - 1))} className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center text-xl font-bold text-gray-600 hover:text-black">-</button>
                    <input type="number" value={addQty} onChange={e => setAddQty(Math.max(1, parseInt(e.target.value) || 1))} className="w-12 bg-transparent text-center font-bold focus:outline-none text-gray-900" />
                    <button onClick={() => setAddQty(addQty + 1)} className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center text-xl font-bold text-gray-600 hover:text-black">+</button>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400 mb-1 font-medium">Total Price</p>
                    <p className="text-2xl font-black text-gray-900">
                      ₱{((selectedSize ? (selectedProduct.sizes?.find(s => s.size === selectedSize)?.price || 0) : getPriceDisplay(selectedProduct, addQty).price) * addQty).toFixed(2)}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => addToCart(selectedProduct.id, addQty, selectedSize)}
                  disabled={!!(selectedProduct.sizes?.length && !selectedSize)}
                  className={`w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-lg shadow-xl shadow-gray-900/20 active:scale-95 transition-transform ${selectedProduct.sizes?.length && !selectedSize ? 'opacity-50 grayscale' : ''}`}
                >
                  {selectedProduct.sizes?.length && !selectedSize ? 'SELECT A SIZE' : `ADD TO CART ${selectedSize ? `(${selectedSize})` : ''}`}
                </button>
                {!selectedSize && getPriceDisplay(selectedProduct, addQty).isWholesale && (
                  <p className="text-center text-green-600 text-xs mt-3 font-bold animate-pulse">
                    🎉 Bulk Savings! Saved ₱{(getPriceDisplay(selectedProduct, addQty).discount * addQty).toFixed(2)}
                  </p>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Photo Lightbox */}
      {fullscreenPhoto && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-lg flex items-center justify-center p-4 cursor-zoom-out animate-fade-in"
          onClick={() => setFullscreenPhoto(null)}
        >
          <button
            className="absolute top-6 right-6 w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center text-2xl transition-colors z-10"
            onClick={() => setFullscreenPhoto(null)}
          >
            ✕
          </button>
          <img
            src={fullscreenPhoto}
            alt="Full size preview"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          />
          <div className="absolute bottom-6 left-0 right-0 text-center text-white/50 text-sm">
            Tap anywhere to close
          </div>
        </div>
      )}

      {/* Global CSS for animations */}
      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up { animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in { animation: fade-in 0.2s ease-out; }
      `}</style>
    </div>
  );
}
