export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          role: 'admin' | 'staff'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          role: 'admin' | 'staff'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          role?: 'admin' | 'staff'
          created_at?: string
          updated_at?: string
        }
      }
      items: {
        Row: {
          id: string
          name: string
          price: number
          description: string | null
          category: string | null
          image_url: string | null
          barcode: string | null
          sku: string | null
          brand: string | null
          model_number: string | null
          distinguishing_features: string[] | null
          min_confidence: number | null
          created_by: string | null
          created_at: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          name: string
          price: number
          description?: string | null
          category?: string | null
          image_url?: string | null
          barcode?: string | null
          sku?: string | null
          brand?: string | null
          model_number?: string | null
          distinguishing_features?: string[] | null
          min_confidence?: number | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          name?: string
          price?: number
          description?: string | null
          category?: string | null
          image_url?: string | null
          barcode?: string | null
          sku?: string | null
          brand?: string | null
          model_number?: string | null
          distinguishing_features?: string[] | null
          min_confidence?: number | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          updated_by?: string | null
        }
      }
      product_images: {
        Row: {
          id: string
          item_id: string
          image_url: string
          image_type: 'front' | 'back' | 'side' | 'detail' | 'label' | 'barcode' | null
          embedding: number[] | null
          is_primary: boolean
          created_at: string
        }
        Insert: {
          id?: string
          item_id: string
          image_url: string
          image_type?: 'front' | 'back' | 'side' | 'detail' | 'label' | 'barcode' | null
          embedding?: number[] | null
          is_primary?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          item_id?: string
          image_url?: string
          image_type?: 'front' | 'back' | 'side' | 'detail' | 'label' | 'barcode' | null
          embedding?: number[] | null
          is_primary?: boolean
          created_at?: string
        }
      }
      similar_products: {
        Row: {
          id: string
          item1_id: string
          item2_id: string
          similarity_score: number | null
          distinguishing_features: string | null
          created_at: string
        }
        Insert: {
          id?: string
          item1_id: string
          item2_id: string
          similarity_score?: number | null
          distinguishing_features?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          item1_id?: string
          item2_id?: string
          similarity_score?: number | null
          distinguishing_features?: string | null
          created_at?: string
        }
      }
      search_corrections: {
        Row: {
          id: string
          user_image_url: string
          predicted_item_id: string
          correct_item_id: string
          confidence_score: number
          correction_reason: string | null
          corrected_by: string
          created_at: string
          status: 'pending' | 'reviewed' | 'used_for_training'
        }
        Insert: {
          id?: string
          user_image_url: string
          predicted_item_id: string
          correct_item_id: string
          confidence_score: number
          correction_reason?: string | null
          corrected_by: string
          created_at?: string
          status?: 'pending' | 'reviewed' | 'used_for_training'
        }
        Update: {
          id?: string
          user_image_url?: string
          predicted_item_id?: string
          correct_item_id?: string
          confidence_score?: number
          correction_reason?: string | null
          corrected_by?: string
          created_at?: string
          status?: 'pending' | 'reviewed' | 'used_for_training'
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

