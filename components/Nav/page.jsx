"use client";
import styles from "./style.module.css";
import Link from "next/link";
import { TbReportSearch } from "react-icons/tb";
import { FaListAlt } from "react-icons/fa";
import { FaGear } from "react-icons/fa6";
import { useEffect, useState } from "react";

function Nav() {
    const [userEmail, setUserEmail] = useState('') 

    useEffect(() => {
        if(typeof window !== 'undefined') {
            setUserEmail(localStorage.getItem('email'))
        }
    }, [])

    return(
        <nav className={styles.nav}>
            <Link href={"/reports"} className={styles.navLink}>
                <span><TbReportSearch/></span>
                <span>التقارير</span>
            </Link>
            <Link href={"/debts"} className={styles.navLink}>
                <span><FaListAlt/></span>
                <span>الديون</span>
            </Link>
            <Link href={"/sittings"} className={styles.navLink}>
                <span><FaGear/></span>
                <span>الاعدادات</span>
            </Link>
        </nav>
    )
}

export default Nav;