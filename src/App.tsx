import React, { useState, useEffect } from 'react';
import { LabverseProvider, useLabverse } from './context/LabverseContext';
import { ActiveTab } from './components/navigation/Sidebar';
import { PublicLayout } from './components/layout/PublicLayout';
import { AuthenticatedLayout } from './components/layout/AuthenticatedLayout';
import { PublicPortalView } from './components/public/PublicPortalView';
import { ExperimentDetailView } from './components/experiment/ExperimentDetailView';
import { CollegeAdminView } from './components/views/CollegeAdminView';
import { CollegeAdminStaffView } from './components/views/CollegeAdminStaffView';
import { LabAssistantView } from './components/views/LabAssistantView';
import { ManageLaboratoriesView } from './components/laboratory/ManageLaboratoriesView';
import { StaffAuthGate } from './components/auth/StaffAuthGate';
import { UpdatePasswordView } from './components/auth/UpdatePasswordView';
import { getSupabaseClient } from './services/supabaseClient';
import { normalizeTabForRole } from './utils/labRules';
import { ShieldAlert, LogOut, Loader2 } from 'lucide-react';

function MainLayout() {
  const {
    currentRole,
    currentUser,
    isAuthenticated,
    authLoading,
    isAccountSuspended,
    signOut,
    isSupabaseActive,
    selectedLabId,
    selectedLab,
    accessibleLabs,
    dataLoadError,
  } = useLabverse();

  // Password Recovery Route Detection (/update-password)
  const [isUpdatePasswordRoute, setIsUpdatePasswordRoute] = useState(() => {
    if (typeof window === 'undefined') return false;
    const path = window.location.pathname;
    const hash = window.location.hash;
    return path.startsWith('/update-password') || hash.includes('type=recovery');
  });

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;
      setIsUpdatePasswordRoute(path.startsWith('/update-password') || hash.includes('type=recovery'));
    };

    window.addEventListener('popstate', handlePopState);

    const supabase = getSupabaseClient();
    let authSubscription: { unsubscribe: () => void } | null = null;
    if (supabase) {
      const { data } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') {
          setIsUpdatePasswordRoute(true);
        }
      });
      authSubscription = data.subscription;
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
      authSubscription?.unsubscribe();
    };
  }, []);

  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [selectedExperimentId, setSelectedExperimentId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedExperimentId(null);
    if (currentRole) {
      setActiveTab((prev) =>
        normalizeTabForRole(currentRole, prev, selectedLab?.lab_type) as ActiveTab
      );
    }
  }, [currentRole, selectedLab?.lab_type]);

  useEffect(() => {
    setSelectedExperimentId(null);
  }, [selectedLabId]);

  const handleSignOut = async () => {
    await signOut();
    setSelectedExperimentId(null);
    setActiveTab('dashboard');
    setShowAdminLogin(false);
  };

  // 1. Auth verification loading splash
  if (authLoading && isSupabaseActive) {
    return (
      <PublicLayout>
        <div className="w-full max-w-md bg-white rounded-2xl border border-[#E7DDD0] shadow-lg p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#49372E] text-white flex items-center justify-center mx-auto">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
          <div>
            <h2 className="font-heading font-bold text-[#252521] text-base">
              Verifying MVIT Staff Session
            </h2>
            <p className="text-xs text-[#6E675F] mt-1">
              Checking institution permissions and assigned laboratories...
            </p>
          </div>
        </div>
      </PublicLayout>
    );
  }

  // 2. Password Recovery Route
  if (isUpdatePasswordRoute) {
    return (
      <PublicLayout>
        <UpdatePasswordView
          onPasswordUpdated={() => {
            if (typeof window !== 'undefined') window.history.replaceState(null, '', '/');
            setIsUpdatePasswordRoute(false);
          }}
          onComplete={() => {
            if (typeof window !== 'undefined') window.history.replaceState(null, '', '/');
            setIsUpdatePasswordRoute(false);
          }}
        />
      </PublicLayout>
    );
  }

  // 3. Unauthenticated State -> Public Portal OR Admin/Assistant Login Gate
  if (!isAuthenticated || !currentRole || !currentUser) {
    if (showAdminLogin) {
      return (
        <PublicLayout>
          <StaffAuthGate
            onAuthenticated={() => setShowAdminLogin(false)}
            onBackToPublic={() => setShowAdminLogin(false)}
          />
        </PublicLayout>
      );
    }
    return (
      <>
        {dataLoadError && isSupabaseActive && (
          <div
            role="alert"
            className="bg-rose-50 border-b border-rose-200 px-4 py-2.5 text-xs text-rose-900 flex items-center justify-center gap-2"
          >
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{dataLoadError}</span>
          </div>
        )}
        <PublicPortalView onOpenAdminLogin={() => setShowAdminLogin(true)} />
      </>
    );
  }

  // 4. Authenticated Staff Views (College Admin OR Lab Assistant)
  const renderAuthenticatedContent = () => {
    if (isAccountSuspended || currentUser.status === 'suspended') {
      return (
        <div className="max-w-md mx-auto my-12 bg-white rounded-2xl border border-rose-200 shadow-lg p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="font-heading font-bold text-lg text-[#252521]">Account Suspended</h2>
          <p className="text-xs text-[#6E675F] leading-relaxed">
            Your MVIT staff account (<strong>{currentUser.email}</strong>) is currently suspended. Contact MVIT College Administration.
          </p>
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full py-2.5 px-4 bg-[#49372E] hover:bg-[#382922] text-white text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      );
    }

    if (selectedExperimentId) {
      return (
        <ExperimentDetailView
          experimentId={selectedExperimentId}
          onBack={() => setSelectedExperimentId(null)}
          isPublic={false}
        />
      );
    }

    if (currentRole === 'college_admin') {
      switch (activeTab) {
        case 'manage_labs':
          return <ManageLaboratoriesView onBackToSelection={() => setActiveTab('dashboard')} />;
        case 'assistants':
          return <CollegeAdminStaffView />;
        case 'assignments':
          return <CollegeAdminView initialSection="assignments" onSelectTab={setActiveTab} />;
        case 'settings':
          return <CollegeAdminView initialSection="settings" onSelectTab={setActiveTab} />;
        case 'dashboard':
        default:
          return <CollegeAdminView initialSection="dashboard" onSelectTab={setActiveTab} />;
      }
    }

    // Lab Assistant strict lab assignment gate:
    if (accessibleLabs.length === 0 && activeTab !== 'settings' && activeTab !== 'my_labs') {
      return <LabAssistantView initialSection="my_labs" onSelectExperiment={setSelectedExperimentId} onSelectTab={setActiveTab} />;
    }

    return (
      <LabAssistantView
        initialSection={
          activeTab === 'dashboard' ||
          activeTab === 'my_labs' ||
          activeTab === 'subjects' ||
          activeTab === 'experiments' ||
          activeTab === 'syllabus' ||
          activeTab === 'manuals' ||
          activeTab === 'youtube' ||
          activeTab === 'bench_twin' ||
          activeTab === 'inventory' ||
          activeTab === 'pc_working' ||
          activeTab === 'pc_defective' ||
          activeTab === 'pc_staff' ||
          activeTab === 'qr_codes' ||
          activeTab === 'settings'
            ? activeTab
            : 'dashboard'
        }
        onSelectExperiment={setSelectedExperimentId}
        onSelectTab={setActiveTab}
      />
    );
  };

  return (
    <AuthenticatedLayout
      activeTab={activeTab}
      onSelectTab={(tab) => {
        setSelectedExperimentId(null);
        setActiveTab(tab);
      }}
      onSignOut={handleSignOut}
    >
      {dataLoadError && isSupabaseActive && (
        <div
          role="alert"
          className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-center gap-2"
        >
          <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{dataLoadError}</span>
        </div>
      )}
      {renderAuthenticatedContent()}
    </AuthenticatedLayout>
  );
}

export default function App() {
  return (
    <LabverseProvider>
      <MainLayout />
    </LabverseProvider>
  );
}
