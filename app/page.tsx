'use client';

import { useState, useRef, useEffect } from 'react';
import type { BrandingSettings } from '@/types';

interface WholesaleTier { min_qty: number; price: number; label: string; }
interface Category { id: string; name: string; parent_id: string | null; children?: Category[]; }
interface ProductSize { size: string; price: number; stock: number; }
interface Product {
  id: string; name: string; price: number; brand: string | null; category_id: string | null;
  image_url: string | null; additional_images: string[] | null; quantity: number | null;
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

// Pastel color rotation for product cards
const pastelColors = [
  { bg: 'bg-[#D4F5E9]', accent: 'text-emerald-700' },
  { bg: 'bg-[#FFE4E6]', accent: 'text-rose-600' },
  { bg: 'bg-[#E0F2FE]', accent: 'text-sky-600' },
  { bg: 'bg-[#FEF9C3]', accent: 'text-amber-600' },
  { bg: 'bg-[#EDE9FE]', accent: 'text-violet-600' },
];

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

  // Tab state for category navigation
  const [activeTab, setActiveTab] = useState<'popular' | 'newest' | 'category'>('popular');

  const cleanLabel = (text?: string | null) => (text || '').replace(/^\*+\s*/, '').replace(/\s*\*+$/, '').trim();

  const ensureSessionId = () => {
    if (sessionId) return sessionId;
    if (typeof window === 'undefined') return '';
    let sid = localStorage.getItem('shop_session');
    if (!sid) {
      sid = 'sess_' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('shop_session', sid);
    }
    setSessionId(sid);
    return sid;
  };

