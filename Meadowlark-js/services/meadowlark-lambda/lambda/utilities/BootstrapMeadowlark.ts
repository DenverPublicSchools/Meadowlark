import { initializeLogging, CachedEnvironmentConfigProvider, Config } from "@edfi/meadowlark-utilities/dist";
export async function bootstrap() {
  await Config.initializeConfig(CachedEnvironmentConfigProvider);
  initializeLogging();
}