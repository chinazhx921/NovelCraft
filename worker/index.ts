import { httpServerHandler } from 'cloudflare:node';
import app from '../server.ts';

// Express runs as an HTTP server inside the Workers runtime.
// Static files are served separately by Wrangler's Workers Static Assets.
app.listen(3000);

export default httpServerHandler({ port: 3000 });
