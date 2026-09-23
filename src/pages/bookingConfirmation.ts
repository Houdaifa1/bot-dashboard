import type { BookingRequest } from '../types'
import type { ConfirmBookingRequestInput } from '../api'

export interface BookingOptions {
  specialties: { specialityId: number; specialityLabel: string }[]
  doctors: { doctorId: number; doctorLabel: string; specialityIds: number[] }[]
}

export type ConfirmationFields = Omit<ConfirmBookingRequestInput, 'message'>
export type ConfirmationErrors = Partial<Record<keyof ConfirmationFields, string>>

export function initialConfirmation(booking: BookingRequest): ConfirmationFields {
  return {
    appointmentDate: booking.requestedDate?.slice(0, 10) ?? '',
    appointmentTime: booking.requestedTime ?? '',
    patientId: booking.clinopsPatientId ?? booking.campaignPatient?.clinopsPatientId ?? 0,
    specialityId: 0,
    motif: '',
    doctorName: '',
  }
}

export function validateConfirmation(
  fields: ConfirmationFields,
  options: BookingOptions | undefined,
  clinicNow: string,
): ConfirmationErrors {
  const errors: ConfirmationErrors = {}
  const parsedDate = new Date(`${fields.appointmentDate}T00:00:00`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fields.appointmentDate) ||
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.getFullYear() !== Number(fields.appointmentDate.slice(0, 4)) ||
      parsedDate.getMonth() + 1 !== Number(fields.appointmentDate.slice(5, 7)) ||
      parsedDate.getDate() !== Number(fields.appointmentDate.slice(8, 10))) {
    errors.appointmentDate = 'Select a valid date.'
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(fields.appointmentTime)) {
    errors.appointmentTime = 'Select a valid time.'
  }
  if (!errors.appointmentDate && !errors.appointmentTime &&
      `${fields.appointmentDate}T${fields.appointmentTime}:00` <= clinicNow) {
    errors.appointmentDate = 'Choose a future appointment.'
  }
  if (!Number.isSafeInteger(fields.patientId) || fields.patientId <= 0) {
    errors.patientId = 'Enter the ClinOps patient ID.'
  }
  if (!options?.specialties.some(s => s.specialityId === fields.specialityId)) {
    errors.specialityId = 'Select a specialty from ClinOps.'
  }
  if (!options?.doctors.some(d => d.doctorLabel === fields.doctorName &&
      d.specialityIds.includes(fields.specialityId))) {
    errors.doctorName = 'Select a doctor for this specialty.'
  }
  if (!fields.motif.trim()) {
    errors.motif = 'Enter the reviewed booking reason.'
  }
  return errors
}
