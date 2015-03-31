# fxpay

JavaScript library to support [Firefox Marketplace][mkt] payments in
a web application.


[![Build Status](https://travis-ci.org/mozilla/fxpay.svg?branch=master)](https://travis-ci.org/mozilla/fxpay)
![Bower Version](https://badge.fury.io/bo/fxpay.svg)
[![devDependency Status](https://david-dm.org/mozilla/fxpay/dev-status.svg)](https://david-dm.org/mozilla/fxpay#info=devDependencies)


## Usage

This is a complete [guide to fxpay usage on MDN][mdn-docs]

## Examples

You can find working code in the [example][example] directory of this repository

## FxPay Developers

To hack on this library you need [NodeJS][node] and [npm][npm] installed.
After cloning the source, cd to the root and install all dependencies:

    npm install

To execute scripts, you should add the local `.bin` directory to
your `$PATH`:

    PATH="./node_modules/.bin:${PATH}"
    export PATH

This is pretty standard for any Node project so you you might already have it.

To test that you have your path set up, type `which grunt` and make
sure you see a path to the executable.

### Compression

To build yourself a compressed version of `fxpay.js`, run this:

    grunt compress

The compressed source file will appear in the `build` directory
as `fxpay.min.js`. You'll also get a [source map][sourcemaps] file in
the same directory as `fxpay.min.js.map`.

**IMPORTANT**: To use this library in a web page you have to
compress it first because the source code spans multiple files.
The usage instructions above explain how to install public releases from
Bower which is of course easier.


### Running Tests

From a source checkout, run all tests and lint checks like this:

    grunt test

To run the JavaScript unit tests continuously while you are developing, type:

    grunt karma:dev

This opens a web browser and will report test results to your [console][console].
As you edit a code file, it will re-run the tests.
**NOTE**: this can be buggy sometimes.

To fire off a single test run with a browser and see the results, type:

    grunt karma:run

Here's how to run a specific test file:

    grunt karma:run --tests tests/test-get-products.js

You can also use grep patterns to match files:

    grunt karma:run --tests 'tests/test-get-*'

If you want to run a specific test function, you can use
a grep pattern to match the name in the `describe()` or `it()`
definition. For example, run all tests under
`describe('fxpay.purchase()')` like this:

    grunt karma:run --grep='fxpay.purchase()'

or run a test defined as `it('should open a payment window on the web')`
like this:

    grunt karma:run --grep='should open a payment window on the web'

If you should need to change the karma log-level (default is ERROR)
you can do so as follows:

    grunt test --log-level=DEBUG


### Check For Lint

To check for syntax errors (lint), run:

    grunt jshint

### Create A Release

You have to do a couple things to create a release:

* Run `grunt release`. This compresses the files and copies them to the dist dir.

  * Commit and push your changes to master.

* Publish the pending [github release][releases] (or create one) which will tag master
  at the version string.

  * Make sure all release notes in the draft are up to date.
  * If no release exists yet, create one and title it as the pending
    version number. For example: `0.0.1`.
  * Alternatively, you could manually tag the release with git by running
    `git tag 0.0.1 && git push upstream 0.0.1`.

* Bump the version for the next release. Library version numbers are
  managed in multiple files.
  To increment the version number and update all files at once,
  run `grunt bump`.

  * Commit and push your changes.


### Build the docs

To build the JSDoc API docs locally run `grunt docs`. The built docs can be found
in `build/docs`.

For anyone with the commit bit that wants to publish the docs to the gh-pages branch
of this repo run: `grunt publish-docs`.

The current API docs are available here: [FxPay API Docs](https://mozilla.github.io/fxpay/) *(Note: they are currently under development).*


## Changelog

See the [release page][releases]


[mkt]: https://marketplace.firefox.com
[node]: http://nodejs.org/
[npm]: https://www.npmjs.org/
[console]: https://developer.mozilla.org/en-US/docs/Web/API/console
[mdn-docs]: https://developer.mozilla.org/en-US/Marketplace/Monetization/In-app_payments_section/fxPay_iap
[example]: https://github.com/mozilla/fxpay/tree/master/example/
[sourcemaps]: http://www.html5rocks.com/en/tutorials/developertools/sourcemaps/
[releases]: https://github.com/mozilla/fxpay/releases
