const copy = require('copyfiles');
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');

// Function to handle copyfiles
function copyWithCopyfiles(from, to, up) {
  return new Promise((resolve, reject) => {
    copy([from, to], { up: up }, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

// Run TypeScript compiler (tsc)
function runTSC() {
  try {
    execSync('tsc');
  } catch (err) {
    console.error(`Error while running tsc: ${err.message}`);
    process.exit(1);
  }
}

// Zip the 'dist' folder
function zipDist() {
  const isWindows = os.platform() === 'win32';

  try {
    if (isWindows) {
      execSync('7z a -tzip -mx1 meadowlark-lambda-functions.zip ./dist/*')
      // execSync('powershell Compress-Archive -CompressionLevel "Fastest" -Update -Path "./dist/*" -DestinationPath "meadowlark-lambda-functions.zip"');
    } else {
      execSync('zip -r meadowlark-lambda-functions.zip dist');
    }
    console.log('meadowlark-lambda-functions.zip created successfully.');
  } catch (err) {
    console.error(`Error while creating meadowlark-lambda-functions.zip: ${err.message}`);
    process.exit(1);
  }
}

// Build script
async function build() {
  console.log(`-------------------------------Build:CompileWithTSC---------------------------------`);
  runTSC();
  console.log(`-------------------------------Copy:NodeModules---------------------------------`);
  await copyWithCopyfiles('./node_modules/**/*', './dist/node_modules/', 1);
  await copyWithCopyfiles('./node_modules/@edfi/ed-fi-model-3.3b/**/*', './dist/node_modules/@edfi/meadowlark-core/node_modules/@edfi/', 2);
  await copyWithCopyfiles('./node_modules/@edfi/ed-fi-model-3.1/**/*', './dist/node_modules/@edfi/meadowlark-core/node_modules/@edfi/', 2);
  await copyWithCopyfiles('./package.json', './dist/', 0);
  await copyWithCopyfiles('./package-lock.json', './dist/', 0);
  console.log(`-------------------------------Package:ZipWithZlib---------------------------------`);
  zipDist();
}

// Execute the build script
build();
