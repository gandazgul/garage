const paths = require('./paths');
const webpack = require('webpack');
const UglifyJSPlugin = require('uglifyjs-webpack-plugin');

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
            // {
            //     test: /\.js$/,
            //     loader: 'babel-loader',
            //     exclude: /node_modules/,
            //     include: /node_modules\/websocket-stream\/node_modules\/ws\/lib\/.*\.js$/
            // },
            {
                test: /node_modules\/mqtt\/.*\.js$/,
                loaders: ['shebang-loader'],
            },
            {
                test: /\.json$/,
                loader: 'json-loader'
            },
        ],
    },
    plugins: [
        new webpack.DefinePlugin({
            'process.env.NODE_ENV': JSON.stringify('production'),
        }),
        // new UglifyJSPlugin(),
    ],
};
