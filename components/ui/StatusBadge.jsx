function StatusBadge({ status }) {
  const isPaid = status === "تم السداد";
  const className = isPaid ? "badge badgeSuccess" : "badge badgeWarning";
  return <span className={className}>{isPaid ? "Paid" : "Pending"}</span>;
}

export default StatusBadge;

