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
    const btns = ['اضف خط جديد','كل الخطوط'];

    const [authorized, setAuthorized] = useState(false);
    const [loading, setLoading] = useState(true);
    const [editId, setEditId] = useState(null); // ⭐ لتحديد إذا كنا في وضع تعديل

    useEffect(() => {
        const checkLock = async () => {
            const email = localStorage.getItem("email");
            setUserEmail(email);
            if (!email) {
                router.push('/');
                return;
            }

            const snapshot = await getDocs(collection(db, "users"));

            if (!snapshot.empty) {
                const userDoc = snapshot.docs[0];
                const data = userDoc.data();

                if (data.lockNumbers) {
                    const input = prompt("🚫 تم قفل صفحة الخطوط\nمن فضلك أدخل كلمة المرور:");
                    if (input === data.lockPassword) {
                        setAuthorized(true);
                    } else {
                        alert("❌ كلمة المرور غير صحيحة");
                        router.push('/');
                    }
                } else {
                    setAuthorized(true);
                }
            } else {
                router.push('/');
            }

            setLoading(false);
        };

        checkLock();
    }, []);

    useEffect(() => {
        if (!userEmail) return;
        const unsubscribe = onSnapshot(collection(db, 'numbers'), (querySnapshot) => {
            const numbersSnap = [];
            querySnapshot.forEach((doc) => {
                numbersSnap.push({...doc.data(), id: doc.id});
            });
            setNumbers(numbersSnap);
        });
        return () => unsubscribe();
    }, [userEmail]);

    useEffect(() => {
        const resetLimitsIfNeeded = async () => {
            const today = new Date();
            const todayDate =  today.toLocaleDateString('en-CA');
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

        if (numbers.length > 0) {
            resetLimitsIfNeeded();
        }
    }, [numbers]);

    // ⭐ إضافة/تعديل خط
    const handelAddNumber = async () => {
        if (phone !== "") {
            if (editId) {
                // تعديل
                const docRef = doc(db, "numbers", editId);
                await updateDoc(docRef, {
                    phone,
                    name,
                    idNumber,
                    amount,
                    withdrawLimit: limit,
                    depositLimit: limit,
                    originalWithdrawLimit: limit,
                    originalDepositLimit: limit,
                    userEmail,
                });
                alert("تم تعديل البيانات بنجاح ✅");
                setEditId(null);
            } else {
                // إضافة
                await addDoc(collection(db, 'numbers'), {
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
                });
                alert('تم اضافة الرقم بنجاح ✅');
            }

            // مسح الفورم
            setPhone('');
            setName('');
            setIdNumber('');
            setAmount('');
            setLimit('');
        }
    };

    // ⭐ تحميل بيانات الخط للتعديل
    const handleEdit = (number) => {
        setPhone(number.phone);
        setName(number.name);
        setIdNumber(number.idNumber);
        setAmount(number.amount);
        setLimit(number.originalWithdrawLimit || number.withdrawLimit);
        setEditId(number.id);
        setActive(0); // يفتح فورم التعديل تلقائي
    };

    const handleDelet = async (id) => {
        await deleteDoc(doc(db, 'numbers', id));
    };

    const handleQr = (phone) => {
        setQrNumber(phone);
        setOpenQr(true);
    };

    const handleDeleteAll = async () => {
        if (!confirm("هل أنت متأكد من حذف جميع البيانات؟ سيتم حذف الخطوط، العمليات، والتقارير.")) return;

        const collectionsToDelete = ['numbers', 'operations', 'reports'];

        for (const collectionName of collectionsToDelete) {
            const querySnapshot = await getDocs(collection(db, collectionName));
            const deletePromises = querySnapshot.docs.map((docSnap) => deleteDoc(doc(db, collectionName, docSnap.id)));
            await Promise.all(deletePromises);
        }

        alert("تم حذف كل البيانات بنجاح ✅");
    };

    const filteredNumbers = numbers.filter((number) =>
        number.phone.includes(searchTerm)
    );

    if (loading) return <p>جاري التحقق...</p>;
    if (!authorized) return null;

    return (
        <div className="main">
            <div className={openQr ? `${styles.qrContainer} ${styles.active}` : `${styles.qrContainer}`}>
                <button onClick={() => setOpenQr(false)}><MdOutlineKeyboardArrowLeft/></button>
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
                        {btns.map((btn, index) => (
                            <button className={active === index ? `${styles.active}` : ``} onClick={() => setActive(index)} key={index}>{btn}</button>
                        ))}
                        <button className={styles.deleteAll} onClick={handleDeleteAll}><FaTrashAlt/></button>
                    </div>
                    <div className={styles.cardInfo} style={{display: active === 0 ? 'flex' : 'none'}}>
                        <div className={styles.info}>
                            <div className="inputContainer">
                                <label>رقم الخط : </label>
                                <input type="number" value={phone} placeholder="اضف رقم الخط" onChange={(e) => setPhone(e.target.value)}/>
                            </div>
                            <div className="amounts">
                                <div className="inputContainer">
                                    <label>اسم المالك :</label>
                                    <input type="text" value={name} placeholder="اضف اسم مالك الخط" onChange={(e) => setName(e.target.value)}/>
                                </div>
                                <div className="inputContainer">
                                    <label>الرقم القومي :</label>
                                    <input type="number" value={idNumber} placeholder="اضف الرقم القومي" onChange={(e) => setIdNumber(e.target.value)}/>
                                </div>
                            </div>
                            <div className="amounts">
                                <div className="inputContainer">
                                    <label> رصيد الخط :</label>
                                    <input type="number" value={amount} placeholder="0" onChange={(e) => setAmount(e.target.value)}/>
                                </div>
                                <div className="inputContainer">
                                    <label> الليمت :</label>
                                    <input type="number" value={limit} placeholder="0" onChange={(e) => setLimit(e.target.value)}/>
                                </div>
                            </div>
                        </div>
                        <button className={styles.addBtn} onClick={handelAddNumber}>
                            {editId ? "تعديل البيانات" : "اكمل العملية"}
                        </button>
                    </div>
                    <div className={styles.cardContent} style={{display: active === 1 ? 'flex' : 'none'}}>
                        <div className="inputContainer">
                            <input
                                type="text"
                                placeholder="ابحث عن رقم"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        {filteredNumbers.map((number, index) => (
                            <div key={number.id} onClick={() => setOpenCard(openCard === index ? null : index)} className={openCard === index ? `${styles.numDiv} ${styles.open}` : `${styles.numDiv}`}>
                                <div className={styles.divHeader}>
                                    <h2>{number.phone}</h2>
                                    <div className={styles.btns}>
                                        <button onClick={() => handleQr(number.phone)}><HiQrcode/></button>
                                        <button onClick={() => handleEdit(number)}><MdModeEditOutline/></button>
                                        <button onClick={() => handleDelet(number.id)}><FaTrashAlt/></button>
                                    </div>
                                </div>
                                <hr />
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