  useEffect(() => {
    const sid = ensureSessionId();
    if (!sid) return;
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

  const fetchCart = async (sid?: string) => {
    const session = sid || ensureSessionId();
    if (!session) return;
    const res = await fetch(`/api/cart?session=${session}`);
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
    const sid = ensureSessionId();
    if (!sid) return;
    try {
      const res = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid, productId, quantity: qty, size })
      });
      if (!res.ok) {
        const errorText = await res.text();
        console.error('Add to cart failed', errorText);
        return;
      }
      await fetchCart(sid);
    } catch (error) {
      console.error('Add to cart error:', error);
      return;
    }
    setSelectedProduct(null);
    setAddQty(1);
    setSelectedSize(null);
    setMode('browse');
  };

  const updateCartItem = async (itemId: string, qty: number) => {
    const sid = ensureSessionId();
    if (!sid) return;
    await fetch('/api/cart', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sid, itemId, quantity: qty })
    });
    fetchCart(sid);
  };

  const removeCartItem = async (itemId: string) => {
    const sid = ensureSessionId();
    await fetch(`/api/cart?itemId=${itemId}`, { method: 'DELETE' });
    fetchCart(sid);
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

  const getPriceDisplay = (product: Product, qty: number, sizePrice?: number | null) => {
    const basePrice = Number(sizePrice ?? (product as Product).price ?? 0);
    const tiers = product.wholesale_tiers || [];
    const sorted = [...tiers].sort((a, b) => b.min_qty - a.min_qty);
    for (const tier of sorted) {
      const tierPrice = Number((tier as WholesaleTier).price ?? basePrice);
      if (qty >= tier.min_qty && tierPrice < basePrice) {
        return { price: tierPrice, isWholesale: true, label: tier.label, discount: basePrice - tierPrice };
      }
    }
    return { price: basePrice, isWholesale: false, label: null, discount: 0 };
  };

  const getSelectedUnitPrice = () => {
    if (!selectedProduct) return 0;
    const sizePrice = selectedSize
      ? selectedProduct.sizes?.find(s => s.size === selectedSize)?.price
      : null;

    if (sizePrice !== undefined && sizePrice !== null) {
      return getPriceDisplay(selectedProduct, addQty, sizePrice).price || 0;
    }

    const fallbackPrice = getPriceDisplay(selectedProduct, addQty).price ?? selectedProduct.price ?? 0;
    return Number(fallbackPrice) || 0;
  };

  const cartItemCount = cartItems.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Subtle Background Pattern */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-30">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-blue-50 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-md mx-auto min-h-screen flex flex-col bg-white shadow-xl overflow-hidden">

        {/* Scan Mode UI */}
        {mode === 'scan' && (
          <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col items-center justify-between py-10">
            <div className="relative w-full flex-1 flex items-center justify-center bg-black overflow-hidden">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              <canvas ref={canvasRef} className="hidden" />
              <div className="absolute inset-0 border-[60px] border-black/50 pointer-events-none">
                <div className="w-full h-full border-2 border-white/50 relative">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[#3478F6] -mt-1 -ml-1"></div>
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-[#3478F6] -mt-1 -mr-1"></div>
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-[#3478F6] -mb-1 -ml-1"></div>
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[#3478F6] -mb-1 -mr-1"></div>
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
              <button onClick={capturePhoto} className="w-20 h-20 bg-white rounded-full border-4 border-[#3478F6] shadow-xl active:scale-95 transition-transform flex items-center justify-center">
                <div className="w-16 h-16 bg-[#3478F6] rounded-full" />
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
            <div className="p-5 sticky top-0 bg-white z-30 border-b border-slate-100">
              <div className="flex justify-between items-center mb-5">
                <div>
                  <p className="text-slate-400 text-sm font-medium">Let&apos;s Explore</p>
                  <h1 className="text-2xl font-black text-slate-900">{branding.title}</h1>
                </div>
                <div className="flex items-center gap-3">
                  <div onClick={() => setMode('cart')} className="relative p-3 bg-slate-50 rounded-2xl active:scale-95 transition-all cursor-pointer hover:bg-slate-100">
                    🛒
                    {cartItemCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#3478F6] rounded-full text-white text-xs flex items-center justify-center font-bold shadow-lg">
                        {cartItemCount}
                      </span>
                    )}
                  </div>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FFE4E6] to-[#FEF9C3] flex items-center justify-center">
                    <span className="text-lg">👤</span>
                  </div>
                </div>
              </div>

              <div className="relative flex gap-2">
                <div className="relative flex-1">
                  <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search products..."
                    className="w-full pl-10 pr-4 py-3.5 bg-slate-50 border-none rounded-2xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3478F6]/30 transition-all font-medium"
                  />
                  <span className="absolute left-3.5 top-3.5 text-slate-400">
                    {searchLoading ? '⏳' : '🔍'}
                  </span>
                </div>
                <button
                  onClick={() => { setMode('scan'); setCameraActive(true); }}
                  className="px-4 bg-[#3478F6] text-white rounded-2xl text-xl active:scale-95 transition-transform shadow-lg shadow-blue-500/25"
                >
                  📷
                </button>
              </div>

              {/* Spell correction hint */}
              {correctedQuery && (
                <div className="mt-3 text-sm text-slate-500">
                  <span className="text-slate-400">Did you mean: </span>
                  <button
                    onClick={() => setSearchQuery(correctedQuery)}
                    className="text-[#3478F6] font-bold hover:underline"
                  >
                    {correctedQuery}
                  </button>
                  <span className="text-slate-300 ml-2">• AI-powered</span>
                </div>
              )}
            </div>

            {/* Tab Navigation */}
            <div className="px-5 py-3 flex gap-6 border-b border-slate-100">
              <button
                onClick={() => { setActiveTab('popular'); setSelectedCat(null); }}
                className={`pb-2 font-semibold text-sm transition-all relative ${activeTab === 'popular' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Popular
                {activeTab === 'popular' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#3478F6] rounded-full" />}
              </button>
              <button
                onClick={() => { setActiveTab('newest'); setSelectedCat(null); }}
                className={`pb-2 font-semibold text-sm transition-all relative ${activeTab === 'newest' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Newest
                {activeTab === 'newest' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#3478F6] rounded-full" />}
              </button>
              <button
                onClick={() => setActiveTab('category')}
                className={`pb-2 font-semibold text-sm transition-all relative ${activeTab === 'category' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Categories
                {activeTab === 'category' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#3478F6] rounded-full" />}
              </button>
              <div className="flex-1" />
              <button className="text-slate-400 hover:text-slate-600">
                🔍
              </button>
            </div>

            {/* Categories (only when category tab active) */}
            {activeTab === 'category' && (
              <div className="px-5 py-3 overflow-x-auto no-scrollbar flex gap-2">
                <button
                  onClick={() => setSelectedCat(null)}
                  className={`whitespace-nowrap px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${!selectedCat ? 'bg-[#3478F6] text-white shadow-lg shadow-blue-500/25' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  All
                </button>
                {categoryTree.map(cat => (
                  <button key={cat.id} onClick={() => setSelectedCat(cat.id)}
                    className={`whitespace-nowrap px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${selectedCat === cat.id ? 'bg-[#3478F6] text-white shadow-lg shadow-blue-500/25' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            )}

            {/* Product Grid */}
            <div className="flex-1 px-5 pb-24 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4 pt-4">
                {products.length === 0 && !loading && (
                  <div className="col-span-2 text-center py-20 text-slate-400">
                    <p className="text-4xl mb-4 opacity-50">🔦</p>
                    <p>No products found</p>
                  </div>
                )}
                {filteredProducts.map((p, index) => {
                  const colorScheme = pastelColors[index % pastelColors.length];
                  return (
                    <div key={p.id} onClick={() => { setSelectedProduct(p); setActiveImageIndex(0); setAddQty(1); setSelectedSize(p.sizes?.[0]?.size || null); }}
                      className={`group ${colorScheme.bg} rounded-3xl p-3 cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300 active:scale-95 relative overflow-hidden`}>
                      <div className="relative aspect-square rounded-2xl overflow-hidden mb-3 bg-white/50">
                        {p.image_url ? (
                          <img src={p.image_url} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-4xl text-slate-300">📦</div>
                        )}
                        {p.wholesale_tiers && p.wholesale_tiers.length > 0 && (
                          <div className="absolute top-2 left-2 bg-amber-400 text-amber-900 text-[10px] font-bold px-2 py-1 rounded-full shadow-lg">
                            WHOLESALE
                          </div>
                        )}
                      </div>
                      <div className="px-1">
                        {/* Rating */}
                        <div className="flex items-center gap-1 mb-1">
                          <span className={`${colorScheme.accent} text-xs font-bold`}>4.{5 + (index % 5)}</span>
                          <span className="text-amber-400 text-xs">★</span>
                        </div>
                        <h3 className="text-slate-900 font-bold truncate text-sm mb-0.5">{cleanLabel(p.name)}</h3>
                        <p className="text-slate-500 text-xs truncate mb-2">{cleanLabel(p.brand) || 'Generic'}</p>
                        <div className="flex justify-between items-end">
                          <div>
                            <span className="text-slate-400 text-xs">₱ </span>
                            <span className="text-slate-900 font-black text-lg">{p.price.toFixed(0)}</span>
                          </div>
                          {typeof p.quantity === 'number' && p.quantity < 5 && p.quantity >= 0 && (
                            <span className="text-[10px] text-rose-500 font-medium bg-rose-50 px-2 py-0.5 rounded-full">{p.quantity} left</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Cart Mode */}
        {mode === 'cart' && (
          <div className="flex flex-col h-screen bg-white z-50">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0">
              <h2 className="text-2xl font-black text-slate-900">Your Cart</h2>
              <button onClick={() => setMode('browse')} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/50">
              {cartItems.length === 0 ? (
                <div className="text-center py-20">
                  <p className="text-6xl mb-4 opacity-30">🛒</p>
                  <p className="text-xl text-slate-400 font-medium">Your cart is empty</p>
                  <button onClick={() => setMode('browse')} className="mt-8 text-[#3478F6] font-bold hover:underline">Start Shopping</button>
                </div>
              ) : (
                cartItems.map((item, index) => {
                  const colorScheme = pastelColors[index % pastelColors.length];
                  return (
                    <div key={item.id} className={`flex gap-4 ${colorScheme.bg} p-4 rounded-2xl items-center shadow-sm`}>
                      <img src={item.product.image_url || ''} className="w-20 h-20 rounded-xl object-cover bg-white" />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-slate-900 truncate">{cleanLabel(item.product.name)}</h4>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-sm text-slate-600 font-semibold">₱{item.unit_price}</span>
                          {item.size && <span className="text-xs bg-white/70 text-slate-600 px-2 py-0.5 rounded uppercase font-bold">{item.size}</span>}
                          {item.is_wholesale && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">BULK</span>}
                        </div>
                        <div className="flex items-center gap-3 mt-3">
                          <button onClick={() => updateCartItem(item.id, item.quantity - 1)} className="w-8 h-8 rounded-full bg-white text-slate-600 flex items-center justify-center hover:bg-slate-100 shadow-sm">-</button>
                          <span className="font-bold w-4 text-center text-slate-900">{item.quantity}</span>
                          <button onClick={() => updateCartItem(item.id, item.quantity + 1)} className="w-8 h-8 rounded-full bg-white text-slate-600 flex items-center justify-center hover:bg-slate-100 shadow-sm">+</button>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-lg text-slate-900">₱{item.subtotal.toFixed(0)}</p>
                        <button onClick={() => removeCartItem(item.id)} className="text-rose-400 text-xs mt-2 font-medium hover:text-rose-500">Remove</button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {cartItems.length > 0 && (
              <div className="p-5 bg-white rounded-t-3xl border-t border-slate-100 shadow-[0_-5px_30px_rgba(0,0,0,0.05)]">
                {cartDiscount > 0 && (
                  <div className="flex justify-between mb-2 text-emerald-600 text-sm font-medium">
                    <span>Wholesale Savings</span>
                    <span>-₱{cartDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between mb-6 text-3xl font-black text-slate-900">
                  <span>Total</span>
                  <span>₱{cartTotal.toFixed(2)}</span>
                </div>

                {transferCode ? (
                  <div className="bg-[#E0F2FE] rounded-2xl p-6 text-center border-2 border-dashed border-sky-200">
                    <p className="text-sky-600 mb-2 uppercase tracking-wide text-xs font-bold">Show to Cashier</p>
                    <p className="text-4xl font-mono font-black text-slate-900 tracking-widest my-4">{transferCode}</p>
                    <p className="text-rose-500 text-xs font-medium">Expires {new Date(transferExpires!).toLocaleTimeString()}</p>
                    <button onClick={() => setTransferCode(null)} className="mt-4 text-slate-400 text-sm underline hover:text-slate-600">Cancel</button>
                  </div>
                ) : (
                  <button onClick={generateTransferCode} className="w-full py-4 bg-[#3478F6] text-white font-bold text-lg rounded-2xl shadow-lg shadow-blue-500/25 active:scale-[0.98] transition-transform">
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
            <div className="relative h-72 bg-[#E0F2FE]">
              <img
                src={[selectedProduct.image_url, ...(selectedProduct.additional_images || [])].filter(Boolean)[activeImageIndex] || ''}
                className="w-full h-full object-cover cursor-zoom-in hover:opacity-90 transition-opacity"
                onClick={() => setFullscreenPhoto([selectedProduct.image_url, ...(selectedProduct.additional_images || [])].filter(Boolean)[activeImageIndex] || null)}
              />
              <button onClick={() => setSelectedProduct(null)} className="absolute top-4 left-4 w-10 h-10 bg-white/90 backdrop-blur rounded-full text-slate-600 flex items-center justify-center z-20 shadow-sm hover:bg-white transition-colors">
                ←
              </button>
              <button className="absolute top-4 right-4 w-10 h-10 bg-white/90 backdrop-blur rounded-full text-slate-600 flex items-center justify-center z-20 shadow-sm hover:bg-white transition-colors">
                ♡
              </button>

              {/* Dots */}
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-20">
                {[selectedProduct.image_url, ...(selectedProduct.additional_images || [])].filter(Boolean).map((_, i) => (
                  <button key={i} onClick={() => setActiveImageIndex(i)}
                    className={`w-2 h-2 rounded-full transition-all shadow-sm ${i === activeImageIndex ? 'bg-[#3478F6] w-6' : 'bg-white'}`}
                  />
                ))}
              </div>
            </div>

            <div className="p-5 flex-1 flex flex-col">
              {/* Rating */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-amber-400">★</span>
                <span className="text-sm font-bold text-slate-900">4.5</span>
                <div className="flex gap-2 ml-3">
                  <span className="text-xs bg-[#E0F2FE] text-sky-600 px-2 py-1 rounded-full font-medium">Trending</span>
                  <span className="text-xs bg-[#EDE9FE] text-violet-600 px-2 py-1 rounded-full font-medium">Popular</span>
                </div>
              </div>

              <h2 className="text-2xl font-black leading-tight mb-2 text-slate-900">{cleanLabel(selectedProduct.name)}</h2>

              <p className="text-slate-500 text-sm mb-4 line-clamp-3">
                {selectedProduct.description || `${cleanLabel(selectedProduct.brand) || 'Quality product'} - Premium quality item from ${cleanLabel(selectedProduct.brand) || 'our collection'}.`}
              </p>

              {/* Size Selector */}
              {selectedProduct.sizes && selectedProduct.sizes.length > 0 && (
                <div className="mb-5">
                  <h4 className="text-sm font-bold text-slate-400 mb-3 uppercase tracking-wider">Select Size</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedProduct.sizes.map((s, i) => (
                      <button key={i}
                        onClick={() => setSelectedSize(s.size)}
                        className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${selectedSize === s.size ? 'bg-[#3478F6] text-white shadow-lg shadow-blue-500/25' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                      >
                        {s.size} <span className="opacity-60 font-normal ml-1">₱{s.price}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Wholesale Tiers */}
              {(!selectedSize || (selectedProduct.sizes?.find(s => s.size === selectedSize)?.price === selectedProduct.price)) && selectedProduct.wholesale_tiers && selectedProduct.wholesale_tiers.length > 0 && (
                <div className="mb-5">
                  <h4 className="text-sm font-bold text-slate-400 mb-3 uppercase tracking-wider">Bulk Pricing</h4>
                  <div className="space-y-2">
                    <div className={`p-3 rounded-xl flex justify-between items-center ${addQty < (selectedProduct.wholesale_tiers?.[0]?.min_qty || 999) ? 'bg-[#E0F2FE] border border-sky-100' : 'bg-slate-50'}`}>
                      <span className="font-medium text-sm text-slate-600">Retail (1+ pcs)</span>
                      <span className="font-bold text-slate-900">₱{selectedProduct.price.toFixed(2)}</span>
                    </div>
                    {selectedProduct.wholesale_tiers?.sort((a, b) => a.min_qty - b.min_qty).map((tier, i) => (
                      <div key={i} className={`p-3 rounded-xl flex justify-between items-center transition-all ${addQty >= tier.min_qty && (addQty < (selectedProduct.wholesale_tiers?.[i + 1]?.min_qty || 9999)) ? 'bg-[#D4F5E9] border border-emerald-100 shadow-lg shadow-emerald-500/10' : 'bg-slate-50'}`}>
                        <span className="font-medium text-sm text-slate-600">{tier.label || `${tier.min_qty}+ pcs`}</span>
                        <span className="font-bold text-emerald-600">₱{tier.price.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Spacer */}
              <div className="flex-1" />

              {/* Footer Actions */}
              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3 bg-slate-100 rounded-xl p-1">
                    <button onClick={() => setAddQty(Math.max(1, addQty - 1))} className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center text-xl font-bold text-slate-600 hover:text-slate-900">-</button>
                    <input type="number" value={addQty} onChange={e => setAddQty(Math.max(1, parseInt(e.target.value) || 1))} className="w-12 bg-transparent text-center font-bold focus:outline-none text-slate-900" />
                    <button onClick={() => setAddQty(addQty + 1)} className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center text-xl font-bold text-slate-600 hover:text-slate-900">+</button>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400 mb-1 font-medium">Total Price</p>
                    <p className="text-2xl font-black text-slate-900">
                      ₱{(getSelectedUnitPrice() * addQty).toFixed(2)}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => addToCart(selectedProduct.id, addQty, selectedSize)}
                  disabled={!!(selectedProduct.sizes?.length && !selectedSize)}
                  className={`w-full py-4 bg-[#3478F6] text-white rounded-2xl font-bold text-lg shadow-lg shadow-blue-500/25 active:scale-[0.98] transition-transform flex items-center justify-center gap-2 ${selectedProduct.sizes?.length && !selectedSize ? 'opacity-50 grayscale' : ''}`}
                >
                  {selectedProduct.sizes?.length && !selectedSize ? 'SELECT A SIZE' : (
                    <>
                      Add to cart
                      <span className="ml-2">→</span>
                    </>
                  )}
                </button>
                {getPriceDisplay(selectedProduct, addQty, selectedSize ? selectedProduct.sizes?.find(s => s.size === selectedSize)?.price : undefined).isWholesale && (
                  <p className="text-center text-emerald-600 text-xs mt-3 font-bold animate-pulse">
                    🎉 Bulk Savings! Saved ₱{(getPriceDisplay(selectedProduct, addQty, selectedSize ? selectedProduct.sizes?.find(s => s.size === selectedSize)?.price : undefined).discount * addQty).toFixed(2)}
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
    </div>
  );
}
