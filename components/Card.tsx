import React, { useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Trash2, Palette, GripVertical, Check } from 'lucide-react';
import { Task, PastelColor } from '../types';
import { COLORS, COLOR_KEYS, COLOR_HEX } from '../constants';

interface Props {
  task: Task;
  deleteTask: (id: string | number) => void;
  updateTaskColor: (id: string | number, color: PastelColor) => void;
  updateTaskContent: (id: string | number, content: string) => void;
}

const Card: React.FC<Props> = ({ task, deleteTask, updateTaskColor, updateTaskContent }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: {
      type: 'Task',
      task,
    },
    disabled: isEditing || showColorPicker,
  });

  const style = {
    transition,
    transform: CSS.Transform.toString(transform),
    zIndex: isDragging ? 100 : showColorPicker ? 50 : 1,
  };

  const colorClasses = COLORS[task.color] || COLORS.yellow;

  // Click outside to close picker
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowColorPicker(false);
      }
    }
    if (showColorPicker) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showColorPicker]);

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`
          opacity-50
          bg-stone-50
          h-[120px] 
          min-h-[120px]
          items-center 
          flex 
          text-left 
          rounded-xl 
          border-2 
          border-stone-200
          border-dashed
          cursor-grabbing
          relative
        `}
      />
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
         setIsHovered(false);
      }}
      className={`
        relative
        group
        ${colorClasses}
        p-4
        min-h-[120px]
        items-start
        flex
        flex-col
        text-left
        rounded-xl
        shadow-sm
        hover:shadow-md
        transition-all
        duration-200
        cursor-grab
        active:cursor-grabbing
        border
      `}
    >
      {/* Drag Handle Icon - subtle visual cue */}
      <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-30 transition-opacity">
         <GripVertical size={14} />
      </div>

      <div className="flex-grow w-full mt-1">
        {!isEditing ? (
          <p
            onClick={() => setIsEditing(true)}
            className="whitespace-pre-wrap text-sm font-semibold leading-relaxed w-full h-full cursor-text min-h-[60px]"
          >
            {task.content}
          </p>
        ) : (
          <textarea
            className="w-full h-full bg-transparent resize-none border-none focus:ring-0 text-sm font-semibold leading-relaxed p-0 outline-none placeholder-gray-500/50"
            value={task.content}
            autoFocus
            placeholder="Digite algo..."
            onBlur={() => setIsEditing(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                setIsEditing(false);
              }
            }}
            onChange={(e) => updateTaskContent(task.id, e.target.value)}
          />
        )}
      </div>

      {/* Action Buttons */}
      <div className={`
        flex items-center justify-end gap-2 w-full mt-3
        transition-opacity duration-200
        ${isHovered || isEditing || showColorPicker ? 'opacity-100' : 'opacity-0 md:opacity-0'} 
      `}>
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowColorPicker(!showColorPicker);
            }}
            className="p-1.5 rounded-full bg-white/40 hover:bg-white/70 text-gray-600 transition-colors shadow-sm ring-1 ring-black/5"
            title="Mudar cor"
          >
            <Palette size={14} />
          </button>

          {/* Color Picker Popover */}
          {showColorPicker && (
            <div 
              ref={pickerRef}
              className="absolute right-0 bottom-full mb-2 p-2 bg-white rounded-xl shadow-xl border border-stone-100 flex gap-1 z-50 animate-in fade-in zoom-in duration-200"
              style={{ minWidth: '160px' }}
              onPointerDown={(e) => e.stopPropagation()} // Prevent drag start from picker
            >
              {COLOR_KEYS.map((colorKey) => (
                <button
                  key={colorKey}
                  onClick={(e) => {
                    e.stopPropagation();
                    updateTaskColor(task.id, colorKey);
                    setShowColorPicker(false);
                  }}
                  className={`
                    w-6 h-6 rounded-full border border-stone-200 transition-transform hover:scale-110 flex items-center justify-center
                    ${task.color === colorKey ? 'ring-2 ring-offset-1 ring-stone-300' : ''}
                  `}
                  style={{ backgroundColor: COLOR_HEX[colorKey] }}
                >
                   {task.color === colorKey && <Check size={10} className="text-stone-600" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            deleteTask(task.id);
          }}
          className="p-1.5 rounded-full bg-white/40 hover:bg-red-50 hover:text-red-500 text-gray-600 transition-colors shadow-sm ring-1 ring-black/5"
          title="Excluir nota"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
};

export default Card;
