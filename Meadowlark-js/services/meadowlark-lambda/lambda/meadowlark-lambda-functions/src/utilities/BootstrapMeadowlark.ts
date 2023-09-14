import { initializeLogging, CachedEnvironmentConfigProvider, Config } from "@edfi/meadowlark-utilities/dist";
import { loadMetaEdState } from "@edfi/meadowlark-core/dist/metaed/LoadMetaEd";
import { modelPackageFor } from "@edfi/meadowlark-core/dist/metaed/MetaEdProjectMetadata";
export async function bootstrap(): Promise<boolean> {
  await Config.initializeConfig(CachedEnvironmentConfigProvider);
  initializeLogging();

  await loadMetaEdState(modelPackageFor('v3.3b')); // TODO: make dynamic somehow

  return true;
}