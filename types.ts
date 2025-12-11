export type Id = string | number;

export type PastelColor = 'pink' | 'blue' | 'green' | 'yellow' | 'purple' | 'orange';

export interface Task {
  id: Id;
  columnId: Id;
  content: string;
  color: PastelColor;
}

export interface Column {
  id: Id;
  title: string;
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