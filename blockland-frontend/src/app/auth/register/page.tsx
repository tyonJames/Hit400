'use client';

import { useState } from 'react';
import Link          from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm }   from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast }     from 'sonner';
import { registerSchema, type RegisterFormData } from '@/lib/schemas';
import { authService }  from '@/lib/api/services';
import { useAuthStore }  from '@/stores/auth.store';
import { getPostLoginRedirect, ROUTES } from '@/lib/navigation';

export default function RegisterPage() {
  const router   = useRouter();
  const setAuth  = useAuthStore((s) => s.setAuth);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  async function onSubmit(data: RegisterFormData) {
    setLoading(true);
    try {
      const { confirmPassword, ...payload } = data;
      const response = await authService.register(payload as any);
      setAuth(response.user, response.accessToken, response.refreshToken);
      toast.success('Account created! Welcome to BlockLand.');
      router.replace(getPostLoginRedirect(response.user.roles));
    } catch (err: any) {
      toast.error(err?.message ?? 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h2 className="font-display text-2xl text-slate-900 mb-1">Create account</h2>
      <p className="text-slate-500 text-sm mb-6">Join the BlockLand Zimbabwe registry</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label" htmlFor="fullName">Full name</label>
            <input
              id="fullName"
              className={`input ${errors.fullName ? 'input-error' : ''}`}
              placeholder="Jane Moyo"
              {...register('fullName')}
            />
            {errors.fullName && <p className="error-msg">{errors.fullName.message}</p>}
          </div>

          <div>
            <label className="label" htmlFor="nationalId">National ID</label>
            <input
              id="nationalId"
              className={`input ${errors.nationalId ? 'input-error' : ''}`}
              placeholder="63-123456A-00"
              {...register('nationalId')}
            />
            {errors.nationalId && <p className="error-msg">{errors.nationalId.message}</p>}
          </div>

          <div>
            <label className="label" htmlFor="phone">Phone</label>
            <input
              id="phone"
              type="tel"
              className={`input ${errors.phone ? 'input-error' : ''}`}
              placeholder="0771234567"
              {...register('phone')}
            />
            {errors.phone && <p className="error-msg">{errors.phone.message}</p>}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            className={`input ${errors.email ? 'input-error' : ''}`}
            placeholder="you@example.com"
            {...register('email')}
          />
          {errors.email && <p className="error-msg">{errors.email.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className={`input ${errors.password ? 'input-error' : ''}`}
              placeholder="••••••••"
              {...register('password')}
            />
            {errors.password && <p className="error-msg">{errors.password.message}</p>}
          </div>

          <div>
            <label className="label" htmlFor="confirmPassword">Confirm password</label>
            <input
              id="confirmPassword"
              type="password"
              className={`input ${errors.confirmPassword ? 'input-error' : ''}`}
              placeholder="••••••••"
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && <p className="error-msg">{errors.confirmPassword.message}</p>}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="walletAddress">
            Stacks wallet address <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <input
            id="walletAddress"
            className={`input font-mono ${errors.walletAddress ? 'input-error' : ''}`}
            placeholder="ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"
            {...register('walletAddress')}
          />
          {errors.walletAddress && <p className="error-msg">{errors.walletAddress.message}</p>}
          <p className="field-hint">You can connect your wallet later from your profile.</p>
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link href={ROUTES.LOGIN} className="text-primary hover:text-primary-dark font-medium">
          Sign in
        </Link>
      </div>
    </>
  );
}
