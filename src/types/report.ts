export interface OperatorData {
  name: string;
  tested: number;
  approved: number;
  rejected: number;
  cleaned: number;
  resetados: number;
  v9: number;
}

export interface DashboardData {
  totalTested: number;
  totalApproved: number;
  totalRejected: number;
  totalCleaned: number;
  totalResetados: number;
  totalV9: number;
  approvalRate: number;
  rejectionRate: number;
  date: string;
}

export interface Report {
  _id?: string;
  header: {
    date: string;
    supervisor: string;
    unit: string;
    shift: 'morning' | 'afternoon';
  };
  morning: OperatorData[];
  afternoon: OperatorData[];
  dashboardData: DashboardData;
  createdAt: string;
  updatedAt: string;
} 