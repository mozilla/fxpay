=====
fxpay
=====

JavaScript library to support `Firefox Marketplace`_ payments in
a web application.

.. image:: https://travis-ci.org/mozilla/fxpay.png?branch=master
    :target: https://travis-ci.org/mozilla/fxpay

Usage
=====

This is a complete guide to usage:
https://developer.mozilla.org/en-US/Marketplace/Monetization/In-app_payments_section/fxPay_iap


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

Running Tests
~~~~~~~~~~~~~

From a source checkout, run all tests and lint checks like this::

    npm test

To run the JavaScript unit tests continuously while you are developing, type::

    grunt karma:dev

This opens a web browser and will report test results to your console.
As you edit a code file, it will re-run the tests.

To fire off a single test run with a browser and see the results, type::

    grunt karma:run

Check For Lint
~~~~~~~~~~~~~~

To check for syntax errors (lint), run::

    grunt jshint

Compression
~~~~~~~~~~~

To build yourself a compressed version of ``fxpay.js``, run this::

    grunt compress

The compressed source file will appear in the ``build`` directory.

Bump Version
~~~~~~~~~~~~

Library version numbers are managed in multiple files. To increment
the version number and update all files at once, run this::

    grunt bump

Commit the changes, tag, and push. For example, tag a ``0.0.1``
release like ``git tag 0.0.1``.

Changelog
=========

*0.0.1* (2014-09-02)

* first public release

.. _`Firefox Marketplace`: https://marketplace.firefox.com/
.. _`Firefox Marketplace Developer Hub`: https://marketplace.firefox.com/developers/
.. _`NodeJS`: http://nodejs.org/
.. _`npm`: https://www.npmjs.org/
.. _`mozPay()`: https://developer.mozilla.org/en-US/docs/Web/API/Navigator.mozPay
.. _`window.console`: https://developer.mozilla.org/en-US/docs/Web/API/console
