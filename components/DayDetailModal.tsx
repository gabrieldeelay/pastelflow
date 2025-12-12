import React, { useState, useEffect } from 'react';
import { X, Calendar, Plus, Trash2, Check, Clock, Flag, Palette } from 'lucide-react';
import { AgendaEvent, DayNote } from '../types';
import { COLOR_HEX, COLUMN_COLORS, COLOR_KEYS } from '../constants';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  date: Date;
  events: AgendaEvent[];
  note: DayNote | null;
  onUpdateEvent: (evt: AgendaEvent) => void;
  onAddEvent: (evt: Partial<AgendaEvent>) => void;
  onDeleteEvent: (id: string) => void;
  onSaveNote: (content: string) => void;
  profileId: string;
}

const DayDetailModal: React.FC<Props> = ({ 
    isOpen, onClose, date, events, note, 
    onUpdateEvent, onAddEvent, onDeleteEvent, onSaveNote
}) => {
  const [activeTab, setActiveTab] = useState<'tasks' | 'note'>('tasks');
  const [noteContent, setNoteContent] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);

  // Color Picker State
  const [activeColorId, setActiveColorId] = useState<string | null>(null);

  // Quick Add State
  const [quickTitle, setQuickTitle] = useState('');
  const [quickTime, setQuickTime] = useState('09:00');

  useEffect(() => {
      if(isOpen) {
          setNoteContent(note?.content || '');
          setActiveColorId(null);
      }
  }, [isOpen, note]);

  // Close color picker on global click
  useEffect(() => {
      const handleGlobalClick = () => setActiveColorId(null);
      window.addEventListener('click', handleGlobalClick);
      return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  // Auto-save note logic
  useEffect(() => {
      if (!isOpen) return;
      const timeout = setTimeout(() => {
          if (noteContent !== (note?.content || '')) {
              setIsSavingNote(true);
              onSaveNote(noteContent);
              setTimeout(() => setIsSavingNote(false), 1000);
          }
      }, 1000);
      return () => clearTimeout(timeout);
  }, [noteContent]);

  if (!isOpen) return null;

  const getPriorityScore = (p?: string) => {
      if (p === 'high') return 3;
      if (p === 'medium') return 2;
      if (p === 'low') return 1;
      return 0;
  };

  const sortedEvents = [...events].sort((a, b) => {
      const timeA = new Date(a.start_time).getTime();
      const timeB = new Date(b.start_time).getTime();
      if (timeA !== timeB) return timeA - timeB;
      return getPriorityScore(b.priority) - getPriorityScore(a.priority);
  });

  const completedCount = events.filter(e => e.is_completed).length;
  const progress = events.length > 0 ? Math.round((completedCount / events.length) * 100) : 0;

  const handleQuickAdd = (e: React.FormEvent) => {
      e.preventDefault();
      if (!quickTitle.trim()) return;
      
      const fullDate = new Date(date);
      const [h, m] = quickTime.split(':');
      fullDate.setHours(parseInt(h), parseInt(m));

      onAddEvent({
          title: quickTitle,
          start_time: fullDate.toISOString(),
          category: 'blue',
          is_completed: false,
          priority: 'medium'
      });
      setQuickTitle('');
  };

  const togglePriority = (evt: AgendaEvent) => {
      const map: Record<string, 'low' | 'medium' | 'high'> = {
          'low': 'medium', 'medium': 'high', 'high': 'low'
      };
      const next = map[evt.priority || 'low'] || 'medium';
      onUpdateEvent({ ...evt, priority: next });
  };

  const getPriorityColor = (p?: string) => {
      if (p === 'high') return 'text-red-500 bg-red-50 hover:bg-red-100';
      if (p === 'medium') return 'text-yellow-600 bg-yellow-50 hover:bg-yellow-100';
      return 'text-stone-300 hover:text-stone-500';
  };

  return (
    <div 
        className="fixed inset-0 z-[150] flex items-center justify-center bg-stone-900/40 backdrop-blur-sm p-4 animate-in fade-in"
        onClick={onClose}
    >
        <div 
            className="bg-white w-full max-w-2xl h-[80vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden relative border border-stone-200"
            onClick={(e) => e.stopPropagation()}
        >
            
            {/* Header */}
            <div className="p-6 pb-4 border-b border-stone-100 flex items-start justify-between bg-stone-50/50">
                <div>
                    <h2 className="text-3xl font-black text-stone-700 capitalize flex items-center gap-3">
                        {date.toLocaleDateString('pt-BR', { weekday: 'long' })}
                        <span className="text-stone-300 font-normal">|</span>
                        <span className="text-blue-600">{date.getDate()}</span>
                    </h2>
                    <p className="text-stone-400 font-bold uppercase text-xs mt-1">
                        {date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                    </p>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full text-stone-400 hover:text-stone-600 transition-colors">
                    <X size={24} />
                </button>
            </div>

            {/* Progress Bar */}
            <div className="px-6 py-2 bg-stone-50/50">
                <div className="flex justify-between text-xs font-bold text-stone-400 mb-1 uppercase tracking-widest">
                    <span>Progresso do Dia</span>
                    <span>{progress}%</span>
                </div>
                <div className="h-2 w-full bg-stone-200 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-blue-500 transition-all duration-500 ease-out"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-stone-100 px-6">
                <button 
                    onClick={() => setActiveTab('tasks')}
                    className={`pb-3 pt-4 px-4 font-bold text-sm border-b-2 transition-colors ${activeTab === 'tasks' ? 'border-blue-500 text-blue-600' : 'border-transparent text-stone-400 hover:text-stone-600'}`}
                >
                    Compromissos ({events.length})
                </button>
                <button 
                    onClick={() => setActiveTab('note')}
                    className={`pb-3 pt-4 px-4 font-bold text-sm border-b-2 transition-colors ${activeTab === 'note' ? 'border-blue-500 text-blue-600' : 'border-transparent text-stone-400 hover:text-stone-600'}`}
                >
                    Notas do Dia
                    {isSavingNote && <span className="ml-2 text-[10px] text-green-500 animate-pulse">Salvando...</span>}
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden bg-[#fdfbf7] relative">
                
                {activeTab === 'tasks' && (
                    <div className="h-full flex flex-col">
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-3">
                            {sortedEvents.length === 0 && (
                                <div className="text-center py-10 text-stone-400">
                                    <Clock size={48} className="mx-auto mb-3 opacity-30" />
                                    <p>Nada planejado para hoje.</p>
                                </div>
                            )}
                            {sortedEvents.map(evt => {
                                const rowBgColor = COLUMN_COLORS[evt.category] || 'bg-white border-stone-100';
                                
                                return (
                                <div key={evt.id} className={`group p-3 rounded-xl border shadow-sm hover:shadow-md transition-all flex items-center gap-3 ${rowBgColor}`}>
                                    <button 
                                        onClick={() => onUpdateEvent({ ...evt, is_completed: !evt.is_completed })}
                                        className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors bg-white ${evt.is_completed ? 'bg-green-500 border-green-500 text-white' : 'border-stone-200 hover:border-green-500 text-transparent'}`}
                                    >
                                        <Check size={14} />
                                    </button>
                                    
                                    <div className="flex-1 min-w-0">
                                        <p className={`font-bold text-stone-700 truncate ${evt.is_completed ? 'line-through text-stone-400' : ''}`}>
                                            {evt.title}
                                        </p>
                                        <div className="flex items-center gap-2 text-xs text-stone-400">
                                            <span className="bg-white/60 px-1.5 py-0.5 rounded font-mono border border-stone-100/50">
                                                {new Date(evt.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            {evt.priority && evt.priority !== 'low' && (
                                                <span className={`uppercase font-bold text-[10px] flex items-center gap-1 ${evt.priority === 'high' ? 'text-red-500' : 'text-yellow-600'}`}>
                                                    <Flag size={10} fill="currentColor" />
                                                    {evt.priority === 'high' ? 'Alta' : 'Média'}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={() => togglePriority(evt)}
                                            className={`p-2 rounded-lg transition-colors ${getPriorityColor(evt.priority)}`}
                                            title="Alterar Prioridade"
                                        >
                                            <Flag size={16} fill={evt.priority === 'high' || evt.priority === 'medium' ? "currentColor" : "none"} />
                                        </button>
                                        
                                        {/* Color Picker Button */}
                                        <div className="relative">
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActiveColorId(activeColorId === evt.id ? null : evt.id);
                                                }}
                                                className="p-2 rounded-lg hover:bg-black/5 transition-colors"
                                                title="Mudar Cor"
                                            >
                                                <div className="w-3 h-3 rounded-full ring-1 ring-black/10 shadow-sm" style={{ backgroundColor: COLOR_HEX[evt.category] }} />
                                            </button>

                                            {activeColorId === evt.id && (
                                                <div 
                                                    className="absolute right-0 top-full mt-2 bg-white p-2 rounded-xl shadow-xl border border-stone-100 z-[200] grid grid-cols-4 gap-1 w-32 animate-in fade-in zoom-in-95 origin-top-right"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                     {COLOR_KEYS.map(key => (
                                                         <button
                                                            key={key}
                                                            onClick={() => {
                                                                onUpdateEvent({ ...evt, category: key });
                                                                setActiveColorId(null);
                                                            }}
                                                            className={`w-6 h-6 rounded-full border hover:scale-110 transition-transform ${evt.category === key ? 'border-stone-400 scale-110 shadow-sm' : 'border-stone-100'}`}
                                                            style={{ backgroundColor: COLOR_HEX[key] }}
                                                            title={key}
                                                         />
                                                     ))}
                                                </div>
                                            )}
                                        </div>

                                        <button 
                                            onClick={() => onDeleteEvent(evt.id)}
                                            className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            )})}
                        </div>
                        
                        {/* Quick Add Footer */}
                        <form onSubmit={handleQuickAdd} className="p-4 bg-white border-t border-stone-100 flex gap-2 shadow-lg">
                             <input 
                                value={quickTitle}
                                onChange={e => setQuickTitle(e.target.value)}
                                placeholder="Novo compromisso..."
                                className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-4 py-2 outline-none focus:border-stone-400 focus:bg-white transition-colors"
                             />
                             <input 
                                type="time"
                                value={quickTime}
                                onChange={e => setQuickTime(e.target.value)}
                                className="bg-stone-50 border border-stone-200 rounded-xl px-2 py-2 outline-none focus:border-stone-400 w-24 text-center cursor-pointer"
                             />
                             <button type="submit" className="bg-stone-800 text-white p-3 rounded-xl hover:bg-stone-700 transition-colors">
                                 <Plus size={20} />
                             </button>
                        </form>
                    </div>
                )}

                {activeTab === 'note' && (
                    <div className="h-full p-6">
                        <textarea
                            value={noteContent}
                            onChange={(e) => setNoteContent(e.target.value)}
                            className="w-full h-full bg-white rounded-2xl border-2 border-dashed border-stone-200 p-6 outline-none focus:border-blue-200 transition-colors resize-none leading-relaxed text-stone-700"
                            placeholder="Escreva suas observações, ideias ou resumo do dia aqui..."
                        />
                    </div>
                )}

            </div>
        </div>
    </div>
  );
};

export default DayDetailModal;