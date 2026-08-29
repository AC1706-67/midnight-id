// SPDX-License-Identifier: Apache-2.0

/**
 * MANO credential API.
 *
 * Three roles, three entry points:
 *   ManoIssuerAPI      - deploy, enroll (persistent issuer private state)
 *   ManoParticipantAPI - join, checkIn, verifyCredential (ephemeral state)
 *   Verifier           - read-only; use deriveManoPublicState with a
 *                        publicDataProvider, no wallet or proof server
 *
 * @packageDocumentation
 */

export * from './types.js';
export * from './common-types.js';
export * from './compiled.js';
export * from './ephemeral-private-state-provider.js';
export * from './issuer-api.js';
export * from './participant-api.js';

export * as utils from './utils/index.js';
