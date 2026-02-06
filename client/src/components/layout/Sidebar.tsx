import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  Scale,
  FileSpreadsheet,
  PieChart,
  Users,
  Receipt,
  Calculator,
  Settings,
  ChevronDown,
  Briefcase,
  Wallet,
  Banknote,
  Upload,
  RefreshCw,
  Clock,
  History,
  Link,
  FileSearch,
  Building2,
  UserCircle,
  CreditCard,
  UserPlus,
  BookMarked,
  ShoppingCart,
  ClipboardList,
  FileCheck,
  FileMinus,
  FilePlus,
  Landmark,
  ArrowLeftRight,
  Package,
  IndianRupee,
  ArrowDownCircle,
  ArrowUpCircle,
} from 'lucide-react';

interface MenuItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

interface MenuGroup {
  label: string;
  icon: React.ReactNode;
  items: MenuItem[];
}

const menuGroups: MenuGroup[] = [
  {
    label: 'Items',
    icon: <Package className="h-4 w-4" />,
    items: [
      { label: 'Products & Services', path: '/products', icon: <Package className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Sales',
    icon: <ArrowUpCircle className="h-4 w-4" />,
    items: [
      { label: 'Customers', path: '/customers', icon: <UserCircle className="h-4 w-4" /> },
      { label: 'Quotes', path: '/quotes', icon: <ClipboardList className="h-4 w-4" /> },
      { label: 'Sales Orders', path: '/sales-orders', icon: <ShoppingCart className="h-4 w-4" /> },
      { label: 'Invoices', path: '/invoices', icon: <FileText className="h-4 w-4" /> },
      { label: 'Payments Received', path: '/payments-received', icon: <ArrowDownCircle className="h-4 w-4" /> },
      { label: 'Credit Notes', path: '/credit-notes', icon: <FileMinus className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Purchases',
    icon: <ArrowDownCircle className="h-4 w-4" />,
    items: [
      { label: 'Vendors', path: '/vendors', icon: <Building2 className="h-4 w-4" /> },
      { label: 'Purchase Orders', path: '/purchase-orders', icon: <ClipboardList className="h-4 w-4" /> },
      { label: 'Bills', path: '/bills', icon: <FileCheck className="h-4 w-4" /> },
      { label: 'Payments Made', path: '/payments-made', icon: <ArrowUpCircle className="h-4 w-4" /> },
      { label: 'Expenses', path: '/expenses', icon: <Receipt className="h-4 w-4" /> },
      { label: 'Debit Notes', path: '/debit-notes', icon: <FilePlus className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Banking',
    icon: <Landmark className="h-4 w-4" />,
    items: [
      { label: 'Bank Accounts', path: '/bank-accounts', icon: <Landmark className="h-4 w-4" /> },
      { label: 'Bank Reconciliation', path: '/bank-reconciliation', icon: <ArrowLeftRight className="h-4 w-4" /> },
      { label: 'Bank Import', path: '/bank-import', icon: <Upload className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Accountant',
    icon: <Briefcase className="h-4 w-4" />,
    items: [
      { label: 'Chart of Accounts', path: '/chart-of-accounts', icon: <BookOpen className="h-4 w-4" /> },
      { label: 'Journal Entries', path: '/journal-entries', icon: <FileText className="h-4 w-4" /> },
      { label: 'Ledger View', path: '/ledger', icon: <BookMarked className="h-4 w-4" /> },
      { label: 'Recurring Entries', path: '/recurring-entries', icon: <RefreshCw className="h-4 w-4" /> },
      { label: 'Parties', path: '/parties', icon: <Users className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Reports',
    icon: <PieChart className="h-4 w-4" />,
    items: [
      { label: 'Trial Balance', path: '/trial-balance', icon: <Scale className="h-4 w-4" /> },
      { label: 'Balance Sheet', path: '/balance-sheet', icon: <FileSpreadsheet className="h-4 w-4" /> },
      { label: 'Profit & Loss', path: '/profit-loss', icon: <PieChart className="h-4 w-4" /> },
      { label: 'Cash Flow', path: '/cash-flow', icon: <Banknote className="h-4 w-4" /> },
      { label: 'Aging Reports', path: '/aging-reports', icon: <Clock className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Compliance',
    icon: <Wallet className="h-4 w-4" />,
    items: [
      { label: 'GST Returns', path: '/gst-returns', icon: <Receipt className="h-4 w-4" /> },
      { label: 'TDS Register', path: '/tds-register', icon: <Calculator className="h-4 w-4" /> },
    ],
  },
];

export default function Sidebar() {
  const location = useLocation();
  const [openMenus, setOpenMenus] = useState<Set<string>>(() => {
    // Auto-expand menu that contains current route
    const activeGroup = menuGroups.find(group =>
      group.items.some(item => location.pathname.startsWith(item.path))
    );
    return new Set(activeGroup ? [activeGroup.label] : ['Sales']);
  });

  const toggleMenu = (label: string) => {
    setOpenMenus(prev => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  };

  return (
    <div className="flex h-full w-64 flex-col bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-foreground/10 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-accent text-white font-bold">
          Z
        </div>
        <span className="text-lg font-semibold">Zara Books</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        {/* Dashboard */}
        <NavLink
          to="/"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-6 py-2.5 text-sm transition-colors',
              isActive
                ? 'bg-sidebar-accent/20 text-sidebar-accent border-r-2 border-sidebar-accent'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground'
            )
          }
        >
          <LayoutDashboard className="h-4 w-4" />
          Dashboard
        </NavLink>

        {/* Menu Groups */}
        {menuGroups.map(group => (
          <div key={group.label} className="mt-2">
            <button
              onClick={() => toggleMenu(group.label)}
              className="flex w-full items-center justify-between px-6 py-2.5 text-sm text-sidebar-foreground/70 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground transition-colors"
            >
              <span className="flex items-center gap-3">
                {group.icon}
                {group.label}
              </span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 transition-transform',
                  openMenus.has(group.label) && 'rotate-180'
                )}
              />
            </button>

            {openMenus.has(group.label) && (
              <div className="mt-1 space-y-1">
                {group.items.map(item => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 pl-10 pr-6 py-2 text-sm transition-colors',
                        isActive
                          ? 'bg-sidebar-accent/20 text-sidebar-accent border-r-2 border-sidebar-accent'
                          : 'text-sidebar-foreground/60 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground'
                      )
                    }
                  >
                    {item.icon}
                    {item.label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Integrations */}
      <div className="border-t border-sidebar-foreground/10 p-4 space-y-1">
        <p className="px-2 mb-2 text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider">
          Integrations
        </p>
        <NavLink
          to="/pm-sync"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-2 py-2 text-sm rounded-md transition-colors',
              isActive
                ? 'bg-sidebar-accent/20 text-sidebar-accent'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground'
            )
          }
        >
          <Link className="h-4 w-4" />
          Practice Manager
        </NavLink>
        <NavLink
          to="/traces"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-2 py-2 text-sm rounded-md transition-colors',
              isActive
                ? 'bg-sidebar-accent/20 text-sidebar-accent'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground'
            )
          }
        >
          <FileSearch className="h-4 w-4" />
          TRACES
        </NavLink>
      </div>

      {/* Settings & Admin */}
      <div className="border-t border-sidebar-foreground/10 p-4 space-y-1">
        <NavLink
          to="/users"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-2 py-2 text-sm rounded-md transition-colors',
              isActive
                ? 'bg-sidebar-accent/20 text-sidebar-accent'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground'
            )
          }
        >
          <UserPlus className="h-4 w-4" />
          User Management
        </NavLink>
        <NavLink
          to="/audit-log"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-2 py-2 text-sm rounded-md transition-colors',
              isActive
                ? 'bg-sidebar-accent/20 text-sidebar-accent'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground'
            )
          }
        >
          <History className="h-4 w-4" />
          Audit Log
        </NavLink>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-2 py-2 text-sm rounded-md transition-colors',
              isActive
                ? 'bg-sidebar-accent/20 text-sidebar-accent'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground'
            )
          }
        >
          <Settings className="h-4 w-4" />
          Settings
        </NavLink>
      </div>
    </div>
  );
}
