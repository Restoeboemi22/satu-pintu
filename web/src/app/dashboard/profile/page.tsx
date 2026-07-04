"use client";

import { useAuthStore } from "@/store/useAuthStore";

export default function ProfilePage() {
  const { user } = useAuthStore();

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Profil Saya</h1>
      </div>

      <div className="bg-white shadow rounded-lg p-6 max-w-2xl">
        <div className="flex items-center space-x-6 mb-6">
          <div className="h-24 w-24 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-3xl font-bold">
            {user.name.charAt(0)}
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{user.name}</h2>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 uppercase mt-1">
              {user.role}
            </span>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-4">
          <dl className="divide-y divide-gray-200">
            <div className="py-3 grid grid-cols-3 gap-4">
              <dt className="text-sm font-medium text-gray-500">ID Pengguna (NISN/NUPTK)</dt>
              <dd className="text-sm text-gray-900 col-span-2">{user.id}</dd>
            </div>
            <div className="py-3 grid grid-cols-3 gap-4">
              <dt className="text-sm font-medium text-gray-500">Email / Username</dt>
              <dd className="text-sm text-gray-900 col-span-2">{user.email}</dd>
            </div>
            <div className="py-3 grid grid-cols-3 gap-4">
              <dt className="text-sm font-medium text-gray-500">Sekolah</dt>
              <dd className="text-sm text-gray-900 col-span-2">SMPN 3 PACET</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
