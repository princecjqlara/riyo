import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Navbar from '@/components/shared/Navbar';
import SearchCorrectionsQueue from '@/components/admin/SearchCorrectionsQueue';

// Force dynamic rendering to prevent build-time errors with Supabase
export const dynamic = 'force-dynamic';

export default function CorrectionsPage() {
  return (
    <ProtectedRoute requiredRole="admin">
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold text-gray-900">Search Corrections</h1>
            <p className="mt-2 text-gray-600">
              Review and correct search misidentifications to improve accuracy
            </p>
          </div>

          <SearchCorrectionsQueue />
        </main>
      </div>
    </ProtectedRoute>
  );
}

