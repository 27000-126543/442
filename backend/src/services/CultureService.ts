import { query, queryOne, run } from '../database';
import { generateId, now, randomFloat, randomInt, clamp } from '../utils';
import { eventService } from './EventService';
import type { Artwork, Festival, DepartmentType } from '../types';

export class CultureService {

  createFestival(name: string, category: Festival['category'], durationDays: number): Festival {
    const id = generateId();
    const timestamp = now();
    const startTime = timestamp;
    const endTime = timestamp + durationDays * 24 * 60 * 60 * 1000;

    run(`
      INSERT INTO festivals (id, name, category, start_time, end_time, status, total_participants)
      VALUES (?, ?, ?, ?, ?, 'active', 0)
    `, [id, name, category, startTime, endTime]);

    eventService.createEvent(
      'festival_bonus',
      `跨宇宙艺术节「${name}」盛大开幕！`,
      `本届艺术节类别：${this.getCategoryLabel(category)}，诚邀各商会提交作品参赛！`,
      0
    );

    return { id, name, category, start_time: startTime, end_time: endTime, status: 'active', total_participants: 0 };
  }

  private getCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
      music: '音乐',
      dance: '舞蹈',
      food: '美食',
      art: '艺术',
      mixed: '综合'
    };
    return labels[category] || category;
  }

  getActiveFestivals(): Festival[] {
    return query("SELECT * FROM festivals WHERE status = 'active' ORDER BY start_time DESC") as Festival[];
  }

  getAllFestivals(): Festival[] {
    return query('SELECT * FROM festivals ORDER BY start_time DESC') as Festival[];
  }

  submitArtwork(
    companyId: string,
    creatorId: string,
    title: string,
    description: string,
    category: Artwork['category'],
    festivalId: string | null
  ): Artwork {
    const id = generateId();
    const timestamp = now();
    const creativityScore = clamp(randomInt(40, 100) + (festivalId ? 10 : 0), 0, 100);
    const totalScore = creativityScore;

    run(`
      INSERT INTO artworks (id, company_id, creator_id, title, description, category, creativity_score, audience_votes, total_score, share_count, festival_id, submitted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 0, ?, ?)
    `, [id, companyId, creatorId, title, description, category, creativityScore, totalScore, festivalId, timestamp]);

    if (festivalId) {
      run('UPDATE festivals SET total_participants = total_participants + 1 WHERE id = ?', [festivalId]);
    }

    return {
      id, company_id: companyId, creator_id: creatorId, title, description, category,
      creativity_score: creativityScore, audience_votes: 0, total_score: totalScore,
      share_count: 0, festival_id: festivalId, submitted_at: timestamp
    };
  }

  getCompanyArtworks(companyId: string): Artwork[] {
    return query('SELECT * FROM artworks WHERE company_id = ? ORDER BY submitted_at DESC', [companyId]) as Artwork[];
  }

  getAllArtworks(limit: number = 50): Artwork[] {
    return query('SELECT * FROM artworks ORDER BY total_score DESC LIMIT ?', [limit]) as Artwork[];
  }

  voteArtwork(artworkId: string, companyId: string): Artwork | null {
    const artwork = queryOne('SELECT * FROM artworks WHERE id = ?', [artworkId]) as Artwork | undefined;
    if (!artwork) return null;

    const newVotes = artwork.audience_votes + 1;
    const newScore = artwork.creativity_score * 0.6 + newVotes * 0.4;

    run(`
      UPDATE artworks SET audience_votes = ?, total_score = ? WHERE id = ?
    `, [newVotes, newScore, artworkId]);

    return { ...artwork, audience_votes: newVotes, total_score: newScore };
  }

  shareArtwork(artworkId: string): Artwork | null {
    const artwork = queryOne('SELECT * FROM artworks WHERE id = ?', [artworkId]) as Artwork | undefined;
    if (!artwork) return null;

    const newShareCount = artwork.share_count + 1;
    const bonus = clamp(Math.floor(newShareCount / 10) * 50, 0, 10000);

    run('UPDATE artworks SET share_count = ? WHERE id = ?', [newShareCount, artworkId]);
    
    if (bonus > 0) {
      run('UPDATE companies SET total_assets = total_assets + ? WHERE id = ?', [bonus, artwork.company_id]);
      this.recordIncome(artwork.company_id, bonus);
      eventService.createEvent(
        'festival_bonus',
        `作品「${artwork.title}」爆红全网！`,
        `累计转发量突破 ${newShareCount}，获得 ${bonus} 金币奖励！`,
        bonus,
        artwork.company_id
      );
    }

    return { ...artwork, share_count: newShareCount };
  }

  tickCulture(): void {
    const artworks = query("SELECT * FROM artworks WHERE submitted_at > ?", [now() - 7 * 24 * 60 * 60 * 1000]) as Artwork[];
    
    for (const artwork of artworks) {
      if (Math.random() < 0.05) {
        const bonusVotes = randomInt(1, 50);
        const newVotes = artwork.audience_votes + bonusVotes;
        const newScore = artwork.creativity_score * 0.6 + newVotes * 0.4;
        
        run(`
          UPDATE artworks SET audience_votes = ?, total_score = ? WHERE id = ?
        `, [newVotes, newScore, artwork.id]);
      }
    }

    const festivals = query("SELECT * FROM festivals WHERE status = 'active'") as Festival[];
    for (const festival of festivals) {
      if (now() > festival.end_time) {
        run("UPDATE festivals SET status = 'ended' WHERE id = ?", [festival.id]);
        
        const winner = queryOne(`
          SELECT a.*, c.name as company_name 
          FROM artworks a 
          JOIN companies c ON a.company_id = c.id 
          WHERE a.festival_id = ? 
          ORDER BY a.total_score DESC LIMIT 1
        `, [festival.id]) as any;

        if (winner) {
          const prize = randomInt(5000, 20000);
          run('UPDATE companies SET total_assets = total_assets + ? WHERE id = ?', [prize, winner.company_id]);
          this.recordIncome(winner.company_id, prize);
          
          eventService.createEvent(
            'festival_bonus',
            `艺术节「${festival.name}」完美落幕！`,
            `冠军作品：「${winner.title}」 by ${winner.company_name}，获得 ${prize} 金币奖金！`,
            prize
          );
        }
      }
    }
  }

  private recordIncome(companyId: string, amount: number) {
    const id = generateId();
    const timestamp = now();
    const dept: DepartmentType = 'culture';
    
    run(`
      INSERT INTO income_records (id, company_id, department, amount, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `, [id, companyId, dept, amount, timestamp]);

    run(`
      UPDATE departments SET weekly_income = weekly_income + ?
      WHERE company_id = ? AND type = ?
    `, [amount, companyId, dept]);
  }
}

export const cultureService = new CultureService();
