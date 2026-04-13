import styles from "./ui.module.css";

function ConfirmDialog({
  open,
  title = "تأكيد العملية",
  description = "هل أنت متأكد من تنفيذ هذا الإجراء؟",
  confirmText = "تأكيد",
  cancelText = "إلغاء",
  danger = false,
  onConfirm,
  onClose,
}) {
  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p>{description}</p>
        <div className={styles.actions}>
          <button className="btnGhost" onClick={onClose}>{cancelText}</button>
          <button className={danger ? "btnDanger" : "btnPrimary"} onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;

