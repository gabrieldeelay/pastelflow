
import { PastelColor } from './types';

// For Cards (Solid/Intense pastel)
export const COLORS: Record<PastelColor, string> = {
  pink: 'bg-red-100 hover:bg-red-200 border-red-200 text-red-800',
  blue: 'bg-blue-100 hover:bg-blue-200 border-blue-200 text-blue-800',
  green: 'bg-green-100 hover:bg-green-200 border-green-200 text-green-800',
  yellow: 'bg-amber-100 hover:bg-amber-200 border-amber-200 text-amber-800',
  purple: 'bg-purple-100 hover:bg-purple-200 border-purple-200 text-purple-800',
  orange: 'bg-orange-100 hover:bg-orange-200 border-orange-200 text-orange-800',
};

// For Columns (Lighter, more subtle backgrounds)
export const COLUMN_COLORS: Record<PastelColor, string> = {
  pink: 'bg-red-50/80 border-red-100',
  blue: 'bg-blue-50/80 border-blue-100',
  green: 'bg-green-50/80 border-green-100',
  yellow: 'bg-amber-50/80 border-amber-100',
  purple: 'bg-purple-50/80 border-purple-100',
  orange: 'bg-orange-50/80 border-orange-100',
};

// Hex codes for the color picker display
export const COLOR_HEX: Record<PastelColor, string> = {
  pink: '#fee2e2',
  blue: '#dbeafe',
  green: '#dcfce7',
  yellow: '#fef3c7',
  purple: '#f3e8ff',
  orange: '#ffedd5',
};

export const COLOR_KEYS: PastelColor[] = ['pink', 'blue', 'green', 'yellow', 'purple', 'orange'];

export const PLACEHOLDER_TEXTS = [
  "Comprar leite 🥛",
  "Reunião de design 🎨",
  "Ler 10 páginas 📖",
  "Caminhada matinal ☀️",
  "Pagar contas 💸",
  "Ligar para mãe 📞",
  "Ideia de app 💡"
];
