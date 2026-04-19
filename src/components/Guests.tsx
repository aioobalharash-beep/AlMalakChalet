import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Calendar as CalendarIcon, Phone, UserPlus, X, Clock, AlertCircle, Pin, Check, Ban, Paperclip, Upload, Gift } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useSearchParams } from 'react-router-dom';
import { propertiesApi } from '../services/api';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, limit } from 'firebase/firestore';
import { db } from '../services/firebase';
import { firestoreBookings } from '../services/firestore';
import { uploadToCloudinary } from '../services/cloudinary';
import type { Property } from '../types';
import { useTranslation } from 'react-i18next';

type DisplayStatus = 'pending' | 'upcoming' | 'checked-in' | 'completed';

interface BookingGuest {
  id: string;
  guest_name: string;
  guest_phone: string;
  guest_email?: string;
  property_name: string;
  property_id: string;
  check_in: string;
  check_out: string;
  nights: number;
  total_amount: number;
  security_deposit: number;
  deposit_refunded: boolean;
  status: string;
  payment_status: string;
  payment_method: string;
  receiptURL: string;
  created_at: string;
  isPinned: boolean;
  displayStatus: DisplayStatus;
}

function computeDisplayStatus(booking: { status: string; check_in: string; check_out: string }): DisplayStatus {
  if (booking.status === 'pending') return 'pending';
  if (booking.status === 'cancelled') return 'completed';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkIn = new Date(booking.check_in);
  checkIn.setHours(0, 0, 0, 0);
  const checkOut = new Date(booking.check_out);
  checkOut.setHours(0, 0, 0, 0);

  if (today < checkIn) return 'upcoming';
  if (today >= checkIn && today <= checkOut) return 'checked-in';
  return 'completed';
}

const STATUS_CONFIG: Record<DisplayStatus, { labelKey: string; badgeClass: string }> = {
  'pending': { labelKey: 'guests.pendingApproval', badgeClass: 'bg-amber-50 text-amber-700' },
  'upcoming': { labelKey: 'guests.upcoming', badgeClass: 'bg-blue-50 text-blue-700' },
  'checked-in': { labelKey: 'guests.checkedIn', badgeClass: 'bg-emerald-50 text-emerald-700' },
  'completed': { labelKey: 'guests.completed', badgeClass: 'bg-gray-100 text-gray-500' },
};

