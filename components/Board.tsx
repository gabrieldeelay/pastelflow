import React, { useState, useMemo, useEffect } from 'react';
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
import { Plus } from 'lucide-react';
import { Column, Task, Id, PastelColor, Profile } from '../types';
import List from './List';
import Card from './Card';
import { createPortal } from 'react-dom';
import { PLACEHOLDER_TEXTS, COLORS } from '../constants';
import { supabase, isSupabaseConfigured } from '../supabaseClient';

interface Props {
  currentProfile: Profile;
}

const Board: React.FC<Props> = ({ currentProfile }) => {
  const [columns, setColumns] = useState<Column[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeColumn, setActiveColumn] = useState<Column | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

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
         // Local Storage Mock
         const key = `pastel_data_${currentProfile.id}`;
         const saved = localStorage.getItem(key);
         if (saved) {
             const data = JSON.parse(saved);
             setColumns(data.columns);
             setTasks(data.tasks);
         } else {
             // Defaults
             const defaultCols = [
                { id: 'todo', title: 'A Fazer' },
                { id: 'doing', title: 'Em Andamento' },
                { id: 'done', title: 'Concluído' },
             ];
             setColumns(defaultCols);
             setTasks([]);
         }
         setLoading(false);
         return;
      }

      const { data: colsData } = await supabase
        .from('columns')
        .select('*')
        .eq('profile_id', currentProfile.id)
        .order('position');
      
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('*')
        .in('column_id', colsData?.map(c => c.id) || []);

      if (colsData && colsData.length > 0) {
        setColumns(colsData);
        setTasks(tasksData || []);
      } else {
         // Init default cols if empty
         const defaultCols = [
            { id: crypto.randomUUID(), profile_id: currentProfile.id, title: 'A Fazer', position: 0 },
            { id: crypto.randomUUID(), profile_id: currentProfile.id, title: 'Em Andamento', position: 1 },
            { id: crypto.randomUUID(), profile_id: currentProfile.id, title: 'Concluído', position: 2 },
         ];
         // Optimistic
         setColumns(defaultCols as any); 
         // Save to DB
         await supabase.from('columns').insert(defaultCols);
      }
      setLoading(false);
    };

    fetchData();
  }, [currentProfile.id]);

  // Sync Data Helper
  const persistData = async (newColumns: Column[], newTasks: Task[]) => {
      if (!isSupabaseConfigured()) {
          const key = `pastel_data_${currentProfile.id}`;
          localStorage.setItem(key, JSON.stringify({ columns: newColumns, tasks: newTasks }));
          return;
      }

      // Simplified persistence: Upsert relevant items
      // In a production app, you'd optimize this to only update changed items
      // For this demo, we assume the DND interactions are infrequent enough or we just fire and forget
      
      // Upsert Columns (for position updates)
      const colsToSave = newColumns.map((c, idx) => ({ 
          id: c.id, 
          title: c.title, 
          position: idx, 
          profile_id: currentProfile.id 
      }));
      await supabase.from('columns').upsert(colsToSave);

      // Upsert Tasks (for position/col updates)
      const tasksToSave = newTasks.map((t, idx) => ({
          id: t.id,
          column_id: t.columnId,
          content: t.content,
          color: t.color,
          position: idx 
      }));
      // We limit upsert to changed ones ideally, but here we just verify integrity
      if (tasksToSave.length > 0) {
         await supabase.from('tasks').upsert(tasksToSave);
      }
  };


  const generateId = () => isSupabaseConfigured() ? crypto.randomUUID() : Math.floor(Math.random() * 100001).toString();

  const createColumn = async () => {
    const newCol = {
      id: generateId(),
      title: `Nova Lista ${columns.length + 1}`,
    };
    const updatedCols = [...columns, newCol];
    setColumns(updatedCols);
    
    if (isSupabaseConfigured()) {
        await supabase.from('columns').insert({
            id: newCol.id,
            profile_id: currentProfile.id,
            title: newCol.title,
            position: updatedCols.length - 1
        });
    } else {
        persistData(updatedCols, tasks);
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
    
    // Debounce save or just save on blur? React state is instant.
    // We'll update DB here (fire & forget)
    if(isSupabaseConfigured()) {
        await supabase.from('columns').update({ title }).eq('id', id);
    } else {
        persistData(updatedCols, tasks);
    }
  };

  const createTask = async (columnId: Id) => {
    const randomText = PLACEHOLDER_TEXTS[Math.floor(Math.random() * PLACEHOLDER_TEXTS.length)];
    const newTask: Task = {
      id: generateId(),
      columnId,
      content: randomText,
      color: 'yellow',
    };
    const updatedTasks = [...tasks, newTask];
    setTasks(updatedTasks);

    if (isSupabaseConfigured()) {
        await supabase.from('tasks').insert({
            id: newTask.id,
            column_id: columnId,
            content: newTask.content,
            color: newTask.color,
            position: updatedTasks.length
        });
    } else {
        persistData(columns, updatedTasks);
    }
  };

  const deleteTask = async (id: Id) => {
    const updatedTasks = tasks.filter((task) => task.id !== id);
    setTasks(updatedTasks);
    if(isSupabaseConfigured()) {
        await supabase.from('tasks').delete().eq('id', id);
    } else {
        persistData(columns, updatedTasks);
    }
  };

  const updateTaskContent = async (id: Id, content: string) => {
    const updatedTasks = tasks.map((task) => {
      if (task.id !== id) return task;
      return { ...task, content };
    });
    setTasks(updatedTasks);
    if(isSupabaseConfigured()) {
        await supabase.from('tasks').update({ content }).eq('id', id);
    } else {
        persistData(columns, updatedTasks);
    }
  };

  const updateTaskColor = async (id: Id, color: PastelColor) => {
    const updatedTasks = tasks.map((task) => {
      if (task.id !== id) return task;
      return { ...task, color };
    });
    setTasks(updatedTasks);
    if(isSupabaseConfigured()) {
        await supabase.from('tasks').update({ color }).eq('id', id);
    } else {
        persistData(columns, updatedTasks);
    }
  };

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
      {/* Header */}
      <header className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center w-full mb-4">
        <div className="flex items-center gap-4">
          <img src={currentProfile.avatar} className="w-12 h-12 rounded-full border-2 border-white shadow-md" alt="Avatar"/>
          <div>
            <h1 className="text-4xl font-black text-stone-700 tracking-tight">
              Pastel<span className="text-red-300">Flow</span>.
            </h1>
          </div>
        </div>
        <button
          onClick={createColumn}
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
          Nova Lista
        </button>
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
                deleteTask={deleteTask}
                updateTaskColor={updateTaskColor}
                updateTaskContent={updateTaskContent}
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
                deleteTask={deleteTask}
                updateTaskColor={updateTaskColor}
                updateTaskContent={updateTaskContent}
              />
            )}
            {activeTask && (
              <Card
                task={activeTask}
                deleteTask={deleteTask}
                updateTaskColor={updateTaskColor}
                updateTaskContent={updateTaskContent}
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