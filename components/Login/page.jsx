"use client";
import { useState } from "react";
import styles from "./styles.module.css";
import { db } from "../../app/firebase";
import { addDoc, collection, getDocs, query, serverTimestamp, where, updateDoc, doc } from "firebase/firestore";

function Login() {
  const [acitve, setActive] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // ✅ State للتحكم في Popup
  const [showPopup, setShowPopup] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [step, setStep] = useState(1); // 1 = إدخال إيميل, 2 = إدخال OTP وباسورد جديد
  const [otp, setOtp] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // CREATE NEW ACCOUNT
  const handleCreatAcc = async () => {
    if (name !== "" && email !== "" && password !== "") {
      const userRef = collection(db, "users");
      const q = query(userRef, where("email", "==", email));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        await addDoc(userRef, {
          name,
          email,
          password,
          date: serverTimestamp(),
        });
        alert("✅ تم انشاء حساب جديد");
        setName("");
        setEmail("");
        setPassword("");
      } else {
        alert("⚠️ المستخدم موجود بالفعل");
      }
    }
  };

  // CHECK ACCOUNT AND LOGIN
  const handleLogin = async () => {
    const userRef = collection(db, "users");
    const q = query(userRef, where("email", "==", email));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      alert("❌ يوجد مشكلة في البريد الالكتروني");
    } else {
      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();
      if (userData.password !== password) {
        alert("❌ يوجد مشكلة في كلمة المرور");
      } else {
          if (typeof window !== "undefined") {
            localStorage.setItem("email", email);
            localStorage.setItem("name", userData.name);
          }
          if (typeof window !== "undefined") {
            window.location.reload();
          }
        }
      }
  };

  // ✅ إرسال OTP
  const handleSendOtp = async () => {
    if (!resetEmail) {
      alert("من فضلك ادخل البريد الالكتروني");
      return;
    }

    const userRef = collection(db, "users");
    const q = query(userRef, where("email", "==", resetEmail));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      alert("❌ هذا البريد غير مسجل لدينا");
      return;
    }

    // توليد OTP
    const randomOtp = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(randomOtp);

    alert("🔑 كود التحقق الخاص بك هو: " + randomOtp);
    setStep(2); // الانتقال للخطوة التالية
  };

  // ✅ التحقق وتحديث الباسورد
  const handleResetPassword = async () => {
    if (otp !== generatedOtp) {
      alert("❌ الكود غير صحيح");
      return;
    }

    if (newPassword.length < 6) {
      alert("⚠️ كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }

    const userRef = collection(db, "users");
    const q = query(userRef, where("email", "==", resetEmail));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const userDoc = querySnapshot.docs[0];
      const userDocRef = doc(db, "users", userDoc.id);

      await updateDoc(userDocRef, { password: newPassword });

      alert("✅ تم تغيير كلمة المرور بنجاح");
      setShowPopup(false);
      setResetEmail("");
      setOtp("");
      setNewPassword("");
      setStep(1);
    }
  };

  return (
    <div className={styles.loginContainer}>
      <div className={styles.title}>
        <h2>مرحبا بعودتك</h2>
        <p>برجاء تسجيل الدخول</p>
      </div>
      <div className={styles.Content}>
        <div className={styles.btnsContainer}>
          <div className={styles.btns}>
            <button
              className={acitve ? `${styles.active}` : ""}
              onClick={() => setActive(true)}
            >
              تسجيل الدخول
            </button>
            <button
              className={acitve ? "" : `${styles.active}`}
              onClick={() => setActive(false)}
            >
              انشاء حساب
            </button>
          </div>
        </div>
        {acitve ? (
          <div className={styles.form}>
            <div className="inputContainer">
              <label>البريد الالكتروني :</label>
              <input
                type="email"
                placeholder="ادخل بريدك الالكتروني"
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="inputContainer">
              <label>كلمة المرور :</label>
              <input
                type="password"
                placeholder="ادخل كلمة المرور الخاصة بك"
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className={styles.forgetBtn}>
              <button
                onClick={() => setShowPopup(true)}
                className={styles.forgetLink}
              >
                هل نسيت كلمة المرور؟
              </button>
            </div>
            <button className={styles.fromBtn} onClick={handleLogin}>
              تسجيل الدخول
            </button>
          </div>
        ) : (
          <div className={styles.form}>
            <div className="inputContainer">
              <label>اسم المستخدم</label>
              <input
                type="text"
                value={name}
                placeholder="ادخل اسمك باللغة العربية"
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="inputContainer">
              <label>البريد الالكتروني : </label>
              <input
                type="email"
                value={email}
                placeholder="ادخل بريدك الالكتروني"
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="inputContainer">
              <label>كلمة المرور :</label>
              <input
                type="password"
                value={password}
                placeholder="ادخل كلمة المرور الخاصة بك"
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button className={styles.fromBtn} onClick={handleCreatAcc}>
              انشاء حساب جديد
            </button>
          </div>
        )}
      </div>

      {/* ✅ Popup */}
      {showPopup && (
        <div className={styles.popupOverlay}>
          <div className={styles.popupContent}>
            {step === 1 && (
              <>
                <h3>إعادة تعيين كلمة المرور</h3>
                <input
                  type="email"
                  placeholder="ادخل بريدك الالكتروني"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                />
                <div className={styles.popupButtons}>
                  <button onClick={handleSendOtp}>إرسال OTP</button>
                  <button onClick={() => setShowPopup(false)}>الغاء</button>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <h3>تأكيد الكود وتغيير كلمة المرور</h3>
                <input
                  type="text"
                  placeholder="ادخل كود OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                />
                <input
                  type="password"
                  placeholder="ادخل كلمة المرور الجديدة"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <div className={styles.popupButtons}>
                  <button onClick={handleResetPassword}>تغيير كلمة المرور</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Login;
