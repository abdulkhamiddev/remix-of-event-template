import React from "react";
import { cn } from "@/lib/utils.ts";

type RevealSectionProps = {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
  as?: "section" | "div";
};

const RevealSection: React.FC<RevealSectionProps> = ({ children, className, delayMs = 0, as = "section" }) => {
  const Tag = as;
  const ref = React.useRef<HTMLElement | null>(null);
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry && entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2, rootMargin: "0px 0px -8% 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={cn(
        "transition-all duration-700 ease-out will-change-transform motion-reduce:transform-none motion-reduce:opacity-100 motion-reduce:transition-none",
        isVisible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
        className,
      )}
      style={{ transitionDelay: `${delayMs}ms` }}
    >
      {children}
    </Tag>
  );
};

export default RevealSection;
