
import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, X, GripHorizontal, RefreshCw, Quote } from 'lucide-react';

interface Props {
  onRemove: () => void;
  initialPosition?: { x: number; y: number };
  onLayoutChange: (x: number, y: number) => void;
}

const QUOTES = [
  { text: "A melhor maneira de prever o futuro é criá-lo.", author: "Peter Drucker" },
  { text: "O sucesso é a soma de pequenos esforços repetidos dia após dia.", author: "Robert Collier" },
  { text: "Não tenha medo de desistir do bom para ir atrás do ótimo.", author: "John D. Rockefeller" },
  { text: "Se você não está disposto a arriscar, esteja disposto a uma vida comum.", author: "Jim Rohn" },
  { text: "O único lugar onde o sucesso vem antes do trabalho é no dicionário.", author: "Vidal Sassoon" },
  { text: "Empreender é se jogar de um precipício e construir um avião na queda.", author: "Reid Hoffman" },
  { text: "Seus clientes mais insatisfeitos são sua maior fonte de aprendizado.", author: "Bill Gates" },
  { text: "A inovação distingue um líder de um seguidor.", author: "Steve Jobs" },
  { text: "O segredo do sucesso é começar antes de estar pronto.", author: "Marie Forleo" },
  { text: "Não espere por oportunidades extraordinárias. Agarre ocasiões comuns e torne-as grandes.", author: "Orison Swett Marden" },
  { text: "Seja a mudança que você quer ver no mundo.", author: "Mahatma Gandhi" },
  { text: "Feito é melhor que perfeito.", author: "Sheryl Sandberg" },
  { text: "A lógica leva você de A a B. A imaginação leva você a qualquer lugar.", author: "Albert Einstein" },
  { text: "Obstáculos são aquelas coisas assustadoras que você vê quando tira os olhos do seu objetivo.", author: "Henry Ford" },
  { text: "Persistência é o caminho do êxito.", author: "Charlie Chaplin" },
  { text: "Qualidade significa fazer certo quando ninguém está olhando.", author: "Henry Ford" },
  { text: "Oportunidades não surgem. É você que as cria.", author: "Chris Grosser" },
];

