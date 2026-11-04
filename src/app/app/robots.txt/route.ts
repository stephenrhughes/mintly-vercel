// robots.txt for the app host: nothing is crawled (APP-10). The proxy
// rewrites app.mintly.uk/robots.txt here.
export function GET() {
  return new Response("User-agent: *\nDisallow: /\n", {
    headers: { "Content-Type": "text/plain" },
  });
}
