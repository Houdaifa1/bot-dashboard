import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'https://api.houdaifa.dev'
console.log('API URL:', BASE_URL)
export const api = axios.create({ baseURL: BASE_URL })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('admin')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ── Auth ──────────────────────────────────────────────────────────────────────
export const login = (email: string, password: string) =>
  api.post('/api/admin/v1/auth/login', { email, password }).then(r => r.data)

// ── Stats ─────────────────────────────────────────────────────────────────────
export const getStats = () =>
  api.get('/api/admin/v1/stats').then(r => r.data)

// ── Clinic ────────────────────────────────────────────────────────────────────
export const getClinic = () =>
  api.get('/api/admin/v1/clinics').then(r => r.data)
export const updateClinic = (data: any) =>
  api.patch('/api/admin/v1/clinics', data).then(r => r.data)

// ── Bot Messages ──────────────────────────────────────────────────────────────
export const getBotMessages = (clinicId: string, language?: string) =>
  api.get(`/api/admin/v1/clinic/${clinicId}/messages`, {
    params: language ? { language } : {},
  }).then(r => r.data)
export const updateBotMessage = (clinicId: string, key: string, language: string, body: string) =>
  api.patch(`/api/admin/v1/clinic/${clinicId}/messages/${key}/${language}`, { body }).then(r => r.data)

// ── Specialties ───────────────────────────────────────────────────────────────
export const getSpecialties = (language?: string) =>
  api.get('/api/admin/v1/specialties', { params: language ? { language } : {} }).then(r => r.data)
export const createSpecialty = (data: any) =>
  api.post('/api/admin/v1/specialties', data).then(r => r.data)
export const updateSpecialty = (id: string, data: any) =>
  api.patch(`/api/admin/v1/specialties/${id}`, data).then(r => r.data)
export const deleteSpecialty = (id: string) =>
  api.delete(`/api/admin/v1/specialties/${id}`).then(r => r.data)
export const hardDeleteSpecialty = (id: string) =>
  api.delete(`/api/admin/v1/specialties/${id}/hard`).then(r => r.data)

// ── Doctors ───────────────────────────────────────────────────────────────────
export const getDoctors = (specialtyId?: string) =>
  api.get('/api/admin/v1/doctors', { params: specialtyId ? { specialtyId } : {} }).then(r => r.data)
export const createDoctor = (data: any) =>
  api.post('/api/admin/v1/doctors', data).then(r => r.data)
export const updateDoctor = (id: string, data: any) =>
  api.patch(`/api/admin/v1/doctors/${id}`, data).then(r => r.data)

// Activate (toggle isActive → true, re-links orphaned appointments)
export const activateDoctor = (id: string) =>
  api.patch(`/api/admin/v1/doctors/${id}/activate`).then(r => r.data)

// Deactivate (soft — doctor record stays, appointments keep doctorId)
export const deactivateDoctor = (id: string) =>
  api.delete(`/api/admin/v1/doctors/${id}/deactivate`).then(r => r.data)
export const confirmDeactivateDoctor = (id: string, data: { notify: boolean; customMessage?: string }) =>
  api.delete(`/api/admin/v1/doctors/${id}/deactivate/confirm`, { data }).then(r => r.data)

// Delete (hard — nulls doctorId on all appointments, preserves doctorName)
export const deleteDoctor = (id: string) =>
  api.delete(`/api/admin/v1/doctors/${id}`).then(r => r.data)
export const confirmDeleteDoctor = (id: string, data: { notify: boolean; customMessage?: string }) =>
  api.delete(`/api/admin/v1/doctors/${id}/confirm`, { data }).then(r => r.data)

// ── Time Slots ────────────────────────────────────────────────────────────────
export const getTimeSlots = (doctorId: string) =>
  api.get(`/api/admin/v1/doctors/${doctorId}/timeslots`).then(r => r.data)
export const createTimeSlot = (doctorId: string, data: any) =>
  api.post(`/api/admin/v1/doctors/${doctorId}/timeslots`, data).then(r => r.data)
export const updateTimeSlot = (id: string, data: any) =>
  api.patch(`/api/admin/v1/timeslots/${id}`, data).then(r => r.data)
export const deleteTimeSlot = (id: string) =>
  api.delete(`/api/admin/v1/timeslots/${id}`).then(r => r.data)

