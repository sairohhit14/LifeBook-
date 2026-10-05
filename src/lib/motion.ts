import { animate, stagger } from "animejs";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Reveal `[data-reveal]` elements as they scroll into view. One-shot: each
 * element animates the first time it enters the viewport, then stays visible.
 * Elements are visible by default (no-JS safe); hiding happens only here,
 * right before animating. No-op under prefers-reduced-motion.
 * Returns a cleanup that disconnects the observer.
 */
export function revealOnScroll(rootEl?: ParentNode | null): () => void {
  if (prefersReducedMotion()) return () => {};
  const root = rootEl ?? document;
  const targets = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
  if (targets.length === 0) return () => {};

  const io = new IntersectionObserver(
    entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        io.unobserve(el);
        el.style.willChange = "transform, opacity";
        animate(el, {
          opacity: [0, 1],
          translateY: [16, 0],
          duration: 650,
          ease: "outExpo",
          onComplete: () => {
            el.style.willChange = "";
            el.removeAttribute("data-reveal");
          },
        });
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
  );
  targets.forEach(el => io.observe(el));
  return () => io.disconnect();
}

/**
 * Staggered entrance for the direct children of `container` (e.g. stat cards).
 * One-shot on mount; no-op under prefers-reduced-motion.
 */
export function staggerChildren(containerEl: HTMLElement | null, gapMs = 70): void {
  if (!containerEl || prefersReducedMotion()) return;
  const kids = Array.from(containerEl.children) as HTMLElement[];
  if (kids.length === 0) return;
  animate(kids, {
    opacity: [0, 1],
    translateY: [14, 0],
    duration: 600,
    ease: "outExpo",
    delay: stagger(gapMs),
    onComplete: (self) => {
      (self.targets as HTMLElement[]).forEach(el => (el.style.willChange = ""));
    },
  });
}
