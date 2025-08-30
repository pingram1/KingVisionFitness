require('ts-node').register({
  transpileOnly: true,
  files: true
});
require('./src/server.ts');