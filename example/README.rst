===========
Example App
===========

This is an example `Firefox OS`_ web app that can do in-app payments
without hosting its own server. Since it needs to do cross-origin API
requests, the app must be `privileged`_ which makes it a type of
packaged app.

Installation
------------

To install a privileged app it must be signed by something like
`Firefox Marketplace`_. However, you can use the
`App Manager`_ to install it as well. First, build this example into a
packaged app. Run this from the root of the `fxpay`_ repository
after you've installed the developer tools listed in the main README::

    grunt package

This will create ``build/application`` and ``build/application.zip``.
You can install the app from that directory using the App Manager.

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
