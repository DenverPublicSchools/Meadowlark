// SPDX-License-Identifier: Apache-2.0
// Licensed to the Ed-Fi Alliance under one or more agreements.
// The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
// See the LICENSE and NOTICES files in the project root for more information.

import * as MeadowlarkCore from '@edfi/meadowlark-core';
import { newJwtStatus } from '@edfi/meadowlark-core';
import { createClient } from '../../src/handler/CreateClient';
import { CreateAuthorizationClientResult } from '../../src/message/CreateAuthorizationClientResult';
import * as AuthorizationPluginLoader from '../../src/plugin/AuthorizationPluginLoader';
import { AuthorizationRequest, newAuthorizationRequest } from '../../src/handler/AuthorizationRequest';
import { AuthorizationResponse } from '../../src/handler/AuthorizationResponse';
import { NoAuthorizationStorePlugin } from '../../src/plugin/NoAuthorizationStorePlugin';

process.env.ACCESS_TOKEN_REQUIRED = 'false';

const authorizationRequest: AuthorizationRequest = {
  ...newAuthorizationRequest(),
  path: '/oauth/client',
  body: `{
    "clientName": "Hometown SIS",
    "roles": [
      "vendor",
      "assessment"
    ]
  }`,
};

describe('given valid admin user but authorization store is going to fail', () => {
  let response: AuthorizationResponse;
  let mockAuthorizationStore: any;
  let mockMeadowlarkCore: any;

  beforeAll(async () => {
    mockAuthorizationStore = jest.spyOn(AuthorizationPluginLoader, 'getAuthorizationStore').mockReturnValue({
      ...NoAuthorizationStorePlugin,
      createAuthorizationClient: async () =>
        Promise.resolve({
          response: 'UNKNOWN_FAILURE',
        }),
    });

    mockMeadowlarkCore = jest.spyOn(MeadowlarkCore, 'verifyJwt').mockReturnValue({
      ...newJwtStatus(),
      isValid: true,
      roles: ['admin'],
    });

    // Act
    response = await createClient(authorizationRequest);
  });

  afterAll(() => {
    mockAuthorizationStore.mockRestore();
    mockMeadowlarkCore.mockRestore();
  });

  it('returns status 500', () => {
    expect(response.statusCode).toEqual(500);
  });

  it('does not return a message body', () => {
    expect(response.body).toEqual('');
  });
});

describe('given authorization store succeeds on create', () => {
  let response: AuthorizationResponse;
  let mockAuthorizationStore: any;
  let mockMeadowlarkCore: any;

  beforeAll(async () => {
    mockAuthorizationStore = jest.spyOn(AuthorizationPluginLoader, 'getAuthorizationStore').mockReturnValue({
      ...NoAuthorizationStorePlugin,
      createAuthorizationClient: async () =>
        Promise.resolve({
          response: 'CREATE_SUCCESS',
        } as CreateAuthorizationClientResult),
    });

    mockMeadowlarkCore = jest.spyOn(MeadowlarkCore, 'verifyJwt').mockReturnValue({
      ...newJwtStatus(),
      isValid: true,
      roles: ['admin'],
    });

    // Act
    response = await createClient(authorizationRequest);
  });

  afterAll(() => {
    mockAuthorizationStore.mockRestore();
    mockMeadowlarkCore.mockRestore();
  });

  it('returns status 201', () => {
    expect(response.statusCode).toEqual(201);
  });

  it('returns a message body with client name', () => {
    expect(response.body).toMatch(`"clientName":"Hometown SIS"`);
  });

  it('returns a message body with roles', () => {
    expect(response.body).toMatch(`"roles":["vendor","assessment"]`);
  });

  it('returns a message body with client id', () => {
    expect(response.body).toMatch(`"client_id":`);
  });

  it('returns a message body with client secret', () => {
    expect(response.body).toMatch(`"client_secret":`);
  });

  it('it returns location header', () => {
    expect((response.headers as any).Location.startsWith('/oauth/client/')).toBe(true);
  });
});

