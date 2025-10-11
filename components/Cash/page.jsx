'use client';
import { useState, useEffect } from "react";
import styles from "./styles.module.css";
import { MdOutlineKeyboardArrowLeft } from "react-icons/md";
import { db } from "../../app/firebase";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  updateDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";

function Cash({ openCash, setOpenCash }) {
  const [operationVal, setOperationVal] = useState("");
  const [phone, setPhone] = useState("");
  const [commation, setCommation] = useState("");
  const [amount, setAmount] = useState("");
  const [depositLimit, setDepositLimit] = useState("");
  const [dailyDeposit, setDailyDeposit] = useState("");
  const [phoneNumbers, setPhoneNumbers] = useState([]);
  const [notes, setNotes] = useState(""); 
  const [receiver, setReceiver] = useState("");

  // ✅ جلب كل الأرقام من numbers بدون أي شرط
  useEffect(() => {
    const q = collection(db, "numbers");
    const unSubscripe = onSnapshot(q, (querySnapshot) => {
      const numbers = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setPhoneNumbers(numbers);
    });

    return () => unSubscripe();
  }, []);

  // ✅ تحديث بيانات الرقم عند تغييره
  useEffect(() => {
    if (phone && phoneNumbers.length > 0) {
      const selected = phoneNumbers.find((p) => p.phone === phone);
      if (selected) {
        setDepositLimit(selected.depositLimit || 0);
        setDailyDeposit(selected.dailyDeposit || 0);
        setAmount(selected.amount || 0);
      }
    }
  }, [phone, phoneNumbers]);

  const handleCashAdd = async () => {
    if (!phone || phone.trim() === "") {
      alert("من فضلك اختر رقم الشريحة");
      return;
    }

    if (!operationVal || isNaN(Number(operationVal))) {
      alert("قيمة العملية غير صالحة");
      return;
    }

    if (!commation || isNaN(Number(commation))) {
      alert("قيمة العمولة غير صالحة");
      return;
    }

    // ✅ التحقق من الرصيد
    if (Number(operationVal) > Number(amount)) {
      alert("قيمة العملية أكبر من رصيد الخط الحالي");
      return;
    }

    // ✅ التحقق من الليميت الشهري
    if (Number(operationVal) > Number(depositLimit)) {
      alert("قيمة العملية تتجاوز الحد الشهري المسموح به");
      return;
    }

    // ✅ التحقق من الليميت اليومي
    if (Number(operationVal) > Number(dailyDeposit)) {
      alert("قيمة العملية تتجاوز الحد اليومي المسموح به");
      return;
    }

    // ✅ إضافة العملية في operations
    await addDoc(collection(db, "operations"), {
      commation,
      operationVal,
      userName: localStorage.getItem('name'),
      phone,
      notes,
      receiver,
      type: "ارسال",
      createdAt: serverTimestamp(),
    });

    // ✅ تحديث بيانات الرقم (خصم العملية)
    const nSnapshot = await getDocs(collection(db, "numbers"));
    const numberDoc = nSnapshot.docs.find((docu) => docu.data().phone === phone);
    if (numberDoc) {
      const numberRef = doc(db, "numbers", numberDoc.id);
      const numberData = numberDoc.data();
      await updateDoc(numberRef, {
        amount: Number(numberData.amount) - Number(operationVal),
        depositLimit: Number(numberData.depositLimit) - Number(operationVal),
        dailyDeposit: Number(numberData.dailyDeposit) - Number(operationVal),
      });
    }

    // ✅ تحديث قيمة الـ cash (زيادة العملية)
    const cSnapshot = await getDocs(collection(db, "cash"));
    if (!cSnapshot.empty) {
      const cashDoc = cSnapshot.docs[0];
      const cashRef = doc(db, "cash", cashDoc.id);
      const cashData = cashDoc.data();

      await updateDoc(cashRef, {
        cashVal: Number(cashData.cashVal) + Number(operationVal),
      });
    }

    alert("تم اتمام العملية بنجاح");
    setCommation("");
    setOperationVal("");
    setPhone("");
    setNotes(""); 
    setReceiver("");
  };

  return (
    <div className={openCash ? "operationContainer active" : "operationContainer"}>
      <div className="conatainerHead">
        <button className={styles.closeBtn} onClick={() => setOpenCash(false)}>
          <MdOutlineKeyboardArrowLeft />
        </button>
        <h2>عملية ارسال</h2>
      </div>

      <div className="operationBox">
        <div className="operationsContent">
          <div className="inputContainer">
            <label>اختر رقم الشريحة :</label>
            <select value={phone} onChange={(e) => setPhone(e.target.value)}>
              <option value="">-- اختر رقم --</option>
              {phoneNumbers.map((item) => (
                <option key={item.id} value={item.phone}>
                  {item.phone}
                </option>
              ))}
            </select>
          </div>
          <div className="amounts">
            <div className="inputContainer">
              <label>المرسل:</label>
              <input
                type="text"
                value={receiver}
                placeholder="اكتب رقم المرسل إليه"
                onChange={(e) => setReceiver(e.target.value)}
              />
            </div>
            <div className="inputContainer">
              <label>ملاحظات :</label>
              <input
                type="text"
                placeholder="ملاحظات"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="amounts">
            <div className="inputContainer">
              <label>المبلغ :</label>
              <input
                type="number"
                value={operationVal}
                placeholder="0"
                onChange={(e) => setOperationVal(e.target.value)}
              />
            </div>
            <div className="inputContainer">
              <label>العمولة:</label>
              <input
                type="number"
                value={commation}
                placeholder="0"
                onChange={(e) => setCommation(e.target.value)}
              />
            </div>
            <div className="inputContainer">
              <label>الصافي :</label>
              <input
                type="number"
                value={Number(operationVal) + Number(commation)}
                placeholder="0"
                disabled
                readOnly
              />
            </div>
          </div>

          <div className="amounts">
            <div className="inputContainer">
              <label>الشهري :</label>
              <input
                type="number"
                value={Number(depositLimit)}
                placeholder="0"
                disabled
                readOnly
              />
            </div>
            <div className="inputContainer">
              <label>اليومي :</label>
              <input
                type="number"
                value={Number(dailyDeposit)}
                placeholder="0"
                disabled
                readOnly
              />
            </div>
            <div className="inputContainer">
              <label>الرصيد :</label>
              <input type="number" value={amount} placeholder="0" disabled readOnly />
            </div>
          </div>
        </div>

        <button className="operationBtn" onClick={handleCashAdd}>
          اكمل العملية
        </button>
      </div>
    </div>
  );
}

export default Cash;
