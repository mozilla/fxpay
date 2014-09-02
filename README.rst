=====
fxpay
=====

A JavaScript library for `Firefox Marketplace`_ payments.

.. image:: https://travis-ci.org/mozilla/fxpay.png?branch=master
    :target: https://travis-ci.org/mozilla/fxpay

This is a helper library for web apps to accept in-app payments on
`Firefox OS`_ without hosting their own server.
The `in-app payments guide`_ provides a deep dive into the underlying APIs and
concepts.
However, by using this library you can skip a lot of that.
This is a wrapper around the in-app payment services offered
by the `Firefox Marketplace API`_ which make it easier to do
in-app payments.

.. _`Firefox Marketplace`: https://marketplace.firefox.com/
.. _`Firefox OS`: https://developer.mozilla.org/en-US/Firefox_OS
.. _`Firefox Marketplace API`: http://firefox-marketplace-api.readthedocs.org/

Usage
=====

This is a complete guide to usage:
https://developer.mozilla.org/en-US/Marketplace/Monetization/In-app_payments_section/fxPay_iap


FxPay Developers
================

To hack on this library you need `NodeJS`_ and `npm`_ installed.
When you clone the source, all other dependencies are included for you.
However, you need to build a few things. Run this::

    npm rebuild

To execute scripts, you should add the local ``.bin`` directory to
your ``$PATH``::

    PATH="./node_modules/.bin:${PATH}"
    export PATH

This is pretty standard for any Node project so you you might already have it.

From a source checkout, run all tests and lint checks like this::

    npm test

To run the JavaScript unit tests continuously while you are developing, type::

    grunt karma:dev

This opens a web browser and will report test results to your console.
As you edit a code file, it will re-run the tests.

To fire off a single test run with a browser and see the results, type::

    grunt karma:run

To check for syntax errors (lint), run::

    grunt jshint

To build yourself a compressed version of ``fxpay.js``, run this::

    grunt compress

The compressed source file will appear in the ``build`` directory.

.. _`Firefox OS`: https://developer.mozilla.org/en-US/Firefox_OS
.. _`Firefox Marketplace Developer Hub`: https://marketplace.firefox.com/developers/
.. _`NodeJS`: http://nodejs.org/
.. _`npm`: https://www.npmjs.org/
.. _`mozPay()`: https://developer.mozilla.org/en-US/docs/Web/API/Navigator.mozPay
.. _`window.console`: https://developer.mozilla.org/en-US/docs/Web/API/console
