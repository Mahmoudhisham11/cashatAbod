import styles from "./ui.module.css";

function EmptyState({ title = "لا يوجد بيانات", description = "ابدأ بإضافة أول عنصر." }) {
  return (
    <div className={styles.emptyState}>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

export default EmptyState;

