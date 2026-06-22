import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAuthStore } from '@/stores/auth-store';
import { Redirect } from 'wouter';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
      
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-background">
          <div className="max-w-7xl mx-auto h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
