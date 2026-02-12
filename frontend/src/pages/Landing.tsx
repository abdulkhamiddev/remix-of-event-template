import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BarChart3, CalendarDays, Flame } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";

const Landing: React.FC = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-6xl px-6 py-10 sm:px-10 sm:py-14">
        <section className="rounded-3xl border border-border/60 bg-card/80 px-6 py-10 shadow-sm backdrop-blur-xl sm:px-10 sm:py-14">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">TaskFlow</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Understand your week. Improve your next one.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Plan your tasks, track consistency, and review real weekly outcomes using occurrence-based analytics.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link to="/login?provider=telegram">
                Start with Telegram
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/login">Email login</Link>
            </Button>
          </div>
        </section>

        <section className="mt-10 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-border/60 bg-card/70 p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Step 1</p>
            <h2 className="mt-2 text-lg font-medium">Plan tasks</h2>
            <p className="mt-2 text-sm text-muted-foreground">Create one-off or recurring tasks with deadlines and categories.</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card/70 p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Step 2</p>
            <h2 className="mt-2 text-lg font-medium">Track consistency</h2>
            <p className="mt-2 text-sm text-muted-foreground">Use daily completion ratio and streak qualification to stay consistent.</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card/70 p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Step 3</p>
            <h2 className="mt-2 text-lg font-medium">Review insights weekly</h2>
            <p className="mt-2 text-sm text-muted-foreground">See what worked this week and set focus for the next one.</p>
          </div>
        </section>

        <section className="mt-10 rounded-3xl border border-border/60 bg-card/80 p-6 sm:p-8">
          <h2 className="text-sm uppercase tracking-[0.14em] text-muted-foreground">Proof UI</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                Weekly Review
              </div>
              <p className="mt-3 text-2xl font-semibold">84%</p>
              <p className="mt-1 text-xs text-muted-foreground">Completion rate</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Flame className="h-4 w-4" />
                Streak
              </div>
              <p className="mt-3 text-2xl font-semibold">12 days</p>
              <p className="mt-1 text-xs text-muted-foreground">Current streak</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <BarChart3 className="h-4 w-4" />
                Most productive day
              </div>
              <p className="mt-3 text-2xl font-semibold">Tuesday</p>
              <p className="mt-1 text-xs text-muted-foreground">Weekly trend</p>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-3xl border border-border/60 bg-card/80 px-6 py-7 sm:px-8">
          <h2 className="text-lg font-medium">Your data stays yours.</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account data is scoped to you and protected by token-based authentication.
          </p>
        </section>

        <footer className="mt-10 flex flex-wrap items-center gap-4 border-t border-border/60 pt-6 text-sm text-muted-foreground">
          <a className="hover:text-foreground" href="/api/docs" rel="noreferrer" target="_blank">
            Docs
          </a>
          <a className="hover:text-foreground" href="#" onClick={(event) => event.preventDefault()}>
            GitHub
          </a>
          <a className="hover:text-foreground" href="#" onClick={(event) => event.preventDefault()}>
            Contact
          </a>
        </footer>
      </main>
    </div>
  );
};

export default Landing;
