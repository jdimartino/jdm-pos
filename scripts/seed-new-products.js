// scripts/seed-new-products.js — JDM-POS
// Crea categorías nuevas y 15 productos en Firestore
// Uso: node scripts/seed-new-products.js

import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

import { initializeApp } from 'firebase/app'
import {
    getFirestore, collection, addDoc, serverTimestamp,
    getDocs, query, where,
} from 'firebase/firestore'

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
    measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID,
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

const categories = [
    { name: 'Cocadas', color: 'teal', order: 1 },
    { name: 'Comida', color: 'orange', order: 2 },
]

const products = [
    { name: 'Cocada pequeña',              emoji: '🥥', category: 'Cocadas', priceUSD: 4 },
    { name: 'Cocada mediana',              emoji: '🥥', category: 'Cocadas', priceUSD: 6 },
    { name: 'Agua de coco 500 ml',         emoji: '💧', category: 'Cocadas', priceUSD: 3.5 },
    { name: 'Agua de coco 1 L',            emoji: '💧', category: 'Cocadas', priceUSD: 7 },
    { name: 'Yogurt',                      emoji: '🥛', category: 'Otros',   priceUSD: 3 },
    { name: 'Helados',                     emoji: '🍦', category: 'Otros',   priceUSD: 3 },
    { name: 'Galletas de coco',            emoji: '🍪', category: 'Otros',   priceUSD: 2.5 },
    { name: 'Chips de coco',               emoji: '🥨', category: 'Otros',   priceUSD: 2 },
    { name: 'Tequeños',                    emoji: '🌮', category: 'Comida',   priceUSD: 5 },
    { name: 'Sándwich de perfil',          emoji: '🥪', category: 'Comida',   priceUSD: 9 },
    { name: 'Sándwich de roastbeet',       emoji: '🥪', category: 'Comida',   priceUSD: 8 },
    { name: 'Cachapa con queso',           emoji: '🥞', category: 'Comida',   priceUSD: 7 },
    { name: 'Perros jumbo',                emoji: '🌭', category: 'Comida',   priceUSD: 3.5 },
    { name: 'Arepas',                      emoji: '🫓', category: 'Comida',   priceUSD: 6 },
    { name: 'Mixtas',                      emoji: '🍽️', category: 'Comida',   priceUSD: 7 },
]

async function categoryExists(name) {
    const q = query(collection(db, 'categories'), where('name', '==', name))
    const snap = await getDocs(q)
    return !snap.empty
}

async function seed() {
    console.log('📁 Creando categorías...\n')

    for (const cat of categories) {
        const exists = await categoryExists(cat.name)
        if (exists) {
            console.log(`   ⏭️  ${cat.name} ya existe, saltando...`)
            continue
        }
        const ref = await addDoc(collection(db, 'categories'), {
            name: cat.name,
            color: cat.color,
            order: cat.order,
            createdAt: serverTimestamp(),
        })
        console.log(`   ✅ ${cat.name} creada (${cat.color}) — ${ref.id}`)
    }

    console.log(`\n🛒 Insertando ${products.length} productos...\n`)

    const col = collection(db, 'products')
    for (const p of products) {
        const docRef = await addDoc(col, {
            ...p,
            active: true,
            createdAt: serverTimestamp(),
        })
        console.log(`   ✅ ${p.emoji}  ${p.name} — $${p.priceUSD.toFixed(2)}  (${docRef.id})`)
    }

    console.log(`\n🎉 ${products.length} productos insertados.`)
    console.log('   Categorías: Cocadas, Comida, Otros')
    process.exit(0)
}

seed().catch(err => {
    console.error('❌ Error:', err.message)
    process.exit(1)
})
