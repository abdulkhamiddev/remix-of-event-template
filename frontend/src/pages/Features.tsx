import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import RevealSection from "@/components/marketing/RevealSection.tsx";
import { TELEGRAM_LOGIN_HTTP_URL } from "@/lib/telegramLinks.ts";

type FeatureItem = {
  title: string;
  description: string;
  why: string;
};

const BUCKETS: { title: string; items: FeatureItem[] }[] = [
  {
    title: "Core",
    items: [
      {
        title: "Tasks",
        description: "Plan one-off and recurring work in one flow.",
        why: "Daily planning stays simple.",
      },
      {
        title: "Calendar",
        description: "View workload by date range and inspect specific days.",
        why: "Helps you catch overload early.",
      },
      {
        title: "Categories",
        description: "Group work by area and focus context.",
        why: "Effort distribution is easier to read.",
      },
    ],
  },
  {
    title: "Insight",
    items: [
      {
        title: "Analytics",
        description: "Weekly, monthly, yearly metrics from occurrences.",
        why: "Trends are based on real outcomes.",
      },
      {
        title: "Weekly Review",
        description: "Summarizes what moved and where friction started.",
        why: "Guides your next week with clarity.",
      },
      {
        title: "Most productive periods",
        description: "Shows windows with strongest completion quality.",
        why: "Protects your best hours.",
      },
    ],
  },
  {
    title: "Consistency",
    items: [
      {
        title: "Streak rules",
        description: "Uses 80% threshold plus minimum daily task count.",
        why: "Consistency stays meaningful.",
      },
      {
        title: "Suggestions",
        description: "Today's guidance surfaces warning, focus, and praise.",
        why: "Keeps next action obvious.",
      },
    ],
  },
];

const Features: React.FC = () => {
  return (
    <div className="marketing-root min-h-screen">
      <div className="marketing-vignette pointer-events-none absolute inset-0" />

      <main className="relative mx-auto max-w-[1100px] px-6 pb-28 pt-10 sm:px-10 sm:pb-36 sm:pt-12">
        <header className="flex items-center justify-between">
          <p className="marketing-text-primary text-sm font-medium tracking-tight">TaskFlow</p>
          <div className="flex items-center gap-4 text-sm">
            <Link className="marketing-text-secondary transition-opacity hover:opacity-70" to="/landing">
              Landing
            </Link>
            <Link className="marketing-text-secondary transition-opacity hover:opacity-70" to="/guide">
              Guide
            </Link>
          </div>
        </header>

        <RevealSection className="pt-14 sm:pt-16" delayMs={40}>
          <h1 className="marketing-text-primary max-w-3xl text-5xl font-semibold tracking-[-0.034em] sm:text-6xl">
            All features, clearly grouped.
          </h1>
          <p className="marketing-text-secondary mt-5 max-w-[66ch] text-base sm:text-lg">
            Everything here supports one goal: better execution this week, better decisions next week.
          </p>
        </RevealSection>

        <RevealSection className="mt-14 grid gap-6 lg:grid-cols-3 sm:mt-16" delayMs={80}>
          {BUCKETS.map((bucket) => (
            <section key={bucket.title} className="marketing-surface-1 rounded-2xl px-5 py-5 sm:px-6">
              <p className="marketing-text-primary text-xl font-medium tracking-tight">{bucket.title}</p>
              <ul className="marketing-divider mt-4 divide-y border-t">
                {bucket.items.map((item) => (
                  <li key={item.title} className="py-4">
                    <p className="marketing-text-primary text-sm font-medium">{item.title}</p>
                    <p className="marketing-text-secondary mt-1 text-xs">{item.description}</p>
                    <p className="marketing-text-secondary mt-1 text-xs">Why it matters: {item.why}</p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </RevealSection>

        <RevealSection className="mt-14 flex flex-wrap items-center gap-3" delayMs={120}>
          <Button asChild size="lg" className="marketing-cta-primary text-sm font-medium">
            <a href={TELEGRAM_LOGIN_HTTP_URL} target="_blank" rel="noreferrer">
              Continue with Telegram
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </Button>
          <Button asChild size="lg" variant="ghost" className="marketing-cta-secondary text-sm font-medium">
            <Link to="/login">Continue with Email</Link>
          </Button>
        </RevealSection>

        <RevealSection className="mt-7 flex flex-wrap items-center gap-4 text-sm" delayMs={150}>
          <Link className="marketing-text-secondary underline underline-offset-4 transition-opacity hover:opacity-70" to="/landing">
            Back to landing
          </Link>
          <Link className="marketing-text-secondary underline underline-offset-4 transition-opacity hover:opacity-70" to="/guide">
            Telegram guide
          </Link>
        </RevealSection>
      </main>
    </div>
  );
};

export default Features;
