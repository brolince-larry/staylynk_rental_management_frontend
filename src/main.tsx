import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initDeviceFP } from './api/client'

void initDeviceFP()

createRoot(document.getElementById('root')!).render(
  <App />,
)
