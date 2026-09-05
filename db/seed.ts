import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  events,
  interactionOptions,
  interactions,
  users,
} from '@/db/schema';
import { hashPassword } from '@/lib/auth/password';

const DEMO_EMAIL = 'demo@chorus.test';
const DEMO_PASSWORD = 'chorus1234';
const EVENT_CODE = 'MARKETING26';

type OptionSeed = { text: string; isCorrect?: boolean };

async function addInteraction(
  eventId: string,
  position: number,
  input: {
    type: string;
    title: string;
    settings?: Record<string, unknown>;
    options?: OptionSeed[];
    parentId?: string;
  },
) {
  const [created] = await db
    .insert(interactions)
    .values({
      eventId,
      parentId: input.parentId,
      type: input.type as 'multiple_choice',
      title: input.title,
      position,
      settings: input.settings ?? {},
    })
    .returning({ id: interactions.id });

  if (input.options) {
    await db.insert(interactionOptions).values(
      input.options.map((option, index) => ({
        interactionId: created.id,
        text: option.text,
        position: index,
        isCorrect: option.isCorrect ?? null,
      })),
    );
  }

  return created.id;
}

async function main() {
  console.log('Seeding demo data…');

  // Re-running the seed replaces the demo event rather than duplicating it.
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, DEMO_EMAIL))
    .limit(1);

  let userId = existingUser?.id;

  if (userId) {
    await db.delete(events).where(eq(events.eventCode, EVENT_CODE));
    console.log('  removed previous demo event');
  } else {
    const [created] = await db
      .insert(users)
      .values({
        name: 'Demo Host',
        email: DEMO_EMAIL,
        passwordHash: await hashPassword(DEMO_PASSWORD),
      })
      .returning({ id: users.id });
    userId = created.id;
    console.log('  created demo user');
  }

  const [event] = await db
    .insert(events)
    .values({
      ownerId: userId,
      title: 'Digital Marketing Workshop',
      description: 'A hands-on session on paid acquisition and measurement.',
      eventCode: EVENT_CODE,
      status: 'live',
    })
    .returning({ id: events.id });

  await addInteraction(event.id, 0, {
    type: 'multiple_choice',
    title: 'What is your primary advertising platform?',
    settings: { allowChangeAnswer: true, showResultsToParticipants: true },
    options: [
      { text: 'Meta Ads' },
      { text: 'Google Ads' },
      { text: 'TikTok Ads' },
      { text: 'LinkedIn Ads' },
    ],
  });

  await addInteraction(event.id, 1, {
    type: 'word_cloud',
    title: 'Describe your ideal marketing campaign in one word',
    settings: { maxEntriesPerParticipant: 2, showResultsToParticipants: true },
  });

  await addInteraction(event.id, 2, {
    type: 'rating',
    title: 'How confident are you with Meta Ads?',
    settings: {
      scaleMin: 1,
      scaleMax: 10,
      minLabel: 'Not at all',
      maxLabel: 'Very confident',
      showResultsToParticipants: true,
    },
  });

  await addInteraction(event.id, 3, {
    type: 'q_and_a',
    title: 'Ask the speaker anything about digital marketing',
    settings: { allowAnonymous: true, moderationEnabled: false, allowUpvotes: true },
  });

  const quizId = await addInteraction(event.id, 4, {
    type: 'quiz',
    title: 'Meta Ads Basics',
    settings: {},
  });

  const quizQuestions = [
    {
      title: 'Which campaign objective optimises for purchases?',
      options: [
        { text: 'Sales', isCorrect: true },
        { text: 'Reach', isCorrect: false },
        { text: 'Brand awareness', isCorrect: false },
      ],
      explanation: 'Sales campaigns optimise towards conversion events like purchases.',
    },
    {
      title: 'What does CPM stand for?',
      options: [
        { text: 'Cost per mille (thousand impressions)', isCorrect: true },
        { text: 'Clicks per minute', isCorrect: false },
        { text: 'Cost per message', isCorrect: false },
      ],
      explanation: 'CPM is the cost of one thousand impressions.',
    },
    {
      title: 'Which of these is a retargeting audience?',
      options: [
        { text: 'People who visited your website in the last 30 days', isCorrect: true },
        { text: 'A lookalike of your customer list', isCorrect: false },
        { text: 'Broad interest targeting', isCorrect: false },
      ],
      explanation: 'Retargeting reaches people who already interacted with you.',
    },
  ];

  for (const [index, question] of quizQuestions.entries()) {
    await addInteraction(event.id, index, {
      parentId: quizId,
      type: 'multiple_choice',
      title: question.title,
      settings: {
        timeLimitSeconds: 25,
        points: 1000,
        speedBonus: true,
        explanation: question.explanation,
      },
      options: question.options,
    });
  }

  console.log('\nDone.');
  console.log(`  Host:  ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`  Event: Digital Marketing Workshop`);
  console.log(`  Code:  ${EVENT_CODE}`);
  console.log('\nOpen a second browser (or a private window) and join with that code.');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
