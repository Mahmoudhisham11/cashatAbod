'use client';
import { useEffect, useRef, useState } from "react";
import styles from "./styles.module.css";
import avatar from "../../public/image/Avatar-Profile-Vector-removebg-preview.png";
import Image from "next/image";
import { FaArrowUp, FaArrowDown, FaRegTrashAlt } from "react-icons/fa";
import { BiMemoryCard } from "react-icons/bi";
import { RiLogoutCircleLine } from "react-icons/ri";
import { MdDarkMode, MdLightMode } from "react-icons/md";
import Nav from "../Nav/page";
import Wallet from "../Wallet/page";
import Cash from "../Cash/page";
import abod from "../../public/image/TXSC8094.JPG"
import EmptyState from "../ui/EmptyState";
import SkeletonRows from "../ui/SkeletonRows";
import ConfirmDialog from "../ui/ConfirmDialog";
import { useToast } from "../ui/ToastProvider";
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
  serverTimestamp,
  where
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
  const [lockDaily, setLockDaily] = useState(false); // لتفعيل قفل حذف اليوم
  const [confirmDayClose, setConfirmDayClose] = useState(false);
  const [openProfileMenu, setOpenProfileMenu] = useState(false);
  const menuRef = useRef(null);
  const { toast } = useToast();

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

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenProfileMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // GET LOCALSTORAGE DATA + FETCH lockMoney & lockDaily
  useEffect(() => {
    const storageName = localStorage.getItem("name");
    const storageEmail = localStorage.getItem("email");
    if (storageName) {
      setUserName(storageName);
      setUserEmail(storageEmail);
      // جلب lockMoney و lockDaily من Firestore لكل مستخدم مع live updates
      // جلب بيانات المستخدم مع live updates + فحص الاشتراك
const usersQ = query(collection(db, "users"), where("email", "==", storageEmail));
const unsubUser = onSnapshot(
  usersQ,
  (qs) => {
    if (!qs.empty) {
      const userData = qs.docs[0].data();
      setHideAmounts(userData.lockMoney === true);
      setLockDaily(userData.lockDaily === true);

      // ✅ لو المستخدم غير مشترك يتم مسح كل البيانات من localStorage وعمل reload
      if (userData.isSubscribe === false) {
        alert("⚠️ تم إيقاف اشتراكك. سيتم تسجيل الخروج.");
        localStorage.clear();
        window.location.reload();
      }
    }
  },
  (err) => {
    console.error("خطأ في قراءة بيانات المستخدم:", err);
  }
);


      return () => unsubUser();
    }
  }, []);

  // SUBSCRIBE TO NUMBERS / OPERATIONS / CASH (live)
  useEffect(() => {
    const numQ = query(collection(db, "numbers"));
    const unsubNum = onSnapshot(numQ, (qs) => {
      const arr = [];
      qs.forEach(d => arr.push({ ...d.data(), id: d.id }));
      setNums(arr);
    });

    const opQ = query(collection(db, "operations"));
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

    const cashQ = query(collection(db, "cash"));
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

  const operationTypeBadgeClass = (type) => {
    const t = (type || "").toString().toLowerCase();
    if (t.includes("ارسال") || t.includes("send")) return styles.typeBadgeSend;
    if (t.includes("استلام") || t.includes("receive")) return styles.typeBadgeReceive;
    return styles.typeBadgeNeutral;
  };

  const opPhoneOrMachine = (operation) => {
    if (operation.sourceType === "machine" && operation.machineName) {
      return operation.machineName;
    }
    return operation.phone || "-";
  };

  // handle delete
  const handelDelete = async (id) => {
    if (lockDaily) {
      alert("⚠️ لا يمكنك حذف العمليات اليومية، الصلاحية مقفولة.");
      toast("صلاحية الحذف اليومي غير متاحة", "warning");
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

      if (!value || isNaN(value)) {
        toast("قيمة العملية غير صالحة", "error");
        return;
      }

      if (op.sourceType === "machine" && op.machineId) {
        const machineRef = doc(db, "machines", op.machineId);
        const machineSnap = await getDoc(machineRef);
        if (!machineSnap.exists()) {
          const proceed = window.confirm(
            "لم يُعثر على الماكينة. حذف السجل فقط بدون تعديل الأرصدة؟"
          );
          if (!proceed) return;
          await deleteDoc(opRef);
          toast("تم حذف العملية", "success");
          return;
        }

        const machineData = machineSnap.data();
        const machineBalance = Number(machineData.balance ?? 0);
        const t = type.toLowerCase();

        const cashSnap = await getDocs(collection(db, "cash"));
        const cashDocSnap = cashSnap.docs[0] ?? null;
        let cashRef = cashDocSnap ? doc(db, "cash", cashDocSnap.id) : null;
        let cashVal = cashDocSnap ? Number(cashDocSnap.data().cashVal ?? cashDocSnap.data().cash ?? 0) : 0;

        let newMachineBalance = machineBalance;
        let newCashVal = cashVal;

        if (t.includes("استلام") || t.includes("receive")) {
          newMachineBalance = machineBalance - value;
          newCashVal = cashVal + value;
        } else if (t.includes("ارسال") || t.includes("send")) {
          newMachineBalance = machineBalance + value;
          newCashVal = cashVal - value;
        } else {
          const proceed = window.confirm(
            "نوع العملية غير معروف. حذفها سيجري بدون تعديل الأرصدة. تابع؟"
          );
          if (!proceed) return;
          await deleteDoc(opRef);
          toast("تم حذف العملية", "warning");
          return;
        }

        if (newMachineBalance < 0) {
          toast("لا يمكن الحذف لأن رصيد الماكينة سيصبح بالسالب", "error");
          return;
        }
        if (newCashVal < 0) {
          toast("لا يمكن الحذف لأن رصيد الكاش سيصبح بالسالب", "error");
          return;
        }

        await updateDoc(machineRef, { balance: newMachineBalance });

        if (cashRef) {
          await updateDoc(cashRef, { cashVal: newCashVal });
        } else {
          await addDoc(collection(db, "cash"), {
            cashVal: newCashVal,
            createdAt: serverTimestamp(),
          });
        }

        await deleteDoc(opRef);
        toast("تم حذف العملية واسترجاع القيم بنجاح", "success");
        return;
      }

      if (!phone) {
        const proceed = window.confirm(
          "العملية غير مرتبطة برقم واضح. حذفها سيؤدي فقط إلى إزالة السجل بدون تعديل الأرصدة. تابع؟"
        );
        if (!proceed) return;
        await deleteDoc(opRef);
        toast("تم حذف العملية", "success");
        return;
      }

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
        toast("تم حذف العملية بدون تعديل الأرصدة", "warning");
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

      const t = type.toLowerCase();

      let newNumberAmount = numberAmount;
      let newWithdrawLimit = numberWithdrawLimit;
      let newDaily = numberDaily;
      let newCashVal = cashVal;

      if (t.includes("استلام") || t.includes("receive")) {
        newNumberAmount = numberAmount - value;
        newWithdrawLimit = numberWithdrawLimit - value;
        newDaily = numberDaily - value;
        newCashVal = cashVal + value;
      } else if (t.includes("ارسال") || t.includes("send")) {
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

      if (newNumberAmount < 0) {
        toast("لا يمكن الحذف لأن رصيد الخط سيصبح بالسالب", "error");
        return;
      }
      if (newCashVal < 0) {
        toast("لا يمكن الحذف لأن رصيد الكاش سيصبح بالسالب", "error");
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
          createdAt: serverTimestamp(),
        });
      }

      await deleteDoc(opRef);

      toast("تم حذف العملية واسترجاع القيم بنجاح", "success");
    } catch (err) {
      console.error("❌ خطأ أثناء حذف العملية:", err);
      toast("حدث خطأ أثناء حذف العملية", "error");
    }
  };

  // DELETE DAY
  const handelDeleteDay = async () => {
    if (lockDaily) {
      alert("⚠️ لا يمكنك تقفيل اليوم، صلاحية الحذف مقفولة.");
      return;
    }
    setConfirmDayClose(true);
  };

  const confirmCloseDayAction = async () => {
    setConfirmDayClose(false);
    try {
      const opQ = query(collection(db, "operations"));
      const querySnapshot = await getDocs(opQ);
      if (querySnapshot.empty) {
        toast("لا توجد عمليات اليوم", "warning");
        return;
      }
      for (const docSnap of querySnapshot.docs) {
        const data = docSnap.data();
        await addDoc(collection(db, "reports"), {
          ...data,
          archivedAt: new Date().toISOString(),
        });
        await deleteDoc(doc(db, "operations", docSnap.id));
      }
      toast("تم تقفيل اليوم بنجاح", "success");
    } catch (error) {
      console.error("Error during end of day operations:", error);
      toast("حدث خطأ أثناء تقفيل اليوم", "error");
    }
  };
    // 🔹 تسجيل خروج
  const handleLogout = () => {
    localStorage.clear();
    window.location.reload()
  };

  return (
    <div className={styles.main}>
      <ConfirmDialog
        open={confirmDayClose}
        title="تقفيل اليوم"
        description="سيتم نقل العمليات الحالية إلى التقارير وحذفها من اليومية. هل تريد المتابعة؟"
        confirmText="تقفيل اليوم"
        danger
        onClose={() => setConfirmDayClose(false)}
        onConfirm={confirmCloseDayAction}
      />
      <Wallet openWallet={openWallet} setOpenWallet={setOpenWallet} />
      <Cash openCash={openCash} setOpenCash={setOpenCash} />
      <Nav />
      <div className={styles.title}>
        <div className={styles.text}>
          <div className={styles.profileMenuWrap} ref={menuRef}>
            <button
              className={styles.avatarBtn}
              onClick={() => setOpenProfileMenu((prev) => !prev)}
              aria-expanded={openProfileMenu}
              aria-haspopup="menu"
            >
              {userEmail === "gamalaaaa999@gmail.com" ? 
                <Image src={abod} className={styles.avatar} alt="avatar" /> :
                <Image src={avatar} className={styles.avatar} alt="avatar" />
              }
            </button>
            <div className={`${styles.profileDropdown} ${openProfileMenu ? styles.open : ""}`}>
              <button onClick={toggleTheme}>
                <span>{theme === "dark" ? <MdLightMode /> : <MdDarkMode />}</span>
                <span>{theme === "dark" ? "الوضع الفاتح" : "الوضع الداكن"}</span>
              </button>
              <button onClick={handleLogout}>
                <span><RiLogoutCircleLine /></span>
                <span>تسجيل الخروج</span>
              </button>
            </div>
          </div>
          <h2>مرحبا, <br /> {userName} 👋</h2>
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.dayCloseBtn}
            onClick={handelDeleteDay}
            title={lockDaily ? "لا يمكن حذف اليوم" : "تقفيل اليوم"}
            disabled={lockDaily}
          >
            تقفيل اليوم
          </button>
        </div>
      </div>

      <div className={styles.balanceContainer}>
        <div className={styles.balanceCard}>
          <div className={styles.totalBalance}>
            <p>رأس المال</p>
            <p>{hideAmounts ? "***" : `${capital}.00 جنية`}</p>
          </div>
          <div className={styles.balanceContent}>
            <div className={styles.balanceHead}>
              <p>عمليات اليوم</p>
              <p>{operations.length}</p>
            </div>
            <div className={styles.balanceHead}>
              <p>المتاح بالمحافظ</p>
              <p>{hideAmounts ? "***" : `${wallet}.00 جنية`}</p>
            </div>
            <div className={styles.balanceHead}>
              <p>الارباح</p>
              <p>{hideAmounts ? "***" : `${profit}.00 جنية`}</p>
            </div>
            <div className={styles.balanceHead}>
              <p>المتاح النقدي</p>
              <p>{hideAmounts ? "***" : `${cash}.00 جنية`}</p>
            </div>
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
        </div>
        <div className={styles.operations}>
          {!operations.length && <EmptyState title="لا توجد عمليات يومية" description="ابدأ بعملية ارسال أو استلام من الأزرار السريعة." />}
          {!userName && <SkeletonRows rows={3} />}
          <div className={styles.operationsTable}>
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
                      <td>{opPhoneOrMachine(operation)}</td>
                      <td>{operation.type || "-"}</td>
                      <td>{hideAmounts ? "***" : operation.operationVal ? `${operation.operationVal} جنية` : "-"}</td>
                      <td>{hideAmounts ? "***" : operation.commation ? `${operation.commation} جنية` : "-"}</td>
                      <td>{operation.receiver || "-"}</td>
                      <td>{operation.notes || "-"}</td>
                      <td>{formatDate(operation.createdAt)}</td>
                      <td>
                        <button
                          className={styles.action}
                          onClick={() => handelDelete(operation.id)}
                          title={lockDaily ? "محظور: القفل اليومي مفعل" : "حذف العملية"}
                          disabled={lockDaily}
                          style={{ cursor: lockDaily ? "not-allowed" : "pointer", opacity: lockDaily ? 0.5 : 1 }}
                        >
                          <FaRegTrashAlt />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  null
                )}
              </tbody>
            </table>
          </div>
          <div className={styles.operationsCards}>
            {operations.length > 0 &&
              operations.map((operation) => (
                <article key={operation.id} className={styles.opCard}>
                  <div className={styles.opCardHeader}>
                    <span className={operationTypeBadgeClass(operation.type)}>
                      {operation.type || "-"}
                    </span>
                    <button
                      type="button"
                      className={styles.action}
                      onClick={() => handelDelete(operation.id)}
                      title={lockDaily ? "محظور: القفل اليومي مفعل" : "حذف العملية"}
                      disabled={lockDaily}
                      style={{ cursor: lockDaily ? "not-allowed" : "pointer", opacity: lockDaily ? 0.5 : 1 }}
                    >
                      <FaRegTrashAlt />
                    </button>
                  </div>
                  <div className={styles.opCardAmounts}>
                    <div className={styles.opCardAmountBlock}>
                      <span>المبلغ</span>
                      <strong>{hideAmounts ? "***" : operation.operationVal ? `${operation.operationVal} جنية` : "-"}</strong>
                    </div>
                    <div className={styles.opCardAmountBlock}>
                      <span>العمولة</span>
                      <strong>{hideAmounts ? "***" : operation.commation ? `${operation.commation} جنية` : "-"}</strong>
                    </div>
                  </div>
                  <dl className={styles.opCardMeta}>
                    <div className={styles.opCardRow}>
                      <dt>المستخدم</dt>
                      <dd>{operation.userName || "-"}</dd>
                    </div>
                    <div className={styles.opCardRow}>
                      <dt>الرقم</dt>
                      <dd>{opPhoneOrMachine(operation)}</dd>
                    </div>
                    <div className={styles.opCardRow}>
                      <dt>المرسل إليه</dt>
                      <dd>{operation.receiver || "-"}</dd>
                    </div>
                    <div className={styles.opCardRow}>
                      <dt>ملاحظات</dt>
                      <dd>{operation.notes || "-"}</dd>
                    </div>
                  </dl>
                  <p className={styles.opCardDate}>{formatDate(operation.createdAt)}</p>
                </article>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Main;
