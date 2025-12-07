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
  const displayProducts = filteredProducts;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-2 border-gray-300 border-t-gray-900 rounded-full" />
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-700">
        Store not found.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div
        className={`relative h-56 ${store.cover_url ? '' : 'bg-gradient-to-r from-blue-600 to-indigo-600'}`}
        style={store.cover_url ? { backgroundImage: `url(${store.cover_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
      >
        <div className={`absolute inset-0 ${store.cover_url ? 'bg-black/30' : 'bg-black/10'}`} />
        <div className="max-w-5xl mx-auto px-6 flex items-end h-full pb-6 relative">
          <div
            className="w-24 h-24 rounded-full bg-white shadow-xl flex items-center justify-center text-3xl font-black text-indigo-700 border-4 border-white -mb-10 overflow-hidden"
            style={store.avatar_url ? { backgroundImage: `url(${store.avatar_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
          >
            {!store.avatar_url && (store.name?.slice(0, 1) || 'S')}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 -mt-10 relative z-10">
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black text-gray-900">{store.name}</h1>
              <p className="text-sm text-gray-500 mt-1">Shareable link: /store/{store.slug}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(window.location.href);
                  setMessage('Store link copied');
                }}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Copy link
              </button>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(`/store/${store.slug}`);
                  setMessage('Store parameter copied');
                }}
                className="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800"
              >
                Parameter
              </button>
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            {(['browse', 'cart', 'scan'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setMode(tab)}
                className={`px-4 py-2 rounded-full text-sm font-semibold ${mode === tab ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}
              >
                {tab === 'browse' ? 'Shop' : tab === 'cart' ? `Cart (${cartCount})` : 'Scan'}
              </button>
            ))}
          </div>
        </div>

        {message && (
          <div className="mt-4 bg-blue-50 border border-blue-100 text-blue-700 rounded-xl p-3 text-sm">
            {message}
          </div>
        )}

        {mode === 'browse' && (
          <div className="mt-6 space-y-6">
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
              <div className="flex gap-3 items-center">
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search products..."
                  className="flex-1 px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-3 rounded-2xl bg-gray-900 text-white font-semibold"
                >
                  Upload to scan
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
              <div className="flex gap-2 overflow-x-auto mt-4">
                <button
                  onClick={() => setSelectedCat(null)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold ${!selectedCat ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}
                >
                  All items
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCat(cat.id)}
                    className={`px-4 py-2 rounded-full text-sm font-semibold ${selectedCat === cat.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayProducts.map(product => (
                <div key={product.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col">
                  <div className="aspect-square rounded-xl bg-gray-100 overflow-hidden mb-3">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-lg">No photo</div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 uppercase">{product.brand || 'Unbranded'}</p>
                    <h3 className="text-lg font-semibold text-gray-900">{product.name}</h3>
                    <p className="text-gray-600 text-sm line-clamp-2">{product.description || ''}</p>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xl font-black text-gray-900">₱{product.price.toFixed(2)}</span>
                    <button
                      onClick={() => addToCart(product.id, 1, product.sizes?.[0]?.size)}
                      className="px-3 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold"
                    >
                      Add
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {displayProducts.length === 0 && (
              <div className="text-center text-gray-500 py-12 bg-white rounded-2xl border border-dashed border-gray-200">
                No products yet.
              </div>
            )}
          </div>
        )}

        {mode === 'cart' && (
          <div className="mt-6 bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Cart</h2>
              <span className="text-sm text-gray-500">{cartCount} items</span>
            </div>
            {cartItems.length === 0 ? (
              <p className="text-gray-500">Your cart is empty.</p>
            ) : (
              <div className="space-y-4">
                {cartItems.map(item => (
                  <div key={item.id} className="flex items-center gap-3 border border-gray-100 rounded-2xl p-3">
                    <img src={item.product.image_url || ''} className="w-16 h-16 rounded-xl object-cover bg-gray-100" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{item.product.name}</h4>
                      <p className="text-sm text-gray-500">₱{item.unit_price.toFixed(2)} · {item.quantity} pcs</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateCartItem(item.id, Math.max(1, item.quantity - 1))} className="w-8 h-8 rounded-full bg-gray-100 text-gray-700">-</button>
                      <span className="w-6 text-center font-semibold">{item.quantity}</span>
                      <button onClick={() => updateCartItem(item.id, item.quantity + 1)} className="w-8 h-8 rounded-full bg-gray-100 text-gray-700">+</button>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">₱{item.subtotal.toFixed(2)}</p>
                      <button onClick={() => removeCartItem(item.id)} className="text-xs text-red-500">Remove</button>
                    </div>
                  </div>
                ))}
                <div className="border-t border-gray-100 pt-4 flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    {cartDiscount > 0 && <p className="text-green-600 font-semibold">Savings: ₱{cartDiscount.toFixed(2)}</p>}
                    <p className="text-lg font-black text-gray-900">Total: ₱{cartTotal.toFixed(2)}</p>
                  </div>
                  {transferCode ? (
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Show this to staff</p>
                      <p className="text-3xl font-mono font-black tracking-widest text-gray-900">{transferCode}</p>
                      {transferExpires && <p className="text-xs text-gray-400">Expires {new Date(transferExpires).toLocaleTimeString()}</p>}
                    </div>
                  ) : (
                    <button onClick={generateTransferCode} className="px-5 py-3 rounded-2xl bg-gray-900 text-white font-semibold">
                      Get checkout code
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {mode === 'scan' && (
          <div className="mt-6 bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Scan product</h2>
                <p className="text-sm text-gray-500">Upload a photo to find a match in this store.</p>
              </div>
              {scanning && <span className="text-sm text-indigo-600 font-semibold">Scanning...</span>}
            </div>
            <label className="border-2 border-dashed border-gray-200 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer hover:border-gray-300">
              <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleScanUpload(file);
              }} />
              <span className="text-3xl text-gray-400 mb-2">Scan</span>
              <p className="text-sm text-gray-600">Drop an image or click to upload</p>
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
