const path = require('path');
const webpack = require('webpack');

module.exports = {
  mode: 'production',
  target: 'node',
  entry: './src/server.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'server.js',
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  module: {
    rules: [
      {
        test: /.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  optimization: {
    minimize: true,
    usedExports: true,
    sideEffects: false,
    innerGraph: true,
    providedExports: true,
    // Aggressive tree shaking
    concatenateModules: true,
    mangleExports: true,
  },
  externals: {
    // Mark large dependencies as external
    express: 'commonjs express',
    bcryptjs: 'commonjs bcryptjs',
    jsonwebtoken: 'commonjs jsonwebtoken',
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('production'),
    }),
    new webpack.IgnorePlugin({
      // Ignore optional dependencies
      resourceRegExp: /^\.(md|txt|LICENSE)$/,
    }),
  ],
};
