function StatusBadge({ status }) {
  const normalizedStatus = (status || "").toString().trim().toLowerCase();
  const isPaid =
    normalizedStatus === "تم السداد" ||
    normalizedStatus === "paid" ||
    normalizedStatus === "done" ||
    normalizedStatus === "completed";
  const className = isPaid ? "badge badgeSuccess" : "badge badgeWarning";
  return <span className={className}>{isPaid ? "تم السداد" : "لم يتم السداد"}</span>;
}

export default StatusBadge;

