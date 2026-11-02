/**
 * How an event treats its audience, beyond how it looks. Stored as JSONB on
 * the event; an event with none behaves as Chorus always has.
 */
export type EventSettings = {
  /**
   * Visitors accept a statement before joining: that what they send may be
   * shown and kept. Off unless the host turns it on.
   */
  consent?: {
    enabled: boolean;
    /** The host's own wording, or null for Chorus's. */
    text: string | null;
  };
};
