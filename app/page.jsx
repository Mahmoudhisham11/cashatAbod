"use client";
import { useEffect, useState } from "react";
import Login from "../components/Login/page";
import Main from "../components/Main/page";

export default function Home() {
  const [logedin, setLogedin] = useState(false)

  useEffect(() => {
    if(typeof window !== "undefined") {
      const storageEmail = localStorage.getItem("email")
      if(storageEmail) {
        setLogedin(true)
      }
    }
  }, [])

  return (
    <div className="main">
      {logedin ? <Main/> : <Login/>}
    </div>
  );
}