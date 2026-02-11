import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  Users,
  DollarSign,
  TrendingUp,
  ArrowUpRight,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: async () => {
      const response = await fetch('/api/admin/dashboard', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your ZaraBooks platform
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Tenants
            </CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totals?.tenants || 0}</div>
            <div className="flex items-center text-sm text-green-600">
              <ArrowUpRight className="h-4 w-4 mr-1" />
              +{stats?.growth?.newTenantsLast30Days || 0} last 30 days
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Partners
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totals?.partners || 0}</div>
            <div className="flex items-center text-sm text-green-600">
              <ArrowUpRight className="h-4 w-4 mr-1" />
              +{stats?.growth?.newPartnersLast30Days || 0} last 30 days
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Monthly Revenue
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{parseFloat(stats?.revenue?.mrr || 0).toLocaleString('en-IN')}
            </div>
            <div className="text-sm text-muted-foreground">
              {stats?.totals?.activeSubscriptions || 0} active subscriptions
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Commissions
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{parseFloat(stats?.revenue?.pendingCommissions || 0).toLocaleString('en-IN')}
            </div>
            <div className="text-sm text-muted-foreground">
              Awaiting approval/payout
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Distribution Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Partner Tiers</CardTitle>
            <CardDescription>Distribution of partners by tier</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats?.distributions?.partnerTiers?.map((tier: any) => (
                <div key={tier.tier} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        tier.tier === 'bronze'
                          ? 'bg-orange-400'
                          : tier.tier === 'silver'
                          ? 'bg-gray-400'
                          : tier.tier === 'gold'
                          ? 'bg-yellow-400'
                          : 'bg-purple-400'
                      }`}
                    />
                    <span className="capitalize font-medium">{tier.tier}</span>
                  </div>
                  <span className="text-muted-foreground">{tier.count}</span>
                </div>
              ))}
              {(!stats?.distributions?.partnerTiers || stats?.distributions?.partnerTiers.length === 0) && (
                <p className="text-sm text-muted-foreground">No partners yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Subscription Plans</CardTitle>
            <CardDescription>Distribution of tenants by plan</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats?.distributions?.subscriptionPlans?.map((plan: any) => (
                <div key={plan.plan} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        plan.plan === 'free'
                          ? 'bg-gray-400'
                          : plan.plan === 'starter'
                          ? 'bg-blue-400'
                          : plan.plan === 'professional'
                          ? 'bg-green-400'
                          : 'bg-purple-400'
                      }`}
                    />
                    <span className="capitalize font-medium">{plan.plan}</span>
                  </div>
                  <span className="text-muted-foreground">{plan.count}</span>
                </div>
              ))}
              {(!stats?.distributions?.subscriptionPlans || stats?.distributions?.subscriptionPlans.length === 0) && (
                <p className="text-sm text-muted-foreground">No tenants yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total Users</div>
            <div className="text-xl font-bold">{stats?.totals?.users || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total Companies</div>
            <div className="text-xl font-bold">{stats?.totals?.companies || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Active Subs</div>
            <div className="text-xl font-bold">{stats?.totals?.activeSubscriptions || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Conversion Rate</div>
            <div className="text-xl font-bold">
              {stats?.totals?.tenants > 0
                ? Math.round((stats?.totals?.activeSubscriptions / stats?.totals?.tenants) * 100)
                : 0}%
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
