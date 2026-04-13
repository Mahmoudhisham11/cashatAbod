import styles from "./ui.module.css";

function SkeletonRows({ rows = 4 }) {
  return (
    <div className={styles.skeletonWrap}>
      {Array.from({ length: rows }).map((_, idx) => (
        <div className={styles.skeletonRow} key={idx} />
      ))}
    </div>
  );
}

export default SkeletonRows;

