============
Example Apps
============

These are some examples of `Firefox OS`_ web apps that can do in-app payments
using the fxpay library.

As a packaged app
-----------------

Since fxpay requires an app to define an origin, the app must be `privileged`_.

Installation
~~~~~~~~~~~~

To install a privileged app it must be signed by something like
`Firefox Marketplace`_. However, you can use the
`App Manager`_ to install it as well. First, build this example into a
packaged app. Run this from the root of the `fxpay`_ repository
after you've installed the developer tools listed in the main README::

    grunt package

This will create ``build/application`` and ``build/application.zip``.
You can install the app from that directory using the App Manager.

As a hosted app
---------------

**IMPORTANT**: using fxpay with hosted apps is currently experimental and may
not be fully implemented.

To run the hosted example app, you'll need to first compress a minified
fxpay library, install some node modules, and start a web server.
Run these commands from the root of the repository::

    grunt compress
    cd example/hosted
    npm install
    npm start

You can now open http://localhost:3000 to see the example app.
You then need to click the Install button to install it as a web app.

The easiest way to debug the app (on Mac OS X) is to run it from the
shell after installation like this::

    /Applications/FxPay.app/Contents/MacOS/webapprt -jsconsole

Using A Custom Webpay
---------------------

If you want to test payments against your local `Webpay`_ server
then you'll also need to `build a custom profile`_ with payments
preferences. To use the Simulator with your custom profile, go into
about:addons, click on Preferences for the
Firefox OS Simulator addon, and set the Gaia path to your custom built
profile.

.. _`App Manager`: https://developer.mozilla.org/en-US/Firefox_OS/Using_the_App_Manager
.. _`privileged`: https://developer.mozilla.org/en-US/Marketplace/Options/Packaged_apps#Privileged_app
.. _`Firefox OS`: https://developer.mozilla.org/en-US/Firefox_OS
.. _`fxpay`: https://github.com/mozilla/fxpay
.. _`Firefox Marketplace`: https://marketplace.firefox.com/
.. _Webpay: https://github.com/mozilla/webpay
.. _`build a custom profile`: https://webpay.readthedocs.org/en/latest/use_hosted_webpay.html#build-a-custom-b2g-profile
