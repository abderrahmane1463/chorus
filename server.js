/**
 * Entry point for hosts that run Node apps behind Passenger (Plesk, cPanel).
 *
 * Those panels start a file rather than an npm script, so `next start` is not
 * available to them. This boots the same production server programmatically
 * and listens on the port the panel provides.
 *
 * Not used on Vercel, which runs the app serverlessly and ignores this file.
 */
const { createServer } = require('node:http');

// Next ships ESM and CJS builds; interop differs by Node and Next version.
const nextImport = require('next');
const next = nextImport.default ?? nextImport;

const port = Number(process.env.PORT) || 3000;
const hostname = process.env.HOSTNAME || '0.0.0.0';

const app = next({ dev: false, dir: __dirname });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    createServer((req, res) => {
      handle(req, res).catch((error) => {
        console.error('[chorus] request failed', error);
        res.statusCode = 500;
        res.end('Internal Server Error');
      });
    }).listen(port, hostname, () => {
      console.log(`[chorus] ready on http://${hostname}:${port}`);
    });
  })
  .catch((error) => {
    console.error('[chorus] failed to start', error);
    process.exit(1);
  });
