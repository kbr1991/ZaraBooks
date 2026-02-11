import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Users,
  Wallet,
  DollarSign,
  UserPlus,
  LogOut,
  Menu,
  ChevronRight,
  Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/partner', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { path: '/partner/clients', label: 'Clients', icon: Users },
  { path: '/partner/commissions', label: 'Commissions', icon: DollarSign },
  { path: '/partner/payouts', label: 'Payouts', icon: Wallet },
  { path: '/partner/team', label: 'Team', icon: UserPlus },
];

export default function PartnerLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const { data: session } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const response = await fetch('/api/auth/me', { credentials: 'include' });
      if (!response.ok) throw new Error('Not authenticated');
      return response.json();
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    },
    onSuccess: () => {
      queryClient.clear();
      navigate('/login');
    },
  });

  const switchToTenantMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/auth/switch-to-tenant', {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to switch');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session'] });
      navigate('/');
    },
  });

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          'flex flex-col bg-card border-r transition-all duration-200',
          sidebarOpen ? 'w-64' : 'w-16'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">ZB</span>
              </div>
              <div>
                <p className="font-semibold text-sm">ZaraBooks</p>
                <p className="text-xs text-muted-foreground">Partner Portal</p>
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <ChevronRight className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )
              }
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {sidebarOpen && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t space-y-2">
          {sidebarOpen && session?.partner && (
            <div className="px-3 py-2 text-sm">
              <p className="font-medium truncate">{session.partner.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {session.user?.email}
              </p>
            </div>
          )}
          {session?.tenants?.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={() => switchToTenantMutation.mutate()}
            >
              <Building2 className="h-4 w-4" />
              {sidebarOpen && 'Switch to Tenant'}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground"
            onClick={() => logoutMutation.mutate()}
          >
            <LogOut className="h-4 w-4" />
            {sidebarOpen && 'Logout'}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
