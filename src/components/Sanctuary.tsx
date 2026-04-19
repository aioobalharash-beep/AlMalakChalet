import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Users, Ruler, CheckCircle2, Calendar as CalendarIcon, Instagram, MessageCircle, Bed, Bath, Car, Wifi, Wind, Flame, Waves, TreePalm, Shield, Star, Coffee, Utensils, Tv, Dumbbell, Baby } from 'lucide-react';
import { OptimizedImage } from './OptimizedImage';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useTranslation } from 'react-i18next';
import { bl, type BilingualField } from '../utils/bilingual';
import { getClientConfig, whatsappHref } from '../config/clientConfig';

interface PricingSettings {
  sunday_rate?: number;
  monday_rate?: number;
  tuesday_rate?: number;
  wednesday_rate?: number;
  thursday_rate?: number;
  friday_rate?: number;
  saturday_rate?: number;
  day_use_rate?: number;
  weekday_rate?: number;
  special_dates?: { date: string; price: number }[];
  discount?: { enabled: boolean; type: 'percent' | 'flat'; value: number; start_date: string; end_date: string };
}

interface PropertyDetails {
  name: string | BilingualField;
  capacity: number;
  area_sqm: number;
  nightly_rate: number;
  headline: string | BilingualField;
  description: string | BilingualField;
  features: string[];
  features_ar?: string[];
  gallery: { url: string; label: string }[];
  pricing?: PricingSettings;
  quickFacts?: { icon: string; label: string; label_ar: string }[];
  footerText?: string | BilingualField;
  whatsappNumber?: string;
  licenseNumber?: string;
}

const DEFAULTS: PropertyDetails = {
  name: 'Al Malak Chalet',
  capacity: 12,
  area_sqm: 850,
  nightly_rate: 120,
  headline: 'Curated Excellence',
  description: 'Nestled in the heart of the Omani landscape, Al Malak Chalet offers an unparalleled blend of modern luxury and heritage-inspired architecture. Every corner of this estate has been curated to provide a seamless flow between indoor relaxation and outdoor majesty.',
  features: ['Concierge Service', 'Daily Maintenance', 'Private Parking', 'Secure Perimeter'],
  gallery: [
    { url: 'https://picsum.photos/seed/oman-bedroom-1/800/1000', label: 'Master Suite: Serene Sands' },
    { url: 'https://picsum.photos/seed/oman-bedroom-2/800/1000', label: 'Guest Wing: Golden Hour' },
    { url: 'https://picsum.photos/seed/oman-kitchen/800/1000', label: 'Culinary Studio' },
  ],
};

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  Users, Ruler, Bed, Bath, Car, Wifi, Wind, Flame, Waves, TreePalm, Shield, Star, Coffee, Utensils, Tv, Dumbbell, Baby,
};

interface QuickFactCardProps {
  iconKey: string;
  label: string;
}

const QuickFactCard = React.memo<QuickFactCardProps>(({ iconKey, label }) => {
  const IconComp = ICON_MAP[iconKey] || Star;
  return (
    <div className="bg-white p-5 rounded-[20px] border border-primary-navy/5 shadow-sm">
      <IconComp className="text-secondary-gold mb-2" size={20} />
      <p className="font-headline text-sm font-bold">{label}</p>
    </div>
  );
});
QuickFactCard.displayName = 'QuickFactCard';

interface FooterProps {
  chaletName: string;
  footerText: string;
  whatsappNumber: string;
  licenseNumber: string;
  termsLabel: string;
  aboutLabel: string;
  onTerms: () => void;
  onAbout: () => void;
}

