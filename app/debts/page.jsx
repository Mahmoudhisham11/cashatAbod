'use client';
import styles from "./styles.module.css";
import Link from "next/link";
import { useState, useEffect } from "react";
import { MdOutlineKeyboardArrowLeft, MdModeEditOutline } from "react-icons/md";
import { FaRegMoneyBillAlt, FaTimes } from "react-icons/fa";
import {
  collection,
  addDoc,
  getDocs,
  query,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";

// Excel
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

function Debts() {
  const btns = ["اضف عميل جديد", "كل العملاء"];
  const [active, setActive] = useState(0);

  // بيانات الفورم
  const [clientName, setClientName] = useState("");
  const [amount, setAmount] = useState("");
  const [debtType, setDebtType] = useState("ليك");
  const [payMethod, setPayMethod] = useState("نقدي");
  const [walletId, setWalletId] = useState("");

  // بيانات الديون
  const [debts, setDebts] = useState([]);
  const [editId, setEditId] = useState(null);

  // مجموعات
  const [totalLik, setTotalLik] = useState(0);
  const [totalAlyek, setTotalAlyek] = useState(0);

  // المستخدم
  const [userEmail, setUserEmail] = useState("");

  // المحافظ والنقدي
  const [wallets, setWallets] = useState([]);
  const [cashVal, setCashVal] = useState(0);

  // popup السداد
  const [showPayPopup, setShowPayPopup] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [payType, setPayType] = useState("نقدي");
  const [selectedWallet, setSelectedWallet] = useState("");

  useEffect(() => {
    const email = localStorage.getItem("email");
    if (email) setUserEmail(email);
  }, []);

  useEffect(() => {
    if (!userEmail) return;
    fetchDebts();
    fetchWallets();
    fetchCash();
  }, [userEmail]);

  const fetchDebts = async () => {
    if (!userEmail) return;
    try {
      const q = query(collection(db, "debts"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setDebts(data);

      let lik = 0, alyek = 0;
      data.forEach((d) => {
        const val = Number(d.amount) || 0;
        if (d.debtType === "ليك") lik += val;
        else alyek += val;
      });
      setTotalLik(lik);
      setTotalAlyek(alyek);
    } catch (error) { console.error(error); }
  };

  const fetchWallets = async () => {
    try {
      const q = query(collection(db, "numbers"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setWallets(data);
    } catch (error) { console.error(error); }
  };

  const fetchCash = async () => {
    try {
      const q = query(collection(db, "cash"));
      const snapshot = await getDocs(q);
      let totalCash = 0;
      snapshot.forEach((docSnap) => { totalCash += Number(docSnap.data().cashVal || 0); });
      setCashVal(totalCash);
    } catch (error) { console.error(error); }
  };

  const handleSubmit = async () => {
    if (!userEmail) return;
    if (!clientName || !amount) { alert("⚠️ من فضلك املأ جميع الحقول"); return; }
    const debtAmount = Number(amount);
    try {
      if (payMethod === "نقدي") {
        const cashSnap = await getDocs(collection(db, "cash"));
        if (!cashSnap.empty) {
          const cashDocId = cashSnap.docs[0].id;
          const cashData = cashSnap.docs[0].data();
          const newCash = Number(cashData.cashVal || 0) - debtAmount;
          await updateDoc(doc(db, "cash", cashDocId), { cashVal: newCash });
          setCashVal(newCash);
        }
      } else if (payMethod === "محفظة" && walletId) {
        const walletRef = doc(db, "numbers", walletId);
        const walletDoc = wallets.find((w) => w.id === walletId);
        const newAmount = Number(walletDoc.amount || 0) - debtAmount;
        await updateDoc(walletRef, { amount: newAmount });
        fetchWallets();
      }

      const debtData = {
        clientName, amount: debtAmount, debtType,
        payMethod, walletId: payMethod==="محفظة"?walletId:null,
        userEmail, date: new Date().toLocaleDateString("ar-EG")
      };

      if (editId) {
        await updateDoc(doc(db, "debts", editId), debtData);
        alert("✅ تم تعديل العميل");
      } else {
        await addDoc(collection(db, "debts"), debtData);
        alert("✅ تم اضافة العميل");
      }

      setClientName(""); setAmount(""); setDebtType("ليك"); setPayMethod("نقدي"); setWalletId(""); setEditId(null);
      fetchDebts();
    } catch (error) { console.error(error); }
  };

  const handleEdit = (debt) => {
    setClientName(debt.clientName);
    setAmount(debt.amount);
    setDebtType(debt.debtType);
    setPayMethod(debt.payMethod || "نقدي");
    setWalletId(debt.walletId || "");
    setEditId(debt.id);
    setActive(0);
  };

  const openPayPopup = (debt) => {
    setSelectedDebt(debt);
    setPayAmount("");
    setPayType("نقدي");
    setSelectedWallet("");
    setShowPayPopup(true);
  };

  const handlePay = async () => {
    if (!payAmount || Number(payAmount)<=0) { alert("⚠️ ادخل قيمة صحيحة"); return; }
    const amt = Number(payAmount);
    try {
      // تحديث النقدي أو المحفظة
      if (payType === "نقدي") {
        const cashSnap = await getDocs(collection(db, "cash"));
        if (!cashSnap.empty) {
          const cashDocId = cashSnap.docs[0].id;
          const cashData = cashSnap.docs[0].data();
          await updateDoc(doc(db, "cash", cashDocId), { cashVal: Number(cashData.cashVal||0)+amt });
          setCashVal(Number(cashData.cashVal||0)+amt);
        }
      } else if (payType==="محفظة" && selectedWallet) {
        const walletRef = doc(db, "numbers", selectedWallet);
        const walletDoc = wallets.find(w=>w.id===selectedWallet);
        const newAmount = Number(walletDoc.amount||0)+amt;
        await updateDoc(walletRef,{amount:newAmount});
        fetchWallets();
      }

      // تحديث الدين
      const debtRef = doc(db,"debts",selectedDebt.id);
      if (amt<selectedDebt.amount) {
        await updateDoc(debtRef,{amount:selectedDebt.amount-amt});
      } else {
        await deleteDoc(debtRef);
      }

      fetchDebts();
      setShowPayPopup(false);
    } catch(error){ console.error(error); }
  };

  const exportToExcel = () => {
    const data = debts.map((d) => ({
      "اسم العميل": d.clientName,
      "المبلغ": d.amount,
      "النوع": d.debtType,
      "طريقة الدفع": d.payMethod||"",
      "التاريخ": d.date,
    }));
    data.push({}); data.push({"اسم العميل":"الإجمالي ليك","المبلغ":totalLik});
    data.push({"اسم العميل":"الإجمالي عليك","المبلغ":totalAlyek});
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "الديون");
    const excelBuffer = XLSX.write(workbook,{bookType:"xlsx",type:"array"});
    const dataBlob = new Blob([excelBuffer],{type:"application/octet-stream"});
    saveAs(dataBlob,`الديون_${new Date().toLocaleDateString("ar-EG")}.xlsx`);
  };

  return (
    <div className={styles.debts}>
      <div className="header">
        <h2>الديون</h2>
        <Link href={"/"} className="headerLink"><MdOutlineKeyboardArrowLeft/></Link>
      </div>

      <div className={styles.content}>
        <div className={styles.btnsContainer}>
          {btns.map((btn,index)=>(
            <button key={index} className={active===index?styles.active:""} onClick={()=>setActive(index)}>
              {btn}
            </button>
          ))}
        </div>

        {/* إضافة عميل */}
        <div className={styles.debtsInfo} style={{display:active===0?"flex":"none"}}>
          {userEmail ? (
            <div className={styles.info}>
              <div className="inputContainer">
                <label>اسم العميل:</label>
                <input type="text" placeholder="ادخل اسم العميل" value={clientName} onChange={e=>setClientName(e.target.value)} />
              </div>
              <div className="inputContainer">
                <label>طريقة الدفع:</label>
                <select value={payMethod} onChange={e=>setPayMethod(e.target.value)}>
                  <option value="نقدي">نقدي</option>
                  <option value="محفظة">محفظة</option>
                </select>
              </div>
              {payMethod==="محفظة" && (
                <div className="inputContainer">
                  <label>اختر المحفظة:</label>
                  <select value={walletId} onChange={e=>setWalletId(e.target.value)}>
                    <option value="">اختر المحفظة</option>
                    {wallets.map(w=><option key={w.id} value={w.id}>{w.phone} - {w.amount} ج.م</option>)}
                  </select>
                </div>
              )}
              <div className="inputContainer">
                <label>المبلغ:</label>
                <input type="number" placeholder="ادخل المبلغ" value={amount} onChange={e=>setAmount(e.target.value)} />
              </div>
              <div className="inputContainer">
                <label>نوع الدين:</label>
                <select value={debtType} onChange={e=>setDebtType(e.target.value)}>
                  <option value="ليك">ليك</option>
                  <option value="عليك">عليك</option>
                </select>
              </div>
              
              <button onClick={handleSubmit} className={styles.addBtn}>{editId?"تعديل العميل":"اضافة العميل"}</button>
            </div>
          ):(<p>⚠️ جاري التعرف على المستخدم...</p>)}
        </div>

        {/* عرض الكل */}
        <div className={styles.debtsContent} style={{display:active===1?"flex":"none"}}>
          <div className={styles.headContainer}>
            <div className={styles.totals}>
              <strong>ليك: {totalLik} ج.م</strong>
              <strong>عليك: {totalAlyek} ج.م</strong>
              <strong>نقدي: {cashVal} ج.م</strong>
            </div>
            <div className={styles.headBtns}>
              <button onClick={exportToExcel}>Excel</button>
            </div>
          </div>
          <div className={styles.tableContainer}>
            <table>
              <thead>
                <tr>
                  <th>اسم العميل</th>
                  <th>المبلغ</th>
                  <th>النوع</th>
                  <th>طريقة الدفع</th>
                  <th>التاريخ</th>
                  <th>تفاعل</th>
                </tr>
              </thead>
              <tbody>
                {debts.map(d=>(
                  <tr key={d.id}>
                    <td>{d.clientName}</td>
                    <td>{d.amount} ج.م</td>
                    <td>{d.debtType}</td>
                    <td>{d.payMethod||"نقدي"}</td>
                    <td>{d.date}</td>
                    <td className={styles.actions}>
                      <button onClick={()=>handleEdit(d)}><MdModeEditOutline/></button>
                      <button onClick={()=>openPayPopup(d)}><FaRegMoneyBillAlt/></button>
                    </td>
                  </tr>
                ))}
                {debts.length===0 && (
                  <tr><td colSpan={6} style={{textAlign:"center"}}>لا يوجد بيانات</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Popup السداد */}
      {showPayPopup && (
        <div className={styles.popupOverlay}>
          <div className={styles.popupContent}>
            <div className={styles.popupHeader}>
              <h3>سداد الدين</h3>
              <button onClick={()=>setShowPayPopup(false)} className={styles.closeBtn}><FaTimes/></button>
            </div>
            <div className={styles.popupBody}>
              <div className="inputContainer">
                <label>طريقة السداد:</label>
                <select value={payType} onChange={e=>setPayType(e.target.value)}>
                  <option value="نقدي">نقدي</option>
                  <option value="محفظة">محفظة</option>
                </select>
              </div>
              {payType==="محفظة" && (
                <div className="inputContainer">
                  <label>اختر المحفظة:</label>
                  <select value={selectedWallet} onChange={e=>setSelectedWallet(e.target.value)}>
                    <option value="">اختر المحفظة</option>
                    {wallets.map(w=><option key={w.id} value={w.id}>{w.phone} - {w.amount} ج.م</option>)}
                  </select>
                </div>
              )}
              <div className="inputContainer">
                <label>قيمة المبلغ:</label>
                <input type="number" value={payAmount} onChange={e=>setPayAmount(e.target.value)} />
              </div>
              <button className={styles.confirmBtn} onClick={handlePay}>تأكيد السداد</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Debts;
