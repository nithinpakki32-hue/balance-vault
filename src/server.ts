import { createApp } from './app.js';
import { config } from './config/env.js';
import { prisma } from './lib/prisma.js';

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 BalanceVault Server running in [${config.nodeEnv}] mode`);
  console.log(`📡 API listening at http://localhost:${config.port}`);
  console.log(`🏥 Health Check:   http://localhost:${config.port}/api/health`);
  console.log(`🚥 Readiness:      http://localhost:${config.port}/api/ready`);
  console.log(`🔒 RBAC Admin:     http://localhost:${config.port}/api/admin/users`);
  console.log(`======================================================\n`);
});

// Graceful Shutdown
const handleShutdown = async (signal: string) => {
  console.log(`\nReceived ${signal}. Gracefully shutting down BalanceVault...`);
  server.close(async () => {
    console.log('HTTP server closed.');
    await prisma.$disconnect();
    console.log('Database connections closed.');
    process.exit(0);
  });

  // Force shutdown after 10s if dangling
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
