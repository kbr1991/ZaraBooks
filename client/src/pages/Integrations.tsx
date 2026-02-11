import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { useToast } from '@/hooks/use-toast';
import {
  Store,
  Webhook,
  Plus,
  RefreshCw,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  Settings,
  ExternalLink,
  Copy,
  Eye,
  Play,
  Pause,
  Link2,
  AlertTriangle,
} from 'lucide-react';

interface Integration {
  id: string;
  platform: string;
  connectionName: string;
  storeUrl?: string;
  isActive: boolean;
  lastSyncAt?: string;
  lastSyncStatus?: string;
  totalOrdersSynced?: number;
  totalProductsSynced?: number;
  createdAt: string;
}

interface WebhookConfig {
  id: string;
  name: string;
  eventType: string;
  targetUrl: string;
  secret?: string;
  isActive: boolean;
  lastTriggeredAt?: string;
  lastStatus?: number;
  consecutiveFailures?: number;
  autoDisabledAt?: string;
  totalTriggered?: number;
  createdAt: string;
}

interface Platform {
  id: string;
  name: string;
  description: string;
  features: string[];
  requiredFields: string[];
  logo?: string;
  comingSoon?: boolean;
}

interface WebhookEvent {
  event: string;
  description: string;
}

export default function Integrations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('connections');
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [showWebhookDialog, setShowWebhookDialog] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
  const [connectionForm, setConnectionForm] = useState({
    connectionName: '',
    storeUrl: '',
    accessToken: '',
    consumerKey: '',
    consumerSecret: '',
  });
  const [webhookForm, setWebhookForm] = useState({
    name: '',
    eventType: '',
    targetUrl: '',
  });

  // Fetch connections
  const { data: connections, isLoading: connectionsLoading } = useQuery<Integration[]>({
    queryKey: ['/api/integrations/connections'],
  });

  // Fetch webhooks
  const { data: webhooks, isLoading: webhooksLoading } = useQuery<WebhookConfig[]>({
    queryKey: ['/api/integrations/webhooks'],
  });

  // Fetch platforms
  const { data: platforms } = useQuery<Platform[]>({
    queryKey: ['/api/integrations/platforms'],
  });

  // Fetch webhook events
  const { data: webhookEvents } = useQuery<WebhookEvent[]>({
    queryKey: ['/api/integrations/webhook-events'],
  });

  // Create connection mutation
  const createConnectionMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/integrations/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/connections'] });
      toast({ title: 'Connection created' });
      setShowConnectDialog(false);
      resetConnectionForm();
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to connect', description: error.message, variant: 'destructive' });
    },
  });

  // Test connection mutation
  const testConnectionMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/integrations/connections/${id}/test`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.success ? 'Connection successful' : 'Connection failed',
        description: data.message,
        variant: data.success ? 'default' : 'destructive',
      });
    },
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/integrations/connections/${id}/sync`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/connections'] });
      toast({ title: 'Sync completed', description: data.message });
    },
    onError: (error: Error) => {
      toast({ title: 'Sync failed', description: error.message, variant: 'destructive' });
    },
  });

  // Delete connection mutation
  const deleteConnectionMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/integrations/connections/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/connections'] });
      toast({ title: 'Connection deleted' });
    },
  });

  // Create webhook mutation
  const createWebhookMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/integrations/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/webhooks'] });
      toast({
        title: 'Webhook created',
        description: `Secret: ${data.secret}. Save this, it won't be shown again.`,
      });
      setShowWebhookDialog(false);
      setWebhookForm({ name: '', eventType: '', targetUrl: '' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create', description: error.message, variant: 'destructive' });
    },
  });

  // Test webhook mutation
  const testWebhookMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/integrations/webhooks/${id}/test`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/webhooks'] });
      toast({
        title: data.success ? 'Webhook test successful' : 'Webhook test failed',
        description: data.error || `Status: ${data.responseStatus}`,
        variant: data.success ? 'default' : 'destructive',
      });
    },
  });

  // Delete webhook mutation
  const deleteWebhookMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/integrations/webhooks/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/webhooks'] });
      toast({ title: 'Webhook deleted' });
    },
  });

  // Toggle webhook mutation
  const toggleWebhookMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/integrations/webhooks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/webhooks'] });
    },
  });

  const resetConnectionForm = () => {
    setConnectionForm({
      connectionName: '',
      storeUrl: '',
      accessToken: '',
      consumerKey: '',
      consumerSecret: '',
    });
    setSelectedPlatform(null);
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="outline" className="text-green-600"><CheckCircle className="w-3 h-3 mr-1" />Success</Badge>;
      case 'failed':
        return <Badge variant="outline" className="text-red-600"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Integrations</h1>
          <p className="text-gray-500">Connect e-commerce platforms and configure webhooks</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="connections">
            <Store className="w-4 h-4 mr-2" />
            E-commerce
          </TabsTrigger>
          <TabsTrigger value="webhooks">
            <Webhook className="w-4 h-4 mr-2" />
            Webhooks
          </TabsTrigger>
        </TabsList>

        <TabsContent value="connections" className="space-y-6">
          {/* Available Platforms */}
          <Card>
            <CardHeader>
              <CardTitle>Connect a Platform</CardTitle>
              <CardDescription>Sync orders and products from your online store</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
                {platforms?.map((platform) => (
                  <Card
                    key={platform.id}
                    className={`cursor-pointer hover:border-primary transition-colors ${platform.comingSoon ? 'opacity-60' : ''}`}
                    onClick={() => {
                      if (!platform.comingSoon) {
                        setSelectedPlatform(platform);
                        setShowConnectDialog(true);
                      }
                    }}
                  >
                    <CardContent className="pt-6 text-center">
                      <div className="w-12 h-12 mx-auto mb-3 bg-muted rounded-lg flex items-center justify-center">
                        <Store className="w-6 h-6" />
                      </div>
                      <h4 className="font-medium">{platform.name}</h4>
                      {platform.comingSoon ? (
                        <Badge variant="secondary" className="mt-2">Coming Soon</Badge>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-1">Click to connect</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Active Connections */}
          <Card>
            <CardHeader>
              <CardTitle>Active Connections</CardTitle>
            </CardHeader>
            <CardContent>
              {connectionsLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : connections?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Link2 className="w-12 h-12 mx-auto mb-4" />
                  <p>No connections yet</p>
                  <p className="text-sm">Connect a platform above to get started</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Platform</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Store URL</TableHead>
                      <TableHead>Last Sync</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Synced</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {connections?.map((conn) => (
                      <TableRow key={conn.id}>
                        <TableCell>
                          <Badge>{conn.platform}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{conn.connectionName}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {conn.storeUrl ? (
                            <a href={conn.storeUrl} target="_blank" rel="noopener" className="hover:underline flex items-center gap-1">
                              {new URL(conn.storeUrl).hostname}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          {conn.lastSyncAt ? new Date(conn.lastSyncAt).toLocaleString() : 'Never'}
                        </TableCell>
                        <TableCell>{getStatusBadge(conn.lastSyncStatus)}</TableCell>
                        <TableCell>
                          {conn.totalOrdersSynced || 0} orders
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => testConnectionMutation.mutate(conn.id)}
                              disabled={testConnectionMutation.isPending}
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => syncMutation.mutate(conn.id)}
                              disabled={syncMutation.isPending}
                            >
                              <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (confirm('Delete this connection?')) {
                                  deleteConnectionMutation.mutate(conn.id);
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="webhooks" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Outbound Webhooks</CardTitle>
                <CardDescription>Send notifications to external services when events occur</CardDescription>
              </div>
              <Button onClick={() => setShowWebhookDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Webhook
              </Button>
            </CardHeader>
            <CardContent>
              {webhooksLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : webhooks?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Webhook className="w-12 h-12 mx-auto mb-4" />
                  <p>No webhooks configured</p>
                  <p className="text-sm">Add a webhook to send events to external services</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>URL</TableHead>
                      <TableHead>Last Triggered</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {webhooks?.map((webhook) => (
                      <TableRow key={webhook.id}>
                        <TableCell className="font-medium">{webhook.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{webhook.eventType}</Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-muted-foreground">
                          {webhook.targetUrl}
                        </TableCell>
                        <TableCell>
                          {webhook.lastTriggeredAt ? new Date(webhook.lastTriggeredAt).toLocaleString() : 'Never'}
                        </TableCell>
                        <TableCell>
                          {webhook.autoDisabledAt ? (
                            <Badge variant="destructive" className="flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Auto-disabled
                            </Badge>
                          ) : webhook.lastStatus ? (
                            <Badge variant={webhook.lastStatus < 400 ? 'outline' : 'destructive'}>
                              {webhook.lastStatus}
                            </Badge>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={webhook.isActive}
                            onCheckedChange={(checked) =>
                              toggleWebhookMutation.mutate({ id: webhook.id, isActive: checked })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => testWebhookMutation.mutate(webhook.id)}
                              disabled={testWebhookMutation.isPending}
                            >
                              <Play className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (confirm('Delete this webhook?')) {
                                  deleteWebhookMutation.mutate(webhook.id);
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Connect Platform Dialog */}
      <Dialog open={showConnectDialog} onOpenChange={setShowConnectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect {selectedPlatform?.name}</DialogTitle>
            <DialogDescription>
              {selectedPlatform?.description}
            </DialogDescription>
          </DialogHeader>
          {selectedPlatform && (
            <div className="space-y-4">
              <div>
                <Label>Connection Name</Label>
                <Input
                  value={connectionForm.connectionName}
                  onChange={(e) => setConnectionForm({ ...connectionForm, connectionName: e.target.value })}
                  placeholder="My Store"
                />
              </div>
              <div>
                <Label>Store URL</Label>
                <Input
                  value={connectionForm.storeUrl}
                  onChange={(e) => setConnectionForm({ ...connectionForm, storeUrl: e.target.value })}
                  placeholder="https://mystore.myshopify.com"
                />
              </div>
              {selectedPlatform.requiredFields.includes('accessToken') && (
                <div>
                  <Label>Access Token</Label>
                  <Input
                    type="password"
                    value={connectionForm.accessToken}
                    onChange={(e) => setConnectionForm({ ...connectionForm, accessToken: e.target.value })}
                    placeholder="shpat_xxxxx"
                  />
                </div>
              )}
              {selectedPlatform.requiredFields.includes('consumerKey') && (
                <>
                  <div>
                    <Label>Consumer Key</Label>
                    <Input
                      value={connectionForm.consumerKey}
                      onChange={(e) => setConnectionForm({ ...connectionForm, consumerKey: e.target.value })}
                      placeholder="ck_xxxxx"
                    />
                  </div>
                  <div>
                    <Label>Consumer Secret</Label>
                    <Input
                      type="password"
                      value={connectionForm.consumerSecret}
                      onChange={(e) => setConnectionForm({ ...connectionForm, consumerSecret: e.target.value })}
                      placeholder="cs_xxxxx"
                    />
                  </div>
                </>
              )}
              <div className="p-3 bg-muted rounded-lg">
                <h4 className="font-medium mb-1">Features</h4>
                <ul className="text-sm text-muted-foreground">
                  {selectedPlatform.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <CheckCircle className="w-3 h-3 text-green-600" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConnectDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const data: any = {
                  platform: selectedPlatform?.id,
                  connectionName: connectionForm.connectionName,
                  storeUrl: connectionForm.storeUrl,
                };
                if (connectionForm.accessToken) {
                  data.accessToken = connectionForm.accessToken;
                }
                if (connectionForm.consumerKey) {
                  data.credentials = {
                    consumerKey: connectionForm.consumerKey,
                    consumerSecret: connectionForm.consumerSecret,
                  };
                }
                createConnectionMutation.mutate(data);
              }}
              disabled={createConnectionMutation.isPending || !connectionForm.storeUrl}
            >
              {createConnectionMutation.isPending ? 'Connecting...' : 'Connect'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Webhook Dialog */}
      <Dialog open={showWebhookDialog} onOpenChange={setShowWebhookDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Webhook</DialogTitle>
            <DialogDescription>
              Configure an outbound webhook to notify external services
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={webhookForm.name}
                onChange={(e) => setWebhookForm({ ...webhookForm, name: e.target.value })}
                placeholder="Notify CRM on payment"
              />
            </div>
            <div>
              <Label>Event</Label>
              <Select
                value={webhookForm.eventType}
                onValueChange={(value) => setWebhookForm({ ...webhookForm, eventType: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select event" />
                </SelectTrigger>
                <SelectContent>
                  {webhookEvents?.map((event) => (
                    <SelectItem key={event.event} value={event.event}>
                      <div>
                        <span className="font-medium">{event.event}</span>
                        <span className="text-muted-foreground ml-2">{event.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Target URL</Label>
              <Input
                value={webhookForm.targetUrl}
                onChange={(e) => setWebhookForm({ ...webhookForm, targetUrl: e.target.value })}
                placeholder="https://api.example.com/webhook"
              />
            </div>
            <div className="p-3 bg-muted rounded-lg text-sm">
              <p className="font-medium">Webhook payload will include:</p>
              <ul className="text-muted-foreground mt-1">
                <li>- Event type and timestamp</li>
                <li>- Full object data (invoice, payment, etc.)</li>
                <li>- HMAC signature for verification</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWebhookDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createWebhookMutation.mutate(webhookForm)}
              disabled={createWebhookMutation.isPending || !webhookForm.name || !webhookForm.eventType || !webhookForm.targetUrl}
            >
              {createWebhookMutation.isPending ? 'Creating...' : 'Create Webhook'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
