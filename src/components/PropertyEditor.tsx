import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { OptimizedImage } from './OptimizedImage';
import { ArrowLeft, Upload, X, Plus, Save, Check, Calendar, Tag, Percent, Landmark, Sun, Clock, FileText, Languages } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { uploadToCloudinary as uploadImageToCloudinary } from '../services/cloudinary';
import { migratePricing, formatTime, type PricingSettings, type DayUseSlot } from '../services/pricingUtils';
import { type BilingualField, toBilingual } from '../utils/bilingual';

interface GalleryImage { url: string; label: string; }

interface PropertyDetails {
  name: BilingualField;
  capacity: number;
  area_sqm: number;
  nightly_rate: number;
  headline: BilingualField;
  description: BilingualField;
  features: string[];
  features_ar: string[];
  gallery: GalleryImage[];
  pricing: PricingSettings;
  bank_name: string;
  account_name: string;
  iban: string;
  bankPhone: string;
  termsOfStay: BilingualField;
  footerText: BilingualField;
  whatsappNumber: string;
  licenseNumber: string;
  quickFacts?: { icon: string; label: string; label_ar: string }[];
}

const DEFAULT_PRICING: PricingSettings = {
  sunday_rate: 120,
  monday_rate: 120,
  tuesday_rate: 120,
  wednesday_rate: 120,
  thursday_rate: 140,
  friday_rate: 180,
  saturday_rate: 150,
  day_use_rate: 70,
  security_deposit: 50,
  special_dates: [],
  day_use_slots: [],
  discount: { enabled: false, type: 'percent', value: 10, start_date: '', end_date: '' },
};

const DEFAULT_DATA: PropertyDetails = {
  name: { en: 'Al Malak Chalet', ar: 'شاليه الملاك' },
  capacity: 12,
  area_sqm: 850,
  nightly_rate: 120,
  headline: { en: 'Curated Excellence', ar: '' },
  description: { en: 'Nestled in the heart of the Omani landscape, Al Malak Chalet offers an unparalleled blend of modern luxury and heritage-inspired architecture. Every corner of this estate has been curated to provide a seamless flow between indoor relaxation and outdoor majesty.', ar: '' },
  features: ['Concierge Service', 'Daily Maintenance', 'Private Parking', 'Secure Perimeter'],
  features_ar: ['', '', '', ''],
  gallery: [
    { url: 'https://picsum.photos/seed/oman-bedroom-1/800/1000', label: 'Master Suite: Serene Sands' },
    { url: 'https://picsum.photos/seed/oman-bedroom-2/800/1000', label: 'Guest Wing: Golden Hour' },
    { url: 'https://picsum.photos/seed/oman-kitchen/800/1000', label: 'Culinary Studio' },
  ],
  pricing: DEFAULT_PRICING,
  bank_name: 'Bank Muscat',
  account_name: 'Al Malak Chalet LLC',
  iban: 'OM12 0123 0000 0012 3456 789',
  bankPhone: '',
  termsOfStay: { en: '', ar: '' },
  footerText: { en: '', ar: '' },
  whatsappNumber: '',
  licenseNumber: '',
};

const inputClass = "w-full bg-pearl-white border border-primary-navy/10 rounded-xl py-3 px-4 text-sm font-medium focus:ring-1 focus:ring-secondary-gold/50 outline-none";

