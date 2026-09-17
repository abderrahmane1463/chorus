import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { connection } from 'next/server';

export const metadata: Metadata = {
  title: 'Privacy policy',
  description: 'What Chorus stores about hosts and participants, and why.',
};

const LAST_UPDATED = '17 September 2026';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-3 space-y-3 text-muted-foreground">{children}</div>
    </section>
  );
}

/**
 * Written against the schema, not a template: every claim here should stay
 * true of what the database and cookies actually hold. Update it alongside any
 * change to what Chorus collects.
 */
export default async function PrivacyPage() {
  // The contact address is deployment configuration, so read it per request
  // rather than from the build, which has no environment.
  await connection();
  const contact = process.env.PRIVACY_CONTACT_EMAIL;

  return (
    <article className="mx-auto max-w-2xl px-5 py-16 sm:py-24">
      <h1 className="text-4xl font-semibold">Privacy policy</h1>
      <p className="mt-3 text-sm text-muted-foreground">Last updated {LAST_UPDATED}</p>

      <p className="mt-8 text-lg text-muted-foreground">
        Chorus runs live polls, Q&amp;A and quizzes. This page explains what it
        stores about the people who host events and the people who take part,
        and what it does not.
      </p>

      <Section title="If you host events">
        <p>
          To give you an account, Chorus stores your <strong>name</strong> and{' '}
          <strong>email address</strong>.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            If you sign up with a password, it is stored only as a one-way
            hash. Nobody, including us, can read your password.
          </li>
          <li>
            If you sign in with Google, Google shares your name, email address
            and profile picture link with Chorus, along with the sign-in tokens
            it issues. Chorus does not ask for access to your Gmail, contacts,
            calendar or files.
          </li>
        </ul>
        <p>
          Chorus also stores what you create: your events, their questions and
          settings, and the responses they collect.
        </p>
      </Section>

      <Section title="If you join an event">
        <p>
          You do not need an account. When you join, Chorus gives your browser
          a random, anonymous identifier so it can tell your answers apart from
          everyone else&apos;s and stop duplicate votes. It is not linked to
          your name, email or device.
        </p>
        <p>Chorus stores:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>a display name, only if you choose to enter one</li>
          <li>your answers to polls, ratings, rankings, word clouds and surveys</li>
          <li>questions you ask and questions you upvote</li>
          <li>your quiz answers and score</li>
        </ul>
        <p>
          The host of the event can see all of this, and can export it. If you
          ask a question anonymously, your name is hidden from the host and
          everyone else.
        </p>
      </Section>

      <Section title="Cookies">
        <p>Chorus sets only the cookies it needs to work:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>a sign-in cookie that keeps hosts logged in</li>
          <li>
            a participant cookie holding your anonymous identifier, which lasts
            30 days
          </li>
        </ul>
        <p>
          There are no advertising cookies, no third-party analytics and no
          tracking across other websites.
        </p>
      </Section>

      <Section title="What Chorus does not do">
        <ul className="list-disc space-y-2 pl-5">
          <li>It does not sell or rent your data.</li>
          <li>It does not show advertising.</li>
          <li>It does not store your IP address in its database.</li>
        </ul>
      </Section>

      <Section title="Where your data is kept">
        <p>
          The database is hosted by Neon, in the European Union (Frankfurt,
          Germany). The application runs on our own web hosting. Like almost
          every web server, it may keep short-lived technical logs of requests,
          such as IP address and browser type, to keep the service running and
          secure.
        </p>
        <p>
          We share data only with these providers, and with Google when you
          choose to sign in with it, and only as needed to run Chorus.
        </p>
      </Section>

      <Section title="How long it is kept">
        <p>
          Event data stays until the host deletes the event. Deleting an event
          permanently removes its participants, answers and questions. Account
          data stays until the account is deleted.
        </p>
      </Section>

      <Section title="Your choices">
        <p>
          You can ask to see the data held about you, to correct it, or to have
          your account and everything in it deleted.
          {contact ? (
            <>
              {' '}
              Email{' '}
              <a href={`mailto:${contact}`} className="text-primary hover:underline">
                {contact}
              </a>{' '}
              and we will reply within 30 days.
            </>
          ) : (
            ' Contact the organisation running this Chorus site.'
          )}
        </p>
        <p>
          If you signed in with Google, you can also remove Chorus&apos;s access
          at any time from your Google Account, under Security, then
          Third-party apps and services.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          If this policy changes, the date at the top will change with it.
        </p>
      </Section>
    </article>
  );
}
