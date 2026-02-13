'use client';

import { useQuery } from '@apollo/client';
import { GET_DASHBOARD_METRICS } from '@/graphql/queries/leads';
import { MetricCard } from '@/components/dashboard/metric-card';
import { RecentLeadsTable } from '@/components/dashboard/recent-leads-table';
import { PipelineSummaryChart } from '@/components/dashboard/pipeline-chart';
import { QuickActions } from '@/components/dashboard/quick-actions';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth/context';

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, loading, error, refetch } = useQuery(GET_DASHBOARD_METRICS, {
    fetchPolicy: 'cache-and-network',
  });

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
        <p className="text-red-500">Failed to load dashboard data</p>
        <button
          onClick={() => refetch()}
          className="text-purple-600 hover:text-purple-700 font-medium"
        >
          Try again
        </button>
      </div>
    );
  }

  const metrics = data?.dashboardMetrics;

  return (
    <div className="space-y-6">
      {/* Welcome message */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
          Welcome back, {user?.name?.split(' ')[0] || 'User'}!
        </h1>
        <p className="text-slate-600 mt-1">
          Here&apos;s what&apos;s happening with your sales pipeline today.
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <MetricCard
          title="Total Leads"
          value={metrics?.totalLeads ?? 0}
          type="number"
          trend={{ value: 12, isPositive: true }}
          icon="users"
        />
        <MetricCard
          title="Open Opportunities"
          value={metrics?.openOpportunities ?? 0}
          type="number"
          trend={{ value: 8, isPositive: true }}
          icon="opportunity"
        />
        <MetricCard
          title="Pipeline Value"
          value={metrics?.pipelineValue ?? 0}
          type="currency"
          trend={{ value: 15, isPositive: true }}
          icon="revenue"
        />
        <MetricCard
          title="Conversion Rate"
          value={(metrics?.conversionRate ?? 0) * 100}
          type="percentage"
          trend={{ value: 3, isPositive: true }}
          icon="conversion"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent Leads - Takes 2 columns on xl screens */}
        <div className="xl:col-span-2">
          <RecentLeadsTable leads={metrics?.recentLeads ?? []} />
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <QuickActions />
          <PipelineSummaryChart data={metrics?.pipelineSummary ?? []} />
        </div>
      </div>
    </div>
  );
}
