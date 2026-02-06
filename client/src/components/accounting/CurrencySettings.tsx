import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Trash2, RefreshCw, Upload } from 'lucide-react';
import { useToast } from '@/hooks/useToast';

interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
  isActive: boolean;
}

interface ExchangeRate {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  rate: string;
  effectiveDate: string;
  source: string;
}

export default function CurrencySettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newRate, setNewRate] = useState({
    fromCurrency: 'USD',
    toCurrency: 'INR',
    rate: '',
    effectiveDate: new Date().toISOString().split('T')[0],
  });

  // Fetch currencies
  const { data: currencies } = useQuery<Currency[]>({
    queryKey: ['currencies'],
    queryFn: async () => {
      const response = await fetch('/api/currencies', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch currencies');
      return response.json();
    },
  });

  // Fetch exchange rates
  const { data: exchangeRates, isLoading } = useQuery<ExchangeRate[]>({
    queryKey: ['exchange-rates'],
    queryFn: async () => {
      const response = await fetch('/api/currencies/exchange-rates', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch exchange rates');
      return response.json();
    },
  });

  // Add exchange rate mutation
  const addRateMutation = useMutation({
    mutationFn: async (data: typeof newRate) => {
      const response = await fetch('/api/currencies/exchange-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...data,
          rate: parseFloat(data.rate),
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add exchange rate');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchange-rates'] });
      setIsAddDialogOpen(false);
      setNewRate({
        fromCurrency: 'USD',
        toCurrency: 'INR',
        rate: '',
        effectiveDate: new Date().toISOString().split('T')[0],
      });
      toast({
        title: 'Exchange rate added',
        description: 'The exchange rate has been saved.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete exchange rate mutation
  const deleteRateMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/currencies/exchange-rates/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to delete exchange rate');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchange-rates'] });
      toast({
        title: 'Exchange rate deleted',
        description: 'The exchange rate has been removed.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete exchange rate.',
        variant: 'destructive',
      });
    },
  });

  // Seed currencies mutation
  const seedCurrenciesMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/currencies/seed', {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to seed currencies');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currencies'] });
      toast({
        title: 'Currencies seeded',
        description: 'Common currencies have been added.',
      });
    },
  });

  const handleAddRate = () => {
    if (!newRate.rate || parseFloat(newRate.rate) <= 0) {
      toast({
        title: 'Invalid rate',
        description: 'Please enter a valid exchange rate.',
        variant: 'destructive',
      });
      return;
    }
    addRateMutation.mutate(newRate);
  };

  const getCurrencySymbol = (code: string) => {
    const currency = currencies?.find(c => c.code === code);
    return currency?.symbol || code;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Exchange Rates</CardTitle>
              <CardDescription>
                Manage foreign currency exchange rates for multi-currency transactions
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => seedCurrenciesMutation.mutate()}
                disabled={seedCurrenciesMutation.isPending}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Seed Currencies
              </Button>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Rate
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Exchange Rate</DialogTitle>
                    <DialogDescription>
                      Enter the exchange rate between two currencies
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>From Currency</Label>
                        <Select
                          value={newRate.fromCurrency}
                          onValueChange={(value) => setNewRate({ ...newRate, fromCurrency: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {currencies?.map((currency) => (
                              <SelectItem key={currency.code} value={currency.code}>
                                {currency.code} - {currency.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>To Currency</Label>
                        <Select
                          value={newRate.toCurrency}
                          onValueChange={(value) => setNewRate({ ...newRate, toCurrency: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {currencies?.map((currency) => (
                              <SelectItem key={currency.code} value={currency.code}>
                                {currency.code} - {currency.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Exchange Rate</Label>
                      <Input
                        type="number"
                        step="0.000001"
                        placeholder="e.g., 83.50"
                        value={newRate.rate}
                        onChange={(e) => setNewRate({ ...newRate, rate: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">
                        1 {newRate.fromCurrency} = {newRate.rate || '?'} {newRate.toCurrency}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Effective Date</Label>
                      <Input
                        type="date"
                        value={newRate.effectiveDate}
                        onChange={(e) => setNewRate({ ...newRate, effectiveDate: e.target.value })}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddRate} disabled={addRateMutation.isPending}>
                      {addRateMutation.isPending ? 'Adding...' : 'Add Rate'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : !exchangeRates || exchangeRates.length === 0 ? (
            <div className="text-center py-8">
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No exchange rates configured</p>
              <p className="text-sm text-muted-foreground mt-1">
                Add exchange rates to enable multi-currency transactions
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead>Effective Date</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exchangeRates.map((rate) => (
                  <TableRow key={rate.id}>
                    <TableCell className="font-medium">
                      {getCurrencySymbol(rate.fromCurrency)} {rate.fromCurrency}
                    </TableCell>
                    <TableCell>
                      {getCurrencySymbol(rate.toCurrency)} {rate.toCurrency}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {parseFloat(rate.rate).toFixed(4)}
                    </TableCell>
                    <TableCell>{rate.effectiveDate}</TableCell>
                    <TableCell>
                      <span className="capitalize text-xs bg-muted px-2 py-1 rounded">
                        {rate.source}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteRateMutation.mutate(rate.id)}
                        disabled={deleteRateMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Available Currencies Card */}
      <Card>
        <CardHeader>
          <CardTitle>Available Currencies</CardTitle>
          <CardDescription>
            Currencies available for transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {currencies?.slice(0, 12).map((currency) => (
              <div
                key={currency.code}
                className="flex items-center gap-3 p-3 rounded-lg border bg-card"
              >
                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-muted text-lg font-semibold">
                  {currency.symbol}
                </div>
                <div>
                  <p className="font-medium">{currency.code}</p>
                  <p className="text-xs text-muted-foreground">{currency.name}</p>
                </div>
              </div>
            ))}
          </div>
          {currencies && currencies.length > 12 && (
            <p className="text-sm text-muted-foreground mt-4 text-center">
              And {currencies.length - 12} more currencies available...
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
