'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

interface CartItem {
  id: string; quantity: number | null; unit_price: number; is_wholesale: boolean; tier_label: string | null;
  subtotal: number; discount: number;
  product: { id: string; name: string; price: number; brand: string | null; image_url: string | null; };
}

interface Transfer {
  transfer_id: string; code: string; status: string; expires_at: string;
  items: CartItem[]; total: number; total_discount: number; item_count: number;
}

// Pastel colors for product cards
const pastelColors = [
  'bg-[#D4F5E9]',
  'bg-[#FFE4E6]',
  'bg-[#E0F2FE]',
  'bg-[#FEF9C3]',
  'bg-[#EDE9FE]',
];

export default function StaffDashboard() {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [staff, setStaff] = useState<{ id: string; name: string; role: string; store_id?: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [codeInput, setCodeInput] = useState('');
  const [transfer, setTransfer] = useState<Transfer | null>(null);
  const [message, setMessage] = useState('');
  const [processing, setProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const router = useRouter();

  // Training
  const [products, setProducts] = useState<{ id: string; name: string; image_url: string | null }[]>([]);
  const [trainingProduct, setTrainingProduct] = useState<string | null>(null);
  const trainingFileRef = useRef<HTMLInputElement>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [staff]);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    setUser({ id: user.id, email: user.email || '' });

    // Check if staff
    const res = await fetch(`/api/staff?userId=${user.id}`);
    const data = await res.json();
    if (data.staff) {
      setStaff(data.staff);
    }
    setLoading(false);
  };

  const fetchProducts = async () => {
    let query = supabase.from('items').select('id, name, image_url').order('name');
    if (staff?.store_id) {
      query = query.eq('store_id', staff.store_id);
    }
    const { data } = await query;
    if (data) setProducts(data);
  };

  const lookupCode = async () => {
    if (!codeInput.trim()) return;
    setMessage('');
    const storeFilter = staff?.store_id ? `&storeId=${staff.store_id}` : '';
    const res = await fetch(`/api/transfer?code=${codeInput.toUpperCase()}${storeFilter}`);
    const data = await res.json();
    if (res.ok) {
      setTransfer(data);
      setMessage('');
    } else {
      setMessage(data.error || 'Invalid code');
      setTransfer(null);
    }
  };

  const confirmOrder = async () => {
    if (!transfer) return;
    setProcessing(true);
    const res = await fetch('/api/transfer', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transferId: transfer.transfer_id,
        action: 'confirm',
        staffId: staff?.id,
        paymentMethod
      })
    });
    const data = await res.json();
    if (res.ok) {
      setMessage(`✅ Order confirmed! Total: ₱${data.total.toFixed(2)}`);
      setTransfer(null);
      setCodeInput('');
    } else {
      setMessage(data.error || 'Failed to confirm');
    }
    setProcessing(false);
  };

  const cancelOrder = async () => {
    if (!transfer || !confirm('Cancel this order?')) return;
    await fetch('/api/transfer', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transferId: transfer.transfer_id, action: 'cancel', staffId: staff?.id })
    });
    setMessage('Order cancelled');
    setTransfer(null);
    setCodeInput('');
  };

  // Training
  const handleTrainingUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!trainingProduct) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      // Resize image
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1024 / img.width, 1024 / img.height, 1);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
        const resized = canvas.toDataURL('image/jpeg', 0.9);

        // Add to product's additional_images
        const { data: product } = await supabase.from('items').select('additional_images').eq('id', trainingProduct).single();
        const current = product?.additional_images || [];
        const updated = [...current, resized].slice(0, 10);

        await supabase.from('items').update({ additional_images: updated }).eq('id', trainingProduct);
        setMessage(`✅ Training image added!`);
        setTrainingProduct(null);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login'); };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-[#3478F6]"></div>
    </div>
  );

  if (!staff) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <div className="text-center bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
          <div className="w-16 h-16 bg-[#FFE4E6] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🚫</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 mb-2">Not Authorized</h1>
          <p className="text-slate-400 mb-6">You are not registered as staff.</p>
          <button onClick={handleLogout} className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-semibold hover:bg-slate-200 transition-all">Logout</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Background decoration */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#E0F2FE] rounded-full blur-3xl opacity-40" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-[#D4F5E9] rounded-full blur-3xl opacity-40" />
      </div>

      <header className="relative z-10 bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#D4F5E9] to-[#E0F2FE] rounded-xl flex items-center justify-center">
              <span className="text-lg">👤</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">{staff.name}</h1>
              <span className="text-xs font-medium text-[#3478F6] bg-[#E0F2FE] px-2 py-0.5 rounded-full">{staff.role}</span>
            </div>
          </div>
          <button onClick={handleLogout} className="text-slate-400 hover:text-slate-600 text-sm font-medium transition-colors">Logout</button>
        </div>
      </header>

      <main className="relative z-10 max-w-4xl mx-auto p-6 space-y-6">
        {message && (
          <div className={`p-4 rounded-2xl font-medium animate-fade-in ${message.includes('✅') ? 'bg-[#D4F5E9] text-emerald-700' : 'bg-[#FFE4E6] text-rose-600'}`}>
            {message}
          </div>
        )}

        {/* Order Lookup */}
        <div className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-100 border border-slate-100">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <span className="w-8 h-8 bg-[#FEF9C3] rounded-lg flex items-center justify-center text-sm">🎫</span>
            Enter Customer Code
          </h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={codeInput}
              onChange={e => setCodeInput(e.target.value.toUpperCase())}
              placeholder="ABC123"
              className="flex-1 px-5 py-4 bg-[#E0F2FE] border-none rounded-2xl text-slate-900 text-2xl tracking-[0.3em] text-center font-mono font-bold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3478F6]/30"
              maxLength={6}
            />
            <button onClick={lookupCode} className="px-8 py-4 bg-[#3478F6] text-white rounded-2xl font-bold shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all active:scale-[0.98]">
              Look Up
            </button>
          </div>
        </div>

        {/* Order Details */}
        {transfer && (
          <div className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-100 border border-slate-100 animate-fade-in">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="w-8 h-8 bg-[#D4F5E9] rounded-lg flex items-center justify-center text-sm">📦</span>
                Order: {transfer.code}
              </h2>
              <span className="text-sm text-slate-400 bg-slate-50 px-3 py-1 rounded-full">Expires: {new Date(transfer.expires_at).toLocaleTimeString()}</span>
            </div>

            {/* Items */}
            <div className="space-y-3 mb-6">
              {transfer.items.map((item, index) => (
                <div key={item.id} className={`flex items-center gap-4 p-4 ${pastelColors[index % pastelColors.length]} rounded-2xl`}>
                  {item.product.image_url && <img src={item.product.image_url} className="w-14 h-14 object-cover rounded-xl bg-white" />}
                  <div className="flex-1">
                    <h4 className="text-slate-900 font-bold">{item.product.name}</h4>
                    <p className="text-slate-600 text-sm font-medium">
                      ₱{item.unit_price.toFixed(2)} × {item.quantity ?? 0}
                      {item.is_wholesale && <span className="ml-2 text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full text-xs font-bold">{item.tier_label}</span>}
                    </p>
                  </div>
                  <span className="text-slate-900 font-black text-lg">₱{item.subtotal.toFixed(2)}</span>
                </div>
              ))}
            </div>

            {/* Totals */}
            {transfer.total_discount > 0 && (
              <div className="flex justify-between text-emerald-600 mb-2 font-medium">
                <span>Wholesale Discount</span>
                <span>-₱{transfer.total_discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-3xl font-black text-slate-900 mb-6">
              <span>Total</span>
              <span>₱{transfer.total.toFixed(2)}</span>
            </div>

            {/* Payment */}
            <div className="flex gap-3 mb-4">
              {['cash', 'gcash', 'card'].map(method => (
                <button
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  className={`px-5 py-3 rounded-xl font-semibold transition-all ${paymentMethod === method ? 'bg-[#3478F6] text-white shadow-lg shadow-blue-500/25' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  {method === 'cash' ? '💵 Cash' : method === 'gcash' ? '📱 GCash' : '💳 Card'}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button onClick={confirmOrder} disabled={processing} className="flex-1 py-4 bg-[#22c55e] text-white rounded-2xl font-bold shadow-lg shadow-emerald-500/25 active:scale-[0.98] transition-all disabled:opacity-50">
                {processing ? 'Processing...' : '✅ Confirm Order'}
              </button>
              <button onClick={cancelOrder} className="px-6 py-4 bg-[#FFE4E6] text-rose-600 rounded-2xl font-bold hover:bg-rose-100 transition-all">Cancel</button>
            </div>
          </div>
        )}

        {/* AI Training */}
        <div className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-100 border border-slate-100">
          <h2 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
            <span className="w-8 h-8 bg-[#EDE9FE] rounded-lg flex items-center justify-center text-sm">🎯</span>
            Train AI Recognition
          </h2>
          <p className="text-slate-400 text-sm mb-4">Add photos of products that weren't recognized correctly</p>
          <div className="grid grid-cols-4 gap-3">
            {products.slice(0, 12).map((p, index) => (
              <button key={p.id} onClick={() => { setTrainingProduct(p.id); trainingFileRef.current?.click(); }}
                className={`p-3 ${pastelColors[index % pastelColors.length]} rounded-2xl hover:shadow-lg transition-all text-left`}>
                {p.image_url && <img src={p.image_url} className="w-full h-16 object-cover rounded-xl mb-2 bg-white" />}
                <p className="text-slate-900 text-sm font-semibold truncate">{p.name}</p>
              </button>
            ))}
          </div>
          <input type="file" accept="image/*" ref={trainingFileRef} onChange={handleTrainingUpload} className="hidden" />
        </div>
      </main>
    </div>
  );
}
