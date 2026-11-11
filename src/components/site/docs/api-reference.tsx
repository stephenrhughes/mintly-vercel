"use client";

import Script from "next/script";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

import { track } from "@/lib/analytics";

// The interactive API reference (DOC-01). ReDoc's standalone bundle (about
// 1 MB, with its own React) is served from /vendor and loaded only on the
// docs pages; until it has rendered, the server-rendered summary passed as
// children is the page, which is also what crawlers see.

type RedocGlobal = {
  init: (spec: string, options: object, element: HTMLElement, callback?: (error?: unknown) => void) => void;
};

const HEADER_HEIGHT = 64; // the sticky sales header (h-16)

function redocOptions(isDark: boolean, specUrl: string, specJsonUrl: string) {
  const primary = isDark ? "#3aaf85" : "#1a7f5c";
  return {
    scrollYOffset: HEADER_HEIGHT,
    hideLoading: true,
    nativeScrollbars: true,
    pathInMiddlePanel: true,
    sideNavStyle: "summary-only",
    menuToggle: true,
    expandResponses: "200",
    jsonSampleExpandLevel: 3,
    schemaExpansionLevel: 2,
    sortRequiredPropsFirst: true,
    simpleOneOfTypeLabel: true,
    hideSingleRequestSampleTab: true,
    minCharacterLengthToInitSearch: 2,
    downloadUrls: [
      { title: "YAML", url: specUrl },
      { title: "JSON", url: specJsonUrl },
    ],
    theme: {
      breakpoints: { small: "50rem", medium: "70rem", large: "105rem" },
      colors: {
        primary: { main: primary },
        success: { main: isDark ? "#3aaf85" : "#216e55" },
        text: { primary: isDark ? "#eeeeee" : "#242b3a", secondary: isDark ? "#c7c7c7" : "#4b5563" },
      },
      typography: {
        fontSize: "15px",
        lineHeight: "1.6em",
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        headings: { fontFamily: "var(--font-geist-sans), system-ui, sans-serif", fontWeight: "600" },
        code: { fontFamily: "var(--font-geist-mono), monospace", fontSize: "13px" },
        links: { color: primary },
      },
      sidebar: { width: "280px", backgroundColor: isDark ? "#1a1c1e" : "#f6f9fc" },
      rightPanel: { backgroundColor: isDark ? "#16181a" : "#242b3a", width: "38%" },
      codeBlock: { backgroundColor: isDark ? "#101214" : "#1b2130" },
    },
  };
}

export function ApiReference({
  specUrl,
  specJsonUrl,
  skillHref,
  skillName,
  children,
}: {
  specUrl: string;
  specJsonUrl: string;
  skillHref: string;
  skillName: string;
  children: ReactNode;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const redoc = (window as Window & { Redoc?: RedocGlobal }).Redoc;
    if (!ready || !redoc || !container.current) return;
    const isDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
    redoc.init(specUrl, redocOptions(isDark, specUrl, specJsonUrl), container.current, (error) => {
      if (!error) setLoaded(true);
    });
  }, [ready, specUrl, specJsonUrl]);

  // The skill link lives in the spec's markdown, so count downloads by
  // delegation rather than an onClick on the link.
  const onClick = useCallback(
    (event: React.MouseEvent) => {
      const link = (event.target as HTMLElement).closest?.("a[href]");
      if (link?.getAttribute("href")?.endsWith(skillHref)) {
        track("download_agent_skill", { category: "AgentSkill", label: skillName });
      }
    },
    [skillHref, skillName],
  );

  return (
    <div onClick={onClick}>
      <Script src="/vendor/redoc.standalone.js" strategy="afterInteractive" onReady={() => setReady(true)} />
      {!loaded && children}
      <div ref={container} />
    </div>
  );
}
