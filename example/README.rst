===========
Example App
===========

This is an example `Firefox OS`_ web app that can do in-app payments
without hosting its own server. To do so, it uses the `fxpay`_ JavaScript
library which hooks into the `Firefox Marketplace`_ for payments.
What's novel about this is that the app can run staticly on something
like `Github Pages`_ and doesn't have to run any backend code.

.. _`Firefox OS`: https://developer.mozilla.org/en-US/Firefox_OS
.. _`fxpay`: https://github.com/mozilla/fxpay
.. _`Firefox Marketplace`: https://marketplace.firefox.com/
.. _`Github Pages`: http://pages.github.com/

You can view this example on Github Pages: http://mozilla.github.io/fxpay/

To install this as a web app, the manifest is located here:
http://mozilla.github.io/fxpay/manifest.webapp

If you want to run the example locally you need NodeJS.
This is only for local development to simulate how Github Pages works.

Run this from the ``example`` directory::

    npm start

This will start a local server to serve all static assets.
