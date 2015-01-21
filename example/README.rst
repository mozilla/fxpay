============
Example Apps
============

These are some examples of `Firefox OS`_ web apps that can do in-app payments
using the fxpay library. You can install the examples as a `packaged app`_,
a `hosted app`_, or you can simply load the URL in a web browser.

As a packaged app
-----------------

Since fxpay requires an app to define an origin, the app must be `privileged`_.

Installation
~~~~~~~~~~~~

To install a `privileged`_ app it must be signed by something like
`Firefox Marketplace`_. However, you can use the
`WebIDE`_ to install it as well. First, build this example into a
packaged app. Run this from the root of the `fxpay`_ repository
after you've installed the developer tools listed in the main README::

    grunt package

This will create ``build/application`` and ``build/application.zip``.
You can install the app from that directory using the App Manager.

As a hosted app
---------------

To run the example as a `hosted app`_, you'll need to first compress a
minified fxpay library, install some node modules, and start a web server.
Run these commands from the root of the repository::

    grunt compress
    cd example/hosted
    npm install
    npm start

You can now open http://localhost:3000 to see the example app.
All features should be working in any standard web browser.

If you install the app as a desktop web app,
the easiest way to debug it (on Mac OS X) is to launch it from the
shell after installation like this::

    /Applications/FxPayHosted.app/Contents/MacOS/webapprt -jsconsole

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

Using A Custom Webpay
---------------------

If you want to test payments against your local `Webpay`_ server
then you'll also need to `build a custom profile`_ with payments
preferences. To use the Simulator with your custom profile, go into
about:addons, click on Preferences for the
Firefox OS Simulator addon, and set the Gaia path to your custom built
profile.

.. _`WebIDE`: https://developer.mozilla.org/en-US/docs/Tools/WebIDE
.. _`packaged app`: https://developer.mozilla.org/en-US/Marketplace/Options/Packaged_apps
.. _`hosted app`: https://developer.mozilla.org/en-US/Marketplace/Options/Hosted_apps
.. _`privileged`: https://developer.mozilla.org/en-US/Marketplace/Options/Packaged_apps#Privileged_app
.. _`Firefox OS`: https://developer.mozilla.org/en-US/Firefox_OS
.. _`fxpay`: https://github.com/mozilla/fxpay
.. _`Firefox Marketplace`: https://marketplace.firefox.com/
.. _Webpay: https://github.com/mozilla/webpay
.. _`build a custom profile`: https://webpay.readthedocs.org/en/latest/use_hosted_webpay.html#build-a-custom-b2g-profile
