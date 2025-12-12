
import React, { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, X, GripHorizontal, Clock, ArrowDownRight } from 'lucide-react';
import { AgendaEvent } from '../types';
import { COLOR_HEX } from '../constants';

interface Props {
  events: AgendaEvent[];
  onOpen: () => void;
  onRemove: () => void;
  initialPosition?: { x: number; y: number };
  initialSize?: { w: number; h: number };
  onLayoutChange: (x: number, y: number, w: number, h: number) => void;
}

const AgendaWidget: React.FC<Props> = ({ events, onOpen, onRemove, initialPosition, initialSize, onLayoutChange }) => {
  const [position, setPosition] = useState(initialPosition || { x: 50, y: 100 });
  const [size, setSize] = useState(initialSize || { w: 288, h: 320 }); // Default w-72 (288px)
  
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });
  
  const today = new Date();
  const dayName = today.toLocaleDateString('pt-BR', { weekday: 'long' });
  const dayNumber = today.getDate();
  const monthName = today.toLocaleDateString('pt-BR', { month: 'long' });

  const todayEvents = events.filter(e => {
      const d = new Date(e.start_time);
      return d.getDate() === today.getDate() && 
             d.getMonth() === today.getMonth() && 
             d.getFullYear() === today.getFullYear();
  }).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  // --- DRAG LOGIC ---
  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  // --- RESIZE LOGIC ---
  const handleResizeDown = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setIsResizing(true);
      resizeStart.current = {
          x: e.clientX,
          y: e.clientY,
          w: size.w,
          h: size.h
      };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newX = e.clientX - dragOffset.current.x;
        const newY = e.clientY - dragOffset.current.y;
        setPosition({ x: newX, y: newY });
      }
      if (isResizing) {
          const deltaX = e.clientX - resizeStart.current.x;
          const deltaY = e.clientY - resizeStart.current.y;
          setSize({
              w: Math.max(200, resizeStart.current.w + deltaX),
              h: Math.max(150, resizeStart.current.h + deltaY)
          });
      }
    };

    const handleMouseUp = () => {
      if (isDragging || isResizing) {
        setIsDragging(false);
        setIsResizing(false);
        onLayoutChange(position.x, position.y, size.w, size.h);
      }
    };

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, position, size, onLayoutChange]);

  return (
    <div 
      style={{ 
        position: 'absolute', 
        left: position.x, 
        top: position.y,
        width: size.w,
        height: size.h,
        zIndex: 50 
      }}
      className="bg-white rounded-3xl shadow-xl border border-stone-200 overflow-hidden flex flex-col group animate-in fade-in zoom-in-95"
    >
      {/* Header */}
      <div 
        onMouseDown={handleMouseDown}
        className="bg-stone-50 p-2 flex items-center justify-between cursor-grab active:cursor-grabbing border-b border-stone-100 shrink-0"
      >
        <div className="flex items-center gap-2 text-stone-500 font-bold text-xs uppercase px-2">
            <CalendarIcon size={14} />
            <span>Agenda</span>
        </div>
        <div className="flex items-center gap-1">
            <GripHorizontal size={16} className="text-stone-300" />
            <button 
                onClick={(e) => { e.stopPropagation(); onRemove(); }}
                className="p-1 hover:bg-red-50 text-stone-400 hover:text-red-500 rounded-full transition-colors"
            >
                <X size={14} />
            </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 cursor-pointer hover:bg-stone-50 transition-colors flex-1 overflow-hidden flex flex-col" onClick={onOpen}>
        <div className="flex items-start gap-4 mb-4 shrink-0">
             <div className="flex flex-col items-center justify-center bg-red-50 text-red-500 rounded-2xl p-2 min-w-[60px] border border-red-100">
                 <span className="text-xs font-bold uppercase">{monthName.substring(0, 3)}</span>
                 <span className="text-3xl font-black leading-none">{dayNumber}</span>
             </div>
             <div className="min-w-0">
                 <p className="text-stone-400 text-xs font-bold uppercase truncate">{dayName}</p>
                 <p className="text-stone-700 font-bold leading-tight truncate">
                    {todayEvents.length === 0 ? "Livre" : `${todayEvents.length} tarefas`}
                 </p>
             </div>
        </div>

        {/* Mini List */}
        <div className="space-y-2 overflow-y-auto custom-scrollbar flex-1">
            {todayEvents.map(evt => (
                <div key={evt.id} className="flex items-center gap-2 text-sm">
                    <div 
                        className={`w-2 h-2 rounded-full shrink-0`} 
                        style={{ backgroundColor: COLOR_HEX[evt.category] || '#ccc' }}
                    />
                    <span className={`flex-1 truncate ${evt.is_completed ? 'line-through text-stone-400' : 'text-stone-600'}`}>
                        {evt.title}
                    </span>
                    <span className="text-xs text-stone-400 font-mono shrink-0">
                        {new Date(evt.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                </div>
            ))}
            {todayEvents.length === 0 && (
                <div className="flex items-center gap-2 text-stone-400 text-xs italic bg-stone-50 p-2 rounded-lg">
                    <Clock size={12} />
                    <span>Seu dia está livre!</span>
                </div>
            )}
        </div>
      </div>

      {/* Resize Handle */}
      <div 
        onMouseDown={handleResizeDown}
        className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize flex items-end justify-end p-1 text-stone-300 hover:text-stone-500"
      >
          <ArrowDownRight size={16} />
      </div>
    </div>
  );
};

export default AgendaWidget;
