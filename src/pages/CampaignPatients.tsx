import { useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft, Phone, Clock, User, Stethoscope, MessageSquare,
  AlertTriangle, CheckCircle2, XCircle, Ban, Loader2, ChevronDown, ChevronUp,
} from 'lucide-react'
import { getCampaign } from '../api'
import { useAuth } from '../store/auth'
import { PageHeader, PageLoader, Empty } from '../components/ui'
import type { Campaign, CampaignPatient, CampaignPatientStatus } from '../types'

// ── Status config ────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<CampaignPatientStatus, { bg: string; text: string; dot: string }> = {
  PENDING:     { bg: 'bg-neutral-100 dark:bg-neutral-800', text: 'text-neutral-600 dark:text-neutral-400', dot: 'bg-neutral-400' },
  PARKED:      { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-400' },
  CONTACTED:   { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-400' },
  REPLIED:     { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', dot: 'bg-purple-400' },
  COMPLETED:   { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', dot: 'bg-green-400' },
  OPTED_OUT:   { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', dot: 'bg-red-400' },
  NO_RESPONSE: { bg: 'bg-neutral-100 dark:bg-neutral-800', text: 'text-neutral-500 dark:text-neutral-500', dot: 'bg-neutral-300' },
}

const STATUS_LABELS: Record<CampaignPatientStatus, string> = {
  PENDING: 'Pending', PARKED: 'Parked', CONTACTED: 'Contacted',
  REPLIED: 'Replied', COMPLETED: 'Completed', OPTED_OUT: 'Opted out', NO_RESPONSE: 'No response',
}

const OUTCOME_LABELS: Record<string, string> = {
  COMPLETED: 'Completed', COMPLAINED: 'Complained', REBOOKED: 'Rebooked',
  HANDED_OFF: 'Handed off', URGENT: 'Urgent', OPTED_OUT: 'Opted out', NO_RESPONSE: 'No response',
}

// ── Conversation Thread Drawer ───────────────────────────────────────────────

function ConversationThread({ patient, lang, onClose }: {
  patient: CampaignPatient; lang: string; onClose: () => void
}) {
  const messages: any[] = patient.messages ?? []

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 px-5 py-4 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-neutral-800 dark:text-neutral-200">{patient.patientName}</h3>
            <p className="text-xs text-neutral-500">{patient.phone}</p>
          </div>
          <button onClick={onClose} className="btn-ghost h-8 w-8 p-0">
            <XCircle size={18} />
          </button>
        </div>

        {/* Patient info */}
        <div className="px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-800">
          <div className="grid grid-cols-2 gap-2 text-xs text-neutral-500">
            <span>📅 Visit: {new Date(patient.visitDate).toLocaleDateString(lang === 'FR' ? 'fr-MA' : 'en-GB')}</span>
            <span>👨‍⚕️ {patient.medecinTraitant}</span>
            <span>📋 {patient.prestation}</span>
            <span>🔄 Turns: {patient.turnCount}</span>
            {patient.outcome && <span>📊 {OUTCOME_LABELS[patient.outcome] ?? patient.outcome}</span>}
          </div>
        </div>

        {/* Messages */}
        <div className="px-5 py-4 space-y-3">
          {messages.length === 0 ? (
            <p className="text-sm text-neutral-400 text-center py-8">
              {lang === 'FR' ? 'Aucun message' : 'No messages yet'}
            </p>
          ) : (
            messages.map((msg: any, i: number) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-md'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-bl-md'
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  {msg.timestamp && (
                    <p className={`text-[10px] mt-1 ${msg.role === 'user' ? 'text-blue-200' : 'text-neutral-400'}`}>
                      {new Date(msg.timestamp).toLocaleTimeString(lang === 'FR' ? 'fr-MA' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export function CampaignPatientsPage() {
  const { campaignId } = useParams<{ campaignId: string }>()
  const { lang } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialStatus = (searchParams.get('status') as CampaignPatientStatus | null) ?? 'ALL'
  const [statusFilter, setStatusFilter] = useState<CampaignPatientStatus | 'ALL'>(initialStatus)
  const [selectedPatient, setSelectedPatient] = useState<CampaignPatient | null>(null)

  const { data: campaign, isLoading, isError, refetch } = useQuery<Campaign & { patients: CampaignPatient[] }>({
    queryKey: ['campaign', campaignId],
    queryFn: () => getCampaign(campaignId!),
    enabled: !!campaignId,
  })

  if (isLoading) return <PageLoader />

  if (isError || !campaign) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-sm text-neutral-500">{lang === 'FR' ? 'Erreur de chargement' : 'Error loading data'}</p>
        <button className="btn-outline" onClick={() => refetch()}>{lang === 'FR' ? 'Réessayer' : 'Try again'}</button>
      </div>
    )
  }

  const patients = campaign.patients ?? []
  const filtered = statusFilter === 'ALL' ? patients : patients.filter(p => p.status === statusFilter)

  // Status counts for chips
  const counts: Record<string, number> = {}
  for (const p of patients) {
    counts[p.status] = (counts[p.status] || 0) + 1
  }

  const statusFilters: (CampaignPatientStatus | 'ALL')[] = ['ALL', 'PENDING', 'CONTACTED', 'REPLIED', 'COMPLETED', 'OPTED_OUT', 'NO_RESPONSE']

  return (
    <div className="max-w-6xl">
      {/* Back button + header */}
      <div className="mb-6">
        <button
          className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 mb-3"
          onClick={() => navigate('/campaigns')}
        >
          <ArrowLeft size={14} />
          {lang === 'FR' ? 'Retour aux campagnes' : 'Back to campaigns'}
        </button>
        <PageHeader
          title={campaign.name}
          subtitle={`${patients.length} ${lang === 'FR' ? 'patients' : 'patients'} • ${campaign.status}`}
        />
      </div>

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        {statusFilters.map(s => {
          const isActive = statusFilter === s
          const count = s === 'ALL' ? patients.length : (counts[s] || 0)
          const style = s === 'ALL' ? null : STATUS_STYLES[s]
          return (
            <button
              key={s}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              }`}
              onClick={() => setStatusFilter(s)}
            >
              {s === 'ALL' ? (lang === 'FR' ? 'Tous' : 'All') : STATUS_LABELS[s]}
              {count > 0 && <span className="ml-1.5 opacity-70">({count})</span>}
            </button>
          )
        })}
      </div>

      {/* Patient list */}
      {filtered.length === 0 ? (
        <Empty message={lang === 'FR' ? 'Aucun patient dans cette catégorie' : 'No patients in this category'} />
      ) : (
        <div className="space-y-2">
          {filtered.map(patient => {
            const style = STATUS_STYLES[patient.status]
            return (
              <div
                key={patient.id}
                className="card p-4 flex items-center gap-4 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedPatient(patient)}
              >
                {/* Status dot */}
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${style.dot}`} />

                {/* Patient info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-neutral-800 dark:text-neutral-200 truncate">
                      {patient.patientName}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${style.bg} ${style.text}`}>
                      {STATUS_LABELS[patient.status]}
                    </span>
                    {patient.outcome && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
                        {OUTCOME_LABELS[patient.outcome] ?? patient.outcome}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-neutral-500">
                    <span className="flex items-center gap-1">
                      <Phone size={10} />
                      {patient.phone}
                    </span>
                    <span className="flex items-center gap-1">
                      <Stethoscope size={10} />
                      {patient.medecinTraitant}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={10} />
                      {new Date(patient.visitDate).toLocaleDateString(lang === 'FR' ? 'fr-MA' : 'en-GB')}
                    </span>
                  </div>
                </div>

                {/* Turn count + messages indicator */}
                <div className="flex items-center gap-2 shrink-0 text-xs text-neutral-400">
                  {patient.messages && patient.messages.length > 0 && (
                    <span className="flex items-center gap-1">
                      <MessageSquare size={12} />
                      {patient.messages.length}
                    </span>
                  )}
                  <span>{patient.turnCount} turns</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Conversation thread drawer */}
      {selectedPatient && (
        <ConversationThread
          patient={selectedPatient}
          lang={lang}
          onClose={() => setSelectedPatient(null)}
        />
      )}
    </div>
  )
}