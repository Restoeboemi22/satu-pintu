import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  trend?: {
    value: number;
    label: string;
    positive?: boolean;
  };
  color?: "blue" | "green" | "red" | "yellow" | "purple";
}

export default function StatsCard({ title, value, icon: Icon, description, trend, color = "blue" }: StatsCardProps) {
  const cardStyles = {
    blue: {
      bg: "bg-gradient-to-br from-slate-900/90 to-slate-900/70 border-slate-700/50 shadow-xl",
      textPrimary: "text-slate-100",
      textSecondary: "text-slate-400",
      iconBg: "bg-blue-600/30 border border-blue-500/30",
      iconColor: "text-blue-400"
    },
    green: {
      bg: "bg-gradient-to-br from-slate-900/90 to-slate-900/70 border-slate-700/50 shadow-xl",
      textPrimary: "text-slate-100",
      textSecondary: "text-slate-400",
      iconBg: "bg-green-600/30 border border-green-500/30",
      iconColor: "text-green-400"
    },
    red: {
      bg: "bg-gradient-to-br from-slate-900/90 to-slate-900/70 border-slate-700/50 shadow-xl",
      textPrimary: "text-slate-100",
      textSecondary: "text-slate-400",
      iconBg: "bg-red-600/30 border border-red-500/30",
      iconColor: "text-red-400"
    },
    yellow: {
      bg: "bg-gradient-to-br from-slate-900/90 to-slate-900/70 border-slate-700/50 shadow-xl",
      textPrimary: "text-slate-100",
      textSecondary: "text-slate-400",
      iconBg: "bg-yellow-600/30 border border-yellow-500/30",
      iconColor: "text-yellow-400"
    },
    purple: {
      bg: "bg-gradient-to-br from-slate-900/90 to-slate-900/70 border-slate-700/50 shadow-xl",
      textPrimary: "text-slate-100",
      textSecondary: "text-slate-400",
      iconBg: "bg-purple-600/30 border border-purple-500/30",
      iconColor: "text-purple-400"
    },
  }[color];

  return (
    <div className={`rounded-3xl ${cardStyles.bg} p-6 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 border backdrop-blur-xl`}>
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-sm font-bold uppercase tracking-wide ${cardStyles.textSecondary}`}>{title}</p>
          <p className={`mt-3 text-4xl font-black ${cardStyles.textPrimary}`}>{value}</p>
        </div>
        <div className={`${cardStyles.iconBg} rounded-2xl p-4 backdrop-blur-sm shadow-inner`}>
          <Icon className={`h-7 w-7 ${cardStyles.iconColor}`} />
        </div>
      </div>
      
      {(description || trend) && (
        <div className={`mt-5 flex items-center text-sm ${cardStyles.textSecondary}`}>
          {trend && (
            <span className={`flex items-center font-bold text-white bg-slate-800/50 px-2.5 py-1 rounded-lg border border-slate-700/30`}>
              {trend.positive ? "+" : ""}{trend.value}%
            </span>
          )}
          <span className={`font-medium ${trend ? "ml-3" : ""}`}>
            {trend ? trend.label : description}
          </span>
        </div>
      )}
    </div>
  );
}
