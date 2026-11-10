"use client";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";

/** Downloads an agent-skill zip (DOC-03), counted in GA after consent. */
export function SkillDownload({
  skill = "mintly-api",
  label = "Download Agent Skill",
  source,
  className,
  variant = "default",
}: {
  skill?: "mintly-api" | "eiscd-api";
  label?: string;
  source: string;
  className?: string;
  variant?: "default" | "outline";
}) {
  return (
    <Button asChild variant={variant} className={className}>
      <a
        href={`/assets/${skill}-skill.zip`}
        download
        onClick={() => track("download_agent_skill", { category: "AgentSkill", label: source })}
      >
        <Download aria-hidden />
        {label}
      </a>
    </Button>
  );
}
