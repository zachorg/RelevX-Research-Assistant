/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["core"],

  webpack: (config, { isServer }) => {
    // Exclude server-only modules from client bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        http: false,
        https: false,
        zlib: false,
        path: false,
        os: false,
        child_process: false,
        "firebase-admin": false,
      };
    }

    return config;
  },
};

export default nextConfig;