const QuoteWidget: React.FC<Props> = ({ onRemove, initialPosition, onLayoutChange }) => {
  const [position, setPosition] = useState(initialPosition || { x: 400, y: 100 });
  const [currentQuote, setCurrentQuote] = useState(QUOTES[0]);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  
  // History to prevent repetition
  const [shownIndices, setShownIndices] = useState<Set<number>>(new Set([0]));
  
  const widgetRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
      // Pick random initial
      const idx = Math.floor(Math.random() * QUOTES.length);
      setCurrentQuote(QUOTES[idx]);
      setShownIndices(new Set([idx]));
  }, []);

  // --- SAFETY BOUNDS CHECK (Rescue Mission) ---
  useEffect(() => {
    const ensureVisible = () => {
        if (!widgetRef.current) return;
        
        const rect = widgetRef.current.getBoundingClientRect();
        const winW = window.innerWidth;
        const winH = window.innerHeight;
        const margin = 20;

        setPosition(prev => {
            let nextX = prev.x;
            let nextY = prev.y;
            let corrected = false;

            // Check Right/Bottom edges
            // Use local rect width/height if available, otherwise fallback
            const w = rect.width || 340;
            const h = rect.height || 200;

            if (nextX + w > winW) { nextX = Math.max(margin, winW - w - margin); corrected = true; }
            if (nextY + h > winH) { nextY = Math.max(margin, winH - h - margin); corrected = true; }
            
            // Check Left/Top edges
            if (nextX < 0) { nextX = margin; corrected = true; }
            if (nextY < 0) { nextY = margin; corrected = true; }

            if (corrected) {
                onLayoutChange(nextX, nextY); // Sync change
                return { x: nextX, y: nextY };
            }
            return prev;
        });
    };

    // Run shortly after mount to allow layout to settle, and on resize
    const timer = setTimeout(ensureVisible, 100);
    window.addEventListener('resize', ensureVisible);
    
    return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', ensureVisible);
    };
  }, []); // Run on mount

  const handleRefresh = () => {
      if (isAnimating) return;
      setIsAnimating(true);
      
      setTimeout(() => {
          let availableIndices = QUOTES.map((_, i) => i).filter(i => !shownIndices.has(i));
          
          // Reset cycle if all shown
          if (availableIndices.length === 0) {
              availableIndices = QUOTES.map((_, i) => i).filter(i => QUOTES[i].text !== currentQuote.text);
              setShownIndices(new Set());
          }

          const randomIdx = availableIndices[Math.floor(Math.random() * availableIndices.length)];
          
          setShownIndices(prev => {
              const newSet = new Set(prev);
              newSet.add(randomIdx);
              return newSet;
          });

          setCurrentQuote(QUOTES[randomIdx]);
          setIsAnimating(false);
      }, 300);
  };

  // --- DRAG LOGIC ---
  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const rawX = e.clientX - dragOffset.current.x;
        const rawY = e.clientY - dragOffset.current.y;

        // Screen Boundaries Constraints
        const widgetWidth = widgetRef.current?.offsetWidth || 340;
        const widgetHeight = widgetRef.current?.offsetHeight || 200;
        const maxX = window.innerWidth - widgetWidth;
        const maxY = window.innerHeight - widgetHeight;

        // Clamp values
        const newX = Math.max(0, Math.min(rawX, maxX));
        const newY = Math.max(0, Math.min(rawY, maxY));

        setPosition({ x: newX, y: newY });
      }
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        onLayoutChange(position.x, position.y);
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, position, onLayoutChange]);

  return (
    <div 
      ref={widgetRef}
      style={{ 
        position: 'absolute', 
        left: position.x, 
        top: position.y,
        zIndex: 40,
        width: 340 // Slightly wider for better text flow
      }}
      className="bg-white rounded-3xl shadow-xl border border-stone-200 overflow-hidden flex flex-col group animate-in fade-in zoom-in-95"
    >
      {/* Header */}
      <div 
        onMouseDown={handleMouseDown}
        className="bg-purple-50 p-2 flex items-center justify-between cursor-grab active:cursor-grabbing border-b border-purple-100/50 shrink-0 relative z-20"
      >
        <div className="flex items-center gap-2 text-purple-400 font-bold text-xs uppercase px-2">
            <Sparkles size={14} />
            <span>Inspiração</span>
        </div>
        <div className="flex items-center gap-1">
            <GripHorizontal size={16} className="text-purple-200" />
            <button 
                onClick={(e) => { e.stopPropagation(); onRemove(); }}
                className="p-1 hover:bg-red-50 text-stone-400 hover:text-red-500 rounded-full transition-colors"
            >
                <X size={14} />
            </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 pb-8 flex flex-col relative min-h-[160px]">
         
         <div className={`flex flex-col gap-2 transition-opacity duration-300 ${isAnimating ? 'opacity-0' : 'opacity-100'}`}>
             {/* Quote Icon placed distinctly at the start */}
             <div className="mb-[-10px]">
                <Quote className="text-purple-200 rotate-180" size={32} fill="currentColor" fillOpacity={0.2} />
             </div>
             
             {/* Text with left padding to align nicely with the quote mark visual flow */}
             <p className="text-stone-700 font-bold text-lg leading-relaxed font-serif italic pl-4 border-l-2 border-purple-100">
                {currentQuote.text}
             </p>
             
             <div className="mt-4 flex items-center justify-end gap-3">
                 <div className="h-px bg-purple-100 w-8"></div>
                 <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest text-right">
                    {currentQuote.author}
                 </p>
             </div>
         </div>

         <button 
            onClick={handleRefresh}
            className="absolute bottom-2 right-2 p-2 text-stone-300 hover:text-purple-500 hover:bg-purple-50 rounded-full transition-all"
            title="Nova frase"
         >
             <RefreshCw size={14} className={isAnimating ? 'animate-spin' : ''} />
         </button>
      </div>
    </div>
  );
};

export default QuoteWidget;
