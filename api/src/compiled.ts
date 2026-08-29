// SPDX-License-Identifier: Apache-2.0

/**
 * Per-role compiled contracts.
 *
 * The Compact-generated Contract is generic over private state, so the
 * same compiled artifact is instantiated twice with different witness
 * objects. An issuer build physically cannot supply a participant
 * secret, and a participant build cannot supply the issuer key -
 * cross-role witnesses throw (see ./types.ts).
 *
 * The compiled assets path is resolved at runtime against the base path
 * given to the ZK config provider, not against this module.
 *
 * @module
 */

import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import * as Mano from '../../contract/src/managed/bboard/contract/index.js';
import {
  issuerWitnesses,
  participantWitnesses,
  type IssuerPrivateState,
  type ParticipantPrivateState,
} from './types.js';

const COMPILED_ASSETS_PATH = './managed/bboard';

export const IssuerCompiledContract = CompiledContract.make<
  Mano.Contract<IssuerPrivateState>
>('ManoIssuer', Mano.Contract<IssuerPrivateState>).pipe(
  CompiledContract.withWitnesses(issuerWitnesses),
  CompiledContract.withCompiledFileAssets(COMPILED_ASSETS_PATH),
);

export const ParticipantCompiledContract = CompiledContract.make<
  Mano.Contract<ParticipantPrivateState>
>('ManoParticipant', Mano.Contract<ParticipantPrivateState>).pipe(
  CompiledContract.withWitnesses(participantWitnesses),
  CompiledContract.withCompiledFileAssets(COMPILED_ASSETS_PATH),
);
