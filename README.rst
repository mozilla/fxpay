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

Requirements
============

To use ``fxpay`` to accept in-app payments, the following
requirements must be met:

* Your application must run in `Firefox OS`_ 1.1 or greater.
* Your manifest must declare an `origin`_ for receipt validation.
* You must declare the following permission in your manifest
  to talk to the Marketplace API::

      "permissions": {
        "systemXHR": {
          "description": "Required to access payment API"
        }
      }

* Your application must be a `privileged`_ packaged app so it can be signed
  and granted proper permissions.

The example app, explained below, shows you how to set all this up.

.. _`origin`: https://developer.mozilla.org/en-US/Apps/Build/Manifest#origin
.. _`privileged`: https://developer.mozilla.org/en-US/Marketplace/Options/Packaged_apps#Privileged_app

Example App
===========

If you'd like to see a working example of ``fxpay``, you're in luck.
We built one here: https://github.com/mozilla/fxpay/tree/master/example

The README on that page has instructions for how to install the
example app on a `Firefox OS`_ device;
the app can also be used to test ``fxpay`` and associated APIs.

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
These docs will be updated with a link when the page is working :)

When you create a product on the Developer Hub you'll get
a unique identifier, such as ``543123``.
You'll use this ID number to reference the product when
working with the ``fxpay`` library.

Development
~~~~~~~~~~~

You can test out the ``fxpay`` library without having to submit your
app and configure products as described above. Skip to the
`fake-products`_ section for details.

Initialization
~~~~~~~~~~~~~~

When your app starts up, you need to initialize ``fxpay`` so it can
check for any existing product receipts. This is also your chance to
register some callbacks for general `error`_
handling and other events.

Example::

    fxpay.init({
      onerror: function(error) {
        console.error('An error occurred:', error);
      },
      oninit: function() {
        console.log('fxpay initialized without errors');
      },
      onrestore: function(error, info) {
        // If error is null, info.productId has been restored from receipt.
      }
    });

Fetching Products
~~~~~~~~~~~~~~~~~

To get all of your app's products, call ``fxpay.getProducts()``
after successful intialization::

    fxpay.init({
      oninit: function() {

        fxpay.getProducts(function(error, products) {
          if (error) {
            return console.error('Error getting products:', error);
          }

          console.log('first product ID:', products[0].productId);
          console.log('first product name:', products[0].name);
        });
      }
    });

If no error occurred, your callback will be invoked with an array
of `product info`_ objects. This method is useful to build an
interface from which the user can purchase your products.

.. _`fake-products`:

Working with Fake Products
~~~~~~~~~~~~~~~~~~~~~~~~~~

To jump into building an app that supports payments without
first configuring products on the `Firefox Marketplace Developer Hub`_,
you can work with a set of fake products.
Set this somewhere in your app's initialization::

    fxpay.configure({fakeProducts: true});

This changes ``fxpay.getProducts(...)`` to return two pre-defined
products that can be purchased in `simulation`_ mode.
The products will have fixed ID numbers, titles, and prices but this
should help you integrate the purchase and fulfillment callbacks.

When you have submitted your finished app and fully configured your
products, set ``fakeProducts`` to false and the same call to
``fxpay.getProducts(...)`` will retrieve your app's real products.

.. _`simulation`: https://developer.mozilla.org/en-US/Marketplace/Monetization/In-app_payments_section/mozPay_iap#Simulating_payments

Restoring Products from Receipt
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

``fxpay.init()`` will discover any `receipts`_ on the user's
device and validate them. If a receipt is valid then it means the user
has already purchased the product so you should restore it.

The ``onrestore`` callback will be invoked for each product restored.
The first argument is an `error`_ string which may be
null. The second argument is a `product info`_ object
which may also be null for certain errors.

You initialize the callback like this::

    fxpay.init({
      onrestore: function(error, info) {
        if (error) {
          console.error('Error', error,
                        'while restoring receipt for', info.productId);
        } else {
          console.log('product', info.productId,
                      'was restored from receipt');
        }
      }
    });

.. _receipts: https://wiki.mozilla.org/Apps/WebApplicationReceipt

Rejecting Foreign Receipts
~~~~~~~~~~~~~~~~~~~~~~~~~~

In addition to rejecting invalid receipts, ``fxpay.init()`` also
rejects any receipts that belong to foreign apps, i.e. a receipt with a
product URL that does not match your app's origin.
This might happen if a user bought a product from another app and copied
it over to the storage area for your app hoping to get free stuff.
To disable this check and allow valid receipts belonging to *any* app,
you can use `configuration`_ to set ``allowAnyAppReceipt = true``.

Capture a Purchase
~~~~~~~~~~~~~~~~~~

