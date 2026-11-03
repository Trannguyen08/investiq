/**
 * Types for Investor Persona, Risk Assessment, Trading Discipline, and Readiness Evaluation.
 */

export interface InvestorPersona {
  code: string;
  title: string;
  tagline: string;
  description: string;
  strengths: string[];
  weaknesses: string[];
  recommended_strategy: string;
  asset_allocation: {
    stocks: number;
    gold: number;
    savings: number;
  };
  ideal_time_hours_per_week: number;
  suitable_instruments: string[];
}

export interface AssessmentOption {
  id: string;
  label: string;
  risk_weight: number;
  persona_weights: Record<string, number>;
}

export interface AssessmentQuestion {
  id: string;
  sort_order: number;
  category: string;
  prompt: string;
  subtext?: string | null;
  options: AssessmentOption[];
  status: "published" | "draft";
}

export interface DisciplineMetrics {
  cut_loss_score: number;
  diversification_score: number;
  cash_management_score: number;
  emotional_pacing_score: number;
  overall_discipline_score: number;
  badge: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

export interface ReadinessEvaluation {
  id: string;
  persona: InvestorPersona;
  risk_score: number;
  knowledge_score: number;
  discipline_score: number;
  overall_readiness_score: number;
  readiness_level: "not_ready" | "needs_training" | "ready_starter" | "disciplined_investor";
  readiness_label: string;
  verdict_summary: string;
  can_trade_real_money: boolean;
  recommended_action: string;
  created_at: string;
  answers: Record<string, string>;
}

export interface SubmitAssessmentPayload {
  answers: Record<string, string>;
  guest_identifier?: string;
  knowledge_score?: number;
  discipline_score?: number;
}

export interface AdminAssessmentSummaryItem {
  id: string;
  user_id?: string | null;
  guest_identifier?: string | null;
  persona_code: string;
  persona_title: string;
  risk_score: number;
  knowledge_score: number;
  discipline_score: number;
  readiness_score: number;
  readiness_level: string;
  readiness_label: string;
  can_trade_real_money: boolean;
  created_at: string;
}

export interface AdminAssessmentStats {
  total_assessments: number;
  average_readiness_score: number;
  ready_percentage: number;
  top_persona_code: string;
  top_persona_title: string;
  persona_distribution: Record<string, number>;
}

export interface AdminAssessmentPage {
  items: AdminAssessmentSummaryItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}
