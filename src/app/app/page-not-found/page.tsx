import { notFound } from "next/navigation";

// proxy.ts rewrites unknown app paths here (including sales pages asked for
// on the app host, APP-01). Reaching notFound() while prerendering keeps
// this page static, so it is served with a real 404 status and the app's
// own not-found page.
export default function PageNotFound() {
  notFound();
}
