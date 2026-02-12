import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Bot, Link2, ShieldCheck, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion.tsx";
import RevealSection from "@/components/marketing/RevealSection.tsx";
import { TELEGRAM_LOGIN_DEEP_LINK, TELEGRAM_LOGIN_HTTP_URL } from "@/lib/telegramLinks.ts";

const Guide: React.FC = () => {
  return (
    <div className="marketing-root min-h-screen">
      <div className="marketing-vignette pointer-events-none absolute inset-0" />

      <main className="relative mx-auto max-w-[980px] px-6 pb-28 pt-10 sm:px-10 sm:pb-36 sm:pt-12">
        <header className="flex items-center justify-between">
          <p className="marketing-text-primary text-sm font-medium tracking-tight">TaskFlow</p>
          <div className="flex items-center gap-4 text-sm">
            <Link className="marketing-text-secondary transition-opacity hover:opacity-70" to="/landing">
              Landing
            </Link>
            <Link className="marketing-text-secondary transition-opacity hover:opacity-70" to="/features">
              Features
            </Link>
          </div>
        </header>

        <RevealSection className="pt-16 text-center sm:pt-20" delayMs={40}>
          <h1 className="marketing-text-primary mx-auto max-w-3xl text-5xl font-semibold tracking-[-0.034em] sm:text-6xl lg:leading-[1.04]">
            Sign in with Telegram in seconds
          </h1>
          <p className="marketing-text-secondary mx-auto mt-5 max-w-[64ch] text-base sm:text-lg">
            Open the bot, press Start, then enter via one-time secure link.
          </p>
        </RevealSection>

        <RevealSection className="mt-16 space-y-4 sm:mt-20" delayMs={80}>
          <div className="marketing-surface-1 flex items-start gap-4 rounded-xl px-5 py-6 sm:px-6">
            <div className="marketing-chip rounded-full p-2.5">
              <Bot className="marketing-text-secondary h-4 w-4" />
            </div>
            <div>
              <p className="marketing-text-secondary text-xs uppercase tracking-[0.14em]">Step 1</p>
              <p className="marketing-text-primary mt-1 text-lg font-medium">Open bot</p>
              <p className="marketing-text-secondary mt-1.5 text-sm">Tap Continue with Telegram to open @taskFlowelite_bot.</p>
            </div>
          </div>

          <div className="marketing-surface-1 flex items-start gap-4 rounded-xl px-5 py-6 sm:px-6">
            <div className="marketing-chip rounded-full p-2.5">
              <Smartphone className="marketing-text-secondary h-4 w-4" />
            </div>
            <div>
              <p className="marketing-text-secondary text-xs uppercase tracking-[0.14em]">Step 2</p>
              <p className="marketing-text-primary mt-1 text-lg font-medium">Press Start</p>
              <p className="marketing-text-secondary mt-1.5 text-sm">The bot prepares your one-time login link instantly.</p>
            </div>
          </div>

          <div className="marketing-surface-1 flex items-start gap-4 rounded-xl px-5 py-6 sm:px-6">
            <div className="marketing-chip rounded-full p-2.5">
              <Link2 className="marketing-text-secondary h-4 w-4" />
            </div>
            <div>
              <p className="marketing-text-secondary text-xs uppercase tracking-[0.14em]">Step 3</p>
              <p className="marketing-text-primary mt-1 text-lg font-medium">Tap secure link</p>
              <p className="marketing-text-secondary mt-1.5 text-sm">Use the one-time URL and go straight to your dashboard.</p>
            </div>
          </div>
        </RevealSection>

        <RevealSection className="marketing-surface-2 mt-10 rounded-xl px-5 py-4 sm:px-6" delayMs={110}>
          <div className="flex items-start gap-3">
            <ShieldCheck className="marketing-text-secondary mt-0.5 h-4 w-4" />
            <p className="marketing-text-secondary text-sm">
              Security note: login token is one-time, short-lived, and hashed before storage.
            </p>
          </div>
        </RevealSection>

        <RevealSection className="mt-10 sm:mt-12" delayMs={135}>
          <p className="marketing-text-secondary text-xs uppercase tracking-[0.14em]">Troubleshooting</p>
          <Accordion type="single" collapsible className="marketing-divider mt-4 border-t border-b">
            <AccordionItem value="expired" className="border-b-0">
              <AccordionTrigger className="marketing-text-primary py-4 text-sm hover:no-underline">
                Link expired
              </AccordionTrigger>
              <AccordionContent className="marketing-text-secondary text-sm">
                Request a fresh link from the bot. Magic links have short TTL by design.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="used" className="border-b-0">
              <AccordionTrigger className="marketing-text-primary py-4 text-sm hover:no-underline">
                Link already used
              </AccordionTrigger>
              <AccordionContent className="marketing-text-secondary text-sm">
                Each link is single-use. Open the bot again and request a new one.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="localhost" className="border-b-0">
              <AccordionTrigger className="marketing-text-primary py-4 text-sm hover:no-underline">
                Why Telegram can&apos;t open localhost
              </AccordionTrigger>
              <AccordionContent className="marketing-text-secondary text-sm">
                Telegram app cannot open your local machine URL from mobile network context. Use a reachable frontend domain.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </RevealSection>

        <RevealSection className="mt-10 flex flex-wrap items-center gap-3" delayMs={160}>
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

        <RevealSection className="mt-6 flex flex-wrap items-center gap-4 text-sm" delayMs={185}>
          <a className="marketing-text-secondary underline underline-offset-4 transition-opacity hover:opacity-70" href={TELEGRAM_LOGIN_DEEP_LINK}>
            Open Telegram app directly
          </a>
          <Link className="marketing-text-secondary underline underline-offset-4 transition-opacity hover:opacity-70" to="/features">
            Explore all features
          </Link>
        </RevealSection>
      </main>
    </div>
  );
};

export default Guide;
