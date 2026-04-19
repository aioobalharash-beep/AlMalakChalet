import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export const Terms: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="p-6 space-y-8 max-w-lg mx-auto pb-24">
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 text-primary-navy/60 hover:text-primary-navy transition-colors text-sm font-medium"
      >
        <ArrowLeft size={18} />
        Back to Home
      </button>

      <section className="text-center space-y-2">
        <span className="text-secondary-gold font-bold tracking-widest text-[10px] uppercase">Legal</span>
        <h2 className="font-headline text-3xl font-bold text-primary-navy">Terms of Stay</h2>
      </section>

      <div className="bg-white rounded-[20px] p-6 border border-primary-navy/5 shadow-sm space-y-6 text-sm text-primary-navy/70 leading-relaxed">
        <div>
          <h3 className="font-bold text-primary-navy mb-2">1. Booking & Payment</h3>
          <p>All reservations require a security deposit at the time of booking. Full payment is due upon check-in. Accepted methods include Thawani, bank transfer, and walk-in payment.</p>
        </div>
        <div>
          <h3 className="font-bold text-primary-navy mb-2">2. Check-In & Check-Out</h3>
          <p>Check-in is available from 3:00 PM. Check-out must be completed by 12:00 PM. Early check-in or late check-out may be arranged subject to availability.</p>
        </div>
        <div>
          <h3 className="font-bold text-primary-navy mb-2">3. Cancellation Policy</h3>
          <p>Cancellations made 48 hours prior to check-in are eligible for a full refund of the security deposit. Late cancellations may incur a charge equivalent to one night's stay.</p>
        </div>
        <div>
          <h3 className="font-bold text-primary-navy mb-2">4. Property Rules</h3>
          <p>Guests are expected to maintain the property in good condition. Any damages beyond normal wear and tear will be deducted from the security deposit. Smoking is permitted only in designated outdoor areas.</p>
        </div>
        <div>
          <h3 className="font-bold text-primary-navy mb-2">5. Privacy & Security</h3>
          <p>Your personal information is collected solely for the purpose of managing your reservation. We do not share guest data with third parties. The property is monitored by perimeter security for your safety.</p>
        </div>
      </div>

      <p className="text-[10px] text-center text-primary-navy/30 font-bold uppercase tracking-widest">
        Al Malak Chalet &mdash; Oman
      </p>
    </div>
  );
};
