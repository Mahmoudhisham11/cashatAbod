"use client";
import styles from "./style.module.css";
import Link from "next/link";
import { TbReportSearch } from "react-icons/tb";
import { FaHome, FaListAlt } from "react-icons/fa";
import { FaGear } from "react-icons/fa6";
import { MdOutlineDevices } from "react-icons/md";
import { usePathname } from "next/navigation";

function Nav() {
    const pathname = usePathname();
    const links = [
        { href: "/", label: "الرئيسية", icon: <FaHome/> },
        { href: "/reports", label: "التقارير", icon: <TbReportSearch/> },
        { href: "/debts", label: "الديون", icon: <FaListAlt/> },
        { href: "/machines", label: "الماكينات", icon: <MdOutlineDevices/> },
        { href: "/sittings", label: "الاعدادات", icon: <FaGear/> },
    ];

    return(
        <nav className={styles.nav}>
            {links.map((item) => (
                <Link
                    key={item.href}
                    href={item.href}
                    className={`${styles.navLink} ${pathname === item.href ? styles.active : ""}`}
                >
                    <span className={styles.icon}>{item.icon}</span>
                    <span>{item.label}</span>
                </Link>
            ))}
        </nav>
    )
}

export default Nav;