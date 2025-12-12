
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
import { Plus, LogOut, ChevronDown, List as ListIcon, StickyNote } from 'lucide-react';
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
// Packs data into 'content' column to bypass schema limitations
const packTaskForDB = (task: Task) => {
  return JSON.stringify({
    title: task.content,
    description: task.description || '',
    attachments: task.attachments || [],
    isChecklist: task.isChecklist || false
  });
};

const unpackTaskFromDB = (dbTask: any): Partial<Task> => {
  const { content, description } = dbTask;
  
  // Try parsing JSON from content column
  try {
    if (content && typeof content === 'string' && content.trim().startsWith('{')) {
      const parsed = JSON.parse(content);
      // Validate it looks like our packed object
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
    // Ignore parse errors, treat as legacy plain text
  }

  // Fallback for legacy plain text rows
  return {
    content: content || '',
    description: description || '', 
    attachments: [],
    isChecklist: false
  };
};

const Board: React.FC<Props> = ({ currentProfile, onSwitchProfile }) => {
  const [columns, setColumns] = useState<Column[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeColumn, setActiveColumn] = useState<Column | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  // Task Modal State
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Add Button Menu State
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

  // Derived active profile to ensure header updates in realtime
  const activeProfile = useMemo(() => {
      return profiles.find(p => p.id === currentProfile.id) || currentProfile;
  }, [profiles, currentProfile]);

  // Load Data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      // Local Storage Fallback
      if (!isSupabaseConfigured()) {
         const key = `pastel_data_${currentProfile.id}`;
         const saved = localStorage.getItem(key);
         if (saved) {
             const data = JSON.parse(saved);
             setColumns(data.columns || []);
             setTasks(data.tasks || []);
         } else {
             const defaultCols = [
                { id: `todo_${currentProfile.id}`, title: 'A Fazer', color: 'blue' as PastelColor },
                { id: `doing_${currentProfile.id}`, title: 'Em Andamento', color: 'yellow' as PastelColor },
                { id: `done_${currentProfile.id}`, title: 'Concluído', color: 'green' as PastelColor },
             ];
             setColumns(defaultCols as any);
             setTasks([]);
             localStorage.setItem(key, JSON.stringify({ columns: defaultCols, tasks: [] }));
         }
         
         const savedProfiles = localStorage.getItem('mock_profiles');
         if(savedProfiles) setProfiles(JSON.parse(savedProfiles));

         setLoading(false);
         return;
      }

      try {
        // Fetch Columns
        const { data: colsData, error: colsError } = await supabase
          .from('columns')
          .select('*')
          .eq('profile_id', currentProfile.id)
          .order('position');
        
        if (colsError) throw colsError;

        // Fetch Tasks
        let loadedTasks: Task[] = [];
        if (colsData && colsData.length > 0) {
            const { data: tasksData, error: tasksError } = await supabase
              .from('tasks')
              .select('*')
              .in('column_id', colsData.map(c => c.id));
            
            if (tasksError) throw tasksError;
            
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

        // Fetch All Profiles (for sharing)
        const { data: profilesData } = await supabase.from('profiles').select('*');
        if (profilesData) setProfiles(profilesData);

        if (colsData && colsData.length > 0) {
          setColumns(colsData);
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
               console.error("Error creating default columns:", insertError);
           } else if (newCols) {
               setColumns(newCols);
               setTasks([]);
           }
        }
      } catch (error: any) {
        console.error("Error loading board:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentProfile.id]);

  // --- REALTIME SUBSCRIPTION SETUP ---
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const channel = supabase.channel(`board_sync_${currentProfile.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'columns' },
        (payload) => {
          // Handle Columns Changes
          if (payload.eventType === 'INSERT') {
            const newCol = payload.new as any;
            if (newCol.profile_id === currentProfile.id) {
                setColumns((prev) => {
                    if (prev.some(c => String(c.id) === String(newCol.id))) return prev;
                    const c: Column = { id: newCol.id, title: newCol.title, color: newCol.color };
                    return [...prev, c]; 
                });
            }
          } else if (payload.eventType === 'UPDATE') {
             const updatedCol = payload.new as any;
             setColumns((prev) => prev.map(c => 
                 String(c.id) === String(updatedCol.id) 
                    ? { ...c, title: updatedCol.title, color: updatedCol.color } 
                    : c
             ));
          } else if (payload.eventType === 'DELETE') {
             setColumns((prev) => prev.filter(c => String(c.id) !== String(payload.old.id)));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        (payload) => {
          // Handle Task Changes
          if (payload.eventType === 'INSERT') {
              const newData = payload.new as any;
              // Check if this task belongs to one of our current columns
              setColumns(currentCols => {
                  const belongsToBoard = currentCols.some(c => String(c.id) === String(newData.column_id));
                  if (belongsToBoard) {
                      setTasks(prev => {
                          if (prev.some(t => String(t.id) === String(newData.id))) return prev;
                          const unpacked = unpackTaskFromDB(newData);
                          return [...prev, {
                              id: newData.id,
                              columnId: newData.column_id,
                              color: newData.color || 'yellow',
                              ...unpacked
                          } as Task];
                      });
                  }
                  return currentCols;
              });

          } else if (payload.eventType === 'UPDATE') {
              const newData = payload.new as any;
              const unpacked = unpackTaskFromDB(newData);
              
              setTasks(prev => prev.map(t => {
                  if (String(t.id) === String(newData.id)) {
                      return {
                          ...t,
                          columnId: newData.column_id,
                          color: newData.color || t.color,
                          ...unpacked
                      };
                  }
                  return t;
              }));
              
              // SYNC SELECTED TASK
              setSelectedTask(prev => {
                  if (prev && String(prev.id) === String(newData.id)) {
                      return {
                          ...prev,
                          columnId: newData.column_id,
                          color: newData.color || prev.color,
                          ...unpacked
                      };
                  }
                  return prev;
              });
              
          } else if (payload.eventType === 'DELETE') {
              const oldId = payload.old.id;
              setTasks(prev => prev.filter(t => String(t.id) !== String(oldId)));
              // Close modal if deleted task was open
              if (selectedTask && String(selectedTask.id) === String(oldId)) {
                  setIsModalOpen(false);
                  setSelectedTask(null);
              }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        (payload) => {
             if (payload.eventType === 'INSERT') {
                 setProfiles(prev => [...prev, payload.new as Profile]);
             } else if (payload.eventType === 'UPDATE') {
                 setProfiles(prev => prev.map(p => String(p.id) === String(payload.new.id) ? payload.new as Profile : p));
             } else if (payload.eventType === 'DELETE') {
                 setProfiles(prev => prev.filter(p => String(p.id) !== String(payload.old.id)));
             }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentProfile.id, selectedTask]);


  // Click outside add menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
        if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
            setShowAddMenu(false);
        }
    }
    if (showAddMenu) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showAddMenu]);


  // Sync Data Helper (Batch Update - Fallback/Reorder)
  const persistData = async (newColumns: Column[], newTasks: Task[]) => {
      if (!isSupabaseConfigured()) {
          const key = `pastel_data_${currentProfile.id}`;
          localStorage.setItem(key, JSON.stringify({ columns: newColumns, tasks: newTasks }));
          return;
      }
      
      const colsToSave = newColumns.map((c, idx) => ({ 
          id: c.id, 
          title: c.title, 
          position: idx, 
          color: c.color,
          profile_id: currentProfile.id 
      }));
      if (colsToSave.length > 0) {
          await supabase.from('columns').upsert(colsToSave);
      }

      // Pack content for each task before saving
      const tasksToSave = newTasks.map((t, idx) => ({
          id: t.id,
          column_id: t.columnId,
          content: packTaskForDB(t), 
          color: t.color,
          position: idx 
      }));

      if (tasksToSave.length > 0) {
         await supabase.from('tasks').upsert(tasksToSave);
      }
  };


  const generateTempId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
  };

  const createColumn = async () => {
    setShowAddMenu(false);
    const tempTitle = `Nova Lista`;
    const tempId = generateTempId();

    const optimisticCol: Column = { id: tempId, title: tempTitle, color: 'blue' };
    setColumns([...columns, optimisticCol]);

    if (isSupabaseConfigured()) {
        const { data, error } = await supabase.from('columns').insert({
            id: tempId,
            profile_id: currentProfile.id,
            title: tempTitle,
            position: columns.length,
            color: 'blue'
        }).select().single();

        if (error) {
            setColumns(prev => prev.filter(c => c.id !== tempId));
            alert(`Erro ao criar lista: ${error.message}`);
        } else if (data && data.id !== tempId) {
            setColumns(prev => prev.map(c => c.id === tempId ? { ...c, id: data.id } : c));
        }
    } else {
        persistData([...columns, optimisticCol], tasks);
    }
  };

  const deleteColumn = async (id: Id) => {
    const updatedCols = columns.filter((col) => col.id !== id);
    const updatedTasks = tasks.filter((t) => t.columnId !== id);
    setColumns(updatedCols);
    setTasks(updatedTasks);

    if (isSupabaseConfigured()) {
        await supabase.from('columns').delete().eq('id', id);
    } else {
        persistData(updatedCols, updatedTasks);
    }
  };

  const updateColumnTitle = async (id: Id, title: string) => {
    const updatedCols = columns.map((col) => col.id === id ? { ...col, title } : col);
    setColumns(updatedCols);
    if(isSupabaseConfigured()) {
        await supabase.from('columns').update({ title }).eq('id', id);
    } else {
        persistData(updatedCols, tasks);
    }
  };

  const updateColumnColor = async (id: Id, color: PastelColor) => {
    const updatedCols = columns.map((col) => col.id === id ? { ...col, color } : col);
    setColumns(updatedCols);
    if(isSupabaseConfigured()) {
        await supabase.from('columns').update({ color }).eq('id', id);
    } else {
        persistData(updatedCols, tasks);
    }
  }

  const createTask = async (columnId: Id) => {
    setShowAddMenu(false);
    const randomText = PLACEHOLDER_TEXTS[Math.floor(Math.random() * PLACEHOLDER_TEXTS.length)];
    const tempId = generateTempId();
    
    const newTask: Task = {
      id: tempId,
      columnId,
      content: randomText,
      color: 'yellow',
      description: '',
      attachments: [],
      isChecklist: false
    };
    
    setTasks(prev => [...prev, newTask]);

    if (isSupabaseConfigured()) {
        const columnTasks = tasks.filter(t => t.columnId === columnId);
        
        // Pack content immediately
        const packedContent = packTaskForDB(newTask);

        const insertPayload = {
            id: tempId, 
            column_id: columnId,
            content: packedContent, 
            color: newTask.color,
            position: columnTasks.length,
        };

        const { data, error } = await supabase.from('tasks').insert(insertPayload).select().single();

        if (error) {
            console.error("Error creating task:", error);
            setTasks(prev => prev.filter(t => t.id !== tempId));
            alert("Erro ao criar nota.");
        } else if (data && data.id !== tempId) {
            // CRITICAL FIX: Update tasks state AND selectedTask if the user already opened it
            const realId = data.id;
            setTasks(prev => prev.map(t => t.id === tempId ? { ...t, id: realId } : t));
            
            // If the modal is open with the temp ID, update it too so saving works
            setSelectedTask(prev => (prev && prev.id === tempId) ? { ...prev, id: realId } : prev);
        }
    } else {
        persistData(columns, [...tasks, newTask]);
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
    const updatedTasks = tasks.filter((task) => task.id !== id);
    setTasks(updatedTasks);
    if (selectedTask?.id === id) setIsModalOpen(false); 

    if(isSupabaseConfigured()) {
        await supabase.from('tasks').delete().eq('id', id);
    } else {
        persistData(columns, updatedTasks);
    }
  };

  // --- AUTOSAVE HANDLER ---
  const updateTaskFull = async (updatedTask: Task) => {
      // Optimistic update
      setTasks(prev => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
      
      if (isSupabaseConfigured()) {
         try {
             const packedContent = packTaskForDB(updatedTask);
             
             await supabase.from('tasks').update({
                content: packedContent,
                color: updatedTask.color,
             }).eq('id', updatedTask.id);

         } catch (e) {
             console.error("Autosave failed", e);
         }
      } else {
         persistData(columns, tasks.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
      }
  }

  // DnD Handlers
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
        const activeIndex = columns.findIndex((col) => col.id === activeId);
        const overIndex = columns.findIndex((col) => col.id === overId);
        const newCols = arrayMove(columns, activeIndex, overIndex);
        persistData(newCols, tasks); // Save order
        return newCols;
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
        const activeIndex = tasks.findIndex((t) => t.id === activeId);
        const overIndex = tasks.findIndex((t) => t.id === overId);

        let newTasks = [...tasks];
        if (tasks[activeIndex].columnId !== tasks[overIndex].columnId) {
          tasks[activeIndex].columnId = tasks[overIndex].columnId;
          newTasks = arrayMove(tasks, activeIndex, overIndex - 1);
        } else {
          newTasks = arrayMove(tasks, activeIndex, overIndex);
        }
        persistData(columns, newTasks);
        return newTasks;
      });
    }

    const isOverColumn = over.data.current?.type === 'Column';
    if (isActiveTask && isOverColumn) {
      setTasks((tasks) => {
        const activeIndex = tasks.findIndex((t) => t.id === activeId);
        tasks[activeIndex].columnId = overId;
        const newTasks = arrayMove(tasks, activeIndex, activeIndex); 
        persistData(columns, newTasks);
        return newTasks;
      });
    }
  };

  const handleTaskClick = (task: Task) => {
      setSelectedTask(task);
      setIsModalOpen(true);
  };

  if (loading) {
     return <div className="flex w-full h-screen items-center justify-center text-pastel-text">Carregando seus planos...</div>;
  }

  return (
    <div className="
        min-h-screen
        w-full
        flex
        flex-col
        items-start
        overflow-x-hidden
        p-8
        gap-8
        fade-in
    ">
      {/* Task Modal */}
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

      {/* Header */}
      <header className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center w-full mb-4">
        <div className="flex items-center gap-4">
          <div className="group relative">
            <img 
                src={activeProfile.avatar} 
                className="w-12 h-12 rounded-full border-2 border-white shadow-md cursor-pointer" 
                alt="Avatar"
            />
          </div>
          <div>
            <h1 className="text-4xl font-black text-stone-700 tracking-tight leading-none">
              Pastel<span className="text-red-300">Flow</span>.
            </h1>
          </div>
          <button 
            onClick={onSwitchProfile}
            className="ml-2 p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-200/50 rounded-full transition-colors"
            title="Trocar Perfil"
          >
            <LogOut size={20} />
          </button>
        </div>
        
        <div className="relative" ref={addMenuRef}>
            <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="
                flex
                items-center
                gap-2
                bg-stone-800
                hover:bg-stone-700
                text-white
                px-6
                py-3
                rounded-xl
                shadow-lg
                shadow-stone-200
                transition-all
                transform
                active:scale-95
                font-bold
            "
            >
            <Plus size={20} />
            Adicionar
            <ChevronDown size={16} className={`transition-transform ${showAddMenu ? 'rotate-180' : ''}`} />
            </button>
            
            {showAddMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-stone-100 p-2 z-50 animate-in fade-in slide-in-from-top-2">
                    <button 
                        onClick={createColumn}
                        className="w-full flex items-center gap-3 p-3 hover:bg-stone-50 rounded-lg text-left text-stone-700 font-bold"
                    >
                        <div className="bg-blue-100 p-1 rounded text-blue-600"><ListIcon size={18} /></div>
                        Nova Lista
                    </button>
                    <button 
                        onClick={createFloatingTask}
                        className="w-full flex items-center gap-3 p-3 hover:bg-stone-50 rounded-lg text-left text-stone-700 font-bold"
                    >
                        <div className="bg-yellow-100 p-1 rounded text-yellow-600"><StickyNote size={18} /></div>
                        Nova Nota
                    </button>
                </div>
            )}
        </div>
      </header>

      {/* Main Board */}
      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragOver={onDragOver}
        collisionDetection={rectIntersection}
      >
        <div className="flex flex-wrap items-start gap-8 w-full pb-20">
          <SortableContext items={columnsId} strategy={rectSortingStrategy}>
            {columns.map((col) => (
              <List
                key={col.id}
                column={col}
                tasks={tasks.filter((task) => task.columnId === col.id)}
                createTask={createTask}
                deleteColumn={deleteColumn}
                updateColumnTitle={updateColumnTitle}
                updateColumnColor={updateColumnColor}
                deleteTask={deleteTask}
                updateTaskColor={(id, color) => {
                     const t = tasks.find(t => t.id === id);
                     if(t) updateTaskFull({...t, color});
                }}
                updateTaskContent={(id, content) => {
                     const t = tasks.find(t => t.id === id);
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
                tasks={tasks.filter((task) => task.columnId === activeColumn.id)}
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
