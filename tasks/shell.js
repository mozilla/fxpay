var proc = require('child_process');


module.exports = function shell(cmd, args, callback) {
  proc.exec(cmd + ' ' + args.join(' '),
            function(err, stdout, stderr) {
    if (err) {
      console.error('Ran:', cmd, args);
      console.error('output', stderr, stdout);
      throw err;
    }
    callback(stdout);
  });
};
