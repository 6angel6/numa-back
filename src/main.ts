import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import express from 'express';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import { load as loadYaml } from 'js-yaml';
import fs from 'fs';
import pinoHttp from 'pino-http';
import { v4 as uuidv4 } from 'uuid';
import http from 'http';
import compression from 'compression';
import path from 'path';

import mainRouter from './routers';
import { setupAssociations } from '../shared/models/Associations';
import { errorHandler } from '../shared/middleware/errorHandler';
import { healthCheck } from '../shared/middleware/healthCheck';
import { setupGracefulShutdown } from '../shared/utils/gracefulShutdown';
import logger from '../shared/utils/logger';

dotenv.config();

const PORT = process.env.PORT || 5000;

export const app = express();

app.use(
   cors({
      credentials: true,
      origin: process.env.CORS_ORIGIN ?? true,
   }),
);

app.use(helmet());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use((req, res: any, next) => {
   const originalJson = res.json.bind(res);
   res.json = function (body: unknown) {
      res._body = body;
      return originalJson(body);
   };
   next();
});

app.use(
   pinoHttp({
      logger,
      autoLogging: {
         ignore: (req) =>
            req.url === '/api/v1/health' || req.url === '/metrics',
      },
      genReqId: (req, res) => {
         const id = (req.headers['x-request-id'] as string) || uuidv4();
         res.setHeader('X-Request-ID', id);
         return id;
      },
      customProps: (req: any) => ({ traceId: req.id }),
      serializers: {
         req(req: any) {
            const serialized: Record<string, unknown> = {
               id: req.id,
               method: req.method,
               url: req.url,
               query: req.query,
               userId: req.user?.id,
            };
            if (req.body && Object.keys(req.body).length > 0) {
               const sanitized = { ...req.body };
               if (sanitized.password) sanitized.password = '***';
               if (sanitized.token) sanitized.token = '***';
               if (sanitized.otp) sanitized.otp = '***';
               serialized.body = sanitized;
            }
            return serialized;
         },
         res(res: any) {
            const serialized: Record<string, unknown> = {
               statusCode: res.statusCode,
            };
            if (res._body) {
               if (res.statusCode >= 400) {
                  serialized.body = res._body;
               } else if (process.env.NODE_ENV !== 'production') {
                  serialized.body = res._body;
               }
            }
            return serialized;
         },
      },
      customSuccessMessage: (_req, res: any) =>
         res.statusCode >= 400
            ? `request failed with status ${res.statusCode}`
            : 'request completed',
      customErrorMessage: (_req, _res, err) => `request error: ${err.message}`,
   }),
);

app.use(compression());
app.use(express.static(path.join(process.cwd(), 'public')));

app.use('/api/v1', mainRouter);
app.get('/api/v1/health', healthCheck);

// Main API docs (e-commerce)
const swaggerDocument = loadYaml(fs.readFileSync('./swagger.yaml', 'utf8'));
app.use('/api/v1/api-docs', swaggerUi.serveFiles(swaggerDocument as any), swaggerUi.setup(swaggerDocument as any));
logger.info('Swagger UI available at /api/v1/api-docs');

// Restaurant & Nutrition Delivery API docs
const swaggerRestaurants = loadYaml(fs.readFileSync('./swagger-restaurants.yaml', 'utf8'));
app.use('/api/v1/api-docs-restaurants', swaggerUi.serveFiles(swaggerRestaurants as any), swaggerUi.setup(swaggerRestaurants as any));
logger.info('Restaurant/Nutrition API docs available at /api/v1/api-docs-restaurants');

// Nutrition (FoodTech) API docs - отдельная документация
const swaggerNutrition = loadYaml(fs.readFileSync('./swagger-nutrition.yaml', 'utf8'));
app.use('/api/v1/api-docs-nutrition', swaggerUi.serveFiles(swaggerNutrition as any), swaggerUi.setup(swaggerNutrition as any));
logger.info('Nutrition API docs available at /api/v1/api-docs-nutrition');

app.use(errorHandler);

const server = http.createServer(app);

const startServer = async (): Promise<void> => {
   try {
      setupAssociations();
      logger.info('Model associations configured');

      server.listen(PORT, () => {
         logger.info({ port: PORT, env: process.env.NODE_ENV ?? 'development' }, 'Server started');
      });

      setupGracefulShutdown(server);
   } catch (error) {
      logger.error({ err: error }, 'Failed to start server');
      process.exit(1);
   }
};

startServer();
