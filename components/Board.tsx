
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
import { Plus, LogOut, ChevronDown, List as ListIcon, StickyNote, AlertTriangle } from 'lucide-react';
import { Column, Task, Id, PastelColor, Profile } from '../types';
import List from './List';
import Card from './Card';
import TaskModal from './TaskModal';
import { createPortal } from 'react-dom';
import { PLACEHOLDER_TEXTS, COLORS } from '../constants';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js';

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
      // Basic validation to check if it's our JSON structure
      if (parsed.title !== undefined || parsed.attachments !== undefined) {
        return {
          content: parsed.title || '', 
          description: parsed.description || '',
          attachments: parsed.attachments || [],
          isChecklist: parsed.isChecklist || false
        };
      }
    }
  } catch (e) {
    // Ignore parse errors, treat as plain text
  }
  return {
    content: content || '',
    description: dbTask.description || '', 
    attachments: [],
    isChecklist: false
  };
};

// Stable sort function
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

  const [showAddMenu, setShowAddMenu] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);

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

      const { error } = await supabase.from('columns').upsert(updates);
      if (error) {
          console.error("ERRO SUPABASE (Salvar Ordem):", JSON.stringify(error, null, 2));
      }
  };

  const saveColumnAttribute = async (id: Id, updates: Partial<Column>) => {
      if (!isSupabaseConfigured()) {
          const key = `pastel_data_${currentProfile.id}`;
          const currentData = JSON.parse(localStorage.getItem(key) || '{"columns":[],"tasks":[]}');
          const newCols = currentData.columns.map((c: Column) => String(c.id) === String(id) ? { ...c, ...updates } : c);
          localStorage.setItem(key, JSON.stringify({ ...currentData, columns: newCols }));
          return;
      }

      const { error } = await supabase.from('columns').update(updates).eq('id', id);
      if (error) {
          console.error("ERRO SUPABASE (Atualizar Coluna):", JSON.stringify(error, null, 2));
      }
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

      const { error } = await supabase.from('tasks').upsert(updates);
      if (error) {
          console.error("ERRO SUPABASE (Salvar Tarefas):", JSON.stringify(error, null, 2));
      }
  };


  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setErrorMsg(null);
      
      if (!isSupabaseConfigured()) {
         // Local Storage Logic
         const key = `pastel_data_${currentProfile.id}`;
         const saved = localStorage.getItem(key);
         if (saved) {
             const data = JSON.parse(saved);
             setColumns(data.columns || []);
             setTasks(data.tasks || []);
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

        const { data: colsData, error: colsError } = await supabase
          .from('columns')
          .select('*')
          .eq('profile_id', currentProfile.id)
          .order('position', { ascending: true });
        
        if (colsError) {
            console.error("Error fetching columns:", JSON.stringify(colsError, null, 2));
            throw colsError;
        }

        let loadedTasks: Task[] = [];
        if (colsData && colsData.length > 0) {
            const { data: tasksData, error: tasksError } = await supabase
              .from('tasks')
              .select('*')
              .in('column_id', colsData.map(c => c.id))
              .order('position', { ascending: true });
            
            if (tasksError) {
                console.error("Error fetching tasks:", JSON.stringify(tasksError, null, 2));
                throw tasksError;
            }
            
            if (tasksData) {
                loadedTasks = tasksData.map((t: any) => {
                    const unpacked = unpackTaskFromDB(t);
                    return {
                        id: t.id,
                        columnId: t.column_id,
                        color: t.color || 'yellow',
                        ...unpacked
                    } as Task;
                });
            }
        }

        const { data: profilesData } = await supabase.from('profiles').select('*');
        if (profilesData) setProfiles(profilesData);

        if (colsData && colsData.length > 0) {
          const mappedCols = colsData.map((c: any) => ({
              id: c.id,
              title: c.title,
              color: c.color,
              position: c.position || 0
          }));
          setColumns(stableSortColumns(mappedCols));
          setTasks(loadedTasks);
        } else {
           // Create default columns in DB if none exist
           const defaultCols = [
              { profile_id: currentProfile.id, title: 'A Fazer', position: 0, color: 'blue' },
              { profile_id: currentProfile.id, title: 'Em Andamento', position: 1, color: 'yellow' },
              { profile_id: currentProfile.id, title: 'Concluído', position: 2, color: 'green' },
           ];
           const { data: newCols, error: insertError } = await supabase
              .from('columns')
              .insert(defaultCols)
              .select();

           if (insertError) {
               console.error("Error creating default columns:", JSON.stringify(insertError, null, 2));
               // Fallback: Don't block UI, just empty
           } else if (newCols) {
               const mapped = newCols.map((c: any) => ({
                   id: c.id, 
                   title: c.title, 
                   color: c.color, 
                   position: c.position || 0
                }));
               setColumns(stableSortColumns(mapped));
               setTasks([]);
           }
        }
      } catch (error: any) {
        console.error("Error loading board full catch:", error);
        setErrorMsg("Erro ao carregar o quadro. Verifique se as tabelas foram criadas no Supabase.");
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
          if (payload.eventType === 'INSERT') {
            const newCol = payload.new as any;
            if (String(newCol.profile_id) === String(currentProfile.id)) {
                setColumns(prev => {
                    if (prev.some(c => String(c.id) === String(newCol.id))) return prev;
                    return stableSortColumns([...prev, { id: newCol.id, title: newCol.title, color: newCol.color, position: newCol.position || 0 }]);
                });
            }
          } else if (payload.eventType === 'UPDATE') {
             const updatedCol = payload.new as any;
             setColumns(prev => stableSortColumns(prev.map(c => String(c.id) === String(updatedCol.id) ? { ...c, title: updatedCol.title, color: updatedCol.color, position: updatedCol.position || 0 } : c)));
          } else if (payload.eventType === 'DELETE') {
             setColumns(prev => prev.filter(c => String(c.id) !== String(payload.old.id)));
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
              const newData = payload.new as any;
              setTasks(prev => prev.map(t => String(t.id) === String(newData.id) ? { ...t, columnId: newData.column_id, color: newData.color || t.color, ...unpackTaskFromDB(newData) } : t));
          } else if (payload.eventType === 'DELETE') {
              setTasks(prev => prev.filter(t => String(t.id) !== String(payload.old.id)));
              if (selectedTask && String(selectedTask.id) === String(payload.old.id)) { setIsModalOpen(false); setSelectedTask(null); }
          }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentProfile.id, selectedTask]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
        if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
            setShowAddMenu(false);
        }
    }
    if (showAddMenu) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showAddMenu]);

  const generateTempId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
  };

  const createColumn = async () => {
    setShowAddMenu(false);
    const tempTitle = `Nova Lista`;
    const tempId = generateTempId();
    const newPos = columns.length;

    const optimisticCol: Column = { id: tempId, title: tempTitle, color: 'blue', position: newPos };
    const newCols = stableSortColumns([...columns, optimisticCol]);
    setColumns(newCols);

    if (isSupabaseConfigured()) {
        const { data, error } = await supabase.from('columns').insert({
            id: tempId, // Send explicit UUID
            profile_id: currentProfile.id,
            title: tempTitle,
            position: newPos,
            color: 'blue'
        }).select().single();

        if (error) {
            console.error("Erro ao criar lista:", JSON.stringify(error, null, 2));
            alert(`Erro ao criar lista: ${error.message || 'Verifique o console'}`);
            setColumns(prev => prev.filter(c => c.id !== tempId));
        } else if (data) {
            setColumns(prev => prev.map(c => c.id === tempId ? { ...c, id: data.id } : c));
        }
    } else {
        saveColumnOrder(newCols);
    }
  };

  const deleteColumn = async (id: Id) => {
    const updatedCols = columns.filter((col) => String(col.id) !== String(id));
    const updatedTasks = tasks.filter((t) => String(t.columnId) !== String(id));
    setColumns(updatedCols);
    setTasks(updatedTasks);

    if (isSupabaseConfigured()) {
        await supabase.from('columns').delete().eq('id', id);
    } else {
        saveColumnOrder(updatedCols);
        saveTaskMoves(updatedTasks);
    }
  };

  const updateColumnTitle = async (id: Id, title: string) => {
    const updatedCols = columns.map((col) => String(col.id) === String(id) ? { ...col, title } : col);
    setColumns(updatedCols);
    saveColumnAttribute(id, { title });
  };

  const updateColumnColor = async (id: Id, color: PastelColor | null) => {
    const updatedCols = columns.map((col) => String(col.id) === String(id) ? { ...col, color: color } : col);
    setColumns(updatedCols);
    saveColumnAttribute(id, { color });
  }

  const createTask = async (columnId: Id) => {
    setShowAddMenu(false);
    const randomText = PLACEHOLDER_TEXTS[Math.floor(Math.random() * PLACEHOLDER_TEXTS.length)];
    const tempId = generateTempId();
    const colTasks = tasks.filter(t => String(t.columnId) === String(columnId));
    const newPos = colTasks.length;

    const newTask: Task = {
      id: tempId,
      columnId,
      content: randomText,
      color: 'yellow',
      description: '',
      attachments: [],
      isChecklist: false
    };
    
    const newTasks = [...tasks, newTask];
    setTasks(newTasks);

    if (isSupabaseConfigured()) {
        const packedContent = packTaskForDB(newTask);
        const { data, error } = await supabase.from('tasks').insert({
            id: tempId, // Send explicit UUID
            column_id: columnId,
            content: packedContent, 
            color: newTask.color,
            position: newPos,
        }).select().single();

        if (error) {
            console.error("Error creating task:", JSON.stringify(error, null, 2));
            alert(`Erro ao criar tarefa: ${error.message || 'Verifique o console'}`);
            setTasks(prev => prev.filter(t => t.id !== tempId));
        } else if (data) {
            setTasks(prev => prev.map(t => t.id === tempId ? { ...t, id: data.id } : t));
            setSelectedTask(prev => (prev && prev.id === tempId) ? { ...prev, id: data.id } : prev);
        }
    } else {
        saveTaskMoves(newTasks);
    }
  };

  const createFloatingTask = () => {
    if (columns.length === 0) {
        alert("Crie uma lista primeiro para adicionar notas.");
        return;
    }
    createTask(columns[0].id);
  };

  const deleteTask = async (id: Id) => {
    const updatedTasks = tasks.filter((task) => String(task.id) !== String(id));
    setTasks(updatedTasks);
    if (selectedTask && String(selectedTask.id) === String(id)) setIsModalOpen(false); 

    if(isSupabaseConfigured()) {
        await supabase.from('tasks').delete().eq('id', id);
    } else {
        saveTaskMoves(updatedTasks);
    }
  };

  const updateTaskFull = async (updatedTask: Task) => {
      setTasks(prev => prev.map((t) => (String(t.id) === String(updatedTask.id) ? updatedTask : t)));
      
      if (isSupabaseConfigured()) {
         try {
             const packedContent = packTaskForDB(updatedTask);
             await supabase.from('tasks').update({
                content: packedContent,
                color: updatedTask.color,
                column_id: updatedTask.columnId
             }).eq('id', updatedTask.id);
         } catch (e) {
             console.error("Autosave failed", e);
         }
      } else {
         const newTasks = tasks.map((t) => (t.id === updatedTask.id ? updatedTask : t));
         saveTaskMoves(newTasks);
      }
  }

  const onDragStart = (event: DragStartEvent) => {
    if (event.active.data.current?.type === 'Column') {
      setActiveColumn(event.active.data.current.column);
      return;
    }
    if (event.active.data.current?.type === 'Task') {
      setActiveTask(event.active.data.current.task);
      return;
    }
  };

  const onDragEnd = (event: DragEndEvent) => {
    setActiveColumn(null);
    setActiveTask(null);

    const { active, over } = event;
    if (!over) return;
    const activeId = active.id;
    const overId = over.id;
    if (activeId === overId) return;

    const isActiveColumn = active.data.current?.type === 'Column';
    if (isActiveColumn) {
      setColumns((columns) => {
        const activeIndex = columns.findIndex((col) => String(col.id) === String(activeId));
        const overIndex = columns.findIndex((col) => String(col.id) === String(overId));
        const newCols = arrayMove(columns, activeIndex, overIndex);
        const newColsWithPos = newCols.map((c, i) => ({ ...c, position: i }));
        saveColumnOrder(newColsWithPos);
        return newColsWithPos;
      });
    }
  };

  const onDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = active.id;
    const overId = over.id;
    if (activeId === overId) return;

    const isActiveTask = active.data.current?.type === 'Task';
    const isOverTask = over.data.current?.type === 'Task';
    if (!isActiveTask) return;

    if (isActiveTask && isOverTask) {
      setTasks((tasks) => {
        const activeIndex = tasks.findIndex((t) => String(t.id) === String(activeId));
        const overIndex = tasks.findIndex((t) => String(t.id) === String(overId));
        if (tasks[activeIndex].columnId !== tasks[overIndex].columnId) {
          tasks[activeIndex].columnId = tasks[overIndex].columnId;
        }
        return arrayMove(tasks, activeIndex, overIndex);
      });
    }
    const isOverColumn = over.data.current?.type === 'Column';
    if (isActiveTask && isOverColumn) {
      setTasks((tasks) => {
        const activeIndex = tasks.findIndex((t) => String(t.id) === String(activeId));
        tasks[activeIndex].columnId = overId;
        return arrayMove(tasks, activeIndex, activeIndex);
      });
    }
  };

  const handleDragEndFull = (event: DragEndEvent) => {
      onDragEnd(event); 
      const { active, over } = event;
      if (!over) return;
      if (active.data.current?.type === 'Task') saveTaskMoves(tasks);
  }

  const handleTaskClick = (task: Task) => {
      setSelectedTask(task);
      setIsModalOpen(true);
  };

  if (loading) {
     return <div className="flex w-full h-screen items-center justify-center text-pastel-text">Carregando seus planos...</div>;
  }

  if (errorMsg) {
      return (
          <div className="flex flex-col w-full h-screen items-center justify-center text-pastel-text p-4 text-center">
              <div className="bg-red-50 p-6 rounded-2xl border border-red-100 max-w-md">
                <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                <h3 className="font-bold text-lg text-red-900 mb-2">Ops! Algo deu errado.</h3>
                <p className="text-red-700 mb-4">{errorMsg}</p>
                <p className="text-xs text-red-500 bg-white p-3 rounded border border-red-100 font-mono">
                    Dica: Verifique se rodou o comando SQL no Supabase para criar as tabelas.
                </p>
                <button onClick={() => window.location.reload()} className="mt-6 bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-xl font-bold transition-colors">
                    Tentar Novamente
                </button>
              </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-start overflow-x-hidden p-8 gap-8 fade-in">
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
                    <button onClick={createColumn} className="w-full flex items-center gap-3 p-3 hover:bg-stone-50 rounded-lg text-left text-stone-700 font-bold">
                        <div className="bg-blue-100 p-1 rounded text-blue-600"><ListIcon size={18} /></div>
                        Nova Lista
                    </button>
                    <button onClick={createFloatingTask} className="w-full flex items-center gap-3 p-3 hover:bg-stone-50 rounded-lg text-left text-stone-700 font-bold">
                        <div className="bg-yellow-100 p-1 rounded text-yellow-600"><StickyNote size={18} /></div>
                        Nova Nota
                    </button>
                </div>
            )}
        </div>
      </header>

      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
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
                deleteColumn={deleteColumn}
                updateColumnTitle={updateColumnTitle}
                updateColumnColor={updateColumnColor}
                deleteTask={deleteTask}
                updateTaskColor={(id, color) => {
                     const t = tasks.find(t => String(t.id) === String(id));
                     if(t) updateTaskFull({...t, color});
                }}
                updateTaskContent={(id, content) => {
                     const t = tasks.find(t => String(t.id) === String(id));
                     if(t) updateTaskFull({...t, content});
                }}
                onTaskClick={handleTaskClick}
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
                createTask={createTask}
                deleteColumn={deleteColumn}
                updateColumnTitle={updateColumnTitle}
                updateColumnColor={updateColumnColor}
                deleteTask={deleteTask}
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
