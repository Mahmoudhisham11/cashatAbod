'use client';
import styles from "./styles.module.css";
import { IoIosCloseCircle } from "react-icons/io";
import { db } from "../../app/firebase";
import { addDoc, collection, doc, getDocs, query, updateDoc, where, serverTimestamp } from "firebase/firestore";
import { useState, useEffect } from "react";

function CashPop({ openCash, setOpenCash }) {
  const [operationVal, setOperationVal] = useState(""); // قيمة العملية
  const [notes, setNotes] = useState(""); 
  const [userEmail, setUserEmail] = useState("");
  const [existingCashId, setExistingCashId] = useState(null);
  const [currentCash, setCurrentCash] = useState(0); // الرصيد الحالي
  const [newCash, setNewCash] = useState(0); // الرصيد بعد العملية
  const [operationType, setOperationType] = useState("deposit"); // نوع العملية (افتراضي إيداع)

  // جلب ايميل المستخدم من localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storageEmail = localStorage.getItem("email");
      if (storageEmail) {
        setUserEmail(storageEmail);
      }
    }
  }, []);

  // التحقق إذا كان للمستخدم قيمة نقدية موجودة بالفعل
  useEffect(() => {
    const checkCash = async () => {
      if (!userEmail) return;
      const q = query(collection(db, "cash"), where("userEmail", "==", userEmail));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const cashDoc = snapshot.docs[0];
        setExistingCashId(cashDoc.id);
        setCurrentCash(cashDoc.data().cashVal || 0);
        setNewCash(cashDoc.data().cashVal || 0);
      }
    };

    if (openCash) {
      checkCash();
    }
  }, [userEmail, openCash]);

  // تحديث الرصيد المتوقع بعد العملية بمجرد تغيير المدخلات
  useEffect(() => {
    const val = Number(operationVal) || 0;
    if (operationType === "deposit") {
      setNewCash(currentCash + val);
    } else {
      setNewCash(currentCash - val);
    }
  }, [operationVal, operationType, currentCash]);

  // تنفيذ العملية
  const handleSaveCash = async () => {
    const val = Number(operationVal);
    if (!val || val <= 0) {
      alert("من فضلك ادخل قيمة صالحة للعملية");
      return;
    }

    if (operationType === "withdraw" && val > currentCash) {
      alert("❌ لا يمكن السحب أكبر من الرصيد الحالي");
      return;
    }

    if (existingCashId) {
      // تعديل القيمة الموجودة
      const cashRef = doc(db, "cash", existingCashId);
      await updateDoc(cashRef, {
        cashVal: newCash,
        notes: notes || "",
        updatedAt: serverTimestamp(),
      });
    } else {
      // إنشاء قيمة جديدة
      const newCashDoc = await addDoc(collection(db, "cash"), {
        cashVal: newCash,
        notes: notes || "",
        userEmail,
        createdAt: serverTimestamp(),
      });
      setExistingCashId(newCashDoc.id);
    }

    // تسجيل العملية في operations
    await addDoc(collection(db, "operations"), {
      userEmail,
      type: operationType === "deposit" ? "ايداع نقدي" : "سحب نقدي",
      operationVal: val,
      notes: notes || "",
      beforeCash: currentCash,
      afterCash: newCash,
      createdAt: serverTimestamp(),
      date: new Date().toISOString().split("T")[0],
    });

    alert("✅ تمت العملية بنجاح");

    // تحديث الحالة
    setCurrentCash(newCash);
    setOperationVal("");
    setNotes("");
    setOpenCash(false);
  };

  if (!openCash) return null;

  return (
    <div className={openCash ? "shadowBox active" : "shadowBox"}>
      <div className="box">
        <button className={styles.closeBtn} onClick={() => setOpenCash(false)}>
          <IoIosCloseCircle />
        </button>
        <h2>عملية نقدية</h2>
        <div className="boxForm">

          <div className="inputContainer">
            <label>نوع العملية : </label>
            <select value={operationType} onChange={(e) => setOperationType(e.target.value)}>
              <option value="deposit">ايداع</option>
              <option value="withdraw">سحب</option>
            </select>
          </div>

          <div className="inputContainer">
            <label>قيمة العملية : </label>
            <input
              type="number"
              value={operationVal}
              placeholder="ادخل قيمة العملية"
              onChange={(e) => setOperationVal(e.target.value)}
            />
          </div>

          <div className="inputContainer">
            <label>الرصيد قبل العملية : </label>
            <input type="number" value={currentCash} disabled readOnly />
          </div>

          <div className="inputContainer">
            <label>الرصيد بعد العملية : </label>
            <input type="number" value={newCash} disabled readOnly />
          </div>

          <div className="inputContainer">
            <label>ملاحظات : </label>
            <input
              type="text"
              value={notes}
              placeholder="ملاحظات"
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <button className={styles.walletBtn} onClick={handleSaveCash}>
            اكمل العملية
          </button>
        </div>
      </div>
    </div>
  );
}

export default CashPop;
