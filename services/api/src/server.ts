import { app, prisma } from './app.js';
import { config } from './config.js';
const server = app.listen(config.API_PORT, () => console.log(`FlowForge API listening on ${config.API_PORT}`));
const shutdown = async () => { server.close(); await prisma.$disconnect(); process.exit(0); };
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
