import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";
const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const envBasePath = process.env.NEXT_PUBLIC_BASE_PATH;
const basePath = envBasePath
  ? `/${envBasePath.replace(/^\/+|\/+$/g, "")}`
  : isProduction && repositoryName
    ? `/${repositoryName}`
    : "";

const nextConfig: NextConfig = {
  output: 'export',
  turbopack: {
    root: process.cwd(),
  },
  images: {
    unoptimized: true,
  },
  basePath,
  assetPrefix: basePath ? `${basePath}/` : '',
  trailingSlash: true,
};

export default nextConfig;
