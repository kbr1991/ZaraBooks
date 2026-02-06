import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  role: string;
}

interface Company {
  id: string;
  name: string;
  legalName: string | null;
  pan: string | null;
  gstin: string | null;
  tan: string | null;
  cin: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  gaapStandard: string;
  role: string;
}

interface AuthData {
  user: User | null;
  companies: Company[];
  currentCompany: Company | null;
  currentRole: string | null;
}

export function useAuth() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data, isLoading, error, refetch } = useQuery<AuthData>({
    queryKey: ['auth'],
    queryFn: async () => {
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
      });
      if (!response.ok) {
        if (response.status === 401) {
          return { user: null, companies: [], currentCompany: null, currentRole: null };
        }
        throw new Error('Failed to fetch user');
      }
      return response.json();
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(credentials),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Login failed');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Logout failed');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.clear();
      navigate('/login');
    },
  });

  const selectCompanyMutation = useMutation({
    mutationFn: async (companyId: string) => {
      const response = await fetch('/api/auth/select-company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ companyId }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to select company');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth'] });
      queryClient.invalidateQueries(); // Invalidate all queries when company changes
    },
  });

  return {
    user: data?.user || null,
    companies: data?.companies || [],
    currentCompany: data?.currentCompany || null,
    currentRole: data?.currentRole || null,
    isLoading,
    error,
    refetch,
    login: loginMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    selectCompany: selectCompanyMutation.mutateAsync,
    isLoginPending: loginMutation.isPending,
    isLogoutPending: logoutMutation.isPending,
  };
}

export function useIsPartner() {
  const { currentRole } = useAuth();
  return currentRole === 'owner' || currentRole === 'accountant';
}

export function useIsOwner() {
  const { currentRole } = useAuth();
  return currentRole === 'owner';
}
