import { Link } from 'react-router-dom';

interface AppLogoProps {
  size?: 'sm' | 'md' | 'lg';
  to?: string;
  showTagline?: boolean;
}

const SIZES = {
  sm: { box: 'h-8 w-8 rounded-lg', icon: 16, text: 'text-base' },
  md: { box: 'h-9 w-9 rounded-xl', icon: 18, text: 'text-lg' },
  lg: { box: 'h-12 w-12 rounded-2xl', icon: 26, text: 'text-2xl' },
};

export default function AppLogo({ size = 'md', to = '/', showTagline = false }: AppLogoProps) {
  const s = SIZES[size];
  return (
    <Link to={to} className="flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600" aria-label="PharmaChain home">
      <img
        src="/logo.jpg"
        alt="PharmaChain Logo"
        className={`${s.box} shrink-0 object-cover`}
        aria-hidden="true"
      />
      <span className="leading-tight">
        <span className={`block bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text font-bold text-transparent ${s.text}`}>
          PharmaChain
        </span>
        {showTagline && (
          <span className="block text-[11px] text-slate-500">Secure pharmaceutical supply-chain traceability</span>
        )}
      </span>
    </Link>
  );
}
