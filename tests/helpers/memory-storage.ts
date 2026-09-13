/**
 * Installs an in-memory stand-in for `window.localStorage`, so the storage
 * module can be exercised under Node. Import this for its side effect BEFORE
 * importing anything that touches storage.
 */
class MemoryStorage {
  private map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }
}

export const storage = new MemoryStorage();

(globalThis as unknown as { window: { localStorage: MemoryStorage } }).window = {
  localStorage: storage,
};
