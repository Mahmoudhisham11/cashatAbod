'use client';

import styles from "../Numbers/styles.module.css";
import mainListStyles from "../../components/Main/styles.module.css";
import Link from "next/link";
import { useEffect, useState } from "react";
import { MdOutlineKeyboardArrowLeft, MdModeEditOutline } from "react-icons/md";
import { FaTrashAlt } from "react-icons/fa";
import { useRouter } from "next/navigation";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
  updateDoc,
  serverTimestamp,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebase";
import EmptyState from "../../components/ui/EmptyState";
import { useToast } from "../../components/ui/ToastProvider";

function Machines() {
  const router = useRouter();
  const { toast } = useToast();

  const [userEmail, setUserEmail] = useState("");
  const [currentShop, setCurrentShop] = useState("");
  const [machines, setMachines] = useState([]);
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const [active, setActive] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [editId, setEditId] = useState(null);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  const btns = ["اضف ماكينة جديدة", "كل الماكينات"];

  useEffect(() => {
    const checkLock = async () => {
      const email = localStorage.getItem("email");
      const shop = localStorage.getItem("shop");
      setUserEmail(email);
      if (!email) {
        router.push("/");
        return;
      }
      if (!shop) {
        alert("⚠️ لا يوجد فرع محدد للحساب");
        router.push("/");
        return;
      }
      setCurrentShop(shop);

      const userQ = query(
        collection(db, "users"),
        where("email", "==", email),
        where("shop", "==", shop)
      );
      const snapshot = await getDocs(userQ);
      const currentUserDoc = snapshot.docs[0];

      if (!currentUserDoc) {
        router.push("/");
        return;
      }

      const userData = currentUserDoc.data();

      if (userData.lockMachines) {
        alert("🚫 لا تملك صلاحية الدخول لهذه الصفحة");
        router.push("/");
        return;
      }
      setAuthorized(true);
      setLoading(false);
    };

    checkLock();
  }, [router]);

  useEffect(() => {
    if (!userEmail || !authorized || !currentShop) return;

    const q = query(
      collection(db, "machines"),
      where("userEmail", "==", userEmail),
      where("shop", "==", currentShop)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const arr = [];
        snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
        arr.sort((a, b) => {
          const sa = a.createdAt?.seconds ?? a.createdAt?._seconds ?? 0;
          const sb = b.createdAt?.seconds ?? b.createdAt?._seconds ?? 0;
          return sb - sa;
        });
        setMachines(arr);
      },
      (err) => {
        console.error(err);
        toast("تعذر تحميل الماكينات", "error");
      }
    );

    return () => unsub();
  }, [userEmail, authorized, currentShop]);

  const handelAddMachine = async () => {
    if (!name.trim()) return alert("⚠️ من فضلك ادخل اسم الماكينة");
    if (!userEmail || !currentShop) return;

    const bal = Number(balance);
    if (balance === "" || Number.isNaN(bal)) {
      alert("⚠️ ادخل رصيداً صالحاً");
      return;
    }

    const data = {
      name: name.trim(),
      balance: bal,
      userEmail,
      shop: currentShop,
    };

    try {
      if (editId) {
        await updateDoc(doc(db, "machines", editId), {
          name: data.name,
          balance: data.balance,
        });
        toast("تم تعديل البيانات", "success");
        setEditId(null);
      } else {
        await addDoc(collection(db, "machines"), {
          ...data,
          createdAt: serverTimestamp(),
        });
        toast("تم إضافة الماكينة بنجاح", "success");
      }
      setName("");
      setBalance("");
    } catch (e) {
      console.error(e);
      toast("حدث خطأ أثناء الحفظ", "error");
    }
  };

  const handleEdit = (m) => {
    setName(m.name || "");
    setBalance(String(m.balance ?? ""));
    setEditId(m.id);
    setActive(0);
  };

  const handleDelet = async (id) => {
    await deleteDoc(doc(db, "machines", id));
  };

  const filteredMachines = machines.filter((m) =>
    (m.name || "").includes(searchTerm)
  );

  if (loading) return <p>جاري التحقق...</p>;
  if (!authorized) return null;

  return (
    <div className="main">
      <div className={styles.numbersContainer}>
        <div className="header">
          <h2>الماكينات</h2>
          <Link href={"/"} className="headerLink">
            <MdOutlineKeyboardArrowLeft />
          </Link>
        </div>

        <div className={styles.content}>
          <div className={styles.btnsContainer}>
            {btns.map((btn, index) => (
              <button
                key={index}
                type="button"
                className={active === index ? `${styles.active}` : ""}
                onClick={() => setActive(index)}
              >
                {btn}
              </button>
            ))}
          </div>

          <div
            className={styles.cardInfo}
            style={{ display: active === 0 ? "flex" : "none" }}
          >
            <div className={styles.info}>
              <div className="amounts">
                <div className="inputContainer">
                  <label>اسم الماكينة :</label>
                  <input
                    type="text"
                    value={name}
                    placeholder="اضف اسم الماكينة"
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="inputContainer">
                  <label>الرصيد :</label>
                  <input
                    type="number"
                    value={balance}
                    placeholder="0"
                    onChange={(e) => setBalance(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <button
              type="button"
              className={styles.addBtn}
              onClick={handelAddMachine}
            >
              {editId ? "تعديل البيانات" : "اكمل العملية"}
            </button>
          </div>

          <div
            className={styles.cardContent}
            style={{ display: active === 1 ? "flex" : "none" }}
          >
            <div className="inputContainer">
              <input
                type="text"
                placeholder="ابحث باسم الماكينة"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {filteredMachines.length === 0 && (
              <EmptyState
                title="لا توجد ماكينات"
                description="أضف ماكينة جديدة لبدء العمليات."
              />
            )}
            {filteredMachines.length > 0 && (
              <div className={styles.tableWrap}>
                <div className={mainListStyles.operationsTable}>
                  <table>
                    <thead>
                      <tr>
                        <th>اسم الماكينة</th>
                        <th>الرصيد</th>
                        <th>إجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMachines.map((m) => (
                        <tr key={m.id}>
                          <td>{m.name || "-"}</td>
                          <td>{Number(m.balance ?? 0)}</td>
                          <td>
                            <div className={styles.actionBtns}>
                              <button
                                type="button"
                                onClick={() => handleEdit(m)}
                              >
                                <MdModeEditOutline />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelet(m.id)}
                              >
                                <FaTrashAlt />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className={mainListStyles.operationsCards}>
                  {filteredMachines.map((m) => (
                    <article
                      key={m.id}
                      className={mainListStyles.opCard}
                    >
                      <div className={mainListStyles.opCardHeader}>
                        <span
                          className={mainListStyles.typeBadgeNeutral}
                        >
                          {m.name || "-"}
                        </span>
                        <div
                          className={`${styles.actionBtns} ${styles.actionBtnsInCard}`}
                        >
                          <button
                            type="button"
                            onClick={() => handleEdit(m)}
                          >
                            <MdModeEditOutline />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelet(m.id)}
                          >
                            <FaTrashAlt />
                          </button>
                        </div>
                      </div>
                      <div className={mainListStyles.opCardAmounts}>
                        <div
                          className={`${mainListStyles.opCardAmountBlock} ${styles.amountBlockSpan2}`}
                        >
                          <span>الرصيد</span>
                          <strong>{Number(m.balance ?? 0)}</strong>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Machines;
