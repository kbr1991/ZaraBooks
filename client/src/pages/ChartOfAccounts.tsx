import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
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
}: {
  account: Account;
  expanded: Set<string>;
  onToggle: (id: string) => void;
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
          {!account.isGroup && (
            <Button variant="ghost" size="sm">
              View
            </Button>
          )}
        </td>
      </tr>
      {hasChildren && isExpanded && account.children?.map((child) => (
        <AccountRow key={child.id} account={child} expanded={expanded} onToggle={onToggle} />
      ))}
    </>
  );
}

export default function ChartOfAccounts() {
  const [searchTerm, setSearchTerm] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);

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
          <Button variant="outline" onClick={() => setShowImport(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button>
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
                />
              ))}
              {hierarchy.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-muted-foreground">
                    No accounts found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
