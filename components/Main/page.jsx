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
        const currentUserDoc = snapshot.docs.find(docSnap => docSnap.data().email === email);
        if (!currentUserDoc) {
          router.push('/');
          return;
        }
        const data = currentUserDoc.data();

        // التحقق من صلاحية الحذف
        setAuthorizedDelete(data.canDeleteOperations === true);

        // التحقق من lockMoney
        if (data.lockMoney) {
          if (data.canViewMoney) {
            // المستخدم لديه صلاحية مشاهدة الأرصدة
            const input = prompt("🚫 تم قفل الأرصدة\nمن فضلك أدخل كلمة المرور:");
            if (input === data.lockPassword) {
              setHideAmounts(false);
            } else {
              alert("❌ كلمة المرور غير صحيحة، سيتم إخفاء الأرصدة تلقائياً");
              setHideAmounts(true);
            }
          } else {
            // المستخدم **ليس له صلاحية مشاهدة الأرصدة** → نجوم مباشرة
            setHideAmounts(true);
          }
        }

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
    // باقي كود الحذف كما هو
    // ...
  };

  // DELETE DAY
  const handelDeleteDay = async () => {
    if (!authorizedDelete) {
      alert("🚫 ليس لديك صلاحية لتقفيل اليوم.");
      return;
    }
    // باقي كود تقفيل اليوم كما هو
    // ...
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
                      {authorizedDelete ? (
                        <button className={styles.action} onClick={() => handelDelete(operation.id)} title="حذف العملية">
                          <FaRegTrashAlt />
                        </button>
                      ) : (
                        <span style={{ opacity: 0.3 }}>🚫</span>
                      )}
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
