const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const os = require('os');

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

// Add virtual module for dev server config
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Create virtual module for dev server IP
config.serializer.customSerializer = (() => {
    const defaultSerializer = config.serializer.customSerializer;
    
    return (entryPoint, preModules, graph, options) => {
        // Add virtual module for dev server config
        const devServerConfig = `
            module.exports = {
                DEV_SERVER_IP: "${getLocalIP()}",
                DEV_SERVER_PORT: "8301"
            };
        `;
        
        // Inject the virtual module
        const virtualModule = {
            path: 'virtual:dev-server-config',
            dependencies: new Set(),
            output: [{
                type: 'js/module',
                data: {
                code: devServerConfig,
                map: null,
                },
            }],
        };
        
        preModules.push(virtualModule);
        
        return defaultSerializer ? defaultSerializer(entryPoint, preModules, graph, options) : '';
    };
})();

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    
    return 'localhost';
}

module.exports = config;
