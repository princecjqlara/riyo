'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import type { Store } from '@/types';

type Category = { id: string; name: string; parent_id: string | null };
type ProductSize = { size: string; price: number; stock?: number };
type Product = {
  id: string;
  store_id?: string | null;
  name: string;
  price: number;
  brand: string | null;
  category_id: string | null;
  image_url: string | null;
  additional_images: string[] | null;
  description: string | null;
  sizes: ProductSize[] | null;
  wholesale_tiers: { min_qty: number; price: number; label?: string }[] | null;
  quantity: number | null;
  scan_count?: number | null;
  created_at?: string;
};

type CartItem = {
  id: string;
  quantity: number;
  unit_price: number;
  is_wholesale: boolean;
  tier_label: string | null;
  subtotal: number;
  discount: number;
  size: string | null;
  product: Product;
};

const pastelCards = [
  { bg: 'from-[#E0F2FE] to-[#E8F4FF]', shadow: 'shadow-blue-100' },
  { bg: 'from-[#FFE4E6] to-[#FFF1F2]', shadow: 'shadow-rose-100' },
  { bg: 'from-[#FEF9C3] to-[#FFF7D6]', shadow: 'shadow-amber-100' },
  { bg: 'from-[#D4F5E9] to-[#E4FBF1]', shadow: 'shadow-emerald-100' },
  { bg: 'from-[#EDE9FE] to-[#F4F0FF]', shadow: 'shadow-violet-100' },
];

