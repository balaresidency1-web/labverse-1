import React, { useState, useEffect, useRef } from 'react';
import { useLabverse } from '../../context/LabverseContext';
import {
  FlaskConical,
  Bell,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  ChevronDown,
  Building2,
  Menu,
  Wrench,
  Download,
  Info,
  LogOut,
} from 'lucide-react';

interface NavbarProps {
  onToggleMobileMenu: () => void;
  onSignOut: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleMobileMenu, onSignOut }) => {
  const {
    currentRole,
    currentUser,
    institution,
    selectedLab,
    accessibleLabs,
    switchLab,
    isSupabaseActive,
    currentTerm,
    notifications,
    markNotificationRead,
    clearAllNotifications,
    resetToDefaultData,
    exportToCsv,
  } = useLabverse();

  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menusContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menusContainerRef.current && !menusContainerRef.current.contains(e.target as Node)) {
        setShowNotifMenu(false);
        setShowUserMenu(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowNotifMenu(false);
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const unreadNotifs = notifications.filter((n) => !n.read);

  const roleBadge =
    currentRole === 'college_admin'
      ? { label: 'College Admin', icon: <Building2 className="w-3.5 h-3.5 shrink-0" />, color: 'bg-[#49372E] text-white' }
      : { label: 'Lab Assistant', icon: <Wrench className="w-3.5 h-3.5 shrink-0" />, color: 'bg-[#A66A43] text-white' };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-[#E7DDD0] shadow-[0_1px_2px_0_rgba(37,37,33,0.03)]">
      <div className="max-w-[1600px] mx-auto px-3 sm:px-6 h-15 flex items-center justify-between gap-2 sm:gap-3">
        {/* Left: Mobile trigger & MVIT Brand */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleMobileMenu}
            aria-label="Toggle navigation menu"
            className="md:hidden p-2 text-[#49372E] hover:bg-[#F5F0E8] rounded-lg cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-[#49372E] flex items-center justify-center text-[#F5F0E8] shadow-sm shrink-0">
              <FlaskConical className="w-4 h-4" />
            </div>
            <div className="whitespace-nowrap">
              <span className="font-heading font-bold text-sm sm:text-base text-[#252521] tracking-tight">
                LABVERSE – MVIT
              </span>
              <span className="text-[11px] text-[#6E675F] hidden xl:inline ml-2">
                {institution.code} Staff Portal
              </span>
            </div>
          </div>
        </div>

        {/* Center: Active Term & Laboratory Indicator */}
        <div className="hidden md:flex items-center gap-2 text-xs min-w-0">
          {!isSupabaseActive && (
            <span className="px-2 py-0.5 rounded-md bg-[#FFFBEB] border border-[#FDE68A] text-[#B45309] font-mono text-[10px] font-bold shrink-0">
              DEMO MODE
            </span>
          )}
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#FAF6F0] border border-[#E7DDD0] rounded-lg shrink-0 whitespace-nowrap">
            <Building2 className="w-3.5 h-3.5 text-[#A66A43] shrink-0" />
            <span className="font-semibold text-[#252521]">MVIT Puducherry</span>
            <span className="text-[#D8CBB9]">•</span>
            <span className="font-mono text-[#6E675F] text-[10px]">{currentTerm.code}</span>
          </div>

          {selectedLab && (
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-[#FAF6F0] border border-[#D8CBB9] rounded-lg text-xs shrink-0 whitespace-nowrap">
              <FlaskConical className="w-3.5 h-3.5 text-[#A66A43] shrink-0" />
              <span className="font-semibold text-[#252521] truncate max-w-[160px]">{selectedLab.name}</span>
              <span className="font-mono text-[10px] text-[#49372E] font-bold px-1.5 py-0.2 bg-white rounded border border-[#E7DDD0]">
                {selectedLab.lab_code}
              </span>
              {accessibleLabs.length > 1 && (
                <button
                  type="button"
                  onClick={switchLab}
                  className="ml-1 text-[11px] font-semibold text-[#A66A43] hover:text-[#49372E] hover:underline cursor-pointer"
                >
                  Switch
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right: Role Badge, Notifications, User Profile, Logout */}
        <div ref={menusContainerRef} className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg whitespace-nowrap ${roleBadge.color}`}
          >
            {roleBadge.icon}
            <span className="hidden sm:inline">{roleBadge.label}</span>
          </span>

          {/* Notifications */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => {
                setShowNotifMenu(!showNotifMenu);
                setShowUserMenu(false);
              }}
              aria-label="View notifications"
              aria-expanded={showNotifMenu}
              className="relative p-2 text-[#49372E] hover:bg-[#FAF6F0] rounded-lg transition-colors cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifs.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#A66A43] rounded-full ring-2 ring-white" />
              )}
            </button>

            {showNotifMenu && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-[#E7DDD0] p-3 z-50">
                <div className="flex items-center justify-between pb-2 border-b border-[#E7DDD0]">
                  <span className="text-xs font-semibold text-[#252521]">Notifications</span>
                  {unreadNotifs.length > 0 && (
                    <button
                      type="button"
                      onClick={clearAllNotifications}
                      className="text-[10px] text-[#A66A43] hover:underline cursor-pointer"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>

                <div className="max-h-64 overflow-y-auto divide-y divide-[#F5F0E8] mt-1">
                  {notifications.length === 0 ? (
                    <p className="text-xs text-[#6E675F] py-4 text-center">No notifications</p>
                  ) : (
                    notifications.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => markNotificationRead(n.id)}
                        className={`w-full text-left py-2 px-1.5 text-xs cursor-pointer hover:bg-[#FAF6F0] rounded transition-colors ${
                          !n.read ? 'bg-[#FAF6F0] font-medium' : 'text-[#6E675F]'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {n.type === 'warning' ? (
                            <AlertTriangle className="w-3.5 h-3.5 text-[#D99022] shrink-0 mt-0.5" />
                          ) : n.type === 'success' ? (
                            <CheckCircle className="w-3.5 h-3.5 text-[#2E6F4E] shrink-0 mt-0.5" />
                          ) : (
                            <Info className="w-3.5 h-3.5 text-[#A66A43] shrink-0 mt-0.5" />
                          )}
                          <div>
                            <p className="text-[#252521] font-semibold">{n.title}</p>
                            <p className="text-[11px] text-[#6E675F] mt-0.5">{n.message}</p>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Profile Menu */}
          {currentUser && (
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowUserMenu(!showUserMenu);
                  setShowNotifMenu(false);
                }}
                aria-expanded={showUserMenu}
                aria-haspopup="menu"
                className="flex items-center gap-2 pl-1.5 pr-2 py-1 rounded-lg hover:bg-[#FAF6F0] border border-transparent hover:border-[#E7DDD0] transition-colors whitespace-nowrap cursor-pointer"
              >
                <div className="w-7 h-7 rounded-full bg-[#E7DDD0] text-[#49372E] font-heading font-bold text-xs flex items-center justify-center shrink-0">
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
                <span className="hidden md:inline text-xs font-semibold text-[#252521] truncate max-w-[120px]">
                  {currentUser.name}
                </span>
                <ChevronDown className="w-3 h-3 text-[#6E675F] shrink-0" />
              </button>

              {showUserMenu && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-[#E7DDD0] py-2 z-50"
                  onClick={() => setShowUserMenu(false)}
                >
                  <div className="px-4 py-2 border-b border-[#E7DDD0]">
                    <p className="text-xs font-semibold text-[#252521]">{currentUser.name}</p>
                    <p className="text-[11px] text-[#6E675F]">{currentUser.email}</p>
                    <p className="text-[10px] font-mono text-[#A66A43] mt-0.5">
                      {currentUser.identifier} • {institution.code}
                    </p>
                  </div>

                  <div className="py-1">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => exportToCsv('inventory')}
                      className="w-full text-left px-4 py-2 text-xs text-[#252521] hover:bg-[#FAF6F0] flex items-center gap-2 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-[#A66A43]" />
                      Export Inventory (CSV)
                    </button>
                    {!isSupabaseActive && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={resetToDefaultData}
                        className="w-full text-left px-4 py-2 text-xs text-[#B91C1C] hover:bg-[#FEF2F2] flex items-center gap-2 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reset Demo Data
                      </button>
                    )}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={onSignOut}
                      className="w-full text-left px-4 py-2 text-xs text-[#49372E] font-semibold hover:bg-[#FAF6F0] flex items-center gap-2 border-t border-[#E7DDD0] mt-1 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Direct Logout Button */}
          <button
            type="button"
            onClick={onSignOut}
            aria-label="Logout"
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-[#49372E] hover:bg-[#FAF6F0] border border-[#D8CBB9] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};
