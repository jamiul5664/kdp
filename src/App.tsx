import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAppStore } from './stores/useAppStore';
import { AppShell } from './components/layout/AppShell';
import DashboardPage from './app/dashboard/page';
import ChatPage from './app/chat/page';
import ResearchPage from './app/research/page';
import NichesPage from './app/niches/page';
import ProjectsPage from './app/projects/page';
import EditorPage from './app/editor/page';
import CoverStudioPage from './app/cover-studio/page';
import SeoPage from './app/seo/page';
import ExportsPage from './app/exports/page';
import SettingsPage from './app/settings/page';
import LoginPage from './app/login/page';
import RegisterPage from './app/register/page';
import IntelligenceHubPage from './app/intelligence/page';
import StudioToolsPage from './app/studio-tools/page';
import CompliancePage from './app/compliance/page';
import AnalyticsPortfolioPage from './app/analytics/page';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function ActiveRouteView() {
  const route = useAppStore((s) => s.route);

  switch (route) {
    case '/dashboard':
      return <DashboardPage />;
    case '/chat':
      return <ChatPage />;
    case '/research':
      return <ResearchPage />;
    case '/niches':
      return <NichesPage />;
    case '/intelligence':
      return <IntelligenceHubPage />;
    case '/projects':
      return <ProjectsPage />;
    case '/editor':
      return <EditorPage />;
    case '/cover-studio':
      return <CoverStudioPage />;
    case '/studio-tools':
      return <StudioToolsPage />;
    case '/seo':
      return <SeoPage />;
    case '/compliance':
      return <CompliancePage />;
    case '/analytics':
      return <AnalyticsPortfolioPage />;
    case '/exports':
      return <ExportsPage />;
    case '/settings':
      return <SettingsPage />;
    case '/login':
      return <LoginPage />;
    case '/register':
      return <RegisterPage />;
    default:
      return <DashboardPage />;
  }
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppShell>
        <ActiveRouteView />
      </AppShell>
    </QueryClientProvider>
  );
}
