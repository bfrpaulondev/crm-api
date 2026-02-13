'use client';

import { ApolloProvider } from '@apollo/client';
import { getApolloClient } from './client';
import { AuthProvider } from '@/lib/auth/context';
import { Toaster } from '@/components/ui/sonner';

interface ApolloProviderWrapperProps {
  children: React.ReactNode;
}

export function ApolloProviderWrapper({ children }: ApolloProviderWrapperProps) {
  const client = getApolloClient();
  
  return (
    <ApolloProvider client={client}>
      <AuthProvider>
        {children}
        <Toaster position="top-right" richColors closeButton />
      </AuthProvider>
    </ApolloProvider>
  );
}
