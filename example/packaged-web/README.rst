======================================
Packaged Web App With In-App Purchases
======================================

This is an example of a `packaged app`_ of `type:web` (meaning it is not
privileged) that uses the fxpay library to sell and restore in-app products.

By default packaged apps get a random origin but fxpay needs a
reliable origin to look up in-app products. This shows how you can still
use a web package having no origin to do in-app payments.

Installation
~~~~~~~~~~~~

First, build this example into a packaged app. Run this from the root
of the fxpay repository
after you've installed the developer tools listed in the main README::

    grunt package

This will create ``build/app-web`` and ``build/app-web.zip``.
You can install the app from that directory using the `WebIDE`_.

.. _`packaged app`: https://developer.mozilla.org/en-US/Marketplace/Options/Packaged_apps
.. _`WebIDE`: https://developer.mozilla.org/en-US/docs/Tools/WebIDE
.. _`Firefox Marketplace`: https://marketplace.firefox.com/
