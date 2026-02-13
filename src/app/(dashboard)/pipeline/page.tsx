'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_PIPELINE, GET_OPPORTUNITIES } from '@/graphql/queries/leads';
import { CREATE_OPPORTUNITY_MUTATION } from '@/graphql/mutations/leads';
import { PipelineBoard } from '@/components/dashboard/pipeline-board';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, GitBranch, Plus, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { OpportunityStage } from '@/types';

const stageOptions: { value: OpportunityStage; label: string }[] = [
  { value: 'NEW', label: 'New' },
  { value: 'CONTACTED', label: 'Contacted' },
  { value: 'QUALIFIED', label: 'Qualified' },
  { value: 'PROPOSAL', label: 'Proposal' },
  { value: 'NEGOTIATION', label: 'Negotiation' },
  { value: 'CLOSED_WON', label: 'Won' },
  { value: 'CLOSED_LOST', label: 'Lost' },
];

export default function PipelinePage() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newOpportunity, setNewOpportunity] = useState({
    name: '',
    value: '',
    stage: 'NEW' as OpportunityStage,
    probability: 50,
  });
  const [formError, setFormError] = useState<string | null>(null);

  const { data, loading, error, refetch } = useQuery(GET_PIPELINE, {
    fetchPolicy: 'cache-and-network',
  });

  const [createOpportunity, { loading: creating }] = useMutation(CREATE_OPPORTUNITY_MUTATION, {
    refetchQueries: [{ query: GET_PIPELINE }, { query: GET_OPPORTUNITIES, variables: { first: 20 } }],
    onCompleted: () => {
      toast.success('Opportunity created successfully');
      setShowCreateForm(false);
      setNewOpportunity({ name: '', value: '', stage: 'NEW', probability: 50 });
    },
    onError: (err) => {
      setFormError(err.message);
    },
  });

  const handleCreateOpportunity = async () => {
    setFormError(null);
    
    if (!newOpportunity.name.trim()) {
      setFormError('Opportunity name is required');
      return;
    }
    
    if (!newOpportunity.value || parseFloat(newOpportunity.value) <= 0) {
      setFormError('Please enter a valid value');
      return;
    }

    await createOpportunity({
      variables: {
        input: {
          name: newOpportunity.name.trim(),
          value: parseFloat(newOpportunity.value),
          stage: newOpportunity.stage,
          probability: newOpportunity.probability,
        },
      },
    });
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-red-500">Failed to load pipeline</p>
        <Button onClick={() => refetch()} variant="outline">
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Pipeline</h1>
          <p className="text-slate-600 mt-1">
            Visualize and manage your sales pipeline
          </p>
        </div>
        <Button
          onClick={() => setShowCreateForm(true)}
          className="bg-purple-600 hover:bg-purple-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Opportunity
        </Button>
      </div>

      {/* Pipeline Board */}
      <div className="bg-slate-100 rounded-xl p-4">
        {data?.pipeline && data.pipeline.length > 0 ? (
          <PipelineBoard data={data.pipeline} onRefresh={() => refetch()} />
        ) : (
          <div className="flex flex-col items-center justify-center py-16">
            <GitBranch className="w-16 h-16 text-slate-300 mb-4" />
            <p className="text-slate-500 text-lg mb-2">No opportunities in pipeline</p>
            <p className="text-slate-400 mb-4">Create your first opportunity to get started</p>
            <Button onClick={() => setShowCreateForm(true)} className="bg-purple-600 hover:bg-purple-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Opportunity
            </Button>
          </div>
        )}
      </div>

      {/* Create Opportunity Modal */}
      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Create Opportunity</DialogTitle>
            <DialogDescription>
              Add a new opportunity to your pipeline
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {formError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <p className="text-sm">{formError}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Opportunity Name *</Label>
              <Input
                id="name"
                value={newOpportunity.name}
                onChange={(e) => setNewOpportunity({ ...newOpportunity, name: e.target.value })}
                placeholder="Enterprise License Deal"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="value">Value ($) *</Label>
              <Input
                id="value"
                type="number"
                value={newOpportunity.value}
                onChange={(e) => setNewOpportunity({ ...newOpportunity, value: e.target.value })}
                placeholder="50000"
                min="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="stage">Stage</Label>
              <Select
                value={newOpportunity.stage}
                onValueChange={(value: OpportunityStage) =>
                  setNewOpportunity({ ...newOpportunity, stage: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  {stageOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="probability">Probability: {newOpportunity.probability}%</Label>
              <input
                id="probability"
                type="range"
                min="0"
                max="100"
                value={newOpportunity.probability}
                onChange={(e) =>
                  setNewOpportunity({ ...newOpportunity, probability: parseInt(e.target.value) })
                }
                className="w-full"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateForm(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateOpportunity}
              disabled={creating}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {creating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Opportunity'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
