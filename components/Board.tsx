import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  rectIntersection,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable';
import { Plus, LogOut, Lock, ChevronDown, List as ListIcon, StickyNote, AlertTriangle, Calendar, Sparkles, Link as LinkIcon, Activity } from 'lucide-react';
import { Column, Task, Id, PastelColor, Profile, AgendaEvent, DayNote, ExtensionShortcut, FitnessData, FitnessHistoryEntry } from '../types';
import List from './List';
import Card from './Card';
import TaskModal from './TaskModal';
import AgendaWidget from './AgendaWidget';
import QuoteWidget from './QuoteWidget';
import ExtensionWidget from './ExtensionWidget';
import FitnessWidget from './FitnessWidget';
import AgendaModal from './AgendaModal';
import { createPortal } from 'react-dom';
import { PLACEHOLDER_TEXTS, COLORS } from '../constants';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { useUndo } from '../hooks/useUndo';

interface Props {
  currentProfile: Profile;
  onSwitchProfile: () => void;
  onLock: () => void;
}

// --- HELPER FUNCTIONS FOR DB MAPPING ---
const packTaskForDB = (task: Task) => {
  return JSON.stringify({
    title: task.content,
    description: task.description || '',
    attachments: task.attachments || [],
    isChecklist: task.isChecklist || false
  });
};

const unpackTaskFromDB = (dbTask: any): Partial<Task> => {
  const { content } = dbTask;
  try {
    if (content && typeof content === 'string' && content.trim().startsWith('{')) {
      const parsed = JSON.parse(content);
      if (parsed.title !== undefined || parsed.attachments !== undefined) {
        return {
          content: parsed.title || '', 
          description: parsed.description || '',
          attachments: parsed.attachments || [],
          isChecklist: parsed.isChecklist || false
        };
      }
    }
  } catch (e) {}
  return {
    content: content || '',
    description: dbTask.description || '', 
    attachments: [],
    isChecklist: false
  };
};

const stableSortColumns = (cols: Column[]) => {
    return [...cols].sort((a, b) => {
        const posDiff = (a.position || 0) - (b.position || 0);
        if (posDiff !== 0) return posDiff;
        return String(a.id).localeCompare(String(b.id));
    });
};

