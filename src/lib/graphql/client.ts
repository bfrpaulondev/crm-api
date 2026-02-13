// GraphQL Client using native fetch - compatible with Next.js 16

const API_URL = 'https://crm-api-89lh.onrender.com/graphql';

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string; code?: string }>;
}

// Token management
let accessToken: string | null = null;
let refreshToken: string | null = null;

export function setTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
  if (typeof window !== 'undefined') {
    localStorage.setItem('accessToken', access);
    localStorage.setItem('refreshToken', refresh);
  }
}

export function getAccessToken(): string | null {
  if (accessToken) return accessToken;
  if (typeof window !== 'undefined') {
    accessToken = localStorage.getItem('accessToken');
    return accessToken;
  }
  return null;
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }
}

// GraphQL request function
export async function graphqlRequest<T>(
  query: string,
  variables?: Record<string, unknown>,
  headers?: Record<string, string>
): Promise<T> {
  const token = getAccessToken();
  
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: JSON.stringify({ query, variables }),
  });

  const result: GraphQLResponse<T> = await response.json();

  if (result.errors && result.errors.length > 0) {
    throw new Error(result.errors[0].message);
  }

  return result.data as T;
}

// Export gql tag for syntax highlighting
export function gql(strings: TemplateStringsArray, ...values: unknown[]): string {
  return strings.reduce((result, string, i) => result + string + (values[i] || ''), '');
}