const Footer = React.memo<FooterProps>(({ chaletName, footerText, whatsappNumber, licenseNumber, termsLabel, aboutLabel, onTerms, onAbout }) => {
  const config = getClientConfig();
  const waHref = whatsappHref(config.social.whatsapp) || whatsappHref(whatsappNumber);
  const year = new Date().getFullYear();
  return (
    <footer className="w-full py-12 px-8 bg-white border-t border-primary-navy/5 flex flex-col items-center gap-6">
      <div className="text-secondary-gold font-bold font-headline text-xl">{chaletName}</div>
      {footerText ? (
        <p className="text-xs text-center text-primary-navy/60 leading-relaxed max-w-xs whitespace-pre-line">
          {footerText}
        </p>
      ) : (
        <p className="text-xs text-center text-primary-navy/60 leading-relaxed max-w-xs">
          &copy; {year} {chaletName}
        </p>
      )}
      {licenseNumber && (
        <div className="text-[10px] text-primary-navy/30 uppercase font-bold tracking-widest text-center">
          Tourism License: {licenseNumber}
        </div>
      )}
      <div className="flex gap-6 items-center">
        <button onClick={onTerms} className="text-xs text-primary-navy/60 underline font-bold">{termsLabel}</button>
        <button onClick={onAbout} className="text-xs text-primary-navy/60 underline font-bold">{aboutLabel}</button>
      </div>
      <div className="flex gap-8 mt-2">
        <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="text-primary-navy/40 hover:text-secondary-gold transition-colors">
          <Instagram size={20} />
        </a>
        {waHref && (
          <a href={waHref} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="text-primary-navy/40 hover:text-secondary-gold transition-colors">
            <MessageCircle size={20} />
          </a>
        )}
      </div>
      {footerText && (
        <p className="text-[10px] text-center text-primary-navy/40 font-bold">
          &copy; {year} {chaletName}
        </p>
      )}
    </footer>
  );
});
Footer.displayName = 'Footer';

