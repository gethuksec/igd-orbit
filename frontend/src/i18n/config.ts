import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import idTranslations from './locales/id.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      id: {
        translation: idTranslations,
      },
    },
    lng: 'id', // Default language: Indonesian
    fallbackLng: 'id',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;

