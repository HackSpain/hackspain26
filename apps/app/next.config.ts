import type { NextConfig } from "next";
import { withBotId } from "botid/next/config";

const nextConfig: NextConfig = {
  agentRules: false,
  allowedDevOrigins: ["127.0.2.2", "127.0.0.1", "localhost"],
  async redirects() {
    return [
      {
        source: "/admin/applications",
        destination: "/admin/perks",
        permanent: false,
      },
    ];
  },
};

export default withBotId(nextConfig);
