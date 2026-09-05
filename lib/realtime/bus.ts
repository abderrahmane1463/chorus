import type { RealtimeMessage } from './events';

type Subscriber = (message: RealtimeMessage) => void;

/**
 * In-process fan-out used when no Pusher credentials are configured.
 *
 * This is genuine server push (subscribers are invoked the moment a message is
 * published, and delivered over SSE) but it only reaches clients connected to
 * the *same* Node process. That covers local development and any single-node
 * deployment. Multi-instance serverless needs Pusher — see lib/realtime/server.
 */
class RealtimeBus {
  private channels = new Map<string, Set<Subscriber>>();

  subscribe(channel: string, subscriber: Subscriber): () => void {
    let set = this.channels.get(channel);
    if (!set) {
      set = new Set();
      this.channels.set(channel, set);
    }
    set.add(subscriber);

    return () => {
      set!.delete(subscriber);
      if (set!.size === 0) this.channels.delete(channel);
    };
  }

  publish(channel: string, message: RealtimeMessage): void {
    const set = this.channels.get(channel);
    if (!set) return;
    for (const subscriber of set) {
      try {
        subscriber(message);
      } catch {
        // A broken subscriber must not stop delivery to the others.
      }
    }
  }
}

// Survives hot reloads in development, which would otherwise orphan listeners.
const globalRef = globalThis as unknown as { __realtimeBus?: RealtimeBus };
export const bus = globalRef.__realtimeBus ?? new RealtimeBus();
globalRef.__realtimeBus = bus;
