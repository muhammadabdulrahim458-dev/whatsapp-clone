import { useEffect } from "react";
import Lenis from "lenis";

export default function SmoothScroll({ children }) {
  useEffect(() => {
    // Initialize Lenis
    const lenis = new Lenis({
      duration: 1.2,
      orientation: "vertical", // 'vertical' or 'horizontal'
      gestureOrientation: "vertical",
      smoothWheel: true,
    });

    let rafId;

    // Track the animation frame ID so we can cancel it properly
    function raf(time) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }

    rafId = requestAnimationFrame(raf);

    // Clean up on unmount
    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}