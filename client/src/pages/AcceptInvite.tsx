import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle, XCircle, LogIn, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/useToast';

interface AcceptResult {
  message: string;
  company: {
    id: string;
    name: string;
  };
  role: string;
}

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const token = searchParams.get('token');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [acceptedCompany, setAcceptedCompany] = useState<AcceptResult | null>(null);

  // Check if user is authenticated
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        setIsAuthenticated(res.ok);
      } catch {
        setIsAuthenticated(false);
      }
    };
    checkAuth();
  }, []);

  const acceptMutation = useMutation({
    mutationFn: async (inviteToken: string) => {
      const res = await fetch('/api/users/accept-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token: inviteToken }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to accept invitation');
      }

      return res.json() as Promise<AcceptResult>;
    },
    onSuccess: (data) => {
      setAcceptedCompany(data);
      toast({
        title: 'Invitation Accepted',
        description: `You've joined ${data.company.name} as ${data.role}`,
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

  // Auto-accept if authenticated and token present
  useEffect(() => {
    if (isAuthenticated && token && !acceptMutation.isPending && !acceptMutation.isSuccess && !acceptMutation.isError) {
      acceptMutation.mutate(token);
    }
  }, [isAuthenticated, token]);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
            <CardTitle>Invalid Invitation Link</CardTitle>
            <CardDescription>
              The invitation link is missing a required token. Please check your email and try again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/login">
              <Button className="w-full">Go to Login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Not authenticated - show login/register options
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <UserPlus className="w-6 h-6 text-blue-600" />
            </div>
            <CardTitle>Accept Invitation</CardTitle>
            <CardDescription>
              You've been invited to join a company on Zara Books. Please sign in or create an account to accept.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link to={`/login?redirect=/accept-invite?token=${token}`}>
              <Button className="w-full" variant="default">
                <LogIn className="w-4 h-4 mr-2" />
                Sign In
              </Button>
            </Link>
            <Link to={`/register?redirect=/accept-invite?token=${token}`}>
              <Button className="w-full" variant="outline">
                <UserPlus className="w-4 h-4 mr-2" />
                Create Account
              </Button>
            </Link>
            <p className="text-xs text-center text-gray-500 mt-4">
              Make sure to use the same email address that received this invitation.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Processing or error state
  if (acceptMutation.isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
            </div>
            <CardTitle>Accepting Invitation</CardTitle>
            <CardDescription>Please wait while we process your invitation...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (acceptMutation.isError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
            <CardTitle>Invitation Failed</CardTitle>
            <CardDescription>
              {acceptMutation.error?.message || 'Unable to accept the invitation. It may have expired or already been used.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full" onClick={() => acceptMutation.mutate(token)}>
              Try Again
            </Button>
            <Link to="/">
              <Button className="w-full" variant="outline">
                Go to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (acceptedCompany) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <CardTitle>Welcome!</CardTitle>
            <CardDescription>
              You've successfully joined <strong>{acceptedCompany.company.name}</strong> as <strong>{acceptedCompany.role}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => navigate('/')}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
