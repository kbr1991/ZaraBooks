import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import {
  Bell,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  XCircle,
  RefreshCw,
  Eye,
  Check,
  Clock,
  TrendingDown,
  Calendar,
  DollarSign,
  Receipt,
  FileText,
  Settings,
  BellOff,
} from 'lucide-react';

interface SmartAlert {
  id: string;
  alertType: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  data?: any;
  isRead: boolean;
  isDismissed: boolean;
  actionUrl?: string;
  createdAt: string;
  expiresAt?: string;
}

interface AlertCounts {
  total: number;
  unread: number;
  critical: number;
  warning: number;
  info: number;
}

export default function SmartAlerts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [showSettings, setShowSettings] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<SmartAlert | null>(null);

  // Fetch alerts
  const { data: alerts, isLoading } = useQuery<SmartAlert[]>({
    queryKey: ['/api/alerts', { severity: severityFilter !== 'all' ? severityFilter : undefined }],
  });

  // Fetch counts
  const { data: counts } = useQuery<AlertCounts>({
    queryKey: ['/api/alerts/counts'],
  });

  // Mark as read mutation
  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/alerts/${id}/read`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/alerts'] });
    },
  });

  // Mark all as read mutation
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/alerts/mark-all-read', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/alerts'] });
      toast({ title: 'All alerts marked as read' });
    },
  });

  // Dismiss mutation
  const dismissMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/alerts/${id}/dismiss`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/alerts'] });
      toast({ title: 'Alert dismissed' });
    },
  });

  // Dismiss all mutation
  const dismissAllMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/alerts/dismiss-all', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/alerts'] });
      toast({ title: 'All alerts dismissed' });
    },
  });

  // Run checks mutation
  const runChecksMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/alerts/check', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/alerts'] });
      toast({ title: `Created ${data.created} new alerts` });
    },
  });

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-orange-600" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-600" />;
      default:
        return <Bell className="w-5 h-5" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <Badge variant="destructive">Critical</Badge>;
      case 'warning':
        return <Badge className="bg-orange-100 text-orange-800">Warning</Badge>;
      case 'info':
        return <Badge variant="secondary">Info</Badge>;
      default:
        return <Badge>{severity}</Badge>;
    }
  };

  const getAlertTypeIcon = (type: string) => {
    switch (type) {
      case 'low_cash':
        return <TrendingDown className="w-4 h-4" />;
      case 'overdue_invoices':
        return <Clock className="w-4 h-4" />;
      case 'gst_deadline':
        return <Calendar className="w-4 h-4" />;
      case 'tds_threshold':
        return <Receipt className="w-4 h-4" />;
      case 'expense_limit':
        return <DollarSign className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const formatAlertTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Smart Alerts</h1>
          <p className="text-gray-500">Proactive notifications for your business</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => runChecksMutation.mutate()}
            disabled={runChecksMutation.isPending}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${runChecksMutation.isPending ? 'animate-spin' : ''}`} />
            Check Now
          </Button>
          <Button variant="outline" onClick={() => setShowSettings(true)}>
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Alert Counts */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unread</CardTitle>
            <Bell className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts?.unread || 0}</div>
            <p className="text-xs text-muted-foreground">New alerts</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{counts?.critical || 0}</div>
            <p className="text-xs text-muted-foreground">Need immediate attention</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Warnings</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{counts?.warning || 0}</div>
            <p className="text-xs text-muted-foreground">Review recommended</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Info</CardTitle>
            <Info className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts?.info || 0}</div>
            <p className="text-xs text-muted-foreground">For your information</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions Bar */}
      <div className="flex justify-between items-center">
        <Tabs value={severityFilter} onValueChange={setSeverityFilter}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="critical">Critical</TabsTrigger>
            <TabsTrigger value="warning">Warning</TabsTrigger>
            <TabsTrigger value="info">Info</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending || !counts?.unread}
          >
            <Check className="w-4 h-4 mr-2" />
            Mark All Read
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => dismissAllMutation.mutate()}
            disabled={dismissAllMutation.isPending || !counts?.total}
          >
            <BellOff className="w-4 h-4 mr-2" />
            Dismiss All
          </Button>
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-4">
        {isLoading ? (
          [...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-20" />
              </CardContent>
            </Card>
          ))
        ) : alerts?.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle className="w-12 h-12 mx-auto text-green-600 mb-4" />
              <p className="text-lg font-medium">All clear!</p>
              <p className="text-muted-foreground">No alerts to show right now</p>
            </CardContent>
          </Card>
        ) : (
          alerts?.map((alert) => (
            <Card
              key={alert.id}
              className={`cursor-pointer hover:border-primary transition-colors ${!alert.isRead ? 'border-l-4 border-l-primary' : ''}`}
              onClick={() => {
                setSelectedAlert(alert);
                if (!alert.isRead) {
                  markReadMutation.mutate(alert.id);
                }
              }}
            >
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-lg ${
                    alert.severity === 'critical' ? 'bg-red-100' :
                    alert.severity === 'warning' ? 'bg-orange-100' : 'bg-blue-100'
                  }`}>
                    {getSeverityIcon(alert.severity)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className={`font-semibold ${!alert.isRead ? 'text-primary' : ''}`}>
                        {alert.title}
                      </h3>
                      {getSeverityBadge(alert.severity)}
                      {!alert.isRead && (
                        <Badge variant="outline" className="text-xs">New</Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground">{alert.message}</p>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        {getAlertTypeIcon(alert.alertType)}
                        {alert.alertType.replace(/_/g, ' ')}
                      </span>
                      <span>{formatAlertTime(alert.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {alert.actionUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.location.href = alert.actionUrl!;
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        dismissMutation.mutate(alert.id);
                      }}
                    >
                      <XCircle className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Alert Detail Dialog */}
      <Dialog open={!!selectedAlert} onOpenChange={() => setSelectedAlert(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedAlert && getSeverityIcon(selectedAlert.severity)}
              {selectedAlert?.title}
            </DialogTitle>
            <DialogDescription>
              {selectedAlert?.message}
            </DialogDescription>
          </DialogHeader>
          {selectedAlert?.data && (
            <div className="p-4 bg-muted rounded-lg">
              <pre className="text-sm overflow-auto">
                {JSON.stringify(selectedAlert.data, null, 2)}
              </pre>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedAlert(null)}>
              Close
            </Button>
            {selectedAlert?.actionUrl && (
              <Button onClick={() => window.location.href = selectedAlert.actionUrl!}>
                Take Action
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alert Settings</DialogTitle>
            <DialogDescription>
              Configure thresholds and notification preferences
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">Low Cash Warning</h4>
              <p className="text-sm text-muted-foreground">
                Alert when bank balance falls below threshold
              </p>
              <p className="mt-2 font-semibold">Threshold: {formatCurrency(50000)}</p>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">Overdue Invoice Alert</h4>
              <p className="text-sm text-muted-foreground">
                Alert when invoices are overdue by specified days
              </p>
              <p className="mt-2 font-semibold">Days: 7</p>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">GST Deadline Reminder</h4>
              <p className="text-sm text-muted-foreground">
                Remind before GST filing deadlines
              </p>
              <p className="mt-2 font-semibold">Days before: 5</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettings(false)}>
              Close
            </Button>
            <Button onClick={() => setShowSettings(false)}>
              Save Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
