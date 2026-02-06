import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Download,
  Filter,
  Eye,
  RefreshCw,
  User,
  Activity,
  FileText,
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash,
  LogIn,
  LogOut,
} from 'lucide-react';

interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
}

interface AuditLogResponse {
  data: AuditLogEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface AuditStats {
  byAction: { action: string; count: number }[];
  byEntityType: { entityType: string; count: number }[];
  todayCount: number;
  weekCount: number;
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  create: <Plus className="h-4 w-4 text-green-500" />,
  update: <Pencil className="h-4 w-4 text-blue-500" />,
  delete: <Trash className="h-4 w-4 text-red-500" />,
  login: <LogIn className="h-4 w-4 text-purple-500" />,
  logout: <LogOut className="h-4 w-4 text-gray-500" />,
};

const ACTION_LABELS: Record<string, string> = {
  create: 'Created',
  update: 'Updated',
  delete: 'Deleted',
  login: 'Logged In',
  logout: 'Logged Out',
  view: 'Viewed',
  export: 'Exported',
  import: 'Imported',
  approve: 'Approved',
  post: 'Posted',
  reverse: 'Reversed',
};

const ENTITY_LABELS: Record<string, string> = {
  journal_entry: 'Journal Entry',
  chart_of_accounts: 'Account',
  party: 'Party',
  company: 'Company',
  user: 'User',
  fiscal_year: 'Fiscal Year',
  gst_config: 'GST Config',
  recurring_entry: 'Recurring Entry',
  bank_import: 'Bank Import',
};

export default function AuditLog() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    action: '',
    entityType: '',
    startDate: '',
    endDate: '',
  });
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Fetch audit logs
  const { data: logsData, isLoading, refetch } = useQuery<AuditLogResponse>({
    queryKey: ['audit-logs', page, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '25');
      if (filters.action) params.append('action', filters.action);
      if (filters.entityType) params.append('entityType', filters.entityType);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);

      const response = await fetch(`/api/audit-log?${params}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch audit logs');
      return response.json();
    },
  });

  // Fetch stats
  const { data: stats } = useQuery<AuditStats>({
    queryKey: ['audit-stats'],
    queryFn: async () => {
      const response = await fetch('/api/audit-log/stats', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
  });

  const handleExport = () => {
    const params = new URLSearchParams();
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);

    window.open(`/api/audit-log/export/csv?${params}`, '_blank');
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const getActionLabel = (action: string) => {
    return ACTION_LABELS[action] || action;
  };

  const getEntityLabel = (entityType: string) => {
    return ENTITY_LABELS[entityType] || entityType.replace(/_/g, ' ');
  };

  const renderDiff = (oldData: Record<string, unknown> | null, newData: Record<string, unknown> | null) => {
    if (!oldData && !newData) return <p className="text-muted-foreground">No data changes</p>;

    const allKeys = new Set([
      ...Object.keys(oldData || {}),
      ...Object.keys(newData || {}),
    ]);

    const changes: { field: string; old: unknown; new: unknown }[] = [];

    allKeys.forEach((key) => {
      const oldValue = oldData?.[key];
      const newValue = newData?.[key];
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes.push({ field: key, old: oldValue, new: newValue });
      }
    });

    if (changes.length === 0) {
      return <p className="text-muted-foreground">No changes detected</p>;
    }

    return (
      <div className="space-y-2">
        {changes.map((change) => (
          <div key={change.field} className="text-sm">
            <span className="font-medium">{change.field}:</span>
            <div className="flex gap-4 mt-1">
              <span className="text-red-600 line-through">
                {JSON.stringify(change.old) || '(empty)'}
              </span>
              <span className="text-green-600">
                {JSON.stringify(change.new) || '(empty)'}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Audit Log</h1>
          <p className="text-muted-foreground">
            Track all changes and activities in your account
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Today's Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.todayCount || 0}</div>
            <p className="text-xs text-muted-foreground">actions recorded</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-500" />
              This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.weekCount || 0}</div>
            <p className="text-xs text-muted-foreground">total activities</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Plus className="h-4 w-4 text-green-500" />
              Most Common Action
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">
              {stats?.byAction?.[0]?.action || '-'}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.byAction?.[0]?.count || 0} occurrences
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <User className="h-4 w-4 text-purple-500" />
              Most Active Entity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.byEntityType?.[0]?.entityType
                ? getEntityLabel(stats.byEntityType[0].entityType)
                : '-'}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.byEntityType?.[0]?.count || 0} changes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Filters</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4 mr-2" />
              {showFilters ? 'Hide' : 'Show'} Filters
            </Button>
          </div>
        </CardHeader>
        {showFilters && (
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label>Action</Label>
                <Select
                  value={filters.action}
                  onValueChange={(value) => {
                    setFilters({ ...filters, action: value });
                    setPage(1);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All actions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All actions</SelectItem>
                    <SelectItem value="create">Create</SelectItem>
                    <SelectItem value="update">Update</SelectItem>
                    <SelectItem value="delete">Delete</SelectItem>
                    <SelectItem value="login">Login</SelectItem>
                    <SelectItem value="logout">Logout</SelectItem>
                    <SelectItem value="post">Post</SelectItem>
                    <SelectItem value="reverse">Reverse</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Entity Type</Label>
                <Select
                  value={filters.entityType}
                  onValueChange={(value) => {
                    setFilters({ ...filters, entityType: value });
                    setPage(1);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All entities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All entities</SelectItem>
                    <SelectItem value="journal_entry">Journal Entry</SelectItem>
                    <SelectItem value="chart_of_accounts">Account</SelectItem>
                    <SelectItem value="party">Party</SelectItem>
                    <SelectItem value="company">Company</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="fiscal_year">Fiscal Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => {
                    setFilters({ ...filters, startDate: e.target.value });
                    setPage(1);
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => {
                    setFilters({ ...filters, endDate: e.target.value });
                    setPage(1);
                  }}
                />
              </div>
            </div>

            {(filters.action || filters.entityType || filters.startDate || filters.endDate) && (
              <Button
                variant="link"
                className="mt-4 px-0"
                onClick={() => {
                  setFilters({ action: '', entityType: '', startDate: '', endDate: '' });
                  setPage(1);
                }}
              >
                Clear all filters
              </Button>
            )}
          </CardContent>
        )}
      </Card>

      {/* Logs Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !logsData?.data?.length ? (
            <div className="text-center py-12">
              <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No audit log entries found</p>
              {(filters.action || filters.entityType || filters.startDate || filters.endDate) && (
                <p className="text-sm text-muted-foreground mt-1">
                  Try adjusting your filters
                </p>
              )}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logsData.data.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-mono text-sm">
                        {formatDate(entry.createdAt)}
                      </TableCell>
                      <TableCell>
                        {entry.user ? (
                          <div>
                            <p className="font-medium">
                              {entry.user.firstName} {entry.user.lastName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {entry.user.email}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">System</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {ACTION_ICONS[entry.action] || (
                            <Activity className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="capitalize">
                            {getActionLabel(entry.action)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium capitalize">
                            {getEntityLabel(entry.entityType)}
                          </p>
                          {entry.entityId && (
                            <p className="text-xs text-muted-foreground font-mono">
                              {entry.entityId.substring(0, 8)}...
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {entry.ipAddress || '-'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedEntry(entry)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {logsData.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <p className="text-sm text-muted-foreground">
                    Showing {(page - 1) * 25 + 1} to{' '}
                    {Math.min(page * 25, logsData.pagination.total)} of{' '}
                    {logsData.pagination.total} entries
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <span className="text-sm">
                      Page {page} of {logsData.pagination.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={page === logsData.pagination.totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedEntry} onOpenChange={() => setSelectedEntry(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Audit Log Details</DialogTitle>
            <DialogDescription>
              {selectedEntry && formatDate(selectedEntry.createdAt)}
            </DialogDescription>
          </DialogHeader>
          {selectedEntry && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Action</Label>
                  <p className="font-medium capitalize">
                    {getActionLabel(selectedEntry.action)}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Entity</Label>
                  <p className="font-medium capitalize">
                    {getEntityLabel(selectedEntry.entityType)}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">User</Label>
                  <p className="font-medium">
                    {selectedEntry.user
                      ? `${selectedEntry.user.firstName} ${selectedEntry.user.lastName}`
                      : 'System'}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">IP Address</Label>
                  <p className="font-mono">{selectedEntry.ipAddress || '-'}</p>
                </div>
              </div>

              {selectedEntry.entityId && (
                <div>
                  <Label className="text-muted-foreground">Entity ID</Label>
                  <p className="font-mono text-sm">{selectedEntry.entityId}</p>
                </div>
              )}

              {(selectedEntry.oldData || selectedEntry.newData) && (
                <div>
                  <Label className="text-muted-foreground mb-2 block">Changes</Label>
                  <div className="bg-muted p-4 rounded-lg max-h-[300px] overflow-auto">
                    {renderDiff(selectedEntry.oldData, selectedEntry.newData)}
                  </div>
                </div>
              )}

              {selectedEntry.userAgent && (
                <div>
                  <Label className="text-muted-foreground">User Agent</Label>
                  <p className="text-sm text-muted-foreground break-all">
                    {selectedEntry.userAgent}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
