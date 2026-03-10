"use client";

import { cn } from "@workspace/ui/lib/utils";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import * as React from "react";

const DEFAULT_WORDS = ["Syncing...", "Modulating...", "Calibrating...", "Propelling...", "Probing...", "Scouting...", "Vectoring...", "Forging...", "Architecting...", "Manifesting...", "Synthesizing...", ""] as const;
  
type TextChangeAnimationProps = {
  words?: readonly string[];
  intervalMs?: number;
  className?: string;
};

function getRandomWordIndex(length: number, currentIndex: number) {
  if (length <= 1) return 0;

  let nextIndex = currentIndex;

  while (nextIndex === currentIndex) {
    nextIndex = Math.floor(Math.random() * length);
  }

  return nextIndex;
}

function OrbitIndicator() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="relative mr-2 size-5 shrink-0 text-muted-foreground">
      <div className="absolute inset-0 rounded-full border border-current/20" />
      <div className="absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current opacity-70" />
      <motion.div
        className="absolute inset-0"
        animate={prefersReducedMotion ? undefined : { rotate: 360 }}
        transition={{
          duration: 2.4,
          repeat: Number.POSITIVE_INFINITY,
          ease: "linear",
        }}
      >
        <div className="absolute left-1/2 top-0 size-1 -translate-x-1/2 rounded-full bg-current opacity-45" />
      </motion.div>
    </div>
  );
}

export function TextChangeAnimation({
  words = DEFAULT_WORDS,
  intervalMs = 5000,
  className,
}: TextChangeAnimationProps) {
  const safeWords = words.length > 0 ? words : DEFAULT_WORDS;
  const [index, setIndex] = React.useState(0);
  const ref = React.useRef<HTMLDivElement | null>(null);
  const isInView = useInView(ref, { once: false });
  const activeWord = safeWords[index] ?? safeWords[0] ?? "working";

  React.useEffect(() => {
    setIndex(0);
  }, [safeWords]);

  React.useEffect(() => {
    if (safeWords.length <= 1) return;

    const interval = window.setInterval(() => {
      setIndex((current) => getRandomWordIndex(safeWords.length, current));
    }, intervalMs);

    return () => window.clearInterval(interval);
  }, [intervalMs, safeWords]);

  return (
    <div
      ref={ref}
      className="relative flex min-h-5 items-center overflow-hidden text-sm text-muted-foreground"
    >
      <OrbitIndicator />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${activeWord}-${index}`}
          className="flex items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.12 } }}
        >
          {activeWord.split("").map((character, characterIndex) => (
            <motion.span
              key={`${activeWord}-${characterIndex}-${character}`}
              initial={{ y: 10, opacity: 0 }}
              animate={
                isInView
                  ? {
                      y: 0,
                      opacity: 1,
                      transition: {
                        delay: characterIndex * 0.05,
                        duration: 0.22,
                        ease: "easeOut",
                      },
                    }
                  : { y: 10, opacity: 0 }
              }
              className={cn("inline-block text-sm tracking-tight", className)}
            >
              {character === " " ? <span>&nbsp;</span> : character}
            </motion.span>
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
