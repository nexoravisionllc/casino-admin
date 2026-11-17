import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon } from './Icons.jsx';

/**
 * Dialog with header / body / footer. Escape or a backdrop click closes it;
 * page scroll is locked while open.
 */
export default function Modal({ title, subtitle, icon: Icon, tone, onClose, children, footer, size, onSubmit }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const Body = onSubmit ? 'form' : 'div';
  return createPortal(
    <div className="modal-overlay" onMouseDown={onClose}>
      <Body
        className={`modal ${size ? `modal--${size}` : ''}`}
        role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={onSubmit ? (e) => { e.preventDefault(); onSubmit(); } : undefined}
      >
        <div className="modal__head">
          {Icon && <span className={`modal__ico ${tone ? `modal__ico--${tone}` : ''}`}><Icon width={19} height={19} /></span>}
          <div className="modal__titles">
            <h3 className="modal__title">{title}</h3>
            {subtitle && <p className="modal__sub">{subtitle}</p>}
          </div>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Close">
            <CloseIcon width={18} height={18} />
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__foot">{footer}</div>}
      </Body>
    </div>,
    document.body
  );
}
