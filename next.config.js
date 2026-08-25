/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      "/api/cases/[id]/export-report": ["./templates/**"],
    },
  },
};

module.exports = nextConfig;
