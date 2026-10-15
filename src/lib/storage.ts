function wrap(get: () => Storage) {
  return {
    get(key: string): string | null {
      try { return get().getItem(key); } catch { return null; }
    },
    set(key: string, value: string) {
      try { get().setItem(key, value); } catch { /* storage yo'q */ }
    },
    remove(key: string) {
      try { get().removeItem(key); } catch { /* storage yo'q */ }
    },
  };
}

export const local = wrap(() => window.localStorage);
export const session = wrap(() => window.sessionStorage);
