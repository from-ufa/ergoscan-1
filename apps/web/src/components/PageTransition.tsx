"use client";

/** No enter animation — explorer pages paint immediately. */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
