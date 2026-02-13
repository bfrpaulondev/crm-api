import { ApolloLink, Observable } from '@apollo/client';

const TOKEN_KEY = 'crm_access_token';
const REFRESH_TOKEN_KEY = 'crm_refresh_token';

export const getAccessToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
};

export const getRefreshToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
};

export const setTokens = (accessToken: string, refreshToken: string): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
};

export const clearTokens = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
};

export const getAuthHeaders = (): Record<string, string> => {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Auth link that adds token to headers
export const authLink = new ApolloLink((operation, forward) => {
  const token = getAccessToken();
  
  operation.setContext(({ headers = {} }) => ({
    headers: {
      ...headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  }));

  return forward(operation);
});

// Error handling link for token refresh
export const errorLink = new ApolloLink((operation, forward) => {
  return new Observable((observer) => {
    let retryCount = 0;
    const maxRetries = 1;

    const handleOperation = () => {
      forward(operation).subscribe({
        next: (result) => observer.next(result),
        error: (error) => {
          const isAuthError = 
            error?.graphQLErrors?.some(
              (e: { extensions?: { code?: string } }) => e?.extensions?.code === 'UNAUTHENTICATED'
            ) ||
            error?.networkError?.statusCode === 401;

          if (isAuthError && retryCount < maxRetries) {
            retryCount++;
            const refreshToken = getRefreshToken();
            
            if (refreshToken) {
              // Attempt to refresh the token
              fetch('/api/auth/refresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken }),
              })
                .then((res) => res.json())
                .then((data) => {
                  if (data.accessToken) {
                    setTokens(data.accessToken, data.refreshToken || refreshToken);
                    operation.setContext(({ headers = {} }) => ({
                      headers: {
                        ...headers,
                        Authorization: `Bearer ${data.accessToken}`,
                      },
                    }));
                    handleOperation();
                  } else {
                    clearTokens();
                    window.location.href = '/login';
                    observer.error(error);
                  }
                })
                .catch(() => {
                  clearTokens();
                  window.location.href = '/login';
                  observer.error(error);
                });
            } else {
              clearTokens();
              window.location.href = '/login';
              observer.error(error);
            }
          } else {
            observer.error(error);
          }
        },
        complete: () => observer.complete(),
      });
    };

    handleOperation();
  });
});
