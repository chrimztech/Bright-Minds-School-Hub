import { useEffect, useRef, useState } from "react";

// Fades/slides an element in the first time it scrolls into view — a small IntersectionObserver
// wrapper rather than pulling in a full animation library for what's just a few marketing
// sections on the public landing page.
//
// This is real page content (About section copy, program cards), not decoration, so it must
// never depend entirely on the observer firing: a generous rootMargin reveals things well
// before they're actually on screen, and a hard fallback timer forces visibility regardless —
// covering script-blocked browsers, unusual embedding contexts, or a full-page capture tool
// that resizes the viewport without dispatching the scroll/resize events IntersectionObserver
// normally reacts to.
export function useReveal<T extends HTMLElement>(threshold = 0.15) {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fallback = setTimeout(() => setVisible(true), 1800);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          clearTimeout(fallback);
          observer.disconnect();
        }
      },
      { threshold, rootMargin: "0px 0px 200px 0px" },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      clearTimeout(fallback);
    };
  }, [threshold]);

  return { ref, visible };
}
