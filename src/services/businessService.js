// src/services/businessService.js — JDM-POS
// Servicio CRUD para settings/business en Firestore

import {
    doc, getDoc, setDoc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase'

const DOC_REF = () => doc(db, 'settings', 'business')

export async function getBusinessSettings() {
    const snap = await getDoc(DOC_REF())
    if (!snap.exists()) return null
    return { id: snap.id, ...snap.data() }
}

export async function saveBusinessSettings(data) {
    const ref = DOC_REF()
    await setDoc(ref, {
        ...data,
        updatedAt: serverTimestamp(),
    }, { merge: true })
}

export function onBusinessSettings(callback) {
    import('firebase/firestore').then(({ onSnapshot }) => {
        return onSnapshot(DOC_REF(), (snap) => {
            if (!snap.exists()) {
                callback(null)
                return
            }
            callback({ id: snap.id, ...snap.data() })
        }, (err) => {
            console.error('onBusinessSettings error:', err)
            callback(null)
        })
    })
}
