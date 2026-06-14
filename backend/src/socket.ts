import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import { config } from './config';
import { transportService } from './services/TransportService';
import { financeService } from './services/FinanceService';
import { intelligenceService } from './services/IntelligenceService';
import { cultureService } from './services/CultureService';
import { eventService } from './services/EventService';
import { query } from './database';
import { verifyToken } from './utils';

let io: Server;
let tickTimer: NodeJS.Timeout | null = null;
let lastFinanceTick = 0;
let lastCultureTick = 0;

export function initSocket(server: HTTPServer) {
  io = new Server(server, {
    cors: {
      origin: config.corsOrigin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('未授权'));
    try {
      const decoded = verifyToken(token);
      (socket as any).user = decoded;
      next();
    } catch {
      next(new Error('无效令牌'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user;
    if (user?.company_id) {
      socket.join(`company:${user.company_id}`);
    }

    socket.on('subscribe:company', (companyId: string) => {
      socket.join(`company:${companyId}`);
    });

    socket.on('disconnect', () => {
      // cleanup if needed
    });
  });

  startGameLoop();
  return io;
}

function startGameLoop() {
  if (tickTimer) clearInterval(tickTimer);

  tickTimer = setInterval(() => {
    const nowTs = Date.now();

    try {
      const updatedCaravans = transportService.tickCaravans();
      for (const caravan of updatedCaravans) {
        io.to(`company:${caravan.company_id}`).emit('caravan:update', caravan);
      }

      const updatedSpies = intelligenceService.tickSpies();
      for (const spy of updatedSpies) {
        io.to(`company:${spy.company_id}`).emit('spy:update', spy);
      }

      if (nowTs - lastFinanceTick >= 60000) {
        financeService.tickFinance();
        lastFinanceTick = nowTs;
        io.emit('economy:update', financeService.getCurrentEconomicIndicators());
      }

      if (nowTs - lastCultureTick >= 30000) {
        cultureService.tickCulture();
        lastCultureTick = nowTs;
      }

      const companies = query<{ id: string }>('SELECT id FROM companies');
      for (const c of companies) {
        const unread = eventService.getUnreadCount(c.id);
        io.to(`company:${c.id}`).emit('events:unread', { count: unread });
      }

      io.emit('tick', { timestamp: nowTs });
    } catch (err) {
      console.error('Game tick error:', err);
    }
  }, config.tickInterval);
}

export function broadcastCompanyEvent(companyId: string, event: string, data: any) {
  if (io) {
    io.to(`company:${companyId}`).emit(event, data);
  }
}

export function broadcastGlobalEvent(event: string, data: any) {
  if (io) {
    io.emit(event, data);
  }
}

export function stopGameLoop() {
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
}
