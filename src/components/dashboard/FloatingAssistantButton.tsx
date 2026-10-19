import { Bot } from 'lucide-react';

interface FloatingAssistantButtonProps {
  onClick?: () => void;
}

/**
 * Floating AI assistant button, bottom-right, above all page content.
 * The tooltip shows on hover/focus; the aria-label covers screen readers.
 */
export default function FloatingAssistantButton({ onClick }: FloatingAssistantButtonProps) {
  return (
    <div className="group fixed bottom-5 right-5 z-40 sm:bottom-6 sm:right-6">
      <span
        role="tooltip"
        className="pointer-events-none absolute right-full top-1/2 mr-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        Open PharmaChain Assistant
      </span>
      <button
        type="button"
        onClick={onClick}
        aria-label="Open PharmaChain Assistant"
        aria-haspopup="dialog"
        className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-xl transition-all duration-200 hover:scale-105 hover:shadow-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 active:scale-95 sm:h-16 sm:w-16"
      >
        <Bot size={28} aria-hidden="true" />
      </button>
    </div>
  );
}
