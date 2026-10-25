'use client';
import { FC, ReactNode, useEffect, useState } from 'react';
import { useTranslationSettings } from '@gitroom/react/translation/get.transation.service.client';

export const HtmlComponent: FC = () => {
  const settings = useTranslationSettings();
  const [dir, setDir] = useState(settings.dir());
  const [language, setLanguage] = useState(
    settings.resolvedLanguage || settings.language
  );

  useEffect(() => {
    const changed = (lng: string) => {
      setDir(settings.dir());
      setLanguage(lng);
    };
    settings.on('languageChanged', changed);
    return () => {
      settings.off('languageChanged', changed);
    };
  }, []);

  useEffect(() => {
    const htmlElement = document.querySelector('html');
    if (htmlElement) {
      htmlElement.setAttribute('dir', dir);
      if (language) htmlElement.setAttribute('lang', language);
    }
  }, [dir, language]);

  return null;
};
