import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarRange,
  Flame,
  Layers2,
  Lightbulb,
  ListChecks,
  Timer,
} from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import RevealSection from "@/components/marketing/RevealSection.tsx";
import { TELEGRAM_LOGIN_HTTP_URL } from "@/lib/telegramLinks.ts";

type WeekInsight = {
  day: string;
  completion: number;
  insight: string;
};

type Highlight = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  why: string;
};

const WEEK_STRIP: WeekInsight[] = [
  { day: "Mon", completion: 58, insight: "Warm-up" },
  { day: "Tue", completion: 84, insight: "Strong day" },
  { day: "Wed", completion: 72, insight: "Stable pace" },
  { day: "Thu", completion: 67, insight: "Recover focus" },
  { day: "Fri", completion: 20, insight: "Overcommitment" },
  { day: "Sat", completion: 46, insight: "Reset" },
  { day: "Sun", completion: 63, insight: "Good close" },
];

const HIGHLIGHTS: Highlight[] = [
  { icon: Layers2, title: "Recurring tasks as daily occurrences", why: "Daily completion stays accurate." },
  { icon: CalendarRange, title: "Calendar range view", why: "You can spot overload earlier." },
  { icon: ListChecks, title: "Categories + category insights", why: "Effort allocation becomes visible." },
  { icon: Timer, title: "Focus timer minutes", why: "Deep work time is measurable." },
  { icon: Flame, title: "Streak qualification (80% rule)", why: "Consistency has a meaningful bar." },
  { icon: Lightbulb, title: "Smart suggestions (Today's Guidance)", why: "Next action stays clear." },
];