const Board: React.FC<Props> = ({ currentProfile, onSwitchProfile, onLock }) => {
  const [columns, setColumns] = useState<Column[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [activeColumn, setActiveColumn] = useState<Column | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Agenda State
  const [showAgenda, setShowAgenda] = useState(false);
  const [agendaEvents, setAgendaEvents] = useState<AgendaEvent[]>([]);
  const [dayNotes, setDayNotes] = useState<DayNote[]>([]);
  const [isAgendaModalOpen, setIsAgendaModalOpen] = useState(false);
  const [agendaLayout, setAgendaLayout] = useState({ x: 50, y: 120, w: 288, h: 320 });

  // Quote Widget State
  const [showQuote, setShowQuote] = useState(false);
  const [quotePos, setQuotePos] = useState({ x: 400, y: 120 });

  // Extension Widget State
  const [showExtension, setShowExtension] = useState(false);
  const [extensionPos, setExtensionPos] = useState({ x: 100, y: 100 });
  const [extensionShortcuts, setExtensionShortcuts] = useState<ExtensionShortcut[]>([]);

  // Fitness Widget State
  const [showFitness, setShowFitness] = useState(false);
  const [fitnessPos, setFitnessPos] = useState({ x: 50, y: 350 });
  const [fitnessData, setFitnessData] = useState<FitnessData | undefined>(undefined);

  const [showAddMenu, setShowAddMenu] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);

  // Undo Hook
  const { addToHistory } = useUndo(setTasks, setAgendaEvents);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10,
      },
    })
  );

  const columnsId = useMemo(() => columns.map((col) => col.id), [columns]);
  
  const activeProfile = useMemo(() => {
    return profiles.find(p => String(p.id) === String(currentProfile.id)) || currentProfile;
  }, [profiles, currentProfile]);

  const updateProfileSettings = async (newSettings: any) => {
      setProfiles(prev => prev.map(p => 
        String(p.id) === String(currentProfile.id) 
          ? { ...p, settings: { ...(p.settings || {}), ...newSettings } } 
          : p
      ));

      if (isSupabaseConfigured()) {
          const { data: latestProfile } = await supabase.from('profiles').select('settings').eq('id', currentProfile.id).single();
          const mergedSettings = { ...(latestProfile?.settings || {}), ...newSettings };
          await supabase.from('profiles').update({ settings: mergedSettings }).eq('id', currentProfile.id);
      }
  };

  // --- SAVE LAYOUTS TO DB ---
  const saveAgendaLayout = async (x: number, y: number, w: number, h: number) => {
      setAgendaLayout({ x, y, w, h });
      updateProfileSettings({ agenda_pos: { x, y }, agenda_size: { w, h } });
  };

  const saveAgendaVisibility = async (visible: boolean) => {
      setShowAgenda(visible);
      updateProfileSettings({ agenda_visible: visible });
  }

  const saveQuoteLayout = async (x: number, y: number) => {
      setQuotePos({ x, y });
      updateProfileSettings({ quote_pos: { x, y } });
  };

  const saveQuoteVisibility = async (visible: boolean) => {
      setShowQuote(visible);
      updateProfileSettings({ quote_visible: visible });
  };

  const saveExtensionLayout = async (x: number, y: number) => {
      setExtensionPos({ x, y });
      updateProfileSettings({ extension_pos: { x, y } });
  };

  const saveExtensionVisibility = async (visible: boolean) => {
      setShowExtension(visible);
      updateProfileSettings({ extension_visible: visible });
  };

  const saveExtensionShortcuts = async (shortcuts: ExtensionShortcut[]) => {
      setExtensionShortcuts(shortcuts);
      updateProfileSettings({ extension_shortcuts: shortcuts });
  };

  const saveFitnessLayout = async (x: number, y: number) => {
      setFitnessPos({ x, y });
      updateProfileSettings({ fitness_pos: { x, y } });
  };

  const saveFitnessVisibility = async (visible: boolean) => {
      setShowFitness(visible);
      updateProfileSettings({ fitness_visible: visible });
  };

  const saveFitnessData = async (data: FitnessData) => {
      setFitnessData(data);
      updateProfileSettings({ fitness_data: data });
  };

  // --- PERSISTENCE HELPERS ---
  const saveColumnOrder = async (newColumns: Column[]) => {
      if (!isSupabaseConfigured()) return;
      const updates = newColumns.map((col, index) => ({
          id: col.id,
          position: index,
          profile_id: currentProfile.id, 
          title: col.title, 
          color: col.color
      }));
      await supabase.from('columns').upsert(updates);
  };

  const saveTaskMoves = async (newTasks: Task[]) => {
      if (!isSupabaseConfigured()) return;
      const updates = newTasks.map((t, idx) => ({
          id: t.id,
          column_id: t.columnId,
          content: packTaskForDB(t),
          color: t.color,
          position: idx
      }));
      await supabase.from('tasks').upsert(updates);
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setErrorMsg(null);
      
      const settings = activeProfile.settings;
      if (settings) {
          if (settings.agenda_pos) setAgendaLayout(prev => ({ ...prev, ...settings.agenda_pos }));
          if (settings.agenda_size) setAgendaLayout(prev => ({ ...prev, ...settings.agenda_size }));
          if (settings.agenda_visible !== undefined) setShowAgenda(settings.agenda_visible);
          if (settings.quote_pos) setQuotePos(settings.quote_pos);
          if (settings.quote_visible !== undefined) setShowQuote(settings.quote_visible);
          if (settings.extension_pos) setExtensionPos(settings.extension_pos);
          if (settings.extension_visible !== undefined) setShowExtension(settings.extension_visible);
          if (settings.extension_shortcuts) setExtensionShortcuts(settings.extension_shortcuts);
          if (settings.fitness_pos) setFitnessPos(settings.fitness_pos);
          if (settings.fitness_visible !== undefined) setShowFitness(settings.fitness_visible);
          
          if (settings.fitness_data) {
              const fData = settings.fitness_data as FitnessData;
              const last = new Date(fData.lastUpdate).toDateString();
              const now = new Date().toDateString();
              
              // Daily reset with ARCHIVING
              if (last !== now) {
                  const caloriesIn = fData.foodLog.reduce((acc, curr) => acc + curr.calories, 0);
                  const caloriesOut = (fData.workoutMinutes || 0) * 8;
                  const hMeter = fData.height / 100;
                  const bmi = fData.weight / (hMeter * hMeter);

                  // Calculate last day's target calorie for history
                  const ACTIVITY_FACTORS = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };
                  const GOAL_ADJUSTMENTS = { lose: -500, maintain: 0, gain: 500 };
                  
                  let bmr = (10 * fData.weight) + (6.25 * fData.height) - (5 * (fData.age || 25));
                  bmr = fData.gender === 'female' ? bmr - 161 : bmr + 5;
                  const tdee = bmr * ACTIVITY_FACTORS[fData.activityLevel || 'moderate'];
                  const target = Math.round(tdee + GOAL_ADJUSTMENTS[fData.fitnessGoal || 'maintain']);

                  const historyEntry: FitnessHistoryEntry = {
                      date: new Date(fData.lastUpdate).toISOString().split('T')[0],
                      water: fData.waterConsumed,
                      caloriesIn,
                      caloriesOut,
                      weight: fData.weight,
                      bmi: isNaN(bmi) ? 0 : bmi,
                      targetCalorie: target
                  };

                  const updatedFitness = { 
                      ...fData, 
                      waterConsumed: 0, 
                      workoutMinutes: 0, 
                      foodLog: [], 
                      lastUpdate: new Date().toISOString(),
                      history: [historyEntry, ...(fData.history || [])].slice(0, 30) // Keep last 30 days
                  };
                  setFitnessData(updatedFitness);
                  updateProfileSettings({ fitness_data: updatedFitness });
              } else {
                  setFitnessData(fData);
              }
          }
      }

      if (!isSupabaseConfigured()) {
         setLoading(false);
         return;
      }

      try {
        const { data: colsData } = await supabase.from('columns').select('*').eq('profile_id', currentProfile.id).order('position', { ascending: true });
        
        let loadedTasks: Task[] = [];
        if (colsData && colsData.length > 0) {
            const { data: tasksData } = await supabase.from('tasks').select('*').in('column_id', colsData.map(c => c.id)).order('position', { ascending: true });
            if (tasksData) {
                loadedTasks = tasksData.map((t: any) => ({
                    id: t.id,
                    columnId: t.column_id,
                    color: t.color || 'yellow',
                    ...unpackTaskFromDB(t)
                } as Task));
            }
        }

        const { data: agendaData } = await supabase.from('agenda_events').select('*').eq('profile_id', currentProfile.id);
        if (agendaData) setAgendaEvents(agendaData as AgendaEvent[]);

        const { data: notesData } = await supabase.from('day_notes').select('*').eq('profile_id', currentProfile.id);
        if (notesData) setDayNotes(notesData as DayNote[]);

        const { data: profilesData } = await supabase.from('profiles').select('*');
        if (profilesData) setProfiles(profilesData);

        if (colsData && colsData.length > 0) {
          setColumns(stableSortColumns(colsData.map((c: any) => ({ id: c.id, title: c.title, color: c.color, position: c.position || 0 }))));
          setTasks(loadedTasks);
        }
      } catch (error: any) {
        console.error("Error loading board:", error);
        setErrorMsg("Erro ao carregar dados.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [currentProfile.id]);

  // --- ACTIONS ---
  const toggleAgenda = () => { setShowAddMenu(false); saveAgendaVisibility(!showAgenda); };
  const toggleQuote = () => { setShowAddMenu(false); saveQuoteVisibility(!showQuote); };
  const toggleExtension = () => { setShowAddMenu(false); saveExtensionVisibility(!showExtension); };
  const toggleFitness = () => { setShowAddMenu(false); saveFitnessVisibility(!showFitness); };

  const addAgendaEvent = async (evt: Partial<AgendaEvent>) => {
      const newEvt = { ...evt, id: crypto.randomUUID(), profile_id: currentProfile.id } as AgendaEvent;
      setAgendaEvents(prev => [...prev, newEvt]);
      addToHistory({ type: 'EVENT_CREATE', data: newEvt });
      if (isSupabaseConfigured()) await supabase.from('agenda_events').insert({ profile_id: currentProfile.id, ...evt });
  };

  const updateAgendaEvent = async (evt: AgendaEvent) => {
      const prev = agendaEvents.find(e => e.id === evt.id);
      if(prev) addToHistory({ type: 'EVENT_UPDATE', prev, current: evt });
      setAgendaEvents(prev => prev.map(e => e.id === evt.id ? evt : e));
      if (isSupabaseConfigured()) await supabase.from('agenda_events').update({ ...evt }).eq('id', evt.id);
  };

  const deleteAgendaEvent = async (id: string) => {
      const target = agendaEvents.find(e => e.id === id);
      if(target) {
          addToHistory({ type: 'EVENT_DELETE', data: target });
          setAgendaEvents(prev => prev.filter(e => e.id !== id));
          if (isSupabaseConfigured()) await supabase.from('agenda_events').delete().eq('id', id);
      }
  };

  const saveDayNote = async (date: string, content: string) => {
      const existing = dayNotes.find(n => n.date === date);
      const newNote = { id: existing?.id || crypto.randomUUID(), profile_id: currentProfile.id, date, content };
      setDayNotes(prev => existing ? prev.map(n => n.id === existing.id ? newNote : n) : [...prev, newNote]);
      if (isSupabaseConfigured()) await supabase.from('day_notes').upsert({ profile_id: currentProfile.id, date, content }, { onConflict: 'profile_id,date' });
  };

  const createTask = async (columnId: Id) => {
    setShowAddMenu(false);
    const tempId = crypto.randomUUID();
    const newTask: Task = { id: tempId, columnId, content: PLACEHOLDER_TEXTS[Math.floor(Math.random() * PLACEHOLDER_TEXTS.length)], color: 'yellow', description: '', attachments: [], isChecklist: false };
    setTasks(prev => [...prev, newTask]);
    addToHistory({ type: 'TASK_CREATE', data: newTask });
    if (isSupabaseConfigured()) await supabase.from('tasks').insert({ id: tempId, column_id: columnId, content: packTaskForDB(newTask), color: newTask.color, position: tasks.length });
  };

  const deleteTask = async (id: Id) => {
    const taskToDelete = tasks.find(t => String(t.id) === String(id));
    if(!taskToDelete) return;
    addToHistory({ type: 'TASK_DELETE', data: taskToDelete });
    const updatedTasks = tasks.filter((t) => String(t.id) !== String(id));
    setTasks(updatedTasks);
    if(isSupabaseConfigured()) await supabase.from('tasks').delete().eq('id', id);
  };

  const updateTaskFull = async (updatedTask: Task) => {
      const prev = tasks.find(t => t.id === updatedTask.id);
      if(prev) addToHistory({ type: 'TASK_UPDATE', prev, current: updatedTask });
      setTasks(prev => prev.map((t) => (String(t.id) === String(updatedTask.id) ? updatedTask : t)));
      if (isSupabaseConfigured()) await supabase.from('tasks').update({ content: packTaskForDB(updatedTask), color: updatedTask.color, column_id: updatedTask.columnId }).eq('id', updatedTask.id);
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-start overflow-x-hidden p-8 gap-8 fade-in relative">
      {/* WIDGETS LAYER */}
      {showAgenda && (
          <AgendaWidget 
             events={agendaEvents}
             initialPosition={{ x: agendaLayout.x, y: agendaLayout.y }}
             initialSize={{ w: agendaLayout.w, h: agendaLayout.h }}
             onLayoutChange={saveAgendaLayout}
             onRemove={() => saveAgendaVisibility(false)}
             onOpen={() => setIsAgendaModalOpen(true)}
             onToggleEvent={updateAgendaEvent}
          />
      )}
      
      {showQuote && <QuoteWidget onRemove={() => saveQuoteVisibility(false)} initialPosition={{ x: quotePos.x, y: quotePos.y }} onLayoutChange={saveQuoteLayout} />}

      {showExtension && <ExtensionWidget onRemove={() => saveExtensionVisibility(false)} initialPosition={{ x: extensionPos.x, y: extensionPos.y }} onLayoutChange={saveExtensionLayout} shortcuts={extensionShortcuts} onUpdateShortcuts={saveExtensionShortcuts} />}

      {showFitness && <FitnessWidget data={fitnessData} onUpdate={saveFitnessData} onRemove={() => saveFitnessVisibility(false)} initialPosition={{ x: fitnessPos.x, y: fitnessPos.y }} onLayoutChange={saveFitnessLayout} />}
      
      <AgendaModal isOpen={isAgendaModalOpen} onClose={() => setIsAgendaModalOpen(false)} events={agendaEvents} dayNotes={dayNotes} onAddEvent={addAgendaEvent} onUpdateEvent={updateAgendaEvent} onDeleteEvent={deleteAgendaEvent} onSaveDayNote={saveDayNote} profileId={currentProfile.id} />

      {selectedTask && <TaskModal task={selectedTask} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onUpdate={updateTaskFull} onDelete={deleteTask} profiles={profiles} currentProfileId={currentProfile.id} />}

      <header className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center w-full mb-4">
        <div className="flex items-center gap-4">
          <div className="group relative">
            <img src={activeProfile.avatar} className="w-12 h-12 rounded-full border-2 border-white shadow-md cursor-pointer" alt="Avatar" />
          </div>
          <div><h1 className="text-4xl font-black text-stone-700 tracking-tight leading-none">Pastel<span className="text-red-300">Flow</span>.</h1></div>
          <div className="flex items-center gap-1">
            <button onClick={onSwitchProfile} className="ml-2 p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-200/50 rounded-full transition-colors" title="Trocar Perfil"><LogOut size={20} /></button>
            <button onClick={onLock} className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors" title="Bloquear Tela"><Lock size={20} /></button>
          </div>
        </div>
        
        <div className="relative" ref={addMenuRef}>
            <button onClick={() => setShowAddMenu(!showAddMenu)} className="flex items-center gap-2 bg-stone-800 hover:bg-stone-700 text-white px-6 py-3 rounded-xl shadow-lg shadow-stone-200 transition-all transform active:scale-95 font-bold"><Plus size={20} />Adicionar<ChevronDown size={16} className={`transition-transform ${showAddMenu ? 'rotate-180' : ''}`} /></button>
            {showAddMenu && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-xl border border-stone-100 p-2 z-50 animate-in fade-in slide-in-from-top-2">
                    <button onClick={async () => { const tempId = crypto.randomUUID(); setColumns(prev => [...prev, { id: tempId, title: 'Nova Lista', color: 'blue', position: columns.length }]); if(isSupabaseConfigured()) await supabase.from('columns').insert({ id: tempId, profile_id: currentProfile.id, title: 'Nova Lista', position: columns.length, color: 'blue' }); setShowAddMenu(false); }} className="w-full flex items-center gap-3 p-3 hover:bg-stone-50 rounded-lg text-left text-stone-700 font-bold"><div className="bg-blue-100 p-1 rounded text-blue-600"><ListIcon size={18} /></div>Nova Lista</button>
                    <button onClick={() => { if(columns.length>0) createTask(columns[0].id); }} className="w-full flex items-center gap-3 p-3 hover:bg-stone-50 rounded-lg text-left text-stone-700 font-bold"><div className="bg-yellow-100 p-1 rounded text-yellow-600"><StickyNote size={18} /></div>Nova Nota</button>
                    <div className="h-px bg-stone-100 my-1 mx-2"></div>
                    <p className="px-3 py-1 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Widgets</p>
                    <button onClick={toggleAgenda} className="w-full flex items-center gap-3 p-3 hover:bg-stone-50 rounded-lg text-left text-stone-700 font-bold"><div className="bg-red-100 p-1 rounded text-red-600"><Calendar size={18} /></div>{showAgenda ? 'Ocultar Agenda' : 'Agenda'}</button>
                    <button onClick={toggleQuote} className="w-full flex items-center gap-3 p-3 hover:bg-stone-50 rounded-lg text-left text-stone-700 font-bold"><div className="bg-purple-100 p-1 rounded text-purple-600"><Sparkles size={18} /></div>{showQuote ? 'Ocultar Frase' : 'Frase do Dia'}</button>
                    <button onClick={toggleExtension} className="w-full flex items-center gap-3 p-3 hover:bg-stone-50 rounded-lg text-left text-stone-700 font-bold"><div className="bg-sky-100 p-1 rounded text-sky-600"><LinkIcon size={18} /></div>{showExtension ? 'Ocultar Extensão' : 'Extensão'}</button>
                    <button onClick={toggleFitness} className="w-full flex items-center gap-3 p-3 hover:bg-stone-50 rounded-lg text-left text-stone-700 font-bold"><div className="bg-teal-100 p-1 rounded text-teal-600"><Activity size={18} /></div>{showFitness ? 'Ocultar Fitness' : 'Saúde & Fitness'}</button>
                </div>
            )}
        </div>
      </header>

      <DndContext sensors={sensors} collisionDetection={rectIntersection} onDragEnd={(e) => { 
        const { active, over } = e; if (!over) return; if (active.id === over.id) return;
        if (active.data.current?.type === 'Column') setColumns((columns) => { const ai = columns.findIndex((col) => col.id === active.id); const oi = columns.findIndex((col) => col.id === over.id); const newCols = arrayMove(columns, ai, oi).map((c, i) => ({ ...c, position: i })); saveColumnOrder(newCols); return newCols; });
        if (active.data.current?.type === 'Task') saveTaskMoves(tasks);
      }} onDragOver={(e) => {
        const { active, over } = e; if (!over) return; if (active.id === over.id) return; if (active.data.current?.type !== 'Task') return;
        if (over.data.current?.type === 'Task') setTasks((tasks) => { const ai = tasks.findIndex((t) => t.id === active.id); const oi = tasks.findIndex((t) => t.id === over.id); if (tasks[ai].columnId !== tasks[oi].columnId) tasks[ai].columnId = tasks[oi].columnId; return arrayMove(tasks, ai, oi); });
        if (over.data.current?.type === 'Column') setTasks((tasks) => { const ai = tasks.findIndex((t) => t.id === active.id); tasks[ai].columnId = over.id; return arrayMove(tasks, ai, ai); });
      }}>
        <div className="flex flex-wrap items-start gap-8 w-full pb-20">
          <SortableContext items={columnsId} strategy={rectSortingStrategy}>
            {columns.map((col) => (
              <List key={col.id} column={col} tasks={tasks.filter((task) => String(task.columnId) === String(col.id))} createTask={createTask} deleteColumn={async (id) => { setColumns(prev => prev.filter(c => c.id !== id)); if(isSupabaseConfigured()) await supabase.from('columns').delete().eq('id', id); }} updateColumnTitle={(id, t) => { const newCols = columns.map(c => c.id === id ? {...c, title: t} : c); setColumns(newCols); if (isSupabaseConfigured()) supabase.from('columns').update({ title: t }).eq('id', id).then(); }} updateColumnColor={(id, c) => { setColumns(prev => prev.map(col => col.id === id ? {...col, color: c} : col)); if(isSupabaseConfigured()) supabase.from('columns').update({ color: c }).eq('id', id); }} deleteTask={deleteTask} updateTaskColor={(id, color) => { const t = tasks.find(t => t.id === id); if(t) updateTaskFull({...t, color}); }} updateTaskContent={(id, content) => { const t = tasks.find(t => t.id === id); if(t) updateTaskFull({...t, content}); }} onTaskClick={(t) => { setSelectedTask(t); setIsModalOpen(true); }} />
            ))}
          </SortableContext>
        </div>
        {createPortal(<DragOverlay>{activeColumn && <List column={activeColumn} tasks={tasks.filter((task) => task.columnId === activeColumn.id)} createTask={() => {}} deleteColumn={() => {}} updateColumnTitle={() => {}} updateColumnColor={() => {}} deleteTask={() => {}} updateTaskColor={() => {}} updateTaskContent={() => {}} onTaskClick={() => {}} />}{activeTask && <Card task={activeTask} onClick={() => {}} />}</DragOverlay>, document.body)}
      </DndContext>
    </div>
  );
};

export default Board;