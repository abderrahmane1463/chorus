/**
 * Interactions open in a lobby.
 *
 * Put live, an interaction first gathers the room: the big screen shows how
 * to join and who has, and phones wait without the question. It reaches
 * phones only when the host starts it, so nobody answers before the room is
 * in and looking at the screen.
 *
 * A quiz has a lobby of its own, run by its own steps (see `lib/quiz/flow`),
 * so it is not counted here. Only a standalone interaction goes live: a
 * survey's own questions never do, and the survey is what opens.
 */
export function opensInLobby(type: string): boolean {
  return type !== 'quiz';
}

/** Live but not started yet: the room is gathering. */
export function inLobby(interaction: {
  type: string;
  status: string;
  startedAt: Date | null;
}): boolean {
  return (
    opensInLobby(interaction.type) &&
    interaction.status === 'active' &&
    interaction.startedAt === null
  );
}
