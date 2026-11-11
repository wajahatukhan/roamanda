"use client";

import { useAnimate } from "motion/react-mini";
import { useEffect } from "react";

/**
 * A card's entrance: a short upward settle, staggered for the first few cards. It only moves the card
 * (no opacity), so content is visible from the first paint and nothing shifts. Reduced-motion users get none.
 * Uses motion's mini animator (a few hundred bytes of script, no animation engine) so the page's first JavaScript
 * download stays small.
 */
export function Reveal({ index, children }: { index: number; children: React.ReactNode }) {
  const [scope, animate] = useAnimate<HTMLLIElement>();
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const controls = animate(scope.current, { transform: ["translateY(8px)", "translateY(0px)"] }, { duration: 0.4, ease: "easeOut", delay: Math.min(index, 5) * 0.04 });
    return () => controls.stop();
  }, [animate, scope, index]);
  return <li ref={scope}>{children}</li>;
}
