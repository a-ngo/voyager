import {
  Home,
  LayoutDashboard,
  LineChart,
  Bell,
  MessageSquare,
  Newspaper,
  Telescope,
  PieChart,
  Calculator,
  Upload,
  Receipt,
  Settings,
  ScanSearch,
  Boxes,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  /** Route path */
  href: string
  /** Sidebar label */
  label: string
  /** Lucide icon */
  icon: LucideIcon
  /** Group for sidebar section headers */
  group: 'core' | 'analytics' | 'tools' | 'settings'
  /** Hide from nav if feature not yet built (still routable for dev) */
  hidden?: boolean
  /** Show a "New" or "Beta" badge */
  badge?: 'new' | 'beta'
}

/**
 * Navigation as data — the single source of truth for the sidebar.
 * Adding a page = add one entry here + create the route.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: '/home', label: 'Home', icon: Home, group: 'core' },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'core' },
  { href: '/portfolio', label: 'Portfolio', icon: PieChart, group: 'core' },
  { href: '/transactions', label: 'Transactions', icon: Receipt, group: 'core' },
  { href: '/performance', label: 'Performance', icon: LineChart, group: 'analytics' },
  { href: '/xray', label: 'X-Ray', icon: ScanSearch, group: 'analytics' },
  { href: '/news', label: 'News', icon: Newspaper, group: 'analytics' },
  { href: '/projections', label: 'Projections', icon: Telescope, group: 'analytics' },
  { href: '/clusters', label: 'Clusters', icon: Boxes, group: 'analytics' },
  { href: '/alerts', label: 'Alerts', icon: Bell, group: 'core' },
  { href: '/import', label: 'Import', icon: Upload, group: 'tools' },
  { href: '/assistant', label: 'AI Assistant', icon: MessageSquare, group: 'tools', badge: 'beta' },
  { href: '/tax', label: 'Tax Helper', icon: Calculator, group: 'tools', hidden: true },
  { href: '/settings', label: 'Settings', icon: Settings, group: 'settings' },
]

export const NAV_GROUP_LABELS: Record<NavItem['group'], string> = {
  core: 'Core',
  analytics: 'Analytics',
  tools: 'Tools',
  settings: 'Settings',
}
