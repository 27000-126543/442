import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { config } from './config';
import type { User, UserRole } from './types';

export const generateId = (): string => uuidv4();

export const now = (): number => Date.now();

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 10);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const generateToken = (user: Pick<User, 'id' | 'username' | 'company_id' | 'role'>): string => {
  return jwt.sign(
    { id: user.id, username: user.username, company_id: user.company_id, role: user.role },
    config.jwtSecret as any,
    { expiresIn: config.jwtExpiresIn as any }
  );
};

export const verifyToken = (token: string): any => {
  return jwt.verify(token, config.jwtSecret);
};

export const randomInt = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

export const randomFloat = (min: number, max: number): number => {
  return Math.random() * (max - min) + min;
};

export const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

export const canApprove = (role: UserRole, requiredLevel: number): boolean => {
  const roleLevel: Record<UserRole, number> = {
    president: 3,
    vice_president: 2,
    finance_officer: 3,
    director: 1,
    member: 0,
  };
  return roleLevel[role] >= requiredLevel;
};

export const formatNumber = (num: number): string => {
  if (num >= 1000000000) return (num / 1000000000).toFixed(2) + 'B';
  if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(2) + 'K';
  return num.toFixed(2);
};
