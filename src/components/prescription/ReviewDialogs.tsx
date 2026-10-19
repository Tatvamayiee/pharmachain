// ---------------------------------------------------------------------------
// ReviewDialogs — all decision Modals of the workflow (note, draft, approve,
// reject, clarify, dispense). Each owns only its input state; decisions are
// delegated upward via the on* callbacks. No native alert/prompt/confirm.
// ---------------------------------------------------------------------------

import { useState } from 'react';
import Modal from '../ui/Modal';
import ConfirmDialog from '../ui/ConfirmDialog';
import { StatusBadgeFor } from './shared';
import type { PrescriptionRecord } from '../../types/prescription';

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 transition-colors focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100';

const btnGhost =
  'rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600';

const btnPrimary =
  'rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600';

// ------------------------------- Note dialog --------------------------------

export type AlertKind = 'interaction' | 'dosage';

interface NoteDialogProps {
  target: { kind: AlertKind; alertId: string; title: string } | null;
  onClose: () => void;
  onSave: (note: string) => void;
}

export function NoteDialog({ target, onClose, onSave }: NoteDialogProps) {
  const [text, setText] = useState('');
  const close = () => { setText(''); onClose(); };
  const save = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSave(trimmed);
    setText('');
  };

  return (
    <Modal isOpen={target !== null} onClose={close} title="Add pharmacist note">
      <p className="text-sm text-slate-500">
        Alert: <span className="font-medium text-slate-700">{target?.title}</span>
      </p>
      <label className="mt-3 block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Note</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          autoFocus
          aria-label="Pharmacist note"
          placeholder="e.g. Prescriber contacted — frequency confirmed"
          className={inputCls}
        />
      </label>
      <p className="mt-2 text-[11px] text-slate-400">Stored locally in this session only — nothing is sent to a server.</p>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={close} className={btnGhost}>Cancel</button>
        <button type="button" onClick={save} disabled={!text.trim()} className={btnPrimary}>Save note</button>
      </div>
    </Modal>
  );
}

// ------------------------------- Draft dialog -------------------------------

interface DraftDialogProps {
  isOpen: boolean;
  recordId: string | null;
  onClose: () => void;
  onSave: (pharmacistName: string) => void;
}

export function DraftDialog({ isOpen, recordId, onClose, onSave }: DraftDialogProps) {
  const [name, setName] = useState('');
  const close = () => { setName(''); onClose(); };
  const save = () => {
    onSave(name.trim() || 'Demo pharmacist (unrecorded)');
    setName('');
  };

  return (
    <Modal isOpen={isOpen} onClose={close} title="Save local review draft">
      <p className="text-sm text-slate-500">
        Prescription <span className="font-mono font-medium text-slate-700">{recordId}</span> — records this
        session's corrections, acknowledged alerts and notes against the local record. Nothing is persisted in any backend.
      </p>
      <label className="mt-3 block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Reviewing pharmacist (prototype)</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Reviewing pharmacist name"
          placeholder="e.g. S. Meena, B.Pharm"
          className={inputCls}
        />
      </label>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={close} className={btnGhost}>Cancel</button>
        <button type="button" onClick={save} className={btnPrimary}>Save draft</button>
      </div>
    </Modal>
  );
}

// ------------------------------ Reject dialog -------------------------------

const REJECT_REASONS = [
  'Suspected interaction',
  'Dosage concern',
  'Unclear handwriting',
  'Invalid prescription',
  'Patient information incomplete',
  'Other',
] as const;
interface RejectDialogProps {
  isOpen: boolean;
  recordId: string | null;
  onClose: () => void;
  onConfirm: (reason: string, note: string) => void | Promise<void>;
}

