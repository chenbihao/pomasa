import { startServer } from './setup.js'

const PORT = parseInt(process.env.PORT || '3001', 10)
startServer(PORT)