export const Guests: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightName = searchParams.get('highlight');
  const highlightId = searchParams.get('id');

  const [rawBookings, setRawBookings] = useState<BookingGuest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | DisplayStatus>('all');

  // Cancel confirmation
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // Receipt viewer
  const [receiptViewURL, setReceiptViewURL] = useState<string | null>(null);

  // Pagination
  const PAGE_SIZE = 20;
  const [pageLimit, setPageLimit] = useState(PAGE_SIZE);
  const [hasMore, setHasMore] = useState(true);

  // Add guest modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [addForm, setAddForm] = useState({ name: '', phone: '', email: '', check_in: '', check_out: '', property_id: '', property_name: '' });
  const [addErrors, setAddErrors] = useState<Record<string, string>>({});
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'paid' | 'free'>('paid');
  const [amountPaid, setAmountPaid] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptFileName, setReceiptFileName] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Real-time bookings from Firestore with pagination
  useEffect(() => {
    const q = query(collection(db, 'bookings'), orderBy('created_at', 'desc'), limit(pageLimit));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setHasMore(snapshot.docs.length >= pageLimit);
      const guests = snapshot.docs
        .map(d => {
          const data = d.data();
          return {
            id: d.id,
            guest_name: data.guest_name || '',
            guest_phone: data.guest_phone || '',
            guest_email: data.guest_email || '',
            property_name: data.property_name || '',
            property_id: data.property_id || '',
            check_in: data.check_in || '',
            check_out: data.check_out || '',
            nights: data.nights || 0,
            total_amount: data.total_amount || 0,
            security_deposit: data.security_deposit || 0,
            deposit_refunded: data.deposit_refunded === true,
            status: data.status || 'pending',
            payment_status: data.payment_status || 'pending',
            payment_method: data.payment_method || '',
            receiptURL: data.receiptURL || '',
            created_at: data.created_at || '',
            isPinned: data.isPinned === true,
            displayStatus: computeDisplayStatus({
              status: data.status,
              check_in: data.check_in,
              check_out: data.check_out,
            }),
          } as BookingGuest;
        })
        .filter(b => b.status !== 'cancelled');
      setRawBookings(guests);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [pageLimit]);

  useEffect(() => {
    propertiesApi.list().then(setProperties).catch(console.error);
  }, []);

  // Filtered, searched, and sorted guest list
  const guests = useMemo(() => {
    let list = rawBookings;
    if (activeFilter !== 'all') {
      list = list.filter(g => g.displayStatus === activeFilter);
    }
    if (searchQuery) {
      const s = searchQuery.toLowerCase();
      list = list.filter(g =>
        g.guest_name.toLowerCase().includes(s) || g.guest_phone.includes(s)
      );
    }
    // Sort: pinned first, then by check-in ascending
    return [...list].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return a.check_in.localeCompare(b.check_in);
    });
  }, [rawBookings, activeFilter, searchQuery]);

  const stats = useMemo(() => ({
    pending: rawBookings.filter(g => g.displayStatus === 'pending').length,
    upcoming: rawBookings.filter(g => g.displayStatus === 'upcoming').length,
    checkedIn: rawBookings.filter(g => g.displayStatus === 'checked-in').length,
    completed: rawBookings.filter(g => g.displayStatus === 'completed').length,
  }), [rawBookings]);

  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  // Deep-link scroll: wait for data to load, find the card by DOM id, scroll + highlight
  useEffect(() => {
    if (loading || !highlightId) return;

    // Ensure the card is in the filtered list — switch to 'all' if needed
    const inCurrentList = guests.some(g => g.id === highlightId);
    if (!inCurrentList && activeFilter !== 'all') {
      setActiveFilter('all');
      return; // will re-trigger after filter change
    }

    setHighlightedId(highlightId);

    // Use rAF + small timeout to ensure DOM has painted the cards
    const raf = requestAnimationFrame(() => {
      const timer = setTimeout(() => {
        const el = document.getElementById(`guest-card-${highlightId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        // Clear params after 3s, remove highlight after 4s
        const clearTimer = setTimeout(() => {
          setSearchParams({}, { replace: true });
        }, 3000);
        const fadeTimer = setTimeout(() => {
          setHighlightedId(null);
        }, 4000);
        return () => { clearTimeout(clearTimer); clearTimeout(fadeTimer); };
      }, 150);
      return () => clearTimeout(timer);
    });
    return () => cancelAnimationFrame(raf);
  }, [loading, highlightId, guests, activeFilter]);

  const handleApprove = async (bookingId: string) => {
    try {
      await firestoreBookings.approvePayment(bookingId);
    } catch (err) {
      console.error('Failed to approve:', err);
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await updateDoc(doc(db, 'bookings', cancelTarget), { status: 'cancelled' });
    } catch (err) {
      console.error('Failed to cancel:', err);
    } finally {
      setCancelling(false);
      setCancelTarget(null);
    }
  };

  const handleTogglePin = async (bookingId: string, currentlyPinned: boolean) => {
    try {
      await updateDoc(doc(db, 'bookings', bookingId), { isPinned: !currentlyPinned });
    } catch (err) {
      console.error('Failed to toggle pin:', err);
    }
  };

  const uploadReceipt = (file: File): Promise<string> =>
    uploadToCloudinary(file, {
      folder: 'al-malak-receipts',
      onProgress: (pct) => setUploadProgress(pct),
    }).finally(() => setUploadProgress(null));

  const resetAddForm = () => {
    setAddForm({ name: '', phone: '', email: '', check_in: '', check_out: '', property_id: '', property_name: '' });
    setPaymentMode('paid');
    setAmountPaid('');
    setReceiptFile(null);
    setReceiptFileName('');
    setAddErrors({});
  };

  const handleAddGuest = async () => {
    const errs: Record<string, string> = {};
    if (!addForm.name.trim()) errs.name = 'Name is required';
    if (!addForm.phone.trim()) errs.phone = 'Phone is required';
    if (!addForm.check_in) errs.check_in = 'Check-in date is required';
    if (!addForm.check_out) errs.check_out = 'Check-out date is required';
    if (paymentMode === 'paid') {
      const amt = parseFloat(amountPaid);
      if (!amountPaid || isNaN(amt) || amt <= 0) errs.amount = 'Amount paid is required';
    }
    setAddErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setAddSubmitting(true);
    try {
      // Upload receipt first (optional, only for paid bookings with a file)
      let receiptURL = '';
      if (paymentMode === 'paid' && receiptFile) {
        try {
          receiptURL = await uploadReceipt(receiptFile);
        } catch (uploadErr) {
          console.error('Receipt upload failed:', uploadErr);
          setAddErrors({ receipt: 'Receipt upload failed. Please try again.' });
          setAddSubmitting(false);
          return;
        }
      }

      const prop = properties[0];
      const parsedAmount = paymentMode === 'paid' ? parseFloat(amountPaid) : 0;
      await firestoreBookings.create({
        property_id: prop?.id || 'default',
        property_name: prop?.name || 'Al Malak Chalet',
        guest_name: addForm.name.trim(),
        guest_phone: `+968${addForm.phone.replace(/\s/g, '')}`,
        guest_email: addForm.email || undefined,
        check_in: addForm.check_in,
        check_out: addForm.check_out,
        nightly_rate: prop?.nightly_rate || 120,
        security_deposit: 0,
        payment_method: 'walk_in',
        payment_mode: paymentMode,
        amount_paid: parsedAmount,
        receiptURL,
      });
      setShowAddModal(false);
      resetAddForm();
    } catch (err) {
      console.error('Failed to add guest:', err);
    } finally {
      setAddSubmitting(false);
    }
  };

  const filters: { id: 'all' | DisplayStatus; labelKey: string }[] = [
    { id: 'all', labelKey: 'guests.allGuests' },
    { id: 'pending', labelKey: 'common.pending' },
    { id: 'upcoming', labelKey: 'guests.upcoming' },
    { id: 'checked-in', labelKey: 'guests.checkedIn' },
    { id: 'completed', labelKey: 'guests.completed' },
  ];

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-4xl mx-auto">
      <section>
        <h2 className="font-headline text-2xl font-bold text-primary-navy mb-1">{t('guests.guestManagement')}</h2>
        <p className="text-primary-navy/50 text-sm font-medium">{t('guests.curatingHospitality')}</p>
      </section>

      {/* Stat Widgets */}
      <section className="grid grid-cols-2 gap-4">
        <div className="bg-primary-navy p-5 rounded-xl shadow-lg">
          <p className="text-[10px] uppercase tracking-widest text-white/50 font-bold mb-2">{t('guests.pendingApproval')}</p>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-headline font-bold text-white">{String(stats.pending).padStart(2, '0')}</span>
            {stats.pending > 0 && <span className="bg-secondary-gold/20 text-secondary-gold px-2 py-0.5 rounded text-[9px] font-bold uppercase mb-1">New</span>}
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-primary-navy/5 shadow-sm">
          <p className="text-[10px] uppercase tracking-widest text-primary-navy/50 font-bold mb-2">{t('guests.upcomingArrivals')}</p>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-headline font-bold text-primary-navy">{String(stats.upcoming).padStart(2, '0')}</span>
            {stats.checkedIn > 0 && <span className="text-xs text-emerald-600 font-bold mb-1">{stats.checkedIn} checked in</span>}
          </div>
        </div>
      </section>

      {/* Search + Filters */}
      <section className="space-y-4">
        <div className="relative group">
          <Search className="absolute start-4 top-1/2 -translate-y-1/2 text-primary-navy/40" size={18} />
          <input
            type="text"
            placeholder={t('guests.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border-none rounded-xl py-4 ps-12 pe-4 shadow-sm focus:ring-1 focus:ring-secondary-gold/50 placeholder:text-primary-navy/30 text-sm transition-all"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {filters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              className={cn(
                "whitespace-nowrap px-6 py-2.5 rounded-full text-xs font-bold transition-all active:scale-95",
                activeFilter === filter.id ? "bg-primary-navy text-white" : "bg-white text-primary-navy/60 hover:bg-primary-navy/5 shadow-sm"
              )}
            >
              {t(filter.labelKey)}
            </button>
          ))}
        </div>
      </section>

      {/* Guest List */}
      <section className="space-y-4">
        {loading ? (
          <div className="space-y-4 animate-pulse">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white p-5 rounded-xl border border-primary-navy/5 space-y-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <div className="h-4 bg-primary-navy/5 rounded w-36" />
                    <div className="h-3 bg-primary-navy/5 rounded w-24" />
                  </div>
                  <div className="h-6 bg-primary-navy/5 rounded-full w-20" />
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-3 bg-primary-navy/5 rounded w-32" />
                  <div className="h-3 bg-primary-navy/5 rounded w-20" />
                  <div className="h-3 bg-primary-navy/5 rounded w-16" />
                </div>
                <div className="flex gap-3 pt-4 border-t border-primary-navy/5">
                  <div className="h-9 bg-primary-navy/5 rounded-lg flex-1" />
                  <div className="h-9 bg-primary-navy/5 rounded-lg flex-1" />
                </div>
              </div>
            ))}
          </div>
        ) : guests.length === 0 ? (
          <p className="text-center text-sm text-primary-navy/40 py-12">{t('guests.noGuestsFound')}</p>
        ) : (
          guests.map((guest, i) => {
            const isHighlighted = highlightedId === guest.id || (highlightName && guest.guest_name.toLowerCase() === highlightName.toLowerCase());
            const cfg = STATUS_CONFIG[guest.displayStatus];
            const isActive = guest.displayStatus !== 'completed';

            return (
              <motion.div
                key={guest.id}
                id={`guest-card-${guest.id}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className={cn(
                  "bg-white p-5 rounded-xl shadow-sm border space-y-4 transition-all duration-500",
                  isHighlighted ? "border-secondary-gold ring-2 ring-secondary-gold/40 shadow-lg shadow-secondary-gold/10 bg-secondary-gold/[0.02]" :
                  guest.isPinned ? "border-secondary-gold/40 bg-secondary-gold/[0.03]" :
                  "border-primary-navy/5"
                )}
              >
                {/* Header */}
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-headline font-bold text-primary-navy">{guest.guest_name}</h3>
                    <p className="text-xs text-primary-navy/50 font-medium">{guest.guest_phone}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={cn("px-3 py-1 rounded-full text-[10px] uppercase tracking-tighter font-bold", cfg.badgeClass)}>
                      {t(cfg.labelKey)}
                    </div>
                    {/* Pin Toggle */}
                    <button
                      onClick={() => handleTogglePin(guest.id, guest.isPinned)}
                      className={cn(
                        "p-1.5 rounded-lg transition-all active:scale-90",
                        guest.isPinned
                          ? "bg-secondary-gold/10 text-secondary-gold"
                          : "text-primary-navy/20 hover:text-primary-navy/40 hover:bg-primary-navy/5"
                      )}
                      title={guest.isPinned ? t('guests.unpinVip') : t('guests.pinVip')}
                    >
                      <Pin size={14} className={guest.isPinned ? "fill-current" : ""} />
                    </button>
                  </div>
                </div>

                {/* Dates + Property */}
                <div className="flex items-center gap-4 text-xs font-bold flex-wrap">
                  <div className="flex items-center gap-1.5 text-primary-navy">
                    <CalendarIcon size={14} className="text-secondary-gold" />
                    {new Date(guest.check_in).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })} - {new Date(guest.check_out).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}
                  </div>
                  <span className="text-primary-navy/30">&bull;</span>
                  <span className="text-primary-navy/60">{guest.property_name}</span>
                  <span className="text-primary-navy/30">&bull;</span>
                  <span className="text-primary-navy/60">{guest.nights} {guest.nights > 1 ? t('common.nights') : t('common.night')}</span>
                </div>

                {/* Deposit Badge */}
                {guest.security_deposit > 0 && (
                  <div className="flex items-center justify-between bg-surface-container-low rounded-lg px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-primary-navy/50">{t('guests.deposit')}</span>
                      <span className="text-xs font-bold text-primary-navy font-headline">{guest.security_deposit} {t('common.omr')}</span>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          await updateDoc(doc(db, 'bookings', guest.id), { deposit_refunded: !guest.deposit_refunded });
                        } catch (err) { console.error('Failed to toggle deposit:', err); }
                      }}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all active:scale-95",
                        guest.deposit_refunded
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-amber-50 text-amber-700 border border-amber-200"
                      )}
                    >
                      {guest.deposit_refunded ? (
                        <><Check size={10} /> {t('guests.refunded')}</>
                      ) : (
                        t('guests.markRefunded')
                      )}
                    </button>
                  </div>
                )}

                {/* Action row */}
                <div className="flex gap-3 pt-4 border-t border-primary-navy/5 flex-wrap">
                  {guest.displayStatus === 'pending' && (
                    <>
                      <button
                        onClick={() => handleApprove(guest.id)}
                        className="flex-1 min-w-[140px] py-2.5 rounded-lg text-[10px] uppercase font-bold tracking-widest active:scale-[0.98] transition-all bg-primary-navy text-white flex items-center justify-center gap-1.5"
                      >
                        <Check size={13} />
                        {t('guests.approveBooking')}
                      </button>
                      {guest.payment_method === 'bank_transfer' && guest.receiptURL && (
                        <button
                          onClick={() => setReceiptViewURL(guest.receiptURL)}
                          className="px-4 py-2.5 rounded-lg border border-secondary-gold/40 bg-secondary-gold/5 text-secondary-gold hover:bg-secondary-gold/10 text-[10px] uppercase font-bold tracking-widest active:scale-[0.98] transition-all flex items-center gap-1.5"
                        >
                          <Paperclip size={13} />
                          {t('guests.viewReceipt')}
                        </button>
                      )}
                    </>
                  )}
                  {guest.displayStatus === 'upcoming' && (
                    <div className="flex items-center gap-2 flex-1 min-w-[140px]">
                      <Clock size={14} className="text-blue-500 flex-shrink-0" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600">
                        {t('guests.arrives')} {new Date(guest.check_in).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  )}
                  {guest.displayStatus === 'checked-in' && (
                    <div className="flex items-center gap-2 flex-1 min-w-[140px]">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse flex-shrink-0" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">{t('guests.guestCurrentlyStaying')}</span>
                    </div>
                  )}
                  {guest.displayStatus === 'completed' && (
                    <div className="flex-1 min-w-[140px] py-2.5 text-center text-[10px] uppercase font-bold tracking-widest text-primary-navy/40">
                      {t('guests.stayCompleted')}
                    </div>
                  )}

                  {/* Cancel — visible for all active bookings */}
                  {isActive && (
                    <button
                      onClick={() => setCancelTarget(guest.id)}
                      className="px-4 py-2.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 text-[10px] uppercase font-bold tracking-widest active:scale-[0.98] transition-all flex items-center gap-1.5"
                    >
                      <Ban size={12} />
                      {t('common.cancel')}
                    </button>
                  )}

                  {/* WhatsApp for pending / upcoming */}
                  {(guest.displayStatus === 'pending' || guest.displayStatus === 'upcoming') && (
                    <a
                      href={`https://wa.me/${guest.guest_phone.replace(/[^\d]/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 active:scale-[0.98] transition-all"
                    >
                      <Phone size={16} />
                    </a>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
        {!loading && hasMore && guests.length > 0 && (
          <button
            onClick={() => setPageLimit(prev => prev + PAGE_SIZE)}
            className="w-full py-3 text-sm font-bold text-secondary-gold hover:text-primary-navy bg-white rounded-xl border border-primary-navy/5 shadow-sm transition-colors"
          >
            {t('common.loadMore')}
          </button>
        )}
      </section>

      {/* FAB */}
      <button
        onClick={() => setShowAddModal(true)}
        className="fixed bottom-24 end-6 w-14 h-14 bg-secondary-gold text-primary-navy rounded-full shadow-lg shadow-secondary-gold/20 flex items-center justify-center active:scale-95 transition-all z-40"
      >
        <UserPlus size={24} />
      </button>

      {/* Cancel Confirmation Modal */}
      <AnimatePresence>
        {cancelTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[24px] w-full max-w-sm p-8 shadow-2xl text-center space-y-5"
            >
              <div className="w-14 h-14 bg-red-50 rounded-full mx-auto flex items-center justify-center">
                <Ban size={28} className="text-red-500" />
              </div>
              <div className="space-y-2">
                <h3 className="font-headline text-lg font-bold text-primary-navy">{t('guests.cancelBooking')}</h3>
                <p className="text-sm text-primary-navy/50">
                  {t('guests.cancelBookingDesc')}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setCancelTarget(null)}
                  className="flex-1 py-3 rounded-xl border border-primary-navy/20 font-bold text-xs uppercase tracking-widest text-primary-navy active:scale-[0.98] transition-all"
                >
                  {t('guests.keepBooking')}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold text-xs uppercase tracking-widest shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {cancelling ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    t('guests.yesCancel')
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Receipt Viewer Modal */}
      <AnimatePresence>
        {receiptViewURL && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[24px] w-full max-w-lg max-h-[85vh] overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between p-5 border-b border-primary-navy/5">
                <div className="flex items-center gap-2">
                  <Paperclip size={16} className="text-secondary-gold" />
                  <h3 className="font-headline font-bold text-primary-navy">{t('guests.transferReceipt')}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={receiptViewURL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-primary-navy/5 text-primary-navy text-[10px] font-bold uppercase tracking-widest hover:bg-primary-navy/10 transition-all"
                  >
                    {t('guests.openFullSize')}
                  </a>
                  <button onClick={() => setReceiptViewURL(null)} className="p-2 hover:bg-primary-navy/5 rounded-full">
                    <X size={18} className="text-primary-navy/40" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-surface-container-low">
                {receiptViewURL.toLowerCase().endsWith('.pdf') ? (
                  <iframe src={receiptViewURL} className="w-full h-[60vh] rounded-lg border-0" title="Receipt PDF" />
                ) : (
                  <img
                    src={receiptViewURL}
                    alt="Transfer Receipt"
                    className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-sm"
                    referrerPolicy="no-referrer"
                  />
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Guest Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[24px] w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl"
          >
            <div className="flex items-center justify-between p-6 border-b border-primary-navy/5">
              <div>
                <h3 className="font-headline text-lg font-bold text-primary-navy">{t('guests.addWalkInGuest')}</h3>
                <p className="text-xs text-primary-navy/50 font-medium">{t('guests.manualGuestEntry')}</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-primary-navy/5 rounded-full">
                <X size={20} className="text-primary-navy/40" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-gold">{t('guests.fullName')} *</label>
                <input
                  type="text"
                  value={addForm.name}
                  onChange={(e) => setAddForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Ahmed Al-Said"
                  className={cn("w-full bg-surface-container-low border rounded-xl py-3 px-4 text-sm placeholder:text-primary-navy/20", addErrors.name ? "border-red-300" : "border-transparent")}
                />
                {addErrors.name && <p className="text-red-500 text-xs">{addErrors.name}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-gold">{t('guests.phone')} *</label>
                <div className="flex gap-2">
                  <div className="bg-surface-container-low rounded-xl py-3 px-3 text-sm font-bold text-primary-navy/60">+968</div>
                  <input
                    type="text"
                    value={addForm.phone}
                    onChange={(e) => setAddForm(p => ({ ...p, phone: e.target.value.replace(/[^\d\s]/g, '') }))}
                    placeholder="9000 0000"
                    maxLength={9}
                    className={cn("flex-1 bg-surface-container-low border rounded-xl py-3 px-4 text-sm placeholder:text-primary-navy/20", addErrors.phone ? "border-red-300" : "border-transparent")}
                  />
                </div>
                {addErrors.phone && <p className="text-red-500 text-xs">{addErrors.phone}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-gold">{t('guests.emailOptional')}</label>
                <input
                  type="email"
                  value={addForm.email}
                  onChange={(e) => setAddForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="guest@email.com"
                  className="w-full bg-surface-container-low border border-transparent rounded-xl py-3 px-4 text-sm placeholder:text-primary-navy/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-gold">{t('guests.checkIn')} *</label>
                  <input
                    type="date"
                    value={addForm.check_in}
                    onChange={(e) => setAddForm(p => ({ ...p, check_in: e.target.value }))}
                    className={cn("w-full bg-surface-container-low border rounded-xl py-3 px-4 text-sm", addErrors.check_in ? "border-red-300" : "border-transparent")}
                  />
                  {addErrors.check_in && <p className="text-red-500 text-xs">{addErrors.check_in}</p>}
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-gold">{t('guests.checkOut')} *</label>
                  <input
                    type="date"
                    value={addForm.check_out}
                    onChange={(e) => setAddForm(p => ({ ...p, check_out: e.target.value }))}
                    className={cn("w-full bg-surface-container-low border rounded-xl py-3 px-4 text-sm", addErrors.check_out ? "border-red-300" : "border-transparent")}
                  />
                  {addErrors.check_out && <p className="text-red-500 text-xs">{addErrors.check_out}</p>}
                </div>
              </div>

              {/* Payment Mode Toggle */}
              <div className="space-y-3 pt-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-gold">{t('guests.paymentMode')}</label>
                <div className="grid grid-cols-2 gap-2 bg-surface-container-low rounded-xl p-1">
                  <button
                    type="button"
                    onClick={() => setPaymentMode('paid')}
                    className={cn(
                      "flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all active:scale-[0.98]",
                      paymentMode === 'paid'
                        ? "bg-primary-navy text-white shadow-sm"
                        : "text-primary-navy/50 hover:text-primary-navy/70"
                    )}
                  >
                    <Check size={13} />
                    {t('guests.paid')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMode('free')}
                    className={cn(
                      "flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all active:scale-[0.98]",
                      paymentMode === 'free'
                        ? "bg-secondary-gold text-primary-navy shadow-sm"
                        : "text-primary-navy/50 hover:text-primary-navy/70"
                    )}
                  >
                    <Gift size={13} />
                    {t('guests.free')}
                  </button>
                </div>

                {paymentMode === 'paid' && (
                  <div className="space-y-3 pt-1">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-gold">{t('guests.amountPaid')} *</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          value={amountPaid}
                          onChange={(e) => setAmountPaid(e.target.value)}
                          placeholder="0.00"
                          className={cn("flex-1 bg-surface-container-low border rounded-xl py-3 px-4 text-sm placeholder:text-primary-navy/20", addErrors.amount ? "border-red-300" : "border-transparent")}
                        />
                        <div className="bg-surface-container-low rounded-xl py-3 px-3 text-sm font-bold text-primary-navy/60">{t('common.omr')}</div>
                      </div>
                      {addErrors.amount && <p className="text-red-500 text-xs">{addErrors.amount}</p>}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-gold">{t('guests.attachReceipt')}</label>
                      <label className="flex items-center gap-3 bg-surface-container-low border border-transparent rounded-xl py-3 px-4 cursor-pointer hover:border-secondary-gold/40 transition-colors">
                        <Upload size={16} className="text-primary-navy/50 flex-shrink-0" />
                        <span className="text-sm text-primary-navy/60 truncate flex-1">
                          {receiptFileName || t('guests.chooseFile')}
                        </span>
                        {uploadProgress !== null && (
                          <span className="text-[10px] font-bold text-secondary-gold">{uploadProgress}%</span>
                        )}
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) { setReceiptFile(f); setReceiptFileName(f.name); }
                          }}
                        />
                      </label>
                      {addErrors.receipt && <p className="text-red-500 text-xs">{addErrors.receipt}</p>}
                    </div>
                  </div>
                )}

                {paymentMode === 'free' && (
                  <div className="bg-secondary-gold/10 border border-secondary-gold/30 rounded-xl p-3 flex items-start gap-2">
                    <Gift size={14} className="text-secondary-gold mt-0.5 flex-shrink-0" />
                    <p className="text-[11px] text-primary-navy/70 font-medium leading-relaxed">
                      {t('guests.freeBookingNote')}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-primary-navy/5 flex gap-3">
              <button
                onClick={() => { setShowAddModal(false); resetAddForm(); }}
                className="flex-1 py-3 rounded-xl border border-primary-navy/20 font-bold text-xs uppercase tracking-widest text-primary-navy"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleAddGuest}
                disabled={addSubmitting}
                className="flex-1 py-3 rounded-xl bg-primary-navy text-white font-bold text-xs uppercase tracking-widest shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {addSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <UserPlus size={14} />
                    {t('guests.addGuest')}
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
