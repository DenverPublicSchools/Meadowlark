import { build } from 'esbuild';
import copy from 'copyfiles';

// esbuild options
const esbuildOptions = {
  bundle: true,
  platform: 'node',
  sourcemap: true
};

// Function to handle esbuild
async function buildWithEsbuild(entryPoint, outfile, external) {
  try {
    await build({
      ...esbuildOptions,
      entryPoints: [entryPoint],
      outfile: outfile,
      external: external
    });
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Function to handle copyfiles
function copyWithCopyfiles(from, to, up) {
  copy([from, to], { up: up }, err => {
    if (err) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });
}

// Build dependencies
buildWithEsbuild('../../backends/meadowlark-postgresql-backend/index.ts', 'dist/layer/nodejs/node_modules/meadowlark-postgresql-backend.js', ['pg-native']);
buildWithEsbuild('../../backends/meadowlark-opensearch-backend/index.ts', 'dist/layer/nodejs/node_modules/meadowlark-opensearch-backend.js');
buildWithEsbuild('../../node_modules/@edfi/metaed-core/dist/index.js', 'dist/layer/nodejs/node_modules/@edfi/metaed-core/dist/index.js');
buildWithEsbuild('../../packages/meadowlark-utilities/index.ts', 'dist/layer/nodejs/node_modules/@edfi/meadowlark-utilities/index.js');
buildWithEsbuild('../../packages/meadowlark-authz-server/index.ts', 'dist/layer/nodejs/node_modules/@edfi/meadowlark-authz-server/index.js');

// Copy files
copyWithCopyfiles('../../node_modules/pg-format/lib/reserved.js', 'dist/layer/nodejs/node_modules/', 0);
copyWithCopyfiles('./dist/node_modules/@edfi/meadowlark-core/index.js', 'dist/node_modules/@edfi/meadowlark-core/dist/index.js', 1);
copyWithCopyfiles('../../node_modules/@edfi/metaed-core/*.json', 'dist/layer/nodejs/node_modules/@edfi/', 5);
copyWithCopyfiles('../../node_modules/@edfi/metaed-core/*.json', 'dist/layer/nodejs/node_modules/@edfi/metaed-core', 5);
