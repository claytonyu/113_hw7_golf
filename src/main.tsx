/**
 * Entry point: mounts the React app into #root in index.html.
 */
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

createRoot(document.getElementById('root')!).render(<App />)
