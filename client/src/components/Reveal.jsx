import { useEffect, useRef, useState } from 'react';

export default function Reveal({
  children,
  delay = 0,
  as: Tag = 'div',
  className = '',
  style,
  ...rest
}) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const mergedStyle = { ...(style || {}), ...(delay ? { transitionDelay: `${delay}ms` } : {}) };

  return (
    <Tag
      ref={ref}
      className={`reveal ${visible ? 'is-visible' : ''} ${className}`}
      style={mergedStyle}
      {...rest}
    >
      {children}
    </Tag>
  );
}
