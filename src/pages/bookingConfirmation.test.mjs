import assert from 'node:assert/strict'
import test from 'node:test'
import { initialConfirmation, validateConfirmation } from './bookingConfirmation.ts'

const options = {
  specialties: [{ specialityId: 5, specialityLabel: 'Cardiology' }],
  doctors: [{ doctorId: 7, doctorLabel: 'Dr Example', specialityIds: [5] }],
}
const valid = {
  appointmentDate: '2099-01-01', appointmentTime: '10:00', patientId: 42,
  specialityId: 5, motif: 'Follow-up consultation', doctorName: 'Dr Example',
}

test('prefills the exact inbound slot and recorded ClinOps IDs', () => {
  assert.deepEqual(initialConfirmation({
    requestedDate: '2099-01-01', requestedTime: '10:00', clinopsPatientId: 42,
    clinopsSpecialityId: 5,
  }), { ...valid, motif: '', doctorName: '' })
})

test('prefills a campaign patient ID from the backend queue response', () => {
  assert.equal(initialConfirmation({ campaignPatient: { clinopsPatientId: 1128 } }).patientId, 1128)
})

test('accepts a reviewed, documented booking selection', () => {
  assert.deepEqual(validateConfirmation(valid, options, '2026-09-23T12:00:00'), {})
})

test('blocks missing identity, unavailable doctor, blank motif, and past slot', () => {
  const errors = validateConfirmation({ ...valid, patientId: 0, doctorName: 'Other doctor',
    motif: ' ', appointmentDate: '2026-09-23', appointmentTime: '11:00' },
  options, '2026-09-23T12:00:00')
  assert.ok(errors.patientId)
  assert.ok(errors.doctorName)
  assert.ok(errors.motif)
  assert.ok(errors.appointmentDate)
})

test('blocks confirmation when the ClinOps options could not load', () => {
  const errors = validateConfirmation(valid, undefined, '2026-09-23T12:00:00')
  assert.ok(errors.specialityId)
  assert.ok(errors.doctorName)
})

test('rejects a calendar date that rolls into another month', () => {
  const errors = validateConfirmation({ ...valid, appointmentDate: '2099-02-30' },
    options, '2026-09-23T12:00:00')
  assert.ok(errors.appointmentDate)
})
