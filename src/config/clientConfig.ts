export interface ClientTheme {
  primary: string;
  secondary: string;
  background?: string;
}

export interface ClientAdmin {
  email: string;
  /** Additional authorized admin emails (beyond the primary). */
  additionalEmails?: string[];
  name: string;
}

export interface ClientSocial {
  whatsapp: string;
  instagram?: string;
}

export interface ClientConfig {
  chaletName: string;
  logoPath: string | null;
  theme: ClientTheme;
  admin: ClientAdmin;
  social: ClientSocial;
}

export const CLIENT_CONFIG: ClientConfig = {
  chaletName: 'Al Malak Chalet',
  logoPath: '/assets/brand/logo.png',
  theme: {
    primary: '#2B3D8B',
    secondary: '#7089C4',
    background: '#F5F3ED',
  },
  admin: {
    email: 'nooralmalak901@gmail.com',
    additionalEmails: ['shaikhashaikha77@gmail.com'],
    name: 'Al Malak Admin',
  },
  social: {
    whatsapp: '96871919666',
    instagram: 'https://www.instagram.com/almalak_chalet/',
  },
};

export const getClientConfig = (): ClientConfig => CLIENT_CONFIG;

export const ADMIN_EMAILS: string[] = [
  CLIENT_CONFIG.admin.email,
  ...(CLIENT_CONFIG.admin.additionalEmails ?? []),
]
  .map(e => (e || '').trim().toLowerCase())
  .filter(Boolean);

export const isAdminEmail = (email: string | null | undefined): boolean => {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
};

export const whatsappHref = (number: string): string => {
  const digits = (number || '').replace(/\D/g, '');
  return `https://wa.me/${digits}`;
};

export const applyTheme = (theme: ClientTheme): void => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--primary', theme.primary);
  root.style.setProperty('--secondary', theme.secondary);
  if (theme.background) {
    root.style.setProperty('--background', theme.background);
  }
};

export const FALLBACK_CLIENT_CONFIG: ClientConfig = CLIENT_CONFIG;
