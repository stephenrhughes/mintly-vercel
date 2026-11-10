// The proxy's rule for view as customer (ADM-13): while a view-as cookie is
// present, only reads get through. Signing out and leaving view-as are the
// two exceptions. Pure and free of Node APIs, for the proxy.

export const VIEW_AS_COOKIE = "mintly_view_as";

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const ALLOWED_WRITES = new Set(["/sign-out", "/admin/view-as/exit"]);

export function viewAsBlocksRequest(input: {
  method: string;
  appPathname: string;
  hasViewAsCookie: boolean;
}): boolean {
  if (!input.hasViewAsCookie) return false;
  if (READ_METHODS.has(input.method.toUpperCase())) return false;
  return !ALLOWED_WRITES.has(input.appPathname.replace(/\/+$/, "") || "/");
}
