import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../store/auth'
import { useToast } from '../store/toast'
import { t, type TKey } from '../i18n'
import {
  getFlows, createFlow, updateFlow, deleteFlow,
  activateFlow, deactivateFlow, getActiveFlow,
  addFlowNode, updateFlowNode, deleteFlowNode, reorderFlowNodes,
} from '../api'
import type { Flow, FlowNode, NodeType } from '../types'
import {
  Plus, Pencil, Trash2, Play, Square, ChevronDown, ChevronUp,
  Copy, ArrowUp, ArrowDown,
  MessageSquareText, LayoutGrid, List, Stethoscope, User, Calendar,
  Clock, TextCursorInput, GitBranch, CalendarCheck, Circle, Dot,
  Check, X, AlertTriangle, Eye, Cable,
  ArrowDownToDot, Info,
} from 'lucide-react'
import { ConfirmDialog, Field } from '../components/ui'

// ─── Node type metadata ───────────────────────────────────────────────────
const NODE_TYPES: { value: NodeType; labelKey: TKey; icon: React.ElementType; color: string }[] = [
  { value: 'TEXT',              labelKey: 'flow_node_text',              icon: MessageSquareText,  color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' },
  { value: 'BUTTONS',           labelKey: 'flow_node_buttons',           icon: LayoutGrid,         color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' },
  { value: 'LIST',              labelKey: 'flow_node_list',              icon: List,               color: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' },
  { value: 'SPECIALTY_LIST',    labelKey: 'flow_node_specialty_list',    icon: Stethoscope,        color: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300' },
  { value: 'DOCTOR_LIST',       labelKey: 'flow_node_doctor_list',       icon: User,               color: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300' },
  { value: 'DATE_PICKER',       labelKey: 'flow_node_date_picker',       icon: Calendar,           color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' },
  { value: 'TIME_PICKER',       labelKey: 'flow_node_time_picker',       icon: Clock,              color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' },
  { value: 'FREE_TEXT_INPUT',   labelKey: 'flow_node_free_text',         icon: TextCursorInput,    color: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300' },
  { value: 'CONDITION',         labelKey: 'flow_node_condition',         icon: GitBranch,          color: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300' },
  { value: 'BOOK_APPOINTMENT',  labelKey: 'flow_node_book_appointment',  icon: CalendarCheck,      color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' },
  { value: 'END',               labelKey: 'flow_node_end',               icon: Circle,             color: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400' },
]

const NODE_TYPE_MAP = new Map(NODE_TYPES.map(nt => [nt.value, nt]))

// ─── Default configs per type ──────────────────────────────────────────────
const DEFAULT_CONFIGS: Record<NodeType, Record<string, any>> = {
  TEXT:             { body: '', nextNodeId: null },
  BUTTONS:          { body: '', buttons: [{ id: 'option_1', title: '', nextNodeId: null }], nextNodeId: null },
  LIST:             { body: '', header: '', buttonLabel: 'Select', sectionTitle: '', rows: [{ id: 'row_1', title: '', description: '', nextNodeId: null }], nextNodeId: null },
  SPECIALTY_LIST:   { body: '', header: 'Specialties', nextNodeId: null },
  DOCTOR_LIST:      { body: '', header: 'Doctors', filterBySpecialty: true, specialtyId: null, nextNodeId: null },
  DATE_PICKER:      { body: '', header: 'Select date', doctorId: null, nextNodeId: null },
  TIME_PICKER:      { body: '', header: 'Select time', nextNodeId: null },
  FREE_TEXT_INPUT:  { body: '', variableName: '', minLength: 1, nextNodeId: null },
  CONDITION:        { variable: '', branches: [{ value: '*', nextNodeId: null }], defaultNextNodeId: null },
  BOOK_APPOINTMENT: { body: '', successMessage: '', nextNodeId: null },
  END:              { body: '' },
}

// ─── Target Node Selector ─────────────────────────────────────────────────
function TargetSelect({ nodes, currentId, value, onChange, label, lang, allowEnd, allowNext, placeholder }: {
  nodes: FlowNode[]
  currentId?: string
  value: string | null
  onChange: (id: string | null) => void
  label: string
  lang: 'FR' | 'EN'
  allowEnd?: boolean
  allowNext?: boolean
  placeholder?: string
}) {
  const others = nodes.filter(n => n.id !== currentId).sort((a, b) => a.position - b.position)
  const typeOf = (id: string | null): TKey => {
    if (!id) return 'flow_no_targets' as TKey
    const n = nodes.find(x => x.id === id)
    return n ? (NODE_TYPE_MAP.get(n.type)?.labelKey ?? n.type as TKey) : 'flow_no_targets' as TKey
  }

  return (
    <Field label={label}>
      <select
        className="input h-10"
        value={value || ''}
        onChange={e => onChange(e.target.value || null)}
      >
        <option value="">{placeholder || t(lang, 'flow_select_target')}</option>
        {allowNext && (
          <option value="__next__">{t(lang, 'flow_target_next')} (position+1)</option>
        )}
        {allowEnd && (
          <option value="__end__">{t(lang, 'flow_target_end')}</option>
        )}
        {others.map(n => (
          <option key={n.id} value={n.id}>
            #{n.position} {n.label} ({t(lang, typeOf(n.id))})
          </option>
        ))}
        {others.length === 0 && !allowEnd && !allowNext && (
          <option disabled>{t(lang, 'flow_no_targets')}</option>
        )}
      </select>
      {value && value !== '__next__' && value !== '__end__' && (
        <span className="text-xs text-neutral-400 mt-1 flex items-center gap-1">
          <Cable size={10} /> → #{nodes.find(n => n.id === value)?.position} {nodes.find(n => n.id === value)?.label}
        </span>
      )}
      {value === '__end__' && (
        <span className="text-xs text-neutral-400 mt-1 flex items-center gap-1">
          <Circle size={10} /> {t(lang, 'flow_target_end')}
        </span>
      )}
      {value === '__next__' && (
        <span className="text-xs text-neutral-400 mt-1 flex items-center gap-1">
          <ArrowDownToDot size={10} /> {t(lang, 'flow_target_next')}
        </span>
      )}
    </Field>
  )
}

// ─── Node Config Editor ──────────────────────────────────────────────────
function NodeConfigEditor({ node, nodes, lang, onChange }: {
  node: FlowNode
  nodes: FlowNode[]
  lang: 'FR' | 'EN'
  onChange: (config: Record<string, any>) => void
}) {
  const config = node.config || {}
  const set = (key: string, value: any) => onChange({ ...config, [key]: value })

  const renderTarget = (key: string, label: string, allowEnd = true, allowNext = true) => (
    <TargetSelect
      nodes={nodes}
      currentId={node.id}
      value={config[key] || null}
      onChange={v => set(key, v)}
      label={label}
      lang={lang}
      allowEnd={allowEnd}
      allowNext={allowNext}
    />
  )

  switch (node.type) {
    case 'TEXT':
      return (
        <div className="space-y-4">
          <Field label={t(lang, 'flow_body')}>
            <textarea
              className="input w-full min-h-[80px]"
              value={config.body || ''}
              onChange={e => set('body', e.target.value)}
              placeholder="Hello {{patientName}}!"
            />
          </Field>
          {renderTarget('nextNodeId', t(lang, 'flow_next_node'))}
        </div>
      )

    case 'BUTTONS': {
      const buttons = config.buttons || []
      return (
        <div className="space-y-4">
          <Field label={t(lang, 'flow_body')}>
            <textarea className="input w-full min-h-[60px]" value={config.body || ''} onChange={e => set('body', e.target.value)} />
          </Field>
          <div className="space-y-3">
            <label className="text-xs font-medium text-neutral-500">{t(lang, 'flow_add_button')}</label>
            {buttons.map((btn: any, i: number) => (
              <div key={i} className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-neutral-400">#{i + 1}</span>
                  <button
                    onClick={() => set('buttons', buttons.filter((_: any, j: number) => j !== i))}
                    className="text-red-400 hover:text-red-600 p-1"
                  >
                    <X size={12} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t(lang, 'flow_button_id')}>
                    <input className="input h-9 text-xs font-mono" value={btn.id} onChange={e => {
                      const copy = [...buttons]; copy[i] = { ...copy[i], id: e.target.value }; set('buttons', copy)
                    }} />
                  </Field>
                  <Field label={t(lang, 'flow_button_title')}>
                    <input className="input h-9" value={btn.title} onChange={e => {
                      const copy = [...buttons]; copy[i] = { ...copy[i], title: e.target.value }; set('buttons', copy)
                    }} />
                  </Field>
                </div>
                <TargetSelect
                  nodes={nodes} currentId={node.id}
                  value={btn.nextNodeId || null}
                  onChange={v => {
                    const copy = [...buttons]; copy[i] = { ...copy[i], nextNodeId: v }; set('buttons', copy)
                  }}
                  label={t(lang, 'flow_next_node')}
                  lang={lang}
                  allowEnd
                  allowNext
                  placeholder={t(lang, 'flow_select_target')}
                />
              </div>
            ))}
            <button
              onClick={() => set('buttons', [...buttons, { id: `option_${buttons.length + 1}`, title: '', nextNodeId: null }])}
              className="btn-ghost text-xs px-3 py-1.5"
            >
              <Plus size={12} className="mr-1" /> {t(lang, 'flow_add_button')}
            </button>
          </div>
        </div>
      )
    }

    case 'LIST': {
      const rows = config.rows || []
      return (
        <div className="space-y-4">
          <Field label={t(lang, 'flow_header')}>
            <input className="input h-9" value={config.header || ''} onChange={e => set('header', e.target.value)} />
          </Field>
          <Field label={t(lang, 'flow_body')}>
            <textarea className="input w-full min-h-[60px]" value={config.body || ''} onChange={e => set('body', e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t(lang, 'flow_section_title')}>
              <input className="input h-9" value={config.sectionTitle || ''} onChange={e => set('sectionTitle', e.target.value)} />
            </Field>
            <Field label={t(lang, 'flow_button_label')}>
              <input className="input h-9" value={config.buttonLabel || ''} onChange={e => set('buttonLabel', e.target.value)} />
            </Field>
          </div>
          <div className="space-y-3">
            <label className="text-xs font-medium text-neutral-500">{t(lang, 'flow_add_row')}</label>
            {rows.map((row: any, i: number) => (
              <div key={i} className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-neutral-400">#{i + 1}</span>
                  <button onClick={() => set('rows', rows.filter((_: any, j: number) => j !== i))} className="text-red-400 hover:text-red-600 p-1"><X size={12} /></button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t(lang, 'flow_row_id')}><input className="input h-9 text-xs font-mono" value={row.id} onChange={e => {
                    const copy = [...rows]; copy[i] = { ...copy[i], id: e.target.value }; set('rows', copy)
                  }} /></Field>
                  <Field label={t(lang, 'flow_row_title')}><input className="input h-9" value={row.title} onChange={e => {
                    const copy = [...rows]; copy[i] = { ...copy[i], title: e.target.value }; set('rows', copy)
                  }} /></Field>
                </div>
                <Field label={t(lang, 'flow_row_desc')}>
                  <input className="input h-9" value={row.description || ''} onChange={e => {
                    const copy = [...rows]; copy[i] = { ...copy[i], description: e.target.value }; set('rows', copy)
                  }} />
                </Field>
                <TargetSelect
                  nodes={nodes} currentId={node.id}
                  value={row.nextNodeId || null}
                  onChange={v => { const copy = [...rows]; copy[i] = { ...copy[i], nextNodeId: v }; set('rows', copy) }}
                  label={t(lang, 'flow_next_node')}
                  lang={lang}
                  allowEnd
                  allowNext
                  placeholder={t(lang, 'flow_select_target')}
                />
              </div>
            ))}
            <button onClick={() => set('rows', [...rows, { id: `row_${rows.length + 1}`, title: '', description: '', nextNodeId: null }])}
              className="btn-ghost text-xs px-3 py-1.5"><Plus size={12} className="mr-1" /> {t(lang, 'flow_add_row')}</button>
          </div>
        </div>
      )
    }

    case 'SPECIALTY_LIST':
      return (
        <div className="space-y-4">
          <Field label={t(lang, 'flow_header')}><input className="input h-9" value={config.header || 'Specialties'} onChange={e => set('header', e.target.value)} /></Field>
          <Field label={t(lang, 'flow_body')}><textarea className="input w-full min-h-[60px]" value={config.body || ''} onChange={e => set('body', e.target.value)} /></Field>
          {renderTarget('nextNodeId', t(lang, 'flow_next_node'))}
        </div>
      )

    case 'DOCTOR_LIST':
      return (
        <div className="space-y-4">
          <Field label={t(lang, 'flow_header')}><input className="input h-9" value={config.header || 'Doctors'} onChange={e => set('header', e.target.value)} /></Field>
          <Field label={t(lang, 'flow_body')}><textarea className="input w-full min-h-[60px]" value={config.body || ''} onChange={e => set('body', e.target.value)} /></Field>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="rounded" checked={config.filterBySpecialty !== false} onChange={e => set('filterBySpecialty', e.target.checked)} />
            <span className="text-sm text-neutral-600 dark:text-neutral-400">{t(lang, 'flow_filter_by_specialty')}</span>
          </label>
          {renderTarget('nextNodeId', t(lang, 'flow_next_node'))}
        </div>
      )

    case 'DATE_PICKER':
      return (
        <div className="space-y-4">
          <Field label={t(lang, 'flow_header')}><input className="input h-9" value={config.header || 'Select date'} onChange={e => set('header', e.target.value)} /></Field>
          <Field label={t(lang, 'flow_body')}><textarea className="input w-full min-h-[60px]" value={config.body || ''} onChange={e => set('body', e.target.value)} /></Field>
          <Field label="Doctor ID (optional if auto)">
            <input className="input h-9 font-mono text-xs" value={config.doctorId || ''} onChange={e => set('doctorId', e.target.value || null)} placeholder="Leave empty to use selected doctor" />
          </Field>
          {renderTarget('nextNodeId', t(lang, 'flow_next_node'))}
        </div>
      )

    case 'TIME_PICKER':
      return (
        <div className="space-y-4">
          <Field label={t(lang, 'flow_header')}><input className="input h-9" value={config.header || 'Select time'} onChange={e => set('header', e.target.value)} /></Field>
          <Field label={t(lang, 'flow_body')}><textarea className="input w-full min-h-[60px]" value={config.body || ''} onChange={e => set('body', e.target.value)} /></Field>
          {renderTarget('nextNodeId', t(lang, 'flow_next_node'))}
        </div>
      )

    case 'FREE_TEXT_INPUT':
      return (
        <div className="space-y-4">
          <Field label={t(lang, 'flow_prompt')} error={!config.body ? t(lang, 'flow_missing_body') : undefined}>
            <textarea className="input w-full min-h-[60px]" value={config.body || ''} onChange={e => set('body', e.target.value)}
              placeholder="Please enter your name:" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t(lang, 'flow_variable_name')} error={!config.variableName ? t(lang, 'flow_missing_variable') : undefined}>
              <input className="input h-9 font-mono text-xs" value={config.variableName || ''} onChange={e => set('variableName', e.target.value)}
                placeholder="patientName" />
            </Field>
            <Field label={t(lang, 'flow_min_length')}>
              <input type="number" min={1} max={500} className="input h-9" value={config.minLength ?? 1} onChange={e => set('minLength', parseInt(e.target.value) || 1)} />
            </Field>
          </div>
          {renderTarget('nextNodeId', t(lang, 'flow_next_node'))}
        </div>
      )

    case 'CONDITION': {
      const branches = config.branches || []
      return (
        <div className="space-y-4">
          <Field label={t(lang, 'flow_variable')}>
            <select className="input h-9" value={config.variable || ''} onChange={e => set('variable', e.target.value)}>
              <option value="">— Select variable —</option>
              <option value="specialtyId">specialtyId</option>
              <option value="doctorId">doctorId</option>
              <option value="selectedDate">selectedDate</option>
              <option value="selectedTime">selectedTime</option>
              <option value="patientName">patientName</option>
              <option value="language">language</option>
            </select>
          </Field>
          <div className="space-y-3">
            <label className="text-xs font-medium text-neutral-500">{t(lang, 'flow_add_branch')}</label>
            {branches.map((branch: any, i: number) => (
              <div key={i} className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GitBranch size={12} className="text-neutral-400" />
                    <span className="text-xs font-mono text-neutral-400">#{i + 1}</span>
                    {branch.value === '*' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-700 text-neutral-500">Default</span>}
                  </div>
                  <button onClick={() => set('branches', branches.filter((_: any, j: number) => j !== i))} className="text-red-400 hover:text-red-600 p-1"><X size={12} /></button>
                </div>
                <Field label={t(lang, 'flow_branch_value')}>
                  <input className="input h-9 text-xs font-mono" value={branch.value || ''} onChange={e => {
                    const copy = [...branches]; copy[i] = { ...copy[i], value: e.target.value }; set('branches', copy)
                  }} placeholder="e.g. cardiology or * for default" />
                </Field>
                <TargetSelect
                  nodes={nodes} currentId={node.id}
                  value={branch.nextNodeId || null}
                  onChange={v => { const copy = [...branches]; copy[i] = { ...copy[i], nextNodeId: v }; set('branches', copy) }}
                  label={t(lang, 'flow_branch_next')}
                  lang={lang}
                  allowEnd
                  allowNext
                  placeholder={t(lang, 'flow_select_target')}
                />
              </div>
            ))}
            <button onClick={() => set('branches', [...branches, { value: '', nextNodeId: null }])}
              className="btn-ghost text-xs px-3 py-1.5"><Plus size={12} className="mr-1" /> {t(lang, 'flow_add_branch')}</button>
          </div>
          <div className="border-t border-neutral-200 dark:border-neutral-700 pt-3">
            {renderTarget('defaultNextNodeId', t(lang, 'flow_default_next'), true)}
          </div>
        </div>
      )
    }

    case 'BOOK_APPOINTMENT':
      return (
        <div className="space-y-4">
          <Field label={t(lang, 'flow_body')}>
            <textarea className="input w-full min-h-[60px]" value={config.body || ''} onChange={e => set('body', e.target.value)}
              placeholder="Booking your appointment..." />
          </Field>
          <Field label={t(lang, 'flow_prompt')}>
            <textarea className="input w-full min-h-[60px]" value={config.successMessage || ''} onChange={e => set('successMessage', e.target.value)}
              placeholder="Your appointment is confirmed for {{date}} at {{time}}!" />
          </Field>
          {renderTarget('nextNodeId', t(lang, 'flow_next_node'), true, true)}
        </div>
      )

    case 'END':
      return (
        <div className="space-y-4">
          <Field label={t(lang, 'flow_body')}>
            <textarea className="input w-full min-h-[80px]" value={config.body || ''} onChange={e => set('body', e.target.value)}
              placeholder="Thank you! Your appointment has been booked." />
          </Field>
          <p className="text-xs text-neutral-400 flex items-center gap-1"><Info size={12} /> The conversation ends after this message. The session resets.</p>
        </div>
      )

    default:
      return <p className="text-sm text-neutral-500">{t(lang, 'flow_invalid_config')}</p>
  }
}

// ─── Node Preview ─────────────────────────────────────────────────────────
function NodePreview({ node, lang, allNodes }: { node: FlowNode; lang: 'FR' | 'EN'; allNodes?: FlowNode[] }) {
  const config = node.config || {}
  const typeMeta = NODE_TYPE_MAP.get(node.type)
  const nodes = allNodes || []

  return (
    <div className="mt-4 p-4 rounded-xl bg-white dark:bg-neutral-900 border-2 border-dashed border-neutral-300 dark:border-neutral-600 max-w-md mx-auto">
      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-neutral-100 dark:border-neutral-800">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${typeMeta?.color || 'bg-neutral-100'}`}>
          {typeMeta?.icon ? <typeMeta.icon size={14} /> : <Dot size={14} />}
        </div>
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{t(lang, typeMeta?.labelKey as TKey || node.type)}</span>
        <span className="text-[10px] font-mono text-neutral-400 ml-auto">#{node.position}</span>
      </div>
      {node.type === 'TEXT' && (
        <p className="text-sm text-neutral-600 dark:text-neutral-300 whitespace-pre-wrap">{config.body || '(no body)'}</p>
      )}
      {node.type === 'BUTTONS' && (
        <div className="space-y-2">
          <p className="text-sm text-neutral-600 dark:text-neutral-300">{config.body || '(no body)'}</p>
          <div className="flex flex-wrap gap-2">
            {(config.buttons || []).map((btn: any, i: number) => (
              <span key={i} className="px-3 py-1.5 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-medium">{btn.title || `Button ${i + 1}`}</span>
            ))}
          </div>
        </div>
      )}
      {node.type === 'LIST' && (
        <div className="space-y-2">
          {config.header && <p className="text-xs font-medium text-neutral-500 uppercase">{config.header}</p>}
          <p className="text-sm text-neutral-600 dark:text-neutral-300">{config.body || '(no body)'}</p>
          <div className="space-y-1 mt-2">
            {(config.rows || []).map((row: any, i: number) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-sm">
                <List size={12} className="text-indigo-400" />
                <span className="text-indigo-700 dark:text-indigo-300">{row.title || `Row ${i + 1}`}</span>
              </div>
            ))}
          </div>
          <span className="inline-block mt-1 px-3 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-xs text-neutral-500">{config.buttonLabel || 'Select'}</span>
        </div>
      )}
      {node.type === 'SPECIALTY_LIST' && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-neutral-500 uppercase">{config.header || 'Specialties'}</p>
          <p className="text-sm text-neutral-600 dark:text-neutral-300">{config.body || '(dynamic specialties list)'}</p>
          <div className="flex items-center gap-2 text-xs text-teal-600 dark:text-teal-400">
            <Stethoscope size={12} /> Dynamic from DB
          </div>
        </div>
      )}
      {node.type === 'DOCTOR_LIST' && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-neutral-500 uppercase">{config.header || 'Doctors'}</p>
          <p className="text-sm text-neutral-600 dark:text-neutral-300">{config.body || '(dynamic doctors list)'}</p>
          <div className="flex items-center gap-2 text-xs text-cyan-600 dark:text-cyan-400">
            <User size={12} /> Dynamic from DB
            {config.filterBySpecialty !== false && <span className="text-neutral-400">· filtered by specialty</span>}
          </div>
        </div>
      )}
      {node.type === 'DATE_PICKER' && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-neutral-500 uppercase">{config.header || 'Select date'}</p>
          <p className="text-sm text-neutral-600 dark:text-neutral-300">{config.body || '(available dates list)'}</p>
          <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
            <Calendar size={12} /> Dynamic from schedule
          </div>
        </div>
      )}
      {node.type === 'TIME_PICKER' && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-neutral-500 uppercase">{config.header || 'Select time'}</p>
          <p className="text-sm text-neutral-600 dark:text-neutral-300">{config.body || '(available time slots)'}</p>
          <div className="flex items-center gap-2 text-xs text-orange-600 dark:text-orange-400">
            <Clock size={12} /> Dynamic from schedule
          </div>
        </div>
      )}
      {node.type === 'FREE_TEXT_INPUT' && (
        <div className="space-y-2">
          <p className="text-sm text-neutral-600 dark:text-neutral-300">{config.body || '(input prompt)'}</p>
          <div className="flex items-center gap-2 mt-2">
            <input className="input flex-1 h-9 text-xs" placeholder="User types here..." disabled />
          </div>
          <div className="flex items-center gap-2 text-xs text-pink-600 dark:text-pink-400">
            <TextCursorInput size={12} /> Stores as <code className="font-mono bg-pink-100 dark:bg-pink-900/30 px-1 rounded">{config.variableName || 'free_text'}</code>
          </div>
        </div>
      )}
      {node.type === 'CONDITION' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <GitBranch size={14} className="text-rose-500" />
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Evaluate <code className="font-mono text-xs bg-rose-100 dark:bg-rose-900/30 px-1 rounded">{config.variable || '(variable)'}</code></span>
          </div>
          <div className="space-y-1 pl-4 border-l-2 border-rose-200 dark:border-rose-800">
            {(config.branches || []).map((b: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
                <Dot size={8} className="text-rose-400" />
                {b.value === '*' ? 'Default' : `"${b.value}"`} → Node #{b.nextNodeId ? nodes.findIndex(n => n.id === b.nextNodeId) : '?'}
              </div>
            ))}
          </div>
        </div>
      )}
      {node.type === 'BOOK_APPOINTMENT' && (
        <div className="space-y-2">
          <p className="text-sm text-neutral-600 dark:text-neutral-300">{config.body || '(booking summary)'}</p>
          <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
            <CalendarCheck size={12} /> Creates appointment in DB
          </div>
        </div>
      )}
      {node.type === 'END' && (
        <div className="space-y-2">
          <p className="text-sm text-neutral-600 dark:text-neutral-300">{config.body || '(farewell message)'}</p>
          <div className="flex items-center gap-1 text-xs text-neutral-400">
            <Circle size={8} /> Flow ends, session resets
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Node Card ────────────────────────────────────────────────────────────
function NodeCard({ node, nodes, flowId, lang, isFirst, onUpdated, onDeleted, onMoveUp, onMoveDown, onDuplicate }: {
  node: FlowNode
  nodes: FlowNode[]
  flowId: string
  lang: 'FR' | 'EN'
  isFirst: boolean
  onUpdated: () => void
  onDeleted: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDuplicate: () => void
}) {
  const { toast } = useToast()
  const [expanded, setExpanded] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [editLabel, setEditLabel] = useState(node.label)
  const [editConfig, setEditConfig] = useState(node.config)

  const queryClient = useQueryClient()

  const typeMeta = NODE_TYPE_MAP.get(node.type)

  const updateMutation = useMutation({
    mutationFn: () => updateFlowNode(flowId, node.id, {
      label: editLabel,
      config: editConfig,
    }),
    onSuccess: () => {
      toast(t(lang, 'flow_node_saved' as TKey), 'success')
      queryClient.invalidateQueries({ queryKey: ['flows'] })
      onUpdated()
    },
    onError: () => toast(t(lang, 'errorSaving' as TKey), 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteFlowNode(flowId, node.id),
    onSuccess: () => {
      toast(t(lang, 'deleted' as TKey), 'success')
      queryClient.invalidateQueries({ queryKey: ['flows'] })
      onDeleted()
    },
    onError: () => toast(t(lang, 'errorSaving' as TKey), 'error'),
  })

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Resolve target node display
  const getTargetLabel = (targetId: string | null): string | null => {
    if (!targetId) return null
    if (targetId === '__end__') return '🏁 End'
    if (targetId === '__next__') return '↓ Next position'
    const target = nodes.find(n => n.id === targetId)
    if (!target) return null
    return `#${target.position} ${target.label}`
  }

  const hasTargets = () => {
    const c = editConfig
    if (c.nextNodeId) return { to: c.nextNodeId, label: getTargetLabel(c.nextNodeId) }
    if (c.buttons) {
      const btn = c.buttons.find((b: any) => b.nextNodeId)
      if (btn) return { to: btn.nextNodeId, label: getTargetLabel(btn.nextNodeId) }
    }
    if (c.rows) {
      const row = c.rows.find((r: any) => r.nextNodeId)
      if (row) return { to: row.nextNodeId, label: getTargetLabel(row.nextNodeId) }
    }
    if (c.branches) {
      const br = c.branches.find((b: any) => b.nextNodeId)
      if (br) return { to: br.nextNodeId, label: getTargetLabel(br.nextNodeId) }
    }
    if (c.defaultNextNodeId) return { to: c.defaultNextNodeId, label: getTargetLabel(c.defaultNextNodeId) }
    return null
  }

  const targetInfo = hasTargets()

  return (
    <div className="relative">
      {/* Connector line */}
      <div className="flex justify-center">
        <div className="w-0.5 h-6 bg-gradient-to-b from-neutral-300 dark:from-neutral-600 to-neutral-200 dark:to-neutral-700" />
      </div>

      {/* Start badge */}
      {isFirst && (
        <div className="flex justify-center mb-1">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
            <Play size={10} /> {t(lang, 'flow_start_node')}
          </span>
        </div>
      )}

      {/* Node card */}
      <div className={`rounded-xl border-2 transition-all duration-200 ${
        expanded
          ? 'border-blue-400 dark:border-blue-500 shadow-lg shadow-blue-500/10'
          : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
      } bg-white dark:bg-neutral-900 overflow-hidden`}>
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          {/* Type icon */}
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${typeMeta?.color || 'bg-neutral-100 dark:bg-neutral-800'}`}>
            {typeMeta?.icon ? <typeMeta.icon size={15} /> : <Dot size={15} />}
          </div>

          {/* Label */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-neutral-400 tabular-nums">#{node.position}</span>
              <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
                {t(lang, typeMeta?.labelKey as TKey || node.type)}
              </span>
            </div>
            <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 truncate mt-0.5">{node.label}</p>
          </div>

          {/* Target indicator */}
          {targetInfo && !expanded && (
            <div className="hidden sm:flex items-center gap-1 text-xs text-neutral-400 dark:text-neutral-500 shrink-0">
              <ArrowDownToDot size={12} />
              <span className="truncate max-w-[100px]">{targetInfo.label || '?'}</span>
            </div>
          )}

          {/* Expand toggle */}
          <button className="p-1 rounded-md text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 shrink-0">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {/* Expanded editor */}
        {expanded && (
          <div className="px-4 pb-4 border-t border-neutral-100 dark:border-neutral-800 pt-4 space-y-4">
            {/* Label */}
            <Field label={t(lang, 'label' as TKey)}>
              <input
                className="input w-full h-9"
                value={editLabel}
                onChange={e => setEditLabel(e.target.value)}
              />
            </Field>

            {/* Type-specific config */}
            <NodeConfigEditor
              node={{ ...node, config: editConfig }}
              nodes={nodes}
              lang={lang}
              onChange={setEditConfig}
            />

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800 flex-wrap">
              <button
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending || !editLabel.trim()}
                className="btn-primary text-sm px-4 py-2 flex items-center gap-1.5"
              >
                {updateMutation.isPending ? (
                  <span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                ) : (
                  <Check size={14} />
                )}
                {t(lang, 'flow_save_node' as TKey)}
              </button>

              <div className="flex items-center gap-1 ml-auto">
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className={`btn-ghost text-sm p-2 ${showPreview ? 'bg-neutral-100 dark:bg-neutral-800' : ''}`}
                  title={t(lang, 'flow_preview' as TKey)}
                >
                  <Eye size={14} />
                </button>
                <button onClick={onMoveUp} disabled={isFirst} className="btn-ghost text-sm p-2 disabled:opacity-30" title="Move up">
                  <ArrowUp size={14} />
                </button>
                <button onClick={onMoveDown} disabled={node.position === nodes.length - 1} className="btn-ghost text-sm p-2 disabled:opacity-30" title="Move down">
                  <ArrowDown size={14} />
                </button>
                <button onClick={onDuplicate} className="btn-ghost text-sm p-2" title={t(lang, 'flow_duplicate' as TKey)}>
                  <Copy size={14} />
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="btn-ghost text-sm p-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Preview */}
            {showPreview && <NodePreview node={{ ...node, config: editConfig }} lang={lang} />}
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => { setShowDeleteConfirm(false); deleteMutation.mutate() }}
        lang={lang}
        loading={deleteMutation.isPending}
        title={t(lang, 'confirmDeleteTitle' as TKey)}
        body={`Delete node "${node.label}"? This cannot be undone.`}
        confirmLabel={t(lang, 'delete' as TKey)}
        icon={AlertTriangle}
      />
    </div>
  )
}

// ─── Add Node Dropdown ────────────────────────────────────────────────────
function AddNodeDropdown({ flowId, lang, onAdded, position }: {
  flowId: string
  lang: 'FR' | 'EN'
  onAdded: () => void
  position: number
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)

  const addMut = useMutation({
    mutationFn: (type: NodeType) => addFlowNode(flowId, {
      type,
      label: NODE_TYPE_MAP.get(type) ? t(lang, NODE_TYPE_MAP.get(type)!.labelKey as TKey) : type,
      config: DEFAULT_CONFIGS[type],
      position,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flows'] })
      toast(t(lang, 'flow_node_added' as TKey), 'success')
      onAdded()
      setOpen(false)
    },
    onError: () => toast(t(lang, 'errorSaving' as TKey), 'error'),
  })

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full py-2 rounded-lg border-2 border-dashed border-neutral-300 dark:border-neutral-600 hover:border-blue-400 dark:hover:border-blue-500 text-neutral-400 hover:text-blue-500 transition-colors flex items-center justify-center gap-1.5 text-sm"
      >
        <Plus size={14} />
        {t(lang, 'flow_add_node' as TKey)}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 mt-2 z-50 bg-white dark:bg-neutral-900 rounded-xl shadow-xl border border-neutral-200 dark:border-neutral-700 p-2 max-h-64 overflow-y-auto">
            <div className="grid grid-cols-1 gap-1">
              {NODE_TYPES.map(nt => (
                <button
                  key={nt.value}
                  onClick={() => addMut.mutate(nt.value)}
                  disabled={addMut.isPending}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors text-left"
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${nt.color}`}>
                    <nt.icon size={13} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{t(lang, nt.labelKey)}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Flow Builder (single flow, expanded view) ────────────────────────────
function FlowBuilder({ flow, lang, onClose }: {
  flow: Flow
  lang: 'FR' | 'EN'
  onClose: () => void
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [flowName, setFlowName] = useState(flow.name)
  const [nodes, setNodes] = useState<FlowNode[]>(() => [...(flow.nodes || [])].sort((a, b) => a.position - b.position))

  // Sync nodes when flow changes
  useEffect(() => {
    setNodes([...(flow.nodes || [])].sort((a, b) => a.position - b.position))
    setFlowName(flow.name)
  }, [flow])

  const updateFlowMut = useMutation({
    mutationFn: () => updateFlow(flow.id, { name: flowName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flows'] })
      toast(t(lang, 'saved' as TKey), 'success')
    },
    onError: () => toast(t(lang, 'errorSaving' as TKey), 'error'),
  })

  const reorderMut = useMutation({
    mutationFn: (nodeIds: string[]) => reorderFlowNodes(flow.id, nodeIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flows'] })
    },
  })

  const duplicateMut = useMutation({
    mutationFn: (node: FlowNode) => addFlowNode(flow.id, {
      type: node.type,
      label: `${node.label} (copy)`,
      config: node.config,
      position: nodes.length,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flows'] })
      toast('Node duplicated', 'success')
    },
    onError: () => toast(t(lang, 'errorSaving' as TKey), 'error'),
  })

  const handleMoveUp = (index: number) => {
    if (index === 0) return
    const newNodes = [...nodes]
    const [moved] = newNodes.splice(index, 1)
    newNodes.splice(index - 1, 0, moved)
    setNodes(newNodes)
    reorderMut.mutate(newNodes.map(n => n.id))
  }

  const handleMoveDown = (index: number) => {
    if (index >= nodes.length - 1) return
    const newNodes = [...nodes]
    const [moved] = newNodes.splice(index, 1)
    newNodes.splice(index + 1, 0, moved)
    setNodes(newNodes)
    reorderMut.mutate(newNodes.map(n => n.id))
  }

  const handleDuplicate = (node: FlowNode) => {
    duplicateMut.mutate(node)
  }

  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 overflow-hidden">
      {/* Flow header with inline editing */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <input
            className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 bg-transparent border-none outline-none focus:ring-0 p-0 flex-1 min-w-0"
            value={flowName}
            onChange={e => setFlowName(e.target.value)}
            onBlur={() => { if (flowName !== flow.name) updateFlowMut.mutate() }}
            onKeyDown={e => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur() } }}
          />
          <span className="text-xs text-neutral-400 shrink-0">{nodes.length} {t(lang, 'flow_nodes_count' as TKey)}</span>
        </div>
        <button onClick={onClose} className="btn-ghost text-sm px-3 py-1.5 shrink-0">
          <ChevronDown size={16} />
        </button>
      </div>

      {/* Nodes */}
      <div className="px-5 py-6">
        {nodes.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
              <GitBranch size={24} className="text-neutral-400" />
            </div>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">{t(lang, 'flow_no_nodes' as TKey)}</p>
            <AddNodeDropdown flowId={flow.id} lang={lang} onAdded={() => queryClient.invalidateQueries({ queryKey: ['flows'] })} position={0} />
          </div>
        ) : (
          <div className="space-y-0">
            {nodes.map((node, index) => (
              <div key={node.id}>
                <NodeCard
                  node={node}
                  nodes={nodes}
                  flowId={flow.id}
                  lang={lang}
                  isFirst={index === 0}
                  onUpdated={() => queryClient.invalidateQueries({ queryKey: ['flows'] })}
                  onDeleted={() => queryClient.invalidateQueries({ queryKey: ['flows'] })}
                  onMoveUp={() => handleMoveUp(index)}
                  onMoveDown={() => handleMoveDown(index)}
                  onDuplicate={() => handleDuplicate(node)}
                />
                {index < nodes.length - 1 && (
                  <div className="flex justify-center py-1">
                    <div className="flex items-center gap-1 text-neutral-300 dark:text-neutral-600">
                      <Cable size={12} />
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Add node at end */}
            <div className="mt-6">
              <AddNodeDropdown
                flowId={flow.id}
                lang={lang}
                onAdded={() => queryClient.invalidateQueries({ queryKey: ['flows'] })}
                position={nodes.length}
              />
            </div>
          </div>
        )}
      </div>

      {/* Stats bar */}
      {nodes.length > 0 && (
        <div className="px-5 py-3 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50 flex items-center gap-4 text-xs text-neutral-500">
          <span className="flex items-center gap-1"><LayoutGrid size={12} /> {nodes.length} {t(lang, 'flow_nodes_count' as TKey)}</span>
          <span className="flex items-center gap-1">
            <Play size={12} className="text-green-500" />
            {t(lang, 'flow_start_node' as TKey)}: {nodes[0]?.label || '—'}
          </span>
          <span className="flex items-center gap-1">
            <Circle size={12} className="text-neutral-400" />
            End: {nodes[nodes.length - 1]?.type === 'END' ? nodes[nodes.length - 1]?.label : 'No END node'}
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Main Flows Page ──────────────────────────────────────────────────────
export function FlowsPage() {
  const { lang } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [editingFlowId, setEditingFlowId] = useState<string | null>(null)
  const [newFlowName, setNewFlowName] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Flow | null>(null)

  const { data: flows, isLoading, error } = useQuery({
    queryKey: ['flows'],
    queryFn: getFlows,
  })

  const { data: activeFlowId } = useQuery({
    queryKey: ['activeFlow'],
    queryFn: async () => {
      const data = await getActiveFlow()
      return data?.id || null
    },
  })

  const createMutation = useMutation({
    mutationFn: () => createFlow({ name: newFlowName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flows'] })
      setNewFlowName('')
      setShowCreate(false)
      toast(t(lang, 'created'), 'success')
    },
    onError: () => toast(t(lang, 'errorSaving'), 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFlow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flows'] })
      toast(t(lang, 'deleted'), 'success')
      setDeleteTarget(null)
    },
    onError: () => toast(t(lang, 'errorSaving'), 'error'),
  })

  const activateMutation = useMutation({
    mutationFn: (id: string) => activateFlow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activeFlow'] })
      toast(t(lang, 'flow_activated' as TKey), 'success')
    },
    onError: () => toast(t(lang, 'errorSaving'), 'error'),
  })

  const deactivateMutation = useMutation({
    mutationFn: () => deactivateFlow(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activeFlow'] })
      toast(t(lang, 'flow_deactivated' as TKey), 'success')
    },
    onError: () => toast(t(lang, 'errorSaving'), 'error'),
  })

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-neutral-200 border-t-blue-500 rounded-full animate-spin" />
    </div>
  )

  if (error) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <AlertTriangle size={24} className="text-red-400" />
      <p className="text-sm text-neutral-500">{t(lang, 'errorLoading')}</p>
      <button className="btn-outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['flows'] })}>
        {t(lang, 'tryAgain')}
      </button>
    </div>
  )

  const flowList: Flow[] = flows || []
  const editingFlow = editingFlowId ? flowList.find(f => f.id === editingFlowId) : null

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">{t(lang, 'flow_title' as TKey)}</h1>
          <p className="text-sm text-neutral-500 mt-1">{t(lang, 'flow_subtitle' as TKey)}</p>
        </div>
        <button onClick={() => { setEditingFlowId(null); setShowCreate(true) }} className="btn-primary flex items-center gap-2">
          <Plus size={16} />
          {t(lang, 'flow_add' as TKey)}
        </button>
      </div>

      {/* Active flow indicator */}
      {activeFlowId && !editingFlowId && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
          <div className="relative">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping opacity-50" />
          </div>
          <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
            {t(lang, 'flow_active_hint' as TKey)}
          </span>
          <button
            onClick={() => deactivateMutation.mutate()}
            className="ml-auto text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
          >
            <Square size={14} />
            {t(lang, 'flow_deactivate' as TKey)}
          </button>
        </div>
      )}

      {/* Editing flow */}
      {editingFlow && (
        <FlowBuilder
          flow={editingFlow}
          lang={lang}
          onClose={() => setEditingFlowId(null)}
        />
      )}

      {/* Create dialog */}
      {showCreate && !editingFlowId && (
        <div className="p-5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 space-y-4 shadow-lg">
          <h3 className="font-medium text-neutral-800 dark:text-neutral-200">{t(lang, 'flow_add' as TKey)}</h3>
          <input
            value={newFlowName}
            onChange={e => setNewFlowName(e.target.value)}
            placeholder={t(lang, 'flow_name_placeholder' as TKey)}
            className="input w-full"
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter' && newFlowName.trim()) createMutation.mutate() }}
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => createMutation.mutate()}
              disabled={!newFlowName.trim() || createMutation.isPending}
              className="btn-primary text-sm px-4 py-2"
            >
              {createMutation.isPending ? t(lang, 'saving' as TKey) : t(lang, 'create' as TKey)}
            </button>
            <button onClick={() => { setShowCreate(false); setNewFlowName('') }} className="btn-ghost text-sm px-4 py-2">
              {t(lang, 'cancel' as TKey)}
            </button>
          </div>
        </div>
      )}

      {/* Flow list (collapsed view) */}
      {!editingFlowId && (
        <>
          {flowList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-20 h-20 mb-4 rounded-3xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                <GitBranch size={32} className="text-neutral-400" />
              </div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">{t(lang, 'noData')}</p>
              {!showCreate && (
                <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
                  <Plus size={16} />
                  {t(lang, 'flow_add' as TKey)}
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-3">
              {flowList.map((flow: Flow) => {
                const isActive = activeFlowId === flow.id
                const sortedNodes = [...(flow.nodes || [])].sort((a, b) => a.position - b.position)
                const firstNode = sortedNodes[0]
                const lastNode = sortedNodes[sortedNodes.length - 1]

                return (
                  <div
                    key={flow.id}
                    className={`rounded-xl border-2 transition-all duration-200 ${
                      isActive
                        ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/20'
                        : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-600'
                    } overflow-hidden cursor-pointer`}
                    onClick={() => setEditingFlowId(flow.id)}
                  >
                    <div className="p-5">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">{flow.name}</h3>
                            {isActive && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                {t(lang, 'active' as TKey)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-neutral-400">
                            <span>{sortedNodes.length} {t(lang, 'flow_nodes_count' as TKey)}</span>
                            {firstNode && (
                              <span className="flex items-center gap-1">
                                <Play size={10} />
                                {firstNode.label}
                              </span>
                            )}
                            {lastNode?.type === 'END' && (
                              <span className="flex items-center gap-1">
                                <Circle size={8} />
                                Ends
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                          {!isActive && sortedNodes.length > 0 && (
                            <button
                              onClick={() => activateMutation.mutate(flow.id)}
                              className="btn-ghost h-8 w-8 p-0 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                              title={t(lang, 'flow_activate' as TKey)}
                            >
                              <Play size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => setEditingFlowId(flow.id)}
                            className="btn-ghost h-8 w-8 p-0"
                            title={t(lang, 'edit' as TKey)}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(flow)}
                            className="btn-ghost h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                            title={t(lang, 'delete' as TKey)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Mini node preview */}
                      {sortedNodes.length > 0 && (
                        <div className="mt-3 flex items-center gap-1 text-xs text-neutral-400">
                          {sortedNodes.slice(0, 5).map((n, i) => {
                            const nm = NODE_TYPE_MAP.get(n.type)
                            const NmIcon = nm?.icon
                            return (
                            <span key={n.id} className="flex items-center gap-1">
                              <span className={`px-1.5 py-0.5 rounded ${
                                nm?.color || 'bg-neutral-100 dark:bg-neutral-800'
                              } text-[10px] font-medium`}>
                                {NmIcon && <NmIcon size={10} className="inline mr-0.5" />}
                                {t(lang, (nm?.labelKey ?? n.type) as TKey).slice(0, 8)}
                              </span>
                              {i < Math.min(sortedNodes.length - 1, 4) && <Cable size={10} className="text-neutral-300" />}
                            </span>
                            )
                          })}
                          {sortedNodes.length > 5 && <span className="text-neutral-300">+{sortedNodes.length - 5} more</span>}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id) }}
        lang={lang}
        loading={deleteMutation.isPending}
        title={t(lang, 'confirmDeleteTitle' as TKey)}
        body={deleteTarget ? `Permanently delete flow "${deleteTarget.name}" and all its nodes?` : ''}
        confirmLabel={t(lang, 'delete' as TKey)}
        icon={AlertTriangle}
        permanent
      />
    </div>
  )
}