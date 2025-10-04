'use client';
import { useEffect, useState } from "react";
import styles from "./styles.module.css";
import avatar from "../../public/image/Avatar-Profile-Vector-removebg-preview.png";
import Image from "next/image";
import { FaArrowUp, FaArrowDown, FaRegTrashAlt, FaEye, FaEyeSlash } from "react-icons/fa";
import { BiMemoryCard } from "react-icons/bi";
import { FaArchive } from "react-icons/fa";
import Nav from "../Nav/page";
import Wallet from "../Wallet/page";
import Cash from "../Cash/page";
import abod from "../../public/image/TXSC8094.JPG"
import { db } from "../../app/firebase";
import {
  collection,
  deleteDoc,
  getDocs,
  onSnapshot,
  query,
  doc,
  addDoc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { useRouter } from "next/navigation";

function Main() {
  const router = useRouter();
  const [openWallet, setOpenWallet] = useState(false);
  const [openCash, setOpenCash] = useState(false);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [wallet, setWallet] = useState(0);
  const [cash, setCash] = useState(0);
  const [profit, setProfit] = useState(0);
  const [capital, setCapital] = useState(0);
  const [operations, setOperations] = useState([]);
  const [nums, setNums] = useState([]);
  const [theme, setTheme] = useState('light');
  const [hideAmounts, setHideAmounts] = useState(false);

  // THEME CONTROL
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") || "light";
    setTheme(savedTheme);
    document.body.className = savedTheme;
  }, []);
  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.body.className = newTheme;
  };

  // GET LOCALSTORAGE DATA
  useEffect(() => {
    const storageName = localStorage.getItem("name");
    const storageEmail = localStorage.getItem("email");
    if (storageName) {
      setUserName(storageName);
      setUserEmail(storageEmail);
    }
  }, []);

  // SUBSCRIBE TO NUMBERS / OPERATIONS / CASH (live)
  useEffect(() => {
    // ✅ كل الأرقام لكل المستخدمين
    const numQ = query(collection(db, 'numbers'));
    const unsubNum = onSnapshot(numQ, (qs) => {
      const arr = [];
      qs.forEach(d => arr.push({ ...d.data(), id: d.id }));
      setNums(arr);
    });

    // ✅ كل العمليات لكل المستخدمين
    const opQ = query(collection(db, 'operations'));
    const unsubOp = onSnapshot(opQ, (qs) => {
      const arr = qs.docs.map((d) => ({ ...d.data(), id: d.id }));

      arr.sort((a, b) => {
        if (a.createdAt && b.createdAt) {
          const aTime = typeof a.createdAt.toMillis === "function"
            ? a.createdAt.toMillis()
            : a.createdAt.seconds * 1000;
          const bTime = typeof b.createdAt.toMillis === "function"
            ? b.createdAt.toMillis()
            : b.createdAt.seconds * 1000;
          return bTime - aTime;
        }
        if (a.createdAt) return -1;
        if (b.createdAt) return 1;
        return 0;
      });

      setOperations(arr);
    });

    // ✅ كل الكاش لكل المستخدمين
    const cashQ = query(collection(db, 'cash'));
    const unsubCash = onSnapshot(cashQ, (qs) => {
      let totalCash = 0;
      qs.forEach((doc) => {
        totalCash += Number(doc.data().cashVal || 0);
      });
      setCash(totalCash);
    });

    return () => {
      try { unsubNum(); } catch (e) {}
      try { unsubOp(); } catch (e) {}
      try { unsubCash(); } catch (e) {}
    };
  }, []);

  // CALCULATE PROFIT, WALLET TOTAL, CAPITAL
  useEffect(() => {
    const subTotal = operations.reduce((acc, op) => acc + Number(op.commation || 0), 0);
    const walletTotal = nums.reduce((acc, n) => acc + Number(n.amount || 0), 0);
    setProfit(subTotal);
    setWallet(walletTotal);
    setCapital(walletTotal + Number(cash || 0) + subTotal);
  }, [operations, nums, cash]);

  const formatValue = (value) => hideAmounts ? "***" : `${value}.00 جنية`;

  const formatDate = (createdAt) => {
    if (!createdAt) return "-";
    try {
      if (typeof createdAt.toDate === "function") {
        return createdAt.toDate().toLocaleString("ar-EG");
      }
      if (createdAt.seconds) {
        return new Date(createdAt.seconds * 1000).toLocaleString("ar-EG");
      }
      return new Date(createdAt).toLocaleString("ar-EG");
    } catch (e) {
      return "-";
    }
  };

