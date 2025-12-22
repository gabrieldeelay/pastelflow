
import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlignLeft, Link } from 'lucide-react';
import { Task } from '../types';
import { COLORS } from '../constants';

interface Props {
  task: Task;
  onClick: () => void;
  isOverlay?: boolean;
}

const Card: React.FC<Props> = ({ task, onClick, isOverlay }) => {
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
  });

  const style = {
    transition,
    transform: CSS.Transform.toString(transform),
  };

  const colorClasses = COLORS[task.color] || COLORS.yellow;
  const hasDescription = task.description && task.description.length > 0;
  const hasAttachments = task.attachments && task.attachments.length > 0;

  if (isDragging && !isOverlay) {
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
      onClick={onClick}
      className={`
        relative
        group
        ${colorClasses}
        p-4
        min-h-[100px]
        flex
        flex-col
        text-left
        rounded-xl
        shadow-sm
        hover:shadow-md
        transition-all
        duration-200
        cursor-pointer
        border
        hover:-translate-y-1
        ${isOverlay ? 'shadow-2xl scale-[1.03] ring-2 ring-white/50 z-[100] rotate-1' : ''}
      `}
    >
      <div className="flex-grow w-full overflow-hidden">
          {/* Render HTML content safely */}
          <div 
            className="text-sm font-semibold leading-relaxed w-full break-words prose prose-sm prose-p:my-0 prose-headings:my-0 max-w-none"
            dangerouslySetInnerHTML={{ __html: task.content }}
          />
      </div>

      {/* Indicators */}
      {(hasDescription || hasAttachments) && (
        <div className="flex gap-2 mt-3 text-stone-500/60">
            {hasDescription && <AlignLeft size={14} />}
            {hasAttachments && <Link size={14} />}
        </div>
      )}
    </div>
  );
};

export default Card;
