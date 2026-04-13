'use client';
import styles from "./styles.module.css";
import mainListStyles from "../../components/Main/styles.module.css";
import Link from "next/link";
import { useEffect, useState } from "react";
import { MdOutlineKeyboardArrowLeft } from "react-icons/md";
import { FaTrashAlt } from "react-icons/fa";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  query,
  where,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { useRouter } from "next/navigation";

// مكتبة Excel
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import EmptyState from "../../components/ui/EmptyState";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { useToast } from "../../components/ui/ToastProvider";

function Reports() {
  const router = useRouter();
  const [reports, setReports] = useState([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [phoneSearch, setPhoneSearch] = useState('');
  const [operationFilter, setOperationFilter] = useState('');
  const [email, setEmail] = useState('');
  const [total, setTotal] = useState(0);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cashBalance, setCashBalance] = useState(0);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [confirmDeleteReportId, setConfirmDeleteReportId] = useState(null);
  const [infoDialog, setInfoDialog] = useState({ open: false, title: "", description: "" });
  const { toast } = useToast();

  useEffect(() => {
    const checkLockAndSetEmail = async () => {
      const userEmail = localStorage.getItem("email");
      if (!userEmail) {
        router.push('/');
        return;
      }

      setEmail(userEmail);

      const q = query(collection(db, "users"), where("email", "==", userEmail));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const user = snapshot.docs[0].data();
        if (user.lockReports) {
          setInfoDialog({
            open: true,
            title: "لا توجد صلاحية",
            description: "لا تملك صلاحية الدخول إلى صفحة التقارير.",
          });
          router.push('/');
          return;
        } else {
          setAuthorized(true);
        }
      } else {
        router.push('/');
        return;
      }

      setLoading(false);
    };

    checkLockAndSetEmail();
  }, []);

  const fetchCashBalance = async () => {
    const cashSnap = await getDocs(collection(db, "cash"));
    let balance = 0;
    cashSnap.forEach((docSnap) => {
      const data = docSnap.data();
      balance += Number(data.cashVal || 0);
    });
    setCashBalance(balance);
  };

  const fetchReports = async () => {
    if (!authorized || !email) return;

    const q = query(collection(db, "reports"));
    const querySnapshot = await getDocs(q);

    const allReports = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();

      let reportDateTime = null;
      let reportDateObj = null;

      if (data.createdAt?.toDate) {
        reportDateObj = data.createdAt.toDate();
        reportDateTime = reportDateObj.toLocaleString("ar-EG");
      } else if (data.date) {
        const parsedDate = new Date(data.date);
        if (!isNaN(parsedDate)) {
          reportDateObj = parsedDate;
          reportDateTime = parsedDate.toLocaleString("ar-EG");
        }
      }

      if (!reportDateObj) return;

      if (
        (!dateFrom || reportDateObj >= new Date(dateFrom)) &&
        (!dateTo || reportDateObj <= new Date(dateTo + "T23:59:59"))
      ) {
        if (!phoneSearch || data.phone?.includes(phoneSearch)) {
          allReports.push({ ...data, id: docSnap.id, reportDateTime, reportDateObj });
        }
      }
    });

    allReports.sort((a, b) => b.reportDateObj - a.reportDateObj);
    setReports(allReports);
  };

  useEffect(() => {
    if (authorized) {
      fetchReports();
      fetchCashBalance();
    }
  }, [authorized, dateFrom, dateTo, phoneSearch, email]);

  useEffect(() => {
    let filteredReports = reports;
    if (operationFilter) {
      filteredReports = reports.filter((r) => r.type === operationFilter);
    }

    const subTotal = filteredReports.reduce((acc, report) => acc + Number(report.commation || 0), 0);
    setTotal(subTotal);
  }, [reports, operationFilter]);

  const handleDeleteAllReports = async () => {
    setConfirmDeleteAll(true);
  };

  const confirmDeleteAllAction = async () => {
    setConfirmDeleteAll(false);
    try {
      const q = query(collection(db, "reports"));
      const querySnapshot = await getDocs(q);
      const deletePromises = querySnapshot.docs.map((docSnap) =>
        deleteDoc(doc(db, "reports", docSnap.id))
      );

      await Promise.all(deletePromises);
      toast("تم حذف جميع التقارير", "success");
      fetchReports();
    } catch (error) {
      console.error("❌ حدث خطأ أثناء الحذف:", error);
      toast("حدث خطأ أثناء حذف التقارير", "error");
    }
  };

  const handleDeleteReport = async (reportId) => {
    setConfirmDeleteReportId(reportId);
  };

  const confirmDeleteSingleAction = async () => {
    if (!confirmDeleteReportId) return;
    try {
      await deleteDoc(doc(db, "reports", confirmDeleteReportId));
      toast("تم حذف التقرير", "success");
      fetchReports();
    } catch (error) {
      console.error("❌ خطأ أثناء حذف التقرير:", error);
      toast("حدث خطأ أثناء حذف التقرير", "error");
    } finally {
      setConfirmDeleteReportId(null);
    }
  };

  const handleExportExcel = async () => {
    if (reports.length === 0) {
      setInfoDialog({
        open: true,
        title: "لا يوجد بيانات",
        description: "لا توجد تقارير متاحة للتصدير الآن.",
      });
      return;
    }

    let filteredReports = operationFilter
      ? reports.filter((r) => r.type === operationFilter)
      : reports;

    const sendReports = filteredReports.filter((r) => r.type === "ارسال");
    const receiveReports = filteredReports.filter((r) => r.type === "استلام");

    // ✅ إجمالي المبالغ + إجمالي العمولات
    const sumSendAmount = sendReports.reduce((acc, r) => acc + Number(r.operationVal || 0), 0);
    const sumReceiveAmount = receiveReports.reduce((acc, r) => acc + Number(r.operationVal || 0), 0);
    const sumSendComm = sendReports.reduce((acc, r) => acc + Number(r.commation || 0), 0);
    const sumReceiveComm = receiveReports.reduce((acc, r) => acc + Number(r.commation || 0), 0);

    // المحافظ
    const numbersSnap = await getDocs(query(collection(db, "numbers")));
    let wallets = [];
    let totalWallets = 0;
    numbersSnap.forEach((docSnap) => {
      const data = docSnap.data();
      wallets.push([data.phone || "-", data.name || "-", Number(data.amount || 0)]);
      totalWallets += Number(data.amount || 0);
    });

    // ✅ الديون
    const debtsSnap = await getDocs(collection(db, "debts"));
    let debts = [];
    debtsSnap.forEach((docSnap) => {
      const data = docSnap.data();
      debts.push([
        data.clientName || "-",
        data.walletPhone || "-",
        Number(data.amount || 0),
        data.notes || "-",
        data.date || "-"
      ]);
    });

    const cashOperations = reports
      .filter((r) => r.type === "سحب نقدي" || r.type === "ايداع نقدي")
      .map((r) => ({
        ...r,
        operationDateTime: r.reportDateObj.toLocaleString("ar-EG"),
      }));

    const capital = totalWallets + cashBalance;
    const totalProfit = reports.reduce((acc, r) => acc + Number(r.commation || 0), 0);

    const sheetData = [];

    // 📋 جدول الاستلام
    sheetData.push(["📌 جدول الاستلام"]);
    sheetData.push(["المستخدم","الرقم", "العملية", "المبلغ", "العمولة", "الملاحظات", "التاريخ والوقت"]);
    receiveReports.forEach((r) => {
      sheetData.push([r.userName || "-" ,r.phone || "-", r.type || "-", r.operationVal || 0, r.commation || 0, r.notes || "-", r.reportDateTime || "-"]);
    });
    sheetData.push(["إجمالي المبلغ", sumReceiveAmount, "إجمالي العمولات", sumReceiveComm]);
    sheetData.push([]);

    // 📋 جدول الإرسال
    sheetData.push(["📌 جدول الإرسال"]);
    sheetData.push(["المستخدم","الرقم", "العملية", "المبلغ", "العمولة", "الملاحظات", "التاريخ والوقت"]);
    sendReports.forEach((r) => {
      sheetData.push([r.userName || "-" ,r.phone || "-", r.type || "-", r.operationVal || 0, r.commation || 0, r.notes || "-", r.reportDateTime || "-"]);
    });
    sheetData.push(["إجمالي المبلغ", sumSendAmount, "إجمالي العمولات", sumSendComm]);
    sheetData.push([]);

    // 📋 جدول العمليات النقدية
    sheetData.push(["📌 جدول العمليات النقدية"]);
    sheetData.push(["النوع", "المبلغ", "العمولة", "ملاحظات", "التاريخ والوقت"]);
    cashOperations.forEach((op) => {
      sheetData.push([op.type, op.operationVal || 0, op.commation || 0, op.notes || "-", op.operationDateTime]);
    });
    sheetData.push([]);

    // 📋 تقرير المحافظ
    sheetData.push(["📌 تقرير المحافظ"]);
    sheetData.push(["رقم المحفظة", "اسم المحفظة", "الرصيد"]);
    wallets.forEach((w) => sheetData.push(w));
    sheetData.push(["إجمالي المحافظ", "-", totalWallets]);
    sheetData.push([]);

    // 📋 جدول الديون
    sheetData.push(["📌 جدول الديون"]);
    sheetData.push(["الاسم", "رقم الهاتف", "المبلغ", "ملاحظات", "التاريخ"]);
    debts.forEach((d) => sheetData.push(d));
    sheetData.push([]);

    // 📋 الملخص المالي
    sheetData.push(["📌 الملخص المالي"]);
    sheetData.push(["إجمالي رأس المال", capital]);
    sheetData.push(["الرصيد النقدي", cashBalance]);
    sheetData.push(["الأرباح", totalProfit]);

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(workbook, worksheet, "التقارير");

    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const data = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(data, `reports_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  if (loading) return <p>🔄 جاري التحقق...</p>;
  if (!authorized) return null;

  const filteredReports = reports.filter((r) => !operationFilter || r.type === operationFilter);

  const reportTypeBadgeClass = (type) => {
    const t = (type || "").toString().toLowerCase();
    if (t.includes("ارسال") || t.includes("send")) return mainListStyles.typeBadgeSend;
    if (t.includes("استلام") || t.includes("receive")) return mainListStyles.typeBadgeReceive;
    return mainListStyles.typeBadgeNeutral;
  };

  return (
    <div className="main">
      <ConfirmDialog
        open={confirmDeleteAll}
        title="حذف جميع التقارير"
        description="لا يمكن التراجع بعد حذف التقارير. هل تريد المتابعة؟"
        danger
        confirmText="حذف الكل"
        onClose={() => setConfirmDeleteAll(false)}
        onConfirm={confirmDeleteAllAction}
      />
      <ConfirmDialog
        open={!!confirmDeleteReportId}
        title="حذف التقرير"
        description="هل أنت متأكد من حذف هذا التقرير؟"
        danger
        confirmText="حذف"
        onClose={() => setConfirmDeleteReportId(null)}
        onConfirm={confirmDeleteSingleAction}
      />
      <ConfirmDialog
        open={infoDialog.open}
        title={infoDialog.title}
        description={infoDialog.description}
        confirmText="حسنًا"
        cancelText="إغلاق"
        onClose={() => setInfoDialog({ open: false, title: "", description: "" })}
        onConfirm={() => setInfoDialog({ open: false, title: "", description: "" })}
      />
      <div className={styles.reportsContainer}>
        <div className="header">
          <h2>التقارير</h2>
          <Link href={"/"} className="headerLink">
            <MdOutlineKeyboardArrowLeft />
          </Link>
        </div>

        <div className={styles.inputContainer}>
          <div className={styles.inputBox}>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className={styles.inputBox}>
            <input type="number" placeholder="ابحث برقم الهاتف" onChange={(e) => setPhoneSearch(e.target.value)} />
            <select value={operationFilter} onChange={(e) => setOperationFilter(e.target.value)}>
              <option value="">الكل</option>
              <option value="استلام">استلام</option>
              <option value="ارسال">ارسال</option>
            </select>
          </div>
        </div>

        <div className={styles.content}>
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <p>إجمالي الأرباح</p>
              <h3>{total} جنيه</h3>
            </div>
            <div className={styles.statCard}>
              <p>الرصيد النقدي</p>
              <h3>{cashBalance} جنيه</h3>
            </div>
          </div>
          <div className={styles.tableContainer}>
            <div className={styles.tableToolbar}>
              <h2>سجل التقارير</h2>
              <div className={styles.btnsContainer}>
                <button onClick={() => window.print()}>PDF</button>
                <button onClick={handleExportExcel}>Excel</button>
                <button className={styles.dangerAction} onClick={handleDeleteAllReports}><FaTrashAlt/></button>
              </div>
            </div>
            <div className={mainListStyles.operationsTable}>
              <table>
                <thead>
                  <tr>
                    <th>المستخدم</th>
                    <th>الرقم</th>
                    <th>العملية</th>
                    <th>المبلغ</th>
                    <th>العمولة</th>
                    <th>ملاحظات</th>
                    <th>التاريخ والوقت</th>
                    <th>حذف</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReports.map((report) => (
                    <tr key={report.id}>
                      <td>{report.userName || "-"}</td>
                      <td>{report.phone || "-"}</td>
                      <td>
                        {report.type || "-"}
                        {report.isManualProfit ? " (يدوي)" : ""}
                      </td>
                      <td>{report.operationVal || 0} جنية</td>
                      <td>{report.commation || 0} جنية</td>
                      <td>{report.notes || "-"}</td>
                      <td>{report.reportDateTime}</td>
                      <td>
                        <button
                          type="button"
                          onClick={() => handleDeleteReport(report.id)}
                          title="حذف التقرير"
                          style={{
                            background: "rgba(253, 100, 100, 0.20)",
                            color: "red",
                            border: "none",
                            borderRadius: "8px",
                            width: "44px",
                            height: "34px",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <FaTrashAlt />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={`${mainListStyles.operationsCards} ${styles.reportCardsList}`}>
              {filteredReports.map((report) => (
                <article key={report.id} className={mainListStyles.opCard}>
                  <div className={mainListStyles.opCardHeader}>
                    <span className={reportTypeBadgeClass(report.type)}>
                      {report.type || "-"}
                      {report.isManualProfit ? " (يدوي)" : ""}
                    </span>
                    <button
                      type="button"
                      className={mainListStyles.action}
                      onClick={() => handleDeleteReport(report.id)}
                      title="حذف التقرير"
                    >
                      <FaTrashAlt />
                    </button>
                  </div>
                  <div className={mainListStyles.opCardAmounts}>
                    <div className={mainListStyles.opCardAmountBlock}>
                      <span>المبلغ</span>
                      <strong>{report.operationVal || 0} جنية</strong>
                    </div>
                    <div className={mainListStyles.opCardAmountBlock}>
                      <span>العمولة</span>
                      <strong>{report.commation || 0} جنية</strong>
                    </div>
                  </div>
                  <dl className={mainListStyles.opCardMeta}>
                    <div className={mainListStyles.opCardRow}>
                      <dt>المستخدم</dt>
                      <dd>{report.userName || "-"}</dd>
                    </div>
                    <div className={mainListStyles.opCardRow}>
                      <dt>الرقم</dt>
                      <dd>{report.phone || "-"}</dd>
                    </div>
                    <div className={mainListStyles.opCardRow}>
                      <dt>ملاحظات</dt>
                      <dd>{report.notes || "-"}</dd>
                    </div>
                  </dl>
                  <p className={mainListStyles.opCardDate}>{report.reportDateTime}</p>
                </article>
              ))}
            </div>
            {reports.length === 0 && <EmptyState title="لا توجد تقارير" description="نفّذ عمليات يومية ثم قم بتقفيل اليوم لظهور التقارير." />}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Reports;
