export interface ReportHeader {
  date: string;
  shift: 'morning' | 'afternoon';
  supervisor: string;
  unit: string;
}

export interface Collaborator {
  name: string;
  tested: number;
  approved: number;
  rejected: number;
  cleaned: number;
  resetados: number;
  v9: number;
}

export interface ReportObservations {
  issues: string;
  highlights: string;
  attentionPoints: string;
}

export interface ReportSummary {
  totalTested: number;
  totalApproved: number;
  totalRejected: number;
  totalV9: number;
  totalReset: number;
  totalCleaning: number;
  totalEquipment: number;
  testedEquipment: number;
  cleanedEquipment: number;
  resetEquipment: number;
  v9Equipment: number;
  totalCollaborators: number;
  morningCollaborators: number;
  afternoonCollaborators: number;
}

export interface ReportData {
  header: ReportHeader;
  morning: Collaborator[];
  afternoon: Collaborator[];
  observations: ReportObservations;
  summary: ReportSummary;
} 