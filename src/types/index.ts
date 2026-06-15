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