'use client';

import { useState }    from 'react';
import { useRouter }   from 'next/navigation';
import { useForm }     from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast }       from 'sonner';
import { createPropertySchema, type CreatePropertyFormData, ZONING_TYPES, LAND_SIZE_UNITS, validateFile } from '@/lib/schemas';
import { propertyService }  from '@/lib/api/services';
import { useBlockchainStore } from '@/stores/blockchain.store';
import { ROUTES }           from '@/lib/navigation';

export default function NewPropertyPage() {
  const router   = useRouter();
  const addTx    = useBlockchainStore((s) => s.addTx);
  const [loading, setLoading]   = useState(false);
  const [titleDeed, setTitleDeed] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<CreatePropertyFormData>({
    resolver: zodResolver(createPropertySchema),
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setFileError(null);
    if (file) {
      const err = validateFile(file);
      if (err) { setFileError(err); setTitleDeed(null); return; }
    }
    setTitleDeed(file);
  }

  async function onSubmit(data: CreatePropertyFormData) {
    if (!titleDeed) { setFileError('Title deed document is required.'); return; }
    setLoading(true);
    try {
      const formData = new FormData();
      Object.entries(data).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') formData.append(k, String(v));
      });
      formData.append('titleDeedFile', titleDeed);

      const { property, txid } = await propertyService.register(formData);
      addTx(txid, 'register-property', property.id, 'Property');
      toast.success('Property registered! Blockchain confirmation in progress.');
      router.replace(ROUTES.PROPERTY(property.id));
    } catch (err: any) {
      toast.error(err?.message ?? 'Registration failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h2 className="font-display text-xl text-slate-800">Register New Property</h2>
        <p className="text-slate-500 text-sm mt-0.5">
          This will create an on-chain record via the BlockLand Clarity contract.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="card space-y-4">
          <p className="form-section">Property Details</p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Plot Number</label>
              <input className={`input ${errors.plotNumber ? 'input-error' : ''}`} {...register('plotNumber')} placeholder="HRE-12345" />
              {errors.plotNumber && <p className="error-msg">{errors.plotNumber.message}</p>}
            </div>
            <div>
              <label className="label">Title Deed Number</label>
              <input className={`input ${errors.titleDeedNumber ? 'input-error' : ''}`} {...register('titleDeedNumber')} placeholder="TD-20240001" />
              {errors.titleDeedNumber && <p className="error-msg">{errors.titleDeedNumber.message}</p>}
            </div>
          </div>

          <div>
            <label className="label">Address</label>
            <input className={`input ${errors.address ? 'input-error' : ''}`} {...register('address')} placeholder="123 Samora Machel Ave, Harare" />
            {errors.address && <p className="error-msg">{errors.address.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">GPS Latitude <span className="text-slate-400 font-normal">(optional)</span></label>
              <input type="number" step="any" className="input" {...register('gpsLat')} placeholder="-17.8292" />
            </div>
            <div>
              <label className="label">GPS Longitude <span className="text-slate-400 font-normal">(optional)</span></label>
              <input type="number" step="any" className="input" {...register('gpsLng')} placeholder="31.0522" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Land Size</label>
              <input type="number" step="any" className={`input ${errors.landSize ? 'input-error' : ''}`} {...register('landSize')} placeholder="500" />
              {errors.landSize && <p className="error-msg">{errors.landSize.message}</p>}
            </div>
            <div>
              <label className="label">Unit</label>
              <select className="input" {...register('unit')}>
                {LAND_SIZE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Zoning Type</label>
              <select className="input" {...register('zoningType')}>
                {ZONING_TYPES.map((z) => <option key={z} value={z}>{z}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Registration Date</label>
              <input type="date" className={`input ${errors.registrationDate ? 'input-error' : ''}`} {...register('registrationDate')} />
              {errors.registrationDate && <p className="error-msg">{errors.registrationDate.message}</p>}
            </div>
            <div>
              <label className="label">Owner National ID</label>
              <input className={`input ${errors.ownerNationalId ? 'input-error' : ''}`} {...register('ownerNationalId')} placeholder="63-123456Z10" />
              {errors.ownerNationalId && <p className="error-msg">{errors.ownerNationalId.message}</p>}
            </div>
          </div>

          <div>
            <label className="label">Notes <span className="text-slate-400 font-normal">(optional)</span></label>
            <textarea className="input" rows={3} {...register('notes')} placeholder="Any additional notes…" />
          </div>
        </div>

        <div className="card space-y-3">
          <p className="form-section">Title Deed Document</p>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={handleFileChange}
            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4
                       file:rounded-lg file:border-0 file:text-sm file:font-medium
                       file:bg-primary file:text-white hover:file:bg-primary-light
                       file:cursor-pointer cursor-pointer"
          />
          {fileError && <p className="error-msg">{fileError}</p>}
          {titleDeed && <p className="field-hint">Selected: {titleDeed.name} ({(titleDeed.size / 1024).toFixed(0)} KB)</p>}
          <p className="field-hint">Accepted: PDF, JPG, PNG. Max 5MB. Will be uploaded to IPFS via Pinata.</p>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()} className="btn-ghost">Cancel</button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Registering on blockchain…' : 'Register Property'}
          </button>
        </div>
      </form>
    </div>
  );
}
