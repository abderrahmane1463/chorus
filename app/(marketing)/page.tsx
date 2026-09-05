import Link from 'next/link';
import {
  BarChart3,
  Cloud,
  LineChart,
  MessageSquare,
  Star,
  Trophy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HeroPreview } from '@/components/marketing/hero-preview';

const features = [
  {
    icon: BarChart3,
    title: 'Live polls',
    body: 'Multiple choice, ranking and open text. Results build on screen as people answer.',
  },
  {
    icon: MessageSquare,
    title: 'Q&A with upvotes',
    body: 'The room decides what gets asked. Best questions rise, and you moderate before they appear.',
  },
  {
    icon: Trophy,
    title: 'Quizzes',
    body: 'Timed questions, points for speed, and a leaderboard that lands at the end.',
  },
  {
    icon: Cloud,
    title: 'Word clouds',
    body: 'Short answers cluster into a cloud that grows with every submission.',
  },
  {
    icon: Star,
    title: 'Ratings',
    body: 'Ask for a number from 1 to 10 and see the distribution, not just the average.',
  },
  {
    icon: LineChart,
    title: 'Analytics',
    body: 'Participation, response counts and per-question breakdowns after the room empties.',
  },
];

const steps = [
  {
    step: '01',
    title: 'Create your event',
    body: 'Add polls, a Q&A or a quiz in a couple of minutes.',
  },
  {
    step: '02',
    title: 'Share the code',
    body: 'Put the short code on screen. People join from any browser.',
  },
  {
    step: '03',
    title: 'Open an interaction',
    body: 'Push one question at a time to everyone in the room.',
  },
  {
    step: '04',
    title: 'Watch it land',
    body: 'Answers appear as they arrive, on your screen and the projector.',
  },
];

const useCases = [
  {
    title: 'All-hands and team meetings',
    body: 'Take the temperature of the room before the discussion, not after it.',
  },
  {
    title: 'Conferences and keynotes',
    body: 'Let a thousand people ask questions without a microphone queue.',
  },
  {
    title: 'Classes and training',
    body: 'Check understanding mid-lesson with a quiz that scores itself.',
  },
  {
    title: 'Workshops and webinars',
    body: 'Keep remote attendees answering instead of quietly leaving.',
  },
];

const promises = [
  {
    title: 'No account for participants',
    body: 'They open a link and answer. That is the whole flow.',
  },
  {
    title: 'Works on any phone',
    body: 'A browser is the only requirement, on any network.',
  },
  {
    title: 'Results as they arrive',
    body: 'Every answer updates the screen the moment it lands.',
  },
];

export default function LandingPage() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-5 pb-16 pt-16 sm:pt-24">
        <div className="max-w-2xl">
          <h1 className="text-4xl font-semibold leading-[1.1] sm:text-5xl lg:text-6xl">
            Your audience has more to say than the loudest person in the room.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            Chorus turns any meeting, class or conference into a two-way
            conversation with live polls, upvoted Q&amp;A and quizzes. Your
            audience joins with a short code, with no account and no download.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link href="/sign-up">Get started free</Link>
            </Button>
            <Button size="lg" variant="secondary" asChild>
              <Link href="/join">Join an event</Link>
            </Button>
          </div>
        </div>

        <div className="mt-14">
          <HeroPreview />
        </div>
      </section>

      <section className="border-y border-border bg-subtle">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 sm:grid-cols-3">
          {promises.map((promise) => (
            <div key={promise.title}>
              <p className="font-medium">{promise.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{promise.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="product" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20">
        <h2 className="max-w-lg text-3xl font-semibold sm:text-4xl">
          Six ways to hear from a room
        </h2>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Mix them in a single event and move between them as the session goes.
        </p>

        <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.title} className="bg-card p-6">
              <feature.icon className="size-5 text-primary" aria-hidden />
              <h3 className="mt-3 font-semibold">{feature.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {feature.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-border bg-subtle">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="text-3xl font-semibold sm:text-4xl">How it works</h2>
          <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step) => (
              <li key={step.step}>
                <span className="font-mono text-sm text-accent">{step.step}</span>
                <h3 className="mt-2 font-semibold">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="use-cases" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20">
        <h2 className="text-3xl font-semibold sm:text-4xl">
          Built for rooms that go quiet
        </h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {useCases.map((useCase) => (
            <div key={useCase.title} className="rounded-lg border border-border p-6">
              <h3 className="font-semibold">{useCase.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {useCase.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="scroll-mt-20 border-t border-border bg-subtle">
        <div className="mx-auto max-w-3xl px-5 py-20 text-center">
          <h2 className="text-3xl font-semibold sm:text-4xl">
            Free while it is yours
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
            This is a self-hosted Chorus instance. Unlimited events, unlimited
            participants, every interaction type. The only limit is your database.
          </p>
          <div className="mt-8">
            <Button size="lg" asChild>
              <Link href="/sign-up">Create your first event</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
