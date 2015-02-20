==================================
Packaged App With In-App Purchases
==================================

This is an example of a `packaged app`_ that uses the fxpay library to
sell and restore in-app products.

By default packaged apps get a random origin but fxpay needs a
reliable origin to look up in-app products. Because of this, the packaged
app needs to be `privileged`_ and must define an origin.

Installation
~~~~~~~~~~~~

To install a `privileged`_ app it must be signed by something like
`Firefox Marketplace`_. However, you can use the
`WebIDE`_ to install it as well. First, build this example into a
packaged app. Run this from the root of the fxpay repository
after you've installed the developer tools listed in the main README::

    grunt package

This will create ``build/application`` and ``build/application.zip``.
You can install the app from that directory using the `WebIDE`_.

.. _`packaged app`: https://developer.mozilla.org/en-US/Marketplace/Options/Packaged_apps
.. _`privileged`: https://developer.mozilla.org/en-US/Marketplace/Options/Packaged_apps#Privileged_app
.. _`WebIDE`: https://developer.mozilla.org/en-US/docs/Tools/WebIDE
.. _`Firefox Marketplace`: https://marketplace.firefox.com/
