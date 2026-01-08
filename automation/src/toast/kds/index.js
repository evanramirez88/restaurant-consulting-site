/**
 * Toast KDS (Kitchen Display System) Operations
 *
 * Centralized exports for all KDS-related automation functions.
 */

export { createStation, updateStation, deleteStation, bulkCreateStations } from './createStation.js';
export { configureRouting, addItemToStation, removeItemFromStation, applyKDSTemplate, getStationRouting } from './configureRouting.js';
export { navigateToKDSConfig, getKDSStructure, findStation } from './navigation.js';
