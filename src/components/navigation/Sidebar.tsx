import React, { useState } from 'react';
import { useLabverse } from '../../context/LabverseContext';
import {
  LayoutDashboard,
  FlaskConical,
  Users,
  GitBranch,
  Settings,
  LogOut,
  BookOpen,
  FileText,
  Video,
  Laptop,
  Wrench,
  QrCode,
  Layers,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
} from 'lucide-react';

export type ActiveTab =
  | 'dashboard'
  | 'manage_labs'
  | 'pc_lab'
  | 'assistants'
  | 'assignments'
  | 'my_labs'
  | 'subjects'
  | 'experiments'
  | 'syllabus'
  | 'manuals'
  | 'youtube'
  | 'bench_twin'
  | 'inventory'
  | 'pc_working'
  | 'pc_defective'
  | 'pc_staff'
  | 'qr_codes'
  | 'settings';

interface SidebarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onSignOut: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

interface NavItem {
  id: ActiveTab;
  label: string;
  icon: React.ReactNode;
  badge?: string | null;
  badgeColor?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  onSignOut,
  isMobileOpen,
  onCloseMobile,
}) => {
  const {
    currentRole,
    labs,
    labInventory,
    selectedLab,
    switchLab,
    accessibleLabs,
    pcLabStats,
  } = useLabverse();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const activeLabsCount = labs.filter((l) => l.status === 'active').length;
  const lowStockCount = labInventory.filter(
    (i) => i.status === 'low_stock' || i.status === 'out_of_stock'
  ).length;

  const getNavItems = (): NavItem[] => {
    if (currentRole === 'college_admin') {
      return [
        { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4 shrink-0" /> },
        {
          id: 'manage_labs',
          label: 'Manage Laboratories',
          icon: <FlaskConical className="w-4 h-4 shrink-0" />,
          badge: `${activeLabsCount} Active`,
          badgeColor: 'bg-[#EBF5EE] text-[#2E6F4E] border border-[#C6E3D0]',
        },
        { id: 'assistants', label: 'Lab Assistant Management', icon: <Users className="w-4 h-4 shrink-0" /> },
        { id: 'assignments', label: 'Laboratory Assignments', icon: <GitBranch className="w-4 h-4 shrink-0" /> },
        { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4 shrink-0" /> },
      ];
    }

    if (selectedLab?.lab_type === 'pc_lab') {
      const defectiveOrMaint = pcLabStats.defectiveStudentComputers;
      return [
        { id: 'dashboard', label: 'PC Lab Dashboard', icon: <LayoutDashboard className="w-4 h-4 shrink-0" /> },
        {
          id: 'my_labs',
          label: 'My Assigned Laboratories',
          icon: <FlaskConical className="w-4 h-4 shrink-0" />,
          badge: `${accessibleLabs.length}`,
        },
        {
          id: 'pc_working',
          label: 'Working Computers',
          icon: <CheckCircle2 className="w-4 h-4 shrink-0" />,
          badge: `${pcLabStats.workingStudentComputers}`,
          badgeColor: 'bg-[#EBF5EE] text-[#2E6F4E] border border-[#C6E3D0]',
        },
        {
          id: 'pc_defective',
          label: 'Defective & Maintenance',
          icon: <AlertTriangle className="w-4 h-4 shrink-0" />,
          badge: defectiveOrMaint > 0 ? `${defectiveOrMaint}` : null,
          badgeColor: 'bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]',
        },
        {
          id: 'pc_staff',
          label: 'Staff Computers',
          icon: <UserCheck className="w-4 h-4 shrink-0" />,
          badge: `${pcLabStats.staffComputers}`,
        },
        { id: 'qr_codes', label: 'QR Code Management', icon: <QrCode className="w-4 h-4 shrink-0" /> },
        { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4 shrink-0" /> },
      ];
    }

    // Standard Practical Lab Assistant navigation items
    return [
      { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4 shrink-0" /> },
      {
        id: 'my_labs',
        label: 'My Assigned Laboratories',
        icon: <FlaskConical className="w-4 h-4 shrink-0" />,
        badge: `${accessibleLabs.length}`,
      },
      { id: 'subjects', label: 'Practical Subjects', icon: <Layers className="w-4 h-4 shrink-0" /> },
      { id: 'experiments', label: 'Experiments', icon: <BookOpen className="w-4 h-4 shrink-0" /> },
      { id: 'syllabus', label: 'Syllabus Management', icon: <FileText className="w-4 h-4 shrink-0" /> },
      { id: 'manuals', label: 'Manual Management', icon: <FileText className="w-4 h-4 shrink-0" /> },
      { id: 'youtube', label: 'YouTube Resources', icon: <Video className="w-4 h-4 shrink-0" /> },
      { id: 'bench_twin', label: 'Bench Twin Simulations', icon: <Laptop className="w-4 h-4 shrink-0" /> },
      {
        id: 'inventory',
        label: 'Inventory',
        icon: <Wrench className="w-4 h-4 shrink-0" />,
        badge: lowStockCount > 0 ? `${lowStockCount} Low` : null,
        badgeColor: 'bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]',
      },
      { id: 'qr_codes', label: 'QR Code Management', icon: <QrCode className="w-4 h-4 shrink-0" /> },
      { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4 shrink-0" /> },
    ];
  };

  const navItems = getNavItems();

  const handleItemClick = (id: ActiveTab) => {
    onSelectTab(id);
    onCloseMobile();
  };

  return (
    <>
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-[#252521]/40 z-40 md:hidden backdrop-blur-xs"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed md:sticky top-15 z-40 h-[calc(100vh-3.75rem)] bg-white border-r border-[#E7DDD0] flex flex-col justify-between transition-all duration-200 shrink-0 ${
          isCollapsed ? 'w-18' : 'w-72'
        } ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        <div className="p-3 space-y-3 overflow-y-auto flex-1">
          <div className="hidden md:flex items-center justify-between px-2 pt-1 pb-2 border-b border-[#F5F0E8]">
            {!isCollapsed && (
              <span className="text-[10px] font-mono uppercase font-bold text-[#6E675F] tracking-wider">
                {currentRole === 'college_admin' ? 'College Admin Portal' : 'Lab Assistant Desk'}
              </span>
            )}
            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1.5 rounded-lg text-[#6E675F] hover:text-[#252521] hover:bg-[#FAF6F0] ml-auto cursor-pointer"
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleItemClick(item.id)}
                  title={isCollapsed ? item.label : undefined}
                  className={`w-full flex items-center ${
                    isCollapsed ? 'justify-center px-2 py-2.5' : 'justify-between px-3 py-2'
                  } rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#49372E] text-white font-semibold shadow-xs'
                      : 'text-[#252521] hover:bg-[#FAF6F0]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={isActive ? 'text-white' : 'text-[#A66A43]'}>{item.icon}</span>
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </div>
                  {!isCollapsed && item.badge && (
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full shrink-0 font-semibold ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : item.badgeColor || 'bg-[#FAF6F0] text-[#49372E] border border-[#E7DDD0]'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Active Lab Context + Logout */}
        <div className="p-3 border-t border-[#E7DDD0] space-y-2">
          {selectedLab && currentRole === 'lab_assistant' && !isCollapsed && (
            <div className="p-3 rounded-xl bg-[#FAF6F0] border border-[#E7DDD0]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase font-bold text-[#6E675F] tracking-wider">
                  Assigned Lab
                </span>
                <span className="font-mono text-[10px] text-[#49372E] font-bold bg-white px-1.5 py-0.5 rounded border border-[#D8CBB9]">
                  {selectedLab.lab_code}
                </span>
              </div>
              <div className="font-bold text-xs text-[#252521] truncate">{selectedLab.name}</div>
              {accessibleLabs.length > 1 && (
                <button
                  type="button"
                  onClick={switchLab}
                  className="mt-2 w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-[#D8CBB9] hover:border-[#A66A43] text-[#49372E] text-[11px] font-semibold cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Switch Assigned Lab</span>
                </button>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              onCloseMobile();
              onSignOut();
            }}
            className={`w-full flex items-center ${
              isCollapsed ? 'justify-center px-2 py-2.5' : 'gap-2.5 px-3 py-2'
            } rounded-xl text-xs font-semibold text-[#B91C1C] hover:bg-[#FEF2F2] transition-colors cursor-pointer`}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
};
