import React, { useEffect, useState } from 'react';
import { X, Sparkles } from 'lucide-react';

interface Props {
  userName: string;
}

const WelcomeToast: React.FC<Props> = ({ userName }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed top-8 left-1/2 transform -translate-x-1/2 z-[100] w-full max-w-sm px-4">
      <div className="bg-stone-800 text-white rounded-2xl shadow-2xl p-4 flex items-center gap-4 animate-[slideDown_0.5s_ease-out]">
        <div className="bg-stone-700 p-2 rounded-xl">
           <Sparkles size={20} className="text-yellow-300" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-sm">Bem-vindo(a), {userName}!</h3>
          <p className="text-xs text-stone-300 mt-0.5">Prepare-se para organizar suas ideias.</p>
        </div>
        <button 
          onClick={() => setVisible(false)}
          className="text-stone-400 hover:text-white transition-colors"
        >
          <X size={18} />
        </button>
      </div>
      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default WelcomeToast;