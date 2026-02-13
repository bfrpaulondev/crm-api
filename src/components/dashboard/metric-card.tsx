'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Users, TrendingUp, DollarSign, BarChart3 } from 'lucide-react';
import { formatCurrency, formatCompactNumber } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: number;
  type: 'number' | 'currency' | 'percentage';
  trend?: {
    value: number;
    isPositive: boolean;
  };
  icon?: 'users' | 'opportunity' | 'revenue' | 'conversion';
}

const iconMap = {
  users: Users,
  opportunity: TrendingUp,
  revenue: DollarSign,
  conversion: BarChart3,
};

const iconStyleMap = {
  users: 'bg-blue-100 text-blue-600',
  opportunity: 'bg-emerald-100 text-emerald-600',
  revenue: 'bg-purple-100 text-purple-600',
  conversion: 'bg-amber-100 text-amber-600',
};

export function MetricCard({ title, value, type, trend, icon = 'users' }: MetricCardProps) {
  const Icon = iconMap[icon];
  const iconStyle = iconStyleMap[icon];

  const formattedValue = () => {
    switch (type) {
      case 'currency':
        return formatCurrency(value);
      case 'percentage':
        return `${Math.round(value)}%`;
      default:
        return formatCompactNumber(value);
    }
  };

  return (
    <Card className="bg-white shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <p className="text-2xl md:text-3xl font-bold text-slate-900">
              {formattedValue()}
            </p>
            {trend && (
              <div className="flex items-center gap-1">
                <span
                  className={cn(
                    'text-xs font-medium flex items-center',
                    trend.isPositive ? 'text-emerald-600' : 'text-red-600'
                  )}
                >
                  {trend.isPositive ? (
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                  {trend.value}%
                </span>
                <span className="text-xs text-slate-400">vs last month</span>
              </div>
            )}
          </div>
          <div className={cn('p-3 rounded-xl', iconStyle)}>
            <Icon className="w-5 h-5" aria-hidden="true" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
