#!/usr/bin/env node

/**
 * Simple local server for Fluid.io Statement
 * 
 * Usage:
 *   node serve.js
 *   node serve.js 3000  # Custom port
 * 
 * Or with npm:
 *   npm start
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.argv[2] || 8000;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
};

const server = http.createServer((req, res) => {
  // Default to index.html
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(__dirname, filePath);

  // Security: prevent directory traversal
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('Not Found');
      } else {
        res.writeHead(500);
        res.end('Server Error');
      }
      return;
    }

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║     Fluid.io Statement - Local Server                   ║
╠════════════════════════════════════════════════════════╣
║                                                        ║
║  🌐 Open in your browser:                              ║
║     http://localhost:${PORT}                              ║
║                                                        ║
║  📁 Serving files from:                                ║
║     ${__dirname}
║                                                        ║
║  ⏹  Press Ctrl+C to stop                              ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
`);
});
