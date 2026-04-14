'use client';
import { useEffect, useState } from "react";
import { useRef } from "react";
import styles from "./styles.module.css";
import { MdOutlineKeyboardArrowLeft } from "react-icons/md";
import { useToast } from "../ui/ToastProvider";
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
  const [sourceType, setSourceType] = useState("line");
  const [phone, setPhone] = useState("");
  const [machineId, setMachineId] = useState("");
  const [operationVal, setOperationVal] = useState("");
  const [commation, setCommation] = useState("");
  const [notes, setNotes] = useState("");
  const [receiver, setReceiver] = useState("");
  const [phoneNumbers, setPhoneNumbers] = useState([]);
  const [machines, setMachines] = useState([]);
  const [withdrawLimit, setWithdrawLimit] = useState("");
  const [dailyWithdraw, setDailyWithdraw] = useState("");
  const [amount, setAmount] = useState("");
  const operationInputRef = useRef(null);
  const { toast } = useToast();
  const quickAmounts = [100, 200, 500, 1000];

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

  useEffect(() => {
    const email =
      typeof window !== "undefined" ? localStorage.getItem("email") : "";
    if (!email) return;

    const q = query(
      collection(db, "machines"),
      where("userEmail", "==", email)
    );
    const unsub = onSnapshot(q, (snap) => {
      const arr = [];
      snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
      setMachines(arr);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (openWallet && operationInputRef.current) {
      setTimeout(() => operationInputRef.current?.focus(), 120);
    }
  }, [openWallet]);

  useEffect(() => {
    if (sourceType === "line" && phone && phoneNumbers.length > 0) {
      const selected = phoneNumbers.find((item) => item.phone === phone);
      if (selected) {
        setWithdrawLimit(selected.withdrawLimit || 0);
        setDailyWithdraw(selected.dailyWithdraw || 0);
        setAmount(selected.amount || 0);
      }
    }
  }, [phone, phoneNumbers, sourceType]);

  useEffect(() => {
    if (sourceType === "machine" && machineId && machines.length > 0) {
      const m = machines.find((x) => x.id === machineId);
      if (m) setAmount(Number(m.balance ?? 0));
    }
  }, [machineId, machines, sourceType]);

  const handleWalletAdd = async () => {
    const shop = localStorage.getItem("shop");
    if (!shop) {
      toast("لا يوجد فرع محدد للحساب", "error");
      return;
    }

    if (!operationVal || isNaN(Number(operationVal))) {
      toast("قيمة العملية غير صالحة", "error");
      return;
    }

    if (!commation || isNaN(Number(commation))) {
      toast("قيمة العمولة غير صالحة", "error");
      return;
    }

    if (sourceType === "machine") {
      if (!machineId) {
        toast("اختر الماكينة أولًا", "warning");
        return;
      }
      const m = machines.find((x) => x.id === machineId);
      if (!m) {
        toast("الماكينة غير موجودة", "error");
        return;
      }
      const machineBalance = Number(m.balance ?? 0);

      await addDoc(collection(db, "operations"), {
        commation,
        operationVal,
        userName: localStorage.getItem("name"),
        shop,
        phone: "",
        type: "استلام",
        notes,
        receiver,
        sourceType: "machine",
        machineId,
        machineName: m.name || "",
        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(db, "machines", machineId), {
        balance: machineBalance + Number(operationVal),
      });

      const cSnapshot = await getDocs(collection(db, "cash"));
      if (!cSnapshot.empty) {
        const cashDoc = cSnapshot.docs[0];
        const cashRef = doc(db, "cash", cashDoc.id);
        const cashData = cashDoc.data();

        await updateDoc(cashRef, {
          cashVal: Number(cashData.cashVal) - Number(operationVal),
        });
      }

      toast("تمت عملية الاستلام بنجاح", "success");
      setMachineId("");
      setCommation("");
      setOperationVal("");
      setNotes("");
      setReceiver("");
      return;
    }

    if (!phone) {
      toast("اختر رقم الشريحة أولًا", "warning");
      return;
    }

    if (Number(operationVal) > Number(withdrawLimit)) {
      toast("تجاوزت الليمت الشهري", "warning");
      return;
    }

    if (Number(operationVal) > Number(dailyWithdraw)) {
      toast("تجاوزت الليمت اليومي", "warning");
      return;
    }

    await addDoc(collection(db, "operations"), {
      commation,
      operationVal,
      userName: localStorage.getItem("name"),
      shop,
      phone,
      type: "استلام",
      notes,
      receiver,
      sourceType: "line",
      createdAt: serverTimestamp(),
    });

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

    toast("تمت عملية الاستلام بنجاح", "success");
    setPhone("");
    setCommation("");
    setOperationVal("");
    setNotes("");
    setReceiver("");
  };

  const onSourceChange = (next) => {
    setSourceType(next);
    setPhone("");
    setMachineId("");
    setOperationVal("");
    setCommation("");
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
            <label>المصدر :</label>
            <select
              value={sourceType}
              onChange={(e) => onSourceChange(e.target.value)}
            >
              <option value="line">من خط</option>
              <option value="machine">من ماكينة</option>
            </select>
          </div>

          {sourceType === "line" ? (
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
          ) : (
            <div className="inputContainer">
              <label>اختر الماكينة :</label>
              <select
                value={machineId}
                onChange={(e) => setMachineId(e.target.value)}
              >
                <option value="">-- اختر ماكينة --</option>
                {machines.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name || item.id}
                  </option>
                ))}
              </select>
            </div>
          )}

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
                ref={operationInputRef}
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

          <div className={styles.quickActions}>
            {quickAmounts.map((val) => (
              <button key={val} type="button" onClick={() => setOperationVal(String(val))}>
                {val} ج
              </button>
            ))}
          </div>

          {sourceType === "line" && (
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
          )}

          {sourceType === "machine" && (
            <div className="amounts">
              <div className="inputContainer">
                <label>رصيد الماكينة :</label>
                <input
                  type="number"
                  value={Number(amount)}
                  placeholder="0"
                  disabled
                  readOnly
                />
              </div>
            </div>
          )}
        </div>
        <button className="operationBtn" onClick={handleWalletAdd}>اكمل العملية</button>
      </div>
    </div>
  );
}

export default Wallet;
