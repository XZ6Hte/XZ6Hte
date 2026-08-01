/**
 * src/plugins/db-plugin.js — Default storage plugin (SQLite via db.js)
 *
 * Wraps the db.js module as an IStoragePlugin so it can be registered
 * with the plugin registry. Swap this file with any alternative
 * IStoragePlugin implementation to replace the persistence layer.
 */

import {
  createParty,
  getPartyById,
  updateParty,
  deleteParty,
  queryParties,
  createContract,
  getContractById,
  updateContract,
  deleteContract,
  queryContracts,
} from '../db.js';

/** @type {import('./interfaces.js').IStoragePlugin} */
export const dbPlugin = {
  createParty,
  getPartyById,
  updateParty,
  deleteParty,
  queryParties,
  createContract,
  getContractById,
  updateContract,
  deleteContract,
  queryContracts,
};
