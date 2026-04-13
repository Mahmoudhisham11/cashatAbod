'use client';
import styles from "./styles.module.css";
import mainListStyles from "../../components/Main/styles.module.css";
import Link from "next/link";
import { useEffect, useState } from "react";
import { MdOutlineKeyboardArrowLeft } from "react-icons/md";
import { HiQrcode } from "react-icons/hi";
import { FaTrashAlt } from "react-icons/fa";
import { MdModeEditOutline } from "react-icons/md";
import { db } from "../firebase";
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, updateDoc, getDocs, where } from "firebase/firestore";
import QRCode from "react-qr-code";
import { useRouter } from "next/navigation";
import EmptyState from "../../components/ui/EmptyState";
import { useToast } from "../../components/ui/ToastProvider";

function Numbers() {
    const router = useRouter();
    const [phone, setPhone] = useState('');
    const [name, setName] = useState('');
    const [idNumber, setIdNumber] = useState('');
    const [amount, setAmount] = useState('');
    const [limit, setLimit] = useState('');
    const [userEmail, setUserEmail] = useState('');
    const [currentShop, setCurrentShop] = useState('');
    const [qrNumber, setQrNumber] = useState('');
    const [active, setActive] = useState(0);
    const [openQr, setOpenQr] = useState(false);
    const [numbers, setNumbers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [authorized, setAuthorized] = useState(false);
    const [loading, setLoading] = useState(true);
    const [editId, setEditId] = useState(null);
    const btns = ['اضف خط جديد','كل الخطوط'];
    const { toast } = useToast();

    // 🔹 جلب المستخدم الحالي والتحقق من الصلاحية
    useEffect(() => {
        const checkLock = async () => {
            const email = localStorage.getItem("email");
            const shop = localStorage.getItem("shop");
            setUserEmail(email);
            if (!email) {
                router.push('/');
                return;
            }
            if (!shop) {
                alert("⚠️ لا يوجد فرع محدد للحساب");
                router.push('/');
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
                router.push('/');
                return;
            }

            const userData = currentUserDoc.data();

            if (userData.lockNumbers) {
                alert("🚫 لا تملك صلاحية الدخول لهذه الصفحة");
                router.push('/');
                return;
            } else {
                setAuthorized(true);
            }

            setLoading(false);
        };

        checkLock();
    }, [router]);

    // 🔹 جلب الخطوط
    useEffect(() => {
        if (!currentShop) return;
        const q = query(collection(db, "numbers"), where("shop", "==", currentShop));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const numbersSnap = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                numbersSnap.push({ ...data, id: doc.id });
            });
            setNumbers(numbersSnap);
        });
        return () => unsubscribe();
    }, [currentShop]);


    // 🔹 إعادة ضبط الليمت اليومي والشهري
    useEffect(() => {
        const resetLimitsIfNeeded = async () => {
            const today = new Date();
            const todayDate = today.toLocaleDateString('en-CA');
            const currentMonth = today.getMonth();

            for (const number of numbers) {
                const docRef = doc(db, 'numbers', number.id);

                if (number.lastDailyReset !== todayDate) {
                    await updateDoc(docRef, {
                        dailyWithdraw: 60000,
                        dailyDeposit: 60000,
                        lastDailyReset: todayDate
                    });
                }

                if (number.lastMonthlyReset !== currentMonth) {
                    await updateDoc(docRef, {
                        withdrawLimit: Number(number.originalWithdrawLimit) || 60000,
                        depositLimit: Number(number.originalDepositLimit) || 60000,
                        lastMonthlyReset: currentMonth
                    });
                }
            }
        };

        if (numbers.length > 0) resetLimitsIfNeeded();
    }, [numbers]);

    // ⭐ إضافة/تعديل خط
    const handelAddNumber = async () => {
        if (!phone) return alert("⚠️ من فضلك ادخل رقم الخط");
        if (!userEmail || !currentShop) return;

        const data = {
            phone,
            name,
            idNumber,
            amount,
            withdrawLimit: limit,
            depositLimit: limit,
            originalWithdrawLimit: limit,
            originalDepositLimit: limit,
            dailyWithdraw: 60000,
            dailyDeposit: 60000,
            userEmail,
            shop: currentShop,
        };

        if (editId) {
            await updateDoc(doc(db, "numbers", editId), data);
            toast("تم تعديل البيانات", "success");
            setEditId(null);
        } else {
            await addDoc(collection(db, 'numbers'), data);
            toast("تم إضافة الخط بنجاح", "success");
        }

        setPhone(''); setName(''); setIdNumber(''); setAmount(''); setLimit('');
    };

    const handleEdit = (number) => {
        setPhone(number.phone);
        setName(number.name);
        setIdNumber(number.idNumber);
        setAmount(number.amount);
        setLimit(number.originalWithdrawLimit || number.withdrawLimit);
        setEditId(number.id);
        setActive(0);
    };

    const handleDelet = async (id) => {
        await deleteDoc(doc(db, 'numbers', id));
    };

    const handleQr = (phone) => {
        setQrNumber(phone);
        setOpenQr(true);
    };

    const filteredNumbers = numbers.filter(n => n.phone.includes(searchTerm));

    if (loading) return <p>جاري التحقق...</p>;
    if (!authorized) return null;

    return (
        <div className="main">
            <div className={openQr ? `${styles.qrContainer} ${styles.active}` : `${styles.qrContainer}`}>
                <button onClick={()=>setOpenQr(false)}><MdOutlineKeyboardArrowLeft/></button>
                <QRCode value={qrNumber} size={200} />
                <h2>{qrNumber}</h2>
            </div>

            <div className={styles.numbersContainer}>
                <div className="header">
                    <h2>الارقام و الليمت</h2>
                    <Link href={"/"} className="headerLink"><MdOutlineKeyboardArrowLeft /></Link>
                </div>

                <div className={styles.content}>
                    <div className={styles.btnsContainer}>
                        {btns.map((btn,index)=>
                            <button key={index} className={active===index?`${styles.active}`:""} onClick={()=>setActive(index)}>{btn}</button>
                        )}
                    </div>

                    <div className={styles.cardInfo} style={{display: active===0?"flex":"none"}}>
                        <div className={styles.info}>
                            <div className="inputContainer">
                                <label>رقم الخط : </label>
                                <input type="number" value={phone} placeholder="اضف رقم الخط" onChange={(e)=>setPhone(e.target.value)}/>
                            </div>
                            <div className="amounts">
                                <div className="inputContainer">
                                    <label>اسم المالك :</label>
                                    <input type="text" value={name} placeholder="اضف اسم مالك الخط" onChange={(e)=>setName(e.target.value)}/>
                                </div>
                                <div className="inputContainer">
                                    <label>الرقم القومي :</label>
                                    <input type="number" value={idNumber} placeholder="اضف الرقم القومي" onChange={(e)=>setIdNumber(e.target.value)}/>
                                </div>
                            </div>
                            <div className="amounts">
                                <div className="inputContainer">
                                    <label> رصيد الخط :</label>
                                    <input type="number" value={amount} placeholder="0" onChange={(e)=>setAmount(e.target.value)}/>
                                </div>
                                <div className="inputContainer">
                                    <label> الليمت :</label>
                                    <input type="number" value={limit} placeholder="0" onChange={(e)=>setLimit(e.target.value)}/>
                                </div>
                            </div>
                        </div>
                        <button className={styles.addBtn} onClick={handelAddNumber}>
                            {editId?"تعديل البيانات":"اكمل العملية"}
                        </button>
                    </div>

                    <div className={styles.cardContent} style={{display: active===1?"flex":"none"}}>
                        <div className="inputContainer">
                            <input type="text" placeholder="ابحث عن رقم" value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)}/>
                        </div>
                        {filteredNumbers.length === 0 && (
                            <EmptyState title="لا توجد خطوط" description="أضف خط جديد لبدء العمليات." />
                        )}
                        {filteredNumbers.length > 0 && (
                            <div className={styles.tableWrap}>
                                <div className={mainListStyles.operationsTable}>
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>رقم الخط</th>
                                                <th>اسم المالك</th>
                                                <th>الرقم القومي</th>
                                                <th>الرصيد</th>
                                                <th>ليمت ارسال</th>
                                                <th>ليمت استلام</th>
                                                <th>يومي ارسال</th>
                                                <th>يومي استلام</th>
                                                <th>إجراءات</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredNumbers.map((number) => (
                                                <tr key={number.id}>
                                                    <td>{number.phone}</td>
                                                    <td>{number.name || "-"}</td>
                                                    <td>{number.idNumber || "-"}</td>
                                                    <td>{Number(number.amount || 0)}</td>
                                                    <td>{Number(number.depositLimit || 0)}</td>
                                                    <td>{Number(number.withdrawLimit || 0)}</td>
                                                    <td>{Number(number.dailyDeposit || 0)}</td>
                                                    <td>{Number(number.dailyWithdraw || 0)}</td>
                                                    <td>
                                                        <div className={styles.actionBtns}>
                                                            <button type="button" onClick={()=>handleQr(number.phone)}><HiQrcode/></button>
                                                            <button type="button" onClick={()=>handleEdit(number)}><MdModeEditOutline/></button>
                                                            <button type="button" onClick={()=>handleDelet(number.id)}><FaTrashAlt/></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className={mainListStyles.operationsCards}>
                                    {filteredNumbers.map((number) => (
                                        <article key={number.id} className={mainListStyles.opCard}>
                                            <div className={mainListStyles.opCardHeader}>
                                                <span className={mainListStyles.typeBadgeNeutral}>{number.phone}</span>
                                                <div className={`${styles.actionBtns} ${styles.actionBtnsInCard}`}>
                                                    <button type="button" onClick={()=>handleQr(number.phone)}><HiQrcode/></button>
                                                    <button type="button" onClick={()=>handleEdit(number)}><MdModeEditOutline/></button>
                                                    <button type="button" onClick={()=>handleDelet(number.id)}><FaTrashAlt/></button>
                                                </div>
                                            </div>
                                            <div className={mainListStyles.opCardAmounts}>
                                                <div className={mainListStyles.opCardAmountBlock}>
                                                    <span>الرصيد</span>
                                                    <strong>{Number(number.amount || 0)}</strong>
                                                </div>
                                                <div className={mainListStyles.opCardAmountBlock}>
                                                    <span>ليمت ارسال</span>
                                                    <strong>{Number(number.depositLimit || 0)}</strong>
                                                </div>
                                                <div className={mainListStyles.opCardAmountBlock}>
                                                    <span>ليمت استلام</span>
                                                    <strong>{Number(number.withdrawLimit || 0)}</strong>
                                                </div>
                                                <div className={mainListStyles.opCardAmountBlock}>
                                                    <span>يومي ارسال</span>
                                                    <strong>{Number(number.dailyDeposit || 0)}</strong>
                                                </div>
                                                <div className={`${mainListStyles.opCardAmountBlock} ${styles.amountBlockSpan2}`}>
                                                    <span>يومي استلام</span>
                                                    <strong>{Number(number.dailyWithdraw || 0)}</strong>
                                                </div>
                                            </div>
                                            <dl className={mainListStyles.opCardMeta}>
                                                <div className={mainListStyles.opCardRow}>
                                                    <dt>اسم المالك</dt>
                                                    <dd>{number.name || "-"}</dd>
                                                </div>
                                                <div className={mainListStyles.opCardRow}>
                                                    <dt>الرقم القومي</dt>
                                                    <dd>{number.idNumber || "-"}</dd>
                                                </div>
                                            </dl>
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

export default Numbers;