// handle delete
const handelDelete = async (id) => {
  try {
    const confirmDelete = window.confirm("هل أنت متأكد من حذف العملية؟");
    if (!confirmDelete) return;

    // 1) جلب العملية
    const opRef = doc(db, "operations", id);
    const opSnap = await getDoc(opRef);
    if (!opSnap.exists()) {
      alert("⚠️ العملية غير موجودة.");
      return;
    }
    const op = opSnap.data();

    // 2) قيم مرنة مع fallbacks
    const type = (op.type || "").toString();
    const phone = op.phone ?? op.number ?? op.phoneNumber ?? null;
    const value = Number(op.operationVal ?? op.operationValue ?? op.amount ?? op.value ?? 0);

    if (!phone) {
      const proceed = window.confirm(
        "العملية غير مرتبطة برقم واضح. حذفها سيؤدي فقط إلى إزالة السجل بدون تعديل الأرصدة. تابع؟"
      );
      if (!proceed) return;
      await deleteDoc(opRef);
      alert("✅ تم حذف العملية.");
      return;
    }

    if (!value || isNaN(value)) {
      alert("⚠️ قيمة العملية غير صالحة، لا يمكن الاستمرار.");
      return;
    }

    // 3) إيجاد مستند الرقم من collection 'numbers' (نبحث محلياً عبر getDocs)
    const numbersSnap = await getDocs(collection(db, "numbers"));
    const numberDocSnap = numbersSnap.docs.find((d) => {
      const data = d.data();
      return data.phone === phone || data.phoneNumber === phone;
    });

    if (!numberDocSnap) {
      const proceed = window.confirm(
        "لم يتم العثور على الخط المرتبط بهذه العملية. هل تريد حذف العملية بدون تعديل الأرصدة؟"
      );
      if (!proceed) return;
      await deleteDoc(opRef);
      alert("✅ تم حذف العملية (بدون تعديل الأرصدة لأن الخط غير موجود).");
      return;
    }

    const numberRef = doc(db, "numbers", numberDocSnap.id);
    const numberData = numberDocSnap.data();
    const numberAmount = Number(numberData.amount ?? 0);
    const numberWithdrawLimit = Number(numberData.withdrawLimit ?? 0);
    const numberDaily = Number(numberData.dailyWithdraw ?? numberData.daily ?? 0);

    // 4) إيجاد مستند cash (نأخذ أول مستند إن وُجد)
    const cashSnap = await getDocs(collection(db, "cash"));
    const cashDocSnap = cashSnap.docs[0] ?? null;
    let cashRef = cashDocSnap ? doc(db, "cash", cashDocSnap.id) : null;
    let cashVal = cashDocSnap ? Number(cashDocSnap.data().cashVal ?? cashDocSnap.data().cash ?? 0) : 0;

    // 5) حساب التعديلات العكسية حسب النوع
    const t = type.toLowerCase();

    let newNumberAmount = numberAmount;
    let newWithdrawLimit = numberWithdrawLimit;
    let newDaily = numberDaily;
    let newCashVal = cashVal;

    if (t.includes("استلام") || t.includes("receive")) {
      // عند حذف "استلام" : اقلل قيمة العملية من الخط و ازودها في الكاش
      newNumberAmount = numberAmount - value;
      newWithdrawLimit = numberWithdrawLimit - value;
      newDaily = numberDaily - value;
      newCashVal = cashVal + value;
    } else if (t.includes("ارسال") || t.includes("send")) {
      // عند حذف "ارسال" : ازود قيمة العملية في الخط و اقللها من الكاش
      newNumberAmount = numberAmount + value;
      newWithdrawLimit = numberWithdrawLimit + value;
      newDaily = numberDaily + value;
      newCashVal = cashVal - value;
    } else {
      const proceed = window.confirm(
        "نوع العملية غير معروف. حذفها سيجري بدون تعديل الأرصدة. هل تريد المتابعة وحذف السجل فقط؟"
      );
      if (!proceed) return;
      await deleteDoc(opRef);
      alert("✅ تم حذف العملية (نوع غير معروف — لم يتم تعديل الأرصدة).");
      return;
    }

    // 6) منع رصيد سالب (يمكن تغيير السلوك لطلب تأكيد بدلاً من الإيقاف)
    if (newNumberAmount < 0) {
      alert("⚠️ لا يمكن حذف العملية لأن ذلك سيجعل رصيد الخط بالسالب. عدّل الرصيد أو راجع العملية أولاً.");
      return;
    }
    if (newCashVal < 0) {
      alert("⚠️ لا يمكن حذف العملية لأن ذلك سيجعل رصيد الكاش بالسالب. عدّل الكاش أو راجع العملية أولاً.");
      return;
    }

    // 7) تنفيذ التحديثات على المستندات
    await updateDoc(numberRef, {
      amount: newNumberAmount,
      withdrawLimit: newWithdrawLimit,
      dailyWithdraw: newDaily,
    });

    if (cashRef) {
      await updateDoc(cashRef, { cashVal: newCashVal });
    } else {
      // لو مفيش مستند cash اصلاً، ننشئ واحد
      await addDoc(collection(db, "cash"), {
        cashVal: newCashVal,
        createdAt: serverTimestamp(),
      });
    }

    // 8) حذف العملية نفسها
    await deleteDoc(opRef);

    alert("✅ تم حذف العملية واسترجاع القيم بنجاح.");
  } catch (err) {
    console.error("❌ خطأ أثناء حذف العملية:", err);
    alert("❌ حدث خطأ أثناء حذف العملية. راجع الكونسول للمزيد من التفاصيل.");
  }
};



  // DELETE DAY
  const handelDeleteDay = async () => {
    const confirmDelete = window.confirm("هل أنت متأكد من تقفيل اليوم؟ سيتم نقل العمليات إلى الأرشيف ومسحها من القائمة.");
    if (!confirmDelete) return;
    try {
      const opQ = query(collection(db, 'operations'));
      const querySnapshot = await getDocs(opQ);
      if (querySnapshot.empty) {
        alert("لا توجد عمليات اليوم.");
        return;
      }
      for (const docSnap of querySnapshot.docs) {
        const data = docSnap.data();
        await addDoc(collection(db, 'reports'), { ...data, archivedAt: new Date().toISOString() });
        await deleteDoc(doc(db, 'operations', docSnap.id));
      }
      alert("تم تقفيل اليوم بنجاح ✅");
    } catch (error) {
      console.error("Error during end of day operations:", error);
      alert("حدث خطأ أثناء تقفيل اليوم ❌");
    }
  };

  return (
    <div className={styles.main}>
      <Wallet openWallet={openWallet} setOpenWallet={setOpenWallet} />
      <Cash openCash={openCash} setOpenCash={setOpenCash} />
      <Nav />
      <div className={styles.title}>
        <div className={styles.text}>
          {userEmail === "gamalaaaa999@gmail.com" ? 
           <Image src={abod} className={styles.avatar} alt="avatar" /> :
           <Image src={avatar} className={styles.avatar} alt="avatar" />
           }
          <h2>مرحبا, <br /> {userName} 👋</h2>
        </div>
        <div className={styles.leftActions}>
           <button onClick={() => setHideAmounts(!hideAmounts)} title="إظهار/إخفاء الأرصدة">
            {hideAmounts ? <FaEyeSlash /> : <FaEye />}
          </button>
          <label className="switch">
            <span className="sun">🌞</span>
            <span className="moon">🌙</span>
            <input
              type="checkbox"
              className="input"
              onChange={toggleTheme}
              checked={theme === 'dark'}
            />
            <span className="slider"></span>
          </label>
        </div>
      </div>

      <div className={styles.balanceContainer}>
        <div className={styles.balanceCard}>
          <div className={styles.totalBalance}><p>رأس المال</p><p>{formatValue(capital)}</p></div>
          <div className={styles.balanceContent}>
            <div className={styles.balanceHead}><p>المتاح بالمحافظ</p><p>{formatValue(wallet)}</p></div>
            <div className={styles.balanceHead}><p>الارباح</p><p>{formatValue(profit)}</p></div>
            <div className={styles.balanceHead}><p>المتاح النقدي</p><p>{formatValue(cash)}</p></div>
          </div>
          <div className={styles.balanceBtns}>
            <button onClick={() => setOpenCash(true)}><span><FaArrowUp /></span><span>ارسال</span></button>
            <button onClick={() => setOpenWallet(true)}><span><FaArrowDown /></span><span>استلام</span></button>
            <button onClick={() => router.push('/Numbers')}><span><BiMemoryCard /></span><span>الخطوط</span></button>
          </div>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.contentTitle}>
          <h2>العمليات اليومية</h2>
          <button onClick={handelDeleteDay} title="تقفيل اليوم"><FaArchive /></button>
        </div>
        <div className={styles.operations}>
          <table>
            <thead>
              <tr>
                <th>المستخدم</th>
                <th>الرقم</th>
                <th>العملية</th>
                <th>المبلغ</th>
                <th>العمولة</th>
                <th>المرسل اليه</th>
                <th>ملاحظات</th>
                <th>التاريخ</th>
                <th>حذف</th>
              </tr>
            </thead>
            <tbody>
              {operations.length > 0 ? (
                operations.map((operation) => (
                  <tr key={operation.id}>
                    <td>{operation.userName || "-"}</td>
                    <td>{operation.phone || "-"}</td>
                    <td>{operation.type || "-"}</td>
                    <td>{operation.operationVal ? `${operation.operationVal} جنية` : "-"}</td>
                    <td>{operation.commation ? `${operation.commation} جنية` : "-"}</td>
                    <td>{operation.receiver || "-"}</td>
                    <td>{operation.notes || "-"}</td>
                    <td>{formatDate(operation.createdAt)}</td>
                    <td>
                      <button className={styles.action} onClick={() => handelDelete(operation.id)} title="حذف العملية">
                        <FaRegTrashAlt />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" style={{ textAlign: "center" }}>لا توجد عمليات اليوم</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Main;
