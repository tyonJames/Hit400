'use client';

import { useState }    from 'react';
import { useRouter }   from 'next/navigation';
import { useForm }     from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast }       from 'sonner';
import { Upload, X, ImageIcon, FileText, FileCheck, FileStack, Paperclip, CheckCircle2 } from 'lucide-react';
import { createPropertySchema, type CreatePropertyFormData, ZONING_TYPES, LAND_SIZE_UNITS, validateFile } from '@/lib/schemas';
import { propertyService } from '@/lib/api/services';
import { useAuthStore }    from '@/stores/auth.store';
import { ROUTES }          from '@/lib/navigation';

type FileSlot =
  | 'images'
  | 'titleDeed'
  | 'surveyDiagram'
  | 'buildingPlan'
  | 'deedOfTransfer'
  | 'taxClearance'
  | 'landDisputeAffidavit';

interface DocSlot {
  slot:  FileSlot;
  label: string;
  hint:  string;
  icon:  React.ReactNode;
}

const DOC_SLOTS: DocSlot[] = [
  { slot: 'titleDeed',            label: 'Title Deed',                       hint: 'Certificate of Registered Title',              icon: <FileCheck className="w-4 h-4" /> },
  { slot: 'surveyDiagram',        label: 'Survey Diagram',                   hint: "Surveyor-General's Office",                    icon: <FileText  className="w-4 h-4" /> },
  { slot: 'buildingPlan',         label: 'Building Plan',                    hint: 'Approval Certificate',                         icon: <FileStack className="w-4 h-4" /> },
  { slot: 'deedOfTransfer',       label: 'Deed of Transfer',                 hint: 'From the previous registered owner',           icon: <Paperclip className="w-4 h-4" /> },
  { slot: 'taxClearance',         label: 'ZIMRA Tax Clearance',              hint: 'Tax Clearance Certificate',                    icon: <FileCheck className="w-4 h-4" /> },
  { slot: 'landDisputeAffidavit', label: 'Land Dispute Affidavit',           hint: 'Sworn affidavit — no active disputes',         icon: <FileText  className="w-4 h-4" /> },
];

