'use client';

import { useState, useEffect } from 'react';
import { useProducts } from '@/hooks/useProducts';
import type { SearchCorrection, Item } from '@/types';

export default function SearchCorrectionsQueue() {
  const { products } = useProducts();
  const [corrections, setCorrections] = useState<SearchCorrection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCorrections();
  }, []);

  const fetchCorrections = async () => {
    try {
      const response = await fetch('/api/corrections?status=pending');
      if (response.ok) {
        const data = await response.json();
        setCorrections(data);
      }
    } catch (error) {
      console.error('Error fetching corrections:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (id: string, correctItemId: string) => {
    try {
      const response = await fetch(`/api/corrections/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          correct_item_id: correctItemId,
          status: 'reviewed',
        }),
      });

      if (!response.ok) throw new Error('Failed to update');

      fetchCorrections();
    } catch (error) {
      alert('Failed to update correction');
    }
  };

  const getProductName = (id: string) => {
    return products.find(p => p.id === id)?.name || 'Unknown';
  };

  if (loading) {
    return <div className="text-center py-8">Loading corrections...</div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">
        Pending Corrections ({corrections.length})
      </h2>

      {corrections.length === 0 ? (
        <p className="text-gray-500">No pending corrections.</p>
      ) : (
        <div className="space-y-4">
          {corrections.map((correction) => (
            <div
              key={correction.id}
              className="bg-white rounded-lg shadow-md p-6 border-2 border-gray-200"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-500">Predicted Product</p>
                  <p className="font-medium">
                    {getProductName(correction.predicted_item_id)}
                  </p>
                  <p className="text-xs text-gray-400">
                    Confidence: {Math.round(correction.confidence_score * 100)}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Correct Product</p>
                  <select
                    onChange={(e) => handleReview(correction.id, e.target.value)}
                    className="w-full mt-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    defaultValue={correction.correct_item_id}
                  >
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {correction.user_image_url && (
                <div className="mb-4">
                  <img
                    src={correction.user_image_url}
                    alt="User image"
                    className="max-w-xs rounded-lg"
                  />
                </div>
              )}

              {correction.correction_reason && (
                <p className="text-sm text-gray-600 mb-4">
                  Reason: {correction.correction_reason}
                </p>
              )}

              <button
                onClick={() => handleReview(correction.id, correction.correct_item_id)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Mark as Reviewed
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

