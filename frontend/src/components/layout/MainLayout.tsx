import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar.tsx';
import { useTheme } from '@/contexts/ThemeContext.tsx';
import { cn } from '@/lib/utils.ts';

export const MainLayout: React.FC = () => {
  const { settings } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(!settings.sidebarCollapsed);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      
      <main
        className={cn(
          'min-h-screen transition-all duration-300',
          'md:ml-64', // Always offset on desktop
          'pt-16 md:pt-0', // Mobile header space
          'px-4 md:px-8 py-6'
        )}
      >
        <div className="max-w-7xl mx-auto animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
