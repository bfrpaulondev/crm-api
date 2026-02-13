import { gql } from '@apollo/client';

export const CREATE_LEAD_MUTATION = gql`
  mutation CreateLead($firstName: String!, $lastName: String!, $email: String!, $phone: String, $companyName: String) {
    createLead(firstName: $firstName, lastName: $lastName, email: $email, phone: $phone, companyName: $companyName) {
      id
      email
      status
    }
  }
`;

export const QUALIFY_LEAD_MUTATION = gql`
  mutation QualifyLead($id: String!) {
    qualifyLead(id: $id) {
      id
      status
    }
  }
`;

export const CONVERT_LEAD_MUTATION = gql`
  mutation ConvertLead($leadId: String!, $createOpportunity: Boolean, $opportunityName: String, $opportunityAmount: Float) {
    convertLead(leadId: $leadId, createOpportunity: $createOpportunity, opportunityName: $opportunityName, opportunityAmount: $opportunityAmount) {
      leadId
      accountId
      contactId
      opportunityId
    }
  }
`;

export const DELETE_LEAD_MUTATION = gql`
  mutation DeleteLead($id: String!) {
    deleteLead(id: $id)
  }
`;

export const BULK_DELETE_LEADS_MUTATION = gql`
  mutation BulkDeleteLeads($ids: [String!]!) {
    bulkDeleteLeads(ids: $ids) {
      success
      processedCount
      successCount
      failedCount
      errors {
        index
        error
      }
    }
  }
`;

export const CREATE_WEBHOOK_MUTATION = gql`
  mutation CreateWebhook($name: String!, $url: String!, $events: [String!]!) {
    createWebhook(name: $name, url: $url, events: $events) {
      id
      name
      url
      isActive
    }
  }
`;

export const DELETE_WEBHOOK_MUTATION = gql`
  mutation DeleteWebhook($id: String!) {
    deleteWebhook(id: $id)
  }
`;
