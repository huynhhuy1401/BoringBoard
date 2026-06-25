import React, { useState, useRef, useEffect } from 'react';

interface SplitterProps {
  direction: 'horizontal' | 'vertical';
  initialSize: number; // size in pixels
  minSize: number;
  maxSize: number;
  primaryPanel: 'first' | 'second';
  firstPanel: React.ReactNode;
  secondPanel: React.ReactNode;
  className?: string;
}

export const Splitter: React.FC<SplitterProps> = ({
  direction,
  initialSize,
  minSize,
  maxSize,
  primaryPanel,
  firstPanel,
  secondPanel,
  className = '',
}) => {
  const [size, setSize] = useState(initialSize);
  const containerRef = useRef<HTMLDivElement>(null);
  const isResizingRef = useRef(false);

  useEffect(() => {
    setSize(initialSize);
  }, [initialSize]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizingRef.current || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    let newSize = 0;

    if (direction === 'horizontal') {
      const offset = e.clientX - containerRect.left;
      newSize = primaryPanel === 'first' ? offset : containerRect.width - offset;
    } else {
      const offset = e.clientY - containerRect.top;
      newSize = primaryPanel === 'first' ? offset : containerRect.height - offset;
    }

    if (newSize >= minSize && newSize <= maxSize) {
      setSize(newSize);
    }
  };

  const handleMouseUp = () => {
    isResizingRef.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  const isHoriz = direction === 'horizontal';
  const sizeStyle = isHoriz
    ? { width: `${size}px`, minWidth: `${size}px`, maxWidth: `${size}px` }
    : { height: `${size}px`, minHeight: `${size}px`, maxHeight: `${size}px` };

  const firstStyle = primaryPanel === 'first' ? sizeStyle : { flexGrow: 1, flexBasis: 0, minWidth: 0, minHeight: 0 };
  const secondStyle = primaryPanel === 'second' ? sizeStyle : { flexGrow: 1, flexBasis: 0, minWidth: 0, minHeight: 0 };

  return (
    <div
      ref={containerRef}
      className={`flex grow ${isHoriz ? 'flex-row' : 'flex-col'} ${className}`}
      style={{ overflow: 'hidden', height: '100%', width: '100%' }}
    >
      <div style={{ ...firstStyle, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {firstPanel}
      </div>
      <div
        className={isHoriz ? 'resizer-h' : 'resizer-v'}
        onMouseDown={handleMouseDown}
        style={{
          flexShrink: 0,
          background: 'var(--border-color)',
          zIndex: 10,
        }}
      />
      <div style={{ ...secondStyle, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {secondPanel}
      </div>
    </div>
  );
};
export default Splitter;
