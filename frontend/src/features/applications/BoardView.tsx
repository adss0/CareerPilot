// View: Kanban board. Drag a card (mouse, touch or keyboard) to another column to change status.
import {
  DndContext,
  pointerWithin,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";

import { COLUMNS, groupByStatus } from "./board";
import { STATUS_LABELS, scoreLabel } from "./labels";
import type { Application, ApplicationStatus } from "./types";

// Column width (w-60 = 240px) + gap (gap-3 = 12px): one arrow press moves one whole column.
const COLUMN_STEP = 252;

const columnJump: KeyboardCoordinateGetter = (event, { currentCoordinates }) => {
  switch (event.code) {
    case "ArrowRight":
      return { ...currentCoordinates, x: currentCoordinates.x + COLUMN_STEP };
    case "ArrowLeft":
      return { ...currentCoordinates, x: currentCoordinates.x - COLUMN_STEP };
    case "ArrowDown":
      return { ...currentCoordinates, y: currentCoordinates.y + 60 };
    case "ArrowUp":
      return { ...currentCoordinates, y: currentCoordinates.y - 60 };
  }
  return undefined;
};

// Drop where the pointer is; keyboard moves (no pointer) fall back to overlap.
const dropTarget: CollisionDetection = (args) => {
  const underPointer = pointerWithin(args);
  return underPointer.length ? underPointer : rectIntersection(args);
};

interface BoardViewProps {
  items: Application[];
  truncated: boolean;
  onMove: (id: number, status: ApplicationStatus) => void;
}

function Card({ application }: { application: Application }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: application.id,
  });
  return (
    <li
      ref={setNodeRef}
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
      className={cn(
        "bg-card flex gap-1 rounded-lg border p-2 text-sm shadow-xs",
        isDragging && "ring-primary relative z-10 opacity-90 shadow-lg ring-2",
      )}
    >
      <button
        type="button"
        aria-label={`Move ${application.company}. Press space, use the arrow keys, then space to drop.`}
        className="text-muted-foreground hover:text-foreground cursor-grab touch-none rounded px-0.5"
        {...listeners}
        {...attributes}
      >
        <GripVertical className="size-4" />
      </button>
      <Link to={`/applications/${application.id}`} className="min-w-0 flex-1 hover:underline">
        <span className="block truncate font-medium">{application.company}</span>
        <span className="text-muted-foreground block truncate">{application.role}</span>
        {application.match_score !== null && (
          <span className="text-muted-foreground block text-xs">
            Match {scoreLabel(application.match_score)}
          </span>
        )}
      </Link>
    </li>
  );
}

function Column({ status, items }: { status: ApplicationStatus; items: Application[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      ref={setNodeRef}
      aria-label={`${STATUS_LABELS[status]} column`}
      className={cn(
        "bg-muted/50 flex w-60 shrink-0 flex-col rounded-xl border p-2",
        isOver && "border-primary bg-accent",
      )}
    >
      <h2 className="flex items-center justify-between px-1 pb-2 text-sm font-medium">
        {STATUS_LABELS[status]}
        <span className="text-muted-foreground tabular-nums">{items.length}</span>
      </h2>
      <ul className="flex min-h-16 flex-col gap-2">
        {items.map((a) => (
          <Card key={a.id} application={a} />
        ))}
      </ul>
    </section>
  );
}

export function BoardView({ items, truncated, onMove }: BoardViewProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: columnJump }),
  );
  const groups = groupByStatus(items);

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) return;
    const application = items.find((a) => a.id === active.id);
    const target = over.id as ApplicationStatus;
    if (application && application.status !== target) onMove(application.id, target);
  };

  return (
    <div className="space-y-2">
      {truncated && (
        <p className="text-muted-foreground text-sm">
          Showing the 200 most recently updated jobs. Use search to find others.
        </p>
      )}
      <DndContext sensors={sensors} collisionDetection={dropTarget} onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {COLUMNS.map((status) => (
            <Column key={status} status={status} items={groups[status]} />
          ))}
        </div>
      </DndContext>
    </div>
  );
}
