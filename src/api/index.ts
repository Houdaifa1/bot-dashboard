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

// Auth
export const login = (email: string, password: string) =>
  api.post('/api/admin/v1/auth/login', { email, password }).then(r => r.data)

// Stats
export const getStats = () =>
  api.get('/api/admin/v1/stats').then(r => r.data)

// Clinic
export const getClinic = () =>
  api.get('/api/admin/v1/clinics').then(r => r.data)
export const updateClinic = (data: any) =>
  api.patch('/api/admin/v1/clinics', data).then(r => r.data)

// Bot Messages
export const getBotMessages = (clinicId: string, language?: string) =>
  api.get(`/api/admin/v1/clinic/${clinicId}/messages`, {
    params: language ? { language } : {},
  }).then(r => r.data)
export const updateBotMessage = (clinicId: string, key: string, language: string, body: string) =>
  api.patch(`/api/admin/v1/clinic/${clinicId}/messages/${key}/${language}`, { body }).then(r => r.data)

// Specialties
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

// Doctors
export const getDoctors = (specialtyId?: string) =>
  api.get('/api/admin/v1/doctors', { params: specialtyId ? { specialtyId } : {} }).then(r => r.data)
export const createDoctor = (data: any) =>
  api.post('/api/admin/v1/doctors', data).then(r => r.data)
export const updateDoctor = (id: string, data: any) =>
  api.patch(`/api/admin/v1/doctors/${id}`, data).then(r => r.data)
export const deleteDoctor = (id: string) =>
  api.delete(`/api/admin/v1/doctors/${id}`).then(r => r.data)
export const hardDeleteDoctor = (id: string) =>
  api.delete(`/api/admin/v1/doctors/${id}/hard`).then(r => r.data)

// Time Slots
export const getTimeSlots = (doctorId: string) =>
  api.get(`/api/admin/v1/doctors/${doctorId}/timeslots`).then(r => r.data)
export const createTimeSlot = (doctorId: string, data: any) =>
  api.post(`/api/admin/v1/doctors/${doctorId}/timeslots`, data).then(r => r.data)
export const updateTimeSlot = (id: string, data: any) =>
  api.patch(`/api/admin/v1/timeslots/${id}`, data).then(r => r.data)
export const deleteTimeSlot = (id: string) =>
  api.delete(`/api/admin/v1/timeslots/${id}`).then(r => r.data)

// FAQs
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

// Appointments
export const getAppointments = (params?: any) =>
  api.get('/api/admin/v1/appointments', { params }).then(r => r.data)
export const updateAppointmentStatus = (id: string, status: string) =>
  api.patch(`/api/admin/v1/appointments/${id}/status`, { status }).then(r => r.data)
export const deleteAppointment = (id: string) =>
  api.delete(`/api/admin/v1/appointments/${id}`).then(r => r.data)

// Handoff
export const getHandoffSessions = () =>
  api.get('/api/admin/v1/handoff').then(r => r.data)
export const resolveHandoff = (phone: string) =>
  api.post('/api/admin/v1/handoff/resolve', { phone }).then(r => r.data)