'use client';

import Image from 'next/image';
import type { SearchResponse } from '@/types';

interface SearchResultsProps {
  results: SearchResponse;
}

export default function SearchResults({ results }: SearchResultsProps) {
  if (results.results.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
        <p className="text-sm text-yellow-800">
          No products found matching your image. Please try a different photo.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {results.warning && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <p className="text-sm text-blue-800">{results.warning}</p>
          {results.distinguishingFeatures && results.distinguishingFeatures.length > 0 && (
            <ul className="mt-2 list-disc list-inside text-sm text-blue-700">
              {results.distinguishingFeatures.map((feature, idx) => (
                <li key={idx}>{feature}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {results.results.map((result, idx) => (
          <div
            key={result.item.id}
            className="bg-white rounded-lg shadow-md p-6 border-2 border-gray-200"
          >
            <div className="flex flex-col md:flex-row gap-4">
              {result.images && result.images.length > 0 && (
                <div className="flex-shrink-0">
                  <Image
                    src={result.images[0].image_url}
                    alt={result.item.name}
                    width={200}
                    height={200}
                    className="rounded-lg object-cover"
                  />
                </div>
              )}
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">
                      {result.item.name}
                    </h3>
                    {result.item.brand && (
                      <p className="text-sm text-gray-500">Brand: {result.item.brand}</p>
                    )}
                    {result.item.category && (
                      <p className="text-sm text-gray-500">Category: {result.item.category}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-indigo-600">
                      ${result.item.price.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {Math.round(result.confidence * 100)}% match
                    </p>
                  </div>
                </div>
                
                {result.item.description && (
                  <p className="mt-2 text-sm text-gray-600">{result.item.description}</p>
                )}

                {result.item.distinguishing_features &&
                  result.item.distinguishing_features.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-gray-700">Features:</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {result.item.distinguishing_features.map((feature, fIdx) => (
                          <span
                            key={fIdx}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
                          >
                            {feature}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