export function RejectDialog({ isOpen, recordId, onClose, onConfirm }: RejectDialogProps) {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const close = () => { setReason(''); setNote(''); setConfirmOpen(false); onClose(); };
  const ready = reason !== '';

  return (
    <>
      <Modal isOpen={isOpen} onClose={close} title="Reject prescription">
        <p className="text-sm text-slate-500">
          Prescription <span className="font-mono font-medium text-slate-700">{recordId}</span> — a rejection
          reason is required and an audit event will be recorded.
        </p>
        <fieldset className="mt-3">
          <legend className="mb-1.5 block text-sm font-medium text-slate-700">Rejection reason <span className="text-red-500" aria-hidden="true">*</span></legend>
          <div className="grid gap-1.5">
            {REJECT_REASONS.map((r) => (
              <label key={r} className="flex items-center gap-2 rounded-lg px-1 py-0.5 text-sm text-slate-700">
                <input
                  type="radio"
                  name={`reject-reason-${recordId ?? 'x'}`}
                  value={r}
                  checked={reason === r}
                  onChange={() => setReason(r)}
                  className="h-4 w-4 border-slate-300 text-red-600 focus:ring-red-200"
                />
                {r}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="mt-3 block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Additional note (optional)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            aria-label="Additional rejection note"
            className={inputCls}
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={close} className={btnGhost}>Cancel</button>
          <button
            type="button"
            disabled={!ready}
            onClick={() => setConfirmOpen(true)}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-600"
          >
            Continue rejection
          </button>
        </div>
      </Modal>
      <ConfirmDialog
        isOpen={confirmOpen}
        title="Confirm rejection"
        tone="danger"
        message={`Reject ${recordId ?? 'this prescription'} for: ${reason}? This cannot be undone and the prescription cannot be dispensed afterwards.`}
        confirmLabel="Reject prescription"
        onConfirm={() => { onConfirm(reason, note.trim()); close(); }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}

// --------------------------- Clarification dialog ---------------------------

const RECIPIENTS = [
  { value: 'prescriber', label: 'Prescriber' },
  { value: 'department', label: 'Hospital department' },
  { value: 'patient', label: 'Patient' },
  { value: 'internal_pharmacist', label: 'Internal pharmacist' },
] as const;

interface ClarifyDialogProps {
  isOpen: boolean;
  recordId: string | null;
  onClose: () => void;
  onConfirm: (message: string, recipient: 'prescriber' | 'department' | 'patient' | 'internal_pharmacist') => void;
}

export function ClarifyDialog({ isOpen, recordId, onClose, onConfirm }: ClarifyDialogProps) {
  const [message, setMessage] = useState('');
  const [recipient, setRecipient] = useState<(typeof RECIPIENTS)[number]['value']>('prescriber');
  const close = () => { setMessage(''); setRecipient('prescriber'); onClose(); };
  const ready = message.trim().length > 0;

  return (
    <Modal isOpen={isOpen} onClose={close} title="Request clarification">
      <p className="text-sm text-slate-500">
        Prescription <span className="font-mono font-medium text-slate-700">{recordId}</span> — the status
        will change to “Clarification Requested” and an audit event will be recorded.
      </p>
      <label className="mt-3 block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Request message <span className="text-red-500" aria-hidden="true">*</span></span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          autoFocus
          aria-label="Clarification message"
          placeholder="e.g. Please confirm the intended frequency for Paracetamol 650 mg"
          className={inputCls}
        />
      </label>
      <fieldset className="mt-3">
        <legend className="mb-1.5 block text-sm font-medium text-slate-700">Send to</legend>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {RECIPIENTS.map((r) => (
            <label key={r.value} className="flex items-center gap-2 rounded-lg px-1 py-0.5 text-sm text-slate-700">
              <input
                type="radio"
                name={`clarify-recipient-${recordId ?? 'x'}`}
                value={r.value}
                checked={recipient === r.value}
                onChange={() => setRecipient(r.value)}
                className="h-4 w-4 border-slate-300 text-indigo-600 focus:ring-indigo-200"
              />
              {r.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={close} className={btnGhost}>Cancel</button>
        <button type="button" disabled={!ready} onClick={() => { onConfirm(message.trim(), recipient); close(); }} className={btnPrimary}>
          Send request
        </button>
      </div>
    </Modal>
  );
}

// ---------------------------- Dispense dialog -------------------------------

interface DispenseDialogProps {
  isOpen: boolean;
  record: PrescriptionRecord | null;
  onClose: () => void;
  onConfirm: (notes: string) => void;
}

export function DispenseDialog({ isOpen, record, onClose, onConfirm }: DispenseDialogProps) {
  const [notes, setNotes] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const close = () => { setNotes(''); setConfirmOpen(false); onClose(); };

  return (
    <>
      <Modal isOpen={isOpen} onClose={close} title="Mark as dispensed">
        {record && (
          <p className="text-sm text-slate-500">
            Prescription <span className="font-mono font-medium text-slate-700">{record.id}</span> —{' '}
            {record.medicineCount} medicine{record.medicineCount === 1 ? '' : 's'} will be recorded as dispensed
            to patient reference <span className="font-medium text-slate-700">{record.patientReference}</span>.
          </p>
        )}
        <label className="mt-3 block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Dispensing notes (optional)</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            aria-label="Dispensing notes"
            placeholder="e.g. Counselling provided on storage"
            className={inputCls}
          />
        </label>
        <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          Inventory is deducted server-side on dispense (FIFO from the organization's batch stock). Shortfalls are reported, not silently ignored.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={close} className={btnGhost}>Cancel</button>
          <button type="button" onClick={() => setConfirmOpen(true)} className={btnPrimary}>Continue</button>
        </div>
      </Modal>
      <ConfirmDialog
        isOpen={confirmOpen}
        title="Confirm dispensing"
        tone="primary"
        message={`Mark ${record?.id ?? 'this prescription'} as dispensed? This is a prototype decision recorded locally only.`}
        confirmLabel="Mark dispensed"
        onConfirm={() => { onConfirm(notes.trim()); close(); }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}

// ---------------------------- Approve dialog --------------------------------

interface ApproveDialogProps {
  isOpen: boolean;
  record: PrescriptionRecord | null;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * Approval confirmation: shows prescription ID, pharmacist name, medicine
 * count, critical-alert count and the prototype warning before confirming.
 */
export function ApproveDialog({ isOpen, record, onClose, onConfirm }: ApproveDialogProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const close = () => { setConfirmOpen(false); onClose(); };

  return (
    <>
      <Modal isOpen={isOpen} onClose={close} title="Approve Prescription">
        {record && (
          <div className="space-y-3 text-sm">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
              <div>
                <dt className="text-xs text-slate-400">Prescription</dt>
                <dd className="font-mono font-semibold text-indigo-700">{record.id}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Status</dt>
                <dd><StatusBadgeFor status={record.status} /></dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Pharmacist</dt>
                <dd className="text-slate-700">{record.pharmacistName || <span className="italic text-slate-400">not recorded</span>}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Medicines</dt>
                <dd className="text-slate-700">{record.medicineCount}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Critical alerts</dt>
                <dd className={record.criticalAlerts > 0 ? 'font-semibold text-red-600' : 'text-slate-700'}>{record.criticalAlerts}</dd>
              </div>
            </dl>
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
              Prototype decision — recorded locally only. AI assistance does not replace pharmacist or
              clinician judgment.
            </p>
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={close} className={btnGhost}>Cancel</button>
          <button type="button" onClick={() => setConfirmOpen(true)} className={btnPrimary}>Continue approval</button>
        </div>
      </Modal>
      <ConfirmDialog
        isOpen={confirmOpen}
        title="Confirm approval"
        tone="primary"
        message={`Approve ${record?.id ?? 'this prescription'} for dispensing? This is a prototype decision recorded locally only.`}
        confirmLabel="Approve prescription"
        onConfirm={() => { onConfirm(); close(); }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
