// @ts-nocheck
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { auth } from './api'

interface User { id: number; email: string; name: string; role: 'teacher' | 'student'; mssv?: string }
interface AuthCtx { user: User | null; loading: boolean; login: (email: string, password: string) => Promise<void>; logout: () => void }

const AuthContext = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { setLoading(false); return }
    auth.me().then((u: User) => setUser(u)).catch(() => localStorage.removeItem('token')).finally(() => setLoading(false))
  }, [])

  const login = async (email: string, password: string) => {
    const res: any = await auth.login(email, password)
    localStorage.setItem('token', res.token)
    setUser(res.user)
  }

  const logout = () => { localStorage.removeItem('token'); setUser(null) }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>
}

export const useAuth = () => { const ctx = useContext(AuthContext); if (!ctx) throw new Error('useAuth outside AuthProvider'); return ctx }
