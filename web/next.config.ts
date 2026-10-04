import type { NextConfig } from "next";

// Static export: the app is fully client-side (Firebase Auth + Firestore) and is
// served from Firebase Hosting. All server logic lives in ../functions.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
};

export default nextConfig;
