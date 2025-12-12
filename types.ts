
export type Id = string | number;

export type PastelColor = 'pink' | 'blue' | 'green' | 'yellow' | 'purple' | 'orange' | 'rose' | 'sky' | 'teal' | 'indigo' | 'slate';

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: 'link' | 'file';
}

export interface Task {
  id: Id;
  columnId: Id;
  content: string;
  description?: string;
  color: PastelColor;
  attachments?: Attachment[];
  isChecklist?: boolean; // Toggles between plain text description or checkbox mode
  checkedItems?: string[]; // IDs or indices of checked lines if using checklist
}

export interface Column {
  id: Id;
  title: string;
  color?: PastelColor | null;
  position: number; // Mandatory for ordering
}

export interface Profile {
  id: string;
  name: string;
  pin?: string;
  avatar: string;
}

export interface DragStartEvent {
  active: { id: Id; data: { current: unknown } };
}

export interface DragOverEvent {
  active: { id: Id; data: { current: unknown } };
  over: { id: Id; data: { current: unknown } } | null;
}

export interface DragEndEvent {
  active: { id: Id; data: { current: unknown } };
  over: { id: Id; data: { current: unknown } } | null;
}
