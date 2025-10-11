'use client';
import styles from "./styles.module.css";
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
          alert("❌ مالكش صلاحية الدخول للصفحة");
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

    const q = query(collection(db, 'reports'));
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
    const confirmDelete = confirm("هل أنت متأكد أنك تريد حذف جميع التقارير؟ لا يمكن التراجع.");
    if (!confirmDelete) return;

    try {
      const q = query(collection(db, "reports"));
      const querySnapshot = await getDocs(q);
      const deletePromises = querySnapshot.docs.map((docSnap) =>
        deleteDoc(doc(db, "reports", docSnap.id))
      );

      await Promise.all(deletePromises);
      alert("✅ تم حذف جميع التقارير بنجاح");
      fetchReports();
    } catch (error) {
      console.error("❌ حدث خطأ أثناء الحذف:", error);
      alert("حدث خطأ أثناء حذف التقارير");
    }
  };

  const handleExportExcel = async () => {
    if (reports.length === 0) {
      alert("⚠️ لا يوجد بيانات للتصدير");
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
        data.name || "-",
        data.phone || "-",
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

  return (
    <div className="main">
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
          <div className={styles.contentTitle}>
            <h2>اجمالي الارباح : {total} جنية</h2>
            <h2>الرصيد النقدي : {cashBalance} جنية</h2>
            <div className={styles.btnsContainer}>
              <button onClick={() => window.print()}>PDF</button>
              <button onClick={handleExportExcel}>Excel</button>
              <button onClick={handleDeleteAllReports}><FaTrashAlt/></button>
            </div>
          </div>
          <div className={styles.tableContainer}>
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
                </tr>
              </thead>
              <tbody>
                {reports
                  .filter((report) => !operationFilter || report.type === operationFilter)
                  .map((report) => (
                    <tr key={report.id}>
                      <td>{report.userName || "-"}</td>
                      <td>{report.phone || "-"}</td>
                      <td>{report.type || "-"}</td>
                      <td>{report.operationVal || 0} جنية</td>
                      <td>{report.commation || 0} جنية</td>
                      <td>{report.notes || "-"}</td>
                      <td>{report.reportDateTime}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Reports;
