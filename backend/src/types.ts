export type DepartmentType = 'transport' | 'finance' | 'intelligence' | 'culture';

export type ApprovalLevel = 1 | 2 | 3;

export type UserRole = 'president' | 'vice_president' | 'finance_officer' | 'director' | 'member';

export type CaravanStatus = 'idle' | 'traveling' | 'trading' | 'attacked' | 'returning';

export type SpyStatus = 'idle' | 'infiltrating' | 'exposed' | 'captured' | 'returning';

export type EventType = 
  | 'caravan_attack'
  | 'caravan_bonus'
  | 'financial_tsunami'
  | 'inflation'
  | 'deflation'
  | 'spy_caught'
  | 'spy_success'
  | 'counter_intelligence'
  | 'subversion'
  | 'festival_bonus'
  | 'market_boom';

export interface User {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  company_id: string | null;
  role: UserRole;
  created_at: number;
  last_login: number;
}

export interface Company {
  id: string;
  name: string;
  owner_id: string;
  total_assets: number;
  influence: number;
  level: number;
  created_at: number;
}

export interface Department {
  id: string;
  company_id: string;
  type: DepartmentType;
  name: string;
  level: number;
  director_id: string | null;
  budget: number;
  weekly_income: number;
  created_at: number;
}

export interface ApprovalFlow {
  id: string;
  company_id: string;
  department_id: string | null;
  title: string;
  description: string;
  required_level: ApprovalLevel;
  status: 'pending' | 'approved' | 'rejected';
  approver_level_1: string | null;
  approver_level_2: string | null;
  approver_level_3: string | null;
  approved_level_1: boolean;
  approved_level_2: boolean;
  approved_level_3: boolean;
  payload: string;
  created_at: number;
  resolved_at: number | null;
}

export interface Portal {
  id: string;
  company_id: string;
  name: string;
  source_dimension: string;
  target_dimension: string;
  risk_level: number;
  capacity: number;
  status: 'active' | 'maintenance' | 'damaged';
  created_at: number;
}

export interface Caravan {
  id: string;
  company_id: string;
  name: string;
  portal_id: string;
  goods_value: number;
  guard_power: number;
  status: CaravanStatus;
  current_position: number;
  total_distance: number;
  progress: number;
  estimated_arrival: number;
  created_at: number;
}

export interface BankAccount {
  id: string;
  company_id: string;
  balance: number;
  interest_rate: number;
  created_at: number;
}

export interface Bond {
  id: string;
  company_id: string;
  face_value: number;
  interest_rate: number;
  maturity_date: number;
  issued_at: number;
  status: 'active' | 'matured' | 'defaulted';
}

export interface Loan {
  id: string;
  company_id: string;
  lender_company_id: string;
  principal: number;
  interest_rate: number;
  remaining_amount: number;
  due_date: number;
  created_at: number;
  status: 'active' | 'paid' | 'defaulted';
}

export interface Spy {
  id: string;
  company_id: string;
  name: string;
  skill: number;
  stealth: number;
  exposure_risk: number;
  target_company_id: string | null;
  status: SpyStatus;
  mission: string | null;
  created_at: number;
}

export interface Artwork {
  id: string;
  company_id: string;
  creator_id: string;
  title: string;
  description: string;
  category: 'music' | 'dance' | 'food' | 'art';
  creativity_score: number;
  audience_votes: number;
  total_score: number;
  share_count: number;
  festival_id: string | null;
  submitted_at: number;
}

export interface Festival {
  id: string;
  name: string;
  category: 'music' | 'dance' | 'food' | 'art' | 'mixed';
  start_time: number;
  end_time: number;
  status: 'upcoming' | 'active' | 'ended';
  total_participants: number;
}

export interface CommercialTower {
  id: string;
  company_ids: string;
  level: number;
  total_contribution: number;
  required_contribution: number;
  upgrade_status: 'idle' | 'ready' | 'awaiting_approval' | 'upgrading';
  created_at: number;
}

export interface TowerContribution {
  id: string;
  tower_id: string;
  company_id: string;
  amount: number;
  contributed_at: number;
}

export interface GameEvent {
  id: string;
  type: EventType;
  company_id: string | null;
  department_id: string | null;
  title: string;
  description: string;
  impact: number;
  timestamp: number;
  read: boolean;
}

export interface EconomicIndicator {
  id: string;
  timestamp: number;
  global_interest_rate: number;
  inflation_rate: number;
  market_volume: number;
  market_index: number;
}

export interface IncomeRecord {
  id: string;
  company_id: string;
  department: DepartmentType;
  amount: number;
  timestamp: number;
}

export interface LeaderboardEntry {
  company_id: string;
  company_name: string;
  total_assets: number;
  transport_level: number;
  finance_level: number;
  intelligence_level: number;
  culture_level: number;
  influence: number;
  rank: number;
}
