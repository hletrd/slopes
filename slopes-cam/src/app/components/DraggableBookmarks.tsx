'use client';

import { useEffect, useRef } from 'react';

interface DraggableBookmarksProps {
  onReorder: (newOrder: number[]) => void;
}

const DraggableBookmarks: React.FC<DraggableBookmarksProps> = ({ onReorder }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = document.getElementById('favorites-grid');
    if (!container) return;

    containerRef.current = container as HTMLDivElement;

    let draggingElement: HTMLElement | null = null;
    let initialIndex: number = -1;

    const getBookmarkCards = () => {
      return Array.from(container.querySelectorAll('.favorite-card'));
    };

    const getCardIndex = (card: HTMLElement) => {
      const index = card.getAttribute('data-index');
      return index ? parseInt(index, 10) : -1;
    };

    const getCardAtPosition = (y: number) => {
      const cards = getBookmarkCards();
      for (const card of cards) {
        const rect = card.getBoundingClientRect();
        if (y >= rect.top && y <= rect.bottom) {
          return card as HTMLElement;
        }
      }
      return null;
    };

    const dragStart = (e: MouseEvent) => {
      if (!(e.target instanceof HTMLElement)) return;

      // Find the closest favorite-card parent
      const card = e.target.closest('.favorite-card') as HTMLElement;
      if (!card) return;

      // Only handle drag if it started from handle or header
      if (!e.target.closest('.drag-handle') && !e.target.closest('.favorite-header')) return;

      e.preventDefault();

      draggingElement = card;
      initialIndex = getCardIndex(card);

      // Apply dragging styles
      card.classList.add('dragging');

      // Capture mouse position
      const startY = e.clientY;
      const startTop = card.offsetTop;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!draggingElement) return;

        // Calculate how far we've moved
        const offsetY = moveEvent.clientY - startY;

        // Move the card with the mouse
        draggingElement.style.position = 'relative';
        draggingElement.style.top = `${offsetY}px`;
        draggingElement.style.zIndex = '10';

        // Get the card we're hovering over
        const targetCard = getCardAtPosition(moveEvent.clientY);

        // Reset all cards styles first
        getBookmarkCards().forEach(c => {
          if (c !== draggingElement) {
            (c as HTMLElement).classList.remove('drag-over');
          }
        });

        // Apply drag-over style to the target card
        if (targetCard && targetCard !== draggingElement) {
          targetCard.classList.add('drag-over');
        }
      };

      const handleMouseUp = (upEvent: MouseEvent) => {
        if (!draggingElement) return;

        // Remove dragging styles
        draggingElement.classList.remove('dragging');
        draggingElement.style.position = '';
        draggingElement.style.top = '';
        draggingElement.style.zIndex = '';

        // Get the drop target
        const targetCard = getCardAtPosition(upEvent.clientY);

        if (targetCard && targetCard !== draggingElement) {
          const targetIndex = getCardIndex(targetCard);

          // Calculate new order
          const cards = getBookmarkCards();
          const newOrder = Array.from(cards).map(c => getCardIndex(c as HTMLElement));

          // Remove the dragging element from its position
          newOrder.splice(initialIndex, 1);

          // Insert it at the target position
          newOrder.splice(targetIndex, 0, initialIndex);

          // Trigger reordering
          onReorder(newOrder);
        }

        // Reset all cards styles
        getBookmarkCards().forEach(c => {
          (c as HTMLElement).classList.remove('drag-over');
        });

        // Clean up
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        draggingElement = null;
        initialIndex = -1;
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    };

    // Add mouse events for desktop
    container.addEventListener('mousedown', dragStart);

    return () => {
      container.removeEventListener('mousedown', dragStart);
    };
  }, [onReorder]);

  return null; // This is a behavior component, it doesn't render anything
};

export default DraggableBookmarks;