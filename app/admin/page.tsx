'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

interface Category {
  id: string;
  name: string;
  parent_id: string | null;
  children?: Category[];
}

interface Product {
  id: string;
  name: string;
  price: number;
  brand: string | null;
  category: string | null;
  category_id: string | null;
  description: string | null;
  image_url: string | null;
  additional_images: string[] | null;
  distinguishing_features: string[] | null;
  quantity: number | null;
  scan_count: number;
  product_code: string | null;
  sizes: { size: string; price: number; stock: number }[] | null;
  specifications: Record<string, string> | null;
  wholesale_tiers: { min_qty: number; price: number; label: string }[] | null;
}

interface StoreRow {
  id: string;
  name: string;
  organizer_id?: string;
  slug?: string;
  created_at?: string;
}

interface StaffMember {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  store_id: string | null;
  store_name: string | null;
  created_at: string;
}

type TabType = 'products' | 'categories' | 'search' | 'analytics' | 'bulk' | 'users' | 'stores';

// Pastel colors for cards
const pastelColors = [
  { bg: 'bg-[#D4F5E9]', accent: 'text-emerald-700' },
  { bg: 'bg-[#FFE4E6]', accent: 'text-rose-600' },
  { bg: 'bg-[#E0F2FE]', accent: 'text-sky-600' },
  { bg: 'bg-[#FEF9C3]', accent: 'text-amber-600' },
  { bg: 'bg-[#EDE9FE]', accent: 'text-violet-600' },
];

