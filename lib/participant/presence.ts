/**
 * Who counts as being in the room.
 *
 * Everyone who ever joined an event is not the room: phones are locked,
 * people leave, and an event is reused from one session to the next. A
 * quiz that waited for all of them would never see "everyone has answered",
 * and its lobby would list people from last week. So a phone says it is
 * still here every so often, and only phones heard from recently count.
 *
 * Shared by the phone, which sends the signal, and the server, which reads
 * it, so the two cannot drift apart.
 */

/** How often an open, visible participant page says it is still here. */
export const HEARTBEAT_SECONDS = 30;

/**
 * How long after its last signal a phone still counts as present: three
 * missed heartbeats, so one slow request or a brief network drop does not
 * take a player out of the room.
 */
export const PRESENCE_WINDOW_SECONDS = 90;
