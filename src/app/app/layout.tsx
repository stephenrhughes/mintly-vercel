import type { Metadata } from "next";

// Everything under the app host: sign-in, the portal and the admin area.
// Never indexed (APP-10).
export const metadata: Metadata = {
  title: { default: "Mintly", template: "%s | Mintly" },
  robots: { index: false, follow: false },
};

export default function AppRootLayout({ children }: LayoutProps<"/app">) {
  return children;
}
