================================
Hosted App With In-App Purchases
================================

This is an example of a `hosted app`_ that uses the fxpay library to
sell and restore in-app products.

Installation
------------

To run the example you'll need to first compress a
minified fxpay library, install some node modules, and start a web server.
Run these commands from the root of the repository::

    grunt compress
    cd example/hosted
    npm install
    npm start

You can now open http://localhost:3000 to see the example app.
All features should be working in any standard web browser.

If you install the app as a desktop web app,
the easiest way to debug it is to launch it from the
shell after installation like this::

    /Applications/FxPayHosted.app/Contents/MacOS/webapprt -debug 6000

Then fire up the `WebIDE`_ and hook it up as a `remote runtime`_.
You'll need to accept a prompt and then you'll be able to use
the debugging tools.

On Mozilla's PAAS
-----------------

The example app is hosted on Mozilla's
`PAAS <https://api.paas.mozilla.org/console/login/>`_ for convenience.
You can access it at http://fxpay-hosted.paas.allizom.org/ and you can
submit it as an app to your local Firefox Marketplace by uploading the
manifest at http://fxpay-hosted.paas.allizom.org/manifest.webapp .

To push changes to the app, run this from the fxpay repository root::

    grunt compress
    stackato push -n

Accessing Your Local API
------------------------

By default, the example app offers ``http://mp.dev`` as the local
Firefox Marketplace API option.
If you'd like to specify a different local URL, you can do so by
passing it as a query string parameter. For example, to set your
local API URL to ``http://fireplace.local``, load the example app
from this URL:

http://localhost:3000/?local_api=http%3A%2F%2Ffireplace.local


.. _`remote runtime`: https://developer.mozilla.org/en-US/docs/Tools/Remote_Debugging/Debugging_Firefox_Desktop
.. _`hosted app`: https://developer.mozilla.org/en-US/Marketplace/Options/Hosted_apps
.. _`WebIDE`: https://developer.mozilla.org/en-US/docs/Tools/WebIDE
