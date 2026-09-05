'use client';

import { useState } from 'react';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

type Option = { id: string; text: string };

function SortableRow({
  option,
  position,
  onMove,
  isFirst,
  isLast,
  disabled,
}: {
  option: Option;
  position: number;
  onMove: (direction: -1 | 1) => void;
  isFirst: boolean;
  isLast: boolean;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: option.id, disabled });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-2 rounded-lg border bg-card px-3 py-3',
        isDragging ? 'border-primary shadow-md' : 'border-border',
      )}
    >
      <span className="w-5 shrink-0 text-center text-sm font-semibold tabular-nums text-muted-foreground">
        {position}
      </span>

      <button
        type="button"
        className={cn(
          'shrink-0 touch-none rounded p-1 text-muted-foreground',
          !disabled && 'cursor-grab active:cursor-grabbing hover:text-foreground',
        )}
        aria-label={`Reorder ${option.text}`}
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>

      <span className="min-w-0 flex-1 text-[15px]">{option.text}</span>

      {/* Buttons alongside dragging: touch drag is fiddly, and this keeps the
          control reachable by keyboard and screen reader users. */}
      <span className="flex shrink-0 flex-col">
        <button
          type="button"
          onClick={() => onMove(-1)}
          disabled={isFirst || disabled}
          aria-label={`Move ${option.text} up`}
          className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
        >
          <ChevronUp className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={isLast || disabled}
          aria-label={`Move ${option.text} down`}
          className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
        >
          <ChevronDown className="size-4" />
        </button>
      </span>
    </li>
  );
}

export function RankingAnswer({
  options,
  myOrder,
  pending,
  onSubmit,
}: {
  options: Option[];
  /** A previously submitted order, if any. */
  myOrder: string[];
  pending: boolean;
  onSubmit: (optionIds: string[]) => void;
}) {
  const initial =
    myOrder.length === options.length
      ? myOrder
          .map((id) => options.find((option) => option.id === id))
          .filter((option): option is Option => Boolean(option))
      : options;

  const [order, setOrder] = useState<Option[]>(initial);
  const submitted = myOrder.length > 0;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setOrder((current) => {
      const from = current.findIndex((option) => option.id === active.id);
      const to = current.findIndex((option) => option.id === over.id);
      return arrayMove(current, from, to);
    });
  }

  function move(index: number, direction: -1 | 1) {
    setOrder((current) => arrayMove(current, index, index + direction));
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Drag to order, or use the arrows. Top is first.
      </p>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={order.map((option) => option.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="space-y-2">
            {order.map((option, index) => (
              <SortableRow
                key={option.id}
                option={option}
                position={index + 1}
                isFirst={index === 0}
                isLast={index === order.length - 1}
                disabled={pending}
                onMove={(direction) => move(index, direction)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <Button
        className="w-full"
        size="lg"
        loading={pending}
        onClick={() => onSubmit(order.map((option) => option.id))}
      >
        {submitted ? 'Update my ranking' : 'Submit ranking'}
      </Button>
    </div>
  );
}
