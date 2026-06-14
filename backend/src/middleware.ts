import { Request, Response, NextFunction } from 'express';
import { verifyToken } from './utils';
import { queryOne } from './database';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        company_id: string | null;
        role: string;
      };
    }
  }
}

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    const user = await queryOne(
      'SELECT id, username, company_id, role FROM users WHERE id = ?',
      [decoded.id]
    );
    if (!user) {
      return res.status(401).json({ error: '用户不存在' });
    }
    req.user = user as any;
    next();
  } catch (error) {
    return res.status(401).json({ error: '无效或过期的令牌' });
  }
};

export const requireCompany = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user?.company_id) {
    return res.status(403).json({ error: '您还没有加入任何商会' });
  }
  next();
};
