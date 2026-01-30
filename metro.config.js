const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Ensure Metro can resolve react-dom/client (package.json "exports" subpath).
// Some dev tooling (e.g. error overlay) requires it.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react-dom/client') {
    const clientPath = path.resolve(
      __dirname,
      'node_modules/react-dom/client.js'
    );
    return { type: 'sourceFile', filePath: clientPath };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
