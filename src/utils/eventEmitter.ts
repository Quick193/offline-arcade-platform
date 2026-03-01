export type Listener<T> = (payload: T) => void;

export class EventEmitter<TEvents extends Record<string, unknown>> {
  private listeners = new Map<keyof TEvents, Set<Listener<any>>>();

  on<TKey extends keyof TEvents>(event: TKey, listener: Listener<TEvents[TKey]>): () => void {
    const set = this.listeners.get(event) ?? new Set();
    set.add(listener as Listener<any>);
    this.listeners.set(event, set);
    return () => this.off(event, listener);
  }

  off<TKey extends keyof TEvents>(event: TKey, listener: Listener<TEvents[TKey]>): void {
    this.listeners.get(event)?.delete(listener as Listener<any>);
  }

  emit<TKey extends keyof TEvents>(event: TKey, payload: TEvents[TKey]): void {
    this.listeners.get(event)?.forEach((listener) => listener(payload));
  }
}
