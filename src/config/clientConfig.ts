// --- THE BLUEPRINT (Don't change these) ---
export interface ClientTheme {
  primary: string;
  secondary: string;
}

export interface ClientAdmin {
  email: string;
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

// --- YOUR CHALET DATA (Change these values!) ---
export const CLIENT_CONFIG: ClientConfig = {
  chaletName: 'Cloud Chalet',
  logoPath: '/assets/brand/logo.png',
  theme: {
    primary: '#5B9BD5',   // That Sky Blue you wanted
    secondary: '#A5C8E1', // The Cloud Blue
  },
  admin: {
    email: 'Admin@cloud.om',
    name: 'Yousif',
  },
  social: {
    whatsapp: '96893311525',
    instagram: 'https://www.instagram.com/cloud.chalet1/',
  },
};

// Safety net for the app
export const FALLBACK_CLIENT_CONFIG = CLIENT_CONFIG;
