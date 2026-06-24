export interface Clinic {
  id: string; name: string; phone: string; address?: string;
  timezone: string; defaultLanguage: string; supportedLangs: string[];
  isActive: boolean; createdAt: string; updatedAt: string;
}


export interface BotMessage {
  id: string; clinicId: string; key: string; body: string;
  language: string; updatedAt: string;
}

export interface Specialty {
  id: string; clinicId: string; labels: Record<string, string>;
  slug: string; isActive: boolean; displayOrder: number; createdAt: string;
}

export interface Doctor {
  id: string; clinicId: string; specialtyId: string | null; name: string;
  bio?: string; isActive: boolean; displayOrder: number; createdAt: string;
  updatedAt?: string;
}

export interface TimeSlot {
  id: string; doctorId: string; dayOfWeek: number; startTime: string;
  endTime: string; slotDurationMinutes: number; isActive: boolean;
}

export interface FAQ {
  id: string; clinicId: string; question: string; answer: string;
  keywords: string[]; isActive: boolean; displayOrder: number; language: string;
  updatedAt?: string;
}

export interface Appointment {
  id: string; clinicId: string; doctorId: string; specialtyId: string;
  patientName: string; patientPhone: string; appointmentDate: string;
  appointmentTime: string; status: AppointmentStatus; notes?: string;
  createdAt: string; updatedAt: string;
  doctor?: { id: string; name: string };
  specialty?: { id: string; label: string };
}

export type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW'


export interface Stats {
  totalAppointments: number;
  todayAppointments: number;
  pendingAppointments: number;
  activeDoctors: number;
  recentAppointments: Appointment[];
}

export interface AdminUser {
  id: string; email: string; role: string; clinicId: string;
}

export interface LoginResponse {
  access_token: string; admin: AdminUser;
}

// ── Campaigns ────────────────────────────────────────────────────────────────

export type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'STOPPED'

export interface Campaign {
  id: string; clinicId: string; name: string; status: CampaignStatus;
  scheduledStartAt?: string | null;
  filterDateFrom?: string | null; filterDateTo?: string | null;
  filterDoctor?: string | null; filterMotif?: string | null;
  notificationPhone?: string | null; delayHours?: number | null;
  reminderCount?: number | null; reminderIntervalHours?: number | null;
  aiMaxTurns?: number | null;
  targetedCount: number; contactedCount: number; repliedCount: number;
  complainedCount: number; completedCount: number; noResponseCount: number;
  createdAt: string; updatedAt: string; launchedAt?: string | null;
  completedAt?: string | null;
}

export type CampaignPatientStatus = 'PENDING' | 'PARKED' | 'CONTACTED' | 'REPLIED' | 'COMPLETED' | 'OPTED_OUT' | 'NO_RESPONSE'

export interface CampaignPatient {
  id: string; campaignId: string; clinicId: string;
  patientName: string; cin?: string | null; phone: string;
  sexe?: string | null; ageYears?: number | null; ville?: string | null;
  visitDate: string; prestation: string; medecinTraitant: string;
  status: CampaignPatientStatus; turnCount: number; remindersSent: number;
  outcome?: string | null;
  createdAt: string; updatedAt: string;
  contactedAt?: string | null; repliedAt?: string | null; completedAt?: string | null;
  messages: any[];
}

// ── Complaints ───────────────────────────────────────────────────────────────

export type ComplaintType = 'COMPLAINT' | 'MEDICAL_CONCERN' | 'URGENT'
export type ComplaintSeverity = 'LOW' | 'MEDIUM' | 'HIGH'
export type ComplaintStatusFilter = 'NEW' | 'REVIEWED' | 'RESOLVED'

export interface Complaint {
  id: string; campaignPatientId: string; clinicId: string;
  type: ComplaintType; severity: ComplaintSeverity;
  triggeringMessage: string; summary: string;
  status: ComplaintStatusFilter; staffNote?: string | null;
  createdAt: string; updatedAt: string;
  reviewedAt?: string | null; resolvedAt?: string | null;
  campaignPatient?: {
    id: string; patientName: string; phone: string; campaignId: string;
  };
}

// ── Booking Requests ─────────────────────────────────────────────────────────

export type BookingRequestStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED'

export interface BookingRequest {
  id: string; campaignPatientId: string; clinicId: string;
  appointmentId?: string | null;
  preferredSpecialty?: string | null; preferredDoctor?: string | null;
  preferredDateRange?: string | null; reason?: string | null;
  rawPatientRequest: string; status: BookingRequestStatus;
  createdAt: string; updatedAt: string; confirmedAt?: string | null;
  campaignPatient?: {
    id: string; patientName: string; phone: string; campaignId: string;
    visitDate: string; prestation: string; medecinTraitant: string;
  };
  appointment?: {
    id: string; appointmentDate: string; appointmentTime: string;
    doctorName?: string | null; specialtyName?: string | null; status: string;
  } | null;
}
