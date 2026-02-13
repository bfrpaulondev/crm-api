'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react/hooks';
import { useParams, useRouter } from 'next/navigation';
import { GET_LEAD } from '@/graphql/queries/leads';
import {
  DELETE_LEAD_MUTATION,
  QUALIFY_LEAD_MUTATION,
  CONVERT_LEAD_MUTATION,
} from '@/graphql/mutations/leads';
import { GET_LEADS } from '@/graphql/queries/leads';
import { LeadForm } from '@/components/forms/lead-form';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  ArrowLeft,
  Loader2,
  Mail,
  Phone,
  Building2,
  Calendar,
  User,
  Edit,
  Trash2,
  CheckCircle,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { Lead, LeadStatus } from '@/types';
import { formatDate, formatDateTime, formatCurrency, getInitials } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const statusStyles: Record<LeadStatus, { bg: string; text: string; icon: React.ComponentType<{ className?: string }> }> = {
  NEW: { bg: 'bg-blue-100', text: 'text-blue-700', icon: AlertCircle },
  CONTACTED: { bg: 'bg-amber-100', text: 'text-amber-700', icon: Mail },
  QUALIFIED: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: CheckCircle },
  UNQUALIFIED: { bg: 'bg-slate-100', text: 'text-slate-700', icon: AlertCircle },
  CONVERTED: { bg: 'bg-purple-100', text: 'text-purple-700', icon: CheckCircle },
};

const sourceLabels: Record<string, string> = {
  WEBSITE: 'Website',
  REFERRAL: 'Referral',
  COLD_CALL: 'Cold Call',
  EMAIL_CAMPAIGN: 'Email Campaign',
  SOCIAL_MEDIA: 'Social Media',
  TRADE_SHOW: 'Trade Show',
  OTHER: 'Other',
};

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const leadId = params.id as string;
  const [showEditForm, setShowEditForm] = useState(false);

  const { data, loading, error, refetch } = useQuery(GET_LEAD, {
    variables: { id: leadId },
    fetchPolicy: 'cache-and-network',
  });

  const [deleteLead, { loading: deleting }] = useMutation(DELETE_LEAD_MUTATION, {
    refetchQueries: [{ query: GET_LEADS, variables: { first: 20 } }],
    onCompleted: () => {
      toast.success('Lead deleted successfully');
      router.push('/dashboard/leads');
    },
    onError: (err) => {
      toast.error(`Failed to delete lead: ${err.message}`);
    },
  });

  const [qualifyLead, { loading: qualifying }] = useMutation(QUALIFY_LEAD_MUTATION, {
    onCompleted: () => {
      toast.success('Lead qualified successfully');
      refetch();
    },
    onError: (err) => {
      toast.error(`Failed to qualify lead: ${err.message}`);
    },
  });

  const [convertLead, { loading: converting }] = useMutation(CONVERT_LEAD_MUTATION, {
    onCompleted: () => {
      toast.success('Lead converted to opportunity');
      refetch();
    },
    onError: (err) => {
      toast.error(`Failed to convert lead: ${err.message}`);
    },
  });

  const lead: Lead | undefined = data?.lead;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-red-500">Lead not found</p>
        <Button onClick={() => router.push('/dashboard/leads')} variant="outline">
          Back to Leads
        </Button>
      </div>
    );
  }

  const statusStyle = statusStyles[lead.status] || statusStyles.NEW;
  const StatusIcon = statusStyle.icon;

  const handleDelete = async () => {
    await deleteLead({ variables: { id: leadId } });
  };

  const handleQualify = async () => {
    await qualifyLead({ variables: { id: leadId } });
  };

  const handleConvert = async () => {
    await convertLead({ variables: { id: leadId } });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/dashboard/leads')}
            className="text-slate-600"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 bg-purple-100">
              <AvatarFallback className="bg-purple-100 text-purple-700 text-lg font-medium">
                {getInitials(lead.firstName, lead.lastName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                {lead.firstName} {lead.lastName}
              </h1>
              <p className="text-slate-500">{lead.email}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShowEditForm(true)}
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Lead</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this lead? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={deleting}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status Card */}
          <Card className="bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-slate-900">Lead Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className={cn('p-2 rounded-lg', statusStyle.bg)}>
                    <StatusIcon className={cn('w-5 h-5', statusStyle.text)} />
                  </div>
                  <Badge
                    variant="secondary"
                    className={cn('font-medium text-base px-4 py-1', statusStyle.bg, statusStyle.text)}
                  >
                    {lead.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  {lead.status === 'NEW' && (
                    <Button
                      onClick={handleQualify}
                      disabled={qualifying}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      {qualifying ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <ArrowRight className="w-4 h-4 mr-2" />
                      )}
                      Qualify
                    </Button>
                  )}
                  {lead.status === 'QUALIFIED' && (
                    <Button
                      onClick={handleConvert}
                      disabled={converting}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      {converting ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4 mr-2" />
                      )}
                      Convert to Opportunity
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact Info */}
          <Card className="bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-slate-900">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <Mail className="w-5 h-5 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">Email</p>
                  <a href={`mailto:${lead.email}`} className="text-slate-900 hover:text-purple-600">
                    {lead.email}
                  </a>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <Phone className="w-5 h-5 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">Phone</p>
                  <p className="text-slate-900">{lead.phone || 'Not provided'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <Building2 className="w-5 h-5 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">Company</p>
                  <p className="text-slate-900">{lead.company || 'Not provided'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <Calendar className="w-5 h-5 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">Created</p>
                  <p className="text-slate-900">{formatDateTime(lead.createdAt)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          {lead.notes && (
            <Card className="bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-slate-900">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 whitespace-pre-wrap">{lead.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Value Card */}
          <Card className="bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-slate-900">Estimated Value</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-slate-900">
                {formatCurrency(lead.estimatedValue)}
              </p>
            </CardContent>
          </Card>

          {/* Source Card */}
          <Card className="bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-slate-900">Lead Source</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary" className="bg-slate-100 text-slate-700 font-medium">
                {sourceLabels[lead.source] || lead.source}
              </Badge>
            </CardContent>
          </Card>

          {/* Assigned To */}
          {lead.assignedTo && (
            <Card className="bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-slate-900">Assigned To</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 bg-purple-100">
                    <AvatarFallback className="bg-purple-100 text-purple-700 text-sm font-medium">
                      {getInitials(
                        lead.assignedTo?.name?.split(' ')[0] || '',
                        lead.assignedTo?.name?.split(' ')[1] || ''
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-slate-900">{lead.assignedTo.name}</p>
                    <p className="text-xs text-slate-500">{lead.assignedTo.email}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Timeline */}
          <Card className="bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-slate-900">Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 mt-2 rounded-full bg-purple-600" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">Lead Created</p>
                    <p className="text-xs text-slate-500">{formatDateTime(lead.createdAt)}</p>
                  </div>
                </div>
                {lead.updatedAt !== lead.createdAt && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 mt-2 rounded-full bg-slate-400" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">Last Updated</p>
                      <p className="text-xs text-slate-500">{formatDateTime(lead.updatedAt)}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Modal */}
      <LeadForm
        open={showEditForm}
        onOpenChange={setShowEditForm}
        lead={lead}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