describe('given missing authorization token', () => {
  let response: AuthorizationResponse;
  let mockMeadowlarkCore: any;

  beforeAll(async () => {
    mockMeadowlarkCore = jest.spyOn(MeadowlarkCore, 'verifyJwt').mockReturnValue({
      ...newJwtStatus(),
      isMissing: true,
    });

    // Act
    response = await createClient(authorizationRequest);
  });

  afterAll(() => {
    mockMeadowlarkCore.mockRestore();
  });

  it('returns error response', () => {
    expect(response).toMatchInlineSnapshot(`
      {
        "body": "{ "error": "invalid_client", "error_description": "Authorization token not provided" }",
        "headers": {
          "WWW-Authenticate": "Bearer",
        },
        "statusCode": 401,
      }
    `);
  });
});

describe('given expired authorization token', () => {
  let response: AuthorizationResponse;
  let mockMeadowlarkCore: any;

  beforeAll(async () => {
    mockMeadowlarkCore = jest.spyOn(MeadowlarkCore, 'verifyJwt').mockReturnValue({
      ...newJwtStatus(),
      isMissing: false,
      isExpired: true,
    });

    // Act
    response = await createClient(authorizationRequest);
  });

  afterAll(() => {
    mockMeadowlarkCore.mockRestore();
  });

  it('returns error response', () => {
    expect(response).toMatchInlineSnapshot(`
      {
        "body": "{ "error": "invalid_token", "error_description": "Token is expired" }",
        "headers": {
          "WWW-Authenticate": "Bearer",
        },
        "statusCode": 401,
      }
    `);
  });
});

describe('given non-admin authorization token', () => {
  let response: AuthorizationResponse;
  let mockMeadowlarkCore: any;

  beforeAll(async () => {
    mockMeadowlarkCore = jest.spyOn(MeadowlarkCore, 'verifyJwt').mockReturnValue({
      ...newJwtStatus(),
      isMissing: false,
      isExpired: false,
      roles: ['vendor'],
    });

    // Act
    response = await createClient(authorizationRequest);
  });

  afterAll(() => {
    mockMeadowlarkCore.mockRestore();
  });

  it('returns error response', () => {
    expect(response.body).toMatchInlineSnapshot(`""`);
  });
});

describe('given invalid authorization token', () => {
  let response: AuthorizationResponse;
  let mockMeadowlarkCore: any;

  beforeAll(async () => {
    mockMeadowlarkCore = jest.spyOn(MeadowlarkCore, 'verifyJwt').mockReturnValue({
      ...newJwtStatus(),
      isMissing: false,
      isExpired: false,
      roles: ['admin'],
      isValid: false,
    });

    // Act
    response = await createClient(authorizationRequest);
  });

  afterAll(() => {
    mockMeadowlarkCore.mockRestore();
  });

  it('returns error response', () => {
    expect(response.body).toMatchInlineSnapshot(
      `"{ "error": "invalid_token", "error_description": "Invalid authorization token" }"`,
    );
  });
});

describe('given create has missing body', () => {
  const missingBodyRequest: AuthorizationRequest = {
    ...newAuthorizationRequest(),
    path: '/oauth/client',
  };

  let response: AuthorizationResponse;
  let mockAuthorizationStore: any;
  let mockMeadowlarkCore: any;

  beforeAll(async () => {
    mockAuthorizationStore = jest.spyOn(AuthorizationPluginLoader, 'getAuthorizationStore').mockReturnValue({
      ...NoAuthorizationStorePlugin,
      createAuthorizationClient: async () =>
        Promise.resolve({
          response: 'CREATE_SUCCESS',
        } as CreateAuthorizationClientResult),
    });

    mockMeadowlarkCore = jest.spyOn(MeadowlarkCore, 'verifyJwt').mockReturnValue({
      ...newJwtStatus(),
      isValid: true,
      roles: ['admin'],
    });

    // Act
    response = await createClient(missingBodyRequest);
  });

  afterAll(() => {
    mockAuthorizationStore.mockRestore();
    mockMeadowlarkCore.mockRestore();
  });

  it('returns status 400', () => {
    expect(response.statusCode).toEqual(400);
  });

  it('returns error response', () => {
    expect(response.body).toMatchInlineSnapshot(`"{"message":"Missing body"}"`);
  });
});

