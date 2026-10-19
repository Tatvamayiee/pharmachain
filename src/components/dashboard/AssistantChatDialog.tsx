import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { api } from '../../lib/api';

interface AssistantChatDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Render a plain-text assistant reply as simple formatted lines.
 *  The system prompt forbids markdown, so we only need paragraphs, numbered
 *  steps and dashes — no markdown library required. React escapes everything,
 *  so this stays XSS-safe. */
function FormattedText({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1.5">
      {lines.map((raw, i) => {
        const line = raw.trimEnd();
        if (line === '') return null;
        const isNumbered = /^\d+[.)]\s/.test(line);
        const isDash = /^[-•]\s/.test(line);
        if (isNumbered || isDash) {
          return (
            <p key={i} className="text-sm leading-snug ps-3 -indent-3">
              {line}
            </p>
          );
        }
        return (
          <p key={i} className="text-sm leading-snug">
            {line}
          </p>
        );
      })}
    </div>
  );
}

export default function AssistantChatDialog({ isOpen, onClose }: AssistantChatDialogProps) {
  const location = useLocation();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [loading, setLoading] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    closeRef.current?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, isOpen]);

  // Keep the newest message in view as the conversation grows.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, loading]);

  if (!isOpen) return null;

  const sendMessage = async () => {
    const trimmed = message.trim();
    if (!trimmed || loading) return;

    setMessages((prev) => [...prev, { role: 'user', content: trimmed }]);
    setMessage('');
    setLoading(true);

    try {
      // Send prior turns so the backend can ground the assistant in this
      // conversation (server caps/sanitizes the history).
      const history = messages
        .slice(-12)
        .map((m) => ({ role: m.role, content: m.content }));

      const result = await api<{ reply: string }>('/api/ai/chat', {
        method: 'POST',
        // `page` lets the server tailor answers to the page the user is on
        // (server sanitizes it; optional field, so old clients are unaffected).
        body: JSON.stringify({ message: trimmed, history, page: location.pathname }),
      });

      setMessages((prev) => [...prev, { role: 'assistant', content: result.reply }]);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends; Shift+Enter inserts a newline.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="PharmaChain Assistant"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg max-h-[80vh] rounded-2xl bg-white shadow-2xl animate-fade-in overflow-hidden">
        {/* Header */}
        <header className="border-b border-slate-100 px-5 py-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">PharmaChain AI Assistant</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close assistant"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            <X size={17} />
          </button>
        </header>

        {/* Messages area */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-5 py-4 space-y-3"
          style={{ maxHeight: 'calc(80vh - 140px)' }}
        >
          {messages.length === 0 && (
            <p className="text-slate-500 text-sm text-center py-8">
              Ask me anything about prescriptions, medicines, or pharmacy operations.
            </p>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`p-3 rounded-lg ${
                msg.role === 'user' ? 'bg-indigo-100 text-slate-900 ms-auto' : 'bg-slate-100 text-slate-900 mr-auto'
              } max-w-xs sm:max-w-sm`}
            >
              {msg.role === 'assistant' ? (
                <FormattedText text={msg.content} />
              ) : (
                <p className="text-sm leading-snug">{msg.content}</p>
              )}
            </div>
          ))}

          {loading && (
            <div className="p-3 rounded-lg bg-indigo-100 text-slate-900 max-w-xs">
              <p className="text-xs text-slate-500">Assistant is thinking…</p>
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="border-t border-slate-100 px-5 py-3 flex gap-2">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type a message…"
            disabled={loading}
            className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 resize-none"
            rows={1}
            ref={inputRef}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !message.trim()}
            className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            {loading ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
