import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html data-theme="dark" lang="ko">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Slopes cam - 전국 스키장 실시간 웹캠 모음</title>
        <meta name="description" content="전국 스키장 실시간 웹캠 및 날씨" />
        <meta name="keywords" content="스키장, 웹캠, 실시간, 날씨" />
        <meta name="author" content="hletrd" />
        <meta name="application-name" content="Slopes cam" />
        <meta name="msapplication-TileColor" content="#121212" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Slopes cam" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#121212" />
        {/* Open Graph */}
        <meta property="og:title" content="Slopes cam - 전국 스키장 실시간 웹캠 모음" />
        <meta property="og:description" content="전국 스키장 실시간 웹캠 및 날씨" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="http://ski.atik.kr" />
        <meta property="og:locale" content="ko_KR" />
        <meta property="og:image" content="http://ski.atik.kr/preview.png" />
        <meta property="og:image:width" content="2400" />
        <meta property="og:image:height" content="1260" />
        <meta property="og:site_name" content="Slopes cam" />
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Slopes cam - 전국 스키장 실시간 웹캠 모음" />
        <meta name="twitter:description" content="전국 스키장 실시간 웹캠 및 날씨" />
        <meta name="twitter:image" content="http://ski.atik.kr/preview.png" />
        {/* Icons */}
        <link rel="icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/skiing-16x16.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/skiing-32x32.png" />
        <link rel="icon" type="image/png" sizes="64x64" href="/icons/skiing-64x64.png" />
        <link rel="icon" type="image/png" sizes="128x128" href="/icons/skiing-128x128.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icons/skiing-512x512.png" />
        <link rel="apple-touch-icon" href="/icons/skiing-180x180.png" />
        <link rel="manifest" href="/manifest.json" />
        {/* External CSS */}
        <link
          href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.5/dist/css/bootstrap.min.css"
          rel="stylesheet"
        />
        <link
          href="https://cdn.jsdelivr.net/npm/video.js@8.23.3/dist/video-js.min.css"
          rel="stylesheet"
        />
        <link
          href="https://cdn.jsdelivr.net/npm/@videojs/themes@1/dist/forest/index.css"
          rel="stylesheet"
        />
        <link
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
          rel="stylesheet"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.min.css"
        />
        {/* reCAPTCHA */}
        <script
          src="https://www.google.com/recaptcha/api.js?render=6LdnzyUsAAAAAKh6eSEaERifPRTh51qnRnpmX6S0"
          async
          defer
        />
        {/* html2canvas */}
        <script
          src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"
        />
        {/* video.js */}
        <script
          src="https://cdn.jsdelivr.net/npm/video.js@8.23.3/dist/alt/video.novtt.min.js"
        />
        {/* GitHub buttons */}
        <script
          async
          defer
          src="https://buttons.github.io/buttons.js"
        />
        {/* Chart.js */}
        <script src="https://cdn.jsdelivr.net/npm/chart.js" />
        <script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns" />
        {/* Google Analytics */}
        <script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-TDF3M6JH2R"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-TDF3M6JH2R');
`,
          }}
        />
        {/* JSON-LD structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "Slopes cam - 전국 스키장 실시간 웹캠 모음",
              alternateName: ["Slopes cam"],
              url: "http://ski.atik.kr",
            }),
          }}
        />
      </head>
      <body>
        {/* Early theme detection - runs before React hydration to prevent flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function () {
  try {
    var saved = localStorage.getItem('webcamSettings');
    if (saved) {
      var settings = JSON.parse(saved);
      if (settings && settings.darkMode === false) {
        document.body.classList.add('light-mode');
        document.documentElement.setAttribute('data-theme', 'light');
      }
    }
  } catch (e) {
    console.error('Theme init error:', e);
  }
})();
`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
