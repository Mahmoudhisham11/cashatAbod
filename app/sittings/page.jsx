'use client';
import styles from "./styles.module.css";
import Link from "next/link";
import { useEffect, useState } from "react";
import { MdOutlineKeyboardArrowLeft } from "react-icons/md";
import { GiMoneyStack } from "react-icons/gi";
import { MdKeyboardArrowLeft } from "react-icons/md";
import { RiLogoutCircleLine } from "react-icons/ri";
import { BsPersonVideo2 } from "react-icons/bs";
import { CiLock } from "react-icons/ci";
import { useRouter } from "next/navigation";
import CashPop from "../../components/CashPop/page";
import Developer from "../../components/Developer/page";
import { db } from "../../app/firebase";
import { collection, doc, getDoc, getDocs, updateDoc, deleteDoc } from "firebase/firestore";

function Sittings() {
  const router = useRouter();
  const [openCash, setOpenCash] = useState(false);
  const [openDev, setOpenDev] = useState(false);
  const [openPermissions, setOpenPermissions] = useState(false);
  const [openActivations, setOpenActivations] = useState(false);
  const [userName, setUserName] = useState('');
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [locks, setLocks] = useState({
    reports: false,
    numbers: false,
    money: false,
    cash: false,
    daily: false,
    settings: false,
    debts: false
  });
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSubscribe, setIsSubscribe] = useState(true);

  // 🔹 التحقق من صلاحية الدخول
  useEffect(() => {
    const checkLock = async () => {
      const email = localStorage.getItem("email");
      if (!email) {
        router.push('/');
        return;
      }

      const snapshot = await getDocs(collection(db, "users"));
      const currentUserDoc = snapshot.docs.find(doc => doc.data().email === email);

      if (!currentUserDoc) {
        router.push('/');
        return;
      }

      const data = currentUserDoc.data();

      if (data.lockSettings) {
        alert("🚫 ليس لديك صلاحية لدخول الصفحة");
        router.push('/');
        return;
      }

      setAuthorized(true);
      setLoading(false);
    };

    checkLock();
  }, [router]);

  // 🔹 تحميل اسم المستخدم
  useEffect(() => {
    const storageName = localStorage.getItem('name');
    if (storageName) setUserName(storageName);
  }, []);

  // 🔹 تحميل كل المستخدمين
  useEffect(() => {
    const fetchUsers = async () => {
      const snapshot = await getDocs(collection(db, "users"));
      const usersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersList);
    };
    fetchUsers();
  }, []);

  // 🔹 تحميل صلاحيات المستخدم
  useEffect(() => {
    if (!selectedUserId) return;

    const fetchUserData = async () => {
      const userSnap = await getDoc(doc(db, "users", selectedUserId));
      if (userSnap.exists()) {
        const data = userSnap.data();
        setLocks({
          reports: data.lockReports || false,
          numbers: data.lockNumbers || false,
          money: data.lockMoney || false,
          cash: data.lockCash || false,
          daily: data.lockDaily || false,
          settings: data.lockSettings || false,
          debts: data.lockDebts || false,
        });
        setIsSubscribe(data.isSubscribe !== false); // افتراضي مشترك لو مش موجود
      }
    };

    fetchUserData();
  }, [selectedUserId]);


  // 🔹 تحديث الصلاحيات
  const handleLockUpdate = async () => {
    if (!selectedUserId) {
      alert("⚠️ من فضلك اختر مستخدم أولاً");
      return;
    }

    const userRef = doc(db, "users", selectedUserId);
    const updateData = {
      lockReports: locks.reports,
      lockNumbers: locks.numbers,
      lockMoney: locks.money,
      lockCash: locks.cash,
      lockDaily: locks.daily,
      lockSettings: locks.settings,
      lockDebts: locks.debts
    };
    await updateDoc(userRef, updateData);

    alert("✅ تم تحديث صلاحيات المستخدم");
    setOpenPermissions(false);
  };

  // 🔹 تحديث حالة الاشتراك
  const handleActivationUpdate = async () => {
    if (!selectedUserId) {
      alert("⚠️ اختر مستخدم أولاً");
      return;
    }

    const userRef = doc(db, "users", selectedUserId);
    await updateDoc(userRef, { isSubscribe });
    alert("✅ تم تحديث حالة الاشتراك");
    setOpenActivations(false);
  };

  // 🔹 حذف المستخدم
  const handleDeleteUser = async () => {
    if (!selectedUserId) {
      alert("⚠️ اختر مستخدم أولاً");
      return;
    }

    const confirmDelete = window.confirm("⚠️ هل أنت متأكد من حذف هذا المستخدم نهائيًا؟");
    if (!confirmDelete) return;

    await deleteDoc(doc(db, "users", selectedUserId));
    alert("✅ تم حذف المستخدم بنجاح");
    setUsers(prev => prev.filter(u => u.id !== selectedUserId));
    setSelectedUserId("");
    setOpenActivations(false);
  };

  if (loading) return <p>جاري التحقق...</p>;
  if (!authorized) return null;

  return (
    <div className="main">
      <Developer openDev={openDev} setOpenDev={setOpenDev} />
      <CashPop openCash={openCash} setOpenCash={setOpenCash} />

      {/* 🔹 Popup تعديل الصلاحيات */}
      {openPermissions && (
        <div className={styles.popupOverlay} onClick={() => setOpenPermissions(false)}>
          <div className={styles.popupContent} onClick={(e) => e.stopPropagation()}>
            <h3>تعديل الصلاحيات</h3>
            <label>اختر مستخدم:</label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
            >
              <option value="">-- اختر مستخدم --</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>
                  {user.name || user.email}
                </option>
              ))}
            </select>

            {selectedUserId && (
              <>
                <div className={styles.locks}>
                  {Object.keys(locks).map(key => (
                    <label key={key}>
                      <input
                        type="checkbox"
                        checked={locks[key]}
                        onChange={() => setLocks(prev => ({ ...prev, [key]: !prev[key] }))}
                      />
                      {`اقفال ${key === 'numbers' ? 'الخطوط' : key}`}
                    </label>
                  ))}
                </div>

                <button className={styles.saveBtn} onClick={handleLockUpdate}>
                  حفظ التعديلات
                </button>
              </>
            )}
            <button className={styles.closeBtn} onClick={() => setOpenPermissions(false)}>إغلاق</button>
          </div>
        </div>
      )}

      {/* 🔹 Popup تفعيلات المستخدمين */}
      {openActivations && (
        <div className={styles.popupOverlay} onClick={() => setOpenActivations(false)}>
          <div className={styles.popupContent} onClick={(e) => e.stopPropagation()}>
            <h3>تفعيلات المستخدمين</h3>
            <label>اختر مستخدم:</label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
            >
              <option value="">-- اختر مستخدم --</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>
                  {user.name || user.email}
                </option>
              ))}
            </select>

            {selectedUserId && (
              <>
                <div className={styles.locks}>
                  <label>
                    <input
                      type="checkbox"
                      checked={isSubscribe}
                      onChange={() => setIsSubscribe(prev => !prev)}
                    />
                    {isSubscribe ? "🔓 مفعل" : "🔒 غير مفعل"}
                  </label>
                </div>

                <button className={styles.saveBtn} onClick={handleActivationUpdate}>
                  حفظ التفعيل
                </button>

                <button
                  className={styles.deleteBtn}
                  style={{ background: "#d9534f", color: "#fff", marginTop: "10px" }}
                  onClick={handleDeleteUser}
                >
                  حذف المستخدم
                </button>
              </>
            )}

            <button className={styles.closeBtn} onClick={() => setOpenActivations(false)}>إغلاق</button>
          </div>
        </div>
      )}

      <div className={styles.sittingsContainer}>
        <div className="header">
          <h2>الاعدادات</h2>
          <Link href={"/"} className="headerLink"><MdOutlineKeyboardArrowLeft /></Link>
        </div>

        <div className={styles.content}>
          <div className={styles.accContainer}>
            <h2>تفاصيل الملف الشخصي</h2>
            <div className={styles.btnsContainer}>
              <div className={styles.btnContent}>
                <button onClick={() => setOpenCash(true)}>
                  <span><GiMoneyStack /></span>
                  <span>تعديل النقدي</span>
                </button>
                <p><MdKeyboardArrowLeft /></p>
              </div>
              <hr />
              <div className={styles.btnContent}>
                <button onClick={() => setOpenPermissions(true)}>
                  <span><CiLock /></span>
                  <span>الصلاحيات</span>
                </button>
                <p><MdKeyboardArrowLeft /></p>
              </div>
              <hr />
              <div className={styles.btnContent}>
                <button onClick={() => setOpenActivations(true)}>
                  <span><CiLock /></span>
                  <span>تفعيلات المستخدمين</span>
                </button>
                <p><MdKeyboardArrowLeft /></p>
              </div>
            </div>
          </div>

          <div className={styles.helpContainer}>
            <h2>المساعدة و الدعم الفني</h2>
            <div className={styles.btnsContainer}>
              <div className={styles.btnContent}>
                <button onClick={() => setOpenDev(true)}>
                  <span><BsPersonVideo2 /></span>
                  <span>تواصل مع المطور</span>
                </button>
                <p><MdKeyboardArrowLeft /></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Sittings;