describe('given create has malformed json body', () => {
  const malformedBodyRequest: AuthorizationRequest = {
    ...newAuthorizationRequest(),
    path: '/oauth/client',
    body: '{ bad',
  };

  let response: AuthorizationResponse;
  let mockAuthorizationStore: any;
  let mockMeadowlarkCore: any;

  beforeAll(async () => {
    mockAuthorizationStore = jest.spyOn(AuthorizationPluginLoader, 'getAuthorizationStore').mockReturnValue({
      ...NoAuthorizationStorePlugin,
      createAuthorizationClient: async () =>
        Promise.resolve({
          response: 'CREATE_SUCCESS',
        } as CreateAuthorizationClientResult),
    });

    mockMeadowlarkCore = jest.spyOn(MeadowlarkCore, 'verifyJwt').mockReturnValue({
      ...newJwtStatus(),
      isValid: true,
      roles: ['admin'],
    });

    // Act
    response = await createClient(malformedBodyRequest);
  });

  afterAll(() => {
    mockAuthorizationStore.mockRestore();
    mockMeadowlarkCore.mockRestore();
  });

  it('returns status 400', () => {
    expect(response.statusCode).toEqual(400);
  });

  it('returns error response', () => {
    expect(response.body).toMatchInlineSnapshot(`"{"message":"Malformed body"}"`);
  });
});

describe('given create has well-formed but invalid json body', () => {
  const invalidBodyRequest: AuthorizationRequest = {
    ...newAuthorizationRequest(),
    path: '/oauth/client',
    body: '{}',
  };

  let response: AuthorizationResponse;
  let mockAuthorizationStore: any;
  let mockMeadowlarkCore: any;

  beforeAll(async () => {
    mockAuthorizationStore = jest.spyOn(AuthorizationPluginLoader, 'getAuthorizationStore').mockReturnValue({
      ...NoAuthorizationStorePlugin,
      createAuthorizationClient: async () =>
        Promise.resolve({
          response: 'CREATE_SUCCESS',
        } as CreateAuthorizationClientResult),
    });

    mockMeadowlarkCore = jest.spyOn(MeadowlarkCore, 'verifyJwt').mockReturnValue({
      ...newJwtStatus(),
      isValid: true,
      roles: ['admin'],
    });

    // Act
    response = await createClient(invalidBodyRequest);
  });

  afterAll(() => {
    mockAuthorizationStore.mockRestore();
    mockMeadowlarkCore.mockRestore();
  });

  it('returns status 400', () => {
    expect(response.statusCode).toEqual(400);
  });

  it('returns error response', () => {
    expect(response.body).toMatchInlineSnapshot(
      `"[{"message":"{requestBody} must have required property 'clientName'","path":"{requestBody}","context":{"errorType":"required"}},{"message":"{requestBody} must have required property 'roles'","path":"{requestBody}","context":{"errorType":"required"}}]"`,
    );
  });
});

describe('given create throws internal error', () => {
  let response: AuthorizationResponse;
  let mockAuthorizationStore: any;
  let mockMeadowlarkCore: any;

  beforeAll(async () => {
    mockAuthorizationStore = jest.spyOn(AuthorizationPluginLoader, 'getAuthorizationStore').mockImplementation(() => {
      throw new Error();
    });

    mockMeadowlarkCore = jest.spyOn(MeadowlarkCore, 'verifyJwt').mockReturnValue({
      ...newJwtStatus(),
      isValid: true,
      roles: ['admin'],
    });

    // Act
    response = await createClient(authorizationRequest);
  });

  afterAll(() => {
    mockAuthorizationStore.mockRestore();
    mockMeadowlarkCore.mockRestore();
  });

  it('returns status 500', () => {
    expect(response.statusCode).toEqual(500);
  });

  it('does not return a message body', () => {
    expect(response.body).toEqual('');
  });
});