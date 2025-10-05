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
  const [authorizedDelete, setAuthorizedDelete] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);

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

  // GET USER DATA & CHECK LOCKS
  useEffect(() => {
    const checkUser = async () => {
      const email = localStorage.getItem("email");
      const name = localStorage.getItem("name");
      if (!email) {
        router.push('/');
        return;
      }
      setUserEmail(email);
      setUserName(name || "");

      const snapshot = await getDocs(collection(db, "users"));
      if (!snapshot.empty) {
        // البحث عن المستخدم الحالي فقط
        const currentUserDoc = snapshot.docs.find(docSnap => docSnap.data().email === email);
        if (!currentUserDoc) {
          router.push('/');
          return;
        }
        const data = currentUserDoc.data();

        // التحقق من lockMoney
        if (data.lockMoney) {
          const input = prompt("🚫 تم قفل الأرصدة\nمن فضلك أدخل كلمة المرور:");
          if (input === data.lockPassword) {
            setHideAmounts(false);
          } else {
            alert("❌ كلمة المرور غير صحيحة، سيتم إخفاء الأرصدة تلقائياً");
            setHideAmounts(true);
          }
        }

        // التحقق من صلاحية الحذف
        setAuthorizedDelete(data.canDeleteOperations === true);

      } else {
        router.push('/');
      }

      setLoadingAuth(false);
    };

    checkUser();
  }, []);

  // SUBSCRIBE TO NUMBERS / OPERATIONS / CASH (live)
  useEffect(() => {
    if (!userEmail) return;

    const numQ = query(collection(db, 'numbers'));
    const unsubNum = onSnapshot(numQ, (qs) => {
      const arr = [];
      qs.forEach(d => arr.push({ ...d.data(), id: d.id }));
      setNums(arr);
    });

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
  }, [userEmail]);

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
    if (!authorizedDelete) {
      alert("🚫 ليس لديك صلاحية لحذف العمليات.");
      return;
    }
    try {
      const confirmDelete = window.confirm("هل أنت متأكد من حذف العملية؟");
      if (!confirmDelete) return;

      const opRef = doc(db, "operations", id);
      const opSnap = await getDoc(opRef);
      if (!opSnap.exists()) {
        alert("⚠️ العملية غير موجودة.");
        return;
      }
      const op = opSnap.data();

      const type = (op.type || "").toString();
      const phone = op.phone ?? op.number ?? op.phoneNumber ?? null;
      const value = Number(op.operationVal ?? op.operationValue ?? op.amount ?? op.value ?? 0);

      if (!phone || !value || isNaN(value)) {
        await deleteDoc(opRef);
        alert("✅ تم حذف العملية بدون تعديل الأرصدة (غير مرتبطة برقم أو قيمة غير صالحة).");
        return;
      }

      // إيجاد مستند الرقم المرتبط
      const numbersSnap = await getDocs(collection(db, "numbers"));
      const numberDocSnap = numbersSnap.docs.find((d) => {
        const data = d.data();
        return data.phone === phone || data.phoneNumber === phone;
      });

      if (!numberDocSnap) {
        const proceed = window.confirm(
          "لم يتم العثور على الخط المرتبط بهذه العملية. حذفها فقط؟"
        );
        if (!proceed) return;
        await deleteDoc(opRef);
        alert("✅ تم حذف العملية بدون تعديل الأرصدة.");
        return;
      }

      const numberRef = doc(db, "numbers", numberDocSnap.id);
      const numberData = numberDocSnap.data();
      const numberAmount = Number(numberData.amount ?? 0);
      const numberWithdrawLimit = Number(numberData.withdrawLimit ?? 0);
      const numberDaily = Number(numberData.dailyWithdraw ?? numberData.daily ?? 0);

      const cashSnap = await getDocs(collection(db, "cash"));
      const cashDocSnap = cashSnap.docs[0] ?? null;
      let cashRef = cashDocSnap ? doc(db, "cash", cashDocSnap.id) : null;
      let cashVal = cashDocSnap ? Number(cashDocSnap.data().cashVal ?? cashDocSnap.data().cash ?? 0) : 0;

      let newNumberAmount = numberAmount;
      let newWithdrawLimit = numberWithdrawLimit;
      let newDaily = numberDaily;
      let newCashVal = cashVal;

      if (type.toLowerCase().includes("استلام") || type.toLowerCase().includes("receive")) {
        newNumberAmount = numberAmount - value;
        newWithdrawLimit = numberWithdrawLimit - value;
        newDaily = numberDaily - value;
        newCashVal = cashVal + value;
      } else if (type.toLowerCase().includes("ارسال") || type.toLowerCase().includes("send")) {
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

      if (newNumberAmount < 0 || newCashVal < 0) {
        alert("⚠️ لا يمكن حذف العملية لأنها ستؤدي إلى رصيد سالب.");
        return;
      }

      await updateDoc(numberRef, {
        amount: newNumberAmount,
        withdrawLimit: newWithdrawLimit,
        dailyWithdraw: newDaily,
      });

      if (cashRef) {
        await updateDoc(cashRef, { cashVal: newCashVal });
      } else {
        await addDoc(collection(db, "cash"), {
          cashVal: newCashVal,
          createdAt: new Date(),
        });
      }

      await deleteDoc(opRef);
      alert("✅ تم حذف العملية واسترجاع القيم بنجاح.");
    } catch (err) {
      console.error("❌ خطأ أثناء حذف العملية:", err);
      alert("❌ حدث خطأ أثناء حذف العملية. راجع الكونسول للمزيد من التفاصيل.");
    }
  };

  // DELETE DAY
  const handelDeleteDay = async () => {
    if (!authorizedDelete) {
      alert("🚫 ليس لديك صلاحية لتقفيل اليوم.");
      return;
    }
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

  if (loadingAuth) return <p>جاري التحقق من الصلاحيات...</p>;

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
