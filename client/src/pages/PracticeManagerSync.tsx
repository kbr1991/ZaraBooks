import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/useToast';
import {
  Link2,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  CreditCard,
  Users,
  Settings2,
  ArrowDownToLine,
  Clock,
  Loader2,
} from 'lucide-react';

interface PMConfig {
  id: string;
  pmBaseUrl: string;
  apiKey: string;
  syncEnabled: boolean;
  autoSyncInvoices: boolean;
  autoSyncPayments: boolean;
  autoSyncExpenses: boolean;
  defaultRevenueAccountId: string | null;
  defaultBankAccountId: string | null;
  defaultExpenseAccountId: string | null;
  defaultReceivableAccountId: string | null;
  lastSyncAt: string | null;
}

interface SyncLog {
  id: string;
  entityType: string;
  pmEntityId: string;
  zarabooksEntryId: string | null;
  syncDirection: string;
  syncStatus: string;
  errorMessage: string | null;
  createdAt: string;
}

interface Account {
  id: string;
  code: string;
  name: string;
}

export default function PracticeManagerSync() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'settings' | 'logs'>('dashboard');

  // Fetch PM config
  const { data: config } = useQuery<PMConfig>({
    queryKey: ['pm-config'],
    queryFn: async () => {
      const response = await fetch('/api/pm-integration/config', {
        credentials: 'include',
      });
      if (!response.ok) return null;
      return response.json();
    },
  });

  // Fetch sync logs
  const { data: logs, isLoading: logsLoading } = useQuery<SyncLog[]>({
    queryKey: ['pm-sync-logs'],
    queryFn: async () => {
      const response = await fetch('/api/pm-integration/logs?limit=50', {
        credentials: 'include',
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: activeTab === 'logs' || activeTab === 'dashboard',
  });

  // Fetch accounts for mapping
  const { data: accounts } = useQuery<Account[]>({
    queryKey: ['ledger-accounts'],
    queryFn: async () => {
      const response = await fetch('/api/chart-of-accounts/ledgers/list', {
        credentials: 'include',
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: activeTab === 'settings',
  });

  // Config form state
  const [formData, setFormData] = useState({
    pmBaseUrl: config?.pmBaseUrl || '',
    apiKey: '',
    syncEnabled: config?.syncEnabled || false,
    autoSyncInvoices: config?.autoSyncInvoices ?? true,
    autoSyncPayments: config?.autoSyncPayments ?? true,
    autoSyncExpenses: config?.autoSyncExpenses ?? true,
    defaultRevenueAccountId: config?.defaultRevenueAccountId || '',
    defaultBankAccountId: config?.defaultBankAccountId || '',
    defaultExpenseAccountId: config?.defaultExpenseAccountId || '',
    defaultReceivableAccountId: config?.defaultReceivableAccountId || '',
  });

  // Save config mutation
  const saveConfigMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch('/api/pm-integration/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to save config');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pm-config'] });
      toast({ title: 'Configuration saved' });
    },
    onError: () => {
      toast({ title: 'Failed to save configuration', variant: 'destructive' });
    },
  });

  // Test connection mutation
  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/pm-integration/test-connection', {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Connection failed');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Connection successful', description: 'Practice Manager is reachable' });
    },
    onError: () => {
      toast({ title: 'Connection failed', variant: 'destructive' });
    },
  });

  // Sync mutations
  const syncInvoicesMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/pm-integration/sync/invoices', {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Sync failed');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pm-sync-logs'] });
      queryClient.invalidateQueries({ queryKey: ['pm-config'] });
      toast({
        title: 'Invoice sync complete',
        description: `Synced: ${data.synced}, Failed: ${data.failed}`,
      });
    },
    onError: () => {
      toast({ title: 'Invoice sync failed', variant: 'destructive' });
    },
  });

  const syncPaymentsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/pm-integration/sync/payments', {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Sync failed');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pm-sync-logs'] });
      queryClient.invalidateQueries({ queryKey: ['pm-config'] });
      toast({
        title: 'Payment sync complete',
        description: `Synced: ${data.synced}, Failed: ${data.failed}`,
      });
    },
    onError: () => {
      toast({ title: 'Payment sync failed', variant: 'destructive' });
    },
  });

  const importClientsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/pm-integration/import/clients', {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Import failed');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['parties'] });
      toast({
        title: 'Client import complete',
        description: `Imported: ${data.imported}, Skipped: ${data.skipped}`,
      });
    },
    onError: () => {
      toast({ title: 'Client import failed', variant: 'destructive' });
    },
  });

  const isConfigured = config?.pmBaseUrl && config?.apiKey;
  const recentLogs = logs?.slice(0, 5) || [];
  const successCount = logs?.filter((l) => l.syncStatus === 'success').length || 0;
  const failedCount = logs?.filter((l) => l.syncStatus === 'failed').length || 0;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'invoice':
        return <FileText className="h-4 w-4" />;
      case 'payment':
        return <CreditCard className="h-4 w-4" />;
      case 'client':
        return <Users className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Practice Manager Sync</h1>
          <p className="text-muted-foreground">
            Sync invoices, payments, and clients from CA Practice Manager
          </p>
        </div>
        <div className="flex items-center gap-2">
          {config?.lastSyncAt && (
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="h-4 w-4" />
              Last sync: {formatDate(config.lastSyncAt)}
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: Link2 },
          { id: 'settings', label: 'Settings', icon: Settings2 },
          { id: 'logs', label: 'Sync Logs', icon: FileText },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Status */}
          {!isConfigured ? (
            <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <AlertTriangle className="h-8 w-8 text-yellow-500" />
                  <div>
                    <h3 className="font-semibold">Integration Not Configured</h3>
                    <p className="text-sm text-muted-foreground">
                      Please configure the Practice Manager connection in Settings
                    </p>
                  </div>
                  <Button className="ml-auto" onClick={() => setActiveTab('settings')}>
                    Configure
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Stats */}
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Connection Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span className="font-medium text-green-600">Connected</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Successful Syncs</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{successCount}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Failed Syncs</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">{failedCount}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Sync Enabled</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      {config?.syncEnabled ? (
                        <>
                          <CheckCircle className="h-5 w-5 text-green-500" />
                          <span>Active</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-5 w-5 text-gray-400" />
                          <span className="text-muted-foreground">Disabled</span>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Sync Actions */}
              <Card>
                <CardHeader>
                  <CardTitle>Sync Actions</CardTitle>
                  <CardDescription>
                    Manually trigger sync operations
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center gap-3 mb-3">
                        <FileText className="h-8 w-8 text-blue-500" />
                        <div>
                          <h4 className="font-medium">Invoices</h4>
                          <p className="text-sm text-muted-foreground">
                            Import approved invoices
                          </p>
                        </div>
                      </div>
                      <Button
                        className="w-full"
                        onClick={() => syncInvoicesMutation.mutate()}
                        disabled={syncInvoicesMutation.isPending}
                      >
                        {syncInvoicesMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <ArrowDownToLine className="h-4 w-4 mr-2" />
                        )}
                        Sync Invoices
                      </Button>
                    </div>

                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center gap-3 mb-3">
                        <CreditCard className="h-8 w-8 text-green-500" />
                        <div>
                          <h4 className="font-medium">Payments</h4>
                          <p className="text-sm text-muted-foreground">
                            Import payment receipts
                          </p>
                        </div>
                      </div>
                      <Button
                        className="w-full"
                        onClick={() => syncPaymentsMutation.mutate()}
                        disabled={syncPaymentsMutation.isPending}
                      >
                        {syncPaymentsMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <ArrowDownToLine className="h-4 w-4 mr-2" />
                        )}
                        Sync Payments
                      </Button>
                    </div>

                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center gap-3 mb-3">
                        <Users className="h-8 w-8 text-purple-500" />
                        <div>
                          <h4 className="font-medium">Clients</h4>
                          <p className="text-sm text-muted-foreground">
                            Import client master
                          </p>
                        </div>
                      </div>
                      <Button
                        className="w-full"
                        onClick={() => importClientsMutation.mutate()}
                        disabled={importClientsMutation.isPending}
                      >
                        {importClientsMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <ArrowDownToLine className="h-4 w-4 mr-2" />
                        )}
                        Import Clients
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Sync Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  {recentLogs.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">
                      No sync activity yet
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>PM Entity</TableHead>
                          <TableHead>Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentLogs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {getEntityIcon(log.entityType)}
                                <span className="capitalize">{log.entityType}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {getStatusIcon(log.syncStatus)}
                                <span className="capitalize">{log.syncStatus}</span>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {log.pmEntityId.substring(0, 8)}...
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatDate(log.createdAt)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Connection Settings</CardTitle>
              <CardDescription>
                Configure the connection to your Practice Manager instance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Practice Manager URL</Label>
                  <Input
                    placeholder="https://pm.example.com"
                    value={formData.pmBaseUrl}
                    onChange={(e) => setFormData({ ...formData, pmBaseUrl: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <Input
                    type="password"
                    placeholder="Enter API key"
                    value={formData.apiKey}
                    onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label>Enable Sync</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow data synchronization between systems
                  </p>
                </div>
                <Switch
                  checked={formData.syncEnabled}
                  onCheckedChange={(checked: boolean) => setFormData({ ...formData, syncEnabled: checked })}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => testConnectionMutation.mutate()}
                  disabled={testConnectionMutation.isPending}
                >
                  {testConnectionMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Test Connection
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Auto-Sync Settings</CardTitle>
              <CardDescription>
                Choose what to sync automatically
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-sync Invoices</Label>
                  <p className="text-sm text-muted-foreground">
                    Create journal entries from approved invoices
                  </p>
                </div>
                <Switch
                  checked={formData.autoSyncInvoices}
                  onCheckedChange={(checked: boolean) =>
                    setFormData({ ...formData, autoSyncInvoices: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-sync Payments</Label>
                  <p className="text-sm text-muted-foreground">
                    Create bank entries from payment receipts
                  </p>
                </div>
                <Switch
                  checked={formData.autoSyncPayments}
                  onCheckedChange={(checked: boolean) =>
                    setFormData({ ...formData, autoSyncPayments: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-sync Expenses</Label>
                  <p className="text-sm text-muted-foreground">
                    Create expense entries from approved expenses
                  </p>
                </div>
                <Switch
                  checked={formData.autoSyncExpenses}
                  onCheckedChange={(checked: boolean) =>
                    setFormData({ ...formData, autoSyncExpenses: checked })
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Account Mapping</CardTitle>
              <CardDescription>
                Map Practice Manager transactions to Zara Books accounts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Revenue Account</Label>
                  <Select
                    value={formData.defaultRevenueAccountId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, defaultRevenueAccountId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts
                        ?.filter((a) => a.code.startsWith('4'))
                        .map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.code} - {account.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Bank Account</Label>
                  <Select
                    value={formData.defaultBankAccountId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, defaultBankAccountId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts
                        ?.filter((a) => a.code.startsWith('1'))
                        .map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.code} - {account.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Receivables Account</Label>
                  <Select
                    value={formData.defaultReceivableAccountId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, defaultReceivableAccountId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts
                        ?.filter((a) => a.code.startsWith('1'))
                        .map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.code} - {account.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Expense Account</Label>
                  <Select
                    value={formData.defaultExpenseAccountId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, defaultExpenseAccountId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts
                        ?.filter((a) => a.code.startsWith('5'))
                        .map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.code} - {account.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              onClick={() => saveConfigMutation.mutate(formData)}
              disabled={saveConfigMutation.isPending}
            >
              {saveConfigMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Save Configuration
            </Button>
          </div>
        </div>
      )}

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <Card>
          <CardHeader>
            <CardTitle>Sync Logs</CardTitle>
            <CardDescription>
              View all synchronization activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            {logsLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : logs?.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                No sync logs found
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>PM Entity</TableHead>
                    <TableHead>ZB Entry</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs?.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {formatDate(log.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getEntityIcon(log.entityType)}
                          <span className="capitalize">{log.entityType}</span>
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">{log.syncDirection}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(log.syncStatus)}
                          <span className="capitalize">{log.syncStatus}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {log.pmEntityId.substring(0, 8)}...
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {log.zarabooksEntryId
                          ? `${log.zarabooksEntryId.substring(0, 8)}...`
                          : '-'}
                      </TableCell>
                      <TableCell className="text-sm text-red-600 max-w-[200px] truncate">
                        {log.errorMessage || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
