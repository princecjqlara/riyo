'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

interface CartItem {
  id: string; quantity: number; unit_price: number; is_wholesale: boolean; tier_label: string | null;
  subtotal: number; discount: number;
  product: { id: string; name: string; price: number; brand: string | null; image_url: string | null; };
}

interface Transfer {
  transfer_id: string; code: string; status: string; expires_at: string;
  items: CartItem[]; total: number; total_discount: number; item_count: number;
}

export default function StaffDashboard() {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [staff, setStaff] = useState<{ id: string; name: string; role: string } | null>(null);
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
    fetchProducts();
  }, []);

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
    const { data } = await supabase.from('items').select('id, name, image_url').order('name');
    if (data) setProducts(data);
  };

  const lookupCode = async () => {
    if (!codeInput.trim()) return;
    setMessage('');
    const res = await fetch(`/api/transfer?code=${codeInput.toUpperCase()}`);
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

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">Loading...</div>;

  if (!staff) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <h1 className="text-2xl text-white mb-4">Not Authorized</h1>
          <p className="text-gray-400 mb-4">You are not registered as staff.</p>
          <button onClick={handleLogout} className="px-4 py-2 bg-gray-700 text-white rounded-lg">Logout</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <header className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold text-white">👤 Staff: {staff.name}</h1>
          <div className="flex items-center gap-4">
            <span className="px-2 py-1 bg-indigo-600/50 text-indigo-300 rounded text-sm">{staff.role}</span>
            <button onClick={handleLogout} className="text-gray-400 hover:text-white text-sm">Logout</button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        {message && (
          <div className={`p-4 rounded-lg mb-6 ${message.includes('✅') ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
            {message}
          </div>
        )}

        {/* Order Lookup */}
        <div className="bg-gray-800 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-medium text-white mb-4">🎫 Enter Customer Code</h2>
          <div className="flex gap-4">
            <input type="text" value={codeInput} onChange={e => setCodeInput(e.target.value.toUpperCase())} placeholder="ABC123"
              className="flex-1 px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white text-2xl tracking-widest text-center font-mono" maxLength={6} />
            <button onClick={lookupCode} className="px-8 py-3 bg-indigo-600 text-white rounded-lg font-medium">Look Up</button>
          </div>
        </div>

        {/* Order Details */}
        {transfer && (
          <div className="bg-gray-800 rounded-xl p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium text-white">📦 Order: {transfer.code}</h2>
              <span className="text-sm text-gray-400">Expires: {new Date(transfer.expires_at).toLocaleTimeString()}</span>
            </div>

            {/* Items */}
            <div className="space-y-3 mb-6">
              {transfer.items.map(item => (
                <div key={item.id} className="flex items-center gap-4 p-3 bg-gray-700 rounded-lg">
                  {item.product.image_url && <img src={item.product.image_url} className="w-12 h-12 object-cover rounded" />}
                  <div className="flex-1">
                    <h4 className="text-white">{item.product.name}</h4>
                    <p className="text-gray-400 text-sm">
                      ₱{item.unit_price.toFixed(2)} × {item.quantity}
                      {item.is_wholesale && <span className="ml-2 text-yellow-400">({item.tier_label})</span>}
                    </p>
                  </div>
                  <span className="text-white font-medium">₱{item.subtotal.toFixed(2)}</span>
                </div>
              ))}
            </div>

            {/* Totals */}
            {transfer.total_discount > 0 && (
              <div className="flex justify-between text-green-400 mb-2">
                <span>Wholesale Discount</span>
                <span>-₱{transfer.total_discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-2xl font-bold text-white mb-6">
              <span>Total</span>
              <span>₱{transfer.total.toFixed(2)}</span>
            </div>

            {/* Payment */}
            <div className="flex gap-4 mb-4">
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg">
                <option value="cash">Cash</option>
                <option value="gcash">GCash</option>
                <option value="card">Card</option>
              </select>
            </div>

            <div className="flex gap-4">
              <button onClick={confirmOrder} disabled={processing} className="flex-1 py-3 bg-green-600 text-white rounded-lg font-medium disabled:opacity-50">
                {processing ? 'Processing...' : '✅ Confirm Order'}
              </button>
              <button onClick={cancelOrder} className="px-6 py-3 bg-red-600/50 text-red-300 rounded-lg">Cancel</button>
            </div>
          </div>
        )}

        {/* AI Training */}
        <div className="bg-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-medium text-white mb-4">🎯 Train AI Recognition</h2>
          <p className="text-gray-400 text-sm mb-4">Add photos of products that weren't recognized correctly</p>
          <div className="grid grid-cols-4 gap-3">
            {products.slice(0, 12).map(p => (
              <button key={p.id} onClick={() => { setTrainingProduct(p.id); trainingFileRef.current?.click(); }}
                className="p-3 bg-gray-700 rounded-lg hover:bg-gray-600 text-left">
                {p.image_url && <img src={p.image_url} className="w-full h-16 object-cover rounded mb-2" />}
                <p className="text-white text-sm truncate">{p.name}</p>
              </button>
            ))}
          </div>
          <input type="file" accept="image/*" ref={trainingFileRef} onChange={handleTrainingUpload} className="hidden" />
        </div>
      </main>
    </div>
  );
}
