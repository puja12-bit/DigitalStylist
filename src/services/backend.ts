import { User, UserProfile, WardrobeItem, HistoryEntry, AppState } from '../types';

const DB_NAME = 'StyleConfidentDB';
const DB_VERSION = 1;

interface BackendService {
  init: () => Promise<void>;
  auth: {
    login: (email: string, name: string) => Promise<User>;
    logout: () => Promise<void>;
    getCurrentUser: () => Promise<User | null>;
  };
  user: {
    getProfile: (userId: string) => Promise<UserProfile | null>;
    updateProfile: (userId: string, profile: UserProfile) => Promise<void>;
  };
  wardrobe: {
    getAll: (userId: string) => Promise<WardrobeItem[]>;
    sync: (userId: string, items: WardrobeItem[]) => Promise<void>;
  };
  history: {
    getAll: (userId: string) => Promise<HistoryEntry[]>;
    add: (userId: string, entry: HistoryEntry) => Promise<void>;
    clear: (userId: string) => Promise<void>;
  };
}

// IndexedDB Helper Wrapper
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          
          // Users Store
          if (!db.objectStoreNames.contains('users')) {
            db.createObjectStore('users', { keyPath: 'id' });
          }
          
          // Profiles Store
          if (!db.objectStoreNames.contains('profiles')) {
            db.createObjectStore('profiles', { keyPath: 'userId' });
          }

          // Wardrobe Store
          if (!db.objectStoreNames.contains('wardrobe')) {
            const store = db.createObjectStore('wardrobe', { keyPath: 'id' });
            store.createIndex('userId', 'userId', { unique: false });
          }

          // History Store
          if (!db.objectStoreNames.contains('history')) {
            const store = db.createObjectStore('history', { keyPath: 'id' });
            store.createIndex('userId', 'userId', { unique: false });
          }
        };
    } catch (e) {
        reject(e);
    }
  });
};

// Generic Transaction Helper
const performTransaction = <T>(
  storeName: string,
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest | void
): Promise<T> => {
  return openDB().then(db => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      let request: IDBRequest | void;

      try {
        request = callback(store);
      } catch (e) {
        reject(e);
        return;
      }

      transaction.oncomplete = () => {
        resolve((request as IDBRequest)?.result as T);
      };
      transaction.onerror = () => reject(transaction.error);
    });
  });
};

export const backend: BackendService = {
  init: async () => {
    try {
      await openDB();
      console.log("Backend Service Initialized (IndexedDB)");
    } catch (e) {
      console.error("Failed to init DB - App will run in degraded mode (no persistence)", e);
    }
  },

  auth: {
    login: async (email: string, name: string) => {
      const id = email.toLowerCase();
      const user: User = { id, email, name, joinedAt: Date.now() };
      
      // Try to save user record, but don't crash if DB fails
      try {
        await performTransaction('users', 'readwrite', (store) => store.put(user));
      } catch(e) { console.warn("DB Save Failed", e) }
      
      // Persist session in local storage at minimum
      localStorage.setItem('styleConfident_userId', id);
      return user;
    },
    
    logout: async () => {
      localStorage.removeItem('styleConfident_userId');
    },

    getCurrentUser: async () => {
      const id = localStorage.getItem('styleConfident_userId');
      if (!id) return null;
      
      try {
        return await performTransaction<User>('users', 'readonly', (store) => store.get(id));
      } catch (e) {
          // Fallback if DB is broken but LocalStorage has ID
          return { id, email: id, name: 'User', joinedAt: Date.now() };
      }
    }
  },

  user: {
    getProfile: async (userId: string) => {
      try {
        const result = await performTransaction<{ userId: string, profile: UserProfile }>('profiles', 'readonly', (store) => store.get(userId));
        return result?.profile || null;
      } catch (e) { return null; }
    },

    updateProfile: async (userId: string, profile: UserProfile) => {
      try {
        await performTransaction('profiles', 'readwrite', (store) => store.put({ userId, profile }));
      } catch(e) { console.warn("Profile save failed", e); }
    }
  },

  wardrobe: {
    getAll: async (userId: string) => {
      try {
        return await openDB().then(db => {
            return new Promise((resolve, reject) => {
            const transaction = db.transaction('wardrobe', 'readonly');
            const store = transaction.objectStore('wardrobe');
            const index = store.index('userId');
            const request = index.getAll(userId);

            request.onsuccess = () => resolve(request.result as WardrobeItem[]);
            request.onerror = () => reject(request.error);
            });
        });
      } catch(e) { return []; }
    },

    sync: async (userId: string, items: WardrobeItem[]) => {
      try {
          const taggedItems = items.map(item => ({ ...item, userId }));
          
          const db = await openDB();
          const transaction = db.transaction('wardrobe', 'readwrite');
          const store = transaction.objectStore('wardrobe');

          const index = store.index('userId');
          const existingRequest = index.getAllKeys(userId);
          
          existingRequest.onsuccess = () => {
            const existingKeys = existingRequest.result as string[];
            existingKeys.forEach(key => store.delete(key));
            taggedItems.forEach(item => store.put(item));
          };
          
          return new Promise((resolve, reject) => {
              transaction.oncomplete = () => resolve();
              transaction.onerror = () => reject(transaction.error);
          });
      } catch(e) { console.warn("Wardrobe sync failed", e); }
    }
  },

  history: {
    getAll: async (userId: string) => {
      try {
        return await openDB().then(db => {
            return new Promise((resolve, reject) => {
            const transaction = db.transaction('history', 'readonly');
            const store = transaction.objectStore('history');
            const index = store.index('userId');
            const request = index.getAll(userId);
            
            request.onsuccess = () => resolve(request.result as HistoryEntry[]);
            request.onerror = () => reject(request.error);
            });
        });
      } catch(e) { return []; }
    },

    add: async (userId: string, entry: HistoryEntry) => {
      try {
        const taggedEntry = { ...entry, userId };
        await performTransaction('history', 'readwrite', (store) => store.put(taggedEntry));
      } catch(e) { console.warn("History save failed", e); }
    },

    clear: async (userId: string) => {
       try {
        const db = await openDB();
        const transaction = db.transaction('history', 'readwrite');
        const store = transaction.objectStore('history');
        const index = store.index('userId');
        
        const request = index.getAllKeys(userId);
        request.onsuccess = () => {
            const keys = request.result as string[];
            keys.forEach(key => store.delete(key));
        };
        
        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
       } catch(e) { console.warn("History clear failed", e); }
    }
  }
};