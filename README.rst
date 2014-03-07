=====
fxpay
=====

JavaScript library for `Firefox Marketplace`_ payments.

.. image:: https://travis-ci.org/mozilla/fxpay.png?branch=master
    :target: https://travis-ci.org/mozilla/fxpay

This is a helper library for web apps to accept in-app payments on
`Firefox OS`_.
The `in-app payments guide`_ provides a deep dive into the underlying APIs and
concepts.

There isn't much to see yet.
This is a work in progress that aims to simplify what an app has to
do to accept payments. We're calling this "server-less in-app payments"
because when fully functional this library will let you do payments without
hosting your own server.
This tracker bug will keep you up to date on our progress:
https://bugzilla.mozilla.org/show_bug.cgi?id=944480

.. _`in-app payments guide`: https://developer.mozilla.org/en-US/Marketplace/Monetization/In-app_payments
.. _`Firefox Marketplace`: https://marketplace.firefox.com/
.. _`Firefox OS`: https://developer.mozilla.org/en-US/Firefox_OS

Developers
==========

To develop on this library you need `NodeJS`_ and `npm`_ installed.
When you clone the source, all other dependencies are included for you.
However, you need to build a few things. Run this::

    npm rebuild

To execute scripts, you should add the local ``.bin`` directory to
your ``$PATH``::

    PATH="./node_modules/.bin/:${PATH}"
    export PATH

This is pretty standard for any Node project so you you might already have it.


From a source checkout, run all tests like this::

    npm test

To run just the JavaScript unit tests, type::

    grunt karma:unit

This opens a web browser and will report test results to your console.
As you edit your tests, it will re-run the tests continuously.

For a single-run, headless (i.e. no browser) execution, run::

    grunt karma:ci

To check for syntax errors, run::

    grunt jshint

To build yourself a compressed version of ``fxpay.js``, run this::

    grunt compress

The compressed source file will appear in the ``build`` directory.

.. _`NodeJS`: http://nodejs.org/
.. _`npm`: https://www.npmjs.org/
