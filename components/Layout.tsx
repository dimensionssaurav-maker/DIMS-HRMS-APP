
import React, { useState, useRef, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  CalendarCheck, 
  IndianRupee, 
  FileBarChart,
  LogOut,
  Bell,
  ReceiptIndianRupee,
  X,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  UserPlus,
  Clock,
  Briefcase,
  CalendarDays,
  Banknote,
  Landmark,
  Settings
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  type: 'payroll' | 'expense' | 'onboarding' | 'system';
  read: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab }) => {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      title: 'Payroll Processed',
      message: 'October 2024 payroll generation is complete for 4 employees.',
      time: '2 hours ago',
      type: 'payroll',
      read: false
    },
    {
      id: '2',
      title: 'New Expense Logged',
      message: 'Office rent for October has been recorded with receipt.',
      time: '5 hours ago',
      type: 'expense',
      read: false
    },
    {
      id: '3',
      title: 'Onboarding Pending',
      message: 'New draft for Arjun Sharma requires document verification.',
      time: '1 day ago',
      type: 'onboarding',
      read: true
    },
    {
      id: '4',
      title: 'System Update',
      message: 'ZenHR has been updated to v2.4 with enhanced ESIC reporting.',
      time: '2 days ago',
      type: 'system',
      read: true
    }
  ]);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'employees', label: 'Employees', icon: Users },
    { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
    { id: 'leaves', label: 'Leave Management', icon: CalendarDays },
    { id: 'shifts', label: 'Shift Management', icon: Clock },
    { id: 'overtime', label: 'Overtime', icon: Clock },
    { id: 'payroll', label: 'Payroll', icon: IndianRupee },
    { id: 'statutory', label: 'Statutory (ESIC/LWF)', icon: Landmark },
    { id: 'loans', label: 'Loans & Advances', icon: Banknote },
    { id: 'expenses', label: 'Expenses', icon: ReceiptIndianRupee },
    { id: 'reports', label: 'Reports', icon: FileBarChart },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const unreadCount = notifications.filter(n => !n.read).length;

  // Close notifications on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'payroll': return <IndianRupee size={16} className="text-emerald-600" />;
      case 'expense': return <CreditCard size={16} className="text-rose-600" />;
      case 'onboarding': return <UserPlus size={16} className="text-indigo-600" />;
      default: return <AlertCircle size={16} className="text-amber-600" />;
    }
  };

  const getNotificationBg = (type: string) => {
    switch (type) {
      case 'payroll': return 'bg-emerald-50';
      case 'expense': return 'bg-rose-50';
      case 'onboarding': return 'bg-indigo-50';
      default: return 'bg-amber-50';
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col hidden md:flex">
        <div className="p-6 border-b border-slate-100">
          <h1 className="text-2xl font-bold text-indigo-600 flex items-center gap-2">
            <span className="bg-indigo-600 text-white p-1 rounded-lg">Zen</span>
            HRMS
          </h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            // Handle duplicate icon for shift/overtime visually if needed, but logic is fine
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  activeTab === item.id 
                    ? 'bg-indigo-50 text-indigo-700 shadow-sm' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <button className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-50 rounded-xl transition-all">
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 z-[100]">
          <h2 className="text-lg font-semibold text-slate-800 capitalize">
            {activeTab.replace('-', ' ')}
          </h2>
          <div className="flex items-center gap-4">
            {/* Notification Bell with Dropdown */}
            <div className="relative" ref={notificationRef}>
              <button 
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className={`p-2 rounded-xl transition-all relative ${isNotificationsOpen ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {isNotificationsOpen && (
                <div className="absolute right-0 mt-3 w-80 bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                  <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-800">Notifications</h3>
                    <button 
                      onClick={markAllAsRead}
                      className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest hover:text-indigo-800 transition-colors"
                    >
                      Mark all as read
                    </button>
                  </div>
                  
                  <div className="max-h-[400px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 text-xs">
                        No new notifications
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <div 
                          key={notif.id} 
                          className={`p-4 border-b border-slate-50 flex gap-3 hover:bg-slate-50/50 transition-colors cursor-pointer ${!notif.read ? 'bg-white' : 'opacity-60'}`}
                        >
                          <div className={`p-2 h-fit rounded-xl ${getNotificationBg(notif.type)}`}>
                            {getNotificationIcon(notif.type)}
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex justify-between items-start">
                              <h4 className="text-xs font-bold text-slate-800">{notif.title}</h4>
                              {!notif.read && <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div>}
                            </div>
                            <p className="text-[11px] text-slate-500 leading-relaxed">{notif.message}</p>
                            <div className="flex items-center gap-1 text-[9px] text-slate-400 font-medium pt-1">
                              <Clock size={10} />
                              {notif.time}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  
                  <button className="w-full py-3 text-xs font-bold text-slate-500 bg-white hover:bg-slate-50 transition-colors border-t border-slate-50">
                    View All Notifications
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
              <img src="https://picsum.photos/seed/admin/40/40" className="w-8 h-8 rounded-full border border-slate-200" alt="avatar" />
              <div className="text-sm">
                <p className="font-medium text-slate-700">Admin User</p>
                <p className="text-xs text-slate-400 leading-none">Super Admin</p>
              </div>
            </div>
          </div>
        </header>

        {/* Viewport */}
        <div className="flex-1 overflow-y-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
