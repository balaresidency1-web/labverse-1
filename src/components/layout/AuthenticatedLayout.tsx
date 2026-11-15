import React, { useState } from 'react';
import { Navbar } from '../navigation/Navbar';
import { Sidebar, ActiveTab } from '../navigation/Sidebar';

interface AuthenticatedLayoutProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onSignOut: () => void;
  children: React.ReactNode;
}

export const AuthenticatedLayout: React.FC<AuthenticatedLayoutProps> = ({
  activeTab,
  onSelectTab,
  onSignOut,
  children,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F5F0E8] flex flex-col font-sans text-[#252521]">
      <Navbar
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        onSignOut={onSignOut}
      />

      <div className="flex-1 flex max-w-[1600px] w-full mx-auto min-w-0">
        <Sidebar
          activeTab={activeTab}
          onSelectTab={onSelectTab}
          onSignOut={onSignOut}
          isMobileOpen={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 overflow-x-hidden overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
