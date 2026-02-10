import { useQuery } from '@tanstack/react-query';
import {
  Users,
  DollarSign,
  TrendingUp,
  Wallet,
  ArrowUpRight,
  Copy,
  Check,
} from 'lucide-react';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export default function PartnerDashboard() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['partner-dashboard'],
    queryFn: async () => {
      const response = await fetch('/api/partner/dashboard', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
  });

  const copyReferralLink = () => {
    const link = `${window.location.origin}/signup?ref=${stats?.partner?.referralCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast({ title: 'Referral link copied!' });
    setTimeout(() => setCopied(false), 2000);
  };

  const getTierBadge = (tier: string) => {
    const colors: Record<string, string> = {
      bronze: 'bg-orange-100 text-orange-800 border-orange-200',
      silver: 'bg-gray-100 text-gray-800 border-gray-200',
      gold: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      platinum: 'bg-purple-100 text-purple-800 border-purple-200',
    };
    return (
      <Badge variant="outline" className={`capitalize ${colors[tier] || ''}`}>
        {tier}
      </Badge>
    );
  };

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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Partner Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {stats?.partner?.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {getTierBadge(stats?.partner?.tier || 'bronze')}
          <span className="text-sm text-muted-foreground">
            {stats?.partner?.commissionRate}% commission
          </span>
        </div>
      </div>

      {/* Referral Link */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Your Referral Link</CardTitle>
          <CardDescription>
            Share this link to refer new clients and earn commissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <code className="flex-1 p-3 bg-muted rounded-lg text-sm font-mono truncate">
              {window.location.origin}/signup?ref={stats?.partner?.referralCode}
            </code>
            <Button onClick={copyReferralLink}>
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Referral Code: <span className="font-mono font-medium">{stats?.partner?.referralCode}</span>
          </p>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Clients
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.stats?.totalClients || 0}</div>
            <div className="flex items-center text-sm text-green-600">
              <ArrowUpRight className="h-4 w-4 mr-1" />
              +{stats?.stats?.newClientsThisMonth || 0} this month
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Subscriptions
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.stats?.activeSubscriptions || 0}</div>
            <div className="text-sm text-muted-foreground">
              Generating commissions
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Earnings
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {'\u20B9'}{parseFloat(stats?.stats?.totalEarnings || 0).toLocaleString('en-IN')}
            </div>
            <div className="text-sm text-muted-foreground">
              Lifetime earnings
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Payout
            </CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {'\u20B9'}{parseFloat(stats?.stats?.pendingPayout || 0).toLocaleString('en-IN')}
            </div>
            <div className="text-sm text-muted-foreground">
              Approved commissions
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Commission Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Commission Status</CardTitle>
            <CardDescription>Breakdown of your commissions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <span>Pending Approval</span>
                </div>
                <span className="font-medium">
                  {'\u20B9'}{parseFloat(stats?.commissions?.pending || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-blue-400" />
                  <span>Approved</span>
                </div>
                <span className="font-medium">
                  {'\u20B9'}{parseFloat(stats?.commissions?.approved || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                  <span>Paid Out</span>
                </div>
                <span className="font-medium">
                  {'\u20B9'}{parseFloat(stats?.commissions?.paid || 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tier Progress</CardTitle>
            <CardDescription>Progress to next tier</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span>Current Tier</span>
                {getTierBadge(stats?.partner?.tier || 'bronze')}
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Total Referrals</span>
                <span className="font-medium">{stats?.stats?.totalClients || 0}</span>
              </div>
              {stats?.tierProgress && (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Next Tier: {stats.tierProgress.nextTier}</span>
                      <span>{stats.tierProgress.referralsNeeded} more referrals</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${stats.tierProgress.progress}%` }}
                      />
                    </div>
                  </div>
                </>
              )}
              {!stats?.tierProgress && (
                <p className="text-sm text-muted-foreground">
                  You've reached the highest tier!
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Clients</CardTitle>
          <CardDescription>Your latest referred clients</CardDescription>
        </CardHeader>
        <CardContent>
          {stats?.recentClients?.length > 0 ? (
            <div className="space-y-4">
              {stats.recentClients.map((client: any) => (
                <div
                  key={client.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div>
                    <p className="font-medium">{client.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(client.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {client.subscriptionPlan}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No clients yet. Share your referral link to get started!
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
