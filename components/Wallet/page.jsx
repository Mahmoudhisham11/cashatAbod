'use client';
import { useEffect, useState } from "react";
import styles from "./styles.module.css";
import { MdOutlineKeyboardArrowLeft } from "react-icons/md";
import { db } from "../../app/firebase";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
  serverTimestamp
} from "firebase/firestore";

function Wallet({ openWallet, setOpenWallet }) {
  const [phone, setPhone] = useState("");
  const [operationVal, setOperationVal] = useState("");
  const [commation, setCommation] = useState("");
  const [notes, setNotes] = useState(""); 
  const [receiver, setReceiver] = useState(""); 
  const [phoneNumbers, setPhoneNumbers] = useState([]);
  const [withdrawLimit, setWithdrawLimit] = useState("");
  const [dailyWithdraw, setDailyWithdraw] = useState("");
  const [amount, setAmount] = useState("");

  // ✅ جلب كل الأرقام
  useEffect(() => {
    const q = collection(db, "numbers");
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const numbersArray = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setPhoneNumbers(numbersArray);
    });

    return () => unsubscribe();
  }, []);

  // ✅ تحديث بيانات الرقم المختار
  useEffect(() => {
    if (phone && phoneNumbers.length > 0) {
      const selected = phoneNumbers.find((item) => item.phone === phone);
      if (selected) {
        setWithdrawLimit(selected.withdrawLimit || 0);
        setDailyWithdraw(selected.dailyWithdraw || 0);
        setAmount(selected.amount || 0);
      }
    }
  }, [phone, phoneNumbers]);

  const handleWalletAdd = async () => {
    if (!phone) {
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

    // ✅ إضافة العملية
    await addDoc(collection(db, "operations"), {
      commation,
      operationVal,
      userName: localStorage.getItem('name'),
      phone,
      type: "استلام",
      notes,
      receiver,
      createdAt: serverTimestamp(),
    });

    // ✅ تحديث بيانات الرقم
    const nq = query(collection(db, "numbers"), where("phone", "==", phone));
    const nSnapshot = await getDocs(nq);
    if (!nSnapshot.empty) {
      const numberDoc = nSnapshot.docs[0];
      const numberRef = doc(db, "numbers", numberDoc.id);
      const numberData = numberDoc.data();
      await updateDoc(numberRef, {
        amount: Number(numberData.amount) + Number(operationVal),
        withdrawLimit: Number(numberData.withdrawLimit) - Number(operationVal),
        dailyWithdraw: Number(numberData.dailyWithdraw) - Number(operationVal),
      });
    }

    // ✅ خصم العملية من cashVal
    const cq = collection(db, "cash");
    const cSnapshot = await getDocs(cq);
    if (!cSnapshot.empty) {
      const cashDoc = cSnapshot.docs[0];
      const cashRef = doc(db, "cash", cashDoc.id);
      const cashData = cashDoc.data();

      await updateDoc(cashRef, {
        cashVal: Number(cashData.cashVal) - Number(operationVal),
      });
    }

    alert("تم اتمام العملية بنجاح");
    setPhone("");
    setCommation("");
    setOperationVal("");
    setNotes("");
    setReceiver(""); 
  };

  return (
    <div className={openWallet ? "operationContainer active" : "operationContainer"}>
      <div className="conatainerHead">
        <button className={styles.closeBtn} onClick={() => setOpenWallet(false)}>
          <MdOutlineKeyboardArrowLeft />
        </button>
        <h2>عملية استلام</h2>
      </div>
      <div className="operationBox">
        <div className="operationsContent">
          <div className="inputContainer">
            <label>اختر رقم الشريحة :</label>
            <select value={phone} onChange={(e) => setPhone(e.target.value)}>
              <option value="">اختر رقم</option>
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
                placeholder="اكتب اسم المرسل إليه"
                onChange={(e) => setReceiver(e.target.value)}
              />
            </div>
            <div className="inputContainer">
              <label>ملاحظات :</label>
              <input
                type="text"
                value={notes}
                placeholder="ملاحظات"
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
                value={Number(operationVal) - Number(commation)}
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
                value={Number(withdrawLimit)}
                placeholder="0"
                disabled
                readOnly
              />
            </div>
            <div className="inputContainer">
              <label>اليومي :</label>
              <input
                type="number"
                value={Number(dailyWithdraw)}
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
        <button className="operationBtn" onClick={handleWalletAdd}>اكمل العملية</button>
      </div>
    </div>
  );
}

export default Wallet;
