'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatRelativeTime, getInitials, formatCurrency } from '@/lib/utils/formatters';
import { Lead, LeadStatus } from '@/types';
import { ArrowRight, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RecentLeadsTableProps {
  leads: Lead[];
}

const statusStyles: Record<LeadStatus, { bg: string; text: string }> = {
  NEW: { bg: 'bg-blue-100', text: 'text-blue-700' },
  CONTACTED: { bg: 'bg-amber-100', text: 'text-amber-700' },
  QUALIFIED: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  UNQUALIFIED: { bg: 'bg-slate-100', text: 'text-slate-700' },
  CONVERTED: { bg: 'bg-purple-100', text: 'text-purple-700' },
};

export function RecentLeadsTable({ leads }: RecentLeadsTableProps) {
  return (
    <Card className="bg-white shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <Users className="w-5 h-5 text-purple-600" />
          Recent Leads
        </CardTitle>
        <Link href="/dashboard/leads">
          <Button variant="ghost" size="sm" className="text-purple-600 hover:text-purple-700 hover:bg-purple-50">
            View all
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="px-0 sm:px-6">
        {leads.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-slate-500">No leads yet</p>
            <Link href="/dashboard/leads">
              <Button variant="outline" size="sm" className="mt-4">
                Add your first lead
              </Button>
            </Link>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="hidden sm:table-cell">Lead</TableHead>
                <TableHead className="hidden md:table-cell">Company</TableHead>
                <TableHead className="hidden lg:table-cell">Value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.slice(0, 5).map((lead) => (
                <TableRow key={lead.id} className="group hover:bg-slate-50/50 cursor-pointer">
                  <TableCell className="hidden sm:table-cell">
                    <Link href={`/dashboard/leads/${lead.id}`} className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 bg-purple-100">
                        <AvatarFallback className="bg-purple-100 text-purple-700 text-xs font-medium">
                          {getInitials(lead.firstName, lead.lastName)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-slate-900 group-hover:text-purple-600 transition-colors">
                          {lead.firstName} {lead.lastName}
                        </p>
                        <p className="text-xs text-slate-500">{lead.email}</p>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-slate-600">
                    {lead.company || '-'}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-slate-600">
                    {formatCurrency(lead.estimatedValue)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={cn(
                        'font-medium',
                        statusStyles[lead.status]?.bg,
                        statusStyles[lead.status]?.text
                      )}
                    >
                      {lead.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-slate-500 text-sm">
                    {formatRelativeTime(lead.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
