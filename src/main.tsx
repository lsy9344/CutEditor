import React from 'react'
import ReactDOM from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import App from './App.tsx'
import { DEFAULT_FONT, fontLoader } from './utils/fontLoader'
import './components/components.css'

// 폰트 목록보다 먼저 넣은 글씨도 저장 때 기본 글꼴 파일을 기다리도록 이름만 등록한다(파일은 받지 않는다).
fontLoader.register([DEFAULT_FONT])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <Analytics />
    <SpeedInsights />
  </React.StrictMode>,
)
