'use client';

import { useRouter } from 'next/navigation';
import { Plus, FileText, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function QuickActions() {
  const router = useRouter();

  return (
    <div className="bg-white rounded-lg border shadow-sm">
      <div className="p-6 border-b">
        <h2 className="text-lg font-semibold">Quick Actions</h2>
      </div>
      <div className="p-6 space-y-3">
        <Button
          onClick={() => router.push('/leads?action=new')}
          className="w-full justify-start"
          variant="outline"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create New Lead
        </Button>
        <Button
          onClick={() => router.push('/pipeline')}
          className="w-full justify-start"
          variant="outline"
        >
          <FileText className="h-4 w-4 mr-2" />
          View Pipeline
        </Button>
        <Button
          onClick={() => router.push('/settings')}
          className="w-full justify-start"
          variant="outline"
        >
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </Button>
      </div>
    </div>
  );
}
