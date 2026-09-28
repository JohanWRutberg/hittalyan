"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { useAnimateEntrance } from "@/lib/use-entrance";

/**
 * Tonar in det som dyker upp efter att sidan laddat. Det servern redan ritat visas
 * direkt, utan intoning – annars är det osynligt tills JavaScript hunnit ladda.
 * Se `useAnimateEntrance`.
 */
export function FadeIn({ delay = 0, ...props }: HTMLMotionProps<"div"> & { delay?: number }) {
  const animate = useAnimateEntrance();
  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 12 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay }}
      {...props}
    />
  );
}

export function Stagger({ children, className }: { children: React.ReactNode; className?: string }) {
  const animate = useAnimateEntrance();
  return (
    <motion.div
      className={className}
      initial={animate ? "hidden" : false}
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 10 },
        show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
      }}
    >
      {children}
    </motion.div>
  );
}
