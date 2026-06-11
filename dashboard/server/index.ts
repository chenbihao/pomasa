import { startServer } from './setup.js'

const PORT = parseInt(process.env.PORT || '3001', 10)
startServer(PORT, '127.0.0.1').then(({ accessToken }) => {
  if (accessToken) {
    console.log(`Access token: ${accessToken}`)
    console.log(`Full URL: http://localhost:${PORT}/?token=${accessToken}`)
  }
  console.log(`Server running at http://localhost:${PORT}`)
})
