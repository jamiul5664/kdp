import {
  BarChart3,
  BookOpen,
  Compass,
  Download,
  FileEdit,
  FolderKanban,
  Layers,
  LayoutDashboard,
  MessageSquare,
  Palette,
  Radar,
  Search,
  Settings,
  ShieldCheck,
  Tag,
} from 'lucide-react';
import type { AppRoute } from '../../types';

export interface NavItem {
  label: string;
  route: AppRoute;
  icon: typeof LayoutDashboard;
  group: 'Workspace' | 'Creation' | 'Publishing';
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', route: '/dashboard', icon: LayoutDashboard, group: 'Workspace' },
  { label: 'AI Chat', route: '/chat', icon: MessageSquare, group: 'Workspace' },
  { label: 'Market Research', route: '/research', icon: Search, group: 'Workspace' },
  { label: 'Niche Finder', route: '/niches', icon: Compass, group: 'Workspace' },
  { label: 'Intelligence Hub', route: '/intelligence', icon: Radar, group: 'Workspace' },
  { label: 'Projects', route: '/projects', icon: FolderKanban, group: 'Creation' },
  { label: 'Book Editor', route: '/editor', icon: FileEdit, group: 'Creation' },
  { label: 'Cover Studio', route: '/cover-studio', icon: Palette, group: 'Creation' },
  { label: 'Studio Suite', route: '/studio-tools', icon: Layers, group: 'Creation' },
  { label: 'SEO Optimizer', route: '/seo', icon: Tag, group: 'Publishing' },
  { label: 'Compliance & IP', route: '/compliance', icon: ShieldCheck, group: 'Publishing' },
  { label: 'Portfolio & Profit', route: '/analytics', icon: BarChart3, group: 'Publishing' },
  { label: 'Exports', route: '/exports', icon: Download, group: 'Publishing' },
  { label: 'Settings', route: '/settings', icon: Settings, group: 'Publishing' },
];

export const ROUTE_TITLES: Record<AppRoute, { section: string; title: string }> = {
  '/dashboard': { section: 'Workspace', title: 'Dashboard' },
  '/chat': { section: 'Workspace', title: 'AI Chat' },
  '/research': { section: 'Workspace', title: 'Market Research' },
  '/niches': { section: 'Workspace', title: 'Niche Finder' },
  '/intelligence': { section: 'Workspace', title: 'Intelligence Hub' },
  '/projects': { section: 'Creation', title: 'Projects' },
  '/editor': { section: 'Creation', title: 'Book Editor' },
  '/cover-studio': { section: 'Creation', title: 'Cover Studio' },
  '/studio-tools': { section: 'Creation', title: 'Studio Suite' },
  '/seo': { section: 'Publishing', title: 'SEO Optimizer' },
  '/compliance': { section: 'Publishing', title: 'Compliance & Originality' },
  '/analytics': { section: 'Publishing', title: 'Portfolio, Profit & Memory' },
  '/exports': { section: 'Publishing', title: 'Exports' },
  '/settings': { section: 'Publishing', title: 'Settings' },
  '/login': { section: 'Account', title: 'Sign In' },
  '/register': { section: 'Account', title: 'Create Account' },
};

export function BrandMark({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <div className="h-8 w-8 rounded-lg bg-accent/15 border border-accent/35 flex items-center justify-center shrink-0">
        <BookOpen className="h-4 w-4 text-accent" />
      </div>
      {!collapsed && (
        <span className="font-display text-sm font-bold tracking-tight text-foreground whitespace-nowrap truncate">
          KDP Studio AI
        </span>
      )}
    </div>
  );
}
