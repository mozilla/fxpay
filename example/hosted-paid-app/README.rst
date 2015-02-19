===============
Hosted Paid App
===============

This is an example of a `hosted app`_ that uses the fxpay library to
validate its receipt to ensure that users paid for the app.

Installation
------------

To run the example you'll need to first compress a
minified fxpay library, install some node modules, and start a web server.
Run these commands from the root of the repository::

    grunt compress
    cd example/hosted-paid-app
    npm install
    npm start

You can now open http://localhost:3001 to see the example app but by
launching the URL directly, no receipt will be installed.

To see a more realistic example, try installing the app with the
Firefox Marketplace `receipt tester`_.

If you install the app as a desktop web app,
the easiest way to debug it is to launch it from the
shell after installation like this::

    /Applications/FxPayHostedPaidApp.app/Contents/MacOS/webapprt -debug 6000

Then fire up the `WebIDE`_ and hook it up as a `remote runtime`_.
You'll need to accept a prompt and then you'll be able to use
the debugging tools.

.. _`hosted app`: https://developer.mozilla.org/en-US/Marketplace/Options/Hosted_apps
.. _`receipt tester`: https://marketplace.firefox.com/developers/test/receipts/
.. _`remote runtime`: https://developer.mozilla.org/en-US/docs/Tools/Remote_Debugging/Debugging_Firefox_Desktop
.. _`WebIDE`: https://developer.mozilla.org/en-US/docs/Tools/WebIDE
