import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const configDir = dirname(fileURLToPath(import.meta.url))
const productionEnvFile = '.env.production'
const productionOnlyEnvKeys = ['VITE_LONGDO_MAP_KEY']

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return {}
  }

  return readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .reduce((env, line) => {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)?\s*$/)

      if (!match) {
        return env
      }

      const [, key, rawValue = ''] = match
      const value = rawValue
        .replace(/\s+#.*$/, '')
        .trim()
        .replace(/^(['"])(.*)\1$/, '$2')

      env[key] = value
      return env
    }, {})
}

function getProductionEnvDefines(mode) {
  if (mode !== 'production') {
    return {}
  }

  const productionEnv = parseEnvFile(resolve(configDir, productionEnvFile))

  return productionOnlyEnvKeys.reduce((defines, key) => {
    defines[`import.meta.env.${key}`] = JSON.stringify(productionEnv[key] ?? '')
    return defines
  }, {})
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  define: getProductionEnvDefines(mode),
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api-proxy': {
        target: 'http://d-poms.diw.go.th',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-proxy/, '/api'),
      },
    },
  },
  preview: {
    port: 5174,
    proxy: {
      '/api-proxy': {
        target: 'http://d-poms.diw.go.th',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-proxy/, '/api'),
      },
    },
  },
}))
