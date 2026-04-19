import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Eye, EyeOff, LogIn, UserPlus, AlertCircle, ArrowLeft, Mail } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { sendPasswordResetEmail } from '../services/firebase';
import { cn } from '@/src/lib/utils';
import { useTranslation } from 'react-i18next';
import { LanguageToggle } from './LanguageToggle';
import { getClientConfig } from '../config/clientConfig';
import { BrandMark } from './BrandMark';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, register, logout } = useAuth();
  const config = getClientConfig();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError('Please enter your email address first');
      return;
    }
    setResetLoading(true);
    setError('');
    try {
      await sendPasswordResetEmail(email.trim());
      setResetSent(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        if (!name.trim()) { setError('Name is required'); setLoading(false); return; }
        await register({ name: name.trim(), email, password, phone: phone || undefined });
      } else {
        await login(email, password);
        const adminEmail = config.admin.email;
        const entered = email.trim().toLowerCase();
        const storedRaw = localStorage.getItem('almalak_user');
        const stored = storedRaw ? JSON.parse(storedRaw) : null;
        if (stored?.role === 'admin' && adminEmail && entered !== adminEmail) {
          logout();
          setError('This account is not authorized as an administrator.');
          setLoading(false);
          return;
        }
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-primary-navy flex items-center justify-center p-6">
      {/* Language toggle */}
      <div className="fixed top-4 end-4 z-50">
        <LanguageToggle variant="dark" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="flex flex-col items-center mb-10">
          <BrandMark variant="dark" size="lg" className="h-24 sm:h-28 mx-auto" />
          <p className="text-white/40 text-[10px] uppercase tracking-[0.3em] font-bold mt-4 text-center">{t('common.luxuryDesertSanctuary')}</p>
        </div>

        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm font-medium mb-6"
        >
          <ArrowLeft size={18} />
          {t('login.backToHome')}
        </button>

        <div className="bg-white rounded-[28px] p-8 shadow-2xl">
          <div className="flex gap-2 mb-8 bg-pearl-white rounded-xl p-1">
            <button
              onClick={() => { setIsRegister(false); setError(''); }}
              className={cn(
                "flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
                !isRegister ? "bg-primary-navy text-white shadow" : "text-primary-navy/50"
              )}
            >
              {t('login.signIn')}
            </button>
            <button
              onClick={() => { setIsRegister(true); setError(''); }}
              className={cn(
                "flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
                isRegister ? "bg-primary-navy text-white shadow" : "text-primary-navy/50"
              )}
            >
              {t('login.register')}
            </button>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 bg-red-50 text-red-600 p-3 rounded-xl mb-6 text-xs font-medium"
            >
              <AlertCircle size={16} />
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {isRegister && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-gold">{t('login.fullName')}</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ahmed Al-Said"
                  className="w-full bg-pearl-white border-none rounded-xl py-3.5 px-5 focus:ring-1 focus:ring-secondary-gold/50 placeholder:text-primary-navy/20 text-sm"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-gold">{t('login.email')}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full bg-pearl-white border-none rounded-xl py-3.5 px-5 focus:ring-1 focus:ring-secondary-gold/50 placeholder:text-primary-navy/20 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-gold">{t('login.password')}</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full bg-pearl-white border-none rounded-xl py-3.5 px-5 pe-12 focus:ring-1 focus:ring-secondary-gold/50 placeholder:text-primary-navy/20 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute end-4 top-1/2 -translate-y-1/2 text-primary-navy/30 hover:text-primary-navy/60"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {!isRegister && (
              <div className="flex justify-end">
                {resetSent ? (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600"
                  >
                    <Mail size={12} />
                    {t('login.resetSent')}
                  </motion.p>
                ) : (
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={resetLoading}
                    className="text-[11px] font-bold text-secondary-gold hover:underline disabled:opacity-50"
                  >
                    {resetLoading ? t('common.loading') : t('login.forgotPassword')}
                  </button>
                )}
              </div>
            )}

            {isRegister && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-gold">{t('login.phone')}</label>
                <div className="flex gap-3">
                  <div className="bg-pearl-white rounded-xl py-3.5 px-4 text-sm font-bold text-primary-navy/60">+968</div>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="9000 0000"
                    className="flex-1 bg-pearl-white border-none rounded-xl py-3.5 px-5 focus:ring-1 focus:ring-secondary-gold/50 placeholder:text-primary-navy/20 text-sm"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-navy text-white py-4 rounded-xl font-bold text-sm uppercase tracking-widest shadow-lg shadow-primary-navy/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {isRegister ? <UserPlus size={18} /> : <LogIn size={18} />}
                  {isRegister ? t('login.register') : t('login.signIn')}
                </>
              )}
            </button>
          </form>

        </div>

        <p className="text-white/20 text-[10px] text-center mt-8 uppercase tracking-widest font-bold">
          {config.chaletName}
        </p>
      </motion.div>
    </div>
  );
};
