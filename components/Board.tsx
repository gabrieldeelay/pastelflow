
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

interface Props {
  currentProfile: Profile;
  onSwitchProfile: () => void;
}

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

  // Load Data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      if (!isSupabaseConfigured()) {
         const key = `pastel_data_${currentProfile.id}`;
         const saved = localStorage.getItem(key);
         if (saved) {
             const data = JSON.parse(saved);
             setColumns(data.columns || []);
             setTasks(data.tasks || []);
         } else {
             const defaultCols = [
                { id: `todo_${currentProfile.id}`, title: 'A Fazer' },
                { id: `doing_${currentProfile.id}`, title: 'Em Andamento' },
                { id: `done_${currentProfile.id}`, title: 'Concluído' },
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
        let tasksData: any[] = [];
        if (colsData && colsData.length > 0) {
            const { data, error: tasksError } = await supabase
              .from('tasks')
              .select('*')
              .in('column_id', colsData.map(c => c.id));
            
            if (tasksError) throw tasksError;
            if (data) tasksData = data;
        }

        // Fetch All Profiles (for sharing)
        const { data: profilesData } = await supabase.from('profiles').select('*');
        if (profilesData) setProfiles(profilesData);

        if (colsData && colsData.length > 0) {
          setColumns(colsData);
          setTasks(tasksData || []);
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
        alert(`Erro ao carregar dados: ${error.message || 'Erro desconhecido'}`);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentProfile.id]);

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
      
      // We only use this for reordering/batch updates now.
      
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

      const tasksToSave = newTasks.map((t, idx) => ({
          id: t.id,
          column_id: t.columnId,
          content: t.content,
          description: t.description,
          // Removed attachments and is_checklist from persistData to align with DB schema limits
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
    // Fallback UUID v4 generator for compatibility
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
  };

  const createColumn = async () => {
    setShowAddMenu(false);
    
    const tempTitle = `Nova Lista`;
    const tempId = generateTempId();

    // Optimistic Update
    const optimisticCol: Column = { id: tempId, title: tempTitle, color: 'blue' };
    setColumns([...columns, optimisticCol]);

    if (isSupabaseConfigured()) {
        const { data, error } = await supabase.from('columns').insert({
            id: tempId, // Explicitly sending ID
            profile_id: currentProfile.id,
            title: tempTitle,
            position: columns.length, // Append to end
            color: 'blue' // Provide default color
        }).select().single();

        if (error) {
            console.error("Error creating column:", JSON.stringify(error, null, 2));
            alert(`Erro ao salvar lista: ${error.message}`);
            setColumns(prev => prev.filter(c => c.id !== tempId)); // Revert
        } else if (data && data.id !== tempId) {
            // Ensure state matches DB if DB generated something else (unlikely with explicit ID)
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
    const updatedCols = columns.map((col) => {
      if (col.id !== id) return col;
      return { ...col, title };
    });
    setColumns(updatedCols);
    if(isSupabaseConfigured()) {
        await supabase.from('columns').update({ title }).eq('id', id);
    } else {
        persistData(updatedCols, tasks);
    }
  };

  const updateColumnColor = async (id: Id, color: PastelColor) => {
    const updatedCols = columns.map((col) => {
      if (col.id !== id) return col;
      return { ...col, color };
    });
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
    
    // Optimistic Update
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
        // Calculate position (last in column)
        const columnTasks = tasks.filter(t => t.columnId === columnId);
        
        // CRITICAL FIX: Send explicit values for ALL fields to avoid Not Null constraint violations
        // AND REMOVE columns that don't exist in DB (description, attachments, is_checklist) to avoid schema errors
        const insertPayload = {
            id: tempId, 
            column_id: columnId,
            content: newTask.content,
            color: newTask.color,
            position: columnTasks.length,
            // description: '', // REMOVED - Column does not exist
            // is_checklist: false, // REMOVED
            // attachments: [] // REMOVED
        };

        const { data, error } = await supabase.from('tasks').insert(insertPayload).select().single();

        if (error) {
            console.error("Error creating task:", JSON.stringify(error, null, 2));
            alert(`Erro ao salvar nota na nuvem: ${error.message}. Tente novamente.`);
            setTasks(prev => prev.filter(t => t.id !== tempId)); // Revert
        } else if (data && data.id !== tempId) {
            setTasks(prev => prev.map(t => t.id === tempId ? { ...t, id: data.id } : t));
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
    // Add to first column
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
      setTasks(prev => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
      
      if (isSupabaseConfigured()) {
         try {
             // Safe Upsert
             await supabase.from('tasks').update({
                content: updatedTask.content,
                // description: updatedTask.description || '', // REMOVED - Column does not exist
                // is_checklist: updatedTask.isChecklist || false, // REMOVED
                // attachments: updatedTask.attachments || [], // REMOVED
                color: updatedTask.color,
                // We do NOT update position here to avoid jumping cards during edit
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

    // Dropping a Task over another Task
    if (isActiveTask && isOverTask) {
      setTasks((tasks) => {
        const activeIndex = tasks.findIndex((t) => t.id === activeId);
        const overIndex = tasks.findIndex((t) => t.id === overId);

        let newTasks = [...tasks];
        // If in different lists, update columnId immediately for visual feedback
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

    // Dropping a Task over a Column
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
                src={currentProfile.avatar} 
                className="w-12 h-12 rounded-full border-2 border-white shadow-md cursor-pointer" 
                alt="Avatar"
            />
          </div>
          <div>
            <h1 className="text-4xl font-black text-stone-700 tracking-tight leading-none">
              Pastel<span className="text-red-300">Flow</span>.
            </h1>
          </div>
          
          {/* Profile Switcher / Logout */}
          <button 
            onClick={onSwitchProfile}
            className="ml-2 p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-200/50 rounded-full transition-colors"
            title="Trocar Perfil"
          >
            <LogOut size={20} />
          </button>
        </div>
        
        {/* ADD BUTTON WITH DROPDOWN */}
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

      {/* Main Board Area */}
      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragOver={onDragOver}
        collisionDetection={rectIntersection} // Better for 2D wrapping layouts
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

        {/* Drag Overlay for smooth visuals */}
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
