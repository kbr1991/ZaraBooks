/**
 * GstinInput Component
 *
 * Reusable GSTIN input with lookup button, validation, and status badge
 *
 * Usage:
 * <GstinInput
 *   value={form.watch('gstin')}
 *   onChange={(value) => form.setValue('gstin', value)}
 *   onLookupSuccess={(details) => {
 *     form.setValue('name', details.legalName);
 *     form.setValue('address', getShortAddress(details));
 *     form.setValue('city', details.address.city);
 *     form.setValue('state', details.address.state);
 *     form.setValue('pincode', details.address.pincode);
 *   }}
 *   error={form.formState.errors.gstin?.message}
 * />
 */

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useGstinLookup } from '@/hooks/useGstinLookup';
import { validateGstin, getStatusBadgeVariant, type GstinDetails } from '@/lib/gst-utils';
import { Search, Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export interface GstinInputProps {
  value: string;
  onChange: (value: string) => void;
  onLookupSuccess?: (details: GstinDetails) => void;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  showLookupButton?: boolean;
}

export function GstinInput({
  value,
  onChange,
  onLookupSuccess,
  error,
  disabled = false,
  placeholder = '22AAAAA0000A1Z5',
  className,
  showLookupButton = true,
}: GstinInputProps) {
  const { toast } = useToast();
  const [lookupStatus, setLookupStatus] = React.useState<GstinDetails['status'] | null>(null);
  const [validationError, setValidationError] = React.useState<string | null>(null);

  const { lookup, isLoading, reset } = useGstinLookup({
    onSuccess: (details) => {
      setLookupStatus(details.status);
      setValidationError(null);
      onLookupSuccess?.(details);
      toast({
        title: 'GSTIN Verified',
        description: `${details.legalName} - ${details.status}`,
      });
    },
    onError: (error) => {
      setLookupStatus(null);
      toast({
        title: 'Lookup Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.toUpperCase();
    onChange(newValue);

    // Reset lookup status when value changes
    if (lookupStatus) {
      setLookupStatus(null);
      reset();
    }

    // Validate on change
    if (newValue.length === 15) {
      const validation = validateGstin(newValue);
      setValidationError(validation.error || null);
    } else if (newValue.length > 0 && newValue.length < 15) {
      setValidationError(null);
    } else {
      setValidationError(null);
    }
  };

  const handleLookup = () => {
    const validation = validateGstin(value);
    if (!validation.valid) {
      setValidationError(validation.error || 'Invalid GSTIN');
      return;
    }

    setValidationError(null);
    lookup(value);
  };

  const canLookup = value.length === 15 && !isLoading && !disabled;

  // Determine display error (external error takes precedence)
  const displayError = error || validationError;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            value={value}
            onChange={handleInputChange}
            placeholder={placeholder}
            maxLength={15}
            disabled={disabled}
            className={cn(
              'font-mono uppercase',
              displayError && 'border-destructive focus-visible:ring-destructive'
            )}
          />
        </div>

        {showLookupButton && (
          <Button
            type="button"
            variant="outline"
            size="default"
            onClick={handleLookup}
            disabled={!canLookup}
            className="shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            <span className="ml-2">Lookup</span>
          </Button>
        )}

        {lookupStatus && (
          <Badge
            variant={getStatusBadgeVariant(lookupStatus)}
            className="shrink-0 flex items-center gap-1"
          >
            {lookupStatus === 'Active' ? (
              <CheckCircle className="h-3 w-3" />
            ) : lookupStatus === 'Cancelled' ? (
              <XCircle className="h-3 w-3" />
            ) : (
              <AlertCircle className="h-3 w-3" />
            )}
            {lookupStatus}
          </Badge>
        )}
      </div>

      {displayError && (
        <p className="text-sm text-destructive">{displayError}</p>
      )}
    </div>
  );
}

// Compact version without button (for tight spaces)
export function GstinInputCompact({
  value,
  onChange,
  error,
  disabled = false,
  placeholder = '22AAAAA0000A1Z5',
  className,
}: Omit<GstinInputProps, 'onLookupSuccess' | 'showLookupButton'>) {
  return (
    <GstinInput
      value={value}
      onChange={onChange}
      error={error}
      disabled={disabled}
      placeholder={placeholder}
      className={className}
      showLookupButton={false}
    />
  );
}
