import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, Mail, MapPin, Phone, Send } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

const contactSchema = z.object({
  name: z.string().min(2, 'Please enter your name'),
  email: z.string().email('Enter a valid email address'),
  subject: z.string().min(3, 'Subject is required'),
  message: z.string().min(10, 'Message should be at least 10 characters'),
});

type ContactValues = z.infer<typeof contactSchema>;

const CHANNELS = [
  { icon: Mail, label: 'Email', value: 'support@pharmachain.com' },
  { icon: Phone, label: 'Phone', value: '+91 422 350 0100' },
  { icon: MapPin, label: 'Office', value: 'Avinashi Road, Coimbatore, Tamil Nadu 641014' },
  { icon: Building2, label: 'Support hours', value: 'Mon–Sat, 9:00–18:00 IST' },
];

export default function Contact() {
  const { toast } = useToast();
  const [sent, setSent] = useState(false);
  const {
    register, handleSubmit, reset, formState: { errors, isSubmitting },
  } = useForm<ContactValues>({ resolver: zodResolver(contactSchema) });

  const onSubmit = async (values: ContactValues) => {
    await new Promise((r) => setTimeout(r, 700)); // simulate API
    void values;
    setSent(true);
    reset();
    toast('Message sent — our team will reply within 2 business days.', 'success');
  };

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[380px_1fr]">
      <section aria-label="Contact information">
        <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600">Contact</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">Talk to PharmaChain</h1>
        <p className="mt-3 text-slate-600">
          Questions about integration, pilots or the platform? Send a message or reach us directly.
        </p>
        <div className="mt-7 space-y-3">
          {CHANNELS.map((c) => (
            <div key={c.label} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600" aria-hidden="true">
                <c.icon size={17} />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{c.label}</p>
                <p className="mt-0.5 text-sm text-slate-700">{c.value}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section aria-label="Contact form" className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8">
        {sent && (
          <p role="status" className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            Thanks for reaching out — your message has been recorded.
          </p>
        )}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Name</span>
              <input {...register('name')} aria-invalid={!!errors.name}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100" placeholder="Your name" />
              {errors.name && <span role="alert" className="mt-1 block text-xs font-medium text-red-600">{errors.name.message}</span>}
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Email</span>
              <input type="email" {...register('email')} aria-invalid={!!errors.email}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100" placeholder="you@company.com" />
              {errors.email && <span role="alert" className="mt-1 block text-xs font-medium text-red-600">{errors.email.message}</span>}
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Subject</span>
            <input {...register('subject')} aria-invalid={!!errors.subject}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100" placeholder="Integration enquiry" />
            {errors.subject && <span role="alert" className="mt-1 block text-xs font-medium text-red-600">{errors.subject.message}</span>}
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Message</span>
            <textarea rows={5} {...register('message')} aria-invalid={!!errors.message}
              className="w-full resize-y rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100" placeholder="How can we help?" />
            {errors.message && <span role="alert" className="mt-1 block text-xs font-medium text-red-600">{errors.message.message}</span>}
          </label>
          <button
            type="submit" disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
          >
            {isSubmitting ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" /> : <Send size={15} aria-hidden="true" />}
            {isSubmitting ? 'Sending…' : 'Send message'}
          </button>
        </form>
      </section>
    </div>
  );
}