// ── FAQs ──────────────────────────────────────────────────────────────────────
export const getFaqs = (language?: string) =>
  api.get('/api/admin/v1/faqs', { params: { ...(language ? { language } : {}), includeInactive: 'true' } }).then(r => r.data)
export const createFaq = (data: any) =>
  api.post('/api/admin/v1/faqs', data).then(r => r.data)
export const updateFaq = (id: string, data: any) =>
  api.patch(`/api/admin/v1/faqs/${id}`, data).then(r => r.data)
export const deleteFaq = (id: string) =>
  api.delete(`/api/admin/v1/faqs/${id}`).then(r => r.data)
export const hardDeleteFaq = (id: string) =>
  api.delete(`/api/admin/v1/faqs/${id}/hard`).then(r => r.data)

// ── Appointments ──────────────────────────────────────────────────────────────
export const getAppointments = (params?: any) =>
  api.get('/api/admin/v1/appointments', { params }).then(r => r.data)
export const updateAppointmentStatus = (id: string, status: string) =>
  api.patch(`/api/admin/v1/appointments/${id}/status`, { status }).then(r => r.data)
export const deleteAppointment = (id: string) =>
  api.delete(`/api/admin/v1/appointments/${id}`).then(r => r.data)

// ── Handoff ───────────────────────────────────────────────────────────────────
export const getHandoffSessions = () =>
  api.get('/api/admin/v1/handoff').then(r => r.data)
export const resolveHandoff = (phone: string) =>
  api.post('/api/admin/v1/handoff/resolve', { phone }).then(r => r.data)

// ── Campaigns ────────────────────────────────────────────────────────────────
export const getCampaigns = () =>
  api.get('/api/admin/v1/campaigns').then(r => r.data)
export const getCampaign = (id: string) =>
  api.get(`/api/admin/v1/campaigns/${id}`).then(r => r.data)
export const createCampaign = (data: any) =>
  api.post('/api/admin/v1/campaigns', data).then(r => r.data)
export const updateCampaign = (id: string, data: any) =>
  api.patch(`/api/admin/v1/campaigns/${id}`, data).then(r => r.data)
export const launchCampaign = (id: string) =>
  api.post(`/api/admin/v1/campaigns/${id}/launch`).then(r => r.data)
export const pauseCampaign = (id: string) =>
  api.post(`/api/admin/v1/campaigns/${id}/pause`).then(r => r.data)
export const resumeCampaign = (id: string) =>
  api.post(`/api/admin/v1/campaigns/${id}/resume`).then(r => r.data)
export const stopCampaign = (id: string) =>
  api.post(`/api/admin/v1/campaigns/${id}/stop`).then(r => r.data)
export const cancelCampaignSchedule = (id: string) =>
  api.post(`/api/admin/v1/campaigns/${id}/cancel-schedule`).then(r => r.data)
export const deleteCampaign = (id: string) =>
  api.delete(`/api/admin/v1/campaigns/${id}`).then(r => r.data)
export const previewCampaign = (id: string) =>
  api.get(`/api/admin/v1/campaigns/${id}/preview`).then(r => r.data)

// ── Complaints ───────────────────────────────────────────────────────────────
export const getComplaints = (params?: any) =>
  api.get('/api/admin/v1/complaints', { params }).then(r => r.data)
export const getComplaint = (id: string) =>
  api.get(`/api/admin/v1/complaints/${id}`).then(r => r.data)
export const updateComplaintStatus = (id: string, status: string) =>
  api.patch(`/api/admin/v1/complaints/${id}/status`, { status }).then(r => r.data)
export const updateComplaintStaffNote = (id: string, staffNote: string) =>
  api.patch(`/api/admin/v1/complaints/${id}/staff-note`, { staffNote }).then(r => r.data)

// ── Booking Requests ─────────────────────────────────────────────────────────
export const getBookingRequests = (params?: any) =>
  api.get('/api/admin/v1/booking-requests', { params }).then(r => r.data)
export const getBookingRequest = (id: string) =>
  api.get(`/api/admin/v1/booking-requests/${id}`).then(r => r.data)
export const confirmBookingRequest = (id: string, data: { appointmentDate: string; appointmentTime: string }) =>
  api.post(`/api/admin/v1/booking-requests/${id}/confirm`, data).then(r => r.data)
export const rejectBookingRequest = (id: string) =>
  api.post(`/api/admin/v1/booking-requests/${id}/reject`).then(r => r.data)
