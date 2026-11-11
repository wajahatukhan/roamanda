"use client";

import { MotionConfig, motion } from "motion/react";

/**
 * A card's entrance: a short upward settle, staggered for the first few cards. It only moves the card
 * (no opacity), so content is visible from the first paint and nothing shifts. Reduced-motion users get none.
 */
export function Reveal({ index, children }: { index: number; children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <motion.li initial={{ y: 8 }} animate={{ y: 0 }} transition={{ duration: 0.4, ease: "easeOut", delay: Math.min(index, 5) * 0.04 }}>
        {children}
      </motion.li>
    </MotionConfig>
  );
}
