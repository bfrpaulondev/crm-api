import { gql } from '@apollo/client';

export const GET_CURRENT_USER = gql`
  query GetCurrentUser {
    me {
      id
      email
      firstName
      lastName
      role
    }
  }
`;

export const GET_TENANT = gql`
  query GetTenant {
    tenant {
      id
      name
      slug
      plan
    }
  }
`;

export const GET_TENANT_BY_SLUG = gql`
  query GetTenantBySlug($slug: String!) {
    tenantBySlug(slug: $slug) {
      id
      name
      slug
      plan
    }
  }
`;
