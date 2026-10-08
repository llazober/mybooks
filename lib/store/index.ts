// Store factory. Selects the Blob store when a Blob token is configured
// (production on Vercel), otherwise the filesystem store (local dev).
//
// Server actions import the named functions below, so the backend choice is
// invisible to callers.

import { LedgerStore } from "./types";
import { pgStore } from "./pg";

export * from "./types";

const store = pgStore;

export const listEntities = () => store.listEntities();
export const loadEntity = (id: string) => store.loadEntity(id);
export const saveEntity = (id: string, beancount: string) =>
  store.saveEntity(id, beancount);
export const createEntity = (id: string, name: string) =>
  store.createEntity(id, name);
export const deleteEntityFromStore = (id: string) => store.deleteEntity(id);
