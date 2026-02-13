'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Users, GitBranch, FileText, Zap } from 'lucide-react';

export function QuickActions() {
  return (
    <Card className="bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <Zap className="w-5 h-5 text-purple-600" />
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Link href="/dashboard/leads">
          <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Add New Lead
          </Button>
        </Link>
        
        <div className="grid grid-cols-2 gap-3">
          <Link href="/dashboard/leads">
            <Button variant="outline" className="w-full" size="sm">
              <Users className="w-4 h-4 mr-1" />
              Leads
            </Button>
          </Link>
          <Link href="/dashboard/pipeline">
            <Button variant="outline" className="w-full" size="sm">
              <GitBranch className="w-4 h-4 mr-1" />
              Pipeline
            </Button>
          </Link>
        </div>
        
        <Button variant="outline" className="w-full" size="sm" disabled>
          <FileText className="w-4 h-4 mr-2" />
          Export Report
        </Button>
      </CardContent>
    </Card>
  );
}
