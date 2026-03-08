/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@workspace/ui", "@workspace/db", "@workspace/github", "@workspace/types"],
  webpack: (config) => {
    // Resolve .js imports to .ts source files in workspace packages (ESM compat)
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
}

export default nextConfig
