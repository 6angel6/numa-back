import logger from './logger';
import { db } from '../config/database';
import { redisClient } from '../config/redis';
import { Server } from 'http';

let isShuttingDown = false;
const activeRequests = new Set<string>();
const SHUTDOWN_TIMEOUT = 30000; // 30 seconds
const CHECK_INTERVAL = 500; // 500ms

export const setupGracefulShutdown = (
   server: Server,
   onShutdown?: () => Promise<void>,
): void => {
   const shutdown = async (signal: string) => {
      if (isShuttingDown) {
         logger.warn({ signal }, 'Shutdown already in progress, ignoring');
         return;
      }
      isShuttingDown = true;

      logger.info(
         { signal, activeRequests: activeRequests.size },
         'Graceful shutdown initiated',
      );

      server.close((err) => {
         if (err) {
            logger.error({ error: err }, 'Error closing HTTP server');
         } else {
            logger.info(
               'HTTP server closed, no longer accepting new connections',
            );
         }
      });

      const forceShutdownTimeout = setTimeout(() => {
         logger.warn(
            { activeRequests: activeRequests.size },
            'Shutdown timeout reached, forcing exit',
         );
         process.exit(1);
      }, SHUTDOWN_TIMEOUT);

      forceShutdownTimeout.unref();

      const waitForRequests = async () => {
         while (activeRequests.size > 0) {
            logger.info(
               { activeRequests: activeRequests.size },
               'Waiting for active requests to complete...',
            );
            await new Promise((resolve) => setTimeout(resolve, CHECK_INTERVAL));
         }
      };

      try {
         await waitForRequests();
         clearTimeout(forceShutdownTimeout);
         await closeConnections();
      } catch (error) {
         logger.error({ error }, 'Error during graceful shutdown');
         process.exit(1);
      }
   };

   const closeConnections = async (): Promise<void> => {
      if (onShutdown) {
         try {
            logger.info('Shutting down workers...');
            await onShutdown();
            logger.info('Workers shut down successfully');
         } catch (error) {
            logger.error({ error }, 'Error shutting down workers');
         }
      }

      const closePromises: Promise<void>[] = [];

      closePromises.push(
         (async () => {
            try {
               logger.info('Closing database connections...');
               await db.close();
               logger.info('Database connections closed');
            } catch (error) {
               logger.error({ error }, 'Error closing database');
               throw error;
            }
         })(),
      );

      closePromises.push(
         (async () => {
            try {
               logger.info('Closing Redis connection...');
               await redisClient.quit();
               logger.info('Redis connection closed');
            } catch (error) {
               logger.error({ error }, 'Error closing Redis');
               throw error;
            }
         })(),
      );

      try {
         await Promise.all(closePromises);
         logger.info('All connections closed successfully');
         process.exit(0);
      } catch (error) {
         logger.error({ error }, 'Failed to close all connections');
         process.exit(1);
      }
   };

   process.once('SIGTERM', () => shutdown('SIGTERM'));
   process.once('SIGINT', () => shutdown('SIGINT'));

   process.on('uncaughtException', (error) => {
      logger.fatal({ error }, 'Uncaught exception, shutting down');
      shutdown('UNCAUGHT_EXCEPTION');
   });

   process.on('unhandledRejection', (reason, promise) => {
      logger.fatal({ reason, promise }, 'Unhandled rejection, shutting down');
      shutdown('UNHANDLED_REJECTION');
   });
};
