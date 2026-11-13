require('esbuild').buildSync({ entryPoints: ['auth-client.js'], bundle: true, minify: true,
  platform: 'browser', outfile: 'public/auth-client.js', legalComments: 'eof' });
