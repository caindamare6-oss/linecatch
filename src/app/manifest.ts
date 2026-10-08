import type { MetadataRoute } from "next";
import { APP_NAME } from "@/lib/config";

/** Lets barbers put LineCatch on their home screen: it opens full screen, like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: "Missed calls, bookings and clients for barbers",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#121110",
    theme_color: "#121110",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
