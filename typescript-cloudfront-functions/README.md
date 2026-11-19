## Overview
This is a sample package to demonstrate how to use TypeScript with CloudFront Functions.

There is a `webpack.config.js` which bundles the TypeScript code and produces a single JavaScript file which can be uploaded as a CloudFront Function.
This JavaScript file exposes a global `handler` variable which points to the default export from your TypeScript file.

### Building this Package
To build the code and get a JavaScript file that can be uploaded to CloudFront, execute:
```shell
nvm use
npm install
npm run build
```

And then find your JavaScript file in the `dist/` directory.

### Adding a New Function
Just create a new TypeScript file in `src/` with a default export handler function that CloudFront Functions should run.
You can optionally add a unit test for this function by adding a file ending in `.test.ts` in the `tst/` directory.

And that's it! The Webpack config will automatically create a new application entrypoint for this TypeScript file and include a JavaScript version in the `dist/` directory.

### Testing
This package uses [Jest](https://jestjs.io/) for unit testing. To run tests, execute:
```shell
npm run test
```
