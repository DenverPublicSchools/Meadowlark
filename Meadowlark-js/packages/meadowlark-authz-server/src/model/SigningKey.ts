// SPDX-License-Identifier: Apache-2.0
// Licensed to the Ed-Fi Alliance under one or more agreements.
// The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
// See the LICENSE and NOTICES files in the project root for more information.
import memoize from 'fast-memoize';
import { getSigningKey } from '../security/TokenSettings';

function getSigningKeyFromEnvironment(): Buffer {
  const signingKeyEncoded = getSigningKey();
  if (signingKeyEncoded == null) {
    throw new Error('Must have a base-64 encoded signing key. Try creating a new one with `npm run createKey`');
  }
  return Buffer.from(signingKeyEncoded, 'base64');
}

export const signingKey: () => Buffer = memoize(getSigningKeyFromEnvironment);
