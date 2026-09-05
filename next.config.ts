import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Gamla adresser låg under /app. Behålls som permanenta omdirigeringar för
  // bokmärken och för appar som redan lagts till på hemskärmen.
  async redirects() {
    return [
      { source: "/app", destination: "/lagenheter", permanent: true },
      { source: "/app/bevakningar/:path*", destination: "/bevakningar/:path*", permanent: true },
      { source: "/app/konto", destination: "/konto", permanent: true },
      { source: "/app/pro", destination: "/pro", permanent: true },
      { source: "/app/admin", destination: "/admin", permanent: true },
    ];
  },
};

export default withNextIntl(nextConfig);
