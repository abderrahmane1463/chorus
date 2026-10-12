/**
 * Interactions that open in a lobby.
 *
 * Put live, one of these first gathers the room: the big screen shows how to
 * join and who has, and phones wait without the question. It reaches phones
 * only when the host starts it, so nobody answers before the room is in and
 * looking at the screen.
 *
 * Only for a standalone interaction: a survey's own questions are never live
 * by themselves, and the survey is what opens.
 */
export const LOBBY_TYPES = ['multiple_choice'] as const;

export function opensInLobby(type: string): boolean {
  return (LOBBY_TYPES as readonly string[]).includes(type);
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
