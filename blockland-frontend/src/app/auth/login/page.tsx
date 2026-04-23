'use client';

import { useState } from 'react';
import Link          from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm }   from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast }     from 'sonner';
import { loginSchema, type LoginFormData } from '@/lib/schemas';
import { authService } from '@/lib/api/services';
import { useAuthStore } from '@/stores/auth.store';
import { getPostLoginRedirect, ROUTES } from '@/lib/navigation';

export default function LoginPage() {
  const router   = useRouter();
  const setAuth  = useAuthStore((s) => s.setAuth);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginFormData) {
    setLoading(true);
    try {
      const response = await authService.login(data.email, data.password);
      setAuth(response.user, response.accessToken, response.refreshToken);
      toast.success(`Welcome back, ${response.user.fullName.split(' ')[0]}!`);
      router.replace(getPostLoginRedirect(response.user.roles));
    } catch (err: any) {
      toast.error(err?.message ?? 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h2 className="font-display text-2xl text-slate-900 mb-1">Sign in</h2>
      <p className="text-slate-500 text-sm mb-6">Access the BlockLand registry system</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className={`input ${errors.email ? 'input-error' : ''}`}
            placeholder="you@example.com"
            {...register('email')}
          />
          {errors.email && <p className="error-msg">{errors.email.message}</p>}
        </div>

        <div>
          <label className="label" htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className={`input ${errors.password ? 'input-error' : ''}`}
            placeholder="••••••••"
            {...register('password')}
          />
          {errors.password && <p className="error-msg">{errors.password.message}</p>}
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-slate-500">
        Don&apos;t have an account?{' '}
        <Link href={ROUTES.REGISTER} className="text-primary hover:text-primary-dark font-medium">
          Register
        </Link>
      </div>

      <div className="mt-2 text-center">
        <Link href={ROUTES.VERIFY} className="text-xs text-slate-400 hover:text-slate-600">
          Verify a property without logging in →
        </Link>
      </div>
    </>
  );
}
