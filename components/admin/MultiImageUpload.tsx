'use client';

import { useState, useRef } from 'react';

interface ImageData {
  file: File;
  type: string;
  isPrimary: boolean;
}

interface MultiImageUploadProps {
  images: ImageData[];
  onChange: (images: ImageData[]) => void;
}

const imageTypes = [
  { value: 'front', label: 'Front View' },
  { value: 'back', label: 'Back View' },
  { value: 'side', label: 'Side View' },
  { value: 'detail', label: 'Detail/Close-up' },
  { value: 'label', label: 'Label' },
  { value: 'barcode', label: 'Barcode' },
];

export default function MultiImageUpload({ images, onChange }: MultiImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const newImage: ImageData = {
        file,
        type: 'front',
        isPrimary: images.length === 0, // First image is primary by default
      };
      onChange([...images, newImage]);
    }
  };

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    // If we removed the primary image, make the first one primary
    if (newImages.length > 0 && images[index].isPrimary) {
      newImages[0].isPrimary = true;
    }
    onChange(newImages);
  };

  const updateImageType = (index: number, type: string) => {
    const newImages = [...images];
    newImages[index].type = type;
    onChange(newImages);
  };

  const setPrimary = (index: number) => {
    const newImages = images.map((img, i) => ({
      ...img,
      isPrimary: i === index,
    }));
    onChange(newImages);
  };

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-gray-700">
        Product Images *
      </label>
      
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {images.map((image, index) => (
          <div key={index} className="relative border rounded-lg p-2">
            <img
              src={URL.createObjectURL(image.file)}
              alt={`Preview ${index + 1}`}
              className="w-full h-32 object-cover rounded"
            />
            {image.isPrimary && (
              <span className="absolute top-2 left-2 bg-indigo-600 text-white text-xs px-2 py-1 rounded">
                Primary
              </span>
            )}
            <button
              type="button"
              onClick={() => removeImage(index)}
              className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="mt-2 space-y-2">
              <select
                value={image.type}
                onChange={(e) => updateImageType(index, e.target.value)}
                className="block w-full text-xs rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              >
                {imageTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              {!image.isPrimary && (
                <button
                  type="button"
                  onClick={() => setPrimary(index)}
                  className="w-full text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
                >
                  Set Primary
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-indigo-500 hover:bg-indigo-50 transition-colors"
      >
        <svg
          className="mx-auto h-8 w-8 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
        <p className="mt-2 text-sm text-gray-600">Add Image</p>
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}