const Landing: React.FC = () => {
  const stripRef = React.useRef<HTMLDivElement | null>(null);
  const [showInsights, setShowInsights] = React.useState(false);
  const [hoveredDay, setHoveredDay] = React.useState<string | null>(null);
  const [reduceMotion, setReduceMotion] = React.useState(false);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduceMotion(mediaQuery.matches);
    apply();
    mediaQuery.addEventListener("change", apply);
    return () => mediaQuery.removeEventListener("change", apply);
  }, []);

  React.useEffect(() => {
    if (reduceMotion) {
      setShowInsights(true);
      return;
    }

    const node = stripRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry && entry.isIntersecting) {
          setShowInsights(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35, rootMargin: "0px 0px -10% 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [reduceMotion]);

  return (
    <div className="marketing-root min-h-screen">
      <div className="marketing-vignette pointer-events-none absolute inset-0" />

      <main className="relative mx-auto max-w-[1100px] px-6 pb-28 pt-10 sm:px-10 sm:pb-36 sm:pt-12">
        <header className="flex items-center justify-between">
          <p className="marketing-text-primary text-sm font-medium tracking-tight">TaskFlow</p>
          <nav className="flex items-center gap-4 text-sm">
            <Link className="marketing-text-secondary transition-opacity hover:opacity-70" to="/features">
              Features
            </Link>
            <Link className="marketing-text-secondary transition-opacity hover:opacity-70" to="/guide">
              Guide
            </Link>
          </nav>
        </header>

        <RevealSection className="flex min-h-[76vh] flex-col justify-center pt-12 sm:min-h-[84vh]" delayMs={40}>
          <h1 className="marketing-text-primary max-w-4xl text-5xl font-semibold tracking-[-0.036em] sm:text-6xl lg:text-7xl lg:leading-[1.01]">
            Understand your week. Improve your next one.
          </h1>
          <p className="marketing-text-secondary mt-6 max-w-[64ch] text-base sm:text-lg">
            A calm system that turns daily execution into clearer weekly decisions.
          </p>

          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild size="lg" className="marketing-cta-primary text-sm font-medium">
              <a href={TELEGRAM_LOGIN_HTTP_URL} target="_blank" rel="noreferrer">
                Continue with Telegram
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <Button asChild size="lg" variant="ghost" className="marketing-cta-secondary text-sm font-medium">
              <Link to="/login">Continue with Email</Link>
            </Button>
          </div>

          <p className="marketing-text-secondary mt-6 text-xs tracking-[0.01em]">
            Weekly Review - Streak (80% rule) - Occurrence-based analytics
          </p>

          <div ref={stripRef} className="mt-10 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {WEEK_STRIP.map((item) => {
              const showLabel = showInsights || hoveredDay === item.day;
              return (
                <button
                  key={item.day}
                  type="button"
                  onMouseEnter={() => !reduceMotion && setHoveredDay(item.day)}
                  onMouseLeave={() => !reduceMotion && setHoveredDay(null)}
                  onFocus={() => !reduceMotion && setHoveredDay(item.day)}
                  onBlur={() => !reduceMotion && setHoveredDay(null)}
                  className="marketing-surface-1 relative overflow-hidden rounded-xl px-3 py-3 text-left sm:px-4 sm:py-4"
                >
                  <p className="marketing-text-secondary text-[11px] uppercase tracking-[0.14em]">{item.day}</p>
                  {reduceMotion ? (
                    <p className="marketing-text-primary mt-2 text-sm font-medium">
                      {item.completion}% - {item.insight}
                    </p>
                  ) : (
                    <div className="relative mt-2 h-6">
                      <span
                        className={`marketing-text-primary absolute inset-0 text-lg font-medium transition-all duration-400 ${
                          showLabel ? "translate-y-1 opacity-0" : "translate-y-0 opacity-100"
                        }`}
                      >
                        {item.completion}%
                      </span>
                      <span
                        className={`marketing-text-primary absolute inset-0 text-sm font-medium transition-all duration-400 ${
                          showLabel ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"
                        }`}
                      >
                        {item.insight}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </RevealSection>

        <hr className="marketing-section-separator" />

        <RevealSection className="mt-20 sm:mt-28" delayMs={80}>
          <p className="marketing-text-secondary text-xs uppercase tracking-[0.14em]">Why it works</p>
          <div className="marketing-divider mt-7 divide-y border-y">
            <div className="py-8">
              <p className="marketing-text-primary text-xl font-medium tracking-tight">Recurring-safe truth</p>
              <p className="marketing-text-secondary mt-2 max-w-[66ch] text-sm">
                Completion is tracked per day via TaskOccurrence, so one day never overwrites another.
              </p>
            </div>
            <div className="py-8">
              <p className="marketing-text-primary text-xl font-medium tracking-tight">Consistency that means something</p>
              <p className="marketing-text-secondary mt-2 max-w-[66ch] text-sm">
                Streaks qualify only when daily load and completion ratio pass your threshold.
              </p>
            </div>
            <div className="py-8">
              <p className="marketing-text-primary text-xl font-medium tracking-tight">Weekly review with direction</p>
              <p className="marketing-text-secondary mt-2 max-w-[66ch] text-sm">
                Insights show where your week slips and what to focus on next.
              </p>
            </div>
          </div>
        </RevealSection>

        <hr className="marketing-section-separator mt-20 sm:mt-28" />

        <RevealSection className="mt-20 sm:mt-28" delayMs={110}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="marketing-text-secondary text-xs uppercase tracking-[0.14em]">Feature highlights</p>
              <p className="marketing-text-primary mt-2 text-2xl font-medium tracking-tight">The essentials, without clutter.</p>
            </div>
            <Link className="marketing-text-secondary text-sm underline underline-offset-4 hover:opacity-70" to="/features">
              See all features
            </Link>
          </div>

          <ul className="mt-7 grid gap-3 sm:grid-cols-2">
            {HIGHLIGHTS.map((item) => (
              <li key={item.title} className="marketing-surface-1 rounded-xl px-4 py-4">
                <div className="flex items-start gap-3">
                  <item.icon className="marketing-text-secondary mt-0.5 h-4 w-4" />
                  <div>
                    <p className="marketing-text-primary text-sm font-medium">{item.title}</p>
                    <p className="marketing-text-secondary mt-1 text-xs">Why it matters: {item.why}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </RevealSection>

        <hr className="marketing-section-separator mt-20 sm:mt-28" />

        <RevealSection className="mt-20 sm:mt-28" delayMs={140}>
          <p className="marketing-text-secondary text-xs uppercase tracking-[0.14em]">Telegram sign-in</p>
          <div className="marketing-surface-2 mt-7 rounded-2xl px-5 py-7 sm:px-7 sm:py-8">
            <div className="grid gap-5 sm:grid-cols-3">
              <p className="marketing-text-primary text-sm">1 Open bot</p>
              <p className="marketing-text-primary text-sm">2 Press Start</p>
              <p className="marketing-text-primary text-sm">3 Tap secure link</p>
            </div>
            <p className="marketing-text-secondary mt-5 text-xs">
              Security: one-time login token, short TTL, hashed before storage.
            </p>
            <Link className="marketing-text-primary mt-5 inline-flex items-center gap-2 text-sm font-medium hover:opacity-70" to="/guide">
              Read full guide
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </RevealSection>

        <RevealSection className="mt-20 sm:mt-28" delayMs={170}>
          <div className="marketing-surface-1 rounded-2xl px-6 py-9 text-center">
            <p className="marketing-text-primary text-2xl font-medium tracking-tight">Your data stays yours.</p>
            <p className="marketing-text-secondary mx-auto mt-2 max-w-[64ch] text-xs">
              One-time link, short TTL, and hashed token storage keep sign-in clean and secure.
            </p>
          </div>
        </RevealSection>

        <RevealSection className="marketing-divider mt-16 flex flex-wrap items-center justify-center gap-6 border-t pt-8 text-sm marketing-text-secondary" delayMs={190}>
          <a className="transition-opacity hover:opacity-70" href="/api/docs" rel="noreferrer" target="_blank">
            Docs
          </a>
          <a className="transition-opacity hover:opacity-70" href="#" onClick={(event) => event.preventDefault()}>
            GitHub
          </a>
          <a className="transition-opacity hover:opacity-70" href="#" onClick={(event) => event.preventDefault()}>
            Contact
          </a>
        </RevealSection>
      </main>
    </div>
  );
};

export default Landing;
