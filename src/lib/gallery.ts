/** 詠んだ作品を端末内（IndexedDB）に残す。サーバーには送らない */

export type Work = {
  id: string;
  createdAt: number;
  lines: string[];
  kigo: string;
  note: string;
  image: Blob;
};

const DB_NAME = "kokode-ikku";
const STORE = "works";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" }).createIndex("createdAt", "createdAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    t.oncomplete = () => db.close();
  });
}

export async function saveWork(work: Work): Promise<void> {
  try {
    await tx("readwrite", (s) => s.put(work));
  } catch {
    /* 保存できない環境（プライベートブラウズなど）では残さない */
  }
}

export async function listWorks(): Promise<Work[]> {
  try {
    const all = await tx<Work[]>("readonly", (s) => s.getAll());
    return all.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export async function deleteWork(id: string): Promise<void> {
  try {
    await tx("readwrite", (s) => s.delete(id));
  } catch {
    /* 失敗しても一覧の表示には影響しない */
  }
}

export async function clearWorks(): Promise<void> {
  try {
    await tx("readwrite", (s) => s.clear());
  } catch {
    /* 同上 */
  }
}

export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
