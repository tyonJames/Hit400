'use client';

import { Suspense, useState } from 'react';
import Link                    from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm }             from 'react-hook-form';
import { zodResolver }         from '@hookform/resolvers/zod';
import { toast }               from 'sonner';
import { CheckCircle, Clock }  from 'lucide-react';
import { loginSchema, type LoginFormData } from '@/lib/schemas';
import { authService }         from '@/lib/api/services';
import { useAuthStore }        from '@/stores/auth.store';
import { getPostLoginRedirect, ROUTES } from '@/lib/navigation';

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const setAuth      = useAuthStore((s) => s.setAuth);
  const [loading, setLoading] = useState(false);

  const justRegistered = searchParams.get('registered') === '1';
  const sessionExpired = searchParams.get('session')    === 'expired';

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
      const msg = (err?.message ?? '') as string;
      if (msg.toLowerCase().includes('pending') || msg.toLowerCase().includes('approval')) {
        toast.error('Your account is awaiting administrator approval. Please check back later.', { duration: 6000 });
      } else {
        toast.error(msg || 'Login failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h2 className="font-display text-2xl text-slate-900 mb-1">Sign in</h2>
      <p className="text-slate-500 text-sm mb-6">Access the BlockLand registry system</p>

      {justRegistered && (
        <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-5">
          <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-emerald-800">Registration received</p>
            <p className="text-xs text-emerald-700 mt-0.5">
              Your account is pending administrator approval. Once approved and assigned a role, you will be able to sign in.
            </p>
          </div>
        </div>
      )}

      {sessionExpired && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
          <Clock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">Session expired</p>
            <p className="text-xs text-amber-700 mt-0.5">Please sign in again to continue.</p>
          </div>
        </div>
      )}

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

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
