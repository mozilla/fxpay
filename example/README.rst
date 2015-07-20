============
Example Apps
============

These are some examples of `Firefox OS`_ web apps that work with the
fxpay library. Each app has its own README for how to install and
play around with them.

`hosted app with in-app purchases <hosted/>`_
    A hosted web app that can sell and restore in-app products.

`hosted paid app <hosted-paid-app/>`_
    A hosted web app that validates its receipt to ensure the user paid for it.

`packaged web app with in-app purchases <packaged-web/>`_
    A packaged app (``type: web``) that can sell and restore in-app products.

`privileged packaged app with in-app purchases <packaged/>`_
    A packaged app (``type: privileged``) that can sell and restore in-app products.

Using A Custom Webpay
---------------------

If you want to test payments against your local `Webpay`_ server
using these example apps then you'll also need to
`build a custom profile`_ with payments
preferences. To use the `Firefox OS Simulator`_ with your custom profile,
go into about:addons, click on Preferences for the
Firefox OS Simulator addon, and set the Gaia path to your custom built
profile.

.. _`Firefox OS`: https://developer.mozilla.org/en-US/Firefox_OS
.. _`Firefox OS Simulator`: https://developer.mozilla.org/en-US/docs/Tools/Firefox_OS_Simulator
.. _Webpay: https://github.com/mozilla/webpay
.. _`build a custom profile`: http://marketplace.readthedocs.org/en/latest/topics/payments.html#build-a-custom-b2g-profile
