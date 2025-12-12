
import { PastelColor } from './types';

// For Cards (Solid/Intense pastel)
export const COLORS: Record<PastelColor, string> = {
  pink: 'bg-red-100 hover:bg-red-200 border-red-200 text-red-800',
  blue: 'bg-blue-100 hover:bg-blue-200 border-blue-200 text-blue-800',
  green: 'bg-green-100 hover:bg-green-200 border-green-200 text-green-800',
  yellow: 'bg-amber-100 hover:bg-amber-200 border-amber-200 text-amber-800',
  purple: 'bg-purple-100 hover:bg-purple-200 border-purple-200 text-purple-800',
  orange: 'bg-orange-100 hover:bg-orange-200 border-orange-200 text-orange-800',
  rose: 'bg-rose-100 hover:bg-rose-200 border-rose-200 text-rose-800',
  sky: 'bg-sky-100 hover:bg-sky-200 border-sky-200 text-sky-800',
  teal: 'bg-teal-100 hover:bg-teal-200 border-teal-200 text-teal-800',
  indigo: 'bg-indigo-100 hover:bg-indigo-200 border-indigo-200 text-indigo-800',
  slate: 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-800',
};

// For Columns (Lighter, more subtle backgrounds)
export const COLUMN_COLORS: Record<PastelColor, string> = {
  pink: 'bg-red-50/80 border-red-100',
  blue: 'bg-blue-50/80 border-blue-100',
  green: 'bg-green-50/80 border-green-100',
  yellow: 'bg-amber-50/80 border-amber-100',
  purple: 'bg-purple-50/80 border-purple-100',
  orange: 'bg-orange-50/80 border-orange-100',
  rose: 'bg-rose-50/80 border-rose-100',
  sky: 'bg-sky-50/80 border-sky-100',
  teal: 'bg-teal-50/80 border-teal-100',
  indigo: 'bg-indigo-50/80 border-indigo-100',
  slate: 'bg-slate-50/80 border-slate-200',
};

// Hex codes for the color picker display
export const COLOR_HEX: Record<PastelColor, string> = {
  pink: '#fee2e2',
  blue: '#dbeafe',
  green: '#dcfce7',
  yellow: '#fef3c7',
  purple: '#f3e8ff',
  orange: '#ffedd5',
  rose: '#ffe4e6',
  sky: '#e0f2fe',
  teal: '#ccfbf1',
  indigo: '#e0e7ff',
  slate: '#f1f5f9',
};

export const COLOR_KEYS: PastelColor[] = [
  'pink', 'rose', 'orange', 'yellow', 
  'green', 'teal', 'sky', 'blue', 
  'indigo', 'purple', 'slate'
];

export const PLACEHOLDER_TEXTS = [
  "Comprar leite 🥛",
  "Reunião de design 🎨",
  "Ler 10 páginas 📖",
  "Caminhada matinal ☀️",
  "Pagar contas 💸",
  "Ligar para mãe 📞",
  "Ideia de app 💡"
];
