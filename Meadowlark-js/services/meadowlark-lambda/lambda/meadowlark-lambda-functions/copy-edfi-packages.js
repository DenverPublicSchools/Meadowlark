/* =============================================================================

Meadowlark as of writing makes use of core packages that make use of dynamic and
at runtime package loading, as well as static file loading, this behavior is not
compatible with bundlers like ESBuild. As they cannot identify these behaviors.
Some of these behaviors are components of core functionality of the code base, and
as such cannot easily be changed to work with bundlers. In order to write lambda
functions in TS we have to compile them which would normally involve the use of 
ESBuild, in this situation we can't do that. The alternative is to use TSC and then
upload the lambda project as a zip file to AWS, doing the work of compiling and packaging
ourselves. This method allows us to more closely mimic the vanilla node behavior
that meadowlark expects.

Because this method requires a complete set of node modules, this project cannot
be used directly in the monorepo project of meadowlark. This file is meant to
replace some of the monorepo functionality, mainly this means including the dependencies,
that meadowlark depends on by making use of NPM pack to link the other packages
into this package without using symlinks.

============================================================================= */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Define the source directory where the tarballs are located (assuming they are in each package directory)
const sourceDir = Object.freeze({
    'root': '../../../../',
    'dir': [
        'packages',
        'backends'
    ],
    paths() {
        return this.dir.map(dir => { return { 'path': path.join(this.root, dir), 'root': dir } });
    }
})

// Define the Lambda function project directory where we want to copy the tarballs
const lambdaFunctionProjectDir = './meadowlark-lambda-functions/tarballs';

// List of package names, ignoring the @edfi namespace, BE AWARE OF THIS NOVELTY, the script assumes the @edfi namespace, and it includes it later when identifying the tarball
const packages = Object.freeze({
    'packages': [
        'meadowlark-authz-server',
        'meadowlark-core',
        'meadowlark-utilities',
        // Add more packages if needed
    ],
    'backends': [
        'meadowlark-opensearch-backend',
        'meadowlark-postgresql-backend',
        // Add more packages if needed
    ]
})

// Function to run npm pack for each package
function runNpmPack(packageDir) {
    execSync('npm pack', { cwd: packageDir });
}

// Function to read the version from package.json
function getVersion(packageDir) {
    const packageJsonPath = path.join(packageDir, 'package.json');
    const packageJsonData = fs.readFileSync(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(packageJsonData);
    return packageJson.version;
}

// Function to copy the tarball files with versioning
function copyTarballsWithVersion() {
    for (const source of sourceDir.paths()) {
        for (const packageName of packages[source.root]) {
            const packagePath = path.join(source.path, packageName)
            console.log(`------Starting: ${packageName}------`);
            runNpmPack(packagePath);

            const version = getVersion(packagePath);
            const tarballFilename = `edfi-${packageName}-${version}.tgz`;
            const sourcePath = path.join(process.cwd(), packagePath, tarballFilename);
            const destinationPath = path.join(process.cwd(), 'tarballs', tarballFilename);

            fs.copyFileSync(sourcePath, destinationPath);
            console.log(`Copied ${tarballFilename} to ${lambdaFunctionProjectDir}`);

            // Install the tarball as a dependency in the Lambda function project
            const installCommand = `npm install ./tarballs/${tarballFilename}`;
            try {
                execSync(installCommand, { cwd: process.cwd() });
                console.log(`Installed ${tarballFilename} in ${lambdaFunctionProjectDir}`);
            } catch (err) {
                console.error(`Error Installing: ${tarballFilename}`)
            }
            console.log(`------Finished: ${packageName}------`);
        }
    }
}

// Run the copyTarballsWithVersion function
copyTarballsWithVersion();
console.log(`-------------------------------Done, Running Npm Install---------------------------------`);
