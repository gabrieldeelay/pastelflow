
import React, { useState } from 'react';
import { Lock, ArrowRight, ShieldCheck } from 'lucide-react';

interface Props {
  onSuccess: () => void;
}

const AccessGate: React.FC<Props> = ({ onSuccess }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.toLowerCase() === 'acforever') {
      onSuccess();
    } else {
      setError(true);
      setTimeout(() => setError(false), 1000); // Shake animation reset
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper p-4">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl shadow-stone-200/50 border border-stone-100 text-center">
        <div className="bg-pastel-pink/30 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 text-red-400">
          <Lock size={32} />
        </div>
        
        <h1 className="text-2xl font-bold text-stone-700 mb-2">Acesso Restrito</h1>
        <p className="text-stone-500 mb-8">Digite o código secreto para acessar seus projetos.</p>

        <form onSubmit={handleSubmit} className="relative mb-8">
          <input
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Código de acesso"
            className={`
              w-full bg-stone-50 border-2 rounded-xl px-4 py-4 outline-none text-center text-xl tracking-widest text-stone-700 transition-all
              ${error ? 'border-red-300 animate-[shake_0.5s_ease-in-out]' : 'border-stone-100 focus:border-stone-300'}
            `}
          />
          <button
            type="submit"
            className="absolute right-2 top-2 bottom-2 bg-stone-800 text-white rounded-lg px-4 hover:bg-stone-700 transition-colors"
          >
            <ArrowRight size={20} />
          </button>
        </form>

        <div className="pt-6 border-t border-stone-50 flex flex-col items-center justify-center gap-2">
            <div className="flex items-center gap-1.5 text-stone-400">
                <ShieldCheck size={14} />
                <span className="text-[10px] font-bold uppercase tracking-widest">Ambiente Seguro</span>
            </div>
            <p className="text-xs text-stone-400">
                Este sistema é de uso exclusivo do <span className="font-bold text-stone-600">Grupo A.C.</span>
            </p>
        </div>

      </div>
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
      `}</style>
    </div>
  );
};

export default AccessGate;
