'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils/formatters';
import { PipelineStageSummary, OpportunityStage } from '@/types';
import { BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PipelineSummaryChartProps {
  data: PipelineStageSummary[];
}

const stageColors: Record<OpportunityStage, { bg: string; bar: string }> = {
  NEW: { bg: 'bg-blue-50', bar: 'bg-blue-500' },
  CONTACTED: { bg: 'bg-amber-50', bar: 'bg-amber-500' },
  QUALIFIED: { bg: 'bg-emerald-50', bar: 'bg-emerald-500' },
  PROPOSAL: { bg: 'bg-purple-50', bar: 'bg-purple-500' },
  NEGOTIATION: { bg: 'bg-indigo-50', bar: 'bg-indigo-500' },
  CLOSED_WON: { bg: 'bg-green-50', bar: 'bg-green-500' },
  CLOSED_LOST: { bg: 'bg-slate-50', bar: 'bg-slate-400' },
};

const stageLabels: Record<OpportunityStage, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  QUALIFIED: 'Qualified',
  PROPOSAL: 'Proposal',
  NEGOTIATION: 'Negotiation',
  CLOSED_WON: 'Won',
  CLOSED_LOST: 'Lost',
};

export function PipelineSummaryChart({ data }: PipelineSummaryChartProps) {
  // Calculate max value for percentage bars
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  if (data.length === 0) {
    return (
      <Card className="bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-600" />
            Pipeline Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-500 text-center py-8">No pipeline data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-purple-600" />
          Pipeline Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data
            .filter((item) => item.stage !== 'CLOSED_LOST')
            .map((item) => {
              const colors = stageColors[item.stage] || stageColors.NEW;
              const percentage = (item.value / maxValue) * 100;
              
              return (
                <div key={item.stage} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">
                      {stageLabels[item.stage] || item.stage}
                    </span>
                    <span className="text-slate-500">
                      {item.count} · {formatCurrency(item.value)}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        colors.bar
                      )}
                      style={{ width: `${percentage}%` }}
                      role="progressbar"
                      aria-label={`${stageLabels[item.stage]}: ${formatCurrency(item.value)}`}
                      aria-valuenow={percentage}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    />
                  </div>
                </div>
              );
            })}
        </div>
      </CardContent>
    </Card>
  );
}
