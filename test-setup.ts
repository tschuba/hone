import { IDBKeyRange, indexedDB } from "fake-indexeddb";

// Dexie reads `globalThis.indexedDB`/`IDBKeyRange` once at module load time.
// `bun test` runs the whole workspace in a single process, so whichever test
// file imports Dexie first determines the captured value for the rest of the
// run. Setting these globals in a preload script (run before any test file
// is loaded) guarantees Dexie always sees fake-indexeddb, regardless of file
// load order.
globalThis.indexedDB = indexedDB;
globalThis.IDBKeyRange = IDBKeyRange;
