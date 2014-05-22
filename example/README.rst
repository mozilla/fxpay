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
packaged app. Run this from the root of the `fxpay`_ repository::

    grunt package

This will create ``build/application`` and ``build/application.zip``.
You can install the app from that directory using the App Manager.

.. _`App Manager`: https://developer.mozilla.org/en-US/Firefox_OS/Using_the_App_Manager
.. _`privileged`: https://developer.mozilla.org/en-US/Marketplace/Options/Packaged_apps#Privileged_app
.. _`Firefox OS`: https://developer.mozilla.org/en-US/Firefox_OS
.. _`fxpay`: https://github.com/mozilla/fxpay
.. _`Firefox Marketplace`: https://marketplace.firefox.com/