const PropertyEditorComponent: React.FC = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState<PropertyDetails>(DEFAULT_DATA);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [newFeature, setNewFeature] = useState('');
  const [newLabel, setNewLabel] = useState('');

  // Special date form
  const [specialDate, setSpecialDate] = useState('');
  const [specialPrice, setSpecialPrice] = useState('');

  // Day-use slot form
  const [newSlotName, setNewSlotName] = useState('');
  const [newSlotNameAr, setNewSlotNameAr] = useState('');
  const [newSlotStart, setNewSlotStart] = useState('11:00');
  const [newSlotEnd, setNewSlotEnd] = useState('16:00');
  const [newFeatureAr, setNewFeatureAr] = useState('');
  const [newFactIcon, setNewFactIcon] = useState('');
  const [newFactLabel, setNewFactLabel] = useState('');
  const [newFactLabelAr, setNewFactLabelAr] = useState('');

  // Helpers to update pricing sub-object
  const setPricing = (patch: Partial<PricingSettings>) =>
    setForm(prev => ({ ...prev, pricing: { ...prev.pricing, ...patch } }));

  const setDiscount = (patch: Partial<NonNullable<PricingSettings['discount']>>) =>
    setForm(prev => ({
      ...prev,
      pricing: { ...prev.pricing, discount: { ...prev.pricing.discount!, ...patch } },
    }));

  useEffect(() => {
    getDoc(doc(db, 'settings', 'property_details'))
      .then(snap => {
        if (snap.exists()) {
          const data = snap.data() as any;
          const features = data.features || DEFAULT_DATA.features;
          setForm({
            ...DEFAULT_DATA,
            ...data,
            name: toBilingual(data.name),
            headline: toBilingual(data.headline),
            description: toBilingual(data.description),
            termsOfStay: toBilingual(data.termsOfStay),
            footerText: toBilingual(data.footerText),
            features,
            features_ar: data.features_ar || features.map(() => ''),
            pricing: { ...DEFAULT_PRICING, ...migratePricing(data.pricing || {}) },
          });
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'property_details'), form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setSaving(false);
    }
  };

  const uploadPropertyImage = (file: File): Promise<string> =>
    uploadImageToCloudinary(file, {
      folder: 'al-malak-property',
      onProgress: (pct) => setUploadProgress(pct),
    }).finally(() => setUploadProgress(null));

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadPropertyImage(file);
      setForm(prev => ({ ...prev, gallery: [...prev.gallery, { url, label: newLabel.trim() }] }));
      setNewLabel('');
    } catch (err) { console.error('Upload error:', err); }
    finally { setUploading(false); }
    e.target.value = '';
  };

  const removeImage = (i: number) => setForm(prev => ({ ...prev, gallery: prev.gallery.filter((_, j) => j !== i) }));

  const addQuickFact = () => {
    const label = newFactLabel.trim();
    if (!label) return;
    setForm(prev => ({
      ...prev,
      quickFacts: [...(prev.quickFacts || []), { icon: newFactIcon || 'Star', label, label_ar: newFactLabelAr.trim() }],
    }));
    setNewFactIcon('');
    setNewFactLabel('');
    setNewFactLabelAr('');
  };
  const removeQuickFact = (i: number) => setForm(prev => ({
    ...prev,
    quickFacts: (prev.quickFacts || []).filter((_, j) => j !== i),
  }));

  const addFeature = () => {
    const t = newFeature.trim();
    const tAr = newFeatureAr.trim();
    if (t && !form.features.includes(t)) {
      setForm(prev => ({ ...prev, features: [...prev.features, t], features_ar: [...(prev.features_ar || []), tAr] }));
      setNewFeature('');
      setNewFeatureAr('');
    }
  };
  const removeFeature = (i: number) => setForm(prev => ({
    ...prev,
    features: prev.features.filter((_, j) => j !== i),
    features_ar: (prev.features_ar || []).filter((_, j) => j !== i),
  }));

  const addSpecialDate = () => {
    if (!specialDate || !specialPrice) return;
    const price = parseFloat(specialPrice);
    if (isNaN(price) || price <= 0) return;
    setPricing({ special_dates: [...form.pricing.special_dates.filter(s => s.date !== specialDate), { date: specialDate, price }] });
    setSpecialDate('');
    setSpecialPrice('');
  };

  const removeSpecialDate = (date: string) =>
    setPricing({ special_dates: form.pricing.special_dates.filter(s => s.date !== date) });

  const addSlot = () => {
    if (!newSlotName.trim() || !newSlotStart || !newSlotEnd) return;
    const newSlot: DayUseSlot = {
      id: `slot_${Date.now()}`,
      name: newSlotName.trim(),
      name_ar: newSlotNameAr.trim() || undefined,
      start_time: newSlotStart,
      end_time: newSlotEnd,
      sunday_rate: 40, monday_rate: 40, tuesday_rate: 40, wednesday_rate: 40,
      thursday_rate: 50, friday_rate: 60, saturday_rate: 55,
    };
    setPricing({ day_use_slots: [...(form.pricing.day_use_slots || []), newSlot] });
    setNewSlotName(''); setNewSlotNameAr(''); setNewSlotStart('11:00'); setNewSlotEnd('16:00');
  };

  const removeSlot = (id: string) =>
    setPricing({ day_use_slots: (form.pricing.day_use_slots || []).filter(s => s.id !== id) });

  const updateSlot = (id: string, patch: Partial<DayUseSlot>) =>
    setPricing({ day_use_slots: (form.pricing.day_use_slots || []).map(s => s.id === id ? { ...s, ...patch } : s) });

  if (loading) return <div className="p-8 animate-pulse"><div className="h-96 bg-primary-navy/5 rounded-xl" /></div>;

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <button onClick={() => navigate('/admin')} className="flex items-center gap-2 text-primary-navy/50 hover:text-primary-navy transition-colors text-xs font-bold uppercase tracking-wider mb-3">
          <ArrowLeft size={14} /> Back to Dashboard
        </button>
        <span className="text-secondary-gold font-bold tracking-widest text-[10px] uppercase">Property Management</span>
        <h1 className="font-headline text-2xl font-bold text-primary-navy mt-1">Edit Property</h1>
      </div>

      {/* Media Gallery */}
      <section className="bg-white rounded-[20px] p-6 border border-primary-navy/5 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-primary-navy uppercase tracking-wide">Media Gallery</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {form.gallery.map((img, i) => (
            <div key={i} className="relative group aspect-[4/5] rounded-xl overflow-hidden bg-primary-navy/5">
              <OptimizedImage src={img.url} alt={img.label || ''} className="w-full h-full" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                <button onClick={() => removeImage(i)} className="opacity-0 group-hover:opacity-100 transition-opacity p-2 bg-white rounded-full shadow-lg"><X size={14} className="text-red-500" /></button>
              </div>
              {img.label && img.label.trim() !== '' && (
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                  <p className="text-white text-xs font-bold truncate">{img.label}</p>
                </div>
              )}
            </div>
          ))}
          <label className="aspect-[4/5] rounded-xl border-2 border-dashed border-primary-navy/15 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-secondary-gold/50 hover:bg-secondary-gold/[0.02] transition-all">
            {uploading ? (
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-primary-navy/20 border-t-secondary-gold rounded-full animate-spin mx-auto mb-2" />
                {uploadProgress !== null && <p className="text-[10px] font-bold text-primary-navy/40">{uploadProgress}%</p>}
              </div>
            ) : (
              <>
                <Upload size={20} className="text-primary-navy/25" />
                <span className="text-[10px] font-bold text-primary-navy/30 uppercase tracking-wider">Add Image</span>
              </>
            )}
            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
          </label>
        </div>
        <div className="flex gap-2">
          <input type="text" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Label for next upload (optional)" className="flex-1 bg-pearl-white border border-primary-navy/10 rounded-xl py-2.5 px-4 text-xs placeholder:text-primary-navy/25 focus:ring-1 focus:ring-secondary-gold/50 outline-none" />
        </div>
      </section>

      {/* Property Details */}
      <section className="bg-white rounded-[20px] p-6 border border-primary-navy/5 shadow-sm space-y-5">
        <h3 className="text-sm font-bold text-primary-navy uppercase tracking-wide">Property Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-gold">Property Name</label>
            <input type="text" value={form.name.en} onChange={(e) => setForm(prev => ({ ...prev, name: { ...prev.name, en: e.target.value } }))} className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-gold">Capacity (Guests)</label>
            <input type="number" value={form.capacity} onChange={(e) => setForm(prev => ({ ...prev, capacity: parseInt(e.target.value) || 0 }))} className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-gold">Area (m²)</label>
            <input type="number" value={form.area_sqm} onChange={(e) => setForm(prev => ({ ...prev, area_sqm: parseInt(e.target.value) || 0 }))} className={inputClass} />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-gold flex items-center gap-1.5">
            <Languages size={12} /> Property Name (Arabic)
          </label>
          <input type="text" dir="rtl" value={form.name.ar} onChange={(e) => setForm(prev => ({ ...prev, name: { ...prev.name, ar: e.target.value } }))} placeholder="e.g. شاليه الملاك" className={inputClass} />
        </div>
      </section>

      {/* Dynamic Pricing — Day-of-Week Rates */}
      <section className="bg-white rounded-[20px] p-6 border border-primary-navy/5 shadow-sm space-y-5">
        <div className="flex items-center gap-2">
          <Tag size={16} className="text-secondary-gold" />
          <h3 className="text-sm font-bold text-primary-navy uppercase tracking-wide">Dynamic Pricing</h3>
        </div>

        <p className="text-[10px] text-primary-navy/40 font-medium mb-1">
          Set the nightly rate for each day of the week. Each night is charged based on the check-in day.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {([
            ['sunday_rate', 'Sun'],
            ['monday_rate', 'Mon'],
            ['tuesday_rate', 'Tue'],
            ['wednesday_rate', 'Wed'],
            ['thursday_rate', 'Thu'],
            ['friday_rate', 'Fri'],
            ['saturday_rate', 'Sat'],
          ] as [keyof PricingSettings, string][]).map(([key, label]) => (
            <div key={key} className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-gold">{label} (OMR)</label>
              <input type="number" value={form.pricing[key] as number} onChange={(e) => setPricing({ [key]: parseInt(e.target.value) || 0 })} className={inputClass} />
            </div>
          ))}
        </div>

        {/* Security Deposit */}
        <div className="pt-4 border-t border-primary-navy/5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-gold">Security Deposit — Refundable (OMR)</label>
              <input type="number" value={form.pricing.security_deposit} onChange={(e) => setPricing({ security_deposit: parseInt(e.target.value) || 0 })} className={inputClass} />
              <p className="text-[10px] text-primary-navy/40 font-medium">Collected at booking, refunded after checkout. Excluded from revenue/tax.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Day-Use Time Slots */}
      <section className="bg-white rounded-[20px] p-6 border border-primary-navy/5 shadow-sm space-y-5">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-secondary-gold" />
          <h3 className="text-sm font-bold text-primary-navy uppercase tracking-wide">Day-Use Time Slots</h3>
        </div>
        <p className="text-[10px] text-primary-navy/40 font-medium">
          Define time-limited booking slots for same-day stays. Each slot has its own per-day pricing grid.
        </p>

        {(form.pricing.day_use_slots || []).map(slot => (
          <div key={slot.id} className="bg-pearl-white rounded-xl p-4 space-y-3 border border-primary-navy/5">
            <div className="flex items-center justify-between">
              <div className="flex-1 me-3">
                <p className="text-sm font-bold text-primary-navy">{slot.name}</p>
                {slot.name_ar && <p className="text-xs text-primary-navy/50 font-medium" dir="rtl">{slot.name_ar}</p>}
                <p className="text-[10px] text-primary-navy/40 font-medium">{formatTime(slot.start_time)} – {formatTime(slot.end_time)}</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  dir="rtl"
                  value={slot.name_ar || ''}
                  onChange={(e) => updateSlot(slot.id, { name_ar: e.target.value })}
                  placeholder="اسم الفترة"
                  className="w-40 bg-white border border-primary-navy/10 rounded-lg py-1.5 px-3 text-xs focus:ring-1 focus:ring-secondary-gold/50 outline-none"
                />
                <button onClick={() => removeSlot(slot.id)} className="text-primary-navy/20 hover:text-red-500 transition-colors"><X size={16} /></button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {(['sunday_rate', 'monday_rate', 'tuesday_rate', 'wednesday_rate', 'thursday_rate', 'friday_rate', 'saturday_rate'] as (keyof DayUseSlot)[]).map((key, i) => (
                <div key={key} className="space-y-1">
                  <label className="text-[8px] font-bold uppercase text-primary-navy/30 text-center block">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i]}</label>
                  <input
                    type="number"
                    value={slot[key] as number}
                    onChange={(e) => updateSlot(slot.id, { [key]: parseInt(e.target.value) || 0 })}
                    className="w-full bg-white border border-primary-navy/10 rounded-lg py-2 px-1 text-xs font-medium text-center focus:ring-1 focus:ring-secondary-gold/50 outline-none"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="border-t border-primary-navy/5 pt-4 space-y-3">
          <p className="text-[10px] font-bold text-primary-navy/40 uppercase tracking-widest">Add New Slot</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-primary-navy/40">Slot Name</label>
              <input type="text" value={newSlotName} onChange={(e) => setNewSlotName(e.target.value)} placeholder="e.g. Morning Escape" className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-primary-navy/40 flex items-center gap-1.5">
                <Languages size={10} /> Slot Name (Arabic)
              </label>
              <input type="text" dir="rtl" value={newSlotNameAr} onChange={(e) => setNewSlotNameAr(e.target.value)} placeholder="e.g. الفترة الصباحية" className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-primary-navy/40">Start Time</label>
              <input type="time" value={newSlotStart} onChange={(e) => setNewSlotStart(e.target.value)} className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-primary-navy/40">End Time</label>
              <input type="time" value={newSlotEnd} onChange={(e) => setNewSlotEnd(e.target.value)} className={inputClass} />
            </div>
          </div>
          <button
            onClick={addSlot}
            disabled={!newSlotName.trim() || !newSlotStart || !newSlotEnd}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-navy/5 rounded-xl text-primary-navy/60 hover:bg-primary-navy/10 transition-colors disabled:opacity-30 text-xs font-bold"
          >
            <Plus size={14} /> Add Slot
          </button>
        </div>
      </section>

      {/* Special Date Overrides */}
      <section className="bg-white rounded-[20px] p-6 border border-primary-navy/5 shadow-sm space-y-5">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-secondary-gold" />
          <h3 className="text-sm font-bold text-primary-navy uppercase tracking-wide">Holiday / Special Date Overrides</h3>
        </div>

        {form.pricing.special_dates.length > 0 && (
          <div className="space-y-2">
            {form.pricing.special_dates
              .sort((a, b) => a.date.localeCompare(b.date))
              .map(s => (
              <div key={s.date} className="flex items-center justify-between bg-pearl-white rounded-xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-primary-navy">
                    {new Date(s.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-secondary-gold font-headline">{s.price} OMR</span>
                  <button onClick={() => removeSpecialDate(s.date)} className="text-primary-navy/20 hover:text-red-500 transition-colors">
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 items-end">
          <div className="flex-1 space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-primary-navy/40">Date</label>
            <input type="date" value={specialDate} onChange={(e) => setSpecialDate(e.target.value)} className={inputClass} />
          </div>
          <div className="w-32 space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-primary-navy/40">Price (OMR)</label>
            <input type="number" value={specialPrice} onChange={(e) => setSpecialPrice(e.target.value)} placeholder="250" className={inputClass} />
          </div>
          <button
            onClick={addSpecialDate}
            disabled={!specialDate || !specialPrice}
            className="px-4 py-3 bg-primary-navy/5 rounded-xl text-primary-navy/60 hover:bg-primary-navy/10 transition-colors disabled:opacity-30"
          >
            <Plus size={16} />
          </button>
        </div>
      </section>

      {/* Discount Rules */}
      <section className="bg-white rounded-[20px] p-6 border border-primary-navy/5 shadow-sm space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Percent size={16} className="text-secondary-gold" />
            <h3 className="text-sm font-bold text-primary-navy uppercase tracking-wide">Discount Rules</h3>
          </div>
          <button
            onClick={() => setDiscount({ enabled: !form.pricing.discount?.enabled })}
            className={cn(
              "relative w-12 h-6 rounded-full transition-colors",
              form.pricing.discount?.enabled ? "bg-secondary-gold" : "bg-primary-navy/15"
            )}
          >
            <div className={cn(
              "absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform",
              form.pricing.discount?.enabled ? "translate-x-6" : "translate-x-0.5"
            )} />
          </button>
        </div>

        {form.pricing.discount?.enabled && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-primary-navy/40">Type</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDiscount({ type: 'percent' })}
                    className={cn(
                      "flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all",
                      form.pricing.discount.type === 'percent' ? "bg-primary-navy text-white" : "bg-pearl-white text-primary-navy/50 border border-primary-navy/10"
                    )}
                  >
                    Percentage (%)
                  </button>
                  <button
                    onClick={() => setDiscount({ type: 'flat' })}
                    className={cn(
                      "flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all",
                      form.pricing.discount.type === 'flat' ? "bg-primary-navy text-white" : "bg-pearl-white text-primary-navy/50 border border-primary-navy/10"
                    )}
                  >
                    Flat (OMR)
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-primary-navy/40">
                  {form.pricing.discount.type === 'percent' ? 'Discount (%)' : 'Discount (OMR)'}
                </label>
                <input
                  type="number"
                  value={form.pricing.discount.value}
                  onChange={(e) => setDiscount({ value: parseFloat(e.target.value) || 0 })}
                  className={inputClass}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-primary-navy/40">Start Date</label>
                <input type="date" value={form.pricing.discount.start_date} onChange={(e) => setDiscount({ start_date: e.target.value })} className={inputClass} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-primary-navy/40">End Date</label>
                <input type="date" value={form.pricing.discount.end_date} onChange={(e) => setDiscount({ end_date: e.target.value })} className={inputClass} />
              </div>
            </div>
          </motion.div>
        )}
      </section>

      {/* Bank Transfer Details */}
      <section className="bg-white rounded-[20px] p-6 border border-primary-navy/5 shadow-sm space-y-5">
        <div className="flex items-center gap-2">
          <Landmark size={16} className="text-secondary-gold" />
          <h3 className="text-sm font-bold text-primary-navy uppercase tracking-wide">Bank Transfer Details</h3>
        </div>
        <p className="text-[10px] text-primary-navy/40 font-medium">
          These details are shown to guests who choose bank transfer as their payment method.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-gold">Bank Name</label>
            <input type="text" value={form.bank_name} onChange={(e) => setForm(prev => ({ ...prev, bank_name: e.target.value }))} placeholder="e.g. Bank Muscat" className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-gold">Account Name</label>
            <input type="text" value={form.account_name} onChange={(e) => setForm(prev => ({ ...prev, account_name: e.target.value }))} placeholder="e.g. Al Malak Chalet LLC" className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-gold">IBAN / Account Number</label>
            <input type="text" value={form.iban} onChange={(e) => setForm(prev => ({ ...prev, iban: e.target.value }))} placeholder="e.g. OM12 0123 ..." className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-gold">Phone Number (for Mobile Transfer)</label>
            <input type="text" value={form.bankPhone} onChange={(e) => setForm(prev => ({ ...prev, bankPhone: e.target.value }))} placeholder="e.g. +968 9000 0000" className={inputClass} />
            <p className="text-[10px] text-primary-navy/40 font-medium">Shown to guests for WhatsApp/bank app transfers. Leave blank to hide.</p>
          </div>
        </div>
      </section>

      {/* Terms of Stay */}
      <section className="bg-white rounded-[20px] p-6 border border-primary-navy/5 shadow-sm space-y-5">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-secondary-gold" />
          <h3 className="text-sm font-bold text-primary-navy uppercase tracking-wide">Terms of Stay</h3>
        </div>
        <p className="text-[10px] text-primary-navy/40 font-medium">
          Define rules, policies, refund terms, and conditions that guests must accept before booking. This text is displayed in a pop-up during checkout.
        </p>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-gold">Terms &amp; Conditions (English)</label>
          <textarea
            value={form.termsOfStay.en}
            onChange={(e) => setForm(prev => ({ ...prev, termsOfStay: { ...prev.termsOfStay, en: e.target.value } }))}
            rows={10}
            placeholder={"e.g.\n1. Check-in is at 4:00 PM and check-out is at 12:00 PM.\n2. A refundable security deposit of 50 OMR is required.\n3. No smoking is allowed inside the property.\n4. Pets are not permitted.\n5. Cancellation within 48 hours of check-in forfeits the deposit.\n6. Guests are responsible for any damage to the property."}
            className={cn(inputClass, "leading-relaxed resize-none font-mono text-xs")}
          />
          <p className="text-[10px] text-primary-navy/40 font-medium">
            {form.termsOfStay.en.length > 0 ? `${form.termsOfStay.en.length} characters` : 'No terms defined yet — guests will not see a terms checkbox during booking.'}
          </p>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-gold flex items-center gap-1.5">
            <Languages size={12} /> Terms &amp; Conditions (Arabic)
          </label>
          <textarea
            dir="rtl"
            value={form.termsOfStay.ar}
            onChange={(e) => setForm(prev => ({ ...prev, termsOfStay: { ...prev.termsOfStay, ar: e.target.value } }))}
            rows={10}
            placeholder="أدخل الشروط والأحكام بالعربية..."
            className={cn(inputClass, "leading-relaxed resize-none font-mono text-xs")}
          />
          <p className="text-[10px] text-primary-navy/40 font-medium">
            {form.termsOfStay.ar.length > 0 ? `${form.termsOfStay.ar.length} characters` : 'Leave blank to show English version for Arabic users.'}
          </p>
        </div>
      </section>

      {/* Footer & Contact */}
      <section className="bg-white rounded-[20px] p-6 border border-primary-navy/5 shadow-sm space-y-5">
        <h3 className="text-sm font-bold text-primary-navy uppercase tracking-wide">Footer &amp; Contact</h3>
        <p className="text-[10px] text-primary-navy/40 font-medium">
          Text shown at the bottom of the guest landing page. WhatsApp number powers the chat icon in the footer.
        </p>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-gold">Footer Description (English)</label>
          <textarea
            value={form.footerText.en}
            onChange={(e) => setForm(prev => ({ ...prev, footerText: { ...prev.footerText, en: e.target.value } }))}
            rows={3}
            placeholder="e.g. Exceptional luxury chalets curated for the modern traveler."
            className={cn(inputClass, "leading-relaxed resize-none")}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-gold flex items-center gap-1.5">
            <Languages size={12} /> Footer Description (Arabic)
          </label>
          <textarea
            dir="rtl"
            value={form.footerText.ar}
            onChange={(e) => setForm(prev => ({ ...prev, footerText: { ...prev.footerText, ar: e.target.value } }))}
            rows={3}
            placeholder="أدخل وصف التذييل بالعربية..."
            className={cn(inputClass, "leading-relaxed resize-none")}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-gold">WhatsApp Number</label>
          <input
            type="tel"
            value={form.whatsappNumber}
            onChange={(e) => setForm(prev => ({ ...prev, whatsappNumber: e.target.value }))}
            placeholder="e.g. 96891000001 (country code + number, no + or spaces)"
            className={inputClass}
          />
          <p className="text-[10px] text-primary-navy/40 font-medium">Used for the footer WhatsApp link: https://wa.me/[number]. Leave blank to hide the icon.</p>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-gold">Tourism License Number</label>
          <input
            type="text"
            value={form.licenseNumber}
            onChange={(e) => setForm(prev => ({ ...prev, licenseNumber: e.target.value }))}
            placeholder="e.g. TL-889"
            className={inputClass}
          />
          <p className="text-[10px] text-primary-navy/40 font-medium">Displayed in the public footer and on generated PDFs. Leave blank to hide.</p>
        </div>
      </section>

      {/* Description */}
      <section className="bg-white rounded-[20px] p-6 border border-primary-navy/5 shadow-sm space-y-5">
        <h3 className="text-sm font-bold text-primary-navy uppercase tracking-wide">Description</h3>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-gold">Section Headline</label>
          <input type="text" value={form.headline.en} onChange={(e) => setForm(prev => ({ ...prev, headline: { ...prev.headline, en: e.target.value } }))} placeholder="e.g. Curated Excellence" className={inputClass} />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-gold flex items-center gap-1.5">
            <Languages size={12} /> Section Headline (Arabic)
          </label>
          <input type="text" dir="rtl" value={form.headline.ar} onChange={(e) => setForm(prev => ({ ...prev, headline: { ...prev.headline, ar: e.target.value } }))} placeholder="e.g. تميز مُنسّق" className={inputClass} />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-gold">Summary Text</label>
          <textarea value={form.description.en} onChange={(e) => setForm(prev => ({ ...prev, description: { ...prev.description, en: e.target.value } }))} rows={4} className={cn(inputClass, "leading-relaxed resize-none")} />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-gold flex items-center gap-1.5">
            <Languages size={12} /> Summary Text (Arabic)
          </label>
          <textarea dir="rtl" value={form.description.ar} onChange={(e) => setForm(prev => ({ ...prev, description: { ...prev.description, ar: e.target.value } }))} rows={4} placeholder="أدخل الوصف بالعربية..." className={cn(inputClass, "leading-relaxed resize-none")} />
        </div>
      </section>

      {/* Property Quick Facts */}
      <section className="bg-white rounded-[20px] p-6 border border-primary-navy/5 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-primary-navy uppercase tracking-wide">Property Quick Facts</h3>
        <div className="space-y-2">
          {(form.quickFacts || []).map((fact, i) => (
            <div key={i} className="flex items-center gap-2 bg-pearl-white border border-primary-navy/10 rounded-xl px-4 py-2.5">
              <span className="text-xs font-bold text-secondary-gold min-w-[60px]">{fact.icon}</span>
              <span className="text-xs font-bold text-primary-navy min-w-[120px]">{fact.label}</span>
              <span className="text-xs text-primary-navy/50 flex-1" dir="rtl">{fact.label_ar || '—'}</span>
              <button onClick={() => removeQuickFact(i)} className="text-primary-navy/30 hover:text-red-500 transition-colors"><X size={14} /></button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <select
            value={newFactIcon}
            onChange={(e) => setNewFactIcon(e.target.value)}
            className="w-36 bg-pearl-white border border-primary-navy/10 rounded-xl py-2.5 px-3 text-xs font-bold focus:ring-1 focus:ring-secondary-gold/50 outline-none"
          >
            <option value="">Icon (Star)</option>
            {['Users', 'Ruler', 'Bed', 'Bath', 'Car', 'Wifi', 'Wind', 'Flame', 'Waves', 'TreePalm', 'Shield', 'Star', 'Coffee', 'Utensils', 'Tv', 'Dumbbell', 'Baby'].map(ic => (
              <option key={ic} value={ic}>{ic}</option>
            ))}
          </select>
          <input type="text" value={newFactLabel} onChange={(e) => setNewFactLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addQuickFact()} placeholder="Label (English)" className="flex-1 bg-pearl-white border border-primary-navy/10 rounded-xl py-2.5 px-4 text-xs placeholder:text-primary-navy/25 focus:ring-1 focus:ring-secondary-gold/50 outline-none" />
          <input type="text" dir="rtl" value={newFactLabelAr} onChange={(e) => setNewFactLabelAr(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addQuickFact()} placeholder="بالعربية (اختياري)" className="flex-1 bg-pearl-white border border-primary-navy/10 rounded-xl py-2.5 px-4 text-xs placeholder:text-primary-navy/25 focus:ring-1 focus:ring-secondary-gold/50 outline-none" />
          <button onClick={addQuickFact} disabled={!newFactLabel.trim()} className="px-4 py-2.5 bg-primary-navy/5 rounded-xl text-primary-navy/60 hover:bg-primary-navy/10 transition-colors disabled:opacity-30">
            <Plus size={16} />
          </button>
        </div>
      </section>

      {/* Features */}
      <section className="bg-white rounded-[20px] p-6 border border-primary-navy/5 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-primary-navy uppercase tracking-wide">Features</h3>
        <div className="space-y-2">
          {form.features.map((f, i) => (
            <div key={i} className="flex items-center gap-2 bg-pearl-white border border-primary-navy/10 rounded-xl px-4 py-2.5">
              <span className="text-xs font-bold text-primary-navy min-w-[120px]">{f}</span>
              <input
                type="text"
                dir="rtl"
                value={(form.features_ar || [])[i] || ''}
                onChange={(e) => setForm(prev => {
                  const updated = [...(prev.features_ar || prev.features.map(() => ''))];
                  updated[i] = e.target.value;
                  return { ...prev, features_ar: updated };
                })}
                placeholder="الترجمة العربية"
                className="flex-1 bg-white border border-primary-navy/10 rounded-lg py-1.5 px-3 text-xs focus:ring-1 focus:ring-secondary-gold/50 outline-none"
              />
              <button onClick={() => removeFeature(i)} className="text-primary-navy/30 hover:text-red-500 transition-colors"><X size={14} /></button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input type="text" value={newFeature} onChange={(e) => setNewFeature(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addFeature()} placeholder="Feature (English)" className="flex-1 bg-pearl-white border border-primary-navy/10 rounded-xl py-2.5 px-4 text-xs placeholder:text-primary-navy/25 focus:ring-1 focus:ring-secondary-gold/50 outline-none" />
          <input type="text" dir="rtl" value={newFeatureAr} onChange={(e) => setNewFeatureAr(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addFeature()} placeholder="بالعربية (اختياري)" className="flex-1 bg-pearl-white border border-primary-navy/10 rounded-xl py-2.5 px-4 text-xs placeholder:text-primary-navy/25 focus:ring-1 focus:ring-secondary-gold/50 outline-none" />
          <button onClick={addFeature} disabled={!newFeature.trim()} className="px-4 py-2.5 bg-primary-navy/5 rounded-xl text-primary-navy/60 hover:bg-primary-navy/10 transition-colors disabled:opacity-30">
            <Plus size={16} />
          </button>
        </div>
      </section>

      {/* Save */}
      <div className="flex justify-end gap-3 pt-2">
        <AnimatePresence>
          {saved && (
            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="flex items-center gap-2 text-emerald-600 text-sm font-bold">
              <Check size={16} /> Changes saved
            </motion.div>
          )}
        </AnimatePresence>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 bg-primary-navy text-white px-8 py-3.5 rounded-xl font-bold text-xs uppercase tracking-widest active:scale-[0.98] transition-all disabled:opacity-60 shadow-lg shadow-primary-navy/20">
          {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={16} />}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
};

export const PropertyEditor = React.memo(PropertyEditorComponent);
