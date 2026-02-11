import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import {
  Building2,
  Mail,
  Phone,
  ArrowRight,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export default function PartnerRegister() {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);

  const [formData, setFormData] = useState({
    // Contact Info
    name: '',
    primaryEmail: '',
    primaryPhone: '',

    // Address
    address: '',
    city: '',
    state: '',

    // Compliance
    pan: '',
    gstin: '',

    // Bank Details
    bankAccountName: '',
    bankAccountNumber: '',
    bankIfsc: '',
  });

  const registerMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch('/api/partner/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Registration failed');
      }
      return response.json();
    },
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: 'destructive' });
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = () => {
    registerMutation.mutate(formData);
  };

  const canProceed = () => {
    if (step === 1) {
      return formData.name && formData.primaryEmail && formData.primaryPhone;
    }
    if (step === 2) {
      return formData.address && formData.city && formData.state;
    }
    if (step === 3) {
      return formData.pan && formData.gstin;
    }
    return true;
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold">Application Submitted!</h2>
            <p className="text-muted-foreground">
              Thank you for applying to become a ZaraBooks partner. We'll review your
              application and get back to you within 2-3 business days.
            </p>
            <div className="pt-4">
              <Button asChild>
                <Link to="/login">Back to Login</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold">ZB</span>
            </div>
            <span className="text-2xl font-bold">ZaraBooks</span>
          </div>
          <h1 className="text-3xl font-bold">Become a Partner</h1>
          <p className="text-muted-foreground">
            Join our partner program and earn commissions by referring clients
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`flex items-center ${s < 4 ? 'flex-1 max-w-[100px]' : ''}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  s <= step
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {s}
              </div>
              {s < 4 && (
                <div
                  className={`flex-1 h-1 mx-2 ${
                    s < step ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>
              {step === 1 && 'Contact Information'}
              {step === 2 && 'Business Address'}
              {step === 3 && 'Compliance Details'}
              {step === 4 && 'Bank Details'}
            </CardTitle>
            <CardDescription>
              {step === 1 && 'Tell us about yourself and your firm'}
              {step === 2 && 'Where is your business located?'}
              {step === 3 && 'Required for tax compliance'}
              {step === 4 && 'For receiving commission payouts'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {step === 1 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name">Firm / Partner Name *</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      className="pl-10"
                      placeholder="ABC & Associates"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="primaryEmail">Email Address *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="primaryEmail"
                      name="primaryEmail"
                      type="email"
                      value={formData.primaryEmail}
                      onChange={handleChange}
                      className="pl-10"
                      placeholder="partner@example.com"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="primaryPhone">Phone Number *</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="primaryPhone"
                      name="primaryPhone"
                      value={formData.primaryPhone}
                      onChange={handleChange}
                      className="pl-10"
                      placeholder="+91 98765 43210"
                    />
                  </div>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="address">Address *</Label>
                  <Textarea
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    placeholder="123, Main Street, Near XYZ"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City *</Label>
                    <Input
                      id="city"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      placeholder="Mumbai"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State *</Label>
                    <Input
                      id="state"
                      name="state"
                      value={formData.state}
                      onChange={handleChange}
                      placeholder="Maharashtra"
                    />
                  </div>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="pan">PAN Number *</Label>
                  <Input
                    id="pan"
                    name="pan"
                    value={formData.pan}
                    onChange={handleChange}
                    placeholder="ABCDE1234F"
                    className="uppercase"
                    maxLength={10}
                  />
                  <p className="text-xs text-muted-foreground">
                    Required for TDS deduction on payouts
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gstin">GSTIN *</Label>
                  <Input
                    id="gstin"
                    name="gstin"
                    value={formData.gstin}
                    onChange={handleChange}
                    placeholder="27ABCDE1234F1Z5"
                    className="uppercase"
                    maxLength={15}
                  />
                </div>
              </>
            )}

            {step === 4 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="bankAccountName">Account Holder Name</Label>
                  <Input
                    id="bankAccountName"
                    name="bankAccountName"
                    value={formData.bankAccountName}
                    onChange={handleChange}
                    placeholder="ABC & Associates"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bankAccountNumber">Account Number</Label>
                  <Input
                    id="bankAccountNumber"
                    name="bankAccountNumber"
                    value={formData.bankAccountNumber}
                    onChange={handleChange}
                    placeholder="1234567890123"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bankIfsc">IFSC Code</Label>
                  <Input
                    id="bankIfsc"
                    name="bankIfsc"
                    value={formData.bankIfsc}
                    onChange={handleChange}
                    placeholder="SBIN0001234"
                    className="uppercase"
                    maxLength={11}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Bank details can be updated later. You can proceed without filling these now.
                </p>
              </>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-4">
              {step > 1 ? (
                <Button variant="outline" onClick={() => setStep(step - 1)}>
                  Back
                </Button>
              ) : (
                <Button variant="outline" asChild>
                  <Link to="/login">Cancel</Link>
                </Button>
              )}

              {step < 4 ? (
                <Button onClick={() => setStep(step + 1)} disabled={!canProceed()}>
                  Continue
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={registerMutation.isPending}>
                  {registerMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Application'
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Benefits */}
        <Card>
          <CardHeader>
            <CardTitle>Partner Benefits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Recurring Commissions</p>
                  <p className="text-sm text-muted-foreground">
                    Earn 10-25% commission on all referred subscriptions
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Tier Rewards</p>
                  <p className="text-sm text-muted-foreground">
                    Unlock higher commission rates as you grow
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Dedicated Support</p>
                  <p className="text-sm text-muted-foreground">
                    Priority support for you and your clients
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Partner Portal</p>
                  <p className="text-sm text-muted-foreground">
                    Track referrals, commissions, and payouts
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
