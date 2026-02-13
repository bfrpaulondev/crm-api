'use client';

import { useAuth } from '@/lib/auth/context';
import { useRedirectIfAuthenticated } from '@/lib/auth/hooks';
import { RegisterForm } from '@/components/forms/register-form';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function RegisterPage() {
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const { isLoading } = useRedirectIfAuthenticated('/dashboard');

  if (isLoading || authLoading || isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Create Account</h1>
          <p className="text-slate-400">Set up your CRM workspace</p>
        </div>
        
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20">
          <RegisterForm />
        </div>
        
        <p className="mt-6 text-center text-slate-400">
          Already have an account?{' '}
          <Link href="/login" className="text-purple-400 hover:text-purple-300 font-medium transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
