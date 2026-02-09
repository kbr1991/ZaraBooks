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
import { toast } from '@/hooks/useToast';
import { useAuth } from '@/hooks/useAuth';
import {
  Building2,
  User,
  Shield,
  Link,
  FileText,
  Calendar,
  Save,
  RefreshCw,
  CheckCircle,
  DollarSign,
  Palette,
  ExternalLink,
} from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';
import { GstinInput } from '@/components/ui/gstin-input';
import { getShortAddress, type GstinDetails } from '@/lib/gst-utils';
import CurrencySettings from '@/components/accounting/CurrencySettings';
import LogoUpload from '@/components/settings/LogoUpload';
import { TemplateGrid } from '@/components/document/TemplatePreview';
import { TemplateId } from '@/lib/document-templates/types';

type SettingsTab = 'company' | 'branding' | 'profile' | 'fiscal-years' | 'currencies' | 'gst' | 'tds' | 'integration';

export default function Settings() {
  const queryClient = useQueryClient();
  const { user, currentCompany } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('company');

  // Company settings
  const [companyData, setCompanyData] = useState({
    name: currentCompany?.name || '',
    legalName: currentCompany?.legalName || '',
    pan: currentCompany?.pan || '',
    gstin: currentCompany?.gstin || '',
    tan: currentCompany?.tan || '',
    cin: currentCompany?.cin || '',
    address: currentCompany?.address || '',
    city: currentCompany?.city || '',
    state: currentCompany?.state || '',
    pincode: currentCompany?.pincode || '',
    gaapStandard: currentCompany?.gaapStandard || 'INDIA_GAAP',
  });

  // Profile settings
  const [profileData, setProfileData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });

  // Fiscal years
  const { data: fiscalYears, isLoading: fyLoading } = useQuery({
    queryKey: ['fiscal-years-settings'],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const response = await fetch(`/api/companies/${currentCompany.id}/fiscal-years`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch fiscal years');
      return response.json();
    },
    enabled: activeTab === 'fiscal-years' && !!currentCompany?.id,
  });

  // GST config
  const { data: gstConfig } = useQuery({
    queryKey: ['gst-config-settings'],
    queryFn: async () => {
      const response = await fetch('/api/gst/config', {
        credentials: 'include',
      });
      if (!response.ok) return null;
      return response.json();
    },
    enabled: activeTab === 'gst',
  });

  const [gstData, setGstData] = useState({
    gstin: gstConfig?.gstin || '',
    legalName: gstConfig?.legalName || '',
    tradeName: gstConfig?.tradeName || '',
    registrationType: gstConfig?.registrationType || 'regular',
    filingFrequency: gstConfig?.filingFrequency || 'monthly',
    einvoiceEnabled: gstConfig?.einvoiceEnabled || false,
    einvoiceThreshold: gstConfig?.einvoiceThreshold || 500000,
  });

  // PM Integration
  const { data: pmConfig } = useQuery({
    queryKey: ['pm-integration-config'],
    queryFn: async () => {
      const response = await fetch('/api/pm-integration/config', {
        credentials: 'include',
      });
      if (!response.ok) return null;
      return response.json();
    },
    enabled: activeTab === 'integration',
  });

  const [pmData, setPmData] = useState({
    pmBaseUrl: pmConfig?.pmBaseUrl || '',
    apiKey: '',
    syncEnabled: pmConfig?.syncEnabled || false,
    autoSyncInvoices: pmConfig?.autoSyncInvoices || true,
    autoSyncPayments: pmConfig?.autoSyncPayments || true,
    autoSyncExpenses: pmConfig?.autoSyncExpenses || true,
  });

  // Mutations
  const updateCompanyMutation = useMutation({
    mutationFn: async (data: typeof companyData) => {
      const response = await fetch(`/api/companies/${currentCompany?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update company');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth'] });
      toast({ title: 'Company settings updated!' });
    },
    onError: (error: any) => {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof profileData) => {
      const response = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update profile');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth'] });
      toast({ title: 'Profile updated!' });
    },
    onError: (error: any) => {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    },
  });

  const updateGstMutation = useMutation({
    mutationFn: async (data: typeof gstData) => {
      const response = await fetch('/api/gst/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update GST config');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gst-config'] });
      toast({ title: 'GST settings updated!' });
    },
    onError: (error: any) => {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    },
  });

  // Branding state
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>(
    (currentCompany?.defaultTemplate as TemplateId) || 'classic'
  );

  // Update template mutation
  const updateTemplateMutation = useMutation({
    mutationFn: async (template: TemplateId) => {
      const response = await fetch(`/api/companies/${currentCompany?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ defaultTemplate: template }),
      });
      if (!response.ok) throw new Error('Failed to update template');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth'] });
      toast({ title: 'Default template updated!' });
    },
    onError: (error: any) => {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    },
  });

  const handleTemplateChange = (template: TemplateId) => {
    setSelectedTemplate(template);
    updateTemplateMutation.mutate(template);
  };

  const tabs = [
    { id: 'company' as SettingsTab, label: 'Company', icon: Building2 },
    { id: 'branding' as SettingsTab, label: 'Branding', icon: Palette },
    { id: 'profile' as SettingsTab, label: 'Profile', icon: User },
    { id: 'fiscal-years' as SettingsTab, label: 'Fiscal Years', icon: Calendar },
    { id: 'currencies' as SettingsTab, label: 'Currencies', icon: DollarSign },
    { id: 'gst' as SettingsTab, label: 'GST Settings', icon: FileText },
    { id: 'tds' as SettingsTab, label: 'TDS Settings', icon: Shield },
    { id: 'integration' as SettingsTab, label: 'Integration', icon: Link },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your company and application settings</p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-64 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-left transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              }`}
            >
              <tab.icon className="h-5 w-5" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1">
          {/* Company Settings */}
          {activeTab === 'company' && (
            <Card>
              <CardHeader>
                <CardTitle>Company Information</CardTitle>
                <CardDescription>Update your company details and compliance information</CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    updateCompanyMutation.mutate(companyData);
                  }}
                  className="space-y-6"
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">Company Name *</Label>
                      <Input
                        id="name"
                        value={companyData.name}
                        onChange={(e) => setCompanyData({ ...companyData, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="legalName">Legal Name</Label>
                      <Input
                        id="legalName"
                        value={companyData.legalName}
                        onChange={(e) => setCompanyData({ ...companyData, legalName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pan">PAN</Label>
                      <Input
                        id="pan"
                        value={companyData.pan}
                        onChange={(e) => setCompanyData({ ...companyData, pan: e.target.value.toUpperCase() })}
                        maxLength={10}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gstin">GSTIN</Label>
                      <GstinInput
                        value={companyData.gstin}
                        onChange={(value) => setCompanyData({ ...companyData, gstin: value })}
                        onLookupSuccess={(details: GstinDetails) => {
                          // Auto-fill fields from GSTIN lookup
                          if (details.legalName && !companyData.legalName) {
                            setCompanyData(prev => ({ ...prev, legalName: details.legalName }));
                          }
                          if (!companyData.address) {
                            setCompanyData(prev => ({ ...prev, address: getShortAddress(details) }));
                          }
                          if (details.address.city && !companyData.city) {
                            setCompanyData(prev => ({ ...prev, city: details.address.city }));
                          }
                          if (details.address.state && !companyData.state) {
                            setCompanyData(prev => ({ ...prev, state: details.address.state }));
                          }
                          if (details.address.pincode && !companyData.pincode) {
                            setCompanyData(prev => ({ ...prev, pincode: details.address.pincode }));
                          }
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tan">TAN</Label>
                      <Input
                        id="tan"
                        value={companyData.tan}
                        onChange={(e) => setCompanyData({ ...companyData, tan: e.target.value.toUpperCase() })}
                        maxLength={10}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cin">CIN</Label>
                      <Input
                        id="cin"
                        value={companyData.cin}
                        onChange={(e) => setCompanyData({ ...companyData, cin: e.target.value.toUpperCase() })}
                        maxLength={25}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="address">Address</Label>
                      <Input
                        id="address"
                        value={companyData.address}
                        onChange={(e) => setCompanyData({ ...companyData, address: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={companyData.city}
                        onChange={(e) => setCompanyData({ ...companyData, city: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State</Label>
                      <Input
                        id="state"
                        value={companyData.state}
                        onChange={(e) => setCompanyData({ ...companyData, state: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pincode">Pincode</Label>
                      <Input
                        id="pincode"
                        value={companyData.pincode}
                        onChange={(e) => setCompanyData({ ...companyData, pincode: e.target.value })}
                        maxLength={6}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gaapStandard">Accounting Standard</Label>
                      <Select
                        value={companyData.gaapStandard}
                        onValueChange={(value) => setCompanyData({ ...companyData, gaapStandard: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="INDIA_GAAP">India GAAP (Schedule III)</SelectItem>
                          <SelectItem value="IFRS">IFRS</SelectItem>
                          <SelectItem value="US_GAAP">US GAAP</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button type="submit" disabled={updateCompanyMutation.isPending}>
                    <Save className="h-4 w-4 mr-2" />
                    {updateCompanyMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Branding Settings */}
          {activeTab === 'branding' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Company Logo</CardTitle>
                  <CardDescription>
                    Upload your company logo to appear on invoices, quotes, and other documents
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {currentCompany?.id && (
                    <LogoUpload
                      companyId={currentCompany.id}
                      currentLogoUrl={currentCompany.logoUrl}
                    />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Default Document Template</CardTitle>
                  <CardDescription>
                    Choose the default template style for invoices, quotes, and sales orders
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <TemplateGrid
                    selectedTemplate={selectedTemplate}
                    onSelect={handleTemplateChange}
                    size="md"
                  />
                  <p className="text-sm text-muted-foreground mt-4">
                    You can override this template when downloading or printing individual documents.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Custom Templates</CardTitle>
                  <CardDescription>
                    Create and manage custom HTML/CSS templates for your documents
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Build fully customized templates with your own HTML and CSS. Use placeholders like
                    {' {{company.name}}'}, {' {{customer.gstin}}'}, {' {{totalAmount}}'} to dynamically insert data.
                  </p>
                  <RouterLink to="/document-templates">
                    <Button variant="outline">
                      <FileText className="h-4 w-4 mr-2" />
                      Manage Custom Templates
                      <ExternalLink className="h-4 w-4 ml-2" />
                    </Button>
                  </RouterLink>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Profile Settings */}
          {activeTab === 'profile' && (
            <Card>
              <CardHeader>
                <CardTitle>Profile Settings</CardTitle>
                <CardDescription>Manage your personal account information</CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    updateProfileMutation.mutate(profileData);
                  }}
                  className="space-y-6"
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name *</Label>
                      <Input
                        id="firstName"
                        value={profileData.firstName}
                        onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name *</Label>
                      <Input
                        id="lastName"
                        value={profileData.lastName}
                        onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={profileData.email}
                        disabled
                      />
                      <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        value={profileData.phone}
                        onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                      />
                    </div>
                  </div>
                  <Button type="submit" disabled={updateProfileMutation.isPending}>
                    <Save className="h-4 w-4 mr-2" />
                    {updateProfileMutation.isPending ? 'Saving...' : 'Save Profile'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Fiscal Years */}
          {activeTab === 'fiscal-years' && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Fiscal Years</CardTitle>
                  <CardDescription>Manage accounting periods</CardDescription>
                </div>
                <Button>
                  <Calendar className="h-4 w-4 mr-2" />
                  Add Fiscal Year
                </Button>
              </CardHeader>
              <CardContent>
                {fyLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="border-b">
                      <tr>
                        <th className="py-2 text-left text-sm font-medium">Name</th>
                        <th className="py-2 text-left text-sm font-medium">Start Date</th>
                        <th className="py-2 text-left text-sm font-medium">End Date</th>
                        <th className="py-2 text-center text-sm font-medium">Status</th>
                        <th className="py-2 text-right text-sm font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fiscalYears?.map((fy: any) => (
                        <tr key={fy.id} className="border-b">
                          <td className="py-3 font-medium">{fy.name}</td>
                          <td className="py-3">{fy.startDate}</td>
                          <td className="py-3">{fy.endDate}</td>
                          <td className="py-3 text-center">
                            {fy.isCurrent ? (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                Current
                              </span>
                            ) : fy.isLocked ? (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                Locked
                              </span>
                            ) : (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                Open
                              </span>
                            )}
                          </td>
                          <td className="py-3 text-right">
                            <Button variant="ghost" size="sm">
                              {fy.isLocked ? 'Unlock' : 'Lock'}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          )}

          {/* Currency Settings */}
          {activeTab === 'currencies' && <CurrencySettings />}

          {/* GST Settings */}
          {activeTab === 'gst' && (
            <Card>
              <CardHeader>
                <CardTitle>GST Configuration</CardTitle>
                <CardDescription>Configure GST registration and compliance settings</CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    updateGstMutation.mutate(gstData);
                  }}
                  className="space-y-6"
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="gstGstin">GSTIN *</Label>
                      <GstinInput
                        value={gstData.gstin}
                        onChange={(value) => setGstData({ ...gstData, gstin: value })}
                        onLookupSuccess={(details: GstinDetails) => {
                          // Auto-fill GST config fields from lookup
                          if (details.legalName) {
                            setGstData(prev => ({ ...prev, legalName: details.legalName }));
                          }
                          if (details.tradeName) {
                            setGstData(prev => ({ ...prev, tradeName: details.tradeName || '' }));
                          }
                          // Map registration type
                          const regTypeMap: Record<string, string> = {
                            'Regular': 'regular',
                            'Composition': 'composition',
                            'Casual': 'casual',
                            'Non-Resident': 'non_resident',
                            'ISD': 'isd',
                          };
                          const mappedType = regTypeMap[details.registrationType] || 'regular';
                          setGstData(prev => ({ ...prev, registrationType: mappedType }));
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gstLegalName">Legal Name</Label>
                      <Input
                        id="gstLegalName"
                        value={gstData.legalName}
                        onChange={(e) => setGstData({ ...gstData, legalName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gstTradeName">Trade Name</Label>
                      <Input
                        id="gstTradeName"
                        value={gstData.tradeName}
                        onChange={(e) => setGstData({ ...gstData, tradeName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="registrationType">Registration Type</Label>
                      <Select
                        value={gstData.registrationType}
                        onValueChange={(value) => setGstData({ ...gstData, registrationType: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="regular">Regular</SelectItem>
                          <SelectItem value="composition">Composition</SelectItem>
                          <SelectItem value="casual">Casual</SelectItem>
                          <SelectItem value="non_resident">Non-Resident</SelectItem>
                          <SelectItem value="isd">Input Service Distributor</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="filingFrequency">Filing Frequency</Label>
                      <Select
                        value={gstData.filingFrequency}
                        onValueChange={(value) => setGstData({ ...gstData, filingFrequency: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="quarterly">Quarterly (QRMP)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="einvoiceThreshold">E-Invoice Threshold</Label>
                      <Input
                        id="einvoiceThreshold"
                        type="number"
                        value={gstData.einvoiceThreshold}
                        onChange={(e) => setGstData({ ...gstData, einvoiceThreshold: parseInt(e.target.value) })}
                      />
                    </div>
                  </div>
                  <Button type="submit" disabled={updateGstMutation.isPending}>
                    <Save className="h-4 w-4 mr-2" />
                    {updateGstMutation.isPending ? 'Saving...' : 'Save GST Settings'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* TDS Settings */}
          {activeTab === 'tds' && (
            <Card>
              <CardHeader>
                <CardTitle>TDS Configuration</CardTitle>
                <CardDescription>Configure TDS compliance settings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>TAN</Label>
                      <Input
                        value={currentCompany?.tan || ''}
                        disabled
                        className="bg-muted"
                      />
                      <p className="text-xs text-muted-foreground">Update in Company Settings</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-4">TDS Section Rates</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Default TDS rates as per Income Tax Act. These can be overridden per transaction.
                    </p>
                    <table className="w-full">
                      <thead className="border-b">
                        <tr>
                          <th className="py-2 text-left text-sm font-medium">Section</th>
                          <th className="py-2 text-left text-sm font-medium">Description</th>
                          <th className="py-2 text-right text-sm font-medium">Individual Rate</th>
                          <th className="py-2 text-right text-sm font-medium">Company Rate</th>
                          <th className="py-2 text-right text-sm font-medium">Threshold</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b">
                          <td className="py-2 font-mono">194J</td>
                          <td className="py-2">Professional/Technical Services</td>
                          <td className="py-2 text-right">10%</td>
                          <td className="py-2 text-right">10%</td>
                          <td className="py-2 text-right">30,000</td>
                        </tr>
                        <tr className="border-b">
                          <td className="py-2 font-mono">194C</td>
                          <td className="py-2">Contractor Payments</td>
                          <td className="py-2 text-right">1%</td>
                          <td className="py-2 text-right">2%</td>
                          <td className="py-2 text-right">30,000</td>
                        </tr>
                        <tr className="border-b">
                          <td className="py-2 font-mono">194H</td>
                          <td className="py-2">Commission/Brokerage</td>
                          <td className="py-2 text-right">5%</td>
                          <td className="py-2 text-right">5%</td>
                          <td className="py-2 text-right">15,000</td>
                        </tr>
                        <tr className="border-b">
                          <td className="py-2 font-mono">194I</td>
                          <td className="py-2">Rent</td>
                          <td className="py-2 text-right">10%</td>
                          <td className="py-2 text-right">10%</td>
                          <td className="py-2 text-right">2,40,000</td>
                        </tr>
                        <tr className="border-b">
                          <td className="py-2 font-mono">194A</td>
                          <td className="py-2">Interest (Other than Banks)</td>
                          <td className="py-2 text-right">10%</td>
                          <td className="py-2 text-right">10%</td>
                          <td className="py-2 text-right">5,000</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Integration Settings */}
          {activeTab === 'integration' && (
            <Card>
              <CardHeader>
                <CardTitle>Practice Manager Integration</CardTitle>
                <CardDescription>Connect with CA Practice Manager for seamless data sync</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="pmBaseUrl">Practice Manager URL</Label>
                      <Input
                        id="pmBaseUrl"
                        value={pmData.pmBaseUrl}
                        onChange={(e) => setPmData({ ...pmData, pmBaseUrl: e.target.value })}
                        placeholder="https://pm.example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pmApiKey">API Key</Label>
                      <Input
                        id="pmApiKey"
                        type="password"
                        value={pmData.apiKey}
                        onChange={(e) => setPmData({ ...pmData, apiKey: e.target.value })}
                        placeholder="Enter API key"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-semibold">Sync Settings</h3>
                    <div className="space-y-3">
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={pmData.autoSyncInvoices}
                          onChange={(e) => setPmData({ ...pmData, autoSyncInvoices: e.target.checked })}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <span>Auto-sync invoices (create journal entries from PM invoices)</span>
                      </label>
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={pmData.autoSyncPayments}
                          onChange={(e) => setPmData({ ...pmData, autoSyncPayments: e.target.checked })}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <span>Auto-sync payments (create bank entries from PM payments)</span>
                      </label>
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={pmData.autoSyncExpenses}
                          onChange={(e) => setPmData({ ...pmData, autoSyncExpenses: e.target.checked })}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <span>Auto-sync expenses (create expense entries from PM)</span>
                      </label>
                    </div>
                  </div>

                  {pmConfig?.lastSyncAt && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Last synced: {new Date(pmConfig.lastSyncAt).toLocaleString()}
                    </div>
                  )}

                  <div className="flex gap-4">
                    <Button type="button">
                      <Save className="h-4 w-4 mr-2" />
                      Save Integration
                    </Button>
                    <Button type="button" variant="outline">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Test Connection
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
