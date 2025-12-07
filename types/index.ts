export type UserRole = 'organizer' | 'admin' | 'staff';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Store {
  id: string;
  name: string;
  organizer_id: string;
  slug: string;
  cover_url?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  created_at: string;
}

export interface StoreAdminInvite {
  id: string;
  store_id: string;
  email: string;
  status: 'pending' | 'sent' | 'accepted' | 'failed';
  invite_token: string;
  invited_by: string;
  created_at: string;
}

export interface BrandingSettings {
  id: string;
  title: string;
  subtitle: string;
  updated_at?: string;
  updated_by?: string;
}

export interface Item {
  id: string;
  store_id?: string | null;
  name: string;
  price: number;
  description: string | null;
  category: string | null;
  image_url: string | null;
  barcode: string | null;
  sku: string | null;
  brand: string | null;
  model_number: string | null;
  distinguishing_features: string[] | null;
  min_confidence: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

export interface ProductImage {
  id: string;
  item_id: string;
  image_url: string;
  store_id?: string | null;
  image_type: 'front' | 'back' | 'side' | 'detail' | 'label' | 'barcode' | null;
  embedding: number[] | null;
  is_primary: boolean;
  created_at: string;
}

export interface SimilarProduct {
  id: string;
  store_id?: string | null;
  item1_id: string;
  item2_id: string;
  similarity_score: number | null;
  distinguishing_features: string | null;
  created_at: string;
}

export interface SearchCorrection {
  id: string;
  store_id?: string | null;
  user_image_url: string;
  predicted_item_id: string;
  correct_item_id: string;
  confidence_score: number;
  correction_reason: string | null;
  corrected_by: string;
  created_at: string;
  status: 'pending' | 'reviewed' | 'used_for_training';
}

export interface SearchResult {
  item: Item;
  confidence: number;
  images?: ProductImage[];
}

export interface SearchResponse {
  results: SearchResult[];
  warning?: string;
  distinguishingFeatures?: string[];
  error?: string;
}

