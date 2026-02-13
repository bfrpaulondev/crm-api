'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/lib/auth/context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Mail, Lock, Eye, EyeOff, AlertCircle, User, Building2 } from 'lucide-react';
import { toast } from 'sonner';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  tenantName: z.string().min(2, 'Company name must be at least 2 characters'),
  tenantSlug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(30, 'Slug must be at most 30 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
});

type RegisterFormData = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const { register: registerUser, isLoading, error, clearError } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      tenantName: '',
      tenantSlug: '',
    },
  });

  const tenantName = watch('tenantName');

  const generateSlug = () => {
    if (tenantName) {
      const slug = tenantName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      return slug;
    }
    return '';
  };

  const onSubmit = async (data: RegisterFormData) => {
    try {
      clearError();
      // Auto-generate slug from tenant name if not manually set
      const slug = data.tenantSlug || generateSlug();
      await registerUser({
        ...data,
        tenantSlug: slug,
      });
      toast.success('Account created successfully!');
    } catch {
      toast.error(error || 'Registration failed. Please try again.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-200">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}
      
      <div className="space-y-2">
        <Label htmlFor="name" className="text-white">Your Name</Label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            id="name"
            type="text"
            placeholder="John Doe"
            {...register('name')}
            className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-purple-400 focus:ring-purple-400/20"
            aria-invalid={!!errors.name}
          />
        </div>
        {errors.name && (
          <p className="text-sm text-red-400" role="alert">{errors.name.message}</p>
        )}
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="email" className="text-white">Email</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            {...register('email')}
            className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-purple-400 focus:ring-purple-400/20"
            aria-invalid={!!errors.email}
          />
        </div>
        {errors.email && (
          <p className="text-sm text-red-400" role="alert">{errors.email.message}</p>
        )}
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="password" className="text-white">Password</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            {...register('password')}
            className="pl-10 pr-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-purple-400 focus:ring-purple-400/20"
            aria-invalid={!!errors.password}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.password && (
          <p className="text-sm text-red-400" role="alert">{errors.password.message}</p>
        )}
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="tenantName" className="text-white">Company Name</Label>
        <div className="relative">
          <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            id="tenantName"
            type="text"
            placeholder="Acme Inc."
            {...register('tenantName')}
            className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-purple-400 focus:ring-purple-400/20"
            aria-invalid={!!errors.tenantName}
          />
        </div>
        {errors.tenantName && (
          <p className="text-sm text-red-400" role="alert">{errors.tenantName.message}</p>
        )}
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="tenantSlug" className="text-white">
          Workspace Slug
          <span className="text-slate-500 font-normal ml-2">(auto-generated from company name)</span>
        </Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">crm.io/</span>
          <Input
            id="tenantSlug"
            type="text"
            placeholder={generateSlug() || 'acme-inc'}
            {...register('tenantSlug')}
            className="pl-16 bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-purple-400 focus:ring-purple-400/20"
            aria-invalid={!!errors.tenantSlug}
          />
        </div>
        {errors.tenantSlug && (
          <p className="text-sm text-red-400" role="alert">{errors.tenantSlug.message}</p>
        )}
      </div>
      
      <Button
        type="submit"
        disabled={isLoading}
        className="w-full bg-purple-600 hover:bg-purple-700 text-white transition-colors"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating account...
          </>
        ) : (
          'Create Account'
        )}
      </Button>
    </form>
  );
}
