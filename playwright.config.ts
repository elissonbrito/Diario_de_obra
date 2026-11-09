import { defineConfig, devices } from '@playwright/test'

// Dois projetos: 'unidade' (funções puras, sem navegador) e 'e2e' (app real servido pelo `vite preview`).
export default defineConfig({
  timeout: 60_000,
  reporter: 'list',
  projects: [
    { name: 'unidade', testDir: 'tests/unit' },
    {
      name: 'e2e',
      testDir: 'tests/e2e',
      use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium', baseURL: 'http://localhost:4173', locale: 'pt-BR' },
    },
  ],
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
