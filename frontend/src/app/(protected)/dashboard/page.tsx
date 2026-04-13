'use client';

/**
 * Protected dashboard — route protection handled by middleware.ts.
 * This page is only reachable if the middleware confirmed a valid session.
 */
import { useState, useEffect } from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react';
import apiClient from '@/lib/api-client';

interface Item {
  id: number;
  name: string;
  description: string;
}

export default function Dashboard() {
  const { user, signOut } = useAuthenticator((ctx) => [ctx.user]);

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient.get<Item[]>('/api/v1/items')
      .then((res) => setItems(res.data))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {user.signInDetails?.loginId}
            </span>
            <button
              onClick={signOut}
              className="text-sm bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Auth status banner */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-800 text-sm font-medium">
            Authenticated via Amazon Cognito
          </p>
          <p className="text-green-700 text-xs mt-1">
            Access token is attached automatically to every API request.
            Amplify refreshes it when it expires.
          </p>
        </div>

        {/* Protected data from FastAPI */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Items from FastAPI Backend
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            GET /api/v1/items — JWT validated by API Gateway, not FastAPI
          </p>

          {loading && (
            <p className="text-gray-500 text-sm">Loading...</p>
          )}

          {error && (
            <p className="text-red-600 text-sm">Error: {error}</p>
          )}

          {!loading && !error && (
            <ul className="divide-y divide-gray-100">
              {items.map((item) => (
                <li key={item.id} className="py-3">
                  <p className="font-medium text-gray-900">{item.name}</p>
                  <p className="text-sm text-gray-500">{item.description}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Architecture note */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-800 text-sm font-semibold mb-2">
            Architecture
          </p>
          <ul className="text-blue-700 text-xs space-y-1 list-disc list-inside">
            <li>Cognito issues access tokens (JWT)</li>
            <li>API Gateway validates the JWT — Lambda never sees invalid tokens</li>
            <li>FastAPI is stateless — no sessions, no auth endpoints</li>
            <li>Amplify refreshes tokens transparently before they expire</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
