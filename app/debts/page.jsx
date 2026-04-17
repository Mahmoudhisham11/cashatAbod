'use client';
import styles from "./styles.module.css";
import Link from "next/link";
import { useState, useEffect } from "react";
import { MdOutlineKeyboardArrowLeft, MdModeEditOutline, MdOutlineFileUpload } from "react-icons/md";
import { FaRegMoneyBillAlt, FaTimes } from "react-icons/fa";
import { collection, addDoc, getDocs, query, doc, updateDoc, deleteDoc, where } from "firebase/firestore";
import { db } from "../firebase";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useRouter } from "next/navigation";
import StatusBadge from "../../components/ui/StatusBadge";
import EmptyState from "../../components/ui/EmptyState";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { useToast } from "../../components/ui/ToastProvider";

function Debts() {
  const router = useRouter();

  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  const btns = ["اضف عميل جديد", "كل العملاء"];
  const [active, setActive] = useState(0);
  const [clientName, setClientName] = useState("");
  const [amount, setAmount] = useState("");
  const [debtType, setDebtType] = useState("ليك");
  const [payMethod, setPayMethod] = useState("نقدي");
  const [walletId, setWalletId] = useState("");
  const [debts, setDebts] = useState([]);
  const [editId, setEditId] = useState(null);
  const [totalLik, setTotalLik] = useState(0);
  const [totalAlyek, setTotalAlyek] = useState(0);
  const [userEmail, setUserEmail] = useState("");
  const [currentShop, setCurrentShop] = useState("");
  const [wallets, setWallets] = useState([]);
  const [cashVal, setCashVal] = useState(0);

  const [showPayPopup, setShowPayPopup] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [payType, setPayType] = useState("نقدي");
  const [selectedWallet, setSelectedWallet] = useState("");
  const [confirmDeletePaid, setConfirmDeletePaid] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [existingImageUrl, setExistingImageUrl] = useState("");
  const [existingImagePublicId, setExistingImagePublicId] = useState("");
  const [removeImageOnEdit, setRemoveImageOnEdit] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageInputKey, setImageInputKey] = useState(0);
  const [zoomedImageUrl, setZoomedImageUrl] = useState("");
  const { toast } = useToast();

  const uploadImageToCloudinary = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "cashat_abod");

    const response = await fetch("https://api.cloudinary.com/v1_1/drtdv4iyr/image/upload", {
      method: "POST",
      body: formData,
    });

    const result = await response.json();
    if (!response.ok || !result?.secure_url || !result?.public_id) {
      throw new Error(result?.error?.message || "فشل رفع الصورة إلى Cloudinary");
    }

    return {
      imageUrl: result.secure_url,
      imagePublicId: result.public_id,
    };
  };

  const resetImageState = () => {
    setSelectedImageFile(null);
    setImagePreviewUrl("");
    setExistingImageUrl("");
    setExistingImagePublicId("");
    setRemoveImageOnEdit(false);
    setImageInputKey((prev) => prev + 1);
  };

  const deleteImageByPublicId = async (publicId) => {
    if (!publicId) {
      console.log("[delete-image] Skip: missing publicId");
      return;
    }

    console.log("[delete-image] Requesting delete for publicId:", publicId);
    const response = await fetch("/api/delete-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicId }),
    });

    const raw = await response.text();
    let data = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { error: raw || "Unknown API response" };
    }

    if (!response.ok || !data?.success) {
      console.warn("[delete-image] API failed:", {
        status: response.status,
        statusText: response.statusText,
        data,
      });
      throw new Error(
        data?.error || `فشل حذف الصورة من Cloudinary (status ${response.status})`
      );
    }

    console.log("[delete-image] Deleted successfully:", publicId);
  };

  const deleteDebtWithImageCleanup = async (debt) => {
    if (!debt?.id) throw new Error("Debt id is required");

    try {
      if (debt.imagePublicId) {
        try {
          await deleteImageByPublicId(debt.imagePublicId);
        } catch (imageError) {
          // Do not block debt deletion if Cloudinary cleanup fails.
          // This keeps settlement flow working even when server credentials are missing.
          console.warn(
            "[delete-debt] Cloudinary delete failed, continuing Firestore delete:",
            imageError
          );
          toast(
            "تم حذف الدين، لكن تعذر حذف الصورة من Cloudinary. راجع إعدادات السيرفر.",
            "warning"
          );
        }
      } else {
        console.log("[delete-debt] No imagePublicId, skipping image deletion for debt:", debt.id);
      }

      await deleteDoc(doc(db, "debts", debt.id));
      console.log("[delete-debt] Firestore document deleted:", debt.id);
    } catch (error) {
      console.error("[delete-debt] Failed to delete debt with image cleanup:", error);
      throw error;
    }
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      setSelectedImageFile(null);
      setImagePreviewUrl("");
      return;
    }

    if (!file.type.startsWith("image/")) {
      alert("⚠️ الملف المختار ليس صورة");
      event.target.value = "";
      setSelectedImageFile(null);
      setImagePreviewUrl("");
      return;
    }

    setSelectedImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
    setRemoveImageOnEdit(false);
  };
  useEffect(() => {
    const checkLock = async () => {
      const email = localStorage.getItem("email");
      const shop = localStorage.getItem("shop");
      if (!email) {
        router.push('/');
        return;
      }
      if (!shop) {
        alert("⚠️ لا يوجد فرع محدد للحساب");
        router.push('/');
        return;
      }
      setUserEmail(email);
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

      const data = currentUserDoc.data();
      if (data.lockDebts) {
        alert("🚫 ليس لديك صلاحية الدخول إلى صفحة الديون.");
        router.push('/');
        return;
      }

      setAuthorized(true);
      setLoading(false);
    };

    checkLock();
  }, [router]);

  useEffect(() => {
    if (!authorized || !userEmail || !currentShop) return;
    fetchDebts();
    fetchWallets();
    fetchCash();
  }, [authorized, userEmail, currentShop]);

  const fetchDebts = async () => {
    if (!currentShop) return;
    try {
      const q = query(collection(db, "debts"), where("shop", "==", currentShop));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDebts(data);

      let lik = 0, alyek = 0;
      data.forEach(d => {
        const val = Number(d.amount) || 0;
        if (d.debtType === "ليك" && d.status !== "تم السداد") lik += val;
        else if (d.debtType === "عليك" && d.status !== "تم السداد") alyek += val;
      });
      setTotalLik(lik);
      setTotalAlyek(alyek);
    } catch (error) { console.error(error); }
  };

  const fetchWallets = async () => {
    if (!currentShop) return;
    try {
      const q = query(collection(db, "numbers"), where("shop", "==", currentShop));
      const snapshot = await getDocs(q);
      setWallets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) { console.error(error); }
  };

  const fetchCash = async () => {
    if (!currentShop) return;
    try {
      const q = query(collection(db, "cash"), where("shop", "==", currentShop));
      const snapshot = await getDocs(q);
      let totalCash = 0;
      snapshot.forEach(docSnap => totalCash += Number(docSnap.data().cashVal || 0));
      setCashVal(totalCash);
    } catch (error) { console.error(error); }
  };

  const handleSubmit = async () => {
    if (isUploadingImage) return;
    if (!userEmail || !currentShop) return;
    if (!clientName || !amount) { alert("⚠️ من فضلك املأ جميع الحقول"); return; }
    if (!editId && !selectedImageFile) {
      alert("⚠️ صورة الدين مطلوبة");
      return;
    }
    const debtAmount = Number(amount);
    try {
      if (payMethod === "نقدي") {
        const cashSnap = await getDocs(query(collection(db, "cash"), where("shop", "==", currentShop)));
        if (!cashSnap.empty) {
          const cashDocId = cashSnap.docs[0].id;
          const cashData = cashSnap.docs[0].data();
          let newCash = Number(cashData.cashVal || 0);

          if (debtType === "ليك") {
            newCash -= debtAmount;
          } else {
            newCash += debtAmount;
          }

          if (newCash < 0) {
            alert("⚠️رصيد المحفظة لا يكفي");
            return;
          }

          await updateDoc(doc(db, "cash", cashDocId), { cashVal: newCash });
          setCashVal(newCash);
        }
      } else if (payMethod === "محفظة" && walletId) {
        const walletRef = doc(db, "numbers", walletId);
        const walletDoc = wallets.find((w) => w.id === walletId);
        let newAmount = Number(walletDoc.amount || 0);

        if (debtType === "ليك") {
          newAmount -= debtAmount;
        } else {
          newAmount += debtAmount;
        }

        if (newAmount < 0) {
          alert("⚠️ رصيد المحفظة لا يكفي");
          return;
        }

        await updateDoc(walletRef, { amount: newAmount });
        fetchWallets();
      }

      const walletPhone = payMethod === "محفظة" && walletId 
        ? wallets.find(w=>w.id===walletId)?.phone || "" 
        : null;

      let finalImageUrl = existingImageUrl || "";
      let finalImagePublicId = existingImagePublicId || "";
      if (selectedImageFile) {
        setIsUploadingImage(true);
        const uploaded = await uploadImageToCloudinary(selectedImageFile);
        finalImageUrl = uploaded.imageUrl;
        finalImagePublicId = uploaded.imagePublicId;
        setIsUploadingImage(false);
      } else if (editId && removeImageOnEdit) {
        finalImageUrl = "";
        finalImagePublicId = "";
      }
      const debtData = {
        clientName,
        userName: localStorage.getItem('name'), 
        amount: debtAmount, 
        debtType,
        payMethod, 
        walletId: payMethod==="محفظة"?walletId:null,
        walletPhone: walletPhone,
        userEmail, 
        shop: currentShop,
        date: new Date().toLocaleString("ar-EG"),
        status: "لم يتم السداد",
        imageUrl: finalImageUrl,
        imagePublicId: finalImagePublicId
      };

      if (editId) {
        await updateDoc(doc(db, "debts", editId), debtData);
        alert("✅ تم تعديل العميل");
      } else {
        await addDoc(collection(db, "debts"), debtData);
        alert("✅ تم اضافة العميل");
      }

      setClientName(""); setAmount(""); setDebtType("ليك"); setPayMethod("نقدي"); setWalletId(""); setEditId(null);
      resetImageState();
      fetchDebts();
    } catch (error) {
      console.error(error);
      alert("❌ حدث خطأ أثناء رفع الصورة أو حفظ الدين");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleEdit = (debt) => {
    setClientName(debt.clientName);
    setAmount(debt.amount);
    setDebtType(debt.debtType);
    setPayMethod(debt.payMethod || "نقدي");
    setWalletId(debt.walletId || "");
    setExistingImageUrl(debt.imageUrl || "");
    setExistingImagePublicId(debt.imagePublicId || "");
    setRemoveImageOnEdit(false);
    setSelectedImageFile(null);
    setImagePreviewUrl("");
    setImageInputKey((prev) => prev + 1);
    setEditId(debt.id);
    setActive(0);
  };

  const openPayPopupFunc = (debt) => {
    setSelectedDebt(debt);
    setPayAmount("");
    setPayType("نقدي");
    setSelectedWallet("");
    setShowPayPopup(true);
  };

  const handlePay = async () => {
    if (!currentShop) return;
    if (!payAmount || Number(payAmount)<=0) { alert("⚠️ ادخل قيمة صحيحة"); return; }
    const amt = Number(payAmount);
    const remainingAmount = Number(selectedDebt?.amount || 0);
    if (amt > remainingAmount) {
      alert("⚠️ لا يمكن سداد مبلغ أكبر من المستحق");
      return;
    }
    try {
      if (payType === "نقدي") {
        const cashSnap = await getDocs(query(collection(db, "cash"), where("shop", "==", currentShop)));
        if (!cashSnap.empty) {
          const cashDocId = cashSnap.docs[0].id;
          const cashData = cashSnap.docs[0].data();
          let updatedCash = Number(cashData.cashVal||0);

          if (selectedDebt.debtType === "ليك") {
            updatedCash += amt; 
          } else {
            updatedCash -= amt; 
          }

          if (updatedCash < 0) {
            alert("⚠️ رصيد المحفظة لا يكفي");
            return;
          }

          await updateDoc(doc(db, "cash", cashDocId), { cashVal: updatedCash });
          setCashVal(updatedCash);
        }
      } else if (payType==="محفظة" && selectedWallet) {
        const walletRef = doc(db, "numbers", selectedWallet);
        const walletDoc = wallets.find(w=>w.id===selectedWallet);
        let newAmount = Number(walletDoc.amount||0);

        if (selectedDebt.debtType === "ليك") {
          newAmount += amt; 
        } else {
          newAmount -= amt; 
        }

        if (newAmount < 0) {
          alert("⚠️ رصيد المحفظة لا يكفي");
          return;
        }

        await updateDoc(walletRef,{amount:newAmount});
        fetchWallets();
      }

      if (amt < remainingAmount) {
        const debtRef = doc(db,"debts",selectedDebt.id);
        await updateDoc(debtRef,{amount:remainingAmount-amt});
      } else {
        await deleteDebtWithImageCleanup(selectedDebt);
      }

      fetchDebts();
      setShowPayPopup(false);
    } catch(error){ console.error(error); }
  };

  const exportToExcel = () => {
    const data = debts.map((d) => ({
      "اسم العميل": d.clientName,
      "المبلغ": d.amount,
      "النوع": d.debtType,
      "طريقة الدفع": d.payMethod==="محفظة" ? `محفظة - ${d.walletPhone||""}` : "نقدي",
      "الحالة": d.status,
      "التاريخ": d.date,
    }));
    data.push({}); data.push({"اسم العميل":"الإجمالي ليك","المبلغ":totalLik});
    data.push({"اسم العميل":"الإجمالي عليك","المبلغ":totalAlyek});
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "الديون");
    const excelBuffer = XLSX.write(workbook,{bookType:"xlsx",type:"array"});
    const dataBlob = new Blob([excelBuffer],{type:"application/octet-stream"});
    saveAs(dataBlob,`الديون_${new Date().toLocaleDateString("ar-EG")}.xlsx`);
  };

  // 🔹 زرار حذف المسدد
  const deletePaidDebts = async () => {
    setConfirmDeletePaid(true);
  };

  const confirmDeletePaidAction = async () => {
    if (!currentShop) return;
    setConfirmDeletePaid(false);
    try {
      const q = query(collection(db, "debts"), where("shop", "==", currentShop));
      const snapshot = await getDocs(q);
      const paidDebts = snapshot.docs.filter(d=>d.data().status==="تم السداد");
      for (const d of paidDebts) {
        await deleteDebtWithImageCleanup({ id: d.id, ...d.data() });
      }
      toast("تم حذف جميع الديون المسددة", "success");
      fetchDebts();
    } catch(error){ console.error(error); }
  };

  if (loading) return <p>جاري التحقق من الصلاحية...</p>;
  if (!authorized) return null;

  return (
    <div className={styles.debts}>
      <ConfirmDialog
        open={confirmDeletePaid}
        title="حذف الديون المسددة"
        description="سيتم حذف جميع الديون التي حالتها تم السداد."
        confirmText="حذف"
        danger
        onClose={() => setConfirmDeletePaid(false)}
        onConfirm={confirmDeletePaidAction}
      />
      <div className="header">
        <h2>الديون</h2>
        <Link href={"/"} className="headerLink"><MdOutlineKeyboardArrowLeft/></Link>
      </div>

      <div className={styles.content}>
        <div className={styles.btnsContainer}>
          {btns.map((btn,index)=>(
            <button key={index} className={active===index?styles.active:""} onClick={()=>setActive(index)}>
              {btn}
            </button>
          ))}
        </div>

        {/* إضافة عميل */}
        <div className={styles.debtsInfo} style={{display:active===0?"flex":"none"}}>
          {userEmail ? (
            <div className={styles.info}>
              <div className="inputContainer">
                <label>التقط صورة الدين</label>
                <input
                  id="debt-image-input"
                  key={imageInputKey}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className={styles.hiddenUploadInput}
                  onChange={handleImageChange}
                />
                {!(imagePreviewUrl || (existingImageUrl && !removeImageOnEdit)) ? (
                  <label htmlFor="debt-image-input" className={styles.uploadField}>
                    <span className={styles.uploadFieldIcon}><MdOutlineFileUpload /></span>
                    <span>اضغط لإضافة صورة الدين</span>
                  </label>
                ) : (
                  <div className={styles.fullImagePreviewWrap}>
                    <img
                      src={imagePreviewUrl || existingImageUrl}
                      alt="debt proof"
                      className={styles.fullImagePreview}
                    />
                    <label htmlFor="debt-image-input" className={styles.changeImageBtn}>
                      تغيير الصورة
                    </label>
                  </div>
                )}
                {!editId && <small>الصورة مطلوبة لإضافة دين جديد.</small>}
                {selectedImageFile && <small>تم اختيار: {selectedImageFile.name}</small>}
              </div>
              <div className="inputContainer">
                <label>اختر صورة الدين</label>
                <input
                  id="debt-image-input"
                  key={imageInputKey}
                  type="file"
                  accept="image/*"
                  className={styles.hiddenUploadInput}
                  onChange={handleImageChange}
                />
                {!(imagePreviewUrl || (existingImageUrl && !removeImageOnEdit)) ? (
                  <label htmlFor="debt-image-input" className={styles.uploadField}>
                    <span className={styles.uploadFieldIcon}><MdOutlineFileUpload /></span>
                    <span>اضغط لإضافة صورة الدين</span>
                  </label>
                ) : (
                  <div className={styles.fullImagePreviewWrap}>
                    <img
                      src={imagePreviewUrl || existingImageUrl}
                      alt="debt proof"
                      className={styles.fullImagePreview}
                    />
                    <label htmlFor="debt-image-input" className={styles.changeImageBtn}>
                      تغيير الصورة
                    </label>
                  </div>
                )}
                {!editId && <small>الصورة مطلوبة لإضافة دين جديد.</small>}
                {selectedImageFile && <small>تم اختيار: {selectedImageFile.name}</small>}
              </div>
              <div className="inputContainer">
                <label>اسم العميل:</label>
                <input type="text" placeholder="ادخل اسم العميل" value={clientName} onChange={e=>setClientName(e.target.value)} />
              </div>
              <div className="inputContainer">
                <label>طريقة الدفع:</label>
                <select value={payMethod} onChange={e=>setPayMethod(e.target.value)}>
                  <option value="نقدي">نقدي</option>
                  <option value="محفظة">محفظة</option>
                </select>
              </div>
              {payMethod==="محفظة" && (
                <div className="inputContainer">
                  <label>اختر المحفظة:</label>
                  <select value={walletId} onChange={e=>setWalletId(e.target.value)}>
                    <option value="">اختر المحفظة</option>
                    {wallets.map(w=><option key={w.id} value={w.id}>{w.phone} - {w.amount} ج.م</option>)}
                  </select>
                </div>
              )}
              <div className="inputContainer">
                <label>المبلغ:</label>
                <input type="number" placeholder="ادخل المبلغ" value={amount} onChange={e=>setAmount(e.target.value)} />
              </div>
              <div className="inputContainer">
                <label>نوع الدين:</label>
                <select value={debtType} onChange={e=>setDebtType(e.target.value)}>
                  <option value="ليك">ليك</option>
                  <option value="عليك">عليك</option>
                </select>
              </div>
              {editId && existingImageUrl && (
                <label className={styles.removeImageLabel}>
                  <input
                    type="checkbox"
                    checked={removeImageOnEdit}
                    onChange={(e) => setRemoveImageOnEdit(e.target.checked)}
                  />
                  حذف الصورة الحالية
                </label>
              )}
              
              <button onClick={handleSubmit} className={styles.addBtn} disabled={isUploadingImage}>
                {isUploadingImage ? "جاري رفع الصورة..." : editId ? "تعديل العميل" : "اضافة العميل"}
              </button>
            </div>
          ):(<p>⚠️ جاري التعرف على المستخدم...</p>)}
        </div>

        {/* عرض الكل */}
        <div className={styles.debtsContent} style={{display:active===1?"flex":"none"}}>
          <div className={styles.headContainer}>
            <div className={styles.summaryCards}>
              <article className={styles.summaryCard}>
                <span>ليك</span>
                <strong>{totalLik} ج.م</strong>
              </article>
              <article className={`${styles.summaryCard} ${styles.summaryCardDanger}`}>
                <span>عليك</span>
                <strong>{totalAlyek} ج.م</strong>
              </article>
            </div>
          </div>
          <div className={styles.tableContainer}>
            <div className={styles.headBtns}>
              <button onClick={exportToExcel}>Excel</button>
              <button onClick={deletePaidDebts}>حذف المسدد</button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>الصورة</th>
                  <th>اسم العميل</th>
                  <th>المستخدم</th>
                  <th>المبلغ</th>
                  <th>النوع</th>
                  <th>طريقة الدفع</th>
                  <th>الحالة</th>
                  <th>التاريخ</th>
                  <th>تفاعل</th>
                </tr>
              </thead>
              <tbody>
                {debts.map(d=>(
                  <tr key={d.id}>
                    <td>
                      {d.imageUrl ? (
                        <button
                          type="button"
                          className={styles.imageThumbBtn}
                          onClick={() => setZoomedImageUrl(d.imageUrl)}
                          title="عرض الصورة"
                        >
                          <img src={d.imageUrl} alt={d.clientName || "debt image"} className={styles.tableDebtImage} />
                        </button>
                      ) : (
                        <span className={styles.imageFallback}>-</span>
                      )}
                    </td>
                    <td>{d.clientName}</td>
                    <td>{d.userName}</td>
                    <td>{d.amount} ج.م</td>
                    <td>{d.debtType}</td>
                    <td>{d.payMethod==="محفظة" ? `محفظة - ${d.walletPhone||""}` : "نقدي"}</td>
                    <td><StatusBadge status={d.status} /></td>
                    <td>{d.date}</td>
                    <td className={styles.actions}>
                      <button onClick={()=>handleEdit(d)}><MdModeEditOutline/></button>
                      <button onClick={()=>openPayPopupFunc(d)}><FaRegMoneyBillAlt/></button>
                    </td>
                  </tr>
                ))}
                {debts.length===0 && null}
              </tbody>
            </table>
            {debts.length===0 && <EmptyState title="لا توجد ديون" description="أضف عميل جديد للمتابعة." />}
          </div>
        </div>
      </div>

      {/* Popup السداد */}
      {showPayPopup && (
        <div className={styles.popupOverlay}>
          <div className={styles.popupContent}>
            <div className={styles.popupHeader}>
              <h3>سداد الدين</h3>
              <button onClick={()=>setShowPayPopup(false)} className={styles.closeBtn}><FaTimes/></button>
            </div>
            <div className={styles.popupBody}>
              <div className="inputContainer">
                <label>طريقة السداد:</label>
                <select value={payType} onChange={e=>setPayType(e.target.value)}>
                  <option value="نقدي">نقدي</option>
                  <option value="محفظة">محفظة</option>
                </select>
              </div>
              {payType==="محفظة" && (
                <div className="inputContainer">
                  <label>اختر المحفظة:</label>
                  <select value={selectedWallet} onChange={e=>setSelectedWallet(e.target.value)}>
                    <option value="">اختر المحفظة</option>
                    {wallets.map(w=><option key={w.id} value={w.id}>{w.phone} - {w.amount} ج.م</option>)}
                  </select>
                </div>
              )}
              <div className="inputContainer">
                <label>قيمة المبلغ:</label>
                <input type="number" value={payAmount} onChange={e=>setPayAmount(e.target.value)} />
                <small>المبلغ المستحق: {Number(selectedDebt?.amount || 0)} ج.م</small>
              </div>
              <button className={styles.confirmBtn} onClick={handlePay}>تأكيد السداد</button>
            </div>
          </div>
        </div>
      )}
      {zoomedImageUrl && (
        <div className={styles.popupOverlay} onClick={() => setZoomedImageUrl("")}>
          <div className={styles.imagePopupContent} onClick={(e) => e.stopPropagation()}>
            <img src={zoomedImageUrl} alt="debt enlarged" className={styles.zoomedDebtImage} />
          </div>
        </div>
      )}
    </div>
  );
}

export default Debts;
