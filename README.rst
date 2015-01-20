=====
fxpay
=====

JavaScript library to support `Firefox Marketplace`_ payments in
a web application.

.. image:: https://travis-ci.org/mozilla/fxpay.svg?branch=master
    :target: https://travis-ci.org/mozilla/fxpay

Usage
=====

This is a complete guide to usage:
https://developer.mozilla.org/en-US/Marketplace/Monetization/In-app_payments_section/fxPay_iap

Examples
========

You can find working code in the
`example <https://github.com/mozilla/fxpay/tree/master/example/>`_
directory of this repository.

FxPay Developers
================

To hack on this library you need `NodeJS`_ and `npm`_ installed.
After cloning the source, cd to the root and install all dependencies::

    npm install

To execute scripts, you should add the local ``.bin`` directory to
your ``$PATH``::

    PATH="./node_modules/.bin:${PATH}"
    export PATH

This is pretty standard for any Node project so you you might already have it.

To test that you have your path set up, type ``which grunt`` and make
sure you see a path to the executable.

Compression
~~~~~~~~~~~

To build yourself a compressed version of ``fxpay.js``, run this::

    grunt compress

The compressed source file will appear in the ``build`` directory
as ``fxpay.min.js``. You'll also get a `source map`_ file in
the same directory as ``fxpay.min.js.map``.

**IMPORTANT**: To use this library in a web page you have to
compress it first because the source code spans multiple files.
The usage instructions above explain how to install public releases from
Bower which is of course easier.

.. _`source map`: http://www.html5rocks.com/en/tutorials/developertools/sourcemaps/

Running Tests
~~~~~~~~~~~~~

From a source checkout, run all tests and lint checks like this::

    grunt test

To run the JavaScript unit tests continuously while you are developing, type::

    grunt karma:dev

This opens a web browser and will report test results to your console.
As you edit a code file, it will re-run the tests.
**NOTE**: this can be buggy sometimes.

To fire off a single test run with a browser and see the results, type::

    grunt karma:run

Here's how to run a specific test file::

    grunt karma:run --tests tests/test-get-products.js

You can also use grep patterns to match files::

    grunt karma:run --tests 'tests/test-get-*'

If you want to run a specific test function, you can use
a grep pattern to match the name in the ``describe()`` or ``it()``
definition. For example, run all tests under
``describe('fxpay.purchase()')`` like this::

    grunt karma:run --grep='fxpay.purchase()'

or run a test defined as ``it('should open a payment window on the web')``
like this::

    grunt karma:run --grep='should open a payment window on the web'

Check For Lint
~~~~~~~~~~~~~~

To check for syntax errors (lint), run::

    grunt jshint

Create A Release
~~~~~~~~~~~~~~~~

You have to do a couple things to create a release:

* Run ``grunt compress`` and add ``build/fxpay.min.js`` to ``dist``
* Make sure the Changelog is up to date.
  You'll probably just need to replace *unreleased* with the current date
  for the current version.
* Commit and push your changes.
* Add and push a git tag corresponding to the version number so that bower
  picks up the file. For example, tag a ``0.0.1`` release like ``git tag 0.0.1``
* Bump the version for the next release. Library version numbers are
  managed in multiple files.
  To increment the version number and update all files at once,
  run ``grunt bump``. In the Changelog, mark this new release number
  as *unreleased*.
* Commit and push your changes.


Changelog
=========

**0.0.6** (unreleased)

* Added ``paymentWindow`` and ``managePaymentWindow`` options to
  ``fxpay.purchase()`` so client can control the payment window.

**0.0.5** (2015-01-13)

* Added experimental support for payments on desktop Firefox.
* Split fxpay.js into smaller modules. This means you *must* minify the
  source before you can use it. That is, unless you install the library
  with Bower.
* Added a source map alongside minified source file.
* Added adapter class for swappable fxpay API backends.
* Added ``extraProviderUrls`` configuration parameter which is more
  convenient than ``payProviderUrls``.

**0.0.4** (2014-09-17)

* Only ask for active products from the marketplace.

**0.0.3** (2014-09-03)

* Send library version to API on each request.

**0.0.2** (2014-09-02)

* Removed node_modules from the repository so the initial bower download
  isn't 8MB on installation.

**0.0.1** (2014-09-02)

* First public release.

.. _`Firefox Marketplace`: https://marketplace.firefox.com/
.. _`Firefox Marketplace Developer Hub`: https://marketplace.firefox.com/developers/
.. _`NodeJS`: http://nodejs.org/
.. _`npm`: https://www.npmjs.org/
.. _`mozPay()`: https://developer.mozilla.org/en-US/docs/Web/API/Navigator.mozPay
.. _`window.console`: https://developer.mozilla.org/en-US/docs/Web/API/console
