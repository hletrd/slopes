import { I18nProvider } from "@/lib/i18n";
import { App } from "@/components/App";

const FALLBACK_BUILD_INFO = {
  commitUrl: "https://github.com/hletrd/slopes/commit/b6f4104bfff232bdf513f0f6baa021a24db1a053",
  shortCommit: "b6f4104",
  buildDate: "2026-03-20",
};

async function getBuildInfo() {
  try {
    const response = await fetch("https://ski.atik.kr/", { cache: "no-store" });
    if (!response.ok) {
      return FALLBACK_BUILD_INFO;
    }

    const html = await response.text();
    const match = html.match(
      /Current version:\s*<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>\s*\((\d{4}-\d{2}-\d{2})\)/i
    );

    if (!match) {
      return FALLBACK_BUILD_INFO;
    }

    return {
      commitUrl: match[1],
      shortCommit: match[2],
      buildDate: match[3],
    };
  } catch {
    return FALLBACK_BUILD_INFO;
  }
}

export default async function Page() {
  const buildInfo = await getBuildInfo();

  return (
    <I18nProvider>
      <App buildInfo={buildInfo} />
    </I18nProvider>
  );
}
