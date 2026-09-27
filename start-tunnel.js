const localtunnel = require('localtunnel');

(async () => {
  try {
    const tunnel = await localtunnel({ port: 3000, subdomain: 'okdriver-cctv-command' });
    console.log('====================================================');
    console.log('🚀 LIVE PUBLIC URL:', tunnel.url);
    console.log('====================================================');

    tunnel.on('close', () => {
      console.log('Tunnel closed');
    });

    tunnel.on('error', (err) => {
      console.error('Tunnel error:', err);
    });
  } catch (err) {
    console.error('Error starting tunnel:', err);
  }
})();
