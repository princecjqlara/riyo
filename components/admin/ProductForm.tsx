'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import MultiImageUpload from './MultiImageUpload';
import type { Item } from '@/types';

const productSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  price: z.number().positive('Price must be positive'),
  description: z.string().optional(),
  category: z.string().optional(),
  barcode: z.string().optional(),
  sku: z.string().optional(),
  brand: z.string().optional(),
  model_number: z.string().optional(),
  distinguishing_features: z.array(z.string()).optional(),
  min_confidence: z.number().min(0).max(1).optional(),
});

type ProductFormData = z.infer<typeof productSchema>;

interface ProductFormProps {
  product?: Item;
  onSuccess?: () => void;
}

export default function ProductForm({ product, onSuccess }: ProductFormProps) {
  const router = useRouter();
  const [images, setImages] = useState<Array<{ file: File; type: string; isPrimary: boolean }>>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: product ? {
      name: product.name,
      price: product.price,
      description: product.description || '',
      category: product.category || '',
      barcode: product.barcode || '',
      sku: product.sku || '',
      brand: product.brand || '',
      model_number: product.model_number || '',
      distinguishing_features: product.distinguishing_features || [],
      min_confidence: product.min_confidence || 0.7,
    } : {},
  });

  const onSubmit = async (data: ProductFormData) => {
    if (images.length === 0) {
      setError('Please upload at least one image');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Upload images
      const uploadedImages = await Promise.all(
        images.map(async (img) => {
          const formData = new FormData();
          formData.append('file', img.file);

          const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) throw new Error('Failed to upload image');

          const { url } = await response.json();
          return { url, type: img.type, isPrimary: img.isPrimary };
        })
      );

      // Create or update product
      const productData = {
        ...data,
        image_url: uploadedImages.find(img => img.isPrimary)?.url || uploadedImages[0].url,
      };

      const response = await fetch(
        product ? `/api/products/${product.id}` : '/api/products',
        {
          method: product ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(productData),
        }
      );

      if (!response.ok) throw new Error('Failed to save product');

      const result = await response.json();

      // Upload product images with embeddings
      const imageResults = await Promise.all(
        uploadedImages.map(async (img, idx) => {
          const imgFormData = new FormData();
          imgFormData.append('file', images[idx].file);
          imgFormData.append('item_id', result.id);
          imgFormData.append('image_type', img.type);
          imgFormData.append('is_primary', img.isPrimary.toString());

          const imgResponse = await fetch('/api/products/images', {
            method: 'POST',
            body: imgFormData,
          });

          if (!imgResponse.ok) throw new Error('Failed to upload image');

          const imgData = await imgResponse.json();

          // Generate and save embedding
          try {
            const { generateEmbeddingFromFile } = await import('@/lib/embeddings');
            const embedding = await generateEmbeddingFromFile(images[idx].file);

            await fetch(`/api/products/images/${imgData.id}/embedding`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ embedding }),
            });
          } catch (embeddingError) {
            console.error('Error generating embedding:', embeddingError);
            // Continue without embedding
          }

          return imgData;
        })
      );

      if (onSuccess) {
        onSuccess();
      } else {
        router.push('/admin/products');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save product');
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          Product Name *
        </label>
        <input
          {...register('name')}
          type="text"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="price" className="block text-sm font-medium text-gray-700">
            Price *
          </label>
          <input
            {...register('price', { valueAsNumber: true })}
            type="number"
            step="0.01"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
          {errors.price && (
            <p className="mt-1 text-sm text-red-600">{errors.price.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700">
            Category
          </label>
          <input
            {...register('category')}
            type="text"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          {...register('description')}
          rows={3}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="brand" className="block text-sm font-medium text-gray-700">
            Brand
          </label>
          <input
            {...register('brand')}
            type="text"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>

        <div>
          <label htmlFor="sku" className="block text-sm font-medium text-gray-700">
            SKU
          </label>
          <input
            {...register('sku')}
            type="text"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="barcode" className="block text-sm font-medium text-gray-700">
            Barcode
          </label>
          <input
            {...register('barcode')}
            type="text"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>

        <div>
          <label htmlFor="model_number" className="block text-sm font-medium text-gray-700">
            Model Number
          </label>
          <input
            {...register('model_number')}
            type="text"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>
      </div>

      <div>
        <label htmlFor="min_confidence" className="block text-sm font-medium text-gray-700">
          Minimum Confidence (0-1)
        </label>
        <input
          {...register('min_confidence', { valueAsNumber: true })}
          type="number"
          step="0.01"
          min="0"
          max="1"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
        <p className="mt-1 text-xs text-gray-500">
          Higher values require stronger matches (default: 0.70)
        </p>
      </div>

      <MultiImageUpload
        images={images}
        onChange={setImages}
      />

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={uploading}
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {uploading ? 'Saving...' : product ? 'Update Product' : 'Create Product'}
        </button>
      </div>
    </form>
  );
}

