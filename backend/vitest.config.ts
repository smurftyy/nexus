import path from 'path'

export default {
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared/src'),
      '@backend': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
  },
}
