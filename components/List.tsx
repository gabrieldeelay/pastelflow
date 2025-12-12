
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, Trash2, MoreHorizontal, Palette } from 'lucide-react';
import { Column, Task, Id, PastelColor } from '../types';
import Card from './Card';
import { COLUMN_COLORS, COLOR_KEYS, COLOR_HEX } from '../constants';

interface Props {
  column: Column;
  tasks: Task[];
  deleteColumn: (id: Id) => void;
  updateColumnTitle: (id: Id, title: string) => void;
  updateColumnColor: (id: Id, color: PastelColor) => void;
  createTask: (columnId: Id) => void;
  onTaskClick: (task: Task) => void;
}

const List: React.FC<Props> = ({
  column,
  tasks,
  deleteColumn,
  updateColumnTitle,
  updateColumnColor,
  createTask,
  onTaskClick
}) => {
  const [editMode, setEditMode] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Local state for title to prevent realtime jitter while typing
  const [localTitle, setLocalTitle] = useState(column.title);

  // Sync local title when column updates from outside (Realtime)
  useEffect(() => {
    if (!editMode) {
        setLocalTitle(column.title);
    }
  }, [column.title, editMode]);

  const handleTitleCommit = () => {
      setEditMode(false);
      if (localTitle.trim() !== column.title) {
          updateColumnTitle(column.id, localTitle);
      }
  };

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

  // Click outside to close menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }
    if (showMenu) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu]);

  const columnColorClass = column.color ? COLUMN_COLORS[column.color] : 'bg-stone-100/50 border-stone-200/60';

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
      className={`
        w-[300px]
        h-fit
        min-h-[150px]
        rounded-2xl
        flex
        flex-col
        shadow-sm
        border
        backdrop-blur-sm
        transition-colors
        duration-300
        ${columnColorClass}
      `}
    >
      {/* List Header */}
      <div
        {...attributes}
        {...listeners}
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
        <div className="flex gap-2 items-center flex-1" onClick={() => setEditMode(true)}>
          {!editMode ? (
            <span className="text-lg px-2 truncate w-full cursor-text min-h-[28px] block">{column.title}</span>
          ) : (
            <input
              className="
                bg-white/50
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
              value={localTitle}
              onChange={(e) => setLocalTitle(e.target.value)}
              autoFocus
              onBlur={handleTitleCommit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTitleCommit();
              }}
            />
          )}
        </div>
        
        {/* Menu Button */}
        <div className="relative" ref={menuRef}>
            <button
            onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
            }}
            className="p-2 rounded-full text-stone-400 hover:text-stone-600 hover:bg-black/5 transition-colors"
            >
             <MoreHorizontal size={18} />
            </button>

            {/* Dropdown Menu */}
            {showMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-stone-100 p-2 z-20 animate-in fade-in zoom-in duration-200 cursor-default" onMouseDown={(e) => e.stopPropagation()}>
                    <div className="p-2">
                        <p className="text-xs font-bold text-stone-400 uppercase mb-2">Cor da Lista</p>
                        <div className="flex flex-wrap gap-1">
                            {COLOR_KEYS.map(k => (
                                <button
                                    key={k}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        updateColumnColor(column.id, k);
                                    }}
                                    className={`
                                        w-6 h-6 rounded-full border hover:scale-110 transition-transform
                                        ${column.color === k ? 'border-stone-400 scale-110 shadow-sm' : 'border-stone-200'}
                                    `}
                                    style={{ backgroundColor: COLOR_HEX[k] }}
                                />
                            ))}
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    updateColumnColor(column.id, undefined as any);
                                }} 
                                className="w-6 h-6 rounded-full border border-stone-200 bg-stone-50 hover:scale-110 flex items-center justify-center"
                                title="Padrão"
                            >
                                <div className="w-3 h-0.5 bg-stone-400 -rotate-45"></div>
                            </button>
                        </div>
                    </div>
                    <div className="h-px bg-stone-100 my-1" />
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            deleteColumn(column.id);
                        }}
                        className="w-full text-left flex items-center gap-2 p-2 text-red-500 hover:bg-red-50 rounded-lg text-sm"
                    >
                        <Trash2 size={14} /> Excluir Lista
                    </button>
                </div>
            )}
        </div>
      </div>

      {/* Tasks Container */}
      <div className="flex-grow flex flex-col gap-3 p-3 overflow-y-auto overflow-x-hidden min-h-[50px]">
        <SortableContext items={taskIds}>
          {tasks.map((task) => (
            <Card
              key={task.id}
              task={task}
              onClick={() => onTaskClick(task)}
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
            border-stone-400/20
            rounded-xl
            p-3
            w-full
            hover:bg-white/40
            hover:border-stone-400/40
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