export default function AdminDashboard() {
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentStoreId, setCurrentStoreId] = useState<string>('');
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [storeEditId, setStoreEditId] = useState<string>('');
  const [storeEditName, setStoreEditName] = useState<string>('');
  const [storeSaving, setStoreSaving] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryTree, setCategoryTree] = useState<Category[]>([]);
  const [analyticsCategory, setAnalyticsCategory] = useState<string>('');
  const [activeTab, setActiveTab] = useState<TabType>('products');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [selectedStaffStoreId, setSelectedStaffStoreId] = useState<string>('');
  const [staffCode, setStaffCode] = useState('');
  const [staffCodeExpiresAt, setStaffCodeExpiresAt] = useState<number | null>(null);
  const [staffCodeStatus, setStaffCodeStatus] = useState<string | null>(null);
  const [staffCodeCountdown, setStaffCodeCountdown] = useState('');
  const [staffCodeLoading, setStaffCodeLoading] = useState(false);
  const router = useRouter();

  // Product form
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [brand, setBrand] = useState('');
  const [description, setDescription] = useState('');
  const [features, setFeatures] = useState('');
  const [quantity, setQuantity] = useState('');
  const [productCode, setProductCode] = useState('');
  const [wholesaleTiers, setWholesaleTiers] = useState<{ min_qty: number; price: number; label: string }[]>([]);
  const [sizes, setSizes] = useState<{ size: string; price: number; stock: number }[]>([]);
  const [specs, setSpecs] = useState<{ key: string; value: string }[]>([]);
  const [productCategoryId, setProductCategoryId] = useState<string>('');
  const [mainImage, setMainImage] = useState<string | null>(null);
  const [additionalImages, setAdditionalImages] = useState<string[]>([]);
  const mainFileRef = useRef<HTMLInputElement>(null);

  // Category form
  const [newCategoryName, setNewCategoryName] = useState('');
  const [parentCategoryId, setParentCategoryId] = useState<string>('');

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanImage, setScanImage] = useState<string | null>(null);
  const scanFileRef = useRef<HTMLInputElement>(null);

  // Training
  const [trainingProduct, setTrainingProduct] = useState<Product | null>(null);
  const trainingFileRef = useRef<HTMLInputElement>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const activeStore = stores.find(s => s.id === currentStoreId);
  const storeShareLink = useMemo(() => {
    const target = activeStore || (storeEditId ? stores.find((s) => s.id === storeEditId) || null : null);
    if (!target) return '';
    if (typeof window === 'undefined') return '';
    const slugOrId = target.slug || target.id;
    return `${window.location.origin}/store/${slugOrId}`;
  }, [activeStore, storeEditId, stores]);

  const copyValue = (value: string) => {
    if (!value) return;
    navigator.clipboard?.writeText(value);
  };

  useEffect(() => {
    checkAuth();
    fetchData();
  }, []);

  useEffect(() => {
    setSelectedProductIds([]);
    setSearchResults([]);
    if (!currentStoreId) return;
    loadStoreData(currentStoreId);
  }, [currentStoreId]);

  useEffect(() => {
    if (!stores.length) return;
    if (!selectedStaffStoreId && (currentStoreId || stores[0]?.id)) {
      setSelectedStaffStoreId(currentStoreId || stores[0].id);
    }
  }, [stores, currentStoreId, selectedStaffStoreId]);

  useEffect(() => {
    if (activeTab !== 'users') return;
    if (!staff.length && !staffLoading) {
      fetchStaff();
    }
    if (selectedStaffStoreId) {
      fetchStaffJoinCode(selectedStaffStoreId, true);
    }
  }, [activeTab, selectedStaffStoreId]);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    setUser({ email: user.email || '' });
    setLoading(false);
  };

  const fetchData = async () => {
    try {
      const res = await fetch('/api/stores');
      if (res.ok) {
        const body = await res.json();
        const storeList: StoreRow[] = body.stores || [];
        setStores(storeList);
        if (!currentStoreId && storeList.length) {
          setCurrentStoreId(storeList[0].id);
          setStoreEditId(storeList[0].id);
          setStoreEditName(storeList[0].name);
        }
      }
    } catch (err) {
      console.error('Store fetch failed', err);
      setMessage('Could not load stores.');
    }
  };

  const loadStoreData = async (storeId: string) => {
    await Promise.all([
      fetchProducts(storeId),
      fetchCategories(storeId),
    ]);
  };

  const fetchProducts = async (storeId: string) => {
    try {
      const res = await fetch(`/api/products?storeId=${storeId}`);
      if (res.ok) {
        const data = await res.json();
        setProducts(Array.isArray(data) ? data : []);
      } else {
        setProducts([]);
      }
    } catch (error) {
      console.error('Failed to load products', error);
      setProducts([]);
    }
  };

  const fetchCategories = async (storeId: string) => {
    try {
      const res = await fetch(`/api/categories?storeId=${storeId}`);
      const data = await res.json();
      if (data.categories) setCategories(data.categories);
      if (data.tree) setCategoryTree(data.tree);
    } catch (error) {
      console.error('Failed to load categories', error);
      setCategories([]);
      setCategoryTree([]);
    }
  };

  const fetchStaff = async () => {
    setStaffLoading(true);
    try {
      const res = await fetch('/api/staff');
      if (res.ok) {
        const data = await res.json();
        setStaff(data.staff || []);
      } else {
        const body = await res.json().catch(() => ({}));
        setMessage(body.error || 'Failed to load users');
      }
    } catch (error) {
      console.error('Failed to load staff', error);
      setMessage('Could not load users.');
    } finally {
      setStaffLoading(false);
    }
  };

  const fetchStaffJoinCode = async (storeId: string, autoCreate = false) => {
    setStaffCodeLoading(true);
    try {
      const res = await fetch(`/api/stores/join-code?storeId=${storeId}&role=staff`);
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || 'Failed to load join code');
      }
      if (!body.code && autoCreate) {
        await renewStaffCode(storeId);
        return;
      }
      setStaffCode(body.code || '');
      setStaffCodeExpiresAt(body.expiresAt ? new Date(body.expiresAt).getTime() : null);
      setStaffCodeStatus(body.status || null);
    } catch (error) {
      console.error('Join code error', error);
      setMessage(error instanceof Error ? error.message : 'Failed to load join code');
    } finally {
      setStaffCodeLoading(false);
    }
  };

  const renewStaffCode = async (storeId?: string) => {
    const targetStoreId = storeId || selectedStaffStoreId;
    if (!targetStoreId) return;
    setStaffCodeLoading(true);
    try {
      const res = await fetch('/api/stores/join-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId: targetStoreId, role: 'staff' }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || 'Failed to create code');
      }
      setStaffCode(body.code);
      setStaffCodeExpiresAt(body.expiresAt ? new Date(body.expiresAt).getTime() : null);
      setStaffCodeStatus(body.status);
    } catch (error) {
      console.error('Renew code error', error);
      setMessage(error instanceof Error ? error.message : 'Failed to create join code');
    } finally {
      setStaffCodeLoading(false);
    }
  };

  const updateStaffRole = async (staffId: string, role: string) => {
    try {
      const res = await fetch('/api/staff', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId, role }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || 'Failed to update user');
      }
      setStaff(prev => prev.map(m => m.id === staffId ? { ...m, ...body.staff } : m));
      setMessage('User updated.');
    } catch (error) {
      console.error('Update staff error', error);
      setMessage(error instanceof Error ? error.message : 'Failed to update user');
    }
  };

  const removeStaffMember = async (staffId: string) => {
    if (!confirm('Remove this user from the store?')) return;
    try {
      const res = await fetch('/api/staff', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || 'Failed to remove user');
      }
      setStaff(prev => prev.filter(m => m.id !== staffId));
      setMessage('User removed.');
    } catch (error) {
      console.error('Delete staff error', error);
      setMessage(error instanceof Error ? error.message : 'Failed to remove user');
    }
  };

  useEffect(() => {
    if (!staffCodeExpiresAt) {
      setStaffCodeCountdown('');
      return;
    }
    const updateCountdown = () => {
      const seconds = Math.max(0, Math.floor((staffCodeExpiresAt - Date.now()) / 1000));
      const minutes = Math.floor(seconds / 60);
      const remainder = seconds % 60;
      setStaffCodeCountdown(`${minutes}m ${remainder.toString().padStart(2, '0')}s`);
      if (seconds === 0) setStaffCodeStatus('expired');
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [staffCodeExpiresAt]);

  const saveStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeEditId || !storeEditName.trim()) {
      setMessage('Add a store first and enter a name.');
      return;
    }
    setStoreSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/stores', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: storeEditId, name: storeEditName.trim() }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to rename store');
      const { store } = body;
      setStores(stores.map((s) => (s.id === store.id ? store : s)));
      setStoreEditName(store.name);
      setMessage('Store updated.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to update store');
    } finally {
      setStoreSaving(false);
    }
  };

  // Image resize
  const resizeImage = (base64: string, maxWidth = 1024): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(maxWidth / img.width, maxWidth / img.height, 1);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.9));
        } else resolve(base64);
      };
      img.src = base64;
    });
  };

  // === PRODUCT FUNCTIONS ===
  const handleMainImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const resized = await resizeImage(reader.result as string);
      setMainImage(resized);
      setAnalyzing(true);
      setMessage('ðŸ¤– Analyzing...');
      try {
        const res = await fetch('/api/analyze-product', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: resized }),
        });
        const data = await res.json();
        if (data.analysis) {
          if (data.analysis.name) setName(data.analysis.name);
          if (data.analysis.brand) setBrand(data.analysis.brand);
          if (data.analysis.description) setDescription(data.analysis.description);
          if (data.analysis.features?.length) setFeatures(data.analysis.features.join(', '));
          if (data.analysis.specifications) {
            setSpecs(Object.entries(data.analysis.specifications).map(([key, value]) => ({ key, value: String(value) })));
          }
          // Auto-fill suggested price
          if (data.analysis.suggestedPrice && !price) {
            setPrice(data.analysis.suggestedPrice.toString());
          }
          // Auto-fill size if detected
          if (data.analysis.size && sizes.length === 0) {
            setSizes([{ size: data.analysis.size, price: data.analysis.suggestedPrice || 0, stock: 10 }]);
          }
          // Auto-generate product code from brand/name
          if (!productCode && data.analysis.brand) {
            const code = `${data.analysis.brand.slice(0, 3).toUpperCase()}-${Date.now().toString(36).slice(-5).toUpperCase()}`;
            setProductCode(code);
          }
          setMessage('âœ… AI filled: Name, Brand, Price, Size, Specs!');
        }
      } catch { setMessage('âš ï¸ AI failed'); }
      finally { setAnalyzing(false); }
    };
    reader.readAsDataURL(file);
  };

  const handleAdditionalImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newImages: string[] = [];
    for (let i = 0; i < Math.min(files.length, 5); i++) {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(files[i]);
      });
      newImages.push(await resizeImage(base64));
    }
    setAdditionalImages([...additionalImages, ...newImages].slice(0, 5));
  };

  const saveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!price) { setMessage('Price required'); return; }
    if (!currentStoreId) { setMessage('Choose a store first.'); return; }
    setSaving(true);
    try {
      const featuresArray = features.split(',').map(f => f.trim()).filter(Boolean);
      const specsObj = specs.reduce((acc, { key, value }) => ({ ...acc, [key]: value }), {});
      const quantityValue = quantity.trim() === '' ? null : (parseInt(quantity) || 0);

      const productData = {
        name: name || 'Unknown',
        price: parseFloat(price),
        brand: brand || null,
        category_id: productCategoryId || null,
        description: description || null,
        image_url: mainImage,
        additional_images: additionalImages.length ? additionalImages : null,
        distinguishing_features: featuresArray.length ? featuresArray : null,
        quantity: quantityValue,
        wholesale_tiers: wholesaleTiers.length ? wholesaleTiers : [],
        product_code: productCode || null,
        sizes: sizes.length ? sizes : [],
        specifications: Object.keys(specsObj).length ? specsObj : {},
        store_id: currentStoreId,
      };

      if (editingProductId) {
        const res = await fetch(`/api/products/${editingProductId}?storeId=${currentStoreId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(productData),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || 'Failed to update product');
        const data = body;
        setProducts(products.map(p => p.id === editingProductId ? data : p));
        setMessage('Product updated!');
      } else {
        const res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(productData),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to save product');
        setProducts([data, ...products]);
        setMessage('Product saved!');
      }

      resetProductForm();
      setShowProductForm(false);
    } catch (err) { setMessage('Error: ' + (err instanceof Error ? err.message : 'Failed')); }
    finally { setSaving(false); }
  };
  const resetProductForm = () => {
    setEditingProductId(null);
    setName(''); setPrice(''); setBrand(''); setDescription(''); setFeatures(''); setQuantity('');
    setProductCategoryId(''); setMainImage(null); setAdditionalImages([]); setWholesaleTiers([]);
    setProductCode(''); setSizes([]); setSpecs([]);
  };

  const loadProductForEdit = (product: Product) => {
    setEditingProductId(product.id);
    setName(product.name || '');
    setPrice(product.price?.toString() || '');
    setBrand(product.brand || '');
    setDescription(product.description || '');
    setFeatures(product.distinguishing_features?.join(', ') || '');
    setQuantity(product.quantity !== null && product.quantity !== undefined ? product.quantity.toString() : '');
    setProductCategoryId(product.category_id || '');
    setMainImage(product.image_url || null);
    setAdditionalImages(product.additional_images || []);
    setWholesaleTiers(product.wholesale_tiers || []);
    setProductCode(product.product_code || '');
    setSizes(product.sizes || []);
    setSpecs(product.specifications ? Object.entries(product.specifications).map(([key, value]) => ({ key, value })) : []);
    setShowProductForm(true);
  };

  const deleteProduct = async (id: string) => {
    if (!confirm('Delete?')) return;
    if (!currentStoreId) { setMessage('Choose a store first.'); return; }
    const res = await fetch(`/api/products/${id}?storeId=${currentStoreId}`, { method: 'DELETE' });
    if (res.ok) {
      setProducts(products.filter(p => p.id !== id));
      setSelectedProductIds(selectedProductIds.filter(pid => pid !== id));
    } else {
      const body = await res.json().catch(() => ({}));
      setMessage(body.error || 'Failed to delete product');
    }
  };

  const toggleSelectProduct = (id: string) => {
    setSelectedProductIds(prev =>
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
    );
  };

  const bulkDelete = async () => {
    if (selectedProductIds.length === 0) return;
    if (!currentStoreId) { setMessage('Choose a store first.'); return; }
    if (!confirm(`Delete ${selectedProductIds.length} products?`)) return;
    const res = await fetch('/api/products', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selectedProductIds, storeId: currentStoreId })
    });
    if (res.ok) {
      setProducts(products.filter(p => !selectedProductIds.includes(p.id)));
      setSelectedProductIds([]);
      setMessage('Products deleted.');
    } else {
      const body = await res.json().catch(() => ({}));
      setMessage(body.error || 'Failed to delete products.');
    }
  };

  // === CATEGORY FUNCTIONS ===
  const createCategory = async () => {
    if (!newCategoryName.trim()) return;
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newCategoryName,
        parent_id: parentCategoryId || null,
        storeId: currentStoreId || null,
      }),
    });
    if (res.ok) {
      setNewCategoryName('');
      setParentCategoryId('');
      if (currentStoreId) fetchCategories(currentStoreId);
      setMessage('âœ… Category created!');
    }
  };

  const deleteCategory = async (id: string) => {
    if (!confirm('Delete category and subcategories?')) return;
    await fetch(`/api/categories?id=${id}`, { method: 'DELETE' });
    if (currentStoreId) fetchCategories(currentStoreId);
  };

  // === SEARCH & SCAN ===
  const handleSearch = () => {
    if (!searchQuery.trim()) { setSearchResults(products); return; }
    const q = searchQuery.toLowerCase();
    setSearchResults(products.filter(p =>
      p.name?.toLowerCase().includes(q) ||
      p.brand?.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q)
    ));
  };

  const handleScanFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const resized = await resizeImage(reader.result as string);
      setScanImage(resized);
      setScanning(true);
      try {
        const res = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: resized }),
        });
        const data = await res.json();
        if (data.product) {
          setSearchResults([data.product]);
          setMessage('âœ… Found: ' + data.product.name);
        } else if (data.similarProducts?.length) {
          setSearchResults(data.similarProducts);
          setMessage('Found similar products');
        } else {
          setMessage('No match found');
          setSearchResults([]);
        }
      } catch { setMessage('Scan failed'); }
      finally { setScanning(false); }
    };
    reader.readAsDataURL(file);
  };

  // === TRAINING ===
  const handleTrainingPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!trainingProduct) return;
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const resized = await resizeImage(reader.result as string);
      const currentImages = trainingProduct.additional_images || [];
      const updated = [...currentImages, resized].slice(0, 10);
      const { error } = await supabase.from('items')
        .update({ additional_images: updated })
        .eq('id', trainingProduct.id);
      if (!error) {
        setProducts(products.map(p => p.id === trainingProduct.id ? { ...p, additional_images: updated } : p));
        setMessage(`âœ… Training photo added! (${updated.length} total)`);
        setTrainingProduct(null);
      }
    };
    reader.readAsDataURL(file);
  };

  // Filter products by category
  const filteredProducts = selectedCategory
    ? products.filter(p => p.category_id === selectedCategory)
    : products;
  const staffForStore = selectedStaffStoreId
    ? staff.filter(member => member.store_id === selectedStaffStoreId)
    : staff;

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login'); };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-[#3478F6]"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans text-slate-800 selection:bg-blue-100 selection:text-blue-900">
      {/* Background decoration */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#E0F2FE] rounded-full blur-3xl opacity-40" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-[#D4F5E9] rounded-full blur-3xl opacity-40" />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="bg-white border-b border-slate-100 shadow-sm sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#3478F6] to-[#7C3AED] rounded-xl flex items-center justify-center">
                <span className="text-white text-lg">ðŸ“¦</span>
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-900">Admin<span className="font-normal text-slate-400">Panel</span></h1>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-slate-400 text-sm font-medium bg-slate-50 px-3 py-1.5 rounded-full">{user?.email}</span>
              <button onClick={handleLogout} className="text-slate-400 hover:text-rose-500 text-sm font-semibold transition-colors">Log Out</button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto p-6 animate-fade-in-up">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400 font-bold">Active Store</p>
              <p className="text-xl font-black text-slate-900">{activeStore?.name || 'Your store'}</p>
              {activeStore?.slug && (
                <p className="text-sm text-slate-400">/store/{activeStore.slug}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-slate-200 px-4 py-3 bg-white shadow-sm min-w-[220px]">
                <p className="text-sm font-semibold text-slate-900">{activeStore?.name || 'No store found'}</p>
                <p className="text-xs text-slate-500 break-all">
                  {activeStore?.id || 'Create a store to get started'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => copyValue(activeStore?.id || '')}
                disabled={!activeStore}
                className="text-sm text-[#3478F6] font-medium hover:underline disabled:text-slate-300"
              >
                Copy ID
              </button>
              <button
                type="button"
                onClick={() => copyValue(storeShareLink)}
                disabled={!storeShareLink}
                className="text-sm text-[#3478F6] font-medium hover:underline disabled:text-slate-300"
              >
                Copy store link
              </button>
            </div>
          </div>
          {/* Tabs */}
          <div className="flex gap-2 mb-8 overflow-x-auto pb-2 no-scrollbar">
            {(['products', 'categories', 'bulk', 'search', 'analytics', 'users', 'stores'] as TabType[]).map(tab => (
              <button key={tab} onClick={() => { setActiveTab(tab); setSearchResults([]); }}
                className={`px-5 py-2.5 rounded-xl font-semibold text-sm whitespace-nowrap transition-all ${activeTab === tab ? 'bg-[#3478F6] text-white shadow-lg shadow-blue-500/25' : 'bg-white text-slate-500 border border-slate-100 hover:bg-slate-50 hover:text-slate-900'}`}>
                {tab === 'products'
                  ? 'ðŸ“¦ Products'
                  : tab === 'categories'
                    ? 'ðŸ“ Categories'
                    : tab === 'bulk'
                      ? 'ðŸš€ Bulk Upload'
                      : tab === 'search'
                        ? 'ðŸ” Search'
                        : tab === 'analytics'
                          ? 'dY"S Analytics'
                          : tab === 'users'
                            ? '👥 Users'
                            : 'ðŸª Stores'}
              </button>
            ))}
          </div>

          {message && (
            <div className={`p-4 rounded-2xl mb-6 font-medium animate-fade-in ${message.includes('Error') ? 'bg-[#FFE4E6] text-rose-600' : message.includes('âš ï¸') ? 'bg-[#FEF9C3] text-amber-600' : 'bg-[#D4F5E9] text-emerald-700'}`}>
              {message}
            </div>
          )}

          {/* BULK UPLOAD TAB */}
          {activeTab === 'bulk' && (
            <div className="bg-white rounded-3xl p-8 shadow-xl shadow-slate-100 border border-slate-100 animate-fade-in">
              <div className="text-center max-w-2xl mx-auto">
                <div className="w-20 h-20 bg-[#E0F2FE] rounded-2xl flex items-center justify-center text-4xl mx-auto mb-6">ðŸš€</div>
                <h2 className="text-3xl font-black text-slate-900 mb-2">Bulk Product Upload</h2>
                <p className="text-slate-400 mb-8 text-lg">Upload multiple photos. Our AI will automatically detect details, categorize items, and create products for you.</p>
              </div>

              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center hover:border-[#3478F6] hover:bg-blue-50/30 transition-all cursor-pointer group"
                onClick={() => document.getElementById('bulk-file')?.click()}>
                <div className="text-6xl mb-6 group-hover:scale-110 transition-transform duration-300">ðŸ“¸</div>
                <h3 className="text-slate-900 font-bold text-xl mb-2">Drop photos here</h3>
                <p className="text-slate-400 font-medium">or click to browse (Max 20)</p>
                <input id="bulk-file" type="file" multiple accept="image/*" className="hidden"
                  onChange={async (e) => {
                    const files = e.target.files;
                    if (!files?.length) return;
                    if (!currentStoreId) { setMessage('Choose a store first.'); return; }
                    setMessage(`Analyzing ${files.length} images... This may take a while.`);
                    setAnalyzing(true);

                    const images = [];
                    for (let i = 0; i < files.length; i++) {
                      const reader = new FileReader();
                      const p = new Promise<string>(resolve => {
                        reader.onload = async () => resolve(await resizeImage(reader.result as string));
                      });
                      reader.readAsDataURL(files[i]);
                      images.push(await p);
                    }

                    try {
                      const res = await fetch('/api/bulk-upload', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ images, autoSave: true, storeId: currentStoreId })
                      });
                      const data = await res.json();
                      setMessage(`âœ… Processed: ${data.successful} success, ${data.failed} failed`);
                      if (data.successful > 0) fetchData();
                    } catch (err) { setMessage('Bulk upload failed'); }
                    finally { setAnalyzing(false); }
                  }}
                />
              </div>

              {analyzing && (
                <div className="mt-10 text-center animate-pulse">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-[#3478F6] mb-4"></div>
                  <p className="text-slate-900 font-bold text-lg">AI Vision Processing...</p>
                  <p className="text-slate-400">Identifying products and extracting details</p>
                </div>
              )}
            </div>
          )}

          {/* PRODUCTS TAB */}
          {activeTab === 'products' && (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              {/* Category Sidebar */}
              <div className="lg:col-span-1">
                <div className="bg-white rounded-2xl p-5 shadow-lg shadow-slate-100 border border-slate-100 sticky top-24">
                  <h3 className="text-slate-900 font-bold mb-4 uppercase tracking-wider text-xs">Categories</h3>
                  <button onClick={() => setSelectedCategory(null)}
                    className={`w-full text-left px-4 py-3 rounded-xl mb-2 font-semibold text-sm transition-all ${!selectedCategory ? 'bg-[#3478F6] text-white shadow-lg shadow-blue-500/25' : 'text-slate-500 hover:bg-slate-50'}`}>
                    All Products <span className="float-right opacity-60">{products.length}</span>
                  </button>
                  <div className="space-y-1 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                    {categoryTree.map(cat => (
                      <CategoryItem key={cat.id} cat={cat} selected={selectedCategory} onSelect={setSelectedCategory} products={products} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Products Grid */}
              <div className="lg:col-span-3">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-black text-gray-900">{selectedCategory ? categories.find(c => c.id === selectedCategory)?.name : 'All Products'}</h2>
                  <button onClick={() => { setShowProductForm(true); resetProductForm(); }}
                    className="bg-gray-900 text-white px-6 py-3 rounded-2xl font-bold shadow-xl shadow-gray-900/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2">
                    <span>+</span> Add Product
                  </button>
                </div>

                {showProductForm && (
                  <div className="bg-white rounded-3xl p-8 mb-8 shadow-2xl shadow-gray-200/50 border border-gray-100 animate-slide-down relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange-400 to-pink-500" />
                    <div className="flex justify-between mb-8">
                      <h3 className="text-xl font-bold text-gray-900">{editingProductId ? 'âœï¸ Edit Product' : 'âž• Add New Product'}</h3>
                      <button onClick={() => { setShowProductForm(false); resetProductForm(); }} className="w-10 h-10 rounded-full bg-gray-50 text-gray-400 hover:bg-gray-100 flex items-center justify-center transition-colors">âœ•</button>
                    </div>

                    <form onSubmit={saveProduct} className="space-y-6">
                      <div className="flex gap-6 items-start">
                        <div className="w-32 h-32 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center relative overflow-hidden group cursor-pointer hover:border-orange-300 transition-colors">
                          <input type="file" accept="image/*" onChange={handleMainImageUpload} ref={mainFileRef} disabled={analyzing} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                          {mainImage ? (
                            <img src={mainImage} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-3xl text-gray-300 group-hover:text-orange-300 transition-colors">+</span>
                          )}
                        </div>
                        <div className="flex-1">
                          <label className="block text-sm font-bold text-gray-700 mb-2">Additional Photos</label>
                          <input type="file" accept="image/*" multiple onChange={handleAdditionalImages}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100" />
                          {additionalImages.length > 0 && (
                            <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
                              {additionalImages.map((img, i) => <img key={i} src={img} className="w-16 h-16 object-cover rounded-xl shadow-sm border border-gray-100" />)}
                            </div>
                          )}
                        </div>
                      </div>

                      {analyzing && <div className="p-4 bg-orange-50 text-orange-600 rounded-xl flex items-center gap-3 animate-pulse font-medium">âœ¨ AI is analyzing your photo...</div>}

                      <div className="grid grid-cols-2 gap-5">
                        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Product Name"
                          className="px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-gray-900 font-bold placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black/5 focus:bg-white transition-all" />

                        <div className="relative">
                          <span className="absolute left-4 top-3 text-gray-400">â‚±</span>
                          <input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="Price" required
                            className="w-full pl-8 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-gray-900 font-bold placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:text-green-600 transition-all" />
                        </div>

                        <input type="text" value={brand} onChange={e => setBrand(e.target.value)} placeholder="Brand"
                          className="px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black/5 focus:bg-white transition-all" />

                        <input type="text" value={productCode} onChange={e => setProductCode(e.target.value)} placeholder="SKU / Code"
                          className="px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black/5 focus:bg-white transition-all font-mono text-sm" />

                        <select value={productCategoryId} onChange={e => setProductCategoryId(e.target.value)}
                          className="px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/5 transition-all">
                          <option value="">Select Category</option>
                          {categories.map(c => <option key={c.id} value={c.id}>{c.parent_id ? '  â”” ' : ''}{c.name}</option>)}
                        </select>

                        <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="Stock Qty (optional)"
                          className="px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black/5 transition-all" />
                      </div>

                      <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Product Description..."
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black/5 focus:bg-white transition-all min-h-[100px]" />

                      {/* Advanced Sections */}
                      <div className="space-y-6 pt-6 border-t border-gray-100">

                        {/* Sizes */}
                        <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                          <div className="flex justify-between mb-4 items-center">
                            <label className="text-gray-900 font-bold text-sm uppercase tracking-wide">ðŸ“ Sizes / Variations</label>
                            <button type="button" onClick={() => setSizes([...sizes, { size: '', price: parseFloat(price) || 0, stock: 0 }])} className="text-white bg-black px-3 py-1 rounded-lg text-xs font-bold hover:opacity-80 transition-opacity">+ Add Size</button>
                          </div>
                          {sizes.map((s, i) => (
                            <div key={i} className="flex gap-3 mb-3 animate-fade-in">
                              <input placeholder="Size name (e.g. XL)" value={s.size} onChange={e => { const n = [...sizes]; n[i].size = e.target.value; setSizes(n); }} className="flex-1 px-3 py-2 bg-white rounded-xl border border-gray-200 text-sm font-bold" />
                              <input placeholder="Price" type="number" value={s.price} onChange={e => { const n = [...sizes]; n[i].price = parseFloat(e.target.value); setSizes(n); }} className="w-24 px-3 py-2 bg-white rounded-xl border border-gray-200 text-sm" />
                              <input placeholder="Stock" type="number" value={s.stock} onChange={e => { const n = [...sizes]; n[i].stock = parseInt(e.target.value); setSizes(n); }} className="w-20 px-3 py-2 bg-white rounded-xl border border-gray-200 text-sm" />
                              <button type="button" onClick={() => setSizes(sizes.filter((_, idx) => idx !== i))} className="w-8 h-8 flex items-center justify-center bg-red-50 text-red-500 rounded-lg hover:bg-red-100">Ã—</button>
                            </div>
                          ))}
                          {sizes.length === 0 && <p className="text-xs text-gray-400 italic">No sizes added.</p>}
                        </div>

                        {/* Wholesale Tiers */}
                        <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                          <div className="flex justify-between mb-4 items-center">
                            <label className="text-gray-900 font-bold text-sm uppercase tracking-wide">ðŸ’° Wholesale Pricing</label>
                            <button type="button" onClick={() => setWholesaleTiers([...wholesaleTiers, { min_qty: 10, price: parseFloat(price) || 0, label: 'Wholesale' }])} className="text-white bg-green-600 px-3 py-1 rounded-lg text-xs font-bold hover:bg-green-700 transition-colors">+ Add Tier</button>
                          </div>
                          {wholesaleTiers.map((t, i) => (
                            <div key={i} className="flex gap-3 mb-3 animate-fade-in">
                              <input placeholder="Min Qty" type="number" value={t.min_qty} onChange={e => { const n = [...wholesaleTiers]; n[i].min_qty = parseInt(e.target.value); setWholesaleTiers(n); }} className="w-24 px-3 py-2 bg-white rounded-xl border border-gray-200 text-sm" />
                              <input placeholder="Price" type="number" value={t.price} onChange={e => { const n = [...wholesaleTiers]; n[i].price = parseFloat(e.target.value); setWholesaleTiers(n); }} className="w-24 px-3 py-2 bg-white rounded-xl border border-gray-200 text-sm text-green-600 font-bold" />
                              <input placeholder="Label" value={t.label} onChange={e => { const n = [...wholesaleTiers]; n[i].label = e.target.value; setWholesaleTiers(n); }} className="flex-1 px-3 py-2 bg-white rounded-xl border border-gray-200 text-sm" />
                              <button type="button" onClick={() => setWholesaleTiers(wholesaleTiers.filter((_, idx) => idx !== i))} className="w-8 h-8 flex items-center justify-center bg-red-50 text-red-500 rounded-lg hover:bg-red-100">Ã—</button>
                            </div>
                          ))}
                          {wholesaleTiers.length === 0 && <p className="text-xs text-gray-400 italic">No wholesale prices set.</p>}
                        </div>

                        {/* Specs */}
                        <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                          <div className="flex justify-between mb-4 items-center">
                            <label className="text-gray-900 font-bold text-sm uppercase tracking-wide">ðŸ“‹ Specifications</label>
                            <button type="button" onClick={() => setSpecs([...specs, { key: '', value: '' }])} className="text-white bg-blue-600 px-3 py-1 rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors">+ Add Spec</button>
                          </div>
                          {specs.map((s, i) => (
                            <div key={i} className="flex gap-3 mb-3 animate-fade-in">
                              <input placeholder="Key (e.g. Material)" value={s.key} onChange={e => { const n = [...specs]; n[i].key = e.target.value; setSpecs(n); }} className="flex-1 px-3 py-2 bg-white rounded-xl border border-gray-200 text-sm font-bold text-gray-700" />
                              <input placeholder="Value (e.g. Cotton)" value={s.value} onChange={e => { const n = [...specs]; n[i].value = e.target.value; setSpecs(n); }} className="flex-1 px-3 py-2 bg-white rounded-xl border border-gray-200 text-sm" />
                              <button type="button" onClick={() => setSpecs(specs.filter((_, idx) => idx !== i))} className="w-8 h-8 flex items-center justify-center bg-red-50 text-red-500 rounded-lg hover:bg-red-100">Ã—</button>
                            </div>
                          ))}
                          {specs.length === 0 && <p className="text-xs text-gray-400 italic">No specifications added.</p>}
                        </div>
                      </div>

                      <button type="submit" disabled={saving || !mainImage} className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black shadow-xl shadow-gray-900/20 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:scale-100">
                        {saving ? 'Saving Product...' : 'ðŸ’¾ SAVE PRODUCT'}
                      </button>
                    </form>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filteredProducts.map(p => (
                    <div key={p.id} className="bg-white rounded-3xl p-4 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-gray-100 group">
                      <div className="relative aspect-[4/3] bg-gray-50 rounded-2xl overflow-hidden mb-4">
                        {p.image_url ? (
                          <img src={p.image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 mix-blend-multiply" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-3xl opacity-20">ðŸ“¦</div>
                        )}
                        <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => loadProductForEdit(p)} className="w-8 h-8 bg-white/90 backdrop-blur text-blue-500 rounded-full flex items-center justify-center shadow-sm hover:bg-blue-50">âœï¸</button>
                          <button onClick={() => deleteProduct(p.id)} className="w-8 h-8 bg-white/90 backdrop-blur text-red-500 rounded-full flex items-center justify-center shadow-sm hover:bg-red-50">ðŸ—‘ï¸</button>
                        </div>
                      </div>
                      <h4 className="font-bold text-gray-900 truncate mb-1">{p.name}</h4>
                      <p className="text-gray-400 text-xs mb-3">
                        {p.brand || 'No Brand'}{typeof p.quantity === 'number' ? ` â€¢ ${p.quantity} in stock` : ''}
                      </p>
                      <div className="flex justify-between items-center">
                        <span className="text-xl font-black text-gray-900">â‚±{p.price.toFixed(2)}</span>
                        <button onClick={() => { setTrainingProduct(p); trainingFileRef.current?.click(); }}
                          className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors">
                          ðŸŽ¯ Train AI
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* CATEGORIES TAB */}
          {activeTab === 'categories' && (
            <div className="max-w-4xl mx-auto animate-fade-in">
              <div className="bg-white rounded-3xl p-8 mb-8 shadow-xl shadow-gray-100/50 border border-gray-100">
                <h3 className="text-2xl font-black text-gray-900 mb-6">Create Category</h3>
                <div className="flex gap-4 items-center">
                  <input type="text" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="New Category Name"
                    className="flex-1 px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-gray-900 font-bold focus:outline-none focus:ring-2 focus:ring-black/5 transition-all" />
                  <div className="w-px h-10 bg-gray-200"></div>
                  <select value={parentCategoryId} onChange={e => setParentCategoryId(e.target.value)}
                    className="px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-gray-600 font-medium focus:outline-none focus:ring-2 focus:ring-black/5 transition-all">
                    <option value="">Top Level Category</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <button onClick={createCategory} className="px-8 py-4 bg-gray-900 text-white rounded-2xl font-bold shadow-lg shadow-gray-900/10 hover:shadow-gray-900/20 active:scale-95 transition-all">Create</button>
                </div>
              </div>

              <div className="bg-white rounded-3xl p-8 shadow-xl shadow-gray-100/50 border border-gray-100">
                <h3 className="text-Gray-900 font-bold mb-6 text-sm uppercase tracking-wider">Category Structure</h3>
                {categoryTree.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">No categories found</div>
                ) : (
                  <div className="space-y-2">
                    {categoryTree.map(cat => <CategoryTreeItem key={cat.id} cat={cat} onDelete={deleteCategory} products={products} />)}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SEARCH TAB */}
          {activeTab === 'search' && (
            <div className="max-w-4xl mx-auto animate-fade-in">
              <div className="bg-white rounded-3xl p-8 mb-8 shadow-xl shadow-gray-100/50 border border-gray-100 text-center">
                <h3 className="text-2xl font-black text-gray-900 mb-6">Inventory Search</h3>
                <div className="flex gap-4 mb-8">
                  <div className="flex-1 relative">
                    <span className="absolute left-4 top-4 text-gray-400">ðŸ”</span>
                    <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search by name, brand, desc..."
                      className="w-full pl-10 pr-4 py-4 bg-gray-50 border-none rounded-2xl text-gray-900 font-bold placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all" />
                  </div>
                  <button onClick={handleSearch} className="px-8 bg-gray-900 text-white rounded-2xl font-bold shadow-lg shadow-gray-900/10 hover:scale-105 transition-all">Search</button>
                </div>

                <div className="inline-flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <span className="text-gray-400 font-medium text-sm text-gray-500">or use AI vision</span>
                  <label className="px-4 py-2 bg-white border border-gray-200 shadow-sm text-gray-700 rounded-xl cursor-pointer hover:bg-gray-50 font-bold text-sm transition-all flex items-center gap-2">
                    ðŸ“· Scan Product
                    <input type="file" accept="image/*" onChange={handleScanFile} ref={scanFileRef} className="hidden" />
                  </label>
                  {scanning && <span className="text-orange-500 font-bold animate-pulse">Scanning...</span>}
                </div>
              </div>

              {searchResults.length > 0 && (
                <div className="grid grid-cols-1 gap-3">
                  <p className="text-gray-400 font-medium mb-2 pl-2">Found {searchResults.length} items</p>
                  {searchResults.map(p => (
                    <div key={p.id} className="bg-white rounded-2xl p-4 flex items-center gap-4 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                      {p.image_url && <img src={p.image_url} className="w-16 h-16 object-cover rounded-xl bg-gray-50" />}
                      <div className="flex-1">
                        <h5 className="text-gray-900 font-bold">{p.name}</h5>
                        {p.brand && <p className="text-gray-400 text-xs font-medium">{p.brand}</p>}
                      </div>
                      <div className="text-right">
                        <div className="text-gray-900 font-black">â‚±{p.price.toFixed(2)}</div>
                        <button onClick={() => { setTrainingProduct(p); trainingFileRef.current?.click(); }}
                          className="mt-1 px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors">
                          ðŸŽ¯ Train
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* USERS TAB */}
          {activeTab === 'users' && (
            <div className="max-w-5xl mx-auto animate-fade-in">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white rounded-3xl p-8 shadow-xl shadow-gray-100/50 border border-gray-100">
                  <div className="flex items-start justify-between gap-3 mb-6">
                    <div>
                      <h3 className="text-2xl font-black text-gray-900">User Access</h3>
                      <p className="text-gray-500 text-sm">Generate single-use codes for staff.</p>
                    </div>
                    <span className="text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-600 font-semibold">
                      {staffForStore.length} users
                    </span>
                  </div>

                  <label className="block text-sm font-semibold text-gray-700 mb-2">Store</label>
                  <select
                    value={selectedStaffStoreId}
                    onChange={(e) => setSelectedStaffStoreId(e.target.value)}
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 shadow-sm bg-gray-50 text-sm font-semibold text-gray-700 focus:border-gray-900 focus:ring-gray-900/10"
                    disabled={!stores.length}
                  >
                    <option value="">Select a store</option>
                    {stores.map((store) => (
                      <option key={store.id} value={store.id}>{store.name}</option>
                    ))}
                  </select>

                  <div className="mt-5 rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-5">
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Single-use code (10 minutes)</p>
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-3xl font-mono font-black tracking-[0.24em] text-gray-900">
                        {staffCodeLoading ? '••••••' : staffCode || '------'}
                      </span>
                      <div className="text-right">
                        <p className={`text-xs font-bold ${staffCodeStatus === 'expired' ? 'text-rose-500' : 'text-emerald-600'}`}>
                          {staffCodeStatus || 'ready'}
                        </p>
                        {staffCodeCountdown && (
                          <p className="text-[11px] text-gray-500">expires in {staffCodeCountdown}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <button
                        type="button"
                        onClick={() => copyValue(staffCode)}
                        disabled={!staffCode || staffCodeLoading}
                        className="flex-1 rounded-xl bg-white border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-100 disabled:opacity-50"
                      >
                        Copy code
                      </button>
                      <button
                        type="button"
                        onClick={() => renewStaffCode()}
                        disabled={!selectedStaffStoreId || staffCodeLoading}
                        className="flex-1 rounded-xl bg-gray-900 text-white px-4 py-2 text-sm font-bold shadow-lg shadow-gray-900/10 hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50"
                      >
                        New code
                      </button>
                    </div>
                    <p className="mt-3 text-xs text-gray-500">
                      Share this code and store ID. Each code can be used once by a teammate.
                    </p>
                    {selectedStaffStoreId && (
                      <p className="mt-2 text-[11px] font-mono text-gray-600 bg-white border border-gray-200 rounded-lg px-3 py-2 break-all">
                        Store ID: {selectedStaffStoreId}
                      </p>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-3xl p-8 shadow-xl shadow-gray-100/50 border border-gray-100 lg:col-span-2">
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <div>
                      <h3 className="text-2xl font-black text-gray-900">Team Directory</h3>
                      <p className="text-gray-500 text-sm">View who has access and adjust roles.</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => fetchStaff()}
                        className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50"
                      >
                        Refresh
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mb-4 text-sm text-gray-500">
                    <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 font-semibold">
                      {staffForStore.length} {selectedStaffStoreId ? 'for this store' : 'total'}
                    </span>
                    <span>Admins can edit roles; removing a user revokes access immediately.</span>
                  </div>

                  {staffLoading ? (
                    <div className="space-y-3">
                      <div className="h-3 w-2/3 bg-gray-100 rounded-full animate-pulse" />
                      <div className="h-3 w-1/2 bg-gray-100 rounded-full animate-pulse" />
                      <div className="h-3 w-3/4 bg-gray-100 rounded-full animate-pulse" />
                    </div>
                  ) : staffForStore.length === 0 ? (
                    <div className="p-6 rounded-2xl bg-gray-50 border border-dashed border-gray-200 text-center text-gray-500">
                      No users yet. Generate a code to invite your first teammate.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {staffForStore.map(member => (
                        <div key={member.id} className="p-4 rounded-2xl border border-gray-100 bg-gray-50/60 flex flex-col sm:flex-row sm:items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#E0F2FE] to-[#D4F5E9] flex items-center justify-center text-blue-700 font-black text-lg">
                            {(member.name || member.email || 'U').slice(0, 1).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-gray-900 truncate">{member.name || member.email || 'Unnamed user'}</span>
                              {member.email && <span className="text-xs text-gray-500 truncate">{member.email}</span>}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Store: {member.store_name || 'Unassigned'}</p>
                            <p className="text-[11px] text-gray-400">Added {new Date(member.created_at).toLocaleString()}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <select
                              value={member.role || 'staff'}
                              onChange={(e) => updateStaffRole(member.id, e.target.value)}
                              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 focus:border-gray-900 focus:ring-gray-900/10"
                            >
                              <option value="staff">Staff</option>
                              <option value="admin">Admin</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => removeStaffMember(member.id)}
                              className="rounded-xl px-3 py-2 text-sm font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-100"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STORES TAB */}
          {activeTab === 'stores' && (
            <div className="max-w-4xl mx-auto animate-fade-in">
              <div className="bg-white rounded-3xl p-8 shadow-xl shadow-gray-100/50 border border-gray-100 mb-8">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-2xl font-black text-gray-900">Manage Stores</h3>
                    <p className="text-gray-500 text-sm">Rename your store, copy its ID, or share a public link.</p>
                  </div>
                  <span className="text-sm text-gray-500">{stores.length} total</span>
                </div>
                <form onSubmit={saveStore} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div className="md:col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Store</label>
                    <div className="w-full rounded-2xl border border-gray-200 px-4 py-4 shadow-sm bg-gray-50">
                      <p className="text-sm font-semibold text-gray-900">{activeStore?.name || 'No store found'}</p>
                      <p className="text-xs text-gray-500 break-all mt-1">{activeStore?.id || 'Create a store to begin'}</p>
                      {activeStore?.slug && (
                        <p className="text-xs text-gray-500 break-all mt-1">/store/{activeStore.slug}</p>
                      )}
                      {storeShareLink && (
                        <p className="text-xs text-gray-400 break-all mt-1">{storeShareLink}</p>
                      )}
                    </div>
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">New name</label>
                    <input
                      type="text"
                      value={storeEditName}
                      onChange={(e) => setStoreEditName(e.target.value)}
                      className="w-full rounded-2xl border border-gray-200 px-4 py-3 shadow-sm focus:border-gray-900 focus:ring-gray-900/10"
                      placeholder="Enter new store name"
                    />
                  </div>
                  <div className="md:col-span-1 flex gap-3">
                    <button
                      type="submit"
                      disabled={storeSaving}
                      className="inline-flex items-center justify-center rounded-2xl bg-gray-900 px-5 py-3 text-white font-bold shadow-lg shadow-gray-900/15 hover:scale-105 active:scale-95 transition-all disabled:opacity-60"
                    >
                      {storeSaving ? 'Saving...' : 'Rename Store'}
                    </button>
                    <button
                      type="button"
                      onClick={() => copyValue(storeEditId)}
                      disabled={!storeEditId}
                      className="inline-flex items-center justify-center rounded-2xl bg-gray-100 px-4 py-3 text-gray-800 font-semibold border border-gray-200 hover:bg-gray-200 disabled:opacity-50"
                    >
                      Copy ID
                    </button>
                    <button
                      type="button"
                      onClick={() => copyValue(storeShareLink)}
                      disabled={!storeShareLink}
                      className="inline-flex items-center justify-center rounded-2xl bg-blue-50 px-4 py-3 text-blue-700 font-semibold border border-blue-100 hover:bg-blue-100 disabled:opacity-50"
                    >
                      Copy link
                    </button>
                  </div>
                </form>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {stores.map((store) => (
                  <div key={store.id} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-lg font-bold text-gray-900">{store.name}</h4>
                        <p className="text-xs text-gray-500 break-all mt-1">{store.id}</p>
                      </div>
                      <button
                        className="text-sm text-gray-600 underline"
                        onClick={() => {
                          setStoreEditId(store.id);
                          setStoreEditName(store.name);
                          setCurrentStoreId(store.id);
                        }}
                      >
                        Edit
                      </button>
                    </div>
                    {store.created_at && (
                      <p className="text-xs text-gray-400 mt-2">Created {new Date(store.created_at).toLocaleDateString()}</p>
                    )}
                  </div>
                ))}
                {stores.length === 0 && (
                  <div className="bg-white rounded-2xl p-6 text-center border border-dashed border-gray-200 text-gray-500">
                    No stores found. Create one from the organizer console.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ANALYTICS TAB */}
          {activeTab === 'analytics' && (
            <div className="max-w-5xl mx-auto animate-fade-in">
              {products.length > 0 && (
                <div className="flex items-center justify-end mb-4">
                  <label className="text-sm text-gray-500 mr-2">Filter by category:</label>
                  <select
                    value={analyticsCategory}
                    onChange={(e) => setAnalyticsCategory(e.target.value)}
                    className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700"
                  >
                    <option value="">All</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-white rounded-3xl p-6 shadow-xl shadow-gray-100 border border-gray-100 text-center">
                  <div className="text-4xl mb-2">ðŸ“¦</div>
                  <div className="text-3xl font-black text-gray-900">{products.length}</div>
                  <div className="text-gray-400 text-sm font-medium">Total Products</div>
                </div>
                <div className="bg-white rounded-3xl p-6 shadow-xl shadow-gray-100 border border-gray-100 text-center">
                  <div className="text-4xl mb-2">ðŸ‘ï¸</div>
                  <div className="text-3xl font-black text-gray-900">{products.reduce((sum, p) => sum + (Number(p.scan_count) || 0), 0)}</div>
                  <div className="text-gray-400 text-sm font-medium">Total Scans</div>
                </div>
                <div className="bg-white rounded-3xl p-6 shadow-xl shadow-gray-100 border border-gray-100 text-center">
                  <div className="text-4xl mb-2">ðŸ“</div>
                  <div className="text-3xl font-black text-gray-900">{categories.length}</div>
                  <div className="text-gray-400 text-sm font-medium">Categories</div>
                </div>
                <div className="bg-white rounded-3xl p-6 shadow-xl shadow-gray-100 border border-gray-100 text-center">
                  <div className="text-4xl mb-2">ðŸ’°</div>
                  <div className="text-3xl font-black text-gray-900">â‚±{products.reduce((sum, p) => sum + (p.price * (p.quantity || 0)), 0).toLocaleString()}</div>
                  <div className="text-gray-400 text-sm font-medium">Inventory Value</div>
                </div>
              </div>

              {/* Top Products */}
              <div className="bg-white rounded-3xl p-8 shadow-xl shadow-gray-100 border border-gray-100">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-black text-gray-900">ðŸ”¥ Most Viewed Products</h3>
                  <span className="text-gray-400 text-sm font-medium">Sorted by scan count</span>
                </div>

                <div className="space-y-4">
                  {([...products]
                    .filter(p => !analyticsCategory || p.category_id === analyticsCategory)
                    .sort((a, b) => (Number(b.scan_count) || 0) - (Number(a.scan_count) || 0))
                    .slice(0, 10)).map((p, idx) => (
                      <div key={p.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-gray-100 transition-colors">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${idx < 3 ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
                          {idx + 1}
                        </div>
                        <div className="w-14 h-14 bg-white rounded-xl overflow-hidden border border-gray-100">
                          {p.image_url ? (
                            <img src={p.image_url} alt="" className="w-full h-full object-cover mix-blend-multiply" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-2xl opacity-30">ðŸ“¦</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-gray-900 truncate">{p.name}</h4>
                          <p className="text-gray-400 text-xs">{p.brand || 'No Brand'} â€¢ â‚±{p.price.toFixed(2)}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-black text-gray-900">{Number(p.scan_count) || 0}</div>
                          <div className="text-xs text-gray-400">scans</div>
                        </div>
                      </div>
                    ))}

                  {products.length === 0 && (
                    <div className="text-center py-12 text-gray-400">
                      <div className="text-4xl mb-4 opacity-30">ðŸ“Š</div>
                      <p>No product data yet</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Hidden training file input */}
          <input type="file" accept="image/*" ref={trainingFileRef} onChange={handleTrainingPhoto} className="hidden" />
        </main>

        <style jsx global>{`
           .custom-scrollbar::-webkit-scrollbar { width: 4px; }
           .custom-scrollbar::-webkit-scrollbar-track { bg: transparent; }
           .custom-scrollbar::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 4px; }
           
           @keyframes fade-in-up {
             0% { opacity: 0; transform: translateY(10px); }
             100% { opacity: 1; transform: translateY(0); }
           }
           .animate-fade-in-up { animation: fade-in-up 0.5s ease-out; }

           @keyframes slide-down {
             0% { opacity: 0; transform: translateY(-20px); }
             100% { opacity: 1; transform: translateY(0); }
           }
           .animate-slide-down { animation: slide-down 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
           
           @keyframes bounce-in {
             0% { opacity: 0; transform: scale(0.9); }
             70% { transform: scale(1.02); }
             100% { opacity: 1; transform: scale(1); }
           }
           .animate-bounce-in { animation: bounce-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        `}</style>
      </div>
    </div>
  );
}

// Category sidebar item
function CategoryItem({ cat, selected, onSelect, products, depth = 0 }: {
  cat: Category; selected: string | null; onSelect: (id: string) => void; products: Product[]; depth?: number
}) {
  const count = products.filter(p => p.category_id === cat.id).length;
  // Don't show empty categories in sidebar if deeply nested to keep UI clean, unless selected
  return (
    <>
      <button onClick={() => onSelect(cat.id)}
        className={`w-full text-left px-4 py-2 rounded-xl mb-1 text-sm font-medium transition-all flex justify-between items-center group
          ${selected === cat.id ? 'bg-orange-50 text-orange-700 shadow-sm border border-orange-100' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 border border-transparent'}`}
        style={{ paddingLeft: `${16 + depth * 12}px` }}>
        <span className="truncate">{cat.name}</span>
        {count > 0 && <span className={`text-xs px-2 py-0.5 rounded-full ${selected === cat.id ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-400 group-hover:bg-gray-200'}`}>{count}</span>}
      </button>
      {cat.children?.map(child => (
        <CategoryItem key={child.id} cat={child} selected={selected} onSelect={onSelect} products={products} depth={depth + 1} />
      ))}
    </>
  );
}

// Category tree item for management
function CategoryTreeItem({ cat, onDelete, products, depth = 0 }: {
  cat: Category; onDelete: (id: string) => void; products: Product[]; depth?: number
}) {
  const count = products.filter(p => p.category_id === cat.id).length;
  return (
    <div style={{ marginLeft: `${depth * 28}px` }} className="animate-fade-in relative">
      {depth > 0 && <div className="absolute -left-4 top-0 bottom-0 w-px bg-gray-100"></div>}
      {depth > 0 && <div className="absolute -left-4 top-1/2 w-4 h-px bg-gray-100"></div>}

      <div className="flex items-center justify-between py-3 px-4 mb-2 bg-gray-50 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors group">
        <span className="text-gray-700 font-bold flex items-center gap-2">
          <span className="text-lg opacity-50">ðŸ“</span> {cat.name}
          <span className="text-gray-400 text-xs font-normal bg-white px-2 py-0.5 rounded-md border border-gray-100">{count} items</span>
        </span>
        <button onClick={() => onDelete(cat.id)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100">ðŸ—‘ï¸</button>
      </div>
      {cat.children?.map(child => (
        <CategoryTreeItem key={child.id} cat={child} onDelete={onDelete} products={products} depth={depth + 1} />
      ))}
    </div>
  );
}


