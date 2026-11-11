"use client";

import { Play } from "lucide-react";
import { useState } from "react";

/**
 * A YouTube video that loads only when played (no third-party request on
 * page load), from youtube-nocookie.com.
 */
export function VideoEmbed({ id, title }: { id: string; title: string }) {
  const [playing, setPlaying] = useState(false);
  return (
    <div className="relative aspect-video overflow-hidden rounded-xl bg-brand-navy ring-1 ring-border">
      {playing ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1`}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 size-full"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white"
        >
          <span className="flex size-16 items-center justify-center rounded-full bg-brand-mint text-brand-navy">
            <Play className="size-7 fill-current" aria-hidden />
          </span>
          <span className="font-medium">Play: {title}</span>
        </button>
      )}
    </div>
  );
}
