import React, { useMemo, useState } from 'react';
import { SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, Trash2, MoreHorizontal } from 'lucide-react';
import { Column, Task, Id } from '../types';
import Card from './Card';

interface Props {
  column: Column;
  tasks: Task[];
  deleteColumn: (id: Id) => void;
  updateColumnTitle: (id: Id, title: string) => void;
  createTask: (columnId: Id) => void;
  deleteTask: (id: Id) => void;
  updateTaskColor: (id: Id, color: any) => void;
  updateTaskContent: (id: Id, content: string) => void;
}

const List: React.FC<Props> = ({
  column,
  tasks,
  deleteColumn,
  updateColumnTitle,
  createTask,
  deleteTask,
  updateTaskColor,
  updateTaskContent,
}) => {
  const [editMode, setEditMode] = useState(false);

  const taskIds = useMemo(() => tasks.map((task) => task.id), [tasks]);

  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: column.id,
    data: {
      type: 'Column',
      column,
    },
    disabled: editMode,
  });

  const style = {
    transition,
    transform: CSS.Transform.toString(transform),
  };

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="
          w-[300px]
          h-[400px]
          max-h-[500px]
          rounded-2xl
          flex
          flex-col
          bg-stone-100
          border-2
          border-stone-300
          border-dashed
          opacity-60
        "
      />
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="
        w-[300px]
        h-fit
        min-h-[150px]
        bg-white/60
        backdrop-blur-sm
        rounded-2xl
        flex
        flex-col
        shadow-sm
        border
        border-stone-200/60
      "
    >
      {/* List Header */}
      <div
        {...attributes}
        {...listeners}
        onClick={() => setEditMode(true)}
        className="
          p-4
          font-bold
          text-stone-700
          flex
          items-center
          justify-between
          cursor-grab
          active:cursor-grabbing
          rounded-t-2xl
        "
      >
        <div className="flex gap-2 items-center flex-1">
          {!editMode ? (
            <span className="text-lg px-2 truncate w-full">{column.title}</span>
          ) : (
            <input
              className="
                bg-white
                focus:ring-2
                focus:ring-stone-200
                border
                border-stone-200
                rounded
                outline-none
                px-2
                py-1
                text-lg
                w-full
                text-stone-700
              "
              value={column.title}
              onChange={(e) => updateColumnTitle(column.id, e.target.value)}
              autoFocus
              onBlur={() => setEditMode(false)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                setEditMode(false);
              }}
            />
          )}
        </div>
        
        {/* Delete Column Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            deleteColumn(column.id);
          }}
          className="
            ml-2
            p-2
            rounded-full
            text-stone-400
            hover:text-red-500
            hover:bg-red-50
            transition-colors
          "
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Tasks Container */}
      <div className="flex-grow flex flex-col gap-3 p-3 overflow-y-auto overflow-x-hidden min-h-[50px]">
        <SortableContext items={taskIds}>
          {tasks.map((task) => (
            <Card
              key={task.id}
              task={task}
              deleteTask={deleteTask}
              updateTaskColor={updateTaskColor}
              updateTaskContent={updateTaskContent}
            />
          ))}
        </SortableContext>
      </div>

      {/* Add Task Footer */}
      <div className="p-3 pt-0">
        <button
          className="
            flex
            gap-2
            items-center
            justify-center
            border-2
            border-dashed
            border-stone-200
            rounded-xl
            p-3
            w-full
            hover:bg-stone-50
            hover:border-stone-300
            text-stone-500
            hover:text-stone-700
            transition-all
            font-medium
          "
          onClick={() => createTask(column.id)}
        >
          <Plus size={18} />
          <span>Nova nota</span>
        </button>
      </div>
    </div>
  );
};

export default List;
