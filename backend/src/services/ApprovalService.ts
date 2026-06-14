import { query, queryOne, run } from '../database';
import { generateId, now, canApprove } from '../utils';
import type { ApprovalFlow, ApprovalLevel, UserRole } from '../types';

export class ApprovalService {

  createApproval(
    companyId: string,
    title: string,
    description: string,
    requiredLevel: ApprovalLevel,
    payload: any,
    departmentId: string | null = null
  ): ApprovalFlow {
    const id = generateId();
    const timestamp = now();
    const payloadStr = JSON.stringify(payload);

    run(`
      INSERT INTO approval_flows (
        id, company_id, department_id, title, description, required_level,
        status, approver_level_1, approver_level_2, approver_level_3,
        approved_level_1, approved_level_2, approved_level_3, payload, created_at, resolved_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', NULL, NULL, NULL, 0, 0, 0, ?, ?, NULL)
    `, [id, companyId, departmentId, title, description, requiredLevel, payloadStr, timestamp]);

    return {
      id, company_id: companyId, department_id: departmentId, title, description,
      required_level: requiredLevel, status: 'pending',
      approver_level_1: null, approver_level_2: null, approver_level_3: null,
      approved_level_1: false, approved_level_2: false, approved_level_3: false,
      payload: payloadStr, created_at: timestamp, resolved_at: null
    };
  }

  getCompanyApprovals(companyId: string, status?: string): ApprovalFlow[] {
    if (status) {
      return query('SELECT * FROM approval_flows WHERE company_id = ? AND status = ? ORDER BY created_at DESC', [companyId, status]) as ApprovalFlow[];
    }
    return query('SELECT * FROM approval_flows WHERE company_id = ? ORDER BY created_at DESC', [companyId]) as ApprovalFlow[];
  }

  getApprovalById(id: string): ApprovalFlow | undefined {
    return queryOne('SELECT * FROM approval_flows WHERE id = ?', [id]) as ApprovalFlow | undefined;
  }

  approve(approvalId: string, userId: string, role: UserRole): ApprovalFlow | null {
    const approval = this.getApprovalById(approvalId);
    if (!approval || approval.status !== 'pending') return null;

    const roleLevel: Record<UserRole, number> = {
      president: 3,
      vice_president: 2,
      finance_officer: 3,
      director: 1,
      member: 0,
    };
    const approverLevel = roleLevel[role];
    if (approverLevel === 0) return null;
    if (!canApprove(role, approval.required_level)) return null;

    let l1 = approval.approved_level_1;
    let l2 = approval.approved_level_2;
    let l3 = approval.approved_level_3;
    let a1 = approval.approver_level_1;
    let a2 = approval.approver_level_2;
    let a3 = approval.approver_level_3;

    if (approverLevel >= 1 && !l1) { l1 = true; a1 = userId; }
    if (approverLevel >= 2 && !l2) { l2 = true; a2 = userId; }
    if (approverLevel >= 3 && !l3) { l3 = true; a3 = userId; }

    const neededL1 = approval.required_level >= 1;
    const neededL2 = approval.required_level >= 2;
    const neededL3 = approval.required_level >= 3;

    const fullyApproved =
      (!neededL1 || l1) && (!neededL2 || l2) && (!neededL3 || l3);

    const timestamp = now();

    run(`
      UPDATE approval_flows SET
        approver_level_1 = ?, approver_level_2 = ?, approver_level_3 = ?,
        approved_level_1 = ?, approved_level_2 = ?, approved_level_3 = ?,
        status = ?, resolved_at = ?
      WHERE id = ?
    `, [
      a1, a2, a3,
      l1 ? 1 : 0, l2 ? 1 : 0, l3 ? 1 : 0,
      fullyApproved ? 'approved' : 'pending',
      fullyApproved ? timestamp : null,
      approvalId
    ]);

    return this.getApprovalById(approvalId) || null;
  }

  reject(approvalId: string, userId: string, role: UserRole): ApprovalFlow | null {
    const approval = this.getApprovalById(approvalId);
    if (!approval || approval.status !== 'pending') return null;
    if (!canApprove(role, approval.required_level)) return null;

    run("UPDATE approval_flows SET status = 'rejected', resolved_at = ? WHERE id = ?", [now(), approvalId]);
    return this.getApprovalById(approvalId) || null;
  }
}

export const approvalService = new ApprovalService();
