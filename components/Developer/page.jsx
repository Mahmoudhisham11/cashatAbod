'use client';
import styles from "./styles.module.css";
import { IoIosCloseCircle } from "react-icons/io";

function Developer({openDev, setOpenDev}) {
    return(
        <div className={openDev ? "shadowBox active" : "shadowBox"}>
            <div className="box">
                <button className={styles.closeBtn} onClick={() => setOpenDev(false)}><IoIosCloseCircle/></button>
                <h2>معلومات عن المطور</h2>
                <div className={styles.boxinfo}>
                    <p><strong>الاسم</strong> : محمود هشام</p>
                    <p><strong>الهاتف</strong> : 01124514331</p>
                    <p><strong>واتساب</strong> : 01097025743</p>
                    <p><strong>البريد الالكتروني</strong> : mh8011651@gmail.com</p>
                </div>
            </div>
        </div>
    )
}

export default Developer;