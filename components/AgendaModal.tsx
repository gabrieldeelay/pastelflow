
import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Calendar, Plus, Trash2, Check, Clock, Flag, AlertCircle } from 'lucide-react';
import { AgendaEvent, DayNote, PastelColor } from '../types';
import { COLOR_KEYS, COLOR_HEX } from '../constants';
import DayDetailModal from './DayDetailModal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  events: AgendaEvent[];
  dayNotes: DayNote[];
  onAddEvent: (evt: Partial<AgendaEvent>) => void;
  onUpdateEvent: (evt: AgendaEvent) => void;
  onDeleteEvent: (id: string) => void;
  onSaveDayNote: (date: string, content: string) => void;
  profileId: string;
}

const VIEWS = ['dia', 'semana', 'mês'] as const;
type ViewMode = typeof VIEWS[number];

const AgendaModal: React.FC<Props> = ({ 
    isOpen, onClose, events, dayNotes, 
    onAddEvent, onUpdateEvent, onDeleteEvent, onSaveDayNote, profileId 
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewMode>('semana');
  const [newEventMode, setNewEventMode] = useState(false);
  
  // Detail Modal State
  const [detailDate, setDetailDate] = useState<Date | null>(null);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; date: Date } | null>(null);

  // New Event Form State
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('09:00');
  const [newCat, setNewCat] = useState<PastelColor>('blue');
  const [newPriority, setNewPriority] = useState<'low' | 'medium' | 'high'>('low');

  useEffect(() => {
    if (isOpen) {
        const now = new Date();
        setNewDate(now.toISOString().split('T')[0]);
        setContextMenu(null);
        setNewPriority('low');
    }
  }, [isOpen]);

  useEffect(() => {
      const handleClick = () => setContextMenu(null);
      window.addEventListener('click', handleClick);
      return () => window.removeEventListener('click', handleClick);
  }, []);

  if (!isOpen) return null;

  // --- NAVIGATION HELPERS ---
  const handlePrev = () => {
    const d = new Date(currentDate);
    if (view === 'dia') d.setDate(d.getDate() - 1);
    if (view === 'semana') d.setDate(d.getDate() - 7);
    if (view === 'mês') d.setMonth(d.getMonth() - 1);
    setCurrentDate(d);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    if (view === 'dia') d.setDate(d.getDate() + 1);
    if (view === 'semana') d.setDate(d.getDate() + 7);
    if (view === 'mês') d.setMonth(d.getMonth() + 1);
    setCurrentDate(d);
  };

  const handleToday = () => setCurrentDate(new Date());

  const handleDayClick = (date: Date) => {
      setDetailDate(date);
  };

  const handleRightClick = (e: React.MouseEvent, date: Date) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({
          x: e.clientX,
          y: e.clientY,
          date: date
      });
  };

  const handleContextAction = () => {
      if (contextMenu) {
          setNewDate(contextMenu.date.toISOString().split('T')[0]);
          setNewEventMode(true);
          setContextMenu(null);
      }
  };

  // --- CRUD HANDLERS ---
  const handleSubmitNew = () => {
      if (!newTitle.trim()) return;
      const startDateTime = new Date(`${newDate}T${newTime}`);
      onAddEvent({
          title: newTitle,
          description: newDesc,
          start_time: startDateTime.toISOString(),
          category: newCat,
          is_completed: false,
          priority: newPriority
      });
      setNewEventMode(false);
      setNewTitle('');
      setNewDesc('');
      setNewPriority('low');
  };

  // --- RENDER HELPERS ---
  const getDaysInMonth = (date: Date) => {
      const year = date.getFullYear();
      const month = date.getMonth();
      const days = new Date(year, month + 1, 0).getDate();
      const firstDay = new Date(year, month, 1).getDay(); // 0 = Sun
      return { days, firstDay, year, month };
  };

  const getWeekDays = (date: Date) => {
      const start = new Date(date);
      start.setDate(start.getDate() - start.getDay());
      const days = [];
      for (let i = 0; i < 7; i++) {
          const d = new Date(start);
          d.setDate(start.getDate() + i);
          days.push(d);
      }
      return days;
  };

  const renderMonthView = () => {
    const { days, firstDay, year, month } = getDaysInMonth(currentDate);
    const blanks = Array(firstDay).fill(null);
    const dayNumbers = Array.from({ length: days }, (_, i) => i + 1);
    const totalSlots = [...blanks, ...dayNumbers];
    while (totalSlots.length % 7 !== 0) totalSlots.push(null);

    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    return (
        <div className="flex flex-col h-full select-none">
            <div className="grid grid-cols-7 mb-2">
                {weekDays.map(d => <div key={d} className="text-center text-xs font-bold text-stone-400 uppercase">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-2 flex-1 auto-rows-fr">
                {totalSlots.map((day, idx) => {
                    if (!day) return <div key={idx} className="bg-transparent" />;
                    
                    const cellDate = new Date(year, month, day);
                    const isToday = cellDate.toDateString() === new Date().toDateString();
                    
                    const dayEvents = events.filter(e => {
                        const d = new Date(e.start_time);
                        return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
                    });
                    const hasEvents = dayEvents.length > 0;
                    const hasHighPriority = dayEvents.some(e => e.priority === 'high' && !e.is_completed);

                    let cellClasses = "rounded-lg p-2 flex flex-col gap-1 transition-all border relative cursor-pointer ";
                    if (isToday) {
                        cellClasses += "bg-blue-50/50 ring-2 ring-blue-300 border-blue-200 ";
                    } else if (hasEvents) {
                        cellClasses += "bg-amber-100 border-amber-300 shadow-sm hover:brightness-95 ";
                    } else {
                        cellClasses += "bg-stone-50 border-stone-100 hover:border-stone-300 hover:bg-white ";
                    }

                    return (
                        <div 
                            key={idx} 
                            className={cellClasses}
                            onContextMenu={(e) => handleRightClick(e, cellDate)}
                            onClick={() => handleDayClick(cellDate)}
                        >
                            <div className="flex justify-between items-start">
                                <span className={`text-xs font-bold ${isToday ? 'text-blue-600' : (hasEvents ? 'text-amber-800' : 'text-stone-500')}`}>{day}</span>
                                {hasHighPriority && <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-sm animate-pulse" />}
                            </div>
                            
                            <div className="flex flex-col gap-1 overflow-y-auto custom-scrollbar max-h-[60px]">
                                {dayEvents.map(evt => (
                                    <div 
                                        key={evt.id} 
                                        className={`text-[10px] px-1.5 py-0.5 rounded truncate flex items-center gap-1 shadow-sm ${evt.priority === 'high' && !evt.is_completed ? 'border-l-2 border-l-red-400' : ''}`}
                                        style={{ backgroundColor: evt.is_completed ? '#e5e7eb' : 'white', border: evt.priority !== 'high' ? '1px solid ' + (COLOR_HEX[evt.category] || '#e5e5e5') : undefined }}
                                    >
                                        {evt.priority !== 'high' && <div className={`w-1.5 h-1.5 rounded-full shrink-0`} style={{ backgroundColor: COLOR_HEX[evt.category] }} />}
                                        <span className={`truncate text-stone-600 ${evt.is_completed ? 'line-through opacity-50' : ''}`}>{evt.title}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
  };

  const renderWeekView = () => {
    const days = getWeekDays(currentDate);
    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    return (
        <div className="grid grid-cols-7 h-full gap-2 overflow-hidden select-none">
            {days.map((date, idx) => {
                const isToday = date.toDateString() === new Date().toDateString();
                const dayEvents = events.filter(e => {
                    const d = new Date(e.start_time);
                    return d.getDate() === date.getDate() && d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear();
                }).sort((a,b) => {
                    // Sort by Time then Priority (High first)
                    const timeA = new Date(a.start_time).getTime();
                    const timeB = new Date(b.start_time).getTime();
                    if(timeA !== timeB) return timeA - timeB;
                    const pMap = { high: 3, medium: 2, low: 1, undefined: 0 };
                    return (pMap[b.priority || 'low'] || 0) - (pMap[a.priority || 'low'] || 0);
                });

                return (
                    <div 
                        key={idx} 
                        className={`flex flex-col h-full rounded-2xl border cursor-pointer hover:border-stone-300 transition-colors ${isToday ? 'bg-blue-50/30 border-blue-200' : 'bg-stone-50 border-stone-200'}`}
                        onContextMenu={(e) => handleRightClick(e, date)}
                        onClick={() => handleDayClick(date)}
                    >
                        <div className="p-3 text-center border-b border-stone-200/50">
                            <p className="text-[10px] font-bold uppercase text-stone-400">{weekDays[idx]}</p>
                            <p className={`text-xl font-black ${isToday ? 'text-blue-600' : 'text-stone-700'}`}>{date.getDate()}</p>
                        </div>
                        <div className="flex-1 p-2 overflow-y-auto custom-scrollbar flex flex-col gap-2">
                             {dayEvents.map(evt => (
                                 <div key={evt.id} className={`group bg-white p-2 rounded-xl shadow-sm border border-stone-100 flex flex-col gap-1 relative ${evt.priority === 'high' && !evt.is_completed ? 'ring-1 ring-red-100' : ''}`}>
                                     <div className="flex justify-between items-start gap-1">
                                        <span className={`text-xs font-bold text-stone-700 line-clamp-2 ${evt.is_completed ? 'line-through text-stone-400' : ''}`}>{evt.title}</span>
                                        {evt.priority === 'high' && !evt.is_completed && <Flag size={10} className="text-red-500 shrink-0 mt-0.5" fill="currentColor" />}
                                     </div>
                                     <div className="absolute top-2 right-full mr-1 w-1 h-8 rounded-full" style={{ backgroundColor: COLOR_HEX[evt.category] }}></div>
                                 </div>
                             ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
  };

  const renderDayView = () => {
      return (
          <div className="flex h-full items-center justify-center">
              <button 
                onClick={() => handleDayClick(currentDate)}
                className="bg-stone-800 text-white px-8 py-4 rounded-2xl font-bold shadow-xl hover:bg-stone-700 flex items-center gap-2"
              >
                  <Calendar />
                  Abrir Detalhes de {currentDate.toLocaleDateString()}
              </button>
          </div>
      )
  }

  const getDayEvents = (d: Date) => {
      return events.filter(e => {
          const date = new Date(e.start_time);
          return date.getDate() === d.getDate() && 
                 date.getMonth() === d.getMonth() && 
                 date.getFullYear() === d.getFullYear();
      });
  };

  const getDayNote = (d: Date) => {
      const dateStr = d.toISOString().split('T')[0];
      return dayNotes.find(n => n.date === dateStr) || null;
  }

  return (
    <>
        {detailDate && (
            <DayDetailModal 
                isOpen={!!detailDate}
                onClose={() => setDetailDate(null)}
                date={detailDate}
                events={getDayEvents(detailDate)}
                note={getDayNote(detailDate)}
                onAddEvent={onAddEvent}
                onUpdateEvent={onUpdateEvent}
                onDeleteEvent={onDeleteEvent}
                onSaveNote={(content) => {
                   if (detailDate) {
                       onSaveDayNote(detailDate.toISOString().split('T')[0], content);
                   }
                }}
                profileId={profileId}
            />
        )}

        {/* AGENDA MODAL BACKDROP */}
        <div 
            className={`fixed inset-0 z-[100] flex items-center justify-center bg-stone-900/60 backdrop-blur-sm fade-in p-4 sm:p-6 ${detailDate ? 'hidden' : ''}`}
            onClick={onClose}
        >
        
        {/* AGENDA CONTENT */}
        <div 
            className="bg-[#fdfbf7] w-full max-w-6xl h-[85vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden relative"
            onClick={(e) => e.stopPropagation()} // Prevent close when clicking content
        >
            
            {/* HEADER */}
            <div className="flex items-center justify-between p-6 border-b border-stone-200 bg-white/50 backdrop-blur-md relative z-20">
                <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-black text-stone-700 capitalize">
                        {currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                    </h2>
                </div>

                <div className="flex items-center gap-4">
                     <button onClick={handleToday} className="px-3 py-1 text-xs font-bold uppercase text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors">Hoje</button>
                    <div className="flex bg-stone-100 p-1 rounded-xl">
                        {VIEWS.map(v => (
                            <button 
                                key={v}
                                onClick={() => setView(v)}
                                className={`px-4 py-2 rounded-lg text-sm font-bold capitalize transition-all ${view === v ? 'bg-white shadow-sm text-stone-800' : 'text-stone-400 hover:text-stone-600'}`}
                            >
                                {v}
                            </button>
                        ))}
                    </div>
                    <button 
                        onClick={() => setNewEventMode(true)}
                        className="flex items-center gap-2 bg-stone-800 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-stone-700 transition-colors shadow-lg shadow-stone-200"
                    >
                        <Plus size={18} /> Novo
                    </button>
                    <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full text-stone-400 hover:text-stone-600">
                        <X size={24} />
                    </button>
                </div>
            </div>

            {/* CONTENT */}
            <div className="flex-1 p-6 overflow-hidden relative group">
                {/* Floating Navigation Arrows ("Side Scroll") */}
                <button 
                    onClick={handlePrev}
                    className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 bg-white/80 backdrop-blur shadow-lg rounded-full text-stone-400 hover:text-stone-800 hover:scale-110 transition-all opacity-0 group-hover:opacity-100 -ml-2 group-hover:ml-0"
                >
                    <ChevronLeft size={24} />
                </button>

                <button 
                    onClick={handleNext}
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 bg-white/80 backdrop-blur shadow-lg rounded-full text-stone-400 hover:text-stone-800 hover:scale-110 transition-all opacity-0 group-hover:opacity-100 -mr-2 group-hover:mr-0"
                >
                    <ChevronRight size={24} />
                </button>

                {view === 'mês' && renderMonthView()}
                {view === 'semana' && renderWeekView()}
                {view === 'dia' && renderDayView()}

                {/* CONTEXT MENU */}
                {contextMenu && (
                    <div 
                        style={{ top: contextMenu.y, left: contextMenu.x }}
                        className="fixed z-[200] bg-white rounded-xl shadow-2xl border border-stone-100 p-2 animate-in fade-in zoom-in-95 origin-top-left"
                        onMouseDown={(e) => e.stopPropagation()} 
                    >
                        <div className="px-3 py-2 border-b border-stone-50 mb-1">
                            <span className="text-xs font-bold text-stone-400 uppercase">{contextMenu.date.toLocaleDateString('pt-BR')}</span>
                        </div>
                        <button 
                            onClick={handleContextAction}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm font-bold text-stone-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors whitespace-nowrap"
                        >
                            <Calendar size={16} /> Novo Agendamento
                        </button>
                    </div>
                )}

                {/* CREATE MODAL OVERLAY */}
                {newEventMode && (
                    <div 
                        className="absolute inset-0 z-10 bg-white/90 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in zoom-in-95"
                        onClick={() => setNewEventMode(false)}
                    >
                        <div 
                            className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-stone-100 p-8"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h3 className="text-xl font-bold text-stone-700 mb-6 flex items-center gap-2">
                                <Calendar className="text-stone-400" /> Novo Agendamento
                            </h3>
                            
                            <div className="space-y-4">
                                <input 
                                    autoFocus
                                    placeholder="Título do compromisso"
                                    className="w-full text-lg font-bold border-b-2 border-stone-100 py-2 outline-none focus:border-stone-800 bg-transparent"
                                    value={newTitle}
                                    onChange={e => setNewTitle(e.target.value)}
                                />
                                
                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <label className="text-xs font-bold text-stone-400 uppercase">Data</label>
                                        <input 
                                            type="date" 
                                            className="w-full bg-stone-50 rounded-xl p-3 mt-1 outline-none"
                                            value={newDate}
                                            onChange={e => setNewDate(e.target.value)}
                                        />
                                    </div>
                                    <div className="w-1/3">
                                        <label className="text-xs font-bold text-stone-400 uppercase">Hora</label>
                                        <input 
                                            type="time" 
                                            className="w-full bg-stone-50 rounded-xl p-3 mt-1 outline-none"
                                            value={newTime}
                                            onChange={e => setNewTime(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-stone-400 uppercase mb-2 block">Prioridade</label>
                                    <div className="flex gap-2">
                                        {(['low', 'medium', 'high'] as const).map(p => (
                                            <button
                                                key={p}
                                                onClick={() => setNewPriority(p)}
                                                className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase transition-all border ${
                                                    newPriority === p 
                                                    ? (p === 'high' ? 'bg-red-100 text-red-600 border-red-200' : p === 'medium' ? 'bg-yellow-100 text-yellow-600 border-yellow-200' : 'bg-green-100 text-green-600 border-green-200')
                                                    : 'bg-stone-50 text-stone-400 border-stone-100 hover:bg-white'
                                                }`}
                                            >
                                                {p === 'high' ? 'Alta' : p === 'medium' ? 'Média' : 'Baixa'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-stone-400 uppercase">Categoria</label>
                                    <div className="flex gap-2 mt-2">
                                        {COLOR_KEYS.slice(0, 6).map(color => (
                                            <button
                                                key={color}
                                                onClick={() => setNewCat(color)}
                                                className={`w-8 h-8 rounded-full border-2 transition-all ${newCat === color ? 'border-stone-500 scale-110' : 'border-transparent hover:scale-105'}`}
                                                style={{ backgroundColor: COLOR_HEX[color] }}
                                            />
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-stone-400 uppercase">Detalhes</label>
                                    <textarea 
                                        className="w-full bg-stone-50 rounded-xl p-3 mt-1 outline-none h-24 resize-none"
                                        placeholder="Adicione notas..."
                                        value={newDesc}
                                        onChange={e => setNewDesc(e.target.value)}
                                    />
                                </div>

                                <div className="flex justify-end gap-3 pt-4">
                                    <button onClick={() => setNewEventMode(false)} className="px-6 py-3 rounded-xl font-bold text-stone-500 hover:bg-stone-100">Cancelar</button>
                                    <button onClick={handleSubmitNew} className="px-6 py-3 rounded-xl font-bold bg-stone-800 text-white hover:bg-stone-700 shadow-lg">Criar</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
        </div>
    </>
  );
};

export default AgendaModal;
