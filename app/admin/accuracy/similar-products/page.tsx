import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Navbar from '@/components/shared/Navbar';
import SimilarProductsManager from '@/components/admin/SimilarProductsManager';

export default function SimilarProductsPage() {
  return (
    <ProtectedRoute requiredRole="admin">
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold text-gray-900">Similar Products Manager</h1>
            <p className="mt-2 text-gray-600">
              Mark products as similar and define what makes them different
            </p>
          </div>

          <SimilarProductsManager />
        </main>
      </div>
    </ProtectedRoute>
  );
}

