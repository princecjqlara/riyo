import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Navbar from '@/components/shared/Navbar';
import ProductForm from '@/components/admin/ProductForm';

export default function AddProductPage() {
  return (
    <ProtectedRoute requiredRole={['admin', 'staff']}>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold text-gray-900">Add Product</h1>
            <p className="mt-2 text-gray-600">Add a new product to your inventory</p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <ProductForm />
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}

