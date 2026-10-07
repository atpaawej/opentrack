'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { motion, useReducedMotion } from 'motion/react';

/** The shell remains fixed; only the newly resolved route settles into place. */
export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      key={pathname}
      initial={reducedMotion ? false : { opacity: 0.88 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reducedMotion ? 0 : 0.12, ease: [0.23, 1, 0.32, 1] }}
    >
      {children}
    </motion.div>
  );
}
