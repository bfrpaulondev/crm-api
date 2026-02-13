'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@apollo/client';
import { CREATE_LEAD_MUTATION, UPDATE_LEAD_MUTATION } from '@/graphql/mutations/leads';
import { GET_LEADS } from '@/graphql/queries/leads';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Lead, LeadStatus, LeadSource, CreateLeadInput, UpdateLeadInput } from '@/types';

const leadSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Please enter a valid email'),
  phone: z.string().optional(),
  company: z.string().optional(),
  status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED', 'CONVERTED']).optional(),
  source: z.enum(['WEBSITE', 'REFERRAL', 'COLD_CALL', 'EMAIL_CAMPAIGN', 'SOCIAL_MEDIA', 'TRADE_SHOW', 'OTHER']).optional(),
  estimatedValue: z.number().min(0).optional(),
  notes: z.string().optional(),
});

type LeadFormData = z.infer<typeof leadSchema>;

interface LeadFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead?: Lead | null;
  onSuccess?: () => void;
}

const statusOptions: { value: LeadStatus; label: string }[] = [
  { value: 'NEW', label: 'New' },
  { value: 'CONTACTED', label: 'Contacted' },
  { value: 'QUALIFIED', label: 'Qualified' },
  { value: 'UNQUALIFIED', label: 'Unqualified' },
  { value: 'CONVERTED', label: 'Converted' },
];

const sourceOptions: { value: LeadSource; label: string }[] = [
  { value: 'WEBSITE', label: 'Website' },
  { value: 'REFERRAL', label: 'Referral' },
  { value: 'COLD_CALL', label: 'Cold Call' },
  { value: 'EMAIL_CAMPAIGN', label: 'Email Campaign' },
  { value: 'SOCIAL_MEDIA', label: 'Social Media' },
  { value: 'TRADE_SHOW', label: 'Trade Show' },
  { value: 'OTHER', label: 'Other' },
];

export function LeadForm({ open, onOpenChange, lead, onSuccess }: LeadFormProps) {
  const [error, setError] = useState<string | null>(null);
  const isEditing = !!lead;

  const [createLead, { loading: creating }] = useMutation(CREATE_LEAD_MUTATION, {
    refetchQueries: [{ query: GET_LEADS, variables: { first: 20 } }],
    onCompleted: () => {
      toast.success('Lead created successfully');
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const [updateLead, { loading: updating }] = useMutation(UPDATE_LEAD_MUTATION, {
    refetchQueries: [{ query: GET_LEADS, variables: { first: 20 } }],
    onCompleted: () => {
      toast.success('Lead updated successfully');
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const isLoading = creating || updating;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<LeadFormData>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      firstName: lead?.firstName || '',
      lastName: lead?.lastName || '',
      email: lead?.email || '',
      phone: lead?.phone || '',
      company: lead?.company || '',
      status: lead?.status || 'NEW',
      source: lead?.source || 'WEBSITE',
      estimatedValue: lead?.estimatedValue || undefined,
      notes: lead?.notes || '',
    },
  });

  const currentStatus = watch('status');
  const currentSource = watch('source');

  const onSubmit = async (data: LeadFormData) => {
    setError(null);
    
    const input = {
      ...data,
      estimatedValue: data.estimatedValue ? Number(data.estimatedValue) : undefined,
    };

    if (isEditing && lead) {
      await updateLead({
        variables: { id: lead.id, input: input as UpdateLeadInput },
      });
    } else {
      await createLead({
        variables: { input: input as CreateLeadInput },
      });
    }
  };

  const handleClose = () => {
    reset();
    setError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Lead' : 'Add New Lead'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update the lead information below.' : 'Fill in the details to create a new lead.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                {...register('firstName')}
                placeholder="John"
                className={errors.firstName ? 'border-red-500' : ''}
              />
              {errors.firstName && (
                <p className="text-sm text-red-500">{errors.firstName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                {...register('lastName')}
                placeholder="Doe"
                className={errors.lastName ? 'border-red-500' : ''}
              />
              {errors.lastName && (
                <p className="text-sm text-red-500">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              {...register('email')}
              placeholder="john@example.com"
              className={errors.email ? 'border-red-500' : ''}
            />
            {errors.email && (
              <p className="text-sm text-red-500">{errors.email.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                {...register('phone')}
                placeholder="+1 (555) 000-0000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                {...register('company')}
                placeholder="Acme Inc."
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={currentStatus}
                onValueChange={(value: LeadStatus) => setValue('status', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="source">Source</Label>
              <Select
                value={currentSource}
                onValueChange={(value: LeadSource) => setValue('source', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  {sourceOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="estimatedValue">Estimated Value ($)</Label>
            <Input
              id="estimatedValue"
              type="number"
              {...register('estimatedValue', { valueAsNumber: true })}
              placeholder="10000"
              min="0"
            />
            {errors.estimatedValue && (
              <p className="text-sm text-red-500">{errors.estimatedValue.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              {...register('notes')}
              placeholder="Additional notes about this lead..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="bg-purple-600 hover:bg-purple-700">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEditing ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                isEditing ? 'Update Lead' : 'Create Lead'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
