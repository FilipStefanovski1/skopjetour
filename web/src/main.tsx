import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/fira-sans/400.css'
import '@fontsource/fira-sans/500.css'
import '@fontsource/fira-sans/600.css'
import '@fontsource/fira-sans-extra-condensed/600.css'
import '@fontsource/fira-sans-extra-condensed/700.css'
import '@fontsource/fira-sans-extra-condensed/800.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
