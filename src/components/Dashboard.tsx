'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useNotifications } from '@/contexts/NotificationContext'
import Navigation from './Navigation'
import NotificationBar from './NotificationBar'
import SalesPage from './pages/SalesPage'
import ReportsPage from './pages/ReportsPage'
import InventoryPage from './pages/InventoryPage'
import EarningsPage from './pages/EarningsPage'
import OPEXPage from './pages/OPEXPage'
import SettingsPage from './pages/SettingsPage'

type NavPage = 'sales' | 'reports' | 'inventory' | 'earnings' | 'opex' | 'settings'

export default function Dashboard() {
  const { user } = useAuth()
  const { checkStorage } = useNotifications()
  const [activePage, setActivePage] = useState<NavPage>('sales')

  useEffect(() => {
    checkStorage()
    // Check storage periodically
    const interval = setInterval(checkStorage, 60000)
    return () => clearInterval(interval)
  }, [checkStorage])

  // Cashier can only access Sales
  const isCashier = user?.role === 'cashier'

  const renderPage = () => {
    // Cashier can only access Sales and Reports
    if (isCashier && activePage !== 'sales' && activePage !== 'reports') {
      setActivePage('sales')
      return <SalesPage />
    }

    switch (activePage) {
      case 'sales':
        return <SalesPage />
      case 'reports':
        return <ReportsPage />
      case 'inventory':
        return <InventoryPage />
      case 'earnings':
        return <EarningsPage />
      case 'opex':
        return <OPEXPage />
      case 'settings':
        return <SettingsPage />
      default:
        return <SalesPage />
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] flex flex-col">
      {/* Notification Bar - Fixed at top */}
      <NotificationBar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Navigation - Sidebar on desktop, bottom bar on mobile */}
        <Navigation
          activePage={activePage}
          setActivePage={setActivePage}
          isCashier={isCashier}
        />

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6 overflow-auto">
          {renderPage()}
        </main>
      </div>
    </div>
  )
}
