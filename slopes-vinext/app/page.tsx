"use client";

import { I18nProvider } from "@/lib/i18n";
import { App } from "@/components/App";

export default function Page() {
  return (
    <I18nProvider>
      <App />
    </I18nProvider>
  );
}
