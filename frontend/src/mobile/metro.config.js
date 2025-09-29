const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Add the common directory to the resolver
config.resolver.alias = {
  '@common': path.resolve(__dirname, '../common'),
};

// Allow imports from outside the project directory
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Add the common directory to watchFolders
config.watchFolders = [
  path.resolve(__dirname, '../common'),
];

module.exports = config;
