import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { GlobalProvider } from './GlobalContext.tsx'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { ChakraProvider } from '@chakra-ui/react'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GlobalProvider>
      <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
        <ChakraProvider>
          <App />
        </ChakraProvider>
      </GoogleOAuthProvider>
    </GlobalProvider>
  </StrictMode>,
)
