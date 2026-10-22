import type { Transition, Variants } from "framer-motion";

export const transitions = {
  spring: {
    type: "spring",
    stiffness: 300,
    damping: 24,
  } as Transition,
  springBouncy: {
    type: "spring",
    stiffness: 500,
    damping: 15,
  } as Transition,
  springStiff: {
    type: "spring",
    stiffness: 700,
    damping: 30,
  } as Transition,
  smooth: {
    type: "tween",
    duration: 0.3,
    ease: "easeInOut",
  } as Transition,
  snappy: {
    type: "tween",
    duration: 0.15,
    ease: [0.25, 0.1, 0.25, 1],
  } as Transition,
} as const;

export const pageTransition: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -16 },
  visible: { opacity: 1, y: 0 },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
};

export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -24 },
  visible: { opacity: 1, x: 0 },
};

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 24 },
  visible: { opacity: 1, x: 0 },
};

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.1,
    },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 300, damping: 24 },
  },
};
