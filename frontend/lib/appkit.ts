"use client";

import { createAppKit, type AppKit } from "@reown/appkit/react";
import { wagmiAdapter, genlayerNetwork, projectId } from "./wagmi-config";

// Reown AppKit must only ever be constructed in the browser (it touches
// customElements/DOM at construction time), and its hooks (useAppKit, etc.)
// throw if called before createAppKit() has run — which would happen during
// Next.js's server-side prerender of any client component that imports
// them. So we build (and expose) the modal instance imperatively here,
// guarded by a window check, instead of relying on the package's hooks.
export let appKitModal: AppKit | undefined;

if (typeof window !== "undefined" && projectId) {
  appKitModal = createAppKit({
    adapters: [wagmiAdapter],
    networks: [genlayerNetwork],
    projectId,
    metadata: {
      name: "WitnessMark",
      description: "Make promises that survive contact with reality.",
      url: window.location.origin,
      icons: ["/icon.svg"],
    },
    features: { analytics: false, email: false, socials: [] },
    themeMode: "light",
    themeVariables: {
      "--w3m-accent": "#0f172a",
      "--w3m-border-radius-master": "2px",
    },
  });
}
