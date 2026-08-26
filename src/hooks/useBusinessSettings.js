// src/hooks/useBusinessSettings.js — JDM-POS
// Hook que escucha settings/business en tiempo real

import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'

export function useBusinessSettings() {
    const [settings, setSettings] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const ref = doc(db, 'settings', 'business')
        const unsub = onSnapshot(ref, (snap) => {
            if (!snap.exists()) {
                setSettings(null)
                setLoading(false)
                return
            }
            setSettings({ id: snap.id, ...snap.data() })
            setLoading(false)
        }, (err) => {
            console.error('useBusinessSettings error:', err)
            setSettings(null)
            setLoading(false)
        })
        return unsub
    }, [])

    return { settings, loading }
}
