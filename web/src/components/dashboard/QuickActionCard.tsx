import Link from "next/link";
import { LucideIcon } from "lucide-react";

interface QuickActionCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  color?: "blue" | "green" | "red" | "yellow" | "purple" | "indigo";
}

export default function QuickActionCard({ title, description, icon: Icon, href, color = "blue" }: QuickActionCardProps) {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white",
    green: "bg-green-50 text-green-600 group-hover:bg-green-600 group-hover:text-white",
    red: "bg-red-50 text-red-600 group-hover:bg-red-600 group-hover:text-white",
    yellow: "bg-yellow-50 text-yellow-600 group-hover:bg-yellow-600 group-hover:text-white",
    purple: "bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white",
    indigo: "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white",
  };

  return (
    <Link href={href} className="group relative flex flex-col justify-between overflow-hidden rounded-xl bg-white p-6 shadow-sm border border-gray-100 transition-all hover:shadow-md">
      <div>
        <div className={`mb-4 inline-flex rounded-lg p-3 transition-colors ${colorClasses[color]}`}>
          <Icon className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>
      <div className="mt-4 flex items-center text-sm font-medium text-blue-600 group-hover:text-blue-700">
        Akses Fitur
        <svg className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}
