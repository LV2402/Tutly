"use client";
import Link from "next/link";

interface Props {
  items: {
    name: string;
    icon: any;
    path: string;
    isActive: boolean;
  }[];
  menu: boolean;
  setMenu: (menu: boolean) => void;
}

export default function Sidebar({ items, menu, setMenu }: Props) {
  return (
    <div
      className={`${
        !menu && "max-sm:hidden max-sm:pt-12"
      } p-3 -mt-3 bg-background absolute sm:fixed left-0 sm:top-14 z-40  min-h-dvh px-2 shadow-sm shadow-blue-800/40`}
    >
      {items.map((item) => {
        return (
          <div key={item.path}>
            <Link
              href={item.path}
              onClick={() =>  setMenu(false)}
              key={item.path}
              className={`${item.isActive ? "bg-blue-600 text-white" : "hover:bg-blue-500 hover:text-white"} m-auto rounded md:hidden px-4 py-3 my-2 flex items-center gap-4 cursor-pointer`}
            >
              <div className={`text-2xl px-2`}>{item.icon}</div>
              <h1 className={`${!menu && "hidden"}`}>{item.name}</h1>
            </Link>
            <Link
              href={item.path}
              key={item.path}
              className={`${item.isActive ? "bg-blue-600 text-white" : "hover:bg-blue-500 hover:text-white"} m-auto rounded hidden md:flex px-3 py-3 my-2 items-center gap-4 cursor-pointer`}
            >
              <div className={`text-2xl px-2`}>{item.icon}</div>
              <h1 className={`${!menu && "hidden"}`}>{item.name}</h1>
            </Link>
          </div>
        );
      })}
    </div>
  );
}