export default function NewPropertyPage() {
  const router      = useRouter();
  const isRegistrar = useAuthStore((s) => s.isRegistrar());

  const [loading, setLoading] = useState(false);
  const [fileMap, setFileMap] = useState<Record<FileSlot, File[]>>({
    images: [], titleDeed: [], surveyDiagram: [], buildingPlan: [],
    deedOfTransfer: [], taxClearance: [], landDisputeAffidavit: [],
  });
  const [fileErrors, setFileErrors] = useState<Record<FileSlot, string[]>>({
    images: [], titleDeed: [], surveyDiagram: [], buildingPlan: [],
    deedOfTransfer: [], taxClearance: [], landDisputeAffidavit: [],
  });

  const { register, handleSubmit, formState: { errors } } = useForm<CreatePropertyFormData>({
    resolver: zodResolver(createPropertySchema),
  });

  function handleFileChange(slot: FileSlot, maxCount: number, e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    const errs: string[] = [];
    const valid: File[] = [];
    for (const f of selected) {
      const err = validateFile(f);
      if (err) errs.push(`${f.name}: ${err}`);
      else valid.push(f);
    }
    setFileErrors((prev) => ({ ...prev, [slot]: errs }));
    setFileMap((prev) => {
      const next = maxCount === 1
        ? valid.slice(0, 1)
        : [...prev[slot], ...valid].slice(0, maxCount);
      return { ...prev, [slot]: next };
    });
    e.target.value = '';
  }

  function removeFile(slot: FileSlot, index: number) {
    setFileMap((prev) => ({ ...prev, [slot]: prev[slot].filter((_, i) => i !== index) }));
  }

  async function onSubmit(data: CreatePropertyFormData) {
    setLoading(true);
    try {
      const formData = new FormData();
      Object.entries(data).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') formData.append(k, String(v));
      });
      fileMap.images.forEach((f)               => formData.append('images',               f));
      fileMap.titleDeed.forEach((f)            => formData.append('titleDeed',            f));
      fileMap.surveyDiagram.forEach((f)        => formData.append('surveyDiagram',        f));
      fileMap.buildingPlan.forEach((f)         => formData.append('buildingPlan',         f));
      fileMap.deedOfTransfer.forEach((f)       => formData.append('deedOfTransfer',       f));
      fileMap.taxClearance.forEach((f)         => formData.append('taxClearance',         f));
      fileMap.landDisputeAffidavit.forEach((f) => formData.append('landDisputeAffidavit', f));

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
    <div className="max-w-6xl">
      <div className="mb-6">
        <h2 className="font-display text-xl text-slate-800">Register Property</h2>
        <p className="text-slate-500 text-sm mt-0.5">
          {isRegistrar
            ? 'Submit property details for registrar review and blockchain registration.'
            : 'Fill in your property details. A registrar will review and approve your registration.'}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

          {/* ── Left column: property details ── */}
          <div className="card space-y-4 lg:sticky lg:top-6">
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

            <div className="grid grid-cols-3 gap-3">
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
                <label className="label">Zoning</label>
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
              <textarea className="input" rows={2} {...register('notes')} placeholder="Any additional notes…" />
            </div>
          </div>

          {/* ── Right column: documents & photos ── */}
          <div className="space-y-4">

            {/* Photos */}
            <div className="card space-y-3">
              <div className="flex items-center justify-between">
                <p className="form-section mb-0">Property Photos</p>
                {fileMap.images.length > 0 && (
                  <span className="text-xs font-medium text-emerald-600">
                    {fileMap.images.length} photo{fileMap.images.length > 1 ? 's' : ''} added
                  </span>
                )}
              </div>

              <label className="flex items-center gap-3 border-2 border-dashed border-slate-200 rounded-xl px-4 py-4 cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors group">
                <ImageIcon className="w-7 h-7 text-slate-300 group-hover:text-primary transition-colors shrink-0" />
                <div>
                  <p className="text-sm font-medium text-slate-600 group-hover:text-primary transition-colors">Click to add photos</p>
                  <p className="text-xs text-slate-400">JPG, PNG — up to 10 images, max 5 MB each</p>
                </div>
                <input type="file" multiple accept=".jpg,.jpeg,.png" onChange={(e) => handleFileChange('images', 10, e)} className="hidden" />
              </label>

              {fileErrors.images.map((err, i) => <p key={i} className="error-msg">{err}</p>)}

              {fileMap.images.length > 0 && (
                <div className="grid grid-cols-2 gap-1.5">
                  {fileMap.images.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg px-2.5 py-2 text-xs group">
                      <ImageIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-slate-600 truncate flex-1">{f.name}</span>
                      <span className="text-slate-400 shrink-0">{(f.size / 1024).toFixed(0)}KB</span>
                      <button type="button" onClick={() => removeFile('images', i)} className="text-slate-300 hover:text-red-400 transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Required documents */}
            <div className="card space-y-2">
              <div className="flex items-center justify-between mb-1">
                <p className="form-section mb-0">Required Documents</p>
                <span className="text-xs text-slate-400">PDF, JPG or PNG · max 5 MB</span>
              </div>

              {DOC_SLOTS.map(({ slot, label, hint, icon }, idx) => {
                const uploaded = fileMap[slot];
                const hasFile  = uploaded.length > 0;
                return (
                  <div key={slot} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${hasFile ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-100 bg-white hover:border-slate-200'}`}>
                    {/* Number badge */}
                    <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center font-semibold shrink-0 ${hasFile ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      {hasFile ? <CheckCircle2 className="w-3.5 h-3.5" /> : idx + 1}
                    </span>

                    {/* Icon + labels */}
                    <span className={`shrink-0 ${hasFile ? 'text-emerald-500' : 'text-slate-400'}`}>{icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium leading-tight ${hasFile ? 'text-emerald-800' : 'text-slate-700'}`}>{label}</p>
                      {hasFile ? (
                        <p className="text-xs text-emerald-600 truncate mt-0.5">
                          {uploaded[0].name} · {(uploaded[0].size / 1024).toFixed(0)} KB
                        </p>
                      ) : (
                        <p className="text-xs text-slate-400 mt-0.5">{hint}</p>
                      )}
                      {fileErrors[slot].map((err, i) => <p key={i} className="error-msg mt-0.5">{err}</p>)}
                    </div>

                    {/* Upload / Replace button */}
                    <label className="cursor-pointer shrink-0">
                      <span className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${hasFile ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                        {hasFile ? 'Replace' : 'Upload'}
                      </span>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => handleFileChange(slot, 1, e)}
                        className="hidden"
                      />
                    </label>

                    {/* Remove */}
                    {hasFile && (
                      <button type="button" onClick={() => removeFile(slot, 0)} className="text-slate-300 hover:text-red-400 transition-colors shrink-0">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Submit row — full width, below both columns */}
        <div className="flex gap-3 mt-6">
          <button type="button" onClick={() => router.back()} className="btn-ghost">Cancel</button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Submitting…' : 'Submit for Review'}
          </button>
        </div>
      </form>
    </div>
  );
}
