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

**Topics**

.. contents::
   :local:
   :depth: 2

Current Status
==============

**This library is experimental**.

Only consider using this library if you want
to help us iron out bugs and if you don't mind dealing with API changes.

This tracker bug will keep you up to date on our progress:
https://bugzilla.mozilla.org/show_bug.cgi?id=944480

Usage
=====

Include this repository as a git submodule in your web app
so you can load the script at ``lib/fxpay.js``.
When the lib is more stable we'll add support for
script / package managers.
See the Developers section below if you want to minimize it first.

Set Up Your Products
~~~~~~~~~~~~~~~~~~~~

Log into the `Firefox Marketplace Developer Hub`_. There will be a page
where you can enter the names and prices for each of your products.
These docs will be updated with a link when the page exists :)

Capture A Purchase
~~~~~~~~~~~~~~~~~~

When you create a product on the Developer Hub you'll get
unique identifiers for each product, such as ``543123``.
Make a screen in your app where you offer a product for purchase.
Create a buy button that when tapped, runs this code::

    var productId = 543123;

    fxpay.purchase(productId, {
      onpurchase: function(err) {
        if (err) {
          throw err;
        } else {
          console.log('product', productId, 'has been purchased!');
          // It is now safe to deliver the product to your user.
        }
      }
    });

When the ``onpurchase()`` callback is executed, the item has been
verifiably purchased. It is safe to deliver the item.

How does this work? The ``fxpay.purchase()`` function automates
the process of calling `mozPay()`_ then
waiting for and verifying an incoming JWT signature.
If you want to know the specifics, see the `in-app payments guide`_
but you could follow this guide start to finish and you'd already be
doing payments.

``fxpay.purchase()`` kicks the user into a buyflow. When the user
completes the payment, the payment window closes and they are returned
to your app; ``fxpay`` waits for a postback message.
It would be a good idea to show the user a progress indicator
while they wait using ``oncheckpayment()`` like this::

    fxpay.purchase(productId, {
      oncheckpayment: function() {
        // Show a progress indicator in your UI
        // while the payment is being checked.
      },
      onpurchase: function(err) {
        if (err) {
          throw err;
        } else {
          // It is now safe to deliver the product to your user.
        }
      }
    });

.. _`in-app payments guide`: https://developer.mozilla.org/en-US/Marketplace/Monetization/In-app_payments
.. _`Firefox Marketplace Developer Hub`: https://marketplace.firefox.com/developers/

Errors
~~~~~~

Errors come back to you as the first argument to the ``onpurchase(err)``
callback. If no error occurs, ``err`` will be null.
The errors are strings and are
meant to be treated like readable codes that you can map to localized text, etc.
A detailed error explanation will be logged; read on for logging details.

Here are the possible error strings you might receive and what they mean:

**API_REQUEST_ABORTED**
    An HTTP request to the API was aborted.

**API_REQUEST_ERROR**
    An HTTP request to the API resulted in an error.

**API_REQUEST_TIMEOUT**
    The API did not respond to a request before the timeout was reached.

**BAD_API_RESPONSE**
    The API responded with a non-successful status code.

**BAD_JSON_RESPONSE**
    The API unexpectedly responded with unparseable JSON.

**DIALOG_CLOSED_BY_USER**
    The user closed their payment window before completing the purchase.
    You can probably ignore this error or maybe display a
    cancelled message. This error comes from `mozPay()`_.

**INVALID_TRANSACTION_STATE**
    The transaction was in an invalid state and cannot be processed.

**TRANSACTION_TIMEOUT**
    The HTTP request to check the transaction state timed out.

**USER_CANCELLED**
    The user cancelled the purchase. You can probably ignore this
    error or maybe display a cancelled message. This error comes from
    `mozPay()`_.

Logging
~~~~~~~

By default, ``fxpay`` logs everything using `window.console`_. If you want to
replace ``console`` with your own logger, pass in an object as ``log``
that implements the same `window.console`_ methods::

    fxpay.purchase(productId, {
      onpurchase: function(err) {
        if (err) {
          throw err;
        }
      },
      log: myConsole
    });

.. _`window.console`: https://developer.mozilla.org/en-US/docs/Web/API/console

Example App
===========

If you'd like to see a working example of ``fxpay``, you're in luck.
We built one here: https://github.com/mozilla/fxpay/tree/master/example

The README on that page has instructions for how to install the
example app on a Firefox OS device;
the app can also be used to test ``fxpay``.

Developers
==========

To hack on this library you need `NodeJS`_ and `npm`_ installed.
When you clone the source, all other dependencies are included for you.
However, you need to build a few things. Run this::

    npm rebuild

To execute scripts, you should add the local ``.bin`` directory to
your ``$PATH``::

    PATH="./node_modules/.bin:${PATH}"
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
.. _`mozPay()`: https://developer.mozilla.org/en-US/docs/Web/API/Navigator.mozPay