export default function StoreFrontPage() {
  const params = useParams();
  const slugParam = Array.isArray(params?.slug) ? params.slug[0] : params?.slug;

  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [cartId, setCartId] = useState<string | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartTotal, setCartTotal] = useState(0);
  const [cartDiscount, setCartDiscount] = useState(0);
  const [mode, setMode] = useState<'browse' | 'cart' | 'scan'>('browse');
  const [viewTab, setViewTab] = useState<'popular' | 'newest' | 'categories'>('popular');
  const [message, setMessage] = useState('');
  const [transferCode, setTransferCode] = useState<string | null>(null);
  const [transferExpires, setTransferExpires] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!slugParam) return;
    const sid = ensureSessionId(slugParam);
    setSessionId(sid);
  }, [slugParam]);

  useEffect(() => {
    if (!slugParam || !sessionId) return;
    loadStore();
  }, [slugParam, sessionId]);

  const ensureSessionId = (slug: string) => {
    if (typeof window === 'undefined') return '';
    const key = `store_session_${slug}`;
    let sid = localStorage.getItem(key);
    if (!sid) {
      sid = 'sess_' + Math.random().toString(36).substring(2, 12);
      localStorage.setItem(key, sid);
    }
    return sid;
  };

  const loadStore = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/storefront?slug=${slugParam}`);
      const body = await res.json();
      if (!res.ok) {
        setMessage(body.error || 'Store not found');
        setLoading(false);
        return;
      }
      setStore(body.store);
      await Promise.all([
        fetchProducts(body.store.slug),
        fetchCategories(body.store.slug),
        fetchCart(body.store.id, sessionId),
      ]);
    } catch (error) {
      console.error('Store load failed', error);
      setMessage('Could not load store.');
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async (slug: string) => {
    const res = await fetch(`/api/search-products?all=true&storeSlug=${slug}`);
    const data = await res.json();
    if (res.ok) {
      setProducts(data.products || data || []);
    } else {
      setProducts([]);
    }
  };

  const fetchCategories = async (slug: string) => {
    const res = await fetch(`/api/categories?storeSlug=${slug}`);
    const data = await res.json();
    if (res.ok) {
      setCategories(data.categories || []);
    } else {
      setCategories([]);
    }
  };

  const fetchCart = async (storeId: string, sid: string) => {
    const res = await fetch(`/api/cart?session=${sid}&storeId=${storeId}`);
    const data = await res.json();
    if (res.ok) {
      setCartId(data.cart_id);
      setCartItems(data.items || []);
      setCartTotal(data.total || 0);
      setCartDiscount(data.total_discount || 0);
    } else {
      setCartId(null);
      setCartItems([]);
      setCartTotal(0);
      setCartDiscount(0);
    }
  };

  const filteredProducts = useMemo(() => {
    const base = selectedCat
      ? products.filter(p => p.category_id === selectedCat)
      : products;
    if (!searchQuery.trim()) return base;
    const q = searchQuery.toLowerCase();
    return base.filter(p =>
      p.name?.toLowerCase().includes(q) ||
      p.brand?.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q)
    );
  }, [products, searchQuery, selectedCat]);

  const displayProducts = useMemo(() => {
    const base = filteredProducts.slice();
    if (viewTab === 'popular') {
      return base.sort((a, b) => (b.scan_count ?? 0) - (a.scan_count ?? 0));
    }
    if (viewTab === 'newest') {
      return base.sort((a, b) => {
        const da = a.created_at ? new Date(a.created_at).getTime() : 0;
        const db = b.created_at ? new Date(b.created_at).getTime() : 0;
        return db - da;
      });
    }
    return base;
  }, [filteredProducts, viewTab]);

  const addToCart = async (productId: string, qty: number, size?: string | null) => {
    if (!store || !sessionId) return;
    const res = await fetch('/api/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, productId, quantity: qty, size, storeId: store.id }),
    });
    if (res.ok) {
      await fetchCart(store.id, sessionId);
      setMode('cart');
      setMessage('Added to cart');
    } else {
      const body = await res.json().catch(() => ({}));
      setMessage(body.error || 'Could not add to cart');
    }
  };

  const updateCartItem = async (itemId: string, qty: number) => {
    if (!store || !sessionId) return;
    await fetch('/api/cart', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, itemId, quantity: qty, storeId: store.id }),
    });
    fetchCart(store.id, sessionId);
  };

  const removeCartItem = async (itemId: string) => {
    if (!store) return;
    await fetch(`/api/cart?itemId=${itemId}`, { method: 'DELETE' });
    fetchCart(store.id, sessionId);
  };

  const generateTransferCode = async () => {
    if (!cartId) return;
    const res = await fetch('/api/transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cartId }),
    });
    const data = await res.json();
    if (res.ok) {
      setTransferCode(data.code);
      setTransferExpires(data.expires_at);
      setMessage('Show this code to the cashier to checkout.');
    }
  };

  const handleScanUpload = async (file: File) => {
    if (!store) return;
    setScanning(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: reader.result, storeId: store.id }),
      });
      const data = await res.json();
      if (data.product) {
        setProducts(prev => {
          const existing = prev.find(p => p.id === data.product.id);
          if (existing) return prev;
          return [data.product, ...prev];
        });
        setSearchQuery(data.product.name || '');
        setSelectedCat(data.product.category_id || null);
        setMode('browse');
      } else if (data.similarProducts?.length) {
        setProducts(data.similarProducts);
        setMode('browse');
        setMessage('Showing similar products');
      } else {
        setMessage(data.error || 'No match found');
      }
      setScanning(false);
    };
    reader.readAsDataURL(file);
  };

  const cartCount = cartItems.reduce((sum, item) => sum + (item.quantity || 0), 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#F8FAFF] to-[#F6F8FB] flex items-center justify-center text-slate-500">
        Loading store...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F8FAFF] to-[#F6F8FB] text-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-white/90 backdrop-blur rounded-3xl p-6 shadow-lg shadow-slate-200 border border-slate-100">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Storefront</p>
              <h1 className="text-3xl font-black text-slate-900 mt-1">{store?.name || 'Storefront'}</h1>
              <p className="text-sm text-slate-500">Shareable link: /store/{store?.slug}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    navigator.clipboard?.writeText(window.location.href);
                    setMessage('Store link copied');
                  }
                }}
                className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 bg-white hover:border-indigo-200 hover:text-indigo-700 transition-colors"
              >
                Copy link
              </button>
              <button
                onClick={() => setMode('cart')}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors"
              >
                Cart ({cartCount})
              </button>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            {(['browse', 'cart', 'scan'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setMode(tab)}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                  mode === tab ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab === 'browse' ? 'Shop' : tab === 'cart' ? `Cart (${cartCount})` : 'Scan'}
              </button>
            ))}
          </div>

          {message && (
            <div className="mt-4 bg-blue-50 border border-blue-100 text-blue-700 rounded-xl p-3 text-sm">
              {message}
            </div>
          )}

          {mode === 'browse' && (
            <div className="mt-6 space-y-6">
              <div className="rounded-3xl bg-gradient-to-br from-[#E8F0FF] via-white to-[#F6F8FF] p-6 shadow-sm border border-slate-100">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Let&apos;s explore</p>
                    <h2 className="text-3xl font-black text-slate-900">PriceScan</h2>
                    <p className="text-sm text-slate-500 mt-1">Discover products in {store?.name || 'this store'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setMode('cart')}
                      className="w-11 h-11 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-center text-slate-600 hover:shadow-md transition-all"
                    >
                      🛒
                    </button>
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white font-bold flex items-center justify-center shadow-md">
                      {store?.name?.[0]?.toUpperCase() || 'S'}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 items-center">
                  <div className="flex-1 relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                    <input
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Search products..."
                      className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white border border-slate-200 shadow-inner focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-3 rounded-2xl bg-indigo-600 text-white font-semibold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-colors"
                  >
                    📷 Scan
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleScanUpload(file);
                    }}
                  />
                </div>

                <div className="flex gap-4 mt-5 text-sm font-semibold text-slate-500">
                  {(['popular', 'newest', 'categories'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setViewTab(tab)}
                      className={`pb-2 border-b-2 transition-colors ${
                        viewTab === tab ? 'border-indigo-500 text-indigo-700' : 'border-transparent hover:text-slate-700'
                      }`}
                    >
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2 overflow-x-auto mt-3 pb-1">
                  <button
                    onClick={() => setSelectedCat(null)}
                    className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
                      !selectedCat
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-100'
                    }`}
                  >
                    All items
                  </button>
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCat(cat.id)}
                      className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
                        selectedCat === cat.id
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-100'
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {displayProducts.map((product, idx) => {
                  const palette = pastelCards[idx % pastelCards.length];
                  const rating = Math.max(4, Math.min(5, 4 + ((product.scan_count ?? 0) % 10) / 20));
                  const stock = product.quantity ?? 0;
                  return (
                    <div
                      key={product.id}
                      className={`rounded-3xl border border-white bg-gradient-to-br ${palette.bg} ${palette.shadow} p-4 shadow-md hover:shadow-lg transition-all flex flex-col`}
                    >
                      <div className="relative mb-3">
                        <div className="aspect-square rounded-2xl overflow-hidden bg-white/70 border border-white shadow-inner">
                          {product.image_url ? (
                            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400 text-lg">No photo</div>
                          )}
                        </div>
                        <div className="absolute top-2 left-2 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-semibold text-slate-700 border border-slate-100">
                          {product.brand || 'Unbranded'}
                        </div>
                        <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded-full text-xs font-semibold text-amber-600 border border-amber-100 flex items-center gap-1">
                          ⭐ {rating.toFixed(1)}
                        </div>
                      </div>
                      <div className="flex-1 space-y-1">
                        <h3 className="text-lg font-black text-slate-900 leading-tight line-clamp-2">{product.name}</h3>
                        <p className="text-xs font-semibold text-slate-500 uppercase">
                          {categories.find(c => c.id === product.category_id)?.name || 'General'}
                        </p>
                        <p className="text-sm text-slate-500 line-clamp-2">{product.description || ''}</p>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <div>
                          <div className="text-2xl font-black text-slate-900">₱ {product.price.toFixed(0)}</div>
                          <div className="text-xs font-semibold text-rose-500">{stock > 0 ? `${stock} left` : '0 left'}</div>
                        </div>
                        <button
                          onClick={() => addToCart(product.id, 1, product.sizes?.[0]?.size)}
                          className="px-4 py-3 rounded-2xl bg-slate-900 text-white text-sm font-semibold shadow-lg shadow-slate-900/15 hover:scale-105 active:scale-95 transition-transform"
                        >
                          Add to cart
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {displayProducts.length === 0 && (
                <div className="text-center text-slate-500 py-12 bg-white rounded-2xl border border-dashed border-slate-200">
                  No products yet.
                </div>
              )}
            </div>
          )}

          {mode === 'cart' && (
            <div className="mt-6 bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-slate-900">Cart</h2>
                <span className="text-sm text-slate-500">{cartCount} items</span>
              </div>
              {cartItems.length === 0 ? (
                <p className="text-slate-500">Your cart is empty.</p>
              ) : (
                <div className="space-y-4">
                  {cartItems.map(item => (
                    <div key={item.id} className="flex items-center gap-3 border border-slate-100 rounded-2xl p-3 bg-slate-50/50">
                      <img src={item.product.image_url || ''} className="w-16 h-16 rounded-xl object-cover bg-slate-100" />
                      <div className="flex-1">
                        <h4 className="font-semibold text-slate-900">{item.product.name}</h4>
                        <p className="text-sm text-slate-500">
                          ₱ {item.unit_price.toFixed(2)} × {item.quantity} pcs
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateCartItem(item.id, Math.max(1, item.quantity - 1))}
                          className="w-8 h-8 rounded-full bg-slate-100 text-slate-700"
                        >
                          -
                        </button>
                        <span className="w-6 text-center font-semibold">{item.quantity}</span>
                        <button
                          onClick={() => updateCartItem(item.id, item.quantity + 1)}
                          className="w-8 h-8 rounded-full bg-slate-100 text-slate-700"
                        >
                          +
                        </button>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-slate-900">₱ {item.subtotal.toFixed(2)}</p>
                        <button onClick={() => removeCartItem(item.id)} className="text-xs text-rose-500">
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="border-t border-slate-100 pt-4 flex items-center justify-between">
                    <div className="text-sm text-slate-500">
                      {cartDiscount > 0 && <p className="text-emerald-600 font-semibold">Savings: ₱ {cartDiscount.toFixed(2)}</p>}
                      <p className="text-lg font-black text-slate-900">Total: ₱ {cartTotal.toFixed(2)}</p>
                    </div>
                    {transferCode ? (
                      <div className="text-right">
                        <p className="text-xs text-slate-500">Show this to staff</p>
                        <p className="text-3xl font-mono font-black tracking-widest text-slate-900">{transferCode}</p>
                        {transferExpires && <p className="text-xs text-slate-400">Expires {new Date(transferExpires).toLocaleTimeString()}</p>}
                      </div>
                    ) : (
                      <button onClick={generateTransferCode} className="px-5 py-3 rounded-2xl bg-slate-900 text-white font-semibold">
                        Get checkout code
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {mode === 'scan' && (
            <div className="mt-6 bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Scan product</h2>
                  <p className="text-sm text-slate-500">Upload a photo to find a match in this store.</p>
                </div>
                {scanning && <span className="text-sm text-indigo-600 font-semibold">Scanning...</span>}
              </div>
              <label className="border-2 border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-200">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleScanUpload(file);
                  }}
                />
                <span className="text-3xl text-slate-400 mb-2">📷</span>
                <p className="text-sm text-slate-600">Drop an image or click to upload</p>
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
