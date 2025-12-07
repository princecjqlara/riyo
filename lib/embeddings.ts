/**
 * Image embedding generation using TensorFlow.js MobileNet
 * Generates 1024-dimensional feature vectors for image similarity search
 * 
 * Note: This is a client-side implementation that runs in the browser
 * For server-side usage, consider using a different approach
 */
import type { LayersModel, Tensor } from '@tensorflow/tfjs';

let modelPromise: Promise<LayersModel> | null = null;

/**
 * Load TensorFlow.js MobileNet model for image feature extraction
 * The model is loaded lazily and cached for subsequent calls
 */
async function loadModel() {
  if (modelPromise) {
    return modelPromise;
  }

  modelPromise = (async () => {
    // Dynamic import to avoid SSR issues - only works client-side
    if (typeof window === 'undefined') {
      throw new Error('Embedding generation must run client-side. Consider using an API endpoint.');
    }

    const tf = await import('@tensorflow/tfjs');

    // Load MobileNet model for feature extraction
    // Using a simpler approach that works reliably
    const MODEL_URL = 'https://tfhub.dev/tensorflow/tfjs-model/mobilenet_v2_1.0_224/1/default/1';

    try {
      const model = await tf.loadLayersModel(MODEL_URL, { fromTFHub: true });
      return model;
    } catch (error) {
      console.error('Failed to load MobileNet model:', error);
      throw new Error('Failed to load embedding model. Please check your internet connection.');
    }
  })();

  return modelPromise;
}

/**
 * Preprocess image file for model input
 * Client-side only (requires browser environment)
 */
function preprocessImage(file: File): Promise<HTMLImageElement> {
  if (typeof window === 'undefined') {
    throw new Error('Image preprocessing requires browser environment');
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

/**
 * Convert HTMLImageElement to TensorFlow tensor
 */
async function imageToTensor(img: HTMLImageElement) {
  const tf = await import('@tensorflow/tfjs');
  // Resize image to 224x224 (MobileNet input size)
  return tf.browser.fromPixels(img)
    .resizeNearestNeighbor([224, 224])
    .expandDims(0)
    .toFloat()
    .div(tf.scalar(255.0));
}

/**
 * Generate embedding vector from image file
 * Returns a 1024-dimensional array suitable for vector similarity search
 * 
 * @param file - Image file to process
 * @returns Promise<number[]> - Embedding vector (1024 dimensions)
 */
export async function generateEmbeddingFromFile(file: File): Promise<number[]> {
  try {
    // Load model (cached after first load)
    const model = await loadModel();

    // Preprocess image
    const img = await preprocessImage(file);
    const tensor = await imageToTensor(img);

    // Generate features
    const features = model.predict(tensor) as Tensor;

    // Extract embedding as array
    const embedding = await features.data();

    // Dispose tensors to free memory
    tensor.dispose();
    features.dispose();

    // Normalize the embedding vector for better similarity comparisons
    const tf = await import('@tensorflow/tfjs');
    const embeddingTensor = tf.tensor1d(Array.from(embedding) as number[]);
    const norm = embeddingTensor.norm();
    const normalized = embeddingTensor.div(norm);
    const normalizedArray = Array.from(await normalized.data());

    embeddingTensor.dispose();
    norm.dispose();
    normalized.dispose();

    // Ensure we have 1024 dimensions (pad or truncate if needed)
    const targetLength = 1024;
    if (normalizedArray.length > targetLength) {
      return normalizedArray.slice(0, targetLength);
    } else if (normalizedArray.length < targetLength) {
      return [...normalizedArray, ...new Array(targetLength - normalizedArray.length).fill(0)];
    }

    return normalizedArray;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate embedding from base64 image string
 * Useful for client-side processing
 */
export async function generateEmbeddingFromBase64(base64: string): Promise<number[]> {
  // Convert base64 to blob
  const response = await fetch(base64);
  const blob = await response.blob();
  const file = new File([blob], 'image.jpg', { type: 'image/jpeg' });

  return generateEmbeddingFromFile(file);
}

