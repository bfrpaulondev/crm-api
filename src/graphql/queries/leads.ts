import { gql } from '@apollo/client';

// Simple lead list query matching the API
export const GET_LEADS = gql`
  query GetLeads {
    leads {
      id
      firstName
      lastName
      email
      phone
      companyName
      status
      createdAt
    }
  }
`;

export const GET_LEAD = gql`
  query GetLead($id: String!) {
    lead(id: $id) {
      id
      firstName
      lastName
      email
      phone
      companyName
      status
      createdAt
    }
  }
`;

// Dashboard stats
export const GET_DASHBOARD = gql`
  query GetDashboard {
    dashboard {
      totalLeads
      qualifiedLeads
      convertedLeads
      totalOpportunities
      openOpportunities
      totalPipelineValue
      wonValue
      lostValue
    }
  }
`;

// Opportunities
export const GET_OPPORTUNITIES = gql`
  query GetOpportunities {
    opportunities {
      id
      name
      amount
      status
      probability
      createdAt
    }
  }
`;

// Stages for pipeline
export const GET_STAGES = gql`
  query GetStages {
    stages {
      id
      name
      order
      probability
    }
  }
`;

// Accounts
export const GET_ACCOUNTS = gql`
  query GetAccounts {
    accounts {
      id
      name
      domain
      website
      createdAt
    }
  }
`;

// Contacts
export const GET_CONTACTS = gql`
  query GetContacts {
    contacts {
      id
      firstName
      lastName
      email
      createdAt
    }
  }
`;

// Lead conversion stats
export const GET_LEAD_CONVERSION_STATS = gql`
  query GetLeadConversionStats {
    leadConversionStats {
      source
      total
      converted
      conversionRate
    }
  }
`;

// Activity stats
export const GET_ACTIVITY_STATS = gql`
  query GetActivityStats {
    activityStats {
      type
      count
      completed
    }
  }
`;
