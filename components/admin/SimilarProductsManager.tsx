'use client';

import { useState, useEffect } from 'react';
import { useProducts } from '@/hooks/useProducts';
import type { Item, SimilarProduct } from '@/types';

export default function SimilarProductsManager() {
  const { products } = useProducts();
  const [similarProducts, setSimilarProducts] = useState<SimilarProduct[]>([]);
  const [selectedItem1, setSelectedItem1] = useState<string>('');
  const [selectedItem2, setSelectedItem2] = useState<string>('');
  const [distinguishingFeatures, setDistinguishingFeatures] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSimilarProducts();
  }, []);

  const fetchSimilarProducts = async () => {
    try {
      const response = await fetch('/api/similar-products');
      if (response.ok) {
        const data = await response.json();
        setSimilarProducts(data);
      }
    } catch (error) {
      console.error('Error fetching similar products:', error);
    }
  };

  const handleAdd = async () => {
    if (!selectedItem1 || !selectedItem2 || selectedItem1 === selectedItem2) {
      alert('Please select two different products');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/similar-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item1_id: selectedItem1,
          item2_id: selectedItem2,
          distinguishing_features: distinguishingFeatures,
        }),
      });

      if (!response.ok) throw new Error('Failed to add');

      setSelectedItem1('');
      setSelectedItem2('');
      setDistinguishingFeatures('');
      fetchSimilarProducts();
    } catch (error) {
      alert('Failed to add similar products');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this similar product relationship?')) return;

    try {
      const response = await fetch(`/api/similar-products/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete');

      fetchSimilarProducts();
    } catch (error) {
      alert('Failed to delete');
    }
  };

  const getProductName = (id: string) => {
    return products.find(p => p.id === id)?.name || 'Unknown';
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">Add Similar Products</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Product 1
            </label>
            <select
              value={selectedItem1}
              onChange={(e) => setSelectedItem1(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="">Select product...</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Product 2
            </label>
            <select
              value={selectedItem2}
              onChange={(e) => setSelectedItem2(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="">Select product...</option>
              {products
                .filter((p) => p.id !== selectedItem1)
                .map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
            </select>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Distinguishing Features
          </label>
          <textarea
            value={distinguishingFeatures}
            onChange={(e) => setDistinguishingFeatures(e.target.value)}
            rows={3}
            placeholder="e.g., Product A has red logo, Product B has blue logo"
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>

        <button
          onClick={handleAdd}
          disabled={loading}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? 'Adding...' : 'Add Similar Products'}
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">Similar Products List</h2>
        
        {similarProducts.length === 0 ? (
          <p className="text-gray-500">No similar products defined yet.</p>
        ) : (
          <div className="space-y-4">
            {similarProducts.map((sp) => (
              <div
                key={sp.id}
                className="border rounded-lg p-4 flex justify-between items-start"
              >
                <div className="flex-1">
                  <div className="flex items-center space-x-4">
                    <div>
                      <p className="font-medium">{getProductName(sp.item1_id)}</p>
                      <p className="text-sm text-gray-500">vs</p>
                      <p className="font-medium">{getProductName(sp.item2_id)}</p>
                    </div>
                    {sp.distinguishing_features && (
                      <div className="ml-4 pl-4 border-l">
                        <p className="text-sm text-gray-600">
                          {sp.distinguishing_features}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(sp.id)}
                  className="ml-4 text-red-600 hover:text-red-800"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

