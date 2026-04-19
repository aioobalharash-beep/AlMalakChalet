import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Phone, Mail } from 'lucide-react';

export const About: React.FC = () => {
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
        <span className="text-secondary-gold font-bold tracking-widest text-[10px] uppercase">Our Story</span>
        <h2 className="font-headline text-3xl font-bold text-primary-navy">About Al Malak Chalet</h2>
      </section>

      <div className="bg-white rounded-[20px] p-6 border border-primary-navy/5 shadow-sm space-y-6 text-sm text-primary-navy/70 leading-relaxed">
        <p>
          Al Malak Chalet is a luxury chalet nestled in the heart of Oman's breathtaking landscape. We blend modern comfort with traditional Omani heritage to create an unforgettable retreat experience.
        </p>
        <p>
          Our property features spacious living areas, a fully equipped culinary studio, private outdoor spaces, and panoramic views. Every detail has been curated to ensure our guests enjoy the highest standard of hospitality.
        </p>
        <p>
          Whether you seek a peaceful escape, a family gathering, or a celebration with friends, Al Malak Chalet provides the perfect setting with concierge service, daily maintenance, private parking, and secure perimeter access.
        </p>
      </div>

      <div className="bg-white rounded-[20px] p-6 border border-primary-navy/5 shadow-sm space-y-4">
        <h3 className="font-bold text-primary-navy text-sm uppercase tracking-wider">Contact</h3>
        <div className="space-y-3 text-sm text-primary-navy/70">
          <div className="flex items-center gap-3">
            <MapPin size={16} className="text-secondary-gold flex-shrink-0" />
            <span>Al Malak Chalet, Oman</span>
          </div>
          <div className="flex items-center gap-3">
            <Phone size={16} className="text-secondary-gold flex-shrink-0" />
            <span>+968 7191 9666</span>
          </div>
          <div className="flex items-center gap-3">
            <Mail size={16} className="text-secondary-gold flex-shrink-0" />
            <span>nooralmalak901@gmail.com</span>
          </div>
        </div>
      </div>

      <p className="text-[10px] text-center text-primary-navy/30 font-bold uppercase tracking-widest">
        Al Malak Chalet &mdash; Oman
      </p>
    </div>
  );
};
