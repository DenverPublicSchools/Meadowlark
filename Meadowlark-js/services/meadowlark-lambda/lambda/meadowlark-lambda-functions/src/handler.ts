// Export handlers from the 'handlers' directory
export { handler as getHandler } from './handlers/getHandler';
export { handler as postHandler } from './handlers/postHandler';
export { handler as deleteHandler } from './handlers/deleteHandler';
export { handler as putHandler } from './handlers/putHandler';
export { handler as descriptorLoaderHandler } from './handlers/descriptorLoaderHandler';

// Export handlers from the 'authorization' directory
export { handler as createAuthorizationClientHandler } from './handlers/authorization/createAuthorizationClientHandler';
export { handler as createSigningKeyHandler } from './handlers/authorization/createSigningKeyHandler';
export { handler as getClientByIdHandler } from './handlers/authorization/getClientByIdHandler';
export { handler as getClientsHandler } from './handlers/authorization/getClientsHandler';
export { handler as requestTokenAuthorizationHandler } from './handlers/authorization/requestTokenAuthorizationHandler';
export { handler as resetAuthorizationClientSecretHandler } from './handlers/authorization/resetAuthorizationClientSecretHandler';
export { handler as updateAuthorizationClientHandler } from './handlers/authorization/updateAuthorizationClientHandler';
export { handler as verifyTokenAuthorizationHandler } from './handlers/authorization/verifyTokenAuthorizationHandler';

// Export handlers from the 'metadata' directory
export { handler as apiVersionHandler } from './handlers/metadata/apiVersionHandler';
export { handler as dependenciesHandler } from './handlers/metadata/dependenciesHandler';
export { handler as metaedHandler } from './handlers/metadata/metaedHandler';
export { handler as openApiUrlListHandler } from './handlers/metadata/openApiUrlListHandler';
export { handler as swaggerForDescriptorsAPIHandler } from './handlers/metadata/swaggerForDescriptorsAPIHandler';
export { handler as swaggerForResourcesAPIHandler } from './handlers/metadata/swaggerForResourcesAPIHandler';
export { handler as xsdMetadataHandler } from './handlers/metadata/xsdMetadataHandler';
