
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
import { Plus, LogOut, ChevronDown, List as ListIcon, StickyNote, AlertTriangle, Calendar } from 'lucide-react';
import { Column, Task, Id, PastelColor, Profile, AgendaEvent, DayNote } from '../types';
import List from './List';
import Card from './Card';
import TaskModal from './TaskModal';
import AgendaWidget from './AgendaWidget';
import AgendaModal from './AgendaModal';
import { createPortal } from 'react-dom';
import { PLACEHOLDER_TEXTS, COLORS } from '../constants';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { useUndo } from '../hooks/useUndo';

interface Props {
  currentProfile: Profile;
  onSwitchProfile: () => void;
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

const Board: React.FC<Props> = ({ currentProfile, onSwitchProfile }) => {
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
  
  // Agenda Layout State
  const [agendaLayout, setAgendaLayout] = useState({ x: 50, y: 120, w: 288, h: 320 });

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
  const activeProfile = useMemo(() => profiles.find(p => String(p.id) === String(currentProfile.id)) || currentProfile, [profiles, currentProfile]);

  // --- SAVE LAYOUT TO DB ---
  const saveAgendaLayout = async (x: number, y: number, w: number, h: number) => {
      setAgendaLayout({ x, y, w, h });
      if (isSupabaseConfigured()) {
          const settings = { 
              ...(activeProfile.settings || {}), 
              agenda_pos: { x, y },
              agenda_size: { w, h },
              agenda_visible: true
          };
          await supabase.from('profiles').update({ settings }).eq('id', currentProfile.id);
      } else {
          localStorage.setItem(`pastel_agenda_layout_${currentProfile.id}`, JSON.stringify({ x, y, w, h }));
      }
  };

  const saveAgendaVisibility = async (visible: boolean) => {
      setShowAgenda(visible);
      if (isSupabaseConfigured()) {
          const settings = { 
              ...(activeProfile.settings || {}), 
              agenda_visible: visible 
          };
          await supabase.from('profiles').update({ settings }).eq('id', currentProfile.id);
      } else {
          localStorage.setItem(`pastel_agenda_vis_${currentProfile.id}`, String(visible));
      }
  }

  // --- PERSISTENCE HELPERS ---
  const saveColumnOrder = async (newColumns: Column[]) => {
      if (!isSupabaseConfigured()) {
          const key = `pastel_data_${currentProfile.id}`;
          const currentData = JSON.parse(localStorage.getItem(key) || '{"columns":[],"tasks":[]}');
          localStorage.setItem(key, JSON.stringify({ ...currentData, columns: newColumns }));
          return;
      }
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
      if (!isSupabaseConfigured()) {
          const key = `pastel_data_${currentProfile.id}`;
          const currentData = JSON.parse(localStorage.getItem(key) || '{"columns":[],"tasks":[]}');
          localStorage.setItem(key, JSON.stringify({ ...currentData, tasks: newTasks }));
          return;
      }
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
      
      // Load Agenda Layout from Profile Settings if available
      if (currentProfile.settings) {
          if (currentProfile.settings.agenda_pos) {
              setAgendaLayout(prev => ({ ...prev, ...currentProfile.settings!.agenda_pos }));
          }
          if (currentProfile.settings.agenda_size) {
              setAgendaLayout(prev => ({ ...prev, ...currentProfile.settings!.agenda_size }));
          }
          if (currentProfile.settings.agenda_visible !== undefined) {
              setShowAgenda(currentProfile.settings.agenda_visible);
          }
      } else if (!isSupabaseConfigured()) {
          // Fallback Local
          const savedLayout = localStorage.getItem(`pastel_agenda_layout_${currentProfile.id}`);
          if (savedLayout) setAgendaLayout(JSON.parse(savedLayout));
          const savedVis = localStorage.getItem(`pastel_agenda_vis_${currentProfile.id}`);
          if (savedVis === 'true') setShowAgenda(true);
      }

      if (!isSupabaseConfigured()) {
         const key = `pastel_data_${currentProfile.id}`;
         const saved = localStorage.getItem(key);
         if (saved) {
             const data = JSON.parse(saved);
             setColumns(data.columns || []);
             setTasks(data.tasks || []);
             setAgendaEvents(data.agendaEvents || []);
         } else {
             const defaultCols: Column[] = [
                { id: `todo_${currentProfile.id}`, title: 'A Fazer', color: 'blue', position: 0 },
                { id: `doing_${currentProfile.id}`, title: 'Em Andamento', color: 'yellow', position: 1 },
                { id: `done_${currentProfile.id}`, title: 'Concluído', color: 'green', position: 2 },
             ];
             setColumns(defaultCols);
             setTasks([]);
             localStorage.setItem(key, JSON.stringify({ columns: defaultCols, tasks: [] }));
         }
         const savedProfiles = localStorage.getItem('mock_profiles');
         if(savedProfiles) setProfiles(JSON.parse(savedProfiles));
         setLoading(false);
         return;
      }

      try {
        if (!currentProfile?.id) throw new Error("ID do perfil inválido");

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
        } else {
           const defaultCols = [
              { profile_id: currentProfile.id, title: 'A Fazer', position: 0, color: 'blue' },
              { profile_id: currentProfile.id, title: 'Em Andamento', position: 1, color: 'yellow' },
              { profile_id: currentProfile.id, title: 'Concluído', position: 2, color: 'green' },
           ];
           const { data: newCols } = await supabase.from('columns').insert(defaultCols).select();
           if (newCols) {
               setColumns(stableSortColumns(newCols.map((c: any) => ({ id: c.id, title: c.title, color: c.color, position: c.position || 0 }))));
               setTasks([]);
           }
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

  // --- REALTIME ---
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const channel = supabase.channel(`board_sync_${currentProfile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'columns' }, (payload) => {
          if (payload.eventType === 'INSERT' && String(payload.new.profile_id) === String(currentProfile.id)) {
             setColumns(prev => [...prev, payload.new as any]);
          }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
          if (payload.eventType === 'INSERT') {
              const newData = payload.new as any;
              setColumns(currentCols => {
                  if (currentCols.some(c => String(c.id) === String(newData.column_id))) {
                      setTasks(prev => {
                          if (prev.some(t => String(t.id) === String(newData.id))) return prev;
                          return [...prev, { id: newData.id, columnId: newData.column_id, color: newData.color || 'yellow', ...unpackTaskFromDB(newData) } as Task];
                      });
                  }
                  return currentCols;
              });
          } else if (payload.eventType === 'UPDATE') {
              setTasks(prev => prev.map(t => String(t.id) === String(payload.new.id) ? { ...t, columnId: payload.new.column_id, color: payload.new.color, ...unpackTaskFromDB(payload.new) } : t));
          } else if (payload.eventType === 'DELETE') {
              setTasks(prev => prev.filter(t => String(t.id) !== String(payload.old.id)));
          }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agenda_events' }, (payload) => {
          if (payload.eventType === 'INSERT' && payload.new.profile_id === currentProfile.id) {
             setAgendaEvents(prev => [...prev, payload.new as AgendaEvent]);
          } else if (payload.eventType === 'UPDATE') {
             setAgendaEvents(prev => prev.map(e => e.id === payload.new.id ? payload.new as AgendaEvent : e));
          } else if (payload.eventType === 'DELETE') {
             setAgendaEvents(prev => prev.filter(e => e.id !== payload.old.id));
          }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentProfile.id]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
        if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
            setShowAddMenu(false);
        }
    }
    if (showAddMenu) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showAddMenu]);

  // --- AGENDA HANDLERS ---
  const toggleAgenda = () => {
      setShowAddMenu(false);
      saveAgendaVisibility(!showAgenda);
  };

  const addAgendaEvent = async (evt: Partial<AgendaEvent>) => {
      const newEvt = { ...evt, id: crypto.randomUUID(), profile_id: currentProfile.id } as AgendaEvent;
      
      // Optimistic
      setAgendaEvents(prev => [...prev, newEvt]);
      addToHistory({ type: 'EVENT_CREATE', data: newEvt });

      if (isSupabaseConfigured()) {
          const { error } = await supabase.from('agenda_events').insert({ profile_id: currentProfile.id, ...evt });
          if(error) console.error(error);
      } else {
          // Local save logic...
      }
  };

  const updateAgendaEvent = async (evt: AgendaEvent) => {
      const prev = agendaEvents.find(e => e.id === evt.id);
      if(prev) addToHistory({ type: 'EVENT_UPDATE', prev, current: evt });

      setAgendaEvents(prev => prev.map(e => e.id === evt.id ? evt : e));
      if (isSupabaseConfigured()) {
          await supabase.from('agenda_events').update({
              title: evt.title, description: evt.description, start_time: evt.start_time,
              category: evt.category, is_completed: evt.is_completed, priority: evt.priority
          }).eq('id', evt.id);
      }
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
      // Optimistic
      const existing = dayNotes.find(n => n.date === date);
      const newNote = { id: existing?.id || crypto.randomUUID(), profile_id: currentProfile.id, date, content };
      
      setDayNotes(prev => {
          if (existing) return prev.map(n => n.id === existing.id ? newNote : n);
          return [...prev, newNote];
      });

      if (isSupabaseConfigured()) {
          await supabase.from('day_notes').upsert({
              profile_id: currentProfile.id,
              date: date,
              content: content
          }, { onConflict: 'profile_id,date' });
      }
  };

  // --- TASK HANDLERS (With Undo) ---
  const createTask = async (columnId: Id) => {
    setShowAddMenu(false);
    const tempId = crypto.randomUUID();
    const newTask: Task = {
      id: tempId, columnId, content: PLACEHOLDER_TEXTS[Math.floor(Math.random() * PLACEHOLDER_TEXTS.length)],
      color: 'yellow', description: '', attachments: [], isChecklist: false
    };
    
    setTasks(prev => [...prev, newTask]);
    addToHistory({ type: 'TASK_CREATE', data: newTask });

    if (isSupabaseConfigured()) {
        await supabase.from('tasks').insert({
            id: tempId, column_id: columnId, content: packTaskForDB(newTask), color: newTask.color, position: tasks.length
        });
    } else {
        saveTaskMoves([...tasks, newTask]);
    }
  };

  const deleteTask = async (id: Id) => {
    const taskToDelete = tasks.find(t => String(t.id) === String(id));
    if(!taskToDelete) return;

    addToHistory({ type: 'TASK_DELETE', data: taskToDelete });
    const updatedTasks = tasks.filter((t) => String(t.id) !== String(id));
    setTasks(updatedTasks);
    if (selectedTask && String(selectedTask.id) === String(id)) setIsModalOpen(false); 

    if(isSupabaseConfigured()) await supabase.from('tasks').delete().eq('id', id);
    else saveTaskMoves(updatedTasks);
  };

  const updateTaskFull = async (updatedTask: Task) => {
      const prev = tasks.find(t => t.id === updatedTask.id);
      if(prev) addToHistory({ type: 'TASK_UPDATE', prev, current: updatedTask });

      setTasks(prev => prev.map((t) => (String(t.id) === String(updatedTask.id) ? updatedTask : t)));
      
      if (isSupabaseConfigured()) {
             const packedContent = packTaskForDB(updatedTask);
             await supabase.from('tasks').update({
                content: packedContent, color: updatedTask.color, column_id: updatedTask.columnId
             }).eq('id', updatedTask.id);
      } else {
         saveTaskMoves(tasks.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
      }
  }

  // ... (Drag handlers same as before, simplified for brevity) ...
  const onDragEnd = (event: DragEndEvent) => {
    setActiveColumn(null);
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;
    if (active.id === over.id) return;

    if (active.data.current?.type === 'Column') {
      setColumns((columns) => {
        const activeIndex = columns.findIndex((col) => String(col.id) === String(active.id));
        const overIndex = columns.findIndex((col) => String(col.id) === String(over.id));
        const newCols = arrayMove(columns, activeIndex, overIndex).map((c, i) => ({ ...c, position: i }));
        saveColumnOrder(newCols);
        return newCols;
      });
    }
  };

  const handleDragEndFull = (event: DragEndEvent) => {
      onDragEnd(event); 
      const { active, over } = event;
      if (!over) return;
      if (active.data.current?.type === 'Task') saveTaskMoves(tasks);
  }

  // Simplified DragOver
  const onDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    if (active.id === over.id) return;
    if (active.data.current?.type !== 'Task') return;

    const isActiveTask = active.data.current?.type === 'Task';
    const isOverTask = over.data.current?.type === 'Task';
    
    if (isActiveTask && isOverTask) {
      setTasks((tasks) => {
        const activeIndex = tasks.findIndex((t) => String(t.id) === String(active.id));
        const overIndex = tasks.findIndex((t) => String(t.id) === String(over.id));
        if (tasks[activeIndex].columnId !== tasks[overIndex].columnId) tasks[activeIndex].columnId = tasks[overIndex].columnId;
        return arrayMove(tasks, activeIndex, overIndex);
      });
    }
    const isOverColumn = over.data.current?.type === 'Column';
    if (isActiveTask && isOverColumn) {
      setTasks((tasks) => {
        const activeIndex = tasks.findIndex((t) => String(t.id) === String(active.id));
        tasks[activeIndex].columnId = over.id;
        return arrayMove(tasks, activeIndex, activeIndex);
      });
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-start overflow-x-hidden p-8 gap-8 fade-in relative">
      {/* AGENDA LAYER */}
      {showAgenda && (
          <AgendaWidget 
             events={agendaEvents}
             initialPosition={{ x: agendaLayout.x, y: agendaLayout.y }}
             initialSize={{ w: agendaLayout.w, h: agendaLayout.h }}
             onLayoutChange={saveAgendaLayout}
             onRemove={() => saveAgendaVisibility(false)}
             onOpen={() => setIsAgendaModalOpen(true)}
          />
      )}
      
      <AgendaModal
        isOpen={isAgendaModalOpen}
        onClose={() => setIsAgendaModalOpen(false)}
        events={agendaEvents}
        dayNotes={dayNotes}
        onAddEvent={addAgendaEvent}
        onUpdateEvent={updateAgendaEvent}
        onDeleteEvent={deleteAgendaEvent}
        onSaveDayNote={saveDayNote}
        profileId={currentProfile.id}
      />

      {selectedTask && (
        <TaskModal 
            task={selectedTask}
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            onUpdate={updateTaskFull}
            onDelete={deleteTask}
            profiles={profiles}
            currentProfileId={currentProfile.id}
        />
      )}

      {/* HEADER */}
      <header className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center w-full mb-4">
        <div className="flex items-center gap-4">
          <div className="group relative">
            <img src={activeProfile.avatar} className="w-12 h-12 rounded-full border-2 border-white shadow-md cursor-pointer" alt="Avatar" />
          </div>
          <div>
            <h1 className="text-4xl font-black text-stone-700 tracking-tight leading-none">
              Pastel<span className="text-red-300">Flow</span>.
            </h1>
          </div>
          <button onClick={onSwitchProfile} className="ml-2 p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-200/50 rounded-full transition-colors" title="Trocar Perfil">
            <LogOut size={20} />
          </button>
        </div>
        
        <div className="relative" ref={addMenuRef}>
            <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="flex items-center gap-2 bg-stone-800 hover:bg-stone-700 text-white px-6 py-3 rounded-xl shadow-lg shadow-stone-200 transition-all transform active:scale-95 font-bold"
            >
            <Plus size={20} />
            Adicionar
            <ChevronDown size={16} className={`transition-transform ${showAddMenu ? 'rotate-180' : ''}`} />
            </button>
            
            {showAddMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-stone-100 p-2 z-50 animate-in fade-in slide-in-from-top-2">
                    <button onClick={async () => {
                         const tempId = crypto.randomUUID();
                         setColumns(prev => [...prev, { id: tempId, title: 'Nova Lista', color: 'blue', position: columns.length }]);
                         if(isSupabaseConfigured()) await supabase.from('columns').insert({ id: tempId, profile_id: currentProfile.id, title: 'Nova Lista', position: columns.length, color: 'blue' });
                         setShowAddMenu(false);
                    }} className="w-full flex items-center gap-3 p-3 hover:bg-stone-50 rounded-lg text-left text-stone-700 font-bold">
                        <div className="bg-blue-100 p-1 rounded text-blue-600"><ListIcon size={18} /></div>
                        Nova Lista
                    </button>
                    <button onClick={() => { if(columns.length>0) createTask(columns[0].id); }} className="w-full flex items-center gap-3 p-3 hover:bg-stone-50 rounded-lg text-left text-stone-700 font-bold">
                        <div className="bg-yellow-100 p-1 rounded text-yellow-600"><StickyNote size={18} /></div>
                        Nova Nota
                    </button>
                    <button onClick={toggleAgenda} className="w-full flex items-center gap-3 p-3 hover:bg-stone-50 rounded-lg text-left text-stone-700 font-bold border-t border-stone-100 mt-1">
                        <div className="bg-red-100 p-1 rounded text-red-600"><Calendar size={18} /></div>
                        {showAgenda ? 'Ocultar Agenda' : 'Agenda'}
                    </button>
                </div>
            )}
        </div>
      </header>

      <DndContext
        sensors={sensors}
        onDragStart={(e) => {
             if(e.active.data.current?.type === 'Column') setActiveColumn(e.active.data.current.column);
             if(e.active.data.current?.type === 'Task') setActiveTask(e.active.data.current.task);
        }}
        onDragEnd={handleDragEndFull}
        onDragOver={onDragOver}
        collisionDetection={rectIntersection}
      >
        <div className="flex flex-wrap items-start gap-8 w-full pb-20">
          <SortableContext items={columnsId} strategy={rectSortingStrategy}>
            {columns.map((col) => (
              <List
                key={col.id}
                column={col}
                tasks={tasks.filter((task) => String(task.columnId) === String(col.id))}
                createTask={createTask}
                deleteColumn={async (id) => {
                    const deleted = columns.find(c => c.id === id);
                    if(deleted) {
                        setColumns(prev => prev.filter(c => c.id !== id));
                        if(isSupabaseConfigured()) await supabase.from('columns').delete().eq('id', id);
                    }
                }}
                updateColumnTitle={(id, t) => {
                    setColumns(prev => prev.map(c => c.id === id ? {...c, title: t} : c));
                    supabase.from('columns').update({ title: t }).eq('id', id);
                }}
                updateColumnColor={(id, c) => {
                    setColumns(prev => prev.map(col => col.id === id ? {...col, color: c} : col));
                    supabase.from('columns').update({ color: c }).eq('id', id);
                }}
                deleteTask={deleteTask}
                updateTaskColor={(id, color) => {
                     const t = tasks.find(t => String(t.id) === String(id));
                     if(t) updateTaskFull({...t, color});
                }}
                updateTaskContent={(id, content) => {
                     const t = tasks.find(t => String(t.id) === String(id));
                     if(t) updateTaskFull({...t, content});
                }}
                onTaskClick={(t) => { setSelectedTask(t); setIsModalOpen(true); }}
              />
            ))}
          </SortableContext>
        </div>

        {createPortal(
          <DragOverlay>
            {activeColumn && (
              <List
                column={activeColumn}
                tasks={tasks.filter((task) => String(task.columnId) === String(activeColumn.id))}
                createTask={() => {}}
                deleteColumn={() => {}}
                updateColumnTitle={() => {}}
                updateColumnColor={() => {}}
                deleteTask={() => {}}
                updateTaskColor={() => {}}
                updateTaskContent={() => {}}
                onTaskClick={() => {}}
              />
            )}
            {activeTask && (
              <Card
                task={activeTask}
                onClick={() => {}}
              />
            )}
          </DragOverlay>,
          document.body
        )}
      </DndContext>
    </div>
  );
};

export default Board;
