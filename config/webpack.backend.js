var paths = require('./paths');
var webpack = require('webpack');

module.exports = {
    entry: paths.serverIndexJs,
    target: 'node',
    node: {
        __dirname: false,
        __filename: false,
    },
    output: {
        path: paths.backendBuild,
        filename: 'server.js'
    },
    module: {
        loaders: [
            {
                test: /\.json$/,
                loader: 'json'
            },
        ],
    },
    plugins: [
        new webpack.DefinePlugin({
            'process.env.NODE_ENV': JSON.stringify('production'),
        }),
    ],
};
