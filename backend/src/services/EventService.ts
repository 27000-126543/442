import { query, queryOne, run } from '../database';
import { generateId, now } from '../utils';
import type { EventType, GameEvent } from '../types';

export class EventService {
  createEvent(
    type: EventType,
    title: string,
    description: string,
    impact: number = 0,
    companyId: string | null = null,
    departmentId: string | null = null
  ): GameEvent {
    const id = generateId();
    const timestamp = now();

    run(`
      INSERT INTO game_events (id, type, company_id, department_id, title, description, impact, timestamp, read)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
    `, [id, type, companyId, departmentId, title, description, impact, timestamp]);

    return {
      id, type, company_id: companyId, department_id: departmentId,
      title, description, impact, timestamp, read: false
    };
  }

  getCompanyEvents(companyId: string, limit: number = 50): GameEvent[] {
    return query(`
      SELECT * FROM game_events 
      WHERE company_id IS NULL OR company_id = ?
      ORDER BY timestamp DESC LIMIT ?
    `, [companyId, limit]) as GameEvent[];
  }

  markAsRead(eventId: string, companyId: string): boolean {
    const result = run(`
      UPDATE game_events SET read = 1 
      WHERE id = ? AND (company_id IS NULL OR company_id = ?)
    `, [eventId, companyId]);
    return result.changes > 0;
  }

  getUnreadCount(companyId: string): number {
    const row = queryOne(`
      SELECT COUNT(*) as count FROM game_events 
      WHERE (company_id IS NULL OR company_id = ?) AND read = 0
    `, [companyId]) as { count: number };
    return row.count;
  }
}

export const eventService = new EventService();
