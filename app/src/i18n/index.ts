import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enUS from '../../../localization/02-locale-files/en-US.json';
import zhCN from '../../../localization/02-locale-files/zh-CN.json';
import esMX from '../../../localization/02-locale-files/es-MX.json';
import ptBR from '../../../localization/02-locale-files/pt-BR.json';

export const SUPPORTED_LOCALES = ['en-US', 'zh-CN', 'es-MX', 'pt-BR'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en-US';

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: SUPPORTED_LOCALES,
    nonExplicitSupportedLngs: false,
    load: 'currentOnly',
    resources: {
      'en-US': enUS,
      'zh-CN': zhCN,
      'es-MX': esMX,
      'pt-BR': ptBR,
    },
    ns: ['common', 'dashboard', 'catalog', 'campaigns', 'growth', 'roasters', 'orders', 'sampleKits', 'rules', 'webhooks', 'errors', 'agent'],
    defaultNS: 'common',
    detection: {
      order: ['path', 'localStorage', 'navigator'],
      lookupFromPathIndex: 0,
      caches: ['localStorage'],
      lookupLocalStorage: 'greensheet:locale',
    },
    interpolation: { escapeValue: false },
    returnEmptyString: false,
    saveMissing: false,
  });

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
  document.documentElement.dir = 'ltr';
});

export default i18n;
