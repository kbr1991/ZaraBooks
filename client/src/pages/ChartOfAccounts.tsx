import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Search,
  FileText,
  Wallet,
  CreditCard,
  TrendingUp,
  TrendingDown,
  Upload,
  Edit,
  Trash2,
} from 'lucide-react';
import CoaImport from '@/components/accounting/CoaImport';

interface Account {
  id: string;
  code: string;
  name: string;
  accountType: string;
  level: number;
  isGroup: boolean;
  isActive: boolean;
  children?: Account[];
}

const accountTypeIcons: Record<string, React.ReactNode> = {
  asset: <Wallet className="h-4 w-4 text-blue-500" />,
  liability: <CreditCard className="h-4 w-4 text-orange-500" />,
  equity: <FileText className="h-4 w-4 text-purple-500" />,
  income: <TrendingUp className="h-4 w-4 text-green-500" />,
  expense: <TrendingDown className="h-4 w-4 text-red-500" />,
};

const accountTypeColors: Record<string, string> = {
  asset: 'text-blue-600 bg-blue-50',
  liability: 'text-orange-600 bg-orange-50',
  equity: 'text-purple-600 bg-purple-50',
  income: 'text-green-600 bg-green-50',
  expense: 'text-red-600 bg-red-50',
};

function AccountRow({
  account,
  expanded,
  onToggle,
  onEdit,
  onDelete,
}: {
  account: Account;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onEdit: (account: Account) => void;
  onDelete: (account: Account) => void;
}) {
  const hasChildren = account.children && account.children.length > 0;
  const isExpanded = expanded.has(account.id);

  return (
    <>
      <tr className="hover:bg-muted/50">
        <td className="py-3 pl-4">
          <div className="flex items-center" style={{ paddingLeft: `${(account.level - 1) * 24}px` }}>
            {hasChildren ? (
              <button
                onClick={() => onToggle(account.id)}
                className="p-1 hover:bg-muted rounded mr-2"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            ) : (
              <span className="w-7" />
            )}
            <span className={cn('font-mono text-sm mr-3', account.isGroup && 'font-bold')}>
              {account.code}
            </span>
            <span className={cn(account.isGroup && 'font-semibold')}>{account.name}</span>
          </div>
        </td>
        <td className="py-3">
          <span className={cn('px-2 py-1 rounded-full text-xs font-medium', accountTypeColors[account.accountType])}>
            {account.accountType}
          </span>
        </td>
        <td className="py-3 text-center">
          {account.isGroup ? (
            <span className="text-xs text-muted-foreground">Group</span>
          ) : (
            <span className="text-xs text-muted-foreground">Ledger</span>
          )}
        </td>
        <td className="py-3 pr-4 text-right">
          <div className="flex items-center justify-end gap-1">
            <Button variant="ghost" size="sm" onClick={() => onEdit(account)}>
              <Edit className="h-4 w-4" />
            </Button>
            {!account.isGroup && (
              <Button variant="ghost" size="sm" onClick={() => onDelete(account)}>
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            )}
          </div>
        </td>
      </tr>
      {hasChildren && isExpanded && account.children?.map((child) => (
        <AccountRow
          key={child.id}
          account={child}
          expanded={expanded}
          onToggle={onToggle}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </>
  );
}

const emptyForm = {
  code: '',
  name: '',
  accountType: 'asset' as string,
  parentAccountId: '',
  description: '',
  isGroup: false,
  openingBalance: '',
  openingBalanceType: 'debit' as string,
  gstApplicable: false,
  defaultGstRate: '',
  hsnSacCode: '',
};

export default function ChartOfAccounts() {
  const [searchTerm, setSearchTerm] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('auto');

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['chart-of-accounts'],
    queryFn: async () => {
      const response = await fetch('/api/chart-of-accounts', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch accounts');
      return response.json();
    },
  });

  // Fetch available templates
  useQuery({
    queryKey: ['coa-templates'],
    queryFn: async () => {
      const response = await fetch('/api/chart-of-accounts/templates/list', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch templates');
      return response.json();
    },
  });

  // Create account mutation
  const createAccountMutation = useMutation({
    mutationFn: async (accountData: typeof formData) => {
      const response = await fetch('/api/chart-of-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...accountData,
          parentAccountId: accountData.parentAccountId || null,
          openingBalance: accountData.openingBalance || '0',
          defaultGstRate: accountData.defaultGstRate || null,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create account');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] });
      setShowAddDialog(false);
      setFormData(emptyForm);
      toast({ title: 'Account created successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Update account mutation
  const updateAccountMutation = useMutation({
    mutationFn: async ({ id, ...accountData }: { id: string } & typeof formData) => {
      const response = await fetch(`/api/chart-of-accounts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...accountData,
          parentAccountId: accountData.parentAccountId || null,
          openingBalance: accountData.openingBalance || '0',
          defaultGstRate: accountData.defaultGstRate || null,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update account');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] });
      setShowEditDialog(false);
      setSelectedAccount(null);
      setFormData(emptyForm);
      toast({ title: 'Account updated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Delete account mutation
  const deleteAccountMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/chart-of-accounts/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete account');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] });
      setShowDeleteDialog(false);
      setSelectedAccount(null);
      toast({ title: 'Account deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Initialize template mutation
  const initializeTemplateMutation = useMutation({
    mutationFn: async (templateOption: string) => {
      const body = templateOption === 'auto'
        ? { autoDetect: true }
        : { gaapStandard: templateOption };

      const response = await fetch('/api/chart-of-accounts/templates/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to initialize accounts');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] });
      setShowTemplateDialog(false);
      toast({ title: 'Chart of Accounts initialized', description: `${data.accountsCreated} accounts created` });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const handleInitializeTemplate = () => {
    setSelectedTemplate('auto');
    setShowTemplateDialog(true);
  };

  const handleApplyTemplate = () => {
    initializeTemplateMutation.mutate(selectedTemplate);
  };

  const handleAddAccount = () => {
    setFormData(emptyForm);
    setShowAddDialog(true);
  };

  const handleEditAccount = (account: Account) => {
    // Fetch full account details for editing
    fetch(`/api/chart-of-accounts/${account.id}`, { credentials: 'include' })
      .then(res => res.json())
      .then(fullAccount => {
        setFormData({
          code: fullAccount.code || '',
          name: fullAccount.name || '',
          accountType: fullAccount.accountType || 'asset',
          parentAccountId: fullAccount.parentAccountId || '',
          description: fullAccount.description || '',
          isGroup: fullAccount.isGroup || false,
          openingBalance: fullAccount.openingBalance || '',
          openingBalanceType: fullAccount.openingBalanceType || 'debit',
          gstApplicable: fullAccount.gstApplicable || false,
          defaultGstRate: fullAccount.defaultGstRate || '',
          hsnSacCode: fullAccount.hsnSacCode || '',
        });
        setSelectedAccount(account);
        setShowEditDialog(true);
      });
  };

  const handleDeleteAccount = (account: Account) => {
    setSelectedAccount(account);
    setShowDeleteDialog(true);
  };

  const handleSubmitCreate = () => {
    if (!formData.code || !formData.name) {
      toast({ title: 'Error', description: 'Code and Name are required', variant: 'destructive' });
      return;
    }
    createAccountMutation.mutate(formData);
  };

  const handleSubmitEdit = () => {
    if (!selectedAccount) return;
    if (!formData.code || !formData.name) {
      toast({ title: 'Error', description: 'Code and Name are required', variant: 'destructive' });
      return;
    }
    updateAccountMutation.mutate({ id: selectedAccount.id, ...formData });
  };

  const handleConfirmDelete = () => {
    if (!selectedAccount) return;
    deleteAccountMutation.mutate(selectedAccount.id);
  };

  // Get flat list of group accounts for parent selection
  const groupAccounts = data?.accounts?.filter((a: Account) => a.isGroup) || [];

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    if (!data?.accounts) return;
    const allIds = data.accounts.filter((a: Account) => a.isGroup).map((a: Account) => a.id);
    setExpanded(new Set(allIds));
  };

  const collapseAll = () => {
    setExpanded(new Set());
  };

  const filterAccounts = (accounts: Account[]): Account[] => {
    return accounts.filter((account) => {
      const matchesSearch =
        !searchTerm ||
        account.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        account.code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = !selectedType || account.accountType === selectedType;

      if (account.children) {
        const filteredChildren = filterAccounts(account.children);
        if (filteredChildren.length > 0) {
          return true;
        }
      }

      return matchesSearch && matchesType;
    }).map((account) => ({
      ...account,
      children: account.children ? filterAccounts(account.children) : undefined,
    }));
  };

  const hierarchy = data?.hierarchy ? filterAccounts(data.hierarchy) : [];
  const accountCounts = data?.accounts?.reduce(
    (acc: Record<string, number>, a: Account) => {
      acc[a.accountType] = (acc[a.accountType] || 0) + 1;
      return acc;
    },
    {}
  ) || {};

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Chart of Accounts</h1>
          <p className="text-muted-foreground">Manage your company's account structure</p>
        </div>
        <div className="flex gap-2">
          {(!data?.accounts || data.accounts.length === 0) && (
            <Button
              variant="outline"
              onClick={handleInitializeTemplate}
              disabled={initializeTemplateMutation.isPending}
            >
              <FileText className="h-4 w-4 mr-2" />
              {initializeTemplateMutation.isPending ? 'Initializing...' : 'Initialize Template'}
            </Button>
          )}
          <Button variant="outline" onClick={() => setShowImport(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button onClick={handleAddAccount}>
            <Plus className="h-4 w-4 mr-2" />
            Add Account
          </Button>
        </div>
      </div>

      <CoaImport open={showImport} onOpenChange={setShowImport} />

      {/* Account Type Summary */}
      <div className="grid gap-4 md:grid-cols-5">
        {['asset', 'liability', 'equity', 'income', 'expense'].map((type) => (
          <Card
            key={type}
            className={cn(
              'cursor-pointer transition-colors',
              selectedType === type && 'ring-2 ring-primary'
            )}
            onClick={() => setSelectedType(selectedType === type ? null : type)}
          >
            <CardContent className="flex items-center gap-3 p-4">
              {accountTypeIcons[type]}
              <div>
                <p className="text-sm font-medium capitalize">{type}</p>
                <p className="text-2xl font-bold">{accountCounts[type] || 0}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search and Actions */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle>Accounts</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={expandAll}>
                Expand All
              </Button>
              <Button variant="outline" size="sm" onClick={collapseAll}>
                Collapse All
              </Button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="py-3 pl-4 text-left text-sm font-medium">Account</th>
                <th className="py-3 text-left text-sm font-medium">Type</th>
                <th className="py-3 text-center text-sm font-medium">Category</th>
                <th className="py-3 pr-4 text-right text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {hierarchy.map((account: Account) => (
                <AccountRow
                  key={account.id}
                  account={account}
                  expanded={expanded}
                  onToggle={toggleExpand}
                  onEdit={handleEditAccount}
                  onDelete={handleDeleteAccount}
                />
              ))}
              {hierarchy.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <FileText className="h-12 w-12 text-muted-foreground" />
                      <div>
                        <p className="text-lg font-medium">No accounts found</p>
                        <p className="text-muted-foreground">Get started by selecting an accounting standard template or add accounts manually</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleInitializeTemplate}
                          disabled={initializeTemplateMutation.isPending}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          {initializeTemplateMutation.isPending ? 'Initializing...' : 'Choose Template'}
                        </Button>
                        <Button variant="outline" onClick={handleAddAccount}>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Account Manually
                        </Button>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Add Account Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Account</DialogTitle>
            <DialogDescription>
              Create a new account in your chart of accounts
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">Account Code *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="e.g., 1001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Account Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Cash in Hand"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="accountType">Account Type *</Label>
                <Select
                  value={formData.accountType}
                  onValueChange={(value) => setFormData({ ...formData, accountType: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asset">Asset</SelectItem>
                    <SelectItem value="liability">Liability</SelectItem>
                    <SelectItem value="equity">Equity</SelectItem>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="parentAccount">Parent Account</Label>
                <Select
                  value={formData.parentAccountId}
                  onValueChange={(value) => setFormData({ ...formData, parentAccountId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None (Top Level)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None (Top Level)</SelectItem>
                    {groupAccounts
                      .filter((a: Account) => a.accountType === formData.accountType)
                      .map((a: Account) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.code} - {a.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isGroup"
                checked={formData.isGroup}
                onCheckedChange={(checked) => setFormData({ ...formData, isGroup: checked as boolean })}
              />
              <Label htmlFor="isGroup">This is a group account (parent for sub-accounts)</Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
                rows={2}
              />
            </div>
            {!formData.isGroup && (
              <>
                <div className="border-t pt-4 mt-2">
                  <h4 className="font-medium mb-3">Opening Balance</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="openingBalance">Amount</Label>
                      <Input
                        id="openingBalance"
                        type="number"
                        step="0.01"
                        value={formData.openingBalance}
                        onChange={(e) => setFormData({ ...formData, openingBalance: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="openingBalanceType">Balance Type</Label>
                      <Select
                        value={formData.openingBalanceType}
                        onValueChange={(value) => setFormData({ ...formData, openingBalanceType: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="debit">Debit</SelectItem>
                          <SelectItem value="credit">Credit</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <div className="border-t pt-4 mt-2">
                  <h4 className="font-medium mb-3">GST Settings</h4>
                  <div className="flex items-center space-x-2 mb-3">
                    <Checkbox
                      id="gstApplicable"
                      checked={formData.gstApplicable}
                      onCheckedChange={(checked) => setFormData({ ...formData, gstApplicable: checked as boolean })}
                    />
                    <Label htmlFor="gstApplicable">GST Applicable</Label>
                  </div>
                  {formData.gstApplicable && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="defaultGstRate">Default GST Rate (%)</Label>
                        <Select
                          value={formData.defaultGstRate}
                          onValueChange={(value) => setFormData({ ...formData, defaultGstRate: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select rate" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">0%</SelectItem>
                            <SelectItem value="5">5%</SelectItem>
                            <SelectItem value="12">12%</SelectItem>
                            <SelectItem value="18">18%</SelectItem>
                            <SelectItem value="28">28%</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="hsnSacCode">HSN/SAC Code</Label>
                        <Input
                          id="hsnSacCode"
                          value={formData.hsnSacCode}
                          onChange={(e) => setFormData({ ...formData, hsnSacCode: e.target.value })}
                          placeholder="e.g., 9983"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitCreate} disabled={createAccountMutation.isPending}>
              {createAccountMutation.isPending ? 'Creating...' : 'Create Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Account Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
            <DialogDescription>
              Update account details
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-code">Account Code *</Label>
                <Input
                  id="edit-code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="e.g., 1001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-name">Account Name *</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Cash in Hand"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-accountType">Account Type *</Label>
                <Select
                  value={formData.accountType}
                  onValueChange={(value) => setFormData({ ...formData, accountType: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asset">Asset</SelectItem>
                    <SelectItem value="liability">Liability</SelectItem>
                    <SelectItem value="equity">Equity</SelectItem>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-parentAccount">Parent Account</Label>
                <Select
                  value={formData.parentAccountId}
                  onValueChange={(value) => setFormData({ ...formData, parentAccountId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None (Top Level)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None (Top Level)</SelectItem>
                    {groupAccounts
                      .filter((a: Account) => a.accountType === formData.accountType && a.id !== selectedAccount?.id)
                      .map((a: Account) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.code} - {a.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
                rows={2}
              />
            </div>
            {!formData.isGroup && (
              <>
                <div className="border-t pt-4 mt-2">
                  <h4 className="font-medium mb-3">Opening Balance</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-openingBalance">Amount</Label>
                      <Input
                        id="edit-openingBalance"
                        type="number"
                        step="0.01"
                        value={formData.openingBalance}
                        onChange={(e) => setFormData({ ...formData, openingBalance: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-openingBalanceType">Balance Type</Label>
                      <Select
                        value={formData.openingBalanceType}
                        onValueChange={(value) => setFormData({ ...formData, openingBalanceType: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="debit">Debit</SelectItem>
                          <SelectItem value="credit">Credit</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <div className="border-t pt-4 mt-2">
                  <h4 className="font-medium mb-3">GST Settings</h4>
                  <div className="flex items-center space-x-2 mb-3">
                    <Checkbox
                      id="edit-gstApplicable"
                      checked={formData.gstApplicable}
                      onCheckedChange={(checked) => setFormData({ ...formData, gstApplicable: checked as boolean })}
                    />
                    <Label htmlFor="edit-gstApplicable">GST Applicable</Label>
                  </div>
                  {formData.gstApplicable && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-defaultGstRate">Default GST Rate (%)</Label>
                        <Select
                          value={formData.defaultGstRate}
                          onValueChange={(value) => setFormData({ ...formData, defaultGstRate: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select rate" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">0%</SelectItem>
                            <SelectItem value="5">5%</SelectItem>
                            <SelectItem value="12">12%</SelectItem>
                            <SelectItem value="18">18%</SelectItem>
                            <SelectItem value="28">28%</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-hsnSacCode">HSN/SAC Code</Label>
                        <Input
                          id="edit-hsnSacCode"
                          value={formData.hsnSacCode}
                          onChange={(e) => setFormData({ ...formData, hsnSacCode: e.target.value })}
                          placeholder="e.g., 9983"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitEdit} disabled={updateAccountMutation.isPending}>
              {updateAccountMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Account</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedAccount?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={deleteAccountMutation.isPending}>
              {deleteAccountMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Selection Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Initialize Chart of Accounts</DialogTitle>
            <DialogDescription>
              Select an accounting standard template to initialize your chart of accounts.
              The template will be customized based on your company type.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-3">
              <div
                className={cn(
                  'p-4 border rounded-lg cursor-pointer transition-colors',
                  selectedTemplate === 'auto' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                )}
                onClick={() => setSelectedTemplate('auto')}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-4 h-4 rounded-full border-2',
                    selectedTemplate === 'auto' ? 'border-primary bg-primary' : 'border-muted-foreground'
                  )} />
                  <div>
                    <p className="font-medium">India GAAP (Auto-detect)</p>
                    <p className="text-sm text-muted-foreground">
                      Automatically selects the right template based on your company type
                      (Company/Partnership/LLP/Proprietorship)
                    </p>
                  </div>
                </div>
              </div>

              <div
                className={cn(
                  'p-4 border rounded-lg cursor-pointer transition-colors',
                  selectedTemplate === 'US_GAAP' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                )}
                onClick={() => setSelectedTemplate('US_GAAP')}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-4 h-4 rounded-full border-2',
                    selectedTemplate === 'US_GAAP' ? 'border-primary bg-primary' : 'border-muted-foreground'
                  )} />
                  <div>
                    <p className="font-medium">US GAAP</p>
                    <p className="text-sm text-muted-foreground">
                      United States Generally Accepted Accounting Principles
                    </p>
                  </div>
                </div>
              </div>

              <div
                className={cn(
                  'p-4 border rounded-lg cursor-pointer transition-colors',
                  selectedTemplate === 'IFRS' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                )}
                onClick={() => setSelectedTemplate('IFRS')}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-4 h-4 rounded-full border-2',
                    selectedTemplate === 'IFRS' ? 'border-primary bg-primary' : 'border-muted-foreground'
                  )} />
                  <div>
                    <p className="font-medium">IFRS</p>
                    <p className="text-sm text-muted-foreground">
                      International Financial Reporting Standards
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {selectedTemplate === 'auto' && (
              <div className="p-3 bg-blue-50 text-blue-800 rounded-lg text-sm">
                <strong>Note:</strong> Based on your company type, the appropriate equity structure will be used:
                <ul className="mt-2 ml-4 list-disc">
                  <li>Company: Share Capital, Reserves & Surplus</li>
                  <li>Partnership: Partners' Capital & Current Accounts</li>
                  <li>LLP: Partners' Contribution</li>
                  <li>Proprietorship: Proprietor's Capital</li>
                </ul>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleApplyTemplate} disabled={initializeTemplateMutation.isPending}>
              {initializeTemplateMutation.isPending ? 'Initializing...' : 'Initialize'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
