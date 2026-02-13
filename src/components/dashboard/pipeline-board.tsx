'use client';

import { useState } from 'react';
import { useMutation } from '@apollo/client';
import { UPDATE_OPPORTUNITY_STAGE_MUTATION } from '@/graphql/mutations/leads';
import { GET_PIPELINE } from '@/graphql/queries/leads';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatCurrency, getInitials } from '@/lib/utils/formatters';
import { Opportunity, OpportunityStage } from '@/types';
import { cn } from '@/lib/utils';
import { GripVertical, DollarSign, Calendar, User } from 'lucide-react';
import { toast } from 'sonner';

interface PipelineBoardProps {
  data: Array<{
    stage: OpportunityStage;
    opportunities: Opportunity[];
  }>;
  onRefresh?: () => void;
}

const stageConfig: Record<OpportunityStage, { label: string; color: string; bg: string }> = {
  NEW: { label: 'New', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  CONTACTED: { label: 'Contacted', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  QUALIFIED: { label: 'Qualified', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  PROPOSAL: { label: 'Proposal', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  NEGOTIATION: { label: 'Negotiation', color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' },
  CLOSED_WON: { label: 'Won', color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
  CLOSED_LOST: { label: 'Lost', color: 'text-slate-700', bg: 'bg-slate-50 border-slate-200' },
};

const stageOrder: OpportunityStage[] = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'PROPOSAL',
  'NEGOTIATION',
  'CLOSED_WON',
];

export function PipelineBoard({ data, onRefresh }: PipelineBoardProps) {
  const [draggedItem, setDraggedItem] = useState<Opportunity | null>(null);
  const [dragSource, setDragSource] = useState<OpportunityStage | null>(null);

  const [updateStage, { loading }] = useMutation(UPDATE_OPPORTUNITY_STAGE_MUTATION, {
    onCompleted: () => {
      toast.success('Opportunity moved successfully');
      onRefresh?.();
    },
    onError: (err) => {
      toast.error(`Failed to move opportunity: ${err.message}`);
    },
  });

  const handleDragStart = (opportunity: Opportunity, source: OpportunityStage) => {
    setDraggedItem(opportunity);
    setDragSource(source);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (targetStage: OpportunityStage) => {
    if (draggedItem && dragSource && dragSource !== targetStage) {
      await updateStage({
        variables: { id: draggedItem.id, stage: targetStage },
      });
    }
    setDraggedItem(null);
    setDragSource(null);
  };

  const opportunitiesByStage = new Map<OpportunityStage, Opportunity[]>();
  stageOrder.forEach((stage) => {
    opportunitiesByStage.set(stage, []);
  });
  
  data?.forEach((item) => {
    if (opportunitiesByStage.has(item.stage)) {
      opportunitiesByStage.set(item.stage, item.opportunities);
    }
  });

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {stageOrder.map((stage) => {
        const config = stageConfig[stage];
        const opportunities = opportunitiesByStage.get(stage) || [];
        const totalValue = opportunities.reduce((sum, opp) => sum + (opp.value || 0), 0);

        return (
          <div
            key={stage}
            className="flex-shrink-0 w-72"
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(stage)}
          >
            <Card className={cn('h-full border-t-4', config.bg)}>
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className={cn('text-sm font-semibold', config.color)}>
                    {config.label}
                  </CardTitle>
                  <Badge variant="secondary" className="text-xs">
                    {opportunities.length}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {formatCurrency(totalValue)}
                </p>
              </CardHeader>
              <CardContent className="p-2 space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto">
                {opportunities.map((opportunity) => (
                  <div
                    key={opportunity.id}
                    draggable
                    onDragStart={() => handleDragStart(opportunity, stage)}
                    className={cn(
                      'p-3 bg-white rounded-lg border border-slate-200 shadow-sm cursor-move',
                      'hover:shadow-md hover:border-purple-300 transition-all',
                      loading && 'opacity-50 pointer-events-none'
                    )}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="text-sm font-medium text-slate-900 line-clamp-1">
                        {opportunity.name}
                      </h4>
                      <GripVertical className="w-4 h-4 text-slate-300 flex-shrink-0 ml-2" />
                    </div>
                    
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-sm text-slate-600">
                        <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="font-medium">{formatCurrency(opportunity.value)}</span>
                      </div>
                      
                      {opportunity.expectedCloseDate && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{new Date(opportunity.expectedCloseDate).toLocaleDateString()}</span>
                        </div>
                      )}
                      
                      {opportunity.assignedTo && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <User className="w-3.5 h-3.5" />
                          <span>{opportunity.assignedTo.name}</span>
                        </div>
                      )}
                      
                      {opportunity.lead && (
                        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100">
                          <Avatar className="h-5 w-5 bg-slate-100">
                            <AvatarFallback className="bg-slate-100 text-slate-600 text-[8px]">
                              {getInitials(opportunity.lead.firstName, opportunity.lead.lastName)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-slate-500 truncate">
                            {opportunity.lead.company || `${opportunity.lead.firstName} ${opportunity.lead.lastName}`}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {opportunities.length === 0 && (
                  <div className="py-8 text-center">
                    <p className="text-xs text-slate-400">No opportunities</p>
                    <p className="text-xs text-slate-400 mt-1">Drag items here</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );
      })}
    </div>
  );
}
