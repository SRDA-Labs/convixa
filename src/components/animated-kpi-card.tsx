"use client";

import { motion, useReducedMotion } from "framer-motion";

export function AnimatedKPICard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={shouldReduceMotion ? undefined : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