export const Sanctuary: React.FC = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [data, setData] = useState<PropertyDetails>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'settings', 'property_details'),
      (snap) => {
        if (snap.exists()) {
          setData({ ...DEFAULTS, ...snap.data() as PropertyDetails });
        }
        setLoading(false);
      },
      (error) => {
        console.error('Property details listener error:', error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="space-y-8 pb-12 animate-pulse">
        <div className="px-6 mt-8 space-y-4">
          <div className="h-4 bg-primary-navy/5 rounded w-32" />
          <div className="h-8 bg-primary-navy/5 rounded w-64" />
          <div className="flex gap-4 overflow-hidden">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex-none w-[85vw] md:w-[600px]">
                <div className="aspect-[4/5] md:aspect-video rounded-[20px] bg-primary-navy/5" />
                <div className="mt-3 h-3.5 bg-primary-navy/5 rounded w-40 mx-1" />
              </div>
            ))}
          </div>
        </div>
        <div className="px-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white p-5 rounded-[20px] border border-primary-navy/5 space-y-3">
              <div className="h-5 w-5 bg-primary-navy/5 rounded" />
              <div className="h-3.5 bg-primary-navy/5 rounded w-20" />
            </div>
          ))}
        </div>
        <div className="px-6 space-y-3">
          <div className="h-6 bg-primary-navy/5 rounded w-48" />
          <div className="h-4 bg-primary-navy/5 rounded w-full" />
          <div className="h-4 bg-primary-navy/5 rounded w-3/4" />
        </div>
        <div className="px-6 grid grid-cols-2 gap-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-4 w-4 bg-primary-navy/5 rounded-full" />
              <div className="h-3 bg-primary-navy/5 rounded w-24" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-12">
      {/* Hero Gallery */}
      <section className="px-6 mt-8">
        <div className="flex justify-between items-end mb-6">
          <div>
            <span className="text-secondary-gold font-bold tracking-widest text-[10px] uppercase block mb-1">{t('sanctuary.estatePreview')}</span>
            <h2 className="font-headline text-3xl font-bold text-primary-navy">{bl(data.name, lang)}</h2>
          </div>
        </div>

        <div className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar gap-4 pb-4">
          {data.gallery.map((img, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex-none w-[85vw] md:w-[600px] snap-center"
            >
              <OptimizedImage
                src={img.url}
                alt={img.label || ''}
                className="aspect-[4/5] md:aspect-video rounded-[20px] bg-primary-navy/5 shadow-sm"
              />
              {img.label && img.label.trim() !== '' && (
                <p className="mt-3 font-bold text-primary-navy/80 text-sm px-1">{img.label}</p>
              )}
            </motion.div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="px-6">
        {data.quickFacts && data.quickFacts.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {data.quickFacts.map((fact, i) => {
              const displayLabel = lang === 'ar' && fact.label_ar ? fact.label_ar : fact.label;
              return (
                <QuickFactCard key={i} iconKey={fact.icon} label={displayLabel} />
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-[20px] border border-primary-navy/5 shadow-sm">
              <Users className="text-secondary-gold mb-2" size={20} />
              <p className="text-[10px] text-primary-navy/50 font-bold uppercase tracking-wider mb-1">{t('sanctuary.capacity')}</p>
              <p className="font-headline text-lg font-bold">{data.capacity} {t('common.guests')}</p>
            </div>
            <div className="bg-white p-5 rounded-[20px] border border-primary-navy/5 shadow-sm">
              <Ruler className="text-secondary-gold mb-2" size={20} />
              <p className="text-[10px] text-primary-navy/50 font-bold uppercase tracking-wider mb-1">{t('sanctuary.area')}</p>
              <p className="font-headline text-lg font-bold">{data.area_sqm} m&sup2;</p>
            </div>
          </div>
        )}
      </section>

      {/* Description */}
      <section className="px-6">
        <h3 className="font-headline text-xl font-bold mb-4">{bl(data.headline, lang)}</h3>
        <p className="text-primary-navy/60 leading-relaxed text-sm">{bl(data.description, lang)}</p>
        <div className="mt-4 text-sm text-primary-navy/60">
          <span className="font-bold text-secondary-gold">{t('sanctuary.from')} {(() => {
            const p = data.pricing;
            if (!p) return data.nightly_rate;
            const dayRates = [
              p.sunday_rate, p.monday_rate, p.tuesday_rate, p.wednesday_rate,
              p.thursday_rate, p.friday_rate, p.saturday_rate, p.day_use_rate,
              // Legacy fallback
              p.weekday_rate,
            ];
            const specialPrices = (p.special_dates || []).map(s => s.price);
            const allRates = [...dayRates, ...specialPrices].filter((r): r is number => typeof r === 'number' && r > 0);
            if (allRates.length === 0) return data.nightly_rate;
            let minRate = Math.min(...allRates);
            if (p.discount?.enabled && p.discount.value > 0) {
              if (p.discount.type === 'percent') {
                minRate = Math.round(minRate * (1 - p.discount.value / 100));
              } else {
                minRate = Math.max(0, minRate - p.discount.value);
              }
            }
            return minRate;
          })()} {t('common.omr')}</span> {t('common.perNight')}
        </div>
        {data.features.length > 0 && (
          <div className="mt-8 grid grid-cols-2 gap-y-4">
            {data.features.map((item, idx) => (
              <div key={item} className="flex items-center gap-3">
                <CheckCircle2 className="text-secondary-gold" size={16} />
                <span className="text-xs font-bold text-primary-navy/80">
                  {lang === 'ar' && data.features_ar?.[idx] ? data.features_ar[idx] : item}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Footer Info */}
      <Footer
        chaletName={bl(data.name, lang)}
        footerText={data.footerText ? bl(data.footerText, lang) : ''}
        whatsappNumber={data.whatsappNumber || ''}
        licenseNumber={data.licenseNumber || ''}
        termsLabel={t('sanctuary.termsOfStay')}
        aboutLabel={t('sanctuary.aboutUs')}
        onTerms={() => navigate('/terms')}
        onAbout={() => navigate('/about')}
      />

      {/* Floating Book Now */}
      <button
        onClick={() => navigate('/booking')}
        className="fixed bottom-[104px] end-[24px] z-[60] flex items-center gap-2 bg-secondary-gold text-primary-navy px-6 py-3.5 rounded-[20px] shadow-[0px_10px_25px_rgba(212,175,55,0.3)] hover:scale-105 transition-transform active:scale-95"
      >
        <CalendarIcon size={20} />
        <span className="font-bold text-sm tracking-wide">{t('sanctuary.bookNow')}</span>
      </button>
    </div>
  );
};
