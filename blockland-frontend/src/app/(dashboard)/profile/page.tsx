'use client';

import { useState }    from 'react';
import { useForm }     from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast }       from 'sonner';
import { Wallet, Key, User } from 'lucide-react';
import {
  updateProfileSchema, changePasswordSchema, linkWalletSchema,
  type UpdateProfileFormData, type ChangePasswordFormData, type LinkWalletFormData,
} from '@/lib/schemas';
import { userService }   from '@/lib/api/services';
import { useAuthStore }  from '@/stores/auth.store';
import { connectWallet } from '@/lib/stacks';

export default function ProfilePage() {
  const user    = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [connectingWallet, setConnectingWallet] = useState(false);

  const profileForm = useForm<UpdateProfileFormData>({ resolver: zodResolver(updateProfileSchema), defaultValues: { fullName: user?.fullName } });
  const passwordForm = useForm<ChangePasswordFormData>({ resolver: zodResolver(changePasswordSchema) });
  const walletForm  = useForm<LinkWalletFormData>({ resolver: zodResolver(linkWalletSchema) });

  const [profileLoading, setProfileLoading]   = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [walletLoading, setWalletLoading]     = useState(false);

  async function onUpdateProfile(data: UpdateProfileFormData) {
    setProfileLoading(true);
    try {
      const updated = await userService.updateProfile(data);
      setUser({ fullName: updated.fullName });
      toast.success('Profile updated.');
    } catch (err: any) { toast.error(err?.message); } finally { setProfileLoading(false); }
  }

  async function onChangePassword(data: ChangePasswordFormData) {
    setPasswordLoading(true);
    try {
      await userService.changePassword(data.currentPassword, data.newPassword);
      passwordForm.reset();
      toast.success('Password changed successfully.');
    } catch (err: any) { toast.error(err?.message); } finally { setPasswordLoading(false); }
  }

  async function onLinkWallet(data: LinkWalletFormData) {
    setWalletLoading(true);
    try {
      await userService.linkWallet(data.walletAddress);
      setUser({ walletAddress: data.walletAddress });
      toast.success('Wallet linked!');
    } catch (err: any) { toast.error(err?.message); } finally { setWalletLoading(false); }
  }

  function handleConnectWallet() {
    setConnectingWallet(true);
    connectWallet({
      onSuccess: async (address) => {
        try {
          await userService.linkWallet(address);
          setUser({ walletAddress: address });
          toast.success('Wallet connected and linked!');
        } catch (err: any) { toast.error(err?.message); }
        setConnectingWallet(false);
      },
      onCancel: () => setConnectingWallet(false),
    });
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Profile info */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <User className="w-4 h-4 text-slate-400" />
          <h3 className="font-semibold text-slate-800">Profile</h3>
        </div>
        <div className="text-sm text-slate-500 space-y-1">
          <p><span className="font-medium text-slate-700">Email:</span> {user?.email}</p>
          <p><span className="font-medium text-slate-700">Roles:</span> {user?.roles.join(', ')}</p>
        </div>
        <form onSubmit={profileForm.handleSubmit(onUpdateProfile)} className="space-y-3 pt-2 border-t border-slate-100">
          <div>
            <label className="label">Full Name</label>
            <input className="input" {...profileForm.register('fullName')} />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" {...profileForm.register('phone')} placeholder="0771234567" />
          </div>
          <button type="submit" disabled={profileLoading} className="btn-primary">
            {profileLoading ? 'Saving…' : 'Save Changes'}
          </button>
        </form>
      </div>

      {/* Wallet */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Wallet className="w-4 h-4 text-slate-400" />
          <h3 className="font-semibold text-slate-800">Stacks Wallet</h3>
        </div>
        {user?.walletAddress ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200">
            <span className="on-chain-dot" />
            <span className="font-mono text-sm text-emerald-700 break-all">{user.walletAddress}</span>
          </div>
        ) : (
          <>
            <button onClick={handleConnectWallet} disabled={connectingWallet} className="btn-secondary">
              <Wallet className="w-4 h-4" />
              {connectingWallet ? 'Opening Hiro Wallet…' : 'Connect Hiro Wallet'}
            </button>
            <div className="text-slate-400 text-xs">or enter address manually:</div>
            <form onSubmit={walletForm.handleSubmit(onLinkWallet)} className="flex gap-2">
              <input
                className={`input flex-1 font-mono text-xs ${walletForm.formState.errors.walletAddress ? 'input-error' : ''}`}
                {...walletForm.register('walletAddress')}
                placeholder="ST1PQHQKV0..."
              />
              <button type="submit" disabled={walletLoading} className="btn-primary flex-shrink-0">
                {walletLoading ? '…' : 'Link'}
              </button>
            </form>
            {walletForm.formState.errors.walletAddress && (
              <p className="error-msg">{walletForm.formState.errors.walletAddress.message}</p>
            )}
          </>
        )}
      </div>

      {/* Change password */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Key className="w-4 h-4 text-slate-400" />
          <h3 className="font-semibold text-slate-800">Change Password</h3>
        </div>
        <form onSubmit={passwordForm.handleSubmit(onChangePassword)} className="space-y-3">
          {(['currentPassword', 'newPassword', 'confirmPassword'] as const).map((field) => (
            <div key={field}>
              <label className="label capitalize">{field.replace(/([A-Z])/g, ' $1')}</label>
              <input type="password" className={`input ${passwordForm.formState.errors[field] ? 'input-error' : ''}`} {...passwordForm.register(field)} />
              {passwordForm.formState.errors[field] && (
                <p className="error-msg">{passwordForm.formState.errors[field]?.message}</p>
              )}
            </div>
          ))}
          <button type="submit" disabled={passwordLoading} className="btn-primary">
            {passwordLoading ? 'Changing…' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
