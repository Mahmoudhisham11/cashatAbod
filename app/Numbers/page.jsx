'use client';
import styles from "./styles.module.css";
import Link from "next/link";
import { useEffect, useState } from "react";
import { MdOutlineKeyboardArrowLeft } from "react-icons/md";
import { HiQrcode } from "react-icons/hi";
import { FaTrashAlt } from "react-icons/fa";
import { MdModeEditOutline } from "react-icons/md";
import { db } from "../firebase";
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, updateDoc, getDocs } from "firebase/firestore";
import QRCode from "react-qr-code";
import { useRouter } from "next/navigation";

function Numbers() {
    const router = useRouter();
    const [phone, setPhone] = useState('');
    const [name, setName] = useState('');
    const [idNumber, setIdNumber] = useState('');
    const [amount, setAmount] = useState('');
    const [limit, setLimit] = useState('');
    const [userEmail, setUserEmail] = useState('');
    const [qrNumber, setQrNumber] = useState('');
    const [active, setActive] = useState(0);
    const [openCard, setOpenCard] = useState('');
    const [openQr, setOpenQr] = useState(false);
    const [numbers, setNumbers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [authorized, setAuthorized] = useState(false);
    const [loading, setLoading] = useState(true);
    const [editId, setEditId] = useState(null);
    const btns = ['اضف خط جديد','كل الخطوط'];

    // 🔹 جلب المستخدم الحالي والتحقق من الصلاحية
    useEffect(() => {
        const checkLock = async () => {
            const email = localStorage.getItem("email");
            setUserEmail(email);
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

    // 🔹 جلب الخطوط الخاصة بالمستخدم
    useEffect(() => {
        if (!userEmail) return;
        const q = query(collection(db, 'numbers'));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const numbersSnap = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                if (data.userEmail === userEmail) {
                    numbersSnap.push({...data, id: doc.id});
                }
            });
            setNumbers(numbersSnap);
        });
        return () => unsubscribe();
    }, [userEmail]);

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
        if (!userEmail) return;

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
        };

        if (editId) {
            await updateDoc(doc(db, "numbers", editId), data);
            alert("✅ تم تعديل البيانات");
            setEditId(null);
        } else {
            await addDoc(collection(db, 'numbers'), data);
            alert("✅ تم إضافة الخط بنجاح");
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

    const handleDeleteAll = async () => {
        if (!confirm("هل أنت متأكد من حذف جميع البيانات؟")) return;
        const collectionsToDelete = ['numbers','operations','reports'];
        for (const col of collectionsToDelete) {
            const snap = await getDocs(collection(db, col));
            const deletePromises = snap.docs.map(d => deleteDoc(doc(db, col, d.id)));
            await Promise.all(deletePromises);
        }
        alert("✅ تم حذف كل البيانات");
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
                        <button className={styles.deleteAll} onClick={handleDeleteAll}><FaTrashAlt/></button>
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
                        {filteredNumbers.map((number,index)=>(
                            <div key={number.id} onClick={()=>setOpenCard(openCard===index?null:index)} className={openCard===index?`${styles.numDiv} ${styles.open}`:`${styles.numDiv}`}>
                                <div className={styles.divHeader}>
                                    <h2>{number.phone}</h2>
                                    <div className={styles.btns}>
                                        <button onClick={()=>handleQr(number.phone)}><HiQrcode/></button>
                                        <button onClick={()=>handleEdit(number)}><MdModeEditOutline/></button>
                                        <button onClick={()=>handleDelet(number.id)}><FaTrashAlt/></button>
                                    </div>
                                </div>
                                <hr/>
                                <div className={styles.divFooter}>
                                    <strong>اسم المالك : {number.name}</strong>
                                    <strong>الرقم القومي: {number.idNumber}</strong>
                                    <strong> رصيد الخط: {number.amount}</strong>
                                    <strong>الليمت المتاح ارسال: {Number(number.depositLimit)}</strong>
                                    <strong>الليمت المتاح استلام: {Number(number.withdrawLimit)}</strong>
                                    <strong>الليمت اليومي ارسال: {Number(number.dailyDeposit)}</strong>
                                    <strong>الليمت اليومي استلام: {Number(number.dailyWithdraw)}</strong>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Numbers;
