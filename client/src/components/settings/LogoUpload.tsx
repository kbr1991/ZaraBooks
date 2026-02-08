import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Upload, X, ImageIcon, Loader2 } from 'lucide-react';

interface LogoUploadProps {
  companyId: string;
  currentLogoUrl?: string | null;
  onLogoChange?: (logoUrl: string | null) => void;
}

export default function LogoUpload({ companyId, currentLogoUrl, onLogoChange }: LogoUploadProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentLogoUrl || null);
  const [isDragging, setIsDragging] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: async (logoUrl: string) => {
      const response = await fetch(`/api/companies/${companyId}/logo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ logoUrl }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload logo');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['auth'] });
      toast({ title: 'Logo uploaded successfully' });
      onLogoChange?.(data.logoUrl);
    },
    onError: (error: Error) => {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
      setPreviewUrl(currentLogoUrl || null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/companies/${companyId}/logo`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to delete logo');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth'] });
      setPreviewUrl(null);
      toast({ title: 'Logo removed' });
      onLogoChange?.(null);
    },
    onError: () => {
      toast({ title: 'Failed to remove logo', variant: 'destructive' });
    },
  });

  const handleFileSelect = (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file type', description: 'Please select an image file (PNG, JPG, or SVG)', variant: 'destructive' });
      return;
    }

    // Validate file size (max 500KB)
    if (file.size > 500000) {
      toast({ title: 'File too large', description: 'Maximum file size is 500KB', variant: 'destructive' });
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setPreviewUrl(base64);
      uploadMutation.mutate(base64);
    };
    reader.onerror = () => {
      toast({ title: 'Failed to read file', variant: 'destructive' });
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const isLoading = uploadMutation.isPending || deleteMutation.isPending;

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml"
        onChange={handleInputChange}
        className="hidden"
      />

      {previewUrl ? (
        <Card className="overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center gap-6">
              <div className="flex-shrink-0 w-32 h-20 flex items-center justify-center bg-muted rounded-lg p-2">
                <img
                  src={previewUrl}
                  alt="Company logo"
                  className="max-w-full max-h-full object-contain"
                />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-3">
                  Your logo will appear on invoices, quotes, and other documents.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClick}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    Change Logo
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMutation.mutate()}
                    disabled={isLoading}
                    className="text-destructive hover:text-destructive"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Remove
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div
          onClick={handleClick}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
            ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
            ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          {isLoading ? (
            <Loader2 className="h-10 w-10 mx-auto text-muted-foreground animate-spin mb-4" />
          ) : (
            <ImageIcon className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
          )}
          <p className="font-medium mb-1">
            {isDragging ? 'Drop your logo here' : 'Upload Company Logo'}
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            Drag and drop or click to browse
          </p>
          <p className="text-xs text-muted-foreground">
            PNG, JPG, or SVG (max 500KB)
          </p>
        </div>
      )}
    </div>
  );
}
