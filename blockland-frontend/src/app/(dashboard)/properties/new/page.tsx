'use client';

import { useState }    from 'react';
import { useRouter }   from 'next/navigation';
import { useForm }     from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast }       from 'sonner';
import { Upload, X }   from 'lucide-react';
import { createPropertySchema, type CreatePropertyFormData, ZONING_TYPES, LAND_SIZE_UNITS, validateFile } from '@/lib/schemas';
import { propertyService } from '@/lib/api/services';
import { useAuthStore }    from '@/stores/auth.store';
import { ROUTES }          from '@/lib/navigation';

export default function NewPropertyPage() {
  const router      = useRouter();
  const isRegistrar = useAuthStore((s) => s.isRegistrar());

  const [loading, setLoading] = useState(false);
  const [files, setFiles]     = useState<File[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);

  const { register, handleSubmit, formState: { errors } } = useForm<CreatePropertyFormData>({
    resolver: zodResolver(createPropertySchema),
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    const errs: string[] = [];
    const valid: File[] = [];
    for (const f of selected) {
      const err = validateFile(f);
      if (err) errs.push(`${f.name}: ${err}`);
      else valid.push(f);
    }
    setFileErrors(errs);
    setFiles((prev) => [...prev, ...valid]);
    e.target.value = '';
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function onSubmit(data: CreatePropertyFormData) {
    setLoading(true);
    try {
      const formData = new FormData();
      Object.entries(data).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') formData.append(k, String(v));
      });
      files.forEach((f) => formData.append('propertyFiles', f));

      const property = await propertyService.submit(formData);
      toast.success(
        isRegistrar
          ? 'Property submitted for review.'
          : 'Property submitted! The registrar will review and approve your registration.'
      );
      router.replace(ROUTES.PROPERTY(property.id));
    } catch (err: any) {
      toast.error(err?.message ?? 'Submission failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h2 className="font-display text-xl text-slate-800">Register Property</h2>
        <p className="text-slate-500 text-sm mt-0.5">
          {isRegistrar
            ? 'Submit property details for registrar review and blockchain registration.'
            : 'Fill in your property details. A registrar will review and approve your registration.'}
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

          <div>
            <label className="label">Registration Date</label>
            <input type="date" className={`input ${errors.registrationDate ? 'input-error' : ''}`} {...register('registrationDate')} />
            {errors.registrationDate && <p className="error-msg">{errors.registrationDate.message}</p>}
          </div>

          <div>
            <label className="label">Notes <span className="text-slate-400 font-normal">(optional)</span></label>
            <textarea className="input" rows={3} {...register('notes')} placeholder="Any additional notes…" />
          </div>
        </div>

        {/* File uploads */}
        <div className="card space-y-3">
          <p className="form-section">Property Documents &amp; Images</p>
          <p className="text-sm text-slate-500">
            Upload your title deed, survey diagrams, or property photos. Accepted: PDF, JPG, PNG. Max 5MB each.
          </p>

          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-xl p-6 cursor-pointer hover:border-primary transition-colors">
            <Upload className="w-6 h-6 text-slate-400" />
            <span className="text-sm text-slate-500">Click to add files</span>
            <input
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>

          {fileErrors.map((err, i) => (
            <p key={i} className="error-msg">{err}</p>
          ))}

          {files.length > 0 && (
            <ul className="space-y-2">
              {files.map((f, i) => (
                <li key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-sm">
                  <span className="text-slate-700 truncate max-w-xs">{f.name}</span>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-slate-400 text-xs">{(f.size / 1024).toFixed(0)} KB</span>
                    <button type="button" onClick={() => removeFile(i)} className="text-slate-400 hover:text-red-500">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()} className="btn-ghost">Cancel</button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Submitting…' : 'Submit for Review'}
          </button>
        </div>
      </form>
    </div>
  );
}
