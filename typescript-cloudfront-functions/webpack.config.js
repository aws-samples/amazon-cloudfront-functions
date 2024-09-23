const path = require('path')
const fs = require('fs')

// Create a separate entry for each TS CloudFront Function in src/
const entry = Object.fromEntries(fs.readdirSync('./src')
  .filter(filename => path.extname(filename) === '.ts')
  .map(filename => [path.parse(filename).name, `./src/${filename}`])
)

module.exports = {
  entry,
  mode: 'production',
  module: {
    rules: [{
      test: /\.ts$/,
      use: 'ts-loader',
      exclude: /node_modules/
    }]
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    chunkFormat: 'module',
    library: {
      name: 'handler',
      type: 'var',
      export: 'default'
    }
  },
  target: 'es5'
}
