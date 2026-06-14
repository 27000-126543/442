import express from 'express';
import cors from 'cors';
import http from 'http';
import { config } from './config';
import { initDatabase } from './database';
import { initSocket } from './socket';
import authRoutes from './routes/auth';
import gameRoutes from './routes/game';

async function bootstrap() {
  await initDatabase();

  const app = express();
  const server = http.createServer(app);

  app.use(cors({
    origin: config.corsOrigin,
    credentials: true,
  }));
  app.use(express.json({ limit: '10mb' }));

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/game', gameRoutes);

  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('API Error:', err);
    res.status(500).json({ error: err.message || '服务器内部错误' });
  });

  initSocket(server);

  server.listen(config.port, () => {
    console.log(`🚀 跨维度商业帝国后端服务已启动: http://localhost:${config.port}`);
    console.log(`📡 WebSocket 服务已就绪`);
  });
}

bootstrap().catch(console.error);