You can call ``fxpay.purchase()`` to start the buy flow for an
item.
First, you'll probably want to make a screen in your app
where you offer some product for purchase using results from
``fxpay.getProducts()``.
Create a buy button that when tapped calls ``fxpay.purchase()`` like this::

    var productId = 543123;  // from getProducts().

    fxpay.purchase(productId, function(error, info) {
      if (error) {
        throw error;
      }

      console.log('product', info.productId, 'was purchased and verified!');
      // ***************************************************
      // It is now safe to deliver the product to your user.
      // ***************************************************
    });

The ``purchase`` callback will receive an `error`_ string
which might be null and a `product info`_ object.
The callback is invoked after the user completes the buy flow
and the Marketplace server has verified the receipt so at this time it is
safe to deliver the item.

How does this work? The ``fxpay.purchase()`` function automates
the process of calling `mozPay()`_ then
waiting for and verifying an incoming JWT signature.
If you want to know the specifics, see the `in-app payments guide`_
but that's not mandatory for using the ``fxpay`` library.

.. _`in-app payments guide`: https://developer.mozilla.org/en-US/Marketplace/Monetization/In-app_payments

.. _`product info`:

Product Info Object
~~~~~~~~~~~~~~~~~~~

The ``purchase`` and ``onrestore`` callbacks receive a product info object.
In case of an error, you may receive an object with missing properties
depending on the error state.
The product info object has the following properties:

*info.productId*
    The ID number of the product. This corresponds to the ID number you see in
    the `Firefox Marketplace Developer Hub`_ when managing your products.

*info.name*
    The name of the product in the default locale.

*info.productUrl*
    The URL of the product as declared in the receipt. This will most likely
    be a URL to the app, such as ``https://your-hosted-app`` or
    ``app://your-packaged-app``.

*info.smallImageUrl*
    A 64 pixel square image URL for the product.

.. _`error`:

Errors
~~~~~~

Errors come back to you as the first argument to the ``onerror(error)`` callback
that was passed to ``fxpay.init()`` or as the first argument to the
``fxpay.purchase()`` callback.
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

**INCORRECT_USAGE**
    An ``fxpay`` function was used incorrectly. Check the console
    for details.

**INVALID_TRANSACTION_STATE**
    The transaction was in an invalid state and cannot be processed.

**NOT_INITIALIZED**
    The library was not initialized correctly; no actions can be
    performed. This might mean you didn't call ``init()`` or it
    could mean there was an uncaught exception. Check the console for
    details.

**NOT_INSTALLED_AS_APP**
    This platform supports apps but the app has not been installed
    on device. This could happen if it was accessed directly from the browser.

**PAY_PLATFORM_UNAVAILABLE**
    This platform does not support payments. This could mean
    the `navigator.mozApps`_ namespace or the `mozPay()`_ function
    is unavailable or the ``Apps.addReceipt`` method doesn't exist.

**TRANSACTION_TIMEOUT**
    The HTTP request to check the transaction state timed out.

**USER_CANCELLED**
    The user cancelled the purchase. You can probably ignore this
    error or maybe display a cancelled message. This error comes from
    `mozPay()`_.

Additionally, your callback may receive one of the `App error strings`_
such as ``INVALID_MANIFEST``.

.. _`navigator.mozApps`: https://developer.mozilla.org/en-US/docs/Web/API/Apps
.. _`App error strings`: https://developer.mozilla.org/en-US/Apps/Build/JavaScript_API/Error_object

Logging
~~~~~~~

By default, ``fxpay`` logs everything using `window.console`_. If you want to
replace ``console`` with your own logger, pass in an object as ``log``
that implements the same `window.console`_ methods::

    fxpay.configure({
      log: myConsole
    });

.. _configuration:

Configuration
~~~~~~~~~~~~~

You can call ``fxpay.configure(overrides)`` to set some internal variables.
If you call this repeatedly, the old keys will be preserved unless
overidden.

Example::

    fxpay.configure({log: myCustomLog});

Possible overrides:

*allowAnyAppReceipt*
    If ``true``, the receipt will not be marked invalid when it's for
    someone else's app. Default: ``false``.

*apiUrlBase*
    The base URL of the internal ``fxpay`` API.
    Default: ``https://marketplace.firefox.com``.

*apiTimeoutMs*
    A length of time in milleseconds until any API request will time out.
    Default: 10000.

*apiVersionPrefix*
    A Path that gets appended to ``apiUrlBase`` to access the right API version.
    Default: ``/api/v1``.

*fakeProducts*
    If true, ``fxpay.getProducts()`` will return fake products that can be
    used for testing. See `fake-products`_ for details.
    Default: ``false``.

*log*
    A log object compatible with `window.console`_ to use internally.
    Default: ``window.console``.

*receiptCheckSites*
    Array of sites allowed to verify purchase receipts.
    These values are top level URLs to verifier services;
    they don't need to include URL paths.
    You would only need to adjust this if you want to work with something
    other than the production version of Firefox Marketplace.
    Default: ``['https://receiptcheck.marketplace.firefox.com']``.


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
